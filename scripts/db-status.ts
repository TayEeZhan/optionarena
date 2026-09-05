/**
 * Report what is actually in the database.
 *
 * `drizzle-kit push` can finish quietly, and "no output" reads the same as
 * "nothing happened". This asks Postgres directly, so the answer is the
 * database's, not the tool's.
 *
 * Run it without touching .env by putting the variable in front of the command:
 *
 *   DATABASE_URL="postgresql://..." npm run db:status
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

/** Tables the app expects, and why each one matters. */
const EXPECTED: Record<string, string> = {
  strategies: 'executed and simulated strategies, and their transaction hashes',
  signals: 'trades sourced from Deribit',
  users: 'accounts, including Google sign-in',
  friendships: 'who follows whom',
  battles: 'head-to-head contests',
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      '\nNo DATABASE_URL.\n\n' +
        'Run it like this, with your Neon string in the quotes:\n' +
        '  DATABASE_URL="postgresql://..." npm run db:status\n',
    );
    process.exit(1);
  }

  const sql = neon(url);

  const rows = (await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `) as { table_name: string }[];

  const present = new Set(rows.map((r) => r.table_name));

  console.log('\nTABLES\n');
  let missing = 0;
  for (const [table, purpose] of Object.entries(EXPECTED)) {
    const there = present.has(table);
    if (!there) missing++;
    console.log(`  ${there ? 'yes' : 'NO '}  ${table.padEnd(13)} ${purpose}`);
  }

  const extra = [...present].filter((t) => !(t in EXPECTED));
  if (extra.length > 0) console.log(`\n  also present: ${extra.join(', ')}`);

  // The four columns the sign-in work added to users.
  if (present.has('users')) {
    const cols = (await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY column_name
    `) as { column_name: string }[];

    const names = cols.map((c) => c.column_name);
    const wanted = ['provider', 'provider_account_id', 'email', 'image'];
    console.log('\nUSERS COLUMNS\n');
    for (const c of wanted) {
      const there = names.includes(c);
      if (!there) missing++;
      console.log(`  ${there ? 'yes' : 'NO '}  ${c}`);
    }
  }

  // How much is actually stored, so an empty feed is never a mystery.
  if (present.has('strategies')) {
    const [{ count }] = (await sql`SELECT count(*)::int AS count FROM strategies`) as {
      count: number;
    }[];
    console.log(`\nSTRATEGIES STORED: ${count}`);
  }

  console.log(
    missing === 0
      ? '\nEverything the app expects is present.\n'
      : `\n${missing} thing(s) missing. Run: DATABASE_URL="..." npm run db:push\n`,
  );
}

main().catch((error) => {
  console.error('\nCould not read the database:', error instanceof Error ? error.message : error);
  process.exit(1);
});
