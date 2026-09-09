/* -------------------------------------------------------------
   KI-Arbeitsblatt-Generator (nur für Lehrer-Konten)

   Ruft die Supabase Edge Function "arbeitsblatt-generieren" auf. Die prüft
   serverseitig, ob die Rolle wirklich "lehrer" ist (nie der Client!), und
   leitet den erzeugten Text von Claude weiter. Das Ergebnis landet als
   neuer Textblock im normalen bloecke-Array – derselbe Weg wie ein von
   Hand angelegtes Textfeld, kein eigener Render-Pfad.

   Ohne eingerichtete Edge Function (siehe KONTO-SETUP.md) bleibt das Panel
   im HTML versteckt (siehe konto.js, zeigeRollenUI()) – dieser Code läuft
   dann einfach nie.
------------------------------------------------------------- */

const kiThemaEl = document.getElementById("ki-thema");
const kiErzeugenBtn = document.getElementById("ki-erzeugen");
const kiStatusEl = document.getElementById("ki-status");

function kiMelde(text, warnung = false) {
  kiStatusEl.textContent = text;
  kiStatusEl.dataset.warn = warnung ? "true" : "false";
}

kiErzeugenBtn.addEventListener("click", async () => {
  const thema = kiThemaEl.value.trim();
  if (!thema) {
    kiMelde("Bitte ein Thema eingeben.", true);
    return;
  }
  if (!window.supabaseClient) {
    kiMelde("Konto/Supabase nicht verbunden.", true);
    return;
  }

  kiErzeugenBtn.disabled = true;
  kiMelde("Text wird erzeugt …");

  const { data, error } = await window.supabaseClient.functions.invoke(
    "arbeitsblatt-generieren",
    { body: { thema } }
  );

  kiErzeugenBtn.disabled = false;

  if (error || !data?.text) {
    kiMelde(`Fehlgeschlagen: ${data?.error || error?.message || "unbekannter Fehler"}`, true);
    return;
  }

  // Neuer Textblock statt Überschreiben – bestehender Text bleibt erhalten.
  // Absichtlich NICHT neuesTextfeld() genutzt: das öffnet nach dem Rendern
  // automatisch einen Bearbeiten-Modus (praktisch bei Doppelklick, hier
  // würde es sich mit dem eigenen render() unten in die Quere kommen).
  const id = naechsteBlockId++;
  bloecke.push({
    id, type: "text", text: data.text,
    x: BASE_MARGIN.left, y: BASE_MARGIN.top, w: 340, seite: 0,
  });
  ausgewaehlt = new Set([id]);
  render();
  sicherePunkt();

  kiMelde("Text eingefügt.");
});
