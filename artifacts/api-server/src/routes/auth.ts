import { Router } from "express";
import { loadData, saveData } from "../lib/data.js";

const router = Router();

router.post("/login", (req, res) => {
  const { name, password } = req.body as {
    name?: string;
    password?: string;
  };
  if (!name?.trim() || !password) {
    res.status(400).json({ error: "שם וסיסמה נדרשים" });
    return;
  }
  const data = loadData();
  const soldier = data.soldiers.find(
    (s) => s.name === name.trim() && s.password === password,
  );
  if (!soldier) {
    res.status(401).json({ error: "שם משתמש או סיסמה לא נכונים" });
    return;
  }
  const { password: _pw, ...safe } = soldier;
  res.json({ soldier: safe });
});

router.post("/register", (req, res) => {
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
  const data = loadData();
  if (data.soldiers.some((s) => s.name === name.trim())) {
    res.status(409).json({ error: "משתמש בשם זה כבר קיים" });
    return;
  }
  const newSoldier = { name: name.trim(), pkal, password };
  data.soldiers.push(newSoldier);
  saveData(data);
  const { password: _pw, ...safe } = newSoldier;
  res.status(201).json({ soldier: safe });
});

export default router;
