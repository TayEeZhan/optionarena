'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Persistent left sidebar with a track-record card pinned to the bottom,
 * following the pinned visual direction.
 */

const NAV = [
  { href: '/', label: 'Overview', hint: 'Build a strategy' },
  { href: '/feed', label: 'Strategy feed', hint: 'What others traded' },
  { href: '/leaderboard', label: 'Leaderboard', hint: 'Risk-adjusted' },
  { href: '/profile', label: 'My profile', hint: 'Your history' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--color-hairline)] bg-[var(--color-surface)]">
      <div className="px-6 pt-7 pb-8">
        <Link href="/" className="flex items-baseline gap-[2px]">
          <span className="display text-[1.35rem] font-bold">Option</span>
          <span className="display text-[1.35rem] font-bold text-[var(--color-lime)]">Arena</span>
        </Link>
        <p className="eyebrow mt-2">Base mainnet</p>
      </div>

      <nav className="flex-1 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-1 block rounded-xl px-3 py-2.5 transition-colors ${
                active
                  ? 'bg-[var(--color-surface-high)] text-[var(--color-ink)]'
                  : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-high)]/50 hover:text-[var(--color-ink)]'
              }`}
            >
              <span className="flex items-center gap-2 text-[0.9rem] font-medium">
                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-lime)]" aria-hidden />
                )}
                <span className={active ? '' : 'pl-[14px]'}>{item.label}</span>
              </span>
              <span className="mt-0.5 block pl-[14px] text-[0.7rem] text-[var(--color-ink-faint)]">
                {item.hint}
              </span>
            </Link>
          );
        })}
      </nav>

      <TrackRecordCard />
    </aside>
  );
}

/** Track record, pinned to the bottom of the sidebar. */
function TrackRecordCard() {
  return (
    <div className="m-3 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface-high)] p-4">
      <p className="eyebrow">Track record</p>
      <p className="data mt-2 text-2xl font-medium text-[var(--color-ink)]">0 trades</p>
      <p className="mt-1 text-[0.75rem] leading-relaxed text-[var(--color-ink-faint)]">
        Your executed strategies appear here with their transaction hashes.
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--color-hairline)]">
        <div className="h-full w-0 bg-[var(--color-lime)]" />
      </div>
    </div>
  );
}
