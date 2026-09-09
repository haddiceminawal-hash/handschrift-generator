# ✍️ Handschrift-Generator

Verwandelt getippten Text in ein Blatt, das aussieht, als wäre es mit der Hand
geschrieben. Läuft komplett im Browser – ohne Server, ohne Installation.

**[→ Live ausprobieren](#)** *(Link eintragen, sobald über GitHub Pages veröffentlicht)*

## Funktionen

- **22 Schriftarten** in drei Gruppen (Druckschrift, Schreibschrift, Kalligrafie)
- **Eigene Handschrift einlesen** – Vorlage ausdrucken, ausfüllen, abfotografieren
- **Konto** (optional) – Handschrift bleibt geräteübergreifend erhalten
- **7 Papiervorlagen** mit Bildvorschau zum Anklicken (liniert in drei
  Abständen, kariert, Punktraster, Cornell-Notizen, blanko)
- Regler für Schriftgröße und „Unordentlichkeit"
- Vier Tintenfarben
- Download als PNG (1588 × 2246 px) oder als **PDF für GoodNotes**
- Automatischer Zeilenumbruch inkl. Silbentrennung bei langen Wörtern

## Wie die Handschrift entsteht

Der Text wird nicht einfach mit einer Schriftart hingeschrieben, sondern
**Buchstabe für Buchstabe** auf ein Canvas gezeichnet. Jeder einzelne bekommt dabei:

| Eigenschaft | Wirkung |
|---|---|
| Drehung | Buchstaben stehen leicht schief |
| Höhenversatz | sie tanzen um die Linie |
| Breite & Höhe | derselbe Buchstabe sieht nie zweimal gleich aus |
| Neigung | wechselnde Schräglage wie beim echten Schreiben |
| Deckkraft | Tinte mal kräftiger, mal blasser |
| Abstand | ungleichmäßige Lücken, Wortabstände schwanken stärker |

Dazu kommt pro Zeile eine leichte Welle (Sinus) und eine zufällige Schräglage –
denn von Hand schreibt niemand exakt waagerecht.

### Warum kein `Math.random()`?

Der Zufall wird aus Zeilen- und Buchstabennummer **berechnet** (`rand01()`),
nicht gewürfelt. Sonst würde sich beim Tippen bei jedem Tastendruck das ganze
Blatt neu anordnen. So bleibt alles ruhig stehen – und der Button
„Neu würfeln" ändert einfach den Startwert.

## Papiervorlagen & GoodNotes-Export

Der Papier-Auswähler zeigt für jede Vorlage ein kleines Vorschaubild statt
nur eines Namens – man sieht vorher, wie das Blatt aussieht. Jede Vorlage
hat eine eigene Zeichenfunktion (`zeichneLinien`, `zeichneKaros`,
`zeichnePunkte`, `zeichneCornell`), die sowohl für das große Blatt als auch
für das jeweilige Vorschaubild benutzt wird (`zeichnePapierGrund`).

Cornell-Notizen brauchen mehr Rand als die anderen Vorlagen (Stichwort-Spalte
links, Zusammenfassung unten). Deshalb ist `MARGIN` in `script.js` bewusst
keine feste Konstante, sondern wird vor jedem Zeichnen passend zur gewählten
Vorlage neu gesetzt (`margeFuer()`).

**Zum GoodNotes-Button:** GoodNotes hat kein offenes, dokumentiertes
Dateiformat – eine echte `.goodnotes`-Datei von außen zu bauen wäre nur eine
kaputte Attrappe. Der Button erzeugt deshalb ein **PDF**, denn das ist auch
der Weg, den gekaufte GoodNotes-Vorlagen tatsächlich gehen: in GoodNotes
importieren (Importieren → Als neues Dokument) und direkt draufschreiben.
Die PDF-Erzeugung übernimmt [jsPDF](https://github.com/parallax/jsPDF), das
wie Supabase erst bei Bedarf per `import()` nachgeladen wird.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Aufbau der Seite |
| `style.css` | Gestaltung, inkl. Dark Mode |
| `script.js` | Zeichen-Engine, Papiervorlagen, PDF-Export |
| `scanner.js` | Vorlage, Foto-Entzerrung, Buchstaben-Extraktion |
| `konto.js` | Anmeldung und Sicherung bei Supabase |
| `config.js` | Zugangsdaten für Supabase (leer = App läuft ohne Konto) |

## Lokal starten

```bash
python3 -m http.server 8794
```

Dann `http://localhost:8794` im Browser öffnen.

## Eigene Handschrift einlesen

Es gibt drei Zeichen-Modi. Welcher greift, hängt von der gewählten Schrift ab:

| Modus | Wann | Warum |
|---|---|---|
| **Druckschrift** | Buchstaben stehen einzeln | jeder Buchstabe wird einzeln verzerrt |
| **Schreibschrift** | Buchstaben sind verbunden | wortweise zeichnen, sonst reißen die Verbindungsstriche |
| **Eigene Handschrift** | nach dem Einscannen | ausgeschnittene Bilder statt Schriftart |

### Wie das Einlesen funktioniert

1. **Vorlage** – 81 Kästchen (a–z, A–Z, ÄÖÜäöüß, 0–9, Satzzeichen), jedes mit
   Vorgabe-Buchstaben und gestrichelter Grundlinie, dazu vier schwarze Eck-Marker.
2. **Foto** – Blatt abfotografieren; dabei ist es immer perspektivisch verzerrt.
3. **Vier Ecken anklicken** – daraus wird eine **Homographie** berechnet, also die
   3×3-Matrix, die das schiefe Viereck zurück auf ein Rechteck abbildet
   (Gauß-Verfahren, `solve()` in `scanner.js`).
4. **Ausschneiden** – da die Vorlage vorgibt, welcher Buchstabe in welchem Kästchen
   steht, muss nichts *erkannt* werden. Pro Kästchen wird der Kontrast gemessen,
   die Tinte freigestellt und auf den belegten Bereich zugeschnitten.

Die Buchstaben werden als transparente Masken gespeichert und beim Zeichnen in der
gewählten Tintenfarbe eingefärbt (`tintGlyph()`). Ablage in `localStorage`, bleibt
also nach dem Schließen erhalten.

> **Warum keine echte Handschrifterkennung?** Ein beliebiges Dokument hochladen und
> die Schrift automatisch erkennen hieße: herausfinden, wo ein Buchstabe aufhört
> (bei verbundener Schrift kaum lösbar) *und* welcher es ist. Das braucht KI-Modelle
> und bleibt unzuverlässig. Der Vorlagen-Weg umgeht beide Probleme – und ist
> derselbe, den Calligraphr kommerziell nutzt.

## Konto (optional)

Ohne Konto liegt die Handschrift nur im `localStorage` – also in genau einem
Browser. Mit Konto liegt sie zusätzlich bei **Supabase** und kommt nach dem
Anmelden auf jedem Gerät zurück.

- **Zwei Wege, sich anzumelden**: klassisch mit E-Mail + Passwort (inkl.
  Registrieren und "Passwort vergessen") oder per Magic-Link ohne Passwort.
- Beim Anmelden wird **abgeglichen**: Liegt etwas im Konto, gewinnt das Konto.
  Liegt nur lokal etwas, wandert es ins Konto.
- Nach jedem erfolgreichen Einscannen wird automatisch gesichert.
- Jede Datei liegt unter `<nutzer-id>/handschrift.json`. Dass niemand fremde
  Ordner lesen kann, regeln die Policies in der Datenbank – nicht der Schlüssel
  im Quelltext.

Einrichtung: siehe **[KONTO-SETUP.md](KONTO-SETUP.md)**. Ohne Einrichtung
funktioniert alles andere unverändert weiter.

## Nächste Schritte

- [ ] Mehrseitige Texte (auch als mehrseitiges PDF)
- [ ] Ecken automatisch finden, statt sie anzuklicken
- [ ] Mehrere Varianten pro Buchstabe (zweite Vorlagenseite)
- [ ] Impressum & Datenschutzerklärung, bevor echte Nutzer dazukommen
