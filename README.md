# OptionArena

**Describe your view, understand the risk, prove the trade.**

A social options desk built on Thetanuts Finance V4, on Base mainnet.

You write what you think the market will do, in plain language. An agent turns
that into a defined-risk options position, shows you the maximum loss before
anything is signed, executes it on-chain, and publishes the result with a
verifiable transaction hash.

---

## The problem

Options are the largest market in traditional finance and barely exist in
crypto. The reason is not demand, it is that the interfaces assume you already
speak the language. Strike, expiry, delta, implied volatility. If you cannot
price a contract yourself, you cannot use one, even when an option is exactly
the instrument you need.

Copy-trading is the usual answer, and it fails on cold start: there is nobody
worth copying yet. Thetanuts has under $1M TVL, so there is very little organic
flow to copy.

## What we do about it

Two things.

**Make the risk legible before the trade.** Every strategy is shown as a real
maximum loss in USDC, priced against the live order book, before anything is
signed. Not an estimate. The number you approve is the number you spend.

**Source the signal from where the flow already is.** The differentiator is not
copying Thetanuts traders, because there are not enough of them. It is sourcing
winning trades from venues with real depth, ranking them by risk-adjusted
performance, and letting users execute the nearest equivalent on Thetanuts.

That direction came from the Thetanuts team directly: copy trading needs winners
on the platform to be profitable, unless the data comes from Deribit or Derive
traders, which would be genuinely useful. It means the product brings Thetanuts
order flow it does not currently have.

