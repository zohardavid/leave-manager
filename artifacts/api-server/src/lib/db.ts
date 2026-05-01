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
    CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
  `);
  await query(`
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS departure_time TEXT NOT NULL DEFAULT '';
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS return_time TEXT NOT NULL DEFAULT '';
    ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS pwd_hashed BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS mispar_ishi TEXT NOT NULL DEFAULT '';
    ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS tzz_neshek TEXT NOT NULL DEFAULT '';
    ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS tzz_kavanot2 TEXT NOT NULL DEFAULT '';
    ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS tzz_kavanot_m5 TEXT NOT NULL DEFAULT '';
    ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS tzz_amrel TEXT NOT NULL DEFAULT '';
    ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS tzz_kesher TEXT NOT NULL DEFAULT '';
    ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS tzz_nosaf TEXT NOT NULL DEFAULT '';
    ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS tzz_extra1 TEXT NOT NULL DEFAULT '';
    ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS tzz_extra2 TEXT NOT NULL DEFAULT '';
    ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS tzz_extra3 TEXT NOT NULL DEFAULT '';
    ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS field_labels TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE soldiers ADD COLUMN IF NOT EXISTS custom_fields TEXT NOT NULL DEFAULT '[]';
  `);
  await query(`
    UPDATE soldiers SET custom_fields = (
      '[]'::jsonb
      || CASE WHEN tzz_kavanot2 != '' THEN jsonb_build_array(jsonb_build_object('label', E'\\u05DB\\u05D5\\u05D5\\u05E0\\u05EA 2', 'value', tzz_kavanot2)) ELSE '[]'::jsonb END
      || CASE WHEN tzz_amrel  != '' THEN jsonb_build_array(jsonb_build_object('label', E'\\u05D0\\u05DE\\u05E8\\u05DC',         'value', tzz_amrel))  ELSE '[]'::jsonb END
      || CASE WHEN tzz_kesher != '' THEN jsonb_build_array(jsonb_build_object('label', E'\\u05E7\\u05E9\\u05E8',               'value', tzz_kesher)) ELSE '[]'::jsonb END
      || CASE WHEN tzz_nosaf  != '' THEN jsonb_build_array(jsonb_build_object('label', E'\\u05E0\\u05D5\\u05E1\\u05E3',        'value', tzz_nosaf))  ELSE '[]'::jsonb END
    )::text
    WHERE custom_fields = '[]' AND (tzz_kavanot2 != '' OR tzz_amrel != '' OR tzz_kesher != '' OR tzz_nosaf != '');
  `);
  await query(`
    UPDATE soldiers SET mispar_ishi='8559767', tzz_neshek='933600', tzz_kavanot_m5='26082' WHERE name='נעם מוסקוביץ' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8252735', tzz_neshek='936528', tzz_kavanot_m5='24479', tzz_amrel='78090' WHERE name='זהר דוד' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8701664', tzz_neshek='41210625', tzz_kavanot_m5='34265', tzz_amrel='6789' WHERE name='אריאל אדלר' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8636731', tzz_neshek='43850366', tzz_kavanot_m5='43268', tzz_amrel='96296' WHERE name='איתמר נתן' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8621860', tzz_neshek='934059', tzz_kavanot_m5='26646', tzz_kavanot2='24022994', tzz_amrel='74330905' WHERE name='יאיר כהן' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8660375', tzz_neshek='933629', tzz_kavanot_m5='29075', tzz_amrel='5042183' WHERE name='נוה קופלנד' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8647834', tzz_neshek='933233', tzz_kavanot_m5='29359' WHERE name='יקיר ברמן' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8638383', tzz_neshek='5263027', tzz_kavanot_m5='20325', tzz_amrel='3241402' WHERE name='עידן מושקין' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8698234', tzz_neshek='98500386', tzz_kavanot_m5='24573', tzz_amrel='6778' WHERE name=E'יאיר אברג׳ל' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8641498', tzz_neshek='925634', tzz_kavanot_m5='26076' WHERE name='ישיב וינברג' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8712928', tzz_neshek='6202642' WHERE name='עקיבא פרלוב' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8660339', tzz_neshek='935531', tzz_kavanot_m5='26593', tzz_kavanot2='פק860404', tzz_amrel='74330972' WHERE name='איתם רסקין' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8761204', tzz_neshek='933145', tzz_kavanot_m5='26609' WHERE name='יונתן נגן' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8680263', tzz_neshek='934063', tzz_kavanot_m5='24071', tzz_amrel='74330922' WHERE name='איתי קיין' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8689235', tzz_neshek='42853920', tzz_kavanot_m5='26162' WHERE name='אביעד מלצר' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8701118', tzz_neshek='935697', tzz_kavanot_m5='25954', tzz_kavanot2='24023181', tzz_amrel='5052258' WHERE name='מנחם זלינגר' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8695991', tzz_neshek='933852', tzz_kavanot_m5='29324', tzz_amrel='2035118' WHERE name='איתי הומינר' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8707576', tzz_neshek='5137456', tzz_kavanot_m5='706269' WHERE name='בארי אייזן' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8626972', tzz_neshek='49158563', tzz_kavanot_m5='318177', tzz_kavanot2='933852', tzz_amrel='5052338' WHERE name='נדב חדד' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8673397', tzz_neshek='934312', tzz_kavanot_m5='24138' WHERE name='אליעד שויבר' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8640535', tzz_neshek='933120', tzz_kavanot_m5='24699', tzz_kavanot2='100080494' WHERE name='דובי ליכטנשטיין' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8664944', tzz_neshek='5237256', tzz_kavanot_m5='8085', tzz_kavanot2='96297', tzz_amrel='96203' WHERE name='נעמן בן גדליה' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8673554', tzz_neshek='5042683', tzz_kavanot_m5='8229', tzz_amrel='6297' WHERE name='רועי טרנר' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8693671', tzz_neshek='5613869', tzz_kavanot_m5='723440' WHERE name='אור לוי' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8677609', tzz_neshek='934207', tzz_kavanot_m5='29562' WHERE name='מתניה צינקין' AND mispar_ishi='';
    UPDATE soldiers SET mispar_ishi='8545728' WHERE name='יאיר היימן' AND mispar_ishi='';
  `);
}
