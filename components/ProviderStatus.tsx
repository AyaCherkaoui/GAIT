"use client";
import { useEffect, useState } from "react";

type Status = { provider: string | null; label?: string; model?: string; note?: string };

/** One quiet line in the nav: which AI provider and model are answering. Fetched once per page load. */
export default function ProviderStatus() {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    fetch("/api/provider")
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS(null));
  }, []);
  if (!s) return null;
  const text = s.model ? `AI: ${s.label} · ${s.model}` : `AI: ${s.note ?? "not set up"}`;
  return (
    <span className={`ml-auto text-xs ${s.model ? "text-slate-500" : "text-amber-700"}`} title="Set GAIT_PROVIDER in .env.local to change it">
      {text}
    </span>
  );
}
