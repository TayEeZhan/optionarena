import { Flow } from '@/components/Flow';
import { AutoRefresh } from '@/components/AutoRefresh';
import { fetchPulse } from '@/lib/thetanuts/book';
import { chainConfig } from '@/lib/thetanuts/client';

// The book changes constantly, so this page is never cached.
export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  let pulse = null;
  let pulseError: string | null = null;

  try {
    pulse = await fetchPulse();
  } catch (error) {
    pulseError = error instanceof Error ? error.message : 'The indexer is unreachable.';
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <AutoRefresh seconds={60} />
      <div className="min-w-0">
        <Flow />
      </div>

      <aside className="space-y-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Market pulse</p>
            {pulse && (
              <span
                className="flex items-center gap-1.5 text-[0.7rem] text-[var(--color-ink-faint)]"
                title={`Indexer lag ${pulse.indexerLagBlocks ?? '?'} blocks`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-gain)]" />
                live
              </span>
            )}
          </div>

          {pulseError && (
            <p className="mt-3 text-[0.8rem] leading-relaxed text-[var(--color-loss)]">
              {pulseError}
            </p>
          )}

          {pulse && (
            <>
              <p className="data mt-3 text-3xl font-medium">{pulse.usdcBuyable}</p>
              <p className="text-[0.75rem] leading-relaxed text-[var(--color-ink-faint)]">
                contracts priced in USDC that you can buy right now, of {pulse.buyableOrders}{' '}
                buyable and {pulse.totalOrders} resting
              </p>

              <div className="mt-4 space-y-1.5">
                {pulse.byUnderlying.map((row) => (
                  <div
                    key={row.underlying}
                    className="flex items-center justify-between text-[0.78rem]"
                  >
                    <span className="data text-[var(--color-ink-muted)]">{row.underlying}</span>
                    <span
                      className={`data ${
                        row.buyable > 0
                          ? 'text-[var(--color-ink)]'
                          : 'text-[var(--color-ink-faint)]'
                      }`}
                      title={
                        row.buyable > 0
                          ? `${row.buyable} buyable of ${row.total}`
                          : 'Makers are bidding only, so there is nothing to buy'
                      }
                    >
                      {row.buyable} / {row.total}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-4 border-t border-[var(--color-hairline)] pt-3 text-[0.7rem] leading-relaxed text-[var(--color-ink-faint)]">
                Only assets with resting sell orders can be bought, which on Base today is ETH and
                BTC. OptionArena trades the contracts priced in USDC, so the budget you type is the
                amount you spend. Calls are collateralised in the asset they deliver.
              </p>
            </>
          )}
        </div>

        <div className="card p-5">
          <p className="eyebrow">Where this runs</p>
          <dl className="mt-3 space-y-2 text-[0.75rem]">
            <div>
              <dt className="text-[var(--color-ink-faint)]">Chain</dt>
              <dd className="data text-[var(--color-ink-muted)]">
                {chainConfig.name} · {chainConfig.chainId}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-faint)]">OptionBook</dt>
              <dd className="data break-all text-[var(--color-ink-muted)]">
                {chainConfig.contracts.optionBook}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-faint)]">OptionFactory</dt>
              <dd className="data break-all text-[var(--color-ink-muted)]">
                {chainConfig.contracts.optionFactory}
              </dd>
            </div>
          </dl>
          <p className="mt-3 border-t border-[var(--color-hairline)] pt-3 text-[0.7rem] leading-relaxed text-[var(--color-ink-faint)]">
            OptionArena deploys no contracts of its own. It calls the contracts Thetanuts has
            already deployed.
          </p>
        </div>
      </aside>
    </div>
  );
}
