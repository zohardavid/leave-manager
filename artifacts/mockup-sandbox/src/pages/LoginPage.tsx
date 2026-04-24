import { useState, useEffect } from "react";
import type { Soldier } from "../lib/types";
import { api } from "../lib/api";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PKALS = [
  "לוחם","חובש","קשר","מטול","קלע","איבו","אבטה","נגב","מאג","מפקד מחלקה",
];

// עיצוב משופר לשדות הקלט
const inputCls =
  "w-full border-0 bg-gray-50/50 rounded-2xl px-4 py-3 text-base outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-[#4b6043] focus:bg-white transition-all placeholder:text-gray-400";

export default function LoginPage({
  onLogin,
}: {
  onLogin: (s: Soldier) => void;
}) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window.navigator as unknown as { standalone?: boolean }).standalone;
    setIsIos(ios);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
    } else if (isIos) {
      setShowIosHint(true);
    }
  };

  const [loginName, setLoginName] = useState("");
  const [loginPw, setLoginPw] = useState("");

  const [regName, setRegName] = useState("");
  const [regPkal, setRegPkal] = useState(PKALS[0]!);
  const [regPw, setRegPw] = useState("");
  const [masterKey, setMasterKey] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { soldier } = await api.login(loginName.trim(), loginPw);
      onLogin(soldier);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { soldier } = await api.register(
        regName.trim(),
        regPkal,
        regPw,
        regPkal === "מפקד מחלקה" ? masterKey : undefined,
      );
      onLogin(soldier);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  };

  return (
    // h-screen ו-overflow-hidden מבטלים את הגלילה בדסקטופ ובמובייל
    <div className="h-screen w-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#fdfcf9] to-[#f3f1eb] overflow-hidden select-none">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          {/* אייקון קסדה צף */}
          <div className="w-20 h-20 flex items-center justify-center text-6xl mx-auto mb-4 drop-shadow-xl animate-bounce-slow">
            🪖
          </div>
          
          {/* עדכון למחלקה 1 */}
          <div className="text-[11px] tracking-[0.25em] uppercase text-[#4b6043]/70 font-bold mb-2">מחלקה 1 · תעסוקה 2026</div>
          
          <h1 className="text-3xl font-extrabold text-[#1a241b] tracking-tight leading-none">
            ניהול יציאות
          </h1>
          
          {(installPrompt || isIos) && (
            <button
              onClick={handleInstall}
              className="mt-5 inline-flex items-center gap-2 bg-[#4b6043] hover:bg-[#3a4d33] text-white text-xs font-bold px-5 py-2.5 rounded-full transition-all shadow-md active:scale-95"
            >
              <span>📲</span>
              <span>התקן אפליקציה</span>
            </button>
          )}

          {showIosHint && (
            <div className="mt-4 bg-white/60 backdrop-blur-sm border border-gray-200 text-gray-700 text-xs rounded-2xl px-4 py-3 shadow-sm inline-block">
              לחץ על <strong>שתף</strong> ⬆️ ואז <strong>"הוסף למסך הבית"</strong>
            </div>
          )}
        </div>

        {/* הכרטיס המרכזי */}
        <div className="bg-white rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-white">
          <div className="flex bg-gray-100/80 p-1.5 rounded-2xl mb-6">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-[calc(1.25rem-4px)] transition-all ${
                  tab === t
                    ? "bg-white shadow-sm text-[#4b6043]"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t === "login" ? "כניסה" : "הרשמה"}
              </button>
            ))}
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mr-1">
                  שם מלא
                </label>
                <input
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  placeholder="ישראל ישראלי"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mr-1">
                  סיסמה
                </label>
                <input
                  type="password"
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#4b6043] hover:bg-[#3a4d33] text-white py-4 rounded-2xl font-bold text-base shadow-lg shadow-[#4b6043]/20 disabled:opacity-50 active:scale-[0.98] transition-all mt-2"
              >
                {loading ? "מתחבר..." : "כניסה למערכת"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mr-1">
                  שם מלא
                </label>
                <input
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="ישראל ישראלי"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mr-1">
                  פק"ל
                </label>
                <select
                  value={regPkal}
                  onChange={(e) => setRegPkal(e.target.value)}
                  className={inputCls}
                >
                  {PKALS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mr-1">
                  סיסמה
                </label>
                <input
                  type="password"
                  value={regPw}
                  onChange={(e) => setRegPw(e.target.value)}
                  placeholder="לפחות 6 תווים"
                  className={inputCls}
                  required
                />
              </div>
              {regPkal === "מפקד מחלקה" && (
                <div>
                  <label className="block text-xs font-bold text-[#4b6043] uppercase tracking-wider mb-2 mr-1">
                    קוד אישור מפקד
                  </label>
                  <input
                    type="password"
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                    className={`${inputCls} ring-[#4b6043]/30 bg-[#4b6043]/5`}
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#4b6043] hover:bg-[#3a4d33] text-white py-4 rounded-2xl font-bold text-base shadow-lg shadow-[#4b6043]/20 disabled:opacity-50 active:scale-[0.98] transition-all mt-2"
              >
                {loading ? "יוצר חשבון..." : "סיום הרשמה"}
              </button>
            </form>
          )}
        </div>
        
        <p className="text-center text-gray-400 text-[10px] mt-6 tracking-widest uppercase font-medium">
          Powered by Zohar David &bull; 2026
        </p>
      </div>
    </div>
  );
}