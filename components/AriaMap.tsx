"use client";
/**
 * The ARIA Map: the whole ARIA folder as a graph, like Obsidian's graph view.
 * Similar files sit close together and are linked; files group into named topics and subtopics.
 * Canvas rendering with a smoothed camera, hover highlights, elastic drag (live physics on the
 * dragged file's neighbourhood) and fly-to. On phones it becomes the same levels as a list.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationNodeDatum } from "d3-force";
import { get } from "@/lib/client";
import type { AriaMap as MapData, AriaPreview } from "@/lib/aria-map-types";

const PALETTE = ["#8fb3ff", "#7ee0c3", "#f59fb0", "#c3a6ff", "#ffb37a", "#6fd3ff", "#a8e07a", "#ff8f8f", "#e6c9ff", "#9fe6f0", "#d7e08a", "#b8c4d9"];
const GOLD = "#ffd84d";
const KINDS = ["Doc", "PDF", "Slides", "Sheet", "Image", "File"];
const FONT = "Figtree, ui-sans-serif, system-ui, sans-serif";

type Box = { minX: number; minY: number; maxX: number; maxY: number };
type Graph = {
  map: MapData;
  n: number;
  hx: Float32Array; hy: Float32Array; px: Float32Array; py: Float32Array;
  topic: Int16Array; rad: Float32Array; deg: Int32Array;
  adjStart: Int32Array; adj: Int32Array;
  index: Map<string, number>;
  all: Box; topicBox: Box[]; subBox: Box[];
  lower: string[];
};
type Cam = { x: number; y: number; k: number };
type SNode = SimulationNodeDatum & { i: number; hx: number; hy: number };

function boxOf(idx: Iterable<number>, xs: Float32Array, ys: Float32Array): Box {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const i of idx) {
    if (xs[i] < b.minX) b.minX = xs[i];
    if (xs[i] > b.maxX) b.maxX = xs[i];
    if (ys[i] < b.minY) b.minY = ys[i];
    if (ys[i] > b.maxY) b.maxY = ys[i];
  }
  return b;
}

function buildGraph(map: MapData): Graph {
  const n = map.nodes.id.length;
  const hx = Float32Array.from(map.nodes.x), hy = Float32Array.from(map.nodes.y);
  const topic = new Int16Array(n);
  map.nodes.sub.forEach((s, i) => (topic[i] = map.subs[s]?.topic ?? 0));
  const deg = new Int32Array(n);
  for (const v of map.links) deg[v]++;
  const adjStart = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) adjStart[i + 1] = adjStart[i] + deg[i];
  const fill = adjStart.slice(0, n);
  const adj = new Int32Array(map.links.length);
  for (let l = 0; l < map.links.length; l += 2) {
    const a = map.links[l], b = map.links[l + 1];
    adj[fill[a]++] = b;
    adj[fill[b]++] = a;
  }
  const rad = new Float32Array(n);
  for (let i = 0; i < n; i++) rad[i] = 2.4 + Math.sqrt(deg[i]) * 0.55;
  const byTopic: number[][] = map.topics.map(() => []);
  const bySub: number[][] = map.subs.map(() => []);
  for (let i = 0; i < n; i++) { byTopic[topic[i]].push(i); bySub[map.nodes.sub[i]].push(i); }
  const all = Array.from({ length: n }, (_, i) => i);
  return {
    map, n, hx, hy, px: hx.slice(), py: hy.slice(), topic, rad, deg, adjStart, adj,
    index: new Map(map.nodes.id.map((id, i) => [id, i])),
    all: boxOf(all, hx, hy), topicBox: byTopic.map((g) => boxOf(g, hx, hy)), subBox: bySub.map((g) => boxOf(g, hx, hy)),
    lower: map.nodes.name.map((s) => s.toLowerCase()),
  };
}

const neighbors = (g: Graph, i: number) => Array.from(g.adj.subarray(g.adjStart[i], g.adjStart[i + 1]));
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const cleanName = (s: string) => s.replace(/\.[a-z0-9]{2,5}$/i, "");

type Crumb = { topic: number | null; sub: number | null };

export default function AriaMap({ picks = [], related = [], focusKey = 0 }: { picks?: string[]; related?: string[]; focusKey?: number }) {
  const [data, setData] = useState<MapData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [crumb, setCrumb] = useState<Crumb>({ topic: null, sub: null });
  const [sel, setSel] = useState<number | null>(null);
  const [preview, setPreview] = useState<AriaPreview | null>(null);
  const [filter, setFilter] = useState("");
  const [full, setFull] = useState(false);
  const [hoverName, setHoverName] = useState<string | null>(null);

  useEffect(() => {
    get<{ map: MapData | null }>("/api/search/map").then((j) => setData(j.map)).catch((e) => setError((e as Error).message));
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const g = useMemo(() => (data ? buildGraph(data) : null), [data]);

  useEffect(() => {
    if (sel === null || !g) { setPreview(null); return; }
    let live = true;
    setPreview(null);
    get<AriaPreview>(`/api/search/map?doc=${encodeURIComponent(g.map.nodes.id[sel])}`).then((p) => live && setPreview(p)).catch(() => {});
    return () => { live = false; };
  }, [sel, g]);

  if (error) return <p className="rounded-lg border border-margin/30 bg-white p-4 text-[15px] text-stone-800">The map could not load: {error}</p>;
  if (data === undefined) return <MapSkeleton />;
  if (!data || !g) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-[15px] text-stone-700">
        <p className="font-semibold text-ink">The map has not been built yet.</p>
        <p className="mt-1">Run <code className="rounded bg-stone-100 px-1.5 py-0.5">npm run build-aria-map</code> once on this computer. It reads the ARIA index and draws the map with the local model.</p>
      </div>
    );
  }
  if (narrow) return <MapList g={g} crumb={crumb} setCrumb={setCrumb} sel={sel} setSel={setSel} preview={preview} picks={picks} />;
  return (
    <MapCanvas
      g={g} crumb={crumb} setCrumb={setCrumb} sel={sel} setSel={setSel} preview={preview}
      picks={picks} related={related} focusKey={focusKey} filter={filter} setFilter={setFilter}
      full={full} setFull={setFull} hoverName={hoverName} setHoverName={setHoverName}
    />
  );
}

function MapSkeleton() {
  return (
    <div className="relative grid h-[72vh] min-h-[480px] place-items-center overflow-hidden rounded-xl bg-[#0a1430]">
      <div className="flex items-center gap-3 text-sm text-indigo-200">
        <span className="h-2 w-2 animate-ping rounded-full bg-gold-300" />
        Drawing the ARIA Map…
      </div>
    </div>
  );
}

type CanvasProps = {
  g: Graph; crumb: Crumb; setCrumb: (c: Crumb) => void; sel: number | null; setSel: (i: number | null) => void; preview: AriaPreview | null;
  picks: string[]; related: string[]; focusKey: number; filter: string; setFilter: (s: string) => void;
  full: boolean; setFull: (b: boolean) => void; hoverName: string | null; setHoverName: (s: string | null) => void;
};

function MapCanvas(p: CanvasProps) {
  const { g, crumb, setCrumb, sel, setSel, preview, picks, related, focusKey, filter, setFilter, full, setFull, setHoverName } = p;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  // Everything the frame loop reads lives in one ref, so React renders never interrupt the animation.
  const st = useRef({
    W: 0, H: 0, dpr: 1, fitK: 1,
    cam: { x: 0, y: 0, k: 0.1 } as Cam, target: { x: 0, y: 0, k: 0.1 } as Cam,
    dirty: true, intro: 0, introStart: 0,
    hover: -1, hoverTopic: -1, sel: -1, crumb: { topic: null, sub: null } as Crumb,
    mark: new Uint8Array(g.n), gold: new Uint8Array(g.n), hasMark: false, dim: 0,
    sim: null as Simulation<SNode, undefined> | null, simNodes: [] as SNode[], dragging: -1, settling: [] as number[],
    grid: new Map<number, number[]>(), gridDirty: true,
    pointers: new Map<number, { x: number; y: number }>(),
    pan: null as null | { x: number; y: number; moved: boolean; vx: number; vy: number; t: number },
    pinch: null as null | { d: number; k: number },
    downNode: -1, downAt: { x: 0, y: 0 }, dragMoved: false,
    pulse: 0,
  });

  const fitBox = useCallback((b: Box, pad = 60): Cam => {
    const s = st.current;
    const w = Math.max(b.maxX - b.minX, 40), h = Math.max(b.maxY - b.minY, 40);
    const k = Math.min((s.W - pad * 2) / w, (s.H - pad * 2) / h);
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, k: Math.min(Math.max(k, 0.02), 6) };
  }, []);

  const flyTo = useCallback((c: Cam) => { const s = st.current; s.target = { ...c }; s.dirty = true; }, []);

  // Marks: 2 = in focus, 1 = neighbour or related. Gold marks search results.
  const recomputeMarks = useCallback(() => {
    const s = st.current;
    s.mark.fill(0);
    s.gold.fill(0);
    let any = false;
    const q = filter.trim().toLowerCase();
    if (q.length > 1) for (let i = 0; i < g.n; i++) if (g.lower[i].includes(q)) { s.mark[i] = 1; any = true; }
    for (const id of related) { const i = g.index.get(id); if (i !== undefined) { s.gold[i] = 1; s.mark[i] = Math.max(s.mark[i], 1); any = true; } }
    for (const id of picks) { const i = g.index.get(id); if (i !== undefined) { s.gold[i] = 2; s.mark[i] = 2; any = true; } }
    const focus = s.hover >= 0 ? s.hover : s.sel;
    if (focus >= 0) {
      s.mark[focus] = 2;
      for (const j of neighbors(g, focus)) if (s.mark[j] < 1) s.mark[j] = 1;
      any = true;
    } else if (s.hoverTopic >= 0) {
      for (let i = 0; i < g.n; i++) if (g.topic[i] === s.hoverTopic) s.mark[i] = Math.max(s.mark[i], 1);
      any = true;
    }
    s.hasMark = any;
    s.dirty = true;
  }, [g, filter, picks, related]);

  useEffect(() => { recomputeMarks(); }, [recomputeMarks]);
  useEffect(() => { st.current.sel = sel ?? -1; recomputeMarks(); }, [sel, recomputeMarks]);
  useEffect(() => { st.current.crumb = crumb; }, [crumb]);

  // Fly to search results.
  useEffect(() => {
    if (!related.length) return;
    const idx = related.map((id) => g.index.get(id)).filter((i): i is number => i !== undefined);
    if (!idx.length) return;
    setSel(null);
    setCrumb({ topic: null, sub: null });
    const c = fitBox(boxOf(idx, g.hx, g.hy), 120);
    flyTo({ ...c, k: Math.min(c.k, st.current.fitK * 7) });
  }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Size, frame loop and input.
  useEffect(() => {
    const s = st.current;
    const cv = canvas.current!, box = wrap.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0, last = performance.now(), first = true;

    const resize = () => {
      const r = box.getBoundingClientRect();
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.W = r.width; s.H = r.height;
      cv.width = Math.round(r.width * s.dpr); cv.height = Math.round(r.height * s.dpr);
      cv.style.width = `${r.width}px`; cv.style.height = `${r.height}px`;
      const fit = fitBox(g.all, 40);
      s.fitK = fit.k;
      if (first) {
        first = false;
        s.cam = { ...fit, k: fit.k * 0.55 };
        s.target = fit;
        s.introStart = performance.now();
      }
      s.dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    resize();

    const toWorld = (x: number, y: number) => ({ x: (x - s.W / 2) / s.cam.k + s.cam.x, y: (y - s.H / 2) / s.cam.k + s.cam.y });
    const CELL = 24;
    const key = (cx: number, cy: number) => cx * 73856093 ^ cy * 19349663;
    const rebuildGrid = () => {
      s.grid.clear();
      for (let i = 0; i < g.n; i++) {
        const k = key(Math.floor(g.px[i] / CELL), Math.floor(g.py[i] / CELL));
        const cell = s.grid.get(k);
        if (cell) cell.push(i); else s.grid.set(k, [i]);
      }
      s.gridDirty = false;
    };
    const nodeAt = (x: number, y: number) => {
      if (s.gridDirty) rebuildGrid();
      const w = toWorld(x, y);
      const reach = Math.max(10 / s.cam.k, 4);
      const c0 = Math.floor((w.x - reach) / CELL), c1 = Math.floor((w.x + reach) / CELL);
      const r0 = Math.floor((w.y - reach) / CELL), r1 = Math.floor((w.y + reach) / CELL);
      let best = -1, bd = Infinity;
      for (let cx = c0; cx <= c1; cx++) for (let cy = r0; cy <= r1; cy++) {
        for (const i of s.grid.get(key(cx, cy)) || []) {
          const d = Math.hypot(g.px[i] - w.x, g.py[i] - w.y);
          const hit = Math.max(g.rad[i], 7 / s.cam.k);
          if (d < hit && d < bd) { bd = d; best = i; }
        }
      }
      return best;
    };
    const overview = () => s.cam.k < s.fitK * 1.9;
    const topicAt = (x: number, y: number) => {
      const w = toWorld(x, y);
      let best = -1, bd = Infinity;
      g.map.topics.forEach((t, i) => { const d = Math.hypot(t.x - w.x, t.y - w.y) / t.r; if (d < 1.15 && d < bd) { bd = d; best = i; } });
      return best;
    };
    const subAt = (x: number, y: number, inTopic: number | null) => {
      const w = toWorld(x, y);
      let best = -1, bd = Infinity;
      g.map.subs.forEach((t, i) => {
        if (inTopic !== null && t.topic !== inTopic) return;
        const d = Math.hypot(t.x - w.x, t.y - w.y) / t.r;
        if (d < 1.15 && d < bd) { bd = d; best = i; }
      });
      return best;
    };

    const startPhysics = (center: number) => {
      const seen = new Map<number, number>([[center, 0]]);
      const queue = [center];
      while (queue.length && seen.size < 320) {
        const i = queue.shift()!;
        const d = seen.get(i)!;
        if (d >= 3) continue;
        for (const j of neighbors(g, i)) if (!seen.has(j)) { seen.set(j, d + 1); queue.push(j); }
      }
      const ids = [...seen.keys()];
      const local = new Map(ids.map((i, k) => [i, k]));
      const nodes: SNode[] = ids.map((i) => ({ i, x: g.px[i], y: g.py[i], hx: g.hx[i], hy: g.hy[i] }));
      const links: { source: number; target: number }[] = [];
      for (const i of ids) for (const j of neighbors(g, i)) if (i < j && local.has(j)) links.push({ source: local.get(i)!, target: local.get(j)! });
      s.simNodes = nodes;
      s.sim = forceSimulation(nodes)
        .force("link", forceLink<SNode, { source: number; target: number }>(links).distance(16).strength(0.32))
        .force("charge", forceManyBody<SNode>().strength(-16).distanceMax(90))
        .force("x", forceX<SNode>((d) => d.hx).strength(0.05))
        .force("y", forceY<SNode>((d) => d.hy).strength(0.05))
        .velocityDecay(0.32)
        .alpha(0.7)
        .alphaTarget(0.3)
        .stop();
      s.settling = [];
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let animating = false;

      // Intro: files bloom out from their topic centres.
      if (s.intro < 1) {
        s.intro = Math.min(1, (now - s.introStart) / 1300);
        const e = 1 - Math.pow(1 - s.intro, 3);
        for (let i = 0; i < g.n; i++) {
          const t = g.map.topics[g.topic[i]];
          g.px[i] = t.x + (g.hx[i] - t.x) * e;
          g.py[i] = t.y + (g.hy[i] - t.y) * e;
        }
        s.gridDirty = true;
        animating = true;
      }

      // Camera: exponential smoothing toward the target (frame-rate independent).
      const a = 1 - Math.exp(-dt * 9);
      const c = s.cam, t = s.target;
      const lk = Math.log(c.k), ltk = Math.log(t.k);
      if (Math.abs(lk - ltk) > 1e-4 || Math.abs(c.x - t.x) * c.k > 0.2 || Math.abs(c.y - t.y) * c.k > 0.2) {
        const nk = Math.exp(lk + (ltk - lk) * a);
        c.x += (t.x - c.x) * a; c.y += (t.y - c.y) * a; c.k = nk;
        animating = true;
      } else { c.x = t.x; c.y = t.y; c.k = t.k; }

      // Pan inertia.
      if (s.pan === null && s.pointers.size === 0 && (Math.abs(inertia.vx) > 0.02 || Math.abs(inertia.vy) > 0.02)) {
        s.target.x -= (inertia.vx * dt * 60) / s.cam.k; s.target.y -= (inertia.vy * dt * 60) / s.cam.k;
        s.cam.x = s.target.x; s.cam.y = s.target.y;
        inertia.vx *= Math.pow(0.9, dt * 60); inertia.vy *= Math.pow(0.9, dt * 60);
        animating = true;
      }

      // Live physics on the dragged neighbourhood.
      if (s.sim) {
        s.sim.tick();
        for (const nd of s.simNodes) { g.px[nd.i] = nd.x!; g.py[nd.i] = nd.y!; }
        s.gridDirty = true;
        animating = true;
        if (s.dragging < 0 && s.sim.alpha() < 0.02) {
          s.settling = s.simNodes.map((nd) => nd.i);
          s.sim = null;
        }
      } else if (s.settling.length) {
        let maxd = 0;
        const b = 1 - Math.exp(-dt * 6);
        for (const i of s.settling) {
          g.px[i] += (g.hx[i] - g.px[i]) * b; g.py[i] += (g.hy[i] - g.py[i]) * b;
          maxd = Math.max(maxd, Math.abs(g.hx[i] - g.px[i]) + Math.abs(g.hy[i] - g.py[i]));
        }
        if (maxd < 0.05) { for (const i of s.settling) { g.px[i] = g.hx[i]; g.py[i] = g.hy[i]; } s.settling = []; }
        s.gridDirty = true;
        animating = true;
      }

      // Dim fade.
      const dimTarget = s.hasMark ? 1 : 0;
      if (Math.abs(s.dim - dimTarget) > 0.01) { s.dim += (dimTarget - s.dim) * (1 - Math.exp(-dt * 12)); animating = true; } else s.dim = dimTarget;

      // Pulse for the best search matches.
      if (picks.length) { s.pulse = (s.pulse + dt) % 1.6; animating = true; }

      // Stepping out by zooming out clears the path.
      if (s.crumb.topic !== null && s.cam.k < s.fitK * 1.25 && s.target.k < s.fitK * 1.25) { s.crumb = { topic: null, sub: null }; setCrumb(s.crumb); }

      if (!animating && !s.dirty) return;
      s.dirty = false;
      draw(ctx);
    };

    const inertia = { vx: 0, vy: 0 };

    const draw = (ctx: CanvasRenderingContext2D) => {
      const { W, H, dpr, cam } = s;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const k = cam.k;
      const sx = (x: number) => (x - cam.x) * k + W / 2;
      const sy = (y: number) => (y - cam.y) * k + H / 2;
      const zoom = Math.log(k / s.fitK) / Math.log(2); // 0 = whole map
      const dim = s.dim;
      const focus = s.hover >= 0 ? s.hover : s.sel;
      const m = 40;
      const onScreen = (x: number, y: number) => x > -m && x < W + m && y > -m && y < H + m;

      // Links.
      const baseLink = 0.05 + 0.13 * smooth(-0.5, 2.5, zoom);
      ctx.lineWidth = Math.min(1.4, Math.max(0.5, 0.35 * Math.sqrt(k / s.fitK)));
      ctx.strokeStyle = `rgba(170,190,235,${baseLink * (1 - 0.7 * dim)})`;
      ctx.beginPath();
      const L = g.map.links;
      for (let l = 0; l < L.length; l += 2) {
        const a = L[l], b = L[l + 1];
        const x1 = sx(g.px[a]), y1 = sy(g.py[a]), x2 = sx(g.px[b]), y2 = sy(g.py[b]);
        if (!onScreen(x1, y1) && !onScreen(x2, y2)) continue;
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      if (dim > 0.01) {
        // Links between highlighted files.
        ctx.beginPath();
        for (let l = 0; l < L.length; l += 2) {
          const a = L[l], b = L[l + 1];
          if (!s.mark[a] || !s.mark[b]) continue;
          if (focus >= 0 && a !== focus && b !== focus && !(s.gold[a] && s.gold[b])) continue;
          ctx.moveTo(sx(g.px[a]), sy(g.py[a])); ctx.lineTo(sx(g.px[b]), sy(g.py[b]));
        }
        ctx.strokeStyle = focus >= 0 ? `rgba(255,255,255,${0.55 * dim})` : `rgba(255,216,77,${0.4 * dim})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Nodes, batched by colour.
      const rScale = Math.pow(k / s.fitK, 0.55) * s.fitK;
      const rad = (i: number) => Math.min(16, Math.max(1.3, g.rad[i] * rScale * 2.2));
      for (let pass = 0; pass < 2; pass++) {
        for (let t = 0; t < g.map.topics.length; t++) {
          ctx.beginPath();
          for (let i = 0; i < g.n; i++) {
            if (g.topic[i] !== t || s.gold[i]) continue;
            const marked = s.mark[i] > 0;
            if ((pass === 1) !== marked) continue;
            const x = sx(g.px[i]), y = sy(g.py[i]);
            if (!onScreen(x, y)) continue;
            const r = rad(i);
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, Math.PI * 2);
          }
          ctx.globalAlpha = pass === 0 ? 1 - 0.85 * dim : 1;
          ctx.fillStyle = PALETTE[t % PALETTE.length];
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Search results in gold, best matches pulse.
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,216,77,0.22)";
      for (let i = 0; i < g.n; i++) if (s.gold[i]) { const x = sx(g.px[i]), y = sy(g.py[i]), r = rad(i) * 2.6; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = GOLD;
      for (let i = 0; i < g.n; i++) if (s.gold[i]) { const x = sx(g.px[i]), y = sy(g.py[i]), r = rad(i) * (s.gold[i] === 2 ? 1.5 : 1.1); ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
      ctx.fill();
      if (picks.length) {
        const ph = s.pulse / 1.6;
        ctx.strokeStyle = `rgba(255,216,77,${0.8 * (1 - ph)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < g.n; i++) if (s.gold[i] === 2) { const x = sx(g.px[i]), y = sy(g.py[i]), r = rad(i) * (1.6 + ph * 3.5); ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
        ctx.stroke();
      }

      // Focus ring.
      if (focus >= 0) {
        const x = sx(g.px[focus]), y = sy(g.py[focus]), r = rad(focus) + 3.5;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      }

      // Labels: topics far out, subtopics in the middle, files up close.
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      const fits = (x: number, y: number, w: number, h: number) => {
        for (const r of placed) if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return false;
        placed.push({ x, y, w, h });
        return true;
      };
      const label = (text: string, x: number, y: number, size: number, weight: number, alpha: number, color = "255,255,255", force = false, pill = false) => {
        if (alpha < 0.03) return;
        ctx.font = `${weight} ${size}px ${FONT}`;
        const w = ctx.measureText(text).width;
        const lx = x - w / 2, ly = y - size / 2;
        const px = pill ? 9 : 4, py = pill ? 6 : 3;
        if (!fits(lx - px, ly - py, w + px * 2, size + py * 2) && !force) return;
        ctx.globalAlpha = alpha;
        if (pill) {
          ctx.fillStyle = "rgba(8,16,38,0.78)";
          ctx.beginPath();
          ctx.roundRect(lx - px, ly - py, w + px * 2, size + py * 2, (size + py * 2) / 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.14)";
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.lineJoin = "round";
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(8,16,38,0.85)";
          ctx.strokeText(text, lx, y + size * 0.35);
        }
        ctx.fillStyle = `rgb(${color})`;
        ctx.fillText(text, lx, y + size * 0.35);
        ctx.globalAlpha = 1;
      };
      const fileA = smooth(1.6, 2.6, zoom);
      if (focus >= 0) {
        const x = sx(g.px[focus]), y = sy(g.py[focus]) - rad(focus) - 14;
        label(cleanName(g.map.nodes.name[focus]), x, y, 14, 600, 1, "255,255,255", true);
      }
      if (fileA > 0.02 || s.hasMark) {
        const cand: number[] = [];
        for (let i = 0; i < g.n; i++) {
          if (i === focus) continue;
          const x = sx(g.px[i]), y = sy(g.py[i]);
          if (x < 0 || x > W || y < 0 || y > H) continue;
          if (fileA > 0.02 || s.gold[i] === 2 || (focus >= 0 && s.mark[i])) cand.push(i);
        }
        cand.sort((a, b) => (s.gold[b] - s.gold[a]) || (s.mark[b] - s.mark[a]) || (g.deg[b] - g.deg[a]));
        for (const i of cand.slice(0, 90)) {
          const a = s.mark[i] || s.gold[i] ? 1 : fileA * (1 - 0.8 * dim);
          label(cleanName(g.map.nodes.name[i]).slice(0, 42), sx(g.px[i]), sy(g.py[i]) + rad(i) + 10, 12, s.gold[i] ? 600 : 500, a, s.gold[i] ? "255,226,122" : "226,232,245");
        }
      }
      const subA = smooth(0.5, 1.2, zoom) * (1 - smooth(2.4, 3.2, zoom));
      if (subA > 0.02) {
        const open = s.crumb.topic;
        // The open topic's subtopics first, so they win the label space.
        const order = g.map.subs.map((_, i) => i).sort((a, b) => Number(g.map.subs[b].topic === open) - Number(g.map.subs[a].topic === open));
        for (const i of order) {
          const sb = g.map.subs[i];
          const x = sx(sb.x), y = sy(sb.y);
          if (!onScreen(x, y)) continue;
          const mine = open === null || sb.topic === open;
          label(sb.name, x, y, mine ? 14 : 12, mine ? 650 : 500, subA * (mine ? 1 : 0.38) * (1 - 0.5 * dim), "236,240,250", false, mine);
        }
      }
      const topA = 1 - smooth(0.6, 1.3, zoom);
      if (topA > 0.02) {
        g.map.topics.forEach((tp, i) => {
          const hovered = s.hoverTopic === i;
          label(tp.name, sx(tp.x), sy(tp.y), hovered ? 21 : 18, 700, topA * (hovered ? 1 : 1 - 0.5 * dim), "255,255,255");
        });
      }
    };

    // Input.
    const pos = (e: PointerEvent | WheelEvent) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const setHover = (i: number, topicI: number) => {
      if (i === s.hover && topicI === s.hoverTopic) return;
      s.hover = i; s.hoverTopic = topicI;
      cv.style.cursor = i >= 0 || topicI >= 0 ? "pointer" : "grab";
      setHoverName(i >= 0 ? g.map.nodes.name[i] : topicI >= 0 ? g.map.topics[topicI].name : null);
      recomputeMarksRef.current();
    };
    const onDown = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      const q = pos(e);
      s.pointers.set(e.pointerId, q);
      inertia.vx = inertia.vy = 0;
      if (s.pointers.size === 2) {
        const [a, b] = [...s.pointers.values()];
        s.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: s.target.k };
        s.pan = null; s.dragging = -1; s.downNode = -1;
        return;
      }
      s.downAt = q;
      s.dragMoved = false;
      s.downNode = overview() ? -1 : nodeAt(q.x, q.y);
      if (s.downNode < 0) { s.pan = { x: q.x, y: q.y, moved: false, vx: 0, vy: 0, t: performance.now() }; cv.style.cursor = "grabbing"; }
    };
    const onMove = (e: PointerEvent) => {
      const q = pos(e);
      if (!s.pointers.has(e.pointerId)) {
        if (overview()) setHover(-1, topicAt(q.x, q.y));
        else setHover(nodeAt(q.x, q.y), -1);
        return;
      }
      s.pointers.set(e.pointerId, q);
      if (s.pinch && s.pointers.size === 2) {
        const [a, b] = [...s.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (s.pinch.k * d) / s.pinch.d / s.target.k, true);
        return;
      }
      if (s.downNode >= 0) {
        if (!s.dragMoved && Math.hypot(q.x - s.downAt.x, q.y - s.downAt.y) > 3) {
          s.dragMoved = true;
          s.dragging = s.downNode;
          startPhysics(s.dragging);
          cv.style.cursor = "grabbing";
        }
        if (s.dragging >= 0 && s.sim) {
          const w = toWorld(q.x, q.y);
          const nd = s.simNodes.find((n) => n.i === s.dragging);
          if (nd) { nd.fx = w.x; nd.fy = w.y; }
          s.sim.alphaTarget(0.3);
          if (s.sim.alpha() < 0.3) s.sim.alpha(0.3);
        }
        return;
      }
      if (s.pan) {
        const dx = q.x - s.pan.x, dy = q.y - s.pan.y;
        if (Math.hypot(q.x - s.downAt.x, q.y - s.downAt.y) > 3) s.pan.moved = true;
        s.cam.x -= dx / s.cam.k; s.cam.y -= dy / s.cam.k;
        s.target.x = s.cam.x; s.target.y = s.cam.y; s.target.k = s.cam.k;
        const now = performance.now(), el = Math.max(1, now - s.pan.t);
        s.pan.vx = 0.7 * s.pan.vx + 0.3 * (dx / el) * 16; s.pan.vy = 0.7 * s.pan.vy + 0.3 * (dy / el) * 16;
        s.pan.x = q.x; s.pan.y = q.y; s.pan.t = now;
        s.dirty = true;
      }
    };
    const onUp = (e: PointerEvent) => {
      const q = pos(e);
      s.pointers.delete(e.pointerId);
      if (s.pinch) { if (s.pointers.size < 2) s.pinch = null; s.pan = null; return; }
      if (s.downNode >= 0) {
        if (!s.dragMoved) { setSel(s.downNode); const c = s.target; flyTo({ x: g.hx[s.downNode], y: g.hy[s.downNode], k: Math.max(c.k, s.fitK * 5) }); }
        if (s.dragging >= 0) {
          const nd = s.simNodes.find((n) => n.i === s.dragging);
          if (nd) { nd.fx = null; nd.fy = null; }
          s.sim?.alphaTarget(0);
          s.dragging = -1;
        }
        s.downNode = -1;
        cv.style.cursor = "pointer";
        return;
      }
      if (s.pan) {
        const moved = s.pan.moved;
        if (moved && performance.now() - s.pan.t < 80) { inertia.vx = s.pan.vx; inertia.vy = s.pan.vy; }
        s.pan = null;
        cv.style.cursor = "grab";
        if (!moved) clickEmpty(q.x, q.y);
      }
    };
    const clickEmpty = (x: number, y: number) => {
      if (overview()) {
        const t = topicAt(x, y);
        if (t >= 0) { openTopicRef.current(t); return; }
        return;
      }
      const sb = subAt(x, y, s.crumb.topic);
      if (sb >= 0 && s.crumb.sub !== sb && s.cam.k < s.fitK * 5) { openSubRef.current(sb); return; }
      if (s.sel >= 0) setSel(null);
    };
    const zoomAt = (x: number, y: number, factor: number, immediate = false) => {
      const t = s.target;
      const nk = Math.min(Math.max(t.k * factor, s.fitK * 0.6), s.fitK * 40);
      // Keep the world point under the cursor fixed (in the target camera).
      const wx = (x - s.W / 2) / t.k + t.x, wy = (y - s.H / 2) / t.k + t.y;
      t.x = wx - (x - s.W / 2) / nk; t.y = wy - (y - s.H / 2) / nk; t.k = nk;
      if (immediate) s.cam = { ...t };
      s.dirty = true;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const q = pos(e);
      const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(q.x, q.y, Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0018)));
    };
    const onLeave = () => { if (!s.pointers.size) setHover(-1, -1); };
    const onDbl = (e: MouseEvent) => { const q = pos(e as PointerEvent); zoomAt(q.x, q.y, 2.2); };

    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp);
    cv.addEventListener("pointerleave", onLeave);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("dblclick", onDbl);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onUp);
      cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("wheel", onWheel);
      cv.removeEventListener("dblclick", onDbl);
    };
  }, [g, picks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable refs so the input handlers always call the latest versions.
  const recomputeMarksRef = useRef(recomputeMarks);
  recomputeMarksRef.current = recomputeMarks;
  const openTopic = (t: number) => { setSel(null); setCrumb({ topic: t, sub: null }); st.current.crumb = { topic: t, sub: null }; flyTo(fitBox(g.topicBox[t], 70)); };
  const openSub = (sb: number) => { const t = g.map.subs[sb].topic; setSel(null); setCrumb({ topic: t, sub: sb }); st.current.crumb = { topic: t, sub: sb }; flyTo(fitBox(g.subBox[sb], 80)); };
  const openAll = () => { setSel(null); setCrumb({ topic: null, sub: null }); st.current.crumb = { topic: null, sub: null }; flyTo(fitBox(g.all, 40)); };
  const openTopicRef = useRef(openTopic); openTopicRef.current = openTopic;
  const openSubRef = useRef(openSub); openSubRef.current = openSub;
  const selectFile = (i: number) => { setSel(i); flyTo({ x: g.hx[i], y: g.hy[i], k: Math.max(st.current.target.k, st.current.fitK * 5) }); };

  // Keyboard: Escape steps out; + and - zoom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "Escape") {
        if (full) setFull(false);
        else if (sel !== null) setSel(null);
        else if (crumb.sub !== null && crumb.topic !== null) openTopic(crumb.topic);
        else if (crumb.topic !== null) openAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const selNeighbors = sel !== null ? neighbors(g, sel) : [];
  const btn = "inline-flex min-h-9 items-center rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300";

  return (
    <div
      ref={wrap}
      className={`${full ? "fixed inset-0 z-50" : "relative h-[72vh] min-h-[480px] rounded-xl"} overflow-hidden bg-[radial-gradient(ellipse_at_center,#13244d_0%,#0a1430_55%,#060c1f_100%)] shadow-[0_20px_60px_-20px_rgba(10,20,48,0.6)]`}
    >
      <canvas ref={canvas} className="absolute inset-0 touch-none select-none" style={{ cursor: "grab" }} role="img" aria-label={`Map of ${g.n} ARIA files grouped into ${g.map.topics.length} topics. Use the topic list to explore by keyboard.`} />

      {/* Path */}
      <nav aria-label="Map path" className="pointer-events-auto absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1 rounded-lg bg-[#081026]/70 px-2 py-1 text-sm text-indigo-100 backdrop-blur">
        <button type="button" onClick={openAll} className="rounded px-1.5 py-1 hover:bg-white/10 hover:text-white">All files</button>
        {crumb.topic !== null && (<><span aria-hidden className="text-indigo-300">›</span><button type="button" onClick={() => openTopic(crumb.topic!)} className="rounded px-1.5 py-1 hover:bg-white/10 hover:text-white">{g.map.topics[crumb.topic].name}</button></>)}
        {crumb.sub !== null && g.map.subs[crumb.sub].name !== g.map.topics[crumb.topic ?? 0]?.name && (<><span aria-hidden className="text-indigo-300">›</span><span className="px-1.5 py-1 font-semibold text-white">{g.map.subs[crumb.sub].name}</span></>)}
        {sel !== null && (<><span aria-hidden className="text-indigo-300">›</span><span className="max-w-[16rem] truncate px-1.5 py-1 font-semibold text-gold-300">{cleanName(g.map.nodes.name[sel])}</span></>)}
      </nav>

      {/* Controls */}
      <div className="absolute right-3 top-3 flex items-center gap-2">
        <label className="sr-only" htmlFor="map-filter">Light up files by name</label>
        <input
          id="map-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Light up by name…"
          className="h-9 w-44 rounded-lg border border-white/15 bg-[#081026]/70 px-3 text-sm text-white placeholder:text-indigo-300 backdrop-blur focus:w-60 focus:outline-none focus:ring-2 focus:ring-gold-300 transition-[width]"
        />
        <button type="button" className={btn} onClick={() => setFull(!full)} aria-pressed={full}>{full ? "Exit full screen" : "Full screen"}</button>
      </div>

      {/* Topics legend (also the keyboard way in) */}
      {crumb.topic === null && sel === null && (
        <ul aria-label="Topics" className="absolute bottom-3 left-3 hidden max-h-[46%] w-56 space-y-0.5 overflow-auto rounded-lg bg-[#081026]/70 p-2 text-sm backdrop-blur md:block">
          {g.map.topics.map((t, i) => (
            <li key={i}>
              <button type="button" onClick={() => openTopic(i)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-indigo-100 hover:bg-white/10 hover:text-white">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                <span className="text-xs tabular-nums text-indigo-300">{t.n}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {crumb.topic !== null && sel === null && (
        <ul aria-label="Subtopics" className="absolute bottom-3 left-3 hidden max-h-[46%] w-56 space-y-0.5 overflow-auto rounded-lg bg-[#081026]/70 p-2 text-sm backdrop-blur md:block">
          {g.map.subs.map((sb, i) => sb.topic !== crumb.topic ? null : (
            <li key={i}>
              <button type="button" onClick={() => openSub(i)} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-white/10 hover:text-white ${crumb.sub === i ? "bg-white/10 text-white" : "text-indigo-100"}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[sb.topic % PALETTE.length] }} />
                <span className="min-w-0 flex-1 truncate">{sb.name}</span>
                <span className="text-xs tabular-nums text-indigo-300">{sb.n}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* File preview */}
      {sel !== null && (
        <aside aria-label="File preview" className="map-panel absolute bottom-3 right-3 top-14 flex w-[min(22rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b1736]/90 text-white shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">{KINDS[g.map.nodes.kind[sel]] ?? "File"} · {g.map.subs[g.map.nodes.sub[sel]]?.name}</p>
              <h3 className="mt-1 break-words font-display text-lg font-semibold leading-snug">{cleanName(g.map.nodes.name[sel])}</h3>
            </div>
            <button type="button" onClick={() => setSel(null)} aria-label="Close preview" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-indigo-200 hover:bg-white/10 hover:text-white">✕</button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
            {preview ? (
              preview.snippet ? <p className="text-sm leading-relaxed text-indigo-100">{preview.snippet}…</p> : <p className="text-sm text-indigo-300">No text preview for this file.</p>
            ) : (
              <div className="space-y-2" aria-hidden><div className="h-3 animate-pulse rounded bg-white/10" /><div className="h-3 w-5/6 animate-pulse rounded bg-white/10" /><div className="h-3 w-2/3 animate-pulse rounded bg-white/10" /></div>
            )}
            {preview && <a href={preview.url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-lg bg-gold-300 px-4 text-sm font-semibold text-ink transition hover:bg-gold-400">Open in Drive</a>}
            {selNeighbors.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-300">Nearest files</p>
                <ul className="space-y-0.5">
                  {selNeighbors.slice(0, 10).map((j) => (
                    <li key={j}>
                      <button type="button" onClick={() => selectFile(j)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-indigo-100 hover:bg-white/10 hover:text-white">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PALETTE[g.topic[j] % PALETTE.length] }} />
                        <span className="min-w-0 flex-1 truncate">{cleanName(g.map.nodes.name[j])}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      )}

      <p className="pointer-events-none absolute bottom-3 right-3 text-xs text-indigo-300/80" hidden={sel !== null}>
        Scroll to zoom · drag to move · drag a file to pull its neighbours · click a topic to go in · Esc steps out
      </p>
    </div>
  );
}

/** Phone: the same levels as a tappable list. */
function MapList({ g, crumb, setCrumb, sel, setSel, preview, picks }: { g: Graph; crumb: Crumb; setCrumb: (c: Crumb) => void; sel: number | null; setSel: (i: number | null) => void; preview: AriaPreview | null; picks: string[] }) {
  const row = "flex min-h-12 w-full items-center gap-3 rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-left text-[15px] text-stone-900 active:bg-stone-100";
  const pickIdx = picks.map((id) => g.index.get(id)).filter((i): i is number => i !== undefined);
  const files = crumb.sub !== null ? g.map.nodes.sub.flatMap((s, i) => (s === crumb.sub ? [i] : [])).sort((a, b) => g.deg[b] - g.deg[a]) : [];
  return (
    <div className="space-y-3">
      <nav aria-label="Map path" className="flex flex-wrap items-center gap-1 text-sm text-stone-600">
        <button type="button" className="rounded px-1 py-1 underline-offset-4 hover:underline" onClick={() => { setSel(null); setCrumb({ topic: null, sub: null }); }}>All files</button>
        {crumb.topic !== null && (<><span aria-hidden>›</span><button type="button" className="rounded px-1 py-1 underline-offset-4 hover:underline" onClick={() => { setSel(null); setCrumb({ topic: crumb.topic, sub: null }); }}>{g.map.topics[crumb.topic].name}</button></>)}
        {crumb.sub !== null && (<><span aria-hidden>›</span><span className="px-1 py-1 font-semibold text-ink">{g.map.subs[crumb.sub].name}</span></>)}
      </nav>
      {sel !== null ? (
        <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{KINDS[g.map.nodes.kind[sel]] ?? "File"}</p>
          <h3 className="break-words font-display text-lg font-semibold text-ink">{cleanName(g.map.nodes.name[sel])}</h3>
          {preview?.snippet && <p className="text-sm text-stone-700">{preview.snippet}…</p>}
          {preview && <a href={preview.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-white">Open in Drive</a>}
          <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-stone-500">Nearest files</p>
          <ul className="space-y-1.5">{neighbors(g, sel).slice(0, 8).map((j) => <li key={j}><button type="button" className={row} onClick={() => setSel(j)}>{cleanName(g.map.nodes.name[j])}</button></li>)}</ul>
          <button type="button" className="text-sm text-stone-600 underline" onClick={() => setSel(null)}>Back to the list</button>
        </div>
      ) : (
        <>
          {pickIdx.length > 0 && crumb.topic === null && (
            <section className="space-y-1.5">
              <p className="text-sm font-semibold text-stone-800">Best matches for your search</p>
              <ul className="space-y-1.5">{pickIdx.map((i) => <li key={i}><button type="button" className={`${row} border-gold-300 bg-gold-50`} onClick={() => setSel(i)}>{cleanName(g.map.nodes.name[i])}</button></li>)}</ul>
            </section>
          )}
          <ul className="space-y-1.5">
            {crumb.topic === null && g.map.topics.map((t, i) => (
              <li key={i}><button type="button" className={row} onClick={() => setCrumb({ topic: i, sub: null })}><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="flex-1">{t.name}</span><span className="text-sm text-stone-500">{t.n}</span></button></li>
            ))}
            {crumb.topic !== null && crumb.sub === null && g.map.subs.map((sb, i) => sb.topic !== crumb.topic ? null : (
              <li key={i}><button type="button" className={row} onClick={() => setCrumb({ topic: crumb.topic, sub: i })}><span className="flex-1">{sb.name}</span><span className="text-sm text-stone-500">{sb.n}</span></button></li>
            ))}
            {crumb.sub !== null && files.slice(0, 200).map((i) => (
              <li key={i}><button type="button" className={row} onClick={() => setSel(i)}><span className="min-w-0 flex-1 break-words">{cleanName(g.map.nodes.name[i])}</span></button></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
