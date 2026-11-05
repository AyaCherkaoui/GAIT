import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

/** An error whose message is safe and useful to show in the UI. */
export class UserFacingError extends Error {}

const MODELS = {
  smart: process.env.GAIT_MODEL_SMART || "claude-sonnet-5-5",
  fast: process.env.GAIT_MODEL_FAST || "claude-haiku-5-5",
};

let rules: string | undefined;
function coachingRules() {
  rules ??= fs.readFileSync(path.join(process.cwd(), "lib/prompts/coaching-rules.md"), "utf8");
  return rules;
}

export type Msg = { role: "user" | "assistant"; content: string };
type AskOpts = { system: string; messages: Msg[]; model?: "smart" | "fast"; maxTokens?: number };

export async function ask(opts: AskOpts): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new UserFacingError("Add ANTHROPIC_API_KEY to .env.local, then restart npm run dev.");
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODELS[opts.model ?? "smart"],
    max_tokens: opts.maxTokens ?? 4000,
    system: [
      { type: "text", text: coachingRules(), cache_control: { type: "ephemeral" } },
      { type: "text", text: opts.system },
    ],
    messages: opts.messages,
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

export async function askJson<T>(opts: AskOpts): Promise<T> {
  const text = await ask({ ...opts, system: `${opts.system}\n\nReply with one JSON object only: no prose, no code fences.` });
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new UserFacingError("The AI reply was not in the expected format. Try again.");
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    throw new UserFacingError("The AI reply was not in the expected format. Try again.");
  }
}
