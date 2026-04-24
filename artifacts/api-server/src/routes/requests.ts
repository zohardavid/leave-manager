import { Router } from "express";
import { query } from "../lib/db.js";
import { notifyCommanders, notifySoldier } from "../lib/push.js";

const router = Router();

router.get("/", async (req, res) => {
  const { soldier } = req.query as { soldier?: string };
  const result = soldier
    ? await query("SELECT * FROM requests WHERE soldier_name = $1 ORDER BY submitted_at DESC", [soldier])
    : await query("SELECT * FROM requests ORDER BY submitted_at DESC");
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { soldier_name, start_date, end_date, reason, departure_time, return_time } = req.body as {
    soldier_name?: string;
    start_date?: string;
    end_date?: string;
    reason?: string;
    departure_time?: string;
    return_time?: string;
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
    `INSERT INTO requests (soldier_name, start_date, end_date, reason, status, submitted_at, commander_note, departure_time, return_time)
     VALUES ($1, $2, $3, $4, 'Pending', $5, '', $6, $7) RETURNING *`,
    [soldier_name, start_date, end_date, reason.trim(), new Date().toISOString().slice(0, 10), departure_time ?? '', return_time ?? ''],
  );
  const req2 = result.rows[0] as { soldier_name: string; start_date: string; end_date: string };
  void notifyCommanders("בקשת יציאה חדשה 📋", `${req2.soldier_name} ביקש יציאה ${req2.start_date} – ${req2.end_date}`);
  res.status(201).json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const { status, commander_note, departure_time, return_time } = req.body as {
    status?: string;
    commander_note?: string;
    departure_time?: string;
    return_time?: string;
  };
  const result = await query(
    `UPDATE requests SET
       status = COALESCE($1, status),
       commander_note = COALESCE($2, commander_note),
       departure_time = COALESCE($3, departure_time),
       return_time = COALESCE($4, return_time)
     WHERE id = $5 RETURNING *`,
    [status ?? null, commander_note ?? null, departure_time ?? null, return_time ?? null, id],
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "בקשה לא נמצאה" });
    return;
  }
  const updated = result.rows[0] as { soldier_name: string; status: string };
  if (status === "Approved") {
    void notifySoldier(updated.soldier_name, "הבקשה אושרה ✅", "בקשת היציאה שלך אושרה על ידי המפקד");
  } else if (status === "Denied") {
    void notifySoldier(updated.soldier_name, "הבקשה נדחתה ❌", "בקשת היציאה שלך נדחתה על ידי המפקד");
  }
  res.json(result.rows[0]);
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const { start_date, end_date, reason, departure_time, return_time } = req.body as {
    start_date?: string;
    end_date?: string;
    reason?: string;
    departure_time?: string;
    return_time?: string;
  };
  const result = await query(
    `UPDATE requests SET
       start_date = COALESCE($1, start_date),
       end_date = COALESCE($2, end_date),
       reason = COALESCE($3, reason),
       departure_time = COALESCE($4, departure_time),
       return_time = COALESCE($5, return_time),
       status = 'Pending',
       commander_note = ''
     WHERE id = $6 RETURNING *`,
    [start_date ?? null, end_date ?? null, reason?.trim() ?? null, departure_time ?? null, return_time ?? null, id],
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
