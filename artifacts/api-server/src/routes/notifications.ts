import { Router } from "express";
import { query } from "../lib/db.js";
import { notifyAll, notifySoldier, notifyCommanders } from "../lib/push.js";

const router = Router();

router.get("/", async (_req, res) => {
  const result = await query("SELECT * FROM notifications ORDER BY sent_at DESC LIMIT 200");
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { target, title, body } = req.body as {
    target?: string;
    title?: string;
    body?: string;
  };
  if (!target || !title?.trim() || !body?.trim()) {
    res.status(400).json({ error: "כל השדות נדרשים" });
    return;
  }
  if (target === "all") {
    await notifyAll(title.trim(), body.trim());
  } else if (target === "commanders") {
    await notifyCommanders(title.trim(), body.trim());
  } else {
    await notifySoldier(target, title.trim(), body.trim());
  }
  res.status(201).json({ ok: true });
});

export default router;
