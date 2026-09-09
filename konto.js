/* -------------------------------------------------------------
   Konto & Sicherung in der Cloud

   Ohne Konto liegt die eingescannte Handschrift nur im localStorage
   dieses einen Browsers. Wechselt man das Gerät oder leert den Cache,
   ist sie weg. Mit Konto liegt sie zusätzlich bei Supabase und kommt
   nach dem Anmelden automatisch zurück.

   Es gibt zwei Wege, sich anzumelden:
     - klassisch mit E-Mail + Passwort (inkl. Registrieren und
       Passwort-vergessen-Zurücksetzen)
     - per Magic-Link ohne Passwort, für alle, die kein weiteres
       Passwort merken wollen

   Der Dropdown zeigt dafür fünf Modi, von denen jeweils genau einer
   sichtbar ist (siehe zeigeModus() weiter unten): login, signup,
   forgot, magiclink, reset.
------------------------------------------------------------- */

const BUCKET = "handschriften";
const DATEI = "handschrift.json";
const MIN_PASSWORT_LAENGE = 6;

let supabase = null;
let nutzer = null;

// Wird true, während jemand über den "Passwort vergessen"-Link zurückkommt.
// In dieser Zeit ist zwar technisch schon eine Sitzung da, die Person soll
// aber erst ein neues Passwort setzen, bevor sie als "angemeldet" gilt.
let istPasswortWiederherstellung = false;

// "lehrer" | "schueler" | null (noch nicht geladen bzw. kein Profil-Eintrag
// vorhanden, z. B. weil die profiles-Tabelle noch nicht eingerichtet ist –
// siehe KONTO-SETUP.md). Kommt bewusst NICHT aus user_metadata (das könnte
// sich jede Person selbst umschreiben), sondern aus der profiles-Tabelle,
// die nur ein serverseitiger Trigger einmalig bei der Registrierung füllt.
let nutzerRolle = null;
let rollenVorlageGesetzt = false;
let gewaehlteRolle = null;

/* ---------- Elemente ---------- */

const kontoHinweis = document.getElementById("konto-hinweis");
const kontoAbgemeldet = document.getElementById("konto-abgemeldet");
const kontoAngemeldet = document.getElementById("konto-angemeldet");
const kontoUserEl = document.getElementById("konto-user");
const kontoSichernBtn = document.getElementById("konto-sichern");
const kontoAbmeldenBtn = document.getElementById("konto-abmelden");
const kontoStatus = document.getElementById("konto-status");

// Die fünf Modi im abgemeldeten Zustand
const kontoModusEls = {
  login: document.getElementById("konto-modus-login"),
  signup: document.getElementById("konto-modus-signup"),
  forgot: document.getElementById("konto-modus-forgot"),
  magiclink: document.getElementById("konto-modus-magiclink"),
  reset: document.getElementById("konto-modus-reset"),
};

// Anmelden mit Passwort
const kontoLoginEmail = document.getElementById("konto-login-email");
const kontoLoginPasswort = document.getElementById("konto-login-passwort");
const kontoLoginSendenBtn = document.getElementById("konto-login-senden");

// Registrieren
const kontoSignupEmail = document.getElementById("konto-signup-email");
const kontoSignupPasswort = document.getElementById("konto-signup-passwort");
const kontoSignupPasswort2 = document.getElementById("konto-signup-passwort2");
const kontoSignupRolleLehrer = document.getElementById("konto-signup-rolle-lehrer");
const kontoSignupRolleSchueler = document.getElementById("konto-signup-rolle-schueler");
const kontoSignupSendenBtn = document.getElementById("konto-signup-senden");

// Nur für Lehrer-Konten sichtbar (siehe zeigeRollenUI())
const kiGeneratorPanel = document.getElementById("ki-generator-panel");

// Passwort vergessen
const kontoForgotEmail = document.getElementById("konto-forgot-email");
const kontoForgotSendenBtn = document.getElementById("konto-forgot-senden");

// Magic-Link (wie zuvor, jetzt als Alternative zum Passwort)
const kontoMagicEmail = document.getElementById("konto-magic-email");
const kontoMagicSendenBtn = document.getElementById("konto-magic-senden");

// Neues Passwort setzen (nach Klick auf den Reset-Link)
const kontoResetPasswort = document.getElementById("konto-reset-passwort");
const kontoResetPasswort2 = document.getElementById("konto-reset-passwort2");
const kontoResetSendenBtn = document.getElementById("konto-reset-senden");

