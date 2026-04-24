import { useState, useEffect, useCallback } from "react";
import type { Soldier, LeaveRequest, Swap } from "../lib/types";
import { api } from "../lib/api";
import { toast } from "sonner";
import { subscribeToPush, unsubscribeFromPush } from "../lib/pushUtils";
import { IconHome, IconClipboard, IconCalendar, IconBell, IconBellSlash, IconLogout } from "../lib/icons";

const DEPLOYMENT_START = new Date(2026, 3, 26); // local midnight, avoids UTC timezone shift
const DEPLOYMENT_END = new Date(2026, 6, 13);
const CYCLE_BASE = 8;
const CYCLE_HOME = 6;
const CYCLE_LENGTH = CYCLE_BASE + CYCLE_HOME;
const MAX_ON_LEAVE = 18;

function dayType(d: Date): "home" | "base" {
  if (d < DEPLOYMENT_START || d > DEPLOYMENT_END) return "base";
  const diff = Math.floor((d.getTime() - DEPLOYMENT_START.getTime()) / 86400000);
  const pos = diff % CYCLE_LENGTH;
  return pos < CYCLE_BASE ? "base" : "home";
}

function diffDays(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;
}

export function countLeaveDays(startDate: string, endDate: string, departureTime?: string, returnTime?: string): number {
  const base = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
  let days = base;
  if (departureTime && departureTime >= "12:00") days -= 1;
  if (returnTime && returnTime <= "12:00") days -= 1;
  return Math.max(0, days);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<string, string> = {
  Pending: "ממתינה 🟡",
  Approved: "אושרה ✅",
  Denied: "נדחתה ❌",
};

const STATUS_COLOR: Record<string, string> = {
  Pending: "bg-yellow-50 border-yellow-200",
  Approved: "bg-green-50 border-green-200",
  Denied: "bg-red-50 border-red-200",
};

const MONTH_NAMES: Record<number, string> = { 4: "אפריל", 5: "מאי", 6: "יוני", 7: "יולי" };
const DAY_HEADERS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "שבת"];

