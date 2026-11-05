"use client";
import { useEffect, useState } from "react";

const KEY = "gait-voice-first";

/** Voice-first mode lives only in this browser's localStorage. */
export function useVoiceFirst(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(localStorage.getItem(KEY) === "1"); }, []);
  return [on, (v) => { setOn(v); localStorage.setItem(KEY, v ? "1" : "0"); }];
}
