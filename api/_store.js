// Speicher für die Geschichten.
// Auf Vercel: Vercel Blob (jede Änderung wird als neue Datei abgelegt, die
// letzten Stände bleiben als Sicherung erhalten). Funktioniert mit privaten
// und öffentlichen Blob-Speichern und mit beiden Verbindungsarten
// (BLOB_READ_WRITE_TOKEN oder BLOB_STORE_ID über Vercel OIDC).
// Lokal ohne Vercel: eine Datei unter .data/, damit man ohne Vercel testen kann.
import { put, get, list, del } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";
import seed from "./_seed.js";

const PREFIX = "mehmoiren/stories-";
const KEEP_VERSIONS = 30;
const LOCAL_FILE = path.join(process.cwd(), ".data", "stories.json");

const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const onVercel = () => Boolean(process.env.VERCEL);

// Privat oder öffentlich: per Umgebungsvariable festlegbar, sonst wird
// beim ersten Zugriff ausprobiert, welche Art der Speicher annimmt.
let access = process.env.MEHMOIREN_BLOB_ACCESS || null;
const accessOrder = () => (access ? [access] : ["private", "public"]);

function useLocal() {
  if (hasBlob()) return false;
  if (onVercel()) {
    throw new Error("Kein Blob-Speicher mit dem Projekt verbunden. Bei Vercel unter Storage einen Blob-Speicher mit dem Projekt verbinden und danach neu deployen.");
  }
  return true;
}

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
  if (useLocal()) {
    try { return JSON.parse(await fs.readFile(LOCAL_FILE, "utf8")); }
    catch { return structuredClone(seed); }
  }
  const [newest] = await listVersions();
  if (!newest) return structuredClone(seed);
  let lastErr;
  for (const a of accessOrder()) {
    try {
      const result = await get(newest.pathname, { access: a, useCache: false });
      if (!result || result.statusCode !== 200) throw new Error("Datei nicht gefunden");
      access = a;
      return JSON.parse(await new Response(result.stream).text());
    } catch (err) { lastErr = err; }
  }
  throw lastErr;
}

export async function saveStories(stories) {
  const body = JSON.stringify(stories);
  if (useLocal()) {
    await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
    await fs.writeFile(LOCAL_FILE, body);
    return;
  }
  let lastErr, saved = false;
  for (const a of accessOrder()) {
    try {
      // Zufälliger Namenszusatz: die Datei-Adresse ist nicht erratbar.
      await put(PREFIX + Date.now() + ".json", body, {
        access: a,
        addRandomSuffix: true,
        contentType: "application/json",
      });
      access = a; saved = true;
      break;
    } catch (err) { lastErr = err; }
  }
  if (!saved) throw lastErr;
  try {
    const old = (await listVersions()).slice(KEEP_VERSIONS);
    if (old.length) await del(old.map((b) => b.url));
  } catch (err) {
    console.error("Alte Stände konnten nicht aufgeräumt werden", err);
  }
}
