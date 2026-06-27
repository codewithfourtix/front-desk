import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ModeBadge } from "@/components/ModeBadge";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Hero />
      <Problem />
      <HowItWorks />
      <WhyAicoo />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Logo href="/" />
        <div className="flex items-center gap-3">
          <ModeBadge className="hidden sm:inline-flex" />
          <Link href="/dashboard" className="btn btn-clay px-4 py-2 text-sm">
            Open your desk
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rise">
          <span className="tag mb-5">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-clay)" }} />
            Built on Aicoo · the agent network
          </span>
          <h1 className="font-display text-[2.7rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Send a link,
            <br />
            <span className="text-clay">not a document.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            Frontdesk turns your AI COO into a shareable front desk. Drop one link —
            anyone can ask it questions and book time with you. No signup. No
            back-and-forth. You decide exactly what it can see and do.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/dashboard" className="btn btn-clay px-5 py-3 text-base">
              Open your desk — it&apos;s free
            </Link>
            <Link href="/dashboard" className="btn btn-ghost px-5 py-3 text-base">
              See how it works
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">
            30 seconds to set up · runs in demo mode with zero config.
          </p>
        </div>

        <DeskPreview />
      </div>
    </section>
  );
}

/** A static, on-brand preview of a desk conversation. */
function DeskPreview() {
  return (
    <div className="card overflow-hidden shadow-sm rise" style={{ boxShadow: "0 20px 60px -30px rgba(23,19,15,.35)" }}>
      <div className="h-1.5 w-full" style={{ background: "var(--color-clay)" }} />
      <div className="flex items-center gap-3 border-b border-line p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: "var(--color-clay)" }}>
          A
        </span>
        <div>
          <div className="font-display text-sm font-semibold text-ink">Ali&apos;s front desk</div>
          <div className="text-xs text-muted">Co-founder, Fourtix · Open</div>
        </div>
        <span className="tag ml-auto">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-good)" }} />
          no signup
        </span>
      </div>
      <div className="space-y-3 p-4">
        <PreviewMsg side="agent">
          Hi — I&apos;m Ali&apos;s front desk. Ask me anything, or book a time with him directly.
        </PreviewMsg>
        <PreviewMsg side="visitor">Do you build AI agents? And can we talk this week?</PreviewMsg>
        <PreviewMsg side="agent" tools={["Checking the calendar"]}>
          Yes — that&apos;s Fourtix&apos;s core work. Here are a few times that work on Ali&apos;s
          calendar:
          {"\n"}1. Tuesday at 2:30 PM
          {"\n"}2. Wednesday at 10:00 AM
          {"\n"}Which works best?
        </PreviewMsg>
        <PreviewMsg side="visitor">Tuesday works</PreviewMsg>
        <PreviewMsg side="agent" booking>
          Done — you&apos;re on Ali&apos;s calendar. ✅ Invite&apos;s on its way.
        </PreviewMsg>
      </div>
    </div>
  );
}

function PreviewMsg({
  side,
  children,
  tools,
  booking,
}: {
  side: "agent" | "visitor";
  children: React.ReactNode;
  tools?: string[];
  booking?: boolean;
}) {
  const agent = side === "agent";
  return (
    <div className={`flex ${agent ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[85%]">
        {booking && (
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-good/10 px-2 py-0.5 text-[0.68rem] font-semibold text-good">
            ✓ Meeting booked
          </div>
        )}
        <div
          className={
            agent
              ? "rounded-2xl rounded-tl-sm border border-line bg-card px-3.5 py-2 text-sm leading-relaxed text-ink"
              : "rounded-2xl rounded-tr-sm bg-ink px-3.5 py-2 text-sm leading-relaxed text-paper"
          }
        >
          <span className="whitespace-pre-wrap">{children}</span>
        </div>
        {tools && (
          <div className="mt-1 flex gap-1">
            {tools.map((t) => (
              <span key={t} className="tag text-[0.62rem]">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-pine)" }} />
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Problem() {
  return (
    <section className="border-y border-line bg-paper-2/50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-8 sm:grid-cols-[auto_1fr]">
          <div className="font-display text-7xl font-semibold text-clay sm:text-8xl">57%</div>
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
              of your time goes to coordination.
            </h2>
            <p className="mt-2 max-w-2xl text-lg leading-relaxed text-ink-2">
              &ldquo;Does Tuesday work?&rdquo; · &ldquo;What&apos;s your pricing?&rdquo; ·
              &ldquo;Can you send the deck?&rdquo; You are the router — the middleware
              between everyone who needs you and the answers in your head. Every question
              waits on you being awake and at a keyboard.
            </p>
            <p className="mt-3 text-lg font-medium text-ink">
              Frontdesk hands that job to your AI COO.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Set the boundaries",
      body: "Pick what the link can see — your notes, your calendar — whether it can book, and when it expires. Real, physical access limits.",
    },
    {
      n: "02",
      title: "Share one link",
      body: "Frontdesk mints it through Aicoo. Put it in your bio, signature, or a DM. That's the whole setup.",
    },
    {
      n: "03",
      title: "Anyone walks up",
      body: "Visitors chat with your agent — no signup. It answers from your context and books on your calendar, inside your rules.",
    },
    {
      n: "04",
      title: "Watch the desk",
      body: "Every visitor, question, and booking streams into your dashboard. You stay in the loop without being the bottleneck.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mb-12 text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          From you-as-middleware to one link
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          The whole thing takes about 30 seconds to set up.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div key={s.n} className="card p-6">
            <div className="font-mono text-sm font-semibold text-clay">{s.n}</div>
            <h3 className="mt-3 font-display text-lg font-semibold text-ink">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhyAicoo() {
  const rows = [
    { f: "The front door — a scoped, expiring link", a: "POST /share/create" },
    { f: "What the agent says, streamed live", a: "POST /chat" },
    { f: "What it knows about you", a: "/accumulate + /context" },
    { f: "Who walked up & what they asked", a: "GET /share/list analytics" },
    { f: "Booking on your behalf", a: "/tools → schedule_meeting" },
  ];
  return (
    <section className="border-y border-line bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <span className="tag" style={{ background: "rgba(247,244,237,.08)", borderColor: "rgba(247,244,237,.18)", color: "var(--color-paper)" }}>
              Why it&apos;s Aicoo, not bolted on
            </span>
            <h2 className="mt-5 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Remove Aicoo and there&apos;s no product.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-paper/70">
              Frontdesk isn&apos;t a chatbot with an API stuck to the side. Every core
              capability <em>is</em> an Aicoo primitive — the agent network is the
              spine, not a feature.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-paper/15">
            {rows.map((r, i) => (
              <div
                key={r.a}
                className={`grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 ${i % 2 ? "bg-paper/[0.03]" : ""}`}
              >
                <span className="text-sm text-paper/90 sm:text-base">{r.f}</span>
                <code className="rounded bg-paper/10 px-2.5 py-1 font-mono text-xs text-paper sm:text-sm">{r.a}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
      <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
        Give your front desk a front door.
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-lg text-muted">
        Open a desk, share the link, and let your AI COO handle the rest.
      </p>
      <Link href="/dashboard" className="btn btn-clay mt-8 px-6 py-3.5 text-base">
        Open your desk
      </Link>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <Logo href="/" size="sm" />
        <p className="text-sm text-muted">
          An Aicoo Hackathon project · built on the agent network.
        </p>
      </div>
    </footer>
  );
}
