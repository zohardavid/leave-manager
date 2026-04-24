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

function dayType(d: Date): "home" | "base" {
  if (d < DEPLOYMENT_START || d > DEPLOYMENT_END) return "base";
  const diff = Math.floor((d.getTime() - DEPLOYMENT_START.getTime()) / 86400000);
  const pos = diff % CYCLE_LENGTH;
  return pos < CYCLE_BASE ? "base" : "home";
}

function countLeaveDays(startDate: string, endDate: string): number {
  const base = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
  return Math.max(0, base);
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
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem("lm_push_enabled") !== "false");

  const load = useCallback(async () => {
    try {
      const [myReqs, swps] = await Promise.all([
        api.getRequests(soldier.name),
        api.getSwaps(),
      ]);
      setRequests(myReqs);
      setSwaps(swps);
    } catch { /* silent */ }
  }, [soldier.name]);

  useEffect(() => { void load(); }, [load]);

  const daysApproved = requests
    .filter((r) => r.status === "Approved")
    .reduce((sum, r) => sum + countLeaveDays(r.start_date, r.end_date), 0);

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.max(0, Math.round((DEPLOYMENT_END.getTime() - todayMidnight.getTime()) / 86400000));
  const todayDisplay = today.toLocaleDateString("he-IL", { day: "numeric", month: "long" });

  const navItems: { key: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { key: "home", label: "בית", Icon: IconHome },
    { key: "requests", label: "בקשות", Icon: IconClipboard },
    { key: "calendar", label: "לוח", Icon: IconCalendar },
  ];

  return (
    <div className="flex flex-col h-full bg-[#fdfcf9]">
      {/* Header מינימליסטי - דק ונקי */}
      <header className="bg-[#4b6043] text-white px-6 py-4 shrink-0 shadow-sm relative z-10">
        <div className="flex items-center justify-between">
          <div className="font-black text-xl tracking-tight leading-none">{soldier.name}</div>
          <div className="flex items-center gap-3">
             <button
              onClick={async () => {
                if (pushEnabled) {
                  await unsubscribeFromPush(soldier.name);
                  localStorage.setItem("lm_push_enabled", "false");
                  setPushEnabled(false);
                  toast.info("התראות כובו");
                } else {
                  const result = await subscribeToPush(soldier);
                  setPushEnabled(result.ok);
                  if (result.ok) toast.success("התראות הופעלו");
                }
              }}
              className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-xl active:scale-90 transition-all"
            >
              {pushEnabled ? <IconBell className="w-4 h-4 text-white" /> : <IconBellSlash className="w-4 h-4 text-white/40" />}
            </button>
            <button onClick={onLogout} className="text-white font-bold text-[10px] bg-white/10 px-3 py-2 rounded-xl active:bg-white/20 transition-all uppercase tracking-widest">
              יציאה
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-40 pt-6 px-6 relative z-20">
        {tab === "home" && (
          <div className="flex flex-col gap-4">
            {/* כרטיס סטטוס אישי */}
            <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-white flex justify-between items-center">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">תפקיד</div>
                <div className="text-sm font-black text-[#2d3a2e]">{soldier.pkal} • מחלקה 1</div>
              </div>
              <div className="text-left">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">היום</div>
                <div className="text-sm font-black text-[#2d3a2e]">{todayDisplay}</div>
              </div>
            </div>

            {/* כרטיס ימים לסיום */}
            <div className="bg-gradient-to-br from-[#2d3a2e] to-[#1a241b] rounded-[2.5rem] p-8 shadow-xl shadow-[#2d3a2e]/20 relative overflow-hidden">
               <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
               <div className="flex items-baseline gap-2">
                 <span className="text-7xl font-black text-white leading-none tracking-tighter">{daysLeft}</span>
                 <span className="text-2xl font-bold text-white/40">ימים לסיום</span>
               </div>
            </div>

            {/* סטטיסטיקות */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-white">
                <div className="text-4xl font-black text-[#4b6043] leading-none">{daysApproved}</div>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-3">ימי חופש</div>
              </div>
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-white">
                <div className="text-4xl font-black text-[#2d3a2e] leading-none">{requests.length}</div>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-3">בקשות</div>
              </div>
            </div>
          </div>
        )}

        {tab === "requests" && (
           <RequestsTab soldier={soldier} requests={requests} onRefresh={load} />
        )}

        {tab === "calendar" && (
          <CalendarTab soldier={soldier} requests={requests} swaps={swaps} />
        )}
      </main>

      {/* Navigation תחתון צף */}
      <nav className="fixed bottom-6 inset-x-6 z-30 bg-white/95 backdrop-blur-xl border border-white/20 rounded-[2.5rem] flex shadow-[0_20px_50px_rgba(0,0,0,0.12)] p-2">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className="flex-1 flex flex-col items-center py-2 gap-1 transition-all"
          >
            <span className={`w-12 h-10 flex items-center justify-center rounded-2xl transition-all ${
              tab === item.key ? "bg-[#4b6043] text-white shadow-lg shadow-[#4b6043]/20" : "text-gray-400"
            }`}>
              <item.Icon className="w-5 h-5" />
            </span>
            <span className={`text-[10px] font-bold ${tab === item.key ? "text-[#4b6043]" : "text-gray-400"}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function RequestsTab({ soldier, requests, onRefresh }: any) {
  const [view, setView] = useState<"new" | "history">("new");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0,10));
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
        {(["new", "history"] as const).map((t) => (
          <button key={t} onClick={() => setView(t)} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${view === t ? "bg-white shadow-sm text-[#4b6043]" : "text-gray-400"}`}>
            {t === "new" ? "חדשה" : "הבקשות שלי"}
          </button>
        ))}
      </div>
      {view === "new" && (
        <form onSubmit={submitRequest} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white space-y-5">
          <h3 className="font-extrabold text-[#2d3a2e] text-lg">בקשת יציאה</h3>
          <div className="grid grid-cols-2 gap-4">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} required />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} className={inputCls} required />
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="סיבת היציאה..." className={`${inputCls} resize-none h-24`} required />
          <button type="submit" disabled={loading} className="w-full bg-[#4b6043] text-white py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-[#4b6043]/20">הגש בקשה</button>
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
              <div className="text-[10px] font-bold opacity-60 mt-2">{r.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarTab({ soldier, requests, swaps }: any) {
  const classify = (dateStr: string): "leave" | "swap" | "home" | "base" => {
    for (const sw of swaps) if (sw.status === 'Approved' && (sw.requester === soldier.name || sw.partner === soldier.name) && dateStr >= sw.start_date && dateStr <= sw.end_date) return "swap";
    for (const r of requests) if (r.status === 'Approved' && dateStr >= r.start_date && dateStr <= r.end_date) return "leave";
    return dayType(new Date(dateStr));
  };

  return (
    <div className="space-y-8 pb-10">
      {[4, 5, 6, 7].map((month) => {
        const weeks = calendarWeeks(2026, month);
        return (
          <div key={month} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white">
            <h3 className="font-black text-[#2d3a2e] mb-4 text-center">{MONTH_NAMES[month]} 2026</h3>
            <div className="grid grid-cols-7 mb-2">
              {DAY_HEADERS.map((h) => <div key={h} className="text-center text-[10px] text-gray-300 font-black py-1">{h}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weeks.map((week, wi) => week.map((day, di) => {
                if (!day) return <div key={`${wi}-${di}`} />;
                const dateStr = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const cat = classify(dateStr);
                const styles = { home: "bg-green-50 text-green-600", leave: "bg-yellow-50 text-yellow-600", swap: "bg-blue-50 text-blue-600", base: "text-gray-300" }[cat];
                return (
                  <div key={dateStr} className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[11px] font-black ${styles}`}>
                    {day}
                    {cat !== 'base' && <div className="w-1 h-1 rounded-full bg-current mt-0.5" />}
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