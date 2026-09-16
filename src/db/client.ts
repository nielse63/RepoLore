/**
 * Shared Postgres connection pool. A lazily-created singleton so both the
 * migration runner and, from session 10 on, application persistence code
 * reuse one pool instead of opening a fresh connection per call.
 */

import { Pool } from "pg";

let pool: Pool | undefined;

export function getDbPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "No DATABASE_URL is configured. Set DATABASE_URL in .env.local (see .env.example)."
    );
  }

  pool = new Pool({ connectionString });
  return pool;
}
