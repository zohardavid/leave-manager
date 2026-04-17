import { Router } from "express";
import { loadData, saveData } from "../lib/data.js";

const router = Router();

router.get("/", (_req, res) => {
  const data = loadData();
  res.json(data.soldiers.map(({ password: _pw, ...s }) => s));
});

router.delete("/:name", (req, res) => {
  const name = decodeURIComponent(req.params["name"] ?? "");
  const data = loadData();
  const before = data.soldiers.length;
  data.soldiers = data.soldiers.filter((s) => s.name !== name);
  if (data.soldiers.length === before) {
    res.status(404).json({ error: "חייל לא נמצא" });
    return;
  }
  saveData(data);
  res.status(204).end();
});

export default router;
