import { useState, useEffect, useCallback } from "react";
import type { Soldier, LeaveRequest, Swap, AppNotification } from "../lib/types";
import { PKALS } from "../lib/types";
import { api } from "../lib/api";
import { toast } from "sonner";
import { countLeaveDays } from "./SoldierApp";
import { subscribeToPush, unsubscribeFromPush } from "../lib/pushUtils";
import { IconClipboard, IconCalendar, IconUsers, IconBell, IconBellSlash, IconCog } from "../lib/icons";

const STATUS_LABEL: Record<string, string> = { Pending: "ממתין", Approved: "אושר", Denied: "נדחה", Replaced: "הוחלף" };
const STATUS_BG: Record<string, string> = {
  Pending: "bg-amber-50/50 border-amber-100 text-amber-800",
  Approved: "bg-green-50/50 border-green-100 text-green-800",
  Denied: "bg-red-50/50 border-red-100 text-red-800",
  Replaced: "bg-gray-50 border-gray-200 text-gray-500",
};

const DEPLOYMENT_START = new Date(2026, 3, 26);
const DEPLOYMENT_END = new Date(2026, 6, 13);
const CYCLE_BASE = 8;
const CYCLE_LENGTH = 14;

function dayType(d: Date): "home" | "base" {
  if (d < DEPLOYMENT_START || d > DEPLOYMENT_END) return "base";
  const diff = Math.floor((d.getTime() - DEPLOYMENT_START.getTime()) / 86400000);
  return diff % CYCLE_LENGTH < CYCLE_BASE ? "base" : "home";
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

const inputCls = "w-full border-0 bg-gray-100/50 rounded-2xl px-4 py-3.5 text-base outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-[#4b6043] focus:bg-white transition-all placeholder:text-gray-400";

export default function CommanderApp({ soldier, onLogout }: { soldier: Soldier; onLogout: () => void; }) {
  const [tab, setTab] = useState<"calendar" | "history" | "soldiers" | "manage" | "notifications">("calendar");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem("lm_push_enabled") !== "false");
  const [noteMap, setNoteMap] = useState<Record<number, string>>({});
  const [calMonth, setCalMonth] = useState(4);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [r, sw, s, n] = await Promise.all([api.getRequests(), api.getSwaps(), api.getSoldiers(), api.getNotifications()]);
      setRequests(r); setSwaps(sw); setSoldiers(s); setNotifications(n);
    } catch { toast.error("שגיאה בטעינת נתונים"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleRequest = async (id: number, status: "Approved" | "Denied") => {
    try {
      const updated = await api.updateRequest(id, { status, commander_note: noteMap[id] ?? "" });
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      toast.success(status === "Approved" ? "הבקשה אושרה" : "הבקשה נדחתה");
    } catch { toast.error("שגיאה בעדכון הבקשה"); }
  };

  const handleSwap = async (id: number, status: "Approved" | "Denied") => {
    try {
      const updated = await api.updateSwap(id, { status });
      setSwaps((prev) => prev.map((s) => (s.id === id ? updated : s)));
      toast.success(status === "Approved" ? "ההחלפה אושרה" : "ההחלפה נדחתה");
    } catch { toast.error("שגיאה בעדכון ההחלפה"); }
  };

  const handleEdit = async (id: number, data: any, targetSoldier: string) => {
    const { commander_note, ...editFields } = data;
    try {
      let updated = await api.editRequest(id, editFields);
      if (commander_note) {
        updated = await api.updateRequest(id, { status: updated.status, commander_note });
      }
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      toast.success("הבקשה עודכנה");
      try {
        await api.sendNotification({
          target: targetSoldier,
          title: "עדכון בבקשת היציאה",
          body: "המפקד הציע שינוי לבקשת היציאה שלך. אנא בדוק את הפרטים החדשים.",
        });
      } catch { /* notification failure is non-critical */ }
    } catch { toast.error("שגיאה בעדכון הבקשה"); }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`למחוק את החייל ${name}?`)) return;
    try {
      await api.deleteSoldier(name);
      setSoldiers((prev) => prev.filter((s) => s.name !== name));
      toast.success("החייל נמחק בהצלחה");
    } catch { toast.error("שגיאה במחיקה"); }
  };

  const handleUpdateSoldier = async (oldName: string, data: any) => {
    try {
      const updated = await api.updateSoldier(oldName, data);
      setSoldiers((prev) => prev.map((s) => (s.name === oldName ? updated : s)));
      toast.success("פרופיל החייל עודכן");
    } catch { toast.error("שגיאה בעדכון פרופיל"); }
  };

  const handleSendNotification = async (data: any) => {
    try {
      await api.sendNotification(data);
      const updated = await api.getNotifications();
      setNotifications(updated);
      toast.success("ההתראה נשלחה בהצלחה");
    } catch { toast.error("שגיאה בשליחת ההתראה"); }
  };

  const pendingRequests = requests.filter((r) => r.status === "Pending");
  const pendingSwaps = swaps.filter((s) => s.status === "Pending");
  const totalPending = pendingRequests.length + pendingSwaps.length;

  const daysInMonth = (m: number) => new Date(2026, m, 0).getDate();
  const firstDay = (m: number) => new Date(2026, m - 1, 1).getDay();
  const calDays = Array.from({ length: daysInMonth(calMonth) }, (_, i) => i + 1);

  const soldierStats = soldiers.map((s) => {
    const days = requests
      .filter((r) => r.soldier_name === s.name && r.status === "Approved")
      .reduce((acc, r) => acc + countLeaveDays(r.start_date, r.end_date, r.departure_time, r.return_time), 0);
    return { ...s, days };
  });

  const TABS = [
    { id: "calendar", label: "לוח ניהול", Icon: IconCalendar },
    { id: "history", label: "היסטוריה", Icon: IconClipboard },
    { id: "soldiers", label: "סד״כ", Icon: IconUsers },
    { id: "notifications", label: "התראות", Icon: IconBell },
    { id: "manage", label: "ניהול", Icon: IconCog },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-[#fdfcf9] overflow-hidden">
      <header className="bg-[#4b6043] text-white px-6 py-4 shrink-0 flex items-center justify-between z-30 shadow-sm">
        <div>
          <div className="font-black text-xl tracking-tight">{soldier.name}</div>
          <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-0.5">מפקד מחלקה</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (pushEnabled) {
                await unsubscribeFromPush(soldier.name);
                setPushEnabled(false);
                localStorage.setItem("lm_push_enabled", "false");
                toast.info("התראות כובו");
              } else {
                const result = await subscribeToPush(soldier);
                setPushEnabled(result.ok);
                localStorage.setItem("lm_push_enabled", result.ok ? "true" : "false");
                if (result.ok) toast.success("התראות הופעלו");
                else if (result.reason === "unsupported") toast.error("הדפדפן לא תומך בהתראות");
                else if (result.reason === "denied") toast.error("הרשאת התראות נדחתה");
                else if (result.reason === "server") toast.error(`שגיאת שרת: ${result.detail ?? ""}`);
                else toast.error(`שגיאה: ${result.detail ?? ""}`);
              }
            }}
            className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-xl"
          >
            {pushEnabled ? <IconBell className="w-4 h-4 text-white" /> : <IconBellSlash className="w-4 h-4 opacity-50" />}
          </button>
          <button onClick={onLogout} className="text-[10px] font-bold bg-white/10 px-3 py-2 rounded-xl border border-white/5 uppercase tracking-widest">יציאה</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-32">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 font-bold uppercase tracking-widest text-sm animate-pulse">טוען נתונים...</div>
        ) : (
          <>
            {tab === "calendar" && <CalendarTab calMonth={calMonth} setCalMonth={setCalMonth} calDays={calDays} firstDay={firstDay} soldiers={soldiers} requests={requests} swaps={swaps} noteMap={noteMap} setNoteMap={setNoteMap} onRequest={handleRequest} onSwap={handleSwap} onEdit={handleEdit} />}
            {tab === "history" && <HistoryTab requests={requests} soldiers={soldiers} />}
            {tab === "soldiers" && <SoldiersTab stats={soldierStats} requests={requests} />}
            {tab === "notifications" && <NotificationsTab notifications={notifications} soldiers={soldiers} onSend={handleSendNotification} />}
            {tab === "manage" && <ManageTab soldiers={soldiers} onDelete={handleDelete} onUpdate={handleUpdateSoldier} />}
          </>
        )}
      </main>

      <nav className="fixed bottom-6 inset-x-4 z-40 bg-white/95 backdrop-blur-md border border-gray-100 rounded-[2rem] flex shadow-xl p-1.5 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 flex flex-col items-center justify-center py-2 min-w-[60px] transition-all">
            <span className={`w-10 h-8 flex items-center justify-center rounded-2xl transition-all relative ${tab === t.id ? "bg-[#4b6043] text-white shadow-lg shadow-[#4b6043]/20" : "text-gray-400"}`}>
              <t.Icon className="w-5 h-5" />
              {(t.id === "calendar" || t.id === "history") && totalPending > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-white" />
              )}
            </span>
            <span className={`text-[9px] mt-1 font-bold ${tab === t.id ? "text-[#4b6043]" : "text-gray-400"}`}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Calendar Tab ───────────────────────────────────────────────────────────────
