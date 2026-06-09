# Infra-inplanting · kaarttool

Een volledig client-side web-app waarmee je beveiligingscamera's én netwerk-infrastructuur op een
echte luchtfoto-kaart kan inplannen, de bekabeling kan tonen, de camera-dekking kan analyseren en
het resultaat kan delen en exporteren. Geen backend, geen build-stap, geen API-sleutels — één
`index.html`, klaar voor **GitHub Pages**.

## Wat ze doet

- **Adres zoeken** (Geopunt-geocoder) → live luchtfoto verschijnt. Geen upload nodig.
- **Kaartlagen**: Esri luchtfoto (wereld), Vlaanderen 15 cm orthofoto, OSM, en GRB-kadaster als overlay.
- **Toestellen plaatsen** via *Plaats ▾*: camera's (vast/bullet, dome 360°, PTZ), netwerkswitches,
  patchkasten/racks, nuts-/kabelintredepunten en WiFi access points. Elk met een montagehoogte en
  een vrije notitie ("waar komt wat binnen").
- **Camera's richten**: sleep het oranje punt om richting + bereik in te stellen; FOV-kegel in echte meters.
- **Bekabeling**: knop *Verbind* → klik twee toestellen om ze met een lijn te verbinden (toont wat
  met wat verbindt). Verbindingen verschuiven mee als je een toestel versleept.
- **Terrein tekenen** → **dekkingsanalyse** (camera's): blinde vlekken (rood), overlap ≥2 cam's
  (groen), met percentages en geschatte oppervlakte.
- **Legende** in/uitschakelen om aan anderen uit te leggen wat elk symbool betekent.
- **Delen**: knop *Deel* kopieert een link met het volledige plan in de URL.
- **Exporteren**: CSV (toestel- + kabellijst voor de offerte), JSON (export/import), PDF via print.
- Auto-opslaan in de browser (localStorage).

## Lokaal openen

Open `index.html` rechtstreeks in de browser. (De kaart heeft internet nodig voor de tegels.)

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
