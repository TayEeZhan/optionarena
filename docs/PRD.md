# OptionArena — Product Requirements Document

**Event:** MUBA Hacks 2026 · Thetanuts track
**Submission:** 5 September 2026, 23:59 MYT (Devfolio)
**Pitch:** 6 September 2026, APU
**Revised:** 31 August 2026 — merged against the working repo
**Repo:** `github.com/TayEeZhan/optionarena`

---

## Status of this document

This replaces the first PRD, which specified a **syndicate pooling model** that
the architecture cannot support and the market does not want. Architecture,
constraints and market facts in this version come from the working code and are
verifiable against it. Vision, interface direction and the non-negotiables come
from the product spec.

Where the two disagreed, the repo won on anything empirical and the spec won on
anything about what the product is *for*. §0 records exactly what was dropped.

The four thinking levels are retained as the structure:

| Level | Question | Section |
|---|---|---|
| 1. Logical | What is the thing? | §1 |
| 2. Analytical | What are the rules, and what can we actually build on? | §2 |
| 3. Computational | How does it map onto states, and how are the rules enforced? | §3 |
| 4. Procedural | How do we excel? | §4 |

## Which document owns what

Five documents describe this project. To stop them drifting, each owns one
thing and defers on everything else.

| Document | Owns | Go to it for |
|---|---|---|
| `README.md` | The public face | What the product is, setup, contracts, status |
| `CLAUDE.md` | Working rules | Stack, decimals rule, security rules, conventions |
| `docs/decisions.md` | Settled decisions | Why the architecture is what it is |
| `tasks/todo.md` | **Day-to-day priority** | What to do next, P0–P4, open questions |
| `docs/PRD.md` (this) | Product intent | What the product is *for*, the interface direction, the non-negotiables |

**This document does not set the schedule.** `tasks/todo.md` does. Where the two
appear to disagree about what to work on next, `tasks/todo.md` wins. §4.2 here
is a triage order for when time runs short, not a plan.

---
---

# 0. WHAT WAS DROPPED, AND WHY

Recorded so the team can see the reasoning rather than wonder where half a
specification went.

| Dropped | Why |
|---|---|
| **Syndicates / capital pooling** | On-platform copy-trading cannot work at current depth: too little TVL means there is nobody to copy. Cold start is not a Q&A risk here, it is fatal. **Source: `README.md`, which attributes this to the Thetanuts team directly. Not independently verified — if anyone challenges it in Q&A, say where it came from rather than defending the number.** |
| **Pro-rata shares, carry, idle/deployed states** | All four depend on users holding their own capital. OptionArena signs from **one server wallet**; users never connect one. These are impossible by construction, not merely unbuilt. |
| **Per-follower risk gate (style drift, concentration)** | Same reason. There are no followers with capital to gate. The *idea* survives — see §3.7 — because sourced signals from strangers would need exactly that guard. |
| **Mark-to-market on open positions** | Was introduced to stop leaders hiding unrealised losses on a leaderboard of pooled positions. With no pooled positions, the leaderboard ranks settled strategies instead, and `MIN_TRADES_TO_RANK` already guards the sample. |
| **Prisma** | The repo uses Drizzle with the Neon HTTP driver, chosen because it works in a serverless function without holding a connection open. Correct call; the spec was wrong. |
| **Covered-call / vault examples** | Calls on Base are collateralised in the asset they deliver. A "budget of 5" against a BTC call means 5 cbBTC. Only puts are tradable today. Measured, not assumed. |

**Do not resurrect the syndicate model.** It is settled.

---
---

# 1. LOGICAL — What is the thing?

## 1.1 One sentence

**OptionArena is an options desk where you describe a market view in your own
words, an agent turns it into a defined-risk position on Thetanuts, you approve
the maximum loss before anything is signed, and the result is published with a
transaction hash anyone can check.**

## 1.2 The problem

Options are the largest market in traditional finance and barely exist in
crypto. The reason is not demand. The interfaces assume you already speak the
language — strike, expiry, delta, implied volatility. If you cannot price a
contract yourself, you cannot use one, even when an option is exactly the
instrument you need.

Four barriers, in the order a person hits them:

1. **The jargon wall.** Most people quit in five minutes.
2. **"How much can I lose?"** Options genuinely have defined risk. No interface
   says so, so people assume leverage and stay away.
