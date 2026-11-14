# GAIT

GAIT is an assistant for tutors at the Augustana College Reading/Writing Center (RWC).
Its goal: help tutors grow students into independent writers who use AI as a coach, never as a ghostwriter, and help tutors keep improving.

This is v0, a rough first draft that runs on one computer. Tutors sign in with Google; there is no hosting and no session recording.

## What it does
- **After session** (`/session`): the tutor's notes become an email draft, printable next steps (`/session/<id>/print`), and AI prompts the student can use that coach rather than write.
- **ARIA search** (`/search`): searches the ARIA Google Drive folder. Claude turns the question into keywords, SQLite full-text search finds candidates, and Claude picks the best 5.
- **Task force** (`/taskforce`): turns a task into steps, an outline, questions, and related ARIA files.
- **Practice** (`/practice`): role-play a tricky student (including AI-era scenarios) with feedback afterwards, or take a 5-question refresher quiz.
- **Talking about AI** (`/ai-talk`): a fixed script bank for conversations about AI (works with no key; a key lets the model tailor the wording), and ownership questions: paste a paragraph, get questions only. Pasted text is not stored.
- **Course AI policies** (`/policies`): each tutor saves what each course allows (kept per tutor). `/session` looks the policy up from the course code.
- **Debrief** (`/debrief`): a private 1-5 drain rating after a shift, with a weekly view. Only that tutor sees it; never exported.
- **Voice-first** (`/voice`): explainer on detector bias. The mode is a toggle kept in localStorage and sent with session and ownership requests.
- **Impact** (`/impact`): weekly counts with CSV export. A tutor sees their own; the director sees everyone's.

## Setup
1. Node 22.5 or newer (uses the built-in `node:sqlite`).
2. `npm install`
3. `cp .env.example .env.local` and fill in:
   - A model provider (`GAIT_PROVIDER`, default `ollama`): see "Model providers" below. Free options need no card.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: in Google Cloud Console, enable the Google Drive API, then create an OAuth client of type **Desktop app**.
   - `ARIA_FOLDER_ID`: the last part of the ARIA folder's Drive URL.
   - `AUTH_SECRET`: at least 32 random characters that sign the login cookie (`openssl rand -base64 32`). The app refuses requests without it.
   - `APP_URL`: where you open the app (default `http://localhost:3100`). In Google Cloud Console add `<APP_URL>/api/auth/callback` as an authorized redirect URI of the same OAuth client. If Google refuses a Desktop-type client for this redirect, create a Web application client instead.
   - `ALLOWED_EMAIL_DOMAIN` (optional): only this email domain may sign in, for example `augustana.edu`. Empty means any Google account.
   - `DIRECTOR_EMAIL`: the director's email. It is always an active director, so the director can never be locked out. The director opens Admin in the nav (`/admin/tutors`) to add tutors and deactivate them. Only people on that list can sign in, and deactivating someone ends their access on their next request.
4. `npm run sync-aria`: the first run opens a Google sign-in (read-only Drive access) and saves the token to `.google-token.json`. Re-run it whenever ARIA changes.
5. `npm run dev -- -p 3100` and open http://localhost:3100 (the port must match `APP_URL`). You sign in with Google first.

## Model providers
`GAIT_PROVIDER` picks one. With none set, the default is `ollama` (a local server; `OLLAMA_HOST` changes where, default `http://localhost:11434`, and it is called on its native `/api/chat`). `xai` is accepted as another name for `grok`. `GAIT_MODEL_SMART` / `GAIT_MODEL_FAST` override the models. Groq, Gemini, OpenRouter and Grok go through one OpenAI-compatible client; `askJson` asks for JSON mode and retries without it if a model rejects it.

