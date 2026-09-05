import 'server-only';

import { fetchBuyable, isUsdcCollateral } from './book';
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
export async function walletBalance(): Promise<WalletBalance | null> {
  const account = signerAddress();
  if (!canSign() || !account) return null;

  try {
    const priced = (await fetchBuyable()).find(isUsdcCollateral);
    if (!priced) return null;

    const { address, decimals, symbol } = priced.collateral;
    const units = await signingClient().erc20.getBalance(address, account);

    return { display: formatUnits(units, decimals), symbol, address: account };
  } catch {
    // A quiet null. The card then says the balance is unavailable, which is
    // true, rather than showing a figure that is not.
    return null;
  }
}
