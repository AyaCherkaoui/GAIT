"use client";
import { useEffect, useState } from "react";

const KEY = "gait-voice-first";

/** Voice-first mode lives only in this browser's localStorage. */
export function useVoiceFirst(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(localStorage.getItem(KEY) === "1");
    } catch {
      /* storage blocked: stays off */
    }
  }, []);
  return [
    on,
    (v) => {
      setOn(v);
      try {
        localStorage.setItem(KEY, v ? "1" : "0");
      } catch {
        /* storage blocked: lasts until the page closes */
      }
    },
  ];
}
