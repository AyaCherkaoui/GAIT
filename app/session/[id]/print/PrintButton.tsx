"use client";

export default function PrintButton() {
  return (
    <button className="rounded border border-slate-300 px-3 py-1 text-sm print:hidden" onClick={() => window.print()}>
      Print
    </button>
  );
}
