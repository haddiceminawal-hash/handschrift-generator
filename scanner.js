/* -------------------------------------------------------------
   Eigene Handschrift einlesen

   Ablauf:
     1. Vorlage mit 81 Kästchen erzeugen und ausdrucken
     2. Kästchen von Hand ausfüllen, Blatt abfotografieren
     3. Foto hochladen, die vier Ecken anklicken
     4. Foto geradeziehen, Kästchen ausschneiden, Buchstaben speichern

   Der Trick: Weil die Vorlage vorgibt, welcher Buchstabe in welches
   Kästchen gehört, muss das Programm nichts *erkennen*. Es weiß bereits,
   was drinsteht – es muss nur ausschneiden. Deshalb funktioniert das
   zuverlässig, während echte Handschrifterkennung es nicht täte.
------------------------------------------------------------- */

/* ---------- Welcher Buchstabe in welchem Kästchen ---------- */

const SHEET_ROWS = [
  "abcdefghi",
  "jklmnopqr",
  "stuvwxyzä",
  "öüßABCDEF",
  "GHIJKLMNO",
  "PQRSTUVWX",
  "YZÄÖÜ0123",
  "456789.,!",
  "?-()\"':;&",
];

const COLS = 9;
const ROWS = SHEET_ROWS.length;

/* ---------- Maße der Vorlage (in Seiten-Pixeln, A4 = 794 x 1123) ---------- */

const SHEET = {
  markSize: 22,          // schwarze Quadrate in den Ecken
  markInset: 28,
  gridX: 56,
  gridY: 196,
  gridW: 682,
  gridH: 831,
  headerH: 15,           // Streifen über dem Kästchen für den Vorgabe-Buchstaben
  padX: 3,
  padB: 3,
  baselineAt: 0.72,      // Grundlinie im Kästchen (Anteil der Höhe)
};

SHEET.cellW = SHEET.gridW / COLS;
SHEET.cellH = SHEET.gridH / ROWS;

// Die vier Marker-Mittelpunkte – Vorlage und Auswertung müssen
// sich exakt auf dieselben Punkte beziehen.
const MARK_CENTERS = [
  [SHEET.markInset + SHEET.markSize / 2, SHEET.markInset + SHEET.markSize / 2],
  [PAGE.w - SHEET.markInset - SHEET.markSize / 2, SHEET.markInset + SHEET.markSize / 2],
  [PAGE.w - SHEET.markInset - SHEET.markSize / 2, PAGE.h - SHEET.markInset - SHEET.markSize / 2],
  [SHEET.markInset + SHEET.markSize / 2, PAGE.h - SHEET.markInset - SHEET.markSize / 2],
];

// Innenbereich eines Kästchens – hier wird später ausgeschnitten
function cellBox(row, col) {
  const cx = SHEET.gridX + col * SHEET.cellW;
  const cy = SHEET.gridY + row * SHEET.cellH;
  return {
    x: cx + SHEET.padX,
    y: cy + SHEET.headerH,
    w: SHEET.cellW - SHEET.padX * 2,
    h: SHEET.cellH - SHEET.headerH - SHEET.padB,
  };
}

/* ---------- Vorlage zeichnen ---------- */

