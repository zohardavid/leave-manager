import type { Soldier } from "./types";

const API_BASE = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output.buffer as ArrayBuffer;
}

export async function subscribeToPush(soldier: Soldier): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;
    const reg = await navigator.serviceWorker.ready;
    const keyRes = await fetch(`${API_BASE}/api/push/vapid-key`);
    if (!keyRes.ok) return false;
    const { key } = (await keyRes.json()) as { key: string };
    if (!key) return false;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    await fetch(`${API_BASE}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldier_name: soldier.name, pkal: soldier.pkal, subscription }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(soldierName: string): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    await fetch(`${API_BASE}/api/push/subscribe`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldier_name: soldierName }),
    });
  } catch { /* silent */ }
}