Signal sourcing is P3 and is **not built yet**. See [Status](#status).

---

## Blockchain and contracts

Everything runs on **Base mainnet, chain ID 8453**.

OptionArena **deploys no contracts of its own**. It only calls contracts
Thetanuts has already deployed.

| Contract | Address |
|---|---|
| OptionBook | [`0x1bDff855d6811728acaDC00989e79143a2bdfDed`](https://basescan.org/address/0x1bDff855d6811728acaDC00989e79143a2bdfDed) |
| OptionFactory | [`0x8118daD971dEbffB49B9280047659174128A8B94`](https://basescan.org/address/0x8118daD971dEbffB49B9280047659174128A8B94) |
| USDC | [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) |
| WETH | [`0x4200000000000000000000000000000000000006`](https://basescan.org/address/0x4200000000000000000000000000000000000006) |
| cbBTC | [`0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf`](https://basescan.org/address/0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf) |

Built on [`@thetanuts-finance/thetanuts-client`](https://github.com/Thetanuts-Finance/thetanuts-sdk) v0.3.0, MIT.

---

## How custody works, plainly

**OptionArena signs server-side. This is one wallet demonstrating a product, not
self-custody.**

The private key lives in the host's secret store and never reaches the browser.
Users do not connect a wallet and do not trade their own funds. We chose this
deliberately for a five-day build, because the alternative requires every user
to hold ETH on Base before anything works.

We would build connected wallets for a real launch. The SDK's `encodeFillOrder`
already returns calldata for any connector, so it is a contained change. We are
saying this here rather than implying custody we did not build.

---

## What is actually tradable

Measured against the live book, not assumed. Run `npm run book` to reproduce.

- **ETH and BTC only.** They are the only assets with resting sell orders. SOL,
  XRP, BNB and AVAX have bids only, so they cannot be bought at all.
- **Puts only, today.** Puts are collateralised in USDC. Calls are collateralised
  in the asset they deliver, so a budget of `5` against a BTC call would mean 5
  cbBTC, not 5 dollars. OptionArena trades the USDC side of the book so the
  number you type is the number you spend. Bullish views are told this plainly
  rather than being handed a put.

Both limits are the market's, not the product's, and both are surfaced in the
interface rather than hidden.

---

## Setup

Node 20 or newer.

```bash
git clone https://github.com/TayEeZhan/optionarena.git
cd optionarena
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5190>. It works immediately in demo mode with no keys and
no configuration: the prices, the book and the maximum loss are all real, and
only the signature is missing.

### Environment

Every variable is optional. The product degrades honestly without each one.

| Variable | Effect if unset |
|---|---|
| `PRIVATE_KEY` | Live trading is unavailable and the interface is pinned to demo mode |
| `ANTHROPIC_API_KEY` | A rule-based selector runs instead of the model, and labels itself as such |
| `BASE_RPC_URL` | Falls back to `https://mainnet.base.org` |
| `MAX_TRADE_USDC` | Ceiling defaults to 25 USDC per trade |
| `DATABASE_URL` | Uses the local JSON store. **Required in production**, see [Deployment](#deployment) |

**Security.** Use a fresh wallet created only for this project, never a personal
one, and fund it with the minimum needed. `.env` has been in `.gitignore` since
the first commit.

### Commands

```bash
npm run dev           # development server on port 5190
npm run book          # inspect the live book and price a contract, no key needed
npm run verify:fill   # dry run of a real fill: every check except the signature
npm run check         # typecheck, lint and test. Run this before pushing
npm test              # unit tests for the decimals helpers
npm run lint          # ESLint, including the rules that guard token math
npm run format        # Prettier
npm run build         # production build
```

Database commands, only needed once `DATABASE_URL` is set:

```bash
npm run db:push       # apply the schema
npm run db:studio     # browse the data
```

A pre-commit hook formats and lints staged files. CI runs the full gate plus a
scan for committed keys on every push and pull request.

---

## Deployment

**Set `DATABASE_URL` before deploying.** This is not optional. A serverless
filesystem is read-only and per-invocation, so the local file store silently
loses every strategy in production: the feed and leaderboard would come up empty
on the exact URL the judges open.

1. Create a free Postgres database on [Neon](https://neon.tech) or Supabase and
   copy the connection string.
2. `DATABASE_URL=... npm run db:push` to create the tables.
3. Import the repo on Vercel. Add `DATABASE_URL`, `PRIVATE_KEY`,
   `ANTHROPIC_API_KEY` and `BASE_RPC_URL` in the project's environment
   variables, never in the repo.
4. Deploy. `vercel.json` already sets the Singapore region and the function
   timeouts that a mainnet fill needs.

Deploy early and keep it working. Do not leave the first deployment to 5 Sep.

### Placing a real trade

`verify:fill` is a dry run unless you pass `--live`.

```bash
npm run verify:fill -- --live --budget 1
```

It refuses unless the key is present, the size is under `MAX_TRADE_USDC`, the
magnitude assertion passes, the wallet holds enough collateral, and the fill
simulates successfully against live chain state. Never let the first run of this
path be a large trade.

---

## How it works

```
app/
  page.tsx            the four-step flow
  feed/               strategies with their transaction hashes
  leaderboard/        ranked by risk-adjusted return
  profile/            your executed history
  api/
    interpret/        view -> chosen contract -> real quote. Signs nothing
    execute/          re-prices, checks slippage, then signs
lib/
  thetanuts/
    client.ts         SDK setup. The only file that reads the key
    book.ts           reads the live OptionBook, normalises orders
    quote.ts          maximum loss, payoff, breakeven from real pricing
    decimals.ts       ALL token math goes through here
  agent/
    interpret.ts      plain language -> a live contract, zod-validated
    execute.ts        seven checks, then the signature
    prompts/          versioned prompt files, not inline strings
  db/store.ts         executed strategies and the feed
scripts/
  show-book.ts        prove the integration is real, no key needed
  verify-fill.ts      place one real trade and print the hash
docs/decisions.md     every architectural decision, with reasoning
```

### Decimals

The Thetanuts team says builders most often get token decimals wrong, and a
mistake sends a million times too much or too little, irreversibly. So:

- every amount goes through `lib/thetanuts/decimals.ts`, never a raw `parseUnits`
- amounts are `bigint`, never a JavaScript number
- formatting happens at the last possible moment
- `assertMagnitude` proves the order of magnitude before anything is signed

One rule is documented nowhere and had to be derived from the live book: **a
contract count uses the same decimals as its collateral token.** Assuming a fixed
value read a call's remaining size as `4099251066830 USDC` instead of `4.09
WETH`. See `docs/decisions.md`.

---

## Status

| Phase | State |
|---|---|
| P0 · prove a real fill is possible | Path built and dry-run verified. **The live hash is not yet recorded** |
| P1 · real book, real pricing, real maximum loss | Done |
| P2 · the agent executes | Done. Model behind an adapter, rule-based fallback |
| P3 · sourced signals, ranking, copy flow | Not started |
| P4 · submission | Not started |

**The submission is not valid until a real mainnet hash is in
`docs/decisions.md`.** The command is above; it needs a funded key.

---

## Team

| Name | Lane |
|---|---|
| Tay Ee Zhan | SDK and execution |
| Goh Sheng Kuan | Agent and prompts |
| _add your name_ | Signals and ranking |
| _add your name_ | Interface and flow |

AI tools used are declared in [`AI_TOOLS.md`](AI_TOOLS.md).

## Licence

MIT.
