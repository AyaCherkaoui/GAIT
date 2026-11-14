import { handle, readJson, str } from "@/lib/api";
import { ask, askJson, UserFacingError, type Msg } from "@/lib/claude";
import { SCENARIOS } from "@/lib/scenarios";
import { getDb } from "@/lib/db";
import { docCount, keywordSearch } from "@/lib/search";
import type { Feedback, QuizQuestion, Turn } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body =
  | { action: "roleplay"; scenario: string; turns: Turn[] }
  | { action: "feedback"; scenario: string; turns: Turn[] }
  | { action: "quiz"; topic: string }
  | { action: "saveQuiz"; topic: string; score: number; total: number };

/** A question is valid when it has text, exactly 4 non-empty choices, an answer 0-3 and an explanation. */
function validQuestion(q: Partial<QuizQuestion> | undefined): q is QuizQuestion {
  return (
    !!q &&
    typeof q.q === "string" && q.q.trim() !== "" &&
    Array.isArray(q.choices) && q.choices.length === 4 && q.choices.every((c) => typeof c === "string" && c.trim() !== "") &&
    Number.isInteger(q.answer) && (q.answer as number) >= 0 && (q.answer as number) <= 3 &&
    typeof q.why === "string" && q.why.trim() !== ""
  );
}

function scenarioBrief(id: string) {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new UserFacingError("Pick a scenario.");
  return s.brief;
}

export async function POST(req: Request) {
  return handle(req, async (user) => {
    const raw = await readJson(req);
    const action = str(raw.action, 20);
    if (!["roleplay", "feedback", "quiz", "saveQuiz"].includes(action)) throw new UserFacingError("Unknown action.");
    const turns: Turn[] = [];
    if (raw.turns !== undefined) {
      if (!Array.isArray(raw.turns) || raw.turns.length > 40) throw new UserFacingError("The request was not valid.");
      for (const t of raw.turns as Record<string, unknown>[]) {
        if (!t || (t.role !== "student" && t.role !== "tutor")) throw new UserFacingError("The request was not valid.");
        turns.push({ role: t.role, text: str(t.text, 2000) });
      }
    }
    const body = { ...raw, action, turns, scenario: str(raw.scenario, 100), topic: str(raw.topic, 200) } as Body;

    if (body.action === "roleplay") {
      const messages: Msg[] = [
        { role: "user", content: "(The tutoring session starts. Open as the student in 1-3 sentences.)" },
        ...body.turns.map((t): Msg => ({ role: t.role === "student" ? "assistant" : "user", content: t.text })),
      ];
      const reply = await ask({
        model: "fast",
        maxTokens: 400,
        system: `This is a practice role-play for a tutor in training. You play the STUDENT, not a tutor. Stay in character; reply in 1-4 sentences like a real college student would. Be realistic: don't make it too easy, but respond to good tutoring moves by opening up. Never break character or give the tutor advice.\n\nYour character: ${scenarioBrief(body.scenario)}`,
        messages,
      });
      return { reply: reply.trim() };
    }

    if (body.action === "feedback") {
      const transcript = body.turns.map((t) => `${t.role.toUpperCase()}: ${t.text}`).join("\n");
      const feedback = await askJson<Feedback>({
        system: `You are an experienced writing-center trainer giving feedback to a tutor after a practice role-play. Judge it against writing-center practice: build rapport, set an agenda, higher-order concerns first, ask open non-directive questions, the student keeps ownership and the pen, check understanding, end with next steps. Quote short moments from the transcript. Return JSON with the keys "worked", "missed" and "tryNext", each an array of short strings written about THIS transcript (worked: 2-4 things the tutor did well; missed: 2-4 things they missed; tryNext: 2 concrete things to try, each with an example line the tutor could say). Do not copy these instructions into the answer.\n\nScenario: ${scenarioBrief(body.scenario)}`,
        messages: [{ role: "user", content: transcript || "(The tutor ended without saying anything.)" }],
      });
      return { feedback };
    }

    if (body.action === "quiz") {
      if (!body.topic) throw new UserFacingError("Pick a topic.");
      const context =
        docCount() > 0
          ? keywordSearch([body.topic], 5).map((h) => `From "${h.name}": ${h.snippet}`).join("\n")
          : "";
      // Keep only valid questions; ask again for the missing ones, up to 2 more times.
      const questions: QuizQuestion[] = [];
      for (let attempt = 0; attempt < 3 && questions.length < 5; attempt++) {
        const need = 5 - questions.length;
        const have = questions.length ? `\n\nDo not repeat these questions:\n${questions.map((x) => x.q).join("\n")}` : "";
        const r = await askJson<{ questions: Partial<QuizQuestion>[] }>({
          system: `Write a ${need}-question multiple-choice refresher quiz for a college writing-center tutor on the topic below. Mix knowledge and "what would you do" tutoring situations. Each question has 4 choices; "answer" is the 0-based index of the correct choice; "why" explains it in 1-2 sentences. Return exactly this shape: {"questions": [{"q": "the question", "choices": ["choice 1", "choice 2", "choice 3", "choice 4"], "answer": 0, "why": "the explanation"}]} with ${need} items.${context ? `\n\nWhere it fits, use the center's own material:\n${context}` : ""}${have}`,
          messages: [{ role: "user", content: `Topic: ${body.topic}` }],
        }).catch(() => ({ questions: [] }));
        const got = Array.isArray(r?.questions) ? r.questions : [];
        for (const q of got) {
          if (questions.length < 5 && validQuestion(q) && !questions.some((x) => x.q === q.q)) questions.push(q);
        }
      }
      if (questions.length < 5) throw new UserFacingError("The quiz could not be built this time. Please try again.");
      return { questions };
    }

    if (body.action === "saveQuiz") {
      const { topic, score, total } = body;
      if (typeof topic !== "string" || !topic.trim() || topic.length > 200) throw new UserFacingError("Pick a topic.");
      if (!Number.isInteger(score) || !Number.isInteger(total) || total < 1 || score < 0 || score > total) {
        throw new UserFacingError("That quiz score does not look right.");
      }
      getDb().prepare("INSERT INTO quiz_results (score, total, topic, user_id) VALUES (?, ?, ?, ?)").run(score, total, topic, user.id);
      return { saved: true };
    }

    throw new UserFacingError("Unknown action.");
  }, { ai: true });
}
