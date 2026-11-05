import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

/** An error whose message is safe and useful to show in the UI. */
export class UserFacingError extends Error {}

export type ProviderId = "anthropic" | "groq" | "gemini" | "openrouter" | "xai" | "ollama";

type Preset = {
  label: string;
  /** OpenAI-compatible base URL. Absent for the Anthropic SDK path. */
  baseUrl?: string;
  keyEnv?: string;
  smart: string;
  fast: string;
  /** Ask for JSON mode in askJson. */
  json?: boolean;
};

/** Order matters: with no GAIT_PROVIDER, the first preset with a key wins, then Ollama if it is running. */
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
  xai: {
    label: "xAI",
    baseUrl: "https://api.x.ai/v1",
    keyEnv: "XAI_API_KEY",
    smart: "grok-4.7",
    fast: "grok-4.3",
    json: true,
  },
  ollama: {
    label: "Ollama",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
    smart: "llama3.1:8b",
    fast: "llama3.1:8b",
    json: true,
  },
};

const AUTO_ORDER: ProviderId[] = ["anthropic", "groq", "gemini", "openrouter", "xai"];

const NO_KEY =
  "No AI provider is set up. For a free start, add GROQ_API_KEY (console.groq.com) or run Ollama and set GAIT_PROVIDER=ollama in .env.local, then restart npm run dev.";

const hasKey = (id: ProviderId) => {
  const env = PRESETS[id].keyEnv;
  return env ? !!process.env[env] : true;
};

/** The provider chosen by GAIT_PROVIDER or by which key is set. Ollama is only picked automatically by `resolveProvider`. */
function configuredProvider(): ProviderId | null {
  const chosen = process.env.GAIT_PROVIDER?.trim().toLowerCase();
  if (chosen) {
    if (!(chosen in PRESETS))
      throw new UserFacingError(
        `GAIT_PROVIDER "${chosen}" is not known. Use one of: ${Object.keys(PRESETS).join(", ")}.`,
      );
    return chosen as ProviderId;
  }
  return AUTO_ORDER.find(hasKey) ?? null;
}

let ollamaProbe: { at: number; up: boolean } | undefined;
async function ollamaUp(): Promise<boolean> {
  if (ollamaProbe && Date.now() - ollamaProbe.at < 10_000) return ollamaProbe.up;
  let up = false;
  try {
    const res = await fetch(`${PRESETS.ollama.baseUrl}/models`, { signal: AbortSignal.timeout(1000) });
    up = res.ok;
  } catch {}
  ollamaProbe = { at: Date.now(), up };
  return up;
}

async function resolveProvider(): Promise<ProviderId | null> {
  const p = configuredProvider();
  if (p) return p;
  return (await ollamaUp()) ? "ollama" : null;
}

/** True when a provider is configured by name or key (Ollama counts only when GAIT_PROVIDER=ollama). */
export function hasModel(): boolean {
  try {
    const p = configuredProvider();
    return p !== null && hasKey(p);
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
  let p: ProviderId | null;
  try {
    p = await resolveProvider();
  } catch (e) {
    return { provider: null, note: e instanceof Error ? e.message : "Provider error." };
  }
  if (!p) return { provider: null, note: "No AI provider set up." };
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
      signal: AbortSignal.timeout(id === "ollama" ? 300_000 : 120_000),
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
    if (wantJson && res.status === 400 && id !== "ollama") res = await send(false);
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"))
      throw new UserFacingError(`${preset.label} took too long to answer. Try again, or pick a smaller model.`);
    if (id === "ollama")
      throw new UserFacingError("Ollama is not running. Start it with `ollama serve` (or open the Ollama app), then try again.");
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
    if (res.status === 404 && id === "ollama")
      throw new UserFacingError(`Ollama does not have the model "${model}". Run \`ollama pull ${model}\` and try again.`);
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
  const p = await resolveProvider();
  if (!p) throw new UserFacingError(NO_KEY);
  const preset = PRESETS[p];
  if (!hasKey(p)) throw new UserFacingError(`Add ${preset.keyEnv} to .env.local, then restart npm run dev.`);
  return p === "anthropic" ? askAnthropic(opts) : askCompat(p, opts);
}

export async function ask(opts: AskOpts): Promise<string> {
  return run(opts);
}

export async function askJson<T>(opts: AskOpts): Promise<T> {
  const text = stripThink(
    await run({
      ...opts,
      json: true,
      system: `${opts.system}\n\nReply with one JSON object only: no prose, no code fences.`,
    }),
  );
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new UserFacingError("The AI reply was not in the expected format. Try again.");
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    throw new UserFacingError("The AI reply was not in the expected format. Try again.");
  }
}