3. **Choice paralysis.** Hundreds of strike × expiry combinations per asset.
4. **It is lonely and boring.** No reason to come back tomorrow.

## 1.3 The insight

The first three are answered by the flow that already exists: plain language in,
one contract out, maximum loss on screen before anything is signed.

The fourth is not answered yet, and it is the one in the product's name.
**It is called OptionArena and it currently has no arena.** Executed strategies
are stored with a `trader` column and a leaderboard route exists, but nothing is
ranked and nothing competes. See §3.7 and the arena-layer proposal in the repo.

## 1.4 The goal

**Make options social, competitive and legible rather than a technical
exercise** — without lying about risk, and without claiming the product makes
anyone money.

Three commitments that follow:

- **Hide the machinery, never the risk.** Always show maximum loss, in the unit
  the user was promised, before confirmation.
- **Never imply the product improves returns.** Not the feed, not the
  leaderboard, not the agent. Every claim is about legibility and informed
  consent.
- **Competition is bragging rights, never a stake.** Gamify the record, not the
  money.

## 1.5 Who it is for

**Primary.** Someone who has a view on the market — "ETH drops below 2,200 this
week" — and no way to express it without learning to price contracts. They have
20–200 USDC and will never read an options textbook.

**Secondary.** The judge, on 6 September, who needs to see in ninety seconds
that this is real and not a mockup. That is what the transaction hash is for.

## 1.6 What it is not

- Not a wallet. Not a DEX. Not an options protocol — Thetanuts is the protocol.
- **Not self-custody.** One server wallet demonstrates the product. Stated in
  the README, on the profile page, and in the pitch.
- Not investment advice. No returns are promised anywhere.
- Not a betting app. Any competitive layer is unstaked.

---
---

# 2. ANALYTICAL — Rules and ground truth

## 2.1 Hackathon rules

### The two tracks

| Track | Prize | Won by |
|---|---|---|
| **01 — Best product on the Thetanuts SDK** | 1,000 USDC | A real working product using on-chain options meaningfully |
| **02 — AI × Options** | 1,000 USDC | An agent that places a real on-chain trade through OptionBook or OptionFactory |

One entry may take both. Sponsor's words: *"Nothing stops one entry taking both
tracks. If we're happy with it, you can win both."*

**Resolved 31 Aug 2026:** Devfolio takes both tracks in **one submission**. One
codebase, one entry, both tracks. See `docs/decisions.md` §13.

### The hard rule

> *"If it would work identically with the Thetanuts calls stubbed out, it isn't
> really using on-chain options."*

OptionArena passes: every price, premium and maximum loss comes from the live
book, and the proof of a strategy is its transaction hash.

### Judging

Two questions only. **Does it work?** — a real running product, not a mockup.
**Would anyone actually use it?** — *"a couple of honest sentences beats a
business plan."*

### Operating constraints

| Rule | Value |
|---|---|
| Chain | Base **mainnet**, chainId **8453** |
| Own contracts | **None.** Deploying our own with real funds is an instant disqualification |
| Trade size | 1–3 USDC. `MAX_TRADE_USDC` defaults to 25 |
| Wallet | Fresh burner, funded with the minimum |
| Keys | `.env` gitignored since the first commit. Server-side only |
| Commits | **No commit may predate 26 Aug 2026** |
| AI tools | Declared in `AI_TOOLS.md`, maintained from commit one |
| Source of truth | The repo beats the slides |

### Submission

Public repo with clear history · README with description, problem, chain,
contract addresses, setup, team · 3–5 minute video · every AI tool declared ·
live demo URL · **a real mainnet transaction hash**. Late = disqualified.

Pitch: 5 minutes + 5 minutes Q&A, live demo required.

## 2.2 Market reality — measured, not assumed

> **These counts are a snapshot and move constantly. Do not quote them from
> memory.** Run `npm run book` — no key needed — and read the current numbers
> before putting any figure in a pitch, a README or a slide.

Snapshot taken 31 August 2026, 16:52 MYT:

| Question | Answer |
|---|---|
| Is the book live? | Yes. **361 resting orders, 77 buyable**, indexer lag 0 blocks |
| Which assets have resting **sell** orders? | **ETH and BTC only** (BTC 42/134, ETH 35/119) |
| SOL, XRP, BNB, AVAX? | Bids only. Cannot be bought at all (0 buyable of 40/27/33/8) |
| Buyable structures | `PHYSICAL_PUT` and `PHYSICAL_CALL` |
| Put collateral | `aBasUSDC`, 6 decimals |
| Call collateral | `aBasWETH` (18dp) for ETH, `cbBTC` (8dp) for BTC |
| Spot price | **Unavailable** — this is what blocks denominating a budget for calls |

