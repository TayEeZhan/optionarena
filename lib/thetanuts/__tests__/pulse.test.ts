import { describe, expect, test } from 'vitest';

import { isAToken, isUsdcCollateral } from '../book';
import type { Instrument } from '../book';

/**
 * The market pulse promised something the executor refuses.
 *
 * The panel on /trade used to say "contracts priced in USDC you can buy right
 * now" over a count of 64, while `executeStrategy` rejected every one of them
 * because the OptionBook overflows on Aave aToken collateral. Measured on the
 * live book on 6 Sep 2026: all 64 USDC-priced buyable orders were aBasUSDC, so
 * the true count of buyable-and-fillable USDC orders was zero.
 *
 * These tests pin the two predicates the panel now counts with — the same ones
 * the executor gates on — so the interface and the refusal cannot drift apart
 * again.
 */

/** Only the fields these predicates read. */
function order(symbol: string): Instrument {
  return { collateral: { symbol, decimals: 6, address: '0x' } } as unknown as Instrument;
}

describe('what the pulse is allowed to call fillable', () => {
  test('treats every aBas token as blocked, whatever it wraps', () => {
    // Arrange: the three aTokens the book actually quotes in.
    const blocked = ['aBasUSDC', 'aBasWETH', 'aBascbBTC'].map(order);

    // Act / Assert
    expect(blocked.every(isAToken)).toBe(true);
  });

  test('does not block a plain token, which is what cbBTC calls are paid in', () => {
    expect(isAToken(order('cbBTC'))).toBe(false);
    expect(isAToken(order('USDC'))).toBe(false);
    expect(isAToken(order('WETH'))).toBe(false);
  });

  test('counts aBasUSDC as USDC-priced but never as fillable', () => {
    // The exact case that made the old caption false: it satisfies the USDC
    // filter behind the headline number and fails the executor's gate.
    const aBasUsdc = order('aBasUSDC');

    expect(isUsdcCollateral(aBasUsdc)).toBe(true);
    expect(isAToken(aBasUsdc)).toBe(true);
  });

  test('usdcUnblocked can never exceed usdcBuyable', () => {
    // Arrange: a book shaped like the live one — USDC orders that are all
    // aTokens, plus plain-token BTC calls.
    const buyable = [order('aBasUSDC'), order('aBasUSDC'), order('cbBTC')];

    // Act
    const usdcBuyable = buyable.filter(isUsdcCollateral).length;
    const usdcUnblocked = buyable.filter((i) => isUsdcCollateral(i) && !isAToken(i)).length;
    const unblocked = buyable.filter((i) => !isAToken(i)).length;

    // Assert
    expect(usdcBuyable).toBe(2);
    expect(usdcUnblocked).toBe(0);
    expect(unblocked).toBe(1);
    expect(usdcUnblocked).toBeLessThanOrEqual(usdcBuyable);
  });
});
