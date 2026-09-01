import Link from 'next/link';
import { AutoRefresh } from '@/components/AutoRefresh';
import { ArrowUpRightIcon, ChevronRightIcon, CopyIcon, TradeIcon } from '@/components/Icons';
import { AssetMark, instrumentLabel, signalValue } from '@/components/SignalCard';
import { getBoardSnapshot } from '@/lib/signals/board';
import { fetchPulse } from '@/lib/thetanuts/book';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [board, pulse] = await Promise.all([
    getBoardSnapshot('inProfit', 1),
    fetchPulse().catch(() => null),
  ]);
  const featured = board.signals[0];

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <AutoRefresh seconds={60} />

      <section className="panel p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Demo balance</p>
          <span className="pill px-3 py-1 text-[0.7rem] font-semibold text-[var(--color-accent)]">
            DEMO
          </span>
        </div>
        <p className="data mt-6 flex flex-wrap items-baseline gap-2">
          <span className="text-[2.8rem] leading-none font-semibold tracking-[-0.05em] sm:text-[3.4rem]">
            10,000.00
          </span>
          <span className="text-[0.95rem] text-[var(--color-ink-muted)]">USDC</span>
        </p>
        <p className="mt-3 text-[0.82rem] text-[var(--color-ink-faint)]">
          Simulated balance. Real prices, no signature.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/trade"
          className="cta flex min-h-16 items-center justify-center gap-2 px-5 text-[0.95rem]"
        >
          <TradeIcon />
          Trade
        </Link>
        <Link
          href="/copy"
          className="ghost flex min-h-16 items-center justify-center gap-2 bg-[var(--color-surface-high)] px-5 text-[0.95rem] font-semibold text-[var(--color-ink)]"
        >
          <CopyIcon />
          Copy
        </Link>
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="eyebrow">Market discovery</p>
            <h1 className="display mt-2 text-[1.8rem] font-bold">Trending now</h1>
          </div>
          <Link href="/arena" className="text-[0.78rem] font-medium text-[var(--color-accent)]">
            View arena
          </Link>
        </div>

        {featured ? (
          <Link
            href="/arena"
            className="panel flex min-h-28 items-center gap-4 p-5 transition-colors hover:border-[var(--color-accent)]/50"
          >
            <AssetMark signal={featured} className="h-11 w-11 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[1rem] font-semibold">{instrumentLabel(featured)}</span>
              <span className="mt-1 block text-[0.78rem] text-[var(--color-ink-faint)]">
                {board.live ? 'Live Deribit signal' : 'Preview signal'} ·{' '}
                {new Date(featured.expiry * 1000).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </span>
            <span className="text-right">
              <span className="data block text-[1rem] font-semibold text-[var(--color-gain)]">
                {signalValue(featured, 'inProfit')}
              </span>
              <span className="mt-1 flex items-center justify-end gap-1 text-[0.72rem] text-[var(--color-ink-muted)]">
                View <ChevronRightIcon className="h-3.5 w-3.5" />
              </span>
            </span>
          </Link>
        ) : (
          <div className="panel p-6 text-[0.85rem] text-[var(--color-ink-muted)]">
            No qualifying signals right now.
          </div>
        )}

        <div className="mt-4 flex items-center justify-between px-1 text-[0.75rem] text-[var(--color-ink-faint)]">
          <span>
            {pulse ? `${pulse.usdcBuyable} USDC-priced contracts live` : 'Live book reconnecting'}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${pulse ? 'bg-[var(--color-gain)]' : 'bg-[var(--color-loss)]'}`}
            />
            {pulse ? 'OptionBook live' : 'Unavailable'}
          </span>
        </div>
      </section>

      <Link
        href="/leaderboard"
        className="flex items-center justify-between rounded-2xl border border-[var(--color-hairline)] px-5 py-4 text-[0.85rem] text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-hairline-bright)] hover:text-[var(--color-ink)]"
      >
        See the ranked trade board
        <ArrowUpRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}
