"use client";

import { useEffect, useRef, useState } from "react";
import { BookingProgress, MeetingCard } from "./BookingProgress";

export interface ChatProps {
  token: string;
  hostName: string;
  greeting: string;
  bookingEnabled: boolean;
  starters?: string[];
  accent?: string;
}

interface UIMessage {
  id: string;
  role: "visitor" | "agent";
  text: string;
  tools?: string[];
  booking?: boolean;
  streaming?: boolean;
  /** This agent turn is an actual booking — show the booking experience. */
  bookingMode?: boolean;
}

// Friendly labels for Aicoo tool names that may surface mid-stream.
const TOOL_LABELS: Record<string, string> = {
  search_calendar_events: "Checking the calendar",
  create_calendar_event: "Adding to calendar",
  schedule_meeting: "Booking the meeting",
  edit_calendar_event: "Updating the calendar",
  search_pulse_contact: "Looking up context",
  send_message_to_human: "Notifying the host",
  fetch_recent_history: "Recalling context",
  web_search: "Searching the web",
  read_url: "Reading a link",
};

function toolLabel(t: string): string {
  return TOOL_LABELS[t] ?? t.replace(/_/g, " ");
}

let _id = 0;
const nextId = () => `m${++_id}`;

export function Chat({
  token,
  hostName,
  greeting,
  bookingEnabled,
  starters = [],
  accent,
}: ChatProps) {
  const firstName = hostName.split(/\s+/)[0] || hostName;
  const [messages, setMessages] = useState<UIMessage[]>([
    { id: nextId(), role: "agent", text: greeting },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const convId = useRef<string | undefined>(undefined);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, activeTools]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setActiveTools([]);
    setMessages((m) => [
      ...m,
      { id: nextId(), role: "visitor", text: trimmed },
    ]);
    setBusy(true);

    const agentId = nextId();
    let started = false;
    const ensureAgent = () => {
      if (started) return;
      started = true;
      setMessages((m) => [
        ...m,
        { id: agentId, role: "agent", text: "", streaming: true },
      ]);
    };

    // Show the agent bubble (with typing dots) immediately — the real agent can
    // take several seconds to first token, and a frozen UI reads as "broken".
    ensureAgent();

    const tz =
      Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          message: trimmed,
          conversationId: convId.current,
          timezone: tz,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        ensureAgent();
        patch(agentId, {
          text: err.error || "Something went wrong. Please try again.",
          streaming: false,
        });
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const tools = new Set<string>();
      let booking = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          handleEvent(evt);
        }
      }

      function handleEvent(evt: Record<string, unknown>) {
        switch (evt.kind) {
          case "meta":
            convId.current = evt.conversationId as string;
            if (evt.booking) {
              ensureAgent();
              patch(agentId, { bookingMode: true });
            }
            break;
          case "tool": {
            const t = evt.tool as string;
            tools.add(t);
            setActiveTools((prev) => (prev.includes(t) ? prev : [...prev, t]));
            break;
          }
          case "text":
            ensureAgent();
            setActiveTools([]);
            appendText(agentId, evt.text as string);
            break;
          case "done":
            // `booked` is true only when a calendar tool actually succeeded.
            if (evt.booked) booking = true;
            patch(agentId, {
              streaming: false,
              tools: [...tools],
              booking,
            });
            setActiveTools([]);
            break;
          case "error":
            ensureAgent();
            patch(agentId, {
              text: (evt.message as string) || "Something went wrong.",
              streaming: false,
            });
            break;
        }
      }
    } catch {
      ensureAgent();
      patch(agentId, {
        text: "Couldn't reach the desk. Check your connection and retry.",
        streaming: false,
      });
    } finally {
      setBusy(false);
      setActiveTools([]);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function patch(id: string, p: Partial<UIMessage>) {
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  function appendText(id: string, t: string) {
    setMessages((m) =>
      m.map((x) => (x.id === id ? { ...x, text: x.text + t } : x))
    );
  }

  const accentStyle = accent ? ({ "--color-clay": accent } as React.CSSProperties) : undefined;

  return (
    <div className="flex h-full flex-col" style={accentStyle}>
      {/* Transcript */}
      <div
        ref={scroller}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
      >
        {messages.map((m) => (
          <Bubble key={m.id} m={m} firstName={firstName} />
        ))}

        {activeTools.length > 0 && (
          <div className="flex items-center gap-2 pl-11 text-sm text-muted rise">
            <span className="flex gap-1">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </span>
            <span>{toolLabel(activeTools[activeTools.length - 1])}…</span>
          </div>
        )}
      </div>

      {/* Starter chips (only before the visitor has said anything) */}
      {messages.length === 1 && starters.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-6">
          {starters.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="tag hover:border-clay hover:text-clay disabled:opacity-50"
              style={{ cursor: "pointer" }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-line bg-card/60 px-4 py-3 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={`Ask ${firstName}'s desk anything…`}
            className="input max-h-32 resize-none py-2.5"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="btn btn-clay h-[42px] shrink-0 disabled:opacity-40"
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </form>
        <p className="mt-2 text-center text-[0.7rem] text-muted">
          {bookingEnabled
            ? `You can ask questions or book time with ${firstName}.`
            : `Ask anything — ${firstName}'s desk will help or pass it along.`}
        </p>
      </div>
    </div>
  );
}

function Bubble({ m, firstName }: { m: UIMessage; firstName: string }) {
  const isAgent = m.role === "agent";

  // Booking turns get the dedicated experience: an animated stepper while Aicoo
  // works, then a confirmed-meeting card (or a graceful message if it couldn't).
  if (isAgent && m.bookingMode) {
    return (
      <div className="flex gap-3 rise">
        <Avatar isAgent firstName={firstName} />
        <div className="max-w-[85%]">
          {m.streaming && !m.text ? (
            <BookingProgress />
          ) : m.booking ? (
            <MeetingCard text={m.text} />
          ) : (
            <div className="rounded-2xl rounded-tl-sm border border-line bg-card px-4 py-2.5 text-[0.95rem] leading-relaxed text-ink">
              <span className="whitespace-pre-wrap">{m.text}</span>
              {m.streaming && <Caret />}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 rise ${isAgent ? "" : "flex-row-reverse"}`}>
      <Avatar isAgent={isAgent} firstName={firstName} />
      <div className={`max-w-[78%] ${isAgent ? "" : "items-end"}`}>
        {m.booking && (
          <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-good/10 px-2.5 py-1 text-xs font-semibold text-good">
            <CheckIcon /> Meeting booked
          </div>
        )}
        <div
          className={
            isAgent
              ? "rounded-2xl rounded-tl-sm border border-line bg-card px-4 py-2.5 text-[0.95rem] leading-relaxed text-ink"
              : "rounded-2xl rounded-tr-sm bg-ink px-4 py-2.5 text-[0.95rem] leading-relaxed text-paper"
          }
        >
          <span className="whitespace-pre-wrap">{m.text}</span>
          {m.streaming && !m.text && (
            <span className="inline-flex items-center gap-2 align-middle">
              <span className="inline-flex gap-1">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </span>
              <ThinkingHint />
            </span>
          )}
          {m.streaming && m.text && <Caret />}
        </div>
        {isAgent && m.tools && m.tools.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 pl-1">
            {m.tools.map((t) => (
              <span key={t} className="tag text-[0.68rem]">
                <ToolDot /> {toolLabel(t)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Reassures during the live agent's multi-second think before first token. */
function ThinkingHint() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 3500);
    const t2 = setTimeout(() => setStage(2), 12000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  if (stage === 0) return null;
  return (
    <span className="text-xs text-muted">
      {stage === 1 ? "thinking…" : "still working — the live agent takes a few seconds"}
    </span>
  );
}

function Avatar({
  isAgent,
  firstName,
}: {
  isAgent: boolean;
  firstName: string;
}) {
  return (
    <span
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={
        isAgent
          ? { background: "var(--color-clay)", color: "#fff" }
          : { background: "var(--color-paper-2)", color: "var(--color-ink-2)", border: "1px solid var(--color-line-2)" }
      }
      aria-hidden
    >
      {isAgent ? firstName.slice(0, 1).toUpperCase() : "You".slice(0, 1)}
    </span>
  );
}

function Caret() {
  return (
    <span
      className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse"
      style={{ background: "var(--color-clay)" }}
    />
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 14-7-4 14-3-6-7-1Z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function ToolDot() {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: "var(--color-pine)" }}
    />
  );
}
