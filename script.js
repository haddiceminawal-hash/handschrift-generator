/* -------------------------------------------------------------
   Handschrift-Generator
   Zeichnet getippten Text Buchstabe für Buchstabe auf ein Canvas
   und verzerrt jeden davon minimal, damit es handgeschrieben wirkt.
------------------------------------------------------------- */

/* ---------- Feste Werte ---------- */

const PAGE = { w: 794, h: 1123 };   // A4 in Pixeln (96 dpi)
const SCALE = 2;                    // doppelte Auflösung für scharfen Export
const BASE_MARGIN = { top: 96, right: 56, bottom: 72, left: 74 };
const GRID = 19;                    // Karo-Größe (5 mm bei 96 dpi)

// MARGIN ist bewusst veränderlich (kein const): render() setzt sie vor
// jedem Zeichnen neu, je nach gewähltem Papier – Cornell-Notizen brauchen
// z.B. mehr Platz links (Stichwort-Spalte) und unten (Zusammenfassung).
// Alle Zeichenfunktionen lesen MARGIN einfach aus dieser gemeinsamen Stelle.
let MARGIN = BASE_MARGIN;

/* -------------------------------------------------------------
   Die verfügbaren Papiersorten – orientiert an den Standard-Vorlagen,
   wie man sie aus GoodNotes & Co. kennt.

   "art" bestimmt, welche Zeichenfunktion greift (siehe zeichnePapierGrund).
   "spacing" staucht oder streckt den Zeilenabstand bei linierten Sorten.
------------------------------------------------------------- */

const PAPIERE = [
  { id: "lined",        label: "Liniert",         art: "lined" },
  { id: "lined-narrow",  label: "Liniert schmal",  art: "lined",   spacing: 0.78 },
  { id: "lined-wide",    label: "Liniert breit",   art: "lined",   spacing: 1.35 },
  { id: "grid",          label: "Kariert",         art: "grid" },
  { id: "dotted",        label: "Punktraster",     art: "dotted" },
  { id: "cornell",       label: "Cornell-Notizen", art: "cornell" },
  { id: "blank",         label: "Blanko",          art: "blank" },
];

function papierInfo(id) {
  return PAPIERE.find((p) => p.id === id) || PAPIERE[0];
}

// Cornell-Notizen brauchen mehr Rand: links für die Stichwort-Spalte,
// unten für die Zusammenfassungs-Zeile.
function margeFuer(paperId) {
  if (paperId === "cornell") {
    return { top: BASE_MARGIN.top, right: BASE_MARGIN.right, bottom: BASE_MARGIN.bottom + 118, left: 190 };
  }
  return BASE_MARGIN;
}

function berechneLineHeight(paperId, fontSize) {
  const info = papierInfo(paperId);
  let lh = Math.round(fontSize * 1.85 * (info.spacing || 1));
  // Bei Karo- und Punktraster auf das Raster einrasten, sonst schweben
  // die Zeilen zwischen den Linien.
  if (info.art === "grid" || info.art === "dotted") {
    lh = Math.max(GRID * 2, Math.round(lh / GRID) * GRID);
  }
  return lh;
}

/* -------------------------------------------------------------
   Die verfügbaren Schriften.

   "joined" ist der wichtige Schalter: Bei Schreibschrift hängen die
   Buchstaben aneinander. Würde ich die einzeln zeichnen und verdrehen,
   würden alle Verbindungsstriche zerreißen. Solche Schriften zeichne
   ich deshalb wortweise statt buchstabenweise.

   "adjust" gleicht aus, dass manche Schriften bei gleicher Punktgröße
   viel kleiner oder größer wirken als andere.
------------------------------------------------------------- */

