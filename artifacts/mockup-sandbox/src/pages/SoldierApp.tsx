import { useState, useEffect, useCallback } from "react";
import type { Soldier, LeaveRequest, Swap } from "../lib/types";
import { api } from "../lib/api";
import { toast } from "sonner";
import { subscribeToPush, unsubscribeFromPush } from "../lib/pushUtils";
import { IconHome, IconClipboard, IconCalendar, IconBell, IconBellSlash } from "../lib/icons";

// --- לוגיקה וקבועים ---
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

function countLeaveDays(startDate: string, endDate: string, departureTime?: string, returnTime?: string): number {
  const base = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
  let days = base;
  if (departureTime && departureTime >= "12:00") days -= 1;
  if (returnTime && returnTime <= "12:00") days -= 1;
  return Math.max(0, days);
}

const STATUS_LABEL: Record<string, string> = { Pending: "ממתינה 🟡", Approved: "אושרה ✅", Denied: "נדחתה ❌" };
const STATUS_COLOR: Record<string, string> = {
  Pending: "bg-yellow-50/50 border-yellow-100 text-yellow-700",
  Approved: "bg-green-50/50 border-green-100 text-green-700",
  Denied: "bg-red-50/50 border-red-100 text-red-700",
};

const inputCls = "w-full border-0 bg-gray-100/50 rounded-2xl px-4 py-3.5 text-base outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-[#4b6043] focus:bg-white transition-all placeholder:text-gray-400";

export default function SoldierApp({ soldier, onLogout }: { soldier: Soldier; onLogout: () => void; }) {
  const [tab, setTab] = useState<"home" | "requests" | "calendar">("home");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem("lm_push_enabled") !== "false");

  const load = useCallback(async () => {
    try {
      const [myReqs, swps] = await Promise.all([api.getRequests(soldier.name), api.getSwaps()]);
      setRequests(myReqs);
      setSwaps(swps);
    } catch { /* silent */ }
  }, [soldier.name]);

  useEffect(() => { void load(); }, [load]);

  const daysApproved = requests.filter((r) => r.status === "Approved").reduce((sum, r) => sum + countLeaveDays(r.start_date, r.end_date, r.departure_time, r.return_time), 0);
  const daysLeft = Math.max(0, Math.round((DEPLOYMENT_END.getTime() - new Date().getTime()) / 86400000));

  return (
    <div className="flex flex-col h-full bg-[#fdfcf9] overflow-hidden">
      {/* Header מינימליסטי וצר */}
      <header className="bg-[#4b6043] text-white px-6 py-4 shrink-0 flex items-center justify-between z-30 shadow-sm">
        <div className="font-black text-xl tracking-tight">{soldier.name}</div>
        <div className="flex items-center gap-2">
          <button onClick={async () => {
            if (pushEnabled) { await unsubscribeFromPush(soldier.name); setPushEnabled(false); localStorage.setItem("lm_push_enabled", "false"); }
            else { const r = await subscribeToPush(soldier); setPushEnabled(r.ok); localStorage.setItem("lm_push_enabled", r.ok ? "true" : "false"); }
          }} className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-xl">
            {pushEnabled ? <IconBell className="w-4 h-4" /> : <IconBellSlash className="w-4 h-4 opacity-50" />}
          </button>
          <button onClick={onLogout} className="text-[10px] font-bold bg-white/10 px-3 py-2 rounded-xl border border-white/5 uppercase">יציאה</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pt-6 pb-32">
        {tab === "home" && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-white flex justify-between items-center">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">תפקיד</div>
                <div className="text-sm font-black text-[#2d3a2e]">{soldier.pkal}</div>
              </div>
              <div className="text-left">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">מחלקה</div>
                <div className="text-sm font-black text-[#2d3a2e]">1</div>
              </div>
            </div>

            <div className="bg-[#2d3a2e] rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden text-white">
              <div className="text-6xl font-black leading-none">{daysLeft}</div>
              <div className="text-lg font-bold opacity-40 mt-2 text-right">ימים לסיום</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white">
                <div className="text-3xl font-black text-[#4b6043]">{daysApproved}</div>
                <div className="text-[10px] text-gray-400 font-bold uppercase mt-2">ימי חופש</div>
              </div>
              <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white">
                <div className="text-3xl font-black text-[#2d3a2e]">{requests.length}</div>
                <div className="text-[10px] text-gray-400 font-bold uppercase mt-2">בקשות</div>
              </div>
            </div>
          </div>
        )}

        {tab === "requests" && (
          <div className="space-y-6">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-white space-y-4">
              <h3 className="font-black text-[#2d3a2e]">בקשה חדשה</h3>
              <input type="date" className={inputCls} />
              <textarea placeholder="סיבה..." className={`${inputCls} h-20 resize-none`} />
              <button className="w-full bg-[#4b6043] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#4b6043]/20">הגש</button>
            </div>
          </div>
        )}
      </main>

      {/* Nav תחתון צף */}
      <nav className="fixed bottom-6 inset-x-6 z-40 bg-white/95 backdrop-blur-md border border-gray-100 rounded-[2rem] flex shadow-xl p-2">
        {(["home", "requests", "calendar"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 flex flex-col items-center py-2 transition-all ${tab === k ? "text-[#4b6043]" : "text-gray-300"}`}>
            {k === "home" ? <IconHome className="w-6 h-6" /> : k === "requests" ? <IconClipboard className="w-6 h-6" /> : <IconCalendar className="w-6 h-6" />}
          </button>
        ))}
      </nav>
    </div>
  );
}