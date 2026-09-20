# Viziunea PWA

MVP-ul demonstrează o buclă de orientare: intenție → căutare/matching → soluție sau nevoie deschisă → sugestie comunitară → moderare → notificare in-app. Interfața rămâne vanilla JavaScript + CSS, mobile-first și fără build step; datele și regulile sunt izolate în servicii mici sub `src/services/`.

## Rulare și demo

Servește repository-ul cu un server static, de exemplu `python3 -m http.server 8000`, apoi deschide `http://localhost:8000`. Intrarea este `/`, onboarding-ul conduce la căutare, iar rutele `/auth` și `/admin` sunt disponibile direct. Demo mode este activ când Supabase nu este configurat: catalogul inițial este seed-uit în browser, iar membrii, nevoile, sugestiile și notificările se păstrează în localStorage. Pentru a testa moderarea, creează o nevoie cu o adresă de email demo, deschide comunitatea cu altă adresă, trimite o sugestie și aprob-o din `/admin`.

## Configurare Supabase

1. Creează un proiect Supabase și copiază Project URL și cheia publică `anon` în `src/config.js` (`supabaseUrl`, `supabaseAnonKey`). Nu introduce cheia `service_role` în frontend.
2. Rulează integral `supabase/schema.sql` în SQL Editor. Scriptul definește tabelele, indexurile, trigger-ele, view-ul anonim, politicile RLS și date demo pentru director.
3. În Supabase Auth, activează autentificarea prin email și adaugă URL-urile aplicației la Site URL / Redirect URLs. Magic link-ul folosește ruta `/auth/`.
4. Autentifică o dată contul care va administra aplicația. Apoi rulează în SQL Editor instrucțiunea comentată de la finalul `schema.sql`, cu emailul administratorului, pentru a-l adăuga în `staff_users`. Drepturile staff nu pot fi acordate din client.

În Supabase, membrii autentificați pot crea și gestiona propriile nevoi, iar comunitatea citește doar view-ul `community_needs`, fără `requester_id` ori date de cont. Sugestiile noi sunt pending; doar staff le poate modera. Aprobarea creează notificarea in-app pentru solicitant. Cheia `service_role` nu trebuie niciodată publicată sau folosită în codul browserului.

## Structura aplicației

- `src/main.js` rămâne orchestratorul temporar al rutelor și al compatibilității UI; logica persistentă nu trebuie adăugată aici.
- `src/services/app-state.js` este sursa unică pentru profil, preferințele Feed și sincronizarea locală/Supabase.
- `src/services/member-repository.js` definește contractul de acces la membri: căutare, filtre, paginare și actualizare; în producție query-ul este server-side, iar demo-ul folosește fallback local.
- `src/services/auth.js`, `directory.js`, `needs.js`, `suggestions.js`, `notifications.js` izolează autentificarea și accesul la date; serviciile folosesc Supabase configurat sau fallback-ul demo.
- `supabase/schema.sql` este sursa modelului persistent. Rolurile și interesele sunt extensibile prin `profile_roles` și `profile_interests`, preferințele prin `feed_preferences`, iar conținutul comunității prin `community_posts`.
- Orice tabel listat pentru utilizatori trebuie să folosească `page`, `pageSize`, filtre în query și `count`, nu să descarce toată baza în browser.
- `/` prezintă Viziunea și onboarding-ul; `/auth` autentifică; `/admin` oferă taburile Membri, Nevoi, Sugestii și Director.

## Potrivire geografică MVP

Directorul distinge `fixed`, `travels`, `remote`, `hybrid` și `location_independent`; înregistrează `city`, `county`, `region`, `country`, `service_area_scope` și `travel_radius_km`. Nevoile păstrează locația, preferința, distanța maximă și dacă remote este acceptat. Căutarea extinde gradual oraș → apropiere → județ → regiune → național. Experiențele și spațiile fixe nu sunt înlocuite cu rezultate naționale; serviciile remote nu sunt penalizate când utilizatorul acceptă remote.

MVP-ul nu folosește hărți, geocoding sau coordonate lat/lng. Apropierea este estimată din oraș/județ/regiune, iar `travel_radius_km` și `max_distance_km` sunt păstrate pentru dezvoltarea următoarei etape, fără calcul geodezic. Fără locație introdusă, matching-ul nu impune o zonă.

## Limite curente și reguli de scalare

Matching-ul este determinist și local, fără AI/ML. Notificările sunt doar in-app; nu există email tranzacțional. Datele demo trăiesc în browserul curent și nu sincronizează între utilizatori. Pentru date persistente și fluxuri comunitare reale trebuie configurat Supabase, Auth și primul staff user.

Fundația pentru creștere este acum separată de fallback-ul demo: Supabase păstrează datele persistente, repository-urile sunt locul unic pentru query-uri, iar RLS controlează accesul. Pentru lansarea publică trebuie finalizate migrarea tuturor ecranelor către repository-uri, paginarea UI în `/admin`, validarea reală a moderatorului și testele end-to-end pentru politici RLS. Nu se adaugă câmpuri arbitrare în componente; câmpurile persistente se introduc prin migrare SQL și servicii tipizate.

## Publicare

Aplicația nu are pas de build. GitHub Pages poate servi conținutul static din root-ul repository-ului. După modificarea fișierelor PWA, actualizează lista `SHELL` și versiunea cache din `service-worker.js`.
