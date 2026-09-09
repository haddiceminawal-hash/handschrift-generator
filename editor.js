/* -------------------------------------------------------------
   Textfelder und Bilder direkt auf dem Blatt bedienen

   Ein Canvas kann nichts anklicken lassen – sobald etwas gezeichnet ist,
   sind es nur noch Pixel. Deshalb liegt über jeder Seite eine unsichtbare,
   exakt passende HTML-Ebene (.text-layer, eine pro Seite). Für jeden
   Block liegt darin eine unsichtbare Klick-/Zieh-Fläche, positioniert
   per Prozent – so bleibt sie auch bei responsiver Verkleinerung und bei
   mehreren Seiten exakt über dem passenden Inhalt.

   Weil es jetzt mehrere Seiten gleichzeitig geben kann, hängen die
   Klick-Ereignisse nicht mehr an jeder einzelnen Klickfläche, sondern
   per Delegation an #page-wrap (dem gemeinsamen Elternteil aller
   Seiten) – neue Seiten brauchen dadurch keine eigene Verkabelung.

   Bedienung:
     - Klick auf einen Block                -> auswählen
     - Umschalt-/Cmd-Klick                   -> Mehrfachauswahl
     - Ziehen                                -> verschieben
     - Ziehen an den blauen Punkten          -> Größe ändern
     - Doppelklick auf ein Textfeld          -> Text direkt dort bearbeiten
     - Doppelklick auf ein Bild              -> Bild ersetzen
     - Doppelklick auf eine freie Stelle     -> neues Textfeld dort anlegen
     - "×" am ausgewählten Block             -> löschen
     - Werkzeugleiste unten / Strg+Z         -> ausrichten, anordnen, rückgängig
------------------------------------------------------------- */

const addBlockBtn = document.getElementById("add-block");
const addImageBtn = document.getElementById("add-image");
const addSignatureBtn = document.getElementById("add-signature");
const bildDateiInput = document.getElementById("bild-datei");
const unterschriftDateiInput = document.getElementById("unterschrift-datei");
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");
const arrangeToolbarEl = document.getElementById("arrange-toolbar");
const alignButtonsEl = document.getElementById("align-buttons");
const bringFrontBtn = document.getElementById("bring-front");
const sendBackBtn = document.getElementById("send-back");

// Mehrere Blöcke können gleichzeitig ausgewählt sein (für Ausrichten).
let ausgewaehlt = new Set([bloecke[0].id]);

/* ---------- Koordinaten: Seiten-Pixel <-> Bildschirm ---------- */

// Die Klickflächen werden in Prozent von PAGE.w/h positioniert, damit
// sie unabhängig von der tatsächlichen Anzeigegröße immer exakt über
// dem passenden Inhalt liegen.
function positioniere(el, box) {
  el.style.left = (box.x / PAGE.w) * 100 + "%";
  el.style.top = (box.y / PAGE.h) * 100 + "%";
  el.style.width = (box.w / PAGE.w) * 100 + "%";
  el.style.height = (box.h / PAGE.h) * 100 + "%";
}

// Für Zieh-/Größenänderungs-Bewegungen: wie viele Seiten-Pixel
// entsprechen einer Mausbewegung von so vielen Bildschirm-Pixeln, bei
// der aktuellen (responsiven) Anzeigegröße der jeweiligen Seite?
function bildschirmZuSeite(layer, deltaClientX, deltaClientY) {
  const rect = layer.getBoundingClientRect();
  return {
    dx: (deltaClientX / rect.width) * PAGE.w,
    dy: (deltaClientY / rect.height) * PAGE.h,
  };
}

// Die "Heimat"-Box eines Blocks – bei Textfeldern, die über mehrere
// Seiten laufen, gibt es davon mehrere Boxen, aber nur die erste
// (heim: true) trägt die Klickfläche.
function letzteBoxVon(id) {
  return letzteBlockBoxen.find((b) => b.id === id && b.heim !== false);
}

