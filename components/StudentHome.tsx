"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";

const BEFORE = [
  "Know which class and assignment this is for.",
  "Read the assignment prompt again and note what is being asked.",
  "Write down your own ideas first, even a messy list.",
  "Decide the one thing you most want help with.",
];

const PROMPTS = [
  "Ask me three questions that help me figure out what my main point is.",
  "Point out one pattern of mistakes in this paragraph and explain it. Do not rewrite it.",
  "Which sentences are unclear, and why? I will rewrite them myself.",
  "Quiz me on how to cite a source in my class's citation style.",
];

const NEVER = [
  "Write my paragraph, essay or conclusion.",
  "Rewrite this so it sounds smarter.",
  "Fix everything in my draft.",
  "Answer this assignment question for me.",
];

const SAY_WHAT_YOU_USED =
  "I used an AI tool to ask questions about my thesis and to explain a grammar pattern. I wrote and revised all of the text myself.";

const KEY = "ink-before-session";

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Checklist() {
  const [done, setDone] = useState<boolean[]>(BEFORE.map(() => false));
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (Array.isArray(raw)) setDone(BEFORE.map((_, i) => raw[i] === true));
    } catch {}
  }, []);
  function toggle(i: number) {
    const next = done.map((d, j) => (j === i ? !d : d));
    setDone(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }
  return (
    <ul className="space-y-1">
      {BEFORE.map((text, i) => (
        <li key={text}>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-stone-50">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-indigo-800" checked={done[i]} onChange={() => toggle(i)} />
            <span className={done[i] ? "text-stone-500 line-through" : "text-stone-800"}>{text}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export default function StudentHome({ requestedRole }: { requestedRole: "tutor" | "director" | null }) {
  return (
    <div className="space-y-10 pt-10">
      {requestedRole && (
        <section role="status" className="rounded-lg border border-gold-300/70 bg-gold-50 px-5 py-4 text-stone-800">
          <h2 className="font-display text-xl font-semibold text-ink">Waiting for the director</h2>
          <p className="mt-1">Your {requestedRole} request is waiting for the director. You do not need to do anything. Until it is approved you can read the guide below and ask the coach about your writing.</p>
        </section>
      )}

      <section aria-labelledby="guide" className="space-y-4">
        <div className="max-w-2xl">
          <h2 id="guide" className="font-display text-2xl font-semibold text-ink">Use AI as a coach</h2>
          <p className="mt-1 text-stone-700">Your professors grade your thinking and your voice. Ask AI to question, explain and quiz you, and keep the writing yours.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Box title="1. Before you ask AI">
            <p className="text-stone-700">Do a little thinking first, then ask for help with one thing.</p>
            <ul className="list-disc space-y-1 pl-5 text-stone-800">
              <li>Write your own rough ideas.</li>
              <li>Know what the assignment asks.</li>
              <li>Pick one question to ask.</li>
            </ul>
          </Box>
          <Box title="2. Good prompts to copy">
            <ul className="space-y-3">
              {PROMPTS.map((p) => (
                <li key={p} className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 basis-56 text-stone-900">{p}</span>
                  <CopyButton text={p} />
                </li>
              ))}
            </ul>
          </Box>
          <Box title="3. What never to ask">
            <ul className="space-y-1.5">
              {NEVER.map((n) => (
                <li key={n} className="text-stone-800 line-through decoration-margin/50">{n}</li>
              ))}
            </ul>
            <p className="text-sm text-stone-700">These skip the practice that makes the next paper easier, and may break your class's AI policy.</p>
          </Box>
          <Box title="4. How to say what you used">
            <p className="text-stone-900">{SAY_WHAT_YOU_USED}</p>
            <CopyButton text={SAY_WHAT_YOU_USED} label="Copy this note" />
            <p className="text-sm text-stone-700">Change it to match what you really did, and check your professor's AI policy.</p>
          </Box>
        </div>
        <Link href="/coach" className="inline-flex min-h-11 items-center rounded-md bg-ink px-5 text-sm font-semibold text-white hover:bg-indigo-800">Ask the coach about your writing</Link>
      </section>

      <section aria-labelledby="before">
        <h2 id="before" className="mb-3 font-display text-2xl font-semibold text-ink">Before your session</h2>
        <div className="max-w-xl rounded-lg border border-stone-200 bg-white p-4">
          <Checklist />
          <p className="mt-2 px-2 text-xs text-stone-600">Ticks are saved on this device only.</p>
        </div>
      </section>

      <section aria-labelledby="next" className="rounded-lg border border-gold-300/70 bg-gold-50 p-6">
        <h2 id="next" className="font-display text-2xl font-semibold text-ink">My next steps</h2>
        <p className="mt-1 max-w-xl text-stone-700">
          After a session your tutor may give you next steps and prompts to use with AI. Ask your tutor to hand them to you in person or by email. Sharing them here is not available yet.
        </p>
      </section>
    </div>
  );
}
