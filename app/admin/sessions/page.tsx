import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate } from "@/components/format";
import { getUser } from "@/lib/auth";
import { listSessionsForDirector } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const user = await getUser();
  if (user?.role !== "director") redirect("/");
  const sessions = listSessionsForDirector();
  return (
    <div className="space-y-6">
      <PageHeader title="Sessions">Every tutor&rsquo;s logged sessions, read-only. You see the student&rsquo;s first name and the course, never a tutor&rsquo;s private notes.</PageHeader>
      <Card>
        {sessions.length === 0 ? (
          <Empty title="No sessions yet">Sessions appear here as tutors write them up.</Empty>
        ) : (
          <ul className="divide-y divide-stone-100">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/sessions/${s.id}`} className="flex min-h-12 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 hover:bg-stone-50">
                  <span className="font-semibold text-ink">
                    {s.student || "Student"} <span className="font-normal text-stone-600">in {s.course || "no course"}</span>
                  </span>
                  <span className="text-sm text-stone-600">{s.tutor} · {fmtDate(s.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
