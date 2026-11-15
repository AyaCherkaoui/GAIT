import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getSession } from "@/lib/sessions";
import PrintButton from "./PrintButton";
import { fmtDate } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const s = getSession(Number((await params).id), user.id);
  if (!s) notFound();
  const o = s.outputs;
  return (
    <article className="mx-auto max-w-2xl space-y-6 bg-white p-6 text-[15px] leading-relaxed text-black print:p-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Your next steps{s.student_name ? `, ${s.student_name}` : ""}</h1>
          <p className="text-stone-700">Reading/Writing Center · {s.course} · {fmtDate(s.created_at)}</p>
        </div>
        <PrintButton />
      </div>
      <section>
        <h2 className="font-display text-lg font-semibold">Do these next</h2>
        <ul className="mt-1 list-none space-y-1">{o.nextSteps.map((x, i) => <li key={i}>☐ {x}</li>)}</ul>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Skills to practice</h2>
        {o.focusAreas.map((f, i) => (
          <div key={i}>
            <p className="font-medium">{f.skill}</p>
            <p>{f.miniLesson}</p>
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Use AI like a coach, not a ghostwriter</h2>
        <p>Paste one of these into an AI tool. Each one keeps you doing the writing.</p>
        <ol className="list-decimal space-y-2 pl-5">
          {o.aiPrompts.map((p, i) => (
            <li key={i}>
              <p className="font-mono text-xs">{p.prompt}</p>
              <p className="text-stone-700">{p.whyItHelps}</p>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold">Don&apos;t ask AI to…</h2>
        <ul className="list-disc pl-5">{o.dontAskAi.map((d, i) => <li key={i}>{d}</li>)}</ul>
      </section>
      <p className="border-t border-black pt-3 text-stone-700">Come back to the RWC any time. Bring your next draft!</p>
    </article>
  );
}
