import Link from 'next/link';
import { ChevronRightIcon, ShieldIcon } from '@/components/Icons';
import { AssetMark, instrumentLabel, MappingBadge, signalValue } from '@/components/SignalCard';
import { findMapped, getBoardSnapshot } from '@/lib/signals/board';

export const dynamic = 'force-dynamic';

export default async function CopyPage() {
  const board = await getBoardSnapshot('inProfit', 20);
  const featured = findMapped(board);

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow">Sourced from public flow</p>
      <h1 className="display mt-2 text-[2.55rem] font-extrabold">Copy trades</h1>
      <p className="mt-3 text-[0.95rem] text-[var(--color-ink-muted)]">You approve every trade.</p>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 rounded-full bg-[var(--color-accent)] px-4 py-2 text-[0.78rem] font-semibold text-[var(--color-accent-ink)]">
          Featured
        </span>
        <span className="pill shrink-0 px-4 py-2 text-[0.78rem] text-[var(--color-ink-muted)]">
          Exact match
        </span>
        <span className="pill shrink-0 px-4 py-2 text-[0.78rem] text-[var(--color-ink-muted)]">
          Near match
        </span>
      </div>

      {featured ? (
        <section className="panel mt-7 p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <AssetMark signal={featured.signal} className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[1.25rem] font-bold">{instrumentLabel(featured.signal)}</h2>
                <MappingBadge mapped={featured} />
              </div>
              <p className="data mt-2 text-[1.45rem] font-semibold text-[var(--color-gain)]">
                {signalValue(featured.signal, 'inProfit')}
              </p>
              <p className="mt-1 text-[0.75rem] text-[var(--color-ink-faint)]">
                Deribit · ${Math.round(featured.signal.notionalUsd).toLocaleString('en-US')} premium
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-ground)] p-4">
            <div className="flex items-start gap-3">
              <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <p className="text-[0.85rem] font-semibold">Why it ranked</p>
                <p className="mt-1.5 text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
                  {featured.signal.why}
                </p>
              </div>
            </div>
          </div>

          <Link
            href={`/copy/strategy?id=${encodeURIComponent(featured.signal.id)}`}
            className="cta mt-6 flex min-h-14 items-center justify-center gap-2 px-5 text-[0.95rem]"
          >
            View strategy
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <div className="panel mt-7 p-8 text-center text-[0.9rem] text-[var(--color-ink-muted)]">
          No ranked trade is available right now.
        </div>
      )}

      <Link
        href="/leaderboard"
        className="mt-7 flex items-center justify-center gap-2 text-[0.85rem] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]"
      >
        Browse ranked trades
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
