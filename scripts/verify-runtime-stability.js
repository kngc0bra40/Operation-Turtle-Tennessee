#!/usr/bin/env node
'use strict';

/* Source-architecture checks for the Version 5.0 runtime hotfix. No browser storage is read. */
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=read('app.js'),smart=read('smart-import.js'),stabilization=read('stabilization.js'),overlay=read('overlay-manager.js'),land=read('land-assessment.js'),parcel=read('parcel-workflow.js'),map=read('map-workspace.js'),zillow=read('zillow-workflow.js'),index=read('index.html');
const refresh=smart.slice(smart.indexOf('async function refreshPropertyDataComplete'),smart.indexOf('window.refreshPropertyData='));
const count=(text,pattern)=>(text.match(pattern)||[]).length;
const checks={
  noWholeBodyMutationObserver:!stabilization.includes("observe(document.body,{childList:true,subtree:true})")&&!smart.includes("observe(document.body,{childList:true,subtree:true})")&&!zillow.includes("observe(document.body,{childList:true,subtree:true})"),
  observersAreSurfaceScoped:stabilization.includes("observe(drawer,{childList:true})")&&stabilization.includes("observe(list,{childList:true})")&&smart.includes("observe(scorecardEditor,{childList:true})")&&smart.includes("observe(drawer,{childList:true})"),
  overlayObserverIsShallow:overlay.includes("observe(drawer,{childList:true,attributes:true")&&!overlay.includes("subtree:true,childList:true,attributes:true"),
  propertyReadsPreferMemory:app.includes("getProperty(id){const p=properties.find")&&app.includes("list(){return properties.map"),
  mapRedrawIsFingerprintGated:app.includes('function mapRecordFingerprint')&&app.includes("if(forceMap||mapRecordFingerprint(before)!==mapRecordFingerprint(current))renderMarkers()"),
  hiddenCompareIsNotRebuilt:app.includes('function compareIsVisible()')&&app.includes('if(forceCompare||compareIsVisible())renderCompare()'),
  dossierNavigationPersists:app.includes('const dossierNavigationState=new Map()')&&app.includes('restoreDossierNavigation(id)')&&map.includes('OTDossierNavigation?.capture?.()')&&map.includes('OTDossierNavigation?.restore?.(activeId)'),
  tabClickIsLocalOnly:app.includes("runtimeMetric('navigation','tabSwitches')")&&!app.slice(app.indexOf("button.addEventListener('click',()=>{runtimeMetric('navigation','tabSwitches')"),app.indexOf("button.addEventListener('click',()=>{runtimeMetric('navigation','tabSwitches')")+650).match(/runPropertyResearch|refreshRoutes|LandAssessment|ParcelWorkflow/),
  ordinaryPropertyOpenDoesNotStartResearch:!app.includes('maybeRefreshStaleListing')&&!app.includes('listingRefreshInFlight'),
  researchJobsDeduplicated:app.includes('const researchJobs=new Map()')&&app.includes("runtimeMetric('jobs','researchDeduplicated')"),
  refreshJobsDeduplicated:smart.includes('const refreshJobs=new Map()')&&smart.includes('refreshDeduplicated'),
  parcelJobsDeduplicated:parcel.includes('const autoJobs=new Map()')&&parcel.includes('parcelDeduplicated'),
  assessmentJobsDeduplicated:land.includes('assessmentJobs=new Map()')&&land.includes('landDeduplicated'),
  scoreJobsCoalesced:app.includes('const pendingScoreRecalculations=new Map()')&&app.includes("runtimeMetric('jobs','scoreDeduplicated')"),
  refreshRunsEachMajorJobOnce:count(refresh,/runPropertyResearch\?\.\(/g)===1&&count(refresh,/refreshRoutes\?\.\(/g)===1&&count(refresh,/recalculateSimplifiedScoreForProperty\?\.\(/g)===1,
  refreshSuppressesIntermediateRenders:refresh.includes('render:false')&&refresh.includes('OTRenderCoordinator?.refresh?.'),
  duplicateParcelRefreshWrapperRemoved:!parcel.includes('const previousRefresh=window.refreshPropertyData'),
  lateDecoratorsArePropertyScoped:land.includes('function activeDossierIs(id)')&&parcel.includes('function activeDossierIs(id)'),
  fileModeSkipsServiceWorker:app.includes("'serviceWorker'in navigator&&/^https?:$/.test(location.protocol)"),
  cacheVersionsMatch:index.includes('app.js?v=5.0.4')&&index.includes('smart-import.js?v=5.0.4')&&index.includes('stabilization.js?v=5.0.4')&&index.includes('zillow-workflow.js?v=5.0.4')
};
for(const [name,passed] of Object.entries(checks))console.log(`${passed?'PASS':'FAIL'} ${name}`);
if(!Object.values(checks).every(Boolean)){console.error('Runtime stability verification failed.');process.exitCode=1}else console.log(`PASS Runtime stability architecture (${Object.keys(checks).length} checks).`);
