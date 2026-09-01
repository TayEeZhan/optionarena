import { BitcoinMark, ChevronRightIcon, EthereumMark } from './Icons';
import type { MappedSignal } from '@/lib/signals/map';
import type { RankedSignal, WinningCriterion } from '@/lib/signals/types';

export function signalValue(signal: RankedSignal, criterion: WinningCriterion): string {
  switch (criterion) {
    case 'inProfit':
      return `+${(signal.score * 100).toFixed(1)}%`;
    case 'bigMoney':
      return `$${Math.round(signal.score).toLocaleString('en-US')}`;
    case 'cheapVolatility':
      return `${signal.iv?.toFixed(0) ?? '—'}% IV`;
    case 'crowdFavourite':
      return `${signal.amount.toLocaleString('en-US')} contracts`;
  }
}

export function instrumentLabel(signal: RankedSignal): string {
  return `${signal.underlying} ${signal.isCall ? 'Call' : 'Put'}`;
}

export function AssetMark({
  signal,
  className = '',
}: {
  signal: RankedSignal;
  className?: string;
}) {
  return signal.underlying === 'BTC' ? (
    <BitcoinMark className={className} />
  ) : (
    <EthereumMark className={className} />
  );
}

export function MappingBadge({ mapped }: { mapped: MappedSignal }) {
  const label = mapped.exact ? 'Exact match' : mapped.instrument ? 'Near match' : 'Unavailable';
  const tone = mapped.exact
    ? 'border-[var(--color-accent)]/70 text-[var(--color-accent)]'
    : mapped.instrument
      ? 'border-[var(--color-hairline-bright)] text-[var(--color-ink-muted)]'
      : 'border-[var(--color-hairline-bright)] text-[var(--color-ink-faint)]';

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-medium ${tone}`}>
      {label}
    </span>
  );
}

export function CompactSignalRow({
  mapped,
  rank,
  criterion,
}: {
  mapped: MappedSignal;
  rank: number;
  criterion: WinningCriterion;
}) {
  const signal = mapped.signal;

  return (
    <li className="grid min-h-17 grid-cols-[1.7rem_2rem_minmax(0,1fr)_auto_1.1rem] items-center gap-2.5 border-b border-[var(--color-hairline)] px-4 py-3.5 last:border-0 sm:gap-3">
      <span className="data text-[0.82rem] text-[var(--color-ink-muted)]">#{rank}</span>
      <AssetMark signal={signal} className="h-8 w-8 text-[0.72rem]" />
      <span className="min-w-0">
        <span className="block truncate text-[0.9rem] font-semibold">
          {instrumentLabel(signal)}
        </span>
        <span className="mt-1 block sm:hidden">
          <MappingBadge mapped={mapped} />
        </span>
      </span>
      <span className="flex items-center gap-2.5">
        <span className="data text-[0.8rem] font-medium text-[var(--color-gain)] sm:text-[0.9rem]">
          {signalValue(signal, criterion)}
        </span>
        <span className="hidden sm:block">
          <MappingBadge mapped={mapped} />
        </span>
      </span>
      <ChevronRightIcon className="h-4 w-4 text-[var(--color-ink-faint)]" />
    </li>
  );
}
