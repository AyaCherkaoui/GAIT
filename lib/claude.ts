import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

/** An error whose message is safe and useful to show in the UI. */
export class UserFacingError extends Error {}
/** A UserFacingError that the API returns as HTTP 404. */
export class NotFoundError extends UserFacingError {}

export type ProviderId = "anthropic" | "groq" | "gemini" | "openrouter" | "grok" | "ollama";

type Preset = {
  label: string;
  /** OpenAI-compatible base URL. Absent for the Anthropic SDK path and for Ollama (native /api/chat). */
  baseUrl?: string;
  keyEnv?: string;
  smart: string;
  fast: string;
  /** Ask for JSON mode in askJson. */
  json?: boolean;
};

const PRESETS: Record<ProviderId, Preset> = {
  anthropic: { label: "Anthropic", keyEnv: "ANTHROPIC_API_KEY", smart: "claude-sonnet-5-5", fast: "claude-haiku-5-5" },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    smart: "openai/gpt-oss-120b",
    fast: "openai/gpt-oss-20b",
    json: true,
  },
  gemini: {
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY",
    smart: "gemini-3.8-flash",
    fast: "gemini-3.5-flash-lite",
    json: true,
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY",
    smart: "google/gemma-4-31b-it:free",
    fast: "google/gemma-4-26b-a4b-it:free",
    json: true,
  },
  grok: {
    label: "Grok (xAI)",
    baseUrl: "https://api.x.ai/v1",
    keyEnv: "XAI_API_KEY",
    smart: "grok-4.7",
    fast: "grok-4.3",
    json: true,
  },
  ollama: {
    label: "Ollama",
    smart: "llama3.1:8b",
    fast: "llama3.1:8b",
  },
};

const hasKey = (id: ProviderId) => {
  const env = PRESETS[id].keyEnv;
  return env ? !!process.env[env] : true;
};

/** The provider chosen by GAIT_PROVIDER. With none set it is Ollama, running locally. "xai" is another name for "grok". */
function resolveProvider(): ProviderId {
  let chosen = (process.env.GAIT_PROVIDER?.trim() || "ollama").toLowerCase();
  if (chosen === "xai") chosen = "grok";
  if (!(chosen in PRESETS))
    throw new UserFacingError(`GAIT_PROVIDER "${chosen}" is not known. Use one of: ${Object.keys(PRESETS).join(", ")}, xai.`);
  return chosen as ProviderId;
}

/** True when the model runs on this machine (Ollama on a loopback host), so private notes never leave it. */
export function isLocalProvider(): boolean {
  try {
    if (resolveProvider() !== "ollama") return false;
    const host = new URL(process.env.OLLAMA_HOST || "http://localhost:11434").hostname;
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
  } catch {
    return false;
  }
}

/** True when the chosen provider is usable (has its key; Ollama needs none). */
export function hasModel(): boolean {
  try {
    return hasKey(resolveProvider());
  } catch {
    return false;
  }
}

function modelName(p: ProviderId, tier: "smart" | "fast") {
  const override = tier === "smart" ? process.env.GAIT_MODEL_SMART : process.env.GAIT_MODEL_FAST;
  return override || PRESETS[p][tier];
}

/** What the nav status line shows. Never throws; never contains a key. */
export async function providerStatus(): Promise<{ provider: string | null; label?: string; model?: string; note?: string }> {
  let p: ProviderId;
  try {
    p = resolveProvider();
  } catch (e) {
    return { provider: null, note: e instanceof Error ? e.message : "Provider error." };
  }
  if (!hasKey(p)) return { provider: p, label: PRESETS[p].label, note: `Missing ${PRESETS[p].keyEnv}.` };
  return { provider: p, label: PRESETS[p].label, model: modelName(p, "smart") };
}

let rules: string | undefined;
function coachingRules() {
  rules ??= fs.readFileSync(path.join(process.cwd(), "lib/prompts/coaching-rules.md"), "utf8");
  return rules;
}

export type Msg = { role: "user" | "assistant"; content: string };
type AskOpts = { system: string; messages: Msg[]; model?: "smart" | "fast"; maxTokens?: number };
type Internal = AskOpts & { json?: boolean };

/** Remove reasoning blocks some local models put before the answer. */
function stripThink(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*?<\/think>/i, "").trim();
}

async function readReason(res: Response) {
  try {
    const j = (await res.json()) as { error?: { message?: string } | string } | { error?: { message?: string } }[];
    const e = Array.isArray(j) ? j[0]?.error : j.error;
    return (typeof e === "string" ? e : e?.message ?? "").slice(0, 200);
  } catch {
    return "";
  }
}

