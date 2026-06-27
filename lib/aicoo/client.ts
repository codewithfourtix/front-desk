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
  // Per spec the link is under `shareLink`; id=`id`, expiry=`expiresAt`.
  const link =
    (raw.shareLink as Record<string, unknown>) ??
    (raw.link as Record<string, unknown>) ??
    raw;
  return {
    linkId: String(link.id ?? link.linkId ?? ""),
    token: String(link.token ?? ""),
    url: String(link.url ?? link.shareUrl ?? ""),
    agentUrl: String(link.agentUrl ?? link.url ?? ""),
    expiry: String(link.expiresAt ?? link.expiry ?? ""),
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
      // Per spec: id, isActive (not status), expiresAt, and analytics use
      // totalConversations / totalMessages.
      linkId: String(l.id ?? l.linkId ?? ""),
      label: String(l.label ?? ""),
      status:
        l.isActive === false
          ? "revoked"
          : (l.status as ShareListItem["status"]) ?? "active",
      access: (l.access as ShareListItem["access"]) ?? "read",
      scope: (l.scope as ShareListItem["scope"]) ?? "all",
      expiry: String(l.expiresAt ?? l.expiry ?? ""),
      analytics: {
        uniqueVisitors: Number(a.uniqueVisitors ?? 0),
        conversationCount: Number(
          a.totalConversations ?? a.conversationCount ?? 0
        ),
        messageCount: Number(a.totalMessages ?? a.messageCount ?? 0),
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

  // The live agent's own loop can run for minutes. Cap the whole turn so a
  // stuck call fails gracefully instead of hanging the desk forever. The timer
  // is reset on activity below, so a slow-but-progressing stream isn't killed.
  const ac = new AbortController();
  const IDLE_MS = 75_000;
  let idleTimer: ReturnType<typeof setTimeout> = setTimeout(
    () => ac.abort(),
    IDLE_MS
  );
  const bump = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => ac.abort(), IDLE_MS);
  };

  let res: Response;
  try {
    res = await fetch(`${config.aicooBase}/chat`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(idleTimer);
    const aborted = err instanceof Error && err.name === "AbortError";
    yield {
      kind: "error",
      message: aborted
        ? "The desk took too long to respond. Please try again."
        : "Couldn't reach the desk. Please try again.",
    };
    return;
  }

  if (!res.ok || !res.body) {
    clearTimeout(idleTimer);
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
  const think = makeThinkFilter();
  let conversationId: string | number | undefined;
  let totalTokens: number | undefined;
  let sawCompletion = false;
  let gotText = false;

  const processLine = function* (
    line: string
  ): Generator<FrontdeskChunk> {
    let evt: Record<string, unknown>;
    try {
      evt = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return; // ignore keep-alives / malformed lines
    }
    switch (evt.type) {
      case "conversation-start":
        conversationId = evt.conversationId as string | number | undefined;
        break;
      case "text-delta": {
        // The real agent interleaves <think>…</think> reasoning in the text
        // stream — strip it so visitors only ever see the final answer.
        const visible = think.push(String(evt.textDelta ?? ""));
        if (visible) {
          gotText = true;
          yield { kind: "text", text: visible };
        }
        break;
      }
      case "tool-call-start":
        if (evt.toolName)
          yield { kind: "tool", tool: String(evt.toolName) };
        break;
      case "completion": {
        sawCompletion = true;
        const meta = (evt.metadata as Record<string, unknown>) ?? {};
        totalTokens = meta.totalTokens as number | undefined;
        break; // emit a single `done` after flushing, below
      }
      case "error":
        yield {
          kind: "error",
          message: String(evt.error ?? "The desk hit a snag."),
        };
        break;
      default:
        break; // pipeline-progress, iteration-*, timing, message-saved → noise
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bump(); // activity → reset the idle timeout
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) yield* processLine(line);
      }
    }
    const tail = buffer.trim();
    if (tail) yield* processLine(tail);

    // Flush any remaining visible text once the stream is complete.
    const rest = think.flush();
    if (rest) yield { kind: "text", text: rest };

    yield { kind: "done", conversationId, totalTokens };
  } catch {
    // Timed out or the connection dropped mid-stream. Salvage partial text so
    // the visitor keeps whatever the agent already said.
    const rest = think.flush();
    if (rest) yield { kind: "text", text: rest };
    if (gotText) yield { kind: "done", conversationId, totalTokens };
    else
      yield {
        kind: "error",
        message: "The desk took too long to respond. Please try again.",
      };
  } finally {
    clearTimeout(idleTimer);
  }
  void sawCompletion;
}

/**
 * Stateful filter that removes the agent's structured control blocks from a
 * token stream — `<think>` reasoning, `<suggestions>` follow-ups, and similar —
 * tolerating tags split across deltas. Returns only the newly-visible text on
 * each push; call flush() at the end to drain trailing text. Visitors should
 * only ever see the agent's actual answer prose.
 */
const STRIP_TAGS = [
  "think",
  "thinking",
  "reasoning",
  "scratchpad",
  "plan",
  "suggestions",
  "tool_call",
  "tool_result",
];

function makeThinkFilter() {
  let raw = "";
  let emitted = 0;

  const completeRe = new RegExp(
    `<(${STRIP_TAGS.join("|")})\\b[^>]*>[\\s\\S]*?</\\1>`,
    "gi"
  );
  const openRe = new RegExp(`<(?:${STRIP_TAGS.join("|")})\\b`, "i");

  const visibleOf = (s: string, atEnd: boolean): string => {
    // Remove complete control blocks (think/suggestions/etc). Replace with a
    // space so adjacent sentences don't get glued together ("AM.I tried").
    let out = s.replace(completeRe, " ");
    // Anything after an unclosed control tag is in-progress — drop it.
    const m = out.match(openRe);
    if (m && m.index !== undefined) out = out.slice(0, m.index);
    // Mid-stream, also drop a dangling partial tag like "<sug" or "</thin".
    if (!atEnd) out = out.replace(/<\/?[a-z_]*$/i, "");
    return out;
  };

  return {
    push(t: string): string {
      raw += t;
      const vis = visibleOf(raw, false);
      const delta = vis.length > emitted ? vis.slice(emitted) : "";
      emitted = Math.max(emitted, vis.length);
      return delta;
    },
    flush(): string {
      const vis = visibleOf(raw, true);
      const delta = vis.length > emitted ? vis.slice(emitted) : "";
      emitted = vis.length;
      return delta;
    },
  };
}

export { AicooError };
