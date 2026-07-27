#!/usr/bin/env node
'use strict';

/* Fixture-only validation for the stable baseline. It never reads browser storage. */
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=read('app.js');
const p0=read('p0-regression-checks.js');
const planningSource=read('planning.js');
const precisionSource=read('precision.js');
const integritySource=read('integrity.js');
const elevationSource=read('elevation.js');
const intelligenceSource=read('intelligence.js');
const saveReliabilitySource=read('save-reliability.js');
const html=read('index.html');
const results=[];
const add=(name,result)=>{const passed=Boolean(result?.passed);results.push({name,passed,count:Object.keys(result?.checks||{}).length,checks:result?.checks||{}});if(!passed)process.exitCode=1;};
const makeDocument=()=>({getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},createElement:()=>({}),body:{}});

const sourceContext={window:{}};
vm.createContext(sourceContext);
vm.runInContext(p0,sourceContext);
add('P0 data preservation',sourceContext.window.OTP0RegressionChecks.run());
add('Planning undo and redo isolation',sourceContext.window.OTPlanningStabilityRegressionChecks.run());
add('Stability source guards',sourceContext.window.OTStabilitySourceChecks.runSources(app,planningSource,html));
add('Cleanup source guards',sourceContext.window.OTCleanupRegressionChecks.runSource(app));

