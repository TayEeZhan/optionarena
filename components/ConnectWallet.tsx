'use client';

import { useWallet } from './WalletProvider';

/** `0xD360…99E9c` — enough to recognise, short enough for a header. */
function short(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-5)}`;
}

/**
 * Connect your own wallet.
 *
 * Four states, and the third matters most: connected but on the wrong network
 * is the case that quietly costs people money elsewhere, so it is called out in
 * the loss colour with the fix one tap away.
 */
export function ConnectWallet() {
  const { available, account, onBase, connecting, connect, disconnect, ensureBase } = useWallet();

  if (!available) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer noopener"
        className="pill px-3.5 py-2 text-[0.78rem] font-semibold text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]"
      >
        Get a wallet
      </a>
    );
  }

  if (!account) {
    return (
      <button
        type="button"
        onClick={connect}
        disabled={connecting}
        className="pill px-3.5 py-2 text-[0.78rem] font-semibold text-[var(--color-ink)] hover:border-[var(--color-accent)]/50 disabled:opacity-50"
      >
        {connecting ? 'Check your wallet…' : 'Connect wallet'}
      </button>
    );
  }

  if (!onBase) {
    return (
      <button
        type="button"
        onClick={ensureBase}
        className="rounded-full border border-[var(--color-loss)]/50 px-3.5 py-2 text-[0.78rem] font-semibold text-[var(--color-loss)]"
      >
        Switch to Base
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={disconnect}
      title={`${account} — click to disconnect`}
      className="data pill px-3.5 py-2 text-[0.76rem] font-semibold text-[var(--color-accent)] hover:text-[var(--color-ink)]"
    >
      {short(account)}
    </button>
  );
}
