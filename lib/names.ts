const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

/**
 * The first name from a typed student name. "Last, First" and "First Last" both work, and a suffix
 * (Jr., Sr., II, III, IV) is never taken as the first name: "Smith Jr., Pat" gives "Pat",
 * "Pat Smith Jr." gives "Pat", and "Smith, Jr." gives "" (no first name was given).
 */
export function firstNameOf(full: string): string {
  const text = full.includes(",") ? full.slice(full.indexOf(",") + 1) : full;
  return text.split(/[\s,]+/).filter((t) => t && !SUFFIX.test(t))[0] ?? "";
}
