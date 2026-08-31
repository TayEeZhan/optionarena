/**
 * All token math for OptionArena goes through this file.
 *
 * Why this file exists: the Thetanuts team says builders most often get token
 * decimals wrong, and a mistake here sends a million times too much or too
 * little, with real money, irreversibly.
 *
 * Rules this file enforces:
 *  - Amounts are bigint. Never a JavaScript number.
 *  - Formatting for display happens at the last possible moment.
 *  - Every value that is about to be signed passes an order-of-magnitude check.
 *
 * Decimal conventions on Base, measured against the live book on 31 Aug 2026:
 *  - Strike prices:             8 decimals (Chainlink price feed convention)
 *  - Option price per contract: 8 decimals
 *  - Collateral and premium:    the collateral TOKEN's decimals, which differ
 *                               per order. USDC is 6, WETH is 18, cbBTC is 8.
 *  - Number of contracts:       the same decimals as the collateral token.
 *
 * That last rule is not documented anywhere. It was derived from the identity
 * contracts * price / 1e8 == collateral, which holds exactly on every live
 * order, and it is why a fixed contract-decimals constant is wrong.
 */

/** Fixed protocol-wide conventions. Collateral decimals are NOT in here. */
export const DECIMALS = {
  /** Strike prices, as reported by the Chainlink feed. */
  strike: 8,
  /** Option price per contract. */
  price: 8,
  /** USDC, the most common collateral. Prefer the order's own token decimals. */
  usdc: 6,
} as const;

export type Quantity = keyof typeof DECIMALS;

/**
 * Convert a human value to chain units without floating point error.
 *
 * Uses string parsing rather than multiplication, because 0.1 * 1e6 is not
 * exactly 100000 in IEEE 754 and the difference is real money.
 */
export function toUnits(value: number | string, decimals: number): bigint {
  const text = typeof value === 'number' ? formatNumberExactly(value) : value.trim();

  if (!/^-?\d*\.?\d*$/.test(text) || text === '' || text === '.' || text === '-') {
    throw new Error(`Cannot read "${value}" as a token amount.`);
  }

  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole = '0', fraction = ''] = unsigned.split('.');

  if (fraction.length > decimals) {
    throw new Error(
      `This amount has at most ${decimals} decimal places. Got "${value}" with ` +
        `${fraction.length}. Round it before converting, so the rounding is deliberate.`,
    );
  }

  const padded = fraction.padEnd(decimals, '0');
  const result = BigInt(`${whole}${padded}`);
  return negative ? -result : result;
}

/** Convert chain units back to a human string. Exact, never lossy. */
export function fromUnits(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** Format for display. Call this at the edge, never in the middle of math. */
export function formatUnits(value: bigint, decimals: number, places = 2): string {
  return Number(fromUnits(value, decimals)).toLocaleString('en-US', {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  });
}

/**
 * Prove, before signing, that an amount is the magnitude the user intended.
 *
 * The brief's rule: if a trade budgeted at 20 USDC is about to send 20,000,000
 * units, that is correct for 6 decimals, but the assertion should prove it
 * deliberately rather than assume it.
 *
 * @param actual   the bigint about to be sent on-chain
 * @param intended the human number the user asked for
 * @param decimals the collateral token's decimals
 * @throws if the two disagree by more than one percent
 */
export function assertMagnitude(
  actual: bigint,
  intended: number,
  decimals: number,
  label: string,
): void {
  const expected = toUnits(intended, decimals);

  if (expected === 0n) {
    if (actual !== 0n) throw new Error(`${label}: expected zero but the value is ${actual}.`);
    return;
  }

  // Allow a one percent band for fees and rounding, never an order of magnitude.
  const lower = (expected * 99n) / 100n;
  const upper = (expected * 101n) / 100n;

  if (actual < lower || actual > upper) {
    const ratio = Number(actual) / Number(expected);
    throw new Error(
      `${label}: refusing to sign. Expected about ${expected} chain units ` +
        `(${intended} at ${decimals} decimals) but the value is ${actual}, which is ` +
        `${ratio.toExponential(2)} times the intended size. ` +
        `This is the decimals bug. Do not bypass this check.`,
    );
  }
}

// --- Conveniences for the fixed conventions -------------------------------

/** Convert a human value at one of the fixed protocol precisions. */
export function toChain(value: number | string, quantity: Quantity): bigint {
  return toUnits(value, DECIMALS[quantity]);
}

/** Convert chain units at one of the fixed protocol precisions. */
export function fromChain(value: bigint, quantity: Quantity): string {
  return fromUnits(value, DECIMALS[quantity]);
}

/** Format at one of the fixed protocol precisions. */
export function forDisplay(value: bigint, quantity: Quantity, places = 2): string {
  return formatUnits(value, DECIMALS[quantity], places);
}

/** Format a USDC amount the way it appears in the interface. */
export function usdc(value: bigint, places = 2): string {
  return `${formatUnits(value, DECIMALS.usdc, places)} USDC`;
}

/** Format a collateral amount with its token symbol. */
export function collateral(value: bigint, decimals: number, symbol: string, places = 2): string {
  return `${formatUnits(value, decimals, places)} ${symbol}`;
}

/** Move a value between two decimal precisions without losing exactness. */
export function rescale(value: bigint, fromDecimals: number, toDecimals: number): bigint {
  const difference = toDecimals - fromDecimals;
  if (difference === 0) return value;
  if (difference > 0) return value * 10n ** BigInt(difference);

  const divisor = 10n ** BigInt(-difference);
  if (value % divisor !== 0n) {
    throw new Error(
      `Rescaling ${value} from ${fromDecimals} to ${toDecimals} decimals would ` +
        `silently drop precision. Round it deliberately instead.`,
    );
  }
  return value / divisor;
}

/** Render a number as a plain decimal string, never as 1e-7. */
function formatNumberExactly(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Cannot convert ${value} to a token amount.`);
  if (!value.toString().includes('e')) return value.toString();
  return value.toFixed(20).replace(/0+$/, '').replace(/\.$/, '');
}
