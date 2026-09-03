#!/usr/bin/env node
'use strict';

/* Source-architecture checks for the Version 5.0 runtime hotfix. No browser storage is read. */
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=read('app.js'),smart=read('smart-import.js'),stabilization=read('stabilization.js'),overlay=read('overlay-manager.js'),land=read('land-assessment.js'),parcel=read('parcel-workflow.js'),map=read('map-workspace.js'),zillow=read('zillow-workflow.js'),planning=read('planning.js'),index=read('index.html');
const refresh=smart.slice(smart.indexOf('async function refreshPropertyDataComplete'),smart.indexOf('window.refreshPropertyData='));
const count=(text,pattern)=>(text.match(pattern)||[]).length;
const modules=[smart,stabilization,overlay,land,parcel,map,zillow,planning],tabNavigation=app.slice(app.indexOf('function activateDossierTab'),app.indexOf('function organizeDossier')),organizedTabs=app.slice(app.indexOf('function organizeDossier'),app.indexOf('window.OTDossierNavigation=')),openPath=app.slice(app.indexOf('const openPropertyCore='),app.indexOf('window.OTImport=')),versions=[...index.matchAll(/\?v=([^"']+)/g)].map(match=>match[1]);
const checks={
  zeroMutationObservers:modules.every(source=>!source.includes('MutationObserver')),
  explicitRenderHooksReplaceObservers:[stabilization,overlay,land,parcel,zillow,planning,smart].every(source=>source.includes('OTRenderLifecycle')),
  noModulePropertyOpenWrappers:modules.every(source=>!source.includes('window.openProperty=function')),
  oneCentralDossierOpenPath:count(app,/window\.openProperty=function/g)===2&&openPath.includes("runRenderer('dossier'")&&openPath.includes("emitRenderHook('dossier'"),
  oneDelegatedTabHandler:openPath.includes("addEventListener('click'")&&openPath.includes('[data-dossier-tab-target]')&&!organizedTabs.includes('addEventListener'),
  tabClickIsSynchronous:tabNavigation.includes("runtimeMetric('navigation','tabSwitches')")&&!/setTimeout|requestAnimationFrame|await |runPropertyResearch|refreshRoutes|LandAssessment|ParcelWorkflow/.test(tabNavigation),
  propertyReadsPreferMemory:app.includes("getProperty(id){const p=properties.find")&&app.includes("list(){return properties.map"),
  mapRedrawIsFingerprintGated:app.includes('function mapRecordFingerprint')&&app.includes("if(forceMap||mapRecordFingerprint(before)!==mapRecordFingerprint(current))renderMarkers()"),
  hiddenCompareIsNotRebuilt:app.includes('function compareIsVisible()')&&app.includes('if(forceCompare||compareIsVisible())renderCompare()'),
  dossierNavigationPersists:app.includes('const dossierNavigationState=new Map()')&&app.includes('activateDossierTab(id,state.tab,{count:false})')&&openPath.includes('captureDossierNavigation()')&&openPath.includes('restoreDossierNavigation(key)'),
  dossierOpenUsesCachedDataOnly:!openPath.match(/runPropertyResearch|refreshRoutes|\.acquire\(|screenParcelTerrain|recalculateSimplifiedScore|preferTennesseeAerial/),
  ordinaryPropertyOpenDoesNotStartResearch:!app.includes('maybeRefreshStaleListing')&&!app.includes('listingRefreshInFlight'),
  rendererReentrancyGuard:app.includes('const renderHooks=new Map()')&&app.includes("runtimeMetric('renders','reentrant')")&&app.includes("runRenderer('dossier'")&&app.includes("runRenderer('list'")&&app.includes("runRenderer('compare'"),
  stabilityDiagnosticsAvailable:app.includes('window.OTStabilityDiagnostics=')&&app.includes('activeObservers:0')&&app.includes('activeJobs:Object.fromEntries')&&app.includes('pendingTimers:trackedTimers.size'),
  diagnosticStressUsesRealClickPaths:app.includes('async function runRuntimeStress')&&app.includes("cards[0].click()")&&app.includes("data-dossier-tab-target")&&app.includes("document.getElementById('layersBtn')?.click()"),
  overlayLoadsAfterDiagnostics:index.indexOf('app.js?v=5.0.5')<index.indexOf('overlay-manager.js?v=5.0.5'),
  overlayDoesNotReopenFromSyntheticCloses:overlay.includes('!item.config.isOpen(item.element)')&&overlay.includes('event.isTrusted&&close&&contextName'),
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
  cacheVersionsMatch:versions.length>=30&&versions.every(version=>version==='5.0.5')
};
for(const [name,passed] of Object.entries(checks))console.log(`${passed?'PASS':'FAIL'} ${name}`);
if(!Object.values(checks).every(Boolean)){console.error('Runtime stability verification failed.');process.exitCode=1}else console.log(`PASS Runtime stability architecture (${Object.keys(checks).length} checks).`);
