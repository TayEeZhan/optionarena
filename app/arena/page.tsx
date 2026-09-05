import Link from 'next/link';
import { AssetMark, instrumentLabel, signalValue } from '@/components/SignalCard';
import { ChevronRightIcon } from '@/components/Icons';
import { getBoardSnapshot, pickMatchup } from '@/lib/signals/board';
import { getHandle } from '@/lib/auth/session';
import { getSocialStore } from '@/lib/social/store';
import { getStore } from '@/lib/db/store';
import type { ExecutedStrategy } from '@/lib/agent/schema';
import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { callRecord, resolveCallIfDue } from '@/lib/social/calls';
import type { CallSide } from '@/lib/db/schema';
import type { RankedSignal } from '@/lib/signals/types';

export const dynamic = 'force-dynamic';

export default async function ArenaPage() {
  // A wider pool than the two shown, so the matchup can find a second
  // contract that is genuinely different. See pickMatchup.
  const board = await getBoardSnapshot('inProfit', 12);
  const matchup = pickMatchup(board.signals);
  const [left, right] = matchup ?? [null, null];

  // The other half of the arena: friends, not strangers. The Deribit matchup
  // above is discovery; this is where you take someone on.
  const me = await getHandle();
  const following = me ? await getSocialStore().following(me) : [];

  // The call this person has already made on exactly this pairing, if any.
  const pairKey = left && right ? `${left.id}|${right.id}` : null;
  const existing = me && pairKey ? await getSocialStore().callFor(me, pairKey) : null;
  const outcome = existing ? await resolveCallIfDue(existing) : null;
  const record = me ? callRecord(await getSocialStore().callsFor(me)) : null;

  const resolvesOn =
    left && right
      ? new Date(Math.max(left.expiry, right.expiry) * 1000).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        })
      : '';
  const challengeable = following.length
    ? (await getStore().list(200))
        .filter((strategy) => strategy.trader && following.includes(strategy.trader))
        .slice(0, 4)
    : [];

  async function call(formData: FormData) {
    'use server';

    const handle = await getHandle();
    if (!handle) redirect('/join');

    const picked = String(formData.get('picked'));
    const key = String(formData.get('pairKey'));
    const leftSide = JSON.parse(String(formData.get('left'))) as CallSide;
    const rightSide = JSON.parse(String(formData.get('right'))) as CallSide;
    if (picked !== 'left' && picked !== 'right') redirect('/arena');

    const already = await getSocialStore().callFor(handle, key);

    await getSocialStore().saveCall({
      id: already?.id ?? randomUUID(),
      handle,
      pairKey: key,
      createdAt: already?.createdAt ?? Date.now(),
      picked,
      left: leftSide,
      right: rightSide,
      resolvesAt: Math.max(leftSide.expiry, rightSide.expiry),
      winner: null,
      resolvedAt: null,
      settlement: null,
    });

    redirect('/arena');
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Competitive discovery</p>
          <h1 className="display mt-2 text-[2.7rem] font-extrabold">Arena</h1>
        </div>
        <span className="pill mt-2 flex items-center gap-2 px-3.5 py-2 text-[0.72rem] text-[var(--color-ink-muted)]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${board.live ? 'bg-[var(--color-gain)]' : 'bg-[var(--color-accent)]'}`}
          />
          {board.live ? 'Live' : 'Preview'}
        </span>
      </div>

      <p className="mt-3 text-[0.9rem] leading-relaxed text-[var(--color-ink-muted)]">
        A live comparison of ranked trades. Bragging rights only—nothing is staked.
      </p>

      {left && right ? (
        <section className="panel accent-ring mt-8 p-5 sm:p-7">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <TradeSide signal={left} align="left" />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-hairline-bright)] bg-[var(--color-ground)] text-[0.95rem] font-extrabold text-[var(--color-accent)]">
              VS
            </div>
            <TradeSide signal={right} align="right" />
          </div>

          <div className="mt-7 border-t border-[var(--color-hairline)] pt-6">
            {outcome?.call.winner ? (
              <div className="text-center">
                <p className="eyebrow">Result</p>
                <p className="display mt-2 text-[1.9rem] font-extrabold">
                  {outcome.call.winner === 'draw'
                    ? 'A draw.'
                    : outcome.correct
                      ? 'You called it.'
                      : 'You called it wrong.'}
                </p>
                <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
                  {outcome.returns && (
                    <>
                      Left {(outcome.returns.left! * 100).toFixed(0)}%, right{' '}
                      {(outcome.returns.right! * 100).toFixed(0)}% at settlement.{' '}
                    </>
                  )}
                  Settled against the price Deribit published. Nothing was staked.
                </p>
              </div>
            ) : existing ? (
              <div className="text-center">
                <p className="eyebrow">Your call</p>
                <p className="mt-2 text-[1rem] font-semibold">
                  You picked the{' '}
                  {(existing.picked === 'left' ? left : right).strike.toLocaleString('en-US')}{' '}
                  {(existing.picked === 'left' ? left : right).isCall ? 'call' : 'put'}
                </p>
                <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
                  {outcome?.note ??
                    `Resolves ${resolvesOn}. Nothing is staked — this is a call, not a bet.`}
                </p>
              </div>
            ) : me ? (
              <>
                <p className="eyebrow text-center">Which one does better by expiry?</p>
                <form action={call} className="mt-4 grid grid-cols-2 gap-3">
                  <input type="hidden" name="pairKey" value={pairKey ?? ''} />
                  <input type="hidden" name="left" value={JSON.stringify(sideOf(left))} />
                  <input type="hidden" name="right" value={JSON.stringify(sideOf(right))} />
                  <button
                    name="picked"
                    value="left"
                    type="submit"
                    className="ghost px-3 py-3 text-[0.82rem] leading-snug"
                  >
                    Call the {left.strike.toLocaleString('en-US')} {left.isCall ? 'call' : 'put'}
                  </button>
                  <button
                    name="picked"
                    value="right"
                    type="submit"
                    className="ghost px-3 py-3 text-[0.82rem] leading-snug"
                  >
                    Call the {right.strike.toLocaleString('en-US')} {right.isCall ? 'call' : 'put'}
                  </button>
                </form>
                <p className="mt-3 text-center text-[0.72rem] leading-relaxed text-[var(--color-ink-faint)]">
                  Free, and nothing is staked. It resolves {resolvesOn} against the settlement price
                  Deribit publishes — not against anything we report.
                  {record && record.right + record.wrong > 0 && (
                    <>
                      {' '}
                      Your record so far: {record.right} right, {record.wrong} wrong.
                    </>
                  )}
                </p>
              </>
            ) : (
              <div className="text-center">
                <p className="text-[0.85rem] text-[var(--color-ink-muted)]">
                  Sign in to call which one does better.
                </p>
                <Link href="/join" className="cta mt-4 inline-flex px-5 py-2.5 text-[0.85rem]">
                  Sign in
                </Link>
              </div>
            )}
          </div>

          <Link
            href={`/arena/matchup?left=${encodeURIComponent(left.id)}&right=${encodeURIComponent(right.id)}`}
            className="cta mt-6 flex min-h-14 items-center justify-center gap-2 px-5 text-[0.95rem]"
          >
            View matchup
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <div className="panel mt-8 p-8 text-center text-[0.9rem] text-[var(--color-ink-muted)]">
          Two qualifying trades are needed for a matchup.
        </div>
      )}

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display text-[1.6rem] font-extrabold">Take on a friend</h2>
          {me && (
            <Link
              href="/battles"
              className="text-[0.8rem] text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]"
            >
              Your battles
            </Link>
          )}
        </div>
        <p className="mt-2 text-[0.85rem] leading-relaxed text-[var(--color-ink-muted)]">
          Put one of your strategies against theirs. Nothing is staked, and it settles when the
          options expire.
        </p>

        {!me ? (
          <div className="panel mt-5 p-6 text-center">
            <p className="text-[0.88rem] text-[var(--color-ink-muted)]">
              Sign in to challenge someone.
            </p>
            <Link href="/join" className="cta mt-4 inline-flex px-5 py-3 text-[0.88rem]">
              Sign in
            </Link>
          </div>
        ) : challengeable.length === 0 ? (
          <div className="panel mt-5 p-6 text-center">
            <p className="text-[0.88rem] text-[var(--color-ink-muted)]">
              {following.length === 0
                ? 'Follow a friend and their strategies show up here.'
                : 'Nobody you follow has built a strategy yet.'}
            </p>
            <Link href="/friends" className="cta mt-4 inline-flex px-5 py-3 text-[0.88rem]">
              {following.length === 0 ? 'Find friends' : 'See friends'}
            </Link>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {challengeable.map((strategy) => (
              <ChallengeRow key={strategy.id} strategy={strategy} />
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/leaderboard"
        className="mt-9 flex items-center justify-center gap-2 text-[0.85rem] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]"
      >
        See all ranked trades
        <ChevronRightIcon className="h-4 w-4" />
      </Link>

      {board.message && (
        <p className="mt-7 text-center text-[0.72rem] leading-relaxed text-[var(--color-ink-faint)]">
          {board.message}
        </p>
      )}
    </div>
  );
}

/**
 * Freeze one side of a matchup into a call.
 *
 * The board rotates within minutes, so a call that merely pointed at signal ids
 * would be unresolvable almost immediately. Everything settlement needs is
 * copied in here instead, and the call never consults the board again.
 */
function sideOf(signal: RankedSignal): CallSide {
  return {
    signalId: signal.id,
    label: instrumentLabel(signal),
    underlying: signal.underlying,
    isCall: signal.isCall,
    strike: signal.strike,
    expiry: signal.expiry,
    price: signal.price,
  };
}

function ChallengeRow({ strategy }: { strategy: ExecutedStrategy }) {
  return (
    <li className="panel flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="data text-[0.8rem] text-[var(--color-ink-faint)]">@{strategy.trader}</p>
        <p className="mt-1 truncate text-[0.92rem] font-semibold">{strategy.label}</p>
        <p className="data mt-1 text-[0.75rem] text-[var(--color-ink-muted)]">
          Risks {strategy.maxLoss} {strategy.collateralSymbol}
        </p>
      </div>
      <Link
        href={`/battles/new?opponent=${encodeURIComponent(strategy.trader ?? '')}&strategy=${encodeURIComponent(strategy.id)}`}
        className="cta shrink-0 px-4 py-2.5 text-[0.82rem]"
      >
        Challenge
      </Link>
    </li>
  );
}

function TradeSide({
  signal,
  align,
}: {
  signal: Awaited<ReturnType<typeof getBoardSnapshot>>['signals'][number];
  align: 'left' | 'right';
}) {
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
      <AssetMark signal={signal} className={`h-12 w-12 ${align === 'right' ? 'ml-auto' : ''}`} />
      <p className="mt-3 truncate text-[1rem] font-bold">{instrumentLabel(signal)}</p>
      <p className="data mt-2 text-[1.25rem] font-semibold text-[var(--color-gain)]">
        {signalValue(signal, 'inProfit')}
      </p>
      <p className="data mt-1 text-[0.7rem] text-[var(--color-ink-faint)]">
        ${signal.strike.toLocaleString('en-US')} strike
      </p>
    </div>
  );
}
