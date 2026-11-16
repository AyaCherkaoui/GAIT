import { handle, readJson } from "@/lib/api";
import { ask, UserFacingError, type Msg } from "@/lib/claude";

export const dynamic = "force-dynamic";

const MAX_TURNS = 12;
const MAX_CHARS = 2000;

/** A student asks about their writing process; the AI answers as a coach with questions back. Nothing is stored. */
export async function POST(req: Request) {
  return handle(
    req,
    async () => {
      const raw = (await readJson(req)).messages;
      if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_TURNS) throw new UserFacingError("Type what you would like help with.");
      const messages: Msg[] = raw.map((m) => {
        const turn = m as { role?: unknown; content?: unknown };
        if ((turn.role !== "user" && turn.role !== "assistant") || typeof turn.content !== "string" || turn.content.length > MAX_CHARS) {
          throw new UserFacingError("The request was not valid.");
        }
        return { role: turn.role, content: turn.content };
      });
      if (messages[0].role !== "user" || messages.at(-1)?.role !== "user" || !messages.at(-1)!.content.trim()) throw new UserFacingError("Type what you would like help with.");
      const answer = await ask({
        model: "fast",
        maxTokens: 600,
        system:
          "You are a writing coach for students at a college Reading/Writing Center. The student asks about their writing process: getting started, planning, revising, using AI well. Answer in plain, warm text of at most 150 words. Give one or two concrete tips, then end with two questions that make the student think about their own paper. Never write, rewrite or fix the student's sentences or paragraphs, and never give text they could paste into an assignment. If they ask you to write for them, say kindly that you won't and offer a coaching step instead.",
        messages,
      });
      return { answer: answer.trim() };
    },
    { ai: true, tutee: true },
  );
}
