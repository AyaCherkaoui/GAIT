import { handle } from "@/lib/api";
import { askJson, UserFacingError } from "@/lib/claude";
import { getDb } from "@/lib/db";
import { getPolicy } from "@/lib/policies";
import { logUsage } from "@/lib/usage";
import { AI_POLICIES, type AiPolicy, type SessionNotes, type SessionOutputs } from "@/lib/types";

export const dynamic = "force-dynamic";

const SYSTEM = `You help a writing-center tutor prepare a follow-up for a student after a tutoring session.
Use only what is in the tutor's notes; do not invent details. Return:
{
  "email": "a warm, short plain-text email from the tutor to the student: greeting by first name, 2-3 sentence recap, what they did well, the focus areas, next steps, an invitation to come back to the RWC. Sign it 'Your RWC tutor'.",
  "nextSteps": ["3-5 concrete actions the student does on their own, each starting with a verb"],
  "focusAreas": [{"skill": "a named writing skill", "why": "why it matters for this assignment, based on the notes", "miniLesson": "3-5 sentences explaining the skill, with one short example on a different topic than the student's paper"}],
  "aiPrompts": [{"prompt": "a prompt the student can paste into any AI tool so the AI coaches them (asks questions, quizzes, explains, or points out patterns) without rewriting their work. Use placeholders like [paste one paragraph] for the student's own text, and include 'Don't rewrite it for me.'", "whyItHelps": "one line"}],
  "sessionNote": "a plain-text session note for the center's records, organized by the RWC rubric with these headings, in this order: Purpose, Focus, Organization & Development, Source Use & Citation, Grammar & Voice. Leave out any heading that was not discussed. Use only the notes; 1-3 sentences per heading",
  "voiceFlags": ["only in voice-first mode: short warnings about any suggestion in this output that only standardizes the student's English instead of serving their meaning; otherwise []"],
  "dontAskAi": ["3 example requests to avoid, each followed by a short reason, e.g. 'Write my conclusion' — you lose the chance to practice the skill your professor is grading"]
}
Give 2-3 focusAreas and 4-6 aiPrompts tied to the focus areas.

The course AI policy is given in the notes. Never say or imply that the student used AI improperly, and never judge who wrote the text.
- If the policy is "banned": aiPrompts must be [] and the next steps must say to check the syllabus and the professor's rules before using any AI tool. dontAskAi should say that any AI use may break the course rules.
- If the policy is "unknown": one of the next steps must be to ask the professor whether and how AI may be used.
- If the policy is "limited": keep the prompts to the uses the policy details allow, and say to disclose the use.
- If the tutor noted AI use, add a next step about disclosing or citing it as the course asks.`;

const VOICE_RULES = `\n\nVoice-first mode is ON. Keep suggestions in the writer's own phrasing and dialect; do not steer toward a "standard" register for its own sake. Fill voiceFlags with any feedback here that mainly standardizes English rather than clarifying meaning (else []).`;

/** What the student-facing parts get to see about policy; the private concern is never passed on. */
function sanitizeOutputs(o: SessionOutputs, policy: AiPolicy): SessionOutputs {
  const out: SessionOutputs = {
    ...o,
    nextSteps: Array.isArray(o.nextSteps) ? o.nextSteps : [],
    focusAreas: Array.isArray(o.focusAreas) ? o.focusAreas : [],
    aiPrompts: Array.isArray(o.aiPrompts) ? o.aiPrompts : [],
    dontAskAi: Array.isArray(o.dontAskAi) ? o.dontAskAi : [],
    voiceFlags: Array.isArray(o.voiceFlags) ? o.voiceFlags.filter((x) => typeof x === "string" && x.trim()) : [],
  };
  if (policy === "banned") {
    out.aiPrompts = [];
    if (!out.nextSteps.some((s) => /syllabus/i.test(s)))
      out.nextSteps.push("Check your syllabus and ask your professor before using any AI tool on this assignment.");
  }
  if (policy === "unknown" && !out.nextSteps.some((s) => /professor|instructor/i.test(s)))
    out.nextSteps.push("Ask your professor whether and how AI tools may be used on this assignment.");
  return out;
}

export async function GET() {
  return handle(async () => {
    const sessions = getDb()
      .prepare("SELECT id, created_at, student_name, course FROM sessions ORDER BY id DESC LIMIT 50")
      .all();
    return { sessions };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json()) as { studentName?: string; course?: string; notes?: SessionNotes; voice?: boolean };
    const notes: SessionNotes = body.notes ?? { workedOn: "", struggles: "", wentWell: "" };
    // The tutor's choice wins; otherwise use the saved policy for the course code.
    const saved = notes.courseCode ? getPolicy(notes.courseCode) : null;
    const policy: AiPolicy = AI_POLICIES.includes(notes.aiPolicy as AiPolicy) ? (notes.aiPolicy as AiPolicy) : (saved?.policy ?? "unknown");
    notes.aiPolicy = policy;
    if (!notes.workedOn?.trim() && !notes.struggles?.trim()) {
      throw new UserFacingError("Add at least what you worked on or what the student struggled with.");
    }
    const policyText = `${policy}${saved && saved.policy === policy && saved.details ? ` (${saved.details})` : ""}`;
    // privateConcern is deliberately left out of the prompt.
    const generated = await askJson<SessionOutputs>({
      system: SYSTEM + (body.voice ? VOICE_RULES : ""),
      messages: [
        {
          role: "user",
          content: `Student first name: ${body.studentName || "(not given)"}
Course / assignment: ${body.course || "(not given)"}
What we worked on: ${notes.workedOn}
What they struggled with: ${notes.struggles}
What went well: ${notes.wentWell}
Course AI policy: ${policyText}
AI use the student disclosed or the tutor noticed: ${notes.aiUse?.trim() || "(none noted)"}`,
        },
      ],
    });
    const outputs = sanitizeOutputs(generated, policy);
    const info = getDb()
      .prepare("INSERT INTO sessions (student_name, course, notes, outputs) VALUES (?, ?, ?, ?)")
      .run(body.studentName ?? "", body.course ?? "", JSON.stringify(notes), JSON.stringify(outputs));
    logUsage("session");
    return { id: Number(info.lastInsertRowid), outputs };
  });
}
