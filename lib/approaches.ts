import type { FocusId, SessionType } from "./session-types";

/** A draft approach: steps with the minute each one starts. The director confirms the wording. */
export type Approach = { title: string; steps: { at: number; text: string }[]; tip?: string };

export const DRAFT_CHIP = "Draft: director to confirm";

const BASE: Record<Exclude<SessionType, "eng101">, Approach> = {
  reading: {
    title: "Reading only",
    steps: [
      { at: 0, text: "Ask what the student is reading and what they want from it." },
      { at: 5, text: "Let them read; check in with one open question now and then." },
      { at: 20, text: "Ask them to say the main point in their own words." },
      { at: 25, text: "Ask what they will do with it next." },
    ],
  },
  tutoring: {
    title: "Normal tutoring",
    steps: [
      { at: 0, text: "Set the agenda together: ask what they want to leave with." },
      { at: 5, text: "Have the student read a short part aloud or summarize it." },
      { at: 15, text: "Ask questions about the one or two biggest issues." },
      { at: 35, text: "Ask the student to restate what they will change." },
      { at: 40, text: "Agree on next steps and write them down together." },
    ],
  },
  fellows: {
    title: "Writing fellows",
    steps: [
      { at: 0, text: "Ask what the assignment asks and where the draft is now." },
      { at: 5, text: "Read together, noting where the draft meets the assignment." },
      { at: 20, text: "Ask questions about one or two priorities for the next draft." },
      { at: 35, text: "Ask the student to plan their revision in their own words." },
      { at: 40, text: "Agree on what to bring back." },
    ],
  },
  aff: {
    title: "AFF",
    steps: [
      { at: 0, text: "Review the form and the draft it describes." },
      { at: 8, text: "Find one or two priorities." },
      { at: 15, text: "Write feedback as questions, not edits." },
      { at: 25, text: "Reread for tone and send." },
    ],
    tip: "No student is present: the timer is a time budget.",
  },
};

const FOCUS: Record<FocusId, Approach> = {
  thesis: { title: "Thesis", steps: [
    { at: 0, text: "Ask the student to say their main claim out loud." },
    { at: 10, text: "Ask what a reader might disagree with." },
    { at: 25, text: "Ask them to write the claim in one sentence." },
  ] },
  organization: { title: "Organization", steps: [
    { at: 0, text: "Ask the student to describe each paragraph in a phrase." },
    { at: 12, text: "Ask which paragraph supports which part of the claim." },
    { at: 28, text: "Ask them to choose an order and say why." },
  ] },
  "source use": { title: "Source use", steps: [
    { at: 0, text: "Ask what each source is for in the paper." },
    { at: 12, text: "Ask how the student explains each quote after it." },
    { at: 28, text: "Ask which source they would cut or add." },
  ] },
  grammar: { title: "Grammar", steps: [
    { at: 0, text: "Ask the student to read a paragraph aloud and listen for stumbles." },
    { at: 12, text: "Ask them to name the pattern in one repeated error." },
    { at: 28, text: "Ask them to fix the next one themselves." },
  ] },
  citations: { title: "Citations", steps: [
    { at: 0, text: "Ask which style the assignment requires." },
    { at: 10, text: "Have the student find one citation's parts in the handbook." },
    { at: 25, text: "Ask them to check the next one on their own." },
  ] },
  revising: { title: "Revising", steps: [
    { at: 0, text: "Ask what the student wants to change and why." },
    { at: 12, text: "Ask them to rank the changes by importance." },
    { at: 28, text: "Ask which one they will start with." },
  ] },
  "getting started": { title: "Getting started", steps: [
    { at: 0, text: "Ask what the assignment asks in the student's words." },
    { at: 10, text: "Ask what they already know or think about it." },
    { at: 25, text: "Ask for a first small step they can do today." },
  ] },
  brainstorming: { title: "Brainstorming", steps: [
    { at: 0, text: "Ask the student to list every idea without judging." },
    { at: 12, text: "Ask which ideas connect." },
    { at: 28, text: "Ask which one they want to explore first." },
  ] },
  outlining: { title: "Outlining", steps: [
    { at: 0, text: "Ask the student to name the main points." },
    { at: 12, text: "Ask how each point leads to the next." },
    { at: 28, text: "Ask them to write the outline in their own words." },
  ] },
};

/** The draft approach for a type; for tutoring, the chosen focus areas are added after the base steps. */
export function approachFor(type: SessionType, focus: FocusId[] = []): Approach {
  if (type === "eng101") return { title: "English 101", steps: [], tip: "Work through the units of the course." };
  const base = BASE[type];
  if (type !== "tutoring" || !focus.length) return base;
  const extra = focus.map((f) => FOCUS[f]).filter(Boolean);
  return {
    ...base,
    tip: "Focus: " + extra.map((a) => a.title.toLowerCase()).join(", ") + ".",
    steps: [
      ...base.steps,
      ...extra.flatMap((a) => a.steps.map((s) => ({ at: s.at + 15, text: `${a.title}: ${s.text}` }))),
    ].sort((x, y) => x.at - y.at),
  };
}
