"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { BucketListItem } from "@/lib/database.types";

const suggestions = ["ไปดูพระอาทิตย์ตกริมทะเล", "ลองไปร้านพาสต้าเล็ก ๆ ร้านนั้น", "นั่งรถไฟไปเที่ยววันหยุดด้วยกัน"];

export default function BucketList() {
  const supabase = getSupabaseBrowserClient();
  const [items, setItems] = useState<BucketListItem[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error: loadError } = await supabase.from("bucket_list").select("*").order("created_at", { ascending: false });
      if (!active) return;
      if (loadError) {
        console.error("โหลดรายการไม่สำเร็จ:", loadError.message);
        setError("โหลดรายการไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
      else setItems(data as BucketListItem[]);
      setLoading(false);
    }
    void load();
    const channel = supabase
      .channel("couple-bucket-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "bucket_list" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const item = payload.new as BucketListItem;
          setItems((current) => current.some((value) => value.id === item.id) ? current : [item, ...current]);
        }
        if (payload.eventType === "UPDATE") {
          const item = payload.new as BucketListItem;
          setItems((current) => current.map((value) => value.id === item.id ? item : value));
        }
        if (payload.eventType === "DELETE") {
          const item = payload.old as Pick<BucketListItem, "id">;
          setItems((current) => current.filter((value) => value.id !== item.id));
        }
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setError("ไม่สามารถอัปเดตรายการแบบเรียลไทม์ได้");
      });
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    setSaving(true);
    setError("");
    const { error: insertError } = await supabase.from("bucket_list").insert({ title: value });
    if (insertError) {
      console.error("เพิ่มไอเดียไม่สำเร็จ:", insertError.message);
      setError("เพิ่มไอเดียไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
    else setTitle("");
    setSaving(false);
  }

  async function toggle(item: BucketListItem) {
    const { error: updateError } = await supabase.from("bucket_list").update({ is_completed: !item.is_completed }).eq("id", item.id);
    if (updateError) {
      console.error("อัปเดตรายการไม่สำเร็จ:", updateError.message);
      setError("อัปเดตรายการไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  }

  return (
    <section className="rounded-[1.8rem] border border-white/80 bg-white/85 p-5 shadow-soft sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-plum/65"><Sparkles size={13} /> ค่อย ๆ เติมความฝัน</p>
          <h2 className="serif text-2xl">สิ่งที่เราอยากทำด้วยกัน</h2>
        </div>
        <span className="rounded-full bg-[#f7f1ed] px-3 py-1.5 text-xs text-ink/55">{items.filter((item) => item.is_completed).length}/{items.length} สำเร็จ</span>
      </div>
      <form className="mb-4 flex gap-2" onSubmit={(event) => void addItem(event)}>
        <input
          className="min-w-0 flex-1 rounded-xl border border-rose-100 bg-[#fffdfb] px-3.5 py-2.5 text-sm outline-none placeholder:text-ink/35 focus:border-plum/40"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="เพิ่มความฝันเล็ก ๆ ของเรา…"
          value={title}
        />
        <button aria-label="เพิ่มลงในรายการ" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-plum text-white transition hover:bg-[#67435e] disabled:opacity-50" disabled={saving || !title.trim()} type="submit">
          {saving ? <LoaderCircle className="animate-spin" size={17} /> : <Plus size={19} />}
        </button>
      </form>
      {error && <p className="mb-3 text-xs text-red-700" role="alert">{error}</p>}
      <div className="space-y-2">
        {loading ? <div className="flex justify-center py-8"><LoaderCircle className="animate-spin text-plum/60" size={20} /></div> : items.length === 0 ? (
          <div className="rounded-xl bg-[#fbf7f3] px-4 py-4 text-sm leading-6 text-ink/55">
            ยังไม่มีแผนในรายการเลย ลอง<button className="font-semibold text-plum underline decoration-plum/30 underline-offset-2" onClick={() => setTitle(suggestions[Math.floor(Math.random() * suggestions.length)])} type="button">สุ่มไอเดียน่ารัก ๆ</button>ดูไหม?
          </div>
        ) : items.map((item) => (
          <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[#fbf7f3]" key={item.id} onClick={() => void toggle(item)} type="button">
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${item.is_completed ? "border-sage bg-sage text-white" : "border-[#d9cbd3] text-transparent"}`}><Check size={13} /></span>
            <span className={`text-sm ${item.is_completed ? "text-ink/40 line-through" : "text-ink/80"}`}>{item.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