const FONTS = [
  { name: "Patrick Hand",          label: "Patrick Hand – ordentlich",     group: "Druckschrift",   joined: false, adjust: 1.00 },
  { name: "Indie Flower",          label: "Indie Flower – rund",           group: "Druckschrift",   joined: false, adjust: 1.00 },
  { name: "Architects Daughter",   label: "Architects Daughter – technisch", group: "Druckschrift", joined: false, adjust: 0.95 },
  { name: "Gloria Hallelujah",     label: "Gloria Hallelujah – verspielt", group: "Druckschrift",   joined: false, adjust: 0.90 },
  { name: "Shadows Into Light",    label: "Shadows Into Light – zart",     group: "Druckschrift",   joined: false, adjust: 1.05 },
  { name: "Covered By Your Grace", label: "Covered By Your Grace – schnell", group: "Druckschrift", joined: false, adjust: 1.05 },
  { name: "Just Another Hand",     label: "Just Another Hand – schmal",    group: "Druckschrift",   joined: false, adjust: 1.35 },
  { name: "Reenie Beanie",         label: "Reenie Beanie – krakelig",      group: "Druckschrift",   joined: false, adjust: 1.15 },
  { name: "Kalam",                 label: "Kalam – klar",                  group: "Druckschrift",   joined: false, adjust: 1.00 },
  { name: "Rock Salt",             label: "Rock Salt – sehr unruhig",      group: "Druckschrift",   joined: false, adjust: 0.80 },

  { name: "Caveat",                label: "Caveat – flüssig",              group: "Schreibschrift", joined: true,  adjust: 1.10 },
  { name: "Dancing Script",        label: "Dancing Script – schwungvoll",  group: "Schreibschrift", joined: true,  adjust: 1.00 },
  { name: "Homemade Apple",        label: "Homemade Apple – echt wirkend", group: "Schreibschrift", joined: true,  adjust: 0.85 },
  { name: "Marck Script",          label: "Marck Script – locker",         group: "Schreibschrift", joined: true,  adjust: 1.10 },
  { name: "Cedarville Cursive",    label: "Cedarville Cursive – fein",     group: "Schreibschrift", joined: true,  adjust: 1.10 },
  { name: "La Belle Aurore",       label: "La Belle Aurore – verträumt",   group: "Schreibschrift", joined: true,  adjust: 0.95 },
  { name: "Zeyada",                label: "Zeyada – dünn",                 group: "Schreibschrift", joined: true,  adjust: 1.10 },
  { name: "Nothing You Could Do",  label: "Nothing You Could Do – schräg", group: "Schreibschrift", joined: true,  adjust: 1.00 },

  { name: "Great Vibes",           label: "Great Vibes – festlich",        group: "Kalligrafie",    joined: true,  adjust: 1.20 },
  { name: "Sacramento",            label: "Sacramento – schlicht",         group: "Kalligrafie",    joined: true,  adjust: 1.20 },
  { name: "Parisienne",            label: "Parisienne – elegant",          group: "Kalligrafie",    joined: true,  adjust: 1.20 },
  { name: "Allura",                label: "Allura – edel",                 group: "Kalligrafie",    joined: true,  adjust: 1.25 },
];

// Auswahlliste aus FONTS aufbauen, nach Gruppen sortiert
function buildFontSelect() {
  const gruppen = ["Druckschrift", "Schreibschrift", "Kalligrafie"];
  gruppen.forEach((g) => {
    const og = document.createElement("optgroup");
    og.label = g;
    FONTS.filter((f) => f.group === g).forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.name;
      opt.textContent = f.label;
      if (f.name === "Patrick Hand") opt.selected = true;
      og.appendChild(opt);
    });
    fontEl.appendChild(og);
  });
}

function fontMeta(name) {
  return FONTS.find((f) => f.name === name) || FONTS[0];
}

// Papier-Auswähler aus PAPIERE aufbauen – jede Karte zeigt ein kleines
// Vorschaubild statt nur eines Namens, damit man vorher sieht, wie die
// Vorlage aussieht.
function buildPaperPicker() {
  PAPIERE.forEach((p, i) => {
    const karte = document.createElement("button");
    karte.type = "button";
    karte.className = "paper-karte";
    karte.dataset.papier = p.id;
    karte.setAttribute("role", "radio");
    karte.setAttribute("aria-checked", i === 0 ? "true" : "false");
    if (i === 0) karte.classList.add("ausgewaehlt");

    const img = document.createElement("img");
    img.src = papierThumbnail(p.id);
    img.alt = "";

    const label = document.createElement("span");
    label.textContent = p.label;

    karte.append(img, label);
    karte.addEventListener("click", () => waehlePapier(p.id));
    paperPickerEl.appendChild(karte);
  });
}

