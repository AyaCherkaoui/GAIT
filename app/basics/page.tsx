import { Card, Chip, PageHeader } from "@/components/ui";
import { DRAFT_CHIP } from "@/lib/approaches";
import { CENTER_BASICS } from "@/lib/session-types";

export default function BasicsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Center basics">Contacts, reporting and safety for any session.</PageHeader>
      <Chip tone="gold">{DRAFT_CHIP}</Chip>
      <Card title="Who to call">
        <ul className="space-y-1 text-sm">
          {CENTER_BASICS.contacts.map((c) => (
            <li key={c.phone} className="flex min-h-11 flex-wrap items-center gap-x-2">
              <span className="text-ink">{c.label}:</span>
              <a className="inline-flex min-h-11 items-center text-indigo-700 underline underline-offset-2" href={`tel:${c.phone.replace(/-/g, "")}`}>{c.phone}</a>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Reporting and policies">
        <ul className="space-y-1 text-sm">
          {CENTER_BASICS.links.map((l) => (
            <li key={l.url} className="break-words">
              <a className="inline-flex min-h-11 items-center text-indigo-700 underline underline-offset-2" href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