function CalendarTab({ calMonth, setCalMonth, calDays, firstDay, soldiers, requests, swaps, noteMap, setNoteMap, onRequest, onSwap, onEdit }: any) {
  const MONTHS = ["", "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי"];
  const DAYS_HE = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [focusedLeave, setFocusedLeave] = useState<LeaveRequest | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ start_date: "", end_date: "", reason: "", departure_time: "", return_time: "", commander_note: "" });

  const blanks = Array.from({ length: firstDay(calMonth) }, (_, i) => i);
  const dStr = (day: number) => `2026-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const approvedOnDay = (day: number) => requests.filter((r: any) => r.status === "Approved" && r.start_date <= dStr(day) && r.end_date >= dStr(day));
  const pendingOnDay = (day: number) => requests.filter((r: any) => r.status === "Pending" && r.start_date <= dStr(day) && r.end_date >= dStr(day));
  const inDeployment = (day: number) => { const d = new Date(2026, calMonth - 1, day); return d >= DEPLOYMENT_START && d <= DEPLOYMENT_END; };

  const pendingSwaps = swaps.filter((s: any) => s.status === "Pending");

  const cellColor = (day: number, isSelected: boolean) => {
    if (isSelected) return "bg-[#4b6043] text-white shadow-lg shadow-[#4b6043]/30";
    if (approvedOnDay(day).length > 0) return "bg-green-50 text-green-700";
    if (pendingOnDay(day).length > 0) return "bg-amber-50 text-amber-600";
    if (!inDeployment(day)) return "bg-gray-50 text-gray-300";
    return dayType(new Date(2026, calMonth - 1, day)) === "home" ? "bg-[#fdfcf9] text-[#4b6043] border border-[#4b6043]/20" : "bg-white text-gray-700";
  };

  return (
    <div className="space-y-6">
      {pendingSwaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-[2rem] p-5 shadow-sm">
          <h3 className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-3">בקשות החלפה להחלטה</h3>
          <div className="space-y-3">
            {pendingSwaps.map((s: any) => (
              <div key={s.id} className="bg-white rounded-[1.5rem] p-4 flex justify-between items-center">
                <div>
                  <div className="font-black text-sm text-[#2d3a2e]">{s.requester} ↔ {s.partner}</div>
                  <div className="text-[10px] font-bold text-gray-500 mt-0.5">{fmt(s.start_date)} – {fmt(s.end_date)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onSwap(s.id, "Approved")} className="bg-[#4b6043] text-white w-8 h-8 rounded-xl flex items-center justify-center font-black">✓</button>
                  <button onClick={() => onSwap(s.id, "Denied")} className="bg-red-50 text-red-500 w-8 h-8 rounded-xl flex items-center justify-center font-black">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-white">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => { setCalMonth(Math.max(4, calMonth - 1)); setSelectedDay(null); setFocusedLeave(null); }} disabled={calMonth <= 4} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl text-gray-400 active:scale-90 transition-all">▶</button>
          <span className="font-black text-xl text-[#2d3a2e]">{MONTHS[calMonth]} 2026</span>
          <button onClick={() => { setCalMonth(Math.min(7, calMonth + 1)); setSelectedDay(null); setFocusedLeave(null); }} disabled={calMonth >= 7} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl text-gray-400 active:scale-90 transition-all">◀</button>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {DAYS_HE.map((d) => <div key={d} className="text-center text-[10px] text-gray-400 font-black py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {blanks.map((i) => <div key={`b${i}`} />)}
          {calDays.map((day: number) => {
            const isSelected = selectedDay === day;
            return (
              <button key={day} onClick={() => { setSelectedDay(isSelected ? null : day); setFocusedLeave(null); setEditMode(false); }} className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-xs font-black transition-all ${cellColor(day, isSelected)}`}>
                {day}
                <div className="flex gap-0.5 mt-1">
                  {approvedOnDay(day).length > 0 && <span className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-green-500"}`} />}
                  {pendingOnDay(day).length > 0 && <span className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-amber-500"}`} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay !== null && (() => {
        const approved = approvedOnDay(selectedDay);
        const pending = pendingOnDay(selectedDay);
        const isHomeDay = inDeployment(selectedDay) && dayType(new Date(2026, calMonth - 1, selectedDay)) === "home";
        const absent = [...approved, ...pending].map((r: any) => r.soldier_name);
        const onBase = soldiers.filter((s: any) => !absent.includes(s.name));

        return (
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white space-y-5">
            <div className="flex items-center justify-between">
              <span className="font-black text-[#2d3a2e] text-lg">{selectedDay} ב{MONTHS[calMonth]}</span>
              <span className={`text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-widest ${isHomeDay ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {isHomeDay ? "🏠 יום בית" : "🛡️ יום בסיס"}
              </span>
            </div>

            {pending.length > 0 && (
              <div>
                <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">⏳ ממתינים להחלטה ({pending.length})</div>
                <div className="flex flex-wrap gap-2">
                  {pending.map((r: any) => (
                    <button key={r.id} onClick={() => setFocusedLeave(focusedLeave?.id === r.id ? null : r)} className={`text-xs px-4 py-2 rounded-2xl font-bold transition-all ${focusedLeave?.id === r.id ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>{r.soldier_name}</button>
                  ))}
                </div>
              </div>
            )}

            {approved.length > 0 && (
              <div>
                <div className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">✅ מאושרים ({approved.length})</div>
                <div className="flex flex-wrap gap-2">
                  {approved.map((r: any) => (
                    <button key={r.id} onClick={() => setFocusedLeave(focusedLeave?.id === r.id ? null : r)} className={`text-xs px-4 py-2 rounded-2xl font-bold transition-all ${focusedLeave?.id === r.id ? "bg-green-600 text-white" : "bg-green-50 text-green-700"}`}>{r.soldier_name}</button>
                  ))}
                </div>
              </div>
            )}

            {focusedLeave && (
              <div className="bg-[#fdfcf9] border border-gray-100 rounded-[1.5rem] p-5 space-y-4 shadow-inner">
                {editMode ? (
                  <>
                    <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{focusedLeave.soldier_name} — תיקון בקשה</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1">מתאריך</label>
                        <input type="date" value={editData.start_date} onChange={(e) => setEditData((d) => ({ ...d, start_date: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1">עד תאריך</label>
                        <input type="date" value={editData.end_date} onChange={(e) => setEditData((d) => ({ ...d, end_date: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1">יציאה</label>
                        <input type="time" value={editData.departure_time} onChange={(e) => setEditData((d) => ({ ...d, departure_time: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1">חזרה</label>
                        <input type="time" value={editData.return_time} onChange={(e) => setEditData((d) => ({ ...d, return_time: e.target.value }))} className={inputCls} />
                      </div>
                    </div>
                    <input type="text" value={editData.reason} onChange={(e) => setEditData((d) => ({ ...d, reason: e.target.value }))} className={inputCls} placeholder="סיבה" />
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 mb-1">הערה לחייל (הסבר לשינוי)</label>
                      <textarea value={editData.commander_note} onChange={(e) => setEditData((d) => ({ ...d, commander_note: e.target.value }))} className={`${inputCls} h-16 resize-none`} placeholder="למשל: שיניתי את התאריכים כי יש אימון ביום שביקשת..." />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={async () => { await onEdit(focusedLeave.id, editData, focusedLeave.soldier_name); setEditMode(false); setFocusedLeave(null); }} className="flex-1 bg-amber-500 text-white py-3 rounded-2xl text-xs font-black shadow-lg shadow-amber-500/20">שמור ושלח לחייל</button>
                      <button onClick={() => setEditMode(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-2xl text-xs font-black">ביטול</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-base font-black text-[#2d3a2e]">{focusedLeave.soldier_name}</div>
                        <div className="text-xs font-bold text-gray-500 mt-1">
                          {fmt(focusedLeave.start_date)}–{fmt(focusedLeave.end_date)} ({countLeaveDays(focusedLeave.start_date, focusedLeave.end_date, focusedLeave.departure_time, focusedLeave.return_time)} ימים)
                        </div>
                        {(focusedLeave.departure_time || focusedLeave.return_time) && (
                          <div className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                            {focusedLeave.departure_time ? `יציאה: ${focusedLeave.departure_time}` : ""}{focusedLeave.departure_time && focusedLeave.return_time ? " • " : ""}{focusedLeave.return_time ? `חזרה: ${focusedLeave.return_time}` : ""}
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${STATUS_BG[focusedLeave.status]}`}>{STATUS_LABEL[focusedLeave.status]}</span>
                    </div>

                    <div className="text-sm font-medium text-gray-700 bg-white border border-gray-100 p-3 rounded-xl italic">
                      "{focusedLeave.reason}"
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-[#4b6043] uppercase tracking-widest mb-2">הערת מפקד (תופיע לחייל)</label>
                      <textarea placeholder="למשל: סע לשלום, תהיה זמין טלפונית..." className={`${inputCls} h-16 resize-none`} value={noteMap[focusedLeave.id] ?? focusedLeave.commander_note ?? ""} onChange={(e) => setNoteMap((m: any) => ({ ...m, [focusedLeave.id]: e.target.value }))} />
                    </div>

                    <div className="flex gap-2 pt-2">
                      {focusedLeave.status === "Pending" ? (
                        <>
                          <button onClick={async () => { await onRequest(focusedLeave.id, "Approved"); setFocusedLeave(null); }} className="flex-1 bg-[#4b6043] text-white py-3 rounded-xl text-xs font-black shadow-lg shadow-[#4b6043]/20">אישור</button>
                          <button onClick={async () => { await onRequest(focusedLeave.id, "Denied"); setFocusedLeave(null); }} className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl text-xs font-black border border-red-100">דחייה</button>
                        </>
                      ) : (
                        <button onClick={async () => { await onRequest(focusedLeave.id, "Denied"); setFocusedLeave(null); }} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl text-xs font-black">בטל אישור קודם</button>
                      )}
                      <button onClick={() => { setEditData({ start_date: focusedLeave.start_date, end_date: focusedLeave.end_date, reason: focusedLeave.reason, departure_time: focusedLeave.departure_time ?? "", return_time: focusedLeave.return_time ?? "", commander_note: focusedLeave.commander_note ?? "" }); setEditMode(true); }} className="flex-1 bg-amber-50 text-amber-600 py-3 rounded-xl text-xs font-black border border-amber-100">תקן בקשה ✏️</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {!isHomeDay && (
              <div className="pt-2 border-t border-gray-50">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">נשארים בבסיס ({onBase.length})</div>
                <div className="flex flex-wrap gap-2">
                  {onBase.map((s: any) => <span key={s.name} className="bg-gray-50 border border-gray-100 text-gray-600 font-bold text-[10px] px-3 py-1.5 rounded-full">{s.name}</span>)}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── History Tab ────────────────────────────────────────────────────────────────
function HistoryTab({ requests, soldiers }: any) {
  const [filterSoldier, setFilterSoldier] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filteredHistory = [...requests]
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .filter((r) => filterSoldier === "all" || r.soldier_name === filterSoldier)
    .filter((r) => filterStatus === "all" || r.status === filterStatus);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-white space-y-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">היסטוריית בקשות כוללת</h3>
        <div className="flex gap-3">
          <select value={filterSoldier} onChange={(e) => setFilterSoldier(e.target.value)} className="flex-1 bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-600 outline-none">
            <option value="all">כל החיילים</option>
            {soldiers.map((s: any) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="flex-1 bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-600 outline-none">
            <option value="all">כל הסטטוסים</option>
            <option value="Approved">אושרו</option>
            <option value="Pending">ממתינים</option>
            <option value="Denied">נדחו</option>
          </select>
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="text-center text-gray-400 py-16 font-bold text-sm">אין תוצאות בהיסטוריה</div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((r: any) => (
            <div key={r.id} className={`rounded-[2rem] p-5 shadow-sm border border-white relative overflow-hidden ${STATUS_BG[r.status]}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-black text-[#2d3a2e] text-base">{r.soldier_name}</span>
                <span className="text-[10px] font-black uppercase tracking-widest">{STATUS_LABEL[r.status]}</span>
              </div>
              <div className="text-xs font-bold text-gray-600 mb-1">
                {fmt(r.start_date)} – {fmt(r.end_date)} ({countLeaveDays(r.start_date, r.end_date, r.departure_time, r.return_time)} ימים)
              </div>
              <div className="text-[10px] font-bold text-gray-500 uppercase">
                {r.departure_time ? `יציאה: ${r.departure_time} • ` : ""}{r.return_time ? `חזרה: ${r.return_time} • ` : ""}{r.reason}
              </div>
              {r.commander_note && <div className="text-xs font-bold text-[#4b6043] mt-3 bg-white/50 p-3 rounded-xl italic">הערתך: "{r.commander_note}"</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Soldiers Tab ───────────────────────────────────────────────────────────────
function SoldiersTab({ stats, requests }: any) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const onLeaveToday = (name: string) => requests.some((r: any) => r.status === "Approved" && r.soldier_name === name && r.start_date <= todayStr && r.end_date >= todayStr);
  const pendingDays = (name: string) => requests.filter((r: any) => r.status === "Pending" && r.soldier_name === name).reduce((sum: number, r: any) => sum + countLeaveDays(r.start_date, r.end_date, r.departure_time, r.return_time), 0);

  const pkalCounts: Record<string, number> = {};
  for (const s of stats) { pkalCounts[s.pkal] = (pkalCounts[s.pkal] ?? 0) + 1; }
  const onLeaveTodayCount = stats.filter((s: any) => onLeaveToday(s.name)).length;
  const onBaseCount = stats.length - onLeaveTodayCount;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-white text-center">
          <div className="text-3xl font-black text-[#4b6043]">{onBaseCount}</div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">בבסיס היום</div>
        </div>
        <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-white text-center">
          <div className="text-3xl font-black text-amber-500">{onLeaveTodayCount}</div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">חופשה היום</div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-white">
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">הרכב מחלקה</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(pkalCounts).sort((a, b) => b[1] - a[1]).map(([pkal, count]) => (
            <div key={pkal} className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2">
              <span className="font-black text-[#4b6043] text-sm">{count}</span>
              <span className="text-xs font-bold text-gray-600">{pkal}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-white overflow-hidden">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">סטטוס חיילים</h3>
        <div className="space-y-3">
          {stats.map((s: any) => {
            const pending = pendingDays(s.name);
            const away = onLeaveToday(s.name);
            return (
              <div key={s.name} className="flex items-center justify-between bg-gray-50/50 p-4 rounded-2xl">
                <div>
                  <div className="font-black text-sm text-[#2d3a2e]">{s.name}</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase">{s.pkal}</div>
                </div>
                <div className="flex items-center gap-4 text-center">
                  <div>
                    <div className="text-[10px] font-bold text-gray-400">אושר</div>
                    <div className={`font-black text-sm ${s.days > 10 ? "text-red-500" : s.days > 5 ? "text-amber-500" : "text-[#4b6043]"}`}>{s.days}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-gray-400">ממתין</div>
                    <div className="font-black text-sm text-gray-600">{pending > 0 ? pending : "-"}</div>
                  </div>
                  <div className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest w-16 ${away ? "bg-amber-100 text-amber-700" : "bg-green-50 text-green-700"}`}>
                    {away ? "בבית" : "בסיס"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Notifications Tab ──────────────────────────────────────────────────────────
function NotificationsTab({ notifications, soldiers, onSend }: any) {
  const [target, setTarget] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    await onSend({ target, title: title.trim(), body: body.trim() });
    setTitle(""); setBody(""); setSending(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white space-y-4">
        <h3 className="font-black text-[#2d3a2e] text-lg">שליחת התראה</h3>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
          <option value="all">כולם</option>
          {soldiers.map((s: any) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="כותרת..." className={inputCls} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="תוכן ההודעה..." rows={3} className={`${inputCls} resize-none`} />
        <button onClick={() => void handleSend()} disabled={sending || !title.trim() || !body.trim()} className="w-full bg-[#4b6043] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#4b6043]/20 disabled:opacity-50 active:scale-95 transition-all">
          {sending ? "שולח..." : "שלח עכשיו 🔔"}
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">היסטוריית התראות</h3>
        {notifications.length === 0 && <div className="text-center text-gray-400 py-6 text-sm font-bold">אין הודעות.</div>}
        {notifications.map((n: any) => (
          <div key={n.id} className="bg-white rounded-[2rem] p-5 shadow-sm border border-white">
            <div className="flex justify-between items-start">
              <div className="font-black text-[#2d3a2e] text-sm">{n.title}</div>
              <div className="text-[10px] font-bold text-gray-400">{new Date(n.sent_at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <div className="text-xs font-medium text-gray-600 mt-1">{n.body}</div>
            <div className="text-[10px] font-bold text-[#4b6043] mt-2 uppercase tracking-widest bg-[#4b6043]/5 inline-block px-3 py-1 rounded-full">
              נמען: {n.target === "all" ? "כולם" : n.target}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Manage Tab ─────────────────────────────────────────────────────────────────
function ManageTab({ soldiers, onDelete, onUpdate }: any) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: "", pkal: "", password: "" });

  const startEdit = (s: any) => { setEditing(s.name); setEditData({ name: s.name, pkal: s.pkal, password: "" }); };
  const cancelEdit = () => { setEditing(null); setEditData({ name: "", pkal: "", password: "" }); };

  const saveEdit = async (oldName: string) => {
    const data: any = {};
    if (editData.name.trim() && editData.name !== oldName) data.name = editData.name.trim();
    if (editData.pkal.trim() && editData.pkal !== soldiers.find((s: any) => s.name === oldName)?.pkal) data.pkal = editData.pkal.trim();
    if (editData.password.trim()) data.password = editData.password.trim();
    if (Object.keys(data).length === 0) { cancelEdit(); return; }
    await onUpdate(oldName, data);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">{soldiers.length} חיילים במערכת</h3>
      {soldiers.map((s: any) => (
        <div key={s.name} className="bg-white rounded-[2rem] p-5 shadow-sm border border-white">
          {editing === s.name ? (
            <div className="space-y-4">
              <div className="text-xs font-black text-[#4b6043] uppercase tracking-widest">עריכת פרופיל</div>
              <input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className={inputCls} placeholder="שם" />
              <select value={editData.pkal} onChange={(e) => setEditData({ ...editData, pkal: e.target.value })} className={inputCls}>
                {PKALS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input type="password" value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} className={inputCls} placeholder="סיסמה חדשה (אופציונלי)" />
              <div className="flex gap-3">
                <button onClick={() => void saveEdit(s.name)} className="flex-1 bg-[#4b6043] text-white py-3 rounded-2xl text-xs font-black shadow-lg shadow-[#4b6043]/20">שמור שינויים</button>
                <button onClick={cancelEdit} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-2xl text-xs font-black">ביטול</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-black text-[#2d3a2e] text-base">{s.name}</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{s.pkal}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(s)} className="bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-xs font-black">עריכה</button>
                <button onClick={() => onDelete(s.name)} className="bg-red-50 text-red-500 px-4 py-2 rounded-xl text-xs font-black">מחק</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
