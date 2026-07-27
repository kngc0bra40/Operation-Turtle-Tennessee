(function(){
'use strict';
const $=id=>document.getElementById(id);
const getMap=()=>window.OT_MAP;
const cats=['Privacy','Infrastructure','Buildability','Shopping','Airport','Recreation','Value','InvestmentFlexibility'];
let locks={}, boundary=[], boundaryLayer=null, drawing=false, audit=[], verification={status:'review',source:'',verifiedAt:''};
const draftKey='ot-form-draft-v32';
function makeLockUI(){
 [...document.querySelectorAll('.score-edit-grid label'),$('scoreInvestmentFlexibility')?.closest('label')].filter(Boolean).forEach((label,i)=>{const cat=cats[i];if(!cat||label.querySelector('.score-lock'))return;const wrap=document.createElement('span');wrap.className='score-lock';wrap.innerHTML=`<input type="checkbox" data-score-lock="${cat}"> Lock manual`;label.appendChild(wrap)});
 document.querySelectorAll('[data-score-lock]').forEach(cb=>cb.addEventListener('change',()=>{locks[cb.dataset.scoreLock]=cb.checked;saveDraft()}));
}
function readScoreLocks(){const out={};document.querySelectorAll('[data-score-lock]').forEach(cb=>out[cb.dataset.scoreLock]=cb.checked);return out}
function applyScoreLocks(auto,current){const l=readScoreLocks();return Object.fromEntries(cats.map(c=>[c,l[c]?Number(current[c]):Number(auto[c])]))}
function setLocks(v={}){locks={...v};document.querySelectorAll('[data-score-lock]').forEach(cb=>cb.checked=!!locks[cb.dataset.scoreLock])}
function polygonAreaAcres(points){if(points.length<3)return 0;const lat0=points.reduce((a,p)=>a+p.lat,0)/points.length*Math.PI/180;const xy=points.map(p=>({x:p.lng*111320*Math.cos(lat0),y:p.lat*110540}));let a=0;for(let i=0,j=xy.length-1;i<xy.length;j=i++)a+=(xy[j].x*xy[i].y-xy[i].x*xy[j].y);return Math.abs(a/2)/4046.8564224}
function renderBoundary(){const map=getMap();if(!map)return;if(boundaryLayer){map.removeLayer(boundaryLayer);boundaryLayer=null}if(boundary.length>=3){boundaryLayer=L.polygon(boundary.map(p=>[p.lat,p.lng]),{weight:3,fillOpacity:.14}).addTo(map);const acres=polygonAreaAcres(boundary);$('boundaryReadout').textContent=`Approx. ${acres.toFixed(2)} acres outlined · ${boundary.length} vertices`;}else $('boundaryReadout').textContent=boundary.length?`${boundary.length} boundary points — add at least 3`:'No parcel boundary saved'}
function startBoundary(){drawing=!drawing;$('drawBoundaryBtn').textContent=drawing?'Finish boundary':'Draw parcel boundary';document.body.classList.toggle('boundary-mode',drawing);if(drawing){boundary=[];renderBoundary();$('boundaryReadout').textContent='Tap parcel corners on the map, then press Finish boundary';document.querySelector('[data-view="mapView"]')?.click();const map=getMap();if(map)map.setZoom(Math.max(map.getZoom(),16))}else renderBoundary()}
function onMapClick(e){if(!drawing)return;boundary.push({lat:e.latlng.lat,lng:e.latlng.lng});renderBoundary()}
function clearBoundary(){boundary=[];drawing=false;$('drawBoundaryBtn').textContent='Draw parcel boundary';renderBoundary()}
function addLocationAudit(entry){audit=[...audit,entry]}
function readBoundary(){return boundary.map(p=>({lat:Number(p.lat),lng:Number(p.lng)}))}
function locationDistanceFt(a,b){const R=3958.8,toRad=v=>v*Math.PI/180,dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng);const h=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(h))*5280}
function validUsCoordinate(lat,lng){lat=Number(lat);lng=Number(lng);return Number.isFinite(lat)&&Number.isFinite(lng)&&!(Math.abs(lat)<0.0001&&Math.abs(lng)<0.0001)&&lat>=18&&lat<=72&&lng>=-180&&lng<=-66}
const roadAliases={rd:'road',road:'road',st:'street',street:'street',ave:'avenue',avenue:'avenue',ln:'lane',lane:'lane',dr:'drive',drive:'drive',trl:'trail',trail:'trail',hwy:'highway',highway:'highway',rte:'route',route:'route',cr:'countyroad',county:'countyroad',holler:'hollow',hollow:'hollow'};
function addressTokens(value=''){return String(value).toLowerCase().replace(/state\s+route/g,'route ').replace(/county\s+road/g,'countyroad').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).map(token=>roadAliases[token]||token)}
function addressParts(address=''){
 const text=String(address),tokens=addressTokens(text),number=tokens.find(token=>/^\d{1,6}[a-z]?$/.test(token))||'',zip=(text.match(/\b\d{5}(?:-\d{4})?\b/)||[])[0]||'',pieces=text.split(',').map(x=>x.trim()),city=pieces.length>1?addressTokens(pieces[1])[0]||'':'';
 const road=tokens.filter(token=>token!==number&&!/^\d{5}/.test(token)&&token!=='tn'&&token!=='tennessee'&&token!==city).slice(0,4);
 return {tokens,number,zip,city,road};
}
function addressMatchQuality(address,label,type=''){
 const wanted=addressParts(address),actual=addressTokens(label),numberMatch=!!wanted.number&&actual.includes(wanted.number),roadMatch=wanted.road.length>0&&wanted.road.every(token=>actual.includes(token)),zipMatch=!!wanted.zip&&String(label).includes(wanted.zip),cityMatch=!!wanted.city&&actual.includes(wanted.city),typeText=String(type).toLowerCase();
 return {numberMatch,roadMatch,zipMatch,cityMatch,exact:numberMatch&&roadMatch,shared:wanted.tokens.filter(token=>actual.includes(token)).length,type:typeText};
}
function buildQueries(address){
 const text=String(address).replace(/\s+/g,' ').trim(),parts=addressParts(text),withoutZip=text.replace(/,?\s*\d{5}(?:-\d{4})?\s*$/,'').trim(),withoutStateZip=text.replace(/,?\s*(?:TN|Tennessee)\s+\d{5}(?:-\d{4})?\s*$/i,'').trim(),road=parts.number&&parts.road.length?`${parts.number} ${parts.road.join(' ')}`:'',roadZip=road&&parts.zip?`${road}, TN ${parts.zip}`:'',roadCity=road&&parts.city?`${road}, ${parts.city}, TN`:'';
 return [{kind:'full address',value:text},{kind:'street and city',value:withoutStateZip},{kind:'house and road with ZIP',value:roadZip},{kind:'road and city',value:roadCity},{kind:'ZIP general area',value:parts.zip}].filter(item=>item.value).filter((item,index,all)=>all.findIndex(other=>other.value.toLowerCase()===item.value.toLowerCase())===index);
}
function rankCandidate(address,candidate){
 const quality=addressMatchQuality(address,candidate.label,candidate.type),type=String(candidate.type||'').toLowerCase();let score=0;
 if(quality.numberMatch)score+=30;if(quality.roadMatch)score+=28;if(quality.zipMatch)score+=18;if(quality.cityMatch)score+=8;if(/tennessee|\btn\b/i.test(candidate.label))score+=5;
 if(/house|building|residential|address|parcel/.test(type))score+=18;else if(/road|highway|street/.test(type))score+=12;else if(/city|town|village|locality/.test(type))score+=5;else if(/postcode|zip/.test(type)||candidate.queryKind==='ZIP general area')score+=1;
 if(candidate.queryKind==='ZIP general area')score=Math.min(score,20);
 const confidence=quality.numberMatch&&quality.roadMatch&&score>=70?'high':quality.numberMatch&&score>=45?'medium':quality.roadMatch&&score>=25?'low':'general';
 const matchType=confidence==='high'?'Verified address match':confidence==='medium'?'Approximate—review recommended':confidence==='low'?'Road-level estimate—adjust pin':'General area only—pin adjustment required';
 return {...candidate,quality,score,matchType,confidence};
}
async function censusLookup(address){
 const url=`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
 const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Census lookup unavailable');
 const matches=(await r.json())?.result?.addressMatches||[];
 return matches.map(m=>({lat:Number(m.coordinates?.y),lng:Number(m.coordinates?.x),source:'U.S. Census address match',label:m.matchedAddress||address,type:'address'})).filter(x=>validUsCoordinate(x.lat,x.lng));
}
async function osmLookup(address){
 const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=3&countrycodes=us&q=${encodeURIComponent(address)}`;
 const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Fallback lookup unavailable');
 const rows=await r.json();return rows.map(x=>({lat:Number(x.lat),lng:Number(x.lon),source:'OpenStreetMap fallback',label:x.display_name||address,type:`${x.class||''} ${x.type||''}`})).filter(x=>validUsCoordinate(x.lat,x.lng));
}
async function locateAddress(ev){
 ev?.preventDefault?.();ev?.stopImmediatePropagation?.();
 const address=$('addAddress').value.trim(),msg=$('addMessage'),loc=$('locationMessage'),box=$('locationCandidates'),btn=$('findAddressBtn');
 if(!address){msg.textContent='Enter the full property address first.';return false}
 if(box){box.hidden=true;box.innerHTML=''};btn.disabled=true;btn.textContent='Locating…';msg.textContent='Looking up the address…';
 try{
  const queries=buildQueries(address);let results=[],attempts=[];
  for(const query of queries){for(const lookup of [{provider:'U.S. Census',run:censusLookup},{provider:'OpenStreetMap',run:osmLookup}]){try{const found=await lookup.run(query.value);attempts.push({provider:lookup.provider,query:query.value,kind:query.kind,count:found.length});results.push(...found.map(item=>({...item,submittedQuery:query.value,queryKind:query.kind})));}catch(err){attempts.push({provider:lookup.provider,query:query.value,kind:query.kind,error:String(err.message||err)})}}if(results.some(item=>rankCandidate(address,item).confidence==='high'))break}
  results=results.map(item=>rankCandidate(address,item)).sort((a,b)=>b.score-a.score);
  audit=[...audit,{at:new Date().toISOString(),action:'Geocode lookup',submittedAddress:address,providerResponses:attempts,selectedResult:results[0]?.label||'',rejectionReason:results.length?'':'No geocoder result'}];
  if(!results.length){const parts=addressParts(address);if(parts.zip){msg.textContent=`No geocoder result was returned. Manual pin placement is ready; use the ${parts.zip} general area as your starting point.`;document.querySelector('#dropPinBtn')?.click()}else msg.textContent='No geocoder result was returned. Use Adjust pin manually.';$('locationConfidence').value='needs-pin';return false}
   const best=results[0];if(!validUsCoordinate(best.lat,best.lng))throw new Error('Invalid result rejected');const automaticallyAcceptable=['high','medium'].includes(best.confidence);if(!automaticallyAcceptable){const normalSetAddPin=window.setAddPin;window.setAddPin=()=>{window.setAddPin=normalSetAddPin;return true};best.confidence='general';best.matchType='Low-confidence candidate — select or adjust pin';}
  const placed=window.setAddPin?window.setAddPin(best.lat,best.lng,`${best.matchType} · ${best.source}`):false;
  if(!placed)throw new Error('Pin placement failed');
   $('locationConfidence').value=best.confidence==='high'?'high':best.confidence==='general'?'needs-pin':'review';verification={status:best.confidence,source:best.source,matchType:best.matchType,submittedQuery:best.submittedQuery,formattedResult:best.label,checkedAt:new Date().toISOString(),userVerified:false,verifiedAt:'',lat:best.lat,lng:best.lng};
  audit=[...audit,{source:best.source,address,at:new Date().toISOString(),action:'Automatic address lookup',lat:best.lat,lng:best.lng,accepted:true,confidence:best.confidence,matchType:best.matchType,submittedQuery:best.submittedQuery,formattedResult:best.label}];
  if(box){box.hidden=false;box.innerHTML=results.slice(0,3).map((candidate,index)=>`<button type="button" data-location-candidate="${index}"><b>${candidate.matchType}</b><br>${candidate.label}<small>${candidate.lat.toFixed(6)}, ${candidate.lng.toFixed(6)} · ${candidate.source}</small></button>`).join('');box.querySelectorAll('[data-location-candidate]').forEach(button=>button.addEventListener('click',()=>{const candidate=results[Number(button.dataset.locationCandidate)];window.setAddPin(candidate.lat,candidate.lng,`${candidate.matchType} · ${candidate.source}`);$('locationConfidence').value=candidate.confidence==='high'?'verified':candidate.confidence==='general'?'needs-pin':'review';verification={status:candidate.confidence,source:candidate.source,matchType:candidate.matchType,submittedQuery:candidate.submittedQuery,formattedResult:candidate.label,checkedAt:new Date().toISOString(),userVerified:true,verifiedAt:new Date().toISOString(),lat:candidate.lat,lng:candidate.lng};box.hidden=true;msg.textContent='Candidate pin applied. Adjust it if the driveway or parcel center needs refinement.'}))}
  msg.textContent=`${best.matchType}. Pin placed near ${best.label}; use Adjust pin manually if needed.`;
  if(loc)loc.textContent=`${best.matchType}: ${best.lat.toFixed(6)}, ${best.lng.toFixed(6)} · ${best.source}`;
  return true;
 }catch(err){msg.textContent='Automatic lookup failed without changing the current pin. Use Adjust pin manually.';$('locationConfidence').value='needs-pin';return false}
 finally{btn.disabled=false;btn.textContent='Locate address'}
}
async function candidates(address){let out=[];for(const query of buildQueries(address)){try{out.push(...(await censusLookup(query.value)).map(item=>rankCandidate(address,{...item,submittedQuery:query.value,queryKind:query.kind})))}catch{}try{out.push(...(await osmLookup(query.value)).map(item=>rankCandidate(address,{...item,submittedQuery:query.value,queryKind:query.kind})))}catch{}}return out.sort((a,b)=>b.score-a.score)}
function saveDraft(){const ids=['addAddress','addName','addPrice','addAcres','addNotes','developmentDriveway','developmentHomesite','developmentUtilities'];const d={};ids.forEach(id=>d[id]=$(id)?.value);d.locks=readScoreLocks();try{const payload=JSON.stringify(d);window.OTSaveReliability?.preflightStorageWrite?.(localStorage,{[draftKey]:payload});localStorage.setItem(draftKey,payload)}catch{}}
function setupDraft(){['addAddress','addName','addPrice','addAcres','addNotes','developmentDriveway','developmentHomesite','developmentUtilities'].forEach(id=>$(id)?.addEventListener('input',saveDraft));}
function loadProperty(p){setLocks(p.scoreLocks||{});boundary=Array.isArray(p.boundary)?p.boundary.map(x=>({lat:+x.lat,lng:+x.lng})):[];audit=Array.isArray(p.locationAudit)?[...p.locationAudit]:[];verification=p.locationVerification&&typeof p.locationVerification==='object'?{...p.locationVerification}:{status:p.locationConfidence||'review',source:p.pinQuality||'',verifiedAt:''};renderBoundary()}
function reset(){setLocks({});boundary=[];audit=[];verification={status:'review',source:'',verifiedAt:''};renderBoundary()}
function readLocationAudit(){return audit}
function readLocationVerification(){return {...verification}}
function setManualLocation(lat,lng,source='Manual map adjustment'){
 verification={status:'review',source,matchType:'User-selected location',submittedQuery:'',formattedResult:'',checkedAt:new Date().toISOString(),userVerified:true,verifiedAt:new Date().toISOString(),lat:Number(lat),lng:Number(lng)};
 audit=[...audit,{at:new Date().toISOString(),action:'Manual location selected',source,lat:Number(lat),lng:Number(lng),accepted:true}];
}
document.addEventListener('DOMContentLoaded',()=>{makeLockUI();setupDraft();$('findAddressBtn')?.addEventListener('click',locateAddress,true);$('drawBoundaryBtn')?.addEventListener('click',startBoundary);$('clearBoundaryBtn')?.addEventListener('click',clearBoundary);getMap()?.on('click',onMapClick);setTimeout(()=>{document.getElementById('addTopBtn')?.addEventListener('click',reset,true)},0)});
window.OTIntegrity={readScoreLocks,applyScoreLocks,readBoundary,readLocationAudit,readLocationVerification,addLocationAudit,setManualLocation,lookupCandidates:async address=>(await candidates(address)).filter(candidate=>['high','medium'].includes(candidate.confidence)),loadProperty,reset,geocodeAddress:locateAddress,buildQueries,rankCandidate};
})();
