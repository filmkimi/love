"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Dices, Utensils } from "lucide-react";

const foods = [
  { name: "Cozy noodles", note: "Something warm and slurpable", emoji: "🍜" },
  { name: "Sushi date", note: "A little bite-sized happiness", emoji: "🍣" },
  { name: "Pizza night", note: "Extra cheese, extra cozy", emoji: "🍕" },
  { name: "Thai comfort", note: "A little sweet, a little spicy", emoji: "🍛" },
  { name: "Brunch together", note: "Slow morning, happy plates", emoji: "🥞" },
  { name: "Dumpling hunt", note: "Find the juiciest little ones", emoji: "🥟" }
];

export default function FoodPicker() {
  const [index, setIndex] = useState(0);
  const [roll, setRoll] = useState(0);
  const food = foods[index];

  function pick() {
    const next = (index + 1 + Math.floor(Math.random() * (foods.length - 1))) % foods.length;
    setIndex(next);
    setRoll((current) => current + 1);
  }

  return (
    <section className="rounded-[1.8rem] border border-white/80 bg-[#eff2e9] p-5 shadow-soft sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-plum/70">
        <Utensils size={16} />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">A very important question</p>
      </div>
      <h2 className="serif text-2xl">What should we eat?</h2>
      <motion.div animate={{ opacity: 1, scale: 1 }} className="my-5 flex items-center gap-4 rounded-2xl bg-white/80 p-4" key={roll} initial={{ opacity: 0.7, scale: 0.97 }} transition={{ duration: 0.2 }}>
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#f9e9e8] text-3xl">{food.emoji}</span>
        <div>
          <p className="font-semibold text-ink">{food.name}</p>
          <p className="mt-1 text-xs text-ink/55">{food.note}</p>
        </div>
      </motion.div>
      <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#dce3d4] bg-white/70 px-4 py-3 text-sm font-semibold text-ink/75 transition hover:bg-white" onClick={pick} type="button">
        <Dices size={17} /> Pick for us
      </button>
    </section>
  );
}