function waehlePapier(id) {
  ausgewaehltesPapier = id;
  [...paperPickerEl.children].forEach((karte) => {
    const gewaehlt = karte.dataset.papier === id;
    karte.classList.toggle("ausgewaehlt", gewaehlt);
    karte.setAttribute("aria-checked", String(gewaehlt));
  });
  scheduleRender();
}

/* ---------- Elemente einsammeln ---------- */

const canvas = document.getElementById("paper");
const ctx = canvas.getContext("2d");

const inputEl = document.getElementById("input-text");
const fontEl = document.getElementById("font-family");
const paperPickerEl = document.getElementById("paper-picker");
const inkEl = document.getElementById("ink-color");
const sizeEl = document.getElementById("font-size");
const messEl = document.getElementById("messiness");
const sizeOut = document.getElementById("size-out");
const messOut = document.getElementById("mess-out");
const statusEl = document.getElementById("status");
const reshuffleBtn = document.getElementById("reshuffle");
const downloadBtn = document.getElementById("download");
const downloadPdfBtn = document.getElementById("download-pdf");

let ausgewaehltesPapier = PAPIERE[0].id;

let seed = Math.floor(Math.random() * 100000);

// Wird von scanner.js gefüllt: { em, glyphs: { "a": {img, w, h, dy}, ... } }
let ownFont = null;

/* -------------------------------------------------------------
   Zufall, der sich merken lässt
   Math.random() würde bei jedem Tastendruck alles neu würfeln –
   das Blatt würde beim Tippen wild zappeln. Deshalb berechnen wir
   den "Zufall" aus einer Zahl: gleiche Zahl -> gleicher Wert.
------------------------------------------------------------- */

function rand01(n) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/* ---------- Papier ---------- */

let noisePattern = null;

// Feine Körnung, damit das Papier nicht wie eine leere Fläche wirkt
function buildNoise() {
  const tile = document.createElement("canvas");
  tile.width = tile.height = 96;
  const tctx = tile.getContext("2d");
  const img = tctx.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 135;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  return ctx.createPattern(tile, "repeat");
}

function zeichneLinien(context, margin, lineHeight) {
  context.strokeStyle = "#9fb6d8";
  context.lineWidth = 1;
  for (let y = margin.top; y <= PAGE.h - margin.bottom; y += lineHeight) {
    context.beginPath();
    context.moveTo(40, y + 0.5);
    context.lineTo(PAGE.w - 40, y + 0.5);
    context.stroke();
  }
  // roter Rand links
  context.strokeStyle = "#e0a3a3";
  context.beginPath();
  context.moveTo(margin.left - 16, 30);
  context.lineTo(margin.left - 16, PAGE.h - 30);
  context.stroke();
}

function zeichneKaros(context) {
  context.strokeStyle = "#b9cbe4";
  context.lineWidth = 0.8;
  for (let x = 40; x <= PAGE.w - 40; x += GRID) {
    context.beginPath();
    context.moveTo(x + 0.5, 40);
    context.lineTo(x + 0.5, PAGE.h - 40);
    context.stroke();
  }
  for (let y = 40; y <= PAGE.h - 40; y += GRID) {
    context.beginPath();
    context.moveTo(40, y + 0.5);
    context.lineTo(PAGE.w - 40, y + 0.5);
    context.stroke();
  }
}

function zeichnePunkte(context) {
  context.fillStyle = "#9fb0c9";
  for (let x = 40; x <= PAGE.w - 40; x += GRID) {
    for (let y = 40; y <= PAGE.h - 40; y += GRID) {
      context.beginPath();
      context.arc(x, y, 1.3, 0, Math.PI * 2);
      context.fill();
    }
  }
}

