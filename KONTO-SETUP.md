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

## 7. Rollen (Lehrer/Schüler) und KI-Arbeitsblatt-Generator (optional)

Ohne diesen Schritt funktioniert alles wie bisher: Jede:r gilt beim
Registrieren implizit als Schüler:in, das KI-Panel bleibt für alle
versteckt. Erst mit dieser Einrichtung erscheint bei der Registrierung eine
Auswahl "Lehrer*in" / "Schüler*in", und Lehrer-Konten bekommen einen
KI-Arbeitsblatt-Generator (Thema eingeben → Claude erzeugt Übungstext).

**a) Rollen-Tabelle anlegen** – im **SQL Editor** einfügen und ausführen:

```sql
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null check (role in ('lehrer', 'schueler')),
  ai_uses_heute int not null default 0,
  ai_uses_datum date not null default current_date,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "eigenes Profil lesen"
on public.profiles for select to authenticated
using (id = auth.uid());

-- Bewusst KEINE insert/update/delete-Policy für "authenticated" – dadurch
-- kann sich niemand selbst zum Lehrer machen, geschrieben wird nur vom
-- Trigger unten und von der KI-Funktion (Schritt c).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'role' = 'lehrer'
         then 'lehrer' else 'schueler' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

**b) Anthropic-API-Key holen** – auf
[console.anthropic.com](https://console.anthropic.com) registrieren und
einen API-Key erstellen. **Kostet Geld pro Anfrage** (Cent-Bereich pro
Arbeitsblatt) – vorher kurz die Preisseite anschauen.

**c) Edge Function anlegen** – unter **Edge Functions → Deploy a new
function**:

- Name **exakt** `arbeitsblatt-generieren` (muss zum Aufruf in `ki.js`
  passen)
- Den Inhalt von
  [`supabase/functions/arbeitsblatt-generieren/index.ts`](supabase/functions/arbeitsblatt-generieren/index.ts)
  aus diesem Repo hineinkopieren

**d) Anthropic-Key als Secret hinterlegen** – unter **Edge Functions →
Secrets** einen Eintrag `ANTHROPIC_API_KEY` mit dem Key aus Schritt b
anlegen.

> **Der Anthropic-Key gehört, genau wie der `service_role`-Key, niemals in
> `config.js` oder eine andere Datei, die im Browser landet.** Er lebt
> ausschließlich als Function-Secret.

Ein paar ehrliche Hinweise dazu:

- "Lehrer*in" wird bei der Registrierung selbst gewählt, nicht gegen eine
  echte Schule geprüft – das ist Absicht, keine Sicherheitslücke. Was die
  `profiles`-Tabelle verhindert, ist nur, dass sich ein Schüler-Konto
  *nachträglich* selbst zum Lehrer hochstuft.
- Das Tageslimit (20 Generierungen pro Konto) ist eine bewusst grobe
  Kostenbremse, kein echtes Rate-Limiting – bei richtiger Nutzung später
  verfeinern.
- Wird die Funktion über das Dashboard per Copy-Paste eingerichtet, am
  besten immer zuerst die Datei im Repo ändern und dann neu einfügen, sonst
  laufen beide Stände auseinander.

---

## Bevor echte Nutzer dazukommen

Ab dem Moment, wo andere Menschen sich anmelden, speicherst du deren
personenbezogene Daten. Dann brauchst du:

- **Impressum** und **Datenschutzerklärung** auf der Seite
- eine Angabe, was gespeichert wird (E-Mail-Adresse, Handschrift-Bilder) und wie
  lange
- eine Möglichkeit, das Konto samt Daten löschen zu lassen

Solange du die App nur selbst benutzt, ist das kein Thema. Vorher aber genau
anschauen (siehe `impressum.html` und `datenschutz.html`).
