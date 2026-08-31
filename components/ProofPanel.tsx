'use client';

import { useState } from 'react';
import type { ExecuteResponse, WireQuote } from '@/lib/wire';

/**
 * Step 03: the proof.
 *
 * The brief calls this the emotional peak of the demo and asks for it to be
 * designed as the payoff rather than as a receipt. So the hash is the largest
 * thing on the screen, it is selectable, and the explorer link sits directly
 * under it. A simulated run gets the same layout with the hash replaced by an
 * honest statement that nothing was signed.
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
    <div className="card overflow-hidden">
      <div
        className={`border-b px-6 py-5 ${
          execution.live
            ? 'border-[var(--color-lime)]/25 bg-[var(--color-lime)]/6'
            : 'border-[var(--color-hairline)] bg-[var(--color-surface-high)]'
        }`}
      >
        <p className="eyebrow">Step 03</p>
        <h2 className="display mt-2 text-4xl font-semibold">
          {execution.live ? 'Filled on Base.' : 'Simulated.'}
        </h2>
        <p className="mt-2 text-[0.9rem] text-[var(--color-ink-muted)]">
          {execution.live
            ? 'The position is on-chain. Anyone can verify it.'
            : 'Nothing was signed and no money moved. This is what the live path would have done.'}
        </p>
      </div>

      <div className="px-6 py-7">
        {execution.live && execution.txHash ? (
          <>
            <p className="eyebrow">Transaction hash</p>
            <p className="data mt-3 text-[1.05rem] leading-relaxed break-all text-[var(--color-lime)] select-all">
              {execution.txHash}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={execution.explorerUrl ?? '#'}
                target="_blank"
                rel="noreferrer noopener"
                className="cta px-5 py-2.5 text-[0.85rem]"
              >
                View on Basescan
              </a>
              <button
                type="button"
                onClick={copyHash}
                className="rounded-[0.875rem] border border-[var(--color-hairline-bright)] px-5 py-2.5 text-[0.85rem] text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
              >
                {copied ? 'Copied' : 'Copy hash'}
              </button>
            </div>

            <dl className="mt-7 grid gap-x-6 gap-y-2 text-[0.8rem] sm:grid-cols-2">
              <Row label="Block" value={String(execution.blockNumber ?? '-')} />
              <Row label="Gas used" value={execution.gasUsed ?? '-'} />
              <Row label="Spent" value={execution.spentDisplay} />
              <Row label="Maximum loss" value={quote.maxLossDisplay} />
            </dl>
          </>
        ) : (
          <>
            <p className="eyebrow">What would have happened</p>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-[0.85rem] sm:grid-cols-2">
              <Row label="Contract" value={quote.label} />
              <Row label="Spend" value={execution.spentDisplay} />
              <Row label="Maximum loss" value={quote.maxLossDisplay} />
              <Row label="Maximum gain" value={quote.maxGainDisplay ?? 'Unbounded'} />
            </dl>
            <p className="mt-6 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface-high)] px-4 py-3 text-[0.8rem] leading-relaxed text-[var(--color-ink-muted)]">
              These are real prices from the live book. The only thing that did not happen is the
              signature. Switch to Live in the top bar to place it for real.
            </p>
          </>
        )}

        <div className="mt-8 flex flex-wrap gap-3 border-t border-[var(--color-hairline)] pt-6">
          <button type="button" onClick={onStartOver} className="cta px-5 py-2.5 text-[0.85rem]">
            Build another strategy
          </button>
          <a
            href="/feed"
            className="rounded-[0.875rem] border border-[var(--color-hairline-bright)] px-5 py-2.5 text-[0.85rem] text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            See it in the feed
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--color-hairline)] py-1.5">
      <dt className="text-[var(--color-ink-faint)]">{label}</dt>
      <dd className="data text-right break-all text-[var(--color-ink-muted)]">{value}</dd>
    </div>
  );
}
