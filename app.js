/* Infra-inplanting · kaarttool — app-logica (gewone script-file, geen build-stap).
   Pure reken-/geo-helpers staan in geo.js; dit bestand doet DOM, Leaflet en state. */
const $=id=>document.getElementById(id);
const uid=()=>'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const fmtH=v=>(''+v).replace('.',',');
/* alle gebruikers-/externe tekst (labels, notities, geocoder) gaat via esc/escAttr
   naar innerHTML — plannen komen ook uit gedeelde links en json-bestanden */
const esc=s=>(''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const escAttr=s=>esc(s).replace(/"/g,'&quot;');

/* ---------- map + layers ---------- */
const map=L.map('map',{zoomControl:true,maxZoom:22}).setView([51.1373,3.3185],18);

/* mislukte tegels (netwerk/no-data) automatisch herladen i.p.v. zwart laten */
function retryTiles(layer){layer.on('tileerror',e=>{const t=e.tile;if(!t)return;const n=t._retry||0;if(n>=2)return;t._retry=n+1;
  const base=t.src.split('#')[0];setTimeout(()=>{t.src=base+(base.indexOf('?')>-1?'&':'?')+'_r='+n+'_'+(performance.now()|0);},450*(n+1));});}

const esri=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {maxZoom:22,maxNativeZoom:19,keepBuffer:4,attribution:'Luchtfoto © Esri'});
const ortho=L.tileLayer.wms('https://geo.api.vlaanderen.be/OMWRGBMRVL/wms',
  {layers:'Ortho',format:'image/png',transparent:true,version:'1.3.0',maxZoom:22,keepBuffer:4,attribution:'Orthofoto 15cm © Digitaal Vlaanderen'});
const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {maxZoom:19,attribution:'© OpenStreetMap'});
const grb=L.tileLayer.wms('https://geo.api.vlaanderen.be/GRB-basiskaart/wms',
  {layers:'GRB_BSK',format:'image/png',transparent:true,version:'1.3.0',opacity:.85,maxZoom:22,attribution:'GRB © Digitaal Vlaanderen'});
[esri,ortho,osm,grb].forEach(retryTiles);

esri.addTo(map);
const baseLayers={"Luchtfoto (wereld)":esri,"Kaart (OSM)":osm};
const overlays={"Vlaanderen 15cm (scherper)":ortho,"GRB-kadaster (Vlaanderen)":grb};
L.control.layers(baseLayers,overlays,{position:'topright'}).addTo(map);
let activeBase='esri';
map.on('baselayerchange',e=>{activeBase=e.name.includes('OSM')?'osm':'esri';scheduleSave();});
map.on('overlayadd overlayremove',scheduleSave);

/* geometrie-helpers (dest, bearing, R, D2R, R2D) staan in geo.js */

