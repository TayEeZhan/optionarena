/**
 * Place one real trade on Base mainnet and print the transaction hash.
 *
 * This is the script that proves Track 2. It runs every check the app runs,
 * against the live book, with a real key.
 *
 * DRY RUN (default) - signs nothing, spends nothing:
 *
 *   npm run verify:fill
 *
 * LIVE - signs and spends real money:
 *
 *   npm run verify:fill -- --live --budget 1
 *
 * Before running live:
 *   - PRIVATE_KEY is a fresh wallet made only for this project
 *   - it holds a small amount of ETH for gas and the collateral token
 *   - MAX_TRADE_USDC is set to the smallest useful number
 *
 * Never let the first run of this path be a large trade.
 */
import 'dotenv/config';

import { fetchBuyable, fetchSpot, describeInstrument, availableLabel } from '../lib/thetanuts/book';
import { quoteInstrument, quoteAmount } from '../lib/thetanuts/quote';
import { execute, dryRun } from '../lib/agent/execute';
import { canSign, signerAddress, chainConfig, maxTradeUsdc } from '../lib/thetanuts/client';
import { fromUnits } from '../lib/thetanuts/decimals';

interface Options {
  live: boolean;
  budget: number;
  underlying: string;
}

function readOptions(): Options {
  const args = process.argv.slice(2);
  const value = (flag: string) => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };

  return {
    live: args.includes('--live'),
    budget: Number(value('--budget') ?? 1),
    underlying: (value('--underlying') ?? 'ETH').toUpperCase(),
  };
}

async function main() {
  const options = readOptions();

  console.log('\n=========================================');
  console.log(' OptionArena - verify one real fill');
  console.log('=========================================');
  console.log(`Chain     : ${chainConfig.name} (${chainConfig.chainId})`);
  console.log(`OptionBook: ${chainConfig.contracts.optionBook}`);
  console.log(
    `Mode      : ${options.live ? 'LIVE - WILL SPEND REAL MONEY' : 'dry run - signs nothing'}`,
  );
  console.log(`Wallet    : ${signerAddress() ?? 'none configured'}`);
  console.log(`Ceiling   : ${maxTradeUsdc()} per trade`);
  console.log(`Budget    : ${options.budget}`);

  if (!canSign()) {
    console.log(
      '\nNo PRIVATE_KEY is set, so this script can only read the book.\n' +
        'Copy .env.example to .env and set PRIVATE_KEY to go further.',
    );
  }

  // 1. Find something buyable.
  const buyable = await fetchBuyable(options.underlying);
  if (buyable.length === 0) {
    console.error(`\nNothing buyable on ${options.underlying} right now. Try --underlying BTC.`);
    process.exit(1);
  }

  // Prefer a USDC-collateralised contract: the budget is a USDC number.
  const target = buyable.find((i) => i.collateral.symbol.includes('USDC')) ?? buyable[0];

  console.log(`\nChose: ${describeInstrument(target)}`);
  console.log(`  paid in   : ${target.collateral.symbol} (${target.collateral.decimals} decimals)`);
  console.log(`  size left : ${availableLabel(target)}`);
  console.log(`  expires in: ${target.hoursToExpiry.toFixed(1)} hours`);

  // 2. Price it, exactly as step 02 does.
  const spot = await fetchSpot();
  const quote = quoteInstrument(target, options.budget, spot[target.underlying] ?? null);

  console.log('\nQuote from the live book:');
  console.log(`  Premium      : ${quoteAmount(quote, quote.premium)}`);
  console.log(`  MAXIMUM LOSS : ${quoteAmount(quote, quote.maxLoss)}`);
  console.log(
    `  Maximum gain : ${quote.maxGain === null ? 'unbounded (long call)' : quoteAmount(quote, quote.maxGain)}`,
  );
  console.log(`  Breakeven    : ${quote.breakeven?.toFixed(2) ?? 'n/a'}`);
  console.log(`  Contracts    : ${fromUnits(quote.numContracts, quote.collateralDecimals)}`);
  for (const note of quote.notes) console.log(`  Note: ${note}`);

  // 3. Run every pre-flight check.
  console.log('\nPre-flight checks:');
  const check = await dryRun(target, quote, options.budget);
  for (const line of check.checks) console.log(`  ok   ${line}`);

  if (!check.ok) {
    console.error(`\n  STOP  ${check.problem}`);
    process.exit(1);
  }

  if (!options.live) {
    console.log(
      '\nDry run complete. Every check passed and nothing was signed.\n' +
        'Add --live to place the trade for real.\n',
    );
    return;
  }

  // 4. Sign and send.
  console.log('\nPlacing the trade...');
  const result = await execute(target, quote, options.budget);

  console.log('\n=========================================');
  console.log(' FILLED');
  console.log('=========================================');
  console.log(`Transaction: ${result.txHash}`);
  console.log(`Basescan   : ${result.explorerUrl}`);
  console.log(`Block      : ${result.blockNumber}`);
  console.log(`Gas used   : ${result.gasUsed}`);
  console.log(
    `Spent      : ${fromUnits(result.spent, result.collateralDecimals)} ${result.collateralSymbol}`,
  );
  console.log('\nRecord this hash in docs/decisions.md as evidence.\n');
}

main().catch((error) => {
  console.error('\nFailed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
