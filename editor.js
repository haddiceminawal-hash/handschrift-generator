/* -------------------------------------------------------------
   Textfelder direkt auf dem Blatt bedienen

   Der Canvas selbst kann nichts anklicken oder verschieben lassen –
   sobald etwas gezeichnet ist, sind es nur noch Pixel. Deshalb liegt
   über dem Canvas eine unsichtbare, exakt passende HTML-Ebene
   (#text-layer). Für jedes Textfeld liegt darin eine unsichtbare
   Klick-/Zieh-Fläche, positioniert per Prozent – so bleibt sie auch
   dann exakt über dem passenden Text, wenn die Seite responsiv
   verkleinert wird.

   Bedienung:
     - Klick auf ein Textfeld              -> auswählen
     - Umschalt-/Cmd-Klick                  -> Mehrfachauswahl
     - Ziehen                               -> verschieben
     - Ziehen an den blauen Punkten         -> Größe ändern
     - Doppelklick auf ein Textfeld         -> Text direkt dort bearbeiten
     - Doppelklick auf eine freie Stelle    -> neues Textfeld dort anlegen
     - "×" am ausgewählten Textfeld         -> löschen
     - Werkzeugleiste unten / Strg+Z        -> ausrichten, anordnen, rückgängig
------------------------------------------------------------- */

const textLayerEl = document.getElementById("text-layer");
const addBlockBtn = document.getElementById("add-block");
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");
const arrangeToolbarEl = document.getElementById("arrange-toolbar");
const alignButtonsEl = document.getElementById("align-buttons");
const bringFrontBtn = document.getElementById("bring-front");
const sendBackBtn = document.getElementById("send-back");

// Mehrere Textfelder können gleichzeitig ausgewählt sein (für Ausrichten).
let ausgewaehlt = new Set([bloecke[0].id]);

/* ---------- Koordinaten: Seiten-Pixel <-> Bildschirm ---------- */

// Die Klickflächen werden in Prozent von PAGE.w/h positioniert, damit
// sie unabhängig von der tatsächlichen Anzeigegröße immer exakt über
// dem passenden Text liegen.
function positioniere(el, box) {
  el.style.left = (box.x / PAGE.w) * 100 + "%";
  el.style.top = (box.y / PAGE.h) * 100 + "%";
  el.style.width = (box.w / PAGE.w) * 100 + "%";
  el.style.height = (box.h / PAGE.h) * 100 + "%";
}

// Für Zieh-/Größenänderungs-Bewegungen: wie viele Seiten-Pixel
// entsprechen einer Mausbewegung von so vielen Bildschirm-Pixeln, bei
// der aktuellen (responsiven) Anzeigegröße?
function bildschirmZuSeite(deltaClientX, deltaClientY) {
  const rect = textLayerEl.getBoundingClientRect();
  return {
    dx: (deltaClientX / rect.width) * PAGE.w,
    dy: (deltaClientY / rect.height) * PAGE.h,
  };
}

function letzteBoxVon(id) {
  return letzteBlockBoxen.find((b) => b.id === id);
}

/* ---------- Verlauf (Rückgängig / Wiederholen) ---------- */

// Ein einfacher Stapel von Momentaufnahmen der Textfelder. Aufgezeichnet
// wird nicht bei jeder Mausbewegung, sondern nur am Ende einer Aktion
// (Ziehen fertig, Text verlassen, Textfeld hinzugefügt/gelöscht, ...) –
// sonst bräuchte man beim Rückgängigmachen hunderte Klicks für eine
// einzige Zieh-Bewegung.
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