/* ---------- camera sub-types ---------- */
const TYPES={
  fixed:{name:"Vast",col:"#2f7fe0",fov:75,range:28,icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="8" width="13" height="8" rx="1.5"/><path d="M15 11l6-3v8l-6-3"/></svg>'},
  dome:{name:"Dome",col:"#7a5cd0",fov:360,range:18,icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14a8 8 0 0116 0"/><rect x="3" y="14" width="18" height="4" rx="1"/></svg>'},
  ptz:{name:"PTZ",col:"#e08a2f",fov:55,range:45,icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>'}
};
/* ---------- other device kinds ---------- */
const KINDS={
  switch:{name:"Netwerkswitch",col:"#2faf8a",h:1.5,prefix:"SW",icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 12h0M10 12h0M14 12h0M18 12h0"/></svg>'},
  rack:{name:"Patchkast / rack",col:"#b07d2c",h:0,prefix:"RK",icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16"/></svg>'},
  entry:{name:"Nuts-/kabelintrede",col:"#d24b6c",h:0.3,prefix:"IN",icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h6v18h-6"/><path d="M3 12h11M10 8l4 4-4 4"/></svg>'},
  ap:{name:"Access point",col:"#45b0c0",h:3,prefix:"AP",icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12a7 7 0 0114 0"/><path d="M8.5 14.5a3.5 3.5 0 017 0"/><circle cx="12" cy="18" r="1"/></svg>'}
};
/* COMP/compName staan in geo.js */
const isCam=c=>c.kind==='camera';
function soortName(c){return isCam(c)?TYPES[c.type].name+' camera':KINDS[c.kind].name;}
function devCol(c){return isCam(c)?TYPES[c.type].col:KINDS[c.kind].col;}
function devIcon(c){return isCam(c)?TYPES[c.type].icon:KINDS[c.kind].icon;}
/* kabeltypes voor de bekabeling */
const CABLES={utp:{name:'UTP/Cat6',col:'#5aa9ff'},fiber:{name:'Glasvezel',col:'#ffd479'},power:{name:'Stroom',col:'#e5564b'},other:{name:'Overig',col:'#cdd7df'}};

let cams=[];            // all devices: {id,kind,label,lat,lng,h,note, type,dir,fov,range, _m,_c,_h}
let links=[];           // {id,a,b,type,_l,_dim}
let labels=[];          // {id,text,lat,lng,_m}
let sel=null, selLink=null, selLabel=null, addKind='camera', linkA=null, mode="idle";
const counters={camera:1,switch:1,rack:1,entry:1,ap:1};

function makeIcon(c){
  if(isCam(c)){const T=TYPES[c.type];const dome=c.type==='dome'&&c.fov>=360;
    return L.divIcon({className:'',iconSize:[24,24],iconAnchor:[12,12],
      html:`<div class="cammk ${c.id===sel?'sel':''}" style="--col:${T.col}">${dome?'':`<span class="arr" style="transform:rotate(${c.dir}deg)"></span>`}<b>${esc(c.label)}</b></div>`});}
  const K=KINDS[c.kind];
  return L.divIcon({className:'',iconSize:[26,26],iconAnchor:[13,13],
    html:`<div class="devmk ${c.id===sel?'sel':''}" style="--col:${K.col}">${K.icon}<span class="devlbl">${esc(c.label)}</span></div>`});
}
function conePts(c){
  if(c.type==='dome'&&c.fov>=360)return null;
  const pts=[[c.lat,c.lng]],n=26,half=c.fov/2;
  for(let i=0;i<=n;i++){const a=c.dir-half+c.fov*(i/n);pts.push(dest(c.lat,c.lng,a,c.range));}
  return pts;
}
function renderCam(c){
  const showCone=$("lCone").checked;
  if(c._c){map.removeLayer(c._c);c._c=null;}
  if(isCam(c)&&showCone){
    const style={color:c.id===sel?'#ffb020':TYPES[c.type].col,weight:1.4,fillColor:c.id===sel?'#ffb020':TYPES[c.type].col,fillOpacity:.18};
    if(c.type==='dome'&&c.fov>=360){c._c=L.circle([c.lat,c.lng],{radius:c.range,...style});}
    else{c._c=L.polygon(conePts(c),style);}
    c._c.addTo(map);c._c.on('click',()=>select(c.id));
  }
  if(!c._m){
    c._m=L.marker([c.lat,c.lng],{icon:makeIcon(c),draggable:true,zIndexOffset:1000}).addTo(map);
    c._m.on('click',e=>{if(mode==='link'){onLinkPick(c.id);L.DomEvent.stop(e);}else select(c.id);});
    c._m.on('drag',()=>{const ll=c._m.getLatLng();c.lat=ll.lat;c.lng=ll.lng;
      if(isCam(c)){drawHandle(c);if(c._c){if(c._c.setLatLngs&&conePts(c))c._c.setLatLngs(conePts(c));else if(c._c.setLatLng)c._c.setLatLng([c.lat,c.lng]);}}
      updateLinksFor(c);});
    c._m.on('dragend',()=>{scheduleSave();});
  }else{c._m.setLatLng([c.lat,c.lng]);c._m.setIcon(makeIcon(c));}
  if(isCam(c)&&c.id===sel)drawHandle(c);
}
function drawHandle(c){
  if(!isCam(c)||(c.type==='dome'&&c.fov>=360)||c.id!==sel){if(c._h){map.removeLayer(c._h);c._h=null;}return;}
  const pos=dest(c.lat,c.lng,c.dir,c.range);
  if(!c._h){
    c._h=L.marker(pos,{icon:L.divIcon({className:'',iconSize:[15,15],iconAnchor:[7,7],html:'<div class="tiph"></div>'}),draggable:true,zIndexOffset:1100}).addTo(map);
    c._h.on('drag',()=>{const hp=c._h.getLatLng(),ctr=L.latLng(c.lat,c.lng);
      c.dir=Math.round(bearing(ctr,hp));c.range=Math.max(2,Math.round(ctr.distanceTo(hp)));
      c._m.setIcon(makeIcon(c));if(c._c&&conePts(c))c._c.setLatLngs(conePts(c));syncEditor(true);});
    c._h.on('dragend',()=>scheduleSave());
  }else c._h.setLatLng(pos);
}
function renderAll(){cams.forEach(renderCam);links.forEach(renderLink);labels.forEach(renderLabel);refreshList();updateLegend();}

/* ---------- links (verbindingen) ---------- */
function renderLink(k){
  const a=byId(k.a), b=byId(k.b);
  if(!a||!b){if(k._l){map.removeLayer(k._l);k._l=null;}if(k._dim){map.removeLayer(k._dim);k._dim=null;}return;}
  const pts=[[a.lat,a.lng],[b.lat,b.lng]];
  if(!k._l){k._l=L.polyline(pts,{weight:3,interactive:true}).addTo(map);
    k._l.on('click',e=>{selectLink(k.id);L.DomEvent.stop(e);});}
  else k._l.setLatLngs(pts);
  const on=k.id===selLink, col=on?'#ffb020':(CABLES[k.type]||CABLES.other).col;
  k._l.setStyle({color:col,weight:on?5:3,opacity:.95,dashArray:null});
  k._l.bringToBack();
  const d=mDist([a.lat,a.lng],[b.lat,b.lng]),mid=[(a.lat+b.lat)/2,(a.lng+b.lng)/2];
  const ic=L.divIcon({className:'',iconSize:[48,14],iconAnchor:[24,7],html:`<div class="dimlbl">${d.toFixed(1)} m</div>`});
  if(!k._dim)k._dim=L.marker(mid,{interactive:false,keyboard:false,icon:ic}).addTo(map);
  else{k._dim.setLatLng(mid);k._dim.setIcon(ic);}
}
function updateLinksFor(c){links.forEach(k=>{if(k.a===c.id||k.b===c.id)renderLink(k);});}
function selectLink(id){if(editingBoundary)stopBoundaryEdit();clearHandles();killBar();
  if(selWall){selWall=null;walls.forEach(w=>w._l&&w._l.setStyle(wallStyle(false)));}
  if(selLabel){selLabel=null;labels.forEach(renderLabel);}
  selLink=id;sel=null;refreshList();links.forEach(renderLink);syncEditor();}
function renderLinkEditor(ed){const k=byLink(selLink);if(!k){ed.innerHTML='';return;}
  const a=byId(k.a),b=byId(k.b),d=(a&&b)?mDist([a.lat,a.lng],[b.lat,b.lng]):0;
  ed.innerHTML=`<div class="ed">
    <div class="row"><label>Kabel</label><div style="font:700 13px var(--mono);color:var(--ink)">${a?esc(a.label):'?'} — ${b?esc(b.label):'?'} · ${d.toFixed(1)} m</div></div>
    <div class="row"><label>Type</label><div class="seg">
      ${Object.entries(CABLES).map(([key,v])=>`<button data-c="${key}" style="${(k.type||'utp')===key?'background:'+v.col+';border-color:'+v.col+';color:#04201d':''}">${v.name}</button>`).join('')}
    </div></div>
    <div class="edbtns"><button class="btn" id="lkDel" style="color:#ffb4ad">Verwijder kabel</button></div></div>`;
  ed.querySelectorAll('.seg button').forEach(btn=>btn.onclick=()=>{k.type=btn.dataset.c;renderLink(k);renderLinkEditor(ed);refreshList();scheduleSave();});
  $("lkDel").onclick=()=>delLink(selLink);}
function delLink(id){const k=byLink(id);if(k&&k._l)map.removeLayer(k._l);if(k&&k._dim)map.removeLayer(k._dim);links=links.filter(x=>x.id!==id);if(selLink===id){selLink=null;syncEditor();}refreshList();scheduleSave();}
const byLink=id=>links.find(k=>k.id===id);
function linkCount(id){return links.filter(k=>k.a===id||k.b===id).length;}
function onLinkPick(id){
  if(linkA===null){linkA=id;toast('Eerste toestel gekozen — klik het tweede');return;}
  if(id===linkA){linkA=null;toast('Geannuleerd');return;}
  if(!links.some(k=>(k.a===linkA&&k.b===id)||(k.a===id&&k.b===linkA))){
    const k={id:uid(),a:linkA,b:id,type:'utp'};links.push(k);renderLink(k);refreshList();scheduleSave();
    const a=byId(linkA),b=byId(id);toast('Verbinding '+a.label+' — '+b.label+' gemaakt');}
  else toast('Die verbinding bestaat al');
  linkA=null;
}

/* ---------- tekst / kamerlabels ---------- */
function makeLabelIcon(t){return L.divIcon({className:'',iconSize:[12,12],iconAnchor:[6,6],
  html:`<div class="txtlbl ${t.id===selLabel?'sel':''}">${esc(t.text||'')}</div>`});}
function renderLabel(t){
  if(!t._m){t._m=L.marker([t.lat,t.lng],{icon:makeLabelIcon(t),draggable:true,zIndexOffset:900}).addTo(map);
    t._m.on('click',e=>{selectLabel(t.id);L.DomEvent.stop(e);});
    t._m.on('drag',()=>{const ll=t._m.getLatLng();t.lat=ll.lat;t.lng=ll.lng;});
    t._m.on('dragend',scheduleSave);
  }else{t._m.setLatLng([t.lat,t.lng]);t._m.setIcon(makeLabelIcon(t));}}
function addLabel(ll){const t={id:uid(),text:'Naam',lat:ll.lat,lng:ll.lng};labels.push(t);renderLabel(t);selectLabel(t.id);scheduleSave();toast('Tekst geplaatst — typ de naam in het paneel');}
function selectLabel(id){if(editingBoundary)stopBoundaryEdit();clearHandles();killBar();
  sel=null;selLink=null;if(selWall){selWall=null;walls.forEach(w=>w._l&&w._l.setStyle(wallStyle(false)));}
  selLabel=id;labels.forEach(renderLabel);refreshList();syncEditor();
  setTimeout(()=>{const el=$("txtInput");if(el){el.focus();el.select();}},30);}
function renderLabelEditor(ed){const t=labels.find(x=>x.id===selLabel);if(!t){ed.innerHTML='';return;}
  ed.innerHTML=`<div class="ed">
    <div class="row"><label>Tekst / kamernaam</label><input type="text" id="txtInput" value="${escAttr(t.text||'')}" placeholder="bv. Serverruimte"></div>
    <div class="edbtns"><button class="btn" id="txtDel" style="color:#ffb4ad">Verwijder</button></div></div>`;
  $("txtInput").oninput=e=>{t.text=e.target.value;t._m.setIcon(makeLabelIcon(t));scheduleSave();};
  $("txtDel").onclick=()=>delLabel(selLabel);}
function delLabel(id){const t=labels.find(x=>x.id===id);if(t&&t._m)map.removeLayer(t._m);labels=labels.filter(x=>x.id!==id);if(selLabel===id){selLabel=null;syncEditor();}refreshList();scheduleSave();}
$("txtBtn").onclick=()=>{ if(mode==='text'){setMode('idle');return;} setMode('text');$("txtBtn").classList.add('active');toast('Klik op de kaart om een tekstlabel te plaatsen'); };

/* ---------- device ops ---------- */
function labelFor(kind){if(kind==='camera')return 'C'+String(counters.camera++).padStart(2,'0');
  return KINDS[kind].prefix+String(counters[kind]++).padStart(2,'0');}
function defaultH(kind){return kind==='camera'?4:KINDS[kind].h;}
function addNode(kind,latlng){
  const c={id:uid(),kind,label:labelFor(kind),lat:latlng.lat,lng:latlng.lng,h:defaultH(kind),note:''};
  if(kind==='camera'){const T=TYPES.fixed;Object.assign(c,{type:'fixed',dir:225,fov:T.fov,range:T.range});}
  cams.push(c);select(c.id);renderCam(c);refreshList();updateLegend();scheduleSave();
  toast(soortName(c)+' '+c.label+' geplaatst'+(isCam(c)?' — sleep het oranje punt om te richten':''));
}
const byId=id=>cams.find(c=>c.id===id);
function select(id){if(editingBoundary)stopBoundaryEdit();clearHandles();
  if(selWall){selWall=null;walls.forEach(w=>w._l&&w._l.setStyle(wallStyle(false)));}
  const prev=byId(sel);selLink=null;sel=id;
  if(prev){prev._m&&prev._m.setIcon(makeIcon(prev));renderCam(prev);drawHandle(prev);}
  const c=byId(id);if(c){c._m&&c._m.setIcon(makeIcon(c));renderCam(c);drawHandle(c);}
  links.forEach(renderLink);refreshList();syncEditor();}
function delCam(id){const c=byId(id);if(!c)return;
  links.filter(k=>k.a===id||k.b===id).forEach(k=>delLink(k.id));
  [c._m,c._c,c._h].forEach(l=>l&&map.removeLayer(l));
  cams=cams.filter(x=>x.id!==id);if(sel===id)sel=null;refreshList();updateLegend();syncEditor();scheduleSave();}
function dupCam(id){const o=byId(id);const p=dest(o.lat,o.lng,90,12);
  const c={...o,id:uid(),label:labelFor(o.kind),lat:p[0],lng:p[1],_m:null,_c:null,_h:null};
  cams.push(c);select(c.id);renderCam(c);updateLegend();scheduleSave();}

/* ---------- list + editor ---------- */
function refreshList(){
  $("count").textContent=cams.length;
  const w=$("listWrap");
  if(!cams.length){w.innerHTML='<div class="empty">Nog geen toestellen.<br>Klik op <b>Plaats ▾</b> en daarna op de kaart.</div>';return;}
  w.innerHTML='<div class="list">'+cams.map(c=>{
    let sub;
    if(isCam(c)){const dome=c.type==='dome'&&c.fov>=360;
      sub=`${TYPES[c.type].name} · ${dome?'360°':c.fov+'° '+compName(c.dir)} · ${c.range} m · h ${fmtH(c.h)} m`;}
    else{const n=linkCount(c.id);sub=`${KINDS[c.kind].name} · h ${fmtH(c.h)} m${n?' · '+n+' kabel'+(n>1?'s':''):''}`;}
    return `<div class="cam ${c.id===sel?'sel':''}" data-id="${c.id}"><span class="dot" style="background:${devCol(c)}">${devIcon(c)}</span>
    <span class="meta"><b>${esc(c.label)}</b><span>${sub}</span></span></div>`;}).join('')+'</div>';
  w.querySelectorAll('.cam').forEach(d=>d.onclick=()=>{select(d.dataset.id);const c=byId(d.dataset.id);map.panTo([c.lat,c.lng]);});
}
function syncEditor(valuesOnly){
  const ed=$("editor");
  if(!valuesOnly&&selLabel){renderLabelEditor(ed);return;}
  if(!valuesOnly&&selLink){renderLinkEditor(ed);return;}
  const c=byId(sel);if(!c){ed.innerHTML="";return;}
  if(valuesOnly){const vr=$("vRange"),vd=$("vDir"),er=$("eRange"),edd=$("eDir");
    if(vr)vr.textContent=c.range+' m';if(er)er.value=c.range;if(vd)vd.textContent=c.dir+'° '+compName(c.dir);if(edd)edd.value=c.dir;refreshList();return;}
  if(isCam(c)){
    const dome=c.type==='dome'&&c.fov>=360;
    ed.innerHTML=`<div class="ed">
      <div class="row"><label>Naam</label><input type="text" id="eLabel" value="${escAttr(c.label)}"></div>
      <div class="row"><label>Type</label><div class="seg">
        ${Object.entries(TYPES).map(([k,v])=>`<button data-t="${k}" style="${c.type===k?'background:'+v.col+';border-color:'+v.col+';color:#fff':''}">${v.icon}${v.name}</button>`).join('')}
      </div></div>
      <div class="row"><label class="chk" style="text-transform:none;color:var(--ink)"><input type="checkbox" id="eDome" ${dome?'checked':''}> Volledig 360° zicht</label></div>
      <div class="row" style="${dome?'display:none':''}"><div class="slabel">Gezichtshoek<b id="vFov">${c.fov}°</b></div><input type="range" id="eFov" min="20" max="120" value="${Math.min(120,c.fov)}"></div>
      <div class="row"><div class="slabel">Bereik<b id="vRange">${c.range} m</b></div><input type="range" id="eRange" min="3" max="150" value="${c.range}"></div>
      <div class="row" style="${dome?'display:none':''}"><div class="slabel">Richting<b id="vDir">${c.dir}° ${compName(c.dir)}</b></div><input type="range" id="eDir" min="0" max="359" value="${c.dir}"></div>
      <div class="row"><div class="slabel">Montagehoogte<b id="vH">${fmtH(c.h)} m</b></div><input type="range" id="eH" min="2" max="12" step="0.5" value="${c.h}"></div>
      <div class="row"><label>Notitie</label><input type="text" id="eNote" value="${escAttr(c.note||'')}" placeholder="bv. zicht op poort"></div>
      <div class="edbtns"><button class="btn" id="eDup">Dupliceer</button><button class="btn" id="eDel" style="color:#ffb4ad">Verwijder</button></div>
    </div>`;
    ed.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{const k=b.dataset.t;c.type=k;
      if(k==='dome')c.fov=360;else if(c.fov>=360)c.fov=TYPES[k].fov;renderCam(c);drawHandle(c);syncEditor();refreshList();scheduleSave();});
    $("eDome").onchange=e=>{c.fov=e.target.checked?360:75;renderCam(c);drawHandle(c);syncEditor();refreshList();scheduleSave();};
    const ef=$("eFov");if(ef)ef.oninput=e=>{c.fov=+e.target.value;$("vFov").textContent=c.fov+'°';renderCam(c);drawHandle(c);refreshList();scheduleSave();};
    $("eRange").oninput=e=>{c.range=+e.target.value;$("vRange").textContent=c.range+' m';renderCam(c);drawHandle(c);refreshList();scheduleSave();};
    const ed2=$("eDir");if(ed2)ed2.oninput=e=>{c.dir=+e.target.value;$("vDir").textContent=c.dir+'° '+compName(c.dir);c._m.setIcon(makeIcon(c));renderCam(c);drawHandle(c);refreshList();scheduleSave();};
    $("eH").oninput=e=>{c.h=+e.target.value;$("vH").textContent=fmtH(c.h)+' m';refreshList();scheduleSave();};
  }else{
    ed.innerHTML=`<div class="ed">
      <div class="row"><label>Naam</label><input type="text" id="eLabel" value="${escAttr(c.label)}"></div>
      <div class="row"><label>Soort</label><div class="seg">
        ${Object.entries(KINDS).map(([k,v])=>`<button data-k="${k}" style="${c.kind===k?'background:'+v.col+';border-color:'+v.col+';color:#fff':''}">${v.icon}${v.name.split(' ')[0]}</button>`).join('')}
      </div></div>
      <div class="row"><div class="slabel">Montagehoogte<b id="vH">${fmtH(c.h)} m</b></div><input type="range" id="eH" min="0" max="12" step="0.5" value="${c.h}"></div>
      <div class="row"><label>Notitie</label><input type="text" id="eNote" value="${escAttr(c.note||'')}" placeholder="bv. 24-poort PoE · voeding hier · glasvezel"></div>
      <div class="row"><label>Verbindingen</label><div style="font:600 12px var(--mono);color:var(--mut)">${linkCount(c.id)} kabel(s) · klik <b style="color:var(--ink)">Verbind</b> om toe te voegen</div></div>
      <div class="edbtns"><button class="btn" id="eDup">Dupliceer</button><button class="btn" id="eDel" style="color:#ffb4ad">Verwijder</button></div>
    </div>`;
    ed.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{c.kind=b.dataset.k;c.h=KINDS[c.kind].h;
      renderCam(c);syncEditor();refreshList();updateLegend();scheduleSave();});
    $("eH").oninput=e=>{c.h=+e.target.value;$("vH").textContent=fmtH(c.h)+' m';refreshList();scheduleSave();};
  }
  $("eLabel").oninput=e=>{c.label=e.target.value||c.label;c._m.setIcon(makeIcon(c));refreshList();scheduleSave();};
  $("eNote").oninput=e=>{c.note=e.target.value;scheduleSave();};
  $("eDup").onclick=()=>dupCam(c.id);$("eDel").onclick=()=>delCam(c.id);
}

/* ---------- placement menu ---------- */
function buildMenu(){
  const m=$("plaatsMenu");
  const items=[['camera','Camera',TYPES.fixed.col,TYPES.fixed.icon],
    ...Object.entries(KINDS).map(([k,v])=>[k,v.name,v.col,v.icon])];
  m.innerHTML=items.map(([k,name,col,icon])=>`<div data-k="${k}"><span class="mi" style="background:${col}">${icon}</span>${name}</div>`).join('');
  m.querySelectorAll('div').forEach(d=>d.onclick=()=>{$("plaatsMenu").classList.remove('show');startAdd(d.dataset.k);});
}
function startAdd(kind){addKind=kind;$("linkBtn").classList.remove('active');linkA=null;setMode('add');
  toast('Klik op de kaart om '+(kind==='camera'?'een camera':KINDS[kind].name)+' te plaatsen');}
$("plaatsBtn").onclick=e=>{e.stopPropagation();$("plaatsMenu").classList.toggle('show');};

/* ---------- modes ---------- */
function setMode(m){
  if(m!=='wall'&&(curWall||$("wallBtn").classList.contains('active'))){commitCurWall();$("wallBtn").classList.remove('active');map.doubleClickZoom.enable();if(wallPreview)wallPreview.setLatLngs([]);}
  if(m!=='measure'&&$("measBtn").classList.contains('active'))$("measBtn").classList.remove('active');
  if(m!=='gebouw'&&$("bldgBtn").classList.contains('active'))$("bldgBtn").classList.remove('active');
  if(m!=='perceel'&&$("parcelBtn").classList.contains('active'))$("parcelBtn").classList.remove('active');
  if(m!=='text'&&$("txtBtn").classList.contains('active'))$("txtBtn").classList.remove('active');
  mode=m;$("plaatsBtn").classList.toggle('active',m==='add');
  map._container.style.cursor=(m==='add'||m==='terrein'||m==='link'||m==='wall'||m==='measure'||m==='gebouw'||m==='perceel'||m==='text')?'crosshair':'';}
map.on('click',e=>{if(mode==='add'){addNode(addKind,e.latlng);setMode('idle');}
  else if(mode==='terrein'){addVertex(e.latlng);}
  else if(mode==='wall'){addWallPoint(e.latlng,e.originalEvent.shiftKey);}
  else if(mode==='measure'){addMeasurePoint(e.latlng);}
  else if(mode==='gebouw'){fetchBuilding(e.latlng);}
  else if(mode==='perceel'){fetchParcel(e.latlng);}
  else if(mode==='text'){addLabel(e.latlng);setMode('idle');}
  else{let changed=false;
    if(selLink!==null){selLink=null;links.forEach(renderLink);killBar();changed=true;}
    if(selWall!==null){selWall=null;walls.forEach(w=>w._l.setStyle(wallStyle(false)));clearHandles();killBar();changed=true;}
    if(selLabel!==null){selLabel=null;labels.forEach(renderLabel);changed=true;}
    if(changed)syncEditor();}});
map.on('dblclick',e=>{if(mode==='wall'){L.DomEvent.stop(e);newWallRun();}});

/* link mode */
$("linkBtn").onclick=()=>{if(mode==='link'){endLink();return;}
  if(cams.length<2){toast('Plaats eerst minstens 2 toestellen');return;}
  setMode('link');linkA=null;$("linkBtn").classList.add('active');
  floatBar('Klik 2 toestellen om te verbinden · ',[['Klaar',endLink]]);};
function endLink(){mode='idle';linkA=null;$("linkBtn").classList.remove('active');killBar();map._container.style.cursor='';}

/* ---------- layer toggles ---------- */
$("lCone").onchange=()=>cams.forEach(renderCam);
$("lLabel").onchange=()=>document.body.classList.toggle('hidelabels',!$("lLabel").checked);
$("lLegend").onchange=updateLegend;
$("lDims").onchange=refreshDims;

/* ---------- legend ---------- */
function updateLegend(){
  const box=$("legend");
  if(!$("lLegend").checked){box.classList.remove('show');return;}
  const used=new Set(cams.map(c=>isCam(c)?'camera':c.kind));
  if(!used.size&&!walls.length){box.classList.remove('show');return;}
  const rows=[];
  if(used.has('camera'))rows.push(['#2f7fe0',TYPES.fixed.icon,'Camera']);
  Object.entries(KINDS).forEach(([k,v])=>{if(used.has(k))rows.push([v.col,v.icon,v.name]);});
  box.innerHTML='<h4>Legende</h4>'+rows.map(([col,icon,name])=>`<div class="lr"><span class="ls" style="background:${col}">${icon}</span>${name}</div>`).join('')
    +[...new Set(links.map(k=>k.type||'utp'))].map(ct=>{const v=CABLES[ct]||CABLES.other;return `<div class="lr"><span style="width:14px;height:0;border-top:3px solid ${v.col};flex:none"></span>${v.name}</div>`;}).join('')
    +(walls.length?'<div class="lr"><span style="width:14px;height:0;border-top:3px solid #eef3f6;flex:none"></span>Muren</div>':'');
  box.classList.add('show');
}

/* ---------- address search (Geopunt JSONP) ---------- */
function jsonp(url){return new Promise((res,rej)=>{const cb='gp'+Math.random().toString(36).slice(2);
  const s=document.createElement('script');window[cb]=d=>{res(d);delete window[cb];s.remove();};
  s.onerror=()=>{rej();delete window[cb];s.remove();};s.src=url+'&callback='+cb;document.body.appendChild(s);});}
let stmr;
$("q").addEventListener('input',e=>{clearTimeout(stmr);const v=e.target.value.trim();
  if(v.length<3){$("sugg").classList.remove('show');return;}
  stmr=setTimeout(async()=>{try{const d=await jsonp('https://geo.api.vlaanderen.be/geolocation/v4/Suggestion?q='+encodeURIComponent(v)+'&c=6');
    const arr=(d&&d.SuggestionResult)||[];const box=$("sugg");
    box.innerHTML=arr.map(s=>`<div>${esc(s)}</div>`).join('');box.classList.toggle('show',arr.length>0);
    box.querySelectorAll('div').forEach(el=>el.onclick=()=>{$("q").value=el.textContent;$("sugg").classList.remove('show');geocode(el.textContent);});
  }catch{}},220);});
$("q").addEventListener('keydown',e=>{if(e.key==='Enter'){$("sugg").classList.remove('show');geocode(e.target.value.trim());}});
document.addEventListener('click',e=>{if(!e.target.closest('.search'))$("sugg").classList.remove('show');
  if(!e.target.closest('.menuwrap'))$("plaatsMenu").classList.remove('show');});
async function geocode(q){if(!q)return;try{const d=await jsonp('https://geo.api.vlaanderen.be/geolocation/v4/Location?q='+encodeURIComponent(q)+'&c=1');
  const r=d&&d.LocationResult&&d.LocationResult[0];if(r){map.setView([r.Location.Lat_WGS84,r.Location.Lon_WGS84],19);toast(r.FormattedAddress||q);}
  else toast('Adres niet gevonden');}catch{toast('Zoeken mislukt (netwerk?)');}}

/* ---------- upload aerial photo overlay ---------- */
let imgOverlay=null;
$("upBtn").onclick=()=>$("fileImg").click();
$("fileImg").onchange=e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);
  if(imgOverlay)map.removeLayer(imgOverlay);
  imgOverlay=L.imageOverlay(url,map.getBounds().pad(-0.15),{opacity:.7,interactive:false}).addTo(map);
  toast('Foto geplaatst. Sleep de kaart zodat ze past; gebruik de schuif voor transparantie.');
  showImgControls();e.target.value='';};
function showImgControls(){
  let bar=$("imgbar");if(bar)bar.remove();
  bar=document.createElement('div');bar.id='imgbar';
  bar.style.cssText='position:absolute;bottom:16px;left:16px;z-index:1100;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;gap:10px;align-items:center;font-size:12px';
  bar.innerHTML='<span style="color:var(--mut)">Foto-overlay</span><input type="range" id="imgop" min="10" max="100" value="70" style="width:120px"><button class="btn" id="imgfit">Pas in kader</button><button class="btn" id="imgdel" style="color:#ffb4ad">Weg</button>';
  document.body.appendChild(bar);
  $("imgop").oninput=ev=>imgOverlay&&imgOverlay.setOpacity(ev.target.value/100);
  $("imgfit").onclick=()=>{if(imgOverlay){imgOverlay.setBounds(map.getBounds().pad(-0.15));}};
  $("imgdel").onclick=()=>{if(imgOverlay){map.removeLayer(imgOverlay);imgOverlay=null;}bar.remove();};
}

/* ---------- site boundary (terrein) ---------- */
let boundary=[], bLayer=null, bDraw=null, bVtx=[], parcelCapakey=null, editHandles=[], editingBoundary=false;
function drawBoundary(){if(bLayer)map.removeLayer(bLayer);if(!boundary.length)return;
  bLayer=L.polygon(boundary,{color:'#1fb6a6',weight:2,dashArray:'6 4',fill:true,fillOpacity:.04,interactive:false}).addTo(map);}
function clearHandles(){editHandles.forEach(m=>map.removeLayer(m));editHandles=[];}
function vtxMarker(latlng,onDrag,onEnd){const h=L.marker(latlng,{draggable:true,keyboard:false,
  icon:L.divIcon({className:'',iconSize:[14,14],iconAnchor:[7,7],html:'<div class="vtx"></div>'}),zIndexOffset:1200}).addTo(map);
  h.on('drag',()=>onDrag(h.getLatLng()));if(onEnd)h.on('dragend',onEnd);editHandles.push(h);}
function showWallHandles(w){clearHandles();w.pts.forEach((p,i)=>vtxMarker(p,
  ll=>{w.pts[i]=[ll.lat,ll.lng];w._l.setLatLngs(w.pts);},()=>{addWallDims(w);scheduleSave();}));}
function boundaryInfo(){return 'Terrein ±'+m2(polygonAreaM2(boundary))+(parcelCapakey?' · '+parcelCapakey:'');}
function startBoundaryEdit(){editingBoundary=true;$("boundBtn").classList.add('active');sel=null;selLink=null;selWall=null;syncEditor();clearHandles();
  boundary.forEach((p,i)=>vtxMarker(p,ll=>{boundary[i]=[ll.lat,ll.lng];bLayer.setLatLngs(boundary);},()=>{scheduleSave();if(analysisOn)scheduleAnalysis();}));
  floatBar(boundaryInfo()+' · sleep de punten · ',
    [['Nieuw terrein',()=>{stopBoundaryEdit();startBoundary();}],['Wis terrein',()=>{stopBoundaryEdit();clearBoundary();scheduleSave();if(analysisOn)scheduleAnalysis();}],['Klaar',stopBoundaryEdit]]);}
function stopBoundaryEdit(){editingBoundary=false;$("boundBtn").classList.remove('active');clearHandles();killBar();}
$("boundBtn").onclick=()=>{ if(mode==='terrein'){finishBoundary();return;}
  if(editingBoundary){stopBoundaryEdit();return;}
  if(boundary.length>=3){startBoundaryEdit();return;}
  startBoundary(); };
function startBoundary(){
  setMode('terrein');clearBoundary();bDraw=L.polyline([],{color:'#1fb6a6',weight:2,dashArray:'5 4'}).addTo(map);
  $("boundBtn").classList.add('active');map._container.style.cursor='crosshair';
  floatBar('Klik de hoekpunten van het terrein · ',[['Klaar',finishBoundary],['Wis',()=>{clearBoundary();killBar();setMode('idle');}]]);
}
function addVertex(ll){boundary.push([ll.lat,ll.lng]);bDraw.setLatLngs(boundary);
  bVtx.push(L.marker(ll,{icon:L.divIcon({className:'',iconSize:[12,12],iconAnchor:[6,6],html:'<div class="vtx"></div>'})}).addTo(map));}
function finishBoundary(){
  if(boundary.length>=3){if(bDraw){map.removeLayer(bDraw);bDraw=null;}bVtx.forEach(m=>map.removeLayer(m));bVtx=[];
    parcelCapakey=null;drawBoundary();
    toast('Terrein vastgelegd ('+boundary.length+' hoekpunten)');scheduleSave();if(analysisOn)scheduleAnalysis();}
  else{clearBoundary();}
  $("boundBtn").classList.remove('active');map._container.style.cursor='';killBar();mode='idle';
}
function clearBoundary(){clearHandles();editingBoundary=false;[bLayer,bDraw,...bVtx].forEach(l=>l&&map.removeLayer(l));bLayer=bDraw=null;bVtx=[];boundary=[];parcelCapakey=null;}
/* pointInPoly staat in geo.js */

/* ---------- walls / floor plan (binnen) ---------- */
let walls=[], curWall=null, selWall=null, wallPreview=null, wallTarget=null, typedLen='';
const wallStyle=on=>({color:on?'#ffb020':'#f6fafc',weight:on?5:4,opacity:1,lineCap:'round',lineJoin:'round',className:'wallpath'});
const mDist=(a,b)=>L.latLng(a[0],a[1]).distanceTo(L.latLng(b[0],b[1]));
function wallTotal(){if(!curWall)return 0;let t=0;for(let i=1;i<curWall.pts.length;i++)t+=mDist(curWall.pts[i-1],curWall.pts[i]);return t;}
function wallStatus(){const span=document.querySelector('#floatbar .t');if(!span)return;let txt;
  if(typedLen!=='')txt='Exacte lengte: '+typedLen+' m → richt met muis + Enter';
  else if(curWall&&curWall.pts.length&&wallTarget)txt='Segment '+mDist(curWall.pts[curWall.pts.length-1],wallTarget).toFixed(1)+' m · totaal '+wallTotal().toFixed(1)+' m · typ getal voor exacte lengte';
  else txt='Klik punten · haakse hoeken auto (Shift = vrij) · typ getal voor exacte lengte';
  span.textContent=txt+' · ';}
/* dimension labels */
function dimLabel(a,b){const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  return L.marker(mid,{interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[44,14],iconAnchor:[22,7],html:`<div class="dimlbl">${mDist(a,b).toFixed(1)} m</div>`})});}
function clearWallDims(w){if(w._dims){w._dims.forEach(m=>map.removeLayer(m));}w._dims=[];}
function addWallDims(w){clearWallDims(w);if(!$("lDims").checked)return;for(let i=1;i<w.pts.length;i++){const m=dimLabel(w.pts[i-1],w.pts[i]);m.addTo(map);w._dims.push(m);}}
function refreshDims(){walls.forEach(addWallDims);}
/* polygonAreaM2 staat in geo.js */
function wallMetrics(w){let per=0;for(let i=1;i<w.pts.length;i++)per+=mDist(w.pts[i-1],w.pts[i]);
  return {per,area:polygonAreaM2(w.pts)};}
const m2=v=>Math.round(v).toLocaleString('nl-BE')+' m²';
function allVertices(){const v=[];walls.forEach(w=>w.pts.forEach(p=>v.push(p)));if(curWall)curWall.pts.forEach(p=>v.push(p));return v;}
function snapPoint(latlng,shift){
  const cp=map.latLngToContainerPoint(latlng);
  let best=null,bd=12;
  allVertices().forEach(v=>{const vp=map.latLngToContainerPoint(L.latLng(v[0],v[1]));const d=Math.hypot(vp.x-cp.x,vp.y-cp.y);if(d<bd){bd=d;best=v;}});
  if(best)return L.latLng(best[0],best[1]);
  if(!shift&&curWall&&curWall.pts.length){const lp=map.latLngToContainerPoint(L.latLng(...curWall.pts[curWall.pts.length-1]));
    const dx=cp.x-lp.x,dy=cp.y-lp.y,dist=Math.hypot(dx,dy);const a=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*(Math.PI/4);
    return map.containerPointToLatLng([lp.x+Math.cos(a)*dist,lp.y+Math.sin(a)*dist]);}
  return latlng;
}
$("wallBtn").onclick=()=>{ if(mode==='wall'){finishWall();return;} startWall(); };
function startWall(){setMode('wall');$("wallBtn").classList.add('active');map.doubleClickZoom.disable();typedLen='';wallTarget=null;
  curWall={id:uid(),pts:[],_dims:[],_l:L.polyline([],wallStyle(false)).addTo(map)};
  if(!wallPreview)wallPreview=L.polyline([],{color:'#ffb020',weight:2,dashArray:'4 5',opacity:.9}).addTo(map);
  floatBar('Klik punten · haakse hoeken auto (Shift = vrij) · typ getal voor exacte lengte · ',
    [['Nieuwe muur',newWallRun],['Ongedaan',undoWallPoint],['Klaar',finishWall]]);
  toast('Klik om muren te tekenen. Typ een getal + Enter voor een exacte lengte · dubbelklik = aparte muur');}
function onWallMove(e){if(mode!=='wall'||!curWall||!curWall.pts.length||!wallPreview)return;
  const sp=snapPoint(e.latlng,e.originalEvent.shiftKey);wallTarget=[sp.lat,sp.lng];
  wallPreview.setLatLngs([curWall.pts[curWall.pts.length-1],wallTarget]);wallStatus();}
map.on('mousemove',onWallMove);
function addWallPoint(ll,shift){if(!curWall)return;const sp=snapPoint(ll,shift);
  const p=[sp.lat,sp.lng],last=curWall.pts[curWall.pts.length-1];
  if(last&&Math.abs(last[0]-p[0])<1e-9&&Math.abs(last[1]-p[1])<1e-9)return;
  curWall.pts.push(p);curWall._l.setLatLngs(curWall.pts);wallStatus();}
function addWallByLength(len){if(!curWall||!curWall.pts.length||!(len>0))return false;
  const last=curWall.pts[curWall.pts.length-1];const br=wallTarget?bearing(L.latLng(last[0],last[1]),L.latLng(wallTarget[0],wallTarget[1])):0;
  const np=dest(last[0],last[1],br,len);curWall.pts.push([np[0],np[1]]);curWall._l.setLatLngs(curWall.pts);wallStatus();return true;}
function undoWallPoint(){if(!curWall||!curWall.pts.length)return;curWall.pts.pop();curWall._l.setLatLngs(curWall.pts);
  if(!curWall.pts.length&&wallPreview)wallPreview.setLatLngs([]);wallStatus();}
function commitCurWall(){if(curWall&&curWall.pts.length>=2){const w=curWall;w._l.setStyle(wallStyle(false));
    w._l.on('click',e=>{selectWall(w.id);L.DomEvent.stop(e);});walls.push(w);addWallDims(w);scheduleSave();updateLegend();}
  else if(curWall&&curWall._l){map.removeLayer(curWall._l);}curWall=null;typedLen='';if(wallPreview)wallPreview.setLatLngs([]);}
function newWallRun(){commitCurWall();typedLen='';curWall={id:uid(),pts:[],_dims:[],_l:L.polyline([],wallStyle(false)).addTo(map)};}
function finishWall(){commitCurWall();$("wallBtn").classList.remove('active');killBar();mode='idle';
  map._container.style.cursor='';map.doubleClickZoom.enable();}
function selectWall(id){if(editingBoundary)stopBoundaryEdit();selWall=id;sel=null;selLink=null;syncEditor();refreshList();
  walls.forEach(w=>w._l.setStyle(wallStyle(w.id===selWall)));
  const w=walls.find(x=>x.id===id),mt=w?wallMetrics(w):{per:0,area:0};
  if(w)showWallHandles(w);
  floatBar('Omtrek '+mt.per.toFixed(1)+' m'+(w&&w.pts.length>=3?' · vlak ≈ '+m2(mt.area):'')+' · sleep punten · ',
    [['Verwijder',()=>{delWall(id);killBar();}],['Sluit',()=>{selWall=null;clearHandles();walls.forEach(w=>w._l.setStyle(wallStyle(false)));killBar();}]]);}
function delWall(id){clearHandles();const w=walls.find(x=>x.id===id);if(w){clearWallDims(w);if(w._l)map.removeLayer(w._l);}walls=walls.filter(x=>x.id!==id);if(selWall===id)selWall=null;updateLegend();scheduleSave();}

/* ---------- measure tool (meetlat) ---------- */
let measureLayer=null, measurePts=[];
$("measBtn").onclick=()=>{ if(mode==='measure'){endMeasure();return;} startMeasure(); };
function startMeasure(){setMode('measure');$("measBtn").classList.add('active');measurePts=[];
  if(!measureLayer)measureLayer=L.layerGroup().addTo(map);measureLayer.clearLayers();
  floatBar('Klik 2 punten om de afstand te meten · ',[['Wis',()=>{measureLayer.clearLayers();measurePts=[];}],['Klaar',endMeasure]]);
  toast('Klik twee punten — de afstand verschijnt in meter');}
function endMeasure(){$("measBtn").classList.remove('active');killBar();mode='idle';map._container.style.cursor='';}
function addMeasurePoint(ll){measurePts.push([ll.lat,ll.lng]);
  if(measurePts.length===2){const d=mDist(measurePts[0],measurePts[1]);
    L.polyline(measurePts,{color:'#ffb020',weight:2,dashArray:'5 4'}).addTo(measureLayer);
    const mid=[(measurePts[0][0]+measurePts[1][0])/2,(measurePts[0][1]+measurePts[1][1])/2];
    L.marker(mid,{interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[70,16],iconAnchor:[35,8],html:`<div class="dimlbl big">${d.toFixed(2)} m</div>`})}).addTo(measureLayer);
    measurePts=[];}}

