"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type Role = "director" | "tutor" | "tutee";
type ShellUser = { name: string | null; email: string; picture: string | null; role: Role };

const TUTOR_NAV = [
  ["/", "Home"],
  ["/session", "After session"],
  ["/history", "History"],
  ["/search", "ARIA search"],
  ["/taskforce", "Task force"],
  ["/practice", "Practice"],
  ["/reading", "Reading"],
] as const;
const NAV: Record<Role, readonly (readonly [string, string])[]> = {
  tutor: TUTOR_NAV,
  director: [...TUTOR_NAV, ["/admin/tutors", "Tutor list"]],
  tutee: [["/", "Home"]],
};
const ROLE_LABEL: Record<Role, string> = { director: "Director", tutor: "Tutor", tutee: "Student" };

function Wordmark() {
  return (
    <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-white">
      GAIT<span className="text-gold-300">.</span>
    </Link>
  );
}

function NavLinks({ role, path, onGo }: { role: Role; path: string; onGo?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {NAV[role].map(([href, label]) => {
        const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onGo}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-[15px] transition ${
                active ? "bg-white/10 font-semibold text-white" : "text-indigo-200 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span aria-hidden className={`h-4 w-1 rounded-full ${active ? "bg-gold-300" : "bg-transparent"}`} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Who({ user }: { user: ShellUser }) {
  return (
    <div className="space-y-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{user.name || user.email}</p>
        <p className="text-xs text-gold-300">{ROLE_LABEL[user.role]}</p>
      </div>
      <form method="post" action="/api/auth/logout">
        <button type="submit" className="text-sm text-indigo-200 underline decoration-indigo-400 underline-offset-4 hover:text-white">
          Sign out
        </button>
      </form>
    </div>
  );
}

export default function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const printing = path.endsWith("/print");

  if (path === "/welcome") return <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-16">{children}</main>;
  if (printing) return <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_1fr]">
      {/* Phones and tablets: a slim bar with a menu. */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 lg:hidden print:hidden">
        <Wordmark />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-white/25 px-3 py-1.5 text-sm font-medium text-white"
        >
          {open ? "Close" : "Menu"}
        </button>
      </header>
      {open && (
        <div id="mobile-nav" className="z-20 space-y-5 bg-ink px-4 pb-5 pt-1 lg:hidden print:hidden">
          <NavLinks role={user.role} path={path} onGo={() => setOpen(false)} />
          <div className="border-t border-white/15 pt-4"><Who user={user} /></div>
        </div>
      )}
      {/* Desktop: a fixed ink sidebar. */}
      <aside className="hidden bg-ink lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:px-4 lg:py-6 print:hidden">
        <div className="space-y-8">
          <div className="px-3"><Wordmark /></div>
          <nav aria-label="Main"><NavLinks role={user.role} path={path} /></nav>
        </div>
        <div className="border-t border-white/15 px-3 pt-4"><Who user={user} /></div>
      </aside>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-10 lg:max-w-5xl">{children}</main>
    </div>
  );
}
