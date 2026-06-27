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

export interface DeskView extends Desk {
  publicUrl: string;
  analytics: { uniqueVisitors: number; conversationCount: number; messageCount: number };
  live: boolean;
}

function publicUrl(token: string): string {
  return `${config.appUrl}/c/${token}`;
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createDesk(payload: CreateDeskPayload): Promise<DeskView> {
  const profile = normalizeProfile(payload.profile);
  const share = normalizeShare(payload.share, profile.bookingEnabled);

  const shareInput: CreateShareInput = {
    scope: share.scope,
    access: share.access,
    label: `Frontdesk · ${profile.name}`,
    expiresIn: share.expiresIn,
    notesAccess: share.notesAccess,
    identity: share.identity,
  };

  const link = await createShareLink(shareInput);
  const token = shortToken(10);

  const desk = await storeCreateDesk({
    token,
    linkId: link.linkId,
    agentUrl: link.agentUrl,
    profile,
    share,
    expiry: link.expiry,
  });

  // Best-effort: push context to Aicoo so the live agent can answer from it.
  void syncDeskContext(desk);

  return {
    ...desk,
    publicUrl: publicUrl(desk.token),
    analytics: await analyticsForDesk(desk.id),
    live: !link.linkId.startsWith("mock_"),
  };
}

// ── List (with analytics) ────────────────────────────────────────────────────

export async function listDeskViews(): Promise<DeskView[]> {
  const [desks, liveMap] = await Promise.all([listDesks(), liveShareList()]);
  const views: DeskView[] = [];
  for (const desk of desks) {
    const liveItem = liveMap.get(desk.linkId);
    const analytics = liveItem
      ? liveItem.analytics
      : await analyticsForDesk(desk.id);
    views.push({
      ...desk,
      publicUrl: publicUrl(desk.token),
      analytics,
      live: Boolean(liveItem),
    });
  }
  return views;
}

export async function getDeskView(id: string): Promise<DeskView | undefined> {
  const desk = await getDeskById(id);
  if (!desk) return undefined;
  return {
    ...desk,
    publicUrl: publicUrl(desk.token),
    analytics: await analyticsForDesk(desk.id),
    live: !desk.linkId.startsWith("mock_"),
  };
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
  await revokeShareLink(desk.linkId);
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
