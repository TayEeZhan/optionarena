import { Flow } from '@/components/Flow';
import { AutoRefresh } from '@/components/AutoRefresh';
import { fetchPulse } from '@/lib/thetanuts/book';
import { chainConfig } from '@/lib/thetanuts/client';

// The book changes constantly, so this page is never cached.
export const dynamic = 'force-dynamic';

/**
 * The trade screen.
 *
 * Mobile-first: the flow comes first and the market context sits underneath it,
 * because on a phone there is no second column and the thing you came to do
 * should not be below the thing you came to read.
 */
export default async function TradePage() {
  let pulse = null;
  let pulseError: string | null = null;

  try {
    pulse = await fetchPulse();
  } catch (error) {
    pulseError = error instanceof Error ? error.message : 'The indexer is unreachable.';
  }

  return (
    <div className="space-y-8">
      <AutoRefresh seconds={60} />

      <Flow />

      <section className="space-y-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Market pulse</p>
            {pulse && (
              <span
                className="flex items-center gap-1.5 text-[0.75rem] text-[var(--color-ink-faint)]"
                title={`Indexer lag ${pulse.indexerLagBlocks ?? '?'} blocks`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-gain)]" />
                live
              </span>
            )}
          </div>

          {pulseError && (
            <p className="mt-3 text-[0.85rem] leading-relaxed text-[var(--color-loss)]">
              {pulseError}
            </p>
          )}

          {pulse && (
            <>
              <p className="data mt-3 text-[2.6rem] leading-none font-medium">
                {pulse.usdcBuyable}
              </p>
              <p className="mt-2 text-[0.85rem] leading-relaxed text-[var(--color-ink-muted)]">
                contracts priced in USDC you can buy right now, of {pulse.buyableOrders} buyable and{' '}
                {pulse.totalOrders} resting
              </p>

              <div className="mt-5 space-y-2">
                {pulse.byUnderlying.map((row) => (
                  <div
                    key={row.underlying}
                    className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-2 text-[0.85rem] last:border-0"
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

              <p className="mt-5 text-[0.8rem] leading-relaxed text-[var(--color-ink-faint)]">
                Only assets with resting sell orders can be bought, which on Base today is ETH and
                BTC. OptionArena trades the contracts priced in USDC, so the budget you type is the
                amount you spend. Calls are collateralised in the asset they deliver.
              </p>
            </>
          )}
        </div>

        <div className="card p-6">
          <p className="eyebrow">Where this runs</p>
          <dl className="mt-4 space-y-3 text-[0.8rem]">
            <div>
              <dt className="text-[var(--color-ink-faint)]">Chain</dt>
              <dd className="data mt-0.5 text-[var(--color-ink-muted)]">
                {chainConfig.name} · {chainConfig.chainId}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-faint)]">OptionBook</dt>
              <dd className="data mt-0.5 break-all text-[var(--color-ink-muted)]">
                {chainConfig.contracts.optionBook}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-faint)]">OptionFactory</dt>
              <dd className="data mt-0.5 break-all text-[var(--color-ink-muted)]">
                {chainConfig.contracts.optionFactory}
              </dd>
            </div>
          </dl>
          <p className="mt-5 border-t border-[var(--color-hairline)] pt-4 text-[0.8rem] leading-relaxed text-[var(--color-ink-faint)]">
            OptionArena deploys no contracts of its own. It calls the contracts Thetanuts has
            already deployed.
          </p>
        </div>
      </section>
    </div>
  );
}
