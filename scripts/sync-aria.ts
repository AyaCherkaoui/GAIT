/**
 * Indexes the ARIA Google Drive folder into the local SQLite search index.
 * Usage: npm run sync-aria   (first run opens a Google sign-in in the browser)
 */
import fs from "node:fs";
import http from "node:http";
import { exec } from "node:child_process";
import { google, type drive_v3 } from "googleapis";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { getDb } from "../lib/db";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: rely on the shell environment
}

const TOKEN_FILE = ".google-token.json";
const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}/callback`;
const MAX_CHARS = 200_000;
const FOLDER = "application/vnd.google-apps.folder";

async function authorize() {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error("Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local (see AGENTS.md).");
  const client = new google.auth.OAuth2(id, secret, REDIRECT);
  client.on("tokens", (t) => {
    const old = fs.existsSync(TOKEN_FILE) ? JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")) : {};
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ ...old, ...t }), { mode: 0o600 });
  });
  if (fs.existsSync(TOKEN_FILE)) {
    client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")));
    return client;
  }
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const code = await new Promise<string>((resolve) => {
    const server = http
      .createServer((req, res) => {
        const c = new URL(req.url ?? "/", REDIRECT).searchParams.get("code");
        res.end(c ? "GAIT is connected to Google Drive. You can close this tab." : "No sign-in code received.");
        if (c) {
          server.close();
          resolve(c);
        }
      })
      .listen(PORT, () => {
        console.log(`Sign in to Google in your browser. If it does not open, visit:\n${url}\n`);
        if (process.platform === "darwin") exec(`open "${url}"`);
      });
  });
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens), { mode: 0o600 });
  return client;
}

async function* walk(drive: drive_v3.Drive, folderId: string): AsyncGenerator<drive_v3.Schema$File> {
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime)",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      if (f.mimeType === FOLDER) yield* walk(drive, f.id!);
      else yield f;
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
}

async function download(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
  const res = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  return Buffer.from(res.data as unknown as ArrayBuffer);
}

async function exportText(drive: drive_v3.Drive, fileId: string, mimeType: string): Promise<string> {
  const res = await drive.files.export({ fileId, mimeType }, { responseType: "text" });
  return String(res.data);
}

async function extract(drive: drive_v3.Drive, f: drive_v3.Schema$File): Promise<string> {
  const id = f.id!;
  switch (f.mimeType) {
    case "application/vnd.google-apps.document":
    case "application/vnd.google-apps.presentation":
      return exportText(drive, id, "text/plain");
    case "application/vnd.google-apps.spreadsheet":
      return exportText(drive, id, "text/csv");
    case "application/pdf": {
      const pdf = await getDocumentProxy(new Uint8Array(await download(drive, id)));
      const { text } = await extractText(pdf, { mergePages: true });
      return text;
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return (await mammoth.extractRawText({ buffer: await download(drive, id) })).value;
    case "text/plain":
    case "text/markdown":
    case "text/csv":
      return (await download(drive, id)).toString("utf8");
    default:
      return ""; // other types are indexed by name only
  }
}

async function main() {
  const folderId = process.env.ARIA_FOLDER_ID;
  if (!folderId) throw new Error("Add ARIA_FOLDER_ID to .env.local (the last part of the ARIA folder's Drive URL).");
  const drive = google.drive({ version: "v3", auth: await authorize() });
  const db = getDb();
  const del = db.prepare("DELETE FROM aria_docs WHERE drive_id = ?");
  const ins = db.prepare("INSERT INTO aria_docs (drive_id, name, mime, url, modified, text) VALUES (?, ?, ?, ?, ?, ?)");
  const seen = new Set<string>();
  let withText = 0;
  let nameOnly = 0;
  let failed = 0;
  for await (const f of walk(drive, folderId)) {
    seen.add(f.id!);
    let text = "";
    try {
      text = (await extract(drive, f)).slice(0, MAX_CHARS);
    } catch (e) {
      failed++;
      console.warn(`  could not read "${f.name}": ${(e as Error).message}`);
    }
    if (text.trim()) withText++;
    else nameOnly++;
    del.run(f.id!);
    ins.run(f.id!, f.name ?? "", f.mimeType ?? "", f.webViewLink ?? "", f.modifiedTime ?? "", text);
    process.stdout.write(`\rindexed ${seen.size} files`);
  }
  const existing = db.prepare("SELECT drive_id FROM aria_docs").all() as { drive_id: string }[];
  let removed = 0;
  for (const { drive_id } of existing) {
    if (!seen.has(drive_id)) {
      del.run(drive_id);
      removed++;
    }
  }
  console.log(`\nDone: ${withText} with text, ${nameOnly} by name only, ${failed} unreadable, ${removed} removed.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