/* ---------- Verlauf (Rückgängig / Wiederholen) ---------- */

// Ein einfacher Stapel von Momentaufnahmen der Blöcke. Aufgezeichnet
// wird nicht bei jeder Mausbewegung, sondern nur am Ende einer Aktion
// (Ziehen fertig, Text verlassen, Block hinzugefügt/gelöscht, ...) –
// sonst bräuchte man beim Rückgängigmachen hunderte Klicks für eine
// einzige Zieh-Bewegung. Die Seitenzahl selbst (mindestSeiten) gehört
// nicht zum Verlauf – "Seite hinzufügen" lässt sich nicht rückgängig
// machen, das wäre für den geringen Nutzen zu viel zusätzliche Logik.
let historie = [];
let historieZeiger = -1;
let historieBlockiert = false;

function klon(stand) {
  return stand.map((b) => ({ ...b }));
}

function sicherePunkt() {
  if (historieBlockiert) return;
  historie = historie.slice(0, historieZeiger + 1);
  historie.push(klon(bloecke));
  if (historie.length > 50) historie.shift();
  historieZeiger = historie.length - 1;
  aktualisiereVerlaufKnoepfe();
}

function setzeSeitenleiste() {
  inputEl.value = bloecke[0] && bloecke[0].type !== "image" ? bloecke[0].text : "";
}

function verlaufWiederherstellen(stand) {
  historieBlockiert = true;
  bloecke = klon(stand);
  historieBlockiert = false;
  ausgewaehlt = new Set([...ausgewaehlt].filter((id) => bloecke.some((b) => b.id === id)));
  setzeSeitenleiste();
  render();
  aktualisiereVerlaufKnoepfe();
}

function rueckgaengig() {
  if (historieZeiger <= 0) return;
  historieZeiger--;
  verlaufWiederherstellen(historie[historieZeiger]);
}

function wiederholen() {
  if (historieZeiger >= historie.length - 1) return;
  historieZeiger++;
  verlaufWiederherstellen(historie[historieZeiger]);
}

function aktualisiereVerlaufKnoepfe() {
  undoBtn.disabled = historieZeiger <= 0;
  redoBtn.disabled = historieZeiger >= historie.length - 1;
}

undoBtn.addEventListener("click", rueckgaengig);
redoBtn.addEventListener("click", wiederholen);

// Strg/Cmd+Z rückgängig, Strg/Cmd+Umschalt+Z bzw. Strg+Y wiederholen –
// aber nicht, während in einem Textfeld getippt wird (dort soll das
// normale Bearbeiten-Undo des Browsers greifen).
window.addEventListener("keydown", (ev) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "TEXTAREA" || tag === "INPUT") return;

  const key = ev.key.toLowerCase();
  if (!(ev.metaKey || ev.ctrlKey)) return;

  if (key === "z" && ev.shiftKey) {
    ev.preventDefault();
    wiederholen();
  } else if (key === "z") {
    ev.preventDefault();
    rueckgaengig();
  } else if (key === "y") {
    ev.preventDefault();
    wiederholen();
  }
});

/* ---------- Auswählen ---------- */

function waehleBlock(id) {
  ausgewaehlt = new Set([id]);
  zeichneUeberlagerung();
}

function toggleAuswahl(id) {
  if (ausgewaehlt.has(id)) ausgewaehlt.delete(id);
  else ausgewaehlt.add(id);
  zeichneUeberlagerung();
}

function waehleNichts() {
  ausgewaehlt = new Set();
  zeichneUeberlagerung();
}

/* ---------- Ziehen (verschieben) ---------- */

