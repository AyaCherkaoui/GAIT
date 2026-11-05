import { handle } from "@/lib/api";
import { askJson, UserFacingError } from "@/lib/claude";
import { TALK_SCENARIOS, onlyQuestions } from "@/lib/ai-talk";
import { logUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";

type Body =
  | { action: "tailor"; scenario: string; context?: string }
  | { action: "ownership"; text: string; discipline?: string; voice?: boolean }
  | { action: "used" };

export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json()) as Body;

    if (body.action === "used") {
      logUsage("script");
      return { ok: true };
    }

    if (body.action === "tailor") {
      const s = TALK_SCENARIOS.find((x) => x.id === body.scenario);
      if (!s) throw new UserFacingError("Pick a situation.");
      const r = await askJson<{ openers: string[]; steps: string[] }>({
        model: "fast",
        maxTokens: 1200,
        system: `You help a writing-center tutor talk with a student about AI. Adapt the wording to the tutor's context. Stay curious and non-accusing; never say or imply the student cheated or that a text was written by AI; never judge authorship. Return {"openers": ["3 things the tutor could say, in plain spoken language"], "steps": ["2-4 short next moves that steer back to coaching the student's own thinking"]}.\n\nSituation: ${s.label}\nStarting points: ${s.openers.join(" | ")}`,
        messages: [{ role: "user", content: body.context?.trim() || "(no extra context)" }],
      });
      logUsage("script");
      return { openers: r.openers ?? [], steps: r.steps ?? [] };
    }

    if (body.action === "ownership") {
      if (!body.text?.trim()) throw new UserFacingError("Paste a paragraph first.");
      // The pasted text goes to the model for this one reply and is never stored.
      const r = await askJson<{ questions: string[] }>({
        model: "fast",
        maxTokens: 800,
        system: `You help a writing-center tutor ask a writer about their own paragraph. Write 3-5 questions that make the writer explain their claim, their evidence, and their word choices in their own words${body.discipline?.trim() ? `, fitting the discipline: ${body.discipline.trim()}` : ""}. Rules: output questions only, each ending with a question mark. Never rewrite, paraphrase, or suggest text. Never say or hint whether the text was written by a person or an AI. Quote at most a few words of the paragraph per question.${body.voice ? " Voice-first mode is on: treat the writer's phrasing and dialect as choices to ask about, not errors." : ""} Return {"questions": [...]}.`,
        messages: [{ role: "user", content: body.text.slice(0, 6000) }],
      });
      const questions = onlyQuestions(r.questions);
      if (questions.length === 0) throw new UserFacingError("No usable questions came back. Try again.");
      logUsage("ownership");
      return { questions };
    }

    throw new UserFacingError("Unknown action.");
  });
}
