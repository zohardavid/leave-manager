import { Router } from "express";
import { loadData, saveData, getNextId } from "../lib/data.js";
import type { RequestStatus } from "../lib/data.js";

const router = Router();

router.get("/", (_req, res) => {
  const data = loadData();
  res.json(data.swaps);
});

router.post("/", (req, res) => {
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
  const data = loadData();
  const newSwap = {
    id: getNextId(data),
    requester,
    partner,
    start_date,
    end_date,
    status: "Pending" as RequestStatus,
    submitted_at: new Date().toISOString().slice(0, 10),
  };
  data.swaps.push(newSwap);
  saveData(data);
  res.status(201).json(newSwap);
});

router.put("/:id", (req, res) => {
  const id = Number(req.params["id"]);
  const { status } = req.body as { status?: RequestStatus };
  const data = loadData();
  const swap = data.swaps.find((s) => s.id === id);
  if (!swap) {
    res.status(404).json({ error: "החלפה לא נמצאה" });
    return;
  }
  if (status) swap.status = status;
  saveData(data);
  res.json(swap);
});

export default router;
