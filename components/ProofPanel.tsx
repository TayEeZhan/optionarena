'use client';

import { useState } from 'react';
import type { ExecuteResponse, WireQuote } from '@/lib/wire';

/**
 * Step 03: the proof.
 *
 * This is the emotional peak of the demo, so it is designed as the payoff
 * rather than as a receipt. The hash is the largest thing on the screen, it is
 * selectable, and the explorer link sits directly under it.
 *
 * This is also the only place in the product that animates. Everything else is
 * still, so the one moment that moves is the moment the fill lands.
 *
 * A simulated run gets the same layout with the hash replaced by an honest
 * statement that nothing was signed.
 */
export function ProofPanel({
  execution,
  quote,
  onStartOver,
}: {
  execution: ExecuteResponse;
  quote: WireQuote;
  onStartOver: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyHash() {
    if (!execution.txHash) return;
    try {
      await navigator.clipboard.writeText(execution.txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused. The hash is on screen either way.
    }
  }

  return (
    <div className="animate-land card overflow-hidden">
      <div
        className={`border-b px-6 py-7 sm:px-8 ${
          execution.live
            ? 'border-[var(--color-gain)]/25 bg-[var(--color-gain)]/[0.07]'
            : 'border-[var(--color-hairline)] bg-[var(--color-surface-high)]'
        }`}
      >
        <p className="eyebrow">{execution.live ? 'On-chain' : 'Simulated'}</p>
        <h2 className="display mt-2.5 text-[2.4rem] font-extrabold sm:text-[3rem]">
          {execution.live ? 'Filled on Base.' : 'Simulated.'}
        </h2>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--color-ink-muted)]">
          {execution.live
            ? 'The position is on-chain. Anyone can verify it.'
            : 'Nothing was signed and no money moved. This is what the live path would have done.'}
        </p>
      </div>

      <div className="px-6 py-7 sm:px-8">
        {execution.live && execution.txHash ? (
          <>
            <p className="eyebrow">Transaction hash</p>
            <p className="animate-hash data mt-3 text-[0.95rem] leading-relaxed break-all text-[var(--color-accent-bright)] select-all sm:text-[1.1rem]">
              {execution.txHash}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={execution.explorerUrl ?? '#'}
                target="_blank"
                rel="noreferrer noopener"
                className="cta px-6 py-3.5 text-center text-[0.9rem]"
              >
                View on Basescan
              </a>
              <button type="button" onClick={copyHash} className="ghost px-6 py-3.5 text-[0.9rem]">
                {copied ? 'Copied' : 'Copy hash'}
              </button>
            </div>

            <dl className="mt-8 grid gap-x-8 text-[0.85rem] sm:grid-cols-2">
              <Row label="Block" value={String(execution.blockNumber ?? '-')} />
              <Row label="Gas used" value={execution.gasUsed ?? '-'} />
              <Row label="Spent" value={execution.spentDisplay} />
              <Row label="Maximum loss" value={quote.maxLossDisplay} />
            </dl>
          </>
        ) : (
          <>
            <p className="eyebrow">What would have happened</p>
            <dl className="mt-3 grid gap-x-8 text-[0.85rem] sm:grid-cols-2">
              <Row label="Contract" value={quote.label} />
              <Row label="Spend" value={execution.spentDisplay} />
              <Row label="Maximum loss" value={quote.maxLossDisplay} />
              <Row label="Maximum gain" value={quote.maxGainDisplay ?? 'Unbounded'} />
            </dl>
            <p className="mt-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface-high)] px-5 py-4 text-[0.85rem] leading-relaxed text-[var(--color-ink-muted)]">
              These are real prices from the live book. The only thing that did not happen is the
              signature. Switch to Live in the header to place it for real.
            </p>
          </>
        )}

        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--color-hairline)] pt-7 sm:flex-row">
          <button type="button" onClick={onStartOver} className="cta px-6 py-3.5 text-[0.9rem]">
            Build another strategy
          </button>
          <a href="/feed" className="ghost px-6 py-3.5 text-center text-[0.9rem]">
            See it in the feed
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--color-hairline)] py-2.5">
      <dt className="text-[var(--color-ink-faint)]">{label}</dt>
      <dd className="data text-right break-all text-[var(--color-ink-muted)]">{value}</dd>
    </div>
  );
}
