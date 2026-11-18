"use client";
import { useEffect, useState, type ReactNode } from "react";

export function PageHeader({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rise flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-2">
      <div className="min-w-0">
        <h1 className="font-display text-[clamp(2.25rem,4.5vw,3rem)] leading-[1.04] tracking-[-0.03em] text-ink">{title}</h1>
        {children && <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-stone-700">{children}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, children, actions, tone = "plain" }: { title?: string; children: ReactNode; actions?: ReactNode; tone?: "plain" | "note" | "ink" }) {
  const shell = {
    plain: "border border-stone-200 bg-white",
    note: "border border-gold-300 bg-gold-50",
    ink: "pad-dark text-white",
  }[tone];
  return (
    <section className={`rounded-xl p-5 sm:p-6 ${shell}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className={`font-display text-[22px] ${tone === "ink" ? "text-white" : "text-ink"}`}>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-[10px] border-l-4 border-margin bg-red-50 px-4 py-3 text-sm text-red-900">
      {error}
    </p>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white/50 px-5 py-8 text-center">
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-stone-600">{children}</p>}
    </div>
  );
}

export function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "gold" | "ink" | "green" }) {
  const cls = { plain: "bg-stone-100 text-stone-700", gold: "bg-gold-100 text-gold-600", ink: "bg-ink text-gold-300", green: "bg-emerald-50 text-emerald-800" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-medium leading-none ${cls}`}>{children}</span>;
}

/** Shown while the AI works: a spinner, what is happening, and how many seconds have passed. */
export function Working({ label = "Working on it" }: { label?: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div role="status" className="flex items-center gap-3 rounded-xl border border-gold-300 bg-gold-50 p-4 text-sm text-stone-800">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gold-300 border-t-ink" />
      <span>
        {label}… {secs}s
        {secs >= 8 && <span className="text-stone-600"> The AI runs on this computer, so it can take a little while.</span>}
      </span>
    </div>
  );
}

export const inputCls =
  "w-full rounded-[10px] border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 placeholder:text-stone-500 focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-300";
export const btnCls =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-ink px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-stone-800 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";
/** The blue button: for the one action that sends or approves something. */
export const btnBlueCls =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-indigo-600 px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-indigo-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";
export const btn2Cls =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-stone-300 bg-white px-4 py-2.5 text-[15px] font-medium text-ink transition hover:bg-stone-100 disabled:opacity-50 disabled:pointer-events-none";
export const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

/** onKeyDown for a textarea or input: Ctrl/Cmd+Enter submits the form it is in. */
export function submitOnCmdEnter(e: React.KeyboardEvent<HTMLElement>) {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    (e.currentTarget as HTMLInputElement).form?.requestSubmit();
  }
}
