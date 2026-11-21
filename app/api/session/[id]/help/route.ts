import { handle, readJson, str } from "@/lib/api";
import { ask, NotFoundError, UserFacingError } from "@/lib/claude";
import { getSession } from "@/lib/sessions";
import { getSessionType } from "@/lib/session-types";

export const dynamic = "force-dynamic";

/** Coaching for the tutor about this session: "how could I have helped this student better?" */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, async (user) => {
    const session = getSession(Number((await params).id), user.id);
    if (!session) throw new NotFoundError("Session not found.");
    const question = str((await readJson(req)).question, 2000);
    if (!question.trim()) throw new UserFacingError("Type what you would like help with.");
    const n = session.notes;
    const answer = await ask({
      model: "fast",
      maxTokens: 700,
      system:
        "You are a writing-center trainer coaching a tutor about one of their own past sessions. Answer in plain text, at most 200 words, with 2-4 concrete tutoring moves (for example open questions to ask, or how to hand the pen back to the student). The tutor does the thinking: suggest approaches, never write the student's work." + (getSessionType(session.session_type) ? ` Context: ${getSessionType(session.session_type)!.helpHint}` : ""),
      messages: [
        {
          role: "user",
          content: `Session notes. Course: ${session.course || "(not given)"}. Worked on: ${n.workedOn}. Struggled with: ${n.struggles}. Went well: ${n.wentWell}.${
            session.reflection ? ` The tutor's reflection: wants to improve ${session.reflection.wantToImprove}; goal next time ${session.reflection.goalNextTime}.` : ""
          }\n\nThe tutor asks: ${question.trim()}`,
        },
      ],
    });
    return { answer: answer.trim() };
  }, { ai: true });
}
