import { getDb } from "./db";

export type UsageKind = "session" | "ownership" | "script";

/** Counts a use of a feature. Stores the kind, the time and who used it (so a tutor sees their own counts): no names, no text. */
export function logUsage(kind: UsageKind, userId: number) {
  try {
    getDb().prepare("INSERT INTO usage_events (kind, user_id) VALUES (?, ?)").run(kind, userId);
  } catch {
    // Counting must never break the feature.
  }
}
