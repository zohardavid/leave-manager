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

export function getClient() {
  return getPool().connect();
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
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      target TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await query(`
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS departure_time TEXT NOT NULL DEFAULT '';
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS return_time TEXT NOT NULL DEFAULT '';
  `);
}
