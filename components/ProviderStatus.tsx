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
      className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs leading-snug ${
        ok ? "border-white/15 text-indigo-200" : "border-gold-300/60 text-gold-300"
      }`}
      title="Set GAIT_PROVIDER in .env.local to change it"
    >
      <span aria-hidden className={`mt-1 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-400" : "bg-gold-300"}`} />
      <span className="min-w-0 break-words">{ok ? `AI: ${s.label} · ${s.model}` : `AI: ${s.note ?? "not set up"}`}</span>
    </p>
  );
}
