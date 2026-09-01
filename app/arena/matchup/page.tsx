import Link from 'next/link';
import { ChevronRightIcon } from '@/components/Icons';
import { AssetMark, instrumentLabel, signalValue } from '@/components/SignalCard';
import { getBoardSnapshot } from '@/lib/signals/board';

export const dynamic = 'force-dynamic';

export default async function MatchupPage() {
  const board = await getBoardSnapshot('inProfit', 2);
  const [left, right] = board.signals;

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/arena"
        className="text-[0.82rem] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      >
        ← Arena
      </Link>
      <h1 className="display mt-5 text-[2.5rem] font-extrabold">Matchup</h1>
      <p className="mt-3 text-[0.88rem] leading-relaxed text-[var(--color-ink-muted)]">
        Two public trades compared under the same selected ranking. This reports what happened; it
        does not predict what happens next.
      </p>

      {left && right && (
        <section className="panel mt-7 p-6">
          <div className="grid grid-cols-2 gap-5">
            {[left, right].map((signal, index) => (
              <div
                key={signal.id}
                className={index === 1 ? 'border-l border-[var(--color-hairline)] pl-5' : ''}
              >
                <AssetMark signal={signal} className="h-12 w-12" />
                <p className="mt-4 text-[1.05rem] font-bold">{instrumentLabel(signal)}</p>
                <p className="data mt-2 text-[1.55rem] font-semibold text-[var(--color-gain)]">
                  {signalValue(signal, 'inProfit')}
                </p>
                <dl className="mt-5 space-y-3 text-[0.76rem]">
                  <Stat label="Strike" value={`$${signal.strike.toLocaleString('en-US')}`} />
                  <Stat
                    label="Expiry"
                    value={new Date(signal.expiry * 1000).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  />
                  <Stat
                    label="Premium"
                    value={`$${Math.round(signal.notionalUsd).toLocaleString('en-US')}`}
                  />
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      <Link
        href="/leaderboard"
        className="ghost mt-5 flex min-h-14 items-center justify-center gap-2 px-5 text-[0.9rem] font-semibold text-[var(--color-ink)]"
      >
        View trade rankings
        <ChevronRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--color-ink-faint)]">{label}</dt>
      <dd className="data mt-0.5 text-[var(--color-ink-muted)]">{value}</dd>
    </div>
  );
}
