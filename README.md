# mEHmoiren

Geschichten aus Ehmen aufschreiben, damit keine verloren geht.

Eine kleine Webseite (`index.html` + `app.js`) mit einer Server-Funktion
(`api/stories.js`), die die Anmeldung prüft und die Geschichten in
**Vercel Blob** speichert. Kein Framework, kein Build-Schritt.

## Auf Vercel einrichten

1. Vercel → **Add New… → Project** → dieses Repository `mehmoiren` importieren
   → ohne Änderungen **Deploy**.
2. Im Projekt: **Storage → Create → Blob** → Store anlegen und mit dem
   Projekt **verbinden** (setzt `BLOB_READ_WRITE_TOKEN` automatisch).
3. **Deployments → … → Redeploy**, damit der Speicher aktiv ist.

Ohne Schritt 2 lassen sich Geschichten lesen, aber nicht dauerhaft speichern.

## Anmeldung

Standard: Anmeldename `Ehmen`, Passwort `Ehmen1`.
Ändern über die Umgebungsvariablen `MEHMOIREN_USER` und
`MEHMOIREN_PASSWORD` (Vercel → Settings → Environment Variables, danach
Redeploy).

## Daten

- Beim ersten Start ohne gespeicherte Daten zeigt die App den Startbestand
  aus `api/_seed.js`.
- Jede Änderung legt einen neuen Stand in Blob ab; die letzten 30 Stände
  bleiben als Sicherung erhalten (Vercel → Storage → Blob → `mehmoiren/`).
