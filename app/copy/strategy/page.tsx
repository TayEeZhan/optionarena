import Link from 'next/link';
import { ChevronRightIcon, ShieldIcon } from '@/components/Icons';
import {
  AssetMark,
  instrumentLabel,
  MappingBadge,
  signalValue,
  viewSentence,
} from '@/components/SignalCard';
import { findMapped, getBoardSnapshot } from '@/lib/signals/board';
import {
  WinningCriterion as WinningCriterionSchema,
  type WinningCriterion,
} from '@/lib/signals/types';

export const dynamic = 'force-dynamic';

export default async function StrategyPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; criterion?: string }>;
}) {
  const params = await searchParams;
  const parsed = WinningCriterionSchema.safeParse(params.criterion);
  const criterion: WinningCriterion = parsed.success ? parsed.data : 'inProfit';

  const board = await getBoardSnapshot(criterion, 20);
  const mapped = findMapped(board, params.id);

  // The board moves as new trades arrive. If the trade the user clicked has
  // rotated off it, show the featured one but say so, rather than quietly
  // swapping a different trade under the same heading.
  const rotatedAway = Boolean(params.id && mapped && mapped.signal.id !== params.id);

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/copy"
        className="text-[0.82rem] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      >
        ← Copy trades
      </Link>
      <h1 className="display mt-5 text-[2.5rem] font-extrabold">Strategy match</h1>
      <p className="mt-3 text-[0.9rem] text-[var(--color-ink-muted)]">
        Review the sourced trade before OptionArena builds a Thetanuts quote.
      </p>

      {rotatedAway && (
        <p className="mt-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3 text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
          That trade has rolled off the board since you opened it, so this is the top ranked one
          instead.
        </p>
      )}

      {mapped && (
        <section className="panel accent-ring mt-7 p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <AssetMark signal={mapped.signal} className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-[1.3rem] font-bold">{instrumentLabel(mapped.signal)}</h2>
              <p className="data mt-2 text-[1.6rem] font-semibold text-[var(--color-gain)]">
                {signalValue(mapped.signal, criterion)}
              </p>
            </div>
            <MappingBadge mapped={mapped} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Tile label="Strike" value={`$${mapped.signal.strike.toLocaleString('en-US')}`} />
            <Tile
              label="Expiry"
              value={new Date(mapped.signal.expiry * 1000).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            />
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-ground)] p-4">
            <div className="flex gap-3">
              <ShieldIcon className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />
              <p className="text-[0.8rem] leading-relaxed text-[var(--color-ink-muted)]">
                {mapped.exact
                  ? 'The strike and expiry match a buyable Thetanuts contract.'
                  : mapped.instrument
                    ? mapped.differences.join(' ')
                    : mapped.unavailable}
              </p>
            </div>
          </div>
        </section>
      )}

      {mapped ? (
        <>
          <Link
            href={`/trade?view=${encodeURIComponent(viewSentence(mapped.signal))}`}
            className="cta mt-5 flex min-h-14 items-center justify-center gap-2 px-5 text-[0.95rem]"
          >
            Build my trade
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-center text-[0.78rem] text-[var(--color-ink-faint)]">
            This fills in the view, not the contract. The agent reads it against the live Thetanuts
            book and may pick a different strike, and you approve the quote and the maximum loss
            before anything is signed. Nothing is copied automatically.
          </p>
        </>
      ) : (
        <p className="panel mt-7 p-8 text-center text-[0.9rem] text-[var(--color-ink-muted)]">
          No ranked trade is available right now.
        </p>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-ground)] p-4">
      <p className="eyebrow">{label}</p>
      <p className="data mt-2 text-[0.9rem] font-medium">{value}</p>
    </div>
  );
}