function beginneZiehen(ev, blockId, layer) {
  if (ev.target.tagName === "TEXTAREA") return;
  ev.preventDefault();

  if (ev.shiftKey || ev.metaKey || ev.ctrlKey) {
    toggleAuswahl(blockId);
    return;   // Umschalt-Klick baut nur die Auswahl auf, zieht nicht mit
  }
  if (!(ausgewaehlt.size === 1 && ausgewaehlt.has(blockId))) waehleBlock(blockId);

  const block = bloecke.find((b) => b.id === blockId);
  if (!block) return;

  const startClientX = ev.clientX;
  const startClientY = ev.clientY;
  const startX = block.x;
  const startY = block.y;
  let frameAusstehend = false;
  let bewegt = false;

  // Die Position wird bei jeder Bewegung sofort berechnet (billig) – nur
  // das teure Neuzeichnen wird per rAF gedrosselt. So steht block.x/y
  // beim Loslassen immer schon auf dem aktuellen Stand, unabhängig davon,
  // ob gerade noch ein Zeichen-Frame aussteht (sonst könnte sicherePunkt()
  // beim schnellen Loslassen eine veraltete Position sichern).
  function onMove(moveEv) {
    bewegt = true;
    const { dx, dy } = bildschirmZuSeite(
      layer,
      moveEv.clientX - startClientX,
      moveEv.clientY - startClientY
    );
    block.x = Math.min(Math.max(10, startX + dx), PAGE.w - block.w - 10);
    block.y = Math.min(Math.max(10, startY + dy), PAGE.h - 40);

    if (frameAusstehend) return;
    frameAusstehend = true;
    requestAnimationFrame(() => {
      frameAusstehend = false;
      render();
    });
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (bewegt) { render(); sicherePunkt(); }
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

/* ---------- Größe ändern ---------- */

function beginneGroessenAendern(ev, blockId, richtung, layer) {
  ev.preventDefault();
  ev.stopPropagation();

  const block = bloecke.find((b) => b.id === blockId);
  if (!block) return;

  const startClientX = ev.clientX;
  const startClientY = ev.clientY;
  const startW = block.w;
  const startBox = letzteBoxVon(blockId);
  const startH = block.h || (startBox ? startBox.h : 100);
  let frameAusstehend = false;

  function onMove(moveEv) {
    const { dx, dy } = bildschirmZuSeite(
      layer,
      moveEv.clientX - startClientX,
      moveEv.clientY - startClientY
    );
    if (richtung.includes("e")) {
      block.w = Math.max(80, Math.min(startW + dx, PAGE.w - block.x - 20));
    }
    if (richtung.includes("s")) {
      block.h = Math.max(30, Math.min(startH + dy, PAGE.h - block.y - 20));
    }

    if (frameAusstehend) return;
    frameAusstehend = true;
    requestAnimationFrame(() => {
      frameAusstehend = false;
      render();
    });
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    render();
    sicherePunkt();
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function erzeugeResizeHandles(hit, blockId, layer) {
  ["e", "s", "se"].forEach((name) => {
    const handle = document.createElement("div");
    handle.className = `resize-handle resize-${name}`;
    handle.addEventListener("pointerdown", (ev) => beginneGroessenAendern(ev, blockId, name, layer));
    hit.appendChild(handle);
  });
}

/* ---------- Text direkt auf dem Blatt bearbeiten ---------- */

function bearbeiteBlock(blockId) {
  const block = bloecke.find((b) => b.id === blockId);
  if (!block || block.type === "image") return;
  const layer = seitenLayerListe[block.seite || 0];
  const hit = layer && layer.querySelector(`[data-block-id="${blockId}"]`);
  if (!hit || hit.querySelector("textarea")) return;

  hit.innerHTML = "";
  const ta = document.createElement("textarea");
  ta.className = "block-editor";
  ta.value = block.text;
  ta.spellcheck = false;
  hit.appendChild(ta);
  ta.focus();
  ta.select();

  function commit() {
    block.text = ta.value;
    // Textfeld 1 ist an die Seitenleiste gekoppelt – auch von hier aus
    if (block.id === bloecke[0].id) setzeSeitenleiste();
    render();
    sicherePunkt();
  }

  ta.addEventListener("blur", commit);
  ta.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") ta.blur();
  });
}

// Auch Änderungen über die Seitenleiste sollen rückgängig gemacht
// werden können – aufgezeichnet wird beim Verlassen des Feldes, nicht
// bei jedem Tastendruck.
inputEl.addEventListener("blur", () => sicherePunkt());

/* ---------- Bilder & Unterschriften ---------- */

function bildAusDataURL(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = url;
  });
}

