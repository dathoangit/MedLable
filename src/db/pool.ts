import { resolve } from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({
  path: resolve(process.cwd(), '.env'),
  override: true
});

export type PoolInitOptions = {
  statementTimeoutMs: number;
};

let pool: pg.Pool | null = null;

function logPoolError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error('MedLabel pool error:', message);
}

/**
 * Create the shared Postgres pool. Call once at process start (server or CLI).
 * Idle client errors are logged; they must not crash the process.
 */
export function initPool(options: PoolInitOptions): pg.Pool {
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

  if (
    !Number.isInteger(options.statementTimeoutMs) ||
    options.statementTimeoutMs < 1
  ) {
    throw new Error(
      `Invalid statementTimeoutMs "${options.statementTimeoutMs}". Expected a positive integer.`
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
    idleTimeoutMillis: 30_000,
    options: `-c statement_timeout=${options.statementTimeoutMs}`
  });

  pool.on('error', (error) => {
    logPoolError(error);
  });

  return pool;
}

export function getPool(): pg.Pool {
  if (!pool) {
    throw new Error('Postgres pool not initialized. Call initPool() first.');
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}
