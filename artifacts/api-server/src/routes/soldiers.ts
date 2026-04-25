import { Router } from "express";
import { query, getClient } from "../lib/db.js";

const router = Router();

router.get("/", async (_req, res) => {
  const result = await query(
    "SELECT name, pkal, mispar_ishi, tzz_neshek, tzz_kavanot2, tzz_kavanot_m5, tzz_amrel, tzz_kesher, tzz_nosaf, tzz_extra1, tzz_extra2, tzz_extra3 FROM soldiers ORDER BY name",
  );
  res.json(result.rows);
});

router.put("/:name", async (req, res) => {
  const oldName = decodeURIComponent(req.params["name"] ?? "");
  const { name, pkal, password, mispar_ishi, tzz_neshek, tzz_kavanot2, tzz_kavanot_m5, tzz_amrel, tzz_kesher, tzz_nosaf, tzz_extra1, tzz_extra2, tzz_extra3 } = req.body as {
    name?: string;
    pkal?: string;
    password?: string;
    mispar_ishi?: string;
    tzz_neshek?: string;
    tzz_kavanot2?: string;
    tzz_kavanot_m5?: string;
    tzz_amrel?: string;
    tzz_kesher?: string;
    tzz_nosaf?: string;
    tzz_extra1?: string;
    tzz_extra2?: string;
    tzz_extra3?: string;
  };
  const newName = name?.trim() || oldName;
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (name?.trim()) { setClauses.push(`name = $${i++}`); params.push(name.trim()); }
  if (pkal?.trim()) { setClauses.push(`pkal = $${i++}`); params.push(pkal.trim()); }
  if (password?.trim()) { setClauses.push(`password = $${i++}`); params.push(password.trim()); }
  if (mispar_ishi !== undefined) { setClauses.push(`mispar_ishi = $${i++}`); params.push(mispar_ishi); }
  if (tzz_neshek !== undefined) { setClauses.push(`tzz_neshek = $${i++}`); params.push(tzz_neshek); }
  if (tzz_kavanot2 !== undefined) { setClauses.push(`tzz_kavanot2 = $${i++}`); params.push(tzz_kavanot2); }
  if (tzz_kavanot_m5 !== undefined) { setClauses.push(`tzz_kavanot_m5 = $${i++}`); params.push(tzz_kavanot_m5); }
  if (tzz_amrel !== undefined) { setClauses.push(`tzz_amrel = $${i++}`); params.push(tzz_amrel); }
  if (tzz_kesher !== undefined) { setClauses.push(`tzz_kesher = $${i++}`); params.push(tzz_kesher); }
  if (tzz_nosaf !== undefined) { setClauses.push(`tzz_nosaf = $${i++}`); params.push(tzz_nosaf); }
  if (tzz_extra1 !== undefined) { setClauses.push(`tzz_extra1 = $${i++}`); params.push(tzz_extra1); }
  if (tzz_extra2 !== undefined) { setClauses.push(`tzz_extra2 = $${i++}`); params.push(tzz_extra2); }
  if (tzz_extra3 !== undefined) { setClauses.push(`tzz_extra3 = $${i++}`); params.push(tzz_extra3); }
  if (setClauses.length === 0) {
    res.status(400).json({ error: "אין שינויים" });
    return;
  }
  params.push(oldName);
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE soldiers SET ${setClauses.join(", ")} WHERE name = $${i} RETURNING name, pkal, mispar_ishi, tzz_neshek, tzz_kavanot2, tzz_kavanot_m5, tzz_amrel, tzz_kesher, tzz_nosaf, tzz_extra1, tzz_extra2, tzz_extra3`,
      params,
    );
    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "חייל לא נמצא" });
      return;
    }
    if (newName !== oldName) {
      await client.query("UPDATE requests SET soldier_name = $1 WHERE soldier_name = $2", [newName, oldName]);
      await client.query("UPDATE swaps SET requester = $1 WHERE requester = $2", [newName, oldName]);
      await client.query("UPDATE swaps SET partner = $1 WHERE partner = $2", [newName, oldName]);
      await client.query("UPDATE subscriptions SET soldier_name = $1 WHERE soldier_name = $2", [newName, oldName]);
    }
    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

router.delete("/:name", async (req, res) => {
  const name = decodeURIComponent(req.params["name"] ?? "");
  const result = await query("DELETE FROM soldiers WHERE name = $1", [name]);
  if ((result.rowCount ?? 0) === 0) {
    res.status(404).json({ error: "חייל לא נמצא" });
    return;
  }
  res.status(204).end();
});

export default router;
