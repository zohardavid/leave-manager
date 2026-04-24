import pg from "pg";

const { Pool } = pg;

let pool: InstanceType<typeof Pool> | null = null;

function getPool(): InstanceType<typeof Pool> {
  if (!pool) {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL is required");
    pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

export function query(text: string, params?: unknown[]) {
  return getPool().query(text, params);
}

export async function initDb(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS soldiers (
      name TEXT PRIMARY KEY,
      pkal TEXT NOT NULL,
      password TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      soldier_name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      submitted_at TEXT NOT NULL,
      commander_note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS swaps (
      id SERIAL PRIMARY KEY,
      requester TEXT NOT NULL,
      partner TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      submitted_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      soldier_name TEXT PRIMARY KEY,
      pkal TEXT NOT NULL,
      subscription JSONB NOT NULL
    );
  `);
}