An earlier snapshot recorded ~295 resting and 36 buyable puts. Both numbers had
moved within a day. The *shape* of the finding is stable — ETH and BTC only,
puts only, USDC-collateralised — but the counts are not.

**Consequence: puts only, today.** OptionArena asks for a budget in USDC and
promises a maximum loss in USDC, so it only offers contracts where that is
literally true. Every buyable put is USDC-collateralised; every buyable call is
collateralised in the asset it delivers, so a budget of `5` against a BTC call
would mean 5 cbBTC.

**Bearish and protective views work. Bullish views are told so plainly rather
than being handed a put.** Lifting this needs a spot source to convert the
budget; `api.getMarketPrices()` was unavailable during the build.

Both limits are the market's, not the product's, and both are surfaced in the
interface rather than hidden.

## 2.3 The Thetanuts SDK — the required dependency

`@thetanuts-finance/thetanuts-client` v0.3.0 with ethers v6.

| Contract | Address |
|---|---|
| OptionBook | `0x1bDff855d6811728acaDC00989e79143a2bdfDed` |
| OptionFactory | `0x8118daD971dEbffB49B9280047659174128A8B94` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| cbBTC | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` |

These are not hand-typed. `lib/thetanuts/client.ts` calls the SDK's own
`getChainConfigById(8453)`, and `npm run book` prints the OptionBook address it
resolves to — confirmed matching the table above on 31 August 2026. If the SDK
changes them, the code follows automatically and this table is what goes stale.

**Not MCP, not AgentKit.** `@thetanuts-finance/mcp` is a *developer-time*
context server — its job is `get_sdk_context` for a coding agent, and the team
should have it in their editor. AgentKit implies an autonomous backend wallet
acting without review, which would remove the human approval step that is the
whole point of the product. The SDK is used directly with a thin model adapter
in `lib/agent/llm.ts`.

**A dependency returning zero is a question, not an answer.**
`calculateMaxPayout` returns `0` for every contract because it does not cover
physically settled implementations, and every buyable order on Base is
physically settled. Payoff is computed in `lib/thetanuts/quote.ts` instead.

## 2.4 Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router, React 19 |
| Language | TypeScript, Node 20+ |
| Chain | ethers v6 |
| Protocol | `@thetanuts-finance/thetanuts-client` v0.3.0 |
| Model | `@anthropic-ai/sdk` behind an adapter, rule-based fallback |
| Validation | zod on anything the model returns |
| Database | Drizzle ORM + Neon HTTP driver, Postgres |
| Styling | Tailwind v4 |
| Toasts | sonner |
| Tests | vitest |
| Hosting | Vercel, Singapore region |

**Drizzle with the Neon HTTP driver** because it works in a serverless function
without holding a connection open between invocations.

**`DATABASE_URL` is required in production, not optional.** Vercel's filesystem
is read-only and per-invocation, so the file store silently loses every strategy
on the deployed URL — the feed and leaderboard would come up empty on the exact
link the judges open.

## 2.5 Custody — stated, not hidden

**OptionArena signs server-side, from one wallet.** The key lives in the host's
secret store, is read only in `lib/thetanuts/client.ts`, and never reaches the
browser. Every module that can touch it imports `server-only`, so an accidental
client import is a build error rather than a leaked key.

**Why:** for a five-day build the alternative costs more than it returns. Every
user, including a judge on demo day, would need ETH on Base before anything
worked, and the demo would depend on their wallet and their gas.

**What it rules out:** users cannot trade their own funds. This is one wallet
demonstrating a product, not self-custody. It is said in the README, on the
profile page and in the pitch.

**How it lifts:** the SDK's `encodeFillOrder` already returns calldata for viem,
wagmi or any connector, so moving to connected wallets is a contained change.

## 2.6 Money handling — the rules that prevent disasters

Three of the bugs found so far were money bugs, all caught by running against
the live book rather than by reasoning about it. Every one typechecked.

**Every token amount goes through `lib/thetanuts/decimals.ts`.** No raw
`parseUnits` anywhere else — ESLint enforces it.

- Amounts are `bigint`, never a JavaScript number
- Format for display at the last possible moment
- `assertMagnitude` before anything is signed
- **Decimals come from the order's own collateral token.** Never hardcode 6, 8
  or 18
- **A contract count uses the same decimals as its collateral token.** Derived,
  not documented: it follows from `contracts * price / 1e8 == collateral`, which
  holds exactly on every live order

**Order identity is a hash of the contract-defining fields** — maker,
implementation, collateral token, price feed, strikes, expiry, option type.
Never `nonce`: on the live book 72 maker-sell orders shared 13 nonces, and one
nonce covered 18 contracts across different strikes *and* expiries. Price and
nonce are deliberately excluded from the hash, because makers requote about once
a minute and ids that include price expire within seconds. Price movement is
handled where it belongs — a 2% slippage check at execution.

**Amounts are stored as `text`** — exact decimal strings from `decimals.ts`. A
float column would reintroduce the rounding error the whole module exists to
prevent.

## 2.7 Setup

```bash
git clone https://github.com/TayEeZhan/optionarena.git
cd optionarena
npm install
cp .env.example .env
npm run dev            # http://localhost:5190
```

Works immediately with no keys: prices, book and maximum loss are all real, only
the signature is missing.

| Variable | Effect if unset |
|---|---|
| `PRIVATE_KEY` | Live trading unavailable, app pinned to demo mode |
| `ANTHROPIC_API_KEY` | Rule-based selector runs and labels itself as such |
| `BASE_RPC_URL` | Falls back to `https://mainnet.base.org` |
| `MAX_TRADE_USDC` | Ceiling defaults to 25 USDC |
| `DATABASE_URL` | Local JSON store. **Required in production** |

