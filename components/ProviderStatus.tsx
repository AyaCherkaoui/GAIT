"use client";
import { useEffect, useState } from "react";

type Status = { provider: string | null; label?: string; model?: string; note?: string };

/** A small chip for staff: which AI provider and model answer. The server never sends a key. Fetched once per page load. */
export default function ProviderStatus() {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    fetch("/api/provider")
      .then((r) => (r.ok ? r.json() : null))
      .then(setS)
      .catch(() => setS(null));
  }, []);
  if (!s) return null;
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
