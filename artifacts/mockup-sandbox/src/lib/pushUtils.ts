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

export type PushResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "server" | "error"; detail?: string };

export async function subscribeToPush(soldier: Soldier): Promise<PushResult> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };
    const reg = await navigator.serviceWorker.ready;
    const keyRes = await fetch(`${API_BASE}/api/push/vapid-key`);
    if (!keyRes.ok) return { ok: false, reason: "server", detail: `vapid-key ${keyRes.status}` };
    const { key } = (await keyRes.json()) as { key: string };
    if (!key) return { ok: false, reason: "server", detail: "empty key" };
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    await fetch(`${API_BASE}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldier_name: soldier.name, pkal: soldier.pkal, subscription }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", detail: String(e) };
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