// Text-Links zum Wechseln zwischen den Modi
const kontoZuForgot = document.getElementById("konto-zu-forgot");
const kontoZuSignup = document.getElementById("konto-zu-signup");
const kontoZuMagic = document.getElementById("konto-zu-magic");
const kontoZuLoginVonSignup = document.getElementById("konto-zu-login-von-signup");
const kontoZuLoginVonForgot = document.getElementById("konto-zu-login-von-forgot");
const kontoZuLoginVonMagic = document.getElementById("konto-zu-login-von-magic");

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

  // Während einer Passwort-Wiederherstellung gibt es zwar schon eine
  // Sitzung, die Person soll aber erst das neue Passwort setzen, bevor sie
  // als "angemeldet" zählt – deshalb bleibt hier der abgemeldete Bereich
  // sichtbar (mit dem reset-Modus darin).
  const zeigeAlsAngemeldet = nutzer !== null && !istPasswortWiederherstellung;

  kontoHinweis.hidden = eingerichtet;
  kontoAbgemeldet.hidden = !eingerichtet || zeigeAlsAngemeldet;
  kontoAngemeldet.hidden = !eingerichtet || !zeigeAlsAngemeldet;

  if (nutzer) kontoUserEl.textContent = nutzer.email;

  // Knopf oben rechts: Anfangsbuchstabe der Mail statt Symbol, sobald
  // jemand angemeldet ist – so sieht man den Zustand, ohne öffnen zu müssen.
  const buchstabe = zeigeAlsAngemeldet ? nutzer.email.trim().charAt(0) : "";
  kontoAvatarEl.innerHTML = buchstabe || PERSON_ICON;
  if (kontoAvatarGrossEl) kontoAvatarGrossEl.textContent = buchstabe;
  kontoDotEl.hidden = !zeigeAlsAngemeldet;
}

/* ---------- Rolle laden und rollenabhängige Bereiche zeigen ---------- */

// Liest die Rolle aus der profiles-Tabelle (nicht aus user_metadata – die
// könnte man sich als Nutzer:in selbst umschreiben). Ohne eingerichtete
// Tabelle (siehe KONTO-SETUP.md) bleibt nutzerRolle einfach null, die App
// verhält sich dann wie bisher ohne Rollen-Funktionen.
async function ladeRolle() {
  if (!supabase || !nutzer) {
    nutzerRolle = null;
    zeigeRollenUI();
    return;
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", nutzer.id)
    .single();
  nutzerRolle = error ? null : data.role;
  zeigeRollenUI();
}

function zeigeRollenUI() {
  const istLehrer = nutzerRolle === "lehrer";
  if (kiGeneratorPanel) kiGeneratorPanel.hidden = !istLehrer;

  // Einmal pro Login eine passende Vorlage vorschlagen, ohne eine bereits
  // von Hand getroffene Wahl zu überschreiben.
  if (istLehrer && !rollenVorlageGesetzt && typeof waehlePapier === "function") {
    waehlePapier("lined");
    rollenVorlageGesetzt = true;
  }
}

/* ---------- Zwischen Anmelden / Registrieren / ... wechseln ---------- */

function zeigeModus(modus) {
  Object.entries(kontoModusEls).forEach(([name, el]) => {
    el.hidden = name !== modus;
  });
  kmelde("");
}

kontoZuForgot.addEventListener("click", () => zeigeModus("forgot"));
kontoZuSignup.addEventListener("click", () => zeigeModus("signup"));
kontoZuMagic.addEventListener("click", () => zeigeModus("magiclink"));
kontoZuLoginVonSignup.addEventListener("click", () => zeigeModus("login"));
kontoZuLoginVonForgot.addEventListener("click", () => zeigeModus("login"));
kontoZuLoginVonMagic.addEventListener("click", () => zeigeModus("login"));

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
  // Nicht mitten in einer Passwort-Wiederherstellung auf "Anmelden"
  // zurückspringen – dann soll der reset-Modus stehen bleiben.
  if (!istPasswortWiederherstellung) zeigeModus("login");
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
    // Cross-Datei-Zugriff für ki.js, gleiches Muster wie window.kontoAutoSichern.
    window.supabaseClient = supabase;
  } catch (err) {
    kmelde("Verbindung zu Supabase nicht möglich – die App läuft ohne Konto weiter.", true);
    zeigeZustand();
    return;
  }

  // Der Listener muss VOR der ersten Sitzungsprüfung registriert werden –
  // sonst verpasst er das PASSWORD_RECOVERY-Ereignis, das direkt nach dem
  // Klick auf den "Passwort vergessen"-Link ausgelöst wird.
  supabase.auth.onAuthStateChange((ereignis, session) => {
    if (ereignis === "PASSWORD_RECOVERY") {
      istPasswortWiederherstellung = true;
      nutzer = session ? session.user : nutzer;
      zeigeModus("reset");
      dropdownOeffnen();
      zeigeZustand();
      kmelde("Bitte leg ein neues Passwort fest.");
      return;
    }

    const vorher = nutzer;
    nutzer = session ? session.user : null;
    zeigeZustand();
    ladeRolle();
    if (!vorher && nutzer && !istPasswortWiederherstellung) {
      kmelde(`Angemeldet als ${nutzer.email}.`);
      abgleichen();
    }
  });

  const { data } = await supabase.auth.getSession();
  nutzer = data.session ? data.session.user : null;
  zeigeZustand();
  ladeRolle();
  if (nutzer) abgleichen();
}

