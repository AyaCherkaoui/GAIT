import { handle } from "@/lib/api";
import { ask, UserFacingError } from "@/lib/claude";
import { getSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const SYSTEM = `You help a writing-center tutor write a short, neutral, factual note to the RWC director about a tutoring session. It is for the tutor only; the tutor decides whether to send it.
- Describe only what the tutor wrote: the course, what was worked on, the AI policy on file, any AI use that came up, and the tutor's private concern if there is one.
- Do not accuse anyone, do not say or imply the student cheated or that a text was written by AI, and do not guess. Say what was observed and what question the tutor has.
- End with one clear question or request for guidance.
- Plain text, under 200 words, signed "An RWC tutor". Do not include the student's full name; use the first name only.`;

/** Drafts a note for the tutor. The result is returned, never stored. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = getSession(Number((await params).id));
    if (!s) throw new UserFacingError("Session not found.");
    const n = s.notes;
    const note = await ask({
      model: "fast",
      maxTokens: 800,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Student first name: ${s.student_name || "(not given)"}
Course: ${n.courseCode || s.course || "(not given)"}
AI policy on file: ${n.aiPolicy ?? "unknown"}
What we worked on: ${n.workedOn}
What they struggled with: ${n.struggles}
AI use noted: ${n.aiUse?.trim() || "(none)"}
Tutor's private concern: ${n.privateConcern?.trim() || "(none)"}`,
        },
      ],
    });
    return { note: note.trim() };
  });
}
