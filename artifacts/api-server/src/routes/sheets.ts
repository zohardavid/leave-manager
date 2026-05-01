import { Router } from "express";
import { importFromSheet } from "../lib/sheets.js";
import { query } from "../lib/db.js";

const router = Router();

router.post("/sync", async (_req, res) => {
  try {
    const soldiers = await importFromSheet();
    let updated = 0;
    for (const s of soldiers) {
      const result = await query(
        `UPDATE soldiers
         SET mispar_ishi=$1, tzz_neshek=$2, tzz_kavanot_m5=$3, custom_fields=$4
         WHERE name=$5`,
        [s.mispar_ishi, s.tzz_neshek, s.tzz_kavanot_m5, s.custom_fields, s.name],
      );
      if (result.rowCount && result.rowCount > 0) updated++;
    }
    res.json({ ok: true, updated });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
