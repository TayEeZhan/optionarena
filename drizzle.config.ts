import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle configuration.
 *
 * Only needed when using Postgres. Provision a free database on Neon or
 * Supabase, put the connection string in DATABASE_URL, then:
 *
 *   npm run db:push     apply the schema
 *   npm run db:studio   browse the data
 */
export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  verbose: true,
  strict: true,
});
