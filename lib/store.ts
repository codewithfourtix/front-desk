/**
 * Frontdesk local store.
 *
 * Maps our public "desk" (a host profile + scope config) to the underlying
 * Aicoo share link, and logs the conversations that happen at each desk so the
 * dashboard can show an inbox + analytics.
 *
 * Persisted as JSON under `.data/` so it survives `next dev` restarts. This is a
 * deliberately simple single-process store — perfect for the hackathon demo,
 * and trivially swappable for a real DB later (same function surface).
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

// ── Persistence ──────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "frontdesk.json");

let cache: DB | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<DB> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    cache = JSON.parse(raw) as DB;
  } catch {
    cache = { desks: [], conversations: [] };
  }
  return cache;
}

async function persist(): Promise<void> {
  // Serialize writes so concurrent requests don't clobber the file.
  writeQueue = writeQueue.then(async () => {
    if (!cache) return;
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(cache, null, 2), "utf8");
  });
  return writeQueue;
}

// ── Ids ──────────────────────────────────────────────────────────────────────

/** Short, URL-safe, lowercase token (collision-checked by caller domain). */
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
  const db = await load();
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
  await persist();
  return desk;
}

export async function listDesks(): Promise<Desk[]> {
  const db = await load();
  return db.desks;
}

export async function getDeskByToken(token: string): Promise<Desk | undefined> {
  const db = await load();
  return db.desks.find((d) => d.token === token);
}

export async function getDeskById(id: string): Promise<Desk | undefined> {
  const db = await load();
  return db.desks.find((d) => d.id === id);
}

export async function updateDesk(
  id: string,
  patch: Partial<Pick<Desk, "profile" | "share" | "revoked" | "expiry">>
): Promise<Desk | undefined> {
  const db = await load();
  const desk = db.desks.find((d) => d.id === id);
  if (!desk) return undefined;
  Object.assign(desk, patch);
  await persist();
  return desk;
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
  const db = await load();
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
  await persist();
  return convo;
}

export async function getConversation(
  id: string
): Promise<Conversation | undefined> {
  const db = await load();
  return db.conversations.find((c) => c.id === id);
}

export async function appendMessage(
  conversationId: string,
  msg: Omit<DeskMessage, "id" | "ts"> & { ts?: string }
): Promise<DeskMessage | undefined> {
  const db = await load();
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
  await persist();
  return full;
}

export async function conversationsForDesk(
  deskId: string
): Promise<Conversation[]> {
  const db = await load();
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
