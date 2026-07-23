/**
 * Applies pending SQL migrations from src/db/migrations/, in filename
 * order, tracking what's applied in a schema_migrations table. No migration
 * framework (node-pg-migrate, Prisma, ...) — two tables and a handful of
 * migrations don't yet justify one; a reversible, low-dependency decision,
 * not a load-bearing one.
 *
 * Usage: npm run migrate
 * Requires DATABASE_URL (see .env.example); already loads .env.local if
 * present, and `docker compose up -d db` for a local Postgres.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { getDbPool } from '../src/db/client';

const MIGRATIONS_DIR = path.join(process.cwd(), 'src/db/migrations');

async function main() {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations'
    );
    const applied = new Set(rows.map((row) => row.filename));

    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith('.sql'))
      .sort();
    const pending = files.filter((file) => !applied.has(file));

    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    for (const file of pending) {
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');
      console.log(`Applying ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log(`Applied ${pending.length} migration(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
