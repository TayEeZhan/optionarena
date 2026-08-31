import { getStore } from '@/lib/db/store';
import { explorerTx } from '@/lib/thetanuts/client';

export const dynamic = 'force-dynamic';

/**
 * The strategy feed.
 *
 * Every executed entry carries a verifiable transaction hash. Simulated entries
 * are shown too, and are labelled as simulated, because hiding them would make
 * the feed look busier than the market really is.
 */
export default async function FeedPage() {
  const strategies = await getStore().list();

  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow">Strategy feed</p>
      <h1 className="display mt-2 text-4xl font-semibold">What people traded</h1>
      <p className="mt-2 text-[0.9rem] text-[var(--color-ink-muted)]">
        Every executed strategy carries its transaction hash, so you can check it yourself.
      </p>

      {strategies.length === 0 ? (
        <div className="card mt-7 p-10 text-center">
          <p className="text-[0.95rem] text-[var(--color-ink-muted)]">Nothing here yet.</p>
          <p className="mt-2 text-[0.8rem] text-[var(--color-ink-faint)]">
            Build a strategy on the Overview page and it appears here.
          </p>
        </div>
      ) : (
        <ul className="mt-7 space-y-3">
          {strategies.map((strategy) => (
            <li key={strategy.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="display text-lg font-semibold">{strategy.label}</p>
                  {strategy.view && (
                    <p className="mt-1 text-[0.8rem] text-[var(--color-ink-faint)]">
                      &ldquo;{strategy.view}&rdquo;
                    </p>
                  )}
                </div>
                <span
                  className={`eyebrow shrink-0 rounded-full px-2.5 py-1 ${
                    strategy.txHash
                      ? 'bg-[var(--color-lime)]/12 text-[var(--color-lime)]'
                      : 'bg-[var(--color-surface-high)] text-[var(--color-ink-faint)]'
                  }`}
                >
                  {strategy.txHash ? 'On-chain' : 'Simulated'}
                </span>
              </div>

              {strategy.reasoning && (
                <p className="mt-3 text-[0.85rem] leading-relaxed text-[var(--color-ink-muted)]">
                  {strategy.reasoning}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[0.75rem]">
                <Stat label="Max loss" value={`${strategy.maxLoss} ${strategy.collateralSymbol}`} />
                <Stat
                  label="Max gain"
                  value={strategy.maxGain ? `${strategy.maxGain} ${strategy.collateralSymbol}` : 'Unbounded'}
                />
                <Stat label="Risk" value={strategy.risk} />
                <Stat label="Expiry" value={new Date(strategy.expiry * 1000).toISOString().slice(0, 10)} />
              </div>

              {strategy.txHash && (
                <a
                  href={explorerTx(strategy.txHash)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="data mt-4 block truncate text-[0.75rem] text-[var(--color-lime)] hover:underline"
                >
                  {strategy.txHash}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-[var(--color-ink-faint)]">{label} </span>
      <span className="data text-[var(--color-ink-muted)]">{value}</span>
    </span>
  );
}
