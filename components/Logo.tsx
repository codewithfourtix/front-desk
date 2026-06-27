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
  const bell = size === "lg" ? 26 : size === "sm" ? 18 : 22;

  const inner = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Bell size={bell} />
      <span className={`font-display ${text} font-semibold tracking-tight text-ink`}>
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

function Bell({ size }: { size: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full"
      style={{
        width: size + 10,
        height: size + 10,
        background: "var(--color-clay)",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 10a6 6 0 1 1 12 0c0 .6.2 1.2.6 1.6l1 1a1 1 0 0 1-.7 1.7H4.1a1 1 0 0 1-.7-1.7l1-1c.4-.4.6-1 .6-1.6Z" />
        <path d="M11 18a1 1 0 0 0 2 0" />
      </svg>
    </span>
  );
}