function verlaufWiederherstellen(stand) {
  historieBlockiert = true;
  bloecke = klon(stand);
  historieBlockiert = false;
  ausgewaehlt = new Set([...ausgewaehlt].filter((id) => bloecke.some((b) => b.id === id)));
  if (bloecke[0]) inputEl.value = bloecke[0].text;
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

// Klick auf die freie Fläche (nicht auf ein Textfeld) hebt die
// Auswahl auf. pointerdown statt click, weil sich click nach einem
// Ziehvorgang browserübergreifend nicht zuverlässig verhält.
textLayerEl.addEventListener("pointerdown", (ev) => {
  if (ev.target === textLayerEl) waehleNichts();
});

/* ---------- Ziehen (verschieben) ---------- */

function beginneZiehen(ev, blockId) {
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

  function onMove(moveEv) {
    bewegt = true;
    if (frameAusstehend) return;
    frameAusstehend = true;
    requestAnimationFrame(() => {
      frameAusstehend = false;
      const { dx, dy } = bildschirmZuSeite(
        moveEv.clientX - startClientX,
        moveEv.clientY - startClientY
      );
      block.x = Math.min(Math.max(10, startX + dx), PAGE.w - block.w - 10);
      block.y = Math.min(Math.max(10, startY + dy), PAGE.h - 40);
      render();
    });
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (bewegt) sicherePunkt();
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

/* ---------- Größe ändern ---------- */

function beginneGroessenAendern(ev, blockId, richtung) {
  ev.preventDefault();
  ev.stopPropagation();

  const block = bloecke.find((b) => b.id === blockId);
  if (!block) return;

  const startClientX = ev.clientX;
  const startClientY = ev.clientY;
  const startW = block.w;
  const startH = block.h || (letzteBoxVon(blockId) ? letzteBoxVon(blockId).h : 100);
  let frameAusstehend = false;

  function onMove(moveEv) {
    if (frameAusstehend) return;
    frameAusstehend = true;
    requestAnimationFrame(() => {
      frameAusstehend = false;
      const { dx, dy } = bildschirmZuSeite(
        moveEv.clientX - startClientX,
        moveEv.clientY - startClientY
      );
      if (richtung.includes("e")) {
        block.w = Math.max(80, Math.min(startW + dx, PAGE.w - block.x - 20));
      }
      if (richtung.includes("s")) {
        block.h = Math.max(30, Math.min(startH + dy, PAGE.h - block.y - 20));
      }
      render();
    });
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    sicherePunkt();
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function erzeugeResizeHandles(hit, blockId) {
  [
    { name: "e" },
    { name: "s" },
    { name: "se" },
  ].forEach((r) => {
    const handle = document.createElement("div");
    handle.className = `resize-handle resize-${r.name}`;
    handle.addEventListener("pointerdown", (ev) => beginneGroessenAendern(ev, blockId, r.name));
    hit.appendChild(handle);
  });
}

/* ---------- Direkt auf dem Blatt bearbeiten ---------- */

function bearbeiteBlock(blockId) {
  const block = bloecke.find((b) => b.id === blockId);
  const hit = textLayerEl.querySelector(`[data-block-id="${blockId}"]`);
  if (!block || !hit || hit.querySelector("textarea")) return;

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
    if (block.id === bloecke[0].id) inputEl.value = block.text;
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

/* ---------- Hinzufügen / Löschen ---------- */

function neuesTextfeld(x, y) {
  const id = naechsteBlockId++;
  bloecke.push({ id, text: "", x: Math.round(x), y: Math.round(y), w: 340 });
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
  neuesTextfeld(140 + versatz, 260 + versatz);
});

// Doppelklick auf eine freie Stelle im Textfelder-Bereich legt dort
// ein neues Textfeld an – so kann man auch ganz ohne Seitenleiste
// direkt auf dem Blatt zu schreiben anfangen.
textLayerEl.addEventListener("dblclick", (ev) => {
  if (ev.target !== textLayerEl) return;
  const rect = textLayerEl.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * PAGE.w;
  const y = ((ev.clientY - rect.top) / rect.height) * PAGE.h;
  neuesTextfeld(x, y);
});

function loescheBlock(blockId) {
  if (bloecke.length <= 1) {
    // Das letzte Textfeld bleibt bestehen, wird aber leer –
    // sonst gäbe es plötzlich gar keinen Text mehr zum Bearbeiten.
    bloecke[0].text = "";
    inputEl.value = "";
    render();
    sicherePunkt();
    return;
  }
  bloecke = bloecke.filter((b) => b.id !== blockId);
  ausgewaehlt.delete(blockId);
  if (ausgewaehlt.size === 0 && bloecke[0]) ausgewaehlt.add(bloecke[0].id);
  render();
  sicherePunkt();
}

/* ---------- Ausrichten ---------- */

// Richtet alle ausgewählten Textfelder an den äußersten Rändern der
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
    // eigentlichen Text-Ursprung berücksichtigen, sonst verschiebt
    // sich der Text beim Ausrichten minimal.
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

/* ---------- Die Klickflächen neu aufbauen ---------- */

function zeichneUeberlagerung() {
  textLayerEl.innerHTML = "";

  letzteBlockBoxen.forEach((box) => {
    const hit = document.createElement("div");
    hit.className = "text-block-hit";
    hit.dataset.blockId = box.id;
    const istAusgewaehlt = ausgewaehlt.has(box.id);
    if (istAusgewaehlt) hit.classList.add("ausgewaehlt");
    positioniere(hit, box);

    hit.addEventListener("pointerdown", (ev) => beginneZiehen(ev, box.id));
    hit.addEventListener("dblclick", (ev) => {
      ev.stopPropagation();
      bearbeiteBlock(box.id);
    });

    // Löschen geht nur, wenn noch ein zweites Textfeld übrig bleibt –
    // das letzte Textfeld kann nur geleert, nicht entfernt werden.
    if (istAusgewaehlt && bloecke.length > 1) {
      const loeschBtn = document.createElement("button");
      loeschBtn.type = "button";
      loeschBtn.className = "text-block-loeschen";
      loeschBtn.textContent = "×";
      loeschBtn.title = "Textfeld löschen";
      loeschBtn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      loeschBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        loescheBlock(box.id);
      });
      hit.appendChild(loeschBtn);
    }

    // Anfasser zum Größenändern nur bei genau einem ausgewählten
    // Textfeld – bei mehreren wäre unklar, wessen Größe gemeint ist.
    if (istAusgewaehlt && ausgewaehlt.size === 1) {
      erzeugeResizeHandles(hit, box.id);
    }

    textLayerEl.appendChild(hit);
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
