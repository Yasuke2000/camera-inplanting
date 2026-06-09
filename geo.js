/* Pure geometrie- & geo-helpers — gedeeld door index.html (browser) en de tests (Node).
   Geen DOM, geen Leaflet: alles puur reken-werk zodat het testbaar is. */
const R=6371000, D2R=Math.PI/180, R2D=180/Math.PI;

/* Bestemmingspunt op afstand d (m) en peiling brng (°) vanaf lat/lng → [lat,lng]. */
function dest(lat,lng,brng,d){const δ=d/R,θ=brng*D2R,φ1=lat*D2R,λ1=lng*D2R;
  const φ2=Math.asin(Math.sin(φ1)*Math.cos(δ)+Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));
  const λ2=λ1+Math.atan2(Math.sin(θ)*Math.sin(δ)*Math.cos(φ1),Math.cos(δ)-Math.sin(φ1)*Math.sin(φ2));
  return [φ2*R2D,((λ2*R2D+540)%360)-180];}

/* Peiling (°, 0=N) van punt a naar b; a/b = {lat,lng}. */
function bearing(a,b){const φ1=a.lat*D2R,φ2=b.lat*D2R,Δλ=(b.lng-a.lng)*D2R;
  const y=Math.sin(Δλ)*Math.cos(φ2),x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
  return (Math.atan2(y,x)*R2D+360)%360;}

const COMP=["N","NO","O","ZO","Z","ZW","W","NW"];
const compName=d=>COMP[Math.round(((d%360)+360)%360/45)%8];

/* Kleinste hoekverschil (°) tussen twee peilingen. */
function angDiff(a,b){const d=Math.abs(a-b)%360;return d>180?360-d:d;}

/* Oppervlakte (m²) van een bolvormige polygoon uit [[lat,lng],...]. */
function polygonAreaM2(pts){const n=pts.length;if(n<3)return 0;let a=0;
  for(let i=0;i<n;i++){const p1=pts[i],p2=pts[(i+1)%n];a+=(p2[1]-p1[1])*D2R*(2+Math.sin(p1[0]*D2R)+Math.sin(p2[0]*D2R));}
  return Math.abs(a*R*R/2);}

/* Punt-in-polygoon (ray casting). poly = [[lat,lng],...]. */
function pointInPoly(lat,lng,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const yi=poly[i][0],xi=poly[i][1],yj=poly[j][0],xj=poly[j][1];
  if(((yi>lat)!==(yj>lat))&&(lng<(xj-xi)*(lat-yi)/(yj-yi)+xi))c=!c;}return c;}

/* Punt-in-ring voor GeoJSON-ringen ([ [lon,lat], ... ]). */
function ptInRing(x,y,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
  if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;}return c;}

function geoPolys(geom){return geom.type==='MultiPolygon'?geom.coordinates:[geom.coordinates];}

/* Bevat een (Multi)Polygon-geometrie het punt (lon,lat)? Houdt rekening met gaten. */
function geoContains(geom,lon,lat){for(const poly of geoPolys(geom)){if(ptInRing(lon,lat,poly[0])){
  let hole=false;for(let h=1;h<poly.length;h++)if(ptInRing(lon,lat,poly[h])){hole=true;break;}if(!hole)return true;}}return false;}

if(typeof module!=='undefined'&&module.exports){
  module.exports={R,D2R,R2D,dest,bearing,COMP,compName,angDiff,polygonAreaM2,pointInPoly,ptInRing,geoPolys,geoContains};
}
