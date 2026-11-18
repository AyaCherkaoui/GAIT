export type SessionType = "reading" | "tutoring" | "fellows" | "aff" | "eng101";

export const SESSION_TYPES: { id: SessionType; label: string; blurb: string; minutes: number }[] = [
  { id: "reading", label: "Reading only", blurb: "A student reads and you stay close.", minutes: 30 },
  { id: "tutoring", label: "Normal tutoring", blurb: "A regular one-on-one session.", minutes: 45 },
  { id: "fellows", label: "Writing fellows", blurb: "A session with a class's writing fellow.", minutes: 45 },
  { id: "aff", label: "AFF", blurb: "Asynchronous feedback form: no student present.", minutes: 30 },
  { id: "eng101", label: "English 101", blurb: "Work through the course units.", minutes: 60 },
];

export const FOCUS_AREAS = [
  "thesis", "organization", "source use", "grammar", "citations", "revising", "getting started", "brainstorming", "outlining",
] as const;
export type FocusId = (typeof FOCUS_AREAS)[number];

export function isSessionType(v: unknown): v is SessionType {
  return typeof v === "string" && SESSION_TYPES.some((t) => t.id === v);
}
export function isFocus(v: unknown): v is FocusId {
  return typeof v === "string" && (FOCUS_AREAS as readonly string[]).includes(v);
}
export function typeLabel(t: SessionType | string | undefined): string {
  return SESSION_TYPES.find((x) => x.id === t)?.label ?? "";
}
export function defaultMinutes(t: SessionType): number {
  return SESSION_TYPES.find((x) => x.id === t)?.minutes ?? 45;
}
