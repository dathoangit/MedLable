import { resolve } from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({
  path: resolve(process.cwd(), '.env'),
  override: true
});

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) {
    return pool;
  }

  const host = process.env.PGHOST;
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;

  if (!host || !database || !user || password === undefined) {
    throw new Error(
      'Missing Postgres env: PGHOST, PGDATABASE, PGUSER, PGPASSWORD'
    );
  }

  pool = new pg.Pool({
    host,
    port: Number(process.env.PGPORT || 5432),
    database,
    user,
    password,
    max: 4,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000
  });

  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}
