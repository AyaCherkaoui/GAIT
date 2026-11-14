import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/session-token";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  domain: "That Google account is not allowed to use GAIT. Sign in with your Augustana account.",
  not_allowed: "Your account isn't on the tutor list yet. Ask the Reading/Writing Center director.",
  denied: "Sign-in did not finish. Please try again.",
  failed: "Sign-in failed. Please try again.",
  config: "Sign-in is not set up yet. Ask the person who runs GAIT.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const target = safeNext(next);
  if (await getUser()) redirect(target);
  return (
    <div className="mx-auto max-w-sm space-y-5 rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm">
      <h1 className="text-xl font-bold text-indigo-700">GAIT</h1>
      <p className="text-sm text-stone-600">Sign in to see your sessions, practice and task force work.</p>
      {error && MESSAGES[error] && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-800">{MESSAGES[error]}</p>}
      <a
        href={`/api/auth/google?next=${encodeURIComponent(target)}`}
        className="inline-block rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800"
      >
        Sign in with Google
      </a>
    </div>
  );
}
