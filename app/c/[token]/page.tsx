import type { Metadata } from "next";
import Link from "next/link";
import { getDeskByToken } from "@/lib/store";
import { deskIsOpen } from "@/lib/desk-service";
import { Chat } from "@/components/Chat";
import { Logo } from "@/components/Logo";

interface Props {
  params: Promise<{ token: string }>;
}

// Desks are created at runtime and read from disk — never prerender/cache this.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const desk = await getDeskByToken(token);
  if (!desk) return { title: "Desk not found" };
  const { name, headline } = desk.profile;
  return {
    title: `${name}'s front desk`,
    description: headline,
    openGraph: { title: `${name}'s front desk`, description: headline },
  };
}

export default async function DeskPage({ params }: Props) {
  const { token } = await params;
  const desk = await getDeskByToken(token);

  if (!desk || desk.revoked) return <ClosedDesk reason="not-found" />;
  if (!deskIsOpen(desk)) return <ClosedDesk reason="expired" />;

  const { profile } = desk;
  const firstName = profile.name.split(/\s+/)[0] || profile.name;
  const greeting = `Hi — I'm ${firstName}'s front desk. ${
    profile.headline
  } Ask me anything${
    profile.bookingEnabled ? `, or book a time with ${firstName} directly.` : "."
  }`;

  const starters = [
    `What does ${firstName} do?`,
    profile.bookingEnabled ? `Can I book a quick call?` : `How do I reach ${firstName}?`,
    `What should I know first?`,
  ];

  const accent = profile.accent || "var(--color-clay)";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6 sm:py-10">
      {/* Desk header */}
      <header className="card overflow-hidden">
        <div className="h-1 w-full" style={{ background: accent }} />
        <div
          className="flex items-center gap-4 p-5 sm:p-6"
          style={{
            background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 7%, var(--color-card)), var(--color-card))`,
          }}
        >
          <span className="relative shrink-0">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold text-white shadow-sm"
              style={{ background: accent }}
            >
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
            <span
              className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card"
              style={{ background: "var(--color-good)" }}
              title="Online"
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-semibold tracking-tight text-ink">
                {profile.name}
              </h1>
              {profile.role && (
                <span className="hidden truncate text-sm text-muted sm:inline">
                  · {profile.role}
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-[0.95rem] leading-relaxed text-ink-2">
              {profile.headline}
            </p>
          </div>
        </div>
      </header>

      {/* Chat */}
      <section className="card mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
        <Chat
          token={desk.token}
          hostName={profile.name}
          greeting={greeting}
          bookingEnabled={profile.bookingEnabled}
          starters={starters}
          accent={profile.accent}
        />
      </section>

      {/* Footer credit */}
      <footer className="mt-5 flex items-center justify-center gap-2 text-xs text-muted">
        <span>Powered by</span>
        <Logo href="/" size="sm" />
        <span className="text-line-2">·</span>
        <span>built on Aicoo</span>
      </footer>
    </main>
  );
}

function ClosedDesk({ reason }: { reason: "not-found" | "expired" }) {
  const expired = reason === "expired";
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="card w-full p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-paper-2 text-muted">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </div>
        <h1 className="font-display text-xl font-semibold text-ink">
          {expired ? "This desk has closed" : "Desk not found"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {expired
            ? "The link for this front desk has expired or was revoked by its owner."
            : "We couldn't find a front desk at this link. It may have been removed."}
        </p>
        <Link href="/" className="btn btn-ghost mt-6">
          Go to Frontdesk
        </Link>
      </div>
    </main>
  );
}