function calendarWeeks(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const startOffset = firstDay.getDay() % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(startOffset).fill(null) as null[];
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

type Tab = "home" | "requests" | "calendar";

export default function SoldierApp({
  soldier,
  onLogout,
}: {
  soldier: Soldier;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>("home");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [pushEnabled, setPushEnabled] = useState(
    () => localStorage.getItem("lm_push_enabled") !== "false",
  );

  const load = useCallback(async () => {
    try {
      const [myReqs, allReqs, swps, sols] = await Promise.all([
        api.getRequests(soldier.name),
        api.getRequests(),
        api.getSwaps(),
        api.getSoldiers(),
      ]);
      setRequests(myReqs);
      setAllRequests(allReqs);
      setSwaps(swps);
      setSoldiers(sols.filter((s) => s.name !== soldier.name));
    } catch { /* silent */ }
  }, [soldier.name]);

  useEffect(() => { void load(); }, [load]);

  const daysApproved = requests
    .filter((r) => r.status === "Approved")
    .reduce((sum, r) => sum + countLeaveDays(r.start_date, r.end_date, r.departure_time, r.return_time), 0);

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft =
    todayMidnight < DEPLOYMENT_START
      ? Math.round((DEPLOYMENT_START.getTime() - todayMidnight.getTime()) / 86400000)
      : todayMidnight <= DEPLOYMENT_END
        ? Math.round((DEPLOYMENT_END.getTime() - todayMidnight.getTime()) / 86400000)
        : 0;
  const countdownLabel =
    today < DEPLOYMENT_START ? "ימים לתחילת תעסוקה"
    : today <= DEPLOYMENT_END ? "ימים לסיום תעסוקה"
    : "התעסוקה הסתיימה";

  const navItems: { key: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { key: "home", label: "בית", Icon: IconHome },
    { key: "requests", label: "בקשות", Icon: IconClipboard },
    { key: "calendar", label: "לוח", Icon: IconCalendar },
  ];

  const todayDisplay = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col h-full bg-[#f4f2ec]">
      <header className="bg-[#4b6043] text-white px-4 pt-4 pb-5 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] tracking-[0.12em] uppercase text-[#7fa873] mb-1 font-medium">מערכת יציאות</div>
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
                  const ok = await subscribeToPush(soldier);
                  localStorage.setItem("lm_push_enabled", ok ? "true" : "false");
                  setPushEnabled(ok);
                  if (ok) toast.success("התראות הופעלו");
                  else toast.error("לא ניתן להפעיל התראות");
                }
              }}
              className="text-[#b8ceaf] opacity-90 active:opacity-60"
              title={pushEnabled ? "כבה התראות" : "הפעל התראות"}
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

      <main className="flex-1 overflow-y-auto pb-20">
        {tab === "home" && (
          <HomeTab
            daysApproved={daysApproved}
            daysLeft={daysLeft}
            countdownLabel={countdownLabel}
            requestCount={requests.length}
          />
        )}
        {tab === "requests" && (
          <RequestsTab
            soldier={soldier}
            requests={requests}
            allRequests={allRequests}
            swaps={swaps}
            soldiers={soldiers}
            onRefresh={load}
          />
        )}
        {tab === "calendar" && (
          <CalendarTab soldier={soldier} requests={requests} swaps={swaps} />
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-10 bg-white border-t border-gray-100 flex shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className="flex-1 flex flex-col items-center py-2 gap-0.5 active:opacity-70"
          >
            <span className={`w-11 h-8 flex items-center justify-center rounded-xl transition-colors ${
              tab === item.key ? "bg-[#4b6043]/12 text-[#4b6043]" : "text-gray-400"
            }`}>
              <item.Icon className="w-5 h-5" />
            </span>
            <span className={`text-[10px] transition-colors ${tab === item.key ? "text-[#4b6043] font-bold" : "text-gray-400"}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function HomeTab({
  daysApproved,
  daysLeft,
  countdownLabel,
  requestCount,
}: {
  daysApproved: number;
  daysLeft: number;
  countdownLabel: string;
  requestCount: number;
}) {
  const today = new Date();
  const todayType = dayType(today);
  const isInDeployment = today >= DEPLOYMENT_START && today <= DEPLOYMENT_END;
  const isHome = isInDeployment && todayType === "home";
  const isBase = isInDeployment && todayType === "base";

  return (
    <div className="p-4 space-y-4">
      {/* Hero status */}
      <div className={`rounded-2xl p-5 ${isHome ? "bg-green-600" : isBase ? "bg-[#4b6043]" : "bg-gray-500"} text-white shadow-md`}>
        <div className="text-3xl mb-2">{isHome ? "🏠" : "🛡️"}</div>
        <div className="text-2xl font-bold leading-tight">
          {isHome ? "היום אתה בבית" : isBase ? "היום אתה בבסיס" : "מחוץ לתעסוקה"}
        </div>
        <div className="text-white/70 text-sm mt-1">
          {isInDeployment ? `נותרו ${daysLeft} ימים לסיום` : countdownLabel}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-3xl font-bold text-[#4b6043]">{daysApproved}</div>
          <div className="text-xs font-medium text-gray-500 mt-1">ימי יציאה שאושרו</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-3xl font-bold text-[#2d3a2e]">{daysLeft}</div>
          <div className="text-xs font-medium text-gray-500 mt-1">{countdownLabel}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-3xl font-bold text-[#2d3a2e]">{requestCount}</div>
          <div className="text-xs font-medium text-gray-500 mt-1">בקשות שהוגשו</div>
        </div>
        <div className="bg-[#4b6043]/8 rounded-2xl p-4 border border-[#4b6043]/20">
          <div className="text-2xl mb-1">🗓</div>
          <div className="text-xs font-semibold text-[#4b6043]">26.04 – 13.07</div>
          <div className="text-[10px] text-gray-500 mt-0.5">8 בסיס · 6 בית</div>
        </div>
      </div>
    </div>
  );
}

function RequestsTab({
  soldier,
  requests,
  allRequests,
  swaps,
  soldiers,
  onRefresh,
}: {
  soldier: Soldier;
  requests: LeaveRequest[];
  allRequests: LeaveRequest[];
  swaps: Swap[];
  soldiers: Soldier[];
  onRefresh: () => Promise<void>;
}) {
  const [view, setView] = useState<"new" | "history" | "swap">("new");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [reason, setReason] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editDepartureTime, setEditDepartureTime] = useState("");
  const [editReturnTime, setEditReturnTime] = useState("");

  const [swapPartner, setSwapPartner] = useState("");
  const [swapStart, setSwapStart] = useState("2026-04-26");
  const [swapEnd, setSwapEnd] = useState("2026-04-26");

  const mySwaps = swaps.filter((s) => s.requester === soldier.name);


  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createRequest({ soldier_name: soldier.name, start_date: startDate, end_date: endDate, reason, departure_time: departureTime, return_time: returnTime });
      toast.success("✅ בקשה הוגשה בהצלחה!");
      setReason("");
      setDepartureTime("");
      setReturnTime("");
      await onRefresh();
      setView("history");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("למחוק את הבקשה?")) return;
    try {
      await api.deleteRequest(id);
      toast.success("הבקשה נמחקה");
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  };

  const startEdit = (r: LeaveRequest) => {
    setEditingId(r.id);
    setEditStart(r.start_date);
    setEditEnd(r.end_date);
    setEditReason(r.reason);
    setEditDepartureTime(r.departure_time ?? "");
    setEditReturnTime(r.return_time ?? "");
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setLoading(true);
    try {
      await api.editRequest(editingId, { start_date: editStart, end_date: editEnd, reason: editReason, departure_time: editDepartureTime, return_time: editReturnTime });
      toast.success("הבקשה עודכנה ונשלחה לאישור מחדש");
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  };

  const submitSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapPartner) return;
    setLoading(true);
    try {
      await api.createSwap({ requester: soldier.name, partner: swapPartner, start_date: swapStart, end_date: swapEnd });
      toast.success("✅ בקשת החלפה נשלחה!");
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full border border-gray-300 rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-[#4b6043] bg-white";

  return (
    <div className="p-4 space-y-4">
      <div className="flex bg-gray-200 rounded-xl p-1">
        {([
          { key: "new", label: "בקשה חדשה" },
          { key: "history", label: "הבקשות שלי" },
          { key: "swap", label: "החלפה" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              view === t.key ? "bg-white shadow text-slate-900" : "text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "new" && (
        <form onSubmit={submitRequest} className="space-y-4 bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-semibold text-[#2d3a2e]">בקשת יציאה חדשה</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תאריך התחלה</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תאריך סיום</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} className={inputCls} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיבה</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="אירוע משפחתי, טיפול רפואי..."
              className={`${inputCls} resize-none h-20`}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שעת יציאה</label>
              <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שעת חזרה</label>
              <input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
            יציאה לפני 12:00 = יום בית · חזרה אחרי 12:00 = יום בית
          </div>
          {(() => {
            const s = new Date(startDate);
            const e2 = new Date(endDate);
            const approved = allRequests.filter((r) => r.status === "Approved" && r.soldier_name !== soldier.name);
            let warn = false;
            for (let d = new Date(s); d <= e2; d.setDate(d.getDate() + 1)) {
              const ds = d.toISOString().slice(0, 10);
              if (approved.filter((r) => r.start_date <= ds && r.end_date >= ds).length >= MAX_ON_LEAVE) { warn = true; break; }
            }
            return warn ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                ⚠️ בחלק מהתאריכים כבר {MAX_ON_LEAVE} חיילים ביציאה. הבקשה תוגש אך עלולה להידחות.
              </div>
            ) : null;
          })()}
          <button type="submit" disabled={loading} className="w-full bg-[#4b6043] text-white py-3 rounded-xl font-semibold disabled:opacity-50 active:scale-95 transition-transform">
            {loading ? "שולח..." : "הגש בקשה"}
          </button>
        </form>
      )}

      {view === "history" && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="text-center text-gray-400 py-12">אין בקשות עדיין</div>
          ) : (
            [...requests].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)).map((r) => (
              <div key={r.id} className={`rounded-2xl border p-4 ${STATUS_COLOR[r.status] ?? ""}`}>
                {editingId === r.id ? (
                  <form onSubmit={submitEdit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">מתאריך</label>
                        <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} className={inputCls} required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">עד תאריך</label>
                        <input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} min={editStart} className={inputCls} required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">שעת יציאה</label>
                        <input type="time" value={editDepartureTime} onChange={(e) => setEditDepartureTime(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">שעת חזרה</label>
                        <input type="time" value={editReturnTime} onChange={(e) => setEditReturnTime(e.target.value)} className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">סיבה</label>
                      <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} className={`${inputCls} resize-none h-16 text-sm`} required />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={loading} className="flex-1 bg-[#4b6043] text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                        {loading ? "שומר..." : "שמור"}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm font-semibold">
                        ביטול
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex justify-between items-start">
                      <div className="text-sm font-semibold text-gray-800">{r.start_date} ← {r.end_date}</div>
                      <div className="text-xs">{STATUS_LABEL[r.status]}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {countLeaveDays(r.start_date, r.end_date, r.departure_time, r.return_time)} ימים
                      {r.departure_time ? ` · יציאה ${r.departure_time}` : ""}
                      {r.return_time ? ` · חזרה ${r.return_time}` : ""}
                      {" · "}{r.reason}
                    </div>
                    {r.commander_note && (
                      <div className="text-xs text-blue-700 mt-1.5 bg-blue-50 rounded-lg px-2 py-1">💬 {r.commander_note}</div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => startEdit(r)} className="flex-1 text-xs border border-[#4b6043] text-[#4b6043] py-1.5 rounded-lg font-medium">
                        ✏️ עריכה
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="flex-1 text-xs border border-red-300 text-red-500 py-1.5 rounded-lg font-medium">
                        🗑️ מחיקה
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {view === "swap" && (
        <div className="space-y-4">
          <form onSubmit={submitSwap} className="space-y-4 bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-semibold text-[#2d3a2e]">בקשת החלפת ימים</h3>
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">חייל להחלפה</label>
                  <input
                    type="text"
                    value={swapPartner}
                    onChange={(e) => setSwapPartner(e.target.value)}
                    placeholder="שם החייל"
                    className={inputCls}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">מתאריך</label>
                    <input type="date" value={swapStart} onChange={(e) => setSwapStart(e.target.value)} min="2026-04-26" max="2026-07-13" className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">עד תאריך</label>
                    <input type="date" value={swapEnd} onChange={(e) => setSwapEnd(e.target.value)} min={swapStart} max="2026-07-13" className={inputCls} required />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-[#4b6043] text-white py-3 rounded-xl font-semibold disabled:opacity-50 active:scale-95 transition-transform">
                  {loading ? "שולח..." : "שלח בקשת החלפה"}
                </button>
              </>
          </form>

          {mySwaps.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">בקשות החלפה שלי</h4>
              {mySwaps.map((sw) => (
                <div key={sw.id} className={`rounded-xl border p-3 ${STATUS_COLOR[sw.status] ?? ""}`}>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">עם {sw.partner}</span>
                    <span className="text-xs">{STATUS_LABEL[sw.status]}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{sw.start_date} ← {sw.end_date} ({diffDays(sw.start_date, sw.end_date)} ימים)</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CalendarTab({
  soldier,
  requests,
  swaps,
}: {
  soldier: Soldier;
  requests: LeaveRequest[];
  swaps: Swap[];
}) {
  const approvedRequests = requests.filter((r) => r.status === "Approved");
  const approvedSwaps = swaps.filter(
    (s) => s.status === "Approved" && (s.requester === soldier.name || s.partner === soldier.name),
  );

  const classify = (dateStr: string): "leave" | "swap" | "home" | "base" => {
    for (const sw of approvedSwaps) {
      if (dateStr >= sw.start_date && dateStr <= sw.end_date) return "swap";
    }
    for (const r of approvedRequests) {
      if (dateStr >= r.start_date && dateStr <= r.end_date) return "leave";
    }
    return dayType(new Date(dateStr));
  };

  return (
    <div className="p-4 space-y-5 pb-6">
      <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-200 inline-block" />בבית לפי לוח</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-200 inline-block" />בקשה שאושרה</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-200 inline-block" />החלפה</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" />בבסיס</span>
      </div>

      {[4, 5, 6, 7].map((month) => {
        const weeks = calendarWeeks(2026, month);
        return (
          <div key={month}>
            <h3 className="font-bold text-[#2d3a2e] mb-2">{MONTH_NAMES[month]} 2026</h3>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {DAY_HEADERS.map((h) => (
                <div key={h} className="text-center text-xs text-gray-400 font-medium py-1">{h}</div>
              ))}
            </div>
            <div className="space-y-0.5">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-0.5">
                  {week.map((day, di) => {
                    if (!day) return <div key={di} className="aspect-square" />;
                    const dateStr = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const inRange = dateStr >= "2026-04-26" && dateStr <= "2026-07-13";
                    if (!inRange) return (
                      <div key={di} className="aspect-square rounded-lg flex items-center justify-center text-xs text-gray-300 bg-gray-50">{day}</div>
                    );
                    const cat = classify(dateStr);
                    const colors = { home: "bg-green-100 text-green-800", leave: "bg-yellow-100 text-yellow-800", swap: "bg-blue-100 text-blue-800", base: "bg-gray-100 text-gray-500" }[cat];
                    const icons = { home: "🏠", leave: "👍", swap: "🔁", base: "🛡️" }[cat];
                    return (
                      <div key={di} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium ${colors}`}>
                        <span className="leading-none text-[11px]">{day}</span>
                        <span className="text-[10px] leading-none mt-0.5">{icons}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