// Cornell-Methode: Stichwort-Spalte links, Notizen in der Mitte,
// Zusammenfassung unten – eine der Standard-Vorlagen in GoodNotes & Co.
function zeichneCornell(context, margin, lineHeight) {
  const cueX = margin.left - 16;
  const summaryY = PAGE.h - margin.bottom;

  context.strokeStyle = "#9fb6d8";
  context.lineWidth = 1;
  for (let y = margin.top; y <= summaryY; y += lineHeight) {
    context.beginPath();
    context.moveTo(margin.left, y + 0.5);
    context.lineTo(PAGE.w - 40, y + 0.5);
    context.stroke();
  }

  context.strokeStyle = "#c9a6a6";
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(cueX, 30);
  context.lineTo(cueX, PAGE.h - 30);
  context.stroke();
  context.beginPath();
  context.moveTo(40, summaryY + 0.5);
  context.lineTo(PAGE.w - 40, summaryY + 0.5);
  context.stroke();

  context.fillStyle = "#a9a2c4";
  context.font = "italic 13px Inter, sans-serif";
  context.textBaseline = "alphabetic";
  context.save();
  context.translate(24, margin.top + 4);
  context.rotate(-Math.PI / 2);
  context.fillText("STICHWORTE", 0, 0);
  context.restore();
  context.fillText("ZUSAMMENFASSUNG", 44, summaryY + 22);
}

// Nur Hintergrund + Linien, ohne Körnung/Schatten – wird sowohl für das
// große Blatt als auch für die kleinen Vorschaubilder im Papier-Auswähler
// benutzt (dort wären Körnung und Schatten bei der geringen Größe eh
// nicht zu erkennen, kosten aber Rechenzeit für sieben Vorschauen).
function zeichnePapierGrund(context, paper, lineHeight, margin) {
  context.fillStyle = "#fdfdf7";
  context.fillRect(0, 0, PAGE.w, PAGE.h);

  context.save();
  const art = papierInfo(paper).art;
  if (art === "lined") zeichneLinien(context, margin, lineHeight);
  else if (art === "grid") zeichneKaros(context);
  else if (art === "dotted") zeichnePunkte(context);
  else if (art === "cornell") zeichneCornell(context, margin, lineHeight);
  context.restore();
}

function drawPaper(paper, lineHeight, margin) {
  zeichnePapierGrund(ctx, paper, lineHeight, margin);

  // Körnung
  if (!noisePattern) noisePattern = buildNoise();
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = noisePattern;
  ctx.fillRect(0, 0, PAGE.w, PAGE.h);
  ctx.restore();

  // ganz leichter Schatten zu den Rändern hin
  const vig = ctx.createRadialGradient(
    PAGE.w / 2, PAGE.h / 2, PAGE.h * 0.35,
    PAGE.w / 2, PAGE.h / 2, PAGE.h * 0.75
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(60,50,35,0.07)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, PAGE.w, PAGE.h);
}

// Kleines Vorschaubild für eine Papiersorte – für den Auswähler unten.
function papierThumbnail(paperId) {
  const w = 108;
  const h = Math.round((w * PAGE.h) / PAGE.w);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const tctx = c.getContext("2d");
  tctx.scale(w / PAGE.w, h / PAGE.h);

  const lineHeight = berechneLineHeight(paperId, 22);
  zeichnePapierGrund(tctx, paperId, lineHeight, margeFuer(paperId));

  return c.toDataURL("image/png");
}

/* ---------- Text in Zeilen umbrechen ---------- */

function wrapText(text, maxWidth, measure) {
  const breite = measure || ((t) => ctx.measureText(t).width);
  const lines = [];

  text.split("\n").forEach((paragraph) => {
    if (paragraph.trim() === "") {
      lines.push("");
      return;
    }

    let current = "";
    paragraph.split(/\s+/).forEach((word) => {
      const test = current ? current + " " + word : word;

      // Passt das Wort noch in die Zeile?  (kleiner Puffer für das Gewackel)
      if (breite(test) * 1.04 <= maxWidth) {
        current = test;
        return;
      }

      if (current) lines.push(current);

      // Sehr langes Wort: hart trennen
      if (breite(word) * 1.04 > maxWidth) {
        let rest = word;
        while (breite(rest) * 1.04 > maxWidth) {
          let cut = rest.length - 1;
          while (cut > 1 && breite(rest.slice(0, cut)) * 1.04 > maxWidth) cut--;
          lines.push(rest.slice(0, cut) + "-");
          rest = rest.slice(cut);
        }
        current = rest;
      } else {
        current = word;
      }
    });

    if (current) lines.push(current);
  });

  return lines;
}

/* ---------- Die eigentliche Handschrift ---------- */

/* Modus A: Druckschrift – jeder Buchstabe wird einzeln verzerrt.
   Derselbe Buchstabe soll nie zweimal exakt gleich aussehen. */
