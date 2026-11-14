import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import "./globals.css";
import ProviderStatus from "@/components/ProviderStatus";

export const metadata: Metadata = {
  title: "GAIT",
  description: "An assistant for Reading/Writing Center tutors",
};

const NAV = [
  ["/session", "After session"],
  ["/history", "History"],
  ["/search", "ARIA search"],
  ["/taskforce", "Task force"],
  ["/practice", "Practice"],
  ["/ai-talk", "Talking about AI"],
  ["/policies", "Policies"],
  ["/debrief", "Debrief"],
  ["/voice", "Voice"],
  ["/impact", "Impact"],
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <html lang="en">
      <body>
        <header className="border-b border-stone-200 bg-white print:hidden">
          <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-sm">
            <Link href="/" className="text-lg font-bold text-indigo-700">GAIT</Link>
            {user && NAV.map(([href, label]) => (
              <Link key={href} href={href} className="text-stone-600 hover:text-stone-900">{label}</Link>
            ))}
            {user?.role === "director" && (
              <Link href="/admin/tutors" className="text-stone-600 hover:text-stone-900">Admin</Link>
            )}
            {user && <ProviderStatus />}
            {user && (
              <form method="post" action="/api/auth/logout" className="ml-auto flex items-center gap-3 text-stone-600">
                <span>{user.name || user.email}</span>
                <button type="submit" className="underline hover:text-stone-900">Sign out</button>
              </form>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
