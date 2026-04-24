import { useState, useEffect, useCallback } from "react";
import type { Soldier, LeaveRequest, Swap, AppNotification } from "../lib/types";
import { api } from "../lib/api";
import { toast } from "sonner";
import { countLeaveDays } from "./SoldierApp";
import { subscribeToPush, unsubscribeFromPush } from "../lib/pushUtils";
import { IconClipboard, IconCalendar, IconUsers, IconBell, IconBellSlash, IconCog, IconBarChart, IconLogout } from "../lib/icons";

const STATUS_LABEL: Record<string, string> = {
  Pending: "ממתין",
  Approved: "אושר",
  Denied: "נדחה",
  Replaced: "הוחלף",
};

const STATUS_BG: Record<string, string> = {
  Pending: "bg-yellow-50 border-yellow-200",
  Approved: "bg-green-50 border-green-200",
  Denied: "bg-red-50 border-red-200",
  Replaced: "bg-gray-50 border-gray-200",
};

const STATUS_DOT: Record<string, string> = {
  Pending: "bg-yellow-400",
  Approved: "bg-green-500",
  Denied: "bg-red-500",
  Replaced: "bg-gray-400",
};

const DEPLOYMENT_START = new Date(2026, 3, 26); // local midnight, avoids UTC timezone shift
const DEPLOYMENT_END = new Date(2026, 6, 13);
const CYCLE_BASE = 8;
const CYCLE_LENGTH = 14;

