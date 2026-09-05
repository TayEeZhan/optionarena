'use client';

import { useEffect, useState } from 'react';
import { useMode } from './ModeProvider';
import { useWallet } from './WalletProvider';

/**
 * What you have to spend, in whichever mode you are in and whoever's wallet it is.
 *
 * A client component for two reasons: the mode lives in the browser, and so does
 * the connected wallet. It began as server-rendered markup with a hardcoded
 * figure, which meant switching to Live left "simulated balance, no signature"
 * on screen while the app was set up to sign for real.
 *
 * Live then reported the **server's** wallet even when a visitor had connected
 * their own, under the heading "Wallet balance" — wrong in the direction that
 * matters. The precedence is now explicit and the label always says whose money
 * it is:
 *
 *   connected wallet  ->  theirs, read in the browser
 *   server key only   ->  ours, and named as ours
 *   neither           ->  a dash and the reason
 */
export function BalanceCard({
  demoDisplay,
  demoSpent,
  wallet,
  token,
}: {
  demoDisplay: string;
  /** Whether anything has been spent yet, so the note stays quiet if not. */
  demoSpent: boolean;
  /** The server's own wallet, when it has a key. Never described as yours. */
  wallet: { display: string; symbol: string; address: string } | null;
  /** The token the USDC side of the book settles in, for reading any balance. */
  token: { address: string; decimals: number; symbol: string } | null;
}) {
  const { mode } = useMode();
  const { account, onBase, readBalance } = useWallet();
  // Stored with the account it belongs to. Switching accounts in MetaMask
  // would otherwise show the previous one's balance under the new address for
  // as long as the next read takes.
  const [read, setRead] = useState<{ account: string; display: string | null } | null>(null);

  const live = mode === 'live';
  const connected = Boolean(account && onBase);

  useEffect(() => {
    if (!connected || !token || !account) return;

    let current = true;
    readBalance(token.address, token.decimals).then((display) => {
      if (current) setRead({ account, display });
    });

    return () => {
      current = false;
    };
  }, [connected, token, account, readBalance]);

  const mine = read && read.account === account ? read.display : null;
  const symbol = token?.symbol ?? wallet?.symbol ?? 'aBasUSDC';
  const figure = connected ? (mine ?? '—') : (wallet?.display ?? '—');

  return (
    <section
      className={`panel p-6 sm:p-8 ${live ? 'border-[var(--color-loss)]/35' : ''}`}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">
          {!live ? 'Demo balance' : connected ? 'Your wallet' : 'Our server wallet'}
        </p>
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
          {live ? figure : demoDisplay}
        </span>
        <span className="text-[0.95rem] text-[var(--color-ink-muted)]">
          {live ? symbol : 'USDC'}
        </span>
      </p>

      {live ? (
        <LiveNote
          connected={connected}
          account={account}
          mine={mine}
          wallet={wallet}
          symbol={symbol}
        />
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

function LiveNote({
  connected,
  account,
  mine,
  wallet,
  symbol,
}: {
  connected: boolean;
  account: string | null;
  mine: string | null;
  wallet: { display: string; symbol: string; address: string } | null;
  symbol: string;
}) {
  if (connected) {
    return (
      <>
        <p className="mt-3 text-[0.82rem] leading-relaxed text-[var(--color-ink-muted)]">
          {mine === null
            ? 'Your wallet is connected, but the balance could not be read just now.'
            : `Your own ${symbol} on Base. You sign, and the funds stay yours.`}
        </p>
        <p className="data mt-2 text-[0.7rem] break-all text-[var(--color-ink-faint)]">{account}</p>
        <p className="mt-2 text-[0.72rem] leading-relaxed text-[var(--color-ink-faint)]">
          Plain USDC cannot fill — it has to be supplied to Aave on Base first.
        </p>
      </>
    );
  }

  if (wallet) {
    return (
      <>
        <p className="mt-3 text-[0.82rem] leading-relaxed text-[var(--color-ink-muted)]">
          This is the shared wallet this demo signs from — not yours. Connect your own to trade with
          your own funds.
        </p>
        <p className="data mt-2 text-[0.7rem] break-all text-[var(--color-ink-faint)]">
          {wallet.address}
        </p>
      </>
    );
  }

  return (
    <p className="mt-3 text-[0.82rem] leading-relaxed text-[var(--color-ink-muted)]">
      No wallet connected and no signing key on this server, so there is no balance to report.
    </p>
  );
}
