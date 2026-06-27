@AGENTS.md

# Frontdesk — project notes

**What:** Frontdesk turns an Aicoo AI COO into a shareable, access-bounded "front
desk." One link → anyone can chat with your agent and book time, no signup. Built
for the Aicoo Hackathon. See `README.md` (pitch) and `DEMO.md` (demo + submission).

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TS · Tailwind v4.
Heed `AGENTS.md` above — this Next is newer than training data; check
`node_modules/next/dist/docs/` before using unfamiliar APIs. Dynamic route
`params` and route-handler `ctx.params` are **async** (Promises) — always await.

**Architecture:**
- `lib/config.ts` — single env source of truth. `liveMode()` = real Aicoo vs mock.
- `lib/aicoo/` — `client.ts` (raw HTTP + NDJSON `/chat` stream), `mock.ts`
  (context-aware simulated COO, the demo engine), `index.ts` (live/mock facade),
  `types.ts`. Nothing outside this folder knows which mode is active.
- `lib/store.ts` — file-backed (`.data/frontdesk.json`) desks + conversations.
- `lib/desk-service.ts` — validation + orchestration (create desk = mint Aicoo
  share link + persist + sync context). Routes stay thin.
- `app/api/*` — desks CRUD, `/chat` (NDJSON stream), status.
- `app/c/[token]` — public desk; `app/dashboard` — host UI; `app/page.tsx` — landing.
- `components/` — `Chat.tsx` (streaming client), `dashboard/*`.

**Modes:** runs with **no key** (mock, `FRONTDESK_MOCK=1`, default) or **live**
(`AICOO_API_KEY` set + `FRONTDESK_MOCK=0`). Live calendar/email needs OAuth done in
the Aicoo web app first.

**BYOK (per-desk key):** a host can paste their own `aicoo_sk_…` when creating a
desk. It's validated against Aicoo `/init`, stored on the `Desk` record
(server-only), and used for that desk's share link + chat + bookings, so bookings
land on *their* calendar. Falls back to the global key when absent. The key is
NEVER serialized to the client — all client-facing desk objects are built through
`desk-service.toView`, which strips `aicooKey` (`DeskView` exposes only `byok:
boolean`). When threading any new field onto `Desk`, re-check that path.

**Conventions:** commit per logical unit, feature branches merged `--no-ff` to
`main`, push directly to `main` (no PRs needed). **No Claude co-author trailer in
commit messages.** Design is hand-built editorial (paper/ink/clay) — keep it
non-templated.

**Verify before pushing:** `npx tsc --noEmit && npm run build`.
