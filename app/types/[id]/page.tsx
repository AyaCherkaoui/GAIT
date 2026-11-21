import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader, btnCls } from "@/components/ui";
import { SESSION_TYPES, getSessionType } from "@/lib/session-types";
import { SCENARIOS } from "@/lib/scenarios";
import Checklist from "./Checklist";
import CenterBasics from "@/components/CenterBasics";

export function generateStaticParams() {
  return SESSION_TYPES.map((t) => ({ id: t.id }));
}

const chip = "rounded-full border border-stone-300 bg-white px-3 py-1 text-sm text-stone-700 hover:border-indigo-300";

export default async function TypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const type = getSessionType(id);
  if (!type) notFound();
  const scenario = SCENARIOS.find((s) => s.id === type.scenarioIds[0]);
  return (
    <div className="space-y-6">
      <PageHeader title={type.name}>
        {type.length}. From the RWC Handbook: {type.source}.
      </PageHeader>

      <Card title="Before / During / After">
        <div className="space-y-5">
          <Checklist title="Before" steps={type.before} />
          <Checklist title="During" steps={type.during} />
          <Checklist title="After" steps={type.after} />
        </div>
      </Card>

      {type.subbing && (
        <Card title="If you are subbing">
          <Checklist title="Subbing" steps={type.subbing} />
        </Card>
      )}

      <Card title="No-shows and Starfish">
        <div className="space-y-2 text-sm">
          <p className="break-words"><span className="font-medium">No-shows:</span> {type.noShow}</p>
          <p className="break-words"><span className="font-medium">Starfish:</span> {type.starfish}</p>
        </div>
      </Card>

      {type.resources.length > 0 && (
        <Card title="Resources">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {type.resources.map((r) => (
              <li key={r.url} className="break-words">
                <a className="text-indigo-700 underline" href={r.url} target="_blank" rel="noreferrer">{r.label}</a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-stone-500">Drive links need your Augustana sign-in.</p>
        </Card>
      )}

      <Card title="Get help">
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Link className={btnCls} href={`/session?type=${type.id}`}>Write up this session</Link>
            {scenario && <Link className={btnCls} href={`/practice?scenario=${scenario.id}`}>Practice this</Link>}
          </div>
          {!scenario && (
            <p className="text-stone-600">
              Feedback by email has no live role-play. Try the quiz &quot;Higher-order vs lower-order concerns&quot; on the <Link className="text-indigo-700 underline" href="/practice">Practice page</Link>.
            </p>
          )}
          <div>
            <p className="mb-1 text-stone-600">Look it up in ARIA:</p>
            <div className="flex flex-wrap gap-2">
              {type.searchSeeds.map((q) => (
                <Link key={q} className={chip} href={`/search?q=${encodeURIComponent(q)}`}>{q}</Link>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <CenterBasics />
    </div>
  );
}
