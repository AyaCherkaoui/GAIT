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
   - `ANTHROPIC_API_KEY`: from the Claude Console.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: in Google Cloud Console, enable the Google Drive API, then create an OAuth client of type **Desktop app**.
   - `ARIA_FOLDER_ID`: the last part of the ARIA folder's Drive URL.
4. `npm run sync-aria`: the first run opens a Google sign-in (read-only Drive access) and saves the token to `.google-token.json`. Re-run it whenever ARIA changes.
5. `npm run dev` and open http://localhost:3000

## Checks
- `npm run typecheck`
- `npm run build`

## Layout
- `app/`: pages and API routes (`app/api/*/route.ts`).
- `lib/claude.ts`: the only place that calls Claude. It always adds `lib/prompts/coaching-rules.md` to the system prompt.
- `lib/db.ts`: SQLite file `gait.db` (tables `sessions`, `tasks`, and the full-text index `aria_docs`).
- `lib/search.ts`: ARIA search.
- `scripts/sync-aria.ts`: the Drive indexer.

## Conventions
- Anything a student sees must coach and never write their work. Change behaviour in `lib/prompts/coaching-rules.md`, not in scattered prompts.
- The repo is public: never commit `.env.local`, `gait.db`, `.google-token.json`, or student data.
- Models are set by `GAIT_MODEL_SMART` and `GAIT_MODEL_FAST`.
