"use client";
import { useEffect, useState } from "react";
import { Empty, PageHeader, Working } from "@/components/ui";
import { get } from "@/lib/client";
import type { Book, FeedItem } from "@/lib/types";

const linkCls = "text-ink underline decoration-gold-400 decoration-2 underline-offset-4 hover:bg-gold-100";

export default function ReadingPage() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  useEffect(() => {
    get<{ items: FeedItem[]; books: Book[] }>("/api/feed")
      .then((j) => { setItems(j.items); setBooks(j.books); })
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader title="Reading">Articles and books to keep growing as a tutor.</PageHeader>

      <section aria-labelledby="articles-h" className="rounded-lg border border-stone-200 bg-white p-5 sm:p-6">
        <h2 id="articles-h" className="font-display text-xl font-semibold text-ink">Recent articles</h2>
        <div className="mt-3">
          {items === null && <Working label="Loading articles" />}
          {items?.length === 0 && (
            <Empty title="No articles right now">The article feeds could not be loaded. The book list below always works.</Empty>
          )}
          {!!items?.length && (
            <ul className="divide-y divide-stone-200">
              {items.map((i) => (
                <li key={i.url} className="py-3 first:pt-0 last:pb-0">
                  <a className={`${linkCls} inline-block py-1 text-[15px] font-medium`} href={i.url} target="_blank" rel="noreferrer">{i.title}</a>
                  <p className="text-sm text-stone-600">{i.source}{i.date ? ` · ${i.date}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="books-h" className="rounded-lg border border-stone-200 bg-white p-5 sm:p-6">
        <h2 id="books-h" className="font-display text-xl font-semibold text-ink">Books worth a look</h2>
        <ul className="mt-3 divide-y divide-stone-200">
          {books.map((b) => (
            <li key={b.title} className="py-4 first:pt-0 last:pb-0">
              <p className="font-display text-lg font-semibold text-ink">
                {b.url ? (
                  <a className={`${linkCls} inline-block py-1`} href={b.url} target="_blank" rel="noreferrer">{b.title}</a>
                ) : (
                  b.title
                )}
              </p>
              <p className="text-sm text-stone-600">by {b.author}</p>
              <p className="mt-1 max-w-prose text-[15px] text-stone-800">{b.why}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
