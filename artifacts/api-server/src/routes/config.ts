import { Router } from "express";
import { query } from "../lib/db.js";

const router = Router();

router.get("/", async (_req, res) => {
  const result = await query("SELECT key, value FROM config");
  const cfg: Record<string, string> = {};
  for (const row of result.rows as { key: string; value: string }[]) cfg[row.key] = row.value;
  res.json(cfg);
});

router.put("/:key", async (req, res) => {
  const key = decodeURIComponent(req.params["key"] ?? "");
  const { value } = req.body as { value?: string };
  if (!key || value === undefined) { res.status(400).json({ error: "חסר מפתח או ערך" }); return; }
  await query(
    "INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [key, value],
  );
  res.json({ ok: true });
});

export default router;
