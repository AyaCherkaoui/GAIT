"use client";
import { useEffect, useState } from "react";

type Status = { provider: string | null; label?: string; model?: string; note?: string };

/** A small chip for staff: which AI provider and model answer. The server never sends a key. Fetched once per page load. */
export default function ProviderStatus() {
  const [s, setS] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/provider")
      .then((r) => { if (!r.ok) throw new Error("status"); return r.json(); })
      .then(setS)
      .catch(() => setFailed(true));
  }, []);
  if (failed) return <p role="alert" className="rounded-md border border-gold-300/60 px-2.5 py-1.5 text-xs leading-snug text-gold-300">AI status could not be loaded. Refresh to try again.</p>;
  if (!s) return <p role="status" aria-busy="true" className="px-2.5 py-1.5 text-xs text-indigo-200">Checking AI…</p>;
  const ok = !!s.model;
  return (
    <p
      className={`flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[13px] leading-snug ${
        ok ? "bg-indigo-50 text-indigo-800" : "bg-gold-100 text-gold-600"
      }`}
      title="Set GAIT_PROVIDER in .env.local to change it"
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" className="mt-px shrink-0"><rect x="2" y="5" width="12" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M5 5V4a3 3 0 0 1 6 0v1" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      <span className="min-w-0 break-words">{ok ? `AI: ${s.label} · ${s.model}` : `AI: ${s.note ?? "not set up"}`}</span>
    </p>
  );
}
