import { Router } from "express";
import { loadData, saveData, getNextId } from "../lib/data.js";
import type { RequestStatus } from "../lib/data.js";

const router = Router();

router.get("/", (req, res) => {
  const data = loadData();
  const { soldier } = req.query as { soldier?: string };
  const requests = soldier
    ? data.requests.filter((r) => r.soldier_name === soldier)
    : data.requests;
  res.json(requests);
});

router.post("/", (req, res) => {
  const { soldier_name, start_date, end_date, reason } = req.body as {
    soldier_name?: string;
    start_date?: string;
    end_date?: string;
    reason?: string;
  };
  if (!soldier_name || !start_date || !end_date || !reason?.trim()) {
    res.status(400).json({ error: "כל השדות נדרשים" });
    return;
  }
  if (new Date(end_date) < new Date(start_date)) {
    res.status(400).json({ error: "תאריך סיום לפני תאריך התחלה" });
    return;
  }
  const data = loadData();
  const existing = data.requests.filter(
    (r) => r.soldier_name === soldier_name && r.status !== "Denied",
  );
  const overlap = existing.some(
    (r) =>
      !(
        end_date < r.start_date || start_date > r.end_date
      ),
  );
  if (overlap) {
    res.status(409).json({ error: "קיימת בקשה חופפת בתאריכים אלו" });
    return;
  }
  const newReq = {
    id: getNextId(data),
    soldier_name,
    start_date,
    end_date,
    reason: reason.trim(),
    status: "Pending" as RequestStatus,
    submitted_at: new Date().toISOString().slice(0, 10),
    commander_note: "",
  };
  data.requests.push(newReq);
  saveData(data);
  res.status(201).json(newReq);
});

router.put("/:id", (req, res) => {
  const id = Number(req.params["id"]);
  const { status, commander_note } = req.body as {
    status?: RequestStatus;
    commander_note?: string;
  };
  const data = loadData();
  const request = data.requests.find((r) => r.id === id);
  if (!request) {
    res.status(404).json({ error: "בקשה לא נמצאה" });
    return;
  }
  if (status) request.status = status;
  if (commander_note !== undefined) request.commander_note = commander_note;
  saveData(data);
  res.json(request);
});

export default router;
