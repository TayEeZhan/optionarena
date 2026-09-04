import Link from 'next/link';
import { ChevronRightIcon, ShieldIcon } from '@/components/Icons';
import { AssetMark, instrumentLabel, MappingBadge, signalValue } from '@/components/SignalCard';
import { getBoardSnapshot } from '@/lib/signals/board';

export const dynamic = 'force-dynamic';

export default async function StrategyPage() {
  const board = await getBoardSnapshot('inProfit', 20);
  const mapped = board.mapped.find((signal) => signal.instrument) ?? board.mapped[0];

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

      {mapped && (
        <section className="panel accent-ring mt-7 p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <AssetMark signal={mapped.signal} className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-[1.3rem] font-bold">{instrumentLabel(mapped.signal)}</h2>
              <p className="data mt-2 text-[1.6rem] font-semibold text-[var(--color-gain)]">
                {signalValue(mapped.signal, 'inProfit')}
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

      <Link
        href="/trade"
        className="cta mt-5 flex min-h-14 items-center justify-center gap-2 px-5 text-[0.95rem]"
      >
        Build my trade
        <ChevronRightIcon className="h-4 w-4" />
      </Link>
      <p className="mt-3 text-center text-[0.78rem] text-[var(--color-ink-faint)]">
        You still review the live quote and maximum loss. Nothing is copied automatically.
      </p>
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
