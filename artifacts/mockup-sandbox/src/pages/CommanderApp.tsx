import { useState, useEffect, useCallback } from "react";
import type { Soldier, LeaveRequest, Swap } from "../lib/types";
import { api } from "../lib/api";
import { toast } from "sonner";

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

const DEPLOYMENT_START = new Date("2026-04-26");
const DEPLOYMENT_END = new Date("2026-07-13");
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
  const [tab, setTab] = useState<"requests" | "calendar" | "soldiers" | "manage">(
    "requests",
  );
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteMap, setNoteMap] = useState<Record<number, string>>({});
  const [calMonth, setCalMonth] = useState(4);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [r, sw, s] = await Promise.all([
        api.getRequests(),
        api.getSwaps(),
        api.getSoldiers(),
      ]);
      setRequests(r);
      setSwaps(sw);
      setSoldiers(s);
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
    const days = myRequests.reduce((acc, r) => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);
      return (
        acc +
        Math.round((end.getTime() - start.getTime()) / 86400000) +
        1
      );
    }, 0);
    return { ...s, days };
  });

  const TABS = [
    { id: "requests" as const, label: "בקשות", icon: "📋" },
    { id: "calendar" as const, label: "לוח", icon: "📅" },
    { id: "soldiers" as const, label: "חיילים", icon: "📊" },
    { id: "manage" as const, label: "ניהול", icon: "👥" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f4f2ec]">
      {/* Header */}
      <header className="bg-[#4b6043] text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <div className="font-bold text-base leading-tight">{soldier.name}</div>
          <div className="text-[#b8ceaf] text-xs">{soldier.pkal}</div>
        </div>
        <button
          onClick={onLogout}
          className="text-[#b8ceaf] text-xs border border-[#3a4d33] rounded-lg px-3 py-1.5"
        >
          יציאה
        </button>
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
              />
            )}
            {tab === "soldiers" && <SoldiersTab stats={soldierStats} />}
            {tab === "manage" && (
              <ManageTab soldiers={soldiers} onDelete={handleDelete} />
            )}
          </>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-10 bg-white border-t border-gray-200 flex">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center py-2.5 text-xs gap-0.5 transition-colors ${
              tab === t.id
                ? "text-[#4b6043] font-semibold"
                : "text-gray-400"
            }`}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            <span className="leading-none">
              {t.label}
              {t.id === "requests" && totalPending > 0
                ? ` (${totalPending})`
                : ""}
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
  noteMap,
  setNoteMap,
  onRequest,
  onSwap,
}: {
  requests: LeaveRequest[];
  pendingRequests: LeaveRequest[];
  pendingSwaps: Swap[];
  noteMap: Record<number, string>;
  setNoteMap: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onRequest: (id: number, status: "Approved" | "Denied") => void;
  onSwap: (id: number, status: "Approved" | "Denied") => void;
}) {
  const [subTab, setSubTab] = useState<"pending" | "history">("pending");
  const handled = requests.filter((r) => r.status !== "Pending");

  return (
    <div className="p-4 space-y-4">
      {/* Sub tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {(["pending", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              subTab === t
                ? "bg-white shadow text-slate-900"
                : "text-slate-500"
            }`}
          >
            {t === "pending" ? "ממתינות לאישור" : "היסטוריה"}
          </button>
        ))}
      </div>

      {subTab === "pending" ? (
        <div className="space-y-5">
          {/* Leave requests */}
          {pendingRequests.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                בקשות חופשה
              </h3>
              <div className="space-y-3">
                {pendingRequests.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">{r.soldier_name}</div>
                        <div className="text-sm text-gray-500">
                          {fmt(r.start_date)} – {fmt(r.end_date)}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {r.reason}
                        </div>
                      </div>
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                        ממתין
                      </span>
                    </div>
                    <textarea
                      placeholder="הערת מפקד (אופציונלי)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-[#4b6043]"
                      rows={2}
                      value={noteMap[r.id] ?? ""}
                      onChange={(e) =>
                        setNoteMap((m) => ({ ...m, [r.id]: e.target.value }))
                      }
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => onRequest(r.id, "Approved")}
                        className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-semibold"
                      >
                        ✓ אישור
                      </button>
                      <button
                        onClick={() => onRequest(r.id, "Denied")}
                        className="flex-1 bg-red-500 text-white py-2 rounded-xl text-sm font-semibold"
                      >
                        ✗ דחייה
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pending swaps */}
          {pendingSwaps.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                בקשות החלפה
              </h3>
              <div className="space-y-3">
                {pendingSwaps.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">
                          {s.requester} ↔ {s.partner}
                        </div>
                        <div className="text-sm text-gray-500">
                          {fmt(s.start_date)} – {fmt(s.end_date)}
                        </div>
                      </div>
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                        ממתין
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onSwap(s.id, "Approved")}
                        className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-semibold"
                      >
                        ✓ אישור
                      </button>
                      <button
                        onClick={() => onSwap(s.id, "Denied")}
                        className="flex-1 bg-red-500 text-white py-2 rounded-xl text-sm font-semibold"
                      >
                        ✗ דחייה
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pendingRequests.length === 0 &&
            pendingSwaps.length === 0 && (
              <div className="text-center text-gray-400 py-10">
                אין בקשות ממתינות
              </div>
            )}
        </div>
      ) : (
        <div className="space-y-3">
          {handled.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
              אין היסטוריה
            </div>
          ) : (
            [...handled]
              .sort(
                (a, b) =>
                  new Date(b.submitted_at).getTime() -
                  new Date(a.submitted_at).getTime(),
              )
              .map((r) => (
                <div
                  key={r.id}
                  className={`rounded-xl border p-3 ${STATUS_BG[r.status] ?? ""}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">
                      {r.soldier_name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${STATUS_DOT[r.status] ?? ""}`}
                      />
                      <span className="text-xs text-gray-600">
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {fmt(r.start_date)} – {fmt(r.end_date)} · {r.reason}
                  </div>
                  {r.commander_note && (
                    <div className="text-xs text-gray-400 mt-1 italic">
                      "{r.commander_note}"
                    </div>
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
}: {
  calMonth: number;
  setCalMonth: (m: number) => void;
  calDays: number[];
  firstDay: (m: number) => number;
  onLeaveOnDay: (day: number) => string[];
  soldiers: Soldier[];
  requests: LeaveRequest[];
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

  const firstDayOfMonth = firstDay(calMonth);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const leavesOnDay = (day: number): LeaveRequest[] => {
    const dStr = `2026-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return requests.filter(
      (r) => r.status === "Approved" && r.start_date <= dStr && r.end_date >= dStr,
    );
  };

  const inDeployment = (day: number) => {
    const d = new Date(2026, calMonth - 1, day);
    return d >= DEPLOYMENT_START && d <= DEPLOYMENT_END;
  };

  const cellColor = (day: number, isSelected: boolean) => {
    if (isSelected) return "bg-[#4b6043] text-white";
    const count = leavesOnDay(day).length;
    if (count > 0) return "bg-yellow-100 text-yellow-800";
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
          onClick={() => { setCalMonth(Math.max(4, calMonth - 1)); setSelectedDay(null); setFocusedLeave(null); }}
          className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600"
          disabled={calMonth <= 4}
        >▶</button>
        <span className="font-semibold text-gray-800">{MONTHS[calMonth]} 2026</span>
        <button
          onClick={() => { setCalMonth(Math.min(7, calMonth + 1)); setSelectedDay(null); setFocusedLeave(null); }}
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
          const count = leavesOnDay(day).length;
          const isSelected = selectedDay === day;
          return (
            <button
              key={day}
              onClick={() => { setSelectedDay(isSelected ? null : day); setFocusedLeave(null); }}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-colors ${cellColor(day, isSelected)}`}
            >
              <span>{day}</span>
              {count > 0 && (
                <span className={`text-[9px] leading-none ${isSelected ? "text-yellow-200" : "text-yellow-600"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />יש בחופשה</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-50 border border-green-200" />יום בית</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-gray-200" />יום בסיס</span>
      </div>

      {/* Selected day details */}
      {selectedDay !== null && (() => {
        const d = new Date(2026, calMonth - 1, selectedDay);
        const leaveReqs = leavesOnDay(selectedDay);
        const isHomeDay = inDeployment(selectedDay) && dayType(d) === "home";
        const onLeaveNames = leaveReqs.map((r) => r.soldier_name);
        const onBase = soldiers.filter((s) => !onLeaveNames.includes(s.name));

        return (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800">{selectedDay}/{calMonth}/2026</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isHomeDay ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {isHomeDay ? "🏠 יום בית" : "🛡️ יום בסיס"}
              </span>
            </div>

            {leaveReqs.length > 0 && (
              <div>
                <div className="text-xs font-medium text-yellow-600 mb-2">בחופשה ({leaveReqs.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {leaveReqs.map((r) => (
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
                {focusedLeave && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                    <span className="font-semibold">{focusedLeave.soldier_name}</span>
                    {" — "}{focusedLeave.reason}
                    <span className="text-amber-600 mr-1"> ({fmt(focusedLeave.start_date)}–{fmt(focusedLeave.end_date)})</span>
                  </div>
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
}: {
  stats: Array<Soldier & { days: number }>;
}) {
  return (
    <div className="p-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-right px-3 py-2.5 font-medium text-gray-600">
                שם
              </th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-600">
                פק"ל
              </th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-600">
                ימי חופש
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr
                key={s.name}
                className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
              >
                <td className="px-3 py-2.5 font-medium">{s.name}</td>
                <td className="px-3 py-2.5 text-center text-gray-500 text-xs">
                  {s.pkal}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span
                    className={`font-semibold ${
                      s.days > 10
                        ? "text-red-500"
                        : s.days > 5
                          ? "text-yellow-600"
                          : "text-green-600"
                    }`}
                  >
                    {s.days}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stats.length === 0 && (
          <div className="text-center text-gray-400 py-8">אין חיילים</div>
        )}
      </div>
    </div>
  );
}

// ── Manage Tab ─────────────────────────────────────────────────────────────────

function ManageTab({
  soldiers,
  onDelete,
}: {
  soldiers: Soldier[];
  onDelete: (name: string) => void;
}) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-gray-500">
        {soldiers.length} חיילים במערכת
      </p>
      {soldiers.map((s) => (
        <div
          key={s.name}
          className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between"
        >
          <div>
            <div className="font-medium text-sm">{s.name}</div>
            <div className="text-xs text-gray-400">{s.pkal}</div>
          </div>
          <button
            onClick={() => onDelete(s.name)}
            className="text-red-500 border border-red-200 rounded-lg px-3 py-1 text-xs font-medium"
          >
            מחק
          </button>
        </div>
      ))}
      {soldiers.length === 0 && (
        <div className="text-center text-gray-400 py-10">אין חיילים</div>
      )}
    </div>
  );
}
