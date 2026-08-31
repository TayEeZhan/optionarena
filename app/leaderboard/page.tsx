import { getStore, MIN_TRADES_TO_RANK } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

/**
 * The leaderboard.
 *
 * Ranked by return per unit of capital risked, not by raw percentage gain. A
 * board sorted by percentage gain rewards whoever took the most risk and got
 * lucky, which is the opposite of what this product is for.
 */
export default async function LeaderboardPage() {
  const strategies = await getStore().list(500);
  const executed = strategies.filter((s) => s.txHash);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow">Leaderboard</p>
      <h1 className="display mt-2 text-4xl font-semibold">Ranked by risk-adjusted return</h1>
      <p className="mt-2 max-w-2xl text-[0.9rem] leading-relaxed text-[var(--color-ink-muted)]">
        Return per unit of capital risked, not raw percentage gain. A trader needs at least{' '}
        {MIN_TRADES_TO_RANK} settled trades before ranking, so one lucky trade cannot top the board.
      </p>

      <div className="card mt-7 p-10 text-center">
        <p className="text-[0.95rem] text-[var(--color-ink-muted)]">
          {executed.length === 0
            ? 'No settled trades yet.'
            : `${executed.length} executed strategy${executed.length === 1 ? '' : 'ies'} recorded, none settled yet.`}
        </p>
        <p className="mt-2 text-[0.8rem] leading-relaxed text-[var(--color-ink-faint)]">
          Positions rank once they reach expiry and settle. Until then the board stays empty rather
          than showing a number that has not been earned.
        </p>
      </div>
    </div>
  );
}