/* ---------- auto-outline gebouw (GRB Vlaanderen) ---------- */
const GRB_WFS='https://geo.api.vlaanderen.be/GRB/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=GRB:GBG&count=40&outputFormat=application/json&srsName=EPSG:4326&bbox=';
$("bldgBtn").onclick=()=>{ if(mode==='gebouw'){setMode('idle');return;} setMode('gebouw');$("bldgBtn").classList.add('active');
  toast('Klik op een gebouw — de exacte GRB-omtrek wordt opgehaald (enkel Vlaanderen)'); };
/* ptInRing, geoPolys, geoContains staan in geo.js */
function ringCentroid(ring){let x=0,y=0;ring.forEach(p=>{x+=p[0];y+=p[1];});return [x/ring.length,y/ring.length];}
async function fetchBuilding(ll){
  setMode('idle');$("bldgBtn").classList.remove('active');
  const d=0.0008,bbox=[ (ll.lat-d).toFixed(7),(ll.lng-d).toFixed(7),(ll.lat+d).toFixed(7),(ll.lng+d).toFixed(7),'urn:ogc:def:crs:EPSG::4326'].join(',');
  toast('Gebouw ophalen…');
  try{
    const r=await fetch(GRB_WFS+encodeURIComponent(bbox));const j=await r.json();
    const feats=(j.features||[]).filter(f=>f.geometry);
    if(!feats.length){toast('Geen gebouw gevonden hier (GRB = enkel Vlaanderen)');return;}
    let chosen=feats.find(f=>geoContains(f.geometry,ll.lng,ll.lat));
    if(!chosen){let bd=1e18;feats.forEach(f=>{const c=ringCentroid(geoPolys(f.geometry)[0][0]);const dd=(c[0]-ll.lng)**2+(c[1]-ll.lat)**2;if(dd<bd){bd=dd;chosen=f;}});}
    addBuilding(chosen);
  }catch(err){toast('Ophalen mislukt (netwerk?)');}
}
function addBuilding(f){
  let area=0,first=null;
  geoPolys(f.geometry).forEach(poly=>{const ring=poly[0];const pts=simplifyCollinear(ring.map(([lo,la])=>[la,lo]),true);
    const w={id:uid(),pts,_dims:[],_l:L.polyline(pts,wallStyle(false)).addTo(map)};
    w._l.on('click',e=>{selectWall(w.id);L.DomEvent.stop(e);});walls.push(w);addWallDims(w);
    area+=polygonAreaM2(pts);if(!first)first=pts;});
  updateLegend();scheduleSave();
  if(first){const b=L.latLngBounds(first.map(p=>L.latLng(p[0],p[1])));map.fitBounds(b,{maxZoom:21,padding:[60,60]});}
  const p=f.properties||{},t=p.LBLTYPE||'gebouw',dt=p.OPNDATUM?(' · opgemeten '+p.OPNDATUM):'';
  toast('Gebouw toegevoegd: '+t+' · ±'+m2(area)+dt);
}

