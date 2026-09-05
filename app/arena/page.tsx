import Link from 'next/link';
import { AssetMark, instrumentLabel, signalValue } from '@/components/SignalCard';
import { ChevronRightIcon } from '@/components/Icons';
import { getBoardSnapshot, pickMatchup } from '@/lib/signals/board';

export const dynamic = 'force-dynamic';

export default async function ArenaPage() {
  // A wider pool than the two shown, so the matchup can find a second
  // contract that is genuinely different. See pickMatchup.
  const board = await getBoardSnapshot('inProfit', 12);
  const matchup = pickMatchup(board.signals);
  const [left, right] = matchup ?? [null, null];

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

          <div className="mt-7 border-t border-[var(--color-hairline)] pt-5 text-center">
            <p className="eyebrow">Current ranking snapshot</p>
            <p className="mt-2 text-[0.8rem] text-[var(--color-ink-muted)]">
              Ranked by performance from entry. This is not a timed wager or a prediction.
            </p>
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

      <Link
        href="/leaderboard"
        className="mt-7 flex items-center justify-center gap-2 text-[0.85rem] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]"
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
