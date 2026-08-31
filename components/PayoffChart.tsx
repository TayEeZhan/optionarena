'use client';

import type { PayoffPoint } from '@/lib/thetanuts/quote';

/**
 * The payoff diagram.
 *
 * The brief calls this one of the two screens worth making distinctive, so it
 * is drawn rather than charted: the loss region is filled, the profit region is
 * filled in the accent, and the maximum loss is drawn as a hard floor, because
 * that floor is the product's whole promise.
 */
export function PayoffChart({
  payoff,
  breakeven,
  spot,
  strikes,
  maxLossLabel,
  symbol,
}: {
  payoff: PayoffPoint[];
  breakeven: number | null;
  spot: number | null;
  strikes: number[];
  maxLossLabel: string;
  symbol: string;
}) {
  if (payoff.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center text-[0.8rem] text-[var(--color-ink-faint)]">
        No payoff to draw for this contract.
      </div>
    );
  }

  const width = 640;
  const height = 240;
  const padding = { top: 16, right: 16, bottom: 28, left: 16 };

  const prices = payoff.map((p) => p.price);
  const pnls = payoff.map((p) => p.pnl);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minPnl = Math.min(...pnls);
  const maxPnl = Math.max(...pnls);

  // Keep zero inside the range so the floor and the crossing are both visible.
  const lowPnl = Math.min(minPnl, 0);
  const highPnl = Math.max(maxPnl, 0);
  const span = highPnl - lowPnl || 1;

  const x = (price: number) =>
    padding.left +
    ((price - minPrice) / (maxPrice - minPrice || 1)) * (width - padding.left - padding.right);

  const y = (pnl: number) =>
    padding.top + (1 - (pnl - lowPnl) / span) * (height - padding.top - padding.bottom);

  const line = payoff.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.price)} ${y(p.pnl)}`).join(' ');
  const zeroY = y(0);

  // Fill between the curve and zero, split at the breakeven.
  const area = `${line} L ${x(payoff[payoff.length - 1].price)} ${zeroY} L ${x(payoff[0].price)} ${zeroY} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Payoff at expiry"
      >
        <defs>
          <clipPath id="profit-region">
            <rect x="0" y="0" width={width} height={zeroY} />
          </clipPath>
          <clipPath id="loss-region">
            <rect x="0" y={zeroY} width={width} height={height - zeroY} />
          </clipPath>
          <linearGradient id="profit-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-gain)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-gain)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="loss-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-loss)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--color-loss)" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        <path d={area} fill="url(#profit-fill)" clipPath="url(#profit-region)" />
        <path d={area} fill="url(#loss-fill)" clipPath="url(#loss-region)" />

        {/* Break-even axis. */}
        <line
          x1={padding.left}
          y1={zeroY}
          x2={width - padding.right}
          y2={zeroY}
          stroke="var(--color-hairline-bright)"
          strokeWidth="1"
        />

        {/* The maximum loss floor. The number this whole product promises. */}
        {minPnl < 0 && (
          <>
            <line
              x1={padding.left}
              y1={y(minPnl)}
              x2={width - padding.right}
              y2={y(minPnl)}
              stroke="var(--color-loss)"
              strokeWidth="1"
              strokeDasharray="3 4"
              opacity="0.55"
            />
            <text
              x={padding.left + 4}
              y={y(minPnl) - 6}
              className="data"
              fontSize="10"
              fill="var(--color-loss)"
            >
              max loss {maxLossLabel}
            </text>
          </>
        )}

        {/* Strikes. */}
        {strikes.map((strike) =>
          strike >= minPrice && strike <= maxPrice ? (
            <line
              key={strike}
              x1={x(strike)}
              y1={padding.top}
              x2={x(strike)}
              y2={height - padding.bottom}
              stroke="var(--color-hairline-bright)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
          ) : null,
        )}

        {/* Spot. */}
        {spot !== null && spot >= minPrice && spot <= maxPrice && (
          <>
            <line
              x1={x(spot)}
              y1={padding.top}
              x2={x(spot)}
              y2={height - padding.bottom}
              stroke="var(--color-ink-muted)"
              strokeWidth="1"
            />
            <text
              x={x(spot) + 5}
              y={padding.top + 10}
              className="data"
              fontSize="10"
              fill="var(--color-ink-muted)"
            >
              spot
            </text>
          </>
        )}

        {/* Break-even marker. */}
        {breakeven !== null && breakeven >= minPrice && breakeven <= maxPrice && (
          <circle cx={x(breakeven)} cy={zeroY} r="3.5" fill="var(--color-ink)" />
        )}

        <path
          d={line}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Price axis ends. */}
        <text
          x={padding.left}
          y={height - 8}
          className="data"
          fontSize="10"
          fill="var(--color-ink-faint)"
        >
          {Math.round(minPrice).toLocaleString('en-US')}
        </text>
        <text
          x={width - padding.right}
          y={height - 8}
          textAnchor="end"
          className="data"
          fontSize="10"
          fill="var(--color-ink-faint)"
        >
          {Math.round(maxPrice).toLocaleString('en-US')}
        </text>
      </svg>

      <p className="eyebrow mt-1 text-center">
        Profit and loss in {symbol} at expiry, by settlement price
      </p>
    </div>
  );
}
