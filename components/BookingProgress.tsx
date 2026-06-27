"use client";

import { useEffect, useState } from "react";

/**
 * The booking experience. While Aicoo works (a real calendar booking can take
 * 10-40s), we narrate it as a calm, animated stepper so the wait feels like a
 * concierge handling things — never like a frozen screen.
 */

const STEPS = [
  "Checking availability",
  "Holding your slot",
  "Creating the meeting",
  "Sending the invite",
];

export function BookingProgress() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Advance through the steps, then linger on the last until the real result
    // arrives (the parent swaps this out for the confirmation).
    const timers = STEPS.slice(0, -1).map((_, i) =>
      setTimeout(() => setStep(i + 1), (i + 1) * 3200)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="w-full max-w-[20rem] rounded-2xl rounded-tl-sm border border-line bg-card p-4 rise">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-5 w-5 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full opacity-30"
            style={{ background: "var(--color-clay)" }}
          />
          <span className="h-2 w-2 animate-ping rounded-full" style={{ background: "var(--color-clay)" }} />
        </span>
        <span className="text-sm font-medium text-ink">Booking your call</span>
      </div>

      <ol className="space-y-2.5">
        {STEPS.map((label, i) => {
          const state = i < step ? "done" : i === step ? "active" : "pending";
          return (
            <li key={label} className="flex items-center gap-2.5">
              <StepDot state={state} />
              <span
                className={
                  state === "pending"
                    ? "text-sm text-muted/60"
                    : state === "active"
                      ? "text-sm font-medium text-ink"
                      : "text-sm text-muted"
                }
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepDot({ state }: { state: "pending" | "active" | "done" }) {
  if (state === "done") {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--color-clay)" }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-paper)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span
        className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-line"
        style={{ borderTopColor: "var(--color-clay)" }}
      />
    );
  }
  return <span className="h-5 w-5 shrink-0 rounded-full border-2 border-line" />;
}

/**
 * Confirmation card shown once the booking succeeds. Parses the date/time and
 * the Google Meet link out of the agent's clean confirmation line.
 */
export function MeetingCard({ text }: { text: string }) {
  const meet = text.match(/https?:\/\/meet\.google\.com\/[a-z-]+/i)?.[0];
  // Everything before the link / dash is the human-readable "when".
  const when = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^booked( for)?[:\s—-]*/i, "")
    .replace(/[—-]\s*$/, "")
    .trim();

  return (
    <div className="w-full max-w-[22rem] overflow-hidden rounded-2xl rounded-tl-sm border border-line bg-card rise">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-good/15 text-good">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <span className="text-sm font-semibold text-ink">Meeting confirmed</span>
      </div>
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <CalendarGlyph />
          <div className="min-w-0">
            <p className="text-[0.95rem] font-medium leading-snug text-ink">
              {when || "Your call is booked"}
            </p>
            <p className="mt-0.5 text-xs text-muted">Google Meet · invite sent</p>
          </div>
        </div>
        {meet && (
          <a
            href={meet}
            target="_blank"
            rel="noreferrer"
            className="btn btn-clay mt-3.5 w-full"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m23 7-7 5 7 5V7Z" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
            Join Google Meet
          </a>
        )}
      </div>
    </div>
  );
}

function CalendarGlyph() {
  return (
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-paper-2 text-ink">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    </span>
  );
}
