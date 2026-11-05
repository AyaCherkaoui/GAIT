import { getDb } from "./db";

export type UsageKind = "session" | "ownership" | "script";

/** Counts a use of a feature. Stores only the kind and the time: no names, no text. */
export function logUsage(kind: UsageKind) {
  try {
    getDb().prepare("INSERT INTO usage_events (kind) VALUES (?)").run(kind);
  } catch {
    // Counting must never break the feature.
  }
}
