# Viziunea PWA

Onboarding pentru comunitatea Viziunea, construit cu vanilla JavaScript și CSS. Pagina de intrare oferă acces la autentificare demo sau la turul de onboarding. Include un panel `/admin`, date demo persistente în browser, manifest și service worker pentru instalare și utilizare offline.

## Pornire locală

Servește directorul cu orice server static, de exemplu `python3 -m http.server 8000`, apoi deschide `http://localhost:8000`. `/auth` arată formularul demonstrativ, iar `/admin` panelul demo. Autentificarea nu este conectată încă; înainte de date reale, protejează rutele de admin cu Supabase Auth și roluri de staff. Interfața este fixată la înălțimea disponibilă și nu permite derularea; pe ecranele joase ascunde informațiile secundare. Pentru a lansa fără barele browserului, instalează PWA-ul pe ecranul principal al telefonului și deschide aplicația de acolo; manifestul folosește modul fullscreen.

## Model de date

`supabase/schema.sql` creează tabelul stabil `members`, cu UUID, email unic, rol validat, status, timestampuri și indexuri. Schema este separată de UI și accesată prin `src/services/members.js`. În demo, înscrierile noi rămân în localStorage pe dispozitivul curent. Pentru Supabase, completează URL-ul proiectului și cheia publică anon în `src/config.js`, apoi rulează SQL-ul din Supabase SQL Editor.

Cheia `service_role` nu trebuie expusă niciodată în browser. Panelul actual folosește date demo; înainte de a păstra date reale de membri, configurează Supabase Auth pentru administratori și politici RLS staff-only pentru citire și modificare.

## Publicare GitHub Pages

Activează GitHub Pages din Settings → Pages, branch `main`, folder `/ (root)`. Fișierele sunt statice și nu necesită build.
