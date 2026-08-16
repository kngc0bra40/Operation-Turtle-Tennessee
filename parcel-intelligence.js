/* Provider-neutral parcel acquisition and validation. No startup writes. */
(()=>{
'use strict';
const VERSION='1.0.0';
const STATES=Object.freeze({
  addressPointOnly:{id:'address-point-only',label:'Address Point Only'},
  approximateParcel:{id:'approximate-parcel',label:'Approximate Parcel'},
  parcelMatch:{id:'parcel-match',label:'Parcel Match'},
  verifiedGisParcel:{id:'verified-gis-parcel',label:'Verified GIS Parcel'},
  userCorrected:{id:'user-corrected',label:'User Corrected'},
  multiParcel:{id:'multi-parcel-property',label:'Multi-Parcel Property'}
});
const PROVIDERS=Object.freeze({
  sevierTn:{
    id:'tn-comptroller-sevier-parcels',
    name:'Tennessee Comptroller / Sevier County parcel feature layer',
    authority:'Tennessee Comptroller of the Treasury',
    endpoint:'https://services1.arcgis.com/Qu4yM4JJvNoC2GKw/ArcGIS/rest/services/Parcel_Sevier_County/FeatureServer/0/query',
    browserCors:'supported',
    noCredential:true,
    county:'Sevier',
    state:'TN'
  }
});
const clone=value=>value==null?value:structuredClone(value);
const now=()=>new Date().toISOString();
const finite=value=>Number.isFinite(Number(value));
const number=value=>finite(value)?Number(value):null;
const compact=value=>String(value??'').toLowerCase().replace(/\b(?:road)\b/g,'rd').replace(/\b(?:tennessee)\b/g,'tn').replace(/[^a-z0-9]+/g,' ').trim();
function addressParts(value=''){
  const text=compact(value),tokens=text.split(' ').filter(Boolean),streetNumber=tokens.find(token=>/^\d{1,6}$/.test(token))||'';
  return {text,streetNumber,tokens:tokens.filter(token=>!['tn','rd','street','st','lane','ln','drive','dr','highway','hwy','sevierville','county'].includes(token)&&token!==streetNumber)};
}
function addressesPlausiblyMatch(recordAddress='',gisAddress=''){
  const saved=addressParts(recordAddress),gis=addressParts(gisAddress);
  if(!saved.streetNumber||saved.streetNumber!==gis.streetNumber)return false;
  const streetTokens=saved.tokens.slice(0,3);
  return streetTokens.length>0&&streetTokens.every(token=>gis.text.includes(token));
}
function pointInRing(point,ring=[]){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j],cross=(Number(a[1])>point.lat)!==(Number(b[1])>point.lat)&&point.lng<(Number(b[0])-Number(a[0]))*(point.lat-Number(a[1]))/((Number(b[1])-Number(a[1]))||1e-12)+Number(a[0]);
    if(cross)inside=!inside;
  }
  return inside;
}
function pointInGeometry(point,geometry){
  if(!finite(point?.lat)||!finite(point?.lng))return false;
  const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
  return polygons.some(polygon=>pointInRing({lat:Number(point.lat),lng:Number(point.lng)},polygon?.[0]||[])&&!polygon.slice(1).some(hole=>pointInRing(point,hole)));
}
function normalizeGeometry(value){
  const geometry=value?.type==='Feature'?value.geometry:value;
  if(!['Polygon','MultiPolygon'].includes(geometry?.type)||!Array.isArray(geometry.coordinates))return null;
  return clone(geometry);
}
function featureAcreage(feature={}){
  const p=feature.properties||{};
  for(const key of ['DEEDAC','CALCAC','CALC_ACRE','LANDUNITS','ACRES','acreage']){const value=number(p[key]);if(value&&value>0)return value}
  return null;
}
function featureParcelId(feature={}){
  const p=feature.properties||{},raw=p.PARCELID||p.GISLINK2||p.GISLINK||p.ID||'';
  return String(raw).replace(/\s+/g,' ').trim();
}
function featureAddress(feature={}){
  const p=feature.properties||{};
  return [p.ADDRESS,p.CITY,p.STATE,p.ZIP].filter(Boolean).join(', ');
}
function validateFeature(feature={},record={}){
  const geometry=normalizeGeometry(feature),listingAcres=number(record.acres),gisAcres=featureAcreage(feature),pointInside=pointInGeometry({lat:record.lat,lng:record.lng},geometry),addressMatch=addressesPlausiblyMatch(record.address,featureAddress(feature)),parcelId=featureParcelId(feature),parcelIdPlausible=/\d{3,}/.test(parcelId.replace(/\D/g,'')),acreageDifferencePct=listingAcres&&gisAcres?Math.abs(gisAcres-listingAcres)/listingAcres*100:null,acreageMatch=acreageDifferencePct===null||acreageDifferencePct<=25,profile=record.propertyIntelligence?.propertyProfile||{},existingHomeClaim=Number(record.beds)>0||Number(record.sqft)>0||/existing|livable|renovation|cabin|dwelling|home/i.test(`${record.propertyType||''} ${profile.residenceStatus||''}`),improvementValue=number(feature.properties?.IMPVAL),improvementsPlausible=!existingHomeClaim||Number(improvementValue)>0,issues=[];
  if(!pointInside)issues.push('The located address point is outside this polygon.');
  if(!addressMatch)issues.push('The GIS situs address does not reasonably match the saved address.');
  if(!acreageMatch)issues.push(`GIS acreage ${gisAcres?.toFixed?.(2)||'unknown'} does not reasonably match listing acreage ${listingAcres?.toFixed?.(2)||'unknown'}.`);
  if(!parcelIdPlausible)issues.push('A plausible parcel identifier was not returned.');
  if(!improvementsPlausible)issues.push('The listing claims an existing dwelling, but this GIS record does not show a positive improvement value. Review the match.');
  const score=(pointInside?40:0)+(addressMatch?25:0)+(acreageMatch?25:0)+(parcelIdPlausible?10:0),verified=score>=90&&pointInside&&addressMatch&&acreageMatch&&parcelIdPlausible,matched=score>=65&&pointInside&&acreageMatch;
  return {feature,geometry,parcelId,gisAcres,listingAcres,acreageDifferencePct:acreageDifferencePct===null?null:Number(acreageDifferencePct.toFixed(1)),pointInside,addressMatch,acreageMatch,parcelIdPlausible,improvementsPlausible,improvementValue,score,verified:verified&&improvementsPlausible,matched,issues};
}
function buildQueryUrl(record={},provider=PROVIDERS.sevierTn,{nearby=false}={}){
  const params=new URLSearchParams({f:'geojson',where:'1=1',geometry:`${Number(record.lng)},${Number(record.lat)}`,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'OBJECTID,GISLINK,GISLINK2,PARCELID,DEEDAC,CALCAC,CALC_ACRE,ADDRESS,CITY,STATE,ZIP,ZONING,BLDGS,WATER,SEWER,ELEC,IMPVAL',returnGeometry:'true',outSR:'4326'});
  if(nearby){params.set('distance','650');params.set('units','esriSRUnit_Meter')}
  return `${provider.endpoint}?${params}`;
}
function providerFor(record={}){
  const state=String(record.parcel?.state||record.state||record.address?.match(/,\s*(TN|Tennessee)\b/i)?.[1]||'').toUpperCase(),county=String(record.parcel?.county||record.county||'');
  if((state==='TN'||state==='TENNESSEE')&&(/\bsevier\b/i.test(county)||/\bsevierville\b/i.test(record.address||'')))return PROVIDERS.sevierTn;
  return null;
}
function parseResponse(payload={}){
  const value=typeof payload==='string'?JSON.parse(payload):payload;
  if(value?.error)throw Object.assign(new Error(value.error.message||'The parcel service returned an error.'),{code:'provider-error'});
  return Array.isArray(value?.features)?value.features.filter(feature=>normalizeGeometry(feature)):[];
}
function resultForCandidates(record,provider,features,retrievedAt=now()){
  const candidates=features.map(feature=>validateFeature(feature,record)).sort((a,b)=>b.score-a.score),best=candidates[0];
  if(!best)return {success:false,state:STATES.addressPointOnly,provider:provider.name,providerId:provider.id,retrievedAt,candidates:[],failure:{code:'no-parcel-at-point',message:'No public GIS parcel polygon was returned at the located address point.',retryable:true}};
  if(!best.matched){const possibleMulti=Boolean(best.pointInside&&best.listingAcres&&best.gisAcres&&best.gisAcres<best.listingAcres*.7);return {success:false,state:STATES.approximateParcel,provider:provider.name,providerId:provider.id,retrievedAt,candidates:candidates.map(candidate=>({...candidate,feature:undefined})),possibleMultiParcel:possibleMulti,failure:{code:possibleMulti?'possible-multi-parcel':'parcel-validation-failed',message:possibleMulti?'Possible multi-parcel listing – review suggested. The point parcel does not account for the advertised acreage.':'A parcel polygon was found, but it did not pass the address and acreage checks.',retryable:false}}}
  return {success:true,state:best.verified?STATES.verifiedGisParcel:STATES.parcelMatch,provider:provider.name,providerId:provider.id,sourceUrl:provider.endpoint,retrievedAt,geometry:best.geometry,parcelId:best.parcelId,gisAcres:best.gisAcres,listingAcres:best.listingAcres,validation:{pointInside:best.pointInside,addressMatch:best.addressMatch,acreageMatch:best.acreageMatch,acreageDifferencePct:best.acreageDifferencePct,parcelIdPlausible:best.parcelIdPlausible,improvementsPlausible:best.improvementsPlausible,improvementValue:best.improvementValue,issues:best.issues},candidates:candidates.map(candidate=>({parcelId:candidate.parcelId,gisAcres:candidate.gisAcres,score:candidate.score,issues:candidate.issues}))};
}
async function acquire(record={},options={}){
  const provider=options.provider||providerFor(record),retrievedAt=now();
  if(!finite(record.lat)||!finite(record.lng))return {success:false,state:STATES.addressPointOnly,retrievedAt,failure:{code:'coordinates-missing',message:'A reasonably matched address point is required before parcel lookup.',retryable:false}};
  if(!provider)return {success:false,state:STATES.addressPointOnly,retrievedAt,failure:{code:'provider-unavailable',message:'No permitted automatic parcel provider is configured for this county. Use the parcel-file or drawing fallback.',retryable:false}};
  try{
    let payload=options.fixtureResponse;
    if(!payload){const fetchImpl=options.fetchImpl||window.fetch?.bind(window);if(typeof fetchImpl!=='function')throw Object.assign(new Error('Parcel lookup is unavailable in this browser.'),{code:'fetch-unavailable'});const response=await fetchImpl(buildQueryUrl(record,provider),{headers:{Accept:'application/geo+json, application/json'}});if(!response?.ok)throw Object.assign(new Error(`Parcel service returned HTTP ${response?.status||'unknown'}.`),{code:'provider-http'});payload=await response.json()}
    return resultForCandidates(record,provider,parseResponse(payload),retrievedAt);
  }catch(error){return {success:false,state:STATES.addressPointOnly,provider:provider.name,providerId:provider.id,retrievedAt,failure:{code:error?.code||'cors-or-network',message:error?.message||'The public parcel service could not be reached.',retryable:true}}}
}
function isUserCorrected(record={}){return record.parcelIntelligence?.state?.id===STATES.userCorrected.id||/user|manual|drawn|corrected/i.test(`${record.parcel?.source||''} ${record.parcelIntelligence?.source||''}`)}
function subdivisionLayout(record={}){
  const status=parcelStatus(record),geometry=normalizeGeometry(record.parcelGeometry),acres=number(record.parcelIntelligence?.gisAcreage||record.acres),land=record.propertyIntelligence?.zillowLand||{},explicitNoAccess=/landlocked|no legal access/i.test(`${record.notes||''} ${record.parcel?.notes||''}`);
  if(explicitNoAccess)return {classification:'Difficult',physicalOnly:true,reasons:['Saved facts identify a landlocked or no-access condition.'],unknown:['Legal subdivisibility','surveyed access and frontage']};
  if(!geometry||!['verified-gis-parcel','user-corrected','multi-parcel-property'].includes(status.id))return {classification:'Unknown',physicalOnly:true,reasons:[],unknown:['Verified parcel geometry','road frontage','house position','legal subdivisibility']};
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates,rings=polygons.map(polygon=>polygon[0]).filter(Boolean),points=rings.flat(),minLat=Math.min(...points.map(pair=>Number(pair[1]))),maxLat=Math.max(...points.map(pair=>Number(pair[1]))),minLng=Math.min(...points.map(pair=>Number(pair[0]))),maxLng=Math.max(...points.map(pair=>Number(pair[0]))),latSpan=maxLat-minLat||1,lngSpan=maxLng-minLng||1,houseInside=pointInGeometry({lat:record.lat,lng:record.lng},geometry),edgeRatio=houseInside?Math.min((Number(record.lat)-minLat)/latSpan,(maxLat-Number(record.lat))/latSpan,(Number(record.lng)-minLng)/lngSpan,(maxLng-Number(record.lng))/lngSpan):null,houseNearEdge=edgeRatio!==null&&edgeRatio<=.28,frontage=land.roadFrontage==='yes'||/road frontage/i.test(`${record.listingDescription||''} ${record.parcel?.notes||''}`),largeEnough=acres>=20;
  const reasons=[largeEnough&&`${acres.toFixed(1)} acres provide physical layout flexibility`,houseNearEdge&&'The existing-home point lies toward a parcel edge',frontage&&'Road frontage is claimed in saved listing evidence'].filter(Boolean),classification=largeEnough&&houseNearEdge&&frontage?'Promising':largeEnough&&(houseNearEdge||frontage)?'Possible':largeEnough?'Possible':'Unknown';
  return {classification,physicalOnly:true,reasons,unknown:['Legal subdivisibility','minimum lot standards','surveyed frontage and access','septic feasibility'],houseInside,houseNearEdge,roadFrontageClaim:frontage,acreage:acres,note:'Physical layout screen only; it is not a legal subdivision determination.'};
}
function merge(record={},result={}){
  const next=clone(record),protectedGeometry=isUserCorrected(next),existing=next.parcelIntelligence||{},successful=Boolean(result.success),state=protectedGeometry?STATES.userCorrected:successful?(result.state||STATES.parcelMatch):(existing.state||result.state||STATES.addressPointOnly);
  next.parcelIntelligence={...existing,state,provider:successful?(result.provider||existing.provider||''):(existing.provider||result.provider||''),providerId:successful?(result.providerId||existing.providerId||''):(existing.providerId||result.providerId||''),listingAcreage:number(next.acres),gisAcreage:successful?(result.gisAcres??existing.gisAcreage??null):(existing.gisAcreage??null),parcelIds:successful&&result.parcelId?[result.parcelId]:(existing.parcelIds||[]),validation:successful?(result.validation||existing.validation||null):(existing.validation||null),possibleMultiParcel:!!result.possibleMultiParcel||!!existing.possibleMultiParcel,acquiredAt:successful?(result.retrievedAt||existing.acquiredAt||''):(existing.acquiredAt||''),lastAttemptAt:result.retrievedAt||now(),failure:result.failure||null,sourceUrl:successful?(result.sourceUrl||existing.sourceUrl||''):(existing.sourceUrl||result.sourceUrl||'')};
  if(result.success&&!protectedGeometry){
    next.parcelGeometry=clone(result.geometry);next.parcel={...(next.parcel||{}),parcelId:next.parcel?.parcelId||result.parcelId||'',source:result.provider,checkedAt:String(result.retrievedAt||'').slice(0,10),gisUrl:result.sourceUrl||next.parcel?.gisUrl||'',gisAcreage:result.gisAcres,listingAcreage:number(next.acres)};next.fieldSources={...(next.fieldSources||{}),'parcel.parcelId':next.fieldSources?.['parcel.parcelId']||'county','parcelGeometry':'county'};
  }
  next.parcelIntelligence.subdivisionLayout=subdivisionLayout(next);
  return next;
}
function combineFeatures(features=[],metadata={}){
  const valid=features.map(feature=>({geometry:normalizeGeometry(feature),parcelId:featureParcelId(feature),acres:featureAcreage(feature)})).filter(item=>item.geometry),polygons=[];
  valid.forEach(item=>{if(item.geometry.type==='Polygon')polygons.push(item.geometry.coordinates);else polygons.push(...item.geometry.coordinates)});
  if(!polygons.length)return null;
  return {geometry:{type:'MultiPolygon',coordinates:polygons},state:STATES.multiParcel,parcelIds:valid.map(item=>item.parcelId).filter(Boolean),gisAcres:valid.reduce((sum,item)=>sum+(item.acres||0),0)||null,source:metadata.source||'User-selected public GIS parcels',confirmedAt:metadata.confirmedAt||now()};
}
function parseBoundaryText(fileName='',text=''){
  const name=String(fileName).toLowerCase();
  if(/\.(?:geojson|json)$/.test(name)){
    const parsed=JSON.parse(text),geometries=parsed?.type==='FeatureCollection'?parsed.features.map(normalizeGeometry).filter(Boolean):[normalizeGeometry(parsed)].filter(Boolean);
    if(!geometries.length)throw new Error('The file did not contain a Polygon or MultiPolygon.');
    const combined=combineFeatures(geometries.map(geometry=>({type:'Feature',geometry,properties:{}})),{source:'User-imported GeoJSON'});
    return {geometry:combined.geometry,state:STATES.userCorrected,source:'User-imported GeoJSON',confidence:'user-confirmed-coordinate-file',needsConfirmation:true};
  }
  if(/\.(?:kml|gpx)$/.test(name)){
    const coordinates=[];
    if(name.endsWith('.gpx'))for(const match of String(text).matchAll(/<(?:trkpt|rtept|wpt)\b[^>]*\blat=["']([^"']+)["'][^>]*\blon=["']([^"']+)["'][^>]*>/gi)){const lat=Number(match[1]),lng=Number(match[2]);if(finite(lat)&&finite(lng))coordinates.push([lng,lat])}
    else for(const match of String(text).matchAll(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi))for(const pair of match[1].trim().split(/\s+/)){const [lng,lat]=pair.split(',').map(Number);if(finite(lat)&&finite(lng))coordinates.push([lng,lat])}
    if(coordinates.length<3)throw new Error('The coordinate file did not contain a usable closed boundary.');
    if(coordinates[0][0]!==coordinates.at(-1)[0]||coordinates[0][1]!==coordinates.at(-1)[1])coordinates.push([...coordinates[0]]);
    return {geometry:{type:'Polygon',coordinates:[coordinates]},state:STATES.userCorrected,source:`User-imported ${name.endsWith('.gpx')?'GPX':'KML'}`,confidence:'user-confirmed-coordinate-file',needsConfirmation:true};
  }
  if(/\.(?:pdf|png|jpe?g)$/.test(name))return {geometry:null,state:STATES.approximateParcel,source:'County map image reference',confidence:'unverified-image-reference',needsConfirmation:true,failure:{code:'image-georeference-required',message:'The map image was accepted as a visual reference. Confirm roads and parcel labels, then draw or edit the candidate boundary; it is not survey-grade geometry.'}};
  if(/\.(?:kmz|zip)$/.test(name))return {geometry:null,state:STATES.approximateParcel,source:'Compressed parcel file',confidence:'unread',needsConfirmation:true,failure:{code:'conversion-required',message:'This compressed GIS file needs conversion to GeoJSON or KML before the browser can verify coordinates. No boundary was imported.'}};
  throw new Error('Use GeoJSON, KML, GPX, KMZ, zipped Shapefile, PDF, PNG, or JPG.');
}
function parcelStatus(record={}){
  if(isUserCorrected(record))return {...STATES.userCorrected,acres:record.parcelIntelligence?.gisAcreage||record.acres||null};
  const state=record.parcelIntelligence?.state;
  if(state?.id)return {...state,acres:record.parcelIntelligence?.gisAcreage||record.acres||null};
  if(record.parcelGeometry)return {...STATES.parcelMatch,acres:record.parcel?.gisAcreage||record.acres||null};
  return {...STATES.addressPointOnly,acres:null};
}
function runRegressionChecks(fixtureResponse){
  const record={id:'happy',address:'2792 Happy Hollow Rd, Sevierville, TN 37862',lat:35.714339,lng:-83.682605,acres:45.76,parcel:{county:'Sevier',state:'TN'}},provider=PROVIDERS.sevierTn,features=parseResponse(fixtureResponse),result=resultForCandidates(record,provider,features,'2026-08-14T12:00:00.000Z'),homeResult=resultForCandidates({...record,beds:3,sqft:1457,propertyType:'existing-home-renovation'},provider,features,'2026-08-14T12:00:00.000Z'),merged=merge(record,result),mismatch=resultForCandidates({...record,acres:1.2},provider,features),manual=merge({...record,parcelGeometry:{type:'Polygon',coordinates:[[[-84,35],[-84,35.1],[-83.9,35.1],[-84,35]]]},parcel:{source:'User drawn'},parcelIntelligence:{state:STATES.userCorrected,source:'User drawn'}},result),failedRefresh=merge(merged,{success:false,state:STATES.addressPointOnly,retrievedAt:'2026-08-15T12:00:00.000Z',failure:{code:'provider-unavailable',message:'Fixture failure'}}),gpx=parseBoundaryText('boundary.gpx','<gpx><trk><trkseg><trkpt lat="35.71" lon="-83.68"/><trkpt lat="35.72" lon="-83.68"/><trkpt lat="35.72" lon="-83.67"/></trkseg></trk></gpx>'),checks={providerIsNoCredential:provider.noCredential===true&&provider.browserCors==='supported',verifiedMatch:result.success&&result.state.id==='verified-gis-parcel',acreageValidated:result.gisAcres===45.76&&result.validation.acreageDifferencePct===0,addressAndPointValidated:result.validation.addressMatch&&result.validation.pointInside,improvementsValidated:homeResult.validation.improvementsPlausible&&homeResult.validation.improvementValue>0,geometryStored:merged.parcelGeometry?.type==='Polygon',parcelIdStored:Boolean(merged.parcel.parcelId),mismatchRejected:!mismatch.success&&mismatch.failure.code==='parcel-validation-failed',manualCorrectionProtected:manual.parcelGeometry.coordinates[0][0][0]===-84&&manual.parcelIntelligence.state.id==='user-corrected',failedRefreshPreservesVerifiedParcel:failedRefresh.parcelGeometry?.type==='Polygon'&&failedRefresh.parcelIntelligence.state.id==='verified-gis-parcel'&&failedRefresh.parcelIntelligence.failure.code==='provider-unavailable',gpxBoundaryUsable:gpx.geometry.type==='Polygon'&&gpx.geometry.coordinates[0].length===4};
  return {passed:Object.values(checks).every(Boolean),checks,result};
}
window.OTParcelIntelligence={VERSION,STATES,PROVIDERS,providerFor,buildQueryUrl,parseResponse,validateFeature,resultForCandidates,acquire,merge,combineFeatures,parseBoundaryText,pointInGeometry,parcelStatus,subdivisionLayout,runRegressionChecks};
})();
