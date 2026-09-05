import { Flow } from '@/components/Flow';
import { AutoRefresh } from '@/components/AutoRefresh';
import { fetchPulse } from '@/lib/thetanuts/book';
import { chainConfig } from '@/lib/thetanuts/client';

export const dynamic = 'force-dynamic';

/** `view` and `budget` let /copy hand a sourced market view into step 01. */
export default async function TradePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; budget?: string }>;
}) {
  const params = await searchParams;
  const budget = Number(params.budget);
  let pulse = null;
  let pulseError: string | null = null;

  try {
    pulse = await fetchPulse();
  } catch (error) {
    pulseError = error instanceof Error ? error.message : 'The indexer is unreachable.';
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <AutoRefresh seconds={60} />

      <div>
        <p className="eyebrow">AI-assisted options</p>
        <h1 className="display mt-2 text-[2.35rem] font-extrabold sm:text-[3rem]">Build a trade</h1>
        <p className="mt-3 text-[0.9rem] leading-relaxed text-[var(--color-ink-muted)]">
          Describe your view. You approve the maximum loss before anything is signed.
        </p>
      </div>

      <Flow
        initialView={params.view ?? ''}
        initialBudget={Number.isFinite(budget) && budget > 0 ? budget : 5}
      />

      <section className="space-y-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Market pulse</p>
            {pulse && (
              <span className="flex items-center gap-1.5 text-[0.75rem] text-[var(--color-ink-faint)]">
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
                    <span className="data text-[var(--color-ink)]">
                      {row.buyable} / {row.total}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <details className="card p-6 text-[0.8rem] text-[var(--color-ink-muted)]">
          <summary className="cursor-pointer font-semibold text-[var(--color-ink)]">
            Protocol details
          </summary>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-[var(--color-ink-faint)]">Chain</dt>
              <dd className="data mt-0.5">
                {chainConfig.name} · {chainConfig.chainId}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-faint)]">OptionBook</dt>
              <dd className="data mt-0.5 break-all">{chainConfig.contracts.optionBook}</dd>
            </div>
          </dl>
        </details>
      </section>
    </div>
  );
}
