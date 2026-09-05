'use client';

import { useMode } from './ModeProvider';

/**
 * What you have to spend, in whichever mode you are in.
 *
 * A client component for one reason: the mode lives in the browser, and a card
 * that reports a balance has to change when the mode does. This was
 * server-rendered markup with a hardcoded figure before, so switching to Live
 * left the words "simulated balance, no signature" on screen while the app was
 * configured to sign for real — the first screen anyone opens, saying the wrong
 * thing at the one moment it mattered.
 *
 * Demo shows an allowance that moves as strategies are built. Live shows what
 * the signing wallet actually holds, or admits it cannot tell.
 */
export function BalanceCard({
  demoDisplay,
  demoSpent,
  wallet,
}: {
  demoDisplay: string;
  /** Whether anything has been spent yet, so the note stays quiet if not. */
  demoSpent: boolean;
  wallet: { display: string; symbol: string; address: string } | null;
}) {
  const { mode } = useMode();
  const live = mode === 'live';

  return (
    <section
      className={`panel p-6 sm:p-8 ${live ? 'border-[var(--color-loss)]/35' : ''}`}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{live ? 'Wallet balance' : 'Demo balance'}</p>
        <span
          className={`pill px-3 py-1 text-[0.7rem] font-semibold ${
            live ? 'text-[var(--color-loss)]' : 'text-[var(--color-accent)]'
          }`}
        >
          {live ? 'LIVE' : 'DEMO'}
        </span>
      </div>

      <p className="data mt-6 flex flex-wrap items-baseline gap-2">
        <span className="text-[2.8rem] leading-none font-semibold tracking-[-0.05em] sm:text-[3.4rem]">
          {live ? (wallet?.display ?? '—') : demoDisplay}
        </span>
        <span className="text-[0.95rem] text-[var(--color-ink-muted)]">
          {live ? (wallet?.symbol ?? 'aBasUSDC') : 'USDC'}
        </span>
      </p>

      {live ? (
        wallet ? (
          <>
            <p className="mt-3 text-[0.82rem] leading-relaxed text-[var(--color-ink-muted)]">
              Real money on Base. This is the server wallet that signs, not yours.
            </p>
            <p className="data mt-2 text-[0.7rem] break-all text-[var(--color-ink-faint)]">
              {wallet.address}
            </p>
          </>
        ) : (
          <p className="mt-3 text-[0.82rem] leading-relaxed text-[var(--color-ink-muted)]">
            The wallet balance could not be read just now.
          </p>
        )
      ) : (
        <p className="mt-3 text-[0.82rem] leading-relaxed text-[var(--color-ink-faint)]">
          {demoSpent
            ? 'A simulated allowance, reduced by what your strategies would have cost. Real prices, no signature.'
            : 'A simulated allowance to build against. Real prices, no signature.'}
        </p>
      )}
    </section>
  );
}
