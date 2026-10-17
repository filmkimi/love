"use client";

import Link from "next/link";
import { ArrowLeft, Heart, LogOut } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import AuthGate from "@/components/AuthGate";
import MemoryTimeline from "@/components/dashboard/MemoryTimeline";
import PwaRegister from "@/components/PwaRegister";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

function MemoriesHome({ session }: { session: Session }) {
  async function signOut() {
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) console.error("ออกจากระบบไม่สำเร็จ:", error.message);
  }

  return (
    <main className="safe-page-bottom mx-auto min-h-screen max-w-7xl px-4 pb-10 pt-5 sm:px-7 sm:pt-8 lg:px-10">
      <PwaRegister />
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link aria-label="กลับไปหน้าแดชบอร์ด" className="grid h-10 w-10 place-items-center rounded-full border border-rose-100 bg-white/70 text-plum transition hover:bg-white" href="/"><ArrowLeft size={18} /></Link>
          <Link className="flex items-center gap-2.5" href="/">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f2dfe5] text-plum"><Heart fill="currentColor" size={19} /></span>
            <span className="serif text-xl text-ink">โลกใบเล็กของเรา</span>
          </Link>
        </div>
        <button aria-label="ออกจากระบบ" className="grid h-10 w-10 place-items-center rounded-full border border-rose-100 bg-white/70 text-ink/55 transition hover:bg-white hover:text-plum" onClick={() => void signOut()} title="ออกจากระบบ" type="button"><LogOut size={17} /></button>
      </header>
      <section className="mb-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-plum/65">เรื่องราวของเราในทุกช่วงเวลา</p>
        <h1 className="serif text-4xl text-ink sm:text-5xl">สวนความทรงจำ <span className="text-[#cf8295]">♡</span></h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-ink/55 sm:text-base">เก็บวันเวลา สถานที่ และความรู้สึกดี ๆ ของเราไว้ในพื้นที่ส่วนตัว</p>
      </section>
      <MemoryTimeline session={session} />
    </main>
  );
}

export default function MemoriesPage() {
  return <AuthGate>{(session) => <MemoriesHome session={session} />}</AuthGate>;
}
