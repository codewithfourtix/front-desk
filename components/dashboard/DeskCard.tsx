"use client";

import Link from "next/link";
import { CopyButton } from "./CopyButton";
import { ACCESS_LABELS, type DeskDTO } from "./types";

function relativeExpiry(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (Number.isNaN(ms)) return "—";
  if (ms <= 0) return "expired";
  const h = Math.round(ms / 3_600_000);
  if (h < 24) return `expires in ${h}h`;
  return `expires in ${Math.round(h / 24)}d`;
}

export function DeskCard({
  desk,
  onOpenInbox,
  onRevoke,
}: {
  desk: DeskDTO;
  onOpenInbox: (desk: DeskDTO) => void;
  onRevoke: (desk: DeskDTO) => void;
}) {
  const a = desk.analytics;
  const closed = desk.revoked || Date.parse(desk.expiry) < Date.now();

  return (
    <div className={`card overflow-hidden ${closed ? "opacity-60" : ""}`}>
      <div className="h-1 w-full" style={{ background: desk.profile.accent || "var(--color-clay)" }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ background: desk.profile.accent || "var(--color-clay)" }}
            >
              {desk.profile.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h3 className="font-display text-base font-semibold leading-tight text-ink">
                {desk.profile.name}
              </h3>
              <p className="text-xs text-muted">
                {desk.profile.role || "Front desk"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="tag">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: desk.live ? "var(--color-good)" : "var(--color-warn)" }}
              />
              {desk.live ? "Live link" : "Demo link"}
            </span>
            <span className="text-[0.7rem] text-muted">{closed ? "closed" : relativeExpiry(desk.expiry)}</span>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-2">
          {desk.profile.headline}
        </p>

        {/* Share link */}
        <div className="mt-4 flex items-center gap-2 rounded-md border border-line bg-paper-2/60 px-3 py-2">
          <span className="truncate font-mono text-xs text-ink-2">{desk.publicUrl}</span>
          <div className="ml-auto flex shrink-0 gap-1.5">
            <CopyButton value={desk.publicUrl} className="btn btn-ghost px-2.5 py-1.5 text-xs" />
            <Link href={`/c/${desk.token}`} target="_blank" className="btn btn-ghost px-2.5 py-1.5 text-xs">
              Open
            </Link>
          </div>
        </div>

        {/* Analytics */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-line rounded-md border border-line">
          <Stat label="Visitors" value={a.uniqueVisitors} />
          <Stat label="Chats" value={a.conversationCount} />
          <Stat label="Questions" value={a.messageCount} />
        </div>

        {/* Meta + actions */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[0.7rem] text-muted">
              {ACCESS_LABELS[desk.share.access]}
            </span>
            {desk.profile.bookingEnabled && (
              <span
                className="tag text-[0.62rem]"
                title={
                  desk.byok
                    ? "Bookings go to the host's own Google Calendar"
                    : "Bookings use the shared demo account"
                }
              >
                {desk.byok ? "Own calendar" : "Demo calendar"}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onOpenInbox(desk)} className="btn btn-ghost px-3 py-1.5 text-xs">
              Inbox
            </button>
            {!closed && (
              <button
                onClick={() => onRevoke(desk)}
                className="btn px-3 py-1.5 text-xs text-clay hover:bg-clay/10"
                style={{ borderColor: "var(--color-clay-soft)" }}
              >
                Revoke
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-2.5 text-center">
      <div className="font-display text-xl font-semibold text-ink">{value}</div>
      <div className="text-[0.65rem] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
