/**
 * Apply the schema over HTTP, when `drizzle-kit push` cannot.
 *
 * `drizzle-kit push` connects to Neon over a **websocket**. On a network that
 * blocks websockets it prints "Pulling schema from database..." and then exits
 * silently, having done nothing, which is indistinguishable from success. The
 * `neon()` driver used here speaks plain HTTPS, which works anywhere a browser
 * does.
 *
 * Every statement is idempotent: `IF NOT EXISTS` throughout, and nothing here
 * drops, alters or deletes an existing column. Running it twice is safe, and it
 * cannot destroy data even if run against the wrong database.
 *
 *   DATABASE_URL="postgresql://..." npm run db:migrate
 *
 * This mirrors `lib/db/schema.ts` BY HAND, and only covers what has been added
 * since the database was first created: `strategies` and `signals` are absent
 * on purpose because they already exist. On a fresh database use
 * `npm run db:push`, which reads the schema directly.
 *
 * **When a table is added to `schema.ts`, add it here too.** `calls` was added
 * in one place and not the other, which meant `db:migrate` would have skipped
 * it silently on exactly the networks that need `db:migrate` in the first
 * place. Run `npm run db:status` afterwards; that is what it is for.
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const STATEMENTS: [label: string, sql: string][] = [
  ['users.provider', `ALTER TABLE users ADD COLUMN IF NOT EXISTS provider text`],
  [
    'users.provider_account_id',
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_account_id text`,
  ],
  ['users.email', `ALTER TABLE users ADD COLUMN IF NOT EXISTS email text`],
  ['users.image', `ALTER TABLE users ADD COLUMN IF NOT EXISTS image text`],
  [
    'users_provider_account_idx',
    `CREATE INDEX IF NOT EXISTS users_provider_account_idx ON users (provider_account_id)`,
  ],
  [
    'friendships',
    `CREATE TABLE IF NOT EXISTS friendships (
       owner       text   NOT NULL,
       friend      text   NOT NULL,
       created_at  bigint NOT NULL
     )`,
  ],
  [
    'friendships_owner_idx',
    `CREATE INDEX IF NOT EXISTS friendships_owner_idx ON friendships (owner)`,
  ],
  [
    'friendships_friend_idx',
    `CREATE INDEX IF NOT EXISTS friendships_friend_idx ON friendships (friend)`,
  ],
  [
    'battles',
    `CREATE TABLE IF NOT EXISTS battles (
       id                       text   PRIMARY KEY,
       created_at               bigint NOT NULL,
       challenger               text   NOT NULL,
       opponent                 text   NOT NULL,
       challenger_strategy_id   text   NOT NULL,
       opponent_strategy_id     text   NOT NULL,
       resolves_at              bigint NOT NULL,
       winner                   text,
       resolved_at              bigint,
       settlement               jsonb
     )`,
  ],
  [
    'battles_challenger_idx',
    `CREATE INDEX IF NOT EXISTS battles_challenger_idx ON battles (challenger)`,
  ],
  ['battles_opponent_idx', `CREATE INDEX IF NOT EXISTS battles_opponent_idx ON battles (opponent)`],
  [
    'calls',
    `CREATE TABLE IF NOT EXISTS calls (
       id            text   PRIMARY KEY,
       handle        text   NOT NULL,
       pair_key      text   NOT NULL,
       created_at    bigint NOT NULL,
       picked        text   NOT NULL,
       "left"        jsonb  NOT NULL,
       "right"       jsonb  NOT NULL,
       resolves_at   bigint NOT NULL,
       winner        text,
       resolved_at   bigint,
       settlement    jsonb
     )`,
  ],
  ['calls_handle_idx', `CREATE INDEX IF NOT EXISTS calls_handle_idx ON calls (handle)`],
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      '\nNo DATABASE_URL.\n\n' +
        'Run it like this, with your Neon string in the quotes:\n' +
        '  DATABASE_URL="postgresql://..." npm run db:migrate\n',
    );
    process.exit(1);
  }

  const sql = neon(url);
  console.log('\nApplying schema over HTTPS. Nothing here drops or deletes.\n');

  let failed = 0;
  for (const [label, statement] of STATEMENTS) {
    try {
      await sql.query(statement);
      console.log(`  ok    ${label}`);
    } catch (error) {
      failed++;
      console.log(`  FAIL  ${label}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(
    failed === 0
      ? '\nDone. Run `npm run db:status` to confirm.\n'
      : `\n${failed} statement(s) failed. Nothing was dropped; fix and run again.\n`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('\nCould not reach the database:', error instanceof Error ? error.message : error);
  process.exit(1);
});