```bash
npm run book          # inspect the live book, no key needed
npm run verify:fill   # dry run: every check except the signature
npm run check         # typecheck + lint + test. Run before pushing
```

Scripts run with `--conditions=react-server` so the `server-only` guard resolves
outside the bundler. Keep that flag on any new script importing from `lib/`.

---
---

# 3. COMPUTATIONAL — States and enforcement

## 3.1 Architecture

```
app/
  page.tsx            the four-step flow + market pulse
  feed/               strategies with their transaction hashes
  leaderboard/        ranked by risk-adjusted return  [scaffolded, not ranked]
  profile/            executed history
  api/
    interpret/        view -> chosen contract -> real quote. Signs nothing
    execute/          re-prices, checks slippage, then signs
lib/
  thetanuts/
    client.ts         SDK setup. The ONLY file that reads the key
    book.ts           reads the live OptionBook, normalises orders
    quote.ts          maximum loss, payoff, breakeven from real pricing
    decimals.ts       ALL token math goes through here
  agent/
    interpret.ts      plain language -> a live contract, zod-validated
    execute.ts        seven checks, then the signature
    prompts/          versioned prompt files, not inline strings
  db/store.ts         executed strategies and the feed
components/           the interface. lib/ does not depend on any of it
```

**`lib/` is proven and does not depend on `components/`.** Interface work
replaces components without touching the integration layer. This is what makes
§4.3 safe to do on a branch.

## 3.2 Data model

Three tables in `lib/db/schema.ts`.

**`strategies`** — the product's record. `view`, `risk`, `reasoning`,
`direction`, the instrument (`label`, `underlying`, `structure`, `strikes`,
`expiry`), the money (`premium`, `maxLoss`, `maxGain`, `breakeven`,
`collateralSymbol`, `collateralDecimals`), and `status` / `txHash` / `live` /
`error` / `trader`.

> `txHash` is the proof. Written once, at execution, never derived from anything
> else. **Null means the strategy was simulated, never that it was lost.**

**`signals`** — trades sourced from external venues, for the P3 copy flow.
Defined ahead of time so the signals lane starts against a real table.

**`users`** — a wallet address or a demo session is enough for now.

**Known constraint on `trader`:** with one shared wallet and no auth, `trader`
is a demo session identifier, not a verified distinct person. Any ranking built
on it ranks **sessions and strategies, not proven individuals.** Say so wherever
it is displayed.

## 3.3 The four-step flow

`Describe → Preview risk → Prove on-chain → Share`

