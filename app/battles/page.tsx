import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRightIcon } from '@/components/Icons';
import { getHandle } from '@/lib/auth/session';
import { getSocialStore, type Battle } from '@/lib/social/store';

export const dynamic = 'force-dynamic';

/**
 * What to say about a battle in one line.
 *
 * Kept out of the component body because it reads the clock, and a component
 * body has to stay pure for the React compiler.
 */
function outcomeLabel(battle: Battle, me: string): string {
  if (battle.winner) {
    if (battle.winner === 'draw') return 'Draw';
    return battle.winner === me ? 'You won' : `@${battle.winner} won`;
  }

  const now = Math.floor(Date.now() / 1000);
  if (now >= battle.resolvesAt) return 'Ready to settle';

  const on = new Date(battle.resolvesAt * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return `Resolves ${on}`;
}

interface Standing {
  handle: string;
  won: number;
  lost: number;
  drawn: number;
}

/**
 * The friends table, from settled battles only.
 *
 * Running battles are deliberately excluded. Counting them would mean deciding
 * who is ahead in a contest that has no result yet, which is the one thing this
 * feature must not do.
 */
function standingsFrom(battles: Battle[]): Standing[] {
  const table = new Map<string, Standing>();

  const seat = (handle: string): Standing => {
    const row = table.get(handle) ?? { handle, won: 0, lost: 0, drawn: 0 };
    table.set(handle, row);
    return row;
  };

  for (const battle of battles) {
    if (!battle.winner) continue;

    const challenger = seat(battle.challenger);
    const opponent = seat(battle.opponent);

    if (battle.winner === 'draw') {
      challenger.drawn += 1;
      opponent.drawn += 1;
      continue;
    }

    const winner = battle.winner === battle.challenger ? challenger : opponent;
    const loser = battle.winner === battle.challenger ? opponent : challenger;
    winner.won += 1;
    loser.lost += 1;
  }

  return [...table.values()].sort((a, b) => b.won - a.won || a.lost - b.lost);
}

/** Battles this person is in. Bragging rights only; nothing is staked. */
export default async function BattlesPage() {
  const me = await getHandle();
  if (!me) redirect('/join');

  const battles = await getSocialStore().battlesFor(me);
  const standings = standingsFrom(battles);

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow">Bragging rights only</p>
      <h1 className="display mt-2 text-[2.55rem] font-extrabold">Battles</h1>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--color-ink-muted)]">
        Your strategies against your friends&rsquo;. Each one settles when the options expire,
        against the price Deribit published.
      </p>

      {standings.length > 0 && (
        <section className="panel mt-7 p-5">
          <p className="eyebrow">Standings</p>
          <ol className="mt-3 space-y-2">
            {standings.map((row, index) => (
              <li
                key={row.handle}
                className="flex items-center justify-between gap-3 border-b border-[var(--color-hairline)] pb-2 text-[0.85rem] last:border-0 last:pb-0"
              >
                <span className="data min-w-0 truncate">
                  <span className="text-[var(--color-ink-faint)]">#{index + 1}</span>{' '}
                  <span className={row.handle === me ? 'text-[var(--color-accent)]' : ''}>
                    @{row.handle}
                  </span>
                </span>
                <span className="data shrink-0 text-[var(--color-ink-muted)]">
                  {row.won}W {row.lost}L{row.drawn > 0 ? ` ${row.drawn}D` : ''}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[0.72rem] leading-relaxed text-[var(--color-ink-faint)]">
            Settled battles only. A battle that has not reached expiry has no result, so it is not
            counted here.
          </p>
        </section>
      )}

      {battles.length === 0 ? (
        <div className="panel mt-7 p-8 text-center">
          <p className="text-[0.9rem] text-[var(--color-ink-muted)]">No battles yet.</p>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--color-ink-faint)]">
            Open a friend&rsquo;s strategy and press Challenge to start one.
          </p>
          <Link href="/friends" className="cta mt-5 inline-flex px-5 py-3 text-[0.88rem]">
            Go to friends
          </Link>
        </div>
      ) : (
        <ul className="panel mt-7 overflow-hidden">
          {battles.map((battle) => {
            const other = battle.challenger === me ? battle.opponent : battle.challenger;
            const outcome = outcomeLabel(battle, me);

            return (
              <li key={battle.id} className="border-b border-[var(--color-hairline)] last:border-0">
                <Link
                  href={`/battles/${battle.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-[var(--color-surface-high)]"
                >
                  <span className="min-w-0">
                    <span className="data block truncate text-[0.92rem] font-semibold">
                      vs @{other}
                    </span>
                    <span
                      className={`mt-1 block text-[0.75rem] ${
                        battle.winner === me
                          ? 'text-[var(--color-gain)]'
                          : battle.winner && battle.winner !== 'draw'
                            ? 'text-[var(--color-ink-faint)]'
                            : 'text-[var(--color-ink-muted)]'
                      }`}
                    >
                      {outcome}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-[var(--color-ink-faint)]" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
