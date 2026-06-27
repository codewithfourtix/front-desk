"use client";

import { useState } from "react";
import { CreateDeskForm } from "./CreateDeskForm";
import { DeskCard } from "./DeskCard";
import { InboxDrawer } from "./InboxDrawer";
import { SlideOver } from "./SlideOver";
import { CopyButton } from "./CopyButton";
import type { DeskDTO } from "./types";

export function DashboardClient({ initialDesks }: { initialDesks: DeskDTO[] }) {
  const [desks, setDesks] = useState<DeskDTO[]>(initialDesks);
  const [inboxDesk, setInboxDesk] = useState<DeskDTO | null>(null);
  const [justCreated, setJustCreated] = useState<DeskDTO | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  function onCreated(desk: DeskDTO) {
    setDesks((d) => [desk, ...d]);
    setJustCreated(desk);
    setCreateOpen(false);
  }

  async function onRevoke(desk: DeskDTO) {
    if (!confirm(`Revoke ${desk.profile.name}'s desk? The link will stop working.`))
      return;
    setDesks((d) => d.map((x) => (x.id === desk.id ? { ...x, revoked: true } : x)));
    if (justCreated?.id === desk.id) setJustCreated(null);
    await fetch(`/api/desks/${desk.id}`, { method: "DELETE" }).catch(() => {});
  }

  const active = desks.filter(
    (d) => !d.revoked && Date.parse(d.expiry) > Date.now()
  );
  const totals = desks.reduce(
    (a, d) => ({
      visitors: a.visitors + d.analytics.uniqueVisitors,
      chats: a.chats + d.analytics.conversationCount,
      bookings: a.bookings + (d.bookings || 0),
    }),
    { visitors: 0, chats: 0, bookings: 0 }
  );

  return (
    <div>
      {/* Title + primary action */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
            Front desks
          </h1>
          <p className="mt-1 text-muted">
            Shareable, access-bounded links to your AI COO.
          </p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn btn-clay">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          New desk
        </button>
      </div>

      {/* Metrics */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Open desks" value={active.length} icon={<DeskIcon />} />
        <Stat label="Visitors" value={totals.visitors} icon={<UserIcon />} />
        <Stat label="Conversations" value={totals.chats} icon={<ChatIcon />} />
        <Stat label="Bookings" value={totals.bookings} icon={<CalIcon />} accent />
      </div>

      {justCreated && (
        <SuccessBanner desk={justCreated} onDismiss={() => setJustCreated(null)} />
      )}

      {/* Desks */}
      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">All desks</h2>
        <span className="text-sm text-muted">
          {active.length} open · {desks.length} total
        </span>
      </div>

      {desks.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {desks.map((d) => (
            <DeskCard
              key={d.id}
              desk={d}
              onOpenInbox={setInboxDesk}
              onRevoke={onRevoke}
            />
          ))}
        </div>
      )}

      {/* Create slide-over */}
      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Open a new desk"
        subtitle="Anyone with the link can talk to your AI COO — no signup."
      >
        <CreateDeskForm onCreated={onCreated} />
      </SlideOver>

      {inboxDesk && (
        <InboxDrawer desk={inboxDesk} onClose={() => setInboxDesk(null)} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="card p-4 transition hover:border-line-2">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className={accent ? "text-good" : "text-muted"}>{icon}</span>
      </div>
      <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function SuccessBanner({
  desk,
  onDismiss,
}: {
  desk: DeskDTO;
  onDismiss: () => void;
}) {
  return (
    <div className="card mt-6 overflow-hidden rise">
      <div className="h-1 w-full" style={{ background: "var(--color-good)" }} />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-good/15 text-good">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <h3 className="font-display text-base font-semibold text-ink">
              {desk.profile.name}&apos;s desk is open
            </h3>
          </div>
          <button onClick={onDismiss} className="text-muted hover:text-ink" aria-label="Dismiss">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          Share this link anywhere. Anyone who opens it can talk to your desk — no signup.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-paper-2/60 px-3 py-2.5">
          <span className="truncate font-mono text-sm text-ink">{desk.publicUrl}</span>
          <div className="ml-auto flex shrink-0 gap-2">
            <CopyButton value={desk.publicUrl} label="Copy link" className="btn btn-clay px-3 text-xs" />
            <a href={`/c/${desk.token}`} target="_blank" rel="noreferrer" className="btn btn-ghost px-3 text-xs">
              Preview
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-paper-2 text-ink">
        <DeskIcon size={26} />
      </div>
      <p className="font-display text-lg font-semibold text-ink">No desks yet</p>
      <p className="mt-1 max-w-xs text-sm text-muted">
        Open your first desk — about 30 seconds — and you&apos;ve got a link your AI
        front desk answers 24/7.
      </p>
      <button onClick={onCreate} className="btn btn-clay mt-6">
        Open your first desk
      </button>
    </div>
  );
}

/* Icons */
function DeskIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9h18M3 9l1-5h16l1 5M5 9v11M19 9v11M9 20v-5h6v5" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12Z" />
    </svg>
  );
}
function CalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
