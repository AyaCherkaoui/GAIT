"use client";
import { useState } from "react";
import { btnCls, ErrorBox } from "@/components/ui";
import { post } from "@/lib/client";

type Choice = "student" | "tutor" | "director";
const OPTIONS: { value: Choice; title: string; text: string }[] = [
  { value: "student", title: "Student", text: "Learn to use AI as a writing coach" },
  { value: "tutor", title: "Tutor", text: "Write up sessions, search ARIA, practice" },
  { value: "director", title: "Director", text: "Manage the tutor list and see the whole center" },
];

export default function WelcomeClient() {
  const [choice, setChoice] = useState<Choice>("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/api/me/role", { role: choice });
      window.location.assign("/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={go} className="space-y-8">
      <p className="font-display text-2xl font-semibold tracking-tight text-ink">Ink<span className="text-gold-400">.</span></p>
      <fieldset className="space-y-4">
        <legend className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">How will you use Ink?</legend>
        <p className="max-w-prose text-stone-700">Pick the one that fits. You will see the matching tools right after you continue.</p>
        <div className="grid gap-3 pt-2 sm:grid-cols-3">
          {OPTIONS.map((o) => {
            const on = choice === o.value;
            return (
              <label
                key={o.value}
                className={`flex min-h-28 cursor-pointer flex-col rounded-lg border-2 p-5 transition focus-within:ring-2 focus-within:ring-gold-300 ${
                  on ? "border-ink bg-gold-50" : "border-stone-200 bg-white hover:border-stone-400"
                }`}
              >
                <input type="radio" name="role" value={o.value} checked={on} onChange={() => setChoice(o.value)} className="sr-only" />
                <span className="flex items-center gap-2">
                  <span aria-hidden className={`h-4 w-4 shrink-0 rounded-full border-2 ${on ? "border-ink bg-gold-300" : "border-stone-400"}`} />
                  <span className="font-display text-2xl font-semibold text-ink">{o.title}</span>
                </span>
                <span className="mt-2 text-stone-700">{o.text}</span>
                {o.value !== "student" && <span className="mt-3 text-sm text-stone-600">The director confirms this. Until then you see the student guide.</span>}
              </label>
            );
          })}
        </div>
      </fieldset>
      <ErrorBox error={error} />
      <button type="submit" className={`${btnCls} min-h-11 w-full px-8 sm:w-auto`} disabled={busy}>Continue</button>
    </form>
  );
}
