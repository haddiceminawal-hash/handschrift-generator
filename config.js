/* -------------------------------------------------------------
   Zugangsdaten für Supabase

   Hier deine beiden Werte eintragen – zu finden im Supabase-Projekt
   unter  Project Settings -> API.

   WICHTIG, damit du nicht erschrickst:
   Der "anon key" ist absichtlich öffentlich. Er darf im Quelltext stehen
   und ist auch für jeden sichtbar, der die Seite öffnet. Geschützt werden
   die Daten nicht durch den Schlüssel, sondern durch die Regeln in der
   Datenbank (Row Level Security) – siehe KONTO-SETUP.md.

   Was NIEMALS hierher gehört: der "service_role key". Der hebelt alle
   Regeln aus. Der bleibt im Supabase-Dashboard und sonst nirgends.

   Solange die Felder leer sind, funktioniert die App ganz normal weiter –
   nur eben ohne Konto, mit Speicherung im Browser.
------------------------------------------------------------- */

window.SUPABASE_URL = "https://dcmkyvpqnrpgefmjgwmz.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjbWt5dnBxbnJwZ2VmbWpnd216Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODY0NTgsImV4cCI6MjEwNDM2MjQ1OH0.w1vwMwtw0IyiNCOOo46JwDvQbTe_DSqLjScqbTWCeLU";
