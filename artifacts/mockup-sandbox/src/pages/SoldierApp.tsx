import { useState, useEffect, useCallback } from "react";
import type { Soldier, LeaveRequest, Swap } from "../lib/types";
import { api } from "../lib/api";
import { toast } from "sonner";
import { subscribeToPush, unsubscribeFromPush } from "../lib/pushUtils";
import { IconHome, IconClipboard, IconCalendar, IconBell, IconBellSlash } from "../lib/icons";

// --- קבועים ופונקציות עזר ---
const DEPLOYMENT_START = new Date(2026, 3, 26);
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

const STATUS_LABEL: Record<string, string> = { Pending: "ממתינה 🟡", Approved: "אושרה ✅", Denied: "נדחתה ❌" };
const STATUS_COLOR: Record<string, string> = {
  Pending: "bg-yellow-50/50 border-yellow-100 text-yellow-700",
  Approved: "bg-green-50/50 border-green-100 text-green-700",
  Denied: "bg-red-50/50 border-red-100 text-red-700",
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

const inputCls = "w-full border-0 bg-gray-100/50 rounded-2xl px-4 py-3.5 text-base outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-[#4b6043] focus:bg-white transition-all placeholder:text-gray-400";

type Tab = "home" | "requests" | "calendar";

export default function SoldierApp({ soldier, onLogout }: { soldier: Soldier; onLogout: () => void; }) {
  const [tab, setTab] = useState<Tab>("home");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem("lm_push_enabled") !== "false");

  const load = useCallback(async () => {
    try {
      const [myReqs, allReqs, swps] = await Promise.all([
        api.getRequests(soldier.name),
        api.getRequests(),
        api.getSwaps(),
      ]);
      setRequests(myReqs);
      setAllRequests(allReqs);
      setSwaps(swps);
    } catch { /* silent */ }
  }, [soldier.name]);

  useEffect(() => { void load(); }, [load]);

  const daysApproved = requests
    .filter((r) => r.status === "Approved")
    .reduce((sum, r) => sum + countLeaveDays(r.start_date, r.end_date, r.departure_time, r.return_time), 0);

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = todayMidnight < DEPLOYMENT_START
      ? Math.round((DEPLOYMENT_START.getTime() - todayMidnight.getTime()) / 86400000)
      : todayMidnight <= DEPLOYMENT_END
        ? Math.round((DEPLOYMENT_END.getTime() - todayMidnight.getTime()) / 86400000)
        : 0;

  const navItems: { key: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { key: "home", label: "בית", Icon: IconHome },
    { key: "requests", label: "בקשות", Icon: IconClipboard },
    { key: "calendar", label: "לוח", Icon: IconCalendar },
  ];

  const todayDisplay = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col h-full bg-[#fdfcf9]">
      {/* Header אלגנטי וצר */}
      <header className="bg-gradient-to-r from-[#4b6043] to-[#3a4d33] text-white px-6 pt-8 pb-8 shrink-0 rounded-b-[2.5rem] shadow-md relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <div className="text-[10px] tracking-[0.15em] uppercase text-white/40 font-bold">מחלקה 1</div>
            <div className="font-black text-xl tracking-tight leading-none mt-1">{soldier.name}</div>
          </div>
          <div className="flex items-center gap-2">
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
                  else toast.error("שגיאה בהפעלת התראות");
                }
              }}
              className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-xl backdrop-blur-md active:scale-90 transition-all border border-white/5"
            >
              {pushEnabled ? <IconBell className="w-4 h-4 text-white" /> : <IconBellSlash className="w-4 h-4 text-white/40" />}
            </button>
            <button onClick={onLogout} className="text-white font-bold text-[11px] bg-white/10 px-3 py-2 rounded-xl border border-white/5 active:bg-white/20 transition-all">
              יציאה
            </button>
          </div>
        </div>
        <div className="text-white/40 text-[10px] mt-3 font-medium tracking-wide border-t border-white/5 pt-2">
          {soldier.pkal} • {todayDisplay}
        </div>
      </header>

      {/* Main - ללא Margin שלילי */}
      <main className="flex-1 overflow-y-auto pb-40 pt-6 px-6 relative z-20">
        {tab === "home" && <HomeTab daysApproved={daysApproved} daysLeft={daysLeft} requestCount={requests.length} />}
        {tab === "requests" && <RequestsTab soldier={soldier} requests={requests} allRequests={allRequests} onRefresh={load} />}
        {tab === "calendar" && <CalendarTab soldier={soldier} requests={requests} swaps={swaps} />}
      </main>

      {/* Nav צף */}
      <nav className="fixed bottom-6 inset-x-6 z-30 bg-white/95 backdrop-blur-xl border border-white/20 rounded-[2.5rem] flex shadow-[0_20px_50px_rgba(0,0,0,0.12)] p-2">
        {navItems.map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)} className="flex-1 flex flex-col items-center py-2 gap-1 transition-all">
            <span className={`w-12 h-9 flex items-center justify-center rounded-2xl transition-all ${tab === item.key ? "bg-[#4b6043] text-white shadow-lg shadow-[#4b6043]/20" : "text-gray-400"}`}>
              <item.Icon className="w-5 h-5" />
            </span>
            <span className={`text-[10px] font-bold ${tab === item.key ? "text-[#4b6043]" : "text-gray-400"}`}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function HomeTab({ daysApproved, daysLeft, requestCount }: any) {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const beforeDeployment = todayMidnight < DEPLOYMENT_START;
  const countdownTo = beforeDeployment ? "לתחילת התעסוקה" : "לסיום התעסוקה";
  const countdownDate = beforeDeployment ? "26 באפריל 2026" : "13 ביולי 2026";

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-gradient-to-br from-[#2d3a2e] to-[#1a241b] rounded-[2.5rem] p-8 shadow-xl shadow-[#2d3a2e]/20 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-6xl font-black text-white leading-none tracking-tighter">{daysLeft}</span>
          <span className="text-2xl font-bold text-white/50">ימים</span>
        </div>
        <div className="text-white text-lg font-bold mt-2">{countdownTo}</div>
        <div className="text-white/30 text-[10px] mt-4 font-bold tracking-widest uppercase">{countdownDate}</div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-white">
          <div className="text-4xl font-black text-[#4b6043] leading-none">{daysApproved}</div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-3">ימי חופש</div>
        </div>
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-white">
          <div className="text-4xl font-black text-[#2d3a2e] leading-none">{requestCount}</div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-3">בקשות הוגשו</div>
        </div>
      </div>
    </div>
  );
}

