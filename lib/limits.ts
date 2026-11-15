import { AsyncLocalStorage } from "node:async_hooks";
import { getDb } from "./db";

/**
 * Rate limits kept in the SQLite database, so they survive restarts and are shared by every process
 * that uses the same gait.db. One row per hit; old rows are deleted as we go.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const db = getDb();
  const now = Date.now();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM rate_hits WHERE at <= ?").run(now - 10 * 60_000);
    const { n } = db.prepare("SELECT count(*) AS n FROM rate_hits WHERE key = ? AND at > ?").get(key, now - windowMs) as { n: number };
    const ok = n < max;
    if (ok) db.prepare("INSERT INTO rate_hits (key, at) VALUES (?, ?)").run(key, now);
    db.exec("COMMIT");
    return ok;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** Model calls (not requests) a signed-in user may make per minute, and per single request (a quiz can need several). */
export const AI_CALLS_PER_MINUTE = 60;
export const AI_CALLS_PER_REQUEST = 5;

/** The user and call count of the request being handled, set by handle() in lib/api.ts. */
export const aiContext = new AsyncLocalStorage<{ userId: number; calls: number }>();

/** Called before every model call. Returns an error message when the call is not allowed, else null. */
export function chargeAiCall(): string | null {
  const ctx = aiContext.getStore();
  if (!ctx) return null; // not inside a request (scripts)
  if (++ctx.calls > AI_CALLS_PER_REQUEST) return "That took too many AI steps. Please try again.";
  if (!rateLimit(`aicall:${ctx.userId}`, AI_CALLS_PER_MINUTE, 60_000)) return "Too many requests. Wait a minute and try again.";
  return null;
}
