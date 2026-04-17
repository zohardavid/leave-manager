import type {
  Soldier,
  LeaveRequest,
  Round,
  Swap,
  RequestStatus,
  RoundStatus,
} from "./types";

const API_BASE = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "שגיאה");
  return body;
}

export const api = {
  login: (name: string, password: string) =>
    request<{ soldier: Soldier }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ name, password }),
    }),

  register: (
    name: string,
    pkal: string,
    password: string,
    masterKey?: string,
  ) =>
    request<{ soldier: Soldier }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, pkal, password, masterKey }),
    }),

  getRequests: (soldier?: string) =>
    request<LeaveRequest[]>(
      "/requests" +
        (soldier ? `?soldier=${encodeURIComponent(soldier)}` : ""),
    ),

  createRequest: (data: {
    soldier_name: string;
    start_date: string;
    end_date: string;
    reason: string;
  }) =>
    request<LeaveRequest>("/requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRequest: (
    id: number,
    data: { status: RequestStatus; commander_note?: string },
  ) =>
    request<LeaveRequest>(`/requests/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  editRequest: (
    id: number,
    data: { start_date: string; end_date: string; reason: string },
  ) =>
    request<LeaveRequest>(`/requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteRequest: (id: number) =>
    request<void>(`/requests/${id}`, { method: "DELETE" }),

  getSoldiers: () => request<Soldier[]>("/soldiers"),

  deleteSoldier: (name: string) =>
    request<void>(`/soldiers/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),

  getRounds: () => request<Round[]>("/rounds"),

  createRound: (data: { soldier_name: string; round: string }) =>
    request<Round>("/rounds", { method: "POST", body: JSON.stringify(data) }),

  updateRound: (idx: number, data: { status: RoundStatus }) =>
    request<Round>(`/rounds/${idx}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getSwaps: () => request<Swap[]>("/swaps"),

  createSwap: (data: {
    requester: string;
    partner: string;
    start_date: string;
    end_date: string;
  }) =>
    request<Swap>("/swaps", { method: "POST", body: JSON.stringify(data) }),

  updateSwap: (id: number, data: { status: RequestStatus }) =>
    request<Swap>(`/swaps/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
