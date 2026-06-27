/**
 * Lightweight, dependency-free routing of a visitor turn.
 *
 * Hybrid mode sends general chat to the fast OpenRouter layer and only hands a
 * turn to Aicoo's (slower, real-calendar) agent once there's an actual day AND
 * time to book. "I want to book a call" alone is NOT enough — OpenRouter handles
 * that conversationally (asking for a day/time); Aicoo only runs when the slot
 * is concrete.
 */

const WEEKDAY = /\b(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)(day)?\b/i;
const RELDAY = /\b(today|tonight|tomorrow|tmrw)\b/i;
const DATE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}(st|nd|rd|th)\b/i;
const CLOCK =
  /\b\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)\b|\b([01]?\d|2[0-3]):[0-5]\d\b|\b(noon|midday|midnight)\b/i;

const AGENT_ASKED_TIME =
  /\b(what|which)\s+(day|time)|day and time|specific (day|time)|preferred (day|time)|let me know.*(day|time)|share.*(day|time)|when works|what works for you|pick a time|exact time\b/i;

const CONFIRM =
  /\b(yes|yep|yeah|sure|confirm|confirmed|that works|sounds good|book it|go ahead|perfect|that one|the first|the second|the third|option \d)\b/i;

const hasDay = (s: string) => WEEKDAY.test(s) || RELDAY.test(s) || DATE.test(s);
const hasTime = (s: string) => CLOCK.test(s);

/**
 * Should this turn be handled by Aicoo (real booking) rather than the fast
 * conversational layer? Only once a concrete day + time exist.
 */
export function isBookingTurn(
  message: string,
  history: { role: "visitor" | "agent"; text: string }[],
  bookingEnabled: boolean
): boolean {
  if (!bookingEnabled) return false;

  // A full day + time in one message → book it.
  if (hasDay(message) && hasTime(message)) return true;

  // Mid-flow: the agent asked for a day/time and the visitor has now supplied
  // the missing piece, so day + time exist across the recent turns.
  const lastAgent = [...history].reverse().find((h) => h.role === "agent");
  const inFlow = lastAgent ? AGENT_ASKED_TIME.test(lastAgent.text) : false;
  if (inFlow) {
    const recent = history
      .filter((h) => h.role === "visitor")
      .slice(-2)
      .map((h) => h.text)
      .join(" ");
    const combined = `${recent} ${message}`;
    const contributes = hasDay(message) || hasTime(message) || CONFIRM.test(message);
    if (hasDay(combined) && hasTime(combined) && contributes) return true;
  }

  return false;
}
