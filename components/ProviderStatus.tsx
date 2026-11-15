"use client";
import { useEffect, useState } from "react";

type Status = { provider: string | null; label?: string; model?: string; note?: string; unavailable?: boolean };

/** One quiet line in the nav: which AI provider and model are answering. Fetched once per page load. */
export default function ProviderStatus() {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    fetch("/api/provider")
      .then((r) => {
        if (!r.ok) throw new Error("status unavailable");
        return r.json();
      })
      .then(setS)
      .catch(() => setS({ provider: null, unavailable: true }));
  }, []);
  if (!s) return null;
  const text = s.unavailable ? "AI: status unavailable" : s.model ? `AI: ${s.label} · ${s.model}` : `AI: ${s.note ?? "not set up"}`;
  return (
    <span className={`text-xs ${s.model ? "text-stone-500" : "text-amber-700"}`} title="Set GAIT_PROVIDER in .env.local to change it">
      {text}
    </span>
  );
}
