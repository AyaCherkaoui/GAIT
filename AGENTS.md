# GAIT

GAIT is an assistant for tutors at the Augustana College Reading/Writing Center (RWC).
Its goal: help tutors grow students into independent writers who use AI as a coach, never as a ghostwriter, and help tutors keep improving.

This is v0, a rough first draft that runs on one computer. No logins, no hosting, no session recording.

## What it does
- **After session** (`/session`): the tutor's notes become an email draft, printable next steps (`/session/<id>/print`), and AI prompts the student can use that coach rather than write.
- **ARIA search** (`/search`): searches the ARIA Google Drive folder. Claude turns the question into keywords, SQLite full-text search finds candidates, and Claude picks the best 5.
- **Task force** (`/taskforce`): turns a task into steps, an outline, questions, and related ARIA files.
- **Practice** (`/practice`): role-play a tricky student with feedback afterwards, or take a 5-question refresher quiz.

## Setup
1. Node 22.5 or newer (uses the built-in `node:sqlite`).
2. `npm install`
3. `cp .env.example .env.local` and fill in:
   - `GAIT_PROVIDER`: `ollama` (default, free, local: install Ollama and `ollama pull llama3.1:8b`), `grok` (needs `XAI_API_KEY`) or `anthropic` (needs `ANTHROPIC_API_KEY`). Switching later only changes `.env.local`. Small models are slow and weaker: on a low-memory Mac use `GAIT_MODEL_SMART=llama3.2:3b`.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: in Google Cloud Console, enable the Google Drive API, then create an OAuth client of type **Desktop app**.
   - `ARIA_FOLDER_ID`: the last part of the ARIA folder's Drive URL.
4. `npm run sync-aria`: the first run opens a Google sign-in (read-only Drive access) and saves the token to `.google-token.json`. Re-run it whenever ARIA changes.
5. `npm run dev` and open http://localhost:3000

## Checks
- `npm run typecheck`
- `npm run build`

## Layout
- `app/`: pages and API routes (`app/api/*/route.ts`). Pages: `/`, `/session`, `/session/[id]` (reflection and coaching help), `/history`, `/search`, `/taskforce`, `/practice`, `/reading`.
- `app/api/session/[id]/reflection` (PUT) saves a tutor's reflection; `.../help` (POST) coaches the tutor on that session; `app/api/practice/results` lists quiz scores (saved with `action: "saveQuiz"`); `app/api/feed` serves the reading list.
- `lib/books.ts`: the curated book list. Article feeds (read in `app/api/feed`, 6 s timeout, cached 1 h): writing.wisc.edu/blog/feed and insidehighered.com/rss.xml.
- `components/ui.tsx`: shared UI (Card, PageHeader, ErrorBox, and `Working`, the loader every AI wait uses).
- `lib/claude.ts`: the only place that calls Claude. It always adds `lib/prompts/coaching-rules.md` to the system prompt.
- `lib/db.ts`: SQLite file `gait.db` (tables `sessions`, `tasks`, and the full-text index `aria_docs`).
- `lib/search.ts`: ARIA search.
- `scripts/sync-aria.ts`: the Drive indexer.

## Conventions
- Anything a student sees must coach and never write their work. Change behaviour in `lib/prompts/coaching-rules.md`, not in scattered prompts.
- The repo is public: never commit `.env.local`, `gait.db`, `.google-token.json`, or student data.
- Models are set by `GAIT_MODEL_SMART` and `GAIT_MODEL_FAST`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
