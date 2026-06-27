<div align="center">

# 🛎️ Frontdesk

### Send a link, not a document.

**Frontdesk turns your [Aicoo](https://www.aicoo.io) AI COO into a shareable, access-bounded front desk.**
Drop one link in your bio, email signature, or a DM — anyone can walk up, ask your
agent questions, and book time with you. No signup. No back-and-forth. You set
exactly what it's allowed to see and do, and you watch every conversation roll in.

Built for the **Aicoo Hackathon** · powered by Aicoo `/share`, `/chat` & the agent network.

</div>

---

## The problem

The average professional loses **~57% of their time to coordination** — "does Tuesday
work?", "what's your pricing?", "can you send me the deck?". You are the router. You
are the middleware. Every inbound question waits on *you* being awake and at a keyboard.

## The idea

You already have an AI COO on Aicoo that knows your context and your calendar.
Frontdesk gives it a **front door**:

1. **Set the boundaries.** Pick what the link can read (your notes, your calendar),
   whether it can book meetings, and when it expires. This maps directly onto Aicoo's
   scoped share links — *physical* access boundaries, not a polite prompt.
2. **Share one link.** Frontdesk mints it via Aicoo `/share/create`.
3. **Anyone walks up.** A visitor opens the link and chats with *your* agent — zero
   signup. It answers from your context and books on your calendar, inside your rules.
4. **You watch the desk.** Every visitor, question, and booking streams back into your
   dashboard via Aicoo's share analytics.

It's the homepage promise of the agent network — *"talk to a stranger's agent and get
a real answer in seconds"* — packaged as a product a normal person gets in 30 seconds.

## Why it's built on Aicoo, not bolted onto it

| Frontdesk feature | Aicoo primitive |
| --- | --- |
| The front door (scoped, expiring link) | `POST /share/create` |
| What the agent says | `POST /chat` (streaming) |
| What it knows | `/accumulate` + `/context/*` |
| Who walked up & what they asked | `GET /share/list` analytics |
| Acting on your behalf (booking) | `/tools` → `schedule_meeting` |

Remove Aicoo and there is no product. That's the point.

---

## Run it

```bash
npm install
cp .env.example .env.local   # works out of the box in mock mode
npm run dev                  # http://localhost:3000
```

Frontdesk runs **with or without** an Aicoo key:

- **No key →** a high-fidelity simulated COO answers, so the full flow is demoable
  offline. (`FRONTDESK_MOCK=1`, the default.)
- **With a key →** set `AICOO_API_KEY` and `FRONTDESK_MOCK=0` to hit the real Aicoo
  network — live agent, live share links, live analytics.

## Stack

- **Next.js 16** (App Router) · React 19 · TypeScript
- **Tailwind v4** with a hand-built editorial design system (no template look)
- Thin server-side Aicoo client (`lib/aicoo/`) — raw HTTP, NDJSON streaming, mock adapter

## Project layout

```
app/
  page.tsx            landing
  dashboard/          host: create links, configure scope, watch analytics
  c/[token]/          public front desk a visitor chats with
  api/                route handlers that proxy Aicoo (key stays server-side)
lib/
  aicoo/              Aicoo client + types + mock COO
  store.ts            local link <-> profile mapping
  config.ts           single source of env truth
```

---

<div align="center">
<sub>Frontdesk · an Aicoo Hackathon project</sub>
</div>
