/** The task forces tutors join. One per person. Seeds hold no member names. */
export type TaskForce = { key: string; name: string; max: number | null; scholars: boolean; description: string };

export const TASK_FORCES: readonly TaskForce[] = [
  { key: "aria-curators", name: "ARIA Curators", max: 3, scholars: false, description: "Maintain ARIA on Drive: rename and sort uploads, archive programs, events, flyers and photos. Up to 3, one per cohort." },
  { key: "gait-keepers", name: "GAIT Keepers (AI)", max: 4, scholars: false, description: "Explore GenAI tools, make tutor resources, collect professors' GenAI course policies, and program AI sessions." },
  { key: "good-troublemakers", name: "Good Troublemakers", max: 4, scholars: false, description: "Work with OSCC and culture groups: Native American Heritage Month in November and the African-American Read-In in February." },
  { key: "merch-publicity", name: "Merch/Publicity Team", max: 4, scholars: false, description: "Make posters and merch." },
  { key: "party-planners", name: "Party Planners", max: 4, scholars: false, description: "Run the RWC 50th birthday bash (the RWC was founded 9/20/1976)." },
  { key: "social-media", name: "Social Media Czars", max: 4, scholars: false, description: "Post to Instagram and Facebook at least twice a week." },
  { key: "rwc-scholars", name: "RWC Scholars", max: null, scholars: true, description: "Experienced tutors only; the director places them. Prepare a writing-center-journal article with a faculty mentor." },
];

export const MIN_TO_RUN = 3;

export function taskForce(key: unknown): TaskForce | undefined {
  return typeof key === "string" ? TASK_FORCES.find((t) => t.key === key) : undefined;
}
