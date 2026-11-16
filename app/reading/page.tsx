"use client";
import Link from "next/link";
import { PageHeader, btn2Cls } from "@/components/ui";
import { BOOKS } from "@/lib/books";

export default function ReadingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reading">Books to keep growing as a tutor. For current articles, see <Link href="/news" className="font-medium text-indigo-700 underline underline-offset-4">News</Link>.</PageHeader>
      {(
        <ul className="grid gap-4 sm:grid-cols-2">
          {BOOKS.map((b) => (
            <li key={b.title} className="flex flex-col justify-between gap-3 rounded-lg border border-stone-200 bg-white p-5">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">{b.title}</h2>
                <p className="text-sm text-stone-600">by {b.author}</p>
                <p className="mt-2 text-[15px] text-stone-800"><span className="font-semibold">Why read this:</span> {b.why}</p>
              </div>
              {b.url && <a className={`${btn2Cls} min-h-11 self-start`} href={b.url} target="_blank" rel="noreferrer">Read more</a>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
