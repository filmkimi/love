"use client";

import { motion } from "framer-motion";
import { CalendarHeart, Sparkles } from "lucide-react";

function daysBetween(start: Date, end: Date) {
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endDay - startDay) / 86_400_000);
}

function nextAnniversary(start: Date, today: Date) {
  let year = today.getFullYear();
  let date = new Date(year, start.getMonth(), start.getDate());
  if (date < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    year += 1;
    date = new Date(year, start.getMonth(), start.getDate());
  }
  return { date, days: daysBetween(today, date) };
}

export default function AnniversaryCounter({ startDate }: { startDate: string }) {
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    return <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">กรุณาตั้งค่าวันครบรอบให้ถูกต้องในรูปแบบ ปี-เดือน-วัน</p>;
  }
  const today = new Date();
  const together = Math.max(0, daysBetween(start, today));
  const next = nextAnniversary(start, today);

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[1.8rem] bg-[#80617d] p-6 text-white shadow-soft sm:p-7"
      initial={{ opacity: 0, y: 12 }}
    >
      <div className="absolute -right-8 -top-12 h-40 w-40 rounded-full border border-white/10" />
      <div className="absolute -right-1 -top-5 h-28 w-28 rounded-full border border-white/10" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="mb-5 flex items-center gap-2 text-sm text-white/75">
            <CalendarHeart size={17} />
            <span>ตัวเลขที่เรารักที่สุด</span>
          </div>
          <p className="serif text-5xl leading-none sm:text-6xl">วัน +{together.toLocaleString("th-TH")}</p>
          <p className="mt-3 text-sm text-white/75">วันที่เราเลือกดูแลกันและกัน</p>
        </div>
        <Sparkles className="mt-1 text-[#f4d5c9]" size={23} />
      </div>
      <div className="relative mt-7 flex items-center justify-between border-t border-white/15 pt-4 text-xs">
        <span className="text-white/65">วันครบรอบครั้งถัดไป</span>
        <span className="font-semibold">{next.days === 0 ? "วันนี้เลย! ✨" : `อีก ${next.days} วัน`}</span>
      </div>
    </motion.section>
  );
}