function RequestsTab({ soldier, requests, allRequests, onRefresh }: any) {
  const [view, setView] = useState<"new" | "history" | "swap">("new");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createRequest({ soldier_name: soldier.name, start_date: startDate, end_date: endDate, reason });
      toast.success("בקשה הוגשה");
      setReason("");
      await onRefresh();
      setView("history");
    } catch { toast.error("שגיאה"); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-gray-100/80 p-1.5 rounded-2xl">
        {(["new", "history", "swap"] as const).map((t) => (
          <button key={t} onClick={() => setView(t)} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${view === t ? "bg-white shadow-sm text-[#4b6043]" : "text-gray-400"}`}>
            {t === "new" ? "חדשה" : t === "history" ? "שלי" : "החלפה"}
          </button>
        ))}
      </div>
      {view === "new" && (
        <form onSubmit={submitRequest} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white space-y-5">
          <h3 className="font-extrabold text-[#2d3a2e] text-lg">בקשת יציאה חדשה</h3>
          <div className="grid grid-cols-2 gap-4">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} required />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} className={inputCls} required />
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="סיבת היציאה..." className={`${inputCls} resize-none h-24`} required />
          <button type="submit" disabled={loading} className="w-full bg-[#4b6043] text-white py-4 rounded-2xl font-bold active:scale-95 transition-all">הגש בקשה</button>
        </form>
      )}
      {view === "history" && (
        <div className="space-y-4">
          {requests.map((r: any) => (
            <div key={r.id} className={`rounded-[2rem] border p-6 bg-white shadow-sm ${STATUS_COLOR[r.status]}`}>
              <div className="flex justify-between items-start">
                <div className="text-sm font-black tracking-tight">{r.start_date} ← {r.end_date}</div>
                <div className="text-[10px] font-black uppercase tracking-widest">{STATUS_LABEL[r.status]}</div>
              </div>
              <div className="text-[10px] font-bold opacity-60 mt-1">{r.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarTab({ soldier, requests, swaps }: any) {
  const classify = (dateStr: string): "leave" | "swap" | "home" | "base" => {
    for (const sw of swaps) if (sw.status === 'Approved' && dateStr >= sw.start_date && dateStr <= sw.end_date) return "swap";
    for (const r of requests) if (r.status === 'Approved' && dateStr >= r.start_date && dateStr <= r.end_date) return "leave";
    return dayType(new Date(dateStr));
  };

  return (
    <div className="space-y-8">
      {[4, 5, 6, 7].map((month) => {
        const weeks = calendarWeeks(2026, month);
        return (
          <div key={month} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white">
            <h3 className="font-black text-[#2d3a2e] mb-4 text-center">{MONTH_NAMES[month]} 2026</h3>
            <div className="grid grid-cols-7 gap-1">
              {weeks.map((week, wi) => week.map((day, di) => {
                if (!day) return <div key={`${wi}-${di}`} />;
                const dateStr = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const cat = classify(dateStr);
                const styles = { home: "bg-green-50 text-green-600", leave: "bg-yellow-50 text-yellow-600", swap: "bg-blue-50 text-blue-600", base: "text-gray-300" }[cat];
                return (
                  <div key={dateStr} className={`aspect-square rounded-xl flex items-center justify-center text-[11px] font-black ${styles}`}>
                    {day}
                  </div>
                );
              }))}
            </div>
          </div>
        );
      })}
    </div>
  );
}