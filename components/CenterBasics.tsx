import { CENTER_BASICS } from "@/lib/session-types";

export default function CenterBasics({ open = false }: { open?: boolean }) {
  return (
    <details open={open} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer font-semibold text-stone-900">Center contacts, Title IX and safety</summary>
      <div className="mt-3 space-y-3 text-sm">
        <ul className="space-y-1">
          {CENTER_BASICS.contacts.map((c) => (
            <li key={c.phone} className="break-words">
              {c.label}: <a className="text-indigo-700 underline" href={`tel:${c.phone.replace(/-/g, "")}`}>{c.phone}</a>
            </li>
          ))}
        </ul>
        <ul className="list-disc space-y-1 pl-5">
          {CENTER_BASICS.links.map((l) => (
            <li key={l.url} className="break-words">
              <a className="text-indigo-700 underline" href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
