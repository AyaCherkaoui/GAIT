import { handle, readJson, str } from "@/lib/api";
import { askJson, UserFacingError } from "@/lib/claude";
import { TALK_SCENARIOS, onlyQuestions } from "@/lib/ai-talk";

export const dynamic = "force-dynamic";

const strings = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string" && !!v.trim()).slice(0, 6) : []);

export async function POST(req: Request) {
  return handle(req, async () => {
    const raw = await readJson(req);
    const action = str(raw.action, 20);
    const scenario = str(raw.scenario, 100);
    const context = str(raw.context, 2000);
    const text = str(raw.text, 6000);
    const discipline = str(raw.discipline, 200);

    if (action === "tailor") {
      const s = TALK_SCENARIOS.find((x) => x.id === scenario);
      if (!s) throw new UserFacingError("Pick a situation.");
      const r = await askJson<{ openers: string[]; steps: string[] }>({
        model: "fast",
        maxTokens: 1200,
        system: `You help a writing-center tutor talk with a student about AI. Adapt the wording to the tutor's context. Stay curious and non-accusing; never say or imply the student cheated or that a text was written by AI; never judge authorship. Return {"openers": ["3 things the tutor could say, in plain spoken language"], "steps": ["2-4 short next moves that steer back to coaching the student's own thinking"]}.\n\nSituation: ${s.label}\nStarting points: ${s.openers.join(" | ")}`,
        messages: [{ role: "user", content: context.trim() || "(no extra context)" }],
      });
      return { openers: strings(r.openers), steps: strings(r.steps) };
    }

    if (action === "ownership") {
      if (!text.trim()) throw new UserFacingError("Paste a paragraph first.");
      // The pasted text goes to the model for this one reply and is never stored.
      const r = await askJson<{ questions: string[] }>({
        model: "fast",
        maxTokens: 800,
        system: `You help a writing-center tutor ask a writer about their own paragraph. Write 3-5 questions that make the writer explain their claim, their evidence, and their word choices in their own words${discipline.trim() ? `, fitting the discipline: ${discipline.trim()}` : ""}. Rules: output questions only, each ending with a question mark. Never rewrite, paraphrase, or suggest text. Never say or hint whether the text was written by a person or an AI. Quote at most a few words of the paragraph per question. Return {"questions": [...]}.`,
        messages: [{ role: "user", content: text }],
      });
      const questions = onlyQuestions(r.questions);
      if (questions.length === 0) throw new UserFacingError("No usable questions came back. Try again.");
      return { questions };
    }

    throw new UserFacingError("Unknown action.");
  }, { ai: true });
}
