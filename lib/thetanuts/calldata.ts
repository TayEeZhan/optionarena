import 'server-only';

import { Interface } from 'ethers';

import { fetchBuyable } from './book';
import { chainConfig, readClient } from './client';
import { assertMagnitude, toUnits } from './decimals';

/**
 * Unsigned calldata, for a wallet that is not ours to sign with.
 *
 * The server-signing path in `lib/agent/execute.ts` holds a key and sends the
 * transaction itself. This is the other half: it builds the same two calls and
 * hands them back, so the person's own wallet signs and broadcasts them.
 * **Nothing here needs `PRIVATE_KEY`, and nothing here signs.**
 *
 * Two transactions, in order, because that is what an ERC-20 book requires:
 * approve the OptionBook to take the premium, then fill.
 *
 * The decimals rule applies unchanged. Every amount is denominated by the
 * collateral on the order it belongs to, read from that order, never assumed.
 */

const ERC20 = new Interface(['function approve(address spender, uint256 value) returns (bool)']);

export interface WalletCalldata {
  /** What the user is buying, so the interface can confirm before signing. */
  label: string;
  symbol: string;
  decimals: number;
  /** The premium in the collateral's own units, as a string for JSON. */
  spendUnits: string;
  /** The collateral token, so the interface can name what is approved. */
  token: string;
  optionBook: string;
  approve: { to: string; data: string };
  fill: { to: string; data: string };
}

export class CalldataRefused extends Error {}

/**
 * Build the two calls for one instrument at one budget.
 *
 * Refuses rather than guesses: an unknown instrument, a rotated order or a
 * budget the maker cannot cover all throw, because a wallet prompt built on a
 * stale order asks someone to sign something they did not choose.
 */
export async function fillCalldata(instrumentId: string, budget: number): Promise<WalletCalldata> {
  if (!(budget > 0)) throw new CalldataRefused('The budget must be more than zero.');

  const instrument = (await fetchBuyable()).find((row) => row.id === instrumentId);
  if (!instrument) {
    throw new CalldataRefused(
      'That contract is no longer on the book. Go back and price it again — the makers requote ' +
        'about once a minute.',
    );
  }

  const { address, decimals, symbol } = instrument.collateral;
  const spend = toUnits(budget, decimals);

  // The same magnitude proof the signing path runs, for the same reason: this
  // number is about to appear in a wallet prompt as real money.
  assertMagnitude(spend, budget, decimals, `Trade size in ${symbol}`);

  if (spend > instrument.availableCollateral) {
    throw new CalldataRefused(
      `The maker has less than ${budget} ${symbol} left on that order. Try a smaller budget.`,
    );
  }

  const optionBook = chainConfig.contracts.optionBook;
  if (!optionBook) throw new CalldataRefused('No OptionBook address for this chain.');

  const encoded = (await readClient().optionBook.encodeFillOrder(instrument.raw, spend)) as
    string | { data: string };
  const data = typeof encoded === 'string' ? encoded : encoded.data;

  if (!data || !data.startsWith('0x')) {
    throw new CalldataRefused('The SDK did not return fill calldata for that order.');
  }

  return {
    label: `${instrument.underlying} ${instrument.strikes.join('/')} ${
      instrument.isCall ? 'Call' : 'Put'
    }`,
    symbol,
    decimals,
    spendUnits: spend.toString(),
    token: address,
    optionBook,
    approve: {
      to: address,
      data: ERC20.encodeFunctionData('approve', [optionBook, spend]),
    },
    fill: { to: optionBook, data },
  };
}
