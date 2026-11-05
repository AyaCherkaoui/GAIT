# GAIT

GAIT is an assistant for tutors at the Augustana College Reading/Writing Center (RWC).
Its goal: help tutors grow students into independent writers who use AI as a coach, never as a ghostwriter, and help tutors keep improving.

This is v0, a rough first draft that runs on one computer. No logins, no hosting, no session recording.

## What it does
- **After session** (`/session`): the tutor's notes become an email draft, printable next steps (`/session/<id>/print`), and AI prompts the student can use that coach rather than write.
- **ARIA search** (`/search`): searches the ARIA Google Drive folder. Claude turns the question into keywords, SQLite full-text search finds candidates, and Claude picks the best 5.
- **Task force** (`/taskforce`): turns a task into steps, an outline, questions, and related ARIA files.
- **Practice** (`/practice`): role-play a tricky student (including AI-era scenarios) with feedback afterwards, or take a 5-question refresher quiz.
- **Talking about AI** (`/ai-talk`): a fixed script bank for conversations about AI (works with no key; a key lets the model tailor the wording), and ownership questions: paste a paragraph, get questions only. Pasted text is not stored.
- **Course AI policies** (`/policies`): tutors save what each course allows. `/session` looks the policy up from the course code.
- **Debrief** (`/debrief`): a private 1-5 drain rating after a shift, with a weekly view. Never exported.
- **Voice-first** (`/voice`): explainer on detector bias. The mode is a toggle kept in localStorage and sent with session and ownership requests.
- **Impact** (`/impact`): anonymous weekly counts with CSV export.

## Setup
1. Node 22.5 or newer (uses the built-in `node:sqlite`).
2. `npm install`
3. `cp .env.example .env.local` and fill in:
   - A model provider: see "Model providers" below. Free options need no card.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: in Google Cloud Console, enable the Google Drive API, then create an OAuth client of type **Desktop app**.
   - `ARIA_FOLDER_ID`: the last part of the ARIA folder's Drive URL.
4. `npm run sync-aria`: the first run opens a Google sign-in (read-only Drive access) and saves the token to `.google-token.json`. Re-run it whenever ARIA changes.
5. `npm run dev` and open http://localhost:3000

## Model providers
`GAIT_PROVIDER` picks one. With none set, the first preset with a key wins (anthropic, groq, gemini, openrouter, xai); with no key at all, a running local Ollama is used. `GAIT_MODEL_SMART` / `GAIT_MODEL_FAST` override the models. All but Anthropic go through one OpenAI-compatible client; `askJson` asks for JSON mode and retries without it if a model rejects it.

| Preset | Key | Smart / fast default | Notes |
| --- | --- | --- | --- |
| `groq` | `GROQ_API_KEY` | `openai/gpt-oss-120b` / `openai/gpt-oss-20b` | Free tier, no card. |
| `ollama` | none | `llama3.1:8b` / `llama3.1:8b` | Local and private; nothing leaves the computer. |
| `gemini` | `GEMINI_API_KEY` | `gemini-3.8-flash` / `gemini-3.5-flash-lite` | Free tier, but Google may use free-tier content to improve its products: no real student text. |
| `openrouter` | `OPENROUTER_API_KEY` | `google/gemma-4-31b-it:free` / `google/gemma-4-26b-a4b-it:free` | Free models are rate limited and change often. |
| `xai` | `XAI_API_KEY` | `grok-4.7` / `grok-4.3` | Paid. |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-5-5` / `claude-haiku-5-5` | Production target. |

Model ids were checked on 2026-11-05 (Groq and Gemini docs, OpenRouter's public model list). Free tiers change; if a call says a model is unknown, set the overrides.

### Free testing (ranked)
1. **Groq**: get a key at https://console.groq.com/keys, put `GROQ_API_KEY=...` in `.env.local`.
2. **Ollama**: install from https://ollama.com, run `ollama pull llama3.1:8b`, set `GAIT_PROVIDER=ollama`. Best for privacy; slower on a laptop.
3. **Gemini**: key at https://aistudio.google.com/apikey, set `GEMINI_API_KEY` (mind the data note above).

For Ollama, long prompts need a context window of at least 8k tokens; if replies look cut off, start the server with `OLLAMA_CONTEXT_LENGTH=8192 ollama serve`.

## Checks
- `npm run typecheck`
- `npm run build`

## Layout
- `app/`: pages and API routes (`app/api/*/route.ts`).
- `lib/claude.ts`: the only place that calls a model (`ask`, `askJson`, `hasModel`, `UserFacingError`). It always adds `lib/prompts/coaching-rules.md` to the system prompt. The nav shows the active provider and model (`/api/provider`).
- `lib/db.ts`: SQLite file `gait.db` (tables `sessions`, `tasks`, `course_policies`, `debriefs`, `usage_events`, and the full-text index `aria_docs`).
- `lib/search.ts`: ARIA search.
- `scripts/sync-aria.ts`: the Drive indexer.

## Conventions
- Anything a student sees must coach and never write their work. Change behaviour in `lib/prompts/coaching-rules.md`, not in scattered prompts.
- The repo is public: never commit `.env.local`, `gait.db`, `.google-token.json`, or student data.
- Session notes gain `courseCode`, `aiPolicy`, `aiUse` and `privateConcern`. `privateConcern` is shown only in the tutor view and never reaches the email, next steps, print page or student outputs.
- No AI detector, no authorship verdicts, no rewrite or "humanize" feature, no session recording, no tutor monitoring (see `lib/prompts/coaching-rules.md`).
- Models are set by `GAIT_MODEL_SMART` and `GAIT_MODEL_FAST`.