function ladeBildDatei(datei) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(bildAusDataURL(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(datei);
  }).then((p) => p);
}

// Für Unterschriften: helle/weiße Bereiche des Fotos werden transparent,
// damit die linierten Blattlinien durch den Hintergrund hindurchscheinen
// statt hinter einem weißen Rechteck zu verschwinden. Weicher Übergang
// statt harter Kante, damit es nicht ausgeschnitten wirkt.
function entferneWeiss(dataUrlBild) {
  return dataUrlBild.then((img) => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const cx = c.getContext("2d");
    cx.drawImage(img, 0, 0);
    const daten = cx.getImageData(0, 0, c.width, c.height);
    const p = daten.data;
    for (let i = 0; i < p.length; i += 4) {
      const helligkeit = (p[i] + p[i + 1] + p[i + 2]) / 3;
      if (helligkeit > 235) p[i + 3] = 0;
      else if (helligkeit > 195) p[i + 3] = Math.round((p[i + 3] * (235 - helligkeit)) / 40);
    }
    cx.putImageData(daten, 0, 0);
    return bildAusDataURL(c.toDataURL("image/png"));
  });
}

async function fuegeBildEin(datei, { transparent, breite, x, y, seite }) {
  let bildPromise = ladeBildDatei(datei);
  if (transparent) bildPromise = entferneWeiss(bildPromise);
  const img = await bildPromise;

  const verhaeltnis = img.naturalHeight / img.naturalWidth;
  const w = breite;
  const h = Math.round(w * verhaeltnis);
  const id = naechsteBlockId++;

  bloecke.push({
    id, type: "image", img,
    x: Math.round(Math.min(Math.max(10, x - w / 2), PAGE.w - w - 10)),
    y: Math.round(Math.min(Math.max(10, y - h / 2), PAGE.h - h - 10)),
    w, h, seite: seite || 0,
  });
  ausgewaehlt = new Set([id]);
  render();
  sicherePunkt();
}

function bearbeiteBildBlock(blockId) {
  const block = bloecke.find((b) => b.id === blockId);
  if (!block) return;

  const temp = document.createElement("input");
  temp.type = "file";
  temp.accept = "image/*";
  temp.addEventListener("change", async () => {
    const datei = temp.files[0];
    if (!datei) return;
    const img = await ladeBildDatei(datei);
    block.img = img;
    // Höhe an das neue Seitenverhältnis anpassen, Breite bleibt erhalten
    block.h = Math.round(block.w * (img.naturalHeight / img.naturalWidth));
    render();
    sicherePunkt();
  });
  temp.click();
}

addImageBtn.addEventListener("click", () => bildDateiInput.click());
addSignatureBtn.addEventListener("click", () => unterschriftDateiInput.click());

bildDateiInput.addEventListener("change", () => {
  const datei = bildDateiInput.files[0];
  bildDateiInput.value = "";
  if (!datei) return;
  fuegeBildEin(datei, { transparent: false, breite: 280, x: PAGE.w / 2, y: PAGE.h / 2, seite: 0 });
});

unterschriftDateiInput.addEventListener("change", () => {
  const datei = unterschriftDateiInput.files[0];
  unterschriftDateiInput.value = "";
  if (!datei) return;
  fuegeBildEin(datei, { transparent: true, breite: 190, x: 210, y: PAGE.h - 130, seite: 0 });
});

/* ---------- Textfeld hinzufügen ---------- */

function neuesTextfeld(x, y, seite) {
  const id = naechsteBlockId++;
  bloecke.push({ id, type: "text", text: "", x: Math.round(x), y: Math.round(y), w: 340, seite: seite || 0 });
  ausgewaehlt = new Set([id]);
  render().then(() => {
    sicherePunkt();
    bearbeiteBlock(id);
  });
}

