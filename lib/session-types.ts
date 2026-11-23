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

// Draft content from the RWC Handbook 2023-24, one checklist per session type. The director confirms the wording.
// Never put the shared email account password or personal phone numbers here (the repo is public).
export type Link = { label: string; url: string };
export type CheckStep = { text: string; link?: Link };
export type Checklist = { before: CheckStep[]; during: CheckStep[]; after: CheckStep[]; noShow: string; starfish: string };

const AFF_FORM: Link = { label: "AFF reminder form", url: "https://forms.gle/QpCddw1NWChnBWxc6" };
const AFF_DOC: Link = { label: "AFF template (Google Doc)", url: "https://docs.google.com/document/d/1umnbvfKwix6VAD69aNRs0kuYIBQoNZZoo0Vio8Mo3ZY/edit" };
const SYLLABUS: Link = { label: "ENGL 101/102 syllabus and peer lessons (ARIA folder)", url: "https://drive.google.com/drive/u/1/folders/11Sw-9eytRlEQAIqpXS3gJYUr_-cZE3rj" };
const SESSION_LOG: Link = { label: "Peer Tutor Session Log", url: "https://docs.google.com/document/d/1iFcAaNzu8Aw2NP32h6kBzvURCEXYhD83KHYjpJqwLyk/edit" };

const NO_SHOW = "After 10-15 minutes, check \"Student missed appointment\" on the Outcomes tab. Do not cancel unless they told you in advance.";
const OUTCOMES = "Every session needs Outcomes in Starfish: a one-sentence summary, the student's next steps, the actual start and end times, and a course.";