function drawTemplate(tctx) {
  tctx.fillStyle = "#ffffff";
  tctx.fillRect(0, 0, PAGE.w, PAGE.h);

  // Überschrift und Anleitung
  tctx.fillStyle = "#111111";
  tctx.font = "bold 22px Inter, sans-serif";
  tctx.textBaseline = "alphabetic";
  tctx.fillText("Handschrift-Vorlage", SHEET.gridX, 96);

  tctx.fillStyle = "#444444";
  tctx.font = "13px Inter, sans-serif";
  [
    "1.  Schreibe in jedes Kästchen den Buchstaben, der darüber steht – mit dunklem Stift.",
    "2.  Setze die Buchstaben auf die gestrichelte Grundlinie und berühre die Ränder nicht.",
    "3.  Fotografiere das Blatt danach von oben ab, mit allen vier schwarzen Ecken im Bild.",
  ].forEach((zeile, i) => tctx.fillText(zeile, SHEET.gridX, 126 + i * 20));

  // Eck-Marker
  tctx.fillStyle = "#000000";
  MARK_CENTERS.forEach(([mx, my]) => {
    tctx.fillRect(mx - SHEET.markSize / 2, my - SHEET.markSize / 2, SHEET.markSize, SHEET.markSize);
  });

  // Die Kästchen
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = SHEET_ROWS[r][c];
      const box = cellBox(r, c);

      // Vorgabe-Buchstabe über dem Kästchen (außerhalb, wird nie mitausgeschnitten)
      tctx.fillStyle = "#8a8a8a";
      tctx.font = "11px Inter, sans-serif";
      tctx.fillText(ch, box.x + 1, box.y - 4);

      // Rahmen
      tctx.strokeStyle = "#c9c9c9";
      tctx.lineWidth = 1;
      tctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w, box.h);

      // gestrichelte Grundlinie
      tctx.save();
      tctx.strokeStyle = "#dcdcdc";
      tctx.setLineDash([3, 3]);
      tctx.beginPath();
      const by = box.y + box.h * SHEET.baselineAt;
      tctx.moveTo(box.x + 3, by + 0.5);
      tctx.lineTo(box.x + box.w - 3, by + 0.5);
      tctx.stroke();
      tctx.restore();
    }
  }
}

function downloadTemplate() {
  const t = document.createElement("canvas");
  t.width = PAGE.w * 2;
  t.height = PAGE.h * 2;
  const tctx = t.getContext("2d");
  tctx.setTransform(2, 0, 0, 2, 0, 0);
  drawTemplate(tctx);

  t.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "handschrift-vorlage.png";
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

/* -------------------------------------------------------------
   Foto geradeziehen

   Ein Foto vom Blatt ist immer perspektivisch verzerrt – das Blatt wird
   zum schiefen Viereck. Eine Homographie ist die 3x3-Matrix, die dieses
   Viereck wieder auf ein sauberes Rechteck abbildet. Aus den vier
   angeklickten Ecken lässt sie sich exakt berechnen.
------------------------------------------------------------- */

const UNWARP_SCALE = 2;

// Lineares Gleichungssystem lösen (Gauß-Verfahren mit Zeilentausch)
function solve(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    // größtes Element als Pivot wählen – sonst wird es numerisch ungenau
    let max = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(A[r][i]) > Math.abs(A[max][i])) max = r;
    }
    [A[i], A[max]] = [A[max], A[i]];
    [b[i], b[max]] = [b[max], b[i]];

    if (Math.abs(A[i][i]) < 1e-10) return null;   // Ecken liegen auf einer Linie

    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

// Matrix, die Seiten-Koordinaten -> Foto-Koordinaten abbildet
function homography(dst, src) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = dst[i];
    const [u, v] = src[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  return h ? [...h, 1] : null;
}

