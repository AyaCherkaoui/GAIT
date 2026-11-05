import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

/** An error whose message is safe and useful to show in the UI. */
export class UserFacingError extends Error {}

type Provider = "xai" | "anthropic";

const NO_KEY = "Add XAI_API_KEY (or ANTHROPIC_API_KEY) to .env.local, then restart npm run dev.";

function provider(): Provider | null {
  const chosen = process.env.GAIT_PROVIDER?.toLowerCase();
  if (chosen === "xai" || chosen === "anthropic") {
    const key = chosen === "xai" ? process.env.XAI_API_KEY : process.env.ANTHROPIC_API_KEY;
    return key ? chosen : null;
  }
  if (process.env.XAI_API_KEY) return "xai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

/** True when a model key is configured. */
export function hasModel(): boolean {
  return provider() !== null;
}

function modelName(p: Provider, tier: "smart" | "fast") {
  if (tier === "smart") return process.env.GAIT_MODEL_SMART || (p === "xai" ? "grok-4.7" : "claude-sonnet-5-5");
  return process.env.GAIT_MODEL_FAST || (p === "xai" ? "grok-4.3" : "claude-haiku-5-5");
}

let rules: string | undefined;
function coachingRules() {
  rules ??= fs.readFileSync(path.join(process.cwd(), "lib/prompts/coaching-rules.md"), "utf8");
  return rules;
}

export type Msg = { role: "user" | "assistant"; content: string };
type AskOpts = { system: string; messages: Msg[]; model?: "smart" | "fast"; maxTokens?: number };

async function askXai(opts: AskOpts): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${process.env.XAI_API_KEY}` },
      body: JSON.stringify({
        model: modelName("xai", opts.model ?? "smart"),
        max_tokens: opts.maxTokens ?? 4000,
        messages: [{ role: "system", content: `${coachingRules()}\n\n${opts.system}` }, ...opts.messages],
      }),
    });
  } catch {
    throw new UserFacingError("Could not reach xAI. Check your internet connection and try again.");
  }
  if (!res.ok) {
    let reason = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } | string };
      reason = typeof j.error === "string" ? j.error : j.error?.message ?? "";
    } catch {}
    reason = reason.slice(0, 200);
    if (res.status === 401) throw new UserFacingError("xAI rejected the key (401). Check XAI_API_KEY in .env.local.");
    if (res.status === 429 || res.status === 402)
      throw new UserFacingError(`xAI says you are out of credits or rate limited (${res.status}). Wait a bit or check your xAI account.`);
    throw new UserFacingError(`xAI returned an error (${res.status})${reason ? `: ${reason}` : ""}.`);
  }
  const json = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new UserFacingError("xAI sent an empty reply. Try again.");
  return text;
}

async function askAnthropic(opts: AskOpts): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const res = await client.messages.create({
      model: modelName("anthropic", opts.model ?? "smart"),
      max_tokens: opts.maxTokens ?? 4000,
      system: [
        { type: "text", text: coachingRules(), cache_control: { type: "ephemeral" } },
        { type: "text", text: opts.system },
      ],
      messages: opts.messages,
    });
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 401) throw new UserFacingError("Anthropic rejected the key (401). Check ANTHROPIC_API_KEY in .env.local.");
    if (status === 429 || status === 402)
      throw new UserFacingError(`Anthropic says you are out of credits or rate limited (${status}).`);
    throw e;
  }
}

export async function ask(opts: AskOpts): Promise<string> {
  const p = provider();
  if (!p) throw new UserFacingError(NO_KEY);
  return p === "xai" ? askXai(opts) : askAnthropic(opts);
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
