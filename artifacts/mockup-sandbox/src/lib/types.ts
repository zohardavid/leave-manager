export type RequestStatus = "Pending" | "Approved" | "Denied";
export type RoundStatus = "Pending" | "Approved" | "Denied" | "Replaced";

export interface Soldier {
  name: string;
  pkal: string;
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
