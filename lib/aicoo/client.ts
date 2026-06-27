/**
 * Thin server-side client for the Aicoo REST API (v1).
 *
 * Raw HTTP — Aicoo ships no SDK. Bearer auth, JSON in, JSON or NDJSON out.
 * Only the slice Frontdesk needs is implemented: /init, /share/*, /chat,
 * /accumulate. The Bearer key never leaves the server.
 */

import { config } from "../config";
import type {
  ChatInput,
  ChatStreamEvent,
  CreateShareInput,
  FrontdeskChunk,
  ShareLink,
  ShareListItem,
} from "./types";

class AicooError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "AicooError";
  }
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${config.aicooKey}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(
  path: string,
  init: RequestInit & { method: string }
): Promise<T> {
  const res = await fetch(`${config.aicooBase}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
    // Never cache mutations or account-scoped reads.
    cache: "no-store",
  });

  if (!res.ok) {
    let code: string | undefined;
    let detail = res.statusText;
    try {
      const body = await res.json();
      code = body?.code || body?.error?.code;
      detail = body?.message || body?.error || detail;
    } catch {
      /* non-JSON error body */
    }
    throw new AicooError(`Aicoo ${path} failed: ${detail}`, res.status, code);
  }

  return (await res.json()) as T;
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

/** Idempotently ensure the workspace exists. Safe to call repeatedly. */
export async function init(): Promise<void> {
  await request<unknown>("/init", { method: "POST", body: "{}" });
}

// ── Share links ──────────────────────────────────────────────────────────────

export async function createShare(
  input: CreateShareInput
): Promise<ShareLink> {
  const raw = await request<Record<string, unknown>>("/share/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
  // Normalize loosely — field names per the spec, tolerant of nesting.
  const link = (raw.link as Record<string, unknown>) ?? raw;
  return {
    linkId: String(link.linkId ?? link.id ?? ""),
    token: String(link.token ?? ""),
    url: String(link.url ?? link.shareUrl ?? ""),
    agentUrl: String(link.agentUrl ?? link.url ?? ""),
    expiry: String(link.expiry ?? link.expiresAt ?? ""),
  };
}

export async function listShares(opts?: {
  status?: "active" | "revoked" | "all";
  limit?: number;
}): Promise<ShareListItem[]> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const raw = await request<Record<string, unknown>>(
    `/share/list${qs ? `?${qs}` : ""}`,
    { method: "GET" }
  );
  const links = (raw.links as Record<string, unknown>[]) ?? [];
  return links.map((l) => {
    const a = (l.analytics as Record<string, unknown>) ?? {};
    return {
      linkId: String(l.linkId ?? l.id ?? ""),
      label: String(l.label ?? ""),
      status: (l.status as ShareListItem["status"]) ?? "active",
      access: (l.access as ShareListItem["access"]) ?? "read",
      scope: (l.scope as ShareListItem["scope"]) ?? "all",
      expiry: String(l.expiry ?? ""),
      analytics: {
        uniqueVisitors: Number(a.uniqueVisitors ?? 0),
        conversationCount: Number(a.conversationCount ?? 0),
        messageCount: Number(a.messageCount ?? 0),
      },
    };
  });
}

export async function revokeShare(linkId: string): Promise<void> {
  await request<unknown>(`/share/${encodeURIComponent(linkId)}`, {
    method: "DELETE",
  });
}

// ── Context ──────────────────────────────────────────────────────────────────

/** Push a desk's free-text context into Aicoo as a note via /accumulate. */
export async function accumulateNote(
  title: string,
  content: string,
  folder = "Frontdesk"
): Promise<void> {
  await request<unknown>("/accumulate", {
    method: "POST",
    body: JSON.stringify({ texts: [{ title, content, folder }] }),
  });
}

// ── Chat (streaming) ─────────────────────────────────────────────────────────

/**
 * Stream a chat turn from Aicoo as normalized Frontdesk chunks.
 *
 * Aicoo streams newline-delimited JSON (NDJSON), not SSE. We buffer across
 * chunk boundaries, parse each complete line, and translate to our wire format
 * so the UI never sees Aicoo's raw event shapes.
 */
export async function* chatStream(
  input: ChatInput & { systemPreamble?: string }
): AsyncGenerator<FrontdeskChunk> {
  const body: Record<string, unknown> = {
    message: input.systemPreamble
      ? `${input.systemPreamble}\n\n---\n\nVisitor: ${input.message}`
      : input.message,
    stream: true,
  };
  if (input.conversationId !== undefined)
    body.conversationId = input.conversationId;
  if (input.userTimezone) body.userTimezone = input.userTimezone;
  if (input.model || config.aicooModel)
    body.model = input.model || config.aicooModel;
  if (input.temperature !== undefined) body.temperature = input.temperature;
  if (input.attachmentIds?.length) body.attachmentIds = input.attachmentIds;

  const res = await fetch(`${config.aicooBase}/chat`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok || !res.body) {
    let detail = res.statusText;
    try {
      detail = (await res.json())?.message || detail;
    } catch {
      /* ignore */
    }
    yield { kind: "error", message: `Aicoo /chat failed: ${detail}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const chunk = translate(line);
      if (chunk) yield chunk;
    }
  }
  // Flush any trailing partial line.
  const tail = buffer.trim();
  if (tail) {
    const chunk = translate(tail);
    if (chunk) yield chunk;
  }
}

function translate(line: string): FrontdeskChunk | null {
  let evt: ChatStreamEvent;
  try {
    evt = JSON.parse(line) as ChatStreamEvent;
  } catch {
    return null; // ignore keep-alives / malformed lines
  }
  switch (evt.type) {
    case "text-delta":
      return { kind: "text", text: (evt as { textDelta: string }).textDelta };
    case "tool-call-start":
      return { kind: "tool", tool: (evt as { toolName: string }).toolName };
    case "completion": {
      const meta = (evt as { metadata?: Record<string, unknown> }).metadata;
      return {
        kind: "done",
        conversationId: meta?.conversationId as string | number | undefined,
        totalTokens: meta?.totalTokens as number | undefined,
      };
    }
    case "error":
      return { kind: "error", message: (evt as { error: string }).error };
    default:
      return null;
  }
}

export { AicooError };
