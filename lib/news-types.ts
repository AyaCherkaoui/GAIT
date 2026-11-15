/** Types and topic names shared by the server (lib/news.ts) and the News page. No Node imports, so the browser can load it. */
export const TOPICS = ["Tutoring theory", "Student improvement", "AI and writing", "Teaching tips"] as const;
export type Topic = (typeof TOPICS)[number];

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  /** ISO date. */
  date: string;
  author?: string;
  image?: string;
  /** About two sentences of plain text. */
  summary: string;
  topic: Topic;
};
export type NewsResult = { items: NewsItem[]; failed: string[]; updatedAt: number };