/* ---------- Anmelden / Registrieren / Passwort vergessen / Abmelden ---------- */

function gueltigeMail(text) {
  return Boolean(text) && text.includes("@");
}

function passwortLangGenug(pw) {
  return Boolean(pw) && pw.length >= MIN_PASSWORT_LAENGE;
}

// Anmelden mit E-Mail + Passwort
kontoLoginSendenBtn.addEventListener("click", async () => {
  const mail = kontoLoginEmail.value.trim();
  const passwort = kontoLoginPasswort.value;

  if (!gueltigeMail(mail)) {
    kmelde("Bitte eine gültige E-Mail-Adresse eingeben.", true);
    return;
  }
  if (!passwort) {
    kmelde("Bitte dein Passwort eingeben.", true);
    return;
  }

  kontoLoginSendenBtn.disabled = true;
  kmelde("Wird angemeldet …");

  const { error } = await supabase.auth.signInWithPassword({ email: mail, password: passwort });

  kontoLoginSendenBtn.disabled = false;
  // Bei Erfolg übernimmt onAuthStateChange die Meldung und den Abgleich.
  if (error) kmelde(`Anmeldung fehlgeschlagen: ${error.message}`, true);
});

// Rolle wählen (Registrieren) – nur eine Auswahl gleichzeitig möglich,
// gleiches Muster wie waehlePapier() in script.js.
function waehleRolle(rolle) {
  gewaehlteRolle = rolle;
  [
    [kontoSignupRolleLehrer, "lehrer"],
    [kontoSignupRolleSchueler, "schueler"],
  ].forEach(([btn, wert]) => {
    const gewaehlt = wert === rolle;
    btn.classList.toggle("ausgewaehlt", gewaehlt);
    btn.setAttribute("aria-checked", String(gewaehlt));
  });
}

kontoSignupRolleLehrer.addEventListener("click", () => waehleRolle("lehrer"));
kontoSignupRolleSchueler.addEventListener("click", () => waehleRolle("schueler"));

// Neues Konto registrieren
kontoSignupSendenBtn.addEventListener("click", async () => {
  const mail = kontoSignupEmail.value.trim();
  const passwort = kontoSignupPasswort.value;
  const passwort2 = kontoSignupPasswort2.value;

  if (!gueltigeMail(mail)) {
    kmelde("Bitte eine gültige E-Mail-Adresse eingeben.", true);
    return;
  }
  if (!passwortLangGenug(passwort)) {
    kmelde(`Das Passwort muss mindestens ${MIN_PASSWORT_LAENGE} Zeichen haben.`, true);
    return;
  }
  if (passwort !== passwort2) {
    kmelde("Die Passwörter stimmen nicht überein.", true);
    return;
  }
  if (!gewaehlteRolle) {
    kmelde("Bitte wähle, ob du Lehrer*in oder Schüler*in bist.", true);
    return;
  }

  kontoSignupSendenBtn.disabled = true;
  kmelde("Konto wird angelegt …");

  const { data, error } = await supabase.auth.signUp({
    email: mail,
    password: passwort,
    options: {
      emailRedirectTo: window.location.href.split("#")[0],
      // Wird von einem serverseitigen Trigger einmalig in die
      // profiles-Tabelle übernommen (siehe KONTO-SETUP.md) – danach liest
      // diese App die Rolle ausschließlich aus profiles, nie mehr von hier.
      data: { role: gewaehlteRolle },
    },
  });

  kontoSignupSendenBtn.disabled = false;

  if (error) {
    kmelde(`Konnte nicht angelegt werden: ${error.message}`, true);
    return;
  }

  // Ist die Bestätigungs-Mail bei Supabase aktiviert (Standardeinstellung),
  // gibt es hier noch keine Sitzung – erst nach dem Klick auf den Link.
  if (data.session) {
    kmelde("Konto erstellt und angemeldet.");
  } else {
    kmelde("Fast fertig! Bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben.");
  }
});

