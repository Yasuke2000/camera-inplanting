# Infra-inplanting · kaarttool

Een volledig client-side web-app waarmee je beveiligingscamera's én netwerk-infrastructuur op een
echte luchtfoto-kaart kan inplannen, de bekabeling kan tonen, de camera-dekking kan analyseren en
het resultaat kan delen en exporteren. Geen backend, geen build-stap, geen API-sleutels —
`index.html` + `app.js` + `geo.js`, klaar voor **GitHub Pages**.

## Wat ze doet

- **Adres zoeken** (Geopunt-geocoder) → live luchtfoto verschijnt. Geen upload nodig.
- **Kaartlagen**: Esri luchtfoto (wereld) of OSM als basis; Vlaanderen 15 cm orthofoto en GRB-kadaster
  als overlays. De Vlaanderen-ortho staat **standaard aan** (Esri is boven zoom 19 opgeschaald en dus
  wazig) en ligt transparant op Esri, zodat gebieden zonder ortho-data (of een tegel die even niet
  laadt) gewoon de Esri-luchtfoto tonen i.p.v. een zwart vlak. Mislukte tegels worden automatisch
  opnieuw geladen.
- **Toestellen plaatsen** via *Plaats ▾*: camera's (vast/bullet, dome 360°, PTZ), netwerkswitches,
  patchkasten/racks, nuts-/kabelintredepunten en WiFi access points. Elk met een montagehoogte en
  een vrije notitie ("waar komt wat binnen").
- **Camera's richten**: sleep het oranje punt om richting + bereik in te stellen; FOV-kegel in echte meters.
- **Bekabeling**: knop *Verbind* → klik twee toestellen om ze met een lijn te verbinden. Selecteer
  een kabel om het **type** (UTP/Cat6, glasvezel, stroom, overig — elk een eigen kleur) te kiezen;
  de **lengte (m)** wordt automatisch berekend en getoond. Verschuift mee als je een toestel
  versleept. Totale lengte per type komt in de CSV.
- **Tekst / kamerlabels**: knop *Tekst* → klik op de kaart en typ een naam (bv. "Serverruimte").
  Versleepbaar; verschijnt mee op het SVG-plan.
- **Op ware schaal**: de luchtfoto is georefereerd, dus alle lengtes en afstanden zijn meteen in
  echte meters (Vlaanderen-orthofoto tot ±15 cm). Geen kalibratie nodig.
- **Plattegrond tekenen** via *Binnen*: klik punten om muren te tekenen. Haakse hoeken worden
  automatisch recht gezet (houd **Shift** voor vrij tekenen), punten klikken vast op bestaande
  hoekpunten. Tijdens het tekenen zie je de **lengte live**; **typ een getal + Enter** om een muur
  een exacte lengte te geven in de richting van de muis. **Dubbelklik** = aparte muur, **Enter** =
  klaar, **⌫** = laatste punt ongedaan. Maatlabels per segment staan op het plan (toggle *Maten tonen*).
- **Gebouw automatisch omranden** via *Gebouw*: klik op een gebouw → de exacte **GRB-omtrek**
  (Digitaal Vlaanderen, kadastraal) wordt als bemate contour getekend, met melding van het **type en
  de oppervlakte (m²)**. Enkel Vlaanderen. Selecteer een contour om **omtrek + ingesloten
  oppervlakte** te zien — zo controleer je of een afbakening klopt.
- **Perceel automatisch afbakenen** via *Perceel*: klik op een perceel → de **GRB-kadastergrens**
  (`ADP`) wordt als *Terrein* gezet, met melding van **CAPAKEY + oppervlakte (m²)**. De
  dekkingsanalyse rekent dan meteen op die perceelgrens. CAPAKEY + oppervlakte komen ook in de
  CSV-export en op het SVG-plan.
- **Hoekpunten bijstellen**: selecteer een muur/gebouwcontour (klik erop) of klik *Terrein* bij een
  bestaande grens → sleep de hoekpunten om de afbakening manueel bij te regelen. Bij *Terrein* ook
  *Nieuw terrein* / *Wis terrein*.
- **Meten** via *Meet*: klik twee punten voor de afstand in meter.
- **SVG-export** via *Exporteer ▾ → SVG*: een proper vectorplan (muren, toestellen, labels, kabels,
  terrein, schaalbalk, noordpijl) als `.svg` — schaalbaar en bewerkbaar voor IT-documentatie
  (Inkscape, Visio, Word…). Voor een snelle kaart-met-luchtfoto blijft *PDF* (print) beschikbaar.