export const CHECKLISTS: Record<SessionType, Checklist> = {
  reading: {
    before: [{ text: "Check the appointment in Starfish and read its description." }],
    during: [
      { text: "Greet them and ask what they are reading and what they want from it." },
      { text: "Stay close; check in with an open question now and then." },
    ],
    after: [
      { text: "Starfish Outcomes: one-sentence summary, then the student's next steps." },
      { text: "Enter the actual start and end times and check that a course is chosen." },
    ],
    noShow: NO_SHOW,
    starfish: OUTCOMES,
  },
  tutoring: {
    before: [
      { text: "For a booked visit, read the Starfish email and check the appointment." },
      { text: "The description and the student's earlier meetings tell you if they have used the RWC before." },
    ],
    during: [
      { text: "Greet them, make them feel at home, and ask what they want to work on." },
      { text: "The session is as long as the student wants (40 minutes by default). Past 75 minutes, returns shrink." },
      { text: "Personal statement, Senior Inquiry project or other high-stakes writing: book a faculty tutor in Starfish." },
    ],
    after: [
      { text: "Open the appointment in Starfish, hover the calendar icon, click Outcomes." },
      { text: "Type a one-sentence summary of what you worked on, then the student's next steps." },
      { text: "Enter the actual start and end times, and check a course is chosen on the Scheduling tab." },
      { text: "Drop-in with no appointment: add one in Starfish afterwards with their full name and course. The minimum is 15 minutes; put the real times under actual start and end." },
    ],
    noShow: NO_SHOW + " This emails the student a reminder.",
    starfish: OUTCOMES + " Without Outcomes there is no proof the student came.",
  },
  fellows: {
    before: [
      { text: "Enter every conference in Starfish before it happens: Reason \"Writing Fellows Appointment\", a 30-minute slot, and the course." },
      { text: "Group conference: add a group session and each participant with their course." },
      { text: "On the SpeedNotes tab mark Conference 1 or Conference 2." },
      { text: "Read the student's work and fill in the WF response form beforehand, with minimal comments on the draft." },
    ],
    during: [
      { text: "Treat it like a walk-in: make them feel at home, explain how the RWC works, agree priorities." },
      { text: "Let the student lead. Consider sharing the form only midway through." },
      { text: "The student is entitled to the full 30 minutes." },
      { text: "Save 3-5 minutes at the end to ask for their next steps and type them at the bottom of the form." },
    ],
    after: [
      { text: "Edit the Starfish appointment to the time actually spent, or mark that they missed." },
      { text: "Print the form or email it to the student." },
      { text: "After each round, email all your forms to the professor as a batch, noting no-shows and late arrivals." },
      { text: "Do not clock in for Writing Fellow work; pay goes through the Learning Commons administrative assistant." },
    ],
    noShow: "Check \"Student Missed Appointment\" on the Outcomes tab. Email the student, cc the professor, to reschedule once. If they miss that too, email them the form, cc the professor.",
    starfish: "No Outcomes are needed for Writing Fellow appointments: the next steps are already on the WF form.",
  },
  aff: {
    before: [
      { text: "When you clock in, check your Starfish schedule for in-person or online asynchronous." },
      { text: "Open the Tutee Agenda-setting form responses and pick the right request by the tutee's email." },
      { text: "Read the due date, assignment details and the writer's priorities, then the prompt and draft." },
      { text: "No survey response yet? Send the reminder with a friendly note.", link: AFF_FORM },
    ],
    during: [
      { text: "You may have as little as 60 minutes: you cannot respond to every issue. Keep logistics to 10-15 minutes." },
      { text: "Make a copy of the template named RWCfeedback + writer's last name + your first name.", link: AFF_DOC },
      { text: "Find 3 big revisions; at least one must be what the writer asked for. Note specific things to praise." },
      { text: "Sort them under Purpose, Focus, Organization & Development, Source Use & Citation, Grammar & Voice. Delete unused categories." },
      { text: "Replace all placeholder text with your own comments, about 2 substantive pages. Short paragraphs and bullets; look for patterns, not every error." },
      { text: "Quote the student's writing inside the form with your explanation; no margin comments on the paper." },
    ],
    after: [
      { text: "Send the feedback from the RWC email account's \"Feedback on your writing\" template with the form attached." },
      { text: "Open the attachment to check it is the right version with no placeholder text left, then check the Sent folder." },
      { text: "Delete the feedback file, the paper and the prompt from your computer (confidentiality)." },
      { text: "Starfish Outcomes: summarize your big 3, then paste your Next Steps. Check the class on the Summary tab." },
    ],
    noShow: "If you reminded them and there is still no survey 10 minutes after the start, mark them as a no-show in Starfish. They must sign up again with another tutor.",
    starfish: "Outcomes = a short summary of your big 3 plus your Next Steps copied from the feedback file.",
  },
  eng101: {
    before: [
      { text: "Open this week's peer lesson in the syllabus.", link: SYLLABUS },
      { text: "ENGL 101 helps first-years move into college; ENGL 102 is information literacy. Adapt the lesson to this student." },
    ],
    during: [
      { text: "Guide the student through the peer lesson. Build on their strengths and demystify academic moves." },
      { text: "Never disclose or ask about grades: a regular's grades are never shared with peer tutors." },
    ],
    after: [
      { text: "Update the Peer Tutor Session Log every week: lesson, what you worked on, plan for next week.", link: SESSION_LOG },
      { text: "If you subbed, email brief notes to the student's regular tutor." },
    ],
    noShow: NO_SHOW,
    starfish: "Never reschedule a regular as an ENGL 101/102 appointment in Starfish: it creates recurring appointments that cannot be fully erased.",
  },
};

export const CENTER_BASICS: { contacts: { label: string; phone: string }[]; links: Link[] } = {
  contacts: [
    { label: "RWC tutor desk", phone: "309-794-8987" },
    { label: "Director's office", phone: "309-794-8043" },
    { label: "Public Safety (if you feel unsafe)", phone: "309-794-7711" },
    { label: "Counseling Center (confidential)", phone: "309-794-7357" },
    { label: "Campus Ministries (confidential)", phone: "309-794-7213" },
  ],
  links: [
    { label: "Title IX reporting form", url: "https://cm.maxient.com/reportingform.php?AugustanaCollege&layout_id=4" },
    { label: "Bias incident reporting", url: "https://www.augustana.edu/reporting" },
    { label: "Policy Against Sex Discrimination", url: "https://www.augustana.edu/student-life/TitleIX/sex-discrimination-policy" },
    { label: "Student Code of Social Conduct", url: "https://augustana.net/student-life/dean-of-students/inside-augustana-student-handbook/social-conduct" },
    { label: "Library hours", url: "https://www.augustana.edu/library" },
  ],
};
