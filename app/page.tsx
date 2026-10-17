"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, LogOut, Sparkles } from "lucide-react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import AuthGate from "@/components/AuthGate";
import PwaRegister from "@/components/PwaRegister";
import PushNotificationControl from "@/components/PushNotificationControl";
import ChatRoom from "@/components/chat/ChatRoom";
import AnniversaryCounter from "@/components/dashboard/AnniversaryCounter";
import BucketList from "@/components/dashboard/BucketList";
import FoodPicker from "@/components/dashboard/FoodPicker";
import DailyMoodWidget from "@/components/dashboard/DailyMoodWidget";
import PokeButton from "@/components/dashboard/PokeButton";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import Link from "next/link";

const userAName = process.env.NEXT_PUBLIC_USER_A_NAME || "คุณ";
const userBName = process.env.NEXT_PUBLIC_USER_B_NAME || "คนรักของคุณ";
const anniversaryDate = process.env.NEXT_PUBLIC_ANNIVERSARY_DATE || "2022-06-18";

function Home({ session }: { session: Session }) {
  const [chatChannel, setChatChannel] = useState<RealtimeChannel | null>(null);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const displayName = session.user.user_metadata?.display_name || memberNames[session.user.id] || userAName;
  const partnerName =
    Object.entries(memberNames).find(([userId]) => userId !== session.user.id)?.[1] ||
    (displayName === userAName ? userBName : userAName);

  useEffect(() => {
    let active = true;
    getSupabaseBrowserClient()
      .from("couple_members")
      .select("user_id, display_name")
      .then(({ data, error }) => {
        if (error) {
          console.error("โหลดชื่อสมาชิกไม่สำเร็จ:", error.message);
          return;
        }
        if (active && data) {
          setMemberNames(Object.fromEntries(data.map((member) => [member.user_id, member.display_name])));
        }
      });
    return () => {
      active = false;
    };
  }, [session.user.id]);

  async function signOut() {
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) console.error("ออกจากระบบไม่สำเร็จ:", error.message);
  }

  return (
    <main className="safe-page-bottom mx-auto min-h-screen max-w-7xl px-4 pb-10 pt-5 sm:px-7 sm:pt-8 lg:px-10">
      <PwaRegister />
      <header className="mb-8 flex items-center justify-between">
        <a className="flex items-center gap-2.5" href="#" aria-label="หน้าแรกโลกใบเล็กของเรา">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f2dfe5] text-plum"><Heart fill="currentColor" size={19} /></span>
          <span className="serif text-xl text-ink">โลกใบเล็กของเรา</span>
        </a>
        <div className="flex items-center gap-3">
          <Link className="rounded-full border border-rose-100 bg-white/70 px-4 py-2 text-sm font-medium text-plum transition hover:bg-white" href="/memories">ความทรงจำของเรา</Link>
          <PushNotificationControl session={session} />
          <span className="hidden text-sm text-ink/55 sm:block">วันนี้เป็นวันที่ดีนะ {displayName}</span>
          <button aria-label="ออกจากระบบ" className="grid h-10 w-10 place-items-center rounded-full border border-rose-100 bg-white/70 text-ink/55 transition hover:bg-white hover:text-plum" onClick={() => void signOut()} title="ออกจากระบบ" type="button">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <motion.section animate={{ opacity: 1, y: 0 }} className="mb-7 flex flex-col gap-3 sm:mb-9 sm:flex-row sm:items-end sm:justify-between" initial={{ opacity: 0, y: 12 }}>
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-plum/65"><Sparkles size={14} /> มุมเล็ก ๆ ของเราสองคน</p>
          <h1 className="serif text-4xl leading-tight text-ink sm:text-5xl">สวัสดีที่รัก <span className="text-[#cf8295]">♡</span></h1>
          <p className="mt-2 text-sm text-ink/55 sm:text-base">มาพักใจในพื้นที่แสนอบอุ่นของเรากันนะ</p>
        </div>
        <p className="text-xs text-ink/45">พื้นที่ของเราสองคน ด้วยรักทั้งหมดที่มี</p>
      </motion.section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(350px,0.88fr)]">
        <div className="flex flex-col gap-5">
          <AnniversaryCounter startDate={anniversaryDate} />
          <PokeButton partnerName={partnerName} session={session} channel={chatChannel} />
          <ChatRoom onPokeChannel={setChatChannel} session={session} userAName={displayName} userBName={partnerName} />
        </div>
        <div className="flex flex-col gap-5">
          <DailyMoodWidget session={session} />
          <BucketList />
          <FoodPicker />
          <p className="px-2 text-center text-xs leading-5 text-ink/45">โลกใบเล็กนี้เป็นส่วนตัว และมีเพียงบัญชีของเราสองคนเท่านั้น</p>
        </div>
      </div>
      <footer className="pt-10 text-center text-xs text-ink/40">เติมความรักให้กันในทุกวัน <span className="text-[#cf8295]">♥</span></footer>
    </main>
  );
}

export default function Page() {
  return <AuthGate>{(session) => <Home session={session} />}</AuthGate>;
}