/* ---------- auto-afbakenen perceel (GRB ADP → terrein) ---------- */
$("parcelBtn").onclick=()=>{ if(mode==='perceel'){setMode('idle');return;} setMode('perceel');$("parcelBtn").classList.add('active');
  toast('Klik op een perceel — de GRB-kadastergrens wordt als terrein gezet (enkel Vlaanderen)'); };
async function fetchParcel(ll){
  setMode('idle');$("parcelBtn").classList.remove('active');
  const d=0.0011,bbox=[(ll.lat-d).toFixed(7),(ll.lng-d).toFixed(7),(ll.lat+d).toFixed(7),(ll.lng+d).toFixed(7),'urn:ogc:def:crs:EPSG::4326'].join(',');
  toast('Perceel ophalen…');
  try{
    const r=await fetch('https://geo.api.vlaanderen.be/GRB/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=GRB:ADP&count=40&outputFormat=application/json&srsName=EPSG:4326&bbox='+encodeURIComponent(bbox));
    const j=await r.json();const feats=(j.features||[]).filter(f=>f.geometry);
    if(!feats.length){toast('Geen perceel gevonden hier (GRB = enkel Vlaanderen)');return;}
    let chosen=feats.find(f=>geoContains(f.geometry,ll.lng,ll.lat));
    if(!chosen){let bd=1e18;feats.forEach(f=>{const c=ringCentroid(geoPolys(f.geometry)[0][0]);const dd=(c[0]-ll.lng)**2+(c[1]-ll.lat)**2;if(dd<bd){bd=dd;chosen=f;}});}
    setParcelTerrein(chosen);
  }catch(err){toast('Ophalen mislukt (netwerk?)');}
}
function setParcelTerrein(f){
  const ring=geoPolys(f.geometry)[0][0];let pts=simplifyCollinear(ring.map(([lo,la])=>[la,lo]),true);
  if(pts.length>1&&Math.abs(pts[0][0]-pts[pts.length-1][0])<1e-9&&Math.abs(pts[0][1]-pts[pts.length-1][1])<1e-9)pts=pts.slice(0,-1);
  clearBoundary();boundary=pts;parcelCapakey=(f.properties&&f.properties.CAPAKEY)||null;drawBoundary();
  map.fitBounds(bLayer.getBounds(),{maxZoom:21,padding:[60,60]});
  scheduleSave();if(analysisOn)scheduleAnalysis();
  toast('Perceel als terrein gezet'+(parcelCapakey?' · '+parcelCapakey:'')+' · ±'+m2(polygonAreaM2(pts)));
}

