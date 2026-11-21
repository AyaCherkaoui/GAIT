import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { SESSION_TYPES } from "@/lib/session-types";

const TOOLS = [
  ["/session", "Write-up (any session)", "Turn your notes into a follow-up email, printable next steps, and AI prompts that coach the student instead of writing for them."],
  ["/history", "History", "Look back at your past sessions and your reflections on them."],
  ["/search", "ARIA search", "Describe what you need in plain words and find it in the ARIA folder."],
  ["/taskforce", "Task force", "Paste a task force assignment and get a plan, an outline and related ARIA files."],
  ["/practice", "Practice", "No appointment? Role-play a tricky session or take a 5-question refresher."],
  ["/ai-talk", "Talking about AI", "Curious, non-accusing scripts for AI conversations, and ownership questions for a paragraph."],
  ["/policies", "Course AI policies", "Look up and save what each course's syllabus says about AI."],
  ["/debrief", "30-second debrief", "A private end-of-shift check-in, just for you."],
  ["/voice", "Voice-first writing", "Why GAIT has no AI detector, and how to protect writers' own voices."],
  ["/impact", "Impact snapshot", "Anonymous weekly counts, with a CSV download."],
  ["/reading", "Reading", "Recent articles and a short book list to keep growing as a tutor."],
];

const card = "rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow";

export default function Home() {
  return (
    <div className="space-y-8">
      <PageHeader title="What kind of session?">Pick one for the handbook steps, practice and a write-up that fits it.</PageHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        {SESSION_TYPES.map((t) => (
          <Link key={t.id} href={`/types/${t.id}`} className={card}>
            <h2 className="font-semibold text-indigo-700">{t.name}</h2>
            <p className="mt-1 text-sm text-stone-600">{t.short}</p>
            <p className="mt-2 text-xs text-stone-500">{t.length}</p>
          </Link>
        ))}
      </div>
      <h2 className="text-lg font-semibold text-stone-800">Other tools</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map(([href, title, text]) => (
          <Link key={href} href={href} className={card}>
            <h2 className="font-semibold text-indigo-700">{title}</h2>
            <p className="mt-1 text-sm text-stone-600">{text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
