"use client";

import { useState } from "react";
import { CreateDeskForm } from "./CreateDeskForm";
import { DeskCard } from "./DeskCard";
import { InboxDrawer } from "./InboxDrawer";
import { CopyButton } from "./CopyButton";
import type { DeskDTO } from "./types";

export function DashboardClient({ initialDesks }: { initialDesks: DeskDTO[] }) {
  const [desks, setDesks] = useState<DeskDTO[]>(initialDesks);
  const [inboxDesk, setInboxDesk] = useState<DeskDTO | null>(null);
  const [justCreated, setJustCreated] = useState<DeskDTO | null>(null);

  function onCreated(desk: DeskDTO) {
    setDesks((d) => [desk, ...d]);
    setJustCreated(desk);
  }

  async function onRevoke(desk: DeskDTO) {
    if (!confirm(`Revoke ${desk.profile.name}'s desk? The link will stop working.`))
      return;
    setDesks((d) =>
      d.map((x) => (x.id === desk.id ? { ...x, revoked: true } : x))
    );
    if (justCreated?.id === desk.id) setJustCreated(null);
    await fetch(`/api/desks/${desk.id}`, { method: "DELETE" }).catch(() => {});
  }

  const active = desks.filter(
    (d) => !d.revoked && Date.parse(d.expiry) > Date.now()
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
      {/* Left: create */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <CreateDeskForm onCreated={onCreated} />
      </div>

      {/* Right: desks */}
      <div>
        {justCreated && (
          <SuccessBanner desk={justCreated} onDismiss={() => setJustCreated(null)} />
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">
            Your desks
          </h2>
          <span className="text-sm text-muted">
            {active.length} open · {desks.length} total
          </span>
        </div>

        {desks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      {inboxDesk && (
        <InboxDrawer desk={inboxDesk} onClose={() => setInboxDesk(null)} />
      )}
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
    <div className="card mb-6 overflow-hidden rise">
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
            <CopyButton value={desk.publicUrl} label="Copy link" className="btn btn-clay px-3 py-1.5 text-xs" />
            <a href={`/c/${desk.token}`} target="_blank" rel="noreferrer" className="btn btn-ghost px-3 py-1.5 text-xs">
              Preview
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-paper-2 text-muted">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 10a6 6 0 1 1 12 0c0 .6.2 1.2.6 1.6l1 1a1 1 0 0 1-.7 1.7H4.1a1 1 0 0 1-.7-1.7l1-1c.4-.4.6-1 .6-1.6Z" />
          <path d="M11 18a1 1 0 0 0 2 0" />
        </svg>
      </div>
      <p className="font-display text-base font-semibold text-ink">No desks yet</p>
      <p className="mt-1 max-w-xs text-sm text-muted">
        Open your first desk on the left. It takes about 30 seconds — then you&apos;ve
        got a link your AI front desk answers, 24/7.
      </p>
    </div>
  );
}
