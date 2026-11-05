import { handle } from "@/lib/api";
import { ask, askJson, UserFacingError, type Msg } from "@/lib/claude";
import { SCENARIOS } from "@/lib/scenarios";
import { docCount, keywordSearch } from "@/lib/search";
import type { Feedback, QuizQuestion, Turn } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body =
  | { action: "roleplay"; scenario: string; turns: Turn[] }
  | { action: "feedback"; scenario: string; turns: Turn[] }
  | { action: "quiz"; topic: string };

function scenarioBrief(id: string) {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new UserFacingError("Pick a scenario.");
  return s.brief;
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json()) as Body;

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
        system: `You are an experienced writing-center trainer giving feedback to a tutor after a practice role-play. Judge it against writing-center practice: build rapport, set an agenda, higher-order concerns first, ask open non-directive questions, the student keeps ownership and the pen, check understanding, end with next steps. Quote short moments from the transcript. Be kind and specific. Name what went well first. Then give exactly ONE thing to try next time, with an example line the tutor could say. Do not list mistakes. Return {"worked": ["2-4 points"], "missed": [], "tryNext": ["the one thing to try"]}.\n\nScenario: ${scenarioBrief(body.scenario)}`,
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
      const { questions } = await askJson<{ questions: QuizQuestion[] }>({
        system: `Write a 5-question multiple-choice refresher quiz for a college writing-center tutor on the topic below. Mix knowledge and "what would you do" tutoring situations. Each question has 4 choices; "answer" is the 0-based index of the correct choice; "why" explains it in 1-2 sentences. Return {"questions": [...]}.${context ? `\n\nWhere it fits, use the center's own material:\n${context}` : ""}`,
        messages: [{ role: "user", content: `Topic: ${body.topic}` }],
      });
      return { questions };
    }

    throw new UserFacingError("Unknown action.");
  });
}
