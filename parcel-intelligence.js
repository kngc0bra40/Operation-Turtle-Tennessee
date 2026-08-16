/* Provider-neutral parcel acquisition and validation. No startup writes. */
(()=>{
'use strict';
const VERSION='1.1.0';
const STATES=Object.freeze({
  addressPointOnly:{id:'address-point-only',label:'Address Point Only'},
  approximateParcel:{id:'approximate-parcel',label:'Approximate Parcel'},
  parcelMatch:{id:'parcel-match',label:'Probable Parcel'},
  probableParcel:{id:'parcel-match',label:'Probable Parcel'},
  reviewRequired:{id:'parcel-review-required',label:'Review Required'},
  noParcelMatch:{id:'no-parcel-match',label:'No Parcel Match'},
  verifiedGisParcel:{id:'verified-gis-parcel',label:'Verified GIS Parcel'},
  userCorrected:{id:'user-corrected',label:'User Corrected'},
  multiParcel:{id:'multi-parcel-property',label:'Multi-Parcel Property'}
});
const ARCGIS_ROOT='https://services.arcgis.com/rD2ylXRs80UroD90/arcgis/rest/services/TN_County_Parcel_Map/FeatureServer';
const statewideProvider=(county,layer,addressField)=>({
  id:`tn-statewide-${county.toLowerCase()}-parcels`,
  name:`Tennessee statewide parcel layer / ${county} County`,
  authority:'Tennessee county parcel data mirror hosted in ArcGIS Online',
  endpoint:`${ARCGIS_ROOT}/${layer}/query`,
  browserCors:'supported',noCredential:true,county,state:'TN',tier:'statewide-fallback',
  fields:{address:[addressField],parcelId:[`Assessment_Data_${addressField.match(/_(\d+)_/)?.[1]||''}_PARCELID`,'Parcels_GISLINK2','Parcels_GISLINK']}
});
const PROVIDERS=Object.freeze({
  sevierTn:Object.freeze({
    id:'tn-comptroller-sevier-parcels',
    name:'Tennessee Comptroller / Sevier County parcel feature layer',
    authority:'Tennessee Comptroller of the Treasury',
    endpoint:'https://services1.arcgis.com/Qu4yM4JJvNoC2GKw/ArcGIS/rest/services/Parcel_Sevier_County/FeatureServer/0/query',
    browserCors:'supported',
    noCredential:true,county:'Sevier',state:'TN',tier:'county-government',
    fields:{address:['ADDRESS'],parcelId:['PARCELID','GISLINK2','GISLINK']}
  }),
  andersonTn:Object.freeze({
    id:'tn-anderson-cadastral-parcels',name:'Anderson County cadastral parcel layer',authority:'Tennessee cadastral data / Anderson County',
    endpoint:'https://services8.arcgis.com/vL7QLF4BNi1wukPE/arcgis/rest/services/Cadastral/FeatureServer/37/query',
    browserCors:'supported',noCredential:true,county:'Anderson',state:'TN',tier:'county-layer',
    fields:{address:['ADDRESS'],parcelId:['PARCELID','PARID','GISLINK2','GISLINK']}
  }),
  blountTn:Object.freeze({
    id:'tn-blount-county-parcels',name:'Blount County parcel feature layer',authority:'Blount County GIS',
    endpoint:'https://services3.arcgis.com/NIOS5f3vobGvnGtD/arcgis/rest/services/BlountParcels/FeatureServer/0/query',
    browserCors:'supported',noCredential:true,county:'Blount',state:'TN',tier:'county-government',
    fields:{address:['ADDRESS'],parcelId:['PARCELID','PARID','GISLINK2','GISLINK']}
  }),
  sevierStatewide:Object.freeze(statewideProvider('Sevier',15,'Assessment_Data_78_ADDRESS')),
  andersonStatewide:Object.freeze(statewideProvider('Anderson',83,'Assessment_Data_01_ADDRESS')),
  blountStatewide:Object.freeze(statewideProvider('Blount',79,'Assessment_Data_05_ADDRESS')),
  loudonStatewide:Object.freeze(statewideProvider('Loudon',38,'Assessment_Data_53_ADDRESS')),
  monroeStatewide:Object.freeze(statewideProvider('Monroe',29,'Assessment_Data_62_ADDRESS')),
  mcminnStatewide:Object.freeze(statewideProvider('McMinn',32,'Assessment_Data_54_ADDRESS'))
});
const COUNTY_PROVIDERS=Object.freeze({
  sevier:[PROVIDERS.sevierTn,PROVIDERS.sevierStatewide],
  anderson:[PROVIDERS.andersonTn,PROVIDERS.andersonStatewide],
  blount:[PROVIDERS.blountTn,PROVIDERS.blountStatewide],
  loudon:[PROVIDERS.loudonStatewide],
  monroe:[PROVIDERS.monroeStatewide],
  mcminn:[PROVIDERS.mcminnStatewide]
});
const BLOCKED_SOURCES=Object.freeze([{id:'tn-comptroller-statewide-parcels',endpoint:'https://maps.cot.tn.gov/server3/rest/services/IMPACT/Parcels/FeatureServer/0/query',reason:'The official statewide service responds outside the browser but does not provide dependable cross-origin access for this browser-only app.'}]);
const clone=value=>value==null?value:structuredClone(value);
const now=()=>new Date().toISOString();
const finite=value=>Number.isFinite(Number(value));
const number=value=>finite(value)?Number(value):null;
const compact=value=>String(value??'').toLowerCase()
  .replace(/\btennessee\b/g,'tn').replace(/\bnorth\b/g,'n').replace(/\bsouth\b/g,'s').replace(/\beast\b/g,'e').replace(/\bwest\b/g,'w')
  .replace(/\broad\b/g,'rd').replace(/\bstreet\b/g,'st').replace(/\blane\b/g,'ln').replace(/\bdrive\b/g,'dr').replace(/\bhighway\b/g,'hwy')
  .replace(/\bavenue\b/g,'ave').replace(/\bboulevard\b/g,'blvd').replace(/\bcircle\b/g,'cir').replace(/\bparkway\b/g,'pkwy').replace(/\bcourt\b/g,'ct')
  .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const STREET_NOISE=new Set(['tn','rd','st','ln','dr','hwy','ave','blvd','cir','pkwy','ct','trl','way','route','county','co','unit','apt','n','s','e','w']);
function addressParts(value=''){
  const line=String(value||'').split(',')[0],text=compact(line),allTokens=text.split(' ').filter(Boolean),numericTokens=allTokens.filter(token=>/^\d{1,6}[a-z]?$/.test(token)),streetNumber=/^\d/.test(allTokens[0]||'')?(numericTokens[0]||''):/^\d/.test(allTokens.at(-1)||'')?(numericTokens.at(-1)||''):(numericTokens[0]||''),tokens=allTokens.filter(token=>!STREET_NOISE.has(token)&&token!==streetNumber&&!/^\d{5}(?:\d{4})?$/.test(token));
  return {text,streetNumber,tokens,allTokens};
}
function addressSimilarity(recordAddress='',gisAddress=''){
  const saved=addressParts(recordAddress),gis=addressParts(gisAddress),shared=saved.tokens.filter(token=>gis.tokens.includes(token)),streetRatio=saved.tokens.length?shared.length/saved.tokens.length:0,houseNumberMatch=saved.streetNumber&&gis.streetNumber?saved.streetNumber===gis.streetNumber:null,strongStreet=streetRatio>=.67&&shared.length>=1,addressAvailable=Boolean(gis.text),plausible=addressAvailable&&strongStreet&&houseNumberMatch!==false;
  return {plausible,strong:plausible&&houseNumberMatch===true,streetRatio:Number(streetRatio.toFixed(2)),houseNumberMatch,addressAvailable,saved,gis};
}
function addressesPlausiblyMatch(recordAddress='',gisAddress=''){return addressSimilarity(recordAddress,gisAddress).plausible}
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
  let geometry=value?.type==='Feature'?value.geometry:value;
  if(geometry?.rings)geometry={type:'Polygon',coordinates:geometry.rings};
  if(!['Polygon','MultiPolygon'].includes(geometry?.type)||!Array.isArray(geometry.coordinates))return null;
  return clone(geometry);
}
function featureProperties(feature={}){return feature.properties||feature.attributes||{}}
function fieldValue(properties={},candidates=[]){
  const entries=Object.entries(properties),wanted=candidates.map(value=>String(value).toUpperCase());
  for(const candidate of wanted){const exact=entries.find(([key])=>key.toUpperCase()===candidate);if(exact&&exact[1]!==null&&exact[1]!==undefined&&exact[1]!=='')return exact[1]}
  for(const candidate of wanted){const suffixed=entries.find(([key])=>key.toUpperCase().endsWith(`_${candidate}`));if(suffixed&&suffixed[1]!==null&&suffixed[1]!==undefined&&suffixed[1]!=='')return suffixed[1]}
  return null;
}
function featureAcreage(feature={}){
  const p=featureProperties(feature);
  for(const key of ['DEEDAC','CAMACALCAC','CALCAC','CALC_ACRE','GIS_ACRES','ACRES','ACREAGE','LANDUNITS']){const value=number(fieldValue(p,[key]));if(value&&value>0)return value}
  return null;
}
function featureParcelId(feature={}){
  const p=featureProperties(feature),raw=fieldValue(p,['PARCELID','PARID','GISLINK2','GISLINK','PARCEL_ID','ID'])||'';
  return String(raw).replace(/\s+/g,' ').trim();
}
function featureAddress(feature={}){
  const p=featureProperties(feature);
  return [fieldValue(p,['ADDRESS','SITUS_ADDRESS','SITE_ADDRESS','PROP_ADDRESS']),fieldValue(p,['CITY','SITUS_CITY']),fieldValue(p,['STATE','SITUS_STATE']),fieldValue(p,['ZIP','ZIPCODE','SITUS_ZIP'])].filter(Boolean).join(', ');
}
const featureOwner=feature=>String(fieldValue(featureProperties(feature),['OWNER','OWNER_NAME','OWNJAN1'])||'').trim();
const normalizedParcelId=value=>compact(value).replace(/\s/g,'');
function normalizedFeature(feature={}){const p=featureProperties(feature);return {parcelId:featureParcelId(feature),situsAddress:featureAddress(feature),owner:featureOwner(feature),ownerMailingAddress:[fieldValue(p,['MAILADDR','MAIL_ADDRESS']),fieldValue(p,['MAILCITY','MAIL_CITY']),fieldValue(p,['MAILSTATE','STATE']),fieldValue(p,['MAILZIP','ZIP'])].filter(Boolean).join(', '),gisAcreage:featureAcreage(feature),landValue:number(fieldValue(p,['LANDMKTVAL','LANDVAL','LAND_VALUE'])),improvementValue:number(fieldValue(p,['IMPVAL','IMPROVEMENT_VALUE','BLDGVAL'])),legalDescription:String(fieldValue(p,['LEGALDESC','LEGAL_DESCRIPTION','DEEDBKPG'])||''),taxDistrict:String(fieldValue(p,['DISTRICT','TAXDISTRICT','TAX_DISTRICT'])||'')}}
function geometryBounds(geometry){const normalized=normalizeGeometry(geometry),pairs=normalized?.type==='Polygon'?normalized.coordinates.flat(1):normalized?.type==='MultiPolygon'?normalized.coordinates.flat(2):[];if(!pairs.length)return null;return {minLng:Math.min(...pairs.map(pair=>Number(pair[0]))),maxLng:Math.max(...pairs.map(pair=>Number(pair[0]))),minLat:Math.min(...pairs.map(pair=>Number(pair[1]))),maxLat:Math.max(...pairs.map(pair=>Number(pair[1])))} }
function haversineMeters(a,b){const rad=value=>Number(value)*Math.PI/180,dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function distanceToGeometry(point,geometry){if(pointInGeometry(point,geometry))return 0;const bounds=geometryBounds(geometry);if(!bounds)return Infinity;const nearest={lat:Math.max(bounds.minLat,Math.min(bounds.maxLat,Number(point.lat))),lng:Math.max(bounds.minLng,Math.min(bounds.maxLng,Number(point.lng)))};return haversineMeters(point,nearest)}
function boundsGapMeters(first,second){const a=geometryBounds(first),b=geometryBounds(second);if(!a||!b)return Infinity;const lat=Math.max(a.minLat,Math.min(a.maxLat,(b.minLat+b.maxLat)/2)),lng=Math.max(a.minLng,Math.min(a.maxLng,(b.minLng+b.maxLng)/2)),other={lat:Math.max(b.minLat,Math.min(b.maxLat,lat)),lng:Math.max(b.minLng,Math.min(b.maxLng,lng))};return haversineMeters({lat,lng},other)}
function validateFeature(feature={},record={}){
  const geometry=normalizeGeometry(feature),listingAcres=number(record.acres),gisAcres=featureAcreage(feature),point={lat:record.lat,lng:record.lng},pointInside=pointInGeometry(point,geometry),proximityMeters=distanceToGeometry(point,geometry),similarity=addressSimilarity(record.address,featureAddress(feature)),addressMatch=similarity.plausible,parcelId=featureParcelId(feature),knownParcelId=record.parcel?.parcelId||record.parcelNumber||record.parcelIntelligence?.parcelIds?.[0]||'',knownParcelIdMatch=Boolean(knownParcelId&&normalizedParcelId(knownParcelId)===normalizedParcelId(parcelId)),parcelIdPlausible=/\d{3,}/.test(parcelId.replace(/\D/g,'')),acreageDifferencePct=listingAcres&&gisAcres?Math.abs(gisAcres-listingAcres)/listingAcres*100:null,acreageMatch=acreageDifferencePct===null||acreageDifferencePct<=25,profile=record.propertyIntelligence?.propertyProfile||{},existingHomeClaim=Number(record.beds)>0||Number(record.sqft)>0||/existing|livable|renovation|cabin|dwelling|home/i.test(`${record.propertyType||''} ${profile.residenceStatus||''}`),improvementValue=normalizedFeature(feature).improvementValue,improvementsPlausible=!existingHomeClaim||improvementValue===null||improvementValue>0,issues=[];
  if(!pointInside)issues.push('The located address point is outside this polygon.');
  if(similarity.addressAvailable&&!addressMatch)issues.push('The GIS situs address does not reasonably match the saved address.');
  if(!similarity.addressAvailable)issues.push('The GIS record does not include a usable situs address; coordinate and acreage evidence carry the match.');
  if(!acreageMatch)issues.push(`GIS acreage ${gisAcres?.toFixed?.(2)||'unknown'} does not reasonably match listing acreage ${listingAcres?.toFixed?.(2)||'unknown'}.`);
  if(!parcelIdPlausible)issues.push('A plausible parcel identifier was not returned.');
  if(!improvementsPlausible)issues.push('The listing claims an existing dwelling, but this GIS record does not show a positive improvement value. Review the match.');
  const score=Math.min(100,(knownParcelIdMatch?35:0)+(pointInside?35:proximityMeters<=150?8:0)+(similarity.strong?20:addressMatch?12:0)+(acreageMatch?15:0)+(parcelIdPlausible?5:0)+(improvementsPlausible?5:0)),verified=((knownParcelIdMatch&&(pointInside||similarity.strong))||(pointInside&&addressMatch))&&acreageMatch&&parcelIdPlausible&&improvementsPlausible,matched=verified||(acreageMatch&&parcelIdPlausible&&(pointInside||knownParcelIdMatch||(similarity.strong&&proximityMeters<=150)));
  return {feature,geometry,normalized:normalizedFeature(feature),parcelId,gisAcres,listingAcres,acreageDifferencePct:acreageDifferencePct===null?null:Number(acreageDifferencePct.toFixed(1)),pointInside,proximityMeters:Number.isFinite(proximityMeters)?Math.round(proximityMeters):null,addressMatch,addressSimilarity:similarity.streetRatio,houseNumberMatch:similarity.houseNumberMatch,knownParcelIdMatch,acreageMatch,parcelIdPlausible,improvementsPlausible,improvementValue,score,verified,matched,methods:[...new Set(feature._otMethods||[])],issues};
}
function knownParcelId(record={}){return String(record.parcel?.parcelId||record.parcelNumber||record.parcelIntelligence?.parcelIds?.[0]||'').trim()}
function addressWhere(record={},provider={}){const parts=addressParts(record.address),tokens=parts.tokens.filter(token=>!/\d/.test(token)).slice(0,4);if(!tokens.length)return '';const pattern=`%${tokens.map(token=>token.toUpperCase()).join('%')}%`,fields=provider.fields?.address||[];return fields.map(field=>`${field} LIKE '${pattern.replace(/'/g,"''")}'`).join(' OR ')}
function idWhere(record={},provider={}){const value=knownParcelId(record).replace(/'/g,"''");if(!value)return '';return (provider.fields?.parcelId||[]).map(field=>`${field} = '${value}'`).join(' OR ')}
function buildQueryUrl(record={},provider=PROVIDERS.sevierTn,{mode='spatial',nearby=false}={}){
  const actualMode=nearby?'nearby':mode,params=new URLSearchParams({f:'geojson',where:'1=1',outFields:'*',returnGeometry:'true',outSR:'4326',resultRecordCount:actualMode==='address'?25:50});
  if(actualMode==='id')params.set('where',idWhere(record,provider)||'1=0');
  if(actualMode==='address')params.set('where',addressWhere(record,provider)||'1=0');
  if(actualMode==='spatial'||actualMode==='nearby'){params.set('geometry',`${Number(record.lng)},${Number(record.lat)}`);params.set('geometryType','esriGeometryPoint');params.set('inSR','4326');params.set('spatialRel','esriSpatialRelIntersects')}
  if(actualMode==='nearby'){params.set('distance','650');params.set('units','esriSRUnit_Meter')}
  return `${provider.endpoint}?${params}`;
}
function inferredCounties(record={}){
  const state=String(record.parcel?.state||record.state||record.address?.match(/,\s*(TN|Tennessee)\b/i)?.[1]||'').toUpperCase(),county=String(record.parcel?.county||record.county||'');
  if(!['TN','TENNESSEE'].includes(state))return [];
  const explicit=Object.keys(COUNTY_PROVIDERS).find(key=>new RegExp(`\\b${key}\\b`,'i').test(county));if(explicit)return [explicit];
  const address=String(record.address||'');
  const cityGroups=[['sevier',/\b(?:sevierville|pigeon forge|gatlinburg)\b/i],['anderson',/\b(?:andersonville|clinton|norris|rocky top)\b/i],['blount',/\b(?:maryville|alcoa|townsend|tallassee)\b/i],['loudon',/\b(?:lenoir city|loudon|philadelphia|greenback)\b/i],['monroe',/\b(?:tellico plains|madisonville|vonore)\b/i],['mcminn',/\b(?:athens|etowah|englewood|niota)\b/i]];
  const matched=cityGroups.find(([,pattern])=>pattern.test(address));if(matched)return [matched[0]];
  if(/\bsweetwater\b/i.test(address))return ['monroe','mcminn'];
  return [];
}
function providersFor(record={}){return inferredCounties(record).flatMap(county=>COUNTY_PROVIDERS[county]||[])}
function providerFor(record={}){return providersFor(record)[0]||null}
function parseResponse(payload={}){
  const value=typeof payload==='string'?JSON.parse(payload):payload;
  if(value?.error)throw Object.assign(new Error(value.error.message||'The parcel service returned an error.'),{code:'provider-error'});
  return Array.isArray(value?.features)?value.features.map(feature=>feature?.attributes?{type:'Feature',properties:feature.attributes,geometry:normalizeGeometry(feature.geometry)}:feature).filter(feature=>normalizeGeometry(feature)):[];
}
function featureKey(feature){return `${normalizedParcelId(featureParcelId(feature))}:${JSON.stringify(normalizeGeometry(feature)?.coordinates?.[0]?.[0]||'').slice(0,80)}`}
function mergeCandidateFeatures(collection=[],incoming=[],method='unknown'){const map=new Map(collection.map(feature=>[featureKey(feature),feature]));incoming.forEach(raw=>{const key=featureKey(raw),existing=map.get(key);if(existing)existing._otMethods=[...new Set([...(existing._otMethods||[]),method])];else{raw._otMethods=[method];map.set(key,raw)}});return [...map.values()]}
function multiParcelSuggestion(best,candidates,record){
  if(!best?.pointInside||!best.listingAcres||!best.gisAcres||best.gisAcres>=best.listingAcres*.7)return null;
  const selected=[best],owner=compact(featureOwner(best.feature));let total=best.gisAcres;
  const adjacent=candidates.filter(candidate=>candidate!==best&&candidate.gisAcres&&owner&&compact(featureOwner(candidate.feature))===owner).sort((a,b)=>boundsGapMeters(best.geometry,a.geometry)-boundsGapMeters(best.geometry,b.geometry));
  for(const candidate of adjacent){if(selected.some(item=>boundsGapMeters(item.geometry,candidate.geometry)<=35)){selected.push(candidate);total+=candidate.gisAcres;if(total>=best.listingAcres*.75)break}}
  if(selected.length<2)return {label:'Possible Multi-Parcel Property',parcelIds:[best.parcelId].filter(Boolean),gisAcres:best.gisAcres,listingAcres:best.listingAcres,combined:false};
  return {label:'Possible Multi-Parcel Property',parcelIds:selected.map(item=>item.parcelId).filter(Boolean),gisAcres:Number(total.toFixed(2)),listingAcres:best.listingAcres,combined:Math.abs(total-best.listingAcres)/best.listingAcres<=.3,ownerMatched:true,count:selected.length};
}
function resultForCandidates(record,provider,features,retrievedAt=now(),attempts=[]){
  const candidates=features.map(feature=>validateFeature(feature,record)).sort((a,b)=>b.score-a.score),best=candidates[0];
  const common={provider:provider.name,providerId:provider.id,providerTier:provider.tier,county:provider.county,sourceUrl:provider.endpoint,retrievedAt,attempts};
  if(!best)return {success:false,state:STATES.noParcelMatch,...common,candidates:[],failure:{code:'no-parcel-match',message:'The configured public parcel sources responded, but no address, containing, or nearby parcel candidate was returned.',retryable:true}};
  const multiParcel=multiParcelSuggestion(best,candidates,record),candidateSummaries=candidates.map(candidate=>({parcelId:candidate.parcelId,gisAcres:candidate.gisAcres,score:candidate.score,pointInside:candidate.pointInside,proximityMeters:candidate.proximityMeters,methods:candidate.methods,issues:candidate.issues}));
  if(multiParcel)return {success:false,state:STATES.reviewRequired,...common,candidates:candidateSummaries,possibleMultiParcel:true,multiParcelSuggestion:multiParcel,failure:{code:'possible-multi-parcel',message:`Possible multi-parcel property — the containing parcel accounts for ${best.gisAcres.toFixed(2)} of ${best.listingAcres.toFixed(2)} listed acres. Review adjacent parcels before terrain analysis.`,retryable:false}};
  if(!best.matched)return {success:false,state:STATES.reviewRequired,...common,candidates:candidateSummaries,failure:{code:'parcel-validation-failed',message:'Parcel candidates were found, but address, coordinate, acreage, or improvement evidence was not strong enough to accept one automatically.',retryable:false}};
  return {success:true,state:best.verified?STATES.verifiedGisParcel:STATES.probableParcel,...common,geometry:best.geometry,parcelId:best.parcelId,parcelIds:[best.parcelId].filter(Boolean),gisAcres:best.gisAcres,listingAcres:best.listingAcres,normalized:best.normalized,matchMethod:best.methods.join(', ')||'candidate-ranking',validation:{score:best.score,pointInside:best.pointInside,proximityMeters:best.proximityMeters,addressMatch:best.addressMatch,addressSimilarity:best.addressSimilarity,houseNumberMatch:best.houseNumberMatch,knownParcelIdMatch:best.knownParcelIdMatch,acreageMatch:best.acreageMatch,acreageDifferencePct:best.acreageDifferencePct,parcelIdPlausible:best.parcelIdPlausible,improvementsPlausible:best.improvementsPlausible,improvementValue:best.improvementValue,issues:best.issues},candidates:candidateSummaries};
}
async function queryProvider(record,provider,options={}){
  const fetchImpl=options.fetchImpl||window.fetch?.bind(window);if(typeof fetchImpl!=='function')throw Object.assign(new Error('Parcel lookup is unavailable in this browser.'),{code:'fetch-unavailable'});
  const fixtureMode=options.fixtureResponse!==undefined;let fixturePayload=options.fixtureResponse,candidates=[],attempts=[];const modes=[knownParcelId(record)&&'id',addressWhere(record,provider)&&'address','spatial'].filter(Boolean);
  for(const mode of modes){const url=buildQueryUrl(record,provider,{mode}),attempt={provider:provider.name,providerId:provider.id,county:provider.county,method:mode,endpoint:provider.endpoint,responded:false,candidateCount:0};try{let payload;if(fixtureMode)payload=fixturePayload;else{const response=await fetchImpl(url,{headers:{Accept:'application/geo+json, application/json'}});if(!response?.ok)throw Object.assign(new Error(`Parcel service returned HTTP ${response?.status||'unknown'}.`),{code:'provider-http'});payload=await response.json()}const found=parseResponse(payload);attempt.responded=true;attempt.candidateCount=found.length;candidates=mergeCandidateFeatures(candidates,found,mode)}catch(error){attempt.errorCode=error?.code||'cors-or-network';attempt.message=error?.message||'The public parcel service could not be reached.'}attempts.push(attempt);const interim=resultForCandidates(record,provider,candidates,now(),attempts);if(interim.success&&interim.state.id===STATES.verifiedGisParcel.id)return interim}
  const interim=resultForCandidates(record,provider,candidates,now(),attempts),needsNearby=!interim.success||interim.state.id!==STATES.verifiedGisParcel.id;
  if(needsNearby&&!fixtureMode){const mode='nearby',url=buildQueryUrl(record,provider,{mode}),attempt={provider:provider.name,providerId:provider.id,county:provider.county,method:mode,endpoint:provider.endpoint,responded:false,candidateCount:0};try{const response=await fetchImpl(url,{headers:{Accept:'application/geo+json, application/json'}});if(!response?.ok)throw Object.assign(new Error(`Parcel service returned HTTP ${response?.status||'unknown'}.`),{code:'provider-http'});const found=parseResponse(await response.json());attempt.responded=true;attempt.candidateCount=found.length;candidates=mergeCandidateFeatures(candidates,found,mode)}catch(error){attempt.errorCode=error?.code||'cors-or-network';attempt.message=error?.message||'The public parcel service could not be reached.'}attempts.push(attempt)}
  return resultForCandidates(record,provider,candidates,now(),attempts);
}
async function acquire(record={},options={}){
  const configured=options.provider?[options.provider]:providersFor(record),retrievedAt=now();
  if(!finite(record.lat)||!finite(record.lng))return {success:false,state:STATES.addressPointOnly,retrievedAt,failure:{code:'coordinates-missing',message:'A reasonably matched address point is required before parcel lookup.',retryable:false}};
  if(!configured.length)return {success:false,state:STATES.noParcelMatch,retrievedAt,attempts:[],failure:{code:'provider-unavailable',message:'No browser-compatible automatic parcel provider is configured for this county. Use the parcel-file or drawing fallback.',retryable:false}};
  const allAttempts=[];let bestReview=null;
  for(const provider of configured){const fixture=options.fixtureResponses?.[provider.id]??options.fixtureResponse,result=await queryProvider(record,provider,{fetchImpl:options.fetchImpl,fixtureResponse:fixture});allAttempts.push(...(result.attempts||[]));if(result.success)return {...result,attempts:allAttempts};if(result.candidates?.length&&!bestReview)bestReview=result}
  if(bestReview)return {...bestReview,attempts:allAttempts};
  const responded=allAttempts.some(attempt=>attempt.responded),failures=allAttempts.filter(attempt=>attempt.errorCode);
  return {success:false,state:STATES.noParcelMatch,retrievedAt,attempts:allAttempts,provider:configured.map(provider=>provider.name).join('; '),providerId:configured.map(provider=>provider.id).join(','),county:configured[0].county,failure:{code:responded?'no-parcel-match':failures.some(attempt=>attempt.errorCode==='provider-http')?'provider-http':'cors-or-network',message:responded?'Public parcel sources responded, but no address, containing, or nearby parcel candidate was found.':'All configured public parcel sources were unavailable in the browser. Review diagnostics or use the parcel-file/drawing fallback.',retryable:true}};
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
  next.parcelIntelligence={...existing,state,county:result.county||existing.county||next.parcel?.county||'',provider:successful?(result.provider||existing.provider||''):(existing.provider||result.provider||''),providerId:successful?(result.providerId||existing.providerId||''):(existing.providerId||result.providerId||''),providerTier:successful?(result.providerTier||existing.providerTier||''):(existing.providerTier||result.providerTier||''),matchMethod:successful?(result.matchMethod||existing.matchMethod||''):(existing.matchMethod||''),listingAcreage:number(next.acres),gisAcreage:successful?(result.gisAcres??existing.gisAcreage??null):(existing.gisAcreage??null),parcelIds:successful?(result.parcelIds||[result.parcelId].filter(Boolean)):(existing.parcelIds||[]),normalized:successful?(result.normalized||existing.normalized||null):(existing.normalized||null),validation:successful?(result.validation||existing.validation||null):(existing.validation||null),attempts:Array.isArray(result.attempts)?clone(result.attempts):(existing.attempts||[]),possibleMultiParcel:!!result.possibleMultiParcel||!!existing.possibleMultiParcel,multiParcelSuggestion:result.multiParcelSuggestion||existing.multiParcelSuggestion||null,acquiredAt:successful?(result.retrievedAt||existing.acquiredAt||''):(existing.acquiredAt||''),lastAttemptAt:result.retrievedAt||now(),failure:result.failure||null,sourceUrl:successful?(result.sourceUrl||existing.sourceUrl||''):(existing.sourceUrl||result.sourceUrl||'')};
  if(result.success&&!protectedGeometry){
    const normalized=result.normalized||{};next.parcelGeometry=clone(result.geometry);next.parcel={...(next.parcel||{}),county:next.parcel?.county||result.county||'',parcelId:next.parcel?.parcelId||result.parcelId||'',situsAddress:next.parcel?.situsAddress||normalized.situsAddress||'',owner:next.parcel?.owner||normalized.owner||'',ownerMailingAddress:next.parcel?.ownerMailingAddress||normalized.ownerMailingAddress||'',landValue:next.parcel?.landValue??normalized.landValue??null,improvementValue:next.parcel?.improvementValue??normalized.improvementValue??null,legalDescription:next.parcel?.legalDescription||normalized.legalDescription||'',taxDistrict:next.parcel?.taxDistrict||normalized.taxDistrict||'',source:result.provider,checkedAt:String(result.retrievedAt||'').slice(0,10),gisUrl:result.sourceUrl||next.parcel?.gisUrl||'',gisAcreage:result.gisAcres,listingAcreage:number(next.acres)};next.fieldSources={...(next.fieldSources||{}),'parcel.parcelId':next.fieldSources?.['parcel.parcelId']||'county','parcelGeometry':'county'};
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
  const record={id:'happy',address:'2792 Happy Hollow Rd, Sevierville, TN 37862',lat:35.714339,lng:-83.682605,acres:45.76,parcel:{county:'Sevier',state:'TN'}},provider=PROVIDERS.sevierTn,features=parseResponse(fixtureResponse),result=resultForCandidates(record,provider,features,'2026-08-14T12:00:00.000Z'),homeResult=resultForCandidates({...record,beds:3,sqft:1457,propertyType:'existing-home-renovation'},provider,features,'2026-08-14T12:00:00.000Z'),merged=merge(record,result),mismatch=resultForCandidates({...record,acres:1.2},provider,features),manual=merge({...record,parcelGeometry:{type:'Polygon',coordinates:[[[-84,35],[-84,35.1],[-83.9,35.1],[-84,35]]]},parcel:{source:'User drawn'},parcelIntelligence:{state:STATES.userCorrected,source:'User drawn'}},result),failedRefresh=merge(merged,{success:false,state:STATES.addressPointOnly,retrievedAt:'2026-08-15T12:00:00.000Z',failure:{code:'provider-unavailable',message:'Fixture failure'}}),gpx=parseBoundaryText('boundary.gpx','<gpx><trk><trkseg><trkpt lat="35.71" lon="-83.68"/><trkpt lat="35.72" lon="-83.68"/><trkpt lat="35.72" lon="-83.67"/></trkseg></trk></gpx>'),checks={providerIsNoCredential:provider.noCredential===true&&provider.browserCors==='supported',verifiedMatch:result.success&&result.state.id==='verified-gis-parcel',acreageValidated:result.gisAcres===45.76&&result.validation.acreageDifferencePct===0,addressAndPointValidated:result.validation.addressMatch&&result.validation.pointInside,improvementsValidated:homeResult.validation.improvementsPlausible&&homeResult.validation.improvementValue>0,geometryStored:merged.parcelGeometry?.type==='Polygon',parcelIdStored:Boolean(merged.parcel.parcelId),mismatchRejected:!mismatch.success&&mismatch.failure.code==='parcel-validation-failed',manualCorrectionProtected:manual.parcelGeometry.coordinates[0][0][0]===-84&&manual.parcelIntelligence.state.id==='user-corrected',failedRefreshPreservesVerifiedParcel:failedRefresh.parcelGeometry?.type==='Polygon'&&failedRefresh.parcelIntelligence.state.id==='verified-gis-parcel'&&failedRefresh.parcelIntelligence.failure.code==='provider-unavailable',gpxBoundaryUsable:gpx.geometry.type==='Polygon'&&gpx.geometry.coordinates[0].length===4,andersonRoutesToCountyLayer:providerFor({address:'419 Duncan Ln, Andersonville, TN',parcel:{county:'Anderson',state:'TN'}})?.id===PROVIDERS.andersonTn.id,blountRoutesToCountyLayer:providerFor({address:'4348 Near Shore Dr, Maryville, TN',parcel:{county:'Blount',state:'TN'}})?.id===PROVIDERS.blountTn.id,monroeRoutesToStatewideLayer:providerFor({address:'464 Allen Rd, Tellico Plains, TN',parcel:{county:'Monroe',state:'TN'}})?.id===PROVIDERS.monroeStatewide.id,sweetwaterChecksBothCounties:providersFor({address:'1 Main St, Sweetwater, TN'}).some(item=>item.county==='Monroe')&&providersFor({address:'1 Main St, Sweetwater, TN'}).some(item=>item.county==='McMinn'),blockedOfficialStateSourceDocumented:BLOCKED_SOURCES.length===1};
  return {passed:Object.values(checks).every(Boolean),checks,result};
}
window.OTParcelIntelligence={VERSION,STATES,PROVIDERS,COUNTY_PROVIDERS,BLOCKED_SOURCES,providerFor,providersFor,buildQueryUrl,parseResponse,validateFeature,resultForCandidates,acquire,merge,combineFeatures,parseBoundaryText,pointInGeometry,parcelStatus,subdivisionLayout,runRegressionChecks};
})();
