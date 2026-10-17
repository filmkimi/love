"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Heart, ImagePlus, LoaderCircle, MapPin, Sparkles, Upload } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { CoupleMemory, CoupleMemoryLike } from "@/lib/database.types";
import PrivateImage from "@/components/PrivateImage";

const memoryMoods = [
  { value: "First Date", label: "เดตแรกของเรา" },
  { value: "Trip to Sea", label: "ทริปทะเล" },
  { value: "Cozy Dinner", label: "มื้อค่ำแสนอบอุ่น" },
  { value: "Adventure", label: "การผจญภัย" },
  { value: "Celebration", label: "วันแห่งการฉลอง" },
  { value: "Everyday Magic", label: "วันธรรมดาที่แสนพิเศษ" }
];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function localDateString() {
  return new Date().toISOString().slice(0, 10);
}

function formatMemoryDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
}

export default function MemoryTimeline({ session }: { session: Session }) {
  const supabase = getSupabaseBrowserClient();
  const [memories, setMemories] = useState<CoupleMemory[]>([]);
  const [likes, setLikes] = useState<CoupleMemoryLike[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [memoryDate, setMemoryDate] = useState(localDateString);
  const [mood, setMood] = useState(memoryMoods[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const [memoryResult, likeResult, memberResult] = await Promise.all([
        supabase.from("couple_memories").select("*").order("memory_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("couple_memory_likes").select("*"),
        supabase.from("couple_members").select("user_id, display_name")
      ]);
      if (!active) return;
      if (memoryResult.error) {
        console.error("โหลดความทรงจำไม่สำเร็จ:", memoryResult.error.message);
        setError("โหลดความทรงจำไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
      else {
        setMemories((current) => {
          const byId = new Map((memoryResult.data as CoupleMemory[]).map((memory) => [memory.id, memory]));
          current.forEach((memory) => byId.set(memory.id, memory));
          return [...byId.values()].sort((a, b) => b.memory_date.localeCompare(a.memory_date) || b.created_at.localeCompare(a.created_at));
        });
      }
      if (likeResult.error) {
        console.error("โหลดการกดหัวใจไม่สำเร็จ:", likeResult.error.message);
        setError("โหลดการกดหัวใจไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
      else setLikes((current) => {
        const byKey = new Map((likeResult.data as CoupleMemoryLike[]).map((like) => [`${like.memory_id}:${like.user_id}`, like]));
        current.forEach((like) => byKey.set(`${like.memory_id}:${like.user_id}`, like));
        return [...byKey.values()];
      });
      if (memberResult.error) {
        console.error("โหลดชื่อโปรไฟล์ไม่สำเร็จ:", memberResult.error.message);
        setError("โหลดชื่อโปรไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
      else setNames(Object.fromEntries(memberResult.data.map((member) => [member.user_id, member.display_name])));
      if (active) setLoading(false);
    }
    void load();

    const channel = supabase
      .channel("couple-memories")
      .on("postgres_changes", { event: "*", schema: "public", table: "couple_memories" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const removed = payload.old as Pick<CoupleMemory, "id">;
          setMemories((current) => current.filter((memory) => memory.id !== removed.id));
        } else {
          const memory = payload.new as CoupleMemory;
          setMemories((current) => current.some((entry) => entry.id === memory.id)
            ? current.map((entry) => entry.id === memory.id ? memory : entry)
            : [memory, ...current].sort((a, b) => b.memory_date.localeCompare(a.memory_date) || b.created_at.localeCompare(a.created_at)));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "couple_memory_likes" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const removed = payload.old as Pick<CoupleMemoryLike, "memory_id" | "user_id">;
          setLikes((current) => current.filter((like) => like.memory_id !== removed.memory_id || like.user_id !== removed.user_id));
        } else {
          const like = payload.new as CoupleMemoryLike;
          setLikes((current) => current.some((entry) => entry.memory_id === like.memory_id && entry.user_id === like.user_id)
            ? current
            : [...current, like]);
        }
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setError("ไม่สามารถอัปเดตความทรงจำแบบเรียลไทม์ได้");
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  async function addMemory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || !memoryDate || !file || saving) return;
    if (!file.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("กรุณาเลือกรูปภาพชนิด JPEG, PNG, WebP หรือ GIF");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("รูปภาพต้องมีขนาดไม่เกิน 8 MB");
      return;
    }

    setSaving(true);
    setError("");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
    const { data: upload, error: uploadError } = await supabase.storage.from("couple-memories").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });
    if (uploadError) {
      console.error("อัปโหลดรูปภาพไม่สำเร็จ:", uploadError.message);
      setError("อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองอีกครั้ง");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("couple_memories").insert({
      title: cleanTitle,
      memory_date: memoryDate,
      mood,
      image_path: upload.path,
      created_by: session.user.id
    });
    if (insertError) {
      console.error("บันทึกความทรงจำไม่สำเร็จ:", insertError.message);
      setError("บันทึกความทรงจำไม่สำเร็จ กรุณาลองอีกครั้ง");
      const { error: cleanupError } = await supabase.storage.from("couple-memories").remove([upload.path]);
      if (cleanupError) console.error("ลบรูปภาพที่อัปโหลดไม่สำเร็จ:", cleanupError.message);
    } else {
      setTitle("");
      setFile(null);
      const input = document.getElementById("memory-photo") as HTMLInputElement | null;
      if (input) input.value = "";
    }
    setSaving(false);
  }

  async function toggleLike(memoryId: string) {
    if (likingId) return;
    setLikingId(memoryId);
    setError("");
    const isLiked = likes.some((like) => like.memory_id === memoryId && like.user_id === session.user.id);
    const result = isLiked
      ? await supabase.from("couple_memory_likes").delete().eq("memory_id", memoryId).eq("user_id", session.user.id)
      : await supabase.from("couple_memory_likes").insert({ memory_id: memoryId, user_id: session.user.id });
    if (result.error) {
      console.error("อัปเดตหัวใจไม่สำเร็จ:", result.error.message);
      setError("อัปเดตหัวใจไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
    else {
      setLikes((current) => isLiked
        ? current.filter((like) => like.memory_id !== memoryId || like.user_id !== session.user.id)
        : [...current, { memory_id: memoryId, user_id: session.user.id, created_at: new Date().toISOString() }]);
    }
    setLikingId(null);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <section className="rounded-[1.8rem] border border-white/80 bg-white/85 p-5 shadow-soft sm:p-6 lg:sticky lg:top-6">
        <div className="mb-5 flex items-center gap-2 text-plum/70">
          <MapPin size={17} />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]">เก็บช่วงเวลาดี ๆ ของเรา</p>
        </div>
        <h2 className="serif text-2xl">วันที่เราอยากจดจำ</h2>
        <p className="mb-5 mt-2 text-sm leading-6 text-ink/55">เก็บรูปภาพและความรู้สึกที่อยากจดจำเอาไว้</p>
        <form className="space-y-3.5" onSubmit={(event) => void addMemory(event)}>
          <label className="block text-xs font-semibold text-ink/70">
            ชื่อความทรงจำ
            <input className="mt-1.5 w-full rounded-xl border border-rose-100 bg-[#fffdfb] px-3.5 py-3 text-sm font-normal outline-none focus:border-plum/40" maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder="คาเฟ่เล็ก ๆ ริมทะเล…" required value={title} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-ink/70">
              วันที่
              <input className="mt-1.5 w-full rounded-xl border border-rose-100 bg-[#fffdfb] px-3 py-3 text-sm font-normal outline-none focus:border-plum/40" max={localDateString()} onChange={(event) => setMemoryDate(event.target.value)} required type="date" value={memoryDate} />
            </label>
            <label className="block text-xs font-semibold text-ink/70">
              ความรู้สึก
              <select className="mt-1.5 w-full rounded-xl border border-rose-100 bg-[#fffdfb] px-2 py-3 text-xs font-normal outline-none focus:border-plum/40" onChange={(event) => setMood(event.target.value)} value={mood}>
                {memoryMoods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-rose-200 bg-[#fffaf9] px-4 py-3.5 transition hover:bg-rose-50">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blush text-plum"><ImagePlus size={19} /></span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink/75">{file?.name || "เลือกรูปภาพ"}</span>
              <span className="mt-0.5 block text-xs text-ink/45">เห็นได้เฉพาะสองโปรไฟล์ของเรา · ขนาดไม่เกิน 8 MB</span>
            </span>
            <input accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" id="memory-photo" onChange={(event) => setFile(event.target.files?.[0] || null)} required type="file" />
          </label>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-plum px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#67435e] disabled:opacity-55" disabled={saving || !file || !title.trim()} type="submit">
            {saving ? <LoaderCircle className="animate-spin" size={17} /> : <Upload size={17} />}
            {saving ? "กำลังบันทึกความทรงจำ…" : "เพิ่มลงในไทม์ไลน์ของเรา"}
          </button>
        </form>
        {error && <p className="mt-3 text-xs leading-5 text-red-700" role="alert">{error}</p>}
      </section>

      <section aria-label="ไทม์ไลน์ความทรงจำของเรา" className="relative">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-plum/65"><Sparkles size={13} /> ช่วงเวลาเล็ก ๆ ที่จะอยู่กับเราตลอดไป</p>
            <h2 className="serif text-3xl">ไทม์ไลน์ของเรา</h2>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs text-ink/55">{memories.length} ความทรงจำ</span>
        </div>
        {loading ? (
          <div className="grid min-h-48 place-items-center rounded-[1.8rem] bg-white/70"><LoaderCircle className="animate-spin text-plum/60" /></div>
        ) : memories.length === 0 ? (
          <div className="rounded-[1.8rem] border border-white/80 bg-white/75 px-6 py-12 text-center shadow-soft">
            <span className="text-4xl">📷</span>
            <p className="serif mt-3 text-2xl">หน้าแรกของเรื่องราวเรา</p>
            <p className="mt-2 text-sm text-ink/55">เพิ่มรูปภาพเพื่อเริ่มต้นไทม์ไลน์ความทรงจำของเรานะ</p>
          </div>
        ) : (
          <div className="relative space-y-5 before:absolute before:bottom-5 before:left-[17px] before:top-5 before:w-px before:bg-rose-200 sm:before:left-[21px]">
            {memories.map((memory) => {
              const memoryLikes = likes.filter((like) => like.memory_id === memory.id);
              const likedByMe = memoryLikes.some((like) => like.user_id === session.user.id);
              return (
                <article className="relative pl-10 sm:pl-12" key={memory.id}>
                  <span className="absolute left-[10px] top-5 grid h-4 w-4 place-items-center rounded-full border-[3px] border-[#fcf8f2] bg-[#d88ca0] sm:left-[14px]" />
                  <div className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-white shadow-soft">
                    <div className="relative aspect-[16/10] bg-[#f7ecec]">
                      <PrivateImage alt={memory.title} bucket="couple-memories" className="h-full w-full" reference={`couple-memories/${memory.image_path}`} />
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-plum backdrop-blur">{memoryMoods.find((option) => option.value === memory.mood)?.label || "ช่วงเวลาพิเศษ"}</span>
                    </div>
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="mb-2 flex items-center gap-1.5 text-xs text-ink/45"><CalendarDays size={13} />{formatMemoryDate(memory.memory_date)}</p>
                          <h3 className="serif text-xl text-ink">{memory.title}</h3>
                          <p className="mt-1 text-xs text-ink/45">เพิ่มโดย {names[memory.created_by] || "คนรักของคุณ"}</p>
                        </div>
                        <button
                          aria-label={likedByMe ? "ยกเลิกการกดหัวใจ" : "ส่งหัวใจ"}
                          aria-pressed={likedByMe}
                          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm transition ${likedByMe ? "bg-blush text-[#cd6f88]" : "bg-[#faf5f3] text-ink/50 hover:bg-blush hover:text-[#cd6f88]"}`}
                          disabled={likingId === memory.id}
                          onClick={() => void toggleLike(memory.id)}
                          type="button"
                        >
                          <Heart className={likedByMe ? "fill-current" : ""} size={16} />
                          <span>{memoryLikes.length}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
