# Infra-inplanting · kaarttool

Een volledig client-side web-app waarmee je beveiligingscamera's én netwerk-infrastructuur op een
echte luchtfoto-kaart kan inplannen, de bekabeling kan tonen, de camera-dekking kan analyseren en
het resultaat kan delen en exporteren. Geen backend, geen build-stap, geen API-sleutels — één
`index.html`, klaar voor **GitHub Pages**.

## Wat ze doet

- **Adres zoeken** (Geopunt-geocoder) → live luchtfoto verschijnt. Geen upload nodig.
- **Kaartlagen**: Esri luchtfoto (wereld) of OSM als basis; Vlaanderen 15 cm orthofoto en GRB-kadaster
  als overlays. De Vlaanderen-ortho ligt transparant op Esri, zodat gebieden zonder ortho-data (of een
  tegel die even niet laadt) gewoon de Esri-luchtfoto tonen i.p.v. een zwart vlak. Mislukte tegels
  worden automatisch opnieuw geladen.
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
- **SVG-export** via *SVG*: een proper vectorplan (muren, toestellen, labels, kabels, terrein,
  schaalbalk, noordpijl) als `.svg` — schaalbaar en bewerkbaar voor IT-documentatie (Inkscape, Visio,
  Word…). Voor een snelle kaart-met-luchtfoto blijft *PDF* (print) beschikbaar.
- **Terrein tekenen** → **dekkingsanalyse** (camera's): blinde vlekken (rood), overlap ≥2 cam's
  (groen), met percentages en geschatte oppervlakte.
- **Legende** in/uitschakelen om aan anderen uit te leggen wat elk symbool betekent.
- **Plan delen om samen te bewerken**: knop *Bewaar* schrijft het volledige plan naar een
  `infra-plan.json`-bestand. Iemand anders opent dat met *Open* (of sleept het op de kaart) en kan
  meteen verder bewerken — alle toestellen, muren, kabels, labels, terrein en kaartpositie zitten erin.
- **Delen via link**: knop *Deel* kopieert een link met het volledige plan in de URL.
- **Exporteren**: CSV (toestel- + kabellijst voor de offerte), PDF via print, SVG-vectorplan.
- Auto-opslaan in de browser (localStorage).

## Lokaal openen

Open `index.html` rechtstreeks in de browser. (De kaart heeft internet nodig voor de tegels.)

## Tests

De pure reken-/geo-functies staan in `geo.js` (gedeeld door de app en de tests). Draaien met Node
(geen dependencies):

```bash
node --test
```

CI draait dezelfde tests bij elke push via GitHub Actions (`.github/workflows/test.yml`).

## Hosten op GitHub Pages

```bash
git init
git add index.html README.md .nojekyll
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

- De dekkingsanalyse is een 2D-rasterbenadering op grondniveau — ze houdt geen rekening met
  obstakels/muren of montagehoogte-zichtlijnen. Goed om gaten en dubbele dekking te zien, niet voor
  exacte lensberekeningen.
- De Geopunt-adreszoeker en de Vlaanderen-lagen gelden voor Vlaanderen/Brussel; daarbuiten gebruik
  je de wereldwijde Esri-luchtfoto.
