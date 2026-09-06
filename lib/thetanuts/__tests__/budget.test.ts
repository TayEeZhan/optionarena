import { describe, expect, test } from 'vitest';

import { BudgetRefused, budgetInCollateral } from '../budget';
import type { Instrument } from '../book';

/** Only the fields the conversion reads. */
function order(symbol: string, underlying: string): Instrument {
  return {
    underlying,
    collateral: { symbol, decimals: 8, address: '0x' },
  } as unknown as Instrument;
}

const SPOT = { ETH: 2479.16, BTC: 79959.37 };

describe('budgetInCollateral', () => {
  test('leaves a USDC budget alone, because a dollar is a dollar', () => {
    const result = budgetInCollateral(5, order('aBasUSDC', 'ETH'), SPOT);

    expect(result.inCollateral).toBe(5);
    expect(result.spotUsed).toBeNull();
    expect(result.note).toBeNull();
  });

  test('converts a dollar budget for a cbBTC order instead of spending bitcoin', () => {
    // Arrange: the exact bug this file exists to prevent. A bare 1 against a
    // cbBTC order is one whole bitcoin.
    const result = budgetInCollateral(1, order('cbBTC', 'BTC'), SPOT);

    // Act / Assert
    expect(result.usd).toBe(1);
    expect(result.inCollateral).toBeCloseTo(1 / 79959.37, 12);
    expect(result.inCollateral).toBeLessThan(0.0000126);
    expect(result.spotUsed).toBe(79959.37);
    expect(result.note).toContain('cbBTC');
  });

  test('converts for aBasWETH against the ETH price', () => {
    const result = budgetInCollateral(10, order('aBasWETH', 'ETH'), SPOT);
    expect(result.inCollateral).toBeCloseTo(10 / 2479.16, 12);
  });

  test('refuses when the spot price is missing rather than treating dollars as bitcoin', () => {
    expect(() => budgetInCollateral(1, order('cbBTC', 'BTC'), {})).toThrow(BudgetRefused);
  });

  test('refuses a zero or negative budget', () => {
    expect(() => budgetInCollateral(0, order('aBasUSDC', 'ETH'), SPOT)).toThrow(BudgetRefused);
    expect(() => budgetInCollateral(-3, order('cbBTC', 'BTC'), SPOT)).toThrow(BudgetRefused);
  });
});
