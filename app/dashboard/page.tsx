import Link from "next/link";
import type { Metadata } from "next";
import { listDeskViews } from "@/lib/desk-service";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import type { DeskDTO } from "@/components/dashboard/types";
import { Logo } from "@/components/Logo";
import { ModeBadge } from "@/components/ModeBadge";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Open desks, share links, and watch every conversation roll in.",
};

// Always render fresh — desks/analytics change per request.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const desks = (await listDeskViews()) as unknown as DeskDTO[];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo href="/" />
          <div className="flex items-center gap-2 sm:gap-3">
            <ModeBadge />
            <ThemeToggle />
            <Link href="/" className="btn btn-ghost px-3 py-1.5 text-sm">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <DashboardClient initialDesks={desks} />
      </main>
    </div>
  );
}
