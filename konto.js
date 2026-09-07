/* -------------------------------------------------------------
   Konto & Sicherung in der Cloud

   Ohne Konto liegt die eingescannte Handschrift nur im localStorage
   dieses einen Browsers. Wechselt man das Gerät oder leert den Cache,
   ist sie weg. Mit Konto liegt sie zusätzlich bei Supabase und kommt
   nach dem Anmelden automatisch zurück.

   Angemeldet wird per Magic-Link: E-Mail eingeben, Link anklicken,
   fertig. Es gibt bewusst kein Passwort – was nicht existiert, kann
   auch nicht gestohlen oder falsch gespeichert werden.
------------------------------------------------------------- */

const BUCKET = "handschriften";
const DATEI = "handschrift.json";

let supabase = null;
let nutzer = null;

/* ---------- Elemente ---------- */

const kontoHinweis = document.getElementById("konto-hinweis");
const kontoAbgemeldet = document.getElementById("konto-abgemeldet");
const kontoAngemeldet = document.getElementById("konto-angemeldet");
const kontoEmail = document.getElementById("konto-email");
const kontoSendenBtn = document.getElementById("konto-senden");
const kontoUserEl = document.getElementById("konto-user");
const kontoSichernBtn = document.getElementById("konto-sichern");
const kontoAbmeldenBtn = document.getElementById("konto-abmelden");
const kontoStatus = document.getElementById("konto-status");

// Das Widget oben rechts im Header
const kontoToggleBtn = document.getElementById("konto-toggle");
const kontoDropdown = document.getElementById("konto-dropdown");
const kontoAvatarEl = document.getElementById("konto-avatar");
const kontoAvatarGrossEl = document.getElementById("konto-avatar-gross");
const kontoDotEl = document.getElementById("konto-dot");

const PERSON_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

function kmelde(text, warnung = false) {
  kontoStatus.textContent = text;
  kontoStatus.dataset.warn = warnung ? "true" : "false";
}

/* ---------- Anzeige umschalten ---------- */

function zeigeZustand() {
  const eingerichtet = supabase !== null;

  kontoHinweis.hidden = eingerichtet;
  kontoAbgemeldet.hidden = !eingerichtet || nutzer !== null;
  kontoAngemeldet.hidden = !eingerichtet || nutzer === null;

  if (nutzer) kontoUserEl.textContent = nutzer.email;

  // Knopf oben rechts: Anfangsbuchstabe der Mail statt Symbol, sobald
  // jemand angemeldet ist – so sieht man den Zustand, ohne öffnen zu müssen.
  const buchstabe = nutzer ? nutzer.email.trim().charAt(0) : "";
  kontoAvatarEl.innerHTML = buchstabe || PERSON_ICON;
  if (kontoAvatarGrossEl) kontoAvatarGrossEl.textContent = buchstabe;
  kontoDotEl.hidden = !nutzer;
}

/* ---------- Dropdown öffnen / schließen ---------- */

// Das Dropdown ist absichtlich ein direktes Kind von <body> (siehe
// index.html), deshalb bekommt es seine Position beim Öffnen per JS anhand
// des Knopfes – statt sich per CSS auf ein position:relative-Elternteil zu
// verlassen.
function dropdownPositionieren() {
  const r = kontoToggleBtn.getBoundingClientRect();
  kontoDropdown.style.top = `${Math.round(r.bottom + 14)}px`;
  kontoDropdown.style.right = `${Math.round(window.innerWidth - r.right)}px`;
}

function dropdownOeffnen() {
  dropdownPositionieren();
  kontoDropdown.classList.add("ist-offen");
  kontoToggleBtn.setAttribute("aria-expanded", "true");
}

function dropdownSchliessen() {
  kontoDropdown.classList.remove("ist-offen");
  kontoToggleBtn.setAttribute("aria-expanded", "false");
}

function dropdownIstOffen() {
  return kontoDropdown.classList.contains("ist-offen");
}

window.addEventListener("resize", () => {
  if (dropdownIstOffen()) dropdownPositionieren();
});

kontoToggleBtn.addEventListener("click", (ev) => {
  ev.stopPropagation();
  if (dropdownIstOffen()) dropdownSchliessen();
  else dropdownOeffnen();
});

// Klick außerhalb schließt das Dropdown
document.addEventListener("click", (ev) => {
  if (dropdownIstOffen() && !kontoDropdown.contains(ev.target) && ev.target !== kontoToggleBtn) {
    dropdownSchliessen();
  }
});

// Escape schließt es ebenfalls, und der Fokus geht sauber zurück zum Knopf
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && dropdownIstOffen()) {
    dropdownSchliessen();
    kontoToggleBtn.focus();
  }
});

