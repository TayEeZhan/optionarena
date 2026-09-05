'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/**
 * The moment a battle lands.
 *
 * Shown once per battle per browser. A result is news the first time and an
 * ambush every time after, so the fact that it has been seen is remembered in
 * `localStorage` and the overlay stays out of the way on later visits.
 *
 * Only a participant sees it. Watching two other people's contest settle is
 * neither a victory nor a defeat, and saying otherwise would be silly.
 */
export type BattleOutcome = 'won' | 'lost' | 'drew';

const COPY: Record<BattleOutcome, { title: string; line: string; tone: string }> = {
  won: {
    title: 'Victory',
    line: 'Your strategy came out ahead at settlement.',
    tone: 'text-[var(--color-gain)]',
  },
  lost: {
    title: 'K.O.',
    line: 'Theirs came out ahead at settlement.',
    tone: 'text-[var(--color-loss)]',
  },
  drew: {
    title: 'Draw',
    line: 'Both strategies settled at the same result.',
    tone: 'text-[var(--color-ink)]',
  },
};

/** Nothing changes this during a visit, so there is nothing to subscribe to. */
const noSubscribe = () => () => {};

export function BattleResultOverlay({
  battleId,
  outcome,
}: {
  battleId: string;
  outcome: BattleOutcome;
}) {
  const key = `optionarena_battle_seen_${battleId}`;

  const readSeen = useCallback(() => {
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      // Private browsing can refuse storage. Showing it once per visit is a
      // better failure than never showing it at all.
      return false;
    }
  }, [key]);

  // The server has no way to know whether this browser has seen the result, so
  // it renders as already seen. That way the overlay only ever appears after
  // hydration, and never flashes on a page that should not show it.
  const seen = useSyncExternalStore(noSubscribe, readSeen, () => true);

  const [dismissed, setDismissed] = useState(false);
  const open = !seen && !dismissed;

  useEffect(() => {
    if (seen) return;
    try {
      localStorage.setItem(key, '1');
    } catch {
      // As above: not being able to remember is survivable.
    }
  }, [key, seen]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        setDismissed(true);
      }
    };

    window.addEventListener('keydown', onKey);
    const timer = setTimeout(() => setDismissed(true), 4200);

    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, [open]);

  // Removed from the tree rather than hidden, so a dismissed overlay can never
  // sit invisibly over the page swallowing clicks.
  if (!open) return null;

  const { title, line, tone } = COPY[outcome];

  return (
    <div
      role="alertdialog"
      aria-label={title}
      onClick={() => setDismissed(true)}
      className="animate-fade-in fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-[var(--color-ground)]/85 px-6 backdrop-blur-sm"
    >
      <div className="text-center">
        <p
          className={`animate-slam display text-[4.5rem] leading-none font-extrabold sm:text-[6rem] ${tone}`}
        >
          {title}
        </p>
        <p className="mt-4 text-[0.9rem] leading-relaxed text-[var(--color-ink-muted)]">{line}</p>
        <p className="mt-6 text-[0.72rem] text-[var(--color-ink-faint)]">
          Bragging rights only. Nothing was staked.
        </p>
      </div>
    </div>
  );
}