function drawLoose(line, li, x, baseY, wobbleAt, opts) {
  const { fontSize, mess, ink } = opts;

  for (let ci = 0; ci < line.length; ci++) {
    const ch = line[ci];
    const key = seed * 7919 + li * 131 + ci * 17;

    const a = rand01(key + 1);   // Drehung
    const b = rand01(key + 2);   // Höhe
    const c = rand01(key + 3);   // Breite
    const d = rand01(key + 4);   // Tintenstärke
    const e = rand01(key + 5);   // Abstand
    const f = rand01(key + 6);   // Streckung
    const g = rand01(key + 7);   // Neigung

    const charW = ctx.measureText(ch).width;

    if (ch === " ") {
      // Wortabstände schwanken stärker als Buchstabenabstände
      x += charW + (e - 0.5) * mess * 3.2;
      continue;
    }

    const sx = 1 + (c - 0.5) * mess * 0.13;
    const sy = 1 + (f - 0.5) * mess * 0.15;

    ctx.save();
    ctx.translate(x + charW / 2, baseY + (b - 0.5) * mess * fontSize * 0.11 + wobbleAt(x));
    ctx.rotate((a - 0.5) * mess * 0.06);
    ctx.transform(sx, 0, (g - 0.5) * mess * 0.22, sy, 0, 0);
    ctx.fillStyle = ink;

    ctx.globalAlpha = 1 - mess * 0.34 * d;
    ctx.fillText(ch, -charW / 2, 0);

    // manchmal ein zweiter Strich -> wirkt wie stärkerer Druck
    if (d > 0.68) {
      ctx.globalAlpha = 0.28;
      ctx.fillText(ch, -charW / 2 + 0.4, 0.3);
    }

    ctx.restore();
    x += charW * sx + (e - 0.5) * mess * 1.1;
  }

  return x;
}

/* Modus B: Schreibschrift – ganze Wörter am Stück, sonst reißen die
   Verbindungsstriche zwischen den Buchstaben. Deshalb fällt die
   Verzerrung hier auch schwächer aus. */
function drawJoined(line, li, x, baseY, wobbleAt, opts) {
  const { fontSize, mess, ink } = opts;
  const spaceW = ctx.measureText(" ").width;

  line.split(" ").forEach((word, wi) => {
    const key = seed * 7919 + li * 131 + wi * 97;

    if (word) {
      const a = rand01(key + 1);
      const b = rand01(key + 2);
      const c = rand01(key + 3);
      const d = rand01(key + 4);
      const f = rand01(key + 6);
      const g = rand01(key + 7);

      const wordW = ctx.measureText(word).width;
      const sx = 1 + (c - 0.5) * mess * 0.06;
      const sy = 1 + (f - 0.5) * mess * 0.07;

      ctx.save();
      ctx.translate(x + wordW / 2, baseY + (b - 0.5) * mess * fontSize * 0.08 + wobbleAt(x));
      ctx.rotate((a - 0.5) * mess * 0.035);
      ctx.transform(sx, 0, (g - 0.5) * mess * 0.10, sy, 0, 0);
      ctx.fillStyle = ink;

      ctx.globalAlpha = 1 - mess * 0.28 * d;
      ctx.fillText(word, -wordW / 2, 0);

      if (d > 0.68) {
        ctx.globalAlpha = 0.26;
        ctx.fillText(word, -wordW / 2 + 0.4, 0.3);
      }

      ctx.restore();
      x += wordW * sx;
    }

    x += spaceW + (rand01(key + 9) - 0.5) * mess * 3.0;
  });

  return x;
}

/* Modus C: die eingescannte eigene Handschrift.
   Statt Buchstaben einer Schriftart werden hier die ausgeschnittenen
   Bilder aus der Vorlage gezeichnet. */

function ownScale(size) {
  return (size * 0.78) / ownFont.em;
}

function ownAdvance(ch, s, size) {
  if (ch === " ") return size * 0.30;
  const g = ownFont.glyphs[ch];
  return g ? g.w * s + size * 0.07 : ctx.measureText(ch).width;
}

function measureOwn(text, size) {
  const s = ownScale(size);
  let w = 0;
  for (const ch of text) w += ownAdvance(ch, s, size);
  return w;
}

