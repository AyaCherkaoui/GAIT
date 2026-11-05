"use client";
import Link from "next/link";
import { useVoiceFirst } from "@/lib/voice";

export default function VoiceToggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      Voice-first mode: keep the writer&apos;s own phrasing. <Link href="/voice" className="text-indigo-700 underline">Why?</Link>
    </label>
  );
}

export { useVoiceFirst };
