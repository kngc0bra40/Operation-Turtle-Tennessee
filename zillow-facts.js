/* Deterministic Zillow Facts parser and mapper; no fetch, modules, or startup writes. */
(()=>{
  'use strict';
  const VERSION='2.1.0',precedence=window.OTSourcePrecedence;
  const PRIORITY=precedence?.levels||Object.freeze({inferred:0,research:1,listing:2,zillow:2,county:3,'user-confirmed':4});
  const clean=value=>String(value??'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
  const num=value=>{const parsed=Number(String(value).replace(/[^\d.]/g,''));return Number.isFinite(parsed)?parsed:null};
  const LAND_FIELDS=new Set(['wooded','private','levelLand','slopedLand','rollingTerrain','clearedLand','pasture','mountainView','otherViews','creek','stream','spring','pond','river','waterfront','barn','stable','workshop','storageBuilding','shed','garage','detachedGarage','carport','deck','porch','coveredPorch','fencing','fireplace']);
  const PROFILE_FIELDS=new Set(['electric','waterSource','publicWater','well','septicOrSewer','septic','sewer','internet','cable','washerDryerHookups','driveway']);
  const REGISTRY=Object.freeze({beds:'score',fullBathrooms:'score',baths:'score',sqft:'score',structureArea:'score',yearBuilt:'score',newConstruction:'confidence',homeType:'score',propertySubtype:'display',stories:'display',levels:'display',architecturalStyle:'confidence',basement:'confidence',heating:'score',cooling:'score',roof:'confidence',exteriorMaterial:'confidence',fireplace:'display',interiorFeatures:'display',acres:'score',parcelNumber:'display',subdivision:'confidence',hoaStatus:'score',price:'score',pricePerSqft:'display',assessedValue:'score',annualTaxes:'score',dateListed:'display',listingRegion:'display',waterSource:'cost',publicWater:'cost',well:'cost',septicOrSewer:'cost',septic:'cost',sewer:'cost',electric:'score',internet:'score',cable:'confidence',washerDryerHookups:'confidence',driveway:'cost',garage:'score',detachedGarage:'score',carport:'score',parkingSpaces:'confidence',deck:'display',porch:'display',coveredPorch:'display',fencing:'confidence',wooded:'score',private:'score',levelLand:'score',slopedLand:'score',rollingTerrain:'score',clearedLand:'score',pasture:'score',mountainView:'score',otherViews:'confidence',creek:'score',stream:'score',spring:'score',pond:'score',river:'score',waterfront:'score',barn:'score',stable:'score',workshop:'score',storageBuilding:'score',shed:'score',otherStructures:'display'});

  function parse(text=''){
    const raw=String(text||''),facts=[],seen=new Set();
    const add=(field,value,matched='',confidence='medium',ambiguity='')=>{if(value===null||value===''||seen.has(field))return;seen.add(field);facts.push({field,value,normalized:value,matchedText:clean(matched),sourceSection:'Facts & Features',confidence,ambiguityWarning:ambiguity,destinationField:field,classification:REGISTRY[field]||'recognized-unmapped',scoringRelevance:REGISTRY[field]==='score',costRelevance:REGISTRY[field]==='cost'})};
    const capture=(field,pattern,numeric=false)=>{const match=raw.match(pattern);if(match)add(field,numeric?num(match[1]):clean(match[1]),match[0],'high')};
    capture('beds',/(?:Bedrooms?|Beds?)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,true);
    capture('fullBathrooms',/Full bathrooms?\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,true);
    capture('baths',/(?:Total bathrooms?|Bathrooms?|Baths?)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,true);
    capture('sqft',/(?:Living area|Finished area|Living space)\s*[:\-]?\s*([\d,]+)\s*(?:sq\.?\s*ft|Square Feet)?/i,true);
    capture('structureArea',/(?:Structure area|Building area)\s*[:\-]?\s*([\d,]+)\s*(?:sq\.?\s*ft)?/i,true);
    capture('yearBuilt',/Year built\s*[:\-]?\s*(\d{4})/i,true);
    capture('acres',/(?:Lot size|Lot area|Acreage)\s*[:\-]?\s*([\d,.]+)\s*(?:acres?|ac\b)/i,true);
    capture('parcelNumber',/(?:Parcel number|APN|Parcel ID)\s*[:#\-]?\s*([\dA-Z][\dA-Z -]{2,})/i);
    capture('homeType',/(?:Home type|Property type)\s*[:\-]?\s*([^\n•]+)/i);
    capture('propertySubtype',/Property subtype\s*[:\-]?\s*([^\n•]+)/i);
    capture('stories',/Stories\s*[:\-]?\s*([^\n•]+)/i);
    capture('levels',/Levels?\s*[:\-]?\s*([^\n•]+)/i);
    capture('architecturalStyle',/(?:Architectural style|Style)\s*[:\-]?\s*([^\n•]+)/i);
    capture('basement',/Basement\s*[:\-]?\s*([^\n•]+)/i);
    capture('heating',/Heating\s*[:\-]?\s*([^\n•]+)/i);
    capture('cooling',/Cooling\s*[:\-]?\s*([^\n•]+)/i);
    capture('roof',/Roof\s*[:\-]?\s*([^\n•]+)/i);
    capture('exteriorMaterial',/(?:Exterior material|Construction materials?)\s*[:\-]?\s*([^\n•]+)/i);
    capture('interiorFeatures',/Interior features?\s*[:\-]?\s*([^\n•]+)/i);
    capture('parkingSpaces',/(?:Total parking spaces|Parking spaces)\s*[:\-]?\s*(\d+)/i,true);
    capture('price',/(?:List price|Price)\s*[:\-]?\s*\$([\d,]+)/i,true);
    capture('pricePerSqft',/Price per square foot\s*[:\-]?\s*\$([\d,.]+)/i,true);
    capture('assessedValue',/Assessed value\s*[:\-]?\s*\$?([\d,]+)/i,true);
    capture('annualTaxes',/(?:Annual taxes|Property taxes?)\s*[:\-]?\s*\$?([\d,]+)/i,true);
    capture('dateListed',/Date listed\s*[:\-]?\s*([^\n•]+)/i);
    capture('listingRegion',/Listing region\s*[:\-]?\s*([^\n•]+)/i);
    capture('subdivision',/Subdivision\s*[:\-]?\s*([^\n•]+)/i);
    if(/\bnew construction\b/i.test(raw))add('newConstruction',/\bnot new construction\b/i.test(raw)?'no':'yes','new construction');
    const bools={garage:/\b(?:attached )?garage\b/i,detachedGarage:/\bdetached garage\b/i,carport:/\bcarport\b/i,deck:/\bdeck\b/i,porch:/\bporch\b/i,coveredPorch:/\bcovered porch\b/i,fencing:/\b(?:partial(?:ly)? fenced|fencing|fenced)\b/i,wooded:/\bwooded\b/i,private:/\bprivate\b/i,levelLand:/\blevel\b/i,slopedLand:/\bsloped?\b/i,rollingTerrain:/\brolling\b/i,clearedLand:/\bcleared\b/i,pasture:/\bpasture\b/i,mountainView:/\bmountain(?:s)?(?: view)?\b/i,otherViews:/\bviews?\b/i,creek:/\bcreek\b/i,stream:/\bstream\b/i,spring:/\bspring\b/i,pond:/\bpond\b/i,river:/\briver(?: frontage)?\b/i,waterfront:/\bwaterfront\b/i,barn:/\bbarns?\b/i,stable:/\bstables?\b/i,workshop:/\b(?:workshop|shop building)\b/i,storageBuilding:/\bstorage(?: building)?\b/i,shed:/\bsheds?\b/i,fireplace:/\bfireplaces?\b/i};
    Object.entries(bools).forEach(([field,pattern])=>{const match=raw.match(pattern);if(match)add(field,'yes',match[0])});
    const publicWater=raw.match(/[^\n.]*\b(?:public water|city water|water\s*:\s*public|water available)\b[^\n.]*/i);
    const well=raw.match(/[^\n.]*\b(?:private )?well\b[^\n.]*/i);
    if(publicWater){const line=publicWater[0],state=/\b(?:public water|city water)[^\n.]*(?:connected|served by|service active|in use)|(?:connected|served by|service active|in use)[^\n.]*(?:public water|city water)/i.test(raw)?'connected':/\bwater available\b/i.test(raw)?'available':'recorded';add('publicWater',state,line,'medium',state==='connected'?'':'Connection is not confirmed.');add('waterSource',state==='connected'?'public-water':state,line,'medium',state==='connected'?'':'Availability is not a confirmed connection.')}
    if(well){const line=well[0],state=/functioning|active|in use|tested/i.test(line)?'verified':'recorded';add('well',state,line,'medium',state==='verified'?'':'Well function should be verified.');if(!seen.has('waterSource'))add('waterSource',state==='verified'?'verified-well':'recorded',line)}
    const septic=raw.match(/[^\n.]*\bseptic(?: tank| system)?\b[^\n.]*/i),sewer=raw.match(/[^\n.]*\b(?:public )?sewer\b[^\n.]*/i);
    if(septic){const line=septic[0],state=/connected|functioning|in use|tested/i.test(line)?'verified':'recorded';add('septic',state,line,'medium',state==='verified'?'':'Condition and capacity should be verified.');add('septicOrSewer',state,line)}
    if(sewer){const line=sewer[0],state=/connected|service active|in use/i.test(line)?'verified':'available';add('sewer',state,line,'medium',state==='verified'?'':'Availability is not a connection.');if(!seen.has('septicOrSewer'))add('septicOrSewer',state,line)}
    const electric=raw.match(/[^\n.]*\b(?:electric|electricity|power)\b[^\n.]*/i);if(electric)add('electric',/active|connected|service on|on site/i.test(electric[0])?'verified':'available',electric[0]);
    const internet=raw.match(/[^\n.]*\b(?:high[- ]speed internet|fiber|internet)\b[^\n.]*/i);if(internet)add('internet',/connected|active|installed|fiber service/i.test(internet[0])?'verified':'available',internet[0]);
    const cable=raw.match(/[^\n.]*\bcable(?: connected| internet)?\b[^\n.]*/i);if(cable)add('cable',/connected|active|installed/i.test(cable[0])?'verified':'available',cable[0]);
    const laundry=raw.match(/[^\n.]*\bwasher(?:\s*(?:and|\/)\s*dryer)? hookups?\b[^\n.]*/i);if(laundry)add('washerDryerHookups','recorded',laundry[0]);
    const drive=raw.match(/[^\n.]*\bdriveway\b[^\n.]*/i);if(drive)add('driveway',/paved|year.round|existing/i.test(drive[0])?'recorded':'unknown',drive[0]);
    if(/\bno hoa\b|hoa\s*[:\-]\s*(?:none|no)/i.test(raw))add('hoaStatus','none',raw.match(/\bno hoa\b|hoa\s*[:\-]\s*(?:none|no)/i)[0]);
    const otherStructure=raw.match(/(?:Other structures?|Other improvements?)\s*[:\-]?\s*([^\n•]+)/i);if(otherStructure)add('otherStructures',clean(otherStructure[1]),otherStructure[0]);
    return {version:VERSION,rawText:raw,facts,found:facts.length,unsupported:Math.max(0,raw.split(/\n|•/).filter(line=>clean(line)).length-facts.length)};
  }

  function applyToProperty(record,parsed,{decisions={}}={}){
    const next=structuredClone(record),profile={...(next.propertyIntelligence?.propertyProfile||{})},land={...(next.propertyIntelligence?.zillowLand||{})},sources={...(next.fieldSources||{})},conflicts=[],updated=[],matching=[];
    const current=field=>PROFILE_FIELDS.has(field)?profile[field]:LAND_FIELDS.has(field)?land[field]:next[field];
    const assign=(field,value)=>{if(PROFILE_FIELDS.has(field))profile[field]=value;else if(LAND_FIELDS.has(field))land[field]=value;else next[field]=value};
    for(const fact of parsed?.facts||[]){
      const old=current(fact.field),oldSource=sources[fact.field]||(precedence?.isBlank(old)?'inferred':'user-confirmed'),decision=precedence?.canReplace(old,oldSource,fact.value,'zillow',{explicit:decisions[fact.field]==='zillow'})||{allowed:old===undefined||old==='',matching:String(old)===String(fact.value),source:'zillow'};
      if(decision.matching){matching.push(fact.field);continue}
      if(!decision.allowed){conflicts.push({field:fact.field,label:fact.field,existing:old,candidate:fact.value,source:oldSource,protected:(precedence?.priority(oldSource)||0)>=(precedence?.priority('county')||3)});precedence?.preserveCandidate(next,fact.field,fact.value,'zillow','rejected');continue}
      assign(fact.field,fact.value);sources[fact.field]=decision.source||'zillow';updated.push(fact.field);
    }
    const homeSignals=['beds','baths','sqft','structureArea','yearBuilt','homeType'].filter(field=>parsed?.facts?.some(fact=>fact.field===field));
    if(homeSignals.length>=2&&profile.existingResidencePresent==null){profile.existingResidencePresent=true;profile.existingResidenceLivable=null;profile.residenceCondition='unknown-condition';profile.residenceLivability='likely-needs-review';profile.residenceDataSource='Zillow';profile.residenceFactsUsed=homeSignals;sources.existingResidencePresent='zillow';updated.push('existingResidencePresent')}
    if(land.wooded==='yes'&&(land.levelLand==='yes'||land.clearedLand==='yes'))profile.woodedOpenMix='mixed';else if(land.wooded==='yes')profile.woodedOpenMix='mostly-wooded';
    if(land.levelLand==='yes'&&land.slopedLand==='yes')profile.slopeCharacter='mixed-moderate';else if(land.slopedLand==='yes'||land.rollingTerrain==='yes')profile.slopeCharacter='recreational';else if(land.levelLand==='yes')profile.slopeCharacter='flat-open';
    const waterType=land.creek==='yes'?'creek':land.stream==='yes'?'stream':land.spring==='yes'?'spring':land.pond==='yes'?'pond':land.river==='yes'?'river':'unknown';
    if(waterType!=='unknown'){profile.waterFeatureType=waterType;if(profile.waterFeatureReliability==='unknown'||!profile.waterFeatureReliability)profile.waterFeatureReliability='unverified';if(!next.waterFeature||next.waterFeature==='Unknown')next.waterFeature=waterType[0].toUpperCase()+waterType.slice(1)}
    const structures=['garage','detachedGarage','carport','barn','stable','workshop','storageBuilding','shed'].filter(field=>land[field]==='yes');
    if(structures.length)profile.outbuildings=structures.length>1?'multiple':structures[0].toLowerCase().includes('garage')?'garage':structures[0]==='workshop'?'workshop':'barn';
    const propertyTypeDecision=precedence?.canReplace(next.propertyType,sources.propertyType,'existing-home-renovation','zillow')||{allowed:false};
    if(profile.existingResidencePresent&&propertyTypeDecision.allowed){next.propertyType='existing-home-renovation';sources.propertyType=propertyTypeDecision.source||'zillow';updated.push('propertyType')}
    else if(profile.existingResidencePresent&&/raw|vacant|land/i.test(String(next.propertyType||'')))precedence?.preserveCandidate(next,'propertyType','existing-home-renovation','zillow','rejected');
    if(next.parcelNumber&&!next.parcel?.parcelId){next.parcel={...(next.parcel||{}),parcelId:String(next.parcelNumber)};sources['parcel.parcelId']=sources.parcelNumber||'zillow';updated.push('parcel.parcelId')}
    const existingSite={...(next.site||{})},setSite=(key,value,sourceField)=>{if(!value||!precedence?.isBlank(existingSite[key])&&!/^(?:tbd|unknown|not recorded)$/i.test(String(existingSite[key])))return;existingSite[key]=value;sources[`site.${key}`]=sources[sourceField]||'zillow';updated.push(`site.${key}`)};
    setSite('Well',profile.waterSource==='public-water'?'Public water connected':profile.waterSource==='verified-well'?'Existing well verified':profile.waterSource==='available'?'Public water available — verify connection':profile.waterSource==='recorded'?'Water source listed — verify':null,'waterSource');
    setSite('Septic',profile.septicOrSewer==='verified'?'Existing septic / sewer verified':profile.septicOrSewer==='available'?'Sewer available — verify connection':profile.septicOrSewer==='recorded'?'Septic / sewer listed — inspect':null,'septicOrSewer');
    setSite('Electric',profile.electric==='verified'?'Existing electric verified':profile.electric==='available'?'Electric available — verify connection':profile.electric==='recorded'?'Electric listed — verify':null,'electric');
    setSite('Driveway',['year-round','verified'].includes(profile.driveway)?'Existing driveway verified':profile.driveway==='recorded'?'Driveway listed — verify condition':null,'driveway');
    next.site=existingSite;next.development={...(next.development||{})};if(profile.existingResidencePresent&&['',null,undefined,'unknown'].includes(next.development.homesite)){next.development.homesite='home';sources['development.homesite']='zillow';updated.push('development.homesite')}
    next.infrastructure={...(next.infrastructure||{}),electric:profile.electric==='verified'?'onsite':profile.electric||next.infrastructure?.electric,well:profile.waterSource==='verified-well'?'existing':profile.waterSource||next.infrastructure?.well,septic:profile.septicOrSewer==='verified'?'existing':profile.septicOrSewer||next.infrastructure?.septic,driveway:['year-round','verified'].includes(profile.driveway)?'existing':profile.driveway||next.infrastructure?.driveway,structures:structures.length?'recorded':next.infrastructure?.structures};
    next.developmentCost={...(next.developmentCost||{})};
    if(profile.waterSource==='verified-well'||profile.waterSource==='public-water')next.developmentCost.well='not-needed-existing-service';else if(['recorded','available'].includes(profile.waterSource))next.developmentCost.well='existing-unverified';
    if(profile.septicOrSewer==='verified')next.developmentCost.septic='not-needed-existing-service';else if(['recorded','available'].includes(profile.septicOrSewer))next.developmentCost.septic='existing-unverified';
    next.propertyIntelligence={...(next.propertyIntelligence||{}),propertyProfile:profile,zillowLand:land};next.fieldSources=sources;
    return {property:next,updated:[...new Set(updated)],matching:[...new Set(matching)],conflicts,reviewItems:buildReview(next,conflicts)};
  }
  function buildReview(property,conflicts=[]){
    const profile=property.propertyIntelligence?.propertyProfile||{},items=[],add=(code,issue,why,category)=>{if(!items.some(item=>item.code===code))items.push({code,issue,why,category})};
    if(profile.existingResidencePresent&&profile.existingResidenceLivable!==true)add('livability','Confirm whether the residence is currently livable.','Listing facts establish a home, not its condition.','Existing Home & Infrastructure');
    if(['recorded','available'].includes(profile.waterSource))add('water-connection','Confirm whether water is connected and functioning.','Availability does not remove installation risk.','Existing Home & Infrastructure');
    if(['recorded','available'].includes(profile.septicOrSewer))add('septic-condition','Confirm septic or sewer connection and condition.','A listing mention does not verify function or capacity.','Existing Home & Infrastructure');
    if(profile.additionalBuildSite==='unknown'||!profile.additionalBuildSite)add('second-site','Evaluate a legal and practical second-home site.','Acreage and terrain are context, not buildability proof.','Second-Home Build Potential');
    conflicts.slice(0,2).forEach(conflict=>add(`conflict-${conflict.field}`,`Resolve the imported ${conflict.field} conflict.`,'The saved and Zillow values differ.','Property Details'));
    return items.slice(0,3);
  }
  function runRegressionChecks(){
    const text='Lot size: 50.61 acres\nBedrooms: 2\nFull bathrooms: 2\nBathrooms: 2\nLiving area: 1,152 sqft\nStructure area: 1,152 sqft\nYear built: 2018\nHome type: Single-family ranch\nHeating: Central\nCooling: Central air\nRoof: Metal\nParking: Detached two-space carport\nDeck, covered porch, partial fencing\nMountain views\nWaterfront: Creek\nLevel, Private, Sloped, Wooded, Views\nBarns, Stables, Storage\nSeptic Tank\nWater: Public\nWater available\nCable Connected, High Speed Internet\nNo HOA\nParcel number: 077 04200 000\nAnnual taxes: $629\nAssessed value: $249,900';
    const parsed=parse(text),mapped=applyToProperty({id:'fixture',lat:35,lng:-84,propertyType:'raw-land',fieldSources:{propertyType:'inferred'},developmentCost:{well:'allowance',septic:'allowance'},propertyIntelligence:{propertyProfile:{}}},parsed),fields=new Set(parsed.facts.map(fact=>fact.field));
    const protectedRecord={id:'protected',lat:35,lng:-84,acres:40,fieldSources:{acres:'user-confirmed'},propertyIntelligence:{propertyProfile:{}}},protectedMap=applyToProperty(protectedRecord,parse('Lot size: 50.61 acres'));
    const checks={fixtureCoverage:['acres','beds','fullBathrooms','baths','sqft','structureArea','yearBuilt','homeType','heating','cooling','roof','carport','deck','coveredPorch','fencing','mountainView','creek','levelLand','private','slopedLand','wooded','barn','stable','storageBuilding','septicOrSewer','waterSource','publicWater','internet','cable','hoaStatus','parcelNumber','annualTaxes','assessedValue'].every(field=>fields.has(field)),mappedHome:mapped.property.propertyIntelligence.propertyProfile.existingResidencePresent===true&&mapped.property.propertyIntelligence.propertyProfile.existingResidenceLivable===null&&mapped.property.propertyType==='existing-home-renovation',mappedLand:mapped.property.propertyIntelligence.propertyProfile.woodedOpenMix==='mixed'&&mapped.property.propertyIntelligence.propertyProfile.slopeCharacter==='mixed-moderate',mappedWater:mapped.property.propertyIntelligence.propertyProfile.waterFeatureType==='creek'&&mapped.property.propertyIntelligence.propertyProfile.waterSource==='available',parcelMapped:mapped.property.parcel?.parcelId==='077 04200 000',developmentAssumptions:mapped.property.development.homesite==='home'&&/available/.test(mapped.property.site.Well)&&/inspect/.test(mapped.property.site.Septic),costResponds:mapped.property.developmentCost.septic==='existing-unverified',structuresMapped:['carport','barn','stable','storageBuilding'].every(field=>mapped.property.propertyIntelligence.zillowLand[field]==='yes'),manualValueProtected:protectedMap.property.acres===40&&protectedMap.conflicts.some(conflict=>conflict.field==='acres'),rejectedCandidateStored:protectedMap.property.sourceCandidates.acres.length===1,reviewsFocused:mapped.reviewItems.length<=3,noUnmappedUserWarnings:mapped.reviewItems.every(item=>!/mapped|unsupported|parser/i.test(item.issue)),idempotent:applyToProperty(mapped.property,parsed).updated.length===0};
    return {passed:Object.values(checks).every(Boolean),checks,parsed:[...fields],updated:mapped.updated,reviewItems:mapped.reviewItems};
  }
  window.OTZillowFacts={VERSION,PRIORITY,REGISTRY,parse,applyToProperty,buildReview,runRegressionChecks};
})();
