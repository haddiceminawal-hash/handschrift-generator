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
     - Klick auf ein Textfeld  -> auswählen
     - Ziehen                  -> verschieben
     - Doppelklick auf ein Textfeld       -> Text direkt dort bearbeiten
     - Doppelklick auf eine freie Stelle  -> neues Textfeld dort anlegen
     - "×" am ausgewählten Textfeld       -> löschen
------------------------------------------------------------- */

const textLayerEl = document.getElementById("text-layer");
const addBlockBtn = document.getElementById("add-block");

let aktiverBlockId = bloecke[0].id;

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

// Für Ziehbewegungen: wie viele Seiten-Pixel entsprechen einer
// Mausbewegung von so vielen Bildschirm-Pixeln, bei der aktuellen
// (responsiven) Anzeigegröße?
function bildschirmZuSeite(deltaClientX, deltaClientY) {
  const rect = textLayerEl.getBoundingClientRect();
  return {
    dx: (deltaClientX / rect.width) * PAGE.w,
    dy: (deltaClientY / rect.height) * PAGE.h,
  };
}

/* ---------- Auswählen ---------- */

function waehleBlock(id) {
  aktiverBlockId = id;
  zeichneUeberlagerung();
}

/* ---------- Ziehen ---------- */

function beginneZiehen(ev, blockId) {
  if (ev.target.tagName === "TEXTAREA" || ev.target.tagName === "BUTTON") return;
  ev.preventDefault();
  waehleBlock(blockId);

  const block = bloecke.find((b) => b.id === blockId);
  if (!block) return;

  const startClientX = ev.clientX;
  const startClientY = ev.clientY;
  const startX = block.x;
  const startY = block.y;
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
      block.x = Math.min(Math.max(10, startX + dx), PAGE.w - block.w - 10);
      block.y = Math.min(Math.max(10, startY + dy), PAGE.h - 40);
      render();
    });
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
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
  }

  ta.addEventListener("blur", commit);
  ta.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") ta.blur();
  });
}

/* ---------- Hinzufügen / Löschen ---------- */

function neuesTextfeld(x, y) {
  const id = naechsteBlockId++;
  bloecke.push({ id, text: "", x: Math.round(x), y: Math.round(y), w: 340 });
  aktiverBlockId = id;
  render().then(() => bearbeiteBlock(id));
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
    return;
  }
  bloecke = bloecke.filter((b) => b.id !== blockId);
  if (aktiverBlockId === blockId) aktiverBlockId = bloecke[0].id;
  render();
}

/* ---------- Die Klickflächen neu aufbauen ---------- */

function zeichneUeberlagerung() {
  textLayerEl.innerHTML = "";

  letzteBlockBoxen.forEach((box) => {
    const hit = document.createElement("div");
    hit.className = "text-block-hit";
    hit.dataset.blockId = box.id;
    if (box.id === aktiverBlockId) hit.classList.add("ausgewaehlt");
    positioniere(hit, box);

    hit.addEventListener("pointerdown", (ev) => beginneZiehen(ev, box.id));
    hit.addEventListener("dblclick", (ev) => {
      ev.stopPropagation();
      bearbeiteBlock(box.id);
    });

    // Löschen geht nur, wenn noch ein zweites Textfeld übrig bleibt –
    // das letzte Textfeld kann nur geleert, nicht entfernt werden.
    if (box.id === aktiverBlockId && bloecke.length > 1) {
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

    textLayerEl.appendChild(hit);
  });
}

// Ab jetzt ruft render() nach jedem Zeichnen zeichneUeberlagerung() auf.
// Einmal selbst neu zeichnen, damit die Klickflächen auch beim ersten
// Laden schon da sind (der allererste render()-Aufruf in script.js lief
// noch, bevor diese Datei geladen war).
onNachRender = zeichneUeberlagerung;
render();