addBlockBtn.addEventListener("click", () => {
  // Leicht gestaffelt, damit mehrere neue Textfelder nicht exakt
  // übereinander landen.
  const versatz = ((bloecke.length - 1) * 55) % 260;
  neuesTextfeld(140 + versatz, 260 + versatz, 0);
});

/* ---------- Löschen ---------- */

function loescheBlock(blockId) {
  bloecke = bloecke.filter((b) => b.id !== blockId);
  if (bloecke.length === 0) {
    // Nie ganz leer – sonst gäbe es plötzlich nichts mehr zum Bearbeiten.
    bloecke.push({
      id: naechsteBlockId++, type: "text", text: "",
      x: BASE_MARGIN.left, y: BASE_MARGIN.top, w: 664, seite: 0,
    });
  }
  ausgewaehlt.delete(blockId);
  if (ausgewaehlt.size === 0 && bloecke[0]) ausgewaehlt.add(bloecke[0].id);
  setzeSeitenleiste();
  render();
  sicherePunkt();
}

/* ---------- Ausrichten ---------- */

// Richtet alle ausgewählten Blöcke an den äußersten Rändern der
// gesamten Auswahl aus – wie "Linksbündig ausrichten" & Co. in Word.
function richteAus(art) {
  const ids = [...ausgewaehlt];
  const eintraege = ids
    .map((id) => ({ block: bloecke.find((b) => b.id === id), box: letzteBoxVon(id) }))
    .filter((e) => e.block && e.box);
  if (eintraege.length < 2) return;

  const minX = Math.min(...eintraege.map((e) => e.box.x));
  const maxX = Math.max(...eintraege.map((e) => e.box.x + e.box.w));
  const minY = Math.min(...eintraege.map((e) => e.box.y));
  const maxY = Math.max(...eintraege.map((e) => e.box.y + e.box.h));

  eintraege.forEach(({ block, box }) => {
    // Innenabstand zwischen der (etwas größeren) Klickfläche und dem
    // eigentlichen Ursprung berücksichtigen, sonst verschiebt sich der
    // Inhalt beim Ausrichten minimal.
    const versatzX = block.x - box.x;
    const versatzY = block.y - box.y;

    if (art === "left") block.x = minX + versatzX;
    else if (art === "right") block.x = maxX - box.w + versatzX;
    else if (art === "center-h") block.x = minX + (maxX - minX - box.w) / 2 + versatzX;
    else if (art === "top") block.y = minY + versatzY;
    else if (art === "bottom") block.y = maxY - box.h + versatzY;
    else if (art === "middle-v") block.y = minY + (maxY - minY - box.h) / 2 + versatzY;
  });

  render();
  sicherePunkt();
}

alignButtonsEl.querySelectorAll(".arrange-btn").forEach((btn) => {
  btn.addEventListener("click", () => richteAus(btn.dataset.align));
});

/* ---------- Anordnen (vorne/hinten) ---------- */

// Die Reihenfolge im bloecke-Array bestimmt sowohl die Zeichenreihenfolge
// auf dem Canvas als auch die Stapelreihenfolge der Klickflächen im DOM –
// "nach vorne" heißt also schlicht: ans Ende des Arrays verschieben.
function nachVorne() {
  if (ausgewaehlt.size === 0) return;
  const vorne = bloecke.filter((b) => ausgewaehlt.has(b.id));
  const rest = bloecke.filter((b) => !ausgewaehlt.has(b.id));
  bloecke = [...rest, ...vorne];
  render();
  sicherePunkt();
}

function nachHinten() {
  if (ausgewaehlt.size === 0) return;
  const hinten = bloecke.filter((b) => ausgewaehlt.has(b.id));
  const rest = bloecke.filter((b) => !ausgewaehlt.has(b.id));
  bloecke = [...hinten, ...rest];
  render();
  sicherePunkt();
}

bringFrontBtn.addEventListener("click", nachVorne);
sendBackBtn.addEventListener("click", nachHinten);

