/**
 * Builds the ARIA Map: embeds every indexed ARIA file with a local model, links each file to its
 * nearest files, groups files into topics and subtopics named by the local model, and lays the
 * graph out once. Everything runs on this computer (Ollama); nothing leaves the college.
 * Usage: npm run build-aria-map        (run again after npm run sync-aria; it only embeds new files)
 */
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";
import { getDb } from "../lib/db";
import { dot, embed, ensureVecTables, normalize } from "../lib/aria-embed";
import type { AriaMap } from "../lib/aria-map-types";

const OLLAMA = (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
const NAME_MODEL = process.env.GAIT_MAP_NAME_MODEL || "llama3.2:3b";
const TOPICS = 12;
const LINK_K = 5;
const BATCH = 48;

let seed = 7;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const log = (s: string) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${s}\n`);

function cleanName(name: string) {
  return name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
}

function kindOf(mime: string, name: string): number {
  const n = name.toLowerCase();
  if (/presentation|powerpoint/.test(mime) || /\.pptx?$/.test(n)) return 2;
  if (/pdf/.test(mime)) return 1;
  if (/spreadsheet|excel|csv/.test(mime)) return 3;
  if (/^image\/|^video\//.test(mime)) return 4;
  if (/document|msword|text/.test(mime)) return 0;
  return 5;
}

async function embedAll(docs: { drive_id: string; name: string; text: string }[]) {
  const db = getDb();
  const have = new Set((db.prepare("SELECT drive_id FROM aria_vecs").all() as { drive_id: string }[]).map((r) => r.drive_id));
  const todo = docs.filter((d) => !have.has(d.drive_id));
  log(`embedding ${todo.length} of ${docs.length} files with the local model`);
  const put = db.prepare("INSERT OR REPLACE INTO aria_vecs (drive_id, vec) VALUES (?, ?)");
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const texts = batch.map((d) => `${cleanName(d.name)}\n${(d.text || "").replace(/\s+/g, " ").trim().slice(0, 1200)}`);
    const vecs = await embed(texts, "document");
    db.exec("BEGIN");
    batch.forEach((d, j) => put.run(d.drive_id, new Uint8Array(vecs[j].buffer)));
    db.exec("COMMIT");
    if ((i / BATCH) % 10 === 0) log(`  ${Math.min(i + BATCH, todo.length)} / ${todo.length}`);
  }
}

/** Spherical k-means with k-means++ seeding. */
function kmeans(idx: number[], vecs: Float32Array[], k: number): number[][] {
  if (idx.length <= k) return idx.map((i) => [i]);
  const dim = vecs[idx[0]].length;
  const cents: Float32Array[] = [vecs[idx[Math.floor(rand() * idx.length)]]];
  const best = new Float64Array(idx.length).fill(Infinity);
  while (cents.length < k) {
    const c = cents[cents.length - 1];
    let total = 0;
    idx.forEach((i, a) => {
      const d = 1 - dot(vecs[i], c);
      if (d < best[a]) best[a] = d;
      total += best[a] * best[a];
    });
    let r = rand() * total;
    let pick = idx.length - 1;
    for (let a = 0; a < idx.length; a++) { r -= best[a] * best[a]; if (r <= 0) { pick = a; break; } }
    cents.push(vecs[idx[pick]]);
  }
  let assign = new Int32Array(idx.length);
  for (let it = 0; it < 30; it++) {
    let moved = 0;
    idx.forEach((i, a) => {
      let bi = 0, bs = -2;
      for (let c = 0; c < k; c++) { const s = dot(vecs[i], cents[c]); if (s > bs) { bs = s; bi = c; } }
      if (assign[a] !== bi) moved++;
      assign[a] = bi;
    });
    const sums = Array.from({ length: k }, () => new Float32Array(dim));
    idx.forEach((i, a) => { const s = sums[assign[a]]; const v = vecs[i]; for (let d = 0; d < dim; d++) s[d] += v[d]; });
    sums.forEach((s, c) => { if (s.some((x) => x !== 0)) cents[c] = normalize(s); });
    if (it > 0 && moved === 0) break;
  }
  const groups: number[][] = Array.from({ length: k }, () => []);
  idx.forEach((i, a) => groups[assign[a]].push(i));
  return groups.filter((g) => g.length);
}

function centroid(group: number[], vecs: Float32Array[]) {
  const s = new Float32Array(vecs[0].length);
  for (const i of group) { const v = vecs[i]; for (let d = 0; d < s.length; d++) s[d] += v[d]; }
  return normalize(s);
}

async function nameGroup(sample: string[], avoid: string[], parent?: string): Promise<string> {
  const system =
    "You name groups of files in a college writing center's shared folder. Give the group a short, plain name of 1 to 4 words that a tutor would understand, such as \"Thesis statements\", \"Writing Fellow forms\" or \"Citation guides\". Never use a person's name. Return JSON: {\"name\": \"...\"}";
  const user = `${parent ? `These files are part of the bigger group "${parent}". Name what makes this smaller group different.\n` : ""}${avoid.length ? `Do not reuse these names: ${avoid.join(", ")}.\n` : ""}Files:\n${sample.map((s) => `- ${s}`).join("\n")}`;
  const taken = new Set(avoid.map((a) => a.toLowerCase()));
  // Small models often ignore "do not reuse": ask again a little warmer until the name is new.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${OLLAMA}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: NAME_MODEL, stream: false, format: "json", options: { temperature: 0.2 + attempt * 0.3 }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
        signal: AbortSignal.timeout(60_000),
      });
      const j = (await res.json()) as { message?: { content?: string } };
      const name = String(JSON.parse(j.message?.content || "{}").name || "").replace(/["“”]/g, "").trim();
      if (name && name.length <= 40 && !taken.has(name.toLowerCase())) return name[0].toUpperCase() + name.slice(1);
    } catch { /* try again */ }
  }
  const base = parent ? `${parent} (more)` : "Other files";
  let n = 2, out = base;
  while (taken.has(out.toLowerCase())) out = `${base} ${n++}`;
  return out;
}

/** 2D placement of group centres: top two principal directions of their centroids. */
function pca2(cents: Float32Array[]): [number, number][] {
  const dim = cents[0].length;
  const mean = new Float32Array(dim);
  cents.forEach((c) => c.forEach((x, d) => (mean[d] += x / cents.length)));
  const X = cents.map((c) => c.map((x, d) => x - mean[d]));
  const comps: Float32Array[] = [];
  for (let k = 0; k < 2; k++) {
    let v = normalize(Array.from({ length: dim }, () => rand() - 0.5));
    for (let it = 0; it < 60; it++) {
      const w = new Float32Array(dim);
      for (const x of X) { const p = dot(x, v); for (let d = 0; d < dim; d++) w[d] += p * x[d]; }
      for (const c of comps) { const p = dot(w, c); for (let d = 0; d < dim; d++) w[d] -= p * c[d]; }
      v = normalize(w);
    }
    comps.push(v);
  }
  return X.map((x) => [dot(x, comps[0]), dot(x, comps[1])]);
}

/** Spread circles from their seed positions so they do not overlap. */
function spread(items: { x: number; y: number; r: number }[], cx: number, cy: number, pad: number) {
  const sim = forceSimulation(items as (typeof items[number] & { index?: number })[])
    .force("x", forceX(cx).strength(0.04))
    .force("y", forceY(cy).strength(0.04))
    .force("c", forceCollide<{ r: number } & { index?: number }>((d) => d.r + pad).strength(1).iterations(3))
    .stop();
  for (let i = 0; i < 300; i++) sim.tick();
}

async function main() {
  ensureVecTables();
  const db = getDb();
  const docs = db.prepare("SELECT drive_id, name, mime, text FROM aria_docs").all() as { drive_id: string; name: string; mime: string; text: string }[];
  if (!docs.length) throw new Error("The ARIA index is empty. Run npm run sync-aria first.");
  await embedAll(docs);

  const vecRows = db.prepare("SELECT drive_id, vec FROM aria_vecs").all() as { drive_id: string; vec: Uint8Array }[];
  const vecById = new Map(vecRows.map((r) => [r.drive_id, new Float32Array(r.vec.buffer.slice(r.vec.byteOffset, r.vec.byteOffset + r.vec.byteLength))]));
  const files = docs.filter((d) => vecById.has(d.drive_id));
  const vecs = files.map((d) => vecById.get(d.drive_id)!);
  const N = files.length;

  log(`linking ${N} files to their nearest files`);
  const linkSet = new Set<number>();
  const links: [number, number][] = [];
  const top = new Int32Array(LINK_K);
  const topS = new Float32Array(LINK_K);
  for (let i = 0; i < N; i++) {
    top.fill(-1); topS.fill(-2);
    const vi = vecs[i];
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const s = dot(vi, vecs[j]);
      if (s <= topS[LINK_K - 1]) continue;
      let p = LINK_K - 1;
      while (p > 0 && topS[p - 1] < s) { topS[p] = topS[p - 1]; top[p] = top[p - 1]; p--; }
      topS[p] = s; top[p] = j;
    }
    for (let t = 0; t < LINK_K; t++) {
      const j = top[t];
      if (j < 0) continue;
      const key = i < j ? i * N + j : j * N + i;
      if (!linkSet.has(key)) { linkSet.add(key); links.push(i < j ? [i, j] : [j, i]); }
    }
    if (i % 1000 === 0) log(`  ${i} / ${N}`);
  }

  log("grouping into topics");
  const all = files.map((_, i) => i);
  const topGroups = kmeans(all, vecs, TOPICS).sort((a, b) => b.length - a.length);
  const subOf = new Int32Array(N);
  const topicOf = new Int32Array(N);
  type G = { members: number[]; cent: Float32Array; name: string; x: number; y: number; r: number };
  const topics: G[] = [];
  const subs: (G & { topic: number })[] = [];
  const sample = (g: number[], cent: Float32Array) =>
    [...g].sort((a, b) => dot(vecs[b], cent) - dot(vecs[a], cent)).slice(0, 14).map((i) => {
      const t = (files[i].text || "").replace(/\s+/g, " ").trim().slice(0, 70);
      return t ? `${cleanName(files[i].name)}: ${t}` : cleanName(files[i].name);
    });

  for (const [t, g] of topGroups.entries()) {
    const cent = centroid(g, vecs);
    const name = await nameGroup(sample(g, cent), topics.map((x) => x.name));
    topics.push({ members: g, cent, name, x: 0, y: 0, r: 0 });
    log(`  topic ${t + 1}/${topGroups.length}: ${name} (${g.length})`);
    const k = g.length < 24 ? 1 : Math.max(2, Math.min(9, Math.round(Math.sqrt(g.length / 10))));
    const parts = k === 1 ? [g] : kmeans(g, vecs, k).sort((a, b) => b.length - a.length);
    const used: string[] = [name];
    for (const p of parts) {
      const pc = centroid(p, vecs);
      const sname = parts.length === 1 ? name : await nameGroup(sample(p, pc), used, name);
      used.push(sname);
      const si = subs.length;
      subs.push({ members: p, cent: pc, name: sname, x: 0, y: 0, r: 0, topic: t });
      for (const i of p) { subOf[i] = si; topicOf[i] = t; }
    }
  }

  log("laying out the map");
  const SPACING = 7.5;
  const tpos = pca2(topics.map((t) => t.cent));
  const tScale = 1400;
  topics.forEach((t, i) => { t.r = Math.sqrt(t.members.length) * SPACING * 1.25; t.x = tpos[i][0] * tScale; t.y = tpos[i][1] * tScale; });
  spread(topics, 0, 0, 40);
  topics.forEach((t, ti) => {
    const mine = subs.filter((s) => s.topic === ti);
    const sp = mine.length > 2 ? pca2(mine.map((s) => s.cent)) : mine.map((_, i) => [Math.cos(i * Math.PI), Math.sin(i * Math.PI)] as [number, number]);
    const m = Math.max(...sp.map(([a, b]) => Math.hypot(a, b)), 1e-6);
    mine.forEach((s, i) => { s.r = Math.sqrt(s.members.length) * SPACING; s.x = t.x + (sp[i][0] / m) * t.r * 0.55; s.y = t.y + (sp[i][1] / m) * t.r * 0.55; });
    spread(mine, t.x, t.y, 12);
  });

  type Node = { i: number; x: number; y: number; vx?: number; vy?: number; hx: number; hy: number };
  const nodes: Node[] = files.map((_, i) => {
    const s = subs[subOf[i]];
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * s.r;
    return { i, x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d, hx: s.x, hy: s.y };
  });
  const sim = forceSimulation(nodes)
    .force("link", forceLink<Node, { source: number; target: number }>(links.map(([a, b]) => ({ source: a, target: b })))
      .distance(14)
      .strength((l) => {
        const a = (l.source as unknown as Node).i, b = (l.target as unknown as Node).i;
        return subOf[a] === subOf[b] ? 0.5 : topicOf[a] === topicOf[b] ? 0.12 : 0.015;
      }))
    .force("charge", forceManyBody().strength(-10).distanceMax(140).theta(0.95))
    .force("x", forceX<Node>((d) => d.hx).strength(0.07))
    .force("y", forceY<Node>((d) => d.hy).strength(0.07))
    .force("collide", forceCollide(3.2).iterations(1))
    .stop();
  for (let i = 0; i < 260; i++) { sim.tick(); if (i % 65 === 0) log(`  tick ${i}`); }

  const recentre = (g: G) => {
    const xs = g.members.map((i) => nodes[i].x), ys = g.members.map((i) => nodes[i].y);
    g.x = xs.reduce((a, b) => a + b, 0) / xs.length;
    g.y = ys.reduce((a, b) => a + b, 0) / ys.length;
    const ds = g.members.map((i) => Math.hypot(nodes[i].x - g.x, nodes[i].y - g.y)).sort((a, b) => a - b);
    g.r = Math.max(20, ds[Math.floor(ds.length * 0.92)] || 20);
  };
  topics.forEach(recentre);
  subs.forEach(recentre);

  const r1 = (v: number) => Math.round(v * 10) / 10;
  const map: AriaMap = {
    builtAt: new Date().toISOString(),
    topics: topics.map((t) => ({ name: t.name, x: r1(t.x), y: r1(t.y), r: r1(t.r), n: t.members.length })),
    subs: subs.map((s) => ({ name: s.name, topic: s.topic, x: r1(s.x), y: r1(s.y), r: r1(s.r), n: s.members.length })),
    nodes: {
      id: files.map((f) => f.drive_id),
      name: files.map((f) => f.name),
      kind: files.map((f) => kindOf(f.mime, f.name)),
      sub: Array.from(subOf),
      x: nodes.map((n) => r1(n.x)),
      y: nodes.map((n) => r1(n.y)),
    },
    links: links.flat(),
  };
  db.prepare("INSERT OR REPLACE INTO aria_map (id, json, built_at) VALUES (1, ?, ?)").run(JSON.stringify(map), map.builtAt);
  log(`done: ${N} files, ${links.length} links, ${topics.length} topics, ${subs.length} subtopics`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
