import { useState } from "react";
import type { Soldier } from "./lib/types";
import { Toaster } from "./components/ui/sonner";
import LoginPage from "./pages/LoginPage";
import SoldierApp from "./pages/SoldierApp";
import CommanderApp from "./pages/CommanderApp";

interface Session {
  soldier: Soldier;
  role: "soldier" | "commander";
}

function loadSession(): Session | null {
  try {
    const s = localStorage.getItem("lm_session");
    return s ? (JSON.parse(s) as Session) : null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

async function subscribeToPush(soldier: Soldier): Promise<void> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
    const keyRes = await fetch("/api/push/vapid-key");
    if (!keyRes.ok) return;
    const { key } = (await keyRes.json()) as { key: string };
    if (!key) return;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldier_name: soldier.name, pkal: soldier.pkal, subscription }),
    });
  } catch {
    // push not supported or denied — silent fail
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);

  const handleLogin = (soldier: Soldier) => {
    const role: "soldier" | "commander" =
      soldier.pkal === "מפקד מחלקה" ? "commander" : "soldier";
    const s: Session = { soldier, role };
    setSession(s);
    localStorage.setItem("lm_session", JSON.stringify(s));
    void subscribeToPush(soldier);
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem("lm_session");
  };

  return (
    <div dir="rtl" className="h-dvh flex flex-col bg-gray-100 overflow-hidden select-none">
      {!session && <LoginPage onLogin={handleLogin} />}
      {session?.role === "soldier" && (
        <SoldierApp soldier={session.soldier} onLogout={handleLogout} />
      )}
      {session?.role === "commander" && (
        <CommanderApp soldier={session.soldier} onLogout={handleLogout} />
      )}
      <Toaster position="top-center" richColors />
    </div>
  );
}
