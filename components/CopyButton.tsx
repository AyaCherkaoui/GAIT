"use client";
import { useState } from "react";

export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center rounded-md border px-3 text-sm font-medium transition sm:min-h-8 print:hidden ${
        done ? "border-gold-400 bg-gold-100 text-ink" : "border-stone-300 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-100"
      }`}
      aria-live="polite"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
