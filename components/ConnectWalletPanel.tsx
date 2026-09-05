'use client';

import { useWallet } from './WalletProvider';

/**
 * Connect a wallet, on the page where people sign in.
 *
 * The header pill is fine once you know what it is, but it is a truncated
 * address in a corner — not somewhere anyone would look to get started. This is
 * the full version, beside Google and the handle.
 *
 * It is careful about one thing: a wallet is **not** a login here. Google or a
 * handle is what names you to friends; a wallet is what signs your trades. They
 * are separate, and a page offering all three has to say so, or people will
 * reasonably assume connecting is how you sign in.
 */
export function ConnectWalletPanel() {
  const { available, account, onBase, connecting, error, connect, disconnect, ensureBase } =
    useWallet();

  return (
    <div className="mt-7 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.85rem] font-semibold">Trade with your own wallet</p>
        {account && (
          <span
            className={`pill px-2.5 py-1 text-[0.66rem] font-semibold ${
              onBase ? 'text-[var(--color-accent)]' : 'text-[var(--color-loss)]'
            }`}
          >
            {onBase ? 'BASE' : 'WRONG NETWORK'}
          </span>
        )}
      </div>

      <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
        Optional, and separate from signing in. Your handle is what friends see; a connected wallet
        is what signs your trades, so the money stays yours instead of going through our shared demo
        wallet.
      </p>

      {!available && (
        <>
          <p className="mt-4 text-[0.78rem] leading-relaxed text-[var(--color-ink-faint)]">
            No wallet detected in this browser. MetaMask is the usual one, and Rabby, the Coinbase
            extension and Phantom all work here too. Install one and reload this page.
          </p>
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noreferrer noopener"
            className="ghost mt-4 block px-5 py-3 text-center text-[0.88rem]"
          >
            Install MetaMask
          </a>
        </>
      )}

      {available && !account && (
        <button
          type="button"
          onClick={connect}
          disabled={connecting}
          className="cta mt-4 min-h-12 w-full px-5 text-[0.9rem] disabled:opacity-50"
        >
          {connecting ? 'Check your wallet…' : 'Connect wallet'}
        </button>
      )}

      {account && (
        <>
          <p className="data mt-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-ground)] px-4 py-3 text-[0.75rem] break-all text-[var(--color-ink-muted)]">
            {account}
          </p>

          {!onBase && (
            <button
              type="button"
              onClick={ensureBase}
              className="mt-3 min-h-12 w-full rounded-2xl border border-[var(--color-loss)]/50 px-5 text-[0.88rem] font-semibold text-[var(--color-loss)]"
            >
              Switch to Base
            </button>
          )}

          <button
            type="button"
            onClick={disconnect}
            className="mt-3 w-full py-2 text-[0.78rem] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]"
          >
            Disconnect this wallet
          </button>
        </>
      )}

      {error && <p className="mt-3 text-[0.78rem] text-[var(--color-loss)]">{error}</p>}
    </div>
  );
}
