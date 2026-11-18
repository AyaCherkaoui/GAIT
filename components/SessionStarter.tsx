"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { inputCls, labelCls } from "@/components/ui";
import { clock, elapsedMs, readLive, startLive, type Live } from "@/components/SessionTimer";
import { get } from "@/lib/client";
import type { Tutee } from "@/lib/types";
import { FOCUS_AREAS, SESSION_TYPES, type FocusId, type SessionType } from "@/lib/session-types";

const chipBtn = (on: boolean) =>
  `inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition ${on ? "border-ink bg-ink text-white" : "border-stone-300 bg-white text-ink hover:border-stone-400"}`;

export default function SessionStarter() {
  const router = useRouter();
  const [type, setType] = useState<SessionType>("tutoring");
  const [focus, setFocus] = useState<FocusId[]>([]);
  const [name, setName] = useState("");
  const [tutees, setTutees] = useState<Tutee[]>([]);
  const [tuteeId, setTuteeId] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    get<{ tutees: Tutee[] }>("/api/tutees").then((j) => setTutees(j.tutees)).catch(() => {});
  }, []);
  useEffect(() => {
    setLive(readLive());
    const t = setInterval(() => {
      setLive(readLive());
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const start = () => {
    const picked = tutees.find((t) => String(t.id) === tuteeId);
    startLive({ type, focus: type === "tutoring" ? focus : [], firstName: picked ? picked.first_name : name.trim(), tuteeId: picked?.id });
    router.push("/session/live");
  };

  return (
    <section aria-labelledby="starter" className="pad-dark rounded-2xl p-7 pl-[4.5rem] text-white sm:p-8 sm:pl-[4.75rem]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-gold-300">Starting a session?</span>
          <h2 id="starter" className="font-display text-[clamp(1.75rem,3vw,2.125rem)] leading-tight">Start a session</h2>
        </div>

        {live && (
          <Link href="/session/live" className="flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-xl bg-white/10 px-5 py-3 text-white transition hover:bg-white/15">
            <span className="font-semibold">Resume {clock(elapsedMs(live, now))}</span>
            <span className="text-sm text-stone-300">{live.firstName || "Session"} in progress</span>
          </Link>
        )}

        <div role="radiogroup" aria-label="Session type" className="grid gap-3 sm:grid-cols-3">
          {SESSION_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={type === t.id}
              onClick={() => setType(t.id)}
              className={`min-h-12 rounded-xl border px-4 py-3 text-left transition ${type === t.id ? "border-gold-300 bg-white/15" : "border-white/20 hover:border-white/40"}`}
            >
              <span className="block font-semibold">{t.label}</span>
              <span className="block text-sm text-stone-300">{t.blurb}</span>
            </button>
          ))}
        </div>

        {type === "tutoring" && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Focus (optional)</span>
            <div className="flex flex-wrap gap-2">
              {FOCUS_AREAS.map((f) => (
                <button key={f} type="button" aria-pressed={focus.includes(f)} onClick={() => setFocus((c) => (c.includes(f) ? c.filter((x) => x !== f) : [...c, f]))} className={chipBtn(focus.includes(f))}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          {tutees.length > 0 && (
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
              <label htmlFor="start-tutee" className={`${labelCls} text-white`}>Tutee</label>
              <select id="start-tutee" value={tuteeId} onChange={(e) => setTuteeId(e.target.value)} className={`${inputCls} text-ink`}>
                <option value="">Someone new</option>
                {tutees.map((t) => <option key={t.id} value={t.id}>{t.first_name}</option>)}
              </select>
            </div>
          )}
          {!tuteeId && (
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
              <label htmlFor="start-name" className={`${labelCls} text-white`}>Student first name</label>
              <input id="start-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={`${inputCls} text-ink`} />
            </div>
          )}
          <button type="button" onClick={start} className="inline-flex min-h-12 items-center rounded-[10px] bg-gold-300 px-6 text-[15px] font-semibold text-ink transition hover:bg-gold-400">
            Start
          </button>
        </div>

        <div className="flex flex-wrap gap-x-6">
          <Link href="/session" className="inline-flex min-h-10 items-center text-sm text-stone-300 underline underline-offset-4">Just finished one? Log a session</Link>
          <Link href="/tutees" className="inline-flex min-h-10 items-center text-sm text-stone-300 underline underline-offset-4">Your tutees</Link>
        </div>
      </div>
    </section>
  );
}
