// GET  /api/stories           -> { stories }
// POST /api/stories { op, ... } -> { stories }
//   op "add":    { story: { title, when, who, text } }
//   op "update": { id, story: { title, when, who, text } }
//   op "delete": { id }
// Jede Anfrage braucht den Header "x-mehmoiren-login" = base64("Name:Passwort").
import { timingSafeEqual, randomUUID } from "node:crypto";
import { loadStories, saveStories } from "./_store.js";

const USER = process.env.MEHMOIREN_USER || "Ehmen";
const PASSWORD = process.env.MEHMOIREN_PASSWORD || "Ehmen1";

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function loggedIn(req) {
  const raw = req.headers["x-mehmoiren-login"];
  if (!raw) return false;
  let decoded = "";
  try { decoded = Buffer.from(String(raw), "base64").toString("utf8"); } catch { return false; }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const okUser = same(decoded.slice(0, i), USER);
  const okPass = same(decoded.slice(i + 1), PASSWORD);
  return okUser && okPass;
}

const LIMITS = { title: 140, when: 60, who: 120, text: 20000 };
function clean(input) {
  const out = {};
  for (const [k, max] of Object.entries(LIMITS)) out[k] = String(input?.[k] ?? "").trim().slice(0, max);
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!loggedIn(req)) return res.status(401).json({ error: "Anmeldename oder Passwort stimmt nicht." });

  try {
    if (req.method === "GET") return res.status(200).json({ stories: await loadStories() });
    if (req.method !== "POST") return res.status(405).json({ error: "Nicht erlaubt." });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const stories = await loadStories();
    let next;

    if (body.op === "add") {
      const story = clean(body.story);
      if (!story.text) return res.status(400).json({ error: "Die Geschichte ist leer." });
      next = [{ id: randomUUID(), ...story, createdAt: Date.now() }, ...stories];
    } else if (body.op === "update") {
      const story = clean(body.story);
      if (!story.text) return res.status(400).json({ error: "Die Geschichte ist leer." });
      if (!stories.some((s) => s.id === body.id)) return res.status(404).json({ error: "Diese Geschichte gibt es nicht mehr." });
      next = stories.map((s) => (s.id === body.id ? { ...s, ...story, updatedAt: Date.now() } : s));
    } else if (body.op === "delete") {
      next = stories.filter((s) => s.id !== body.id);
    } else {
      return res.status(400).json({ error: "Unbekannte Aktion." });
    }

    await saveStories(next);
    return res.status(200).json({ stories: next });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Speichern hat nicht geklappt. Bitte gleich nochmal versuchen." });
  }
}