/* ---------- coverage analysis (camera's only) ---------- */
let analysisOn=false, anaCanvas=null, anaCells=null, anaStep=4;
/* zichtlijn camera→punt: geblokkeerd zodra ze een muursegment kruist. Start ±0,5 m
   van de camera af zodat een camera die óp een muur hangt niet door die muur zelf
   wordt geblokkeerd. */
function losClear(cLat,cLng,lat,lng,d){
  if(!walls.length)return true;
  const t=Math.min(0.9,0.5/Math.max(d,0.6));
  const a=[cLat+(lat-cLat)*t,cLng+(lng-cLng)*t],b=[lat,lng];
  for(const w of walls)for(let i=1;i<w.pts.length;i++)
    if(segsIntersect(a,b,w.pts[i-1],w.pts[i]))return false;
  return true;}
function coverCount(lat,lng){let n=0;const p=L.latLng(lat,lng);
  for(const c of cams){if(!isCam(c))continue;const cc=L.latLng(c.lat,c.lng);const d=cc.distanceTo(p);if(d>c.range)continue;
    if(!(c.type==='dome'&&c.fov>=360)&&angDiff(bearing(cc,p),c.dir)>c.fov/2)continue;
    if(losClear(c.lat,c.lng,lat,lng,d))n++;}
  return n;}
