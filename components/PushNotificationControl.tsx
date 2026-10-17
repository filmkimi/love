"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

type PushNotificationControlProps = { session: Session };

function decodeApplicationServerKey(value: string): ArrayBuffer {
  const padded = value + "=".repeat((4 - value.length % 4) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return bytes.buffer;
}

function isInstalledIosApp() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return !isIos || standaloneNavigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export default function PushNotificationControl({ session }: PushNotificationControlProps) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let active = true;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setMessage("อุปกรณ์หรือเบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน");
      return;
    }
    if (!publicKey) {
      setMessage("ระบบแจ้งเตือนยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์");
      return;
    }
    if (!isInstalledIosApp()) {
      setMessage("บน iPhone ให้เพิ่มเว็บแอปลงหน้าจอโฮมก่อนเปิดการแจ้งเตือน");
      return;
    }

    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (!active || !subscription || Notification.permission !== "granted") return;
        const response = await fetch("/api/push/subscription", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(subscription)
        });
        if (!response.ok) throw new Error("Could not sync this device's notification settings.");
        if (active) setEnabled(true);
      })
      .catch((error: unknown) => {
        console.error("Could not restore push notification settings:", error);
      });

    return () => {
      active = false;
    };
  }, [publicKey, session.access_token]);

  async function toggleNotifications() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setMessage("อุปกรณ์หรือเบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน");
        return;
      }
      if (!publicKey) {
        setMessage("ระบบแจ้งเตือนยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์");
        return;
      }
      if (!isInstalledIosApp()) {
        setMessage("บน iPhone ให้แตะ แชร์ แล้วเลือก เพิ่มไปยังหน้าจอโฮม จากนั้นเปิดแอปจากไอคอน");
        return;
      }

      if (!enabled) {
        const permission = Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
        if (permission !== "granted") {
          setMessage(permission === "denied"
            ? "อนุญาตการแจ้งเตือนได้จากการตั้งค่าเว็บไซต์ในเบราว์เซอร์"
            : "ยังไม่ได้อนุญาตการแจ้งเตือน");
          return;
        }
      }

      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (enabled && current) {
        const response = await fetch("/api/push/subscription", {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ endpoint: current.endpoint })
        });
        if (!response.ok) throw new Error("ปิดการแจ้งเตือนบนเซิร์ฟเวอร์ไม่สำเร็จ");
        await current.unsubscribe();
        setEnabled(false);
        setMessage("ปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว");
        return;
      }

      const subscription = current || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(publicKey)
      });
      const response = await fetch("/api/push/subscription", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(subscription)
      });
      if (!response.ok) throw new Error("บันทึกอุปกรณ์รับการแจ้งเตือนไม่สำเร็จ");
      setEnabled(true);
      setMessage("เปิดการแจ้งเตือนข้อความและคิดถึงนะแล้ว 💌");
    } catch (error) {
      console.error("Could not change push notification settings:", error);
      setMessage(error instanceof Error ? error.message : "ตั้งค่าการแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="flex min-h-10 items-center gap-2 rounded-full border border-rose-100 bg-white/70 px-3 py-2 text-xs font-medium text-plum transition hover:bg-white disabled:opacity-60 sm:text-sm"
        disabled={busy}
        onClick={() => void toggleNotifications()}
        type="button"
      >
        {busy ? <LoaderCircle className="animate-spin" size={16} /> : enabled ? <BellOff size={16} /> : <Bell size={16} />}
        <span className="hidden sm:inline">{enabled ? "ปิดแจ้งเตือน" : "เปิดแจ้งเตือน"}</span>
      </button>
      {message && <p aria-live="polite" className="max-w-56 text-right text-[10px] leading-4 text-ink/55 sm:text-xs">{message}</p>}
    </div>
  );
}
