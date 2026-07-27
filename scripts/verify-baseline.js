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
const saveReliabilityContext={window:{},Object,Array,JSON,Number,Date,Symbol,WeakSet,Error,String,RegExp};
saveReliabilityContext.window.window=saveReliabilityContext.window;
vm.createContext(saveReliabilityContext);
vm.runInContext(saveReliabilitySource,saveReliabilityContext);
add('Property save reliability',saveReliabilityContext.window.OTSaveReliabilityRegressionChecks.run());
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
