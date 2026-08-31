/**
 * Prove the signal pipeline end to end, against live Deribit and live Thetanuts.
 *
 * Needs no keys. Run it to see what each definition of "winning" surfaces and
 * how well it maps onto contracts Thetanuts can actually fill:
 *
 *   npm run signals
 *   npm run signals -- --criterion bigMoney --currency BTC
 */
import 'dotenv/config';

import { fetchRecentTrades } from '../lib/signals/sources/deribit';
import { rank, criteriaList } from '../lib/signals/rank';
import { mapSignals } from '../lib/signals/map';
import { WINNING_CRITERIA, type WinningCriterion } from '../lib/signals/types';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const currency = (arg('--currency') ?? 'ETH').toUpperCase() as 'ETH' | 'BTC';
  const criterion = (arg('--criterion') ?? 'inProfit') as WinningCriterion;

  if (!(criterion in WINNING_CRITERIA)) {
    console.error(
      `Unknown criterion. Choose one of: ${criteriaList()
        .map((c) => c.key)
        .join(', ')}`,
    );
    process.exit(1);
  }

  console.log(`\nSourcing ${currency} option flow from Deribit...`);
  const trades = await fetchRecentTrades(currency, 500);
  console.log(`  ${trades.length} live, unexpired trades`);

  console.log(`\nRanking by "${WINNING_CRITERIA[criterion].label}"`);
  console.log(`  ${WINNING_CRITERIA[criterion].explain}\n`);

  const ranked = rank(trades, criterion, 8);
  if (ranked.length === 0) {
    console.log('  Nothing scored under this criterion right now.');
    return;
  }

  const mapped = await mapSignals(ranked);

  let exact = 0;
  let unavailable = 0;

  for (const m of mapped) {
    const s = m.signal;
    console.log(
      `  ${s.venueInstrument.padEnd(22)} ${s.direction.padEnd(4)} $${Math.round(s.notionalUsd).toLocaleString('en-US').padStart(9)}`,
    );
    console.log(`     ${s.why}`);

    if (!m.instrument) {
      unavailable++;
      console.log(`     -> cannot copy: ${m.unavailable}`);
    } else if (m.exact) {
      exact++;
      console.log(
        `     -> EXACT match on Thetanuts: ${m.instrument.underlying} ${m.instrument.strikes[0]} put`,
      );
    } else {
      console.log(`     -> closest Thetanuts contract, with differences:`);
      for (const d of m.differences) console.log(`        - ${d}`);
    }
    console.log();
  }

  console.log(
    `Summary: ${exact} exact, ${mapped.length - exact - unavailable} approximate, ${unavailable} not copyable.`,
  );
}

main().catch((error) => {
  console.error('\nFailed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
