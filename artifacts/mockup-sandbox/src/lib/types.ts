export type RequestStatus = "Pending" | "Approved" | "Denied" | "Modified";

export const PKALS = [
  "לוחם", "חובש", "קשר", "מטול", "קלע", "איבו", "אבטה", "נגב", "מאג", "סמל", "מפקד מחלקה",
] as const;
export type Pkal = (typeof PKALS)[number];
export type RoundStatus = "Pending" | "Approved" | "Denied" | "Replaced";

export interface Soldier {
  name: string;
  pkal: string;
  mispar_ishi?: string;
  tzz_neshek?: string;
  tzz_kavanot2?: string;
  tzz_kavanot_m5?: string;
  tzz_amrel?: string;
  tzz_kesher?: string;
  tzz_nosaf?: string;
  tzz_extra1?: string;
  tzz_extra2?: string;
  tzz_extra3?: string;
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
  departure_time?: string;
  return_time?: string;
}

export interface Round {
  soldier_name: string;
  round: string;
  status: RoundStatus;
  submitted_at: string;
}

export interface AppNotification {
  id: number;
  target: string;
  title: string;
  body: string;
  sent_at: string;
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
