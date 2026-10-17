"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { playSoftSound } from "@/lib/sounds";

type PokeButtonProps = { session: Session; channel: RealtimeChannel | null; partnerName: string };

export default function PokeButton({ session, channel, partnerName }: PokeButtonProps) {
  const [bursts, setBursts] = useState<number[]>([]);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const listener = () => {
      const id = Date.now();
      setBursts((current) => [...current, id]);
      window.setTimeout(() => setBursts((current) => current.filter((value) => value !== id)), 1800);
    };
    window.addEventListener("couple:poke", listener);
    return () => window.removeEventListener("couple:poke", listener);
  }, []);

  async function poke() {
    setFeedback("");
    if (channel) {
      const status = await channel.send({
        type: "broadcast",
        event: "poke",
        payload: { from: session.user.id, at: new Date().toISOString() }
      });
      if (status !== "ok") {
        setFeedback("Couldn’t send your little hello. Check your connection.");
        return;
      }
    } else {
      setFeedback("Connecting to your shared space… try again in a moment.");
      return;
    }

    playSoftSound("chime");

    setFeedback(`A little love is on its way to ${partnerName} 💌`);
    const { data: sessionData } = await getSupabaseBrowserClient().auth.getSession();
    if (!sessionData.session) return;
    try {
      const response = await fetch("/api/notify", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` }
      });
      if (!response.ok && response.status !== 503) {
        console.info("Optional partner notification could not be sent:", response.status);
      }
    } catch (error) {
      console.info("Optional partner notification endpoint is unavailable:", error);
    }
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
        {bursts.map((burst) => (
          <motion.span
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.9], x: [0, -70, 55], y: [0, -100, -145], rotate: [-15, 20, -10] }}
            className="absolute left-1/2 top-1/2 text-3xl"
            initial={{ opacity: 0, scale: 0.5 }}
            key={burst}
            transition={{ duration: 1.7, ease: "easeOut" }}
          >
            ❤️
          </motion.span>
        ))}
      </div>
      <motion.button
        className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-white px-5 py-4 font-semibold text-plum shadow-[0_12px_35px_rgba(88,61,76,0.07)] transition hover:bg-[#fff7f8] active:scale-[0.98]"
        onClick={() => void poke()}
        whileTap={{ scale: 0.97 }}
        type="button"
      >
        <Heart className="fill-[#e69aab] text-[#e69aab]" size={20} />
        <span>คิดถึงนะ · Miss you</span>
      </motion.button>
      {feedback && <p aria-live="polite" className="mt-2 text-center text-xs text-plum/75">{feedback}</p>}
    </div>
  );
}
