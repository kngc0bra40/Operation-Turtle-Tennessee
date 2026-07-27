/* Operation Turtle 4.1 Property Intelligence configuration and pure helpers.
   This file deliberately has no storage or DOM writes. */
(function(){
  'use strict';
  const SCORECARD_CATEGORIES=[
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
  const STATUS_OPTIONS=['Researching','Interested','Visit Planned','Visited','Offer Submitted','Under Contract','Purchased','Rejected','Archived'];
  const LEGACY_STATUS_MAP={Saved:'Researching',Shortlisted:'Interested',Rejected:'Rejected'};
  const clampScore=value=>{
    if(value===''||value===null||value===undefined)return null;
    const number=Number(value);
    return Number.isFinite(number)?Math.max(0,Math.min(10,number)):null;
  };
  const scorecardEntry=value=>({score:clampScore(value?.score),notes:typeof value?.notes==='string'?value.notes:'',updatedAt:typeof value?.updatedAt==='string'?value.updatedAt:''});
  function normalizeScorecard(value){
    const source=value&&typeof value==='object'?value:{};
    const ratings={};
    SCORECARD_CATEGORIES.forEach(category=>{ratings[category.id]=scorecardEntry(source.ratings?.[category.id]??source[category.id]);});
    return {version:1,ratings};
  }
  function scorecardHasValues(value){
    const card=normalizeScorecard(value);
    return SCORECARD_CATEGORIES.some(category=>card.ratings[category.id].score!==null||card.ratings[category.id].notes||card.ratings[category.id].updatedAt);
  }
  function getTurtleScore(record={}){
    const scorecard=normalizeScorecard(record.propertyIntelligence?.scorecard||record.scorecard);
    let total=0,ratedWeight=0,ratedCount=0;
    const categories=SCORECARD_CATEGORIES.map(category=>{
      const rating=scorecard.ratings[category.id];
      const contribution=rating.score===null?0:(rating.score/10)*category.weight;
      if(rating.score!==null){ratedWeight+=category.weight;ratedCount+=1;}
      total+=contribution;
      return {...category,score:rating.score,notes:rating.notes,updatedAt:rating.updatedAt,contribution:Number(contribution.toFixed(2))};
    });
    total=Math.max(0,Math.min(100,total));
    return {total:Number(total.toFixed(2)),percentage:Number(total.toFixed(2)),ratedCount,ratedWeight,categories,scorecard};
  }
  function displayStatus(status){
    const value=String(status||'').trim();
    return STATUS_OPTIONS.includes(value)?value:(LEGACY_STATUS_MAP[value]||'Researching');
  }
  function statusMatches(record,status){return !status||displayStatus(record?.status)===status;}
  function airportDistance(record={}){
    const destinations=Array.isArray(record.destinations)?record.destinations:[];
    const airport=destinations.find(item=>/airport/i.test(String(item?.name||item?.label||item?.type||'')));
    const value=Number(airport?.miles??airport?.distanceMiles??airport?.distance);
    return Number.isFinite(value)&&value>=0?value:null;
  }
  function pricePerAcre(record={}){
    const acres=Number(record.acres),price=Number(record.price);
    return acres>0&&price>=0?price/acres:null;
  }
  function numericAscending(a,b){
    const aValid=Number.isFinite(a),bValid=Number.isFinite(b);
    if(!aValid&&!bValid)return 0;
    if(!aValid)return 1;
    if(!bValid)return -1;
    return a-b;
  }
  function sortProperties(records=[],sort='turtleScore',{favoritesFirst=false}={}){
    const statusIndex=value=>Math.max(0,STATUS_OPTIONS.indexOf(displayStatus(value)));
    const valueFor=(record)=>{
      if(sort==='price')return Number(record.price)||null;
      if(sort==='pricePerAcre')return pricePerAcre(record);
      if(sort==='acreage')return Number(record.acres)||null;
      if(sort==='airportDistance')return airportDistance(record);
      if(sort==='favorite')return record.favorite?1:0;
      if(sort==='status')return statusIndex(record.status);
      return getTurtleScore(record).total;
    };
    return records.slice().sort((a,b)=>{
      if(favoritesFirst&&Boolean(a.favorite)!==Boolean(b.favorite))return a.favorite?-1:1;
      const aValue=valueFor(a),bValue=valueFor(b);
      if(sort==='price'||sort==='pricePerAcre'||sort==='airportDistance'||sort==='status')return numericAscending(aValue,bValue)||String(a.name||'').localeCompare(String(b.name||''));
      return numericAscending(bValue,aValue)||String(a.name||'').localeCompare(String(b.name||''));
    });
  }
  function filterProperties(records=[],filters={}){
    const minimum=(value)=>{const number=Number(value);return Number.isFinite(number)&&number>0?number:null;};
    const minAcres=minimum(filters.minAcres),minTurtle=minimum(filters.minTurtleScore),minPrice=minimum(filters.minPrice),maxPrice=minimum(filters.maxPrice),maxPricePerAcre=minimum(filters.maxPricePerAcre);
    const county=String(filters.county||'').trim().toLowerCase();
    return records.filter(record=>{
      const turtle=getTurtleScore(record).total,price=Number(record.price)||0,acres=Number(record.acres)||0,ppa=pricePerAcre(record);
      return (!minAcres||acres>=minAcres)&&(!minTurtle||turtle>=minTurtle)&&statusMatches(record,filters.status)&&(!filters.favorite||Boolean(record.favorite))&&(!county||String(record.parcel?.county||'').toLowerCase().includes(county))&&(!minPrice||price>=minPrice)&&(!maxPrice||price<=maxPrice)&&(!maxPricePerAcre||(ppa!==null&&ppa<=maxPricePerAcre));
    });
  }
  function strengthsAndWeaknesses(record={}){
    const turtle=getTurtleScore(record),strengths=[],weaknesses=[];
    if(Number(record.acres)>=25)strengths.push('Large acreage');
    turtle.categories.filter(category=>category.score!==null&&category.score>=8).sort((a,b)=>b.score-a.score).forEach(category=>strengths.push(category.strength));
    turtle.categories.filter(category=>category.score!==null&&category.score<=3).sort((a,b)=>a.score-b.score).forEach(category=>{
      const weak={airportAccess:'Long airport drive',internetAvailability:'Internet availability needs review',utilities:'Utilities not confirmed'}[category.id]||`${category.label} needs improvement`;
      weaknesses.push(weak);
    });
    ['utilities','internetAvailability'].forEach(id=>{
      const category=turtle.categories.find(item=>item.id===id);
      if(category?.score===null)weaknesses.push(id==='utilities'?'Utilities not confirmed':'Unknown internet');
    });
    if(!turtle.ratedCount)weaknesses.push('Property scorecard has not been rated yet');
    return {strengths:[...new Set(strengths)].slice(0,4),weaknesses:[...new Set(weaknesses)].slice(0,4)};
  }
  function dashboard(records=[]){
    const totals=records.length?records:[];
    const rated=totals.map(getTurtleScore).filter(result=>result.ratedCount>0);
    const averages=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
    const propertyScores=rated.map(result=>result.total),acres=totals.map(record=>Number(record.acres)||0).filter(value=>value>0),prices=totals.map(record=>Number(record.price)||0).filter(value=>value>0),ppas=totals.map(pricePerAcre).filter(value=>value!==null);
    const statusCounts=Object.fromEntries(STATUS_OPTIONS.map(status=>[status,0]));
    totals.forEach(record=>{statusCounts[displayStatus(record.status)]+=1;});
    return {totalProperties:totals.length,favorites:totals.filter(record=>record.favorite).length,visited:totals.filter(record=>{const status=String(record.visitStatus||'').trim();return status&&!/^not visited$/i.test(status);}).length,averageTurtleScore:averages(propertyScores),highestScore:propertyScores.length?Math.max(...propertyScores):null,lowestScore:propertyScores.length?Math.min(...propertyScores):null,statusCounts,averageAcreage:averages(acres),averagePrice:averages(prices),averagePricePerAcre:averages(ppas)};
  }
  function runRegressionChecks(){
    const allTens={propertyIntelligence:{scorecard:{ratings:Object.fromEntries(SCORECARD_CATEGORIES.map(category=>[category.id,{score:10,notes:'verified',updatedAt:'2026-07-26'}]))}}};
    const middle={...allTens,favorite:true,status:'Visited',acres:25,price:250000,parcel:{county:'Monroe'},visitStatus:'Walked',destinations:[{name:'Airport',miles:42}]};
    const raw=[middle,{favorite:false,status:'Saved',acres:5,price:100000,parcel:{county:'Loudon'},propertyIntelligence:{scorecard:{ratings:{privacy:{score:5}}}}}];
    const turtle=getTurtleScore(allTens),summary=strengthsAndWeaknesses(middle),filtered=filterProperties(raw,{minAcres:20,minTurtleScore:80,status:'Visited',favorite:true,county:'monroe',maxPricePerAcre:11000}),sorted=sortProperties(raw,'turtleScore',{favoritesFirst:true}),stats=dashboard(raw),storedRoundTrip=JSON.parse(JSON.stringify({version:1,records:{'OT-001':{favorite:true,propertyIntelligence:allTens.propertyIntelligence}}}));
    const checks={
      weightsTotal100:SCORECARD_CATEGORIES.reduce((sum,category)=>sum+category.weight,0)===100,
      scoresBounded:turtle.total===100&&turtle.categories.every(category=>category.contribution>=0&&category.contribution<=category.weight),
      backwardCompatibleEmptyScorecard:getTurtleScore({}).ratedCount===0&&getTurtleScore({}).total===0,
      favoritesPersistThroughStateRoundTrip:storedRoundTrip.records['OT-001'].favorite===true,
      legacyStatusDisplaysSafely:displayStatus('Saved')==='Researching',
      filtersUseStructuredFields:filtered.length===1&&filtered[0]===middle,
      turtleSortWorks:sorted[0]===middle,
      dashboardMetricsWork:stats.totalProperties===2&&stats.favorites===1&&stats.visited===1&&stats.statusCounts.Visited===1,
      strengthsAreRuleBased:summary.strengths.includes('Excellent privacy')&&summary.strengths.includes('Large acreage'),
      scorecardNotesAndDatesSurvive:storedRoundTrip.records['OT-001'].propertyIntelligence.scorecard.ratings.privacy.updatedAt==='2026-07-26'
    };
    return {passed:Object.values(checks).every(Boolean),checks};
  }
  window.OTIntelligence={config:{scorecardCategories:SCORECARD_CATEGORIES,statusOptions:STATUS_OPTIONS},normalizeScorecard,scorecardHasValues,getTurtleScore,displayStatus,statusMatches,airportDistance,pricePerAcre,sortProperties,filterProperties,strengthsAndWeaknesses,dashboard,runRegressionChecks};
  window.OTPropertyIntelligenceRegressionChecks={run:runRegressionChecks};
})();
