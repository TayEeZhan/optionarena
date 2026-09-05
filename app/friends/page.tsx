import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRightIcon } from '@/components/Icons';
import { getHandle, normaliseHandle } from '@/lib/auth/session';
import { getSocialStore } from '@/lib/social/store';
import { getStore } from '@/lib/db/store';
import type { ExecutedStrategy } from '@/lib/agent/schema';

export const dynamic = 'force-dynamic';

/**
 * Friends, and what they are trading.
 *
 * Following is one-directional and needs no consent, because every strategy is
 * already public in the feed. This is a filter over that, not a privacy
 * boundary — see the comment on `friendships` in `lib/db/schema.ts`.
 */
export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await getHandle();
  if (!me) redirect('/join');

  const { error } = await searchParams;
  const following = await getSocialStore().following(me);

  // One read of the feed, then split by author. The feed is small and already
  // sorted newest first, so there is nothing to gain from a query per friend.
  const recent = await getStore().list(200);
  const byFriend = new Map<string, ExecutedStrategy[]>();
  for (const strategy of recent) {
    if (!strategy.trader || !following.includes(strategy.trader)) continue;
    const list = byFriend.get(strategy.trader) ?? [];
    if (list.length < 3) list.push(strategy);
    byFriend.set(strategy.trader, list);
  }

  async function addFriend(formData: FormData) {
    'use server';

    const owner = await getHandle();
    if (!owner) redirect('/join');

    const handle = normaliseHandle(String(formData.get('handle') ?? ''));
    if (!handle) redirect('/friends?error=invalid');
    if (handle === owner) redirect('/friends?error=self');

    const social = getSocialStore();
    await social.upsertUser(handle);
    await social.follow(owner, handle);
    redirect('/friends');
  }

  async function removeFriend(formData: FormData) {
    'use server';

    const owner = await getHandle();
    const handle = String(formData.get('handle') ?? '');
    if (owner && handle) await getSocialStore().unfollow(owner, handle);
    redirect('/friends');
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow">Sourced from people you know</p>
      <h1 className="display mt-2 text-[2.55rem] font-extrabold">Friends</h1>
      <p className="mt-3 text-[0.95rem] text-[var(--color-ink-muted)]">
        You are <span className="data text-[var(--color-accent)]">@{me}</span>.{' '}
        <Link href="/join" className="underline hover:text-[var(--color-ink)]">
          Change handle
        </Link>{' '}
        ·{' '}
        <Link href="/battles" className="underline hover:text-[var(--color-ink)]">
          Your battles
        </Link>
      </p>

      <form action={addFriend} className="mt-7 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[var(--color-hairline-bright)] bg-[var(--color-ground)] px-4 py-3 focus-within:border-[var(--color-accent)]/60">
          <span className="data text-[var(--color-ink-faint)]">@</span>
          <input
            name="handle"
            placeholder="their handle"
            autoComplete="off"
            aria-label="Friend's handle"
            className="data w-full bg-transparent outline-none placeholder:text-[var(--color-ink-faint)]"
          />
        </div>
        <button type="submit" className="cta shrink-0 px-5 text-[0.9rem]">
          Follow
        </button>
      </form>

      {error === 'self' && (
        <p className="mt-3 text-[0.8rem] text-[var(--color-loss)]">
          You do not need to follow yourself. Your own strategies are on your profile.
        </p>
      )}
      {error === 'invalid' && (
        <p className="mt-3 text-[0.8rem] text-[var(--color-loss)]">
          That handle will not work. Three to twenty letters, numbers or underscores.
        </p>
      )}

      {following.length === 0 ? (
        <div className="panel mt-7 p-8 text-center">
          <p className="text-[0.9rem] text-[var(--color-ink-muted)]">
            You are not following anyone yet.
          </p>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--color-ink-faint)]">
            Ask a friend for their handle, or have them pick one on the join screen. Everything they
            build then shows up here.
          </p>
        </div>
      ) : (
        <ul className="mt-7 space-y-4">
          {following.map((friend) => {
            const theirs = byFriend.get(friend) ?? [];
            return (
              <li key={friend} className="panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="data text-[1.05rem] font-semibold">@{friend}</p>
                  <form action={removeFriend}>
                    <input type="hidden" name="handle" value={friend} />
                    <button
                      type="submit"
                      className="text-[0.75rem] text-[var(--color-ink-faint)] hover:text-[var(--color-loss)]"
                    >
                      Unfollow
                    </button>
                  </form>
                </div>

                {theirs.length === 0 ? (
                  <p className="mt-3 text-[0.8rem] text-[var(--color-ink-faint)]">
                    Nothing built yet.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {theirs.map((strategy) => (
                      <li
                        key={strategy.id}
                        className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-ground)] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[0.9rem] font-semibold">{strategy.label}</p>
                          <StatusPill strategy={strategy} />
                        </div>
                        <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
                          &ldquo;{strategy.view}&rdquo;
                        </p>
                        <dl className="data mt-3 flex gap-5 text-[0.75rem] text-[var(--color-ink-faint)]">
                          <div>
                            <dt className="inline">Max loss </dt>
                            <dd className="inline text-[var(--color-ink-muted)]">
                              {strategy.maxLoss} {strategy.collateralSymbol}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline">Max gain </dt>
                            <dd className="inline text-[var(--color-ink-muted)]">
                              {strategy.maxGain ?? 'Unbounded'}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={`/trade?view=${encodeURIComponent(strategy.view)}`}
                            className="cta flex items-center gap-1.5 px-4 py-2.5 text-[0.82rem]"
                          >
                            Copy this view
                            <ChevronRightIcon className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            href={`/battles/new?opponent=${encodeURIComponent(friend)}&strategy=${encodeURIComponent(strategy.id)}`}
                            className="ghost px-4 py-2.5 text-[0.82rem]"
                          >
                            Challenge
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-center text-[0.72rem] leading-relaxed text-[var(--color-ink-faint)]">
        Copying fills in your friend&rsquo;s view, not their contract. The agent prices it against
        the live book for your own budget, and you approve the maximum loss. Their position is
        theirs and yours is yours — no money is pooled.
      </p>
    </div>
  );
}

function StatusPill({ strategy }: { strategy: ExecutedStrategy }) {
  const live = Boolean(strategy.txHash);
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[0.66rem] font-medium ${
        live
          ? 'border-[var(--color-gain)]/30 text-[var(--color-gain)]'
          : 'border-[var(--color-hairline-bright)] text-[var(--color-ink-faint)]'
      }`}
    >
      {live ? 'On-chain' : 'Simulated'}
    </span>
  );
}
