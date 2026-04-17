import { Router } from "express";
import { query } from "../lib/db.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { name, password } = req.body as { name?: string; password?: string };
  if (!name?.trim() || !password) {
    res.status(400).json({ error: "שם וסיסמה נדרשים" });
    return;
  }
  const result = await query(
    "SELECT * FROM soldiers WHERE name = $1 AND password = $2",
    [name.trim(), password],
  );
  if (result.rows.length === 0) {
    res.status(401).json({ error: "שם משתמש או סיסמה לא נכונים" });
    return;
  }
  const { password: _pw, ...safe } = result.rows[0] as { name: string; pkal: string; password: string };
  res.json({ soldier: safe });
});

router.post("/register", async (req, res) => {
  const { name, pkal, password, masterKey } = req.body as {
    name?: string;
    pkal?: string;
    password?: string;
    masterKey?: string;
  };
  if (!name?.trim() || !pkal || !password) {
    res.status(400).json({ error: 'שם, פק"ל וסיסמה נדרשים' });
    return;
  }
  if (pkal === "מפקד מחלקה" && masterKey !== "1234") {
    res.status(403).json({ error: "קוד מפקד שגוי" });
    return;
  }
  const existing = await query("SELECT name FROM soldiers WHERE name = $1", [name.trim()]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: "משתמש בשם זה כבר קיים" });
    return;
  }
  await query("INSERT INTO soldiers (name, pkal, password) VALUES ($1, $2, $3)", [
    name.trim(),
    pkal,
    password,
  ]);
  res.status(201).json({ soldier: { name: name.trim(), pkal } });
});

export default router;