| Preset | Key | Smart / fast default | Notes |
| --- | --- | --- | --- |
| `groq` | `GROQ_API_KEY` | `openai/gpt-oss-120b` / `openai/gpt-oss-20b` | Free tier, no card. |
| `ollama` | none | `llama3.1:8b` / `llama3.1:8b` | Local and private; nothing leaves the computer. |
| `gemini` | `GEMINI_API_KEY` | `gemini-3.8-flash` / `gemini-3.5-flash-lite` | Free tier, but Google may use free-tier content to improve its products: no real student text. |
| `openrouter` | `OPENROUTER_API_KEY` | `google/gemma-4-31b-it:free` / `google/gemma-4-26b-a4b-it:free` | Free models are rate limited and change often. |
| `grok` (or `xai`) | `XAI_API_KEY` | `grok-4.7` / `grok-4.3` | Paid. |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-5-5` / `claude-haiku-5-5` | Production target. |

Model ids were checked on 2026-11-05 (Groq and Gemini docs, OpenRouter's public model list). Free tiers change; if a call says a model is unknown, set the overrides.

### Free testing (ranked)
1. **Groq**: get a key at https://console.groq.com/keys, put `GROQ_API_KEY=...` in `.env.local`.
2. **Ollama**: install from https://ollama.com, run `ollama pull llama3.1:8b`, it is the default. Best for privacy; slower on a laptop.
3. **Gemini**: key at https://aistudio.google.com/apikey, set `GEMINI_API_KEY` (mind the data note above).

For Ollama, long prompts need a context window of at least 8k tokens; if replies look cut off, start the server with `OLLAMA_CONTEXT_LENGTH=8192 ollama serve`.

## Checks
- `npm run typecheck`
- `npm run build`
- `npm run security-check`: starts a private server on port 3101 with a throwaway database and probes sign-in, headers, size limits and rate limits (no AI calls).
- `npm run feature-check`: starts a private server on port 3102 (it can run beside `npm run dev`) with a stand-in AI server, checks the session help route and the search fallback, then opens every page at 390px and 1280px in Chrome and fails on sideways scroll, a non-200 status or an error overlay. Screenshots go to `.feature-shots/`. Needs Google Chrome installed, or set `CHROME_PATH`.

## Layout
- `app/`: pages and API routes (`app/api/*/route.ts`). Pages: `/`, `/session`, `/session/[id]` (reflection and coaching help), `/history`, `/search`, `/taskforce`, `/practice`, `/ai-talk`, `/policies`, `/debrief`, `/voice`, `/impact`, `/reading`.
- `app/api/session/[id]/reflection` (PUT) saves a tutor's reflection; `.../help` (POST) coaches the tutor on that session; `app/api/practice/results` lists quiz scores (saved with `action: "saveQuiz"`); `app/api/feed` serves the reading list.
- `lib/books.ts`: the curated book list. Article feeds (read in `app/api/feed`, 6 s timeout, cached 1 h): writing.wisc.edu/blog/feed and insidehighered.com/rss.xml.
- `components/ui.tsx`: shared UI (Card, PageHeader, ErrorBox, and `Working`, the loader every AI wait uses).
- `lib/claude.ts`: the only place that calls a model (`ask`, `askJson`, `hasModel`, `UserFacingError`). It always adds `lib/prompts/coaching-rules.md` to the system prompt. The nav shows the active provider and model (`/api/provider`).
- `lib/db.ts`: SQLite file `gait.db` (override the path with `GAIT_DB`; tables `users`, `sessions`, `tasks`, `quiz_results`, `course_policies`, `debriefs`, `usage_events`, and the full-text index `aria_docs`). Sessions, tasks, quiz results, course policies, debriefs and usage events belong to one user; rows from before sign-in existed have no owner and are hidden from everyone.
- `proxy.ts`: first gate (login required except `/login` and `/api/auth/*`) and security headers. `lib/auth.ts` and `lib/session-token.ts`: Google sign-in and the signed session cookie. `lib/api.ts`: `handle(req, fn)` wraps every API route (401 when signed out, size-checked JSON body, rate limit on AI routes, no internal error text).
- `lib/search.ts`: ARIA search.
- `scripts/sync-aria.ts`: the Drive indexer.

## Conventions
- Anything a student sees must coach and never write their work. Change behaviour in `lib/prompts/coaching-rules.md`, not in scattered prompts.
- The repo is public: never commit `.env.local`, `gait.db`, `.google-token.json`, or student data.
- Session notes gain `courseCode`, `aiPolicy`, `aiUse` and `privateConcern`. `privateConcern` is shown only in the tutor view and never reaches the email, next steps, print page or student outputs.
- No AI detector, no authorship verdicts, no rewrite or "humanize" feature, no session recording, no tutor monitoring (see `lib/prompts/coaching-rules.md`).
- Models are set by `GAIT_MODEL_SMART` and `GAIT_MODEL_FAST`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
