"use client";

import { useEffect, useState } from "react";
import type { ConversationDTO, DeskDTO } from "./types";

function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function InboxDrawer({
  desk,
  onClose,
}: {
  desk: DeskDTO;
  onClose: () => void;
}) {
  const [convos, setConvos] = useState<ConversationDTO[] | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    fetch(`/api/desks/${desk.id}/conversations`)
      .then((r) => r.json())
      .then((d) => {
        if (!on) return;
        const list = (d.conversations as ConversationDTO[]) || [];
        setConvos(list);
        setActive(list[0]?.id ?? null);
      })
      .catch(() => on && setConvos([]));
    return () => {
      on = false;
    };
  }, [desk.id]);

  const current = convos?.find((c) => c.id === active) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-2xl flex-col bg-paper shadow-2xl rise">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              {desk.profile.name}&apos;s inbox
            </h2>
            <p className="text-xs text-muted">
              {convos ? `${convos.length} conversation${convos.length === 1 ? "" : "s"}` : "Loading…"}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost px-2.5 py-2" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {convos === null ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">Loading…</div>
        ) : convos.length === 0 ? (
          <EmptyInbox url={desk.publicUrl} />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,14rem)_1fr]">
            {/* List */}
            <div className="overflow-y-auto border-r border-line">
              {convos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className={`block w-full border-b border-line px-4 py-3 text-left transition hover:bg-paper-2 ${active === c.id ? "bg-paper-2" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">{c.visitorLabel}</span>
                    <span className="text-[0.65rem] text-muted">{timeAgo(c.lastAt)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                    {c.messages[c.messages.length - 1]?.text ?? "—"}
                  </p>
                  {c.messages.some((m) => m.booking) && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[0.65rem] font-semibold text-good">
                      ✓ booked
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Transcript */}
            <div className="overflow-y-auto px-5 py-4">
              {current ? (
                <div className="space-y-3">
                  {current.messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === "visitor" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[80%]">
                        <div
                          className={
                            m.role === "agent"
                              ? "rounded-2xl rounded-tl-sm border border-line bg-card px-3.5 py-2 text-sm text-ink"
                              : "rounded-2xl rounded-tr-sm bg-ink px-3.5 py-2 text-sm text-paper"
                          }
                        >
                          <span className="whitespace-pre-wrap">{m.text}</span>
                        </div>
                        {m.tools && m.tools.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {m.tools.map((t) => (
                              <span key={t} className="tag text-[0.62rem]">{t.replace(/_/g, " ")}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted">
                  Select a conversation
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function EmptyInbox({ url }: { url: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-paper-2 text-muted">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 4h16v12H5.2L4 17.2V4Z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-ink">No one&apos;s walked up yet</p>
      <p className="mt-1 max-w-xs text-xs text-muted">
        Share the link and conversations will show up here in real time.
      </p>
      <code className="mt-3 rounded bg-paper-2 px-2 py-1 font-mono text-[0.7rem] text-ink-2">{url}</code>
    </div>
  );
}
