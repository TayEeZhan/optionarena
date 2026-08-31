'use client';

import { usePathname } from 'next/navigation';
import { useMode } from './ModeProvider';

const CRUMBS: Record<string, string> = {
  '/': 'Overview',
  '/feed': 'Strategy feed',
  '/leaderboard': 'Leaderboard',
  '/profile': 'My profile',
};

export function TopBar() {
  const pathname = usePathname();
  const { mode, setMode, liveAvailable } = useMode();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--color-hairline)] px-8">
      <div className="flex items-center gap-2">
        <span className="eyebrow">OptionArena</span>
        <span className="text-[var(--color-ink-faint)]">/</span>
        <span className="text-[0.85rem] text-[var(--color-ink-muted)]">
          {CRUMBS[pathname] ?? 'Overview'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {!liveAvailable && (
          <span className="eyebrow text-[var(--color-ink-faint)]">No signing key on server</span>
        )}

        <div
          className="flex items-center gap-1 rounded-full border border-[var(--color-hairline-bright)] bg-[var(--color-surface)] p-1"
          role="group"
          aria-label="Trading mode"
        >
          <ModeButton
            active={mode === 'demo'}
            onClick={() => setMode('demo')}
            tone="neutral"
            label="Demo"
            title="Simulated. No money moves."
          />
          <ModeButton
            active={mode === 'live'}
            onClick={() => setMode('live')}
            tone="live"
            label="Live"
            disabled={!liveAvailable}
            title={
              liveAvailable
                ? 'Real money on Base mainnet.'
                : 'Unavailable: the server has no signing key.'
            }
          />
        </div>
      </div>
    </header>
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
  const base = 'rounded-full px-3 py-1 text-[0.75rem] font-medium transition-colors';

  const className = active
    ? tone === 'live'
      ? `${base} bg-[var(--color-loss)] text-[#1a0a08]`
      : `${base} bg-[var(--color-surface-high)] text-[var(--color-ink)]`
    : `${base} text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${className} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      {active && tone === 'live' ? `● ${label}` : label}
    </button>
  );
}
