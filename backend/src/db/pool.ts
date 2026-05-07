import pg from "pg";

const { Pool } = pg;

let _pool: pg.Pool | undefined;

export function getPool() {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  _pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000
  });

  return _pool;
}