// Die Buchstabenbilder sind schwarz mit Transparenz. Damit sie die
// gewählte Tintenfarbe bekommen, wird pro Farbe eine eingefärbte
// Fassung erzeugt und gemerkt.
function tintGlyph(g, ink) {
  if (g._tint && g._tintColor === ink) return g._tint;
  const c = document.createElement("canvas");
  c.width = g.w;
  c.height = g.h;
  const cx = c.getContext("2d");
  cx.drawImage(g.img, 0, 0);
  cx.globalCompositeOperation = "source-in";
  cx.fillStyle = ink;
  cx.fillRect(0, 0, g.w, g.h);
  g._tint = c;
  g._tintColor = ink;
  return c;
}

function drawOwn(line, li, x, baseY, wobbleAt, opts) {
  const { fontSize, mess, ink } = opts;
  const s = ownScale(fontSize);

  for (let ci = 0; ci < line.length; ci++) {
    const ch = line[ci];
    const key = seed * 7919 + li * 131 + ci * 17;
    const a = rand01(key + 1);
    const b = rand01(key + 2);
    const c = rand01(key + 3);
    const e = rand01(key + 5);

    const g = ownFont.glyphs[ch];

    // Zeichen war nicht auf der Vorlage -> mit der Ersatzschrift schreiben
    if (!g) {
      if (ch !== " ") {
        ctx.save();
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.85;
        ctx.fillText(ch, x, baseY + wobbleAt(x));
        ctx.restore();
      }
      x += ownAdvance(ch, s, fontSize);
      continue;
    }

    // Eigene Buchstaben sind schon von Natur aus ungleichmäßig,
    // deshalb wird hier deutlich schwächer verzerrt als bei Schriftarten.
    const f = 1 + (c - 0.5) * mess * 0.08;
    const gw = g.w * s * f;
    const gh = g.h * s * f;

    ctx.save();
    ctx.translate(x + gw / 2, baseY + (b - 0.5) * mess * fontSize * 0.09 + wobbleAt(x));
    ctx.rotate((a - 0.5) * mess * 0.05);
    ctx.globalAlpha = 1 - mess * 0.15 * e;
    ctx.drawImage(tintGlyph(g, ink), -gw / 2, g.dy * s, gw, gh);
    ctx.restore();

    x += ownAdvance(ch, s, fontSize) + (e - 0.5) * mess * 1.0;
  }

  return x;
}

function drawLines(lines, opts) {
  const { lineHeight, mess, maxLines, joined } = opts;
  const shown = lines.slice(0, maxLines);

  shown.forEach((line, li) => {
    const baseY = MARGIN.top + li * lineHeight;

    // Jede Zeile bekommt eine eigene leichte Welle und Schräglage –
    // von Hand schreibt niemand exakt waagerecht.
    const phase = rand01(seed * 31 + li) * Math.PI * 2;
    const slope = (rand01(seed * 57 + li) - 0.5) * mess * 0.018;
    const wobbleAt = (px) =>
      Math.sin(px * 0.035 + phase) * mess * 1.7 + (px - MARGIN.left) * slope;

    const startX = MARGIN.left + (rand01(seed * 91 + li) - 0.5) * mess * 4;

    if (opts.own) {
      drawOwn(line, li, startX, baseY, wobbleAt, opts);
    } else if (joined) {
      drawJoined(line, li, startX, baseY, wobbleAt, opts);
    } else {
      drawLoose(line, li, startX, baseY, wobbleAt, opts);
    }
  });

  return shown.length;
}

/* ---------- Alles zusammenbauen ---------- */

