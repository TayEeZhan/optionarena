/**
 * Read-only inspection of the live Thetanuts book on Base.
 *
 * Signs nothing and needs no key. Run this first, on any machine, to confirm
 * the integration is real:
 *
 *   npm run book
 */
import 'dotenv/config';
import {
  fetchBuyable,
  fetchPulse,
  fetchSpot,
  describeInstrument,
  availableLabel,
} from '../lib/thetanuts/book';
import { quoteInstrument, quoteAmount } from '../lib/thetanuts/quote';
import { fromUnits } from '../lib/thetanuts/decimals';
import { chainConfig } from '../lib/thetanuts/client';

async function main() {
  console.log(`\nOptionArena - live book on ${chainConfig.name} (chain ${chainConfig.chainId})`);
  console.log(`OptionBook: ${chainConfig.contracts.optionBook}\n`);

  const pulse = await fetchPulse();
  console.log(`Resting orders: ${pulse.totalOrders}   Buyable: ${pulse.buyableOrders}`);
  console.log(`Indexer lag: ${pulse.indexerLagBlocks ?? 'unknown'} blocks`);

  console.log('\nBy underlying (buyable / total):');
  for (const row of pulse.byUnderlying) {
    const flag = row.buyable === 0 ? '  <- cannot buy, maker bids only' : '';
    console.log(
      `  ${row.underlying.padEnd(6)} ${String(row.buyable).padStart(3)} / ` +
        `${String(row.total).padStart(3)}${flag}`,
    );
  }

  const spot = await fetchSpot();
  const spotLine = Object.entries(spot)
    .map(([k, v]) => `${k} ${v}`)
    .join('  ');
  console.log('\nSpot:', spotLine || 'unavailable');

  const buyable = await fetchBuyable('ETH');
  console.log(`\nBuyable ETH contracts: ${buyable.length}`);

  if (buyable.length === 0) {
    console.log('No buyable ETH contracts right now.');
    return;
  }

  for (const instrument of buyable.slice(0, 6)) {
    console.log(
      `  ${describeInstrument(instrument).padEnd(34)} ` +
        `paid in ${instrument.collateral.symbol.padEnd(9)} ` +
        `size left ${availableLabel(instrument).padStart(24)}  ` +
        `IV ${instrument.greeks ? (instrument.greeks.iv * 100).toFixed(1) + '%' : '  -  '}`,
    );
  }

  // Price the first USDC-collateralised contract, exactly as step 02 does.
  const target = buyable.find((i) => i.collateral.symbol.includes('USDC')) ?? buyable[0];
  const budget = 5; // denominated in the order's own collateral token

  console.log(
    `\nPricing "${describeInstrument(target)}" for a ${budget} ${target.collateral.symbol} budget:`,
  );

  const quote = quoteInstrument(target, budget, spot[target.underlying] ?? null);
  console.log(`  Paid in:                ${quote.collateralSymbol} (${quote.collateralDecimals} decimals)`);
  console.log(`  Premium (what you pay): ${quoteAmount(quote, quote.premium)}`);
  console.log(`  MAXIMUM LOSS:           ${quoteAmount(quote, quote.maxLoss)}`);
  console.log(
    `  Maximum gain:           ${quote.maxGain === null ? 'unbounded (long call)' : quoteAmount(quote, quote.maxGain)}`,
  );
  console.log(`  Breakeven:              ${quote.breakeven ? quote.breakeven.toFixed(2) : 'n/a'}`);
  console.log(`  Contracts:              ${fromUnits(quote.numContracts, quote.collateralDecimals)}`);
  console.log(`  Payoff samples:         ${quote.payoff.length}`);
  for (const note of quote.notes) console.log(`  Note: ${note}`);
  console.log();
}

main().catch((error) => {
  console.error('\nFailed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
