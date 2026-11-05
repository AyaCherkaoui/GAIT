import { notFound } from "next/navigation";
import { getSession } from "@/lib/sessions";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const s = getSession(Number((await params).id));
  if (!s) notFound();
  const o = s.outputs;
  const banned = s.notes.aiPolicy === "banned";
  return (
    <article className="mx-auto max-w-2xl space-y-5 bg-white p-6 text-sm leading-relaxed print:p-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Your next steps{s.student_name ? `, ${s.student_name}` : ""}</h1>
          <p className="text-slate-600">Reading/Writing Center · {s.course} · {s.created_at.slice(0, 10)}</p>
        </div>
        <PrintButton />
      </div>
      <section>
        <h2 className="font-semibold">Do these next</h2>
        <ul className="list-none space-y-1">{o.nextSteps.map((x, i) => <li key={i}>☐ {x}</li>)}</ul>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Skills to practice</h2>
        {o.focusAreas.map((f, i) => (
          <div key={i}>
            <p className="font-medium">{f.skill}</p>
            <p>{f.miniLesson}</p>
          </div>
        ))}
      </section>
      {o.aiPrompts.length > 0 && (
      <section className="space-y-2">
        <h2 className="font-semibold">Use AI like a coach, not a ghostwriter</h2>
        <p>Paste one of these into an AI tool. Each one keeps you doing the writing.</p>
        <ol className="list-decimal space-y-2 pl-5">
          {o.aiPrompts.map((p, i) => (
            <li key={i}>
              <p className="font-mono text-xs">{p.prompt}</p>
              <p className="text-slate-600">{p.whyItHelps}</p>
            </li>
          ))}
        </ol>
      </section>
      )}
      {banned ? (
        <section className="rounded border border-slate-300 p-3">
          <h2 className="font-semibold">Check your syllabus first</h2>
          <p>Your course&apos;s rules say not to use AI on this work. Read the syllabus and ask your professor if you are unsure.</p>
        </section>
      ) : (
        <section className="space-y-2 break-inside-avoid rounded border border-slate-300 p-3">
          <h2 className="font-semibold">My AI reflection (fill this in if you used an AI tool)</h2>
          {["Tool I used", "What I asked it", "What I kept", "What I changed, and why", "How I will cite or disclose it"].map((l) => (
            <div key={l}>
              <p className="text-slate-600">{l}</p>
              <div className="h-8 border-b border-slate-400" />
            </div>
          ))}
        </section>
      )}
      <section>
        <h2 className="font-semibold">Don&apos;t ask AI to…</h2>
        <ul className="list-disc pl-5">{o.dontAskAi.map((d, i) => <li key={i}>{d}</li>)}</ul>
      </section>
      <p className="border-t pt-3 text-slate-600">Come back to the RWC any time. Bring your next draft!</p>
    </article>
  );
}
