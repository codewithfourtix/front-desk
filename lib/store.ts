/**
 * Frontdesk local store.
 *
 * Maps our public "desk" (a host profile + scope config) to the underlying
 * Aicoo share link, and logs the conversations that happen at each desk so the
 * dashboard can show an inbox + analytics.
 *
 * Persisted as JSON under `.data/`. IMPORTANT: reads always hit disk fresh — in
 * Next dev the page bundle and the route-handler bundle are separate module
 * graphs, so a long-lived in-memory cache goes stale across them (the classic
 * "created it but the page says not found" bug). Writes are serialized through
 * an in-process lock so concurrent read-modify-write cycles don't clobber.
 *
 * Single-process, file-backed, dependency-free — ideal for the hackathon and
 * trivially swappable for a real DB later (same function surface).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ShareAccess,
  ShareExpiry,
  ShareScope,
  NotesAccess,
  ShareIdentity,
  ShareAnalytics,
} from "./aicoo/types";

export interface DeskProfile {
  /** Host display name, e.g. "Ali Zulfiqar". */
  name: string;
  /** Host role/sub-line, e.g. "Co-founder, Fourtix". */
  role: string;
  /** One-line greeting shown at the top of the desk. */
  headline: string;
  /**
   * Free-text the agent answers from — bio, pricing, availability, links, FAQs.
   * In live mode this is also synced to Aicoo context; in mock mode the
   * simulated COO reasons over it directly.
   */
  context: string;
  /** Whether the desk offers to book meetings. */
  bookingEnabled: boolean;
  /** Optional accent override (hex). Falls back to clay. */
  accent?: string;
}

export interface DeskShareConfig {
  scope: ShareScope;
  access: ShareAccess;
  expiresIn: ShareExpiry;
  notesAccess: NotesAccess;
  identity: ShareIdentity;
}

export interface Desk {
  id: string;
  /** Public token used in /c/[token]. Short + URL-safe. */
  token: string;
  /** Aicoo share link id (real in live mode, synthetic in mock). */
  linkId: string;
  /** Aicoo-side agent URL, when available. */
  agentUrl?: string;
  profile: DeskProfile;
  share: DeskShareConfig;
  /** ISO expiry. */
  expiry: string;
  createdAt: string;
  revoked?: boolean;
}

export type MessageRole = "visitor" | "agent";

export interface DeskMessage {
  id: string;
  role: MessageRole;
  text: string;
  ts: string;
  /** Tool calls the agent fired while producing this message. */
  tools?: string[];
  /** Marks a confirmed booking, for the dashboard to highlight. */
  booking?: boolean;
}

export interface Conversation {
  id: string;
  deskId: string;
  /** Friendly label for the visitor, e.g. "Visitor · a1b2". */
  visitorLabel: string;
  startedAt: string;
  lastAt: string;
  messages: DeskMessage[];
}

interface DB {
  desks: Desk[];
  conversations: Conversation[];
}

// ── Persistence (fresh reads + serialized writes) ────────────────────────────

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "frontdesk.json");

async function readDB(): Promise<DB> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<DB>;
    return {
      desks: parsed.desks ?? [],
      conversations: parsed.conversations ?? [],
    };
  } catch {
    return { desks: [], conversations: [] };
  }
}

async function writeDB(db: DB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Write atomically: temp file + rename, so a reader never sees a half file.
  const tmp = `${DB_FILE}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DB_FILE);
}

let lock: Promise<unknown> = Promise.resolve();

/** Serialize a read-modify-write cycle so concurrent mutations don't race. */
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  // Keep the chain alive regardless of individual outcomes.
  lock = run.then(
    () => undefined,
    () => undefined
  );
  return run as Promise<T>;
}

// ── Ids ──────────────────────────────────────────────────────────────────────

/** Short, URL-safe, lowercase token. */
export function shortToken(len = 10): string {
  return randomUUID().replace(/-/g, "").slice(0, len);
}

// ── Desk operations ──────────────────────────────────────────────────────────

export async function createDesk(input: {
  token: string;
  linkId: string;
  agentUrl?: string;
  profile: DeskProfile;
  share: DeskShareConfig;
  expiry: string;
}): Promise<Desk> {
  return withLock(async () => {
    const db = await readDB();
    const desk: Desk = {
      id: randomUUID(),
      token: input.token,
      linkId: input.linkId,
      agentUrl: input.agentUrl,
      profile: input.profile,
      share: input.share,
      expiry: input.expiry,
      createdAt: new Date().toISOString(),
    };
    db.desks.unshift(desk);
    await writeDB(db);
    return desk;
  });
}

export async function listDesks(): Promise<Desk[]> {
  const db = await readDB();
  return db.desks;
}

export async function getDeskByToken(token: string): Promise<Desk | undefined> {
  const db = await readDB();
  return db.desks.find((d) => d.token === token);
}

export async function getDeskById(id: string): Promise<Desk | undefined> {
  const db = await readDB();
  return db.desks.find((d) => d.id === id);
}

export async function updateDesk(
  id: string,
  patch: Partial<Pick<Desk, "profile" | "share" | "revoked" | "expiry">>
): Promise<Desk | undefined> {
  return withLock(async () => {
    const db = await readDB();
    const desk = db.desks.find((d) => d.id === id);
    if (!desk) return undefined;
    Object.assign(desk, patch);
    await writeDB(db);
    return desk;
  });
}

export async function revokeDesk(id: string): Promise<boolean> {
  const desk = await updateDesk(id, { revoked: true });
  return Boolean(desk);
}

// ── Conversation operations ──────────────────────────────────────────────────

export async function startConversation(
  deskId: string,
  visitorLabel: string
): Promise<Conversation> {
  return withLock(async () => {
    const db = await readDB();
    const now = new Date().toISOString();
    const convo: Conversation = {
      id: randomUUID(),
      deskId,
      visitorLabel,
      startedAt: now,
      lastAt: now,
      messages: [],
    };
    db.conversations.unshift(convo);
    await writeDB(db);
    return convo;
  });
}

export async function getConversation(
  id: string
): Promise<Conversation | undefined> {
  const db = await readDB();
  return db.conversations.find((c) => c.id === id);
}

export async function appendMessage(
  conversationId: string,
  msg: Omit<DeskMessage, "id" | "ts"> & { ts?: string }
): Promise<DeskMessage | undefined> {
  return withLock(async () => {
    const db = await readDB();
    const convo = db.conversations.find((c) => c.id === conversationId);
    if (!convo) return undefined;
    const full: DeskMessage = {
      id: randomUUID(),
      ts: msg.ts ?? new Date().toISOString(),
      role: msg.role,
      text: msg.text,
      tools: msg.tools,
      booking: msg.booking,
    };
    convo.messages.push(full);
    convo.lastAt = full.ts;
    await writeDB(db);
    return full;
  });
}

export async function conversationsForDesk(
  deskId: string
): Promise<Conversation[]> {
  const db = await readDB();
  return db.conversations
    .filter((c) => c.deskId === deskId)
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

/**
 * Locally-computed analytics, used in mock mode and as a fallback when the live
 * /share/list call is unavailable. Shape matches Aicoo's analytics so the
 * dashboard renders identically either way.
 */
export async function analyticsForDesk(
  deskId: string
): Promise<ShareAnalytics> {
  const convos = await conversationsForDesk(deskId);
  const messageCount = convos.reduce(
    (n, c) => n + c.messages.filter((m) => m.role === "visitor").length,
    0
  );
  return {
    uniqueVisitors: convos.length,
    conversationCount: convos.length,
    messageCount,
  };
}
