/* Operation Turtle Property Intelligence configuration and pure helpers.
   The six-category score is calculated from saved facts until the app explicitly persists a scorecard. */
(function(){
  'use strict';

  // The original, detailed 16-category scorecard remains available under Advanced scoring details.
  const DETAILED_SCORECARD_CATEGORIES=[
    {id:'privacy',label:'Privacy',weight:10,strength:'Excellent privacy'},
    {id:'mountainViews',label:'Mountain Views',weight:6,strength:'Strong mountain views'},
    {id:'buildability',label:'Buildability',weight:10,strength:'Strong build site'},
    {id:'recreation',label:'Recreation',weight:7,strength:'Great recreation potential'},
    {id:'hunting',label:'Hunting',weight:5,strength:'Strong hunting potential'},
    {id:'waterFeatures',label:'Water Features',weight:6,strength:'Notable water features'},
    {id:'roadAccess',label:'Road Access',weight:7,strength:'Strong road access'},
    {id:'utilities',label:'Utilities',weight:9,strength:'Utilities are well positioned'},
    {id:'airportAccess',label:'Airport Access',weight:5,strength:'Convenient airport access'},
    {id:'costcoAccess',label:'Costco Access',weight:4,strength:'Convenient Costco access'},
    {id:'homeDepotAccess',label:'Home Depot Access',weight:4,strength:'Convenient Home Depot access'},
    {id:'lowesAccess',label:"Lowe's Access",weight:4,strength:"Convenient Lowe's access"},
    {id:'groceryAccess',label:'Grocery Access',weight:5,strength:'Convenient grocery access'},
    {id:'hospitalAccess',label:'Hospital Access',weight:5,strength:'Convenient hospital access'},
    {id:'internetAvailability',label:'Internet Availability',weight:7,strength:'Internet availability is promising'},
    {id:'overallFeeling',label:'Overall Feeling',weight:6,strength:'Strong overall fit'}
  ];

  // This is the single authoritative six-category model for the Turtle Score.
  const SIMPLIFIED_SCORECARD_CATEGORIES=[
    {id:'existingHomeInfrastructure',label:'Existing Home & Infrastructure',weight:25},
    {id:'secondHomeBuildPotential',label:'Second-Home Build Potential',weight:20},
    {id:'landCharacterPrivacy',label:'Land Character & Privacy',weight:15},
    {id:'recreationWaterFeatures',label:'Recreation & Water Features',weight:15},
    {id:'locationConvenience',label:'Location & Convenience',weight:15},
    {id:'costRiskPersonalFit',label:'Cost, Risk & Personal Fit',weight:10}
  ];
  const LEGACY_CATEGORY_FALLBACK={
    secondHomeBuildPotential:'landBuildability',
    landCharacterPrivacy:'privacySetting',
    recreationWaterFeatures:'recreationUsability',
    locationConvenience:'locationConvenience',
    costRiskPersonalFit:'developmentCostRisk'
  };
  const LEGACY_CATEGORY_IDS=['landBuildability','privacySetting','recreationUsability','locationConvenience','developmentCostRisk','overallPersonalFit'];
  const STATUS_OPTIONS=['Researching','Interested','Visit Planned','Visited','Offer Submitted','Under Contract','Purchased','Rejected','Archived'];
  const LEGACY_STATUS_MAP={Saved:'Researching',Shortlisted:'Interested',Rejected:'Rejected'};
  const PROFILE_ENUMS={
    residenceCondition:['unknown','livable','minor-work','major-rehabilitation','unknown-condition'],
    electric:['unknown','verified','recorded','available','none'],
    waterSource:['unknown','verified-well','public-water','verified-other','recorded','available','none'],
    septicOrSewer:['unknown','verified','recorded','available','none'],
    internet:['unknown','verified','recorded','available','none'],
    driveway:['unknown','year-round','verified','recorded','limited','none'],
    outbuildings:['unknown','garage','barn','workshop','multiple','none'],
    additionalBuildSite:['unknown','identified','likely','none-identified','not-viable'],
    additionalBuildSiteConfidence:['unknown','high','medium','low','not-viable'],
    secondHomeAccess:['unknown','independent','shared-practical','difficult','not-feasible'],
    utilityExtensionDifficulty:['unknown','low','moderate','high','extreme'],
    multipleResidences:['unknown','permitted','likely','restricted','not-permitted'],
    woodedOpenMix:['unknown','mixed','mostly-wooded','mostly-open','featureless'],
    slopeCharacter:['unknown','mixed-moderate','recreational','steep-limiting','flat-open'],
    waterFeatureType:['unknown','none','seasonal-drainage','creek','spring','pond','river','multiple'],
    waterFeatureReliability:['unknown','verified-year-round','likely','seasonal','unverified'],
    waterFloodRisk:['unknown','none-known','low','moderate','high']
  };
  const clampScore=value=>{
    if(value===''||value===null||value===undefined)return null;
    const number=Number(value);
    return Number.isFinite(number)?Math.max(0,Math.min(10,number)):null;
  };
  const unique=values=>[...new Set(values.filter(Boolean))];
  const confidenceFor=(facts,unknowns=0)=>facts>=5?'High':facts>=3?'Medium':facts>=1?'Low':unknowns?'Not enough information':'Not enough information';
  const plainObject=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const enumValue=(value,options)=>options.includes(value)?value:'unknown';
  const nullableBoolean=value=>value===true||value==='true'||value==='yes'?true:value===false||value==='false'||value==='no'?false:null;
  const scorecardEntry=value=>({score:clampScore(value?.score),notes:typeof value?.notes==='string'?value.notes:'',updatedAt:typeof value?.updatedAt==='string'?value.updatedAt:''});

  function normalizeScorecard(value){
    const source=plainObject(value),ratings={};
    DETAILED_SCORECARD_CATEGORIES.forEach(category=>{ratings[category.id]=scorecardEntry(source.ratings?.[category.id]??source[category.id]);});
    return {version:1,ratings};
  }
  function scorecardHasValues(value){
    const card=normalizeScorecard(value);
    return DETAILED_SCORECARD_CATEGORIES.some(category=>{
      const entry=card.ratings[category.id];
      return entry.score!==null||entry.notes||entry.updatedAt;
    });
  }
  function detailedTurtleScore(record={}){
    const scorecard=normalizeScorecard(record.propertyIntelligence?.scorecard||record.scorecard);
    let total=0,ratedWeight=0,ratedCount=0;
    const categories=DETAILED_SCORECARD_CATEGORIES.map(category=>{
      const rating=scorecard.ratings[category.id];
      const contribution=rating.score===null?0:(rating.score/10)*category.weight;
      if(rating.score!==null){ratedWeight+=category.weight;ratedCount+=1;}
      total+=contribution;
      return {...category,score:rating.score,notes:rating.notes,updatedAt:rating.updatedAt,contribution:Number(contribution.toFixed(2))};
    });
    const score=Number(Math.max(0,Math.min(100,total)).toFixed(2));
    return {total:score,percentage:score,ratedCount,ratedWeight,categories,scorecard};
  }

  // Profile facts are optional and live beside the existing intelligence data. Unknown future fields are retained.
  function normalizePropertyProfile(value){
    const source=plainObject(value),profile={...source,version:1};
    profile.existingResidencePresent=nullableBoolean(source.existingResidencePresent);
    profile.existingResidenceLivable=nullableBoolean(source.existingResidenceLivable);
    const sqft=Number(source.residenceSquareFootage);
    profile.residenceSquareFootage=Number.isFinite(sqft)&&sqft>0?sqft:null;
    Object.entries(PROFILE_ENUMS).forEach(([key,options])=>{profile[key]=enumValue(String(source[key]??'unknown'),options);});
    return profile;
  }
  const profileFor=record=>normalizePropertyProfile(record.propertyIntelligence?.propertyProfile||record.propertyProfile);
  const textFacts=record=>[
    record.notes,...(Array.isArray(record.pros)?record.pros:[]),...(Array.isArray(record.cons)?record.cons:[]),
    record.parcel?.notes,record.locationVerification?.source,record.propertyType,
    ...Object.values(plainObject(record.investment)),...Object.values(plainObject(record.site)),
    ...Object.values(plainObject(record.development)),...Object.values(plainObject(record.infrastructure))
  ].filter(value=>typeof value==='string').join(' ').toLowerCase();
  const includesAny=(text,terms)=>terms.some(term=>text.includes(term));
  const existingStructureRecorded=record=>Boolean(Number(record.beds)||Number(record.sqft)||Number(record.propertyIntelligence?.propertyProfile?.residenceSquareFootage)||/existing-(livable|home|cabin|structure)|cabin|dwelling|residence|home needing renovation|barn|shop/.test(`${record.propertyType||''} ${textFacts(record)}`));
  const practicalHomesiteRecorded=(value,text)=>/home|pad|identified|prepared|build site/.test(value)||includesAny(text,['prepared pad','building pad','build site','homesite']);
  const utilityAccessRecorded=value=>/onsite|roadside|existing|installed|functioning|verified/.test(value);
  const serviceProfileKey={electric:'electric',water:'waterSource',septic:'septicOrSewer',internet:'internet',driveway:'driveway'};
  const serviceLegacyKeys={
    electric:['electric','Electric'],water:['water','Water','well','Well'],septic:['septic','Septic','sewer','Sewer'],
    internet:['internet','Internet','broadband'],driveway:['driveway','Driveway']
  };
  function savedServiceText(record,key){
    const keys=serviceLegacyKeys[key]||[];
    const sources=[plainObject(record.infrastructure),plainObject(record.development),plainObject(record.site),plainObject(record.investment)];
    return sources.flatMap(source=>keys.map(name=>source[name]).filter(value=>value!==undefined&&value!==null&&value!==''))
      .map(value=>String(value).toLowerCase()).join(' ');
  }
  function serviceState(record,profile,key){
    const explicit=profile[serviceProfileKey[key]]||'unknown';
    if(explicit==='none')return 'none';
    if(['verified','verified-well','public-water','verified-other','year-round'].includes(explicit))return 'verified';
    if(explicit==='recorded')return 'recorded';
    if(explicit==='available')return 'available';
    const legacy=savedServiceText(record,key);
    if(/existing|onsite|installed|functioning|verified|year.round/.test(legacy))return 'recorded';
    if(/available|roadside/.test(legacy))return 'available';
    if(/none|not available/.test(legacy))return 'none';
    return 'unknown';
  }
  function serviceContribution(state){return state==='verified'?1:state==='recorded'?.7:state==='available'?.25:state==='none'?-.25:0;}
  function existingHomeFacts(record,profile=profileFor(record)){
    const canonicalType=String(record.propertyType||'').toLowerCase();
    const present=profile.existingResidencePresent===null?existingStructureRecorded(record):profile.existingResidencePresent;
    const livable=profile.existingResidenceLivable===null?canonicalType==='existing-livable-home':profile.existingResidenceLivable;
    const services=Object.fromEntries(Object.keys(serviceProfileKey).map(key=>[key,serviceState(record,profile,key)]));
    const verifiedCount=Object.values(services).filter(value=>value==='verified').length;
    const recordedCount=Object.values(services).filter(value=>value==='verified'||value==='recorded').length;
    return {present,livable,services,verifiedCount,recordedCount,condition:profile.residenceCondition,profile};
  }
  const acreageBase=acres=>{
    if(!Number.isFinite(acres)||acres<=0)return null;
    if(acres<5)return 2;
    if(acres<10)return 3.5;
    if(acres<20)return 5;
    if(acres<30)return 6.2;
    if(acres<=50)return 7;
    return 7.3;
  };
  const routeMinutes=(record,matcher)=>{
    const destinations=Array.isArray(record.destinations)?record.destinations:[];
    const item=destinations.find(candidate=>matcher.test(String(candidate?.name||candidate?.label||candidate?.type||'')));
    if(!item)return null;
    const value=Number(item.routeMinutes??item.durationMinutes??item.drivingMinutes??item.minutes??item.travelMinutes);
    return Number.isFinite(value)&&value>=0?value:null;
  };
  const timeScore=(minutes,type)=>{
    if(!Number.isFinite(minutes))return null;
    if(type==='airport'){if(minutes<=45)return 10;if(minutes<=60)return 8.5;if(minutes<=75)return 7;if(minutes<=90)return 4.5;return 2.5;}
    if(minutes<=20)return 10;if(minutes<=35)return 8;if(minutes<=50)return 6;if(minutes<=70)return 4;return 2.5;
  };
  const explicitAccessRatings=record=>{
    const values=[];
    for(const [label,key] of [['Airport','Airport'],['Shopping','Shopping']]){
      const raw=Number(record.scores?.[key]);
      if(Number.isFinite(raw)&&raw>=0&&raw<=100)values.push({label,score:raw/10});
    }
    return values;
  };
  const AUTO_SCORE_FACT_MAPPING={
    existingHomeInfrastructure:['saved property type and home facts','explicit residence condition','saved electric, water, septic, driveway, internet, and outbuilding facts'],
    secondHomeBuildPotential:['acreage','identified additional build-site facts','site access, utility-extension, restriction, terrain, flood, soil, and septic facts'],
    landCharacterPrivacy:['acreage','wooded/open mix','slope character','privacy, views, road, and neighbor observations'],
    recreationWaterFeatures:['acreage','trails, hunting, woods, usable-land, and water-feature facts','water reliability and flood-risk facts'],
    locationConvenience:['verified routed destination minutes','explicitly saved airport or shopping access ratings'],
    costRiskPersonalFit:['asking price and price per acre','rehabilitation, driveway, utility, well, septic, flood, terrain, and restriction facts','detailed Overall Feeling and visit observations']
  };
  // One registry documents how importer-normalized fields participate in Property Intelligence.
  // It is diagnostic only: no import or startup path writes review metadata into canonical properties.
  const IMPORT_INTELLIGENCE_FIELD_REGISTRY=[
    {field:'price',label:'Asking price',classification:'used-directly-in-scoring',categories:['Cost, Risk & Personal Fit']},
    {field:'acres',label:'Acreage',classification:'used-directly-in-scoring',categories:['Second-Home Build Potential','Land Character & Privacy','Recreation & Water Features']},
    {field:'pricePerAcre',label:'Price per acre',classification:'used-directly-in-scoring',derived:true,categories:['Cost, Risk & Personal Fit']},
    {field:'beds',label:'Bedrooms',classification:'used-directly-in-scoring',categories:['Existing Home & Infrastructure']},
    {field:'sqft',label:'Home square footage',classification:'used-directly-in-scoring',categories:['Existing Home & Infrastructure']},
    {field:'propertyType',label:'Property type',classification:'used-directly-in-scoring',categories:['Existing Home & Infrastructure','Cost, Risk & Personal Fit']},
    {field:'infrastructure',label:'Imported infrastructure facts',classification:'used-directly-in-scoring',categories:['Existing Home & Infrastructure','Second-Home Build Potential','Cost, Risk & Personal Fit']},
    {field:'development',label:'Imported build-site and access facts',classification:'used-directly-in-scoring',categories:['Second-Home Build Potential','Cost, Risk & Personal Fit']},
    {field:'waterFeature',label:'Water feature',classification:'used-directly-in-scoring',categories:['Recreation & Water Features']},
    {field:'terrain',label:'Terrain or topography',classification:'used-directly-in-scoring',categories:['Second-Home Build Potential','Land Character & Privacy','Cost, Risk & Personal Fit']},
    {field:'destinations',label:'Verified routed access',classification:'used-directly-in-scoring',categories:['Location & Convenience']},
    {field:'developmentCost',label:'Estimated site-development cost',classification:'used-directly-in-scoring',categories:['Cost, Risk & Personal Fit']},
    {field:'notes',label:'Existing notes',classification:'used-in-score-confidence',categories:['Land Character & Privacy','Recreation & Water Features','Cost, Risk & Personal Fit']},
    {field:'pros',label:'Imported strengths',classification:'used-in-score-confidence',categories:['Cost, Risk & Personal Fit']},
    {field:'cons',label:'Imported concerns',classification:'used-in-score-confidence',categories:['Cost, Risk & Personal Fit']},
    {field:'baths',label:'Bathrooms',classification:'displayed-not-scored',categories:[]},
    {field:'yearBuilt',label:'Year built',classification:'available-unmapped',categories:['Existing Home & Infrastructure','Cost, Risk & Personal Fit']},
    {field:'listingDescription',label:'Listing description',classification:'available-unmapped',categories:['Land Character & Privacy','Recreation & Water Features']},
    {field:'restrictions',label:'Restrictions',classification:'available-unmapped',categories:['Second-Home Build Potential','Cost, Risk & Personal Fit']},
    {field:'floodInfo',label:'Flood information',classification:'available-unmapped',categories:['Second-Home Build Potential','Cost, Risk & Personal Fit']},
    {field:'internet',label:'Imported internet detail',classification:'available-unmapped',categories:['Existing Home & Infrastructure']},
    {field:'parcel',label:'Parcel ID and county',classification:'displayed-not-scored',categories:[]},
    {field:'coordinates',label:'Coordinates',classification:'displayed-not-scored',categories:[]},
    {field:'photos',label:'Photos',classification:'displayed-not-scored',categories:[]},
    {field:'listing',label:'Listing URL and source',classification:'ignored-intentionally',categories:[]},
    {field:'zillowId',label:'Zillow property ID',classification:'ignored-intentionally',categories:[]}
  ];
  const registryValue=(record,field)=>{
    if(field==='pricePerAcre')return pricePerAcre(record);
    if(field==='coordinates')return Number.isFinite(Number(record.lat))&&Number.isFinite(Number(record.lng))?`${record.lat},${record.lng}`:'';
    if(field==='listingDescription')return record.listingDescription||record.description||'';
    if(field==='floodInfo')return record.floodInfo||record.floodplain||record.floodRisk||'';
    if(field==='internet')return record.internet||record.infrastructure?.internet||'';
    return record[field];
  };
  const meaningfulValue=value=>Array.isArray(value)?value.length>0:value&&typeof value==='object'?Object.keys(value).length>0:typeof value==='number'?Number.isFinite(value)&&value>0:String(value||'').trim()!=='';
  function auditImportFields(record={}){
    const fields=IMPORT_INTELLIGENCE_FIELD_REGISTRY.map(entry=>({...entry,present:meaningfulValue(registryValue(record,entry.field))}));
    const known=new Set(IMPORT_INTELLIGENCE_FIELD_REGISTRY.map(entry=>entry.field));
    const meaningfulUnknown=Object.keys(record).filter(field=>!known.has(field)&&/utility|water|septic|sewer|well|internet|driveway|road|garage|barn|workshop|structure|terrain|wood|clear|creek|stream|pond|spring|river|restriction|flood/i.test(field)&&meaningfulValue(record[field])).map(field=>({field,label:field.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()),classification:'available-unmapped',categories:['Review needed'],present:true}));
    return {fields:[...fields,...meaningfulUnknown],mapped:fields.filter(entry=>entry.present&&entry.classification.startsWith('used-')),unmapped:[...fields,...meaningfulUnknown].filter(entry=>entry.present&&entry.classification==='available-unmapped'),displayed:fields.filter(entry=>entry.present&&entry.classification==='displayed-not-scored'),ignored:fields.filter(entry=>entry.present&&entry.classification==='ignored-intentionally')};
  }
  function dataReview(record={}){
    const profile=profileFor(record),audit=auditImportFields(record),issues=[],add=(code,found,why,category,action='scorecard')=>{if(!issues.some(item=>item.code===code))issues.push({code,found,why,category,action});};
    const type=String(record.propertyType||'').toLowerCase(),hasHome=Boolean(Number(record.beds)||Number(record.sqft)||profile.existingResidencePresent===true);
    if(/raw|vacant|land/.test(type)&&hasHome)add('type-conflict','Property type says vacant/raw land, but home facts are present.','Home readiness and infrastructure scoring may be inconsistent.','Existing Home & Infrastructure','property');
    if(/home|livable|residence|cabin/.test(type)&&profile.existingResidencePresent===null)add('home-unclear','A home-type property has no confirmed residence status.','Immediate livability should not be assumed.','Existing Home & Infrastructure');
    const utilities=['electric','waterSource','septicOrSewer','driveway','internet'];
    if(utilities.some(key=>profile[key]==='unknown')&&(/home|improved|structure/.test(type)||hasHome))add('utilities-unclear','Core utility status is incomplete.','Electric, water, septic, driveway, and internet affect readiness and development risk.','Existing Home & Infrastructure');
    if(profile.additionalBuildSite==='unknown')add('second-site-unknown','Additional-home site is not recorded.','A second-home path is central to the Turtle Score.','Second-Home Build Potential');
    const waterText=String(record.waterFeature||'').toLowerCase();
    if((/creek|stream|pond|spring|river|water/.test(waterText)||/creek|stream|pond|spring|river/.test(String(record.notes||'')))&&profile.waterFeatureReliability==='unknown')add('water-unverified','A water feature is mentioned but reliability is not verified.','Water adds recreation value while reliability and flood exposure affect risk.','Recreation & Water Features');
    const alternateAcres=Number(record.lotAcres??record.acreage??record.parcel?.acres);
    if(Number(record.acres)>0&&Number.isFinite(alternateAcres)&&alternateAcres>0&&Math.abs(Number(record.acres)-alternateAcres)>.2)add('acreage-conflict','Saved acreage differs from another imported acreage value.','Acreage affects land, recreation, price-per-acre, and build-site scoring.','Second-Home Build Potential','property');
    if(!Array.isArray(record.destinations)||!record.destinations.some(item=>Number.isFinite(Number(item?.routeMinutes??item?.durationMinutes??item?.minutes))))add('routes-missing','Verified routed access is missing.','Location convenience uses routed travel times only.','Location & Convenience','routes');
    if(!meaningfulValue(record.developmentCost)&&!meaningfulValue(record.sitePlanning?.costEstimates))add('costs-missing','Site-development cost information is missing.','Unknown driveway, utility, well, septic, and rehabilitation work reduces cost confidence.','Cost, Risk & Personal Fit','property');
    const priority=code=>code==='acreage-conflict'?0:code==='type-conflict'?1:code==='home-unclear'?2:code==='utilities-unclear'?3:code==='second-site-unknown'?4:code==='water-unverified'?5:6;
    issues.sort((a,b)=>priority(a.code)-priority(b.code));
    return {count:issues.length,issues:issues.slice(0,3),audit};
  }

  function ruleExistingHomeInfrastructure(record){
    const profile=profileFor(record),home=existingHomeFacts(record,profile),reasons=[],warnings=[];
    const hasAnyFact=home.present||Object.values(home.services).some(value=>value!=='unknown')||profile.outbuildings!=='unknown';
    if(!hasAnyFact){
      if(String(record.propertyType||'').toLowerCase()==='raw-land')return {autoScore:1.2,confidence:'Medium',reasons:['Saved property type identifies vacant/raw land without recorded infrastructure.'],warnings:['Water, septic, driveway, and internet improvements are not yet confirmed.']};
      return {autoScore:null,confidence:'Not enough information',reasons,warnings:['Existing-home and installed-infrastructure facts are not yet recorded.']};
    }
    let score=home.present?2.1:1.2,facts=0;
    if(home.present){facts++;reasons.push('An existing residence or structure is recorded.');}
    if(home.livable){score+=3;facts++;reasons.push('An existing livable residence is recorded.');}
    else if(home.present)warnings.push('Immediate livability has not been verified.');
    if(profile.residenceCondition==='livable'){score+=1.1;facts++;reasons.push('Residence condition is recorded as livable.');}
    else if(profile.residenceCondition==='minor-work'){score+=.45;facts++;reasons.push('Residence is recorded as needing only minor work.');}
    else if(profile.residenceCondition==='major-rehabilitation'){score-=.9;facts++;warnings.push('Residence requires major rehabilitation.');}
    else if(home.present)warnings.push('Residence condition remains unverified.');
    const serviceLabels={electric:'Electric service',water:'Water source',septic:'Septic or sewer',driveway:'Driveway access',internet:'Internet'};
    Object.entries(home.services).forEach(([key,state])=>{
      // Raw land receives a low readiness score, not an additional negative penalty for each absent service.
      score+=(!home.present&&state==='none')?0:serviceContribution(state);
      if(state==='verified'){facts++;reasons.push(`${serviceLabels[key]} is verified.`);}
      else if(state==='recorded'){facts++;reasons.push(`${serviceLabels[key]} is recorded but still needs verification.`);}
      else if(state==='available')warnings.push(`${serviceLabels[key]} is available, not confirmed installed.`);
      else if(state==='none'){facts++;reasons.push(`${serviceLabels[key]} is confirmed absent.`);}
    });
    if(profile.driveway==='year-round'){score+=.25;facts++;reasons.push('Driveway is recorded as practical year-round access.');}
    if(['garage','barn','workshop','multiple'].includes(profile.outbuildings)){score+=.45;facts++;reasons.push('Useful existing outbuilding value is recorded.');}
    if(profile.utilityExtensionDifficulty==='low'&&['identified','likely'].includes(profile.additionalBuildSite)){score+=.35;facts++;reasons.push('Utilities appear close to a likely second-home site.');}
    if(!home.livable&&home.present&&profile.residenceCondition==='unknown')warnings.push('Do not assume an existing structure can be occupied immediately.');
    const confirmedVacant=home.present===false&&Object.values(home.services).every(state=>state==='none');
    return {autoScore:clampScore(score),confidence:confirmedVacant?'High':confidenceFor(facts,warnings.length),reasons:unique(reasons),warnings:unique(warnings)};
  }

  function ruleSecondHomeBuildPotential(record){
    const profile=profileFor(record),text=textFacts(record),acres=Number(record.acres),reasons=[],warnings=[];
    let score=acreageBase(acres),facts=score===null?0:1;
    if(score===null&&profile.additionalBuildSite==='unknown')return {autoScore:null,confidence:'Not enough information',reasons,warnings:['Acreage and additional-build-site facts are not yet recorded.']};
    score=score??4;
    if(acres>=20){reasons.push('Acreage supports a separate second-home area pending field verification.');}
    else if(Number.isFinite(acres)&&acres<10)warnings.push('Limited acreage may constrain a separate second-home site.');
    const legacySite=plainObject(record.development).homesite||plainObject(record.site).Homesite||plainObject(record.site)['Home Site']||plainObject(record.site).Pad||'';
    const buildSite=profile.additionalBuildSite;
    if(buildSite==='identified'){score+=2.3;facts++;reasons.push('An additional build site is identified.');}
    else if(buildSite==='likely'){score+=1.3;facts++;reasons.push('An additional build site appears likely.');}
    else if(buildSite==='not-viable'){score=1.2;facts++;warnings.push('A realistic additional build site is recorded as not viable.');}
    else if(practicalHomesiteRecorded(String(legacySite).toLowerCase(),text)){score+=.9;facts++;reasons.push('A saved pad or build-site fact supports second-home potential.');}
    else warnings.push('Additional build-site location, soil, and septic feasibility need verification.');
    if(profile.additionalBuildSiteConfidence==='high'){score+=.5;facts++;reasons.push('Build-site confidence is high.');}
    else if(profile.additionalBuildSiteConfidence==='low')warnings.push('Build-site confidence remains low.');
    if(profile.secondHomeAccess==='independent'){score+=.75;facts++;reasons.push('Independent second-home access is recorded.');}
    else if(profile.secondHomeAccess==='shared-practical'){score+=.3;facts++;reasons.push('Practical shared access is recorded.');}
    else if(profile.secondHomeAccess==='difficult'){score-=.9;facts++;warnings.push('Second-home access may require material work.');}
    else if(profile.secondHomeAccess==='not-feasible'){score=1.2;facts++;warnings.push('Second-home access is recorded as not feasible.');}
    if(profile.utilityExtensionDifficulty==='low'){score+=.55;facts++;reasons.push('Utility extension appears manageable.');}
    else if(profile.utilityExtensionDifficulty==='high'){score-=.7;facts++;warnings.push('Utility extension may be difficult.');}
    else if(profile.utilityExtensionDifficulty==='extreme'){score-=1.2;facts++;warnings.push('Utility extension is recorded as extreme.');}
    if(profile.multipleResidences==='permitted'){score+=.7;facts++;reasons.push('Multiple residences are recorded as permitted.');}
    else if(profile.multipleResidences==='likely'){score+=.3;facts++;reasons.push('Multiple residences appear likely, pending confirmation.');}
    else if(profile.multipleResidences==='restricted'){score-=1;facts++;warnings.push('Restrictions may limit a second residence.');}
    else if(profile.multipleResidences==='not-permitted'){score=1.2;facts++;warnings.push('Multiple residences are recorded as not permitted.');}
    if(profile.slopeCharacter==='steep-limiting'){score-=.9;facts++;warnings.push('Steep terrain may limit a second-home site.');}
    if(['moderate','high'].includes(profile.waterFloodRisk)||includesAny(text,['floodplain','drainage concern','septic concern','perc concern'])){score-=.6;facts++;warnings.push('Flood, drainage, soil, or septic feasibility needs review.');}
    return {autoScore:clampScore(score),confidence:confidenceFor(facts,warnings.length),reasons:unique(reasons),warnings:unique(warnings)};
  }

  function ruleLandCharacterPrivacy(record){
    const profile=profileFor(record),text=textFacts(record),acres=Number(record.acres),reasons=[],warnings=[];
    let score=acreageBase(acres),facts=score===null?0:1;
    if(score===null&&!includesAny(text,['privacy','rural','wood','tree','view','mountain','secluded']))return {autoScore:null,confidence:'Not enough information',reasons,warnings:['No acreage or land-character observations are recorded.']};
    score=score??5;
    if(profile.woodedOpenMix==='mixed'){score+=1.25;facts++;reasons.push('A mixed wooded and open-land pattern is recorded.');}
    else if(profile.woodedOpenMix==='mostly-wooded'){score+=.8;facts++;reasons.push('Wooded cover is recorded.');}
    else if(profile.woodedOpenMix==='mostly-open'){score+=.25;facts++;reasons.push('Open usable areas are recorded.');}
    else if(profile.woodedOpenMix==='featureless'){score-=.4;facts++;warnings.push('Land character is recorded as featureless or uniform.');}
    if(['mixed-moderate','recreational'].includes(profile.slopeCharacter)){score+=.8;facts++;reasons.push('Varied or moderate slopes support privacy, views, or recreation.');}
    else if(profile.slopeCharacter==='flat-open'){score-=.15;facts++;warnings.push('Flat open terrain may provide less natural screening.');}
    else if(profile.slopeCharacter==='steep-limiting'){score-=.9;facts++;warnings.push('Excessively steep terrain limits usable areas.');}
    const positives=['privacy','secluded','rural','wood','timber','tree cover','mountain view','view'];
    const negatives=['neighbor','nearby homes','road noise','traffic','visible from road'];
    if(includesAny(text,positives)){score+=.9;facts++;reasons.push('Saved observations describe privacy, cover, rural setting, or views.');}
    if(includesAny(text,negatives)){score-=1;facts++;warnings.push('Saved observations identify a neighbor, visibility, or road-noise concern.');}
    if(acres>=30)reasons.push('Acreage supports separation between uses.');
    if(profile.woodedOpenMix==='unknown')warnings.push('Wooded/open balance and usable areas need field verification.');
    return {autoScore:clampScore(score),confidence:confidenceFor(facts,warnings.length),reasons:unique(reasons),warnings:unique(warnings)};
  }

  function ruleRecreationWaterFeatures(record){
    const profile=profileFor(record),text=textFacts(record),acres=Number(record.acres),reasons=[],warnings=[];
    let score=Number.isFinite(acres)&&acres>0?(acres<10?3.5:acres<20?5:acres<30?6:7):null,facts=score===null?0:1;
    if(score!==null)reasons.push('Acreage provides a starting point for on-site recreation.');
    const recreationTerms=['trail','atv','sxs','hunting','hike','shoot','woods','timber','open ground'];
    if(includesAny(text,recreationTerms)){score=(score??5)+1.15;facts++;reasons.push('Saved observations identify recreation, trails, hunting, woods, or usable ground.');}
    const water=profile.waterFeatureType!=='unknown'?profile.waterFeatureType:String(record.waterFeature||'').toLowerCase();
    if(['creek','spring','pond','river','multiple'].includes(water)){score=(score??5)+(water==='multiple'?1.9:1.3);facts++;reasons.push(`${water==='multiple'?'Multiple water features':water[0].toUpperCase()+water.slice(1)} are recorded.`);}
    else if(water==='seasonal-drainage'||water==='seasonal'){score=(score??5)+.35;facts++;warnings.push('A seasonal drainage feature is recorded; reliability is limited.');}
    if(profile.waterFeatureReliability==='verified-year-round'){score=(score??5)+.75;facts++;reasons.push('Water feature is recorded as verified year-round.');}
    else if(profile.waterFeatureReliability==='unverified')warnings.push('Water-feature reliability remains unverified.');
    if(['mixed-moderate','recreational'].includes(profile.slopeCharacter)){score=(score??5)+.35;facts++;reasons.push('Terrain variety supports recreation.');}
    if(profile.waterFloodRisk==='high')warnings.push('Flood exposure remains a separate cost and risk concern.');
    if(score===null)return {autoScore:null,confidence:'Not enough information',reasons,warnings:['No acreage, recreation, or water-feature facts are recorded.']};
    if(facts<2)warnings.push('Trail, hunting, water, and usable-ground conditions need field verification.');
    return {autoScore:clampScore(score),confidence:confidenceFor(facts,warnings.length),reasons:unique(reasons),warnings:unique(warnings)};
  }

  function ruleLocationConvenience(record){
    const entries=[['Airport',/airport/i,'airport'],["Lowe's",/lowe'?s/i,'service'],['Home Depot',/home depot/i,'service'],['Costco',/costco/i,'service'],['Grocery',/grocery|walmart|supermarket/i,'service'],['Hospital',/hospital/i,'service']];
    const known=[];
    entries.forEach(([label,matcher,type])=>{const minutes=routeMinutes(record,matcher);if(minutes!==null)known.push({label,minutes,score:timeScore(minutes,type),type});});
    const savedRatings=explicitAccessRatings(record);
    if(!known.length&&!savedRatings.length)return {autoScore:null,confidence:'Not enough information',reasons:[],warnings:['No verified routed travel times or explicitly saved access ratings are recorded. Straight-line distances are not used for this score.']};
    const scored=[...known,...savedRatings],score=scored.reduce((total,item)=>total+item.score,0)/scored.length,reasons=[],warnings=[];
    const airport=known.find(item=>item.type==='airport');
    if(airport){
      if(airport.minutes<=45)reasons.push(`Airport routed time is ${airport.minutes} minutes.`);
      else if(airport.minutes<=75)reasons.push(`Airport routed time is ${airport.minutes} minutes and remains competitive.`);
      else warnings.push(`Airport routed time is ${airport.minutes} minutes.`);
    }
    if(known.some(item=>item.label==="Lowe's"))reasons.push("Lowe's has a property-specific routed time.");
    if(savedRatings.length)reasons.push(`Uses ${savedRatings.map(item=>item.label.toLowerCase()).join(' and ')} access rating${savedRatings.length===1?'':'s'} already saved with this property.`);
    const missing=entries.filter(([,matcher])=>routeMinutes(record,matcher)===null).map(([label])=>label);
    if(missing.length)warnings.push(`Missing routed data: ${missing.join(', ')}.`);
    return {autoScore:clampScore(score),confidence:confidenceFor(known.length+savedRatings.length,warnings.length),reasons:unique(reasons),warnings:unique(warnings)};
  }

  function ruleCostRiskPersonalFit(record){
    const profile=profileFor(record),home=existingHomeFacts(record,profile),text=textFacts(record),reasons=[],warnings=[];
    let score=null,facts=0;
    const price=Number(record.price),acres=Number(record.acres),pricePerAcre=price>0&&acres>0?price/acres:null;
    if(Number.isFinite(price)&&price>0){
      score=5;facts++;reasons.push('Asking price is recorded.');
      if(pricePerAcre!==null){
        facts++;reasons.push('Price per acre is included in the cost review.');
        if(pricePerAcre<=10000)score+=.55;
        else if(pricePerAcre<=20000)score+=.2;
        else if(pricePerAcre>60000)score-=.75;
        else if(pricePerAcre>35000)score-=.35;
      }
    }
    const savedValue=Number(record.scores?.Value);
    if(Number.isFinite(savedValue)&&savedValue>=0&&savedValue<=100){score=(score??5)+(savedValue-50)/55;facts++;reasons.push('Saved value assessment is included.');}
    if(home.present&&home.livable&&home.recordedCount>=3){score=(score??5)+.45;facts++;reasons.push('Existing verified or recorded infrastructure reduces initial development risk.');}
    else if(String(record.propertyType||'').toLowerCase()==='raw-land'&&home.recordedCount===0){score=(score??5)-.45;facts++;warnings.push('No installed infrastructure is recorded; readiness and development cost remain uncertain.');}
    if(profile.residenceCondition==='major-rehabilitation'){score=(score??5)-1.15;facts++;warnings.push('Major residence rehabilitation is a material cost risk.');}
    else if(profile.residenceCondition==='minor-work'){score=(score??5)-.25;facts++;warnings.push('Minor residence work should be priced.');}
    if(profile.utilityExtensionDifficulty==='high'){score=(score??5)-.55;facts++;warnings.push('Difficult utility extension is a material cost risk.');}
    else if(profile.utilityExtensionDifficulty==='extreme'){score=(score??5)-1;facts++;warnings.push('Extreme utility extension is a material cost risk.');}
    if(['restricted','not-permitted'].includes(profile.multipleResidences)){score=(score??5)-.8;facts++;warnings.push('Restrictions may affect second-home feasibility and value.');}
    if(['moderate','high'].includes(profile.waterFloodRisk)){score=(score??5)-.7;facts++;warnings.push('Flood or drainage exposure needs cost review.');}
    if(profile.slopeCharacter==='steep-limiting'){score=(score??5)-.6;facts++;warnings.push('Steep terrain may add access and cut-and-fill cost.');}
    const costs=plainObject(record.developmentCost),siteCosts=plainObject(record.site);
    const knownCost=[...Object.entries(costs),...Object.entries(siteCosts)].some(([key,value])=>/total|estimate|expected|low|high|driveway|electric|well|septic/i.test(key)&&/\$|\d/.test(String(value)));
    if(knownCost){score=score??5;facts++;reasons.push('Development-cost inputs are recorded.');}
    if(includesAny(text,['rock','drainage','flood','bridge','retaining','soil','septic concern','permit','restriction'])){score=(score??5)-1;facts++;warnings.push('Known site-cost, drainage, soil, restriction, or permitting risk needs review.');}
    const feeling=clampScore(record.propertyIntelligence?.scorecard?.ratings?.overallFeeling?.score??record.scorecard?.ratings?.overallFeeling?.score);
    if(feeling!==null){score=(score??5)+(feeling-5)*.18;facts++;reasons.push('Saved Overall Feeling is included without replacing cost and risk facts.');}
    const positives=Array.isArray(record.pros)?record.pros.filter(Boolean).length:0,negatives=Array.isArray(record.cons)?record.cons.filter(Boolean).length:0;
    if(positives){score=(score??5)+Math.min(.45,positives*.12);facts++;reasons.push('Personal strengths are recorded.');}
    if(negatives){score=(score??5)-Math.min(.55,negatives*.15);facts++;warnings.push('Personal concerns are recorded.');}
    if(score===null)return {autoScore:null,confidence:'Not enough information',reasons,warnings:['Asking price, development-cost, risk, or personal-fit facts are not yet recorded.']};
    if(!knownCost)warnings.push('Unknown work is not treated as zero cost.');
    return {autoScore:clampScore(score),confidence:confidenceFor(facts,warnings.length),reasons:unique(reasons),warnings:unique(warnings)};
  }

  const RULES={
    existingHomeInfrastructure:ruleExistingHomeInfrastructure,
    secondHomeBuildPotential:ruleSecondHomeBuildPotential,
    landCharacterPrivacy:ruleLandCharacterPrivacy,
    recreationWaterFeatures:ruleRecreationWaterFeatures,
    locationConvenience:ruleLocationConvenience,
    costRiskPersonalFit:ruleCostRiskPersonalFit
  };
  const simplifiedEntry=value=>({
    autoScore:clampScore(value?.autoScore),manualScore:clampScore(value?.manualScore),effectiveScore:clampScore(value?.effectiveScore),
    confidence:['High','Medium','Low','Not enough information'].includes(value?.confidence)?value.confidence:'Not enough information',
    reasons:Array.isArray(value?.reasons)?value.reasons.filter(item=>typeof item==='string').slice(0,8):[],
    warnings:Array.isArray(value?.warnings)?value.warnings.filter(item=>typeof item==='string').slice(0,8):[],
    factsUsed:Array.isArray(value?.factsUsed)?value.factsUsed.filter(item=>typeof item==='string').slice(0,8):[],
    missingFacts:Array.isArray(value?.missingFacts)?value.missingFacts.filter(item=>typeof item==='string').slice(0,8):[],
    recalculatedAt:typeof value?.recalculatedAt==='string'?value.recalculatedAt:'',notes:typeof value?.notes==='string'?value.notes:'',
    updatedAt:typeof value?.updatedAt==='string'?value.updatedAt:'',source:value?.source==='manual'?'manual':'automatic'
  });
  function normalizeSimplifiedScorecard(value){
    const source=plainObject(value),rawCategories=plainObject(source.categories||source),categories={},legacyCategories={};
    SIMPLIFIED_SCORECARD_CATEGORIES.forEach(category=>{categories[category.id]=simplifiedEntry(rawCategories[category.id]);});
    const legacySource={...plainObject(source.legacyCategories),...Object.fromEntries(LEGACY_CATEGORY_IDS.filter(id=>rawCategories[id]).map(id=>[id,rawCategories[id]]))};
    LEGACY_CATEGORY_IDS.forEach(id=>{if(legacySource[id])legacyCategories[id]=simplifiedEntry(legacySource[id]);});
    const passthrough={...source};delete passthrough.categories;delete passthrough.legacyCategories;delete passthrough.version;
    return {...passthrough,version:2,categories,legacyCategories};
  }
  function legacyEntryFor(saved,id){
    const direct=saved.categories[id];
    if(direct&&direct.manualScore!==null)return direct;
    const legacy=saved.legacyCategories[LEGACY_CATEGORY_FALLBACK[id]];
    if(legacy&&legacy.manualScore!==null)return legacy;
    // Old Overall Feeling had no direct successor; retain it as a cost/personal-fit override only if no risk override exists.
    if(id==='costRiskPersonalFit'&&saved.legacyCategories.overallPersonalFit&&saved.legacyCategories.overallPersonalFit.manualScore!==null)return saved.legacyCategories.overallPersonalFit;
    return direct||legacy||simplifiedEntry({});
  }
  function calculateSimplifiedScorecard(record={},existing){
    const saved=normalizeSimplifiedScorecard(existing||record.propertyIntelligence?.simplifiedScorecard||record.simplifiedScorecard),categories={};
    SIMPLIFIED_SCORECARD_CATEGORIES.forEach(category=>{
      const automatic=RULES[category.id](JSON.parse(JSON.stringify(record||{})));
      const prior=legacyEntryFor(saved,category.id);
      const manualScore=prior.manualScore;
      categories[category.id]={...prior,autoScore:automatic.autoScore,manualScore,effectiveScore:manualScore===null?automatic.autoScore:manualScore,
        // A manual score remains authoritative, while confidence continues to describe the saved automatic evidence.
        confidence:automatic.confidence,reasons:automatic.reasons,warnings:automatic.warnings,
        factsUsed:automatic.reasons,missingFacts:automatic.warnings,recalculatedAt:prior.recalculatedAt||'',source:manualScore===null?'automatic':'manual'};
    });
    return {version:2,categories,legacyCategories:saved.legacyCategories};
  }
  function buildOverallExplanation(categories,overallConfidence,safeguards=[]){
    const contributions=categories.map(category=>({
      label:category.label,
      text:category.score===null?`${category.label}: needs more saved facts.`:`${category.label}: ${category.reasons[0]||`${category.score}/10 automatic score.`}`
    }));
    const deductions=unique(categories.flatMap(category=>category.warnings.map(warning=>`${category.label}: ${warning}`))).slice(0,6);
    const missingInformation=unique(categories.filter(category=>category.score===null||category.confidence!=='High').flatMap(category=>category.warnings)).slice(0,6);
    return {contributions,deductions,missingInformation,confidence:overallConfidence,safeguards};
  }
  function hasClearlyImpossibleSecondSite(profile){return profile.additionalBuildSite==='not-viable'||profile.additionalBuildSiteConfidence==='not-viable'||profile.secondHomeAccess==='not-feasible'||profile.multipleResidences==='not-permitted';}
  function simplifiedTurtleScore(record={}){
    const scorecard=calculateSimplifiedScorecard(record),categories=SIMPLIFIED_SCORECARD_CATEGORIES.map(category=>{
      const value=scorecard.categories[category.id];
      return {...category,...value,score:value.effectiveScore,contribution:0};
    });
    const rated=categories.filter(category=>category.score!==null),ratedWeight=rated.reduce((sum,category)=>sum+category.weight,0);
    const rawTotal=ratedWeight?rated.reduce((sum,category)=>sum+(category.score/10)*(category.weight/ratedWeight)*100,0):0;
    categories.forEach(category=>{category.contribution=category.score===null?0:Number(((category.score/10)*(ratedWeight?category.weight/ratedWeight:0)*100).toFixed(2));});
    const critical=categories.filter(category=>['existingHomeInfrastructure','secondHomeBuildPotential','costRiskPersonalFit'].includes(category.id));
    const criticalLow=critical.some(category=>category.confidence==='Low'||category.confidence==='Not enough information');
    const highCount=categories.filter(category=>category.confidence==='High').length;
    // Confidence describes evidence quality only. A missing secondary fact does not lower a well-supported home to Low.
    const overallConfidence=!rated.length||criticalLow?'Low':highCount>=3?'High':'Medium';
    const profile=profileFor(record),safeguards=[];
    let total=rawTotal;
    const home=categories.find(category=>category.id==='existingHomeInfrastructure'),otherRated=categories.filter(category=>category.id!=='existingHomeInfrastructure'&&category.score!==null);
    if(home?.score>=8&&(!otherRated.length||otherRated.every(category=>category.score<6))){
      total=Math.min(total,82);
      safeguards.push('Overall score is capped because an exceptional score cannot rest solely on an existing home and infrastructure.');
    }
    if(hasClearlyImpossibleSecondSite(profile)){
      total=Math.min(total,74);
      safeguards.push('Overall score is capped because the saved facts identify no viable second-home path.');
    }
    total=Number(Math.max(0,Math.min(100,total)).toFixed(2));
    return {total,percentage:total,ratedCount:rated.length,ratedWeight,categories,scorecard,overallConfidence,
      incomplete:rated.length<SIMPLIFIED_SCORECARD_CATEGORIES.length,overallExplanation:buildOverallExplanation(categories,overallConfidence,safeguards)};
  }
  function getTurtleScore(record={}){const simplified=simplifiedTurtleScore(record),detailed=detailedTurtleScore(record);return {...simplified,detailedScorecard:detailed.scorecard,detailedScore:detailed};}
  function displayStatus(status){const value=String(status||'').trim();return STATUS_OPTIONS.includes(value)?value:(LEGACY_STATUS_MAP[value]||'Researching');}
  function statusMatches(record,status){return !status||displayStatus(record?.status)===status;}
  function airportDistance(record={}){const destinations=Array.isArray(record.destinations)?record.destinations:[],airport=destinations.find(item=>/airport/i.test(String(item?.name||item?.label||item?.type||''))),value=Number(airport?.miles??airport?.distanceMiles??airport?.distance);return Number.isFinite(value)&&value>=0?value:null;}
  function pricePerAcre(record={}){const acres=Number(record.acres),price=Number(record.price);return acres>0&&price>=0?price/acres:null;}
  function numericAscending(a,b){const aValid=Number.isFinite(a),bValid=Number.isFinite(b);if(!aValid&&!bValid)return 0;if(!aValid)return 1;if(!bValid)return -1;return a-b;}
  function sortProperties(records=[],sort='turtleScore',{favoritesFirst=false}={}){
    const statusIndex=value=>Math.max(0,STATUS_OPTIONS.indexOf(displayStatus(value)));
    const valueFor=record=>{if(sort==='price')return Number(record.price)||null;if(sort==='pricePerAcre')return pricePerAcre(record);if(sort==='acreage')return Number(record.acres)||null;if(sort==='airportDistance')return airportDistance(record);if(sort==='favorite')return record.favorite?1:0;if(sort==='status')return statusIndex(record.status);return getTurtleScore(record).total;};
    return records.slice().sort((a,b)=>{if(favoritesFirst&&Boolean(a.favorite)!==Boolean(b.favorite))return a.favorite?-1:1;const aValue=valueFor(a),bValue=valueFor(b);if(sort==='price'||sort==='pricePerAcre'||sort==='airportDistance'||sort==='status')return numericAscending(aValue,bValue)||String(a.name||'').localeCompare(String(b.name||''));return numericAscending(bValue,aValue)||String(a.name||'').localeCompare(String(b.name||''));});
  }
  function filterProperties(records=[],filters={}){
    const minimum=value=>{const number=Number(value);return Number.isFinite(number)&&number>0?number:null;};
    const minAcres=minimum(filters.minAcres),minTurtle=minimum(filters.minTurtleScore),minPrice=minimum(filters.minPrice),maxPrice=minimum(filters.maxPrice),maxPricePerAcre=minimum(filters.maxPricePerAcre),county=String(filters.county||'').trim().toLowerCase();
    return records.filter(record=>{const turtle=getTurtleScore(record).total,price=Number(record.price)||0,acres=Number(record.acres)||0,ppa=pricePerAcre(record);return (!minAcres||acres>=minAcres)&&(!minTurtle||turtle>=minTurtle)&&statusMatches(record,filters.status)&&(!filters.favorite||Boolean(record.favorite))&&(!county||String(record.parcel?.county||'').toLowerCase().includes(county))&&(!minPrice||price>=minPrice)&&(!maxPrice||price<=maxPrice)&&(!maxPricePerAcre||(ppa!==null&&ppa<=maxPricePerAcre));});
  }
  function profileBadges(record={}){
    const profile=profileFor(record),home=existingHomeFacts(record,profile),badges=[];
    if(home.present&&home.livable)badges.push('Livable Home');
    if(home.recordedCount>=5)badges.push('Core Utilities');
    if(['identified','likely'].includes(profile.additionalBuildSite))badges.push('Second Site');
    if(['creek','spring','pond','river','multiple'].includes(profile.waterFeatureType))badges.push('Water Feature');
    if(profile.woodedOpenMix==='mixed'||['mixed-moderate','recreational'].includes(profile.slopeCharacter))badges.push('Mixed Terrain');
    if(dataReview(record).count)badges.push('Review Needed');
    return badges;
  }
  function compareRankExplanation(record={},other={}){
    const recordScore=getTurtleScore(record),otherScore=getTurtleScore(other),recordHome=existingHomeFacts(record,profileFor(record)),otherHome=existingHomeFacts(other,profileFor(other));
    if(recordScore.total<=otherScore.total||recordHome.livable||!otherHome.present)return '';
    const reasons=[],recordPpa=pricePerAcre(record),otherPpa=pricePerAcre(other);
    if(recordPpa!==null&&otherPpa!==null&&recordPpa<=otherPpa*.85)reasons.push('substantially lower price per acre');
    const category=(result,id)=>result.categories.find(item=>item.id===id)?.score;
    if((category(recordScore,'secondHomeBuildPotential')||0)>=(category(otherScore,'secondHomeBuildPotential')||0)+.8)reasons.push('confirmed second-home feasibility');
    if((category(recordScore,'locationConvenience')||0)>=(category(otherScore,'locationConvenience')||0)+.8)reasons.push('stronger location');
    if((category(recordScore,'costRiskPersonalFit')||0)>=(category(otherScore,'costRiskPersonalFit')||0)+.8)reasons.push('lower development risk');
    return reasons.length?`Ranks higher because of ${reasons.slice(0,4).join(', ')}.`:'';
  }
  function profileSummary(record={}){
    const profile=profileFor(record),home=existingHomeFacts(record,profile);
    const homeLabel=home.present?(home.livable?'Livable residence recorded':'Residence recorded; livability needs review'):'No existing residence recorded';
    const infrastructure=home.recordedCount?`${home.recordedCount}/5 installed services recorded`:'Installed services not recorded';
    const second={identified:'Identified second build site',likely:'Likely second build site','not-viable':'Second build site not viable'}[profile.additionalBuildSite]||'Second build site needs verification';
    const water=profile.waterFeatureType!=='unknown'&&profile.waterFeatureType!=='none'?`${profile.waterFeatureType.replace(/-/g,' ')} recorded`:'No water feature recorded';
    const landMix={mixed:'Mixed wooded / open', 'mostly-wooded':'Mostly wooded', 'mostly-open':'Mostly open',featureless:'Uniform / featureless'}[profile.woodedOpenMix]||'Wooded/open mix needs review';
    const slope={'mixed-moderate':'Mixed / moderate slopes',recreational:'Recreational slopes','steep-limiting':'Steep / limiting','flat-open':'Flat / open'}[profile.slopeCharacter]||'Slope character needs review';
    const risk=['high','extreme'].includes(profile.utilityExtensionDifficulty)||['moderate','high'].includes(profile.waterFloodRisk)?'Elevated development risk':'Development risk needs review';
    return {home:homeLabel,infrastructure,secondHome:second,water,landMix,slope,risk};
  }
  function strengthsAndWeaknesses(record={}){
    const turtle=getTurtleScore(record),strengths=[],weaknesses=[];
    turtle.categories.filter(category=>category.score!==null&&category.score>=7.5).sort((a,b)=>b.score-a.score).forEach(category=>strengths.push(category.label));
    turtle.categories.forEach(category=>{if(category.score!==null&&category.score<=4)weaknesses.push(`${category.label} needs attention`);weaknesses.push(...category.warnings.slice(0,1));});
    turtle.overallExplanation.safeguards.forEach(item=>weaknesses.push(item));
    if(!turtle.ratedCount)weaknesses.push('Not enough information to calculate a Turtle Score');
    return {strengths:unique(strengths).slice(0,4),weaknesses:unique(weaknesses).slice(0,4)};
  }
  function dashboard(records=[]){
    const totals=records.length?records:[],rated=totals.map(getTurtleScore).filter(result=>result.ratedCount>0),average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null,propertyScores=rated.map(result=>result.total),acres=totals.map(record=>Number(record.acres)||0).filter(value=>value>0),prices=totals.map(record=>Number(record.price)||0).filter(value=>value>0),ppas=totals.map(pricePerAcre).filter(value=>value!==null),statusCounts=Object.fromEntries(STATUS_OPTIONS.map(status=>[status,0]));
    totals.forEach(record=>{statusCounts[displayStatus(record.status)]+=1;});
    return {totalProperties:totals.length,favorites:totals.filter(record=>record.favorite).length,visited:totals.filter(record=>{const status=String(record.visitStatus||'').trim();return status&&!/^not visited$/i.test(status);}).length,averageTurtleScore:average(propertyScores),highestScore:propertyScores.length?Math.max(...propertyScores):null,lowestScore:propertyScores.length?Math.min(...propertyScores):null,statusCounts,averageAcreage:average(acres),averagePrice:average(prices),averagePricePerAcre:average(ppas)};
  }
  function fixtureRecord(name,overrides={}){
    return {id:name,name,address:`${name} Rd`,lat:35.4,lng:-84.3,acres:32,price:360000,propertyType:'raw-land',notes:'private wooded property with trails and hunting',pros:[],cons:[],scores:{Value:60},destinations:[{name:'Airport',routeMinutes:58},{name:"Lowe's",routeMinutes:30},{name:'Home Depot',routeMinutes:35},{name:'Grocery',routeMinutes:22},{name:'Hospital',routeMinutes:34}],propertyIntelligence:{propertyProfile:{}},...overrides};
  }
  function runRegressionChecks(){
    const ideal=fixtureRecord('A',{propertyType:'existing-livable-home',beds:3,sqft:1850,propertyIntelligence:{propertyProfile:{existingResidencePresent:true,existingResidenceLivable:true,residenceCondition:'livable',electric:'verified',waterSource:'verified-well',septicOrSewer:'verified',internet:'verified',driveway:'year-round',outbuildings:'garage',additionalBuildSite:'identified',additionalBuildSiteConfidence:'high',secondHomeAccess:'independent',utilityExtensionDifficulty:'low',multipleResidences:'permitted',woodedOpenMix:'mixed',slopeCharacter:'mixed-moderate',waterFeatureType:'creek',waterFeatureReliability:'verified-year-round',waterFloodRisk:'low'}}});
    const raw=fixtureRecord('B',{price:260000,destinations:[{name:'Airport',routeMinutes:45},{name:"Lowe's",routeMinutes:25},{name:'Home Depot',routeMinutes:30},{name:'Grocery',routeMinutes:20},{name:'Hospital',routeMinutes:30}],propertyIntelligence:{propertyProfile:{existingResidencePresent:false,electric:'none',waterSource:'none',septicOrSewer:'none',internet:'none',driveway:'limited',additionalBuildSite:'identified',additionalBuildSiteConfidence:'high',secondHomeAccess:'independent',utilityExtensionDifficulty:'high',multipleResidences:'likely',woodedOpenMix:'mixed',slopeCharacter:'recreational',waterFeatureType:'creek',waterFeatureReliability:'verified-year-round',waterFloodRisk:'low'}}});
    const noExpansion=fixtureRecord('C',{acres:6,price:325000,propertyType:'existing-livable-home',beds:3,sqft:1500,notes:'near road with limited privacy',propertyIntelligence:{propertyProfile:{existingResidencePresent:true,existingResidenceLivable:true,residenceCondition:'livable',electric:'verified',waterSource:'verified-well',septicOrSewer:'verified',internet:'verified',driveway:'year-round',additionalBuildSite:'not-viable',additionalBuildSiteConfidence:'not-viable',secondHomeAccess:'not-feasible',multipleResidences:'not-permitted',woodedOpenMix:'mostly-open',slopeCharacter:'flat-open',waterFeatureType:'none'}}});
    const rehab=fixtureRecord('D',{propertyType:'existing-home-needing-renovation',beds:2,sqft:1200,propertyIntelligence:{propertyProfile:{existingResidencePresent:true,existingResidenceLivable:false,residenceCondition:'major-rehabilitation',electric:'recorded',waterSource:'recorded',septicOrSewer:'unknown',internet:'unknown',driveway:'recorded',additionalBuildSite:'identified',additionalBuildSiteConfidence:'medium',secondHomeAccess:'shared-practical',utilityExtensionDifficulty:'moderate',multipleResidences:'likely',woodedOpenMix:'mixed',slopeCharacter:'mixed-moderate',waterFeatureType:'none'}}});
    const impractical=fixtureRecord('E',{price:275000,notes:'beautiful private woods creek views with severe access and steep slope',propertyIntelligence:{propertyProfile:{existingResidencePresent:false,electric:'none',waterSource:'none',septicOrSewer:'none',internet:'none',driveway:'none',additionalBuildSite:'not-viable',additionalBuildSiteConfidence:'not-viable',secondHomeAccess:'not-feasible',utilityExtensionDifficulty:'extreme',multipleResidences:'unknown',woodedOpenMix:'mostly-wooded',slopeCharacter:'steep-limiting',waterFeatureType:'creek',waterFeatureReliability:'likely',waterFloodRisk:'high'}}});
    const exceptionalRaw=fixtureRecord('C-exceptional',{price:120000,propertyType:'raw-land',destinations:[{name:'Airport',routeMinutes:30},{name:"Lowe's",routeMinutes:15},{name:'Home Depot',routeMinutes:18},{name:'Grocery',routeMinutes:12},{name:'Hospital',routeMinutes:18}],propertyIntelligence:{propertyProfile:{existingResidencePresent:false,electric:'roadside',waterSource:'roadside',septicOrSewer:'unknown',internet:'roadside',driveway:'year-round',additionalBuildSite:'identified',additionalBuildSiteConfidence:'high',secondHomeAccess:'independent',utilityExtensionDifficulty:'low',multipleResidences:'permitted',woodedOpenMix:'mixed',slopeCharacter:'recreational',waterFeatureType:'creek',waterFeatureReliability:'verified-year-round',waterFloodRisk:'low'}}});
    const poorImproved=fixtureRecord('D-poor',{price:590000,propertyType:'existing-home-needing-renovation',beds:2,sqft:1100,restrictions:'single home only',propertyIntelligence:{propertyProfile:{existingResidencePresent:true,existingResidenceLivable:false,residenceCondition:'major-rehabilitation',electric:'recorded',waterSource:'recorded',septicOrSewer:'unknown',internet:'unknown',driveway:'limited',additionalBuildSite:'not-viable',additionalBuildSiteConfidence:'not-viable',secondHomeAccess:'not-feasible',utilityExtensionDifficulty:'high',multipleResidences:'not-permitted',woodedOpenMix:'mostly-open',slopeCharacter:'flat-open',waterFeatureType:'none',waterFloodRisk:'high'}}});
    const imported=fixtureRecord('E-imported',{yearBuilt:1986,listingDescription:'Creek frontage and a usable workshop',workshopCondition:'unknown',propertyIntelligence:{propertyProfile:{existingResidencePresent:true,electric:'verified',waterSource:'verified-well',septicOrSewer:'verified',driveway:'year-round',additionalBuildSite:'unknown',waterFeatureType:'creek',waterFeatureReliability:'unknown'}}});
    const confirmedVacant=fixtureRecord('F-vacant',{propertyType:'raw-land',propertyIntelligence:{propertyProfile:{existingResidencePresent:false,electric:'none',waterSource:'none',septicOrSewer:'none',internet:'none',driveway:'none',outbuildings:'none',additionalBuildSite:'identified',additionalBuildSiteConfidence:'high',secondHomeAccess:'independent',utilityExtensionDifficulty:'high',multipleResidences:'likely'}}});
    const idealScore=getTurtleScore(ideal),rawScore=getTurtleScore(raw),noExpansionScore=getTurtleScore(noExpansion),rehabScore=getTurtleScore(rehab),impracticalScore=getTurtleScore(impractical),exceptionalRawScore=getTurtleScore(exceptionalRaw),poorImprovedScore=getTurtleScore(poorImproved),confirmedVacantScore=getTurtleScore(confirmedVacant),importAudit=auditImportFields(imported),importReview=dataReview(imported),conflictReview=dataReview({...imported,lotAcres:45});
    const legacyManual=calculateSimplifiedScorecard(ideal,{categories:{landBuildability:{manualScore:2,notes:'legacy manual'}}}),currentManual=calculateSimplifiedScorecard(ideal,{categories:{existingHomeInfrastructure:{manualScore:1,notes:'current manual'}}}),legacyDetailed=detailedTurtleScore({propertyIntelligence:{scorecard:{ratings:{privacy:{score:9,notes:'saved',updatedAt:'2026-07-27'}}}}});
    const base=fixtureRecord('base',{propertyIntelligence:{propertyProfile:{additionalBuildSite:'likely'}}}),complete=getTurtleScore(base),partial=getTurtleScore({id:'OT-002',name:'Partial',address:'2 Test Rd',lat:35.4,lng:-84.3,acres:20}),noData=getTurtleScore({}),unknownAirport=ruleLocationConvenience({...base,destinations:[]}),sorted=sortProperties([ideal,raw],'turtleScore'),filtered=filterProperties([ideal],{minAcres:20,minTurtleScore:1});
    const checks={
      simplifiedWeightsTotal100:SIMPLIFIED_SCORECARD_CATEGORIES.reduce((sum,category)=>sum+category.weight,0)===100,
      allNewCategoriesPresent:SIMPLIFIED_SCORECARD_CATEGORIES.length===6&&Object.keys(AUTO_SCORE_FACT_MAPPING).length===6,
      idealImprovedPropertyRanksFirst:idealScore.total>rawScore.total&&idealScore.total>noExpansionScore.total&&idealScore.total>impracticalScore.total,
      exceptionalRawStillScoresWell:rawScore.total>=70&&rawScore.total<idealScore.total,
      homeWithoutExpansionIsCapped:noExpansionScore.total<=74&&noExpansionScore.overallExplanation.safeguards.length>0,
      rehabilitationGetsPartialInfrastructure:rehabScore.categories.find(category=>category.id==='existingHomeInfrastructure').score>2&&rehabScore.categories.find(category=>category.id==='existingHomeInfrastructure').score<idealScore.categories.find(category=>category.id==='existingHomeInfrastructure').score,
      impracticalLandDoesNotOutrankIdeal:impracticalScore.total<idealScore.total,
      explicitSecondSiteImpossibleIsCapped:impracticalScore.total<=74,
      knownAirportTimeScores:ruleLocationConvenience(base).autoScore!==null,
      unknownAirportStaysUnknown:unknownAirport.autoScore===null&&unknownAirport.confidence==='Not enough information',
      legacyManualOverrideMapped:legacyManual.categories.secondHomeBuildPotential.effectiveScore===2&&legacyManual.categories.secondHomeBuildPotential.source==='manual',
      currentManualOverrideWins:currentManual.categories.existingHomeInfrastructure.effectiveScore===1&&currentManual.categories.existingHomeInfrastructure.source==='manual',
      existingDetailedScorecardSurvives:legacyDetailed.categories.find(category=>category.id==='privacy').score===9,
      missingProfileFieldsStayBackwardCompatible:normalizePropertyProfile({}).existingResidencePresent===null&&getTurtleScore({id:'old',acres:20}).total>=0,
      partialDataStaysBounded:partial.ratedCount>0&&partial.total>=0&&partial.total<=100,
      noScoreableDataStaysEmpty:noData.ratedCount===0&&noData.total===0,
      scoresBounded:[idealScore,rawScore,noExpansionScore,rehabScore,impracticalScore,complete].every(result=>result.total>=0&&result.total<=100),
      sortingAndFilteringUseSimplified:sorted[0]===ideal&&filtered.length===1,
      profileBadgesAreScoped:profileBadges(ideal).includes('Livable Home')&&!profileBadges(raw).includes('Livable Home')
      ,comparableImprovedOutranksVacant:idealScore.total>rawScore.total
      ,exceptionalVacantCanOutrankPoorImproved:exceptionalRawScore.total>poorImprovedScore.total
      ,vacantComparisonExplanationIsDerived:compareRankExplanation(exceptionalRaw,poorImproved).length>0
      ,confirmedVacancyHasHighInfrastructureConfidence:confirmedVacantScore.categories.find(category=>category.id==='existingHomeInfrastructure').confidence==='High'&&confirmedVacantScore.categories.find(category=>category.id==='existingHomeInfrastructure').score<3
      ,importRegistryKeepsTechnicalGapsOutOfUserReview:importAudit.unmapped.some(entry=>entry.field==='yearBuilt')&&importAudit.unmapped.some(entry=>entry.field==='listingDescription')&&!importReview.issues.some(item=>item.code.startsWith('unmapped:'))
      ,reviewFlagsDeduplicateAndDetectConflicts:new Set(importReview.issues.map(item=>item.code)).size===importReview.issues.length&&conflictReview.issues.some(item=>item.code==='acreage-conflict')
      ,manualOverrideKeepsAutomaticConfidence:currentManual.categories.existingHomeInfrastructure.confidence===calculateSimplifiedScorecard(ideal).categories.existingHomeInfrastructure.confidence
      ,reviewIsRuntimeOnly:!Object.keys(imported).some(key=>/review/i.test(key))&&JSON.stringify(imported).length<6000
    };
    return {passed:Object.values(checks).every(Boolean),checks,fixtures:{ideal:idealScore.total,raw:rawScore.total,noExpansion:noExpansionScore.total,rehab:rehabScore.total,impractical:impracticalScore.total,exceptionalRaw:exceptionalRawScore.total,poorImproved:poorImprovedScore.total,confirmedVacant:confirmedVacantScore.total}};
  }
  window.OTIntelligence={
    config:{scorecardCategories:DETAILED_SCORECARD_CATEGORIES,detailedScorecardCategories:DETAILED_SCORECARD_CATEGORIES,simplifiedScorecardCategories:SIMPLIFIED_SCORECARD_CATEGORIES,statusOptions:STATUS_OPTIONS,autoScoreFactMapping:AUTO_SCORE_FACT_MAPPING,importFieldRegistry:IMPORT_INTELLIGENCE_FIELD_REGISTRY,propertyProfileEnums:PROFILE_ENUMS},
    normalizeScorecard,scorecardHasValues,normalizePropertyProfile,normalizeSimplifiedScorecard,calculateSimplifiedScorecard,getDetailedTurtleScore:detailedTurtleScore,getTurtleScore,displayStatus,statusMatches,airportDistance,pricePerAcre,sortProperties,filterProperties,profileBadges,profileSummary,auditImportFields,dataReview,compareRankExplanation,strengthsAndWeaknesses,dashboard,runRegressionChecks
  };
  window.OTPropertyIntelligenceRegressionChecks={run:runRegressionChecks};
})();
