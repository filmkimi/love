"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, LoaderCircle, Sparkles } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type Mood = {
  user_id: string;
  mood_date: string;
  mood: string;
  updated_at: string;
};

const choices = [
  { label: "Happy", emoji: "😊" },
  { label: "Tired", emoji: "😴" },
  { label: "Need hugs", emoji: "🫂" },
  { label: "Excited", emoji: "✨" },
  { label: "Hungry", emoji: "🍜" }
];

export default function DailyMoodWidget({ session }: { session: Session }) {
  const supabase = getSupabaseBrowserClient();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ownMood = moods.find((entry) => entry.user_id === session.user.id)?.mood;
  const partnerMood = moods.find((entry) => entry.user_id !== session.user.id);

  useEffect(() => {
    let active = true;
    async function load() {
      const [moodResult, memberResult] = await Promise.all([
        supabase.from("daily_moods").select("*").eq("mood_date", today),
        supabase.from("couple_members").select("user_id, display_name")
      ]);
      if (!active) return;
      if (moodResult.error) setError(`Could not load today’s moods: ${moodResult.error.message}`);
      else setMoods((current) => {
        const byUser = new Map((moodResult.data as Mood[]).map((mood) => [mood.user_id, mood]));
        current.forEach((mood) => byUser.set(mood.user_id, mood));
        return [...byUser.values()];
      });
      if (memberResult.error) setError(`Could not load profile names: ${memberResult.error.message}`);
      else setNames(Object.fromEntries(memberResult.data.map((member) => [member.user_id, member.display_name])));
      setLoading(false);
    }
    void load();

    const channel = supabase
      .channel(`daily-moods-${today}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_moods", filter: `mood_date=eq.${today}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          const removed = payload.old as Pick<Mood, "user_id">;
          setMoods((current) => current.filter((mood) => mood.user_id !== removed.user_id));
        } else {
          const updated = payload.new as Mood;
          setMoods((current) => current.some((mood) => mood.user_id === updated.user_id)
            ? current.map((mood) => mood.user_id === updated.user_id ? updated : mood)
            : [...current, updated]);
        }
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setError("Live mood updates are unavailable.");
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, today]);

  async function updateMood(mood: string) {
    setSaving(true);
    setError("");
    const { data, error: updateError } = await supabase
      .from("daily_moods")
      .upsert({ user_id: session.user.id, mood_date: today, mood, updated_at: new Date().toISOString() }, { onConflict: "user_id,mood_date" })
      .select()
      .single();
    if (updateError) setError(`Could not save your mood: ${updateError.message}`);
    else {
      const updated = data as Mood;
      setMoods((current) => current.some((entry) => entry.user_id === updated.user_id)
        ? current.map((entry) => entry.user_id === updated.user_id ? updated : entry)
        : [...current, updated]);
    }
    setSaving(false);
  }

  const partnerChoice = choices.find((choice) => choice.label === partnerMood?.mood);

  return (
    <section className="rounded-[1.8rem] border border-white/80 bg-white/85 p-5 shadow-soft sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-plum/70">
        <Sparkles size={16} />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">A tiny check-in</p>
      </div>
      <h2 className="serif text-2xl">How’s your heart today?</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {choices.map((choice) => (
          <button
            aria-pressed={ownMood === choice.label}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition ${ownMood === choice.label ? "border-plum/30 bg-blush text-plum" : "border-rose-100 bg-[#fffdfb] text-ink/70 hover:bg-rose-50"}`}
            disabled={saving}
            key={choice.label}
            onClick={() => void updateMood(choice.label)}
            type="button"
          >
            <span>{choice.emoji}</span>{choice.label}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="mt-4 flex min-h-12 items-center gap-3 rounded-2xl bg-[#fbf7f3] px-3.5 py-2.5">
        {loading ? <LoaderCircle className="animate-spin text-plum/60" size={17} /> : partnerChoice ? (
          <>
            <span className="text-xl">{partnerChoice.emoji}</span>
            <p className="text-sm text-ink/75"><span className="font-semibold">{names[partnerMood!.user_id] || "Your person"}</span> is feeling {partnerChoice.label.toLowerCase()} today.</p>
            <Heart className="ml-auto shrink-0 text-[#d98da2]" size={16} />
          </>
        ) : (
          <p className="text-sm text-ink/55">{saving ? "Saving your little check-in…" : "Your person hasn’t checked in yet today."}</p>
        )}
      </div>
      {error && <p className="mt-3 text-xs text-red-700" role="alert">{error}</p>}
    </section>
  );
}
