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

const STATUS_LABEL: Record<string, string> = { Pending: "ממתינה 🟡", Approved: "אושרה ✅", Denied: "נדחתה ❌", Modified: "עודכנה ✏️" };
const STATUS_COLOR: Record<string, string> = {
  Pending: "bg-yellow-50/50 border-yellow-100 text-yellow-700",
  Approved: "bg-green-50/50 border-green-100 text-green-700",
  Denied: "bg-red-50/50 border-red-100 text-red-700",
  Modified: "bg-blue-50/50 border-blue-100 text-blue-700",
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
      const [myReqs, swps] = await Promise.all([api.getRequests(soldier.name), api.getSwaps()]);
      setRequests(myReqs);
      setSwaps(swps);
    } catch { /* silent */ }
  }, [soldier.name]);

  useEffect(() => { void load(); }, [load]);

  const [soldierData, setSoldierData] = useState<Soldier>(soldier);

  const handleEquipmentUpdate = async (data: Record<string, string>) => {
    try {
      const updated = await api.updateSoldier(soldierData.name, data);
      setSoldierData(updated);
      const raw = localStorage.getItem("lm_session");
      if (raw) {
        const s = JSON.parse(raw) as { soldier: Soldier; role: string };
        s.soldier = updated;
        localStorage.setItem("lm_session", JSON.stringify(s));
      }
      toast.success("הציוד עודכן בהצלחה ✅");
    } catch { toast.error("שגיאה בעדכון הציוד"); }
  };

  const daysApproved = requests.filter((r) => r.status === "Approved").reduce((sum, r) => sum + countLeaveDays(r.start_date, r.end_date, r.departure_time, r.return_time), 0);
  
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  let daysLeft = 0;
  let countdownLabel = "לסיום התעסוקה";

  if (todayMidnight < DEPLOYMENT_START) {
    daysLeft = Math.round((DEPLOYMENT_START.getTime() - todayMidnight.getTime()) / 86400000);
    countdownLabel = "ימים לתחילת התעסוקה";
  } else if (todayMidnight <= DEPLOYMENT_END) {
    daysLeft = Math.round((DEPLOYMENT_END.getTime() - todayMidnight.getTime()) / 86400000);
    countdownLabel = "ימים לסיום התעסוקה";
  } else {
    daysLeft = 0;
    countdownLabel = "התעסוקה הסתיימה";
  }

  const todayDisplay = new Date().toLocaleDateString("he-IL", { day: "numeric", month: "long" });

  const navItems: { key: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { key: "home", label: "בית", Icon: IconHome },
    { key: "requests", label: "בקשות יציאה", Icon: IconClipboard },
    { key: "calendar", label: "לוח שנה", Icon: IconCalendar },
  ];

  return (
    <div className="flex flex-col h-full bg-[#fdfcf9] overflow-hidden">
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
          <HomeTab soldier={soldierData} daysApproved={daysApproved} daysLeft={daysLeft} requestCount={requests.length} todayDisplay={todayDisplay} countdownLabel={countdownLabel} onSoldierUpdate={handleEquipmentUpdate} />
        )}

        {tab === "requests" && (
          <RequestsTab soldier={soldier} requests={requests} swaps={swaps} onRefresh={load} />
        )}

        {tab === "calendar" && (
          <CalendarTab soldier={soldier} requests={requests} swaps={swaps} />
        )}
      </main>

      <nav className="fixed bottom-6 inset-x-6 z-40 bg-white/95 backdrop-blur-md border border-gray-100 rounded-[2rem] flex shadow-xl p-2">
        {navItems.map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)} className={`flex-1 flex flex-col items-center py-2 transition-all`}>
            <span className={`w-12 h-9 flex items-center justify-center rounded-2xl transition-all ${tab === item.key ? "bg-[#4b6043] text-white shadow-lg shadow-[#4b6043]/20" : "text-gray-400"}`}>
              <item.Icon className="w-5 h-5" />
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

const EQUIP_FIELDS = [
  { key: "mispar_ishi", label: 'מ"א' },
  { key: "tzz_neshek", label: "צ' נשק" },
  { key: "tzz_kavanot2", label: "צ' כוונת 2" },
  { key: "tzz_kavanot_m5", label: "צ' כוונת M5" },
  { key: "tzz_amrel", label: "צ' אמרל" },
  { key: "tzz_kesher", label: "צ' קשר" },
  { key: "tzz_nosaf", label: "צ' נוסף" },
] as const;

