import { getDbPool } from './client';

export interface RepoRow {
  id: number;
  owner: string;
  name: string;
  createdAt: string;
}

interface RepoRawRow {
  id: string;
  owner: string;
  name: string;
  created_at: string;
}

function mapRow(row: RepoRawRow): RepoRow {
  return {
    id: Number(row.id),
    owner: row.owner,
    name: row.name,
    createdAt: row.created_at,
  };
}

/**
 * Inserts a repo row if one doesn't already exist for `(owner, name)`, and
 * always returns it either way — an upsert, not a plain insert, since
 * `resolveRepositoryHead` is checked on every submission regardless of
 * whether the repo's been seen before.
 */
export async function upsertRepo(
  owner: string,
  name: string
): Promise<RepoRow> {
  const pool = getDbPool();
  const { rows } = await pool.query<RepoRawRow>(
    `INSERT INTO repos (owner, name)
     VALUES ($1, $2)
     ON CONFLICT (owner, name) DO UPDATE SET owner = EXCLUDED.owner
     RETURNING id, owner, name, created_at`,
    [owner, name]
  );
  return mapRow(rows[0]);
}
