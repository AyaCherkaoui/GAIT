"use client";
import Link from "next/link";
import { useVoiceFirst } from "@/lib/voice";

export default function VoiceToggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex min-h-10 items-center gap-3 text-sm text-stone-700">
      <input type="checkbox" className="h-5 w-5 accent-indigo-700" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>
        Voice-first mode: keep the writer&apos;s own phrasing.{" "}
        <Link href="/voice" className="font-medium text-indigo-700 underline underline-offset-4">Why?</Link>
      </span>
    </label>
  );
}

export { useVoiceFirst };