const intelligenceContext={window:{},Math,Number,Object,Array,JSON,Date};
intelligenceContext.window.window=intelligenceContext.window;
vm.createContext(intelligenceContext);
vm.runInContext(intelligenceSource,intelligenceContext);
add('Property Intelligence scorecard, filters, and dashboard',intelligenceContext.window.OTPropertyIntelligenceRegressionChecks.run());
const intelligenceApi=intelligenceContext.window.OTIntelligence;
const automaticFactRecord={id:'OT-AUTO',name:'Automatic fixture',address:'1 Fact Rd',lat:35.4,lng:-84.3,acres:36,propertyType:'existing-livable-home',site:{Driveway:'Existing',Electric:'Existing',Well:'$18k-$35k',Septic:'$12k-$25k'},development:{driveway:'existing',homesite:'prepared pad',utilities:'onsite'},notes:'Wooded private mountain setting with creek, trails, hunting, prepared pad, and a drive-by completed.',pros:['Strong recreation appeal','Existing residence'],cons:[],status:'Visited',scores:{Airport:70,Shopping:65},destinations:[{name:'Airport',routeMinutes:60},{name:"Lowe's",routeMinutes:30},{name:'Home Depot',routeMinutes:40},{name:'Costco',routeMinutes:50},{name:'Grocery',routeMinutes:25},{name:'Hospital',routeMinutes:35}],propertyIntelligence:{scorecard:{ratings:{overallFeeling:{score:8}}}}};
const automaticCard=intelligenceApi.calculateSimplifiedScorecard(automaticFactRecord),emptyCard=intelligenceApi.calculateSimplifiedScorecard({}),straightLineCard=intelligenceApi.calculateSimplifiedScorecard({...automaticFactRecord,destinations:[{name:'Airport',miles:12}],scores:{}}),manualCard=intelligenceApi.calculateSimplifiedScorecard(automaticFactRecord,{categories:{privacySetting:{manualScore:2}}});
const autoScoreChecks={allSixCategoriesScoreFromSavedFacts:Object.values(automaticCard.categories).every(value=>value.autoScore!==null),insufficientFactsStayExplicit:Object.values(emptyCard.categories).every(value=>value.autoScore===null&&value.confidence==='Not enough information'),routedMinutesScoreLocation:automaticCard.categories.locationConvenience.autoScore!==null,straightLineDistanceIgnored:straightLineCard.categories.locationConvenience.autoScore===null,manualOverrideProtected:manualCard.categories.privacySetting.effectiveScore===2&&manualCard.categories.privacySetting.source==='manual',explanationsListFactsAndGaps:Object.values(automaticCard.categories).every(value=>Array.isArray(value.factsUsed)&&Array.isArray(value.missingFacts)),centralFactMappingAvailable:Object.keys(intelligenceApi.config.autoScoreFactMapping||{}).length===6};
add('Automatic score fact mapping and explanations',{passed:Object.values(autoScoreChecks).every(Boolean),checks:autoScoreChecks});
const saveReliabilityContext={window:{},Object,Array,JSON,Number,Date,Symbol,WeakSet,Error,String,RegExp};
saveReliabilityContext.window.window=saveReliabilityContext.window;
vm.createContext(saveReliabilityContext);
vm.runInContext(saveReliabilitySource,saveReliabilityContext);
add('Property save reliability',saveReliabilityContext.window.OTSaveReliabilityRegressionChecks.run());
const storageApi=saveReliabilityContext.window.OTSaveReliability;
const quotaStorage={data:{'ot-properties':'x'.repeat(4*1024*1024-600)},get length(){return Object.keys(this.data).length},key:index=>Object.keys(quotaStorage.data)[index]||null,getItem:key=>Object.prototype.hasOwnProperty.call(quotaStorage.data,key)?quotaStorage.data[key]:null,setItem:(key,value)=>{quotaStorage.data[key]=String(value)}};
const quotaBlocked=(()=>{try{storageApi.preflightStorageWrite(quotaStorage,{'ot-property-intelligence-v1':'x'.repeat(1200)});return false}catch(error){return error.code==='storage-full'}})();
const storageChecks={snapshotRotationIsSingle:app.includes('const RECOVERY_SNAPSHOT_LIMIT=1')&&app.includes('const payload=JSON.stringify([entry])'),canonicalSaveAvoidsFullTemporaryCopy:!app.includes('localStorage.setItem(TEMP_PROPERTY_KEY,prepared.payload)')&&app.includes('preflightStorageWrite?.(localStorage,{[STORAGE_KEY]:prepared.payload})'),intelligenceWriteIsSeparate:app.includes('writeVerifiedState(PROPERTY_INTELLIGENCE_KEY,next)')&&!app.includes('save({reason:\'Property Intelligence'),temporaryCleanupIsSafe:app.includes('removeTemporaryVerificationData')&&app.includes('/-write-temp-v1$/'),cacheCleanupExcludesCanonical:app.includes("classification==='cache-only'")&&app.includes('clearRegenerableCaches'),fullBackupAvailableOnPressure:html.includes('storagePressureBackupBtn')&&app.includes('showStoragePressureNotice'),nearQuotaPreflightAllowsNonGrowingWrite:storageApi.preflightStorageWrite(quotaStorage,{'ot-properties':quotaStorage.getItem('ot-properties')}).projectedBytes===storageApi.preflightStorageWrite(quotaStorage,{'ot-properties':quotaStorage.getItem('ot-properties')}).totalBytes,quotaExceededPreflightBlocks:quotaBlocked,storageReportClassifiesTemporary:storageApi.storageClassification('ot-x-write-temp-v1').classification==='temporary'};
add('Storage pressure and cleanup guards',{passed:Object.values(storageChecks).every(Boolean),checks:storageChecks});
add('Property Intelligence storage and UI wiring',{passed:["const PROPERTY_INTELLIGENCE_KEY='ot-property-intelligence-v1'","PROPERTY_INTELLIGENCE_KEY,'ot-version'",'rebindPropertyIntelligenceListControls','appendPropertyIntelligence','openPropertyScorecard','simplifiedScorecard','Recalculate score','Advanced scoring details'].every(token=>app.includes(token)),checks:{separateOptionalState:app.includes("const PROPERTY_INTELLIGENCE_KEY='ot-property-intelligence-v1'"),snapshotsIncludeIntelligenceState:app.includes("PROPERTY_INTELLIGENCE_KEY,'ot-version'"),listAndCompareControlsRebound:app.includes('rebindPropertyIntelligenceListControls'),dossierScorecardAvailable:app.includes('appendPropertyIntelligence')&&app.includes('openPropertyScorecard'),simplifiedScorecardStaysOptional:app.includes('simplifiedScorecard'),recalculationAndAdvancedDetailsAvailable:app.includes('Recalculate score')&&app.includes('Advanced scoring details')}});
add('Property save transaction wiring',{passed:['collection=properties,activePropertyId','showPropertySaveFailure','retryPendingPropertySave','downloadEmergencyPropertyBackup','prepareCollection?.(collection)','Recovery snapshot could not be created','active property could not be read back'].every(token=>app.includes(token)),checks:{candidateValidatedBeforePrimaryWrite:app.includes('prepareCollection?.(collection)')&&app.indexOf('prepareCollection?.(collection)')<app.indexOf('localStorage.setItem(STORAGE_KEY,staged)'),recoverySnapshotRequired:app.includes('Recovery snapshot could not be created'),temporaryWriteVerified:app.includes('Temporary storage verification failed.'),activeRecordReadBackVerified:app.includes('active property could not be read back'),retryActionWired:app.includes('retryPendingPropertySave'),emergencyBackupWired:app.includes('downloadEmergencyPropertyBackup'),formUpdateDoesNotMutateExisting:!app.includes('if(existing)Object.assign(existing,p)')}});