```
01 DESCRIBE
   Free text view · budget in USDC · risk level
   Nothing is signed at this step
        ↓
02 PREVIEW RISK  — POST /api/interpret
   shortlist live buyable USDC-collateralised orders
   model picks ONE instrumentId + reasoning + direction + confidence
   zod-validate against the shortlist; reject anything not on it
   price it against the real book -> max loss, max gain, breakeven, payoff
   HUMAN READS THE MAXIMUM LOSS AND APPROVES
        ↓
03 PROVE ON-CHAIN  — POST /api/execute
   re-price · slippage check (2% tolerance) · magnitude assertion
   balance · allowance · callStaticFillOrder simulation · cap check
   then, and only then, sign
        ↓
04 SHARE
   the strategy joins the feed with its transaction hash
```

**The model never supplies a number.** It chooses which contract expresses the
view and explains why. Every price, premium and maximum loss comes from the
book. Its answer is validated with zod and checked against the shortlist, so it
cannot name a contract that is not live.

**Demo mode is the default.** A deliberate response to a thin market, and demo
insurance: if a live fill hangs on stage, the simulated path still shows the
product working with real prices. The distinction must be unmissable — a user
must never be unsure whether real money is about to move.

## 3.4 Track 02 — where the agent qualifies

The agent chooses the contract and places the trade. A human approves the
maximum loss between those two acts.

```
DETERMINISTIC (code)                 MODEL
· shortlist of live orders           · which contract expresses this view
· every price and maximum loss       · why, in plain language
· slippage, magnitude, balance,      · direction and confidence
  allowance, simulation, cap
· the signature
```

> **The model decides what to say. The code decides what moves.**

This satisfies Track 02 — the agent places the trade — without pretending the
human step does not exist. An autonomous agent would remove the very thing the
product is for.

## 3.5 Feed

Every executed entry carries a verifiable transaction hash linking to Basescan.
**Simulated entries are shown too, labelled as simulated** — hiding them would
make the feed look busier than the market really is.

## 3.6 Leaderboard — scaffolded, not implemented

`LeaderboardRow` and `MIN_TRADES_TO_RANK = 3` exist in `lib/db/store.ts`. The
ranking function does not. The page renders an honest empty state:

> *"Positions rank once they reach expiry and settle. Until then the board stays
> empty rather than showing a number that has not been earned."*

Ranking is by **return per unit of capital risked, never raw percentage gain.** A
board sorted by percentage gain rewards whoever took the most risk and got
lucky, which is the opposite of what this product is for.

## 3.7 The arena layer — proposal withdrawn

The product is named OptionArena and the board is still empty. A competitive
layer over the `strategies` table was proposed to close that gap, on the grounds
that the signals lane was blocked. It no longer is.

It was written up as a proposal in `docs/proposals/arena-layer.md` and has since
been **largely withdrawn**. The argument rested on P3 being blocked; `decisions.md`
§11 answered that question the same evening — Deribit maps onto Thetanuts 39 of
39 exact — and `lib/signals/` now exists.

**The board is more likely to arrive through P3 than beside it.**
`lib/signals/rank.ts` already ranks trades by four user-selectable criteria with
a plain-language reason each. Wiring the existing `/leaderboard` route to that
output is the cheapest route from "OptionArena has no arena" to one that works.

Two rules govern whatever fills the board, both from `decisions.md` §11 and §12:
**rank trades, never traders** — Deribit's public trades carry no trader
identity, so a track record is not derivable from public data — and every ranked
row carries the reason it ranked, so the board is never a black box.

The risk-gate idea from the first PRD does not survive. It presumed following a
person; there are no persons to follow.

---
---

# 4. PROCEDURAL — How we excel

## 4.1 The one thing that matters most

**No real mainnet fill has been placed.** The whole path is built and every
check short of the signature has been run against live chain state. It needs a
funded key and one command:

```bash
npm run verify:fill -- --live --budget 1
```

Then the hash goes into `docs/decisions.md` §9.

> **Until that hash exists, the Track 02 entry is not valid.** This is the
> highest-priority item in the project, ahead of every feature in this document.

## 4.2 Triage order

**This is not the schedule — `tasks/todo.md` is.** This is the order to abandon
things in when time runs short. Cut from the top; never cut downward into the
spine.