- **Terrein tekenen** → **dekkingsanalyse** (camera's): blinde vlekken (rood), overlap ≥2 cam's
  (groen), met percentages en geschatte oppervlakte. **Muren blokkeren de zichtlijn**: wat achter
  een getekende muur of GRB-gebouwcontour ligt telt als blinde vlek.
- **Ongedaan maken**: **Ctrl+Z** / **Ctrl+Y** (of Ctrl+Shift+Z) over alle bewerkingen — toestellen,
  kabels, muren, labels en terrein. Pannen/zoomen telt niet mee en de kaartpositie blijft staan.
- **Legende** in/uitschakelen om aan anderen uit te leggen wat elk symbool betekent.
- **Meerdere plannen (sites) naast elkaar** via het plan-menu (knop met de plannaam): *Nieuw plan*
  start met een leeg blad zonder het vorige te verliezen, wissel met één klik tussen sites, hernoem
  of verwijder een plan. Elk plan wordt apart auto-opgeslagen in de browser (localStorage); de oude
  enkelvoudige opslag wordt automatisch gemigreerd naar "Plan 1". Undo/redo geldt per plan.
- **Plan delen om samen te bewerken**: *Bewaar als bestand (.json)* in het plan-menu schrijft het
  volledige plan naar `<plannaam>.json`. Iemand anders opent dat via *Open bestand…* (of sleept het
  op de kaart) — het komt binnen als een **apart** plan, dus eigen werk wordt nooit overschreven.
- **Delen via link**: *Exporteer ▾ → Deelbare link* kopieert een link met het volledige plan in de
  URL. Het plan wordt gecomprimeerd (`#z=`, deflate) zodat ook grote plannen met GRB-contouren in
  een URL passen; oude ongecomprimeerde `#p=`-links blijven werken. Bij de ontvanger wordt de link
  ook als apart plan geïmporteerd.
- **Exporteren** via *Exporteer ▾*: CSV (toestel- + kabellijst voor de offerte), PDF via print,
  SVG-vectorplan, deelbare link.
- Zoom- en kaartlagenknoppen staan rechtsonder, zodat ze nooit onder de werkbalk of het
  toestellenpaneel vallen.
- **Offline/PWA**: de app-shell wordt door een service worker gecachet — een bewaard plan opent ook
  zonder netwerk (de kaarttegels zelf vereisen wel internet). Installeerbaar als app via het
  webmanifest.

## Lokaal openen

Open `index.html` rechtstreeks in de browser. (De kaart heeft internet nodig voor de tegels.)

## Tests

De app-logica staat in `app.js`; de pure reken-/geo-functies staan in `geo.js` (gedeeld door de
app en de tests). Draaien met Node (geen dependencies):

```bash
node --test
```

CI draait dezelfde tests bij elke push via GitHub Actions (`.github/workflows/test.yml`).

## Hosten op GitHub Pages

```bash
git init
git add index.html app.js geo.js sw.js manifest.webmanifest icon.svg README.md .nojekyll
git commit -m "Camera-inplanting kaarttool"
git branch -M main
git remote add origin https://github.com/Yasuke2000/camera-inplanting.git
git push -u origin main
```

Daarna in GitHub: **Settings → Pages → Deploy from branch → `main` / root**.
De tool staat dan op `https://yasuke2000.github.io/camera-inplanting/`.

### Eigen domein (optioneel)

Maak een bestand `CNAME` met daarin je domein, bv. `camera.daviddelporte.com`, en zet bij je
DNS-provider een CNAME-record naar `yasuke2000.github.io`.

## Opmerkingen

- De dekkingsanalyse is een 2D-rasterbenadering op grondniveau. Getekende muren en
  gebouwcontouren blokkeren de zichtlijn, maar montagehoogte (over een muur heen kijken) en
  lens-details tellen niet mee. Goed om gaten en dubbele dekking te zien, niet voor exacte
  lensberekeningen.
- De Geopunt-adreszoeker en de Vlaanderen-lagen gelden voor Vlaanderen/Brussel; daarbuiten gebruik
  je de wereldwijde Esri-luchtfoto.