const metadataContext={window:{addEventListener:()=>{}},document:makeDocument(),URL,console,structuredClone,performance:{now:()=>0},setTimeout:()=>0,clearTimeout:()=>{},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},alert:()=>{},confirm:()=>true};
metadataContext.window.window=metadataContext.window;
vm.createContext(metadataContext);
const metadataSlice=app.slice(app.indexOf('function textValue'),app.indexOf('const map=L.map'));
const coordinateValidator=app.match(/function validUsCoordinate\(lat,lng\)\{[^\n]+/)[0];
vm.runInContext(`${metadataSlice}\n${coordinateValidator}\nwindow.OTPropertyMetadata={normalizeParcel,normalizePhotos,normalizeParcelGeometry,locationPriority,isUserConfirmedLocation,canApplyLocation};`,metadataContext);
vm.runInContext(precisionSource,metadataContext);
vm.runInContext(planningSource,metadataContext);
vm.runInContext(p0,metadataContext);
add('Property metadata and cost',metadataContext.window.OTPropertyMetadataRegressionChecks.run());
add('Foundation save and load fixtures',metadataContext.window.OTFoundationRegressionChecks.run());

const locationContext={window:{},document:makeDocument(),console,structuredClone,URL,setTimeout:()=>0,clearTimeout:()=>{},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},navigator:{},performance:{now:()=>0}};
locationContext.window.window=locationContext.window;
vm.createContext(locationContext);
vm.runInContext(integritySource,locationContext);
vm.runInContext(p0,locationContext);
add('Location and manual-pin protection',locationContext.window.OTLocationRegressionChecks.run(locationContext.window.OTIntegrity));

const terrainContext={window:{addEventListener:()=>{},removeEventListener:()=>{}},document:makeDocument(),console,structuredClone,URL,setTimeout:()=>0,clearTimeout:()=>{},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},navigator:{},performance:{now:()=>0},fetch:async()=>{throw new Error('Offline fixture environment');}};
terrainContext.window.window=terrainContext.window;
vm.createContext(terrainContext);
vm.runInContext(elevationSource,terrainContext);
vm.runInContext(planningSource,terrainContext);
vm.runInContext(p0,terrainContext);
add('Planning feature isolation',terrainContext.window.OTPlanningRegressionChecks.run(terrainContext.window.OTPlanning));

const importContext={window:{},URL};
vm.createContext(importContext);
const importSlice=app.slice(app.indexOf('function detectListingSource'),app.indexOf('async function fetchListingPage'));
vm.runInContext(`${importSlice}\nwindow.OTImport={canonicalListingInput,parseListingText,extractTennesseeAddress};`,importContext);
vm.runInContext(p0,importContext);
add('Listing import parser',importContext.window.OTImportRegressionChecks.run(importContext.window.OTImport));

const scoringContext={window:{OT_SEED:[{id:'OT-001'}]},document:{getElementById:()=>null},Math,Number,Object,Array,JSON};
scoringContext.clampScore=value=>Math.max(0,Math.min(100,Number(value)||0));
scoringContext.developmentAdjustments=()=>({buildability:0,value:0});
scoringContext.infrastructureScore=()=>50;
scoringContext.terrainBuildabilityScore=()=>null;
scoringContext.scoreByDistance=()=>50;
scoringContext.milesBetween=()=>20;
scoringContext.MAJOR_AIRPORTS=[];
scoringContext.estimatedDevelopmentTotal=()=>0;
scoringContext.normalizeRecord=value=>value;
vm.createContext(scoringContext);
const scoringSlice=app.slice(app.indexOf('function canonicalPropertyType'),app.indexOf('function organizeDossier'));
vm.runInContext(`const SCORE_WEIGHTS={Privacy:14,Infrastructure:14,Buildability:16,Shopping:10,Airport:14,Recreation:7,Value:10,InvestmentFlexibility:15}; const seed=window.OT_SEED;\n${scoringSlice}`,scoringContext);
add('Scoring bounds and weights',scoringContext.window.OTScoring.runRegressionChecks());

(async()=>{
  add('Elevation fixtures and cache',await terrainContext.window.OTElevationRegressionChecks.run());
  for(const result of results)console.log(`${result.passed?'PASS':'FAIL'} ${result.name} (${result.count} checks)`);
  const failed=results.filter(result=>!result.passed);
  if(failed.length){console.error(`Failed suites: ${failed.map(result=>result.name).join(', ')}`);process.exitCode=1;}
})();