```
CUT 1st   Arena layer beyond a ranked list
CUT 2nd   Deribit signal sourcing (P3)  <- unblocked work first
CUT 3rd   Leaderboard ranking function
CUT 4th   Feed polish
CUT 5th   Interface restyle

NEVER CUT
  · the real mainnet hash
  · maximum loss shown before signing
  · the decimals discipline
  · demo mode as the safe default
  · DATABASE_URL provisioned before the deploy
```

**A working four-step flow with a real hash beats every feature in §3.7.**
Judges score what runs on stage.

## 4.3 Interface direction

**This overrides the repo's current visuals.** The integration layer does not
depend on `components/`, and `tasks/todo.md` P1 leaves the visual port open, so
this is contained work on a branch.

**Reference: Phantom wallet.** Bold, confident, uncluttered.

| Principle | Application |
|---|---|
| **Mobile-first** | Judges hold phones, and nearly every on-chain options UI is desktop-only. This differentiates on its own |
| **Bold over dense** | Large type, generous spacing, one primary action per screen. Never a Bloomberg terminal |
| **Dark-first on deep neutral** | Not pure black |
| **Generous radii** | Cards feel like objects, not table rows |
| **One saturated accent, used sparingly** | Everything else quiet |
| **Numbers are the hero** | Returns, sizes and maximum loss large, in tabular figures. Labels small and quiet |
| **Restrained motion** | One orchestrated moment, when the fill lands |

**Replaces** the sidebar + two-column desktop workspace.

**Semantic colour stays separate from the brand accent.** Up/down and
profit/loss never borrow the accent, and the accent never signals gain.

### Copy rules

- Never name a unit the interface is not actually spending
- Always show maximum loss before any confirmation
- Buttons say exactly what happens; the toast confirms it happened
- Errors explain what went wrong and what to do next. No apologies

### Tokens, as built

Defined in `app/globals.css` under `@theme`. **Change them here first, then
there** — this table is the vocabulary the rest of this section relies on.

| Token | Value | Used for |
|---|---|---|
| `--color-ground` | `#0b0b10` | Page background. Deep neutral, never `#000` |
| `--color-surface` | `#14141c` | Cards |
| `--color-surface-high` | `#1d1d28` | Raised surfaces, active segments |
| `--color-hairline` | `#262633` | Card borders, dividers |
| `--color-hairline-bright` | `#363648` | Input borders, chips |
| `--color-ink` | `#f2f2f7` | Primary text |
| `--color-ink-muted` | `#9e9eb3` | Body text |
| `--color-ink-faint` | `#6b6b80` | Labels, hints |
| `--color-accent` | `#7c5cff` | **Brand and actions only** |
| `--color-accent-bright` | `#9a80ff` | Transaction hashes, links |
| `--color-gain` | `#3ddc97` | Profit. **Never brand** |
| `--color-loss` | `#ff6b6b` | Loss, and the button that spends real money |

**The accent never signals money and money never uses the accent.** That rule is
why the Live button is drawn in the loss colour and the payoff chart's profit
region uses the gain colour.

### Component vocabulary

Utility classes in `app/globals.css`. Use these rather than inventing new ones.

| Class | What it is |
|---|---|
| `.card` | Surface, hairline border, `1.5rem` radius |
| `.cta` | The one primary action per screen. Accent background |
| `.ghost` | Secondary action. Bordered, never competes with `.cta` |
| `.eyebrow` | Small uppercase mono label |
| `.data` | Anything numeric. Mono, `tabular-nums` |
| `.display` | Headings. Tight tracking, balanced wrap |
| `.animate-land` / `.animate-hash` | The fill-landing moment. **Nothing else animates** |

Type: **Bricolage Grotesque** display, **JetBrains Mono** for data. Both
self-hosted by `next/font` so there is no external request on venue wifi.

### Layout and breakpoints

One breakpoint carries the design. Below `md` is the real target.

| Width | Navigation | Content |
|---|---|---|
| `< sm` (phone) | Bottom tab bar; header has wordmark + mode switch | Single column, `px-5` |
| `sm`–`md` | Same | Two-column figure grids appear |
| `>= md` | Destinations move inline into the header; tab bar hidden | `max-w-5xl` centred |

Page shell lives in `app/layout.tsx`: sticky header, `main` with `pb-28` on
phones to clear the fixed tab bar, `TabBar` last.

### Screens