// Klicks im Dropdown selbst sollen es nicht gleich wieder zuklappen
kontoDropdown.addEventListener("click", (ev) => ev.stopPropagation());

/* ---------- Verbindung aufbauen ---------- */

async function initKonto() {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    zeigeZustand();
    return;
  }

  try {
    // Erst hier laden – so bleibt die App auch ohne Netz benutzbar
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  } catch (err) {
    kmelde("Verbindung zu Supabase nicht möglich – die App läuft ohne Konto weiter.", true);
    zeigeZustand();
    return;
  }

  const { data } = await supabase.auth.getSession();
  nutzer = data.session ? data.session.user : null;
  zeigeZustand();

  // Nach dem Klick auf den Magic-Link kehrt der Nutzer angemeldet zurück
  supabase.auth.onAuthStateChange((ereignis, session) => {
    const vorher = nutzer;
    nutzer = session ? session.user : null;
    zeigeZustand();
    if (!vorher && nutzer) {
      kmelde(`Angemeldet als ${nutzer.email}.`);
      abgleichen();
    }
  });

  if (nutzer) abgleichen();
}

/* ---------- Anmelden / Abmelden ---------- */

kontoSendenBtn.addEventListener("click", async () => {
  const mail = kontoEmail.value.trim();
  if (!mail || !mail.includes("@")) {
    kmelde("Bitte eine gültige E-Mail-Adresse eingeben.", true);
    return;
  }

  kontoSendenBtn.disabled = true;
  kmelde("Link wird verschickt …");

  const { error } = await supabase.auth.signInWithOtp({
    email: mail,
    options: { emailRedirectTo: window.location.href.split("#")[0] },
  });

  kontoSendenBtn.disabled = false;
  kmelde(
    error
      ? `Konnte nicht verschickt werden: ${error.message}`
      : "Link verschickt. Schau in dein Postfach (auch im Spam-Ordner).",
    Boolean(error)
  );
});

kontoAbmeldenBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  nutzer = null;
  zeigeZustand();
  kmelde("Abgemeldet. Die Handschrift bleibt in diesem Browser gespeichert.");
});

/* ---------- Sichern und Abrufen ---------- */

function pfad() {
  return `${nutzer.id}/${DATEI}`;
}

async function sichern(daten) {
  const blob = new Blob([JSON.stringify(daten)], { type: "application/json" });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(pfad(), blob, { upsert: true, contentType: "application/json" });
  return error;
}

async function abrufen() {
  const { data, error } = await supabase.storage.from(BUCKET).download(pfad());
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text());
  } catch (err) {
    return null;
  }
}

/* Nach dem Anmelden zusammenführen:
   – liegt etwas im Konto, gewinnt das Konto (es ist das Gerät-übergreifende)
   – liegt nur lokal etwas, wird das ins Konto hochgeladen */
async function abgleichen() {
  kmelde("Handschrift wird abgeglichen …");

  const ausKonto = await abrufen();
  if (ausKonto && ausKonto.glyphs) {
    handschriftUebernehmen(ausKonto, () => {
      kmelde(`Handschrift aus dem Konto geladen (${Object.keys(ausKonto.glyphs).length} Zeichen).`);
    });
    return;
  }

  const lokal = handschriftLokal();
  if (lokal) {
    const fehler = await sichern(lokal);
    kmelde(fehler ? `Sichern fehlgeschlagen: ${fehler.message}` : "Lokale Handschrift ins Konto gesichert.", Boolean(fehler));
    return;
  }

  kmelde("Noch keine Handschrift vorhanden – zuerst eine Vorlage einscannen.");
}

kontoSichernBtn.addEventListener("click", async () => {
  const lokal = handschriftLokal();
  if (!lokal) {
    kmelde("Es ist keine Handschrift zum Sichern da.", true);
    return;
  }
  kontoSichernBtn.disabled = true;
  kmelde("Wird gesichert …");
  const fehler = await sichern(lokal);
  kontoSichernBtn.disabled = false;
  kmelde(fehler ? `Fehlgeschlagen: ${fehler.message}` : "Im Konto gesichert.", Boolean(fehler));
});

/* Wird von scanner.js direkt nach einem erfolgreichen Einlesen aufgerufen */
window.kontoAutoSichern = async function (daten) {
  if (!supabase || !nutzer) return;
  const fehler = await sichern(daten);
  kmelde(fehler ? `Automatisches Sichern fehlgeschlagen: ${fehler.message}` : "Automatisch im Konto gesichert.", Boolean(fehler));
};

initKonto();
