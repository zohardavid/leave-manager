import { Router } from "express";
import { loadData, saveData } from "../lib/data.js";
import type { RoundStatus } from "../lib/data.js";

const router = Router();

router.get("/", (_req, res) => {
  const data = loadData();
  res.json(data.rounds);
});

router.post("/", (req, res) => {
  const { soldier_name, round } = req.body as {
    soldier_name?: string;
    round?: string;
  };
  if (!soldier_name || !round) {
    res.status(400).json({ error: "חייל וסבב נדרשים" });
    return;
  }
  const data = loadData();
  data.rounds = data.rounds.filter(
    (r) => !(r.soldier_name === soldier_name && r.status === "Pending"),
  );
  const newRound = {
    soldier_name,
    round,
    status: "Pending" as RoundStatus,
    submitted_at: new Date().toISOString().slice(0, 10),
  };
  data.rounds.push(newRound);
  saveData(data);
  res.status(201).json(newRound);
});

router.put("/:idx", (req, res) => {
  const idx = Number(req.params["idx"]);
  const { status } = req.body as { status?: RoundStatus };
  const data = loadData();
  if (idx < 0 || idx >= data.rounds.length) {
    res.status(404).json({ error: "סבב לא נמצא" });
    return;
  }
  const round = data.rounds[idx]!;
  if (status === "Approved") {
    data.rounds.forEach((r) => {
      if (r.soldier_name === round.soldier_name && r.status === "Approved") {
        r.status = "Replaced";
      }
    });
  }
  round.status = status ?? round.status;
  saveData(data);
  res.json(round);
});

export default router;
