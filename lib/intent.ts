/**
 * Lightweight, dependency-free routing of a visitor turn.
 *
 * In hybrid mode, general questions go to the fast OpenRouter layer and only
 * booking turns go to Aicoo's (slower, real-calendar) agent. This decides which
 * is which without spending an extra LLM round-trip.
 */

const BOOK_VERB =
  /\b(book|schedule|reserve|confirm|finalize|lock it in|pencil me in|set up (a )?(call|meeting|time|chat)|put me down)\b/i;

const WEEKDAY =
  /\b(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)(day)?\b|\b(today|tomorrow|tonight)\b/i;

const CLOCK = /\b(\d{1,2})(:\d{2})?\s*(am|pm)\b|\b([01]?\d|2[0-3]):[0-5]\d\b/i;

const MEET_WORD = /\b(meet|meeting|call|appointment|intro call|catch up|chat)\b/i;

const AGENT_OFFERED =
  /\b(book|calendar|time that works|day and time|what time|which (one |time )?works|propose|slot|available time|when works|exact time)\b/i;

/**
 * Should this turn be handled by Aicoo (real booking) rather than the fast
 * conversational layer?
 */
export function isBookingTurn(
  message: string,
  history: { role: "visitor" | "agent"; text: string }[],
  bookingEnabled: boolean
): boolean {
  if (!bookingEnabled) return false;

  const m = message.toLowerCase();

  // Explicit booking verb → always Aicoo.
  if (BOOK_VERB.test(m)) return true;

  const hasDayTime = WEEKDAY.test(m) || CLOCK.test(m);

  // The agent just asked for / offered a time, and the visitor replied with one.
  const lastAgent = [...history].reverse().find((h) => h.role === "agent");
  const inBookingFlow = lastAgent ? AGENT_OFFERED.test(lastAgent.text) : false;
  if (hasDayTime && inBookingFlow) return true;

  // A concrete day/time paired with a meeting word, even cold.
  if (hasDayTime && MEET_WORD.test(m)) return true;

  return false;
}
