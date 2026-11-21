import type { SessionOutputs } from "./types";

// RWC Handbook 2023-24 procedures, one entry per kind of session.
// Never put the shared email account password or personal phone numbers here (public repo).

export type Link = { label: string; url: string };
export type Step = { text: string; link?: Link };
export type SessionTypeId = "walk-in" | "email-feedback" | "online" | "regular" | "writing-fellow";
export type SessionType = {
  id: SessionTypeId;
  name: string;
  short: string;
  source: string;
  length: string;
  before: Step[];
  during: Step[];
  after: Step[];
  subbing?: Step[];
  noShow: string;
  starfish: string;
  resources: Link[];
  aiFocus: string;
  extraOutputs: { key: string; title: string; instruction: string }[];
  helpHint: string;
  hideEmail: boolean;
  scenarioIds: string[];
  searchSeeds: string[];
};

const L = {
  affReminder: { label: "AFF reminder form (send to a tutee with no survey)", url: "https://forms.gle/QpCddw1NWChnBWxc6" },
  affTemplate: { label: "AFF template (Word)", url: "https://docs.google.com/document/d/1GREo6K1FxPb4oJa1rnfzNSdGzWzkR4_o/edit#heading=h.30j0zll" },
  affDoc: { label: "AFF template (Google Doc)", url: "https://docs.google.com/document/d/1umnbvfKwix6VAD69aNRs0kuYIBQoNZZoo0Vio8Mo3ZY/edit" },
  affVideo: { label: "AFF video tutorial", url: "https://drive.google.com/file/d/1JVLIxvqCG6MPt-uvSvyKsEoeUDKu9RYr/view?usp=sharing" },
  syllabus: { label: "ENGL 101/102 syllabus and peer lessons (ARIA folder)", url: "https://drive.google.com/drive/u/1/folders/11Sw-9eytRlEQAIqpXS3gJYUr_-cZE3rj" },
  sessionLog: { label: "Peer Tutor Session Log", url: "https://docs.google.com/document/d/1iFcAaNzu8Aw2NP32h6kBzvURCEXYhD83KHYjpJqwLyk/edit" },
  library: { label: "Library hours", url: "https://www.augustana.edu/library" },
} satisfies Record<string, Link>;