function dayType(d: Date): "home" | "base" {
  if (d < DEPLOYMENT_START || d > DEPLOYMENT_END) return "base";
  const diff = Math.floor((d.getTime() - DEPLOYMENT_START.getTime()) / 86400000);
  return diff % CYCLE_LENGTH < CYCLE_BASE ? "base" : "home";
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function CommanderApp({
  soldier,
  onLogout,
}: {
  soldier: Soldier;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<"requests" | "calendar" | "soldiers" | "manage" | "notifications">(
    "requests",
  );
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(
    () => localStorage.getItem("lm_push_enabled") !== "false",
  );
  const [noteMap, setNoteMap] = useState<Record<number, string>>({});
  const [calMonth, setCalMonth] = useState(4);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [r, sw, s, n] = await Promise.all([
        api.getRequests(),
        api.getSwaps(),
        api.getSoldiers(),
        api.getNotifications(),
      ]);
      setRequests(r);
      setSwaps(sw);
      setSoldiers(s);
      setNotifications(n);
    } catch {
      toast.error("שגיאה בטעינת נתונים");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleRequest = async (id: number, status: "Approved" | "Denied") => {
    try {
      const updated = await api.updateRequest(id, { status, commander_note: noteMap[id] ?? "" });
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      toast.success(status === "Approved" ? "אושר" : "נדחה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  };

  const handleSwap = async (id: number, status: "Approved" | "Denied") => {
    try {
      const updated = await api.updateSwap(id, { status });
      setSwaps((prev) => prev.map((s) => (s.id === id ? updated : s)));
      toast.success(status === "Approved" ? "החלפה אושרה" : "החלפה נדחתה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  };

  const handleEdit = async (
    id: number,
    data: { start_date: string; end_date: string; reason: string; departure_time?: string; return_time?: string },
  ) => {
    try {
      const updated = await api.editRequest(id, data);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      toast.success("הבקשה עודכנה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`למחוק את ${name}?`)) return;
    try {
      await api.deleteSoldier(name);
      setSoldiers((prev) => prev.filter((s) => s.name !== name));
      toast.success("חייל נמחק");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  };

  const handleUpdateSoldier = async (
    oldName: string,
    data: { name?: string; pkal?: string; password?: string },
  ) => {
    try {
      const updated = await api.updateSoldier(oldName, data);
      setSoldiers((prev) => prev.map((s) => (s.name === oldName ? updated : s)));
      toast.success("פרופיל עודכן");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  };

  const handleSendNotification = async (data: { target: string; title: string; body: string }) => {
    try {
      await api.sendNotification(data);
      const updated = await api.getNotifications();
      setNotifications(updated);
      toast.success("התראה נשלחה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "Pending");
  const pendingSwaps = swaps.filter((s) => s.status === "Pending");
  const totalPending = pendingRequests.length + pendingSwaps.length;

  const daysInMonth = (m: number) => new Date(2026, m, 0).getDate();
  const firstDay = (m: number) => new Date(2026, m - 1, 1).getDay();

  const calDays = Array.from({ length: daysInMonth(calMonth) }, (_, i) => i + 1);

  const onLeaveOnDay = (day: number): string[] => {
    const d = new Date(2026, calMonth - 1, day);
    const dStr = d.toISOString().slice(0, 10);
    return requests
      .filter(
        (r) =>
          r.status === "Approved" &&
          r.start_date <= dStr &&
          r.end_date >= dStr,
      )
      .map((r) => r.soldier_name);
  };

  // ── Soldier stats ──────────────────────────────────────────────────
  const soldierStats = soldiers.map((s) => {
    const myRequests = requests.filter(
      (r) => r.soldier_name === s.name && r.status === "Approved",
    );
    const days = myRequests.reduce((acc, r) => acc + countLeaveDays(r.start_date, r.end_date, r.departure_time, r.return_time), 0);
    return { ...s, days };
  });

  const TABS: { id: "requests" | "calendar" | "soldiers" | "notifications" | "manage"; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { id: "requests", label: "בקשות", Icon: IconClipboard },
    { id: "calendar", label: "לוח", Icon: IconCalendar },
    { id: "soldiers", label: "חיילים", Icon: IconBarChart },
    { id: "notifications", label: "התראות", Icon: IconBell },
    { id: "manage", label: "ניהול", Icon: IconCog },
  ];

  const todayDisplay = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col h-full bg-[#f4f2ec]">
      {/* Header */}
      <header className="bg-[#4b6043] text-white px-4 pt-4 pb-5 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] tracking-[0.12em] uppercase text-[#7fa873] mb-1 font-medium">מפקד מחלקה</div>
            <div className="font-bold text-xl leading-tight">{soldier.name}</div>
            <div className="text-[#b8ceaf] text-xs mt-0.5">{soldier.pkal} · {todayDisplay}</div>
          </div>
          <div className="flex items-center gap-3 pt-0.5">
            <button
              onClick={async () => {
                if (pushEnabled) {
                  await unsubscribeFromPush(soldier.name);
                  localStorage.setItem("lm_push_enabled", "false");
                  setPushEnabled(false);
                  toast.info("התראות כובו");
                } else {
                  const result = await subscribeToPush(soldier);
                  localStorage.setItem("lm_push_enabled", result.ok ? "true" : "false");
                  setPushEnabled(result.ok);
                  if (result.ok) toast.success("התראות הופעלו");
                  else if (result.reason === "unsupported") toast.error("הדפדפן לא תומך בהתראות");
                  else if (result.reason === "denied") toast.error("הרשאת התראות נדחתה");
                  else if (result.reason === "server") toast.error(`שגיאת שרת: ${result.detail ?? ""}`);
                  else toast.error(`שגיאה: ${result.detail ?? ""}`);
                }
              }}
              className="text-[#b8ceaf] opacity-90 active:opacity-60"
            >
              {pushEnabled ? <IconBell className="w-5 h-5" /> : <IconBellSlash className="w-5 h-5" />}
            </button>
            <button
              onClick={onLogout}
              className="text-[#b8ceaf] text-xs border border-[#3a4d33] rounded-lg px-3 py-1.5 active:bg-[#3a4d33]"
            >
              יציאה
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto pb-16">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            טוען...
          </div>
        ) : (
          <>
            {tab === "requests" && (
              <RequestsTab
                requests={requests}
                pendingRequests={pendingRequests}
                pendingSwaps={pendingSwaps}
                soldiers={soldiers}
                noteMap={noteMap}
                setNoteMap={setNoteMap}
                onRequest={handleRequest}
                onSwap={handleSwap}
              />
            )}
            {tab === "calendar" && (
              <CalendarTab
                calMonth={calMonth}
                setCalMonth={setCalMonth}
                calDays={calDays}
                firstDay={firstDay}
                onLeaveOnDay={onLeaveOnDay}
                soldiers={soldiers}
                requests={requests}
                onRequest={handleRequest}
                onEdit={handleEdit}
              />
            )}
            {tab === "soldiers" && <SoldiersTab stats={soldierStats} requests={requests} />}
            {tab === "notifications" && (
              <NotificationsTab
                notifications={notifications}
                soldiers={soldiers}
                onSend={handleSendNotification}
              />
            )}
            {tab === "manage" && (
              <ManageTab
                soldiers={soldiers}
                onDelete={handleDelete}
                onUpdate={handleUpdateSoldier}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-10 bg-white border-t border-gray-100 flex shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex flex-col items-center py-2 gap-0.5 active:opacity-70"
          >
            <span className={`w-10 h-7 flex items-center justify-center rounded-xl transition-colors ${
              tab === t.id ? "bg-[#4b6043]/12 text-[#4b6043]" : "text-gray-400"
            }`}>
              <t.Icon className="w-4 h-4" />
            </span>
            <span className={`text-[10px] leading-none transition-colors ${tab === t.id ? "text-[#4b6043] font-bold" : "text-gray-400"}`}>
              {t.label}{t.id === "requests" && totalPending > 0 ? ` (${totalPending})` : ""}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Requests Tab ───────────────────────────────────────────────────────────────

function RequestsTab({
  requests,
  pendingRequests,
  pendingSwaps,
  soldiers,
  noteMap,
  setNoteMap,
  onRequest,
  onSwap,
}: {
  requests: LeaveRequest[];
  pendingRequests: LeaveRequest[];
  pendingSwaps: Swap[];
  soldiers: Soldier[];
  noteMap: Record<number, string>;
  setNoteMap: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onRequest: (id: number, status: "Approved" | "Denied") => void;
  onSwap: (id: number, status: "Approved" | "Denied") => void;
}) {
  const [subTab, setSubTab] = useState<"pending" | "history">("pending");
  const [filterSoldier, setFilterSoldier] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const handled = requests.filter((r) => r.status !== "Pending");

  const approvedCount = requests.filter((r) => r.status === "Approved").length;
  const deniedCount = requests.filter((r) => r.status === "Denied").length;

  const filteredHistory = [...handled]
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .filter((r) => filterSoldier === "all" || r.soldier_name === filterSoldier)
    .filter((r) => filterStatus === "all" || r.status === filterStatus);

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "ממתינות", value: pendingRequests.length, color: "bg-yellow-50 border-yellow-200 text-yellow-800" },
          { label: "אושרו", value: approvedCount, color: "bg-green-50 border-green-200 text-green-800" },
          { label: "נדחו", value: deniedCount, color: "bg-red-50 border-red-200 text-red-800" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border px-3 py-2 text-center ${s.color}`}>
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sub tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {(["pending", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              subTab === t ? "bg-white shadow text-slate-900" : "text-slate-500"
            }`}
          >
            {t === "pending" ? `ממתינות (${pendingRequests.length + pendingSwaps.length})` : "היסטוריה"}
          </button>
        ))}
      </div>

      {subTab === "pending" ? (
        <div className="space-y-5">
          {pendingRequests.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">בקשות חופשה</h3>
              <div className="space-y-3">
                {pendingRequests.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">{r.soldier_name}</div>
                        <div className="text-sm text-gray-500">
                          {fmt(r.start_date)} – {fmt(r.end_date)}
                          {" "}({countLeaveDays(r.start_date, r.end_date, r.departure_time, r.return_time)} ימים)
                        </div>
                        {(r.departure_time || r.return_time) && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {r.departure_time ? `יציאה ${r.departure_time}` : ""}
                            {r.departure_time && r.return_time ? " · " : ""}
                            {r.return_time ? `חזרה ${r.return_time}` : ""}
                          </div>
                        )}
                        <div className="text-sm text-gray-600 mt-1">{r.reason}</div>
                      </div>
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">ממתין</span>
                    </div>
                    <textarea
                      placeholder="הערת מפקד (אופציונלי)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-[#4b6043]"
                      rows={2}
                      value={noteMap[r.id] ?? ""}
                      onChange={(e) => setNoteMap((m) => ({ ...m, [r.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => onRequest(r.id, "Approved")} className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-semibold">✓ אישור</button>
                      <button onClick={() => onRequest(r.id, "Denied")} className="flex-1 bg-red-500 text-white py-2 rounded-xl text-sm font-semibold">✗ דחייה</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pendingSwaps.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">בקשות החלפה</h3>
              <div className="space-y-3">
                {pendingSwaps.map((s) => (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">{s.requester} ↔ {s.partner}</div>
                        <div className="text-sm text-gray-500">{fmt(s.start_date)} – {fmt(s.end_date)}</div>
                      </div>
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">ממתין</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onSwap(s.id, "Approved")} className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-semibold">✓ אישור</button>
                      <button onClick={() => onSwap(s.id, "Denied")} className="flex-1 bg-red-500 text-white py-2 rounded-xl text-sm font-semibold">✗ דחייה</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pendingRequests.length === 0 && pendingSwaps.length === 0 && (
            <div className="text-center text-gray-400 py-10">אין בקשות ממתינות</div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={filterSoldier}
              onChange={(e) => setFilterSoldier(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-1 focus:ring-[#4b6043]"
            >
              <option value="all">כל החיילים</option>
              {soldiers.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-1 focus:ring-[#4b6043]"
            >
              <option value="all">כל הסטטוסים</option>
              <option value="Approved">אושרו</option>
              <option value="Denied">נדחו</option>
            </select>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center text-gray-400 py-10">אין תוצאות</div>
          ) : (
            filteredHistory.map((r) => (
              <div key={r.id} className={`rounded-xl border p-3 ${STATUS_BG[r.status] ?? ""}`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{r.soldier_name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[r.status] ?? ""}`} />
                    <span className="text-xs text-gray-600">{STATUS_LABEL[r.status]}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {fmt(r.start_date)} – {fmt(r.end_date)} ({countLeaveDays(r.start_date, r.end_date, r.departure_time, r.return_time)} ימים)
                  {r.departure_time ? ` · יציאה ${r.departure_time}` : ""}
                  {r.return_time ? ` · חזרה ${r.return_time}` : ""}
                  {" · "}{r.reason}
                </div>
                {r.commander_note && (
                  <div className="text-xs text-gray-400 mt-1 italic">"{r.commander_note}"</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Calendar Tab ───────────────────────────────────────────────────────────────

function CalendarTab({
  calMonth,
  setCalMonth,
  calDays,
  firstDay,
  soldiers,
  requests,
  onRequest,
  onEdit,
}: {
  calMonth: number;
  setCalMonth: (m: number) => void;
  calDays: number[];
  firstDay: (m: number) => number;
  onLeaveOnDay: (day: number) => string[];
  soldiers: Soldier[];
  requests: LeaveRequest[];
  onRequest: (id: number, status: "Approved" | "Denied") => Promise<void>;
  onEdit: (id: number, data: { start_date: string; end_date: string; reason: string; departure_time?: string; return_time?: string }) => Promise<void>;
}) {
  const MONTHS = ["", "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי"];
  const DAYS_HE = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

  const today = new Date();
  const [selectedDay, setSelectedDay] = useState<number | null>(() => {
    if (today.getFullYear() === 2026 && today.getMonth() + 1 === calMonth) {
      return today.getDate();
    }
    return null;
  });
  const [focusedLeave, setFocusedLeave] = useState<LeaveRequest | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ start_date: "", end_date: "", reason: "", departure_time: "", return_time: "" });

  const firstDayOfMonth = firstDay(calMonth);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const dStr = (day: number) =>
    `2026-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const approvedOnDay = (day: number) => {
    const s = dStr(day);
    return requests.filter((r) => r.status === "Approved" && r.start_date <= s && r.end_date >= s);
  };

  const pendingOnDay = (day: number) => {
    const s = dStr(day);
    return requests.filter((r) => r.status === "Pending" && r.start_date <= s && r.end_date >= s);
  };

  const inDeployment = (day: number) => {
    const d = new Date(2026, calMonth - 1, day);
    return d >= DEPLOYMENT_START && d <= DEPLOYMENT_END;
  };

  const cellColor = (day: number, isSelected: boolean) => {
    if (isSelected) return "bg-[#4b6043] text-white";
    const approved = approvedOnDay(day).length;
    const pending = pendingOnDay(day).length;
    if (approved > 0) return "bg-yellow-100 text-yellow-800";
    if (pending > 0) return "bg-orange-50 text-orange-700 border border-orange-200";
    if (!inDeployment(day)) return "bg-gray-50 text-gray-300";
    const d = new Date(2026, calMonth - 1, day);
    if (dayType(d) === "home") return "bg-green-50 text-green-700";
    return "bg-white text-gray-700";
  };

  return (
    <div className="p-4 space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setCalMonth(Math.max(4, calMonth - 1)); setSelectedDay(null); setFocusedLeave(null); setEditMode(false); }}
          className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600"
          disabled={calMonth <= 4}
        >▶</button>
        <span className="font-semibold text-gray-800">{MONTHS[calMonth]} 2026</span>
        <button
          onClick={() => { setCalMonth(Math.min(7, calMonth + 1)); setSelectedDay(null); setFocusedLeave(null); setEditMode(false); }}
          className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600"
          disabled={calMonth >= 7}
        >◀</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS_HE.map((d) => (
          <div key={d} className="text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
        {blanks.map((i) => <div key={`b${i}`} />)}
        {calDays.map((day) => {
          const approved = approvedOnDay(day).length;
          const pending = pendingOnDay(day).length;
          const isSelected = selectedDay === day;
          return (
            <button
              key={day}
              onClick={() => { setSelectedDay(isSelected ? null : day); setFocusedLeave(null); setEditMode(false); }}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-colors ${cellColor(day, isSelected)}`}
            >
              <span>{day}</span>
              {approved > 0 && (
                <span className={`text-[9px] leading-none ${isSelected ? "text-yellow-200" : "text-yellow-600"}`}>{approved}</span>
              )}
              {pending > 0 && approved === 0 && (
                <span className={`text-[9px] leading-none ${isSelected ? "text-orange-200" : "text-orange-500"}`}>?{pending}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />אושרה</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-50 border border-orange-300" />ממתינה</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-50 border border-green-200" />יום בית</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-gray-200" />יום בסיס</span>
      </div>

      {/* Selected day details */}
      {selectedDay !== null && (() => {
        const d = new Date(2026, calMonth - 1, selectedDay);
        const approved = approvedOnDay(selectedDay);
        const pending = pendingOnDay(selectedDay);
        const isHomeDay = inDeployment(selectedDay) && dayType(d) === "home";
        const absentNames = [...approved, ...pending].map((r) => r.soldier_name);
        const onBase = soldiers.filter((s) => !absentNames.includes(s.name));

        return (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800">{selectedDay}/{calMonth}/2026</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isHomeDay ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {isHomeDay ? "🏠 יום בית" : "🛡️ יום בסיס"}
              </span>
            </div>

            {approved.length > 0 && (
              <div>
                <div className="text-xs font-medium text-yellow-600 mb-2">✅ בחופשה מאושרת ({approved.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {approved.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setFocusedLeave(focusedLeave?.id === r.id ? null : r)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        focusedLeave?.id === r.id
                          ? "bg-yellow-200 border-yellow-400 text-yellow-900 font-semibold"
                          : "bg-yellow-50 border-yellow-200 text-yellow-800"
                      }`}
                    >
                      {r.soldier_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pending.length > 0 && (
              <div>
                <div className="text-xs font-medium text-orange-600 mb-2">⏳ בקשה ממתינה לאישור ({pending.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {pending.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setFocusedLeave(focusedLeave?.id === r.id ? null : r)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        focusedLeave?.id === r.id
                          ? "bg-orange-200 border-orange-400 text-orange-900 font-semibold"
                          : "bg-orange-50 border-orange-200 text-orange-700"
                      }`}
                    >
                      {r.soldier_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {focusedLeave && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                {editMode ? (
                  <>
                    <div className="text-xs font-semibold text-amber-800 mb-1">{focusedLeave.soldier_name} — עריכה</div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500">מתאריך</label>
                        <input type="date" value={editData.start_date}
                          onChange={(e) => setEditData((d) => ({ ...d, start_date: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#4b6043]" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500">עד תאריך</label>
                        <input type="date" value={editData.end_date}
                          onChange={(e) => setEditData((d) => ({ ...d, end_date: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#4b6043]" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500">שעת יציאה</label>
                        <input type="time" value={editData.departure_time}
                          onChange={(e) => setEditData((d) => ({ ...d, departure_time: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#4b6043]" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500">שעת חזרה</label>
                        <input type="time" value={editData.return_time}
                          onChange={(e) => setEditData((d) => ({ ...d, return_time: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#4b6043]" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">סיבה</label>
                      <input type="text" value={editData.reason}
                        onChange={(e) => setEditData((d) => ({ ...d, reason: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#4b6043]" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={async () => {
                          await onEdit(focusedLeave.id, { start_date: editData.start_date, end_date: editData.end_date, reason: editData.reason, departure_time: editData.departure_time, return_time: editData.return_time });
                          setEditMode(false);
                          setFocusedLeave(null);
                        }}
                        className="flex-1 bg-[#4b6043] text-white py-1.5 rounded-lg text-xs font-semibold"
                      >שמור</button>
                      <button onClick={() => setEditMode(false)}
                        className="flex-1 border border-gray-200 text-gray-600 py-1.5 rounded-lg text-xs">ביטול</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-amber-800 space-y-0.5">
                      <div><span className="font-semibold">{focusedLeave.soldier_name}</span>{" — "}{focusedLeave.reason}</div>
                      <div className="text-amber-600">
                        {fmt(focusedLeave.start_date)}–{fmt(focusedLeave.end_date)}
                        {" "}({countLeaveDays(focusedLeave.start_date, focusedLeave.end_date, focusedLeave.departure_time, focusedLeave.return_time)} ימים)
                      </div>
                      {(focusedLeave.departure_time || focusedLeave.return_time) && (
                        <div className="text-amber-500">
                          {focusedLeave.departure_time ? `יציאה ${focusedLeave.departure_time}` : ""}
                          {focusedLeave.departure_time && focusedLeave.return_time ? " · " : ""}
                          {focusedLeave.return_time ? `חזרה ${focusedLeave.return_time}` : ""}
                        </div>
                      )}
                    </div>
                    {focusedLeave.status === "Pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={async () => { await onRequest(focusedLeave.id, "Approved"); setFocusedLeave(null); }}
                          className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-xs font-semibold"
                        >✓ אישור</button>
                        <button
                          onClick={async () => { await onRequest(focusedLeave.id, "Denied"); setFocusedLeave(null); }}
                          className="flex-1 bg-red-500 text-white py-1.5 rounded-lg text-xs font-semibold"
                        >✗ דחייה</button>
                        <button
                          onClick={() => { setEditData({ start_date: focusedLeave.start_date, end_date: focusedLeave.end_date, reason: focusedLeave.reason, departure_time: focusedLeave.departure_time ?? "", return_time: focusedLeave.return_time ?? "" }); setEditMode(true); }}
                          className="flex-1 border border-amber-300 text-amber-800 py-1.5 rounded-lg text-xs font-semibold"
                        >✏️ עריכה</button>
                      </div>
                    )}
                    {focusedLeave.status === "Approved" && (
                      <div className="flex gap-2">
                        <button
                          onClick={async () => { await onRequest(focusedLeave.id, "Denied"); setFocusedLeave(null); }}
                          className="flex-1 bg-red-500 text-white py-1.5 rounded-lg text-xs font-semibold"
                        >✗ בטל אישור</button>
                        <button
                          onClick={() => { setEditData({ start_date: focusedLeave.start_date, end_date: focusedLeave.end_date, reason: focusedLeave.reason, departure_time: focusedLeave.departure_time ?? "", return_time: focusedLeave.return_time ?? "" }); setEditMode(true); }}
                          className="flex-1 border border-amber-300 text-amber-800 py-1.5 rounded-lg text-xs font-semibold"
                        >✏️ עריכה</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {isHomeDay ? (
              <div className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                כל שאר המחלקה בבית לפי לוח הסבב
              </div>
            ) : (
              <div>
                <div className="text-xs font-medium text-green-600 mb-2">בבסיס ({onBase.length})</div>
                <div className="flex flex-wrap gap-1">
                  {onBase.map((s) => (
                    <span key={s.name} className="bg-green-50 border border-green-200 text-xs px-2 py-0.5 rounded-full">
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── Soldiers Tab ───────────────────────────────────────────────────────────────

function SoldiersTab({
  stats,
  requests,
}: {
  stats: Array<Soldier & { days: number }>;
  requests: LeaveRequest[];
}) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const onLeaveToday = (name: string) =>
    requests.some(
      (r) => r.status === "Approved" && r.soldier_name === name && r.start_date <= todayStr && r.end_date >= todayStr,
    );

  const pendingDays = (name: string) =>
    requests
      .filter((r) => r.status === "Pending" && r.soldier_name === name)
      .reduce((sum, r) => sum + countLeaveDays(r.start_date, r.end_date, r.departure_time, r.return_time), 0);

  // pkal breakdown
  const pkalCounts: Record<string, number> = {};
  for (const s of stats) {
    pkalCounts[s.pkal] = (pkalCounts[s.pkal] ?? 0) + 1;
  }
  const onLeaveTodayCount = stats.filter((s) => onLeaveToday(s.name)).length;
  const onBaseCount = stats.length - onLeaveTodayCount;

  return (
    <div className="p-4 space-y-4">
      {/* Today summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl border border-gray-200 px-3 py-3 text-center">
          <div className="text-2xl font-bold text-[#4b6043]">{onBaseCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">🛡️ בבסיס היום</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-3 py-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{onLeaveTodayCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">🏠 ביציאה היום</div>
        </div>
      </div>

      {/* Pkal breakdown */}
      {Object.keys(pkalCounts).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">הרכב מחלקה</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(pkalCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([pkal, count]) => (
                <div key={pkal} className="flex items-center gap-1.5 bg-[#f4f2ec] border border-[#d9d5cc] rounded-lg px-3 py-1.5">
                  <span className="font-bold text-[#4b6043] text-sm">{count}</span>
                  <span className="text-xs text-gray-600">{pkal}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Per-soldier table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-right px-3 py-2.5 font-medium text-gray-600">שם</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-600">אושר</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-600">ממתין</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-600">היום</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => {
              const pending = pendingDays(s.name);
              const away = onLeaveToday(s.name);
              return (
                <tr key={s.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-[10px] text-gray-400">{s.pkal}</div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`font-semibold text-sm ${s.days > 10 ? "text-red-500" : s.days > 5 ? "text-yellow-600" : "text-green-600"}`}>
                      {s.days}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {pending > 0
                      ? <span className="text-yellow-600 font-medium text-sm">{pending}</span>
                      : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${away ? "bg-amber-100 text-amber-700" : "bg-green-50 text-green-700"}`}>
                      {away ? "יציאה" : "בסיס"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {stats.length === 0 && (
          <div className="text-center text-gray-400 py-8">אין חיילים</div>
        )}
      </div>
    </div>
  );
}

// ── Notifications Tab ──────────────────────────────────────────────────────────

const TARGET_LABEL: Record<string, string> = {
  all: "כולם",
  commanders: "מפקדים",
};

function NotificationsTab({
  notifications,
  soldiers,
  onSend,
}: {
  notifications: AppNotification[];
  soldiers: Soldier[];
  onSend: (data: { target: string; title: string; body: string }) => Promise<void>;
}) {
  const [target, setTarget] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    await onSend({ target, title: title.trim(), body: body.trim() });
    setTitle("");
    setBody("");
    setSending(false);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Send form */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="font-semibold text-sm text-gray-800">שלח התראה</div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">נמען</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#4b6043] bg-white"
          >
            <option value="all">כולם</option>
            {soldiers.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">כותרת</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="כותרת ההתראה"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#4b6043]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">תוכן</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="תוכן ההודעה..."
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-[#4b6043]"
          />
        </div>
        <button
          onClick={() => void handleSend()}
          disabled={sending || !title.trim() || !body.trim()}
          className="w-full bg-[#4b6043] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
        >
          {sending ? "שולח..." : "🔔 שלח התראה"}
        </button>
      </div>

      {/* Log */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-500 uppercase">היסטוריית התראות</div>
        {notifications.length === 0 && (
          <div className="text-center text-gray-400 py-8 text-sm">אין התראות עדיין</div>
        )}
        {notifications.map((n) => (
          <div key={n.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className="flex justify-between items-start">
              <div className="font-medium text-sm">{n.title}</div>
              <span className="text-[10px] text-gray-400 shrink-0 mr-2">
                {new Date(n.sent_at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="text-xs text-gray-600 mt-0.5">{n.body}</div>
            <div className="text-[10px] text-gray-400 mt-1">
              → {TARGET_LABEL[n.target] ?? n.target}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Manage Tab ─────────────────────────────────────────────────────────────────

const PKAL_OPTIONS = [
  "לוחם", "מ\"כ", "סמל", "רס\"ל", "מפקד מחלקה",
];

function ManageTab({
  soldiers,
  onDelete,
  onUpdate,
}: {
  soldiers: Soldier[];
  onDelete: (name: string) => void;
  onUpdate: (oldName: string, data: { name?: string; pkal?: string; password?: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPkal, setEditPkal] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const startEdit = (s: Soldier) => {
    setEditing(s.name);
    setEditName(s.name);
    setEditPkal(s.pkal);
    setEditPassword("");
  };

  const cancelEdit = () => { setEditing(null); setEditPassword(""); };

  const saveEdit = async (oldName: string) => {
    const data: { name?: string; pkal?: string; password?: string } = {};
    if (editName.trim() && editName.trim() !== oldName) data.name = editName.trim();
    if (editPkal.trim() && editPkal.trim() !== soldiers.find((s) => s.name === oldName)?.pkal) data.pkal = editPkal.trim();
    if (editPassword.trim()) data.password = editPassword.trim();
    if (Object.keys(data).length === 0) { cancelEdit(); return; }
    await onUpdate(oldName, data);
    setEditing(null);
    setEditPassword("");
  };

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-gray-500">{soldiers.length} חיילים במערכת</p>
      {soldiers.map((s) => (
        <div key={s.name} className="bg-white rounded-xl border border-gray-200 px-4 py-3 space-y-3">
          {editing === s.name ? (
            <>
              <div className="text-xs font-semibold text-gray-700 mb-1">עריכת פרופיל</div>
              <div>
                <label className="text-[10px] text-gray-500">שם</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#4b6043]" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">תפקיד</label>
                <select value={editPkal} onChange={(e) => setEditPkal(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#4b6043] bg-white">
                  {PKAL_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500">סיסמה חדשה (השאר ריק אם לא לשנות)</label>
                <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="סיסמה חדשה..."
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#4b6043]" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => void saveEdit(s.name)}
                  className="flex-1 bg-[#4b6043] text-white py-1.5 rounded-lg text-xs font-semibold">שמור</button>
                <button onClick={cancelEdit}
                  className="flex-1 border border-gray-200 text-gray-600 py-1.5 rounded-lg text-xs">ביטול</button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{s.name}</div>
                <div className="text-xs text-gray-400">{s.pkal}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(s)}
                  className="text-[#4b6043] border border-[#4b6043] rounded-lg px-3 py-1 text-xs font-medium">
                  עריכה
                </button>
                <button onClick={() => onDelete(s.name)}
                  className="text-red-500 border border-red-200 rounded-lg px-3 py-1 text-xs font-medium">
                  מחק
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {soldiers.length === 0 && (
        <div className="text-center text-gray-400 py-10">אין חיילים</div>
      )}
    </div>
  );
}
