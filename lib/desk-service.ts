/**
 * Desk service — the orchestration layer between route handlers and the
 * store / Aicoo facade. Routes stay thin; all the "create a desk = make a share
 * link + persist + sync context" logic lives here.
 */

import {
  createShareLink,
  revokeShareLink,
  liveShareList,
  syncDeskContext,
  validateAicooKey,
} from "./aicoo";
import type {
  CreateShareInput,
  ShareAccess,
  ShareExpiry,
  ShareScope,
  NotesAccess,
} from "./aicoo/types";
import {
  createDesk as storeCreateDesk,
  listDesks,
  getDeskById,
  updateDesk as storeUpdateDesk,
  analyticsForDesk,
  conversationsForDesk,
  bookingsForDesk,
  shortToken,
  type Desk,
  type DeskProfile,
  type DeskShareConfig,
} from "./store";
import { config } from "./config";

const ACCESS: ShareAccess[] = ["read", "read_calendar", "read_calendar_write"];
const SCOPES: ShareScope[] = ["all", "folders"];
const EXPIRIES: ShareExpiry[] = ["1h", "24h", "7d", "30d"];
const NOTES: NotesAccess[] = ["read", "write", "edit"];

export interface CreateDeskPayload {
  profile: Partial<DeskProfile>;
  share?: Partial<DeskShareConfig>;
  /** Optional host-supplied Aicoo API key (BYOK). Server-only. */
  aicooKey?: string;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function str(v: unknown, field: string, max = 4000): string {
  if (typeof v !== "string") throw new ValidationError(`${field} is required`);
  const t = v.trim();
  if (!t) throw new ValidationError(`${field} cannot be empty`);
  if (t.length > max)
    throw new ValidationError(`${field} is too long (max ${max} chars)`);
  return t;
}

function pick<T>(v: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function normalizeProfile(p: Partial<DeskProfile>): DeskProfile {
  return {
    name: str(p.name, "Name", 80),
    role: typeof p.role === "string" ? p.role.trim().slice(0, 120) : "",
    headline: str(p.headline, "Headline", 200),
    context: str(p.context, "Context", 8000),
    bookingEnabled: p.bookingEnabled !== false,
    accent:
      typeof p.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(p.accent)
        ? p.accent
        : undefined,
  };
}

function normalizeShare(
  s: Partial<DeskShareConfig> | undefined,
  bookingEnabled: boolean
): DeskShareConfig {
  // If booking is on, the link needs calendar-write; otherwise read is enough.
  const defaultAccess: ShareAccess = bookingEnabled
    ? "read_calendar_write"
    : "read";
  return {
    scope: pick(s?.scope, SCOPES, "all"),
    access: pick(s?.access, ACCESS, defaultAccess),
    expiresIn: pick(s?.expiresIn, EXPIRIES, "7d"),
    notesAccess: pick(s?.notesAccess, NOTES, "read"),
    identity: {
      loadCoo: s?.identity?.loadCoo !== false,
      loadUser: s?.identity?.loadUser !== false,
      loadPolicy: s?.identity?.loadPolicy !== false,
    },
  };
}

// NOTE: omits `aicooKey` — the host's secret must NEVER reach the client. All
// views are built through `toView`, which strips it.
export interface DeskView extends Omit<Desk, "aicooKey"> {
  publicUrl: string;
  analytics: { uniqueVisitors: number; conversationCount: number; messageCount: number };
  bookings: number;
  /** True when this desk runs on the host's own Aicoo key (their calendar). */
  byok: boolean;
  live: boolean;
}

function publicUrl(token: string): string {
  return `${config.appUrl}/c/${token}`;
}

/** Build a client-safe view, stripping the server-only Aicoo key. */
function toView(
  desk: Desk,
  extra: { analytics: DeskView["analytics"]; bookings: number; live: boolean }
): DeskView {
  const { aicooKey, ...safe } = desk;
  return {
    ...safe,
    publicUrl: publicUrl(desk.token),
    byok: Boolean(aicooKey),
    ...extra,
  };
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createDesk(payload: CreateDeskPayload): Promise<DeskView> {
  const profile = normalizeProfile(payload.profile);
  const share = normalizeShare(payload.share, profile.bookingEnabled);

  // Optional BYOK: the host's own Aicoo key, so this desk runs on their account.
  const aicooKey = await normalizeAicooKey(payload.aicooKey);

  const shareInput: CreateShareInput = {
    scope: share.scope,
    access: share.access,
    label: `Frontdesk · ${profile.name}`,
    expiresIn: share.expiresIn,
    notesAccess: share.notesAccess,
    identity: share.identity,
  };

  const link = await createShareLink(shareInput, aicooKey);
  const token = shortToken(10);

  const desk = await storeCreateDesk({
    token,
    linkId: link.linkId,
    agentUrl: link.agentUrl,
    profile,
    share,
    expiry: link.expiry,
    aicooKey,
  });

  // Best-effort: push context to Aicoo so the live agent can answer from it.
  void syncDeskContext(desk);

  return toView(desk, {
    analytics: await analyticsForDesk(desk.id),
    bookings: 0,
    live: Boolean(aicooKey) || !link.linkId.startsWith("mock_"),
  });
}

/**
 * Validate and normalize a host-supplied Aicoo key. Returns `undefined` when no
 * key was given (the desk then uses the server's global key). Throws a clear
 * ValidationError when the key is malformed or rejected by Aicoo.
 */
async function normalizeAicooKey(
  raw: unknown
): Promise<string | undefined> {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string")
    throw new ValidationError("Aicoo API key must be text");
  const key = raw.trim();
  if (!key) return undefined;
  if (!/^aicoo_sk_/.test(key))
    throw new ValidationError(
      "That doesn't look like an Aicoo key — they start with \"aicoo_sk_\"."
    );
  const ok = await validateAicooKey(key);
  if (!ok)
    throw new ValidationError(
      "That Aicoo API key was rejected — double-check it and try again."
    );
  return key;
}

// ── List (with analytics) ────────────────────────────────────────────────────

export async function listDeskViews(): Promise<DeskView[]> {
  // Visitors chat through Frontdesk's own page (proxied via the host's key), so
  // our local store — not Aicoo's share-link analytics — is the source of truth
  // for real desk activity. We still consult /share/list to confirm each link is
  // a genuine Aicoo resource (the "live" badge).
  const [desks, liveMap] = await Promise.all([listDesks(), liveShareList()]);
  const views: DeskView[] = [];
  for (const desk of desks) {
    views.push(
      toView(desk, {
        analytics: await analyticsForDesk(desk.id),
        bookings: await bookingsForDesk(desk.id),
        live:
          Boolean(desk.aicooKey) ||
          liveMap.has(desk.linkId) ||
          !desk.linkId.startsWith("mock_"),
      })
    );
  }
  return views;
}

export async function getDeskView(id: string): Promise<DeskView | undefined> {
  const desk = await getDeskById(id);
  if (!desk) return undefined;
  return toView(desk, {
    analytics: await analyticsForDesk(desk.id),
    bookings: await bookingsForDesk(desk.id),
    live: Boolean(desk.aicooKey) || !desk.linkId.startsWith("mock_"),
  });
}

// ── Update / revoke ──────────────────────────────────────────────────────────

export async function updateDeskProfile(
  id: string,
  payload: CreateDeskPayload
): Promise<DeskView | undefined> {
  const existing = await getDeskById(id);
  if (!existing) return undefined;
  const profile = normalizeProfile({ ...existing.profile, ...payload.profile });
  const share = normalizeShare(
    { ...existing.share, ...payload.share },
    profile.bookingEnabled
  );
  const updated = await storeUpdateDesk(id, { profile, share });
  if (!updated) return undefined;
  void syncDeskContext(updated);
  return getDeskView(id);
}

export async function revokeDesk(id: string): Promise<boolean> {
  const desk = await getDeskById(id);
  if (!desk) return false;
  await revokeShareLink(desk.linkId, desk.aicooKey);
  const updated = await storeUpdateDesk(id, { revoked: true });
  return Boolean(updated);
}

// ── Inbox ────────────────────────────────────────────────────────────────────

export async function deskInbox(id: string) {
  return conversationsForDesk(id);
}

/** Desk liveness for the public page: not revoked and not expired. */
export function deskIsOpen(desk: Desk): boolean {
  if (desk.revoked) return false;
  const exp = Date.parse(desk.expiry);
  if (!Number.isNaN(exp) && exp < Date.now()) return false;
  return true;
}
