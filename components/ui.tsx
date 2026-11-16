"use client";
import { useEffect, useState, type ReactNode } from "react";

export function PageHeader({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rise flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-stone-200 pb-5">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {children && <p className="mt-1.5 max-w-prose text-[15px] text-stone-600">{children}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, children, actions, tone = "plain" }: { title?: string; children: ReactNode; actions?: ReactNode; tone?: "plain" | "note" | "ink" }) {
  const shell = {
    plain: "border border-stone-200 bg-white",
    note: "border border-gold-300/70 bg-gold-50",
    ink: "bg-ink text-white",
  }[tone];
  return (
    <section className={`rounded-lg p-5 sm:p-6 ${shell}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className={`font-display text-xl font-semibold ${tone === "ink" ? "text-white" : "text-ink"}`}>{title}</h2>}
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
    <p role="alert" className="rounded-md border-l-4 border-margin bg-red-50 px-4 py-3 text-sm text-red-900">
      {error}
    </p>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 px-5 py-8 text-center">
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-stone-600">{children}</p>}
    </div>
  );
}

export function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "gold" | "ink" }) {
  const cls = { plain: "bg-stone-100 text-stone-700", gold: "bg-gold-100 text-gold-600", ink: "bg-ink text-gold-300" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

/** Shown while the AI works: a spinner, what is happening, and how many seconds have passed. */
export function Working({ label = "Working on it" }: { label?: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div role="status" className="flex items-center gap-3 rounded-lg border border-gold-300/70 bg-gold-50 p-4 text-sm text-stone-800">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gold-300 border-t-ink" />
      <span>
        {label}… {secs}s
        {secs >= 8 && <span className="text-stone-600"> The AI runs on this computer, so it can take a little while.</span>}
      </span>
    </div>
  );
}

export const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-[15px] text-stone-900 placeholder:text-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-gold-300";
export const btnCls =
  "inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";
export const btn2Cls =
  "inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-medium text-stone-800 transition hover:border-stone-400 hover:bg-stone-100 disabled:opacity-50 disabled:pointer-events-none";
export const labelCls = "mb-1 block text-sm font-semibold text-stone-800";

/** onKeyDown for a textarea or input: Ctrl/Cmd+Enter submits the form it is in. */
export function submitOnCmdEnter(e: React.KeyboardEvent<HTMLElement>) {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    (e.currentTarget as HTMLInputElement).form?.requestSubmit();
  }
}
