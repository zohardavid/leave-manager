import fs from "fs";
import path from "path";

const DATA_FILE =
  process.env["DATA_FILE"] ?? path.resolve(process.cwd(), "data/data.json");

export type RequestStatus = "Pending" | "Approved" | "Denied";
export type RoundStatus = "Pending" | "Approved" | "Denied" | "Replaced";

export interface Soldier {
  name: string;
  pkal: string;
  password: string;
}

export interface LeaveRequest {
  id: number;
  soldier_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: RequestStatus;
  submitted_at: string;
  commander_note?: string;
}

export interface Round {
  soldier_name: string;
  round: string;
  status: RoundStatus;
  submitted_at: string;
}

export interface Swap {
  id: number;
  requester: string;
  partner: string;
  start_date: string;
  end_date: string;
  status: RequestStatus;
  submitted_at: string;
}

export interface AppData {
  requests: LeaveRequest[];
  soldiers: Soldier[];
  rounds: Round[];
  swaps: Swap[];
}

export function loadData(): AppData {
  if (!fs.existsSync(DATA_FILE)) {
    return { requests: [], soldiers: [], rounds: [], swaps: [] };
  }
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  const data = JSON.parse(raw) as Partial<AppData>;
  return {
    requests: data.requests ?? [],
    soldiers: data.soldiers ?? [],
    rounds: data.rounds ?? [],
    swaps: data.swaps ?? [],
  };
}

export function saveData(data: AppData): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function getNextId(data: AppData): number {
  const ids = [
    ...data.requests.map((r) => r.id),
    ...data.swaps.map((s) => s.id ?? 0),
  ];
  return Math.max(0, ...ids) + 1;
}
