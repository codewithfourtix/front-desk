# Frontdesk — demo script & submission kit

Everything you need to record the video and fill the Devpost form. Mapped to the
hackathon's judging rubric so nothing scores zero by omission.

---

## 0. Setup (do this once before recording)

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

- Out of the box it runs in **Demo mode** (simulated COO) — perfect for a clean,
  reliable recording that never depends on the network.
- To record in **Live mode** against the real Aicoo API:
  1. Create a key at https://www.aicoo.io/settings/api-keys
  2. In `.env.local` set `AICOO_API_KEY=...` and `FRONTDESK_MOCK=0`
  3. Connect Gmail/Calendar in the Aicoo web app first (calendar tools are empty
     until you do), then restart `npm run dev`.
- The badge in the top-right of every page shows which mode you're in.

---

## 1. The 90-second demo script

> Record at 1280×720+. Keep the cursor calm. Two tabs: **Dashboard** and an
> incognito window for the **visitor**.

**[0:00–0:12] The hook (landing page)**
> "We lose more than half our time to coordination — pricing questions, 'does
> Tuesday work', sending the same docs. Frontdesk hands that whole job to your AI
> COO. You send a link, not a document."

Scroll the landing page once, top to bottom. Land on **Open your desk**.

**[0:12–0:35] Create a desk (Dashboard)**
- Click **Use example** (fills Ali's profile + context in one click).
- Point at **Access boundaries**: "I decide what the link can see and do — read
  only, see the calendar, or book meetings — and when it expires. This maps
  straight onto Aicoo's scoped share link. It's a physical boundary, not a prompt."
- Click **Open desk & get link**. The green banner shows the shareable link.
- Click **Copy link**.

**[0:35–1:15] Be the visitor (incognito window)**
Paste the link. "No signup — a stranger just walks up to my agent."
- Type: **"Do you build AI agents, and how much does a sprint cost?"**
  → it answers from the context ($4k sprints).
- Type: **"Can we talk this week?"**
  → watch the *Checking the calendar* tool pill, then it proposes real time slots.
- Type: **"Tuesday works"**
  → the **✓ Meeting booked** badge appears; it fires `schedule_meeting`.

**[1:15–1:30] Close the loop (back to Dashboard)**
- Refresh the dashboard. The desk card now shows **Visitors / Chats / Questions**
  going up.
- Click **Inbox** → open the conversation → the full transcript is there, tagged
  with the tools the agent used and a **booked** marker.
> "Every conversation and booking streams back to me. I'm in the loop without
> being the bottleneck. That's an agent network coordinating people — built
> entirely on Aicoo."

---

## 2. Devpost submission answers (paste-ready)

**Project name:** Frontdesk

**One-sentence summary:**
Frontdesk turns your Aicoo AI COO into a shareable, access-bounded front desk —
one link anyone can use to ask you questions and book time, no signup.

**The problem & who it's for:**
Professionals, founders, freelancers, and teams lose ~57% of their time to
coordination. Frontdesk is for anyone who fields the same inbound questions and
scheduling over and over and wants their AI COO to handle it within strict limits.

**Which Aicoo capabilities we used:**
- `POST /share/create` — mints the scoped, expiring guest link that *is* the desk
- `POST /chat` (NDJSON streaming) — the agent's live replies on the public desk
- `/tools` → `schedule_meeting` / calendar tools — booking on the host's behalf
- `GET /share/list` — visitor / conversation / message analytics on the dashboard
- `/accumulate` + `/context` — syncing the desk's knowledge into the COO

**Aicoo's key role:**
Aicoo isn't bolted on — it's the spine. The product *is* a packaging of Aicoo's
scoped agent-to-agent sharing: a stranger talking to your agent under access
boundaries you control. Remove Aicoo and there is no product.

**Did we use AI COO as a team?**
Yes — for team formation/coordination before and during the build (notes, task
planning, and splitting build vs. demo work between the two of us).

**Repo:** https://github.com/codewithfourtix/front-desk
**Demo:** _(add video link)_

---

## 3. Rubric self-check

| Criterion | Weight | How Frontdesk covers it |
| --- | --- | --- |
| Use of Aicoo API/Infra | 30% | 5 distinct Aicoo primitives; the product is a packaging of `/share` + `/chat` |
| Product value & real workflow | 25% | Solves the universal coordination tax; concrete inbound-questions + booking flow |
| Technical execution & demo | 20% | Streaming chat, scoped links, analytics, inbox — all working, build is green |
| Demo clarity & completeness | 15% | This script + the submission answers above; live preview on the landing page |
| Team collaboration with AI COO | 10% | Used AI COO for planning + build/demo split (state this in the form) |