function ensureCanvas(){if(anaCanvas)return;anaCanvas=document.createElement('canvas');
  anaCanvas.style.cssText='position:absolute;pointer-events:none;z-index:-1';
  map.getPanes().overlayPane.appendChild(anaCanvas);
  ['moveend','zoomend','resize','viewreset','move','zoom'].forEach(ev=>map.on(ev,drawAna));}
function computeAnalysis(){
  if(boundary.length<3){anaCells=null;return;}
  let minLa=90,maxLa=-90,minLo=180,maxLo=-180;
  boundary.forEach(([la,lo])=>{minLa=Math.min(minLa,la);maxLa=Math.max(maxLa,la);minLo=Math.min(minLo,lo);maxLo=Math.max(maxLo,lo);});
  const midLa=(minLa+maxLa)/2;const mPerDegLa=111320, mPerDegLo=111320*Math.cos(midLa*D2R);
  const wM=(maxLo-minLo)*mPerDegLo, hM=(maxLa-minLa)*mPerDegLa;
  anaStep=Math.max(2,Math.round(Math.sqrt(Math.max(1,wM*hM)/7000)));
  const dLa=anaStep/mPerDegLa, dLo=anaStep/mPerDegLo;
  const cells=[];let inside=0,gap=0,ok=0,ov=0;
  for(let la=minLa;la<=maxLa;la+=dLa)for(let lo=minLo;lo<=maxLo;lo+=dLo){
    if(!pointInPoly(la,lo,boundary))continue;inside++;
    const n=coverCount(la,lo);cells.push([la,lo,n]);
    if(n===0)gap++;else if(n===1)ok++;else ov++;}
  anaCells=cells;
  const area=inside*anaStep*anaStep;const pct=v=>inside?Math.round(v/inside*100):0;
  const nCam=cams.filter(isCam).length;
  $("statcard").classList.add('show');
  $("stbar").innerHTML=`<i style="width:${pct(ov)}%;background:#4fa24a"></i><i style="width:${pct(ok)}%;background:#5aa9ff"></i><i style="width:${pct(gap)}%;background:#e5564b"></i>`;
  $("stOv").textContent=pct(ov)+'%';$("stOk").textContent=pct(ok)+'%';$("stGap").textContent=pct(gap)+'%';
  $("stMeta").innerHTML=`Terrein ≈ ${area.toLocaleString('nl-BE')} m² · ${nCam} camera('s) · raster ${anaStep} m${walls.length?' · muren blokkeren zicht':''}${parcelCapakey?' · '+esc(parcelCapakey):''}`;
}
function drawAna(){if(!analysisOn||!anaCells||!anaCanvas)return;
  const s=map.getSize();const tl=map.containerPointToLayerPoint([0,0]);
  L.DomUtil.setPosition(anaCanvas,tl);anaCanvas.width=s.x;anaCanvas.height=s.y;
  const ctx=anaCanvas.getContext('2d');ctx.clearRect(0,0,s.x,s.y);
  const z=map.getZoom();const mpp=40075016.686*Math.cos(map.getCenter().lat*D2R)/Math.pow(2,z+8);
  const sz=Math.max(2,anaStep/mpp)+1;
  for(const [la,lo,n] of anaCells){if(n===1)continue;
    const p=map.latLngToContainerPoint([la,lo]);
    ctx.fillStyle=n===0?'rgba(229,86,75,.42)':'rgba(79,162,74,.45)';
    ctx.fillRect(p.x-sz/2,p.y-sz/2,sz,sz);}
}
let anatmr;function scheduleAnalysis(){clearTimeout(anatmr);anatmr=setTimeout(()=>{computeAnalysis();drawAna();},250);}
$("anaBtn").onclick=()=>{
  if(boundary.length<3){toast('Teken eerst een terrein (knop Terrein)');return;}
  analysisOn=!analysisOn;$("anaBtn").classList.toggle('active',analysisOn);
  if(analysisOn){ensureCanvas();computeAnalysis();drawAna();}
  else{anaCells=null;if(anaCanvas){anaCanvas.getContext('2d').clearRect(0,0,anaCanvas.width,anaCanvas.height);}$("statcard").classList.remove('show');}
};

/* ---------- CSV export ---------- */
/* vrije tekst: scheidingsteken/regeleinden eruit + apostrof vóór =+-@ zodat een
   rekenblad er geen formule van maakt (CSV-injectie) */
