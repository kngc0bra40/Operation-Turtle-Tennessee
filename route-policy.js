/* Central route and Location & Convenience policy. Pure helpers; network work stays in the UI adapter. */
(()=>{
  'use strict';

  const CONFIG=Object.freeze({
    airport:Object.freeze({type:'airport',category:'TYS airport',name:'McGhee Tyson Airport',code:'TYS',address:'2055 Alcoa Hwy, Alcoa, TN 37701',lat:35.8110,lng:-83.9940}),
    homeImprovementSimilarMinutes:5,
    weights:Object.freeze({grocery:.30,airport:.30,hospital:.18,homeImprovement:.15,costco:.07}),
    scoredCategories:Object.freeze(['grocery','airport','hospital','home-improvement','costco']),
    displayCategories:Object.freeze([
      Object.freeze({key:'airport',label:'TYS airport'}),
      Object.freeze({key:'grocery',label:'Grocery'}),
      Object.freeze({key:'hospital',label:'Hospital / emergency care'}),
      Object.freeze({key:'home-improvement',label:'Home improvement'}),
      Object.freeze({key:'costco',label:'Costco'})
    ])
  });
  const finite=value=>value!==null&&value!==''&&value!==undefined&&Number.isFinite(Number(value));
  const text=value=>String(value??'').trim();
  function normalizedDestination(raw={},fallback=''){
    if(Array.isArray(raw))return {category:text(raw[0]||fallback),name:text(raw[1]),address:text(raw[2]),routeMiles:null,routeMinutes:null,checkedAt:'',source:'legacy'};
    const value=raw&&typeof raw==='object'?raw:{};
    return {...value,category:text(value.category||value.label||fallback),type:text(value.type),name:text(value.name),address:text(value.address),code:text(value.code).toUpperCase(),lat:finite(value.lat)?Number(value.lat):null,lng:finite(value.lng)?Number(value.lng):null,routeMiles:finite(value.routeMiles??value.distanceMiles)?Number(value.routeMiles??value.distanceMiles):null,routeMinutes:finite(value.routeMinutes??value.durationMinutes??value.drivingMinutes??value.minutes)?Number(value.routeMinutes??value.durationMinutes??value.drivingMinutes??value.minutes):null,checkedAt:text(value.checkedAt||value.updatedAt),source:text(value.source||'legacy')};
  }
  function categoryKey(raw={}){
    const d=normalizedDestination(raw),haystack=`${d.type} ${d.category} ${d.name} ${d.code}`.toLowerCase();
    if(d.code==='TYS'||/mcghee tyson|tys airport/.test(haystack))return 'airport';
    if(/airport/.test(haystack))return 'other-airport';
    if(/grocery|supermarket|walmart/.test(haystack))return 'grocery';
    if(/hospital|emergency/.test(haystack))return 'hospital';
    if(/home improvement|home depot|lowe'?s/.test(haystack))return 'home-improvement';
    if(/costco/.test(haystack))return 'costco';
    if(/tractor supply/.test(haystack))return 'tractor-supply';
    return text(d.type||d.category).toLowerCase();
  }
  function activeRoute(property,key){
    const matches=(Array.isArray(property?.destinations)?property.destinations:[]).map(item=>normalizedDestination(item)).filter(item=>categoryKey(item)===key);
    const confirmed=matches.filter(item=>window.OTSourcePrecedence?.normalizeSource(item.source)==='user-confirmed');
    return (confirmed.at(-1)||matches.at(-1)||null);
  }
  function canonicalAirport(existing={}){
    const route=normalizedDestination(existing,'TYS airport');
    return {...route,...CONFIG.airport,routeMiles:route.routeMiles,routeMinutes:route.routeMinutes,checkedAt:route.checkedAt,source:route.source||'route-automation'};
  }
  function airportScore(minutes){
    const value=Number(minutes);if(!Number.isFinite(value)||value<0)return null;
    if(value<=60)return 10;
    if(value<=75)return Number((10-(value-60)*(2/15)).toFixed(2));
    return Number(Math.max(2.5,8-(value-75)*.15).toFixed(2));
  }
  function serviceScore(minutes){
    const value=Number(minutes);if(!Number.isFinite(value)||value<0)return null;
    if(value<=15)return 10;if(value<=25)return 9;if(value<=35)return 8;if(value<=50)return 6.5;if(value<=70)return 5;if(value<=90)return 3.5;return 2.5;
  }
  function chooseHomeImprovement(lowes,homeDepot,similar=CONFIG.homeImprovementSimilarMinutes){
    const l=normalizedDestination(lowes,'Home improvement'),h=normalizedDestination(homeDepot,'Home improvement');
    if(!finite(l.routeMinutes))return finite(h.routeMinutes)?{...h,selectedBrand:'Home Depot',evaluatedAlternative:finite(l.routeMinutes)?l:null}:null;
    if(!finite(h.routeMinutes))return {...l,selectedBrand:"Lowe's",evaluatedAlternative:null};
    const homeDepotWins=Math.abs(h.routeMinutes-l.routeMinutes)<=similar||h.routeMinutes<l.routeMinutes;
    const selected=homeDepotWins?h:l,alternative=homeDepotWins?l:h;
    return {...selected,category:'Home improvement',type:'home-improvement',selectedBrand:homeDepotWins?'Home Depot':"Lowe's",evaluatedAlternative:{name:alternative.name,address:alternative.address,routeMiles:alternative.routeMiles,routeMinutes:alternative.routeMinutes}};
  }
  function scoreLocation(property={}){
    const routes={airport:activeRoute(property,'airport'),grocery:activeRoute(property,'grocery'),hospital:activeRoute(property,'hospital'),homeImprovement:activeRoute(property,'home-improvement'),costco:activeRoute(property,'costco')};
    const scores={airport:airportScore(routes.airport?.routeMinutes),grocery:serviceScore(routes.grocery?.routeMinutes),hospital:serviceScore(routes.hospital?.routeMinutes),homeImprovement:serviceScore(routes.homeImprovement?.routeMinutes),costco:serviceScore(routes.costco?.routeMinutes)};
    let weighted=0,knownWeight=0;for(const [key,weight] of Object.entries(CONFIG.weights)){if(scores[key]===null)continue;weighted+=scores[key]*weight;knownWeight+=weight}
    const missing=Object.keys(CONFIG.weights).filter(key=>scores[key]===null),score=knownWeight?Number((weighted/knownWeight).toFixed(2)):null;
    const confidence=knownWeight>=.85?'High':knownWeight>=.55?'Medium':knownWeight>0?'Low':'Not enough information';
    const reasons=[];if(scores.airport!==null)reasons.push(`TYS routed time is ${Math.round(routes.airport.routeMinutes)} minutes.`);if(scores.grocery!==null)reasons.push('Grocery uses a property-specific routed time.');if(scores.homeImprovement!==null)reasons.push(`${routes.homeImprovement.selectedBrand||routes.homeImprovement.name||'Home improvement'} is the selected combined home-improvement route.`);
    const warnings=missing.length?[`Missing routed data: ${missing.map(key=>({airport:'TYS airport',grocery:'Grocery',hospital:'Hospital / emergency care',homeImprovement:'Home improvement',costco:'Costco'}[key])).join(', ')}.`]:[];
    return {score,confidence,knownWeight,missing,routes,scores,reasons,warnings};
  }
  function formatMiles(value){const miles=Number(value);if(!Number.isFinite(miles)||miles<0)return '—';return `${miles<10?miles.toFixed(1):Math.round(miles)} mi`}
  function formatDuration(value){const minutes=Math.round(Number(value));if(!Number.isFinite(minutes)||minutes<0)return '—';if(minutes<60)return `${minutes} min`;const hours=Math.floor(minutes/60),remainder=minutes%60;return `${hours} hr${hours===1?'':'s'}${remainder?` ${remainder} min`:''}`}
  function runRegressionChecks(){
    const airportCases={45:10,60:10,61:9.87,70:8.67,75:8,76:7.85,90:5.75};
    const airportThresholds=Object.entries(airportCases).every(([minutes,expected])=>airportScore(Number(minutes))===expected);
    const lowes={category:"Lowe's",name:"Lowe's A",routeMinutes:30},homeDepot={category:'Home Depot',name:'Home Depot A',routeMinutes:34};
    const home=chooseHomeImprovement(lowes,homeDepot),a={destinations:[canonicalAirport({routeMinutes:90}),{category:'Grocery',name:'Store A',routeMinutes:18},{category:'Hospital',name:'Hospital A',routeMinutes:28},home,{category:'Costco',name:'Costco A',routeMinutes:62},{category:'Tractor Supply',name:'Tractor',routeMinutes:2}]},b={destinations:[canonicalAirport({routeMinutes:45}),{category:'Grocery',name:'Store B',routeMinutes:40}]};
    const scoreA=scoreLocation(a),withoutTractor=scoreLocation({...a,destinations:a.destinations.filter(item=>categoryKey(item)!=='tractor-supply')}),improvedAirport=scoreLocation({...a,destinations:a.destinations.map(item=>categoryKey(item)==='airport'?canonicalAirport({...item,routeMinutes:45}):item)});
    const checks={airportThresholds,allAirportsAreTys:activeRoute(a,'airport')?.code==='TYS'&&activeRoute(b,'airport')?.code==='TYS',noAirportSubstitution:categoryKey({category:'Major airport',name:'Chattanooga Airport'})==='other-airport',gradualAirportPenalty:airportScore(61)>airportScore(70)&&airportScore(76)>airportScore(90),overHourNotDisqualified:airportScore(90)>0,propertySpecificGrocery:activeRoute(a,'grocery')?.name!==activeRoute(b,'grocery')?.name,propertySpecificHospital:activeRoute(a,'hospital')?.name==='Hospital A',homeDepotTiePreference:home?.selectedBrand==='Home Depot',combinedHomeImprovement:categoryKey(home)==='home-improvement',costcoLowerWeight:CONFIG.weights.costco<CONFIG.weights.grocery&&CONFIG.weights.costco<CONFIG.weights.airport,tractorSupplyZeroWeight:scoreA.score===withoutTractor.score,routeUpdateChangesLocationScore:improvedAirport.score>scoreA.score,cleanMileage:formatMiles(8.36)==='8.4 mi'&&formatMiles(27.41)==='27 mi',cleanDuration:formatDuration(72)==='1 hr 12 min'};
    return {passed:Object.values(checks).every(Boolean),checks,samples:{airportCases,locationAt90Minutes:scoreA.score}};
  }

  window.OTRoutePolicy={config:CONFIG,normalizedDestination,categoryKey,activeRoute,canonicalAirport,airportScore,serviceScore,chooseHomeImprovement,scoreLocation,formatMiles,formatDuration,runRegressionChecks};
})();
