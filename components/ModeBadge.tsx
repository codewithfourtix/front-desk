"use client";

import { useEffect, useState } from "react";

/**
 * Shows whether Frontdesk is talking to the real Aicoo API ("Live") or the
 * built-in simulated COO ("Demo"). Reads /api/status once on mount.
 */
export function ModeBadge({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<"live" | "mock" | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => active && setMode(d.mode))
      .catch(() => active && setMode(null));
    return () => {
      active = false;
    };
  }, []);

  if (!mode) return null;
  const live = mode === "live";

  return (
    <span
      className={`tag ${className}`}
      title={
        live
          ? "Connected to the live Aicoo API"
          : "Running on the built-in simulated COO — set AICOO_API_KEY to go live"
      }
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: live ? "var(--color-good)" : "var(--color-warn)" }}
      />
      {live ? "Live · Aicoo" : "Demo mode"}
    </span>
  );
}
