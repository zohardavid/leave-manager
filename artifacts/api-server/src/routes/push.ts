import { Router } from "express";
import { query } from "../lib/db.js";
import { vapidPublicKey } from "../lib/push.js";

const router = Router();

router.get("/vapid-key", (_req, res) => {
  const key = vapidPublicKey();
  if (!key) {
    res.status(503).json({ error: "Push not configured" });
    return;
  }
  res.json({ key });
});

router.post("/subscribe", async (req, res) => {
  const { soldier_name, pkal, subscription } = req.body as {
    soldier_name?: string;
    pkal?: string;
    subscription?: unknown;
  };
  if (!soldier_name || !pkal || !subscription) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }
  await query(
    `INSERT INTO subscriptions (soldier_name, pkal, subscription)
     VALUES ($1, $2, $3)
     ON CONFLICT (soldier_name) DO UPDATE SET subscription = $3, pkal = $2`,
    [soldier_name, pkal, JSON.stringify(subscription)],
  );
  res.status(201).end();
});

router.delete("/subscribe", async (req, res) => {
  const { soldier_name } = req.body as { soldier_name?: string };
  if (!soldier_name) {
    res.status(400).json({ error: "Missing soldier_name" });
    return;
  }
  await query("DELETE FROM subscriptions WHERE soldier_name = $1", [soldier_name]);
  res.status(204).end();
});

export default router;