| Screen | Route | The one thing it must do |
|---|---|---|
| Trade | `/` | Get a view typed and interpreted. Flow first, market pulse below |
| Preview | `/` step 02 | **Maximum loss as the largest element on screen** |
| Proof | `/` step 03 | The hash, large and selectable, with the explorer link under it |
| Feed | `/feed` | Every row links to its transaction |
| Board | `/leaderboard` | Rank honestly, or stay empty |
| You | `/profile` | Custody stated plainly |

### How to change the interface

**Edit this section before writing any component.** The order matters, because
the tokens are the shared vocabulary:

1. Change the principle, token or screen spec **here**
2. Say which of the rules above it breaks, if any, and why that is acceptable
3. Then change `app/globals.css`, then `components/`
4. Verify at **375x812** before anything else — that is the size being designed for
5. `npm run check` before committing

**Never change `lib/`** to accommodate an interface change. The integration layer
does not depend on `components/`, and keeping it that way is what makes visual
work safe to do on a branch.

## 4.4 The demo

1. **Describe a view in plain language.** "ETH drops below 2,200 this week."
2. **The agent's reading** — the contract it chose and why, with confidence.
3. **The maximum loss, large.** *"This is the most you can lose. Nothing can
   take more."*
4. **Execute.** The hash lands, large and selectable.
5. **Open Basescan on screen.** *"Nothing here is self-reported."*
6. **The feed** — it is already there.

Close:

> *"Options are the biggest market in finance and almost nobody in crypto
> touches them. Not because they're bad — because they're hostile. You describe
> what you think happens. You see exactly what you can lose. Then you prove it
> happened."*

### Demo rules

- **Record a backup video of a successful live trade.** Play it if the live
  attempt hangs. Venue wifi will fail at the worst moment
- Demo mode is the default and is honest — real prices, no signature
- Deploy early and keep it working. Do not leave the first deployment to 5 Sep
- Rehearse out loud, with a timer

## 4.5 Anticipated Q&A

| Question | Answer |
|---|---|
| *Who holds the money?* | We do, and we say so. One server wallet demonstrating the product, not self-custody. Users never connect a wallet. Connected wallets are a contained change — `encodeFillOrder` already returns calldata for any connector. |
| *What stops the agent draining it?* | `MAX_TRADE_USDC`, a magnitude assertion, a balance and allowance check, and a static simulation — all before the signature. The model proposes; the code signs. |
| *Isn't the agent just picking from a list?* | Yes, deliberately. It picks which contract expresses your view and explains why. It never supplies a number, because a model that invents a premium is a model that loses your money. |
| *Why only puts?* | Because calls on Base are collateralised in the asset they deliver, so a 5 USDC budget on a BTC call would mean 5 cbBTC. We measured the book rather than assuming. Bullish views are told this plainly. |
| *Why no copy-trading, given the name?* | Your team told us: under $1M TVL means there is nobody to copy. Sourcing signals from venues with real depth is the honest version, and it brings Thetanuts flow it does not have. |
| *Does the AI improve returns?* | No, and we never claim it does. It makes the risk legible before you commit. |
| *Why blockchain?* | Delete it and the transaction hash goes away, and the hash is the entire proof. |

## 4.6 Definition of done

- [ ] **A real mainnet fill, hash recorded in `docs/decisions.md` §9**
- [ ] `DATABASE_URL` provisioned, `npm run db:push` run
- [ ] Deployed to Vercel, URL working
- [ ] Maximum loss shown before every confirmation
- [ ] Team names filled in the README
- [ ] `AI_TOOLS.md` complete
- [ ] 3–5 minute video, plus a backup recording of a live trade
- [ ] `npm run check` green
- [ ] Devfolio both-track question resolved

## 4.7 Non-negotiables

1. Never claim or imply the product improves returns.
2. Never let the model perform arithmetic on money or supply a price.
3. Never show a position without its maximum loss.
4. Never name a unit the interface is not actually spending.
5. Never commit a key. `.env` stays gitignored.
6. Never stake a competitive outcome.
7. Never hide the custody limitation — state it, with the roadmap.
8. Never deploy our own contracts with real funds.
9. Never mark a chain-touching task complete without real output from the real
   system.

---

*Architecture and constraints verified against the working repo on 31 August
2026. Market counts in §2.2 are a snapshot and go stale within a day — re-run
`npm run book` rather than quoting them. Where the slides and the repo disagree,
the repo wins; where this document and `tasks/todo.md` disagree about what to do
next, `tasks/todo.md` wins.*
