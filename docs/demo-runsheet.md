# Demo run sheet

The operational layer for the submission video. `docs/PRD.md` §4.4 owns the
narrative and §4.5 owns the Q&A answers — this file is the clicks, the timings
and what to do when something breaks on camera.

Read it once the day before. Work the pre-flight the hour you record.

---

## 1. Pre-flight, about ten minutes

Do all of these. Two of them have caught a broken deployment already.

| # | Check | How | Pass looks like |
|---|---|---|---|
| 1 | Every screen answers | the loop below | seven `200`s |
| 2 | **The agent is really live** | the `curl` below | `decidedBy` names a model |
| 3 | The book has contracts | `npm run book` | a non-zero USDC-priced count |
| 4 | Storage is Postgres | open `/`, read the footer strip | `STORAGE: POSTGRES` |
| 5 | Tests are green | `npm run check` | typecheck, lint, tests all pass |
| 6 | **The copy loop closes** | `/leaderboard`, click row 3 | The strategy page shows **row 3's** trade, and "Build my trade" arrives with the box filled |

```bash
for r in / /trade /arena /leaderboard /copy /feed /profile; do printf '%s -> ' "$r"; curl -s -o /dev/null -w '%{http_code}\n' "https://optionarena-uoqy.vercel.app$r"; done
```

```bash
curl -s -X POST https://optionarena-uoqy.vercel.app/api/interpret -H 'content-type: application/json' -d '{"view":"ETH drops below 2200 this week","budget":5,"risk":"balanced"}' | grep -o '"decidedBy":"[^"]*"'
```

**Check 2 is the one that matters most**, and it is the one the Vercel dashboard
lies about. Per PRD §2.8, a variable can exist with an empty value. Worse, it can
exist with a *bad* value. Read the answer carefully:

| `decidedBy` says | What is true | Do |
|---|---|---|
| `anthropic:claude-sonnet-5` | The agent is live | Record |
| `rules` | No key is set | Set `ANTHROPIC_API_KEY`, redeploy |
| `rules (the model could not be reached)` | **A key is set and the call is failing** | Read the Vercel runtime log for `[interpret] model call failed:` and believe what it says. Do not guess from the symptom — this was diagnosed as a billing problem it never was, when the log said a rejected SDK parameter |
| `rules (model returned an unusable answer)` | The model replied and validation rejected it | The raw reply is logged server-side. Read it before assuming the model was at fault; a too-tight schema was the culprit last time, not the answer |

### Screen and room

- One clean browser window. No bookmarks bar, no other tabs, no extensions bar
- 1280×800, zoom at 100%
- Close every notification source — Slack, mail, phone on the desk
- Screen recorder at 1080p, microphone tested with thirty seconds played back
- Have `docs/decisions.md` open in a second window for the hash, if there is one

---

## 2. Decide which version you are recording

The video is 3–5 minutes. There are two versions and the difference is one beat.

**Version A — a real mainnet hash exists.** Record the full arc through Basescan.
This is the version the hackathon asks for, and Track 02 needs it.

**Version B — no hash yet.** Record everything else and be direct about the gap.
Do not imply a fill happened. Say this, in these words or close to them:

> "The signing path is built and proven — seven checks before anything is
> signed, and a dry run against the live book. What you are watching is demo
> mode: the same real prices from the same live book, the same maximum-loss
> calculation, stopping at the signature. We have not placed a mainnet fill
> yet."

Then move straight on. One clean sentence beats thirty seconds of hedging, and a
judge will respect it more than a vague claim.

**Record Version B today even if you expect a hash tomorrow.** A video that
exists is worth more than a better one that does not, and re-recording one beat
is cheap.

---

## 3. The shape, with a clock

| Time | Beat | Screen |
|---|---|---|
| 0:00–0:30 | The problem | Title card or `/` |
| 0:30–0:50 | What it is, one sentence | `/` |
| 0:50–1:20 | Describe a view in plain language | `/` step 01 |
| 1:20–2:10 | **The agent's reading, and the maximum loss** | step 02 |
| 2:10–2:50 | Prove it — Version A or B | step 03 |
| 2:50–3:45 | **Copy a sourced trade, end to end** | `/leaderboard` → `/copy/strategy` → `/trade` |
| 3:45–4:00 | Custody, said plainly | `/profile` or the footer |
| 4:00–4:30 | Close | `/` |

Rehearse out loud with a timer. The beat that always overruns is 1:20–2:10.

---

## 4. Beat by beat

### 0:00 — The problem

> "Options are the biggest market in finance, and almost nobody in crypto
> touches them. Not because they are bad — because they are hostile. Greeks,
> strikes, expiries, and no clear answer to the only question that matters:
> what is the most I can lose?"

Do not show a screen yet. Let the sentence land.

### 0:30 — What it is

> "OptionArena takes a sentence about what you think happens, and gives you back
> a real options position on Base with a fixed maximum loss you approve before
> anything is signed."

Show `/`. Point at the market pulse strip — it is live, and it proves the book
is real. **Do not read the numbers from this document; they change hourly.**

### 0:50 — Describe

Type it yourself, do not click the example chip. Typing reads as real.

