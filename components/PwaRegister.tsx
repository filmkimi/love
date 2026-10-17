"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error: unknown) => {
        console.error("ลงทะเบียนเซอร์วิสเวิร์กเกอร์ไม่สำเร็จ:", error);
      });
  }, []);

  return null;
}
