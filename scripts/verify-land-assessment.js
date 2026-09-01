#!/usr/bin/env node
'use strict';
/* Fixture-only statewide parcel, imagery, and Land Assessment verification. It never reads or writes browser storage. */
const fs=require('fs'),path=require('path'),vm=require('vm'),root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const document={readyState:'loading',getElementById:()=>null,querySelector:()=>null,addEventListener:()=>{}},context={window:{},document,structuredClone,URL,URLSearchParams,Date,Number,JSON,Math};context.window.window=context.window;vm.createContext(context);for(const file of ['parcel-intelligence.js','land-assessment.js'])vm.runInContext(read(file),context);
const parcel=context.window.OTParcelIntelligence,land=context.window.OTLandAssessment,result=land.runRegressionChecks(),happy={address:'2792 Happy Hollow Rd, Sevierville, TN 37862',lat:35.714339,lng:-83.682605,acres:45.76,parcel:{county:'Sevier',state:'TN',rawParcelId:'078-123-010.00'}},provider=parcel.providerFor(happy),decodeUrl=value=>decodeURIComponent(value).replaceAll('+',' '),addressUrl=decodeUrl(parcel.buildQueryUrl(happy,provider,{mode:'address'})),idUrl=decodeUrl(parcel.buildQueryUrl(happy,provider,{mode:'id'})),fullIdUrl=decodeUrl(parcel.buildQueryUrl({...happy,parcel:{...happy.parcel,rawParcelId:'078 123    01000 000 2026'}},provider,{mode:'id'})),happyFeature={type:'Feature',properties:{COUNTY_NAME:'Sevier',PARCELID:'078 123    01000 000 2026',GISLINK:'078123    01000',ADDRESS:'HAPPY HOLLOW RD 2792',DEEDAC:45.76,LINK_TPV:'https://tnmap.tn.gov/assessment/#/parcel/078123%20%20%20%2001000'},geometry:{type:'Polygon',coordinates:[[[-83.685,35.712],[-83.680,35.712],[-83.680,35.717],[-83.685,35.717],[-83.685,35.712]]]}},happyResult=parcel.resultForCandidates(happy,provider,[happyFeature],'2026-09-01T12:00:00Z'),happyMerged=parcel.merge(happy,{...happyResult,rawParcelId:happy.parcel.rawParcelId}),html=read('index.html'),app=read('app.js'),workflow=read('parcel-workflow.js'),serviceWorker=read('service-worker.js');
const checks={
  ...result.checks,
  officialStatewideProviderFirst:provider.id==='tn-property-viewer-statewide-parcels'&&provider.tier==='official-state-primary',
  happyHollowAddressUsesRoadFirst:addressUrl.includes("ADDRESS LIKE '%HAPPY%HOLLOW%2792%'")&&addressUrl.includes("COUNTY_NAME = 'Sevier'"),
  parcelIdFormattingIsFlexible:idUrl.includes("GISLINK = '078123    01000'")&&idUrl.includes("PARCELID LIKE '078 123    01000%'"),
  fullOfficialParcelIdFormattingWorks:fullIdUrl.includes("GISLINK = '078123    01000'")&&fullIdUrl.includes("PARCELID LIKE '078 123    01000%'"),
  happyHollowFixtureVerified:happyResult.success&&happyResult.state.id==='verified-gis-parcel'&&parcel.normalizeParcelId(happyResult.parcelId)==='078123010000002026',
  propertyViewerLinkPreserved:happyMerged.parcel.propertyViewerUrl.includes('tnmap.tn.gov/assessment')&&happyMerged.parcel.rawParcelId==='078-123-010.00',
  rawParcelIdPreservationIsImplemented:workflow.includes('parcelIdEvidence')&&workflow.includes('rawParcelId'),
  parcelIdRecoveryUiPresent:['parcelIdInput','parcelIdFindBtn','openTnPropertyViewerBtn'].every(id=>html.includes(`id="${id}"`)),
  tnAerialLayerPresent:html.includes('value="tnAerial"')&&app.includes('IMAGERY_WEB_MERCATOR/MapServer/tile/{z}/{y}/{x}'),
  imageryYearMetadataPresent:html.includes('imageryMetadata')&&app.includes('TN_Ortho_Year'),
  noGoogleTiles:!app.includes('google.com/vt')&&!app.includes('maps.googleapis.com'),
  assessmentRunsAfterConfirmation:workflow.includes("trigger:'confirmed-parcel'")&&workflow.includes('OTLandAssessment.run'),
  referenceAlignmentControls:workflow.includes('data-reference-rotation')&&workflow.includes('data-reference-opacity')&&workflow.includes('data-trace-parcel'),
  cacheIncludesLandAssessment:serviceWorker.includes("'./land-assessment.js'")
};
for(const [name,passed] of Object.entries(checks))console.log(`${passed?'PASS':'FAIL'} ${name}`);if(!Object.values(checks).every(Boolean)){console.error(`Land Assessment verification failed at: ${Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name).join(', ')}`);process.exitCode=1}else console.log(`PASS Tennessee parcel, imagery, and Land Assessment foundation (${Object.keys(checks).length} checks).`);
