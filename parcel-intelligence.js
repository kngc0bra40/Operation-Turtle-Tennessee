/* Provider-neutral parcel acquisition and validation. No startup writes. */
(()=>{
'use strict';
const VERSION='2.1.0';
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
const TN_PROPERTY_VIEWER_ENDPOINT='https://services1.arcgis.com/YuVBSS7Y1of2Qud1/ArcGIS/rest/services/Tennessee_Property_Boundaries_Public_Use/FeatureServer/0/query';
const statewideProvider=(county,layer,addressField)=>({
  id:`tn-statewide-${county.toLowerCase()}-parcels`,
  name:`Tennessee statewide parcel layer / ${county} County`,
  authority:'Tennessee county parcel data mirror hosted in ArcGIS Online',
  endpoint:`${ARCGIS_ROOT}/${layer}/query`,
  browserCors:'supported',noCredential:true,county,state:'TN',tier:'statewide-fallback',
  fields:{address:[addressField],parcelId:[`Assessment_Data_${addressField.match(/_(\d+)_/)?.[1]||''}_PARCELID`,'Parcels_GISLINK2','Parcels_GISLINK']}
});
const PROVIDERS=Object.freeze({
  tnPropertyViewer:Object.freeze({
    id:'tn-property-viewer-statewide-parcels',
    name:'Tennessee Property Viewer statewide parcel boundaries',
    authority:'Tennessee Comptroller of the Treasury',
    endpoint:TN_PROPERTY_VIEWER_ENDPOINT,
    browserCors:'supported',
    noCredential:true,state:'TN',tier:'official-state-primary',addressOrder:'road-house',
    fields:{address:['ADDRESS'],parcelId:['PARCELID','GISLINK']},countyField:'COUNTY_NAME'
  }),
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
const number=value=>value===null||value===undefined||value===''?null:finite(value)?Number(value):null;
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
  if(value?.type==='FeatureCollection'){
    const polygons=(value.features||[]).map(normalizeGeometry).filter(Boolean).flatMap(geometry=>geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates);
    return polygons.length===1?{type:'Polygon',coordinates:polygons[0]}:polygons.length?{type:'MultiPolygon',coordinates:polygons}:null;
  }
  let geometry=value?.type==='Feature'?value.geometry:value;
  if(geometry?.rings)geometry={type:'Polygon',coordinates:geometry.rings};
  if(!['Polygon','MultiPolygon'].includes(geometry?.type)||!Array.isArray(geometry.coordinates))return null;
  const source=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates,polygons=[];
  for(const polygon of source){
    if(!Array.isArray(polygon)||!polygon.length)return null;
    const rings=polygon.map(closeRing);
    if(rings.some(ring=>ring.length<4||!coordinatesAreUs(ring)))return null;
    polygons.push(rings);
  }
  return geometry.type==='Polygon'?{type:'Polygon',coordinates:polygons[0]}:{type:'MultiPolygon',coordinates:polygons};
}
function coordinatesAreUs(value){if(!Array.isArray(value))return false;if(value.length===2&&finite(value[0])&&finite(value[1]))return Number(value[1])>=18&&Number(value[1])<=72&&Number(value[0])>=-180&&Number(value[0])<=-66;return value.length>0&&value.every(coordinatesAreUs)}
function featureProperties(feature={}){return feature.properties||feature.attributes||{}}
function fieldValue(properties={},candidates=[]){
  const entries=Object.entries(properties),wanted=candidates.map(value=>String(value).toUpperCase());
  for(const candidate of wanted){const exact=entries.find(([key])=>key.toUpperCase()===candidate);if(exact&&exact[1]!==null&&exact[1]!==undefined&&exact[1]!=='')return exact[1]}
  for(const candidate of wanted){const suffixed=entries.find(([key])=>key.toUpperCase().endsWith(`_${candidate}`));if(suffixed&&suffixed[1]!==null&&suffixed[1]!==undefined&&suffixed[1]!=='')return suffixed[1]}
  return null;
}
function reportedFeatureAcreage(feature={}){
  const p=featureProperties(feature);
  for(const key of ['DEEDAC','CAMACALCAC','CALCAC','CALC_ACRE','GIS_ACRES','ACRES','ACREAGE','LANDUNITS']){const value=number(fieldValue(p,[key]));if(value&&value>0)return value}
  return null;
}
function featureAcreage(feature={}){
  const reported=reportedFeatureAcreage(feature);if(reported)return reported;
  const mapped=geometryAreaAcres(feature);
  return mapped>0?Number(mapped.toFixed(3)):null;
}
function mappedFeatureAcreage(feature={}){const area=geometryAreaAcres(feature);return area>0?Number(area.toFixed(3)):featureAcreage(feature)}
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
function normalizedFeature(feature={}){const p=featureProperties(feature);return {parcelId:featureParcelId(feature),situsAddress:featureAddress(feature),owner:featureOwner(feature),ownerMailingAddress:[fieldValue(p,['MAILADDR','MAIL_ADDRESS']),fieldValue(p,['MAILCITY','MAIL_CITY']),fieldValue(p,['MAILSTATE','STATE']),fieldValue(p,['MAILZIP','ZIP'])].filter(Boolean).join(', '),gisAcreage:featureAcreage(feature),landValue:number(fieldValue(p,['LANDMKTVAL','LANDVAL','LAND_VALUE'])),improvementValue:number(fieldValue(p,['IMPVAL','IMPROVEMENT_VALUE','BLDGVAL'])),legalDescription:String(fieldValue(p,['LEGALDESC','LEGAL_DESCRIPTION','DEEDBKPG'])||''),taxDistrict:String(fieldValue(p,['DISTRICT','TAXDISTRICT','TAX_DISTRICT'])||''),propertyViewerUrl:String(fieldValue(p,['LINK_TPV'])||''),assessmentUrl:String(fieldValue(p,['LINK_TPAD'])||'')}}
function geometryBounds(geometry){const normalized=normalizeGeometry(geometry),pairs=normalized?.type==='Polygon'?normalized.coordinates.flat(1):normalized?.type==='MultiPolygon'?normalized.coordinates.flat(2):[];if(!pairs.length)return null;return {minLng:Math.min(...pairs.map(pair=>Number(pair[0]))),maxLng:Math.max(...pairs.map(pair=>Number(pair[0]))),minLat:Math.min(...pairs.map(pair=>Number(pair[1]))),maxLat:Math.max(...pairs.map(pair=>Number(pair[1])))} }
function haversineMeters(a,b){const rad=value=>Number(value)*Math.PI/180,dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function distanceToGeometry(point,geometry){if(pointInGeometry(point,geometry))return 0;const bounds=geometryBounds(geometry);if(!bounds)return Infinity;const nearest={lat:Math.max(bounds.minLat,Math.min(bounds.maxLat,Number(point.lat))),lng:Math.max(bounds.minLng,Math.min(bounds.maxLng,Number(point.lng)))};return haversineMeters(point,nearest)}
function boundsGapMeters(first,second){const a=geometryBounds(first),b=geometryBounds(second);if(!a||!b)return Infinity;const lat=Math.max(a.minLat,Math.min(a.maxLat,(b.minLat+b.maxLat)/2)),lng=Math.max(a.minLng,Math.min(a.maxLng,(b.minLng+b.maxLng)/2)),other={lat:Math.max(b.minLat,Math.min(b.maxLat,lat)),lng:Math.max(b.minLng,Math.min(b.maxLng,lng))};return haversineMeters({lat,lng},other)}
function closeRing(value=[]){const ring=value.map(pair=>[Number(pair[0]),Number(pair[1])]).filter(pair=>finite(pair[0])&&finite(pair[1]));if(ring.length<3)return [];const first=ring[0],last=ring.at(-1);if(first[0]!==last[0]||first[1]!==last[1])ring.push([...first]);return ring}
function ringAreaAcres(value=[]){const ring=closeRing(value);if(ring.length<4)return 0;const lat0=ring.reduce((sum,pair)=>sum+pair[1],0)/ring.length*Math.PI/180,xy=ring.map(pair=>({x:pair[0]*111320*Math.cos(lat0),y:pair[1]*110540}));let area=0;for(let index=0,prior=xy.length-1;index<xy.length;prior=index++)area+=xy[prior].x*xy[index].y-xy[index].x*xy[prior].y;return Math.abs(area/2)/4046.8564224}
function geometryAreaAcres(value){const geometry=normalizeGeometry(value);if(!geometry)return 0;const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;return polygons.reduce((sum,polygon)=>sum+Math.max(0,ringAreaAcres(polygon[0])-polygon.slice(1).reduce((holes,ring)=>holes+ringAreaAcres(ring),0)),0)}
function validateFeature(feature={},record={}){
  const geometry=normalizeGeometry(feature),listingAcres=number(record.acres),gisAcres=featureAcreage(feature),point={lat:record.lat,lng:record.lng},pointInside=pointInGeometry(point,geometry),proximityMeters=distanceToGeometry(point,geometry),similarity=addressSimilarity(record.address,featureAddress(feature)),addressMatch=similarity.plausible,parcelId=featureParcelId(feature),knownParcelId=record.parcel?.rawParcelId||record.parcel?.parcelId||record.parcelNumber||record.parcelIntelligence?.rawParcelId||record.parcelIntelligence?.parcelIds?.[0]||'',knownNormalized=normalizedParcelId(knownParcelId),featureIds=['PARCELID','PARID','GISLINK2','GISLINK','PARCEL_ID'].map(field=>normalizedParcelId(fieldValue(featureProperties(feature),[field])||'')).filter(Boolean),knownParcelIdMatch=Boolean(knownNormalized&&featureIds.some(value=>value===knownNormalized||(knownNormalized.length>=8&&value.startsWith(knownNormalized)))),parcelIdPlausible=/\d{3,}/.test(parcelId.replace(/\D/g,'')),acreageDifferencePct=listingAcres&&gisAcres?Math.abs(gisAcres-listingAcres)/listingAcres*100:null,acreageMatch=acreageDifferencePct===null||acreageDifferencePct<=25,profile=record.propertyIntelligence?.propertyProfile||{},existingHomeClaim=Number(record.beds)>0||Number(record.sqft)>0||/existing|livable|renovation|cabin|dwelling|home/i.test(`${record.propertyType||''} ${profile.residenceStatus||''}`),improvementValue=normalizedFeature(feature).improvementValue,improvementsPlausible=!existingHomeClaim||improvementValue===null||improvementValue>0,issues=[];
  if(!pointInside)issues.push('The located address point is outside this polygon.');
  if(similarity.addressAvailable&&!addressMatch)issues.push('The GIS situs address does not reasonably match the saved address.');
  if(!similarity.addressAvailable)issues.push('The GIS record does not include a usable situs address; coordinate and acreage evidence carry the match.');
  if(!acreageMatch)issues.push(`GIS acreage ${gisAcres?.toFixed?.(2)||'unknown'} does not reasonably match listing acreage ${listingAcres?.toFixed?.(2)||'unknown'}.`);
  if(!parcelIdPlausible)issues.push('A plausible parcel identifier was not returned.');
  if(!improvementsPlausible)issues.push('The listing claims an existing dwelling, but this GIS record does not show a positive improvement value. Review the match.');
  const score=Math.min(100,(knownParcelIdMatch?35:0)+(pointInside?35:proximityMeters<=150?8:0)+(similarity.strong?20:addressMatch?12:0)+(acreageMatch?15:0)+(parcelIdPlausible?5:0)+(improvementsPlausible?5:0)),verified=((knownParcelIdMatch&&(pointInside||similarity.strong))||(pointInside&&addressMatch))&&acreageMatch&&parcelIdPlausible&&improvementsPlausible,matched=verified||(acreageMatch&&parcelIdPlausible&&(pointInside||knownParcelIdMatch||(similarity.strong&&proximityMeters<=150)));
  return {feature,geometry,normalized:normalizedFeature(feature),parcelId,gisAcres,listingAcres,acreageDifferencePct:acreageDifferencePct===null?null:Number(acreageDifferencePct.toFixed(1)),pointInside,proximityMeters:Number.isFinite(proximityMeters)?Math.round(proximityMeters):null,addressMatch,addressSimilarity:similarity.streetRatio,houseNumberMatch:similarity.houseNumberMatch,knownParcelIdMatch,acreageMatch,parcelIdPlausible,improvementsPlausible,improvementValue,score,verified,matched,methods:[...new Set(feature._otMethods||[])],issues};
}
function knownParcelId(record={}){return String(record.parcel?.rawParcelId||record.parcel?.parcelId||record.parcelNumber||record.parcelIntelligence?.rawParcelId||record.parcelIntelligence?.parcelIds?.[0]||'').trim()}
function tennesseeParcelIdParts(value=''){const tokens=String(value).toUpperCase().match(/[A-Z0-9]+/g)||[];if(tokens.length<3||!/^\d{3}$/.test(tokens[0])||!/^\d{1,4}$/.test(tokens[1]))return null;let parcel=tokens[2];for(let index=3;index<tokens.length&&parcel.length<5;index++)parcel+=tokens[index];if(!/^\d{3,7}$/.test(parcel))return null;const county=tokens[0],map=tokens[1].padStart(3,'0'),parcelNumber=parcel.padStart(5,'0');return {county,map,parcelNumber,gisLink:`${county}${map}    ${parcelNumber}`,parcelPrefix:`${county} ${map}    ${parcelNumber}`}}
function countyClause(provider={}){const county=String(provider.county||'').replace(/\s+County$/i,'').replace(/'/g,"''");return provider.countyField&&county?`${provider.countyField} = '${county}'`:''}
function withCounty(where,provider={}){const county=countyClause(provider);return county&&where?`${county} AND (${where})`:county||where}
function addressWhere(record={},provider={}){const parts=addressParts(record.address),tokens=parts.tokens.filter(token=>!/\d/.test(token)).slice(0,4);if(!tokens.length)return '';const upper=tokens.map(token=>token.toUpperCase()),patterns=[`%${[parts.streetNumber,...upper].filter(Boolean).join('%')}%`];if(provider.addressOrder==='road-house'&&parts.streetNumber)patterns.unshift(`%${[...upper,parts.streetNumber].join('%')}%`);const fields=provider.fields?.address||[],where=fields.flatMap(field=>patterns.map(pattern=>`${field} LIKE '${pattern.replace(/'/g,"''")}'`)).join(' OR ');return withCounty(where,provider)}
function idWhere(record={},provider={}){const raw=knownParcelId(record),value=raw.replace(/'/g,"''"),parts=provider.id===PROVIDERS.tnPropertyViewer.id?tennesseeParcelIdParts(raw):null,tokens=raw.toUpperCase().match(/[A-Z0-9]+/g)||[],pattern=tokens.length?`%${tokens.join('%')}%`:'';if(!value)return '';let clauses=(provider.fields?.parcelId||[]).map(field=>`${field} = '${value}'`);if(parts)clauses.push(`GISLINK = '${parts.gisLink}'`,`PARCELID LIKE '${parts.parcelPrefix}%'`);else clauses.push(...(provider.fields?.parcelId||[]).map(field=>pattern&&`${field} LIKE '${pattern.replace(/'/g,"''")}'`).filter(Boolean));return withCounty([...new Set(clauses)].join(' OR '),provider)}
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
function isTennesseeRecord(record={}){return /(?:\bTN\b|Tennessee)/i.test(`${record.parcel?.state||record.state||''} ${record.address||''}`)}
function providerCountyName(key='',record={}){const explicit=String(record.parcel?.county||record.county||'').replace(/\s+County$/i,'').trim();return explicit||key?String(explicit||key).replace(/\b\w/g,char=>char.toUpperCase()):''}
function providersFor(record={}){const counties=inferredCounties(record),official=isTennesseeRecord(record)?(counties.length?counties:[null]).map(county=>({...PROVIDERS.tnPropertyViewer,county:providerCountyName(county||'',record)})):[],fallback=counties.flatMap(county=>COUNTY_PROVIDERS[county]||[]);return [...official,...fallback]}
function providerFor(record={}){return providersFor(record)[0]||null}
function parseResponse(payload={}){
  const value=typeof payload==='string'?JSON.parse(payload):payload;
  if(value?.error)throw Object.assign(new Error(value.error.message||'The parcel service returned an error.'),{code:'provider-error'});
  return Array.isArray(value?.features)?value.features.map(feature=>feature?.attributes?{type:'Feature',properties:feature.attributes,geometry:normalizeGeometry(feature.geometry)}:feature).filter(feature=>normalizeGeometry(feature)):[];
}
function featureKey(feature){return `${normalizedParcelId(featureParcelId(feature))}:${JSON.stringify(normalizeGeometry(feature)?.coordinates?.[0]?.[0]||'').slice(0,80)}`}
function mergeCandidateFeatures(collection=[],incoming=[],method='unknown'){const map=new Map(collection.map(feature=>[featureKey(feature),feature]));incoming.forEach(raw=>{const key=featureKey(raw),existing=map.get(key);if(existing)existing._otMethods=[...new Set([...(existing._otMethods||[]),method])];else{raw._otMethods=[method];map.set(key,raw)}});return [...map.values()]}
function multiParcelSuggestion(best,candidates,record){
  if(!best?.pointInside||!best.listingAcres||!best.gisAcres||best.gisAcres>=best.listingAcres*.8)return null;
  const owner=compact(featureOwner(best.feature)),listingText=`${record.listingDescription||''} ${record.notes||''} ${record.propertyIntelligence?.zillowLand?.description||''}`,listingSignals=/\b(?:two|2|multiple|several)\s+(?:tracts?|lots?|parcels?)\b|\b(?:tracts?|lots?|parcels?)\s+(?:included|convey|together)\b/i.test(listingText),parcelPrefix=normalizedParcelId(best.parcelId).slice(0,6);
  const useMappedSet=!reportedFeatureAcreage(best.feature),bestMapped=useMappedSet?mappedFeatureAcreage(best.feature):best.gisAcres,ranked=candidates.filter(candidate=>candidate!==best&&candidate.gisAcres).map(candidate=>{
    const candidateMapped=useMappedSet?mappedFeatureAcreage(candidate.feature):candidate.gisAcres,gapMeters=boundsGapMeters(best.geometry,candidate.geometry),sameOwner=Boolean(owner&&compact(featureOwner(candidate.feature))===owner),combinedAcres=bestMapped+candidateMapped,acreageDifferencePct=Math.abs(combinedAcres-best.listingAcres)/best.listingAcres*100,idRelated=Boolean(parcelPrefix&&normalizedParcelId(candidate.parcelId).startsWith(parcelPrefix)),roadRelated=addressParts(best.normalized?.situsAddress).tokens.some(token=>addressParts(candidate.normalized?.situsAddress).tokens.includes(token)),score=(gapMeters<=8?35:gapMeters<=35?28:gapMeters<=80?12:0)+(sameOwner?35:0)+Math.max(0,25-acreageDifferencePct)+(idRelated?5:0)+(roadRelated?5:0)+(listingSignals?8:0);
    return {candidate,mappedAcres:candidateMapped,gapMeters:Number(gapMeters.toFixed(1)),sameOwner,combinedAcres:Number(combinedAcres.toFixed(2)),acreageDifferencePct:Number(acreageDifferencePct.toFixed(1)),idRelated,roadRelated,score:Number(score.toFixed(1))};
  }).filter(item=>item.gapMeters<=250&&(item.sameOwner||listingSignals&&item.acreageDifferencePct<=20)).sort((a,b)=>b.score-a.score);
  const selected=[best],rankedEvidence=[];let total=bestMapped;
  for(const item of ranked){if(!selected.some(candidate=>boundsGapMeters(candidate.geometry,item.candidate.geometry)<=35))continue;selected.push(item.candidate);rankedEvidence.push(item);total+=item.mappedAcres;if(Math.abs(total-best.listingAcres)/best.listingAcres<=.12)break}
  if(selected.length<2)return {label:'Possible Multi-Parcel Property',parcelIds:[best.parcelId].filter(Boolean),gisAcres:Number(best.gisAcres.toFixed(2)),listingAcres:best.listingAcres,combined:false,listingSignals};
  const differencePct=Math.abs(total-best.listingAcres)/best.listingAcres*100,parcels=selected.map(item=>({parcelId:item.parcelId,acres:Number((useMappedSet?mappedFeatureAcreage(item.feature):item.gisAcres).toFixed(2)),reportedAcres:reportedFeatureAcreage(item.feature),geometry:clone(item.geometry),properties:clone(item.normalized||{})}));
  return {label:'Possible Multi-Parcel Property',parcelIds:parcels.map(item=>item.parcelId).filter(Boolean),parcels,gisAcres:Number(total.toFixed(2)),listingAcres:best.listingAcres,acreageDifferencePct:Number(differencePct.toFixed(1)),combined:differencePct<=20,ownerMatched:rankedEvidence.every(item=>item.sameOwner),listingSignals,count:parcels.length,confidence:differencePct<=10&&rankedEvidence.every(item=>item.sameOwner)?'high':'review',ranking:rankedEvidence.map(item=>({parcelId:item.candidate.parcelId,adjacencyMeters:item.gapMeters,sameOwner:item.sameOwner,combinedAcres:item.combinedAcres,acreageDifferencePct:item.acreageDifferencePct,idRelated:item.idRelated,roadRelated:item.roadRelated,score:item.score}))};
}
function resultForCandidates(record,provider,features,retrievedAt=now(),attempts=[]){
  const candidates=features.map(feature=>validateFeature(feature,record)).sort((a,b)=>b.score-a.score),best=candidates[0];
  const common={provider:provider.name,providerId:provider.id,providerTier:provider.tier,county:provider.county,sourceUrl:provider.endpoint,retrievedAt,attempts};
  if(!best)return {success:false,state:STATES.noParcelMatch,...common,candidates:[],failure:{code:'no-parcel-match',message:'The configured public parcel sources responded, but no address, containing, or nearby parcel candidate was returned.',retryable:true}};
  const multiParcel=multiParcelSuggestion(best,candidates,record),candidateSummaries=candidates.map(candidate=>({parcelId:candidate.parcelId,gisAcres:candidate.gisAcres||Number(geometryAreaAcres(candidate.geometry).toFixed(2)),score:candidate.score,pointInside:candidate.pointInside,proximityMeters:candidate.proximityMeters,methods:candidate.methods,issues:candidate.issues,geometry:clone(candidate.geometry),normalized:clone(candidate.normalized)}));
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
  if((!finite(record.lat)||!finite(record.lng))&&!knownParcelId(record))return {success:false,state:STATES.addressPointOnly,retrievedAt,failure:{code:'coordinates-missing',message:'A reasonably matched address point or Parcel ID is required before parcel lookup.',retryable:false}};
  if(!configured.length)return {success:false,state:STATES.noParcelMatch,retrievedAt,attempts:[],failure:{code:'provider-unavailable',message:'No browser-compatible automatic parcel provider is configured for this county. Use the parcel-file or drawing fallback.',retryable:false}};
  const allAttempts=[];let bestReview=null;
  for(const provider of configured){const fixture=options.fixtureResponses?.[provider.id]??options.fixtureResponse,result=await queryProvider(record,provider,{fetchImpl:options.fetchImpl,fixtureResponse:fixture});allAttempts.push(...(result.attempts||[]));if(result.success)return {...result,attempts:allAttempts};if(result.candidates?.length&&!bestReview)bestReview=result}
  if(bestReview)return {...bestReview,attempts:allAttempts};
  const responded=allAttempts.some(attempt=>attempt.responded),failures=allAttempts.filter(attempt=>attempt.errorCode);
  return {success:false,state:STATES.noParcelMatch,retrievedAt,attempts:allAttempts,provider:configured.map(provider=>provider.name).join('; '),providerId:configured.map(provider=>provider.id).join(','),county:configured[0].county,failure:{code:responded?'no-parcel-match':failures.some(attempt=>attempt.errorCode==='provider-http')?'provider-http':'cors-or-network',message:responded?'Public parcel sources responded, but no address, containing, or nearby parcel candidate was found.':'All configured public parcel sources were unavailable in the browser. Review diagnostics or use the parcel-file/drawing fallback.',retryable:true}};
}
async function lookupByParcelId(record={},rawParcelId='',options={}){const raw=String(rawParcelId||'').trim();if(!raw)return {success:false,state:STATES.reviewRequired,retrievedAt:now(),failure:{code:'parcel-id-missing',message:'Enter the Parcel ID exactly as shown by the assessor or Tennessee Property Viewer.',retryable:false}};const candidate={...clone(record),parcel:{...(record.parcel||{}),rawParcelId:raw},parcelIntelligence:{...(record.parcelIntelligence||{}),rawParcelId:raw}};const result=await acquire(candidate,options);return {...result,rawParcelId:raw,normalizedParcelId:normalizedParcelId(raw)} }
function isUserCorrected(record={}){const state=record.parcelIntelligence?.state?.id||record.parcelIntelligence?.state;return state===STATES.userCorrected.id||state===STATES.multiParcel.id&&Boolean(record.parcelIntelligence?.confirmedAt||record.parcelIntelligence?.validation?.userConfirmed)||/user|manual|drawn|corrected/i.test(`${record.parcel?.source||''} ${record.parcelIntelligence?.source||''}`)}
function subdivisionLayout(record={}){
  const usable=getUsablePropertyGeometry(record),status=parcelStatus(record),geometry=usable.geometry,acres=number(usable.acreage||record.acres),land=record.propertyIntelligence?.zillowLand||{},parcelCount=Math.max(usable.constituentParcelIds?.length||0,record.parcelIntelligence?.parcels?.length||0,geometry?.type==='MultiPolygon'?geometry.coordinates.length:geometry?1:0),existingLegalParcels=parcelCount>1,explicitNoAccess=/landlocked|no legal access/i.test(`${record.notes||''} ${record.parcel?.notes||''}`);
  if(explicitNoAccess)return {classification:'Difficult',physicalOnly:true,reasons:['Saved facts identify a landlocked or no-access condition.'],unknown:['Legal subdivisibility','surveyed access and frontage']};
  if(!geometry||!['verified-gis-parcel','user-corrected','multi-parcel-property'].includes(status.id))return {classification:'Unknown',physicalOnly:true,reasons:[],unknown:['Verified parcel geometry','road frontage','house position','legal subdivisibility']};
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates,rings=polygons.map(polygon=>polygon[0]).filter(Boolean),points=rings.flat(),minLat=Math.min(...points.map(pair=>Number(pair[1]))),maxLat=Math.max(...points.map(pair=>Number(pair[1]))),minLng=Math.min(...points.map(pair=>Number(pair[0]))),maxLng=Math.max(...points.map(pair=>Number(pair[0]))),latSpan=maxLat-minLat||1,lngSpan=maxLng-minLng||1,houseInside=pointInGeometry({lat:record.lat,lng:record.lng},geometry),edgeRatio=houseInside?Math.min((Number(record.lat)-minLat)/latSpan,(maxLat-Number(record.lat))/latSpan,(Number(record.lng)-minLng)/lngSpan,(maxLng-Number(record.lng))/lngSpan):null,houseNearEdge=edgeRatio!==null&&edgeRatio<=.28,frontage=land.roadFrontage==='yes'||/road frontage/i.test(`${record.listingDescription||''} ${record.parcel?.notes||''}`),largeEnough=acres>=20;
  const reasons=[existingLegalParcels&&`${parcelCount} separate parcel identities are already represented`,largeEnough&&`${acres.toFixed(1)} acres provide physical layout flexibility`,houseNearEdge&&'The existing-home point lies toward a parcel edge',frontage&&'Road frontage is claimed in saved listing evidence'].filter(Boolean),classification=existingLegalParcels?'Promising':largeEnough&&houseNearEdge&&frontage?'Promising':largeEnough&&(houseNearEdge||frontage)?'Possible':largeEnough?'Possible':'Unknown';
  return {classification,physicalOnly:true,reasons,unknown:['Whether every parcel conveys with the listing','minimum lot standards','surveyed frontage and access','septic feasibility'],houseInside,houseNearEdge,roadFrontageClaim:frontage,acreage:acres,parcelCount,existingLegalParcels,note:'Existing parcel identity improves physical flexibility, but this is not a legal subdivision determination; title, conveyance, access, and development rights still require verification.'};
}
function merge(record={},result={}){
  const next=clone(record),protectedGeometry=isUserCorrected(next),existing=next.parcelIntelligence||{},successful=Boolean(result.success),state=protectedGeometry?STATES.userCorrected:successful?(result.state||STATES.parcelMatch):(existing.state||result.state||STATES.addressPointOnly);
  const rawParcelId=String(result.rawParcelId||existing.rawParcelId||next.parcel?.rawParcelId||'').trim(),evidence=rawParcelId?[...(existing.parcelIdEvidence||[]).filter(item=>item?.raw!==rawParcelId),{raw:rawParcelId,normalized:normalizedParcelId(rawParcelId),resolved:result.parcelId||'',provider:result.provider||'',checkedAt:result.retrievedAt||now()}].slice(-5):(existing.parcelIdEvidence||[]);
  next.parcelIntelligence={...existing,state,county:result.county||existing.county||next.parcel?.county||'',provider:successful?(result.provider||existing.provider||''):(existing.provider||result.provider||''),providerId:successful?(result.providerId||existing.providerId||''):(existing.providerId||result.providerId||''),providerTier:successful?(result.providerTier||existing.providerTier||''):(existing.providerTier||result.providerTier||''),matchMethod:successful?(result.matchMethod||existing.matchMethod||''):(existing.matchMethod||''),listingAcreage:number(next.acres),gisAcreage:successful?(result.gisAcres??existing.gisAcreage??null):(existing.gisAcreage??null),parcelIds:successful?(result.parcelIds||[result.parcelId].filter(Boolean)):(existing.parcelIds||[]),rawParcelId,parcelIdEvidence:evidence,normalized:successful?(result.normalized||existing.normalized||null):(existing.normalized||null),validation:successful?(result.validation||existing.validation||null):(existing.validation||null),attempts:Array.isArray(result.attempts)?clone(result.attempts):(existing.attempts||[]),possibleMultiParcel:!!result.possibleMultiParcel||!!existing.possibleMultiParcel,multiParcelSuggestion:result.multiParcelSuggestion||existing.multiParcelSuggestion||null,acquiredAt:successful?(result.retrievedAt||existing.acquiredAt||''):(existing.acquiredAt||''),lastAttemptAt:result.retrievedAt||now(),failure:result.failure||null,sourceUrl:successful?(result.sourceUrl||existing.sourceUrl||''):(existing.sourceUrl||result.sourceUrl||'')};
  if(result.success&&!protectedGeometry){
    const normalized=result.normalized||{};next.parcelGeometry=clone(result.geometry);next.parcel={...(next.parcel||{}),county:next.parcel?.county||result.county||'',parcelId:next.parcel?.parcelId||result.parcelId||'',rawParcelId:rawParcelId||next.parcel?.rawParcelId||'',situsAddress:next.parcel?.situsAddress||normalized.situsAddress||'',owner:next.parcel?.owner||normalized.owner||'',ownerMailingAddress:next.parcel?.ownerMailingAddress||normalized.ownerMailingAddress||'',landValue:next.parcel?.landValue??normalized.landValue??null,improvementValue:next.parcel?.improvementValue??normalized.improvementValue??null,legalDescription:next.parcel?.legalDescription||normalized.legalDescription||'',taxDistrict:next.parcel?.taxDistrict||normalized.taxDistrict||'',source:result.provider,checkedAt:String(result.retrievedAt||'').slice(0,10),gisUrl:result.sourceUrl||next.parcel?.gisUrl||'',propertyViewerUrl:normalized.propertyViewerUrl||next.parcel?.propertyViewerUrl||'',recordUrl:normalized.assessmentUrl||next.parcel?.recordUrl||'',gisAcreage:result.gisAcres,listingAcreage:number(next.acres)};next.fieldSources={...(next.fieldSources||{}),'parcel.parcelId':next.fieldSources?.['parcel.parcelId']||'county','parcelGeometry':'county'};
  }
  next.parcelIntelligence.subdivisionLayout=subdivisionLayout(next);
  return next;
}
function combineFeatures(features=[],metadata={}){
  const valid=features.map((feature,index)=>{const geometry=normalizeGeometry(feature);return {geometry,parcelId:featureParcelId(feature)||`parcel-${index+1}`,acres:featureAcreage(feature)||geometryAreaAcres(geometry),properties:clone(featureProperties(feature))}}).filter(item=>item.geometry),polygons=[];
  valid.forEach(item=>{if(item.geometry.type==='Polygon')polygons.push(item.geometry.coordinates);else polygons.push(...item.geometry.coordinates)});
  if(!polygons.length)return null;
  const geometry=polygons.length===1?{type:'Polygon',coordinates:polygons[0]}:{type:'MultiPolygon',coordinates:polygons};
  return {geometry,state:valid.length>1?STATES.multiParcel:STATES.userCorrected,parcelIds:valid.map(item=>item.parcelId).filter(Boolean),parcels:valid.map(item=>({parcelId:item.parcelId,acres:Number(item.acres.toFixed(2)),geometry:clone(item.geometry),properties:item.properties})),gisAcres:Number(valid.reduce((sum,item)=>sum+(item.acres||0),0).toFixed(2))||null,source:metadata.source||'User-selected public GIS parcels',confirmedAt:metadata.confirmedAt||now()};
}
function getUsablePropertyGeometry(record={}){
  const intelligence=record.parcelIntelligence||{},state=String(intelligence.state?.id||intelligence.state||'').toLowerCase(),source=String(intelligence.source||record.parcel?.source||record.fieldSources?.parcelGeometry||''),confirmed=Boolean(intelligence.confirmedAt||intelligence.validation?.userConfirmed),verifiedState=state===STATES.verifiedGisParcel.id,userState=['user-confirmed-parcel',STATES.userCorrected.id,'confirmed-manual-boundary','confirmed-imported-boundary'].includes(state),legacyConfirmed=!state&&confirmed&&/user|manual|drawn|imported|corrected/i.test(source);
  const storedCandidates=[record.parcelGeometry,intelligence.combinedGeometry,intelligence.geometry,record.parcel?.geometry].filter(value=>value!==null&&value!==undefined),individual=(Array.isArray(intelligence.parcels)?intelligence.parcels:[]).map((item,index)=>({geometry:normalizeGeometry(item?.geometry||item),parcelId:String(item?.parcelId||intelligence.parcelIds?.[index]||'').trim()})).filter(item=>item.geometry),storedGeometry=storedCandidates.map(normalizeGeometry).find(Boolean)||null;
  /* Older confirmed multi-parcel records did not always include confirmedAt or
     validation.userConfirmed. Persisted constituent polygons under the final
     multi-parcel state are confirmation evidence; proposals retain
     needsConfirmation and remain ineligible. */
  const multiState=state===STATES.multiParcel.id&&individual.length>1&&intelligence.needsConfirmation!==true&&(confirmed||Array.isArray(intelligence.parcels)),eligible=verifiedState||userState||multiState||legacyConfirmed;
  let geometry=null;
  if(eligible&&state===STATES.multiParcel.id&&individual.length>1){const polygons=[];individual.forEach(item=>{if(item.geometry.type==='Polygon')polygons.push(item.geometry.coordinates);else polygons.push(...item.geometry.coordinates)});geometry=polygons.length===1?{type:'Polygon',coordinates:polygons[0]}:{type:'MultiPolygon',coordinates:polygons}}
  if(!geometry&&eligible)geometry=storedGeometry;
  if(!geometry&&eligible&&Array.isArray(record.boundary)&&record.boundary.length>=3){const ring=closeRing(record.boundary.map(item=>Array.isArray(item)?item:[item?.lng,item?.lat]));geometry=ring.length>=4&&coordinatesAreUs(ring)?{type:'Polygon',coordinates:[ring]}:null}
  const invalid=storedCandidates.length>0&&!storedGeometry||individual.length>0&&state===STATES.multiParcel.id&&individual.length<2,reason=!eligible?{code:storedCandidates.length||individual.length?'parcel-unconfirmed':'geometry-missing',message:storedCandidates.length||individual.length?'The saved parcel boundary still requires confirmation before parcel-wide analysis.':'A confirmed parcel boundary is required before parcel-wide analysis.'}:!geometry?{code:invalid?'geometry-invalid':'geometry-missing',message:invalid?'The confirmed parcel boundary is not a valid U.S. Polygon or MultiPolygon.':'The confirmed parcel boundary geometry is missing.'}:null,parcelIds=[...new Set([...(intelligence.parcelIds||[]),...individual.map(item=>item.parcelId),record.parcel?.parcelId].map(value=>String(value||'').trim()).filter(Boolean))],acreage=Number(intelligence.gisAcreage||record.parcel?.gisAcreage)||geometryAreaAcres(geometry)||Number(record.acres)||null;
  return {usable:Boolean(geometry),geometry:geometry?clone(geometry):null,source:source||[verifiedState?'Verified public GIS parcel':userState||multiState||legacyConfirmed?'User-confirmed property boundary':''].find(Boolean)||'',confidence:String(intelligence.confidence||(verifiedState?'verified-gis-parcel':multiState?'user-confirmed-multi-parcel':userState||legacyConfirmed?'user-confirmed':'unconfirmed')),status:state||null,constituentParcelIds:parcelIds,acreage:acreage?Number(Number(acreage).toFixed(3)):null,reason};
}
function parseBoundaryText(fileName='',text=''){
  const name=String(fileName).toLowerCase();
  if(/\.(?:geojson|json)$/.test(name)){
    const parsed=JSON.parse(text),features=parsed?.type==='FeatureCollection'?parsed.features:parsed?.type==='Feature'?[parsed]:[{type:'Feature',geometry:parsed,properties:{}}],combined=combineFeatures(features,{source:'User-imported GeoJSON'});
    if(!combined)throw new Error('The file did not contain a Polygon or MultiPolygon.');
    return {...combined,state:combined.parcels.length>1?STATES.multiParcel:STATES.userCorrected,source:'User-imported GeoJSON',confidence:'coordinate-file-awaiting-confirmation',needsConfirmation:true};
  }
  if(/\.(?:kml|gpx)$/.test(name)){
    const rings=[];
    if(name.endsWith('.gpx'))for(const block of String(text).matchAll(/<(?:trkseg|rte)\b[^>]*>([\s\S]*?)<\/(?:trkseg|rte)>/gi)){const coordinates=[];for(const match of block[1].matchAll(/<(?:trkpt|rtept)\b[^>]*\blat=["']([^"']+)["'][^>]*\blon=["']([^"']+)["'][^>]*>/gi)){const lat=Number(match[1]),lng=Number(match[2]);if(finite(lat)&&finite(lng))coordinates.push([lng,lat])}if(coordinates.length>=4&&haversineMeters({lat:coordinates[0][1],lng:coordinates[0][0]},{lat:coordinates.at(-1)[1],lng:coordinates.at(-1)[0]})<=40)rings.push(closeRing(coordinates))}
    else for(const match of String(text).matchAll(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi)){const coordinates=[];for(const pair of match[1].trim().split(/\s+/)){const [lng,lat]=pair.split(',').map(Number);if(finite(lat)&&finite(lng))coordinates.push([lng,lat])}if(coordinates.length>=3)rings.push(closeRing(coordinates))}
    if(!rings.length)throw new Error(name.endsWith('.gpx')?'The GPX did not contain a closed boundary. Open tracks and routes are not accepted as parcel polygons.':'The KML did not contain a usable polygon boundary.');
    const features=rings.map((ring,index)=>({type:'Feature',geometry:{type:'Polygon',coordinates:[ring]},properties:{parcelId:`parcel-${index+1}`}})),format=name.endsWith('.gpx')?'GPX':'KML',combined=combineFeatures(features,{source:`User-imported ${format}`});
    return {...combined,state:combined.parcels.length>1?STATES.multiParcel:STATES.userCorrected,source:`User-imported ${format}`,confidence:'coordinate-file-awaiting-confirmation',needsConfirmation:true};
  }
  if(/\.(?:pdf|png|jpe?g|webp)$/.test(name))return {geometry:null,state:STATES.approximateParcel,source:/\.pdf$/.test(name)?'County parcel-map PDF reference':'County map image reference',confidence:'unverified-image-reference',needsConfirmation:true,failure:{code:'image-georeference-required',message:'The map was accepted as a visual reference. Align it with recognizable roads and buildings, then trace the boundary; unreferenced imagery is not converted into fabricated geometry or called survey-grade.'}};
  if(/\.(?:kmz|zip)$/.test(name))return {geometry:null,state:STATES.approximateParcel,source:'Compressed parcel file',confidence:'unread',needsConfirmation:true,failure:{code:'conversion-required',message:'This compressed GIS file needs conversion to GeoJSON or KML before the browser can verify coordinates. No boundary was imported.'}};
  throw new Error('Use GeoJSON, KML, GPX, KMZ, zipped Shapefile, PDF, PNG, or JPG.');
}
async function inflateRaw(bytes){if(typeof DecompressionStream!=='function')throw new Error('This browser cannot decompress the uploaded GIS archive. Convert it to GeoJSON or KML.');const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return new Uint8Array(await new Response(stream).arrayBuffer())}
async function unzipEntries(buffer){const bytes=new Uint8Array(buffer),view=new DataView(buffer),decoder=new TextDecoder(),minimum=Math.max(0,bytes.length-65557);let eocd=-1;for(let offset=bytes.length-22;offset>=minimum;offset--)if(view.getUint32(offset,true)===0x06054b50){eocd=offset;break}if(eocd<0)throw new Error('The ZIP archive directory could not be read.');const count=view.getUint16(eocd+10,true),directoryOffset=view.getUint32(eocd+16,true),entries={};let cursor=directoryOffset;for(let index=0;index<count;index++){if(view.getUint32(cursor,true)!==0x02014b50)throw new Error('The ZIP archive contains an invalid directory entry.');const method=view.getUint16(cursor+10,true),compressedSize=view.getUint32(cursor+20,true),nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true),localOffset=view.getUint32(cursor+42,true),name=decoder.decode(bytes.slice(cursor+46,cursor+46+nameLength));if(view.getUint32(localOffset,true)!==0x04034b50)throw new Error('The ZIP archive contains an invalid file entry.');const localNameLength=view.getUint16(localOffset+26,true),localExtraLength=view.getUint16(localOffset+28,true),start=localOffset+30+localNameLength+localExtraLength,compressed=bytes.slice(start,start+compressedSize);entries[name]=method===0?compressed:method===8?await inflateRaw(compressed):null;cursor+=46+nameLength+extraLength+commentLength}return entries}
function shapefilePolygons(buffer){const view=new DataView(buffer),shapeType=view.getInt32(32,true);if(![5,15,25].includes(shapeType))throw new Error('The Shapefile does not contain polygon geometry.');const features=[];let cursor=100,record=0;while(cursor+12<=buffer.byteLength){const contentWords=view.getInt32(cursor+4,false),contentStart=cursor+8,contentBytes=contentWords*2;if(contentStart+contentBytes>buffer.byteLength)break;const type=view.getInt32(contentStart,true);if([5,15,25].includes(type)&&contentBytes>=48){const parts=view.getInt32(contentStart+36,true),points=view.getInt32(contentStart+40,true),partsStart=contentStart+44,pointsStart=partsStart+parts*4,rings=[];for(let part=0;part<parts;part++){const from=view.getInt32(partsStart+part*4,true),to=part+1<parts?view.getInt32(partsStart+(part+1)*4,true):points,ring=[];for(let index=from;index<to;index++)ring.push([view.getFloat64(pointsStart+index*16,true),view.getFloat64(pointsStart+index*16+8,true)]);const closed=closeRing(ring);if(closed.length>=4)rings.push(closed)}for(const ring of rings)features.push({type:'Feature',geometry:{type:'Polygon',coordinates:[ring]},properties:{parcelId:`shape-${record+1}`}})}cursor=contentStart+contentBytes;record++}if(!features.length)throw new Error('The Shapefile did not contain a usable polygon.');if(!features.every(feature=>geometryBounds(feature.geometry)&&coordinatesAreUs(feature.geometry.coordinates)))throw new Error('The Shapefile coordinates are not browser-ready longitude/latitude coordinates for the United States. Re-export it as WGS84 GeoJSON.');return features}
async function parseBoundaryFile(file){
  const name=String(file?.name||'').toLowerCase();if(!file)throw new Error('Choose a parcel file or map first.');
  if(!/\.(?:kmz|zip)$/.test(name))return parseBoundaryText(name,/\.(?:pdf|png|jpe?g|webp)$/.test(name)?'':await file.text());
  const entries=await unzipEntries(await file.arrayBuffer()),names=Object.keys(entries),textFor=entry=>new TextDecoder().decode(entries[entry]);
  const geo=names.find(entry=>/\.(?:geojson|json)$/i.test(entry));if(geo)return {...parseBoundaryText(geo,textFor(geo)),archiveName:file.name};
  const kml=names.find(entry=>/\.kml$/i.test(entry));if(kml)return {...parseBoundaryText(kml,textFor(kml)),source:name.endsWith('.kmz')?'User-imported KMZ':'User-imported KML archive',archiveName:file.name};
  const shp=names.find(entry=>/\.shp$/i.test(entry));if(shp){const prj=names.find(entry=>entry.replace(/\.prj$/i,'').toLowerCase()===shp.replace(/\.shp$/i,'').toLowerCase()&&/\.prj$/i.test(entry)),projection=prj?textFor(prj):'';if(projection&&!/(?:GEOGCS|GEODCRS)[\s\S]*(?:WGS[_ ]?1984|NAD[_ ]?1983|NAD83)/i.test(projection))throw new Error('The zipped Shapefile uses a projected coordinate system. Re-export it as WGS84 GeoJSON so it cannot be placed incorrectly.');const features=shapefilePolygons(entries[shp].buffer.slice(entries[shp].byteOffset,entries[shp].byteOffset+entries[shp].byteLength)),combined=combineFeatures(features,{source:'User-imported zipped Shapefile'});return {...combined,state:combined.parcels.length>1?STATES.multiParcel:STATES.userCorrected,source:'User-imported zipped Shapefile',confidence:'coordinate-file-awaiting-confirmation',needsConfirmation:true,archiveName:file.name}}
  throw new Error('The archive did not contain KML, GeoJSON, or a WGS84 polygon Shapefile.');
}
function parcelStatus(record={}){
  const usable=getUsablePropertyGeometry(record),state=record.parcelIntelligence?.state,stateId=state?.id||state;
  if(usable.usable){const known=Object.values(STATES).find(item=>item.id===stateId)||STATES.userCorrected;return {...known,acres:usable.acreage}}
  if(state?.id)return {...state,acres:record.parcelIntelligence?.gisAcreage||record.acres||null};
  if(record.parcelGeometry)return {...STATES.parcelMatch,acres:record.parcel?.gisAcreage||record.acres||null};
  return {...STATES.addressPointOnly,acres:null};
}
function runRegressionChecks(fixtureResponse){
  const record={id:'happy',address:'2792 Happy Hollow Rd, Sevierville, TN 37862',lat:35.714339,lng:-83.682605,acres:45.76,parcel:{county:'Sevier',state:'TN'}},provider=PROVIDERS.sevierTn,features=parseResponse(fixtureResponse),result=resultForCandidates(record,provider,features,'2026-08-14T12:00:00.000Z'),homeResult=resultForCandidates({...record,beds:3,sqft:1457,propertyType:'existing-home-renovation'},provider,features,'2026-08-14T12:00:00.000Z'),merged=merge(record,result),mismatch=resultForCandidates({...record,acres:1.2},provider,features),manual=merge({...record,parcelGeometry:{type:'Polygon',coordinates:[[[-84,35],[-84,35.1],[-83.9,35.1],[-84,35]]]},parcel:{source:'User drawn'},parcelIntelligence:{state:STATES.userCorrected,source:'User drawn'}},result),failedRefresh=merge(merged,{success:false,state:STATES.addressPointOnly,retrievedAt:'2026-08-15T12:00:00.000Z',failure:{code:'provider-unavailable',message:'Fixture failure'}}),gpx=parseBoundaryText('boundary.gpx','<gpx><trk><trkseg><trkpt lat="35.71" lon="-83.68"/><trkpt lat="35.72" lon="-83.68"/><trkpt lat="35.72" lon="-83.67"/><trkpt lat="35.71" lon="-83.68"/></trkseg></trk></gpx>');
  const wrapped={type:'Feature',properties:{},geometry:merged.parcelGeometry},usableWrapped=getUsablePropertyGeometry({...merged,parcelGeometry:wrapped}),unconfirmed=getUsablePropertyGeometry({...merged,parcelIntelligence:{...merged.parcelIntelligence,state:STATES.reviewRequired}}),happyProviders=providersFor(record),checks={providerIsNoCredential:provider.noCredential===true&&provider.browserCors==='supported',verifiedMatch:result.success&&result.state.id==='verified-gis-parcel',acreageValidated:result.gisAcres===45.76&&result.validation.acreageDifferencePct===0,addressAndPointValidated:result.validation.addressMatch&&result.validation.pointInside,improvementsValidated:homeResult.validation.improvementsPlausible&&homeResult.validation.improvementValue>0,geometryStored:merged.parcelGeometry?.type==='Polygon',canonicalFeatureUnwrapped:usableWrapped.usable&&usableWrapped.geometry.type==='Polygon',unconfirmedRejected:!unconfirmed.usable&&unconfirmed.reason.code==='parcel-unconfirmed',parcelIdStored:Boolean(merged.parcel.parcelId),mismatchRejected:!mismatch.success&&mismatch.failure.code==='parcel-validation-failed',manualCorrectionProtected:manual.parcelGeometry.coordinates[0][0][0]===-84&&manual.parcelIntelligence.state.id==='user-corrected',failedRefreshPreservesVerifiedParcel:failedRefresh.parcelGeometry?.type==='Polygon'&&failedRefresh.parcelIntelligence.state.id==='verified-gis-parcel'&&failedRefresh.parcelIntelligence.failure.code==='provider-unavailable',gpxBoundaryUsable:gpx.geometry.type==='Polygon'&&gpx.geometry.coordinates[0].length===4,officialStatewideIsPrimary:happyProviders[0]?.id===PROVIDERS.tnPropertyViewer.id,countyFallbackRetained:happyProviders.some(item=>item.id===PROVIDERS.sevierTn.id),roadFirstAddressQuery:/HAPPY%HOLLOW%2792/.test(addressWhere(record,{...PROVIDERS.tnPropertyViewer,county:'Sevier'})),parcelIdFormattingFlexible:/LIKE/.test(idWhere({...record,parcel:{...record.parcel,rawParcelId:'078-123-010.00'}},{...PROVIDERS.tnPropertyViewer,county:'Sevier'})),sweetwaterChecksBothCounties:providersFor({address:'1 Main St, Sweetwater, TN'}).some(item=>item.county==='Monroe')&&providersFor({address:'1 Main St, Sweetwater, TN'}).some(item=>item.county==='McMinn'),blockedOfficialStateSourceDocumented:BLOCKED_SOURCES.length===1};
  return {passed:Object.values(checks).every(Boolean),checks,result};
}
window.OTParcelIntelligence={VERSION,STATES,PROVIDERS,COUNTY_PROVIDERS,BLOCKED_SOURCES,providerFor,providersFor,buildQueryUrl,parseResponse,validateFeature,resultForCandidates,acquire,lookupByParcelId,merge,combineFeatures,parseBoundaryText,parseBoundaryFile,normalizeGeometry,getUsablePropertyGeometry,geometryAreaAcres,pointInGeometry,parcelStatus,subdivisionLayout,normalizeParcelId:normalizedParcelId,runRegressionChecks};
})();
