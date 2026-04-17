import { Router } from "express";
import { query } from "../lib/db.js";

const router = Router();

router.get("/", async (req, res) => {
  const { soldier } = req.query as { soldier?: string };
  const result = soldier
    ? await query("SELECT * FROM requests WHERE soldier_name = $1 ORDER BY submitted_at DESC", [soldier])
    : await query("SELECT * FROM requests ORDER BY submitted_at DESC");
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { soldier_name, start_date, end_date, reason } = req.body as {
    soldier_name?: string;
    start_date?: string;
    end_date?: string;
    reason?: string;
  };
  if (!soldier_name || !start_date || !end_date || !reason?.trim()) {
    res.status(400).json({ error: "כל השדות נדרשים" });
    return;
  }
  if (new Date(end_date) < new Date(start_date)) {
    res.status(400).json({ error: "תאריך סיום לפני תאריך התחלה" });
    return;
  }
  const overlap = await query(
    `SELECT id FROM requests WHERE soldier_name = $1 AND status != 'Denied'
     AND NOT (end_date < $2 OR start_date > $3)`,
    [soldier_name, start_date, end_date],
  );
  if ((overlap.rowCount ?? 0) > 0) {
    res.status(409).json({ error: "קיימת בקשה חופפת בתאריכים אלו" });
    return;
  }
  const result = await query(
    `INSERT INTO requests (soldier_name, start_date, end_date, reason, status, submitted_at, commander_note)
     VALUES ($1, $2, $3, $4, 'Pending', $5, '') RETURNING *`,
    [soldier_name, start_date, end_date, reason.trim(), new Date().toISOString().slice(0, 10)],
  );
  res.status(201).json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const { status, commander_note } = req.body as {
    status?: string;
    commander_note?: string;
  };
  const result = await query(
    `UPDATE requests SET
       status = COALESCE($1, status),
       commander_note = COALESCE($2, commander_note)
     WHERE id = $3 RETURNING *`,
    [status ?? null, commander_note ?? null, id],
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "בקשה לא נמצאה" });
    return;
  }
  res.json(result.rows[0]);
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const { start_date, end_date, reason } = req.body as {
    start_date?: string;
    end_date?: string;
    reason?: string;
  };
  const result = await query(
    `UPDATE requests SET
       start_date = COALESCE($1, start_date),
       end_date = COALESCE($2, end_date),
       reason = COALESCE($3, reason),
       status = 'Pending',
       commander_note = ''
     WHERE id = $4 RETURNING *`,
    [start_date ?? null, end_date ?? null, reason?.trim() ?? null, id],
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "בקשה לא נמצאה" });
    return;
  }
  res.json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const result = await query("DELETE FROM requests WHERE id = $1", [id]);
  if ((result.rowCount ?? 0) === 0) {
    res.status(404).json({ error: "בקשה לא נמצאה" });
    return;
  }
  res.status(204).end();
});

export default router;