function HomeTab({ soldier, daysApproved, daysLeft, requestCount, todayDisplay, countdownLabel, onSoldierUpdate }: any) {
  const [editingEquip, setEditingEquip] = useState(false);
  const [equipData, setEquipData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    setEquipData(Object.fromEntries(EQUIP_FIELDS.map(({ key }) => [key, soldier[key] ?? ""])));
    setEditingEquip(true);
  };

  const saveEquipment = async () => {
    setSaving(true);
    try {
      await onSoldierUpdate(equipData);
      setEditingEquip(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-white flex justify-between items-center">
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">תפקיד</div>
          <div className="text-sm font-black text-[#2d3a2e]">{soldier.pkal} • מחלקה 1</div>
        </div>
        <div className="text-left">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">היום</div>
          <div className="text-sm font-black text-[#2d3a2e]">{todayDisplay}</div>
        </div>
      </div>

      <div className="bg-[#2d3a2e] rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden text-white">
        <div className="text-6xl font-black leading-none">{daysLeft}</div>
        <div className="text-lg font-bold opacity-40 mt-2 text-right">{countdownLabel}</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white">
          <div className="text-3xl font-black text-[#4b6043]">{daysApproved}</div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2">ימי חופש</div>
        </div>
        <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white">
          <div className="text-3xl font-black text-[#2d3a2e]">{requestCount}</div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2">בקשות הוגשו</div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ציוד אישי</div>
          {!editingEquip ? (
            <button onClick={openEdit} className="text-[10px] font-black text-[#4b6043] uppercase tracking-widest bg-[#4b6043]/5 px-3 py-1.5 rounded-xl active:scale-95 transition-all">
              עריכה ✏️
            </button>
          ) : (
            <button onClick={() => setEditingEquip(false)} className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              ביטול
            </button>
          )}
        </div>

        {editingEquip ? (
          <div className="space-y-3">
            {EQUIP_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
                <input
                  value={equipData[key] ?? ""}
                  onChange={(e) => setEquipData((d) => ({ ...d, [key]: e.target.value }))}
                  className={inputCls}
                  placeholder={`הזן ${label}...`}
                />
              </div>
            ))}
            <button
              onClick={() => void saveEquipment()}
              disabled={saving}
              className="w-full bg-[#4b6043] text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-[#4b6043]/20 disabled:opacity-50 active:scale-[0.98] transition-all mt-2"
            >
              {saving ? "שומר..." : "שמור שינויים"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {EQUIP_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</div>
                <div className="text-sm font-black text-[#2d3a2e] truncate">
                  {(soldier[key] as string | undefined)?.trim() || <span className="text-gray-200 font-medium">—</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestsTab({ soldier, requests, swaps, onRefresh }: any) {
  const [view, setView] = useState<"new" | "history" | "swap">("new");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  
  // --- הוספת השדות לשעות ---
  const [departureTime, setDepartureTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const [swapPartner, setSwapPartner] = useState("");
  const [swapStart, setSwapStart] = useState("2026-04-26");
  const [swapEnd, setSwapEnd] = useState("2026-04-26");

  const mySwaps = swaps.filter((s: any) => s.requester === soldier.name);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // עדכון ה-API לקבל גם את השעות
      await api.createRequest({ soldier_name: soldier.name, start_date: startDate, end_date: endDate, departure_time: departureTime, return_time: returnTime, reason });
      toast.success("✅ בקשה הוגשה בהצלחה!");
      setReason("");
      setDepartureTime("");
      setReturnTime("");
      await onRefresh();
      setView("history");
    } catch (err) { toast.error("שגיאה בהגשת בקשה"); } finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("למחוק את הבקשה?")) return;
    try {
      await api.deleteRequest(id);
      toast.success("הבקשה נמחקה");
      await onRefresh();
    } catch { toast.error("שגיאה במחיקה"); }
  };

  const handleConfirmEdit = async (id: number) => {
    try {
      await api.updateRequest(id, { status: "Approved" });
      toast.success("אישרת את השינוי ✅");
      await onRefresh();
    } catch { toast.error("שגיאה באישור"); }
  };

  const handleTalkRequest = async (soldierName: string, requestId: number) => {
    try {
      await api.sendNotification({
        target: "commanders",
        title: `📞 ${soldierName} רוצה לדבר`,
        body: `${soldierName} מבקש לדבר איתך לגבי תיקון בקשת היציאה (בקשה #${requestId})`,
      });
      toast.success("הודעה נשלחה למפקד — הוא יחזור אליך");
    } catch { toast.error("שגיאה בשליחת ההודעה"); }
  };

  const modifiedRequests = requests.filter((r: any) => r.status === "Modified");

  const submitSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapPartner) return;
    setLoading(true);
    try {
      await api.createSwap({ requester: soldier.name, partner: swapPartner, start_date: swapStart, end_date: swapEnd });
      toast.success("✅ בקשת החלפה נשלחה!");
      await onRefresh();
    } catch (err) { toast.error("שגיאה בשליחת החלפה"); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      {/* בקשות שהמפקד תיקן — דורשות תגובה */}
      {modifiedRequests.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-[2rem] p-5 space-y-4">
          <div className="text-[10px] font-black text-blue-700 uppercase tracking-widest">✏️ המפקד תיקן בקשה — נדרשת תגובתך</div>
          {modifiedRequests.map((r: any) => (
            <div key={r.id} className="bg-white rounded-[1.5rem] p-5 space-y-3 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-black text-[#2d3a2e]">{r.start_date} – {r.end_date}</div>
                  <div className="text-[10px] font-bold text-gray-500 mt-0.5">
                    {r.departure_time ? `יציאה: ${r.departure_time} • ` : ""}{r.return_time ? `חזרה: ${r.return_time} • ` : ""}{r.reason}
                  </div>
                </div>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">עודכנה</span>
              </div>
              {r.commander_note && (
                <div className="bg-[#4b6043]/5 border border-[#4b6043]/10 rounded-xl p-3 text-sm text-[#2d3a2e] italic">
                  💬 המפקד: "{r.commander_note}"
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => void handleConfirmEdit(r.id)} className="flex-1 bg-[#4b6043] text-white py-2.5 rounded-xl text-xs font-black shadow-md shadow-[#4b6043]/20 active:scale-95 transition-all">
                  אשר שינוי ✅
                </button>
                <button onClick={() => void handleTalkRequest(soldier.name, r.id)} className="flex-1 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-xl text-xs font-black active:scale-95 transition-all">
                  רוצה לדבר 📞
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex bg-gray-100/80 p-1.5 rounded-2xl">
        {([ { key: "new", label: "בקשה חדשה" }, { key: "history", label: "הבקשות שלי" }, { key: "swap", label: "החלפה" } ] as const).map((t) => (
          <button key={t.key} onClick={() => setView(t.key)} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${view === t.key ? "bg-white shadow-sm text-[#4b6043]" : "text-gray-400"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {view === "new" && (
        <form onSubmit={submitRequest} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white space-y-5">
          <h3 className="font-extrabold text-[#2d3a2e] text-lg">בקשת יציאה חדשה</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 mr-1">מתאריך</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 mr-1">עד תאריך</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} className={inputCls} required />
            </div>
          </div>
          
          {/* הוספת שדות שעות */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 mr-1">שעת יציאה</label>
              <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 mr-1">שעת חזרה</label>
              <input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 mr-1">סיבה</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="פרט את סיבת היציאה..." className={`${inputCls} resize-none h-24`} required />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-[#4b6043] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#4b6043]/20 active:scale-[0.98] transition-all">
            {loading ? "שולח..." : "הגש בקשה"}
          </button>
        </form>
      )}

      {view === "history" && (
        <div className="space-y-4">
          {requests.length === 0 ? <div className="text-center text-gray-300 py-10 font-medium">אין בקשות עדיין</div> : (
            [...requests].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)).map((r) => (
              <div key={r.id} className={`rounded-[2rem] border p-6 bg-white shadow-sm relative ${STATUS_COLOR[r.status]}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-black tracking-tight">{r.start_date} ← {r.end_date}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest">{STATUS_LABEL[r.status]}</div>
                </div>
                {/* הצגת השעות במידה והוזנו */}
                <div className="text-[10px] font-bold opacity-60 mb-3">
                  {r.departure_time ? `יציאה ב-${r.departure_time} • ` : ""}
                  {r.return_time ? `חזרה ב-${r.return_time} • ` : ""}
                  {r.reason}
                </div>
                <button onClick={() => handleDelete(r.id)} className="w-full text-[10px] font-black uppercase tracking-widest border border-red-200 text-red-500 py-2 rounded-xl hover:bg-red-50 transition-colors">מחק בקשה</button>
              </div>
            ))
          )}
        </div>
      )}

      {view === "swap" && (
        <div className="space-y-6">
          <form onSubmit={submitSwap} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white space-y-5">
            <h3 className="font-extrabold text-[#2d3a2e] text-lg">בקשת החלפה</h3>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 mr-1">עם מי מחליפים?</label>
              <input type="text" value={swapPartner} onChange={(e) => setSwapPartner(e.target.value)} placeholder="שם החייל" className={inputCls} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 mr-1">מתאריך</label>
                <input type="date" value={swapStart} onChange={(e) => setSwapStart(e.target.value)} min="2026-04-26" className={inputCls} required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 mr-1">עד תאריך</label>
                <input type="date" value={swapEnd} onChange={(e) => setSwapEnd(e.target.value)} min={swapStart} className={inputCls} required />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-[#4b6043] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#4b6043]/20 active:scale-[0.98] transition-all">
              {loading ? "שולח..." : "שלח בקשת החלפה"}
            </button>
          </form>
          {mySwaps.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 px-2">בקשות ההחלפה שלי</h4>
              {mySwaps.map((sw: any) => (
                <div key={sw.id} className={`rounded-2xl border p-4 ${STATUS_COLOR[sw.status]}`}>
                  <div className="flex justify-between items-center"><span className="text-sm font-black">עם {sw.partner}</span><span className="text-[10px] font-bold">{STATUS_LABEL[sw.status]}</span></div>
                  <div className="text-[10px] font-bold opacity-60 mt-1">{sw.start_date} ← {sw.end_date}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CalendarTab({ soldier, requests, swaps }: any) {
  const approvedRequests = requests.filter((r: any) => r.status === "Approved");
  const approvedSwaps = swaps.filter((s: any) => s.status === "Approved" && (s.requester === soldier.name || s.partner === soldier.name));

  const classify = (dateStr: string): "leave" | "swap" | "home" | "base" => {
    for (const sw of approvedSwaps) { if (dateStr >= sw.start_date && dateStr <= sw.end_date) return "swap"; }
    for (const r of approvedRequests) { if (dateStr >= r.start_date && dateStr <= r.end_date) return "leave"; }
    return dayType(new Date(dateStr));
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 flex-wrap uppercase tracking-wider justify-center">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-400" />בית</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />בקשת יציאה</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" />החלפה</span>
      </div>

      {[4, 5, 6, 7].map((month) => {
        const weeks = calendarWeeks(2026, month);
        return (
          <div key={month} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white">
            <h3 className="font-black text-[#2d3a2e] mb-4 text-center">{MONTH_NAMES[month]} 2026</h3>
            <div className="grid grid-cols-7 mb-2">{DAY_HEADERS.map((h) => (<div key={h} className="text-center text-[10px] text-gray-300 font-black py-1">{h}</div>))}</div>
            <div className="grid grid-cols-7 gap-1">
              {weeks.map((week, wi) => (
                week.map((day, di) => {
                  if (!day) return <div key={`${wi}-${di}`} />;
                  const dateStr = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const inRange = dateStr >= "2026-04-26" && dateStr <= "2026-07-13";
                  const cat = classify(dateStr);
                  if (!inRange) return (<div key={dateStr} className="aspect-square rounded-xl flex items-center justify-center text-[11px] text-gray-200 font-bold">{day}</div>);
                  const styles = { home: "bg-green-50 text-green-600", leave: "bg-yellow-50 text-yellow-600", swap: "bg-blue-50 text-blue-600", base: "text-gray-300 bg-gray-50/50" }[cat];
                  return (
                    <div key={dateStr} className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[11px] font-black transition-all ${styles}`}>
                      {day}
                      {cat !== 'base' && <div className={`w-1 h-1 rounded-full mt-1 ${cat === 'home' ? 'bg-green-400' : cat === 'leave' ? 'bg-yellow-400' : 'bg-blue-400'}`} />}
                    </div>
                  );
                })
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}