// Speicher für die Geschichten.
// Auf Vercel: Vercel Blob (jede Änderung wird als neue Datei abgelegt, die
// letzten Stände bleiben als Sicherung erhalten). Lokal ohne Token: eine
// Datei unter .data/, damit man ohne Vercel testen kann.
import { put, list, del } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";
import seed from "./_seed.js";

const PREFIX = "mehmoiren/stories-";
const KEEP_VERSIONS = 30;
const LOCAL_FILE = path.join(process.cwd(), ".data", "stories.json");

const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

async function listVersions() {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

export async function loadStories() {
  if (!useBlob()) {
    try { return JSON.parse(await fs.readFile(LOCAL_FILE, "utf8")); }
    catch { return structuredClone(seed); }
  }
  const [newest] = await listVersions();
  if (!newest) return structuredClone(seed);
  const res = await fetch(newest.url, { cache: "no-store" });
  if (!res.ok) throw new Error("Geschichten konnten nicht geladen werden (" + res.status + ")");
  return res.json();
}

export async function saveStories(stories) {
  const body = JSON.stringify(stories);
  if (!useBlob()) {
    await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
    await fs.writeFile(LOCAL_FILE, body);
    return;
  }
  // Zufälliger Namenszusatz: die Datei-Adresse ist nicht erratbar.
  await put(PREFIX + Date.now() + ".json", body, {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/json",
  });
  const old = (await listVersions()).slice(KEEP_VERSIONS);
  if (old.length) await del(old.map((b) => b.url));
}