// Das ganze Blatt aus dem Foto geradegezogen zurückgeben
function unwarp(img, corners) {
  const H = homography(MARK_CENTERS, corners);
  if (!H) return null;

  const W = Math.round(PAGE.w * UNWARP_SCALE);
  const Hh = Math.round(PAGE.h * UNWARP_SCALE);

  // Foto in ein Canvas legen, um an die Pixel zu kommen
  const sc = document.createElement("canvas");
  sc.width = img.naturalWidth;
  sc.height = img.naturalHeight;
  const sctx = sc.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const srcData = sctx.getImageData(0, 0, sc.width, sc.height);
  const sp = srcData.data;

  const out = new ImageData(W, Hh);
  const op = out.data;

  for (let y = 0; y < Hh; y++) {
    const py = y / UNWARP_SCALE;
    for (let x = 0; x < W; x++) {
      const px = x / UNWARP_SCALE;

      // Seiten-Punkt durch die Matrix schicken -> Punkt im Foto
      const w = H[6] * px + H[7] * py + H[8];
      const u = Math.round((H[0] * px + H[1] * py + H[2]) / w);
      const v = Math.round((H[3] * px + H[4] * py + H[5]) / w);

      const o = (y * W + x) * 4;
      if (u < 0 || v < 0 || u >= sc.width || v >= sc.height) {
        op[o] = op[o + 1] = op[o + 2] = 255;
        op[o + 3] = 255;
        continue;
      }
      const s = (v * sc.width + u) * 4;
      op[o] = sp[s];
      op[o + 1] = sp[s + 1];
      op[o + 2] = sp[s + 2];
      op[o + 3] = 255;
    }
  }

  const dc = document.createElement("canvas");
  dc.width = W;
  dc.height = Hh;
  dc.getContext("2d").putImageData(out, 0, 0);
  return dc;
}

/* -------------------------------------------------------------
   Buchstaben aus den Kästchen schneiden
------------------------------------------------------------- */

function extractGlyphs(flat) {
  const fctx = flat.getContext("2d", { willReadFrequently: true });
  const glyphs = {};
  let gefunden = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = SHEET_ROWS[r][c];
      const box = cellBox(r, c);

      // 3 Pixel Sicherheitsabstand, damit der gedruckte Rahmen nicht mitkommt
      const bx = Math.round((box.x + 3) * UNWARP_SCALE);
      const by = Math.round((box.y + 3) * UNWARP_SCALE);
      const bw = Math.round((box.w - 6) * UNWARP_SCALE);
      const bh = Math.round((box.h - 6) * UNWARP_SCALE);

      const img = fctx.getImageData(bx, by, bw, bh);
      const p = img.data;

      // Helligkeiten einsammeln
      let min = 255;
      let summe = 0;
      const lum = new Float32Array(bw * bh);
      for (let i = 0, j = 0; i < p.length; i += 4, j++) {
        const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
        lum[j] = l;
        summe += l;
        if (l < min) min = l;
      }
      const mittel = summe / (bw * bh);

      // Zu wenig Kontrast -> Kästchen ist leer geblieben
      if (mittel - min < 28) continue;

      const grenze = (min + mittel) / 2;

      // Maske bauen und gleichzeitig den belegten Bereich suchen
      let x0 = bw, y0 = bh, x1 = -1, y1 = -1;
      const maske = new Uint8ClampedArray(bw * bh * 4);
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const j = y * bw + x;
          if (lum[j] >= grenze) continue;
          const a = Math.min(255, ((grenze - lum[j]) / Math.max(1, grenze - min)) * 255);
          maske[j * 4 + 3] = a;
          if (a > 40) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }

      if (x1 - x0 < 3 || y1 - y0 < 3) continue;   // nur ein Fleck, kein Buchstabe

      // Auf den belegten Bereich zuschneiden
      const gw = x1 - x0 + 1;
      const gh = y1 - y0 + 1;
      const gc = document.createElement("canvas");
      gc.width = gw;
      gc.height = gh;
      const gctx = gc.getContext("2d");
      const gimg = gctx.createImageData(gw, gh);
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const from = ((y + y0) * bw + (x + x0)) * 4;
          const to = (y * gw + x) * 4;
          gimg.data[to + 3] = maske[from + 3];
        }
      }
      gctx.putImageData(gimg, 0, 0);

      // Wie weit steht der Buchstabe über der Grundlinie?
      const baselineY = (box.h * SHEET.baselineAt - 3) * UNWARP_SCALE;
      glyphs[ch] = {
        url: gc.toDataURL("image/png"),
        w: gw,
        h: gh,
        dy: y0 - baselineY,          // negativ = oberhalb der Grundlinie
      };
      gefunden++;
    }
  }

  // Bezugsgröße: Abstand Grundlinie -> Kästchenoberkante entspricht
  // ungefähr der Höhe eines Großbuchstabens.
  const box0 = cellBox(0, 0);
  return {
    glyphs,
    em: (box0.h * SHEET.baselineAt - 3) * UNWARP_SCALE,
    gefunden,
  };
}

