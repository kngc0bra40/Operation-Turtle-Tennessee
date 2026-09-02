(()=>{
'use strict';
/*
  Provider-neutral elevation service. USGS 3DEP is deliberately kept behind
  this adapter: browser CORS or availability failures return a structured
  result so planning can keep using clearly-labelled manual inputs.
*/
const FEET_PER_MILE=5280;
const DEFAULT_MAX_SAMPLES=96;
const cache=new Map();
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const clone=value=>value==null?value:structuredClone(value);
const num=value=>Number(value)||0;
const toRadians=value=>num(value)*Math.PI/180;
const isPoint=value=>value&&Number.isFinite(Number(value.lat))&&Number.isFinite(Number(value.lng));
const cleanPoint=value=>({lat:Number(value.lat),lng:Number(value.lng)});
function haversineFeet(a,b){const radius=3958.8,dLat=toRadians(b.lat-a.lat),dLng=toRadians(b.lng-a.lng),h=Math.sin(dLat/2)**2+Math.cos(toRadians(a.lat))*Math.cos(toRadians(b.lat))*Math.sin(dLng/2)**2;return 2*radius*Math.asin(Math.sqrt(h))*FEET_PER_MILE}
function routeDistance(points){return points.slice(1).reduce((total,point,index)=>total+haversineFeet(points[index],point),0)}
function hash(text){let value=2166136261;for(let index=0;index<text.length;index++){value^=text.charCodeAt(index);value=Math.imul(value,16777619)}return (value>>>0).toString(36)}
function geometryFingerprint(routeCoordinates=[]){const text=routeCoordinates.filter(isPoint).map(point=>`${Number(point.lat).toFixed(6)},${Number(point.lng).toFixed(6)}`).join('|');return `route-${hash(text)}-${routeCoordinates.filter(isPoint).length}`}
function recommendedSpacing(totalFeet){if(totalFeet<500)return 35;if(totalFeet<=2000)return 65;return 100}
function interpolate(a,b,fraction){return {lat:a.lat+(b.lat-a.lat)*fraction,lng:a.lng+(b.lng-a.lng)*fraction}}
function sampleRoute(routeCoordinates=[],options={}){
  const points=routeCoordinates.filter(isPoint).map(cleanPoint);
  const totalFeet=routeDistance(points),maxSamples=Math.max(2,Math.floor(num(options.maxSamples)||DEFAULT_MAX_SAMPLES));
  if(points.length<2||totalFeet<=0)return {points,totalFeet,spacingFeet:0};
  const desiredSpacing=recommendedSpacing(totalFeet),segments=Math.max(1,Math.ceil(totalFeet/desiredSpacing));
  const sampleCount=Math.min(maxSamples,segments+1),spacingFeet=totalFeet/(sampleCount-1),samples=[];
  let accumulated=0,segmentIndex=0,nextDistance=0;
  samples.push({...points[0],cumulativeFeet:0});
  for(let sampleIndex=1;sampleIndex<sampleCount-1;sampleIndex++){
    nextDistance=spacingFeet*sampleIndex;
    while(segmentIndex<points.length-2&&accumulated+haversineFeet(points[segmentIndex],points[segmentIndex+1])<nextDistance){accumulated+=haversineFeet(points[segmentIndex],points[segmentIndex+1]);segmentIndex++}
    const start=points[segmentIndex],end=points[segmentIndex+1],segmentFeet=haversineFeet(start,end),fraction=segmentFeet?(nextDistance-accumulated)/segmentFeet:0;
    samples.push({...interpolate(start,end,Math.max(0,Math.min(1,fraction))),cumulativeFeet:nextDistance});
  }
  samples.push({...points.at(-1),cumulativeFeet:totalFeet});
  return {points:samples,totalFeet,spacingFeet};
}
const USGS_3DEP_PROVIDER=Object.freeze({
  id:'usgs-3dep-epqs',
  name:'USGS 3DEP Elevation Point Query Service',
  endpoint:'https://epqs.nationalmap.gov/v1/json',
  units:'Feet',
  noCredential:true,
  futureProxy:{
    method:'POST',
    path:'/elevation-profile',
    request:'{ routeCoordinates: [{ lat, lng }], options: { maxSamples } }',
    response:'{ success, profile, failure }',
    note:'A future Cloudflare Worker may call the provider server-side only when direct browser CORS or availability is not dependable.'
  }
});
function readElevation(payload){
  const candidates=[payload?.value,payload?.elevation,payload?.Elevation,payload?.USGS_Elevation_Point_Query_Service?.Elevation_Query?.Elevation,payload?.USGS_Elevation_Point_Query_Service?.Elevation_Query?.elevation];
  const value=candidates.find(candidate=>Number.isFinite(Number(candidate)));
  return Number.isFinite(Number(value))?Number(value):null;
}
async function usgsPointElevation(point,options={}){
  const fetchImpl=options.fetchImpl||window.fetch?.bind(window);
  if(typeof fetchImpl!=='function')throw Object.assign(new Error('Fetch is not available in this browser.'),{code:'fetch-unavailable',retryable:false});
  const url=new URL(USGS_3DEP_PROVIDER.endpoint);
  url.searchParams.set('x',String(point.lng));url.searchParams.set('y',String(point.lat));url.searchParams.set('wkid','4326');url.searchParams.set('units','Feet');url.searchParams.set('includeDate','false');
  let response;
  try{response=await fetchImpl(url.toString(),{method:'GET',headers:{Accept:'application/json'}})}catch(error){throw Object.assign(new Error('The elevation provider could not be reached directly from this browser.'),{code:'cors-or-network',retryable:true,cause:String(error?.message||error)})}
  if(!response?.ok)throw Object.assign(new Error(`The elevation provider returned HTTP ${response?.status||'unknown'}.`),{code:'provider-http',httpStatus:response?.status,retryable:response?.status===429||response?.status>=500});
  let payload;
  try{payload=await response.json()}catch{throw Object.assign(new Error('The elevation provider returned an unreadable response.'),{code:'provider-response',retryable:true})}
  const elevationFeet=readElevation(payload);
  if(elevationFeet===null)throw Object.assign(new Error('The elevation provider returned no usable elevation for this route point.'),{code:'no-elevation',retryable:true});
  return elevationFeet;
}
function summarizeProfile(samplePoints,elevations,details={}){
  const samples=samplePoints.map((point,index)=>({lat:point.lat,lng:point.lng,cumulativeFeet:point.cumulativeFeet,elevationFeet:elevations[index]}));
  let gain=0,loss=0,absoluteChange=0,maxSegmentGrade=0,uphillFeet=0,downhillFeet=0;
  const gradeBandFeet={gentle:0,moderate:0,steep:0,'very-steep':0,severe:0};
  const runs={above10:{current:0,longest:0},above15:{current:0,longest:0}};
  const segments=[];
  for(let index=1;index<samples.length;index++){
    const previous=samples[index-1],current=samples[index],distance=Math.max(0,current.cumulativeFeet-previous.cumulativeFeet),change=current.elevationFeet-previous.elevationFeet,grade=distance?Math.abs(change)/distance*100:0;
    current.segmentGradePct=grade;current.segmentDirection=change>0?'uphill':change<0?'downhill':'level';
    segments.push({startIndex:index-1,endIndex:index,distanceFeet:distance,elevationChangeFeet:change,gradePct:grade});
    absoluteChange+=Math.abs(change);if(change>0){gain+=change;uphillFeet+=distance}else if(change<0){loss+=Math.abs(change);downhillFeet+=distance}
    maxSegmentGrade=Math.max(maxSegmentGrade,grade);
    const band=grade<=5?'gentle':grade<=10?'moderate':grade<=15?'steep':grade<=20?'very-steep':'severe';gradeBandFeet[band]+=distance;
    for(const [key,threshold] of [['above10',10],['above15',15]]){if(grade>threshold){runs[key].current+=distance;runs[key].longest=Math.max(runs[key].longest,runs[key].current)}else runs[key].current=0}
  }
  const totalFeet=samples.at(-1)?.cumulativeFeet||0;
  const sustainedWindowFeet=Math.min(250,Math.max(100,totalFeet*.15));
  let steepestSustainedGrade=0;
  for(let start=0;start<segments.length;start++){
    let windowDistance=0,windowRise=0;
    for(let end=start;end<segments.length&&windowDistance<sustainedWindowFeet;end++){windowDistance+=segments[end].distanceFeet;windowRise+=Math.abs(segments[end].elevationChangeFeet);if(windowDistance>=Math.min(sustainedWindowFeet,totalFeet))steepestSustainedGrade=Math.max(steepestSustainedGrade,windowRise/windowDistance*100)}
  }
  const gradeBands={};Object.entries(gradeBandFeet).forEach(([name,feet])=>gradeBands[name]={feet:Math.round(feet),percent:totalFeet?Number((feet/totalFeet*100).toFixed(1)):0});
  const maxElevation=Math.max(...elevations),minElevation=Math.min(...elevations),gainPerMile=totalFeet?gain/totalFeet*FEET_PER_MILE:0;
  const switchbackPressure=maxSegmentGrade>20||steepestSustainedGrade>15||gainPerMile>750?'severe':maxSegmentGrade>15||steepestSustainedGrade>10||gainPerMile>500?'high':maxSegmentGrade>10||gainPerMile>250?'moderate':'low';
  return {
    success:true,source:details.source||'provider',provider:details.provider||USGS_3DEP_PROVIDER.name,providerId:details.providerId||USGS_3DEP_PROVIDER.id,retrievedAt:details.retrievedAt||new Date().toISOString(),geometryFingerprint:details.geometryFingerprint,
    confidence:details.confidence||'preliminary-provider-derived',samples,totalLengthFeet:Math.round(totalFeet),sampleSpacingFeet:Math.round(details.sampleSpacingFeet||0),elevationGainFeet:Math.round(gain),elevationLossFeet:Math.round(loss),averageGradePct:Number((totalFeet?absoluteChange/totalFeet*100:0).toFixed(1)),maximumSegmentGradePct:Number(maxSegmentGrade.toFixed(1)),steepestSustainedGradePct:Number(steepestSustainedGrade.toFixed(1)),minimumElevationFeet:Math.round(minElevation),maximumElevationFeet:Math.round(maxElevation),gradeBands,longestContinuousAbove10Feet:Math.round(runs.above10.longest),longestContinuousAbove15Feet:Math.round(runs.above15.longest),uphillDistanceFeet:Math.round(uphillFeet),downhillDistanceFeet:Math.round(downhillFeet),switchbackPressure,segments
  };
}
function failureResult(routeCoordinates,error,details={}){return {success:false,source:'provider',provider:details.provider||USGS_3DEP_PROVIDER.name,providerId:details.providerId||USGS_3DEP_PROVIDER.id,retrievedAt:new Date().toISOString(),geometryFingerprint:geometryFingerprint(routeCoordinates),confidence:'unavailable',failure:{code:error?.code||'provider-unavailable',message:error?.message||'Elevation data is unavailable for this route.',retryable:!!error?.retryable,httpStatus:error?.httpStatus||null}}}
async function getElevationProfile(routeCoordinates,options={}){
  const fingerprint=geometryFingerprint(routeCoordinates),fixtureKey=Array.isArray(options.fixtureElevations)?`:fixture-${hash(options.fixtureElevations.join(','))}`:'',cacheKey=`${fingerprint}${fixtureKey}`,sampled=sampleRoute(routeCoordinates,options);
  if(sampled.points.length<2||sampled.totalFeet<=0)return failureResult(routeCoordinates,Object.assign(new Error('Draw at least two distinct driveway points before requesting an elevation profile.'),{code:'route-too-short',retryable:false}));
  const cached=cache.get(cacheKey);if(cached&&cached.success)return {...clone(cached),cached:true};
  if(Array.isArray(options.fixtureElevations)){
    if(options.fixtureElevations.length!==sampled.points.length)return failureResult(routeCoordinates,Object.assign(new Error('The elevation test fixture does not match the sampled route length.'),{code:'fixture-length',retryable:false}));
    const fixture=summarizeProfile(sampled.points,options.fixtureElevations.map(Number),{source:'fixture',provider:'Fixture elevation provider',providerId:'fixture',geometryFingerprint:fingerprint,sampleSpacingFeet:sampled.spacingFeet,confidence:'test-fixture'});cache.set(cacheKey,clone(fixture));return fixture;
  }
  const provider=options.provider||{...USGS_3DEP_PROVIDER,getPointElevation:usgsPointElevation};
  const getPointElevation=provider.getPointElevation||usgsPointElevation,throttleMs=Math.max(100,num(options.throttleMs)||160),elevations=[];
  try{
    for(let index=0;index<sampled.points.length;index++){if(index)await sleep(throttleMs);elevations.push(await getPointElevation(sampled.points[index],options))}
    const profile=summarizeProfile(sampled.points,elevations,{provider:provider.name||USGS_3DEP_PROVIDER.name,providerId:provider.id||USGS_3DEP_PROVIDER.id,geometryFingerprint:fingerprint,sampleSpacingFeet:sampled.spacingFeet,confidence:'preliminary-provider-derived'});cache.set(cacheKey,clone(profile));return profile;
  }catch(error){return failureResult(routeCoordinates,error,{provider:provider.name||USGS_3DEP_PROVIDER.name,providerId:provider.id||USGS_3DEP_PROVIDER.id})}
}
function manualElevationFallback(routeCoordinates,values={}){
  const sampled=sampleRoute(routeCoordinates,{maxSamples:2}),length=sampled.totalFeet,start=Number(values.startElevationFeet),end=Number(values.endElevationFeet),average=Math.max(0,num(values.estimatedAverageGradePct)),maximum=Math.max(0,num(values.estimatedMaximumGradePct));
  return {source:'manual',provider:'User-estimated elevation',providerId:'manual',retrievedAt:new Date().toISOString(),geometryFingerprint:geometryFingerprint(routeCoordinates),confidence:'user-estimated',startElevationFeet:Number.isFinite(start)?start:null,endElevationFeet:Number.isFinite(end)?end:null,estimatedAverageGradePct:average||null,estimatedMaximumGradePct:maximum||null,totalLengthFeet:Math.round(length),terrainClass:String(values.terrainClass||'rolling'),note:String(values.note||''),failure:null};
}
function costAdjustments(profile={}){
  if(!profile?.success)return {basis:'Manual terrain',components:[]};
  const length=num(profile.totalLengthFeet),bands=profile.gradeBands||{},feet=name=>num(bands[name]?.feet),components=[];
  const add=(name,range)=>components.push({name,range:range.map(value=>Math.round(value))});
  add('Measured moderate-grade exposure', [feet('moderate')*2,feet('moderate')*4,feet('moderate')*7]);
  add('Measured steep-grade exposure', [feet('steep')*8,feet('steep')*16,feet('steep')*29]);
  add('Measured very-steep / severe sections', [(feet('very-steep')+feet('severe'))*22,(feet('very-steep')+feet('severe'))*45,(feet('very-steep')+feet('severe'))*85]);
  add('Sustained steep sections', [Math.max(0,num(profile.longestContinuousAbove10Feet)-100)*3,Math.max(0,num(profile.longestContinuousAbove10Feet)-100)*7,Math.max(0,num(profile.longestContinuousAbove10Feet)-100)*13]);
  add('Measured elevation gain', [num(profile.elevationGainFeet)*12,num(profile.elevationGainFeet)*25,num(profile.elevationGainFeet)*45]);
  if(profile.switchbackPressure==='moderate')add('Measured switchback pressure',[1200,3200,7000]);
  if(profile.switchbackPressure==='high')add('Measured switchback pressure',[4000,9000,19000]);
  if(profile.switchbackPressure==='severe')add('Measured switchback pressure',[9000,19000,40000]);
  const observedSteep=feet('steep')+feet('very-steep')+feet('severe');
  if(observedSteep>0)add('Drainage / cut-and-fill exposure',[observedSteep*3,observedSteep*7,observedSteep*14]);
  return {basis:'Measured elevation',components:components.filter(component=>component.range.some(Boolean)),routeLengthFeet:length};
}
function parcelGeometryFingerprint(geometry){
  const rings=geometry?.type==='Polygon'?geometry.coordinates:geometry?.type==='MultiPolygon'?geometry.coordinates.flat():[];
  const text=rings.flat().map(pair=>`${Number(pair?.[1]).toFixed(6)},${Number(pair?.[0]).toFixed(6)}`).join('|');
  return text?`parcel-${hash(text)}-${rings.flat().length}`:'';
}
function parcelPolygons(geometry){
  const raw=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
  return raw.map(polygon=>polygon.map(ring=>ring.map(pair=>({lat:Number(pair?.[1]),lng:Number(pair?.[0])})).filter(isPoint)).filter(ring=>ring.length>=3)).filter(polygon=>polygon[0]?.length>=3);
}
function pointInRing(value,ring=[]){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j],cross=(a.lat>value.lat)!==(b.lat>value.lat)&&value.lng<(b.lng-a.lng)*(value.lat-a.lat)/((b.lat-a.lat)||1e-12)+a.lng;
    if(cross)inside=!inside;
  }
  return inside;
}
function pointInParcel(value,polygons=[]){return polygons.some(polygon=>pointInRing(value,polygon[0])&&!polygon.slice(1).some(hole=>pointInRing(value,hole)))}
function sampleParcel(geometry,options={}){
  const polygons=parcelPolygons(geometry),all=polygons.flat(2),maxSamples=Math.max(9,Math.min(64,Math.floor(num(options.maxSamples)||49)));
  if(!all.length)return [];
  const minLat=Math.min(...all.map(item=>item.lat)),maxLat=Math.max(...all.map(item=>item.lat)),minLng=Math.min(...all.map(item=>item.lng)),maxLng=Math.max(...all.map(item=>item.lng)),side=Math.max(3,Math.ceil(Math.sqrt(maxSamples*1.8))),latStep=(maxLat-minLat)/side,lngStep=(maxLng-minLng)/side,points=[];
  for(let row=0;row<side;row++)for(let column=0;column<side;column++){
    const candidate={lat:minLat+latStep*(row+.5),lng:minLng+lngStep*(column+.5),gridRow:row,gridColumn:column,gridMinLat:minLat,gridMinLng:minLng,gridLatStep:latStep,gridLngStep:lngStep,cellHalfLat:latStep/2,cellHalfLng:lngStep/2};
    if(pointInParcel(candidate,polygons))points.push(candidate);
  }
  /* Candidate geometry depends on a stable grid. Avoid injecting non-grid centroids here. */
  return points.slice(0,maxSamples);
}
function contiguousCandidateZones(samples=[],parcelAcreage=null){
  const gentle=samples.filter(sample=>sample.slopePct<=10);if(!gentle.length)return [];
  const nearest=gentle.map(sample=>Math.min(...gentle.filter(other=>other!==sample).map(other=>haversineFeet(sample,other)).filter(Boolean),Infinity)).filter(Number.isFinite).sort((a,b)=>a-b),spacing=nearest[Math.floor(nearest.length/2)]||250,threshold=spacing*1.65,unvisited=new Set(gentle),groups=[];
  while(unvisited.size){const seed=unvisited.values().next().value,group=[],queue=[seed];unvisited.delete(seed);while(queue.length){const current=queue.shift();group.push(current);for(const candidate of [...unvisited])if(haversineFeet(current,candidate)<=threshold){unvisited.delete(candidate);queue.push(candidate)}}groups.push(group)}
  return groups.sort((a,b)=>b.length-a.length).slice(0,3).map((group,index)=>({id:`candidate-zone-${index+1}`,label:`Candidate Build Zone ${String.fromCharCode(65+index)}`,center:{lat:Number((group.reduce((sum,item)=>sum+item.lat,0)/group.length).toFixed(7)),lng:Number((group.reduce((sum,item)=>sum+item.lng,0)/group.length).toFixed(7))},sampleCount:group.length,averageSlopePct:Number((group.reduce((sum,item)=>sum+item.slopePct,0)/group.length).toFixed(1)),maximumSlopePct:Number(Math.max(...group.map(item=>item.slopePct)).toFixed(1)),approximateScreenedAcres:Number.isFinite(Number(parcelAcreage))?Number((Number(parcelAcreage)*group.length/samples.length).toFixed(2)):null,points:group.map(item=>({lat:item.lat,lng:item.lng})),classification:'Preliminary candidate zone – not an approved building site'}));
}
function summarizeParcelTerrain(points,elevations,details={}){
  const samples=points.map((item,index)=>({...item,elevationFeet:Number(elevations[index])}));
  samples.forEach((sample,index)=>{
    const neighbors=samples.filter((_,other)=>other!==index).map(other=>({distance:haversineFeet(sample,other),change:Math.abs(sample.elevationFeet-other.elevationFeet)})).filter(item=>item.distance>0).sort((a,b)=>a.distance-b.distance).slice(0,3);
    sample.slopePct=neighbors.length?Number((neighbors.reduce((sum,item)=>sum+item.change/item.distance*100,0)/neighbors.length).toFixed(1)):0;
  });
  const bandFor=slope=>slope<=5?'gentle':slope<=10?'moderate':slope<=15?'steep':slope<=20?'very-steep':'severe',gradeBands={gentle:0,moderate:0,steep:0,'very-steep':0,severe:0};
  samples.forEach(item=>gradeBands[bandFor(item.slopePct)]++);
  Object.keys(gradeBands).forEach(key=>{gradeBands[key]={sampleCount:gradeBands[key],percent:samples.length?Number((gradeBands[key]/samples.length*100).toFixed(1)):0}});
  const values=samples.map(item=>item.elevationFeet),minimumElevationFeet=Math.round(Math.min(...values)),maximumElevationFeet=Math.round(Math.max(...values));
  const slopeBandFor=slope=>slope<10?'under-10':slope<20?'10-20':slope<30?'20-30':'30-plus',slopeBands={'under-10':0,'10-20':0,'20-30':0,'30-plus':0};samples.forEach(item=>slopeBands[slopeBandFor(item.slopePct)]++);Object.keys(slopeBands).forEach(key=>{slopeBands[key]={sampleCount:slopeBands[key],percent:samples.length?Number((slopeBands[key]/samples.length*100).toFixed(1)):0}});
  const candidateSamples=samples.filter(item=>item.slopePct<=10).sort((a,b)=>a.slopePct-b.slopePct||b.elevationFeet-a.elevationFeet).slice(0,6),candidateZones=contiguousCandidateZones(samples,details.parcelAcreage),steepSamples=samples.filter(item=>item.slopePct>15).sort((a,b)=>b.slopePct-a.slopePct).slice(0,6),drainageCandidates=samples.filter(item=>item.elevationFeet<=minimumElevationFeet+(maximumElevationFeet-minimumElevationFeet)*.15).slice(0,4);
  const steepPct=gradeBands.steep.percent+gradeBands['very-steep'].percent+gradeBands.severe.percent,overallTerrainCharacter=steepPct>=55?'Predominantly steep with localized usable areas':steepPct>=25?'Mixed terrain with meaningful steep areas and localized benches':'Mostly lower-slope samples with localized steeper areas';
  return {success:true,analysisType:'parcel-terrain-screen',source:details.source||'provider',provider:details.provider||USGS_3DEP_PROVIDER.name,providerId:details.providerId||USGS_3DEP_PROVIDER.id,retrievedAt:new Date().toISOString(),geometryFingerprint:details.geometryFingerprint,parcelCertainty:details.parcelCertainty||'verified-parcel-polygon',confidence:details.confidence||'preliminary-provider-derived',sampleCount:samples.length,samples,minimumElevationFeet,maximumElevationFeet,reliefFeet:maximumElevationFeet-minimumElevationFeet,averageSlopePct:Number((samples.reduce((sum,item)=>sum+item.slopePct,0)/samples.length).toFixed(1)),maximumLocalSlopePct:Number(Math.max(...samples.map(item=>item.slopePct)).toFixed(1)),gradeBands,slopeBands,overallTerrainCharacter,candidateSamples,candidateZones,steepSamples,drainageCandidates,limitations:'Preliminary parcel-wide sample screening only. Candidate zones are not approved building sites and do not establish parcel boundaries, drainage engineering, septic suitability, or construction approval.'};
}
async function screenParcelTerrain(geometry,options={}){
  const fingerprint=parcelGeometryFingerprint(geometry),points=sampleParcel(geometry,options),cacheKey=`${fingerprint}:parcel`;
  if(!fingerprint||points.length<5)return {success:false,analysisType:'parcel-terrain-screen',geometryFingerprint:fingerprint,confidence:'unavailable',failure:{code:'parcel-geometry-invalid',message:'A verified parcel Polygon or MultiPolygon is required before terrain screening.',retryable:false}};
  const cached=cache.get(cacheKey);if(cached?.success)return {...clone(cached),cached:true};
  let elevations=[];
  if(typeof options.fixtureElevationFn==='function')elevations=points.map((value,index)=>Number(options.fixtureElevationFn(value,index,points)));
  else if(Array.isArray(options.fixtureElevations)&&options.fixtureElevations.length===points.length)elevations=options.fixtureElevations.map(Number);
  else{
    const provider=options.provider||{...USGS_3DEP_PROVIDER,getPointElevation:usgsPointElevation},getPointElevation=provider.getPointElevation||usgsPointElevation,throttleMs=Math.max(100,num(options.throttleMs)||160);
    try{for(let index=0;index<points.length;index++){if(index)await sleep(throttleMs);elevations.push(await getPointElevation(points[index],options))}}
    catch(error){return {success:false,analysisType:'parcel-terrain-screen',source:'provider',provider:provider.name||USGS_3DEP_PROVIDER.name,providerId:provider.id||USGS_3DEP_PROVIDER.id,retrievedAt:new Date().toISOString(),geometryFingerprint:fingerprint,confidence:'unavailable',failure:{code:error?.code||'provider-unavailable',message:error?.message||'Parcel elevations are unavailable.',retryable:!!error?.retryable}}}
  }
  if(elevations.some(value=>!Number.isFinite(value)))return {success:false,analysisType:'parcel-terrain-screen',geometryFingerprint:fingerprint,confidence:'unavailable',failure:{code:'no-elevation',message:'The provider returned incomplete parcel elevations.',retryable:true}};
  const fixture=typeof options.fixtureElevationFn==='function'||Array.isArray(options.fixtureElevations),screen=summarizeParcelTerrain(points,elevations,{source:fixture?'fixture':'provider',provider:fixture?'Fixture elevation provider':USGS_3DEP_PROVIDER.name,providerId:fixture?'fixture':USGS_3DEP_PROVIDER.id,geometryFingerprint:fingerprint,parcelCertainty:options.parcelCertainty,parcelAcreage:options.parcelAcreage,confidence:fixture?'test-fixture':'preliminary-provider-derived'});
  cache.set(cacheKey,clone(screen));return screen;
}
function clearCache(){cache.clear()}
window.OTElevation={USGS_3DEP_PROVIDER,geometryFingerprint,sampleRoute,getElevationProfile,manualElevationFallback,costAdjustments,clearCache,gradeBands:[{key:'gentle',label:'0–5% gentle'},{key:'moderate',label:'over 5–10% moderate'},{key:'steep',label:'over 10–15% steep'},{key:'very-steep',label:'over 15–20% very steep'},{key:'severe',label:'over 20% severe'}]};
Object.assign(window.OTElevation,{parcelGeometryFingerprint,sampleParcel,screenParcelTerrain,contiguousCandidateZones});
})();
