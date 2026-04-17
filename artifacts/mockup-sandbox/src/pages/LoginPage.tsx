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

const inputCls =
  "w-full border border-gray-300 rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-[#4b6043] bg-white";

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
    <div className="flex-1 flex flex-col items-center justify-center p-5 bg-[#f4f2ec]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center text-5xl mx-auto mb-4 shadow-md border border-[#e5e1d8]">
            🪖
          </div>
          <h1 className="text-2xl font-bold text-[#2d3a2e] tracking-tight">
            מערכת ניהול יציאות
          </h1>
          <p className="text-[#6b7a6b] text-sm mt-1">
            כניסה לחיילים ומפקדים
          </p>
          {(installPrompt || isIos) && (
            <button
              onClick={handleInstall}
              className="mt-3 flex items-center gap-2 mx-auto bg-[#4b6043] hover:bg-[#3a4d33] text-white text-sm px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              <span>📲</span>
              <span>הוסף לדף הבית</span>
            </button>
          )}
          {showIosHint && (
            <div className="mt-3 bg-[#4b6043]/10 border border-[#4b6043]/20 text-[#2d3a2e] text-xs rounded-xl px-4 py-3 text-center leading-relaxed">
              לחץ על <strong>שתף</strong> ⬆️ ואז <strong>"הוסף למסך הבית"</strong>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-xl border border-[#e5e1d8]">
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  tab === t
                    ? "bg-white shadow text-slate-900"
                    : "text-slate-500"
                }`}
              >
                {t === "login" ? "🔑 כניסה" : "📝 הרשמה"}
              </button>
            ))}
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  סיסמה
                </label>
                <input
                  type="password"
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#4b6043] text-white py-3 rounded-xl font-semibold text-base disabled:opacity-50 active:scale-95 transition-transform"
              >
                {loading ? "מתחבר..." : "כניסה"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  סיסמה
                </label>
                <input
                  type="password"
                  value={regPw}
                  onChange={(e) => setRegPw(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              {regPkal === "מפקד מחלקה" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    קוד אישור מפקד
                  </label>
                  <input
                    type="password"
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#4b6043] text-white py-3 rounded-xl font-semibold text-base disabled:opacity-50 active:scale-95 transition-transform"
              >
                {loading ? "נרשם..." : "הרשמה וכניסה"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
