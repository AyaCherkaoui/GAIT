"use client";
import { useEffect, useState, type ReactNode } from "react";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
      {children && <p className="mt-1 text-sm text-stone-600">{children}</p>}
    </div>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold text-stone-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>;
}

/** Shown while a page loads its data. */
export function Loading({ label = "Loading" }: { label?: string }) {
  return <p role="status" aria-busy="true" className="text-sm text-stone-500">{label}…</p>;
}

/** Shown while the AI works: a spinner, what is happening, and how many seconds have passed. */
export function Working({ label = "Working on it" }: { label?: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div role="status" className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700" />
      <span>
        {label}… {secs}s
        {secs >= 8 && <span className="text-indigo-700"> (the AI runs on this computer, so it can take a little while)</span>}
      </span>
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-stone-300 bg-white p-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200";
export const btnCls =
  "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50";
export const btn2Cls = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm hover:bg-stone-100 disabled:opacity-50";
