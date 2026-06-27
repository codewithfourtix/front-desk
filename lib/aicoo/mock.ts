/**
 * Mock Aicoo COO.
 *
 * A deterministic, context-aware stand-in for the real /chat agent so Frontdesk
 * is fully demoable with no API key. It reads the desk's free-text context the
 * same way the real agent would, detects booking intent, proposes/locks slots,
 * and streams its reply token-by-token through the same FrontdeskChunk channel
 * the live client uses — so the UI is identical in both modes.
 */

import type { FrontdeskChunk } from "./types";
import type { DeskProfile } from "../store";

export interface MockTurnInput {
  profile: DeskProfile;
  message: string;
  /** Prior turns this conversation, oldest → newest (excludes current). */
  history: { role: "visitor" | "agent"; text: string }[];
  timezone?: string;
}

// Marker the agent leaves when it proposes times, so a later turn can tell that
// the visitor is replying to a slot offer (mirrors having conversation memory).
const SLOT_MARKER = "Here are a few times that work";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function nextSlots(tz?: string): string[] {
  // Deterministic-ish upcoming weekday slots. Demo-stable, not wall-clock exact.
  const now = new Date();
  const slots: string[] = [];
  const times = ["10:00 AM", "2:30 PM", "4:00 PM"];
  let d = new Date(now);
  let i = 0;
  while (slots.length < 3) {
    d = new Date(d.getTime() + 24 * 3600 * 1000);
    const day = d.getDay();
    if (day === 0 || day === 6) continue;
    const label = WEEKDAYS[day - 1];
    slots.push(`${label} at ${times[i % times.length]}${tz ? ` (${tz})` : ""}`);
    i++;
  }
  return slots;
}

// ── Tiny retrieval over the context blob ─────────────────────────────────────

interface ContextLine {
  raw: string;
  lower: string;
}

function indexContext(context: string): ContextLine[] {
  return context
    .split(/\n|(?<=\.)\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => ({ raw, lower: raw.toLowerCase() }));
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

const STOP = new Set([
  "the", "and", "you", "your", "for", "are", "can", "what", "how", "does",
  "with", "this", "that", "have", "has", "about", "would", "could", "want",
  "tell", "give", "please", "there", "their", "they", "from", "into",
]);

/** Rank context lines against the question and return the best matches. */
function retrieve(lines: ContextLine[], q: string, k = 2): string[] {
  const qt = tokens(q).filter((w) => !STOP.has(w));
  if (!qt.length) return [];
  const scored = lines.map((line) => {
    let score = 0;
    for (const t of qt) if (line.lower.includes(t)) score += t.length;
    return { line, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.line.raw);
}

// ── Intent ───────────────────────────────────────────────────────────────────

function wantsToBook(msg: string): boolean {
  return /\b(book|schedule|meet|meeting|call|chat|catch up|time to talk|set up|appointment|calendar|available|availability)\b/i.test(
    msg
  );
}

function isConfirmation(msg: string): boolean {
  return /\b(yes|yep|sure|sounds good|works|book it|confirm|let'?s do|that one|first|second|third|monday|tuesday|wednesday|thursday|friday|am|pm|:\d{2})\b/i.test(
    msg
  );
}

function isGreeting(msg: string): boolean {
  return /^(hi|hey|hello|yo|gm|good (morning|afternoon|evening))\b/i.test(
    msg.trim()
  );
}

// ── Reply planning ───────────────────────────────────────────────────────────

interface Plan {
  text: string;
  tools: string[];
  booking: boolean;
}

function plan(input: MockTurnInput): Plan {
  const { profile, message, history } = input;
  const firstName = profile.name.split(/\s+/)[0] || profile.name;
  const lines = indexContext(profile.context);
  const lastAgent = [...history].reverse().find((h) => h.role === "agent");
  const offeredSlots = lastAgent?.text.includes(SLOT_MARKER) ?? false;

  // 1) Visitor is locking in a time we proposed.
  if (offeredSlots && isConfirmation(message) && profile.bookingEnabled) {
    return {
      text:
        `Done — you're on ${firstName}'s calendar. ✅\n\n` +
        `I've booked it and sent a confirmation. ${firstName} will get the ` +
        `invite with everything they need. Anything else I can help you with ` +
        `before you go?`,
      tools: ["schedule_meeting", "create_calendar_event"],
      booking: true,
    };
  }

  // 2) Visitor wants to book — propose times.
  if (wantsToBook(message) && profile.bookingEnabled) {
    const slots = nextSlots(input.timezone);
    return {
      text:
        `Happy to set that up. ${SLOT_MARKER} on ${firstName}'s calendar:\n\n` +
        slots.map((s, i) => `  ${i + 1}. ${s}`).join("\n") +
        `\n\nWhich works best? Reply with a number or a time and I'll lock it in.`,
      tools: ["search_calendar_events"],
      booking: false,
    };
  }

  // 3) Greeting.
  if (isGreeting(message) && history.length === 0) {
    return {
      text:
        `Hi there — I'm ${firstName}'s front desk. I can answer questions about ` +
        `${firstName}${profile.role ? `, ${profile.role.toLowerCase()},` : ""} ` +
        `and ${profile.bookingEnabled ? "book time directly on the calendar" : "point you to the right place"}. ` +
        `What can I help you with?`,
      tools: [],
      booking: false,
    };
  }

  // 4) Knowledge question — retrieve from context.
  const hits = retrieve(lines, message, 2);
  if (hits.length) {
    const body = hits.join(" ");
    const followup = profile.bookingEnabled
      ? ` If you'd like, I can also book a quick call with ${firstName} to go deeper.`
      : "";
    return {
      text: `${body}${followup}`,
      tools: hits.length > 1 ? ["fetch_recent_history"] : [],
      booking: false,
    };
  }

  // 5) Fallback — honest, still helpful.
  return {
    text:
      `That's a good question. I don't have that detail in ${firstName}'s notes ` +
      `yet, so I don't want to guess. ` +
      (profile.bookingEnabled
        ? `The fastest path is a quick call — want me to grab a time on ${firstName}'s calendar?`
        : `I'll flag it for ${firstName} to follow up with you directly.`),
    tools: ["search_pulse_contact"],
    booking: false,
  };
}

// ── Streaming ────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Stream a mock turn as FrontdeskChunks: optional tool pings, then the reply
 * word-by-word, then a done event. Mirrors the live client's output exactly.
 */
export async function* mockChatStream(
  input: MockTurnInput
): AsyncGenerator<FrontdeskChunk> {
  const p = plan(input);

  // Emit tool "calls" first, like a real agent reaching for calendar/context.
  for (const tool of p.tools) {
    await sleep(180);
    yield { kind: "tool", tool };
  }

  await sleep(p.tools.length ? 200 : 120);

  const words = p.text.split(/(\s+)/); // keep whitespace tokens
  for (const w of words) {
    yield { kind: "text", text: w };
    // Whitespace tokens stream instantly; words get a tiny human cadence.
    if (w.trim()) await sleep(14 + (w.length % 5) * 6);
  }

  yield {
    kind: "done",
    totalTokens: Math.round((p.text.length + input.message.length) / 4),
    booked: p.booking,
  };
}

/** Lets the route know (synchronously) whether a mock turn booked a meeting. */
export function mockTurnMeta(input: MockTurnInput): {
  booking: boolean;
  tools: string[];
} {
  const p = plan(input);
  return { booking: p.booking, tools: p.tools };
}