async function render() {
  const fontSize = Number(sizeEl.value);
  const mess = Number(messEl.value) / 100;
  const family = fontEl.value;

  // "__own__" = die eingescannte eigene Handschrift
  const own = family === "__own__" && ownFont !== null;
  const meta = own ? FONTS[0] : fontMeta(family);
  const drawSize = Math.round(fontSize * meta.adjust);
  const paper = ausgewaehltesPapier;
  const ink = inkEl.value;

  MARGIN = margeFuer(paper);
  const lineHeight = berechneLineHeight(paper, fontSize);

  // Schrift ZUERST laden – sonst blitzt beim Wechsel kurz ein leeres Blatt auf,
  // weil das Papier schon gemalt wäre, der Text aber noch fehlt.
  // Bei eigener Handschrift wird trotzdem eine Schrift geladen – als
  // Ersatz für Zeichen, die auf der Vorlage fehlen.
  try {
    await document.fonts.load(`${drawSize}px "${meta.name}"`);
  } catch (err) {
    /* Schrift nicht verfügbar – dann greift die Ersatzschrift */
  }

  // Canvas auf A4 setzen (intern doppelt so groß für scharfen Export)
  canvas.width = PAGE.w * SCALE;
  canvas.height = PAGE.h * SCALE;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

  drawPaper(paper, lineHeight, MARGIN);

  // Schriftart muss nach dem Größenwechsel neu gesetzt werden
  ctx.font = `${drawSize}px "${meta.name}", "Bradley Hand", cursive`;
  ctx.textBaseline = "alphabetic";

  const maxWidth = PAGE.w - MARGIN.left - MARGIN.right;
  const lines = wrapText(
    inputEl.value,
    maxWidth,
    own ? (t) => measureOwn(t, drawSize) : null
  );
  const maxLines = Math.floor((PAGE.h - MARGIN.top - MARGIN.bottom) / lineHeight) + 1;

  const drawn = drawLines(lines, {
    fontSize: drawSize, lineHeight, mess, ink, maxLines,
    joined: meta.joined, own,
  });

  // Rückmeldung an die Nutzerin
  if (lines.length > drawn) {
    statusEl.dataset.warn = "true";
    statusEl.textContent =
      `${lines.length - drawn} Zeile(n) passen nicht auf das Blatt. ` +
      `Schrift verkleinern oder Text kürzen.`;
  } else {
    statusEl.dataset.warn = "false";
    statusEl.textContent = `${drawn} von ${maxLines} Zeilen belegt.`;
  }
}

/* ---------- Bedienung ---------- */

function refreshOutputs() {
  sizeOut.textContent = sizeEl.value;
  messOut.textContent = messEl.value;
}

// Beim Tippen nicht bei jedem Zeichen neu zeichnen, sondern kurz warten
let timer = null;
function scheduleRender() {
  refreshOutputs();
  clearTimeout(timer);
  timer = setTimeout(render, 80);
}

[inputEl, fontEl, inkEl, sizeEl, messEl].forEach((el) => {
  el.addEventListener("input", scheduleRender);
});

reshuffleBtn.addEventListener("click", () => {
  seed = Math.floor(Math.random() * 100000);
  render();
});

downloadBtn.addEventListener("click", () => {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "handschrift.png";
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
});

/* -------------------------------------------------------------
   Als PDF speichern (für GoodNotes)

   GoodNotes hat kein offenes, dokumentiertes Dateiformat – eine eigene
   ".goodnotes"-Datei von außen zu bauen wäre nur eine kaputte Attrappe,
   die dort gar nicht aufginge. Der tatsächliche Weg, den auch gekaufte
   GoodNotes-Vorlagen gehen: eine PDF-Datei, die man importiert
   (Importieren -> Als neues Dokument) und dann beschreibt. Das Blatt ist
   schon als A4-Seite aufgebaut, deshalb reicht es, das fertige Bild in
   eine einzelne PDF-Seite derselben Größe zu packen.
------------------------------------------------------------- */

downloadPdfBtn.addEventListener("click", async () => {
  const textVorher = downloadPdfBtn.textContent;
  downloadPdfBtn.disabled = true;
  downloadPdfBtn.textContent = "Wird erstellt …";

  try {
    const { jsPDF } = await import("https://esm.sh/jspdf@2.5.2");
    const bild = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF({ unit: "px", format: [PAGE.w, PAGE.h] });
    pdf.addImage(bild, "JPEG", 0, 0, PAGE.w, PAGE.h);
    pdf.save("handschrift.pdf");
  } catch (err) {
    statusEl.dataset.warn = "true";
    statusEl.textContent = "PDF konnte nicht erstellt werden – Internetverbindung prüfen.";
  } finally {
    downloadPdfBtn.disabled = false;
    downloadPdfBtn.textContent = textVorher;
  }
});

buildFontSelect();
buildPaperPicker();
refreshOutputs();
render();
