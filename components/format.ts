/** "2026-11-15 03:41:36" (SQLite, UTC) becomes "Nov 15, 2026". Date only, so server and browser agree. */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(s) ? s.replace(" ", "T") + "Z" : s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