/** Ollama's own chat endpoint: lets us raise the context window and force valid JSON. */
async function askOllama(opts: Internal): Promise<string> {
  const base = (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
  const model = modelName("ollama", opts.model ?? "smart");
  let res: Response;
  try {
    res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(300_000),
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: "30m",
        ...(opts.json ? { format: "json" } : {}),
        options: { num_ctx: 8192, num_predict: opts.maxTokens ?? 4000 },
        messages: [{ role: "system", content: `${coachingRules()}\n\n${opts.system}` }, ...opts.messages],
      }),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"))
      throw new UserFacingError("Ollama took too long to answer. Try again, or pick a smaller model.");
    throw new UserFacingError("Ollama is not running. Start it with `ollama serve` (or open the Ollama app), then try again.");
  }
  if (!res.ok) {
    if (res.status === 404) throw new UserFacingError(`Ollama does not have the model "${model}". Run \`ollama pull ${model}\` and try again.`);
    console.error(`Ollama error ${res.status}: ${(await readReason(res)).slice(0, 500)}`);
    throw new UserFacingError("The AI service had a problem. Please try again.");
  }
  const data = (await res.json().catch(() => null)) as { message?: { content?: string } } | null;
  const text = data?.message?.content;
  if (typeof text !== "string" || !stripThink(text)) throw new UserFacingError("Ollama sent an empty reply. Try again.");
  return stripThink(text);
}

async function askCompat(id: ProviderId, opts: Internal): Promise<string> {
  const preset = PRESETS[id];
  const tier = opts.model ?? "smart";
  const model = modelName(id, tier);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (preset.keyEnv) headers.Authorization = `Bearer ${process.env[preset.keyEnv]}`;

  const send = (withJson: boolean) =>
    fetch(`${preset.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 4000,
        messages: [{ role: "system", content: `${coachingRules()}\n\n${opts.system}` }, ...opts.messages],
        ...(withJson ? { response_format: { type: "json_object" } } : {}),
      }),
    });

  const wantJson = !!(opts.json && preset.json);
  let res: Response;
  try {
    res = await send(wantJson);
    // Some free models reject JSON mode; try once more without it (the prompt still asks for JSON).
    // Only when the 400 is about JSON mode, so a bad key or model id is not sent twice.
    if (wantJson && res.status === 400 && /response_format|json/i.test(await res.clone().text())) res = await send(false);
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"))
      throw new UserFacingError(`${preset.label} took too long to answer. Try again, or pick a smaller model.`);
    throw new UserFacingError(`Could not reach ${preset.label}. Check your internet connection and try again.`);
  }

  if (!res.ok) {
    const reason = await readReason(res);
    const keyName = preset.keyEnv ?? "the provider settings";
    if (res.status === 401 || res.status === 403 || (res.status === 400 && /api[ _-]?key/i.test(reason)))
      throw new UserFacingError(`${preset.label} rejected the key (${res.status === 400 ? 401 : res.status}). Check ${keyName} in .env.local.`);
    if (res.status === 429 || res.status === 402)
      throw new UserFacingError(
        `${preset.label} says you are out of credits or rate limited (${res.status}). Wait a minute and try again, or switch GAIT_PROVIDER.`,
      );
    if (res.status === 404)
      throw new UserFacingError(`${preset.label} does not know the model "${model}". Set GAIT_MODEL_SMART and GAIT_MODEL_FAST to a model it offers.`);
    throw new UserFacingError(`${preset.label} returned an error (${res.status})${reason ? `: ${reason}` : ""}.`);
  }
  const json = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !stripThink(text)) throw new UserFacingError(`${preset.label} sent an empty reply. Try again.`);
  return stripThink(text);
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

async function run(opts: Internal): Promise<string> {
  const p = resolveProvider();
  const preset = PRESETS[p];
  if (!hasKey(p)) throw new UserFacingError(`Add ${preset.keyEnv} to .env.local, then restart npm run dev.`);
  if (p === "anthropic") return askAnthropic(opts);
  return p === "ollama" ? askOllama(opts) : askCompat(p, opts);
}

export async function ask(opts: AskOpts): Promise<string> {
  return run(opts);
}

export async function askJson<T>(opts: AskOpts): Promise<T> {
  const system = `${opts.system}\n\nReply with one JSON object only: no prose, no code fences.`;
  // Smaller local models sometimes return broken JSON, so try twice before giving up.
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = stripThink(await run({ ...opts, json: true, system }));
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
