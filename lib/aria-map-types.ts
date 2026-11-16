/** The ARIA Map as sent to the browser. Built once by scripts/build-aria-map.ts. */
export type AriaGroup = { name: string; x: number; y: number; r: number; n: number };

export type AriaMap = {
  builtAt: string;
  topics: AriaGroup[];
  subs: (AriaGroup & { topic: number })[];
  /** Column arrays, one entry per file. kind: 0 doc, 1 pdf, 2 slides, 3 sheet, 4 image or video, 5 other. */
  nodes: { id: string[]; name: string[]; kind: number[]; sub: number[]; x: number[]; y: number[] };
  /** Flat pairs of node indexes: [a0, b0, a1, b1, ...]. Each file is linked to its most similar files. */
  links: number[];
};

export type AriaPreview = { driveId: string; name: string; url: string; mime: string; snippet: string };
