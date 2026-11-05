import { handle } from "@/lib/api";
import { askJson, UserFacingError } from "@/lib/claude";
import { getDb } from "@/lib/db";
import type { SessionNotes, SessionOutputs } from "@/lib/types";

export const dynamic = "force-dynamic";

const SYSTEM = `You help a writing-center tutor prepare a follow-up for a student after a tutoring session.
Use only what is in the tutor's notes; do not invent details. Return:
{
  "email": "a warm, short plain-text email from the tutor to the student: greeting by first name, 2-3 sentence recap, what they did well, the focus areas, next steps, an invitation to come back to the RWC. Sign it 'Your RWC tutor'.",
  "nextSteps": ["3-5 concrete actions the student does on their own, each starting with a verb"],
  "focusAreas": [{"skill": "a named writing skill", "why": "why it matters for this assignment, based on the notes", "miniLesson": "3-5 sentences explaining the skill, with one short example on a different topic than the student's paper"}],
  "aiPrompts": [{"prompt": "a prompt the student can paste into any AI tool so the AI coaches them (asks questions, quizzes, explains, or points out patterns) without rewriting their work. Use placeholders like [paste one paragraph] for the student's own text, and include 'Don't rewrite it for me.'", "whyItHelps": "one line"}],
  "dontAskAi": ["3 example requests to avoid, each followed by a short reason, e.g. 'Write my conclusion' — you lose the chance to practice the skill your professor is grading"]
}
Give 2-3 focusAreas and 4-6 aiPrompts tied to the focus areas.`;

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
    const body = (await req.json()) as { studentName?: string; course?: string; notes?: SessionNotes };
    const notes = body.notes ?? { workedOn: "", struggles: "", wentWell: "" };
    if (!notes.workedOn?.trim() && !notes.struggles?.trim()) {
      throw new UserFacingError("Add at least what you worked on or what the student struggled with.");
    }
    const outputs = await askJson<SessionOutputs>({
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Student first name: ${body.studentName || "(not given)"}
Course / assignment: ${body.course || "(not given)"}
What we worked on: ${notes.workedOn}
What they struggled with: ${notes.struggles}
What went well: ${notes.wentWell}`,
        },
      ],
    });
    const info = getDb()
      .prepare("INSERT INTO sessions (student_name, course, notes, outputs) VALUES (?, ?, ?, ?)")
      .run(body.studentName ?? "", body.course ?? "", JSON.stringify(notes), JSON.stringify(outputs));
    return { id: Number(info.lastInsertRowid), outputs };
  });
}
