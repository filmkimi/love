"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, LoaderCircle, LockKeyhole, Delete } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type ProfileId = "A" | "B";
const profiles: { id: ProfileId; name: string }[] = [
  { id: "A", name: process.env.NEXT_PUBLIC_USER_A_NAME || "คุณ" },
  { id: "B", name: process.env.NEXT_PUBLIC_USER_B_NAME || "คนรักของคุณ" }
];

function translateLoginError(message: string) {
  if (/missing|setting|environment|setup|supabase/i.test(message)) return "การตั้งค่าระบบยังไม่ครบ กรุณาตรวจสอบค่าการเชื่อมต่อ Supabase";
  if (/too many|rate limit|wait/i.test(message)) return "ลองใส่รหัสหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (/not enabled|not invited|couple space/i.test(message)) return "โปรไฟล์นี้ยังไม่ได้รับอนุญาตให้เข้าใช้งาน กรุณาตรวจสอบการตั้งค่าสมาชิก";
  if (/pin|password|credentials|invalid/i.test(message)) return "รหัสไม่ถูกต้อง ลองใหม่อีกครั้งนะ";
  return "เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง";
}

export default function AuthGate({ children }: { children: (session: Session) => React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileId | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [configured, setConfigured] = useState(true);
  const pinRef = useRef("");

  useEffect(() => {
    let alive = true;
    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (!alive) return;
        if (sessionError) setError("ตรวจสอบเซสชันไม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง");
        setSession(data.session);
        setLoading(false);
      });
      const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (alive) setSession(newSession);
      });
      return () => {
        alive = false;
        data.subscription.unsubscribe();
      };
    } catch {
      setConfigured(false);
      setLoading(false);
      return () => {
        alive = false;
      };
    }
  }, []);

  function clearPin() {
    pinRef.current = "";
    setPin("");
    setError("");
  }

  async function unlock() {
    if (!profile || pinRef.current.length !== 6 || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/profile-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, pin: pinRef.current })
      });
      const result = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        error?: string;
        missingSettings?: string[];
      };
      if (!response.ok || !result.access_token || !result.refresh_token) {
        const missing = result.missingSettings?.length
          ? ` (ค่าที่ขาด: ${result.missingSettings.join(", ")})`
          : "";
        setError(`${translateLoginError(result.error || "")}${missing}`);
        pinRef.current = "";
        setPin("");
        return;
      }

      const { error: sessionError } = await getSupabaseBrowserClient().auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token
      });
      if (sessionError) {
        setError("เริ่มเซสชันส่วนตัวไม่สำเร็จ กรุณาลองอีกครั้ง");
        pinRef.current = "";
        setPin("");
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง");
      pinRef.current = "";
      setPin("");
    } finally {
      setSubmitting(false);
    }
  }

  function addDigit(digit: string) {
    if (submitting || pinRef.current.length >= 6) return;
    const nextPin = pinRef.current + digit;
    pinRef.current = nextPin;
    setPin(nextPin);
    setError("");
  }

  function handlePinInput(value: string) {
    const nextPin = value.replace(/\D/g, "").slice(0, 6);
    pinRef.current = nextPin;
    setPin(nextPin);
    setError("");
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center"><LoaderCircle className="animate-spin text-plum" size={28} /></main>;
  }
  if (session) return <>{children(session)}</>;

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-12">
      <div className="absolute left-[8%] top-[12%] -rotate-12 text-3xl text-rose-200">✦</div>
      <div className="absolute bottom-[13%] right-[10%] rotate-12 text-2xl text-sage/70">✿</div>
      <section className="w-full max-w-[420px] rounded-[2rem] border border-white/80 bg-white/85 p-7 shadow-soft backdrop-blur sm:p-10">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-blush text-plum"><Heart fill="currentColor" size={25} /></div>
        <p className="mb-2 text-center text-xs font-bold uppercase tracking-[0.24em] text-plum/70">พื้นที่ของเราสองคน</p>
        <h1 className="serif text-center text-4xl text-ink">โลกใบเล็กของเรา</h1>
        <p className="mx-auto mb-7 mt-3 max-w-xs text-center text-sm leading-6 text-ink/60">
          {profile ? `ใส่รหัสอีกนิดเดียว แล้วกลับบ้านของเรากันนะ ${profiles.find((item) => item.id === profile)?.name}` : "เลือกโปรไฟล์ของคุณเพื่อเข้าสู่โลกใบเล็กของเรา"}
        </p>

        {!configured ? (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            เพิ่ม URL ของโปรเจกต์และ anon key ของ Supabase ในไฟล์ <code>.env.local</code> แล้วเริ่มเซิร์ฟเวอร์ใหม่
          </div>
        ) : (
          <>
            <div aria-label="เลือกโปรไฟล์" className="grid grid-cols-2 gap-3">
              {profiles.map((item, index) => (
                <button
                  aria-pressed={profile === item.id}
                  className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${profile === item.id ? "border-plum bg-blush text-plum" : "border-rose-100 bg-[#fffdfb] text-ink/70 hover:bg-rose-50"}`}
                  key={item.id}
                  onClick={() => {
                    setProfile(item.id);
                    clearPin();
                  }}
                  type="button"
                >
                  <span aria-hidden="true" className="mb-1 block text-xl">{index === 0 ? "🌷" : "🌿"}</span>
                  {item.name}
                </button>
              ))}
            </div>

            {profile && (
              <form className="mt-6" onSubmit={(event) => { event.preventDefault(); void unlock(); }}>
                <label className="sr-only" htmlFor="profile-pin">รหัส PIN 6 หลัก</label>
                <input
                  autoComplete="one-time-code"
                  className="mb-4 w-full rounded-xl border border-rose-100 bg-[#fffdfb] px-4 py-3 text-center text-lg tracking-[0.45em] outline-none focus:border-plum/50"
                  id="profile-pin"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => handlePinInput(event.target.value)}
                  pattern="[0-9]{6}"
                  placeholder="••••••"
                  type="password"
                  value={pin}
                />
                <div aria-label="แป้นตัวเลข PIN" className="mx-auto grid max-w-[250px] grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "delete"].map((digit, index) => digit === "" ? (
                    <span aria-hidden="true" key={`empty-${index}`} />
                  ) : digit === "delete" ? (
                    <button aria-label="ลบตัวเลขตัวสุดท้าย" className="grid h-12 place-items-center rounded-xl text-ink/60 hover:bg-blush" key={digit} onClick={() => handlePinInput(pin.slice(0, -1))} type="button"><Delete size={19} /></button>
                  ) : (
                    <button className="h-12 rounded-xl bg-[#faf5f3] text-lg font-semibold text-ink transition hover:bg-blush active:scale-95" key={digit} onClick={() => addDigit(digit)} type="button">{digit}</button>
                  ))}
                </div>
                {error && <p className="mt-4 text-center text-sm text-red-700" role="alert">{error}</p>}
                <button
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-plum px-5 py-3.5 font-semibold text-white shadow-lg shadow-plum/20 transition hover:bg-[#67435e] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting || pin.length !== 6}
                  type="submit"
                >
                  {submitting ? <LoaderCircle className="animate-spin" size={18} /> : <LockKeyhole size={17} />}
                  {submitting ? "กำลังเปิดโลกของเรา…" : "เข้าสู่โลกของเรา"}
                </button>
                <button className="mt-3 w-full py-2 text-sm text-ink/50 hover:text-plum" onClick={() => { setProfile(null); clearPin(); }} type="button">เลือกโปรไฟล์อื่น</button>
              </form>
            )}
          </>
        )}
        <p className="mt-6 text-center text-xs leading-5 text-ink/45">มีเพียงสองโปรไฟล์ที่ได้รับอนุญาตเท่านั้นที่เข้าใช้งานได้</p>
      </section>
    </main>
  );
}
