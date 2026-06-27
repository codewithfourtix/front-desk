/**
 * Types mirroring the Aicoo REST API (v1) surface that Frontdesk uses.
 * Source of truth: https://www.aicoo.io/docs/api/spec
 *
 * We intentionally only model the slice we touch: /chat and /share/*.
 */

// ── Share links ─────────────────────────────────────────────────────────────

/** What the guest link is scoped to read. */
export type ShareScope = "all" | "folders";

/** Access tier the guest gets. Ordered least → most capable. */
export type ShareAccess = "read" | "read_calendar" | "read_calendar_write";

/** How long a link stays alive. */
export type ShareExpiry = "1h" | "24h" | "7d" | "30d";

/** Note read/write level granted to the guest. */
export type NotesAccess = "read" | "write" | "edit";

/** Which identity files the guest agent loads about the host. */
export interface ShareIdentity {
  loadCoo: boolean;
  loadUser: boolean;
  loadPolicy: boolean;
}

export interface CreateShareInput {
  scope: ShareScope;
  access: ShareAccess;
  label: string;
  expiresIn: ShareExpiry;
  folderIds?: string[];
  notesAccess?: NotesAccess;
  identity?: ShareIdentity;
}

/** Shape returned by POST /share/create. */
export interface ShareLink {
  linkId: string;
  token: string;
  /** Full guest URL on Aicoo's side. */
  url: string;
  /** Direct agent URL. */
  agentUrl: string;
  /** ISO timestamp the link dies. */
  expiry: string;
}

/** Per-link analytics returned by GET /share/list. */
export interface ShareAnalytics {
  uniqueVisitors: number;
  conversationCount: number;
  messageCount: number;
}

export interface ShareListItem {
  linkId: string;
  label: string;
  status: "active" | "revoked";
  access: ShareAccess;
  scope: ShareScope;
  expiry: string;
  analytics: ShareAnalytics;
}

// ── Chat ────────────────────────────────────────────────────────────────────

export interface ChatInput {
  message: string;
  /** Continue a prior conversation. number or string per the spec. */
  conversationId?: string | number;
  /** IANA tz, e.g. "Asia/Karachi". Helps the agent reason about times. */
  userTimezone?: string;
  model?: string;
  temperature?: number;
  /** Aicoo file ids to attach. */
  attachmentIds?: number[];
}

/**
 * NDJSON event shapes streamed by POST /chat (stream: true).
 * We keep a permissive union — Aicoo may add fields; we read what we need.
 */
export type ChatStreamEvent =
  | { type: "text-delta"; textDelta: string }
  | { type: "tool-call-start"; toolName: string; toolCallId: string }
  | {
      type: "tool-call-result";
      toolName?: string;
      toolCallId?: string;
      result?: unknown;
    }
  | {
      type: "completion";
      metadata?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
        conversationId?: string | number;
      };
    }
  | { type: "error"; error: string }
  // catch-all so unknown event types don't crash the parser
  | { type: string; [k: string]: unknown };

/** A normalized chunk our UI consumes, decoupled from Aicoo's wire format. */
export type FrontdeskChunk =
  | { kind: "text"; text: string }
  | { kind: "tool"; tool: string }
  | { kind: "done"; conversationId?: string | number; totalTokens?: number }
  | { kind: "error"; message: string };
