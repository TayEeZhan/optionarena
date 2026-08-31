import { describe, it, expect } from 'vitest';
import {
  DECIMALS,
  toUnits,
  fromUnits,
  formatUnits,
  toChain,
  fromChain,
  usdc,
  collateral,
  rescale,
  assertMagnitude,
} from '../decimals';

/** Collateral decimals seen on the live Base book, 31 Aug 2026. */
const USDC = 6;
const WETH = 18;
const CBBTC = 8;

describe('toUnits', () => {
  it('converts whole USDC at 6 decimals', () => {
    expect(toUnits(20, USDC)).toBe(20_000_000n);
    expect(toUnits('20', USDC)).toBe(20_000_000n);
  });

  it('converts fractional amounts exactly', () => {
    expect(toUnits('0.01', USDC)).toBe(10_000n);
    expect(toUnits('123.612655', USDC)).toBe(123_612_655n);
  });

  it('avoids the floating point error that multiplication would introduce', () => {
    // 0.1 * 1e6 is 100000.00000000001 in IEEE 754. String parsing is exact.
    expect(toUnits(0.1, USDC)).toBe(100_000n);
    expect(toUnits(0.07, USDC)).toBe(70_000n);
    expect(toUnits(1.005, USDC)).toBe(1_005_000n);
  });

  it('converts the same human value differently per token', () => {
    // The whole point of the file: one budget, three collateral tokens.
    expect(toUnits(2, USDC)).toBe(2_000_000n);
    expect(toUnits(2, CBBTC)).toBe(200_000_000n);
    expect(toUnits(2, WETH)).toBe(2_000_000_000_000_000_000n);
  });

  it('handles very small numbers without exponent notation', () => {
    expect(toUnits(0.0000001, DECIMALS.strike)).toBe(10n);
  });

  it('refuses more precision than the token allows', () => {
    expect(() => toUnits('1.0000001', USDC)).toThrow(/at most 6 decimal places/);
  });

  it('refuses input that is not a number', () => {
    expect(() => toUnits('twenty', USDC)).toThrow(/Cannot read/);
    expect(() => toUnits('', USDC)).toThrow(/Cannot read/);
  });
});

describe('fromUnits', () => {
  it('trims trailing zeros but keeps significant digits', () => {
    expect(fromUnits(20_000_000n, USDC)).toBe('20');
    expect(fromUnits(20_500_000n, USDC)).toBe('20.5');
    expect(fromUnits(1n, USDC)).toBe('0.000001');
  });

  it('round-trips across every collateral token', () => {
    for (const decimals of [USDC, CBBTC, WETH]) {
      for (const value of ['1', '0.5', '1234.25']) {
        expect(fromUnits(toUnits(value, decimals), decimals)).toBe(String(Number(value)));
      }
    }
  });

  it('handles zero', () => {
    expect(fromUnits(0n, USDC)).toBe('0');
  });
});

describe('strike and price conventions', () => {
  it('converts strikes at 8 decimals, matching the live book', () => {
    // Observed on Base 31 Aug 2026: an ETH put at strike 2250.
    expect(toChain(2250, 'strike')).toBe(225_000_000_000n);
    expect(toChain(98000, 'strike')).toBe(9_800_000_000_000n);
  });

  it('reads a live price back correctly', () => {
    // A real resting PHYSICAL_PUT price, 8 decimals.
    expect(fromChain(284_886_481n, 'price')).toBe('2.84886481');
  });
});

describe('display helpers', () => {
  it('formats money with thousands separators', () => {
    expect(formatUnits(1_234_560_000n, USDC)).toBe('1,234.56');
    expect(usdc(20_000_000n)).toBe('20.00 USDC');
  });

  it('labels a non-USDC collateral with its own symbol and decimals', () => {
    expect(collateral(2_000_000_000_000_000_000n, WETH, 'aBasWETH')).toBe('2.00 aBasWETH');
  });
});

describe('rescale', () => {
  it('widens precision exactly', () => {
    expect(rescale(1_000_000n, USDC, DECIMALS.strike)).toBe(100_000_000n);
  });

  it('narrows precision when it is lossless', () => {
    expect(rescale(100_000_000n, DECIMALS.strike, USDC)).toBe(1_000_000n);
  });

  it('refuses to narrow precision when it would drop digits', () => {
    expect(() => rescale(100_000_001n, DECIMALS.strike, USDC)).toThrow(/silently drop precision/);
  });
});

describe('assertMagnitude', () => {
  it('accepts the correct decimal expansion', () => {
    // A 20 USDC budget really is 20,000,000 units. Proven, not assumed.
    expect(() => assertMagnitude(20_000_000n, 20, USDC, 'premium')).not.toThrow();
  });

  it('allows a one percent band for fees and rounding', () => {
    expect(() => assertMagnitude(20_100_000n, 20, USDC, 'premium')).not.toThrow();
    expect(() => assertMagnitude(19_900_000n, 20, USDC, 'premium')).not.toThrow();
  });

  it('catches an amount that is a thousand times too large', () => {
    expect(() => assertMagnitude(20_000_000_000n, 20, USDC, 'premium')).toThrow(/refusing to sign/);
  });

  it('catches the classic wrong-decimals bug', () => {
    // 20 units encoded at 18 decimals when the token has 6.
    const wrong = 20_000_000_000_000_000_000n;
    expect(() => assertMagnitude(wrong, 20, USDC, 'premium')).toThrow(/This is the decimals bug/);
  });

  it('catches the live bug this file was rewritten to prevent', () => {
    // A 2 USDC budget scaled at 6 decimals, then sent to a call whose
    // collateral is aBasWETH at 18 decimals. That is 2e-12 WETH, not 2 WETH.
    // Checking against the ORDER's own decimals is what catches it.
    const usdcScaled = toUnits(2, USDC);
    expect(() => assertMagnitude(usdcScaled, 2, WETH, 'collateral')).toThrow(
      /This is the decimals bug/,
    );
    // The same number is correct when the collateral really is USDC.
    expect(() => assertMagnitude(usdcScaled, 2, USDC, 'collateral')).not.toThrow();
  });

  it('catches an amount that is far too small', () => {
    expect(() => assertMagnitude(20_000n, 20, USDC, 'premium')).toThrow(/refusing to sign/);
  });

  it('handles a zero budget', () => {
    expect(() => assertMagnitude(0n, 0, USDC, 'premium')).not.toThrow();
    expect(() => assertMagnitude(1n, 0, USDC, 'premium')).toThrow(/expected zero/);
  });
});
