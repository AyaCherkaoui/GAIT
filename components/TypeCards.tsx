"use client";
import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import { Card, inputCls } from "@/components/ui";
import { getSessionType, starfishOutcome } from "@/lib/session-types";
import type { SessionOutputs } from "@/lib/types";

/** Type-specific write-ups (editable) and the Starfish outcome built from the notes. */
export default function TypeCards({ outputs, typeId }: { outputs: SessionOutputs; typeId: string | null }) {
  const type = getSessionType(typeId);
  const [texts, setTexts] = useState<string[]>(() => (outputs.typeOutputs ?? []).map((t) => t.text));
  const items = outputs.typeOutputs ?? [];
  const outcome = type && type.id !== "writing-fellow" ? starfishOutcome(outputs, type) : "";
  return (
    <>
      {items.map((t, i) => (
        <Card key={i} title={t.title} actions={<CopyButton text={texts[i] ?? t.text} />}>
          <textarea className={inputCls} rows={6} value={texts[i] ?? t.text} onChange={(e) => setTexts((a) => a.map((x, j) => (j === i ? e.target.value : x)))} />
          {type?.id === "email-feedback" && (
            <p className="mt-1 text-xs text-stone-500">An outline from your notes. Write the AFF feedback in your own words.</p>
          )}
        </Card>
      ))}
      {outcome && (
        <Card title="Starfish outcome" actions={<CopyButton text={outcome} />}>
          <p className="whitespace-pre-wrap break-words text-sm">{outcome}</p>
          <p className="mt-1 text-xs text-stone-500">Add the actual start and end times in Starfish.</p>
        </Card>
      )}
    </>
  );
}
