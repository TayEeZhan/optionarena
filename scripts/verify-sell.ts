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

  const client = signingClient();
  const optionBook = client.getContractAddress('optionBook');

  // Approval has to come before simulation. `callStaticFillOrder` runs the real
  // transfer path, so with no allowance EVERY candidate fails with "transfer
  // amount exceeds allowance", whether or not it would actually fill. Simulating
  // first made a working path look completely broken.
  const allowance = await client.erc20.getAllowance(USDC, account, optionBook);
  console.log(`\nOptionBook allowance: ${fromUnits(allowance, 6)} USDC`);

  if (allowance < need) {
    if (live) {
      console.log('  Approving the OptionBook for this trade...');
      await client.erc20.ensureAllowance(USDC, optionBook, need);
      console.log('  Approved.');
    } else {
      console.log(
        '  Not approved yet. A dry run signs nothing, so candidates that fail\n' +
          '  only on allowance are shown as "pending" rather than as failures.',
      );
    }
  }

  const allBids = await fetchSellable();

  // Opt-in only, via --min-hours. A longer-dated position is nicer to show on
  // stage, but measured against the live book the bids that actually fill are
  // the short-dated ETH and BTC spreads, and the longer-dated ones reject for
  // unrelated reasons. A valid transaction hash matters more than a position
  // that is still running, so the default filters nothing.
  const minHours = Number(arg('--min-hours') ?? 0);
  const longer = allBids.filter((bid) => bid.hoursToExpiry >= minHours);
  const bids = longer.length > 0 ? longer : allBids;

  console.log(`\nResting bids we can sell into: ${allBids.length}`);
  console.log(
    longer.length > 0
      ? `  ${longer.length} expire at least ${minHours}h out, preferring those`
      : `  none expire ${minHours}h out, so using the full set`,
  );

  if (bids.length === 0) {
    console.error('Nothing to sell into right now.');
    process.exit(1);
  }

  // Not every bid fills. Simulate in order and take the first that passes,
  // rather than giving up on the first rejection.
  let chosen: Instrument | null = null;
  let pendingApproval: Instrument | null = null;

  console.log('\nSimulating candidates against live chain state:');
  for (const bid of bids.slice(0, 20)) {
    const label = describeInstrument(bid).padEnd(32);

    // The SDK reports a rejection two different ways: a result with
    // `success: false`, or a thrown error. Both carry the same revert reason,
    // so classify one message rather than duplicating the logic per branch.
    let message: string | null = null;
    try {
      const result = await client.optionBook.callStaticFillOrder(bid.raw, need);
      if (result.success) {
        chosen = bid;
        console.log(`  ok       ${label}`);
        break;
      }
      message = result.error?.message ?? 'rejected';
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    if (/exceeds allowance/.test(message)) {
      // Only the approval is missing. This one would fill.
      pendingApproval ??= bid;
      console.log(`  pending  ${label} would fill once approved`);
      continue;
    }

    const reason =
      /reverted:? "?([^"(]*)/.exec(message)?.[1]?.trim() ??
      /Panic due to ([A-Z]+)/.exec(message)?.[1] ??
      message.slice(0, 44);
    console.log(`  fails    ${label} ${reason}`);
  }

  if (!chosen && pendingApproval && !live) {
    chosen = pendingApproval;
    console.log(
      '\n  Nothing simulated cleanly only because the OptionBook is not approved\n' +
        '  yet. Running with --live approves first, then fills.',
    );
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
