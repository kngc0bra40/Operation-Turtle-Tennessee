/* V4.4 canonical property workflow helpers. Pure: no storage or startup writes. */
(()=>{'use strict';
const VERSION='4.4.0',precedence=window.OTSourcePrecedence;
const FLEXIBILITY_OPTIONS=['unknown','excellent','good','difficult','unlikely'];
const BUILDABILITY_OPTIONS=['unknown','excellent','good','difficult','unlikely'];
const SUBDIVISION_OPTIONS=['unknown','strong','possible','difficult','unlikely'];
const PROFILE_FIELDS=['existingResidencePresent','existingResidenceLivable','residenceStatus','residenceCondition','electric','waterSource','well','spring','septicOrSewer','sewer','internet','driveway','roadAccess','utilityAvailability','outbuildings','additionalBuildSite','additionalBuildSiteConfidence','secondHomeBuildability','secondHomeAccess','secondHomeSubdivisionPotential','secondHomeFlexibility','secondHomeFlexibilityNote','utilityExtensionDifficulty','multipleResidences','woodedOpenMix','slopeCharacter','waterFeatureType','waterFeatureReliability','waterFloodRisk'];
const MANUAL_PROPERTY_FIELDS=['name','status','visitStatus','propertyType','waterFeature','acres','price','beds','baths','sqft','notes'];
const NUMERIC_PROPERTY_FIELDS=new Set(['acres','price','beds','baths','sqft']);
const FIELD_REGISTRY=Object.freeze({
 acreage:'acres',residenceStatus:'propertyIntelligence.propertyProfile.residenceStatus',
 residenceCondition:'propertyIntelligence.propertyProfile.residenceCondition',
 existingResidencePresent:'propertyIntelligence.propertyProfile.existingResidencePresent',
 existingResidenceLivable:'propertyIntelligence.propertyProfile.existingResidenceLivable',
 residenceSquareFootage:'sqft',structureArea:'structureArea',yearBuilt:'yearBuilt',
 waterSource:'propertyIntelligence.propertyProfile.waterSource',
 waterConnectionStatus:'propertyIntelligence.propertyProfile.publicWater',
 wellStatus:'propertyIntelligence.propertyProfile.well',
 springStatus:'propertyIntelligence.propertyProfile.spring',
 septicStatus:'propertyIntelligence.propertyProfile.septicOrSewer',
 sewerStatus:'propertyIntelligence.propertyProfile.sewer',
 electricStatus:'propertyIntelligence.propertyProfile.electric',
 internet:'propertyIntelligence.propertyProfile.internet',
 drivewayStatus:'propertyIntelligence.propertyProfile.driveway',
 roadAccess:'propertyIntelligence.propertyProfile.roadAccess',
 utilityAvailability:'propertyIntelligence.propertyProfile.utilityAvailability',
 outbuildings:'propertyIntelligence.propertyProfile.outbuildings',
 garage:'propertyIntelligence.zillowLand.garage',carport:'propertyIntelligence.zillowLand.carport',
 barn:'propertyIntelligence.zillowLand.barn',stable:'propertyIntelligence.zillowLand.stable',
 workshop:'propertyIntelligence.zillowLand.workshop',storage:'propertyIntelligence.zillowLand.storageBuilding',
 wooded:'propertyIntelligence.zillowLand.wooded',private:'propertyIntelligence.zillowLand.private',
 level:'propertyIntelligence.zillowLand.levelLand',sloped:'propertyIntelligence.zillowLand.slopedLand',
 mountainView:'propertyIntelligence.zillowLand.mountainView',creek:'propertyIntelligence.zillowLand.creek',
 secondHomeBuildability:'propertyIntelligence.propertyProfile.secondHomeBuildability',
 secondHomeAccess:'propertyIntelligence.propertyProfile.secondHomeAccess',
 secondHomeSubdivisionPotential:'propertyIntelligence.propertyProfile.secondHomeSubdivisionPotential',
 secondHomeFlexibility:'propertyIntelligence.propertyProfile.secondHomeFlexibility',
 secondHomeFlexibilityNote:'propertyIntelligence.propertyProfile.secondHomeFlexibilityNote',
 routeRecords:'destinations'
});
const RESEARCH_SCOPE=Object.freeze([['parcel','County parcel record'],['ownership','Ownership'],['zoning','Zoning'],['priorUse','Previous business or unusual use'],['multipleResidences','Multiple-residence rules'],['flood','Flood information'],['easements','Easements'],['permits','Permits'],['utilities','Utility verification'],['soilSeptic','Soil or septic records'],['restrictions','Legal restrictions'],['countyGis','County GIS'],['secondHome','Second-home feasibility']]);
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const clone=value=>structuredClone(value);
const canonicalPath=field=>FIELD_REGISTRY[field]||field;
const getAt=(value,path)=>String(path).split('.').reduce((current,key)=>current?.[key],value);
function setAt(value,path,nextValue){const parts=String(path).split('.');let current=value;parts.slice(0,-1).forEach(key=>{current[key]=plain(current[key]);current=current[key]});current[parts.at(-1)]=nextValue;return value}
const canonicalSource=(record,path)=>record?.fieldSources?.[path]||record?.fieldSources?.[path.split('.').at(-1)]||'inferred';
const enumValue=(value,allowed)=>allowed.includes(String(value||'').toLowerCase())?String(value).toLowerCase():'unknown';
function profileForRecord(record={},legacyEntry={}){
 const topLevel=plain(record.propertyProfile),canonical=plain(plain(record.propertyIntelligence).propertyProfile),legacy={...plain(legacyEntry.propertyProfile),...plain(plain(legacyEntry.propertyIntelligence).propertyProfile)},source={...topLevel,...legacy,...canonical};
 const normalized=window.OTIntelligence?.normalizePropertyProfile?.(source)||{...plain(source)};
 normalized.secondHomeBuildability=enumValue(source?.secondHomeBuildability,BUILDABILITY_OPTIONS);
 normalized.secondHomeSubdivisionPotential=enumValue(source?.secondHomeSubdivisionPotential,SUBDIVISION_OPTIONS);
 normalized.secondHomeFlexibility=enumValue(source?.secondHomeFlexibility,FLEXIBILITY_OPTIONS);
 normalized.secondHomeFlexibilityNote=String(source?.secondHomeFlexibilityNote||'');
 normalized.residenceSquareFootage=Number(record.sqft)>0?Number(record.sqft):(Number(source?.residenceSquareFootage)>0?Number(source.residenceSquareFootage):null);
 return normalized
}
function effectiveInfrastructure(record={}){
 const profile=profileForRecord(record),livable=profile.existingResidenceLivable===true||profile.residenceStatus==='livable'||profile.residenceCondition==='livable',infer=(value,label,presentValue='present-inferred')=>value==='none'?{state:'absent',value,source:canonicalSource(record,`propertyIntelligence.propertyProfile.${label}`)}:value&&value!=='unknown'?{state:'present',value,source:canonicalSource(record,`propertyIntelligence.propertyProfile.${label}`)}:livable?{state:'present',value:presentValue,source:'inferred-existing-livable-home'}:{state:'unknown',value:'unknown',source:'unknown'},accessField=profile.driveway==='unknown'?'roadAccess':'driveway';
 return {livable,electric:infer(profile.electric,'electric'),water:infer(profile.waterSource,'waterSource','present-type-unknown'),wastewater:infer(profile.septicOrSewer,'septicOrSewer','present-type-unknown'),access:infer(profile[accessField],accessField),internet:profile.internet==='none'?{state:'absent',value:'none',source:canonicalSource(record,'propertyIntelligence.propertyProfile.internet')}:profile.internet&&profile.internet!=='unknown'?{state:'present',value:profile.internet,source:canonicalSource(record,'propertyIntelligence.propertyProfile.internet')}:{state:'unknown',value:'unknown',source:'unknown'},futureCapacity:{electric:'unknown',water:'unknown',wastewater:'unknown',legalAccess:profile.secondHomeAccess||'unknown'}}
}
function developmentFromProfile(record){
 const next=clone(record),profile=profileForRecord(next),effective=effectiveInfrastructure(next),sources={...(next.fieldSources||{})},development={driveway:'unknown',homesite:'unknown',utilities:'unknown',...(next.development||{})};
 const assign=(key,value)=>{const path=`development.${key}`;if(!value||precedence?.normalizeSource?.(canonicalSource(next,path))==='user-confirmed')return;if(development[key]!==value){development[key]=value;sources[path]='inferred'}};
 if(profile.existingResidencePresent===true)assign('homesite','home');else if(['identified','likely'].includes(profile.additionalBuildSite))assign('homesite','identified');else if(profile.additionalBuildSite==='not-viable')assign('homesite','steep');
 if(['year-round','verified','recorded'].includes(profile.driveway)||effective.access.source==='inferred-existing-livable-home')assign('driveway','existing');else if(profile.driveway==='limited')assign('driveway','rough');else if(profile.driveway==='none')assign('driveway','none');
 const installed=[profile.electric,profile.waterSource,profile.septicOrSewer].filter(value=>['verified','verified-well','public-water'].includes(value)).length,available=[profile.electric,profile.waterSource,profile.septicOrSewer].filter(value=>['available','recorded'].includes(value)).length;
 if(installed||[effective.electric,effective.water,effective.wastewater].every(item=>item.state==='present'))assign('utilities','onsite');else if(available)assign('utilities','roadside');
 next.development=development;next.fieldSources=sources;return next
}
function applyProfileDraft(record,draft={}){
 const before=profileForRecord(record),next=clone(record),profile={...plain(next.propertyIntelligence?.propertyProfile)},sources={...(next.fieldSources||{})},changed=[];
 for(const key of PROFILE_FIELDS){if(!(key in draft))continue;let value=draft[key];if(key==='secondHomeBuildability')value=enumValue(value,BUILDABILITY_OPTIONS);if(key==='secondHomeSubdivisionPotential')value=enumValue(value,SUBDIVISION_OPTIONS);if(key==='secondHomeFlexibility')value=enumValue(value,FLEXIBILITY_OPTIONS);if(key==='secondHomeFlexibilityNote')value=String(value||'').trim();const legacyOnly=!(key in profile)&&value!==''&&value!==null&&value!==undefined&&value!=='unknown';if(legacyOnly||!precedence?.sameValue?.(before[key],value)&&String(before[key]??'')!==String(value??'')){profile[key]=value;sources[`propertyIntelligence.propertyProfile.${key}`]='user-confirmed';changed.push(key)}}
 if('residenceSquareFootage' in draft){const sqft=Number(draft.residenceSquareFootage),value=Number.isFinite(sqft)&&sqft>0?sqft:0;if(Number(next.sqft||0)!==value){next.sqft=value;sources.sqft='user-confirmed';changed.push('residenceSquareFootage')}}
 if(['existingResidencePresent','existingResidenceLivable','residenceCondition'].some(key=>key in draft)){const status=profile.existingResidencePresent===false?'raw_land':profile.existingResidenceLivable===true||profile.residenceCondition==='livable'?'livable':profile.existingResidencePresent===true&&profile.existingResidenceLivable===false&&profile.residenceCondition==='major-rehabilitation'?'non_livable':profile.residenceStatus;if(status&&profile.residenceStatus!==status){profile.residenceStatus=status;sources['propertyIntelligence.propertyProfile.residenceStatus']='user-confirmed';changed.push('residenceStatus')}}
 next.propertyIntelligence={...(next.propertyIntelligence||{}),propertyProfile:profile};next.fieldSources=sources;next.updatedAt=new Date().toISOString();
 return {property:developmentFromProfile(next),changed:[...new Set(changed)]}
}
function applyManualDraft(record,{profile={},fields={}}={}){
 const next=clone(record),sources={...(next.fieldSources||{})},changed=[],errors=[];
 for(const key of MANUAL_PROPERTY_FIELDS){
  if(!(key in fields))continue;
  let value=fields[key];
  if(NUMERIC_PROPERTY_FIELDS.has(key)){
   if(value===''||value===null||value===undefined)value=0;
   else if(!Number.isFinite(Number(value))||Number(value)<0){errors.push(`${key} must be zero or greater.`);continue}
   else value=Number(value)
  }else value=String(value??'').trim();
  if(String(next[key]??'')===String(value??''))continue;
  next[key]=value;sources[key]='user-confirmed';changed.push(key)
 }
 if(errors.length)return {property:clone(record),changed:[],errors};
 next.fieldSources=sources;
 const applied=applyProfileDraft(next,profile);
 return {property:applied.property,changed:[...new Set([...changed,...applied.changed])],errors:[]}
}
function synchronizeRecord(record={}){return developmentFromProfile(record)}
function applyProposals(record,proposals={},source='research',{explicit=false}={}){
 const next=clone(record),updated=[],conflicts=[];
 for(const [field,candidate] of Object.entries(proposals||{})){const path=canonicalPath(field),current=getAt(next,path),currentSource=canonicalSource(next,path),decision=precedence?.canReplace?.(current,currentSource,candidate,source,{explicit})||{allowed:current===undefined||current===null||current==='',source};if(decision.allowed){setAt(next,path,candidate);next.fieldSources={...(next.fieldSources||{}),[path]:decision.source||source};updated.push(path)}else if(decision.conflict){precedence?.preserveCandidate?.(next,path,candidate,source,'rejected');conflicts.push({field:path,current,candidate,source:currentSource})}}
 return {property:developmentFromProfile(next),updated,conflicts}
}
const meaningful=value=>Array.isArray(value)?value.length>0:value&&typeof value==='object'?Object.keys(value).length>0:String(value??'').trim()!==''&&String(value).toLowerCase()!=='unknown';
function parcelCertainty(record={}){
 const parcel=plain(record.parcel),intelligence=plain(record.parcelIntelligence),state=intelligence.state?.id||intelligence.state||'',usable=window.OTParcelIntelligence?.getUsablePropertyGeometry?.(record),geometry=usable?.geometry||null,hasGeometry=Boolean(usable?.usable),geometrySource=canonicalSource(record,'parcelGeometry');
 if(state==='multi-parcel-property'&&hasGeometry)return {id:'verified-parcel-polygon',stateId:state,label:'Multi-parcel property',terrainEligible:true};
 if(['user-confirmed-parcel','user-corrected','confirmed-manual-boundary','confirmed-imported-boundary'].includes(state)&&hasGeometry)return {id:'user-adjusted-parcel',stateId:state,label:'User-confirmed parcel',terrainEligible:true};
 if(state==='verified-gis-parcel'&&hasGeometry)return {id:'verified-parcel-polygon',stateId:state,label:'Verified GIS parcel',terrainEligible:true};
 if(state==='parcel-match')return {id:'parcel-matched',stateId:state,label:'Parcel match',terrainEligible:false};
 if(state==='parcel-review-required')return {id:'parcel-review-required',stateId:state,label:'Parcel review required',terrainEligible:false};
 if(state==='no-parcel-match')return {id:'no-parcel-match',stateId:state,label:'No parcel match',terrainEligible:false};
 if(state==='approximate-parcel')return {id:'approximate-parcel',stateId:state,label:'Approximate parcel',terrainEligible:false};
 if(hasGeometry&&precedence?.normalizeSource?.(geometrySource)==='user-confirmed')return {id:'user-adjusted-parcel',label:'User-adjusted parcel',terrainEligible:true};
 if(/approximate/i.test(String(parcel.matchStatus||parcel.confidence||'')))return {id:'approximate-parcel',label:'Approximate parcel',terrainEligible:false};
 if(parcel.parcelId||record.parcelNumber)return {id:'parcel-matched',label:'Parcel matched',terrainEligible:false};
 return {id:'address-point-only',label:'Address point only',terrainEligible:false};
}
function researchAssessment(record={}){
 const profile=profileForRecord(record),parcel=plain(record.parcel),facts={parcel:parcel.parcelId||record.parcelNumber,ownership:record.owner||record.ownership,zoning:record.zoning,priorUse:record.priorUse?.name||record.priorUse,multipleResidences:profile.multipleResidences!=='unknown'&&profile.multipleResidences,flood:record.floodInfo||record.floodplain||profile.waterFloodRisk!=='unknown'&&profile.waterFloodRisk,easements:record.easements,permits:record.permits,utilities:[profile.electric,profile.waterSource,profile.septicOrSewer].some(value=>!['unknown',''].includes(value))&&'recorded',soilSeptic:record.soilReport||record.septicRecords,restrictions:record.restrictions,countyGis:parcel.gisUrl||parcel.recordUrl,secondHome:[profile.secondHomeFlexibility,profile.secondHomeBuildability,profile.secondHomeAccess,profile.secondHomeSubdivisionPotential].some(value=>value&&value!=='unknown')&&'recorded'};
 const completed=RESEARCH_SCOPE.filter(([key])=>meaningful(facts[key])).map(([,label])=>label),missing=RESEARCH_SCOPE.filter(([key])=>!meaningful(facts[key])).map(([,label])=>label);
 return {status:missing.length?'partial':'complete',completed,missing,scope:RESEARCH_SCOPE.map(([,label])=>label)}
}
function applyResearchAssessment(record){const next=clone(record),assessment=researchAssessment(next),now=new Date().toISOString();next.propertyResearch={...(next.propertyResearch||{}),version:1,scope:assessment.scope,completed:assessment.completed,missing:assessment.missing,status:assessment.status,checkedAt:now,provider:'Saved facts and configured county-record links only'};next.researchStatus=assessment.status==='complete'?'Research complete':'Research partial';next.researchUpdatedAt=now;next.updatedAt=now;return {property:next,...assessment}}
const conclusionRating=score=>score===null||score===undefined?'Needs information':score>=8.5?'Excellent':score>=7?'Good':score>=5?'Fair':'Limited';
function propertyConclusions(record={}){
 const turtle=window.OTIntelligence?.getTurtleScore?.(record),categories=turtle?.categories||[],find=id=>categories.find(item=>item.id===id),average=(...items)=>{const values=items.map(item=>item?.score).filter(value=>Number.isFinite(Number(value))).map(Number);return values.length?values.reduce((total,value)=>total+value,0)/values.length:null},support=(items,fallback)=>items.flatMap(item=>item?.reasons||[]).find(Boolean)||items.flatMap(item=>item?.warnings||[]).find(Boolean)||fallback;
 const infrastructure=find('existingHomeInfrastructure'),land=find('landCharacterPrivacy'),second=find('secondHomeBuildPotential'),recreation=find('recreationWaterFeatures'),risk=find('costRiskPersonalFit'),developmentScore=average(second,risk),potentialScore=average(second,recreation);
 return [
  {id:'infrastructure',label:'Infrastructure',score:infrastructure?.score??null,rating:conclusionRating(infrastructure?.score),support:support([infrastructure],'Confirm the existing home and utility facts.')},
  {id:'land',label:'Land Quality',score:land?.score??null,rating:conclusionRating(land?.score),support:support([land],'Add terrain, privacy, and land-character observations.')},
  {id:'development',label:'Development Readiness',score:developmentScore,rating:conclusionRating(developmentScore),support:support([risk,second],'Confirm build-site, access, utility, and cost assumptions.')},
  {id:'potential',label:'Property Potential',score:potentialScore,rating:conclusionRating(potentialScore),support:support([second,recreation],'Confirm recreation and additional-home potential.')}
 ]
}
function decisionSummary(record={}){
 const turtle=window.OTIntelligence?.getTurtleScore?.(record)||{total:0,confidencePercentage:0,categories:[]},profile=profileForRecord(record),land=plain(record.propertyIntelligence?.zillowLand),certainty=parcelCertainty(record),home=profile.existingResidencePresent===true||Number(record.beds)>0||Number(record.sqft)>0,why=[],worries=[],unknown=[];
 if(home)why.push(`${Number(record.sqft)>0?Number(record.sqft).toLocaleString()+' sq ft ':''}existing residence`);
 if(Number(record.acres)>=20)why.push(`${Number(record.acres).toLocaleString()} acres with privacy and use-separation potential`);
 if([profile.electric,profile.waterSource,profile.septicOrSewer,profile.driveway].filter(value=>value&&value!=='unknown'&&value!=='none').length>=3)why.push('established home-area infrastructure');
 if(profile.outbuildings==='multiple'||land.climateControlledBuilding==='yes')why.push('multiple reusable developed structures');
 if(land.establishedTrails==='yes'||land.recreationalUse==='yes')why.push('established trails and prior recreational use');
 if(['creek','spring','pond','river','multiple'].includes(profile.waterFeatureType))why.push(profile.waterFeatureType==='multiple'?'multiple water features':profile.waterFeatureType);
 if(land.nationalParkAdjacency==='yes')why.push('corroborated National Park adjacency');
 if(profile.residenceCondition==='major-rehabilitation')worries.push('the residence requires major rehabilitation');
 if(profile.slopeCharacter==='steep-limiting')worries.push('saved terrain facts identify steep, limiting slopes');
 if(['moderate','high'].includes(profile.waterFloodRisk))worries.push('saved flood or drainage risk is elevated');
 if(record.propertyResearch?.background?.terrainEvidence)worries.push('independent recreation sources describe very hilly terrain and significant elevation change');
 if(!certainty.terrainEligible)unknown.push('the actual parcel polygon and parcel-wide terrain');
 if(profile.additionalBuildSite==='unknown')unknown.push('a practical second build site');
 if(profile.secondHomeAccess==='unknown')unknown.push('independent second-home or subdivision access');
 if(profile.secondHomeSubdivisionPotential==='unknown')unknown.push('subdivision feasibility');
 if(profile.septicOrSewer!=='none'&&profile.secondHomeBuildability==='unknown')unknown.push('second-home septic and soil feasibility; existing septic is a separate recorded fact');
 if(land.establishedTrails==='yes'&&land.sxsSuitability!=='confirmed')unknown.push('SxS trail width, grade, and access suitability');
 const headline=turtle.total>=75?`Strong Candidate${turtle.confidencePercentage<80?' – Research Incomplete':''}`:turtle.total>=65?`Promising Candidate${turtle.confidencePercentage<80?' – Research Incomplete':''}`:'Research Candidate';
 const subject=[Number(record.acres)>0?`${Number(record.acres).toLocaleString()} acres`:'This property',home?'with an existing residence':''].filter(Boolean).join(' '),supporting=why.filter(item=>!/^\d[\d,.]* acres\b/i.test(item)&&!/existing residence$/i.test(item)).slice(0,3),summary=`${subject}${supporting.length?`, ${supporting.join(', ')}`:''}. ${unknown.length?`Primary unresolved questions are ${unknown.slice(0,3).join(', ')}.`:'Core suitability facts are well supported.'}`;
 const recommendedNext=!certainty.terrainEligible?'Match and verify the parcel polygon before relying on terrain or candidate build areas.':!record.sitePlanning?.terrainScreening?.success?'Run the automatic parcel terrain screen, then inspect its low-slope candidate areas.':profile.additionalBuildSite==='unknown'?'Field-check the best low-slope candidate for access, soils, septic, drainage, and setbacks.':'Verify the highest-priority unresolved legal or site-feasibility question.';
 return {headline,summary,why:[...new Set(why)].slice(0,6),worries:[...new Set(worries)].slice(0,4),unknown:[...new Set(unknown)].slice(0,6),recommendedNext,parcelCertainty:certainty,score:turtle.total,confidencePercentage:turtle.confidencePercentage||0,confidenceStatus:turtle.confidenceStatus||'Research incomplete'};
}
function completionSummary({research='skipped',routes=0,scoreBefore=null,scoreAfter=null,reviewCount=0,partial=false}={}){return {status:partial?'partial':'complete',headline:partial?'Property created with items to review':'Property created successfully',items:['Property profile updated',research==='complete'?'Research complete':'Research needs verification',routes>=5?'Routes verified':'Routes need verification',Number.isFinite(scoreBefore)&&Number.isFinite(scoreAfter)?`Score calculated (${Math.round(scoreAfter)})`:'Score calculated',`${reviewCount} ${reviewCount===1?'review item remains':'review items remain'}`]}}
function runRegressionChecks(){
 const routes=[window.OTRoutePolicy.canonicalAirport({routeMinutes:48,routeMiles:36}),{category:'Grocery',routeMinutes:18,routeMiles:12},{category:'Hospital',routeMinutes:24,routeMiles:17},{category:'Home improvement',routeMinutes:26,routeMiles:19},{category:'Costco',routeMinutes:58,routeMiles:48}];
 const base={id:'fixture',name:'Fixture',address:'1 Test Rd, TN',lat:35.4,lng:-84.3,acres:30,price:360000,propertyType:'existing-livable-home',notes:'private wooded property with trails and hunting',destinations:routes,development:{driveway:'unknown',homesite:'unknown',utilities:'unknown'},fieldSources:{},propertyIntelligence:{propertyProfile:{}}};
 const completeDraft={existingResidencePresent:true,existingResidenceLivable:true,residenceStatus:'livable',residenceCondition:'livable',electric:'verified',waterSource:'verified-well',septicOrSewer:'verified',internet:'verified',driveway:'year-round',outbuildings:'barn',additionalBuildSite:'identified',additionalBuildSiteConfidence:'high',secondHomeBuildability:'excellent',secondHomeAccess:'independent',secondHomeSubdivisionPotential:'strong',secondHomeFlexibility:'excellent',secondHomeFlexibilityNote:'Independent rear site.',utilityExtensionDifficulty:'low',multipleResidences:'permitted',woodedOpenMix:'mixed',slopeCharacter:'mixed-moderate',waterFeatureType:'creek',waterFeatureReliability:'verified-year-round',waterFloodRisk:'low'};
 const complete=applyProfileDraft(base,completeDraft).property,shared=applyProfileDraft({...complete,id:'shared'},{secondHomeBuildability:'good',secondHomeAccess:'shared-practical',secondHomeSubdivisionPotential:'difficult',secondHomeFlexibility:'good',secondHomeFlexibilityNote:'Shared access; subdivision remains uncertain.'}).property;
 const raw=applyProfileDraft({...base,id:'raw',propertyType:'raw-land',beds:0,sqft:0},{existingResidencePresent:false,existingResidenceLivable:false,electric:'none',waterSource:'none',septicOrSewer:'none',internet:'none',driveway:'none',additionalBuildSite:'likely',secondHomeBuildability:'unknown',secondHomeAccess:'unknown',secondHomeSubdivisionPotential:'unknown',secondHomeFlexibility:'unknown'}).property;
 const noPath=applyProfileDraft({...complete,id:'no-path',acres:6},{additionalBuildSite:'not-viable',additionalBuildSiteConfidence:'not-viable',secondHomeBuildability:'unlikely',secondHomeAccess:'not-feasible',secondHomeSubdivisionPotential:'unlikely',secondHomeFlexibility:'unlikely',multipleResidences:'not-permitted'}).property;
 const manual=applyProfileDraft({...complete,id:'manual',acres:40,fieldSources:{...complete.fieldSources,acres:'user-confirmed'},destinations:[{...routes[0],source:'user-confirmed',locked:true},...routes.slice(1)]},{secondHomeFlexibility:'good'}).property;
 const refreshed=applyProposals(manual,{acreage:50.61,secondHomeFlexibility:'difficult'},'zillow'),manualRoot=applyManualDraft(complete,{fields:{acres:44,notes:'User confirmed note.'},profile:{driveway:'limited'}}),invalidManual=applyManualDraft(complete,{fields:{acres:-2}}),roundTrip=JSON.parse(JSON.stringify(complete)),research=applyResearchAssessment(complete),summary=completionSummary({research:'partial',routes:5,scoreBefore:50,scoreAfter:70,reviewCount:2,partial:true}),conclusions=propertyConclusions(complete);
 const completeScore=window.OTIntelligence.getTurtleScore(complete),sharedScore=window.OTIntelligence.getTurtleScore(shared),rawScore=window.OTIntelligence.getTurtleScore(raw),noPathScore=window.OTIntelligence.getTurtleScore(noPath),baseScore=window.OTIntelligence.getTurtleScore(base),completeFlex=completeScore.categories.find(item=>item.id==='secondHomeBuildPotential'),sharedFlex=sharedScore.categories.find(item=>item.id==='secondHomeBuildPotential'),rawFlex=rawScore.categories.find(item=>item.id==='secondHomeBuildPotential'),noPathFlex=noPathScore.categories.find(item=>item.id==='secondHomeBuildPotential');
 const unanswered={...raw,id:'review',propertyIntelligence:{...raw.propertyIntelligence,propertyProfile:{...raw.propertyIntelligence.propertyProfile,additionalBuildSite:'unknown'}}},reviewBefore=window.OTIntelligence.dataReview(unanswered),answered=applyProfileDraft(unanswered,{secondHomeFlexibility:'good'}).property,reviewAfter=window.OTIntelligence.dataReview(answered),likelyHome={...base,id:'likely-home',propertyIntelligence:{propertyProfile:{residenceStatus:'likely_livable',existingResidencePresent:true,existingResidenceLivable:null,residenceCondition:'unknown-condition'}}},homeReviewBefore=window.OTIntelligence.dataReview(likelyHome),confirmedHome=applyProfileDraft(likelyHome,{existingResidenceLivable:true,residenceCondition:'livable'}).property,homeReviewAfter=window.OTIntelligence.dataReview(confirmedHome),homeWarningsBefore=window.OTIntelligence.getTurtleScore(likelyHome).categories.find(item=>item.id==='existingHomeInfrastructure').warnings,homeWarningsAfter=window.OTIntelligence.getTurtleScore(confirmedHome).categories.find(item=>item.id==='existingHomeInfrastructure').warnings;
 const requiredRegistry=['acreage','residenceStatus','residenceCondition','residenceSquareFootage','structureArea','yearBuilt','waterSource','waterConnectionStatus','wellStatus','septicStatus','sewerStatus','electricStatus','internet','drivewayStatus','garage','carport','barn','stable','workshop','storage','wooded','private','level','sloped','mountainView','creek','secondHomeBuildability','secondHomeAccess','secondHomeSubdivisionPotential','secondHomeFlexibility','routeRecords'];
 const checks={
  registryHasOneDestination:Object.keys(FIELD_REGISTRY).length===new Set(Object.values(FIELD_REGISTRY)).size,
  canonicalRegistryCoverage:requiredRegistry.every(key=>FIELD_REGISTRY[key]),
  legacyProfileReadFallback:profileForRecord({propertyProfile:{secondHomeFlexibility:'good'}},{}).secondHomeFlexibility==='good',
  canonicalProfileWinsLegacy:profileForRecord({propertyIntelligence:{propertyProfile:{secondHomeFlexibility:'excellent'}}},{propertyIntelligence:{propertyProfile:{secondHomeFlexibility:'difficult'}}}).secondHomeFlexibility==='excellent',
  profileWritesCanonical:complete.propertyIntelligence.propertyProfile.secondHomeFlexibility==='excellent',
  profileRoundTrip:roundTrip.propertyIntelligence.propertyProfile.secondHomeFlexibilityNote==='Independent rear site.',
  everyEditableProfileFieldRoundTrips:PROFILE_FIELDS.every(key=>Object.hasOwn(roundTrip.propertyIntelligence.propertyProfile,key)||completeDraft[key]===undefined),
  developmentResponds:complete.development.homesite==='home'&&complete.development.driveway==='existing'&&complete.development.utilities==='onsite',
  completeFixtureMateriallyImproves:completeScore.total>=baseScore.total+10&&completeScore.overallConfidence==='High',
  completeFixtureHasFewGenuineReviews:window.OTIntelligence.dataReview(complete).count<=3,
  sharedAccessScoresLower:sharedFlex.score<completeFlex.score&&sharedScore.total<completeScore.total,
  sharedAccessNotePersists:shared.propertyIntelligence.propertyProfile.secondHomeFlexibilityNote.includes('Shared access'),
  rawInfrastructureStaysLow:rawScore.categories.find(item=>item.id==='existingHomeInfrastructure').score<5,
  unknownFlexibilityIsNeutralAndLowerConfidence:rawFlex.score>0&&rawFlex.confidence!=='High',
  unlikelyFlexibilityMeaningfullyPenalizes:noPathFlex.score<=2.2&&noPathScore.total<80,
  manualAcreageProtected:refreshed.property.acres===40&&refreshed.conflicts.some(item=>item.field==='acres'),
  manualFlexibilityProtected:refreshed.property.propertyIntelligence.propertyProfile.secondHomeFlexibility==='good'&&refreshed.conflicts.some(item=>item.field.endsWith('secondHomeFlexibility')),
  candidatePreserved:refreshed.property.sourceCandidates.acres?.length===1&&refreshed.property.sourceCandidates['propertyIntelligence.propertyProfile.secondHomeFlexibility']?.length===1,
  manualRouteRemainsLocked:manual.destinations[0].locked===true&&manual.destinations[0].source==='user-confirmed',
  researchDoesNotFabricate:research.missing.includes('Ownership')&&research.property.propertyResearch.provider.includes('Saved facts'),
  completionIsCompact:summary.items.length===5,
  completionUsesPlainOutcomeLanguage:summary.headline==='Property created with items to review'&&summary.items[0]==='Property profile updated',
  manualRootFieldsUseCanonicalStore:manualRoot.property.acres===44&&manualRoot.property.notes==='User confirmed note.'&&manualRoot.property.fieldSources.acres==='user-confirmed',
  manualProfileAndDevelopmentStayConnected:manualRoot.property.propertyIntelligence.propertyProfile.driveway==='limited'&&manualRoot.property.development.driveway==='rough',
  invalidManualDraftDoesNotMutate:invalidManual.errors.length===1&&invalidManual.property.acres===complete.acres,
  conclusionsUseExistingSixCategories:conclusions.length===4&&conclusions.every(item=>['Excellent','Good','Fair','Limited','Needs information'].includes(item.rating)),
  profileAnswerRemovesRelatedReview:reviewBefore.allIssues.some(item=>item.code==='second-site-unknown')&&!reviewAfter.allIssues.some(item=>item.code==='second-site-unknown'),
  confirmedLivabilityUpdatesCanonicalStatus:confirmedHome.propertyIntelligence.propertyProfile.residenceStatus==='livable'&&homeWarningsBefore.some(item=>/confirm current livability/i.test(item))&&!homeWarningsAfter.some(item=>/confirm current livability/i.test(item)),
  allFixtureScoresBounded:[completeScore,sharedScore,rawScore,noPathScore].every(score=>score.total>=0&&score.total<=100)
 };
 return {passed:Object.values(checks).every(Boolean),checks,fixtures:{complete:completeScore.total,shared:sharedScore.total,raw:rawScore.total,noPath:noPathScore.total}}
}
window.OTPropertyWorkflow={VERSION,fieldRegistry:FIELD_REGISTRY,profileFields:PROFILE_FIELDS,manualPropertyFields:MANUAL_PROPERTY_FIELDS,flexibilityOptions:FLEXIBILITY_OPTIONS,canonicalPath,profileForRecord,effectiveInfrastructure,developmentFromProfile,synchronizeRecord,applyProfileDraft,applyManualDraft,applyProposals,parcelCertainty,researchAssessment,applyResearchAssessment,propertyConclusions,decisionSummary,completionSummary,runRegressionChecks};
})();
