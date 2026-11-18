"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import DirectorNote from "@/components/DirectorNote";
import { fmtDate } from "@/components/format";
import { Card, ErrorBox, Loading, PageHeader } from "@/components/ui";
import { get } from "@/lib/client";
import type { SessionRecord } from "@/lib/types";

export default function DirectorSessionView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ session: SessionRecord; tutor?: string; readOnly?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    get<{ session: SessionRecord; tutor?: string; readOnly?: boolean }>(`/api/session/${id}`).then(setData).catch((e) => setError((e as Error).message));
  }, [id]);

  if (!data) return <div className="space-y-4"><ErrorBox error={error} />{!error && <Loading />}</div>;
  const { session, tutor } = data;
  const n = session.notes;
  return (
    <div className="space-y-6">
      <p role="status" className="rounded-lg border border-gold-300/70 bg-gold-50 px-5 py-3 text-stone-800">
        Viewing {tutor ? `${tutor}’s` : "your own"} session (read-only). You can leave a note for the tutor below.
      </p>
      <PageHeader title={`${session.student_name || "Student"} · ${session.course || "no course"}`}>{fmtDate(session.created_at)}</PageHeader>
      <Card title="Tutor’s notes">
        <dl className="space-y-3 text-[15px] text-stone-800">
          {([["Worked on", n.workedOn], ["Struggled with", n.struggles], ["Went well", n.wentWell]] as const).map(([label, text]) => (
            <div key={label}>
              <dt className="text-sm font-semibold text-stone-600">{label}</dt>
              <dd className="whitespace-pre-wrap">{text || "Nothing written."}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Email draft"><p className="whitespace-pre-wrap text-[15px] text-stone-800">{session.outputs.email}</p></Card>
      <Card title="Next steps">
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-stone-800">{session.outputs.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </Card>
      <DirectorNote sessionId={id} />
      <Link href="/admin/sessions" className="inline-flex min-h-10 items-center text-sm font-medium text-indigo-700 underline underline-offset-4">All sessions</Link>
    </div>
  );
}
