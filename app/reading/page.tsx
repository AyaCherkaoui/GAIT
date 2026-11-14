"use client";
import { useEffect, useState } from "react";
import { Card, PageHeader, Working } from "@/components/ui";
import { get } from "@/lib/client";
import type { Book, FeedItem } from "@/lib/types";

export default function ReadingPage() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  useEffect(() => {
    get<{ items: FeedItem[]; books: Book[] }>("/api/feed")
      .then((j) => { setItems(j.items); setBooks(j.books); })
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Reading">Articles and books to keep growing as a tutor.</PageHeader>
      <Card title="Recent articles">
        {items === null && <Working label="Loading articles" />}
        {items?.length === 0 && <p className="text-sm text-stone-500">No articles could be loaded right now. The book list below always works.</p>}
        <ul className="space-y-3 text-sm">
          {items?.map((i) => (
            <li key={i.url}>
              <a className="font-medium text-indigo-700 hover:underline" href={i.url} target="_blank" rel="noreferrer">{i.title}</a>
              <p className="text-xs text-stone-500">{i.source}{i.date ? ` · ${i.date}` : ""}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Books worth a look">
        <ul className="space-y-3 text-sm">
          {books.map((b) => (
            <li key={b.title}>
              {b.url ? (
                <a className="font-medium text-indigo-700 hover:underline" href={b.url} target="_blank" rel="noreferrer">{b.title}</a>
              ) : (
                <span className="font-medium">{b.title}</span>
              )}{" "}
              <span className="text-stone-500">by {b.author}</span>
              <p className="text-stone-600">{b.why}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
