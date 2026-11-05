import { getDb } from "./db";

export type ImpactWeek = {
  week: string;
  sessions: number;
  aiDisclosed: number;
  allowed: number;
  limited: number;
  banned: number;
  unknown: number;
  ownership: number;
  scripts: number;
};

/** Anonymous weekly counts (weeks start Monday). Only counts leave the database: no names, no text. */
export function impactByWeek(): ImpactWeek[] {
  const db = getDb();
  const weekOf = "date(created_at, 'weekday 0', '-6 days')";
  const sessions = db
    .prepare(
      `SELECT ${weekOf} AS week, COUNT(*) AS sessions,
        SUM(CASE WHEN COALESCE(TRIM(json_extract(notes, '$.aiUse')), '') != '' THEN 1 ELSE 0 END) AS aiDisclosed,
        SUM(CASE WHEN json_extract(notes, '$.aiPolicy') = 'allowed' THEN 1 ELSE 0 END) AS allowed,
        SUM(CASE WHEN json_extract(notes, '$.aiPolicy') = 'limited' THEN 1 ELSE 0 END) AS limited,
        SUM(CASE WHEN json_extract(notes, '$.aiPolicy') = 'banned' THEN 1 ELSE 0 END) AS banned,
        SUM(CASE WHEN COALESCE(json_extract(notes, '$.aiPolicy'), 'unknown') NOT IN ('allowed','limited','banned') THEN 1 ELSE 0 END) AS unknown
       FROM sessions GROUP BY week`,
    )
    .all() as Omit<ImpactWeek, "ownership" | "scripts">[];
  const usage = db
    .prepare(
      `SELECT date(at, 'weekday 0', '-6 days') AS week,
        SUM(CASE WHEN kind = 'ownership' THEN 1 ELSE 0 END) AS ownership,
        SUM(CASE WHEN kind = 'script' THEN 1 ELSE 0 END) AS scripts
       FROM usage_events GROUP BY week`,
    )
    .all() as { week: string; ownership: number; scripts: number }[];
  const map = new Map<string, ImpactWeek>();
  const blank = (week: string): ImpactWeek => ({ week, sessions: 0, aiDisclosed: 0, allowed: 0, limited: 0, banned: 0, unknown: 0, ownership: 0, scripts: 0 });
  for (const r of sessions) map.set(r.week, { ...blank(r.week), ...r });
  for (const u of usage) map.set(u.week, { ...(map.get(u.week) ?? blank(u.week)), ownership: u.ownership, scripts: u.scripts });
  return [...map.values()].sort((a, b) => b.week.localeCompare(a.week));
}

export function toCsv(rows: ImpactWeek[]): string {
  const head = "week,sessions,ai_use_disclosed,policy_allowed,policy_limited,policy_banned,policy_unknown,ownership_question_uses,script_bank_uses";
  return [head, ...rows.map((r) => [r.week, r.sessions, r.aiDisclosed, r.allowed, r.limited, r.banned, r.unknown, r.ownership, r.scripts].join(","))].join("\n") + "\n";
}