> "ETH drops below 2,200 this week."

Set the maximum spend. Say the number out loud. Click **Interpret my view**.

### 1:20 — The reading, and the floor

This is the most important thirty seconds in the video. Point at three things,
in this order:

1. **The contract it chose**, and the sentence underneath saying why
2. **`Chosen by …`** — say the model name if the agent is live
3. **The maximum loss, large.** Read it aloud:

> "This is the most you can lose. Nothing can take more than this, whatever the
> market does."

Then the payoff chart, briefly — the dashed floor is the promise drawn.

Say this next, because it is the strongest thing about the build:

> "The model never touches a number. It picks which contract expresses your
> view and explains why. Every price, every maximum loss, comes from the live
> book. A model that invents a premium is a model that loses your money."

If the contract is physically settled, the interface says so. Read that line
out — it is a detail most teams get wrong.

### 2:10 — Prove

**Version A:** click through, let the hash land, then open Basescan on screen.

> "Nothing here is self-reported. That is on Base, and anyone can check it."

**Version B:** click **Simulate this trade**, show the honest simulated panel,
and say the Version B sentence from §2. Then say:

> "The number you are looking at is not a mock. It is what the live path would
> have spent, at the price the book is quoting right now."

### 2:50 — Copy a sourced trade, end to end

**This is a click-through, not a tour.** Do not narrate over static screens —
the point is that the loop closes, so let it close on camera.

Open `/leaderboard`. Say where the ranking comes from while it is on screen:

> "The name says arena, so here is the honest version of it. Thetanuts' own book
> is too thin to have anyone worth copying yet — their team told us that
> directly. So we rank real flow from Deribit, where the depth is, and map it
> onto contracts that actually exist on Base. Every row says why it ranked. We
> rank trades, never traders."

That last line matters. Deribit's public trades carry no identity, so a track
record is not derivable — and claiming one would be a lie. See `decisions.md` §11.

Then do the three clicks, without hurrying:

1. **Click a row that is not the top one.** Row 3 is a good choice — it proves
   the page opens the trade you picked. Point at the **Exact match** badge:

   > "That is a real Deribit trade, and the strike and expiry exist on Thetanuts.
   > The badge says whether it is an exact match or a near one, and a near one
   > lists every difference. It never substitutes silently."

2. **Click "Build my trade."** Let the viewer see the box arrive already filled:

   > "It carries the view across, not the contract. The agent reads it against
   > the live book and may well pick a different strike — so you approve the
   > quote and the maximum loss, same as any other trade. Nothing is copied
   > automatically."

3. **Click "Interpret my view."** Land on a real quote for that expiry.

> "That is the whole loop. Real flow from a venue with depth, ranked with a
> reason, mapped onto a contract that exists on Base, priced from the live book."

If a beat has to be cut for time, cut something else. This one is the product.

### 3:30 — Custody

Do not skip this and do not bury it. It is on screen already, in the footer.

> "We sign from one server wallet, and we say so on every screen. You are not
> connecting your own. This is a product demonstration, not self-custody."

### 3:50 — Close

> "Options are the biggest market in finance and almost nobody in crypto touches
> them. Not because they're bad — because they're hostile. You describe what you
> think happens. You see exactly what you can lose. Then you prove it happened."

---

## 5. If it breaks while recording

| It happens | Do this |
|---|---|
| The interpret step hangs | Wait five seconds, then cut. Do not narrate the wait |
| `Chosen by rules …` appears unexpectedly | Keep going. Say "the agent is unreachable right now, so the deterministic selector ran — the product is built to degrade rather than fail." Then fix it and re-record that beat |
| The book returns nothing | Stop. There is no honest demo without a live book. Re-run the pre-flight |
| "That trade has rolled off the board" appears | Expected, not a bug — Deribit flow rotates and the trade you opened is gone. Either keep going and say so, or go back and pick a fresher row. Do **not** apologise for it; it is the page being honest rather than swapping a different trade in silently |
| A live fill hangs | Cut to the backup recording. PRD §4.4 requires one |
| You fluff a line | Stop, breathe, restart the beat. Do not fix it in narration |

**Record a backup of any successful live trade the moment you get one.** Venue
wifi fails at the worst possible moment, and you cannot re-run a mainnet fill.

---

## 6. Never say

Straight from PRD §4.7. Each of these loses more credibility than it buys.

- Anything implying the product **improves returns**. It makes risk legible. That is the claim
- That the model calculates, prices, or predicts anything
- A position without its maximum loss on screen
- A unit the interface is not actually spending — it is `aBasUSDC`, not "USDC"
- Any suggestion that users hold their own keys

---

## 7. After recording

- [ ] Watch it once muted, and once with your eyes closed
- [ ] Under five minutes
- [ ] The maximum loss is legible at 1080p
- [ ] Version A: the hash is readable and matches `decisions.md` §9
- [ ] Version B: the gap is stated once, plainly, and not repeated
- [ ] Custody is said out loud
- [ ] No key, `.env`, or terminal history is visible in any frame
- [ ] Uploaded, link is public, and the link is in the submission

That last check has ended more hackathon runs than any bug.
