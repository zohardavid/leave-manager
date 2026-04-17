import { Router } from "express";
import { query } from "../lib/db.js";

const router = Router();

router.get("/", async (_req, res) => {
  const result = await query("SELECT name, pkal FROM soldiers ORDER BY name");
  res.json(result.rows);
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
