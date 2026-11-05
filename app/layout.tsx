import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "GAIT",
  description: "An assistant for Reading/Writing Center tutors",
};

const NAV = [
  ["/session", "After session"],
  ["/search", "ARIA search"],
  ["/taskforce", "Task force"],
  ["/practice", "Practice"],
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white print:hidden">
          <nav className="mx-auto flex max-w-4xl items-center gap-5 px-4 py-3 text-sm">
            <Link href="/" className="font-bold text-indigo-700">GAIT</Link>
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="text-slate-600 hover:text-slate-900">{label}</Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