const csvCell=s=>{s=(''+s).replace(/[;\r\n]/g,' ');return /^[=+\-@\t]/.test(s)?"'"+s:s;};
$("csvBtn").onclick=()=>{
  if(!cams.length){toast('Geen toestellen om te exporteren');return;}
  const totals={};cams.forEach(c=>{const key=isCam(c)?'Camera':KINDS[c.kind].name;totals[key]=(totals[key]||0)+1;});
  const sep=';';const rows=[];
  rows.push('# Infra-inplanting'+(boundary.length?' · '+boundary.length+' hoekpunten terrein':''));
  rows.push('# Datum'+sep+new Date().toLocaleDateString('nl-BE'));
  rows.push('# Aantal toestellen'+sep+cams.length);
  Object.entries(totals).forEach(([t,n])=>rows.push('# '+t+sep+n));
  rows.push('# Aantal verbindingen'+sep+links.length);
  if(boundary.length>=3)rows.push('# Terrein oppervlakte m²'+sep+Math.round(polygonAreaM2(boundary)));
  if(parcelCapakey)rows.push('# Perceel CAPAKEY'+sep+parcelCapakey);
  if(analysisOn&&anaCells){const tot=anaCells.length,gap=anaCells.filter(c=>c[2]===0).length,ov=anaCells.filter(c=>c[2]>=2).length;
    rows.push('# Camera-dekking gedekt%'+sep+Math.round((tot-gap)/tot*100));
    rows.push('# Blinde vlek%'+sep+Math.round(gap/tot*100));
    rows.push('# Overlap%'+sep+Math.round(ov/tot*100));}
  rows.push('');
  rows.push(['Label','Soort','Latitude','Longitude','Richting_graden','Kompas','FOV_graden','Bereik_m','Montagehoogte_m','Verbindingen','Notitie'].join(sep));
  cams.forEach(c=>{const dome=c.type==='dome'&&c.fov>=360;const cam=isCam(c);
    rows.push([csvCell(c.label),soortName(c),c.lat.toFixed(6),c.lng.toFixed(6),
      cam?(dome?'':c.dir):'',cam?(dome?'360°':compName(c.dir)):'',cam?(dome?360:c.fov):'',cam?c.range:'',
      fmtH(c.h),linkCount(c.id),csvCell(c.note||'')].join(sep));});
  if(links.length){rows.push('');
    const ctot={};let lentot=0;
    links.forEach(k=>{const a=byId(k.a),b=byId(k.b);if(!a||!b)return;const d=mDist([a.lat,a.lng],[b.lat,b.lng]);
      const nm=(CABLES[k.type]||CABLES.other).name;ctot[nm]=(ctot[nm]||0)+d;lentot+=d;});
    rows.push('# Totale kabellengte m'+sep+Math.round(lentot));
    Object.entries(ctot).forEach(([t,mm])=>rows.push('# '+t+' m'+sep+Math.round(mm)));
    rows.push('# Verbindingen (bekabeling)');rows.push(['Van','Naar','Type','Lengte_m'].join(sep));
    links.forEach(k=>{const a=byId(k.a),b=byId(k.b);if(a&&b)rows.push([csvCell(a.label),csvCell(b.label),(CABLES[k.type]||CABLES.other).name,mDist([a.lat,a.lng],[b.lat,b.lng]).toFixed(1)].join(sep));});}
  const blob=new Blob(['﻿'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='infra-inplanting.csv';a.click();
  toast('CSV geëxporteerd ('+cams.length+' toestellen, '+links.length+' kabels)');
};

/* ---------- SVG export (vectorplan voor documenten) ---------- */
const innerOf=svg=>svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
/* esc staat bovenaan bij de andere helpers */
function exportSVG(){
  const allLL=[];
  walls.forEach(w=>w.pts.forEach(p=>allLL.push(p)));
  cams.forEach(c=>{allLL.push([c.lat,c.lng]);if(isCam(c)){const cp=conePts(c);if(cp)cp.forEach(p=>allLL.push(p));
    else allLL.push(dest(c.lat,c.lng,0,c.range),dest(c.lat,c.lng,180,c.range),dest(c.lat,c.lng,90,c.range),dest(c.lat,c.lng,270,c.range));}});
  boundary.forEach(p=>allLL.push(p));
  labels.forEach(t=>allLL.push([t.lat,t.lng]));
  if(!allLL.length){toast('Niets om te exporteren — teken eerst een plattegrond');return;}
  let minLa=90,maxLa=-90,minLo=180,maxLo=-180;
  allLL.forEach(([la,lo])=>{minLa=Math.min(minLa,la);maxLa=Math.max(maxLa,la);minLo=Math.min(minLo,lo);maxLo=Math.max(maxLo,lo);});
  const lat0=(minLa+maxLa)/2, mLo=111320*Math.cos(lat0*D2R), mLa=111320;
  const wM=Math.max(1,(maxLo-minLo)*mLo), hM=Math.max(1,(maxLa-minLa)*mLa);
  const M=70, ppm=Math.max(0.5,Math.min(6,(1100-2*M)/wM)), TOP=64;
  const W=Math.round(wM*ppm)+2*M, H=Math.round(hM*ppm)+2*M+TOP;
  const X=lo=>M+(lo-minLo)*mLo*ppm, Y=la=>TOP+M+(maxLa-la)*mLa*ppm;
  const proj=([la,lo])=>X(lo).toFixed(1)+','+Y(la).toFixed(1);
  const showDims=$("lDims").checked;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui,Segoe UI,sans-serif">`;
  s+=`<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  // title
  const title=$("q").value.trim()||'Plattegrond';
  s+=`<text x="${M}" y="34" font-size="18" font-weight="700" fill="#11161a">${esc(title)}</text>`;
  const sub2=(parcelCapakey?' · perceel '+parcelCapakey:'')+(boundary.length>=3?' · terrein ±'+m2(polygonAreaM2(boundary)):'');
  s+=`<text x="${M}" y="52" font-size="11" fill="#5e6a73">Infra-inplanting · ${new Date().toLocaleDateString('nl-BE')} · schaal ±1 px = ${(1/ppm).toFixed(2)} m${esc(sub2)}</text>`;
  // boundary
  if(boundary.length>=3)s+=`<polygon points="${boundary.map(proj).join(' ')}" fill="#1fb6a6" fill-opacity="0.05" stroke="#1fb6a6" stroke-width="1.5" stroke-dasharray="7 5"/>`;
  // camera cones
  cams.forEach(c=>{if(!isCam(c))return;const col=TYPES[c.type].col;
    if(c.type==='dome'&&c.fov>=360)s+=`<circle cx="${X(c.lng).toFixed(1)}" cy="${Y(c.lat).toFixed(1)}" r="${(c.range*ppm).toFixed(1)}" fill="${col}" fill-opacity="0.13" stroke="${col}" stroke-opacity="0.5" stroke-width="1"/>`;
    else s+=`<polygon points="${conePts(c).map(proj).join(' ')}" fill="${col}" fill-opacity="0.13" stroke="${col}" stroke-opacity="0.5" stroke-width="1"/>`;});
  // links (bekabeling, kleur per type)
  links.forEach(k=>{const a=byId(k.a),b=byId(k.b);if(!a||!b)return;const col=(CABLES[k.type]||CABLES.other).col;
    s+=`<line x1="${X(a.lng).toFixed(1)}" y1="${Y(a.lat).toFixed(1)}" x2="${X(b.lng).toFixed(1)}" y2="${Y(b.lat).toFixed(1)}" stroke="${col}" stroke-width="2"/>`;
    if(showDims){const mx=(X(a.lng)+X(b.lng))/2,my=(Y(a.lat)+Y(b.lat))/2;
      s+=`<text x="${mx.toFixed(1)}" y="${(my-3).toFixed(1)}" text-anchor="middle" font-size="8" fill="#1c2733" paint-order="stroke" stroke="#ffffff" stroke-width="2.5">${mDist([a.lat,a.lng],[b.lat,b.lng]).toFixed(1)} m</text>`;}});
  // walls + maatlabels
  walls.forEach(w=>{s+=`<polyline points="${w.pts.map(proj).join(' ')}" fill="none" stroke="#1c2733" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    if(showDims)for(let i=1;i<w.pts.length;i++){const a=w.pts[i-1],b=w.pts[i];
      const mx=(X(a[1])+X(b[1]))/2, my=(Y(a[0])+Y(b[0]))/2;
      s+=`<text x="${mx.toFixed(1)}" y="${(my-3).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#1c2733" paint-order="stroke" stroke="#ffffff" stroke-width="3" stroke-linejoin="round">${mDist(a,b).toFixed(1)} m</text>`;}});
  // devices
  const SZ=22;
  cams.forEach(c=>{const x=X(c.lng),y=Y(c.lat),col=devCol(c);
    s+=`<g><rect x="${(x-SZ/2).toFixed(1)}" y="${(y-SZ/2).toFixed(1)}" width="${SZ}" height="${SZ}" rx="5" fill="${col}" stroke="rgba(0,0,0,.45)" stroke-width="1.5"/>`;
    s+=`<g transform="translate(${(x-SZ/2+3).toFixed(1)},${(y-SZ/2+3).toFixed(1)}) scale(${((SZ-6)/24).toFixed(3)})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${innerOf(devIcon(c))}</g>`;
    s+=`<text x="${x.toFixed(1)}" y="${(y+SZ/2+11).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#11161a" paint-order="stroke" stroke="#ffffff" stroke-width="3" stroke-linejoin="round">${esc(c.label)}</text></g>`;});
  // tekstlabels
  labels.forEach(t=>{const x=X(t.lng),y=Y(t.lat);
    s+=`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="700" fill="#11161a" paint-order="stroke" stroke="#ffffff" stroke-width="3.5">${esc(t.text||'')}</text>`;});
  // scale bar
  let sm=[1,2,5,10,20,50,100].find(v=>v*ppm>=90)||100;const sx=M,sy=H-26,sw=sm*ppm;
  s+=`<line x1="${sx}" y1="${sy}" x2="${(sx+sw).toFixed(1)}" y2="${sy}" stroke="#11161a" stroke-width="2"/>`;
  s+=`<line x1="${sx}" y1="${sy-4}" x2="${sx}" y2="${sy+4}" stroke="#11161a" stroke-width="2"/><line x1="${(sx+sw).toFixed(1)}" y1="${sy-4}" x2="${(sx+sw).toFixed(1)}" y2="${sy+4}" stroke="#11161a" stroke-width="2"/>`;
  s+=`<text x="${(sx+sw/2).toFixed(1)}" y="${sy-7}" text-anchor="middle" font-size="11" fill="#11161a">${sm} m</text>`;
  // north arrow
  const nx=W-M-10,ny=H-44;
  s+=`<g stroke="#11161a" stroke-width="2" fill="#11161a"><line x1="${nx}" y1="${ny}" x2="${nx}" y2="${ny-26}"/><polygon points="${nx-5},${ny-20} ${nx},${ny-30} ${nx+5},${ny-20}"/></g><text x="${nx}" y="${ny+14}" text-anchor="middle" font-size="11" font-weight="700" fill="#11161a">N</text>`;
  s+=`</svg>`;
  const blob=new Blob([s],{type:'image/svg+xml'});const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='plattegrond.svg';a.click();
  toast('Plattegrond geëxporteerd als SVG');
}
$("svgBtn").onclick=exportSVG;

/* ---------- generic floating bar ---------- */
function floatBar(label,btns){killBar();const bar=document.createElement('div');bar.className='floatbar';bar.id='floatbar';
  bar.innerHTML='<span class="t">'+label+'</span>';
  btns.forEach(([txt,fn])=>{const b=document.createElement('button');b.className='btn';b.textContent=txt;b.onclick=fn;bar.appendChild(b);});
  document.body.appendChild(bar);}
function killBar(){const b=$("floatbar");if(b)b.remove();}

/* ---------- toast ---------- */
let ttmr;function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add('show');clearTimeout(ttmr);ttmr=setTimeout(()=>t.classList.remove('show'),3200);}

/* ---------- persistence + share ---------- */
const LS='infraplan.kaarttool.v2';
function state(){const c=map.getCenter();return{c:[+c.lat.toFixed(6),+c.lng.toFixed(6)],z:map.getZoom(),b:activeBase,ov:{o:map.hasLayer(ortho),g:map.hasLayer(grb)},ct:{...counters},
  bnd:boundary.map(p=>[+p[0].toFixed(6),+p[1].toFixed(6)]),
  cams:cams.map(x=>({k:x.kind,l:x.label,la:+x.lat.toFixed(6),lo:+x.lng.toFixed(6),d:x.dir,f:x.fov,r:x.range,t:x.type,h:x.h,no:x.note||''})),
  lk:links.map(k=>[cams.findIndex(c=>c.id===k.a),cams.findIndex(c=>c.id===k.b)]).filter(p=>p[0]>=0&&p[1]>=0),
  wl:walls.map(w=>w.pts.map(p=>[+p[0].toFixed(6),+p[1].toFixed(6)])),pk:parcelCapakey||undefined,
  lt:links.map(k=>k.type||'utp'),
  tx:labels.map(t=>({t:t.text,la:+t.lat.toFixed(6),lo:+t.lng.toFixed(6)}))};}
