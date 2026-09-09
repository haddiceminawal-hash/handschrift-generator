// supabase/functions/arbeitsblatt-generieren/index.ts
//
// Generiert einen kurzen Übungstext für ein Arbeitsblatt per Claude
// (Anthropic Messages API). Nur für Konten mit Rolle "lehrer" – die Rolle
// wird HIER serverseitig aus der profiles-Tabelle gelesen (mit dem
// service_role-Key, der Row Level Security umgeht), nie einem vom Client
// mitgeschickten Feld vertraut. Ein Schüler-Konto könnte sich sonst per
// Browser-Konsole selbst als Lehrer ausgeben.
//
// Deployment: siehe KONTO-SETUP.md, Abschnitt "Rollen und
// KI-Arbeitsblatt-Generator" – am einfachsten über das Supabase-Dashboard
// (Edge Functions → Deploy a new function), kein Terminal nötig. Der
// Funktionsname muss exakt "arbeitsblatt-generieren" sein, damit er zum
// Aufruf in ki.js passt.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Muss manuell als Secret gesetzt werden (siehe KONTO-SETUP.md) – ohne ihn
// bleibt die Funktion inaktiv, statt mit einer kryptischen Fehlermeldung
// abzustürzen.
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Grobe, einfache Kostenbremse statt eines generischen Rate-Limitings –
// reicht für den Start, bei echter Nutzung später verfeinern.
const TAGES_LIMIT = 20;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Methode nicht erlaubt" }, 405);

  if (!ANTHROPIC_KEY) {
    return json({ error: "KI-Funktion ist noch nicht eingerichtet (kein Anthropic-Key)." }, 503);
  }

  // 1) Wer ruft hier an? JWT aus dem Authorization-Header prüfen.
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Nicht angemeldet." }, 401);

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "Ungültige Sitzung." }, 401);
  const userId = userData.user.id;

  // 2) Rolle NUR aus profiles lesen, mit service_role (umgeht RLS) – die
  //    einzige vertrauenswürdige Quelle, nie ein Feld aus dem Request-Body.
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: profil, error: profilErr } = await supabaseAdmin
    .from("profiles")
    .select("role, ai_uses_heute, ai_uses_datum")
    .eq("id", userId)
    .single();

  if (profilErr || !profil) return json({ error: "Kein Profil gefunden." }, 403);
  if (profil.role !== "lehrer") return json({ error: "Nur für Lehrkräfte verfügbar." }, 403);

  // 3) Tageslimit prüfen.
  const heute = new Date().toISOString().slice(0, 10);
  const bisherHeute = profil.ai_uses_datum === heute ? profil.ai_uses_heute : 0;
  if (bisherHeute >= TAGES_LIMIT) {
    return json({ error: `Tageslimit von ${TAGES_LIMIT} Generierungen erreicht.` }, 429);
  }

  // 4) Eingabe lesen und knapp begrenzen (Kostenschutz).
  let thema = "";
  try {
    const body = await req.json();
    thema = String(body?.thema ?? "").trim().slice(0, 300);
  } catch {
    // leerer/ungültiger Body -> thema bleibt "", wird unten abgefangen
  }
  if (!thema) return json({ error: "Bitte ein Thema angeben." }, 400);

  // 5) Claude aufrufen – der Anthropic-Key bleibt serverseitig, landet nie
  //    im Client.
  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 600,
      messages: [{
        role: "user",
        content:
          `Schreibe einen kurzen Übungstext für ein Grundschul-Arbeitsblatt ` +
          `zum Thema "${thema}". Nur der reine Übungstext auf Deutsch, ` +
          `keine Überschrift, keine Erklärung drumherum.`,
      }],
    }),
  });

  if (!aiRes.ok) {
    return json({ error: "KI-Anfrage fehlgeschlagen." }, 502);
  }
  const aiJson = await aiRes.json();
  const text: string = aiJson?.content?.[0]?.text ?? "";
  if (!text) return json({ error: "Keine Antwort erhalten." }, 502);

  // 6) Zähler erst NACH erfolgreichem Aufruf hochzählen.
  await supabaseAdmin
    .from("profiles")
    .update({ ai_uses_heute: bisherHeute + 1, ai_uses_datum: heute })
    .eq("id", userId);

  return json({ text });
});
