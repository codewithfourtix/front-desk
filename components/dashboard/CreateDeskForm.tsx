"use client";

import { useState } from "react";
import type { DeskDTO, DeskShareDTO } from "./types";
import { ACCESS_LABELS, EXPIRY_LABELS } from "./types";

const EXAMPLE = {
  name: "Ali Zulfiqar",
  role: "Co-founder, Fourtix",
  headline: "I build AI products and ship fast. Here to answer questions and book intro calls.",
  context: `Fourtix is an AI + software studio. We build agents, full-stack web apps, and automation for startups.
Typical engagement: 2-6 week build sprints. Intro calls are free; project quotes after a scoping call.
Pricing: sprints start at $4k. Ongoing retainers available.
Availability: I take intro calls Tue-Thu afternoons (Asia/Karachi).
Stack: Next.js, TypeScript, Python, Aicoo, Claude. I love agent-to-agent and coordination problems.
Links: portfolio at fourtix.com. Email intro@fourtix.com for anything urgent.`,
  bookingEnabled: true,
  accent: "#0070f3",
};

// Geist / Vercel brand accents — black first.
const ACCENTS = ["#000000", "#0070f3", "#7928ca", "#ff0080", "#f5a623", "#50e3c2"];

interface Props {
  onCreated: (desk: DeskDTO) => void;
}

export function CreateDeskForm({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [headline, setHeadline] = useState("");
  const [context, setContext] = useState("");
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [accent, setAccent] = useState("#0070f3");
  const [advanced, setAdvanced] = useState(false);
  const [expiresIn, setExpiresIn] = useState<DeskShareDTO["expiresIn"]>("7d");
  const [access, setAccess] = useState<DeskShareDTO["access"]>("read_calendar_write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fillExample() {
    setName(EXAMPLE.name);
    setRole(EXAMPLE.role);
    setHeadline(EXAMPLE.headline);
    setContext(EXAMPLE.context);
    setBookingEnabled(EXAMPLE.bookingEnabled);
    setAccent(EXAMPLE.accent);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/desks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: { name, role, headline, context, bookingEnabled, accent },
          share: { expiresIn, access: bookingEnabled ? access : "read" },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create desk");
        return;
      }
      onCreated(data.desk as DeskDTO);
      // Reset for the next one.
      setName("");
      setRole("");
      setHeadline("");
      setContext("");
      setBookingEnabled(true);
      setAccent("#0070f3");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">
          Open a new desk
        </h2>
        <button
          type="button"
          onClick={fillExample}
          className="text-xs font-semibold text-clay hover:underline"
        >
          Use example
        </button>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" required>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ali Zulfiqar" required />
          </Field>
          <Field label="Role (optional)">
            <input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Co-founder, Fourtix" />
          </Field>
        </div>

        <Field label="Headline" hint="The one line visitors see at the top.">
          <input className="input" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Here to answer questions and book intro calls." required />
        </Field>

        <Field
          label="What your desk knows"
          hint="Bio, pricing, availability, FAQs, links. The agent answers only from this."
        >
          <textarea
            className="input min-h-36 resize-y leading-relaxed"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Paste anything your front desk should be able to answer…"
            required
          />
        </Field>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Toggle
            checked={bookingEnabled}
            onChange={setBookingEnabled}
            label="Let visitors book time"
          />
          <div className="flex items-center gap-2">
            <span className="label">Accent</span>
            <div className="flex gap-1.5">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccent(c)}
                  className="h-6 w-6 rounded-full ring-offset-2 transition"
                  style={{
                    background: c,
                    boxShadow: accent === c ? `0 0 0 2px var(--color-paper), 0 0 0 4px ${c}` : "none",
                  }}
                  aria-label={`Accent ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Advanced scope controls */}
        <div>
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: advanced ? "rotate(90deg)" : "none", transition: "transform .15s" }} aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
            Access boundaries
          </button>

          {advanced && (
            <div className="mt-3 grid gap-4 rounded-md border border-line bg-paper-2/50 p-4 sm:grid-cols-2">
              <Field label="Link expires in">
                <select className="input" value={expiresIn} onChange={(e) => setExpiresIn(e.target.value as DeskShareDTO["expiresIn"])}>
                  {Object.entries(EXPIRY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="What the agent can do" hint={bookingEnabled ? undefined : "Enable booking to allow calendar writes."}>
                <select className="input" value={access} disabled={!bookingEnabled} onChange={(e) => setAccess(e.target.value as DeskShareDTO["access"])}>
                  {Object.entries(ACCESS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
              <p className="text-xs leading-relaxed text-muted sm:col-span-2">
                These map straight onto Aicoo&apos;s scoped share link — a physical
                boundary, not a prompt. The link can only ever reach what you grant here.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-md bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>
        )}

        <button type="submit" disabled={busy} className="btn btn-clay w-full disabled:opacity-50">
          {busy ? "Opening desk…" : "Open desk & get link"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required && <span className="text-clay"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2"
    >
      <span
        className="relative h-5 w-9 rounded-full transition"
        style={{ background: checked ? "var(--color-clay)" : "var(--color-line-2)" }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
          style={{ left: checked ? "1.125rem" : "0.125rem" }}
        />
      </span>
      <span className="text-sm font-medium text-ink">{label}</span>
    </button>
  );
}
