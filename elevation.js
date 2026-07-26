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
function clearCache(){cache.clear()}
window.OTElevation={USGS_3DEP_PROVIDER,geometryFingerprint,sampleRoute,getElevationProfile,manualElevationFallback,costAdjustments,clearCache,gradeBands:[{key:'gentle',label:'0–5% gentle'},{key:'moderate',label:'over 5–10% moderate'},{key:'steep',label:'over 10–15% steep'},{key:'very-steep',label:'over 15–20% very steep'},{key:'severe',label:'over 20% severe'}]};
})();
