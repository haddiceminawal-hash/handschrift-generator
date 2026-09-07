# Konto einrichten (Supabase)

Dauert etwa 10 Minuten. Danach bleibt deine Handschrift erhalten – auch auf
anderen Geräten.

Ohne diese Einrichtung funktioniert die App ganz normal weiter, die Handschrift
liegt dann nur im Browser (`localStorage`).

---

## 1. Projekt anlegen

1. Auf [supabase.com](https://supabase.com) ein Konto erstellen (kostenlos).
2. **New Project** – Name z.B. `handschrift`, Region **Frankfurt** wählen
   (kürzeste Wege, und die Daten bleiben in der EU).
3. Das Datenbank-Passwort, das dabei angezeigt wird, gut aufbewahren.

## 2. Die beiden Werte eintragen

Im Projekt unter **Project Settings → API** stehen zwei Angaben:

| Feld im Dashboard | gehört in `config.js` |
|---|---|
| Project URL | `window.SUPABASE_URL` |
| `anon` `public` key | `window.SUPABASE_ANON_KEY` |

```js
window.SUPABASE_URL = "https://xxxxxxxx.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

> **Der `anon`-Key darf öffentlich sein.** Er ist dafür gemacht, im Quelltext zu
> stehen. Geschützt wird nichts durch ihn, sondern durch die Regeln in Schritt 4.
>
> **Der `service_role`-Key darf das niemals.** Der umgeht alle Regeln. Er bleibt
> im Dashboard – nicht in `config.js`, nicht auf GitHub, nirgends.

## 3. Speicherort anlegen

**Storage → New bucket**

- Name: `handschriften`
- **Public bucket: aus** (wichtig – sonst könnte jeder die Dateien abrufen)

## 4. Zugriffsregeln setzen

Das ist der Schritt, der die Daten tatsächlich schützt. Unter **SQL Editor**
einfügen und ausführen:

```sql
-- Jeder darf ausschließlich in seinem eigenen Ordner lesen und schreiben.
-- Der Ordnername ist die Nutzer-ID, vergeben von Supabase.

create policy "eigene Handschrift lesen"
on storage.objects for select to authenticated
using (
  bucket_id = 'handschriften'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "eigene Handschrift anlegen"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'handschriften'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "eigene Handschrift ersetzen"
on storage.objects for update to authenticated
using (
  bucket_id = 'handschriften'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

## 5. Anmelde-Link erlauben

Unter **Authentication → URL Configuration** bei *Redirect URLs* eintragen:

```
http://localhost:8794
```

Sobald die App online ist, kommt die echte Adresse zusätzlich dazu, z.B.
`https://deinname.github.io/handschrift`.

## 6. Ausprobieren

Seite neu laden → **👤 Konto** aufklappen → E-Mail eingeben → Link im Postfach
anklicken. Danach wird eine vorhandene Handschrift automatisch gesichert und
beim nächsten Anmelden wieder geladen.

---

## Bevor echte Nutzer dazukommen

Ab dem Moment, wo andere Menschen sich anmelden, speicherst du deren
personenbezogene Daten. Dann brauchst du:

- **Impressum** und **Datenschutzerklärung** auf der Seite
- eine Angabe, was gespeichert wird (E-Mail-Adresse, Handschrift-Bilder) und wie
  lange
- eine Möglichkeit, das Konto samt Daten löschen zu lassen

Solange du die App nur selbst benutzt, ist das kein Thema. Vorher aber genau
anschauen – und bei Minderjährigkeit vorher mit deinen Eltern besprechen.
