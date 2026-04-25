import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../lib/db.js";
import { notifyCommanders } from "../lib/push.js";

const router = Router();

function signToken(name: string, pkal: string): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET not configured");
  return jwt.sign({ name, pkal }, secret, { expiresIn: "30d" });
}

router.post("/login", async (req, res) => {
  const { name, password } = req.body as { name?: string; password?: string };
  if (!name?.trim() || !password) {
    res.status(400).json({ error: "שם וסיסמה נדרשים" });
    return;
  }
  const result = await query(
    "SELECT name, pkal, password, pwd_hashed FROM soldiers WHERE name = $1",
    [name.trim()],
  );
  if (result.rows.length === 0) {
    res.status(401).json({ error: "שם משתמש או סיסמה לא נכונים" });
    return;
  }
  const row = result.rows[0] as { name: string; pkal: string; password: string; pwd_hashed: boolean };

  let valid = false;
  if (row.pwd_hashed) {
    valid = await bcrypt.compare(password, row.password);
  } else {
    // migrate plaintext password on first login
    valid = password === row.password;
    if (valid) {
      const hashed = await bcrypt.hash(password, 12);
      await query("UPDATE soldiers SET password = $1, pwd_hashed = true WHERE name = $2", [hashed, row.name]);
    }
  }

  if (!valid) {
    res.status(401).json({ error: "שם משתמש או סיסמה לא נכונים" });
    return;
  }

  const token = signToken(row.name, row.pkal);
  res.json({ soldier: { name: row.name, pkal: row.pkal }, token });
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
  if (pkal === "מפקד מחלקה") {
    const commanderKey = process.env["COMMANDER_KEY"];
    if (!commanderKey || masterKey !== commanderKey) {
      res.status(403).json({ error: "קוד מפקד שגוי" });
      return;
    }
  }
  const existing = await query("SELECT name FROM soldiers WHERE name = $1", [name.trim()]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: "משתמש בשם זה כבר קיים" });
    return;
  }
  const hashed = await bcrypt.hash(password, 12);
  await query(
    "INSERT INTO soldiers (name, pkal, password, pwd_hashed) VALUES ($1, $2, $3, true)",
    [name.trim(), pkal, hashed],
  );
  void notifyCommanders("חייל חדש נרשם 🪖", `${name.trim()} (${pkal}) הצטרף למערכת`);
  const token = signToken(name.trim(), pkal);
  res.status(201).json({ soldier: { name: name.trim(), pkal }, token });
});

export default router;
