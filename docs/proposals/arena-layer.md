# Proposal: the arena layer, as P3a

**Status: proposal, and largely withdrawn.** Written 31 Aug 2026 on the
`arena-layer` branch, revised 1 Sep after reading `docs/decisions.md` §11–§13 and
`lib/signals/`. Nothing in `docs/decisions.md` or `tasks/todo.md` has been
changed by this file. The team decides.

---

## Read this first: the original argument is dead

The first version of this document argued for a competitive layer on the grounds
that **P3 was unstarted and blocked** on an open question — whether Deribit's
liquid contracts map onto Thetanuts' thin ETH/BTC put book.

That question was answered the same evening, and the answer is emphatic.
`docs/decisions.md` §11:

> **Thetanuts to Deribit: 39 of 39 exact.** Every buyable Thetanuts put, ETH and
> BTC, has an exact strike-and-expiry match on Deribit. That is not luck. The
> market makers quoting Base hedge on Deribit, so they quote the same grid.

Open question 2 is resolved too (§12: the user picks one of four criteria), and
so is open question 1 (§13: one submission, both tracks). `lib/signals/` exists
with a Deribit source, a ranker and a mapper.

**P3 is no longer blocked, no longer unstarted, and no longer speculative.** The
premise this proposal rested on is gone, and the recommendation below changes
accordingly.

---

## What has already been decided, and should not be relitigated

Recorded here so this document does not accidentally re-argue settled points.

| Decided | Where |
|---|---|
| Deribit maps onto Thetanuts, exactly one way and approximately the other | §11 |
| The mapper never substitutes silently — it lists every difference | §11 |
| **OptionArena ranks trades, never traders** | §11 |
| "Winning trade" is the user's choice of four criteria, with a $250 notional floor | §12 |
| Every ranked signal carries a plain-language reason it ranked | §12 |
| One submission covers both tracks | §13 |

The third row deserves particular note, because the first version of this
document derived the same conclusion independently and at greater length. §11
states it better and from firmer evidence — Deribit's public trades carry no
trader identity, so a track record is not derivable from public data at all. The
earlier reasoning here about `trader` being a session identifier reached the same
place from the custody decision in §1. **Cite §11; it is the stronger source.**

---

## What is still true

Two things from the original proposal survive the change.

**The product is called OptionArena and the board is still empty.**
`lib/db/store.ts` declares `LeaderboardRow` and `MIN_TRADES_TO_RANK = 3`. The
ranking function does not exist, and `app/leaderboard/page.tsx` renders an honest
empty state. That is a real gap between the name and the product.

**The scaffold is still waiting.** Schema, route, constant and empty state were
all written for a board that has not been built.

---

## What has changed: P3 may already be the arena

This is the substance of the revision.

`lib/signals/rank.ts` ranks trades by four user-selectable criteria and attaches
a plain-language reason to each. That is not merely signal plumbing — **it is
leaderboard content.** A board fed by ranked Deribit signals is an arena, and it
arrives as a by-product of work that is already underway and already justified to
the sponsor.

So the question is no longer "P3 or P3a". It is narrower:

> Once P3's ranking is on screen, is there anything left that a separate layer
> over our own executed strategies would add?

The honest answer is: not much, and not soon. Ranking our own executed strategies
would need settled positions we do not yet have — the board can only rank what
has reached expiry, and **P0 has not placed a single mainnet fill.** A board over
our own trades has nothing to rank until that changes.

---

## Revised recommendation

**Do not run P3a as a separate lane.** Instead:

1. **Wire the existing `/leaderboard` route to `lib/signals/rank.ts`.** The
   scaffold was built for a board; the ranker produces one. Connecting them is
   the cheapest path from "OptionArena has no arena" to "OptionArena has an
   arena", and it needs no new concepts.
2. **Keep the empty state honest** where our own executed strategies are
   concerned. A board of sourced signals is not a track record of ours, and the
   interface must not let the two be confused. §11's rule applies: rank trades,
   never traders.
3. **Leave ranking our own strategies until after P0.** It cannot rank anything
   until a real fill has settled.

### Still deliberately excluded

- **Anything staked.** A competitive layer with money on the outcome is gambling
  layered on gambling, and a protocol judge will say so.
- **Head-to-head challenges.** They need a duration, a valuation of open
  positions we do not have, and a social graph.
- **Any claim about future performance.** A board reports what happened.

---

## The thing that outranks all of this

`tasks/todo.md` P0 is still open: **no real mainnet fill has been placed, and no
hash is recorded in `docs/decisions.md` §9.** Until that exists the Track 02
entry is not valid, and no amount of leaderboard makes up for it.

If this proposal competes with that for anyone's time, it should lose.

---

## Related

- `docs/decisions.md` §11 — Deribit mapping, and why we rank trades not traders
- `docs/decisions.md` §12 — what counts as a winning trade
- `docs/decisions.md` §1 — server-side signing, and why `trader` is a session id
- `docs/decisions.md` §9 — the missing mainnet hash
- `tasks/todo.md` P3 — the signals lane
