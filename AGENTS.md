# Ink

Ink is an assistant for tutors at the Augustana College Reading/Writing Center (RWC).
Its goal: help tutors grow students into independent writers who use AI as a coach, never as a ghostwriter, and help tutors keep improving.

This is v0, a rough first draft that runs on one computer. Tutors sign in with Google; there is no hosting and no session recording.

## What it does
- **After session** (`/session`): the tutor's notes become an email draft, printable next steps (`/session/<id>/print`), and AI prompts the student can use that coach rather than write.
- **ARIA search** (`/search`): searches the ARIA Google Drive folder. Claude turns the question into keywords, SQLite full-text search finds candidates, and Claude picks the best 5.
- **Task force** (`/taskforce`): turns a task into steps, an outline, questions, and related ARIA files.
- **Practice** (`/practice`): role-play a tricky student with feedback afterwards, or take a 5-question refresher quiz.

## Setup
1. Node 22.5 or newer (uses the built-in `node:sqlite`).
2. `npm install`
3. `cp .env.example .env.local` and fill in:
   - `GAIT_PROVIDER`: `ollama` (default, free, local: install Ollama and `ollama pull llama3.1:8b`), `groq`, `gemini`, `openrouter` (free tiers, see `.env.example`), `grok` (alias `xai`, needs `XAI_API_KEY`) or `anthropic` (needs `ANTHROPIC_API_KEY`). Switching later only changes `.env.local`. `GAIT_MODEL_SMART` / `GAIT_MODEL_FAST` override the models; `GAIT_API_BASE` overrides a hosted provider's URL. Small models are slow and weaker: on a low-memory Mac use `GAIT_MODEL_SMART=llama3.2:3b`.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: in Google Cloud Console, enable the Google Drive API, then create an OAuth client of type **Desktop app**.
   - `ARIA_FOLDER_ID`: the last part of the ARIA folder's Drive URL.
   - `AUTH_SECRET`: at least 32 random characters that sign the login cookie (`openssl rand -base64 32`). The app refuses requests without it.
   - `APP_URL`: where you open the app (default `http://localhost:3100`). In Google Cloud Console add `<APP_URL>/api/auth/callback` as an authorized redirect URI of the same OAuth client. If Google refuses a Desktop-type client for this redirect, create a Web application client instead.
   - `ALLOWED_EMAIL_DOMAIN` (optional): only this email domain may sign in, for example `augustana.edu`. Empty means any Google account.
   - `DIRECTOR_EMAIL`: the director's email. It is always an active director, so the director can never be locked out. The director opens Admin in the nav (`/admin/tutors`) to add tutors and deactivate them. Only people on that list can sign in, and deactivating someone ends their access on their next request.
4. `npm run sync-aria`: the first run opens a Google sign-in (read-only Drive access) and saves the token to `.google-token.json`. Re-run it whenever ARIA changes.
5. `npm run dev -- -p 3100` and open http://localhost:3100 (the port must match `APP_URL`). You sign in with Google first.

## Task forces
Tutors join one of seven RWC task forces (`lib/task-forces.ts`; a task force runs once it has `MIN_TO_RUN` members). Members live in `task_force_members` (one row per user, joined at `/welcome`, from the Home picker, or placed by the director in Admin). `app/api/task-forces` (GET list, POST join or move, DELETE leave, PUT director places someone by email; data helpers in `lib/task-force-data.ts`) enforces the seat cap in one transaction (409 when full). New `/taskforce` tasks carry the tutor's `tasks.task_force`; the page groups tasks by task force.
ARIA files are tagged in `aria_doc_tags` (`lib/aria-tags.ts`): `npm run sync-aria` matches the Drive folder name first, else asks the fast model, and re-tags only new or changed files. `POST /api/aria/tag` (director only) sets or clears a tag and is never overwritten by sync. `/search` filters by task force and the ARIA Map can colour by task force; `/api/search/map` joins tags outside its cache.

## Roles
On first sign-in a person picks Student, Tutor or Director at `/welcome` (`POST /api/me/role`, once; later calls are 409). That choice is only a request (`users.requested_role`); access always comes from `allowed_users`. Until the director approves it in Admin (`/admin/tutors`, Requests: `POST /api/admin/requests`), the person is a tutee and sees the student guide with a "waiting for the director" note. `DIRECTOR_EMAIL` and anyone already active in `allowed_users` skip the chooser.

