/**
 * Prove a fill would succeed, without sending an approval or spending gas.
 *
 * `npm run fill` (dry run) cannot tell the difference between "the contract
 * rejects this order" and "we have not approved the token yet", because both
 * revert. This uses an eth_call state override to grant a USDC allowance and
 * balance for the duration of one simulated call and nothing else. No
 * transaction is created, nothing is signed, no gas is spent.
 *
 * It is what established that the sell path was never broken: with an allowance
 * in place, orders that had been failing all along fill cleanly.
 *
 *   npm run prove:fill
 */
import 'dotenv/config';
import { ethers } from 'ethers';
import { fetchBook } from '../lib/thetanuts/book';
import { signingClient } from '../lib/thetanuts/client';
import { fromUnits } from '../lib/thetanuts/decimals';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BOOK = '0x1bDff855d6811728acaDC00989e79143a2bdfDed';

/** Must match SIZE in scripts/place-fill.ts. */
const SIZE = 10_000n;

/**
 * Circle's FiatTokenV2 keeps balances at storage slot 9 and allowances at
 * slot 10. Overriding those two slots is the smallest change that isolates
 * the allowance as the cause.
 */
const BALANCES_SLOT = '0x09';
const ALLOWED_SLOT = '0x0a';

function explain(data: string): string {
  const selector = data.slice(0, 10);
  const body = '0x' + data.slice(10);
  const abi = ethers.AbiCoder.defaultAbiCoder();
  if (selector === '0x08c379a0') return `Error("${abi.decode(['string'], body)[0]}")`;
  if (selector === '0x4e487b71') {
    return `Panic(0x${abi.decode(['uint256'], body)[0].toString(16)})`;
  }
  return `${selector} (custom error)`;
}

async function main() {
  const client = signingClient();
  const me = await client.getSignerAddress();
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453);

  const pad = (x: string) => ethers.zeroPadValue(x, 32);
  const balanceSlot = ethers.keccak256(ethers.concat([pad(me), pad(BALANCES_SLOT)]));
  const allowanceSlot = ethers.keccak256(
    ethers.concat([pad(BOOK), ethers.keccak256(ethers.concat([pad(me), pad(ALLOWED_SLOT)]))]),
  );
  const plenty = ethers.zeroPadValue('0x0de0b6b3a7640000', 32); // 1e18

  const overrides = {
    [USDC]: { stateDiff: { [balanceSlot]: plenty, [allowanceSlot]: plenty } },
  };

  const real: bigint = await client.erc20.getAllowance(USDC, me, BOOK);
  console.log(`\n  Signer            ${me}`);
  console.log(`  Real allowance    ${fromUnits(real, 6)} USDC`);
  console.log(`  Simulated as      1000000000000 USDC (state override, this call only)`);
  console.log(`  Fill size         ${fromUnits(SIZE, 6)} USDC\n`);

  const book = await fetchBook();
  const candidates = book
    .filter((i) => i.makerIsBuying && i.availableCollateral > 0n && !i.isPhysical)
    .filter((i) => i.collateral.address.toLowerCase() === USDC.toLowerCase())
    .sort((a, b) => b.expiry - a.expiry)
    .slice(0, 12);

  let fillable = 0;
  for (const instrument of candidates) {
    const tag =
      `${instrument.underlying} ${instrument.strikes.join('/')} ` +
      `${instrument.isCall ? 'Call' : 'Put'} ${instrument.structure}`;
    const expiry = new Date(instrument.expiry * 1000).toISOString().slice(0, 16);

    const encoded = (await client.optionBook.encodeFillOrder(instrument.raw, SIZE)) as
      string | { data: string };
    const data = typeof encoded === 'string' ? encoded : encoded.data;

    try {
      await provider.send('eth_call', [{ from: me, to: BOOK, data }, 'latest', overrides]);
      console.log(`  FILLS   ${tag.padEnd(38)} ${expiry}`);
      fillable++;
    } catch (error) {
      const raw = (error as { info?: { error?: { data?: string } }; data?: string })?.info?.error
        ?.data;
      const why =
        typeof raw === 'string' && raw.length > 10 ? explain(raw) : 'reverted (no revert data)';
      console.log(`  fails   ${tag.padEnd(38)} ${expiry}  ${why}`);
    }
  }

  console.log(`\n  ${fillable} of ${candidates.length} fill once the allowance exists.`);
  console.log(
    fillable > 0
      ? '  The sell path works. Run: npm run fill -- --live\n'
      : '  Nothing fillable right now; the book turns over in about a minute.\n',
  );
}

main().catch((error) => {
  console.error(`\n  ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
