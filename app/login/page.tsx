import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/session-token";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  domain: "That Google account can't use GAIT. Sign in with your Augustana account.",
  denied: "Sign-in didn't finish. Try again.",
  failed: "Sign-in failed. Try again in a moment.",
  config: "Sign-in isn't set up yet. Ask the person who runs GAIT.",
};

function GoogleG() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="h-5 w-5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.2-3.9 7.2-9.6 7.2-16.4z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.8 2.3-8.8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const target = safeNext(next);
  if (await getUser()) redirect(target);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      <section className="pad-dark flex flex-col justify-between gap-16 px-6 py-10 pl-[4.75rem] text-white sm:px-10 sm:pl-[5.5rem] lg:min-h-dvh lg:py-14 lg:pl-[6rem]">
        <p className="font-display text-2xl font-semibold tracking-tight">GAIT<span className="text-gold-300">.</span></p>
        <div className="rise max-w-xl">
          <h1 className="font-display text-4xl font-medium leading-[1.08] tracking-tight sm:text-6xl">
            Coach the writer,<br />not the paper.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-indigo-100">
            Turn session notes into next steps a student can act on, and use AI to teach, never to ghostwrite.
          </p>
        </div>
        <p className="text-sm text-indigo-200">Augustana College Reading/Writing Center</p>
      </section>

      <section className="flex items-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">Sign in</h2>
          <p className="mt-2 text-stone-600">Use your Augustana Google account. GAIT shows tutors, directors and students what each of them needs.</p>
          {error && MESSAGES[error] && (
            <p role="alert" className="mt-5 rounded-md border-l-4 border-margin bg-red-50 px-4 py-3 text-sm text-red-900">{MESSAGES[error]}</p>
          )}
          <a
            href={`/api/auth/google?next=${encodeURIComponent(target)}`}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-md border border-stone-300 bg-white px-4 py-3 text-[15px] font-semibold text-stone-900 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 active:translate-y-px"
          >
            <GoogleG />
            Continue with Google
          </a>
          <p className="mt-5 text-sm text-stone-500">We only read your name and email. Nothing is posted to your account.</p>
        </div>
      </section>
    </div>
  );
}
