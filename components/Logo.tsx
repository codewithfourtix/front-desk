import Link from "next/link";

/** The Frontdesk wordmark — a concierge bell + editorial serif name. */
export function Logo({
  href = "/",
  className = "",
  size = "md",
}: {
  href?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const text =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  const mark = size === "lg" ? 22 : size === "sm" ? 15 : 18;

  const inner = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Triangle size={mark} />
      <span
        className={`font-display ${text} font-semibold tracking-tight text-ink`}
      >
        Frontdesk
      </span>
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center" aria-label="Frontdesk home">
      {inner}
    </Link>
  );
}

/** Solid black triangle — the Vercel/Geist signature mark. */
function Triangle({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="var(--color-ink)"
      aria-hidden
    >
      <path d="M12 2 23 21H1L12 2Z" />
    </svg>
  );
}
