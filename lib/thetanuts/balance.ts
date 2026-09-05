import 'server-only';

import { fetchBuyable, isUsdcCollateral } from './book';
import { chainConfig } from './client';
import { canSign, signerAddress, signingClient } from './client';
import { formatUnits } from './decimals';

/**
 * What the signing wallet actually holds, for the interface to report.
 *
 * The home screen used to print a hardcoded figure and call it a balance in
 * both modes, which meant that in live mode it claimed "simulated, no
 * signature" while the app was configured to sign for real. This exists so the
 * live state reports something true instead.
 *
 * The token is taken from the book rather than named here. Every amount in this
 * project is denominated by the collateral on the order it belongs to, and a
 * literal 6 in this file would be the same mistake `decimals.ts` was written to
 * prevent — puts settle in aBasUSDC at 6dp, but nothing guarantees that stays
 * the only USDC-priced collateral.
 */

export interface WalletBalance {
  /** Already formatted, because the caller is a component. */
  display: string;
  symbol: string;
  address: string;
}

/**
 * The balance, or null when there is nothing honest to report.
 *
 * Null covers three cases and the interface treats them alike: no signing key,
 * no USDC-priced order to name a token from, and an unreachable indexer. In all
 * three the answer is "we do not know", and a balance card must not guess at a
 * number.
 */
/** A token, as the interface needs to name and read it. */
export interface TokenDescriptor {
  address: string;
  decimals: number;
  symbol: string;
}

/** The token the USDC side of the book settles in, and what backs it. */
export interface CollateralDescriptor extends TokenDescriptor {
  /**
   * The plain token behind the aToken, when there is one.
   *
   * A wallet holding USDC sees a balance in MetaMask and zero in this app,
   * because the book settles in aBasUSDC and those are different tokens. The
   * interface shows both so the two screens reconcile, which needs the
   * underlying's own address and decimals.
   */
  underlying: TokenDescriptor | null;
}

/**
 * The plain token an Aave aToken wraps.
 *
 * Derived from the naming the SDK's own config uses — aBasUSDC wraps USDC,
 * aBasWETH wraps WETH — and looked up there rather than written down here, so
 * no address or decimal is hardcoded. Null when there is no match, because a
 * missing pairing is a display detail and not a failure.
 */
function underlyingOf(symbol: string): TokenDescriptor | null {
  const plain = symbol.replace(/^aBas/, '');
  if (plain === symbol) return null;

  const tokens = chainConfig.tokens as
    Record<string, { address: string; symbol: string; decimals: number } | undefined> | undefined;
  const found = tokens?.[plain];

  return found ? { address: found.address, decimals: found.decimals, symbol: found.symbol } : null;
}

/**
 * Which token a USDC-priced order is paid in, read from an order.
 *
 * Deliberately independent of any signing key: the browser needs this to read a
 * *connected* wallet's balance, and that has nothing to do with whether the
 * server can sign. It was previously only reachable inside `walletBalance()`,
 * which returns null without a key — so on the deployment, where there is no
 * key, the token was unavailable exactly when a user wallet needed it.
 */
export async function usdcCollateral(): Promise<CollateralDescriptor | null> {
  try {
    const priced = (await fetchBuyable()).find(isUsdcCollateral);
    if (!priced) return null;

    const { address, decimals, symbol } = priced.collateral;
    return { address, decimals, symbol, underlying: underlyingOf(symbol) };
  } catch {
    return null;
  }
}

export async function walletBalance(): Promise<WalletBalance | null> {
  const account = signerAddress();
  if (!canSign() || !account) return null;

  try {
    const token = await usdcCollateral();
    if (!token) return null;

    const { address, decimals, symbol } = token;
    const units = await signingClient().erc20.getBalance(address, account);

    return { display: formatUnits(units, decimals), symbol, address: account };
  } catch {
    // A quiet null. The card then says the balance is unavailable, which is
    // true, rather than showing a figure that is not.
    return null;
  }
}
