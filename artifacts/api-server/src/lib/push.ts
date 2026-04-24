import webpush from "web-push";
import { query } from "./db.js";

export function initPush(): void {
  const pub = process.env["VAPID_PUBLIC_KEY"];
  const priv = process.env["VAPID_PRIVATE_KEY"];
  const email = process.env["VAPID_EMAIL"] ?? "mailto:admin@example.com";
  if (pub && priv) {
    webpush.setVapidDetails(email, pub, priv);
  }
}

export const vapidPublicKey = (): string => process.env["VAPID_PUBLIC_KEY"] ?? "";

async function send(subscription: webpush.PushSubscription, soldierName: string, title: string, body: string): Promise<void> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 410 || status === 404) {
      await query("DELETE FROM subscriptions WHERE soldier_name = $1", [soldierName]).catch(() => {});
    }
  }
}

export async function notifyCommanders(title: string, body: string): Promise<void> {
  if (!process.env["VAPID_PUBLIC_KEY"]) return;
  const result = await query("SELECT soldier_name, subscription FROM subscriptions WHERE pkal = 'מפקד מחלקה'");
  await Promise.allSettled(
    result.rows.map((row) => send(row.subscription as webpush.PushSubscription, row.soldier_name as string, title, body)),
  );
}

export async function notifySoldier(soldierName: string, title: string, body: string): Promise<void> {
  if (!process.env["VAPID_PUBLIC_KEY"]) return;
  const result = await query("SELECT subscription FROM subscriptions WHERE soldier_name = $1", [soldierName]);
  if (result.rows.length === 0) return;
  await send(result.rows[0].subscription as webpush.PushSubscription, soldierName, title, body);
}
