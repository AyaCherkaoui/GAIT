"use client";
import { useEffect, useState } from "react";
import { readLocal, writeLocal } from "@/lib/local";
import { defaultMinutes, type FocusId, type SessionType } from "@/lib/session-types";

/** A running session lives in localStorage so it survives a reload and is shared across tabs. Time comes from timestamps, never from a counter. */
export type Live = {
  type: SessionType;
  focus: FocusId[];
  minutes: number;
  firstName: string;
  tuteeId?: number;
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
  notes: string;
  /** English 101: the unit being worked and when each unit was entered, in elapsed ms. */
  unit?: number;
  unitStarts?: number[];
};

export const LIVE_KEY = "ink-live-session";

export function readLive(): Live | null {
  const raw = readLocal(LIVE_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Live;
    return v && typeof v.startedAt === "number" ? v : null;
  } catch {
    return null;
  }
}
export function writeLive(l: Live | null) {
  writeLocal(LIVE_KEY, l ? JSON.stringify(l) : null);
}
export function startLive(p: { type: SessionType; focus: FocusId[]; firstName: string; tuteeId?: number; minutes?: number }): Live {
  const l: Live = {
    type: p.type, focus: p.focus, firstName: p.firstName, tuteeId: p.tuteeId,
    minutes: p.minutes ?? defaultMinutes(p.type), startedAt: Date.now(), pausedAt: null, pausedMs: 0, notes: "",
    ...(p.type === "eng101" ? { unit: 0, unitStarts: [0] } : {}),
  };
  writeLive(l);
  return l;
}

export const elapsedMs = (l: Live, now = Date.now()) => Math.max(0, (l.pausedAt ?? now) - l.startedAt - l.pausedMs);
export function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The live session and the current time, ticking every second while it runs. Updates when another tab changes it. */
export function useLive(): { live: Live | null; now: number; update: (fn: (l: Live) => Live) => void; ready: boolean } {
  const [live, setLive] = useState<Live | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setLive(readLive());
    setReady(true);
    const onStorage = (e: StorageEvent) => (e.key === LIVE_KEY || e.key === null) && setLive(readLive());
    window.addEventListener("storage", onStorage);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, []);
  const update = (fn: (l: Live) => Live) => {
    const cur = readLive();
    if (!cur) return;
    const next = fn(cur);
    writeLive(next);
    setLive(next);
    setNow(Date.now());
  };
  return { live, now, update, ready };
}

export default function SessionTimer({ live, now, update }: { live: Live; now: number; update: (fn: (l: Live) => Live) => void }) {
  const ms = elapsedMs(live, now);
  const budget = live.minutes * 60_000;
  const over = ms > budget;
  const paused = live.pausedAt !== null;
  const btn = "inline-flex min-h-11 items-center justify-center rounded-[10px] border border-stone-300 bg-white px-5 text-[15px] font-semibold text-ink transition hover:border-stone-400";
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5">
      <div>
        <div role="timer" aria-label="Elapsed time" className={`font-display text-5xl tabular-nums ${over ? "text-red-700" : "text-ink"}`}>{clock(ms)}</div>
        <div className="text-sm text-stone-600">{paused ? "Paused. " : ""}of {live.minutes} minutes{over ? " (over)" : ""}</div>
      </div>
      <button
        type="button"
        className={btn}
        onClick={() => update((l) => (l.pausedAt === null ? { ...l, pausedAt: Date.now() } : { ...l, pausedMs: l.pausedMs + (Date.now() - l.pausedAt), pausedAt: null }))}
      >
        {paused ? "Resume" : "Pause"}
      </button>
    </div>
  );
}
