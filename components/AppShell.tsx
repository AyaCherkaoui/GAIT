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
  ["Today", [["/", "Home"], ["/session", "After session"], ["/history", "History"], ["/tutees", "Tutees"]]],
  ["Tools", [["/search", "ARIA search"], ["/taskforce", "Task planner"], ["/practice", "Practice"], ["/policies", "Policies"], ["/ai-talk", "AI talk"], ["/basics", "Center basics"]]],
  ["Learn", [["/news", "News"], ["/reading", "Reading"], ["/debrief", "Debrief"], ["/voice", "Voice-first"]]],
];
const NAV: Record<Role, readonly NavGroup[]> = {
  tutor: TUTOR_GROUPS,
  director: [...TUTOR_GROUPS, ["Admin", [["/impact", "Impact"], ["/admin/tutors", "Tutor list"], ["/admin/sessions", "Sessions"], ["/admin/courses", "Courses"]]]],
  tutee: [["Today", [["/", "Home"], ["/coach", "Coach"]]]],
};
const ROLE_LABEL: Record<Role, string> = { director: "Director", tutor: "Tutor", tutee: "Student" };

function Wordmark() {
  return (
    <Link href="/" className="inline-flex min-h-10 items-center gap-2.5 px-2 text-ink">
      <svg aria-hidden width="28" height="28" viewBox="0 0 28 28"><path d="M14 3 L22 13 L14 25 L6 13 Z" fill="currentColor" /><circle cx="14" cy="14" r="2.2" fill="#FFE27A" /></svg>
      <span className="font-display text-[26px] leading-none">Ink</span>
    </Link>
  );
}

function NavLinks({ role, path, onGo }: { role: Role; path: string; onGo?: () => void }) {
  return (
    <div className="space-y-5">
      {NAV[role].map(([title, items]) => (
        <div key={title}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-600">{title}</p>
          <ul className="space-y-0.5">
            {items.map(([href, label]) => {
              const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onGo}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-10 items-center rounded-lg px-3 text-[15px] transition lg:min-h-9 lg:text-sm ${
                      active ? "bg-ink font-semibold text-white" : "text-stone-700 hover:bg-stone-100 hover:text-ink"
                    }`}
                  >
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
      className="block min-h-9 text-sm text-gold-600 underline underline-offset-4 hover:text-ink"
    >
      {busy ? "Resetting…" : "Reset role (testing)"}
    </button>
  );
}

function Who({ user, testTools }: { user: ShellUser; testTools?: boolean }) {
  return (
    <div className="space-y-3">
      {user.role !== "tutee" && <ProviderStatus />}
      <div className="flex items-center justify-between gap-3 rounded-[10px] border border-stone-200 bg-white px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs text-stone-600">Signed in as {ROLE_LABEL[user.role]}</p>
          <p className="truncate text-sm font-semibold text-ink">{user.name || user.email}</p>
        </div>
        <form method="post" action="/api/auth/logout" className="shrink-0">
          <button type="submit" className="min-h-9 whitespace-nowrap rounded-lg border border-stone-300 bg-stone-50 px-3 text-[13px] text-ink hover:bg-stone-100">
            Sign out
          </button>
        </form>
      </div>
      {testTools && <ResetRole />}
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
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[16.5rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-gold-300 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      {/* Phones and tablets: a slim bar with a menu. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-side/95 px-4 py-3 backdrop-blur lg:hidden print:hidden">
        <Wordmark />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
          className="min-h-11 rounded-[10px] border border-stone-200 bg-white px-4 text-sm font-medium text-ink hover:bg-stone-100"
        >
          {open ? "Close" : "Menu"}
        </button>
      </header>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="sticky top-[4.3rem] z-20 flex max-h-[calc(100dvh-4.3rem)] flex-col overflow-y-auto border-b border-stone-200 bg-side lg:hidden print:hidden">
          <div className="px-4 pb-4 pt-1"><NavLinks role={user.role} path={path} onGo={() => setOpen(false)} /></div>
          <div className="sticky bottom-0 mt-auto border-t border-stone-200 bg-side px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"><Who user={user} testTools={testTools} /></div>
        </nav>
      )}
      {/* Desktop: a fixed ink sidebar. */}
      <aside className="hidden border-r border-stone-200 bg-side lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col print:hidden">
        <div className="px-4 pt-6"><Wordmark /></div>
        <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-5"><NavLinks role={user.role} path={path} /></nav>
        <div className="border-t border-stone-200 px-4 pb-5 pt-4"><Who user={user} testTools={testTools} /></div>
      </aside>
      <main
        id="main"
        tabIndex={-1}
        className={path === "/search"
          ? "w-full min-w-0 px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-5 outline-none sm:h-[calc(100dvh-4.3rem)] sm:p-0 lg:h-dvh"
          : "mx-auto w-full max-w-[1160px] px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-8 outline-none sm:px-[clamp(1rem,4vw,4rem)] sm:pt-10"}
      >
        {children}
      </main>
    </div>
  );
}
