import 'server-only';

import { ThetanutsClient, getChainConfigById } from '@thetanuts-finance/thetanuts-client';
import { JsonRpcProvider, Wallet } from 'ethers';

/**
 * Thetanuts client construction. Server only.
 *
 * OptionArena signs server-side. The private key lives in the host's secret
 * store, is read here, and never reaches the browser. The `server-only` import
 * above turns any accidental client import into a build error rather than a
 * leaked key. See docs/decisions.md.
 */

/** Base mainnet. The only chain OptionArena trades on. */
export const CHAIN_ID = 8453 as const;

export const chainConfig = getChainConfigById(CHAIN_ID);

/** Block explorer link for a transaction. This is the product's proof. */
export function explorerTx(hash: string): string {
  return `${chainConfig.explorerUrl}/tx/${hash}`;
}

function rpcUrl(): string {
  return process.env.BASE_RPC_URL || chainConfig.defaultRpcUrls[0];
}

/** A read-only client. Safe to build on any request. Needs no key. */
export function readClient(): ThetanutsClient {
  return new ThetanutsClient({
    chainId: CHAIN_ID,
    provider: new JsonRpcProvider(rpcUrl()),
  });
}

/** True when a signing key is configured, so the live path is available. */
export function canSign(): boolean {
  return Boolean(process.env.PRIVATE_KEY);
}

/**
 * A client that can sign and send transactions.
 *
 * @throws if no key is configured, so a missing key fails loudly at the point
 *         of use rather than silently falling back to a simulated result.
 */
export function signingClient(): ThetanutsClient {
  const key = process.env.PRIVATE_KEY;
  if (!key) {
    throw new Error(
      'Live trading needs PRIVATE_KEY in the environment. ' +
        'Without it OptionArena runs in demo mode only.',
    );
  }

  const provider = new JsonRpcProvider(rpcUrl());
  return new ThetanutsClient({
    chainId: CHAIN_ID,
    provider,
    signer: new Wallet(key, provider),
  });
}

/** The address OptionArena trades from, or null in demo-only mode. */
export function signerAddress(): string | null {
  const key = process.env.PRIVATE_KEY;
  if (!key) return null;
  try {
    return new Wallet(key).address;
  } catch {
    return null;
  }
}

/**
 * Hard ceiling on a single live trade, in whole USDC.
 *
 * The first run of any execution path must be small. This is the backstop that
 * makes that a property of the system rather than a habit.
 */
export function maxTradeUsdc(): number {
  const configured = Number(process.env.MAX_TRADE_USDC);
  return Number.isFinite(configured) && configured > 0 ? configured : 25;
}
