# OptionArena

**Options, for people who do not speak options.**

### → **[Open the app](https://optionarena-uoqy.vercel.app)** ←

Nothing to install, no wallet to connect, no seed phrase. Open the link and
trade. It runs on real Thetanuts market data on Base mainnet with a simulated
balance, so you can learn the instrument without risking anything.

---

## The problem

Options are the biggest market in traditional finance and almost nobody in
crypto touches them. Not because people would not want the payoff — a capped
downside with real upside is exactly what most people say they want — but
because every interface assumes you already speak the language. Strike. Expiry.
Delta. Implied volatility. If you cannot price a contract yourself you cannot
use one, even when an option is precisely the right tool for what you think.

So the average person does the thing options were invented to avoid: buys the
asset with leverage, and gets liquidated.

There is a second barrier underneath the first. Even people who want to learn
have nobody to learn from. Trading is solitary and opaque — you cannot see what
anyone else did, whether it worked, or why.

## What we built

Three answers, in one app.

**1 · Say what you think, in plain English.** You type something like *"I think
ETH drops before the weekend"* and choose how much you are willing to lose. An
agent turns that into a real, defined-risk options position on the live
Thetanuts book, then shows you **the maximum loss as a dollar figure** before
anything is signed. Not a projection — it is priced against real resting orders,
and the number you approve is the number at risk.

**2 · Make it social, so it is worth coming back to.** A position is a
prediction, and a prediction is more interesting when someone is watching. You
get a handle, add friends, and challenge them: two strategies, one expiry, one
winner. Outcomes settle against the price the option actually paid out against,
never against a self-reported number.

**3 · Copy people who are demonstrably good.** New traders learn by imitation.
The usual version of this fails on cold start, because a young venue has nobody
worth copying yet. Ours sources winning trades from Deribit, where the real
options flow is, ranks them by a definition of "winning" that **you** choose,
and maps each one onto the nearest Thetanuts contract you can actually fill.

That third idea came from the Thetanuts team directly: copy trading only works
if there are winners to copy, *unless* the data comes from Deribit or Derive
traders — which would be genuinely useful. It means OptionArena brings Thetanuts
order flow it does not currently have.

---

## What you can do in the app

| Where | What it does |
|---|---|
| **Trade** | Four steps: describe your view → see the maximum loss → prove it on-chain → share it. The agent picks the contract; you approve the risk. |
| **Copy** | Live Deribit trades, ranked and mapped onto fillable Thetanuts contracts. Every mismatch in strike, expiry or direction is spelled out before you copy — we never silently substitute. |
| **Arena** | Two ranked signals head to head. Call which one wins and it goes on your record. Also where you take on a friend. |
| **Ranks** | The leaderboard. You pick what "winning" means — profit, risk-adjusted return, consistency — because there is no single honest definition, and burying that choice inside a number would hide it. |
| **Friends** | Follow people and see what they are trading. Following needs no consent, because every strategy is already public in the feed. |
| **Battles** | A friendly head-to-head on a shared expiry. Before expiry it compares what each side risked against what each pays if right — a comparison of conviction. After expiry there is a real winner. |
| **Feed** | Every executed strategy, with its transaction hash. |
| **Profile** | Your own record. |

Sign in with Google, or just type a handle. A handle is a name, not a login —
the app says exactly that — and it exists so the whole product works with zero
configuration.

---

## What is real, and what is simulated

This matters more than any feature, so it sits near the top rather than buried.

**Real:** the order book, the prices, the contracts, the maximum-loss figures,
the Deribit signals and their rankings, and the settlement prices that decide
battles. All of it read live from Base mainnet and Deribit.

**Simulated:** the balance and the signature. The public site runs in demo mode
with a 10,000 USDC paper balance.

