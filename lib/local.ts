"use client";
import { useEffect, useState } from "react";

/** Browser-only notes (drafts, "email sent"). Every access is wrapped: private windows and blocked storage must not break a page. */
export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

const sentKey = (id: number | string) => `ink-email-sent-${id}`;
export const readEmailSent = (id: number | string) => readLocal(sentKey(id)) === "1";

/** Whether the tutor marked this session's email as sent. Kept in this browser only. */
export function useEmailSent(id: number | string): [boolean, (v: boolean) => void] {
  const [sent, setSent] = useState(false);
  useEffect(() => setSent(readEmailSent(id)), [id]);
  return [sent, (v) => { writeLocal(sentKey(id), v ? "1" : null); setSent(v); }];
}
