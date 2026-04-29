import { useState } from "react";
import type { Soldier } from "./lib/types";
import { Toaster } from "./components/ui/sonner";
import LoginPage from "./pages/LoginPage";
import SoldierApp from "./pages/SoldierApp";
import CommanderApp from "./pages/CommanderApp";
import { subscribeToPush } from "./lib/pushUtils";

interface Session {
  soldier: Soldier;
  role: "soldier" | "commander" | "sergeant";
}

function loadSession(): Session | null {
  try {
    const s = localStorage.getItem("lm_session");
    return s ? (JSON.parse(s) as Session) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);

  const handleLogin = (soldier: Soldier, token: string) => {
    const role: "soldier" | "commander" | "sergeant" =
      soldier.pkal === "מפקד מחלקה" ? "commander" :
      soldier.pkal === "סמל" ? "sergeant" : "soldier";
    const s: Session = { soldier, role };
    setSession(s);
    localStorage.setItem("lm_session", JSON.stringify(s));
    localStorage.setItem("lm_token", token);
    if (localStorage.getItem("lm_push_enabled") !== "false") {
      void subscribeToPush(soldier);
    }
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem("lm_session");
    localStorage.removeItem("lm_token");
  };

  return (
    <div dir="rtl" className="h-dvh flex flex-col bg-gray-100 overflow-hidden select-none">
      {!session && <LoginPage onLogin={(s, t) => handleLogin(s, t)} />}
      {session?.role === "soldier" && (
        <SoldierApp soldier={session.soldier} onLogout={handleLogout} />
      )}
      {session?.role === "sergeant" && (
        <SoldierApp soldier={session.soldier} onLogout={handleLogout} isSergeant />
      )}
      {session?.role === "commander" && (
        <CommanderApp soldier={session.soldier} onLogout={handleLogout} />
      )}
      <Toaster position="top-center" richColors />
    </div>
  );
}
