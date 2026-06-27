/**
 * Lightweight, dependency-free routing of a visitor turn.
 *
 * Hybrid mode sends general chat to the fast OpenRouter layer and hands a turn
 * to Aicoo's (slower, real-calendar) agent once a concrete day + time is on the
 * table — supplied in one message, completed across the conversation, or simply
 * confirmed ("yes, book it") after both were already agreed.
 */

const WEEKDAY =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|weds?|thur?s?|fri|sat|sun)\b/i;
const RELDAY = /\b(today|tonight|tomorrow|tmrw)\b/i;
const DATE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}(st|nd|rd|th)\b/i;
const CLOCK =
  /\b\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)\b|\b([01]?\d|2[0-3]):[0-5]\d\b|\b(noon|midday|midnight)\b/i;

const CONFIRM =
  /\b(yes|yep|yeah|yup|sure|ok|okay|confirm(ed)?|book it|book that|please book|go ahead|do it|lock it in|sounds good|that works|works for me|perfect|let'?s do it|schedule it|the (first|second|third)|option \d)\b/i;

const hasDay = (s: string) => WEEKDAY.test(s) || RELDAY.test(s) || DATE.test(s);
const hasTime = (s: string) => CLOCK.test(s);

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

  // A full day + time in this single message → book it.
  if (hasDay(message) && hasTime(message)) return true;

  // Otherwise, look across the recent window (both sides — the agent often
  // restates the agreed slot) for an established day + time.
  const window = [...history.slice(-6).map((h) => h.text), message].join("  ");
  const slotKnown = hasDay(window) && hasTime(window);
  if (!slotKnown) return false;

  // The visitor must be contributing a piece of the slot or confirming it, so
  // we don't hijack an unrelated question that merely follows a booking chat.
  const contributes =
    hasDay(message) || hasTime(message) || CONFIRM.test(message);
  return contributes;
}