function restore(s,keepView){if(!s)return;
  [...cams].forEach(c=>[c._m,c._c,c._h].forEach(l=>l&&map.removeLayer(l)));cams=[];
  links.forEach(k=>{k._l&&map.removeLayer(k._l);k._dim&&map.removeLayer(k._dim);});links=[];sel=null;selLink=null;
  labels.forEach(t=>t._m&&map.removeLayer(t._m));labels=[];selLabel=null;
  walls.forEach(w=>w._l&&map.removeLayer(w._l));walls=[];selWall=null;curWall=null;
  Object.assign(counters,{camera:1,switch:1,rack:1,entry:1,ap:1},s.ct||(s.n?{camera:s.n}:{}));
  (s.cams||[]).forEach(x=>{const kind=x.k||'camera';const c={id:uid(),kind,label:x.l,lat:x.la,lng:x.lo,h:(x.h==null?defaultH(kind):x.h),note:x.no||''};
    if(kind==='camera')Object.assign(c,{type:x.t||'fixed',dir:x.d,fov:x.f,range:x.r});cams.push(c);});
  (s.lk||[]).forEach(([i,j],idx)=>{if(cams[i]&&cams[j])links.push({id:uid(),a:cams[i].id,b:cams[j].id,type:(s.lt&&s.lt[idx])||'utp'});});
  (s.tx||[]).forEach(x=>{labels.push({id:uid(),text:x.t,lat:x.la,lng:x.lo});});
  (s.wl||[]).forEach(pts=>{if(pts&&pts.length>=2){const w={id:uid(),pts:pts.map(p=>[p[0],p[1]]),_dims:[],_l:L.polyline(pts,wallStyle(false)).addTo(map)};
    w._l.on('click',e=>{selectWall(w.id);L.DomEvent.stop(e);});walls.push(w);addWallDims(w);}});
  if(!keepView){ // bij undo/redo blijven kaartpositie en lagen staan
    if(s.c)map.setView(s.c,s.z||18);
    if(s.b==='osm'){map.removeLayer(esri);osm.addTo(map);activeBase='osm';}
    if(s.ov){if(s.ov.o)ortho.addTo(map);else map.removeLayer(ortho);if(s.ov.g)grb.addTo(map);else map.removeLayer(grb);}
    else if(s.b==='ortho')ortho.addTo(map);  // back-compat: oude opslag had ortho als basislaag
  }
  clearBoundary();if(s.bnd&&s.bnd.length>=3){boundary=s.bnd.map(p=>[p[0],p[1]]);drawBoundary();}
  parcelCapakey=s.pk||null;
  renderAll();syncEditor();}
/* ---- undo/redo: snapshot bij elke structurele wijziging (pannen/zoomen telt niet mee) ---- */
const VIEW_KEYS=['c','z','b','ov'];
const coreOf=s=>{const o={...s};VIEW_KEYS.forEach(k=>delete o[k]);return JSON.stringify(o);};
let undoStack=[],redoStack=[],lastSnap=null,lastCore=null;
function persist(s){try{localStorage.setItem(LS,JSON.stringify(s));}catch{}}
function saveNow(){const s=state(),core=coreOf(s);
  if(lastSnap&&core!==lastCore){undoStack.push(lastSnap);if(undoStack.length>60)undoStack.shift();redoStack=[];}
  lastSnap=s;lastCore=core;persist(s);}
function markSnap(){lastSnap=state();lastCore=coreOf(lastSnap);}
function applySnap(s){clearTimeout(savtmr);lastSnap=s;lastCore=coreOf(s);
  restore(s,true);refreshList();syncEditor();persist(s);if(analysisOn)scheduleAnalysis();}
function doUndo(){saveNow();if(!undoStack.length){toast('Niets om ongedaan te maken');return;}
  redoStack.push(lastSnap);applySnap(undoStack.pop());toast('Ongedaan gemaakt (Ctrl+Y = opnieuw)');}
function doRedo(){saveNow();if(!redoStack.length){toast('Niets om opnieuw te doen');return;}
  undoStack.push(lastSnap);applySnap(redoStack.pop());toast('Opnieuw gedaan');}
let savtmr;function scheduleSave(){clearTimeout(savtmr);savtmr=setTimeout(saveNow,400);if(analysisOn)scheduleAnalysis();}
map.on('moveend zoomend',scheduleSave);

/* deellinks: gecomprimeerd (#z=, deflate + base64url — grote plannen passen zo in een
   URL) met fallback en back-compat voor oude ongecomprimeerde #p=-links */
const b64u=buf=>{let s='';new Uint8Array(buf).forEach(x=>s+=String.fromCharCode(x));
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
const unb64u=str=>{const b=atob(str.replace(/-/g,'+').replace(/_/g,'/'));
  const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;};
async function encodeShare(){const json=JSON.stringify(state());
  if(window.CompressionStream){try{
    const buf=await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    return 'z='+b64u(buf);}catch{}}
  return 'p='+btoa(unescape(encodeURIComponent(json)));}
async function decodeHash(h){
  let m=h.match(/z=([^&]+)/);
  if(m&&window.DecompressionStream){try{
    const buf=await new Response(new Blob([unb64u(m[1])]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    return JSON.parse(new TextDecoder().decode(buf));}catch{return null;}}
  m=h.match(/p=([^&]+)/);
  if(m){try{return JSON.parse(decodeURIComponent(escape(atob(m[1]))));}catch{return null;}}
  return null;}
$("shareBtn").onclick=async()=>{const h=await encodeShare(),url=location.origin+location.pathname+'#'+h;
  try{await navigator.clipboard.writeText(url);toast('Deelbare link gekopieerd ✓');}catch{prompt('Kopieer deze link:',url);}
  history.replaceState(null,'','#'+h);};

/* JSON export (click) / import (dubbelklik of sleep bestand op de kaart) */
$("jsonBtn").onclick=()=>{const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(state(),null,2)],{type:'application/json'}));
  a.download='infra-plan.json';a.click();toast('Plan bewaard als infra-plan.json — deel dit bestand; de ander opent het met ‘Open’');};
$("openBtn").onclick=()=>$("fileJson").click();
$("jsonBtn").ondblclick=()=>$("fileJson").click();
$("fileJson").onchange=e=>{const f=e.target.files[0];if(f)readJson(f);e.target.value='';};
function readJson(f){const rd=new FileReader();rd.onload=()=>{const s=decodeJSON(rd.result);if(s){restore(s);refreshList();toast('Plan geopend ✓ — je kan verder bewerken');}else toast('Ongeldig planbestand');};rd.readAsText(f);}
function decodeJSON(t){try{return JSON.parse(t);}catch{return null;}}
window.addEventListener('dragover',e=>e.preventDefault());
window.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(!f)return;
  if(f.type.startsWith('image/')){const url=URL.createObjectURL(f);if(imgOverlay)map.removeLayer(imgOverlay);
    imgOverlay=L.imageOverlay(url,map.getBounds().pad(-0.15),{opacity:.7}).addTo(map);showImgControls();toast('Foto geplaatst — sleep de kaart zodat ze past');}
  else readJson(f);});

$("printBtn").onclick=()=>window.print();

/* keyboard */
window.addEventListener('keydown',e=>{const inInput=document.activeElement.tagName==='INPUT';
  if((e.ctrlKey||e.metaKey)&&!inInput&&mode!=='wall'){const k=e.key.toLowerCase();
    if(k==='z'&&!e.shiftKey){e.preventDefault();doUndo();return;}
    if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();doRedo();return;}}
  if(mode==='measure'&&e.key==='Escape'){endMeasure();return;}
  if((mode==='gebouw'||mode==='perceel')&&e.key==='Escape'){setMode('idle');return;}
  if(mode==='wall'&&!inInput){
    if(e.key>='0'&&e.key<='9'){typedLen+=e.key;wallStatus();e.preventDefault();return;}
    if((e.key==='.'||e.key===',')&&typedLen&&!typedLen.includes('.')){typedLen+='.';wallStatus();e.preventDefault();return;}
    if(e.key==='Backspace'){e.preventDefault();if(typedLen){typedLen=typedLen.slice(0,-1);wallStatus();}else undoWallPoint();return;}
    if(e.key==='Enter'){e.preventDefault();if(typedLen!==''){if(addWallByLength(parseFloat(typedLen)))typedLen='';wallStatus();}else finishWall();return;}
    if(e.key==='Escape'){typedLen='';finishWall();return;}
    return;}
  if((e.key==='Delete'||e.key==='Backspace')&&!inInput){
    if(selLabel){delLabel(selLabel);}else if(selLink){delLink(selLink);}else if(selWall){delWall(selWall);}else if(sel){delCam(sel);}
    else return;toast('Verwijderd — Ctrl+Z maakt het ongedaan');}
  if(e.key==='Escape'){if(mode==='link')endLink();$("plaatsMenu").classList.remove('show');}});

/* ---------- paneel automatisch onder de (mogelijk meerregelige) werkbalk plaatsen ---------- */
function layoutPanel(){const tb=document.querySelector('.topbar'),pn=document.querySelector('.panel');if(!tb||!pn)return;
  if(window.innerWidth<=760){pn.style.top='';pn.style.maxHeight='';return;}
  const top=Math.round(tb.getBoundingClientRect().height)+18;
  pn.style.top=top+'px';pn.style.maxHeight='calc(100% - '+(top+12)+'px)';}
window.addEventListener('resize',layoutPanel);
if(window.ResizeObserver)new ResizeObserver(layoutPanel).observe(document.querySelector('.topbar'));
layoutPanel();

/* ---------- init: URL hash > localStorage ---------- */
buildMenu();
(async function init(){
  let loaded=false;
  if(/[zp]=/.test(location.hash)){const s=await decodeHash(location.hash);
    if(s){restore(s);refreshList();toast('Gedeeld plan geladen');loaded=true;}}
  if(!loaded){try{const ls=localStorage.getItem(LS);if(ls){restore(JSON.parse(ls));refreshList();loaded=true;}}catch{}}
  if(!loaded){refreshList();toast('Zoek een adres of klik ‘Plaats’ om te starten');}
  markSnap(); // nulpunt voor undo/redo
})();

/* ---------- offline (PWA): app-shell cachen; kaarttegels vereisen wel netwerk ---------- */
if('serviceWorker' in navigator&&location.protocol==='https:')
  navigator.serviceWorker.register('sw.js').catch(()=>{});
