import Link from "next/link";

const TOOLS = [
  ["/session", "After session", "Turn your notes into a follow-up email, printable next steps, and AI prompts that coach the student instead of writing for them."],
  ["/search", "ARIA search", "Ask for what you need in plain words and find it in the ARIA folder."],
  ["/taskforce", "Task force", "Paste a task force assignment and get a plan, an outline and related ARIA files."],
  ["/practice", "Practice", "No appointment? Role-play a tricky session or take a 5-question refresher."],
];

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GAIT</h1>
        <p className="text-slate-600">Help students become independent writers, and keep growing as a tutor.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map(([href, title, text]) => (
          <Link key={href} href={href} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300">
            <h2 className="font-semibold text-indigo-700">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
