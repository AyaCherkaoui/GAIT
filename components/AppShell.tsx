"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import ProviderStatus from "@/components/ProviderStatus";
import { post } from "@/lib/client";

type Role = "director" | "tutor" | "tutee";
type ShellUser = { name: string | null; email: string; picture: string | null; role: Role };

type NavItem = readonly [href: string, label: string];
type NavGroup = readonly [title: string, items: readonly NavItem[]];

const TUTOR_GROUPS: readonly NavGroup[] = [
  ["Today", [["/", "Home"], ["/session", "After session"], ["/history", "History"]]],
  ["Tools", [["/search", "ARIA search"], ["/taskforce", "Task force"], ["/practice", "Practice"], ["/policies", "Policies"], ["/ai-talk", "AI talk"]]],
  ["Learn", [["/news", "News"], ["/reading", "Reading"], ["/debrief", "Debrief"], ["/voice", "Voice-first"]]],
];
const NAV: Record<Role, readonly NavGroup[]> = {
  tutor: TUTOR_GROUPS,
  director: [...TUTOR_GROUPS, ["Admin", [["/impact", "Impact"], ["/admin/tutors", "Tutor list"], ["/admin/sessions", "Sessions"]]]],
  tutee: [["Today", [["/", "Home"], ["/coach", "Coach"]]]],
};
const ROLE_LABEL: Record<Role, string> = { director: "Director", tutor: "Tutor", tutee: "Student" };

function Wordmark() {
  return (
    <Link href="/" className="font-display inline-flex min-h-10 items-center text-2xl font-semibold tracking-tight text-white">
      Ink<span className="text-gold-300">.</span>
    </Link>
  );
}

function NavLinks({ role, path, onGo }: { role: Role; path: string; onGo?: () => void }) {
  return (
    <div className="space-y-5 lg:space-y-2.5">
      {NAV[role].map(([title, items]) => (
        <div key={title}>
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-indigo-300">{title}</p>
          <ul className="space-y-0.5">
            {items.map(([href, label]) => {
              const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onGo}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-md px-3 py-1.5 text-[15px] transition lg:min-h-7 lg:py-0.5 lg:text-sm focus-visible:outline-gold-300 ${
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
        </div>
      ))}
    </div>
  );
}

function ResetRole() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await post("/api/me/reset", {});
          window.location.assign("/welcome");
        } catch {
          setBusy(false);
        }
      }}
      className="block min-h-10 text-sm text-gold-300 underline decoration-gold-300/50 underline-offset-4 hover:text-white"
    >
      {busy ? "Resetting…" : "Reset role (testing)"}
    </button>
  );
}

function Who({ user, testTools }: { user: ShellUser; testTools?: boolean }) {
  return (
    <div className="space-y-3">
      {user.role !== "tutee" && <ProviderStatus />}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{user.name || user.email}</p>
        <p className="text-xs text-gold-300">{ROLE_LABEL[user.role]}</p>
      </div>
      {testTools && <ResetRole />}
      <form method="post" action="/api/auth/logout">
        <button type="submit" className="min-h-10 text-sm text-indigo-200 underline decoration-indigo-400 underline-offset-4 hover:text-white">
          Sign out
        </button>
      </form>
    </div>
  );
}

export default function AppShell({ user, testTools, children }: { user: ShellUser; testTools?: boolean; children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  const printing = path.endsWith("/print");

  if (path === "/welcome") return <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-16">{children}</main>;
  if (printing) return <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-gold-300 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      {/* Phones and tablets: a slim bar with a menu. */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 lg:hidden print:hidden">
        <Wordmark />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
          className="min-h-10 rounded-md border border-white/25 px-4 text-sm font-medium text-white hover:bg-white/10"
        >
          {open ? "Close" : "Menu"}
        </button>
      </header>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="sticky top-16 z-20 flex max-h-[calc(100dvh-4rem)] flex-col overflow-y-auto bg-ink lg:hidden print:hidden">
          <div className="px-4 pb-4 pt-1"><NavLinks role={user.role} path={path} onGo={() => setOpen(false)} /></div>
          <div className="sticky bottom-0 mt-auto border-t border-white/15 bg-ink px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"><Who user={user} testTools={testTools} /></div>
        </nav>
      )}
      {/* Desktop: a fixed ink sidebar. */}
      <aside className="hidden bg-ink lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col print:hidden">
        <div className="px-7 pt-6"><Wordmark /></div>
        <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:py-3"><NavLinks role={user.role} path={path} /></nav>
        <div className="border-t border-white/15 px-7 py-4"><Who user={user} testTools={testTools} /></div>
      </aside>
      <main
        id="main"
        tabIndex={-1}
        className={path === "/search"
          ? "w-full min-w-0 px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-5 outline-none sm:h-[calc(100dvh-4rem)] sm:p-0 lg:h-dvh"
          : "mx-auto w-full max-w-4xl px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-8 outline-none sm:px-8 sm:pt-10 lg:max-w-5xl"}
      >
        {children}
      </main>
    </div>
  );
}
