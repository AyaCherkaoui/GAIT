"use client";
import Link from "next/link";
import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import { Chip, btn2Cls, inputCls } from "@/components/ui";
import { useEmailSent } from "@/lib/local";
import type { SessionOutputs } from "@/lib/types";

const TABS = [["email", "Email"], ["steps", "Next steps"], ["ai", "AI prompts"], ["note", "Session note"]] as const;
type Tab = (typeof TABS)[number][0];

/** The results of a session write-up: Email, Next steps and AI prompts for the student, each with Copy, plus Print and Mark email sent. */
export default function SessionOutputsView({ id, outputs: o, editable = false }: { id: number; outputs: SessionOutputs; editable?: boolean }) {
  const [tab, setTab] = useState<Tab>("email");
  const [email, setEmail] = useState(o.email);
  const [note, setNote] = useState(o.sessionNote ?? "");
  const [sent, setSent] = useEmailSent(id);
  const tabs = TABS.filter(([k]) => k !== "note" || o.sessionNote?.trim());
  const steps = o.nextSteps.map((s) => `- ${s}`).join("\n");
  const allPrompts = o.aiPrompts.map((p, i) => `${i + 1}. ${p.prompt}`).join("\n\n");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link className={`${btn2Cls} min-h-10`} href={`/session/${id}/print`} target="_blank">Print next steps</Link>
        <button type="button" className={`${btn2Cls} min-h-10`} aria-pressed={sent} onClick={() => setSent(!sent)}>
          {sent ? "Email marked as sent (undo)" : "Mark email sent"}
        </button>
        {sent && <Chip tone="gold">Email sent</Chip>}
      </div>

      {o.voiceFlags && o.voiceFlags.length > 0 && (
        <section aria-label="Voice flags" className="rounded-lg border-l-4 border-gold-400 bg-gold-50 px-4 py-3">
          <p className="text-sm font-semibold text-ink">Check these against the student&apos;s own voice</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-stone-800">{o.voiceFlags.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </section>
      )}

      <div role="tablist" aria-label="Session results" className="flex flex-wrap gap-1 border-b border-stone-200">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            onClick={() => setTab(k)}
            className={`min-h-10 rounded-t-md border-b-2 px-4 text-sm font-semibold transition ${tab === k ? "border-gold-400 text-ink" : "border-transparent text-stone-600 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "email" && (
        <section role="tabpanel" id="panel-email" aria-labelledby="tab-email" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-2xl font-semibold text-ink">Email draft</h2>
            <CopyButton text={email} />
          </div>
          {editable ? (
            <>
              <label htmlFor="emailDraft" className="sr-only">Email draft</label>
              <textarea id="emailDraft" className={inputCls} rows={12} value={email} onChange={(e) => setEmail(e.target.value)} />
              <p className="text-sm text-stone-600">Edit it, copy it, and send it from your own email.</p>
            </>
          ) : (
            <p className="max-w-prose whitespace-pre-wrap rounded-lg border border-stone-200 bg-white p-4 text-[15px] text-stone-800">{email}</p>
          )}
        </section>
      )}

      {tab === "steps" && (
        <section role="tabpanel" id="panel-steps" aria-labelledby="tab-steps" className="space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-2xl font-semibold text-ink">Next steps</h2>
            <CopyButton text={steps} />
          </div>
          <ul className="max-w-prose list-disc space-y-1.5 pl-5 text-[15px] text-stone-800">{o.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
          <h3 className="font-display text-xl font-semibold text-ink">Focus areas</h3>
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {o.focusAreas.map((f, i) => (
              <li key={i} className="max-w-prose px-5 py-4 text-[15px]">
                <p className="font-semibold text-ink"><span className="mark">{f.skill}</span></p>
                <p className="mt-1 text-stone-600">{f.why}</p>
                <p className="mt-2 text-stone-800">{f.miniLesson}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "ai" && (
        <section role="tabpanel" id="panel-ai" aria-labelledby="tab-ai" className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink">{o.aiPrompts.length ? "Use AI like a coach" : "AI and this course"}</h2>
              <p className="mt-1 text-sm text-stone-600">
                {o.aiPrompts.length
                  ? "Prompts the student can paste into an AI tool. Each one keeps them doing the writing."
                  : "No AI prompts this time. The student should check the syllabus and ask the professor before using any AI tool on this work."}
              </p>
            </div>
            {o.aiPrompts.length > 0 && <CopyButton text={allPrompts} label="Copy all" />}
          </div>
          <ul className="space-y-3">
            {o.aiPrompts.map((p, i) => (
              <li key={i} className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <code className="min-w-0 whitespace-pre-wrap break-words text-sm text-stone-900">{p.prompt}</code>
                  <CopyButton text={p.prompt} />
                </div>
                <p className="mt-2 max-w-prose text-sm text-stone-600">{p.whyItHelps}</p>
              </li>
            ))}
          </ul>
          <div className="rounded-lg border-l-4 border-margin bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-margin">Don&apos;t ask AI to…</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-stone-800">{o.dontAskAi.map((d, i) => <li key={i}>{d}</li>)}</ul>
          </div>
        </section>
      )}

      {tab === "note" && (
        <section role="tabpanel" id="panel-note" aria-labelledby="tab-note" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-2xl font-semibold text-ink">Session note for the center&apos;s records</h2>
            <CopyButton text={note} />
          </div>
          {editable ? (
            <>
              <label htmlFor="sessionNote" className="sr-only">Session note</label>
              <textarea id="sessionNote" className={inputCls} rows={8} value={note} onChange={(e) => setNote(e.target.value)} />
              <p className="text-sm text-stone-600">Organized by the RWC rubric. Edit it, then copy it into your records.</p>
            </>
          ) : (
            <p className="max-w-prose whitespace-pre-wrap rounded-lg border border-stone-200 bg-white p-4 text-[15px] text-stone-800">{note}</p>
          )}
        </section>
      )}
    </div>
  );
}
