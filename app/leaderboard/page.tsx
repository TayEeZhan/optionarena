import Link from 'next/link';
import { RankingSelector } from '@/components/RankingSelector';
import {
  AssetMark,
  CompactSignalRow,
  instrumentLabel,
  MappingBadge,
  signalValue,
} from '@/components/SignalCard';
import { getBoardSnapshot } from '@/lib/signals/board';
import {
  WINNING_CRITERIA,
  WinningCriterion as WinningCriterionSchema,
  type WinningCriterion,
} from '@/lib/signals/types';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ criterion?: string }>;
}) {
  const requested = (await searchParams).criterion;
  const parsed = WinningCriterionSchema.safeParse(requested);
  const criterion: WinningCriterion = parsed.success ? parsed.data : 'inProfit';
  const board = await getBoardSnapshot(criterion, 4);
  const [featured, ...rest] = board.mapped;

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-[2.5rem] font-extrabold sm:text-[3rem]">Leaderboard</h1>
          <p className="mt-2 text-[0.95rem] text-[var(--color-ink-muted)]">Trades, not traders.</p>
        </div>
        <span className="pill mt-1 px-3 py-1.5 text-[0.7rem] font-semibold text-[var(--color-accent)]">
          {board.live ? 'LIVE' : 'PREVIEW'}
        </span>
      </div>

      <div className="mt-6">
        <RankingSelector value={criterion} />
      </div>

      {featured ? (
        <Link
          href={`/copy/strategy?id=${encodeURIComponent(featured.signal.id)}&criterion=${criterion}`}
          className="panel accent-ring mt-6 block p-5 transition-colors hover:border-[var(--color-accent)]/40 sm:p-6"
        >
          <div className="grid grid-cols-[1.8rem_2.75rem_minmax(0,1fr)_4.6rem] items-start gap-3">
            <span className="data pt-1 text-[1.1rem] font-semibold text-[var(--color-accent)]">
              #1
            </span>
            <AssetMark signal={featured.signal} className="h-11 w-11" />
            <div className="min-w-0">
              <h2 className="truncate text-[1.15rem] font-bold">
                {instrumentLabel(featured.signal)}
              </h2>
              <p className="data mt-1 text-[1.45rem] font-semibold text-[var(--color-gain)]">
                {signalValue(featured.signal, criterion)}
              </p>
            </div>
            <div className="text-right">
              <p className="data text-[0.85rem] font-medium">
                ${Math.round(featured.signal.notionalUsd).toLocaleString('en-US')}
              </p>
              <p className="mt-1 text-[0.75rem] text-[var(--color-ink-muted)]">Deribit</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="data text-[0.78rem] text-[var(--color-ink-muted)]">
              {featured.signal.direction === 'buy' ? 'Bought' : 'Sold'}{' '}
              {featured.signal.price.toFixed(4)} · Mark{' '}
              {featured.signal.markPrice?.toFixed(4) ?? '—'}
            </p>
            <MappingBadge mapped={featured} />
          </div>

          <p className="mt-5 border-t border-[var(--color-hairline)] pt-5 text-[0.82rem] leading-relaxed text-[var(--color-ink-muted)]">
            {featured.signal.why}
          </p>
        </Link>
      ) : (
        <div className="panel mt-6 p-8 text-center text-[0.9rem] text-[var(--color-ink-muted)]">
          No trades qualify for this ranking right now.
        </div>
      )}

      {rest.length > 0 && (
        <ol className="panel mt-4 overflow-hidden">
          {rest.map((mapped, index) => (
            <CompactSignalRow
              key={mapped.signal.id}
              mapped={mapped}
              rank={index + 2}
              criterion={criterion}
            />
          ))}
        </ol>
      )}

      <details className="group mt-6 text-center">
        <summary className="cursor-pointer list-none text-[0.82rem] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]">
          How ranking works
        </summary>
        <p className="mx-auto mt-3 max-w-md text-left text-[0.78rem] leading-relaxed text-[var(--color-ink-faint)]">
          {WINNING_CRITERIA[criterion].explain} Every row explains why it ranked, and mapping labels
          show whether the public Deribit trade can be reproduced on Thetanuts.
        </p>
      </details>

      {board.message && (
        <p className="mt-6 text-center text-[0.72rem] leading-relaxed text-[var(--color-ink-faint)]">
          {board.message}
        </p>
      )}
    </div>
  );
}
