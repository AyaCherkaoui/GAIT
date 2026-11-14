import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

/** An error whose message is safe and useful to show in the UI. */
export class UserFacingError extends Error {}
/** A UserFacingError that the API returns as HTTP 404. */
export class NotFoundError extends UserFacingError {}

/**
 * Which AI backend to use. GAIT_PROVIDER = ollama (default, free, local) | grok | anthropic.
 * grok uses the OpenAI-compatible chat endpoint (ollama uses its own), so a paid API can be swapped in later
 * by changing .env.local only.
 */
const PROVIDER = (process.env.GAIT_PROVIDER || "ollama").toLowerCase();
const DEFAULT_MODELS: Record<string, { smart: string; fast: string }> = {
  anthropic: { smart: "claude-sonnet-5-5", fast: "claude-haiku-5-5" },
  ollama: { smart: "llama3.1:8b", fast: "llama3.1:8b" },
  grok: { smart: "grok-4", fast: "grok-4-fast" },
};
const MODELS = {
  smart: process.env.GAIT_MODEL_SMART || DEFAULT_MODELS[PROVIDER]?.smart || DEFAULT_MODELS.ollama.smart,
  fast: process.env.GAIT_MODEL_FAST || DEFAULT_MODELS[PROVIDER]?.fast || DEFAULT_MODELS.ollama.fast,
};

/** Ollama's own chat endpoint: lets us raise the context window and force valid JSON. */
async function askOllama(opts: AskOpts, system: string): Promise<string> {
  const base = (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODELS[opts.model ?? "smart"],
        stream: false,
        keep_alive: "30m",
        ...(opts.json ? { format: "json" } : {}),
        options: { num_ctx: 8192, num_predict: opts.maxTokens ?? 4000 },
        messages: [{ role: "system", content: system }, ...opts.messages],
      }),
    });
  } catch {
    throw new UserFacingError("Could not reach Ollama. Is it running (ollama serve)?");
  }
  if (!res.ok) throw new UserFacingError(`Ollama returned an error (${res.status}). ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}

async function askOpenAICompatible(opts: AskOpts, system: string): Promise<string> {
  const isGrok = PROVIDER === "grok";
  const base = (process.env.GAIT_API_BASE || (isGrok ? "https://api.x.ai/v1" : "http://localhost:11434/v1")).replace(/\/$/, "");
  const key = isGrok ? process.env.XAI_API_KEY : process.env.OLLAMA_API_KEY || "ollama";
  if (!key) throw new UserFacingError("Add XAI_API_KEY to .env.local, then restart npm run dev.");
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODELS[opts.model ?? "smart"],
        max_tokens: opts.maxTokens ?? 4000,
        messages: [{ role: "system", content: system }, ...opts.messages],
      }),
    });
  } catch {
    throw new UserFacingError(isGrok ? "Could not reach the Grok API." : "Could not reach Ollama. Is it running (ollama serve)?");
  }
  if (!res.ok) throw new UserFacingError(`The AI service returned an error (${res.status}). ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

let rules: string | undefined;
function coachingRules() {
  rules ??= fs.readFileSync(path.join(process.cwd(), "lib/prompts/coaching-rules.md"), "utf8");
  return rules;
}

export type Msg = { role: "user" | "assistant"; content: string };
type AskOpts = { system: string; messages: Msg[]; model?: "smart" | "fast"; maxTokens?: number; json?: boolean };

export async function ask(opts: AskOpts): Promise<string> {
  const system = `${coachingRules()}\n\n${opts.system}`;
  if (PROVIDER === "ollama") return askOllama(opts, system);
  if (PROVIDER === "grok") return askOpenAICompatible(opts, system);
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

function parseJsonObject<T>(text: string): T | null {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export async function askJson<T>(opts: AskOpts): Promise<T> {
  const system = `${opts.system}\n\nReply with one JSON object only: no prose, no code fences.`;
  // Smaller local models sometimes return broken JSON, so try twice before giving up.
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await ask({ ...opts, json: true, system });
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      return JSON.parse(text.slice(start, end + 1)) as T;
    } catch {
      /* try again */
    }
  }
  throw new UserFacingError("The AI reply was not in the expected format. Try again.");
}