/* -------------------------------------------------------------
   Bedienung: Ecken anklicken
------------------------------------------------------------- */

const ECKEN = ["oben links", "oben rechts", "unten rechts", "unten links"];
const SPEICHER = "handschrift-eigene";

const tplBtn = document.getElementById("tpl-download");
const uploadEl = document.getElementById("sheet-upload");
const ownStatus = document.getElementById("own-status");
const ownClearBtn = document.getElementById("own-clear");
const overlay = document.getElementById("corner-overlay");
const pickCanvas = document.getElementById("corner-canvas");
const pickHint = document.getElementById("corner-hint");
const pickResetBtn = document.getElementById("corner-reset");
const pickCancelBtn = document.getElementById("corner-cancel");

let pickImg = null;
let pickPts = [];
let pickScale = 1;

function melde(text, warnung = false) {
  ownStatus.textContent = text;
  ownStatus.dataset.warn = warnung ? "true" : "false";
}

function drawPick() {
  const cx = pickCanvas.getContext("2d");
  cx.drawImage(pickImg, 0, 0, pickCanvas.width, pickCanvas.height);

  pickPts.forEach(([ix, iy], i) => {
    const x = ix * pickScale;
    const y = iy * pickScale;
    cx.strokeStyle = "#2f6fdb";
    cx.lineWidth = 2;
    cx.beginPath();
    cx.arc(x, y, 9, 0, Math.PI * 2);
    cx.stroke();
    cx.fillStyle = "#2f6fdb";
    cx.beginPath();
    cx.arc(x, y, 3, 0, Math.PI * 2);
    cx.fill();
    cx.font = "bold 12px Inter, sans-serif";
    cx.fillText(String(i + 1), x + 12, y - 8);
  });

  pickHint.textContent = pickPts.length < 4
    ? `Klicke auf das schwarze Eck-Quadrat ${ECKEN[pickPts.length]} (${pickPts.length + 1} von 4)`
    : "Wird ausgewertet …";
}

function startPicking(img) {
  pickImg = img;
  pickPts = [];
  pickScale = Math.min(720 / img.naturalWidth, 560 / img.naturalHeight, 1);
  pickCanvas.width = Math.round(img.naturalWidth * pickScale);
  pickCanvas.height = Math.round(img.naturalHeight * pickScale);
  overlay.hidden = false;
  drawPick();
}

pickCanvas.addEventListener("click", (ev) => {
  if (pickPts.length >= 4) return;

  // Klick auf dem Bildschirm -> Punkt im Originalfoto
  const rect = pickCanvas.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * pickCanvas.width;
  const y = ((ev.clientY - rect.top) / rect.height) * pickCanvas.height;
  pickPts.push([x / pickScale, y / pickScale]);
  drawPick();

  if (pickPts.length === 4) setTimeout(verarbeite, 50);
});

pickResetBtn.addEventListener("click", () => {
  pickPts = [];
  drawPick();
});

pickCancelBtn.addEventListener("click", () => {
  overlay.hidden = true;
  pickImg = null;
  melde("");
});

/* ---------- Auswerten und speichern ---------- */