export const SESSION_TYPES: SessionType[] = [
  {
    id: "walk-in",
    name: "In-person walk-in",
    short: "A one-off visit, booked ahead or dropped in.",
    source: "Types of Tutees: Walk-Ins; Logistics: Starfish",
    length: "40 min by default (diminishing returns past 75)",
    before: [
      { text: "For a booked visit, read the Starfish email and check the appointment." },
      { text: "Starfish description and the student's earlier meetings tell you if they have used the RWC before." },
    ],
    during: [
      { text: "Greet them, make them feel at home, and ask what they want to work on." },
      { text: "The session is as long as the student wants: some finish in 15 minutes, some stay past the end." },
      { text: "If nobody else is waiting, you may go past 40 minutes while it still helps. Past 75 minutes, returns shrink." },
      { text: "Personal statement, Senior Inquiry project or other high-stakes writing: schedule them with a faculty tutor in Starfish, Reason \"RWC faculty tutoring appointment\"." },
    ],
    after: [
      { text: "Open the appointment in Starfish, hover the calendar icon, click Outcomes." },
      { text: "Type a one-sentence summary of what you worked on, then the student's next steps." },
      { text: "Enter the actual start and end times." },
      { text: "On the Scheduling tab, check that a course is chosen from the dropdown." },
      { text: "Drop-in with no appointment: add one in Starfish (it can be after the fact). Get their full name and course. Starfish minimum is 15 minutes, so for a 2-minute question enter 15 minutes and put the real times under actual start and end." },
    ],
    subbing: [
      { text: "Accept the Google Calendar invitation. Do not add your own office hours in Starfish." },
      { text: "Work with whoever is signed up on the other tutor's Starfish schedule." },
      { text: "You cannot see Outcomes or SpeedNotes: put the one-sentence summary and next steps in the \"Detailed Description\" box on the Scheduling tab, and make sure the course is selected." },
      { text: "If the student does not show, cancel the appointment (you cannot use the missed-appointment box)." },
    ],
    noShow: "After 10-15 minutes, check \"Student missed appointment\" on the Outcomes tab. Do not cancel unless they told you in advance. It emails the student a reminder.",
    starfish: "Every session needs Outcomes: one-sentence summary, next steps, actual start and end times, and a course. Without Outcomes there is no proof the student came.",
    resources: [L.library],
    aiFocus: "This was a one-off walk-in session. Keep next steps small enough to finish before the student's next draft is due.",
    extraOutputs: [],
    helpHint: "This was a one-off in-person walk-in session (default 40 minutes). The tutor does not see this student weekly.",
    hideEmail: false,
    scenarioIds: ["fix-grammar", "deadline"],
    searchSeeds: ["walk-in session first-year student", "higher-order concerns", "setting an agenda"],
  },
  {
    id: "email-feedback",
    name: "Feedback via email (AFF)",
    short: "Asynchronous written feedback on a draft, sent from the RWC email account.",
    source: "Online Tutoring: Asynchronous Appointments",
    length: "About 60 min (10-15 on logistics)",
    before: [
      { text: "When you clock in, check your Starfish schedule. The description says in-person or online asynchronous." },
      { text: "Log in to the RWC email account and open Google Drive." },
      { text: "Open \"Tutee Agenda-setting form\", then Responses, then Individual. Pick your tutee's email (they may have several requests: check it is the right one)." },
      { text: "Read the due date, assignment details and the writer's priorities, then open and read the prompt and draft." },
      { text: "No survey response? Send the \"link to asynch survey\" draft email with a friendly reminder. If it is gone, send the reminder form link.", link: L.affReminder },
    ],
    during: [
      { text: "You may have as little as 60 minutes. Be judicious: you cannot respond to every issue." },
      { text: "Spend no more than 10-15 minutes on logistics. If you routinely spend more than 10, ask a peer or faculty tutor for help." },
      { text: "Open the template. Save as / make a copy named RWCfeedback + writer's last name + your first name.", link: L.affTemplate },
      { text: "No Word? Use the Google Doc version.", link: L.affDoc },
      { text: "Replace Lucas's photo with yours." },
      { text: "Find 3 big revisions. At least one must be what the writer asked for in the form. Also note specific things to praise." },
      { text: "Sort the big 3 and praise under Purpose, Focus, Organization & Development, Source Use & Citation, Grammar & Voice. Delete categories you do not use." },
      { text: "Replace all cyan placeholder text with your own comments. Aim for about 2 substantive pages." },
      { text: "Use short paragraphs, bullets and lists. Look for themes and patterns, not every error." },
      { text: "Put excerpts of the student's writing inside the form with your explanation. Do not write margin comments on the paper." },
      { text: "Any image or link you add must come from a credible source (Purdue OWL is fine). Give credit." },
    ],
    after: [
      { text: "In the RWC email account, open the three-dot menu, Templates, \"Feedback on your writing\". Fill in the tutee's name and yours." },
      { text: "Attach the form. Click the attachment to check it is the right version with no cyan placeholder text left." },
      { text: "Send, then check the Sent folder to confirm it went." },
      { text: "Delete the feedback file, the paper and the prompt from your computer (confidentiality)." },
      { text: "Starfish Outcomes: briefly summarize your big 3, then paste your Next Steps from the form. Check the class on the Summary tab." },
    ],
    noShow: "If you reminded them and there is still no survey 10 minutes after the appointment start, mark them as a no-show in Starfish. They must sign up again with another tutor.",
    starfish: "Outcomes = a short summary of your big 3 plus your Next Steps copied from the feedback file. Check the class on the Summary tab.",
    resources: [L.affReminder, L.affTemplate, L.affDoc, L.affVideo],
    aiFocus: "This was an asynchronous feedback session: the tutor read the draft and wrote feedback on the AFF form. The notes are the tutor's own feedback. Never rewrite or quote-and-fix any student sentence.",
    extraOutputs: [
      {
        key: "aff-outline",
        title: "Big 3 + praise outline (for the AFF form)",
        instruction:
          "Sort only the tutor's own notes into a bullet outline: the Big 3 (at least one is what the writer asked for), placed across Purpose, Focus, Organization & Development, Source Use & Citation, Grammar & Voice, plus praise. Use only what the tutor wrote. Never rewrite or quote-and-fix the student's sentences. The tutor writes the final feedback in their own words.",
      },
    ],
    helpHint: "This was an asynchronous written-feedback (AFF) appointment: the tutor wrote a big-3 feedback form, no live conversation with the student.",
    hideEmail: true,
    scenarioIds: [],
    searchSeeds: ["asynchronous feedback form", "giving written feedback on a draft", "higher-order concerns"],
  },
  {
    id: "online",
    name: "Online (Google Meet, by request only)",
    short: "A live video session for students with extenuating circumstances.",
    source: "Online Tutoring intro; Appendix D: Online Synchronous Appointments",
    length: "1 hour",
    before: [
      { text: "Starfish cannot make a Meet link. Open Google Calendar and select the event Starfish created." },
      { text: "Edit the event, More actions, Duplicate." },
      { text: "Click \"Add Google Meet Video Conferencing\"." },
      { text: "Add the tutee under Guests. Confirm the event is one hour long." },
      { text: "Save, and click Send when asked about invitation emails." },
      { text: "A few minutes early, join the Meet and try to be first. Wear and plug in a headset for confidentiality and clarity." },
      { text: "Contingency if technology fails: they can call the tutor desk at 309-794-8987." },
    ],
    during: [
      { text: "Greet them as in a walk-in. Check the Starfish meetings tab for earlier visits; if new to the RWC, explain how we work." },
      { text: "Ask if they have used Meet before. If not, show them how to mute and turn on captions." },
      { text: "Agree a back-up plan in case tech fails: Hangout chat in Gmail, or the Google Doc." },
      { text: "Ask them to share their work as a Google Doc and their prompt (a summary is fine)." },
      { text: "Use a headset. Expect it to be more tiring and longer than you think." },
      { text: "Narrate what you do, e.g. \"I'm highlighting a sentence, can you see it?\"." },
      { text: "Ask them to turn on their camera: \"Are you OK with turning on your camera so we can see each other?\"" },
      { text: "Comment on their doc or ask them to; never edit it directly." },
      { text: "Give them tasks, e.g. \"Take 5 minutes to revise your thesis\", so it is not all talking." },
    ],
    after: [
      { text: "Save a few minutes to ask for their next steps in revision." },
      { text: "Starfish Outcomes: a one-sentence summary of what you worked on, then their next steps." },
      { text: "Enter the actual start and end times. This shows the appointment happened." },
    ],
    noShow: "Same as a walk-in: after 10-15 minutes check \"Student missed appointment\" on the Outcomes tab.",
    starfish: "Outcomes: one-sentence summary, then the student's next steps, plus the actual start and end times.",
    resources: [],
    aiFocus: "This was a live Google Meet session. Next steps should be doable without the tutor present.",
    extraOutputs: [],
    helpHint: "This was an online Google Meet session (by request only). Camera, shared doc and technology can shape how it goes.",
    hideEmail: false,
    scenarioIds: ["online-camera-off"],
    searchSeeds: ["online tutoring Google Meet", "tutoring multilingual writers", "setting an agenda"],
  },
  {
    id: "regular",
    name: "ENGL 101/102 regular",
    short: "A weekly one-credit session with the same student, following the syllabus peer lessons.",
    source: "Types of Tutees: English 101 and 102 Students, or \"Regulars\"",
    length: "Weekly appointment",
    before: [
      { text: "Open this week's peer lesson in the syllabus.", link: L.syllabus },
      { text: "ENGL 101 helps first-years transition to college. ENGL 102 (sophomores) is information literacy: research questions, finding, evaluating and synthesizing sources." },
      { text: "Adapt the lesson to this student's talents and needs." },
    ],
    during: [
      { text: "Guide the student through the peer lesson. Build on their strengths and demystify academic moves." },
      { text: "Never disclose or ask about grades: regulars' grades are never shared with peer tutors." },
      { text: "You are not evaluated on the regular's performance, but you may be observed." },
    ],
    after: [
      { text: "Update the Peer Tutor Session Log every week: lesson, what you worked on, plan for next week.", link: L.sessionLog },
      { text: "Faculty tutors enter regulars in Starfish as recurring appointments." },
    ],
    subbing: [
      { text: "If you must miss your shift, meet your regular during your other shift if you can." },
      { text: "Otherwise tell them another tutor will meet them, and tell the substitute which lesson they are on." },
      { text: "If you are the substitute: take brief notes and email them to the student's regular tutor, so they know what happened this week." },
    ],
    noShow: "Follow the Starfish no-show rule: after 10-15 minutes check \"Student missed appointment\" on the Outcomes tab.",
    starfish: "Never reschedule a regular as an ENGL101/102 appointment: it creates recurring appointments for the rest of the semester that can never be fully erased from the student's profile.",
    resources: [L.syllabus, L.sessionLog],
    aiFocus: "This was a weekly ENGL 101/102 regular session following a syllabus peer lesson. Never mention or ask about grades.",
    extraOutputs: [
      {
        key: "session-log",
        title: "Peer Tutor Session Log entry",
        instruction:
          "A short Peer Tutor Session Log entry with three labelled lines: Lesson (the peer lesson covered, only if the notes say), What we worked on, Plan for next week. Use only the tutor's notes.",
      },
    ],
    helpHint: "This was a weekly ENGL 101/102 regular session. 101 is about transition to college; 102 about information literacy. Grades are never disclosed to peer tutors.",
    hideEmail: false,
    scenarioIds: ["regular-101"],
    searchSeeds: ["ENGL 101 peer lesson", "ENGL 102 information literacy research question", "working with a regular"],
  },
  {
    id: "writing-fellow",
    name: "Writing Fellow conference",
    short: "A 30-minute conference with a student in your fellowed class (Conference 1 or 2).",
    source: "Types of Tutees: Writing Fellow Appointments; Appendix B",
    length: "30 min, individual or group",
    before: [
      { text: "Enter every conference in Starfish before it happens, so students are reminded and others know you are on shift." },
      { text: "Individual: + Appointment, Reason \"Writing Fellows Appointment\", location Reading/Writing Center (Gerber 423), 30-minute slot, pick the course." },
      { text: "Group: + Group Session, Reason \"Writing Fellow Appointment\", enter the number of students, then Manage Participants to add each one with their course." },
      { text: "On the SpeedNotes tab mark Conference 1 or Conference 2." },
      { text: "Read the student's work and fill in the WF response form before the conference (unless the professor asked otherwise). Write minimal, if any, comments on the draft." },
      { text: "Meet in the RWC, any time the library is open. If it is crowded, ask a faculty tutor about a faculty office.", link: L.library },
    ],
    during: [
      { text: "Treat it much like a walk-in: make them feel at home, explain how the RWC works, negotiate priorities." },
      { text: "Let the student lead. Consider sharing the form only midway through." },
      { text: "The student is entitled to the full 30 minutes. If you finish early, they can start revising." },
      { text: "Save 3-5 minutes at the end to ask for their Next Steps. Type them at the bottom of the WF form. Negotiate if their priorities differ from yours." },
      { text: "Print the form or email it to them." },
    ],
    after: [
      { text: "Edit the Starfish appointment to the actual time spent, or mark that they missed. Group: Manage Participants, Outcomes tab, actual arrival and leave times, \"Student missed session\" for absentees." },
      { text: "After each round, email all your WF forms to the professor as a batch. Note any no-shows and anyone more than a few minutes late." },
      { text: "Do not clock in for WF work: pay is handled through the Learning Commons administrative assistant." },
    ],
    noShow: "Check \"Student Missed Appointment\" on the Outcomes tab. Email the student, cc the professor, asking them to reschedule to another open time. One reschedule only: if they miss that too, email them their form, cc the professor.",
    starfish: "No Outcomes needed for Writing Fellow appointments: the next steps are already on the WF form.",
    resources: [L.library],
    aiFocus: "This was a Writing Fellow conference. The next steps are for the WF response form, not Starfish.",
    extraOutputs: [],
    helpHint: "This was a Writing Fellow conference (30 minutes, Conference 1 or 2). The student's professor is a peer-like partner; the tutor filled in a WF response form beforehand.",
    hideEmail: true,
    scenarioIds: ["wf-conference"],
    searchSeeds: ["Writing Fellows conference", "responding to first-year writing", "giving feedback on a draft"],
  },
];

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
    { label: "Task force folder", url: "https://drive.google.com/drive/u/1/folders/1LY5480DKiP5SvApnLSeU9k9mjL_sNb2G" },
    { label: "Peer tutor job description", url: "https://drive.google.com/a/augustana.edu/open?id=1mOLgFF8Zp1WqTtRVUHhTUhxCUJiWU6ob" },
  ],
};