// Passwort vergessen: Link zum Zurücksetzen anfordern
kontoForgotSendenBtn.addEventListener("click", async () => {
  const mail = kontoForgotEmail.value.trim();

  if (!gueltigeMail(mail)) {
    kmelde("Bitte eine gültige E-Mail-Adresse eingeben.", true);
    return;
  }

  kontoForgotSendenBtn.disabled = true;
  kmelde("Link wird verschickt …");

  const { error } = await supabase.auth.resetPasswordForEmail(mail, {
    redirectTo: window.location.href.split("#")[0],
  });

  kontoForgotSendenBtn.disabled = false;
  kmelde(
    error
      ? `Konnte nicht verschickt werden: ${error.message}`
      : "Falls ein Konto mit dieser E-Mail existiert, hast du eine Mail mit einem Link zum Zurücksetzen bekommen."
  );
});

// Neues Passwort setzen (nach Klick auf den Reset-Link)
kontoResetSendenBtn.addEventListener("click", async () => {
  const passwort = kontoResetPasswort.value;
  const passwort2 = kontoResetPasswort2.value;

  if (!passwortLangGenug(passwort)) {
    kmelde(`Das Passwort muss mindestens ${MIN_PASSWORT_LAENGE} Zeichen haben.`, true);
    return;
  }
  if (passwort !== passwort2) {
    kmelde("Die Passwörter stimmen nicht überein.", true);
    return;
  }

  kontoResetSendenBtn.disabled = true;
  kmelde("Neues Passwort wird gespeichert …");

  const { error } = await supabase.auth.updateUser({ password: passwort });

  kontoResetSendenBtn.disabled = false;

  if (error) {
    kmelde(`Fehlgeschlagen: ${error.message}`, true);
    return;
  }

  istPasswortWiederherstellung = false;
  kontoResetPasswort.value = "";
  kontoResetPasswort2.value = "";
  zeigeZustand();
  kmelde("Neues Passwort gespeichert. Du bist angemeldet.");
  abgleichen();
});

// Magic-Link ohne Passwort (Alternative zur normalen Anmeldung)
kontoMagicSendenBtn.addEventListener("click", async () => {
  const mail = kontoMagicEmail.value.trim();
  if (!gueltigeMail(mail)) {
    kmelde("Bitte eine gültige E-Mail-Adresse eingeben.", true);
    return;
  }

  kontoMagicSendenBtn.disabled = true;
  kmelde("Link wird verschickt …");

  const { error } = await supabase.auth.signInWithOtp({
    email: mail,
    options: { emailRedirectTo: window.location.href.split("#")[0] },
  });

  kontoMagicSendenBtn.disabled = false;
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
  istPasswortWiederherstellung = false;
  nutzerRolle = null;
  rollenVorlageGesetzt = false;
  zeigeZustand();
  zeigeRollenUI();
  zeigeModus("login");
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

// Nur für UX-Zwecke (z. B. ki.js kann das Panel schon lokal ausblenden,
// bevor ein Klick passiert) – die eigentliche, verbindliche Prüfung passiert
// immer serverseitig in der Edge Function, nie hier.
window.kontoRolle = () => nutzerRolle;

/* Wird von scanner.js direkt nach einem erfolgreichen Einlesen aufgerufen */
window.kontoAutoSichern = async function (daten) {
  if (!supabase || !nutzer) return;
  const fehler = await sichern(daten);
  kmelde(fehler ? `Automatisches Sichern fehlgeschlagen: ${fehler.message}` : "Automatisch im Konto gesichert.", Boolean(fehler));
};

initKonto();
