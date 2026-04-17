import { Router } from "express";
import { query } from "../lib/db.js";

const router = Router();

router.get("/", async (_req, res) => {
  const result = await query("SELECT * FROM swaps ORDER BY submitted_at DESC");
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { requester, partner, start_date, end_date } = req.body as {
    requester?: string;
    partner?: string;
    start_date?: string;
    end_date?: string;
  };
  if (!requester || !partner || !start_date || !end_date) {
    res.status(400).json({ error: "כל השדות נדרשים" });
    return;
  }
  if (new Date(end_date) < new Date(start_date)) {
    res.status(400).json({ error: "תאריך סיום לפני תאריך התחלה" });
    return;
  }
  const result = await query(
    `INSERT INTO swaps (requester, partner, start_date, end_date, status, submitted_at)
     VALUES ($1, $2, $3, $4, 'Pending', $5) RETURNING *`,
    [requester, partner, start_date, end_date, new Date().toISOString().slice(0, 10)],
  );
  res.status(201).json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const { status } = req.body as { status?: string };
  if (!status) {
    res.status(400).json({ error: "סטטוס נדרש" });
    return;
  }
  const result = await query(
    "UPDATE swaps SET status = $1 WHERE id = $2 RETURNING *",
    [status, id],
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "החלפה לא נמצאה" });
    return;
  }
  res.json(result.rows[0]);
});

export default router;