export function getSessionType(id: string | null | undefined): SessionType | undefined {
  return id ? SESSION_TYPES.find((t) => t.id === id) : undefined;
}

/** Starfish Outcomes text, built from the tutor's own notes with no model call. */
export function starfishOutcome(outputs: SessionOutputs, type: SessionType | undefined): string {
  const note = outputs.sessionNote ?? "";
  // First line of the Purpose section if the note has one, else the first non-empty line.
  const lines = note.split("\n").map((l) => l.trim()).filter(Boolean);
  const purposeAt = lines.findIndex((l) => /^purpose\b/i.test(l));
  let summary = "";
  if (purposeAt >= 0) {
    const same = lines[purposeAt].replace(/^purpose\s*[:\-–]?\s*/i, "");
    summary = same || lines[purposeAt + 1] || "";
  } else summary = lines[0] ?? "";
  summary = (summary.match(/^.*?[.!?](\s|$)/)?.[0] ?? summary).trim();
  const steps = (outputs.nextSteps ?? []).filter((s) => typeof s === "string" && s.trim());
  const parts: string[] = [];
  if (type?.id === "email-feedback") {
    const big3 = outputs.typeOutputs?.find((t) => /big 3/i.test(t.title))?.text.trim();
    if (big3) parts.push(`Big 3: ${big3.split("\n").map((l) => l.replace(/^[-*\s]+/, "").trim()).filter(Boolean).slice(0, 3).join("; ")}.`);
  }
  if (summary) parts.push(summary);
  if (steps.length) parts.push(`Next steps: ${steps.join(" ")}`);
  return parts.join(" ");
}
