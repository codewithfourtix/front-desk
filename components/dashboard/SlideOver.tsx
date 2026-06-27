"use client";

import { useEffect } from "react";

/** A right-side slide-over panel (Linear/Stripe style) for focused tasks. */
export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "32rem",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-[fadein_.2s_ease]"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full flex-col bg-paper shadow-2xl"
        style={{
          maxWidth: width,
          animation: "slideover .26s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost shrink-0"
            style={{ height: 36, width: 36, padding: 0 }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
      <style>{`
        @keyframes slideover { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
