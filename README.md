# ✍️ Handschrift-Generator

Verwandelt getippten Text in ein Blatt, das aussieht, als wäre es mit der Hand
geschrieben. Läuft komplett im Browser – ohne Server, ohne Installation.

**[→ Live ausprobieren](#)** *(Link eintragen, sobald über GitHub Pages veröffentlicht)*

## Funktionen

- **Frei verschiebbare Textfelder** – direkt auf dem Blatt anklicken, ziehen,
  in der Größe ändern, per Doppelklick bearbeiten; Doppelklick auf eine
  freie Stelle legt ein neues Textfeld an
- **Mehrseitige Dokumente** – "Seite hinzufügen" legt eine weitere Seite an,
  und ein zu langes Textfeld läuft automatisch auf der nächsten Seite weiter
- **Bilder & Unterschriften einfügen** – eigenes Foto/Bild einfügen oder eine
  fotografierte Unterschrift, bei der helle/weiße Bereiche automatisch
  transparent werden
- **Mehrfachauswahl, Ausrichten & Anordnen** – mehrere Textfelder per
  Umschalt-Klick auswählen und bündig ausrichten, nach vorne/hinten stellen
- **Rückgängig / Wiederholen** (Strg+Z / Strg+Umschalt+Z)
- **22 Schriftarten** in drei Gruppen (Druckschrift, Schreibschrift, Kalligrafie)
- **Eigene Handschrift einlesen** – Vorlage ausdrucken, ausfüllen, abfotografieren
- **Konto** (optional) – Handschrift bleibt geräteübergreifend erhalten
- **7 Papiervorlagen** mit Bildvorschau zum Anklicken (liniert in drei
  Abständen, kariert, Punktraster, Cornell-Notizen, blanko)
- Regler für Schriftgröße und „Unordentlichkeit"
- Vier Tintenfarben
- Download als PNG (1588 × 2246 px, eine Datei pro Seite) oder als
  **mehrseitiges PDF für GoodNotes**
- Automatischer Zeilenumbruch inkl. Silbentrennung bei langen Wörtern
- Schriftarten liegen lokal (nicht bei Google), aus Datenschutzgründen

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

## Frei verschiebbare Textfelder

Der Text liegt nicht mehr fest an einem Rand, sondern in `bloecke` – einer
Liste von Textfeldern mit eigener Position (`x`, `y`) und Breite (`w`).
`render()` in `script.js` zeichnet jedes davon einzeln und merkt sich danach
in `letzteBlockBoxen`, wo genau auf dem Blatt jedes gelandet ist.

Der Canvas selbst kann nichts anklicken lassen – sobald etwas gezeichnet ist,
sind es nur noch Pixel. Deshalb übernimmt `editor.js` das Bedienbare: Über
dem Canvas liegt eine unsichtbare HTML-Ebene (`#text-layer`) mit einer
Klick-/Zieh-Fläche pro Textfeld, positioniert per Prozent (damit es auch bei
verkleinertem Fenster exakt passt). Doppelklick darauf blendet kurz ein
`<textarea>` ein, das den Text des Textfelds direkt auf dem Blatt bearbeitbar
macht; beim Verlassen wandert der neue Text zurück ins Datenmodell und das
Blatt wird neu gezeichnet.

Textfeld 1 ist zweiseitig mit dem Textfeld in der Seitenleiste gekoppelt –
beide bearbeiten denselben Text, egal auf welchem Weg man ihn ändert.

### Größe, Mehrfachauswahl, Ausrichten & Anordnen

An den blauen Punkten am ausgewählten Textfeld lässt sich die Breite (und
damit der Zeilenumbruch) sowie die Höhe ziehen. Eine von Hand gesetzte Höhe
(`block.h`) begrenzt zusätzlich die Zeilenzahl – wie beim Seitenende wird zu
viel Text dann als "passt nicht" gemeldet, statt einfach zu verschwinden.

Umschalt- oder Cmd/Strg-Klick fügt weitere Textfelder zur Auswahl hinzu. Ab
zwei ausgewählten Textfeldern erscheint eine Werkzeugleiste zum Ausrichten
(an den äußersten Rändern der gesamten Auswahl, wie in Word). "Nach
vorne"/"nach hinten" verschiebt die ausgewählten Textfelder einfach ans Ende
bzw. an den Anfang des `bloecke`-Arrays – das bestimmt gleichzeitig die
Zeichenreihenfolge auf dem Canvas *und* die Stapelreihenfolge im DOM, es
brauchte also keine zusätzliche z-index-Verwaltung.

### Rückgängig / Wiederholen

Ein einfacher Verlaufs-Stapel in `editor.js`: Aufgezeichnet wird nicht bei
jeder Mausbewegung, sondern nur am Ende einer Aktion (Ziehen/Größe-Ändern
fertig, Textfeld verlassen, hinzugefügt, gelöscht, ausgerichtet, ...) – sonst
bräuchte man beim Rückgängigmachen einer einzigen Zieh-Bewegung hunderte
Klicks. Strg+Z funktioniert nicht, während in einem Textfeld getippt wird –
dort greift stattdessen das eingebaute Undo des Browsers. Position/Größe
werden bei jeder Mausbewegung sofort im Datenmodell aktualisiert (nur das
Neuzeichnen ist über `requestAnimationFrame` gedrosselt) – sonst könnte ein
schnelles Loslassen der Maus den letzten Bewegungsschritt verpassen und ein
veralteter Stand würde gesichert.

## Mehrere Seiten

Jede Seite hat ihr eigenes `<canvas>` plus eigene `.text-layer`-Ebene
(`richteSeitenEin()` in `script.js` legt bzw. entfernt sie bei Bedarf). Damit
alle vorhandenen Zeichenfunktionen unverändert weiterlaufen, ist `ctx` in
`script.js` keine feste Konstante mehr, sondern zeigt beim Zeichnen jeweils
auf das Canvas der gerade aktiven Seite.

Ein Textfeld, das nicht mehr auf eine Seite passt, läuft automatisch auf der
nächsten weiter (`render()`s Layoutdurchlauf verteilt die Zeilen auf so viele
Seiten wie nötig) – die Wackel-/Neigungs-Muster laufen dabei nahtlos über den
Seitenumbruch hinweg fort, damit es nicht wie ein Bruch aussieht. Über
„📄 Seite hinzufügen“ lässt sich zusätzlich manuell eine leere Seite anlegen.

Weil Seiten dynamisch entstehen und verschwinden können, hängen Klick-/Zieh-
Ereignisse nicht mehr an einzelnen Elementen, sondern per Delegation am
gemeinsamen Elternteil `#page-wrap` – eine neue Seite braucht dadurch keine
eigene Verkabelung.

## Bilder & Unterschriften

„🖼️ Bild einfügen“ und „✍️ Unterschrift einfügen“ legen einen Block vom Typ
`image` an (statt `text`) – er lässt sich wie ein Textfeld verschieben, in
der Größe ändern und löschen, nur der Doppelklick ersetzt das Bild statt
einen Text-Editor zu öffnen.

Bei Unterschriften werden helle/weiße Bereiche automatisch transparent
gemacht (`entferneWeiss()` in `editor.js`): Das Foto landet kurz auf einem
Hilfs-Canvas, jedes Pixel über einer Helligkeitsschwelle wird durchsichtig
geschaltet (mit weichem statt hartem Übergang), damit die Blattlinien durch
die Unterschrift hindurchscheinen statt hinter einem weißen Rechteck zu
verschwinden.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Aufbau der Seite |
| `style.css` | Gestaltung, inkl. Dark Mode |
| `script.js` | Zeichen-Engine, Textfelder, Papiervorlagen, PDF-Export |
| `editor.js` | Textfelder direkt auf dem Blatt anklicken, verschieben, bearbeiten |
| `scanner.js` | Vorlage, Foto-Entzerrung, Buchstaben-Extraktion |
| `konto.js` | Anmeldung und Sicherung bei Supabase |
| `config.js` | Zugangsdaten für Supabase (leer = App läuft ohne Konto) |
| `fonts.css` / `fonts/` | Lokal gehostete Schriftarten (kein Google-Fonts-CDN) |
| `impressum.html` | Impressum |
| `datenschutz.html` | Datenschutzerklärung |

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

- [ ] Ecken automatisch finden, statt sie anzuklicken
- [ ] Mehrere Varianten pro Buchstabe (zweite Vorlagenseite)
- [ ] Konto selbst löschen können (aktuell nur per E-Mail an den Betreiber)
