import { handle, readJson, str } from "@/lib/api";
import { ask, UserFacingError } from "@/lib/claude";

export const dynamic = "force-dynamic";

/** POST /api/news/try {title, summary}: one concrete coaching move a tutor can try with a student. Nothing is saved. */
export async function POST(req: Request) {
  return handle(
    req,
    async () => {
      const body = await readJson(req, 10_000);
      const title = str(body.title, 300).trim();
      const summary = str(body.summary, 1000).trim();
      if (!title) throw new UserFacingError("Pick an article first.");
      const move = await ask({
        model: "smart",
        maxTokens: 300,
        system:
          "You help a writing-center tutor. From an article's title and short summary, suggest ONE concrete coaching move the tutor can try with a student in their next session: what to say or ask and what the student then does, in 2-3 plain sentences. Use only what the title and summary say; do not claim to know more of the article. The student holds the pen: never write or rewrite the student's text. No lists, no headings.",
        messages: [{ role: "user", content: `Title: ${title}\nSummary: ${summary || "(none)"}` }],
      });
      return { move: move.trim() };
    },
    { ai: true },
  );
}
