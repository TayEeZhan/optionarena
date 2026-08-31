# Proposal: the arena layer, as P3a

**Status: proposal, not a decision.** Written 31 Aug 2026 on the `arena-layer`
branch. Nothing here is settled, and nothing in `docs/decisions.md` or
`tasks/todo.md` has been changed. The team decides.

---

## What this argues

That a competitive layer over the strategies we already store should run
**alongside** P3 Deribit signal sourcing, not instead of it, and that it is the
safer of the two to start first.

The case rests on one observation: **the product is called OptionArena and it
has no arena.** A judge who reads the name and then uses the product will
notice.

---

## What already exists

This is the part that makes the proposal cheap. None of it is new work.

| Already in the repo | Where |
|---|---|
| Executed strategies with a `trader` column | `lib/db/schema.ts` |
| `LeaderboardRow`: trades, totalReturn, totalRisked, riskAdjusted, hitRate | `lib/db/store.ts` |
| `MIN_TRADES_TO_RANK = 3` | `lib/db/store.ts` |
| A `/leaderboard` route with an honest empty state | `app/leaderboard/page.tsx` |
| A feed rendering executed and simulated strategies | `app/feed/page.tsx` |
| Every strategy's `maxLoss`, `premium`, `expiry`, `txHash` | `lib/db/schema.ts` |

What is missing is the ranking function itself. The interface, the schema, the
constant and the honest empty state were all written for it and are waiting.

---

## The two lanes, stated fairly

### P3 — Deribit signal sourcing

**For it.** It came from the Thetanuts team directly, and it answers the real
objection to copy-trading: under $1M TVL there is nobody on-platform worth
copying, but Deribit and Derive have depth. It is the only one of the two that
**brings Thetanuts order flow it does not currently have**, which is a genuine
argument to a protocol sponsor rather than a feature we happen to like.

**Against it.** It is **not started**, and it is blocked on a question we have
not answered: *do Deribit's liquid contracts map onto Thetanuts' Base book?* We
have ETH and BTC puts on a handful of expiries. If the mapping does not hold,
the copy interface needs rethinking, and we would discover that with days left.

It also depends on work that is not scoped: a venue adapter, a definition of
"winning trade" that survives scrutiny, resolved profit and loss data we do not
control, and a mapping layer that must never substitute an instrument silently.

### P3a — the arena layer

**For it.** Unblocked. Every dependency is already in the repo. It reuses the
schema, the route and the constant listed above, so most of the work is one
ranking function and a detail view. It delivers the name. And it gives a judge
something to look at beyond a single strategy: a board, a record, a reason the
product is called what it is called.

**Against it, honestly:** it brings the protocol **no new order flow**. It makes
our own users legible to each other, which is a product benefit, not a protocol
benefit. Against a sponsor who told us what they want, that is a real cost and
should not be dressed up.

---

## The limitation that has to be stated first

**With one shared server wallet and no auth, `trader` is a demo session
identifier, not a verified person.**

That is not a flaw in this proposal. It is a consequence of the custody decision
in `docs/decisions.md` §1, which is correct for a five-day build. But it means a
leaderboard cannot honestly claim to rank *people*.

What it can honestly rank:

- **strategies**, by return per unit of capital risked
- **sessions**, labelled as sessions

What it must not do is imply the top row is a person with a track record. If we
cannot say that truthfully, the interface says what it actually is. That is the
same standard the empty state already holds itself to:

> *"Until then the board stays empty rather than showing a number that has not
> been earned."*

An honest board of ranked strategies is still worth building. A board that
implies verified traders is not.

---

## What P3a would be, concretely

The smallest version that earns the name. Roughly a day, most of it in one file.

**1. The ranking function.** `rankStrategies()` in `lib/db/store.ts`,
implementing the `LeaderboardRow` shape that is already declared.

Ranked by **return per unit of capital risked**, never raw percentage gain, for
the reason already written into that file: a board sorted by percentage gain
rewards whoever took the most risk and got lucky. `MIN_TRADES_TO_RANK` stays at
3 and stays visible, so one lucky trade cannot top the board.

It scores settled strategies only. A strategy that has not reached expiry has
not earned a number.

**2. The board.** Fill in `app/leaderboard/page.tsx`. Show trades, hit rate and
capital risked next to the headline figure, so a high number from a tiny sample
is visibly different from a steady one. Link every row to its transaction hash.

**3. A strategy detail view.** The view in the user's own words, the agent's
reasoning, the payoff, the outcome, and the hash. This is the page that makes
the product feel like an arena rather than a form.

### Deliberately excluded

- **Anything staked.** A competitive layer with money on the outcome is
  gambling layered on gambling, and a protocol judge will say so.
- **Head-to-head challenges.** They need a duration, a valuation of open
  positions we do not have, and a social graph. Out of scope this week.
- **Any claim about future performance.** The board reports what happened.

---

## The honest recommendation

Both lanes are worth having and they do not conflict: P3a ranks what we
executed, P3 sources what to execute next. They meet at the same feed.

The sequencing argument is about risk, not preference. **P3a is unblocked and P3
is not.** If the Deribit mapping question is answered early and the answer is
yes, P3 is the stronger submission, because it brings the protocol something it
asked for. If that question is still open in two days, P3a is what stands
between us and a product whose name it does not live up to.

There is also a third option worth naming: **do neither, and spend the time on
the mainnet hash, the database and the deploy.** Those three are on the critical
path and none of them are done. A ranked board on a deployment that loses its
data is worth nothing.

---

## Related

- `docs/decisions.md` §1 — server-side signing, and why `trader` is what it is
- `docs/decisions.md` §8 — persistence, and why `DATABASE_URL` is not optional
- `tasks/todo.md` P3 — the Deribit lane and its open questions
