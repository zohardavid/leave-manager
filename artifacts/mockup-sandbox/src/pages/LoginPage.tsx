import { useState } from "react";
import type { Soldier } from "../lib/types";
import { api } from "../lib/api";
import { toast } from "sonner";

const PKALS = [
  "לוחם","חובש","קשר","מטול","קלע","איבו","אבטה","נגב","מאג","מפקד מחלקה",
];

const inputCls =
  "w-full border border-gray-300 rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-slate-600 bg-white";

export default function LoginPage({
  onLogin,
}: {
  onLogin: (s: Soldier) => void;
}) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

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
    <div className="flex-1 flex flex-col items-center justify-center p-5 bg-gradient-to-b from-slate-800 to-slate-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="text-6xl mb-3">🪖</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            מערכת ניהול יציאות
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            כניסה לחיילים ומפקדים
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-2xl">
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
                className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold text-base disabled:opacity-50 active:scale-95 transition-transform"
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
                className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold text-base disabled:opacity-50 active:scale-95 transition-transform"
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