function aktualisiereArrangeToolbar() {
  const anzahl = ausgewaehlt.size;
  arrangeToolbarEl.hidden = anzahl < 1;
  alignButtonsEl.hidden = anzahl < 2;
}

/* ---------- Ereignisse: per Delegation auf #page-wrap ----------
   Damit neue Seiten nicht jedes Mal neu verkabelt werden müssen, hängen
   Klick-/Zieh-/Doppelklick-Ereignisse zentral an #page-wrap statt an
   jeder einzelnen .text-layer/.text-block-hit. */

pageWrapEl.addEventListener("pointerdown", (ev) => {
  const hit = ev.target.closest(".text-block-hit");
  const layer = ev.target.closest(".text-layer");

  if (hit) {
    beginneZiehen(ev, Number(hit.dataset.blockId), layer || seitenLayerListe[0]);
  } else if (layer && ev.target === layer) {
    waehleNichts();
  }
});

pageWrapEl.addEventListener("dblclick", (ev) => {
  const hit = ev.target.closest(".text-block-hit");
  const layer = ev.target.closest(".text-layer");

  if (hit) {
    const id = Number(hit.dataset.blockId);
    const block = bloecke.find((b) => b.id === id);
    if (block && block.type === "image") bearbeiteBildBlock(id);
    else bearbeiteBlock(id);
    return;
  }

  // Doppelklick auf eine freie Stelle: neues Textfeld genau dort anlegen
  if (layer && ev.target === layer) {
    const rect = layer.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * PAGE.w;
    const y = ((ev.clientY - rect.top) / rect.height) * PAGE.h;
    neuesTextfeld(x, y, Number(layer.dataset.seite));
  }
});

/* ---------- Die Klickflächen neu aufbauen ---------- */

function zeichneUeberlagerung() {
  seitenLayerListe.forEach((layer) => { layer.innerHTML = ""; });

  letzteBlockBoxen.forEach((box) => {
    // Fortsetzungs-Textabschnitte auf Folgeseiten (wenn ein Textfeld über
    // die Seite hinausläuft) bekommen bewusst keine eigene Klickfläche –
    // bedient wird ausschließlich über den Anfang des Textfelds.
    if (box.heim === false) return;

    const layer = seitenLayerListe[box.seite || 0];
    if (!layer) return;

    const block = bloecke.find((b) => b.id === box.id);
    const istAusgewaehlt = ausgewaehlt.has(box.id);

    const hit = document.createElement("div");
    hit.className = "text-block-hit";
    hit.dataset.blockId = box.id;
    if (block && block.type === "image") hit.classList.add("bild-feld");
    if (istAusgewaehlt) hit.classList.add("ausgewaehlt");
    positioniere(hit, box);

    if (istAusgewaehlt) {
      const loeschBtn = document.createElement("button");
      loeschBtn.type = "button";
      loeschBtn.className = "text-block-loeschen";
      loeschBtn.textContent = "×";
      loeschBtn.title = "Löschen";
      loeschBtn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      loeschBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        loescheBlock(box.id);
      });
      hit.appendChild(loeschBtn);
    }

    // Anfasser zum Größenändern nur bei genau einem ausgewählten Block –
    // bei mehreren wäre unklar, wessen Größe gemeint ist.
    if (istAusgewaehlt && ausgewaehlt.size === 1) {
      erzeugeResizeHandles(hit, box.id, layer);
    }

    layer.appendChild(hit);
  });

  aktualisiereArrangeToolbar();
}

// Ab jetzt ruft render() nach jedem Zeichnen zeichneUeberlagerung() auf.
// Einmal selbst neu zeichnen, damit die Klickflächen auch beim ersten
// Laden schon da sind (der allererste render()-Aufruf in script.js lief
// noch, bevor diese Datei geladen war). Danach den Ausgangszustand als
// ersten Verlaufs-Punkt sichern.
onNachRender = zeichneUeberlagerung;
render().then(() => sicherePunkt());
