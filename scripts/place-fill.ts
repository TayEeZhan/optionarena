/**
 * Place one real fill on Base mainnet.
 *
 * Why this exists, and why it sells rather than buys:
 *
 * Every buyable order on the Thetanuts Base book is physically settled, and
 * physically settled orders cannot be filled through the SDK today. Every
 * attempt reverts with `Panic(0x11)`, an arithmetic overflow inside the
 * OptionBook, across 123 orders, nine sizes and three RPCs. The Thetanuts team
 * confirmed on 5 Sep 2026: "don't do physicals for now, I think it's not routed
 * into the SDK yet."
 *
 * The cash-settled side of the book does work, but it is all resting BIDS, so
 * the only trade a taker can actually place is a sell. That is the market's
 * shape, not a design choice. Selling here is fully collateralised: the most
 * that can be lost is the collateral posted, which is what `SIZE` sets.
 *
 * A separate discovery: the earlier sell-side failures were never a contract
 * bug. The wallet had approved aBasUSDC for the (dead) buy path and had never
 * approved plain USDC, so every fill reverted at the token transfer with
 * "ERC20: transfer amount exceeds allowance". Proven with an eth_call state
 * override that granted an allowance and nothing else: 8 of 8 orders filled.
 *
 * Run:
 *   npm run fill              # simulate every step, sign nothing
 *   npm run fill -- --live    # approve and send for real
 */
import 'dotenv/config';
import { fetchBook } from '../lib/thetanuts/book';
import { signingClient, explorerTx, maxTradeUsdc } from '../lib/thetanuts/client';
import { fromUnits } from '../lib/thetanuts/decimals';

/** Base mainnet USDC. The cash-settled book is collateralised in this. */
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/**
 * Collateral posted, in USDC units (6 decimals). This is the entire downside:
 * a fully collateralised short cannot lose more than it posts.
 */
const SIZE = 10_000n; // 0.010000 USDC

const live = process.argv.includes('--live');

async function main() {
  const client = signingClient();
  await client.assertNetwork();

  const me = await client.getSignerAddress();
  const optionBook = client.getContractAddress('optionBook');
  const balance: bigint = await client.erc20.getBalance(USDC, me);

  console.log(`\n${live ? 'LIVE — this signs and spends' : 'DRY RUN — nothing is signed'}\n`);
  console.log(`  Signer      ${me}`);
  console.log(`  USDC held   ${fromUnits(balance, 6)}`);
  console.log(`  Posting     ${fromUnits(SIZE, 6)} USDC as collateral`);
  console.log(`  Ceiling     ${maxTradeUsdc()} (MAX_TRADE_USDC)\n`);

  if (balance < SIZE) {
    throw new Error(
      `Wallet holds ${fromUnits(balance, 6)} USDC but this needs ${fromUnits(SIZE, 6)}.`,
    );
  }

  const book = await fetchBook();
  const candidates = book
    .filter((i) => i.makerIsBuying && i.availableCollateral > 0n && !i.isPhysical)
    .filter((i) => i.collateral.address.toLowerCase() === USDC.toLowerCase())
    // Latest expiry first, so the position is still open during the demo.
    .sort((a, b) => b.expiry - a.expiry);

  console.log(`  Cash-settled bids available: ${candidates.length}\n`);
  if (candidates.length === 0) throw new Error('No cash-settled bids on the book right now.');

  if (live) {
    console.log(`  Approving the OptionBook for exactly ${fromUnits(SIZE, 6)} USDC...`);
    await client.erc20.ensureAllowance(USDC, optionBook, SIZE);
    const allowance: bigint = await client.erc20.getAllowance(USDC, me, optionBook);
    console.log(`  Allowance is now ${fromUnits(allowance, 6)} USDC\n`);
  } else {
    const allowance: bigint = await client.erc20.getAllowance(USDC, me, optionBook);
    console.log(`  Current allowance ${fromUnits(allowance, 6)} USDC`);
    if (allowance < SIZE) {
      console.log('  (0 allowance makes every simulation below fail at the token transfer,');
      console.log('   which is expected on a dry run. --live approves first.)\n');
    }
  }

  for (const instrument of candidates.slice(0, 12)) {
    const tag =
      `${instrument.underlying} ${instrument.strikes.join('/')} ` +
      `${instrument.isCall ? 'Call' : 'Put'} ${instrument.structure}`;
    const expiry = new Date(instrument.expiry * 1000).toISOString();

    const simulation = await client.optionBook.callStaticFillOrder(instrument.raw, SIZE);
    if (!simulation.success) {
      const why = (simulation.error?.message ?? 'rejected').slice(0, 60);
      console.log(`  skip  ${tag.padEnd(28)} ${expiry}  ${why}`);
      continue;
    }

    console.log(`\n  SIMULATES CLEAN`);
    console.log(`    ${tag}`);
    console.log(`    expires ${expiry}`);
    console.log(`    max loss ${fromUnits(SIZE, 6)} USDC (the collateral posted)\n`);

    if (!live) {
      console.log('  Dry run: stopping here. Re-run with --live to send.\n');
      return;
    }

    const receipt = await client.optionBook.fillOrder(instrument.raw, SIZE);
    console.log(`  TX HASH   ${receipt.hash}`);
    console.log(`  BLOCK     ${receipt.blockNumber}`);
    console.log(`  GAS USED  ${receipt.gasUsed}`);
    console.log(`  EXPLORER  ${explorerTx(receipt.hash)}\n`);
    return;
  }

  console.log('\n  Nothing simulated clean. Re-run: resting orders turn over in about a minute.\n');
}

main().catch((error) => {
  console.error(`\n  ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
