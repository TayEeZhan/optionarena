/**
 * Place one real trade on Base mainnet by selling into a resting bid.
 *
 * This exists because the buy side is blocked upstream: every buyable order is
 * physically settled, and filling one reverts with `Panic(0x11)` inside the
 * OptionBook. The Thetanuts team confirmed physical settlement is not routed
 * into the SDK yet. See `docs/decisions.md` sections 14 and 15.
 *
 * DRY RUN (default) - signs nothing, spends nothing:
 *
 *   npm run verify:sell
 *
 * LIVE - signs and posts real collateral:
 *
 *   npm run verify:sell -- --live --collateral 0.4
 *
 * The wallet needs PLAIN USDC, not aBasUSDC. The buy path uses Aave's
 * interest-bearing token; the fills that actually succeed use plain USDC. If
 * the funds are in Aave, withdraw them first.
 *
 * Balances are read immediately before and after the fill and the delta is
 * printed. That is deliberate: the SDK's preview is buyer-oriented, so the
 * short economics are established by measurement rather than assumed.
 */
import 'dotenv/config';

import { fetchSellable, describeInstrument, availableLabel } from '../lib/thetanuts/book';
import { executeSell } from '../lib/agent/execute';
import {
  readClient,
  signingClient,
  canSign,
  chainConfig,
  maxTradeUsdc,
} from '../lib/thetanuts/client';
import { fromUnits, toUnits } from '../lib/thetanuts/decimals';
import type { Instrument } from '../lib/thetanuts/book';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const A_BAS_USDC = '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** Both USDC balances, so the delta shows where value actually moved. */
async function balances(account: string) {
  const client = readClient();
  const [plain, aave] = await Promise.all([
    client.erc20.getBalance(USDC, account),
    client.erc20.getBalance(A_BAS_USDC, account),
  ]);
  return { plain, aave };
}

async function main() {
  const live = process.argv.includes('--live');
  const collateral = Number(arg('--collateral') ?? 0.4);

  console.log('\n=========================================');
  console.log(' OptionArena - sell into a resting bid');
  console.log('=========================================');
  console.log(`Chain     : ${chainConfig.name} (${chainConfig.chainId})`);
  console.log(`OptionBook: ${chainConfig.contracts.optionBook}`);
  console.log(
    `Mode      : ${live ? 'LIVE - WILL POST REAL COLLATERAL' : 'dry run - signs nothing'}`,
  );
  console.log(`Ceiling   : ${maxTradeUsdc()} per trade`);
  console.log(`Collateral: ${collateral}`);

  if (!canSign()) {
    console.log('\nNo PRIVATE_KEY is set. Copy .env.example to .env and set it.');
    process.exit(1);
  }

  const account = await signingClient().getSignerAddress();
  console.log(`Wallet    : ${account}`);

  const before = await balances(account);
  console.log(`\nBalances before:`);
  console.log(`  USDC     : ${fromUnits(before.plain, 6)}`);
  console.log(`  aBasUSDC : ${fromUnits(before.aave, 6)}`);

  const need = toUnits(collateral, 6);
  if (before.plain < need) {
    console.error(
      `\nNot enough plain USDC. Holds ${fromUnits(before.plain, 6)}, needs ${collateral}.` +
        (before.aave > 0n
          ? `\nThere is ${fromUnits(before.aave, 6)} aBasUSDC in Aave. Withdraw it at ` +
            `app.aave.com (Base market) to get plain USDC back.`
          : ''),
    );
    process.exit(1);
  }

  const bids = await fetchSellable();
  console.log(`\nResting bids we can sell into: ${bids.length}`);
  if (bids.length === 0) {
    console.error('Nothing to sell into right now.');
    process.exit(1);
  }

  // Not every bid fills. Simulate candidates in order and take the first that
  // passes, rather than giving up on the first rejection.
  const client = signingClient();
  let chosen: Instrument | null = null;

  console.log('\nSimulating candidates against live chain state:');
  for (const bid of bids.slice(0, 12)) {
    try {
      const result = await client.optionBook.callStaticFillOrder(bid.raw, need);
      if (result.success) {
        chosen = bid;
        console.log(`  ok     ${describeInstrument(bid)}`);
        break;
      }
      console.log(
        `  fails  ${describeInstrument(bid).padEnd(32)} ${result.error?.message ?? 'rejected'}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  fails  ${describeInstrument(bid).padEnd(32)} ${message.slice(0, 50)}`);
    }
  }

  if (!chosen) {
    console.error('\nNo bid simulated cleanly. The book moves fast; try again in a minute.');
    process.exit(1);
  }

  console.log(`\nChose: ${describeInstrument(chosen)}`);
  console.log(`  structure : ${chosen.structure}`);
  console.log(`  posting   : ${collateral} ${chosen.collateral.symbol}`);
  console.log(`  size left : ${availableLabel(chosen)}`);
  console.log(`  expires in: ${chosen.hoursToExpiry.toFixed(1)} hours`);
  console.log(
    `\n  You are the SELLER here. What you post is the collateral, and the worst\n` +
      `  case is bounded by it. This is not the buy side's "maximum loss is the\n` +
      `  premium" - it is a different position with different risk.`,
  );

  if (!live) {
    console.log('\nDry run complete. Nothing was signed. Add --live to place it.\n');
    return;
  }

  console.log('\nPlacing the trade...');
  const result = await executeSell(chosen, collateral);

  const after = await balances(account);

  console.log('\n=========================================');
  console.log(' FILLED');
  console.log('=========================================');
  console.log(`Transaction: ${result.txHash}`);
  console.log(`Basescan   : ${result.explorerUrl}`);
  console.log(`Block      : ${result.blockNumber}`);
  console.log(`Gas used   : ${result.gasUsed}`);

  console.log('\nMeasured on-chain, before and after:');
  console.log(`  USDC     : ${fromUnits(before.plain, 6)} -> ${fromUnits(after.plain, 6)}`);
  console.log(`  aBasUSDC : ${fromUnits(before.aave, 6)} -> ${fromUnits(after.aave, 6)}`);
  console.log(
    `  net USDC : ${fromUnits(after.plain - before.plain, 6)} ` +
      `(negative means collateral posted)`,
  );

  console.log('\nRecord the hash and these deltas in docs/decisions.md section 9.\n');
}

main().catch((error) => {
  console.error('\nFailed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
