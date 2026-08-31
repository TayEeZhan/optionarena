'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMode } from './ModeProvider';

/**
 * Navigation, mobile-first.
 *
 * On a phone the destinations live in a fixed bottom bar, within thumb reach,
 * and the header carries only the wordmark and the mode switch. From `md` up
 * the same destinations move inline into the header and the bottom bar
 * disappears.
 *
 * The mode switch is in the header at every size, because a user must never be
 * unsure whether real money is about to move.
 */

const NAV = [
  { href: '/', label: 'Trade' },
  { href: '/feed', label: 'Feed' },
  { href: '/leaderboard', label: 'Board' },
  { href: '/profile', label: 'You' },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function Header() {
  const pathname = usePathname();
  const { liveAvailable } = useMode();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-hairline)] bg-[var(--color-ground)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Link href="/" className="flex items-baseline gap-[1px]">
          <span className="display text-[1.4rem] font-extrabold">Option</span>
          <span className="display text-[1.4rem] font-extrabold text-[var(--color-accent)]">
            Arena
          </span>
        </Link>

        <nav className="hidden md:flex md:items-center md:gap-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-full px-4 py-2 text-[0.9rem] font-medium transition-colors ${
                  active
                    ? 'bg-[var(--color-surface-high)] text-[var(--color-ink)]'
                    : 'text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <ModeSwitch />
      </div>

      {/*
       * Why live is unavailable, at every width.
       *
       * This used to sit beside the mode switch, where it had to be hidden on
       * phones for space — which left a greyed-out Live button with no visible
       * reason and no hover to explain it. The reason is part of the custody
       * honesty, so it gets its own line rather than competing for the header.
       */}
      {!liveAvailable && (
        <p className="border-t border-[var(--color-hairline)] bg-[var(--color-surface)] px-5 py-2 text-center text-[0.75rem] leading-relaxed text-[var(--color-ink-muted)]">
          No signing key on this server, so this is demo mode only. The prices and the maximum loss
          are real; nothing can be signed.
        </p>
      )}
    </header>
  );
}

/**
 * Demo or live.
 *
 * Live is drawn in the loss colour rather than the accent. Spending real money
 * is not a brand moment, and the accent must never be the thing that tells you
 * money is at stake.
 */
function ModeSwitch() {
  const { mode, setMode, liveAvailable } = useMode();

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-[var(--color-hairline-bright)] bg-[var(--color-surface)] p-1"
      role="group"
      aria-label="Trading mode"
    >
      <ModeButton
        active={mode === 'demo'}
        onClick={() => setMode('demo')}
        label="Demo"
        tone="neutral"
        title="Simulated. Real prices, no signature, no money moves."
      />
      <ModeButton
        active={mode === 'live'}
        onClick={() => setMode('live')}
        label="Live"
        tone="live"
        disabled={!liveAvailable}
        title={
          liveAvailable
            ? 'Real money on Base mainnet.'
            : 'Unavailable: the server has no signing key.'
        }
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  tone,
  disabled,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: 'neutral' | 'live';
  disabled?: boolean;
  title: string;
}) {
  const base = 'rounded-full px-3.5 py-1.5 text-[0.8rem] font-semibold transition-colors';

  const className = active
    ? tone === 'live'
      ? `${base} bg-[var(--color-loss)] text-[#1a0a0a]`
      : `${base} bg-[var(--color-surface-high)] text-[var(--color-ink)]`
    : `${base} text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`${className} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      {label}
    </button>
  );
}

/** The bottom bar. Phone only; `md` and up uses the header nav instead. */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-hairline)] bg-[var(--color-ground)]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="flex items-stretch">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center gap-1.5 py-3"
              >
                <span
                  aria-hidden
                  className={`h-1 w-1 rounded-full transition-colors ${
                    active ? 'bg-[var(--color-accent)]' : 'bg-transparent'
                  }`}
                />
                <span
                  className={`text-[0.78rem] font-medium transition-colors ${
                    active ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-faint)]'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