## Checks
- `npm run typecheck`
- `npm run build`
- `npm run security-check`: starts a private server on port 3101 with a throwaway database and probes sign-in, headers, size limits and rate limits (no AI calls).
- `npm run feature-check`: starts a private server on port 3102 (it can run beside `npm run dev`) with a stand-in AI server, checks the session help route and the search fallback, then opens every page at 390px and 1280px in Chrome and fails on sideways scroll, a non-200 status or an error overlay. Screenshots go to `.feature-shots/`. Needs Google Chrome installed, or set `CHROME_PATH`.

## Layout
- `app/`: pages and API routes (`app/api/*/route.ts`). Pages: `/`, `/session`, `/session/[id]` (reflection and coaching help), `/history`, `/search`, `/taskforce`, `/practice`, `/policies`, `/ai-talk`, `/debrief`, `/voice`, `/reading`, `/news` (tutor reading from public teaching feeds; `app/api/news` lists, `app/api/news/try` turns an article into one coaching move; `NEWS_FIXTURE=1` reads `lib/fixtures/news.xml` for checks), `/coach` (student coaching), `/impact`, `/admin/tutors`, `/admin/sessions` (director's read-only view of a tutor's session: student first name only, never the tutor's private concern or debrief), `/session/live` (live session: timer, approach, notes; Home has the "Start a session" panel), `/tutees` and `/tutees/[id]` (a tutor's own students by first name, with a timeline; owner only, the director has no access), `/admin/courses` (the director sets the shared English 101 course).
- `app/api/session/[id]/reflection` (PUT) saves a tutor's reflection; `.../help` (POST) coaches the tutor on that session; `app/api/practice/results` lists quiz scores (saved with `action: "saveQuiz"`); `app/api/feed` serves the reading list; `app/api/taskforce` (PUT, owner only) saves ticked steps.
- `lib/books.ts`: the curated book list. Article feeds (read in `app/api/feed`, 6 s timeout, cached 1 h): writing.wisc.edu/blog/feed and insidehighered.com/rss.xml.
- `components/ui.tsx`: shared UI (Card, PageHeader, ErrorBox, and `Working`, the loader every AI wait uses).
- `lib/claude.ts`: the only place that calls Claude. It always adds `lib/prompts/coaching-rules.md` to the system prompt.
- `lib/db.ts`: SQLite file `gait.db` (override the path with `GAIT_DB`; tables `users`, `sessions`, `tasks`, `quiz_results`, and the full-text index `aria_docs`). Sessions, tasks and quiz results belong to one user; rows from before sign-in existed have no owner and are hidden from everyone.
- `proxy.ts`: first gate (login required except `/login` and `/api/auth/*`) and security headers. `lib/auth.ts` and `lib/session-token.ts`: Google sign-in and the signed session cookie. `lib/api.ts`: `handle(req, fn)` wraps every API route (401 when signed out, size-checked JSON body, rate limit on AI routes, no internal error text).
- `lib/search.ts`: ARIA search.
- Live sessions: `lib/session-types.ts` (types and focus areas), `lib/approaches.ts` (static draft approaches, shown with the chip "Draft: director to confirm"), `components/SessionTimer.tsx` (the timer comes from timestamps in localStorage key `ink-live-session`, so it survives reload and is shared across tabs; Finish merges into the `ink-draft-session` draft and opens `/session`). Type, focus, minutes and `tutee_id` are saved in the session notes JSON.
- Tutees: table `tutees` (one row per tutor and lower-cased first name; `sessions.tutee_id`, backfilled once from `student_name`). `lib/tutees.ts`; `app/api/tutees` is owner only (another tutor's tutee is a 404).
- English 101: table `courses` (one shared row: syllabus text and units JSON of title, goal, minutes). `lib/courses.ts`; `app/api/courses` (GET for tutors; PUT, `propose` and `load` for the director only; the course body limit is 200 KB), `app/api/courses/exercise` (made on demand from a unit; questions and tasks only, never model answers).
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
