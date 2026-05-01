import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";

const SHEET_ID = "1B5NMEkpyVBPvv3HVcZDDFiJF0lEhoHWZ_PPy6mSah78";
const SHEET_RANGE = "A1:Z100";

const CREDS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../sheets-credentials.json",
);

// Fixed columns that map directly to DB fields
const FIXED_HEADERS: Record<string, string> = {
  "מספר אישי": "mispar_ishi",
  "צ נשק": "tzz_neshek",
  "צ כוונת": "tzz_kavanot_m5",
};

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function getRows(): Promise<string[][]> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  });
  return (res.data.values ?? []) as string[][];
}

export interface SheetSoldier {
  name: string;
  mispar_ishi: string;
  tzz_neshek: string;
  tzz_kavanot_m5: string;
  custom_fields: string;
}

export async function importFromSheet(): Promise<SheetSoldier[]> {
  const rows = await getRows();
  if (rows.length < 2) return [];

  const headers = rows[0]!;
  const result: SheetSoldier[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    const name = row[0]?.trim();
    if (!name) continue;

    const soldier: SheetSoldier = {
      name,
      mispar_ishi: "",
      tzz_neshek: "",
      tzz_kavanot_m5: "",
      custom_fields: "[]",
    };

    const customFields: { label: string; value: string }[] = [];

    headers.forEach((header, colIdx) => {
      const value = (row[colIdx] ?? "").trim();
      const headerClean = header?.trim();
      if (!headerClean || colIdx === 0) return;

      const fixedField = FIXED_HEADERS[headerClean];
      if (fixedField) {
        (soldier as unknown as Record<string, string>)[fixedField] = value;
      } else if (value) {
        customFields.push({ label: headerClean, value });
      }
    });

    soldier.custom_fields = JSON.stringify(customFields);
    result.push(soldier);
  }

  return result;
}

export async function syncSoldierToSheet(
  name: string,
  data: { mispar_ishi?: string; tzz_neshek?: string; tzz_kavanot_m5?: string; custom_fields?: string },
): Promise<void> {
  const sheets = await getSheets();
  const rows = await getRows();
  if (rows.length < 2) return;

  const headers = rows[0]!;
  const rowIdx = rows.findIndex((r, i) => i > 0 && r[0]?.trim() === name);
  if (rowIdx === -1) return;

  const sheetRow = rowIdx + 1;
  const updates: { range: string; values: string[][] }[] = [];

  const customFields: { label: string; value: string }[] = data.custom_fields
    ? (JSON.parse(data.custom_fields) as { label: string; value: string }[])
    : [];

  headers.forEach((header, colIdx) => {
    const headerClean = header?.trim();
    if (!headerClean || colIdx === 0) return;

    const col = colToLetter(colIdx);
    const fixedField = FIXED_HEADERS[headerClean];

    if (fixedField && data[fixedField as keyof typeof data] !== undefined) {
      updates.push({ range: `${col}${sheetRow}`, values: [[data[fixedField as keyof typeof data] as string]] });
    } else {
      const cf = customFields.find((f) => f.label === headerClean);
      if (cf) {
        updates.push({ range: `${col}${sheetRow}`, values: [[cf.value]] });
      }
    }
  });

  if (updates.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: "RAW", data: updates },
  });
}

function colToLetter(idx: number): string {
  let result = "";
  let n = idx;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}
