import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getHandle } from '@/lib/auth/session';
import { getStore } from '@/lib/db/store';
import { getSocialStore } from '@/lib/social/store';

export const dynamic = 'force-dynamic';

/**
 * Start a friendly battle.
 *
 * The challenger picks one of their own strategies to put up against the one
 * they were looking at. Nothing is staked and nothing is transferred; a battle
 * is a comparison with a date on it.
 */
export default async function NewBattlePage({
  searchParams,
}: {
  searchParams: Promise<{ opponent?: string; strategy?: string }>;
}) {
  const me = await getHandle();
  if (!me) redirect('/join');

  const { opponent, strategy: opponentStrategyId } = await searchParams;
  if (!opponent || !opponentStrategyId) redirect('/friends');

  const theirs = await getStore().get(opponentStrategyId);
  const mine = (await getStore().list(200)).filter((row) => row.trader === me);

  async function start(formData: FormData) {
    'use server';

    const challenger = await getHandle();
    const mineId = String(formData.get('strategy') ?? '');
    const theirId = String(formData.get('opponentStrategy') ?? '');
    const against = String(formData.get('opponent') ?? '');
    if (!challenger || !mineId || !theirId || !against) redirect('/friends');

    const store = getStore();
    const [a, b] = await Promise.all([store.get(mineId), store.get(theirId)]);
    if (!a || !b) redirect('/friends');

    const id = randomUUID();
    await getSocialStore().createBattle({
      id,
      createdAt: Date.now(),
      challenger,
      opponent: against,
      challengerStrategyId: mineId,
      opponentStrategyId: theirId,
      // Neither side can be judged until both contracts have expired.
      resolvesAt: Math.max(a.expiry, b.expiry),
      winner: null,
      resolvedAt: null,
      settlement: null,
    });

    redirect(`/battles/${id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/friends"
        className="text-[0.82rem] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      >
        ← Friends
      </Link>
      <h1 className="display mt-5 text-[2.4rem] font-extrabold">Challenge @{opponent}</h1>
      <p className="mt-3 text-[0.9rem] leading-relaxed text-[var(--color-ink-muted)]">
        Pick one of your strategies to put up against theirs. Nothing is staked and no money moves —
        this is bragging rights, settled when the options expire.
      </p>

      {theirs && (
        <div className="panel mt-7 p-5">
          <p className="eyebrow">Their strategy</p>
          <p className="mt-2 text-[1.05rem] font-bold">{theirs.label}</p>
          <p className="mt-2 text-[0.8rem] leading-relaxed text-[var(--color-ink-muted)]">
            &ldquo;{theirs.view}&rdquo;
          </p>
        </div>
      )}

      {mine.length === 0 ? (
        <div className="panel mt-5 p-8 text-center">
          <p className="text-[0.9rem] text-[var(--color-ink-muted)]">
            You have not built a strategy yet.
          </p>
          <Link href="/trade" className="cta mt-5 inline-flex px-5 py-3 text-[0.88rem]">
            Build one first
          </Link>
        </div>
      ) : (
        <form action={start} className="mt-5">
          <input type="hidden" name="opponent" value={opponent} />
          <input type="hidden" name="opponentStrategy" value={opponentStrategyId} />

          <p className="eyebrow">Your strategy</p>
          <ul className="mt-3 space-y-2">
            {mine.slice(0, 8).map((strategy, index) => (
              <li key={strategy.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-ground)] p-4 transition-colors hover:border-[var(--color-accent)]/40 has-checked:border-[var(--color-accent)]/60">
                  <input
                    type="radio"
                    name="strategy"
                    value={strategy.id}
                    defaultChecked={index === 0}
                    className="mt-1 accent-[var(--color-accent)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[0.92rem] font-semibold">{strategy.label}</span>
                    <span className="mt-1 block text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
                      &ldquo;{strategy.view}&rdquo;
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <button type="submit" className="cta mt-6 min-h-14 w-full px-5 text-[0.95rem]">
            Start the battle
          </button>
        </form>
      )}
    </div>
  );
}