That is deliberate, and it is the correct production state. OptionArena signs
**server-side from a single wallet** — there is no per-user wallet and no
user-level authentication. Arming that wallet on a public URL would let any
visitor spend it. So the deployed site cannot sign, and the toggle in the top
bar stays pinned to demo. A live fill is placed from a developer machine, by a
person holding the key, one command at a time.

We would build connected wallets for a real launch, and the SDK's
`encodeFillOrder` already returns calldata any wallet connector could sign, so
it is a contained change. We are saying this plainly rather than implying
self-custody we did not build.

---

## Chain and contracts

Everything runs on **Base mainnet, chain ID 8453**.

OptionArena **deploys no contracts of its own.** It only calls contracts
Thetanuts has already deployed.

| Contract | Address |
|---|---|
| OptionBook | [`0x1bDff855d6811728acaDC00989e79143a2bdfDed`](https://basescan.org/address/0x1bDff855d6811728acaDC00989e79143a2bdfDed) |
| OptionFactory | [`0x8118daD971dEbffB49B9280047659174128A8B94`](https://basescan.org/address/0x8118daD971dEbffB49B9280047659174128A8B94) |
| USDC | [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) |
| WETH | [`0x4200000000000000000000000000000000000006`](https://basescan.org/address/0x4200000000000000000000000000000000000006) |
| cbBTC | [`0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf`](https://basescan.org/address/0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf) |

Built on [`@thetanuts-finance/thetanuts-client`](https://github.com/Thetanuts-Finance/thetanuts-sdk)
v0.3.0, MIT.

---

## What the market actually allows

Measured against the live book, not assumed. Run `npm run book` to reproduce.

- **ETH and BTC only.** They are the only assets with resting sell orders. SOL,
  XRP, BNB and AVAX have bids only, so they cannot be bought at all.
- **Puts only.** Puts are collateralised in USDC. Calls are collateralised in
  the asset they deliver, so a budget of `5` against a BTC call would mean 5
  cbBTC, not five dollars. OptionArena trades the USDC side so the number you
  type is the number you spend, and a bullish view is told that plainly rather
  than handed a put.
- **Every buyable order is physically settled, and filling one reverts
  on-chain** with `Panic(0x11)` inside the OptionBook. We ruled out size, order
  choice, expiry, SDK version, RPC and allowance across 62 orders, then decoded
  a successful fill against our own calldata word by word. The Thetanuts team
  confirmed it: physical settlement is not routed into the SDK yet. The whole
  investigation is in [`docs/decisions.md`](docs/decisions.md) §14, and the sell
  path built to work around it is `scripts/verify-sell.ts`.

Each of these is the market's limit rather than the product's, and each is
surfaced in the interface instead of hidden.

---

## Status

| Phase | State |
|---|---|
| Live deployment | **Done.** Real prices, real book, Postgres-backed, Google sign-in working |
| Real book, real pricing, real maximum loss | **Done** |
| The agent executes | **Done.** Model behind an adapter, with a rule-based fallback that labels itself as one |
| Sourced signals, ranking, copy flow | **Done.** Live Deribit flow ranked and mapped onto tradable contracts — 39 of 39 buyable puts matched exactly on the day we measured |
| A recorded mainnet fill | **Not yet.** The buy side is blocked upstream (§14). The sell path is built, tested and dry-run verified; the hash goes into §9 when it is placed |

---

## Running it yourself

**You almost certainly do not need this.** The hosted app is the product, and it
needs no keys, no database and no setup. This section is for the team and for
anyone reading the code.

Node 20 or newer.

```bash
git clone https://github.com/TayEeZhan/optionarena.git
cd optionarena
npm install
npm run dev
```

Open <http://localhost:5190>. It works immediately with no configuration at all:
the prices, the book, the signals and the maximum loss are all real, and only
the signature and the shared database are missing.

Four environment variables exist, all optional, and the app degrades honestly
without each: `ANTHROPIC_API_KEY` (otherwise a rule-based selector runs and says
so), `DATABASE_URL` (otherwise a local JSON file), `BASE_RPC_URL` (otherwise the
public Base endpoint) and `MAX_TRADE_USDC` (otherwise a 25 USDC ceiling). Copy
`.env.example` to `.env` to set any of them.

`PRIVATE_KEY` is the fifth, and it is **deliberately left unset in production** —
see *What is real* above. If you set it locally to place a fill, use a fresh
wallet made only for this and fund it with the minimum. `.env` has been in
`.gitignore` since the first commit, and CI scans every push for committed keys.

### Commands

```bash
npm run dev           # development server on port 5190
npm run check         # typecheck, lint and test — run this before pushing
npm run book          # inspect the live book and price a contract, no key needed
npm run signals       # rank live Deribit flow and map it onto Thetanuts
npm run verify:sell   # dry run of a real fill through the sell side
npm run db:status     # what the database actually contains
npm run db:migrate    # apply the schema over HTTPS, where db:push cannot
```

A pre-commit hook formats and lints staged files.

### Redeploying

The app is already deployed on Vercel, so this is only for standing up a new
instance. `DATABASE_URL` is **required**: a serverless filesystem is read-only
and per-invocation, so the file store would silently drop every strategy and the
feed would come up empty. Create a free Postgres on [Neon](https://neon.tech),
run `npm run db:push` (or `npm run db:migrate` if your network blocks
websockets), then set the variable in Vercel's project settings — never in the
repo. `vercel.json` pins the Singapore region, and the routes that talk to the
chain declare their own `maxDuration`, so a mainnet call has room to finish.

---

## How the code is laid out

```
app/
  page.tsx            home and discovery
  trade/              the four-step flow
  arena/              ranked signal head-to-head, and challenges
  copy/               copy a sourced strategy
  battles/            friendly head-to-heads and their settlement
  friends/            follow people, see what they trade
  feed/               strategies with their transaction hashes
  leaderboard/        ranked by a criterion you choose
  profile/            your executed history
  join/               Google sign-in, or just a handle
  api/
    interpret/        view -> chosen contract -> real quote. Signs nothing
    execute/          re-prices, checks slippage, then signs
    auth/google/      OAuth start and callback
lib/
  thetanuts/
    client.ts         SDK setup. The only file that reads the key
    book.ts           reads the live OptionBook, normalises orders
    quote.ts          maximum loss, payoff and breakeven from real pricing
    decimals.ts       ALL token math goes through here
  agent/
    interpret.ts      plain language -> a live contract, zod-validated
    execute.ts        every pre-flight check, then the signature
    prompts/          versioned prompt files, not inline strings
  signals/            Deribit sourcing, ranking, mapping onto Thetanuts
  social/             handles, friends, battles, calls and their settlement
  db/                 Postgres via Drizzle, with a local JSON fallback
scripts/
  show-book.ts        prove the integration is real, no key needed
  verify-sell.ts      place one real trade through the sell side
docs/decisions.md     every architectural decision, with its reasoning
```

### Decimals

The Thetanuts team says builders most often get token decimals wrong, and the
mistake sends a million times too much or too little, irreversibly. So:

- every amount goes through `lib/thetanuts/decimals.ts`, never a raw `parseUnits`
- amounts are `bigint`, never a JavaScript number
- formatting happens at the last possible moment
- `assertMagnitude` proves the order of magnitude before anything is signed

One rule is documented nowhere and had to be derived from the live book: **a
contract count uses the same decimals as its collateral token.** Assuming a
fixed value read a call's remaining size as `4099251066830 USDC` instead of
`4.09 WETH`. There is a regression test for it.

---

## Team

| Name | Lane |
|---|---|
| Tay Ee Zhan | SDK, execution and signals |
| Goh Sheng Kuan | Agent, prompts and product spec |
| Ong Zi Qi (Owen) | Interface and flow |

AI tools used are declared in [`AI_TOOLS.md`](AI_TOOLS.md).

## Licence

MIT.