function verarbeite() {
  const flat = unwarp(pickImg, pickPts);
  overlay.hidden = true;

  if (!flat) {
    melde("Die vier Ecken liegen auf einer Linie – bitte nochmal versuchen.", true);
    return;
  }

  const res = extractGlyphs(flat);

  if (res.gefunden < 10) {
    melde(`Nur ${res.gefunden} Buchstaben erkannt. Wurden die Ecken richtig angeklickt? ` +
          `Hilft meist: helleres Foto, dunklerer Stift.`, true);
    return;
  }

  const daten = { em: res.em, glyphs: res.glyphs };
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(daten));
  } catch (err) {
    melde("Konnte nicht gespeichert werden (Speicher voll) – gilt nur für diese Sitzung.", true);
  }

  ladeEigene(daten, () => {
    melde(`${res.gefunden} von ${ROWS * COLS} Buchstaben übernommen.`);
    ownClearBtn.hidden = false;
    fontEl.value = "__own__";
    render();
  });

  // Falls jemand angemeldet ist, wandert die Handschrift gleich ins Konto
  if (window.kontoAutoSichern) window.kontoAutoSichern(daten);
}

// Aus den gespeicherten Bildern echte Image-Objekte machen
function ladeEigene(daten, fertig) {
  const eintraege = Object.entries(daten.glyphs);
  const glyphs = {};
  let offen = eintraege.length;
  if (!offen) return;

  eintraege.forEach(([ch, g]) => {
    const img = new Image();
    img.onload = img.onerror = () => {
      glyphs[ch] = { img, w: g.w, h: g.h, dy: g.dy };
      if (--offen === 0) {
        ownFont = { em: daten.em, glyphs };
        addOwnOption();
        fertig && fertig();
      }
    };
    img.src = g.url;
  });
}

// Eintrag "Meine Handschrift" in die Auswahlliste
function addOwnOption() {
  if (fontEl.querySelector('option[value="__own__"]')) return;
  const og = document.createElement("optgroup");
  og.label = "Eigene";
  const opt = document.createElement("option");
  opt.value = "__own__";
  opt.textContent = "✏️ Meine Handschrift";
  og.appendChild(opt);
  fontEl.insertBefore(og, fontEl.firstChild);
}

/* ---------- Knöpfe ---------- */

tplBtn.addEventListener("click", downloadTemplate);

uploadEl.addEventListener("change", () => {
  const datei = uploadEl.files && uploadEl.files[0];
  if (!datei) return;
  melde("Bild wird geladen …");

  const img = new Image();
  img.onload = () => startPicking(img);
  img.onerror = () => melde("Das Bild konnte nicht gelesen werden.", true);
  img.src = URL.createObjectURL(datei);
});

ownClearBtn.addEventListener("click", () => {
  localStorage.removeItem(SPEICHER);
  ownFont = null;
  const og = fontEl.querySelector('optgroup[label="Eigene"]');
  if (og) og.remove();
  fontEl.value = "Patrick Hand";
  ownClearBtn.hidden = true;
  melde("Handschrift gelöscht.");
  render();
});

/* -------------------------------------------------------------
   Schnittstelle für konto.js
   Damit das Konto-Modul nicht in den Interna von scanner.js wühlen muss.
------------------------------------------------------------- */

// Was liegt in diesem Browser? (Objekt oder null)
function handschriftLokal() {
  const roh = localStorage.getItem(SPEICHER);
  if (!roh) return null;
  try {
    return JSON.parse(roh);
  } catch (err) {
    return null;
  }
}

// Handschrift aus dem Konto übernehmen und sofort benutzen
function handschriftUebernehmen(daten, fertig) {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(daten));
  } catch (err) {
    /* Speicher voll – gilt dann nur für diese Sitzung */
  }
  ladeEigene(daten, () => {
    ownClearBtn.hidden = false;
    fontEl.value = "__own__";
    render();
    fertig && fertig();
  });
}

/* ---------- Beim Start: schon gespeicherte Handschrift laden ---------- */

(function () {
  const roh = localStorage.getItem(SPEICHER);
  if (!roh) return;
  try {
    ladeEigene(JSON.parse(roh), () => {
      ownClearBtn.hidden = false;
      melde("Gespeicherte Handschrift geladen.");
    });
  } catch (err) {
    localStorage.removeItem(SPEICHER);
  }
})();
