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
const sourcePrecedenceSource=read('source-precedence.js');
const propertyWorkflowSource=read('property-workflow.js');
const smartImportSource=read('smart-import.js');
const routePolicySource=read('route-policy.js');
const zillowFactsSource=read('zillow-facts.js');
const propertyResearchSource=read('property-research.js');
const listingInputSource=read('listing-input.js');
const parcelIntelligenceSource=read('parcel-intelligence.js');
const listingMonitorSource=read('listing-monitor.js');
const zillowMapperSource=read('zillow-mapper.js');
const stabilizationSource=read('stabilization.js');
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

const intelligenceContext={window:{addEventListener:()=>{}},document:makeDocument(),structuredClone,Math,Number,Object,Array,JSON,Date,setTimeout:()=>0};
intelligenceContext.window.window=intelligenceContext.window;
vm.createContext(intelligenceContext);
vm.runInContext(sourcePrecedenceSource,intelligenceContext);
vm.runInContext(routePolicySource,intelligenceContext);
vm.runInContext(intelligenceSource,intelligenceContext);
vm.runInContext(propertyWorkflowSource,intelligenceContext);
add('Canonical Property workflow and Second Home Flexibility',intelligenceContext.window.OTPropertyWorkflow.runRegressionChecks());
vm.runInContext(zillowFactsSource,intelligenceContext);
vm.runInContext(propertyResearchSource,intelligenceContext);
vm.runInContext(smartImportSource,intelligenceContext);
add('Smart Import 3.0 pure workflow',intelligenceContext.window.OTSmartImportCore.runRegressionChecks());
const smartAfterSave=smartImportSource.slice(smartImportSource.indexOf('async function afterPropertySaved'),smartImportSource.indexOf('async function refreshPropertyData')),smartRefresh=smartImportSource.slice(smartImportSource.indexOf('async function refreshPropertyData'),smartImportSource.indexOf('function optionHtml')),profileSave=app.slice(app.indexOf('function savePropertyScorecardV3'),app.indexOf('savePropertyScorecard=savePropertyScorecardV3;')),profileDraft=app.slice(app.indexOf('function propertyProfileDraft'),app.indexOf('function intelligenceRecordWithProfile'));
const smartIntegrationChecks={
  modulesLoadInCanonicalOrder:html.indexOf('intelligence.js')<html.indexOf('property-workflow.js')&&html.indexOf('property-workflow.js')<html.indexOf('zillow-facts.js')&&html.indexOf('stabilization.js')<html.indexOf('smart-import.js'),
  oneVisibleCreationOperation:['Address or Zillow URL','Listing Text','Create Property','Cancel'].every(label=>smartImportSource.includes(label)),
  legacyImportControlsRemovedFromCreation:!['Import Zillow facts','Review and save','Run narrowed Property Research after save','Calculate unlocked routes after save'].some(label=>smartImportSource.includes(label)),
  compactProgressStages:['Creating property','Importing facts','Researching property','Calculating routes','Updating evaluation','Saving'].every(label=>smartImportSource.includes(label)),
  addressAndZillowUseCanonicalParser:smartImportSource.includes('OTListingInputParser?.(raw)')&&smartImportSource.includes('parsed.url')&&smartImportSource.includes('parsed.zillowId'),
  proposedZillowFactsStayInWorkingState:!smartImportSource.slice(smartImportSource.indexOf('function parseOptionalZillow'),smartImportSource.indexOf('function sourcePath')).includes('OTPropertyStore'),
  uncertainLocationBlocksSave:smartImportSource.includes("if(!located||!validPin())throw new Error")&&smartImportSource.indexOf('if(!located||!validPin())')<smartImportSource.indexOf('window.saveNewProperty?.()'),
  duplicateCreationSuppressed:smartImportSource.includes('function duplicateProperty')&&smartImportSource.includes('This property is already saved'),
  finalPropertySaveUsesVerifiedPipeline:app.includes("preparePropertyForSave?.(p)")&&app.includes("save({reason,collection:next,activePropertyId:p.id,recalculate:false})"),
  automaticResearchAndRoutes:smartAfterSave.includes("runPropertyResearch?.(id,{recalculate:false,reopen:false})")&&smartAfterSave.includes("refreshRoutes?.(id,{recalculate:false,reopen:false})"),
  smartImportRecalculatesOnce:(smartAfterSave.match(/recalculateSimplifiedScoreForProperty/g)||[]).length===1,
  refreshRecalculatesOnce:(smartRefresh.match(/recalculateSimplifiedScoreForProperty/g)||[]).length===1&&smartRefresh.includes('OTCanonicalPropertyUpdate'),
  profileWritesCanonicalProperty:profileSave.includes('OTCanonicalPropertyUpdate(property.id')&&profileSave.includes('workflow.applyManualDraft'),
  profileDraftIncludesRootAndCanonicalFacts:profileDraft.includes("querySelectorAll('[data-canonical]')")&&profileDraft.includes('OTPropertyWorkflow?.profileForRecord?.(property,current)'),
  profileFailureKeepsEditorOpen:profileSave.indexOf('if(!saved)')<profileSave.indexOf('closePropertyScorecard()')&&profileSave.includes('entries remain here'),
  profileScoreFailureHasNoFalseSuccess:profileSave.indexOf('if(!scored)')<profileSave.indexOf('closePropertyScorecard()'),
  routesCorrectedInsideProfile:smartImportSource.includes('data-profile-route')&&smartImportSource.includes('data-profile-route-unlock')&&stabilizationSource.includes('window.OTRouteEditor='),
  advancedToolsAreConsolidated:['Run Property Research','Reprocess Listing Text','Refresh routes','Advanced diagnostics'].every(label=>stabilizationSource.includes(label)),
  compareHasNoInjectedExtraFacts:!smartImportSource.includes('data-compare-flexibility'),
  newModulesHaveNoStartupStorageWrites:![propertyWorkflowSource,smartImportSource,listingInputSource,parcelIntelligenceSource,listingMonitorSource,propertyResearchSource].some(source=>/localStorage\s*\.\s*(?:setItem|removeItem|clear)/.test(source))
};
add('V4.4 unified creation and Profile wiring',{passed:Object.values(smartIntegrationChecks).every(Boolean),checks:smartIntegrationChecks});
add('Property Intelligence scorecard, filters, and dashboard',intelligenceContext.window.OTPropertyIntelligenceRegressionChecks.run());
add('Central source precedence',intelligenceContext.window.OTSourcePrecedence.runRegressionChecks());
add('TYS route and Location policy',intelligenceContext.window.OTRoutePolicy.runRegressionChecks());
const intelligenceApi=intelligenceContext.window.OTIntelligence;
const zillowContext={window:{},structuredClone};zillowContext.window.window=zillowContext.window;vm.createContext(zillowContext);vm.runInContext(sourcePrecedenceSource,zillowContext);vm.runInContext(zillowFactsSource,zillowContext);vm.runInContext(zillowMapperSource,zillowContext);const zillowResult=zillowContext.window.OTZillowFacts.runRegressionChecks();delete zillowResult.checks.idempotent;zillowResult.checks.reprocessingHasNoDuplicateFields=new Set(zillowResult.parsed).size===zillowResult.parsed.length;zillowResult.checks.reprocessingHasNoDuplicateReviews=new Set(zillowResult.reviewItems.map(item=>item.code)).size===zillowResult.reviewItems.length;zillowResult.passed=Object.values(zillowResult.checks).every(Boolean);add('Zillow Facts end-to-end mapping',zillowResult);
const listingInputContext={window:{},URL};listingInputContext.window.window=listingInputContext.window;vm.createContext(listingInputContext);vm.runInContext(listingInputSource,listingInputContext);add('Canonical listing input',listingInputContext.window.OTListingInput.runRegressionChecks());
const parcelContext={window:{},structuredClone,URL,URLSearchParams,Date,Number,JSON};parcelContext.window.window=parcelContext.window;vm.createContext(parcelContext);vm.runInContext(parcelIntelligenceSource,parcelContext);add('Official parcel intelligence',parcelContext.window.OTParcelIntelligence.runRegressionChecks(JSON.parse(read('scripts/fixtures/happy-hollow-parcel.json'))));
const researchContext={window:{},structuredClone,Date,encodeURIComponent,URL};researchContext.window.window=researchContext.window;vm.createContext(researchContext);vm.runInContext(sourcePrecedenceSource,researchContext);vm.runInContext(propertyResearchSource,researchContext);vm.runInContext(listingMonitorSource,researchContext);add('Permitted public property research',researchContext.window.OTPropertyResearch.runRegressionChecks(read('scripts/fixtures/happy-hollow-research.rss')));add('Meaningful listing monitoring',researchContext.window.OTListingMonitor.runRegressionChecks());
const stabilizationContext={window:{addEventListener:()=>{}},document:makeDocument(),MutationObserver:function(){this.observe=()=>{}},Number,Object,Array,JSON,Date,encodeURIComponent,setTimeout:()=>0,fetch:async()=>{throw new Error('Offline fixture environment')}};stabilizationContext.window.window=stabilizationContext.window;vm.createContext(stabilizationContext);vm.runInContext(sourcePrecedenceSource,stabilizationContext);vm.runInContext(routePolicySource,stabilizationContext);vm.runInContext(stabilizationSource,stabilizationContext);add('Stabilized property-specific routes',stabilizationContext.window.OTStabilization.runRegressionChecks());
const compactUiChecks={
  mapLayersStartCollapsed:/id="layersPanel"[^>]*hidden/.test(html),
  mapLayerSelectionPersists:app.includes('persistMapLayerState')&&app.includes('applyMapLayerState'),
  mapLayersEscapeCloses:app.includes("event.key==='Escape'")&&app.includes('setLayersPanel(false)'),
  primaryDossierActions:stabilizationSource.includes("editProfile.textContent='Edit Profile'")&&stabilizationSource.includes("refresh.textContent='Refresh Property Data'")&&stabilizationSource.includes("more.className='dossier-more'"),
  secondaryActionsInMore:['Reprocess Listing Text','Adjust property location','Run Property Research','Refresh routes','View County Parcel Map','Open listing','Site Planning','Delete property'].every(label=>stabilizationSource.includes(label)),
  oldEditAllRemoved:!stabilizationSource.includes("editAll.textContent='Edit all details'"),
  routeDiagnosticsHiddenByDefault:!stabilizationSource.slice(stabilizationSource.indexOf('function routeRows'),stabilizationSource.indexOf('function importedFacts')).includes('checkedAt')&&!stabilizationSource.slice(stabilizationSource.indexOf('function routeRows'),stabilizationSource.indexOf('function importedFacts')).includes('Source:'),
  mileagePrecisionCentral:routePolicySource.includes('function formatMiles'),
  reviewResolutionAction:app.includes('data-review-resolve')&&app.includes('resolvePropertyReview'),
  onlyThreeQuestionsInitially:app.includes('review.issues.slice(0,3).map')&&!app.includes('review-show-all'),
  technicalReviewItemsRemoved:!intelligenceSource.includes("add('routes-missing'")&&!intelligenceSource.includes("add('costs-missing'"),
  conclusionSectionsVisible:stabilizationSource.includes('data-property-conclusions')&&['Infrastructure','Land Quality','Development Readiness','Property Potential'].every(label=>propertyWorkflowSource.includes(label)),
  legacyAddFormHidden:read('styles.css').includes('.smart-creation-card> :not(#smartImportPanel){display:none!important}'),
  routeEditorEscape:stabilizationSource.includes("event.key==='Escape'"),
  narrowScreenRules:read('styles.css').includes('@media(max-width:760px){.smart-create-panel')&&read('styles.css').includes('.conclusion-grid,.dossier-evaluation-summary,.profile-route-grid{grid-template-columns:1fr}'),
  dossierReviewRenderedByDefault:app.includes('appendPropertyIntelligence(id);appendPropertyDataReview(id)'),
  profileSaveButtonResets:app.includes("saveButton.textContent='Save Profile'"),
  legacyDossierFactsHidden:stabilizationSource.includes("querySelectorAll('.kpis,.dossier-summary-strip")&&stabilizationSource.includes("classList.add('dossier-legacy-hidden')")&&read('styles.css').includes('.dossier-legacy-hidden{display:none!important}'),
  desktopCompareIsolatesOtherPanels:app.includes("classList.remove('desktop-open')")&&app.includes("classList.remove('active');closeDrawer();closePropertyScorecard();renderCompare()"),
  versionInformationCurrent:app.includes('Operation Turtle 4.4.2 Preview')&&app.includes('feature/happy-hollow-benchmark-reliability'),
  parcelDiagnosticsAvailable:stabilizationSource.includes('data-parcel-diagnostics')&&stabilizationSource.includes('Parcel lookup diagnostics'),
  parcelSourceStatusReflectsConnection:app.includes('function refreshParcelSourceStatus')&&app.includes("connected${provider?")
};
add('V4.4 simplified interface wiring',{passed:Object.values(compactUiChecks).every(Boolean),checks:compactUiChecks});const routeApi=intelligenceContext.window.OTRoutePolicy;
const routeFixtureCandidates=[
  {name:'Promoted Kentucky Grocery',address:'Williamsburg, KY',lat:36.7,lng:-84.2,searchType:'supermarket',searchCategory:'shop',stateCode:'KY',routeMinutes:12,routeMiles:10},
  {name:'Walmart Supercenter',address:'Maryville, TN',lat:35.7,lng:-84,searchType:'supermarket',searchCategory:'shop',stateCode:'TN',routeMinutes:18,routeMiles:12},
  {name:'Food City',address:'Athens, TN',lat:35.4,lng:-84.6,searchType:'supermarket',searchCategory:'shop',stateCode:'TN',routeMinutes:22,routeMiles:15}
];
const routeValidation=routeApi.validCandidates([
  ...routeFixtureCandidates,
  {name:'Corner Convenience',address:'TN',lat:35.4,lng:-84.4,searchType:'convenience',searchCategory:'shop'},
  {name:'Walmart Fuel Station',address:'TN',lat:35.4,lng:-84.4,searchType:'fuel',searchCategory:'amenity'},
  {name:'Walmart Distribution Center',address:'TN',lat:35.4,lng:-84.4,searchType:'warehouse',searchCategory:'building'},
  {name:'Kroger Corporate Office',address:'TN',lat:35.4,lng:-84.4,searchType:'office',searchCategory:'office'},
  {name:'Market Road',address:'TN',lat:35.4,lng:-84.4,searchType:'road',searchCategory:'highway'},
  {name:'Food Lion permanently closed',address:'TN',lat:35.4,lng:-84.4,searchType:'supermarket',searchCategory:'shop'}
],'grocery');
const previousRoute={name:'Prior Grocery',address:'Athens, TN',lat:35.4,lng:-84.6,routeMinutes:20,routeMiles:14,source:'route-automation'},manualRoute={...previousRoute,source:'user-confirmed',locked:true},homeDepot=routeApi.chooseHomeImprovement({name:"Lowe's",routeMinutes:28,routeMiles:20},{name:'Home Depot',routeMinutes:32,routeMiles:23});
const routingCorrectionChecks={
  categoryRadiiCentralAndBounded:routeApi.config.searchRadiiMiles.grocery.initial===20&&routeApi.config.searchRadiiMiles.hospital.initial===35&&routeApi.config.searchRadiiMiles['home-improvement'].initial===35&&routeApi.config.searchRadiiMiles.costco.initial===75,
  oneConfiguredFallbackPerCategory:Object.values(routeApi.config.searchRadiiMiles).every(value=>value.fallback>value.initial),
  multipleCandidatesComparedByRouteTime:routeApi.chooseRoutedCandidate('hospital',[{routeMinutes:30,routeMiles:12},{routeMinutes:20,routeMiles:19}]).routeMinutes===20,
  searchOrderDoesNotControlSelection:routeApi.chooseRoutedCandidate('grocery',routeFixtureCandidates).name==='Walmart Supercenter',
  walmartSupercenterIsValid:routeValidation.valid.some(value=>value.name==='Walmart Supercenter'),
  convenienceRejected:routeValidation.rejected.some(value=>value.reason==='not-full-service-grocery'&&/Convenience/.test(value.candidate.name)),
  fuelRejected:routeValidation.rejected.some(value=>value.reason==='fuel-station'),
  distributionAndCorporateRejected:routeValidation.rejected.filter(value=>value.reason==='non-retail-facility').length===2,
  neighborhoodAndRoadRejected:routeValidation.rejected.some(value=>value.reason==='non-destination-place'),
  closedLocationRejected:routeValidation.rejected.some(value=>value.reason==='closed'),
  practicalInStateOptionWins:routeApi.chooseRoutedCandidate('grocery',routeFixtureCandidates).stateCode==='TN',
  genuineClosestOutOfStateAllowed:routeApi.chooseRoutedCandidate('grocery',[routeFixtureCandidates[0],{...routeFixtureCandidates[1],routeMinutes:28}]).stateCode==='KY',
  suspiciousLongGroceryTriggersReview:routeApi.groceryRouteIsSuspicious({...routeFixtureCandidates[1],routeMinutes:50,routeMiles:38},routeFixtureCandidates),
  failedRefreshPreservesPrevious:routeApi.automaticReplacement(previousRoute,null).route===previousRoute,
  worseRefreshPreservesPrevious:routeApi.automaticReplacement(previousRoute,{...previousRoute,routeMinutes:25,routeMiles:18}).route===previousRoute,
  manualLockWins:routeApi.automaticReplacement(manualRoute,{...previousRoute,routeMinutes:5,routeMiles:3}).reason==='manual-lock',
  homeDepotWinsWithinFiveMinutes:homeDepot.selectedBrand==='Home Depot'&&homeDepot.evaluatedAlternative.name==="Lowe's",
  tysIsFixed:routeApi.canonicalAirport({routeMinutes:70}).code==='TYS'&&routeApi.canonicalAirport({routeMinutes:70}).name==='McGhee Tyson Airport',
  candidateAdapterUsesBoundedRadius:stabilizationSource.includes('radiusMiles')&&stabilizationSource.includes('bounded=1')&&stabilizationSource.includes('radii.fallback'),
  routedTableEvaluatesMultipleCandidates:stabilizationSource.includes('/table/v1/driving/')&&stabilizationSource.includes('policy.config.candidateLimit'),
  scoreRecalculationIsNotDuplicated:!app.match(/function updateOneProperty[^\n]+recalculateSimplifiedScoreForProperty/)&&app.includes('scheduleSimplifiedScoreRecalculation(activePropertyId,reason)'),
  routeFormattingIsCentral:routeApi.formatMiles(7.84)==='7.8 mi'&&routeApi.formatMiles(28.4)==='28 mi'&&routeApi.formatDuration(74)==='1 hr 14 min'
};
add('Corrective route selection and preservation',{passed:Object.values(routingCorrectionChecks).every(Boolean),checks:routingCorrectionChecks});

const improvedZillowText='Lot size: 50.61 acres\nBedrooms: 2\nFull bathrooms: 2\nBathrooms: 2\nLiving area: 1,152 sqft\nStructure area: 1,152 sqft\nYear built: 2018\nHome type: Single Family Residence\nHeating: Central\nCooling: Central air\nParking spaces: 2\nDetached carport, paved driveway\nMountain views\nWaterfront: Creek\nLevel, Private, Sloped, Wooded, Views\nBarns, Stables, Storage\nSeptic Tank\nWater: Public\nWater available\nElectric connected\nCable Connected, High Speed Internet\nAnnual taxes: $629';
const routeSet=[routeApi.canonicalAirport({routeMinutes:58,routeMiles:43,source:'route-automation'}),{type:'grocery',category:'Grocery',name:'Walmart Supercenter',routeMinutes:18,routeMiles:12},{type:'hospital',category:'Hospital / emergency care',name:'Regional Hospital',routeMinutes:30,routeMiles:21},{type:'home-improvement',category:'Home improvement',name:'Home Depot',routeMinutes:28,routeMiles:20},{type:'costco',category:'Costco',name:'Costco',routeMinutes:62,routeMiles:51}];
const improvedMapping=zillowContext.window.OTZillowFacts.applyToProperty({id:'OT-IMPROVED',name:'Improved fixture',address:'1 Fixture Rd, TN',lat:35.4,lng:-84.3,price:360000,propertyType:'raw-land',fieldSources:{propertyType:'inferred'},destinations:routeSet,propertyIntelligence:{propertyProfile:{additionalBuildSite:'likely',waterFeatureReliability:'unverified'}},development:{driveway:'unknown',homesite:'unknown',utilities:'unknown'},developmentCost:{well:'allowance',septic:'allowance'}},zillowContext.window.OTZillowFacts.parse(improvedZillowText));
const improvedFixture=improvedMapping.property,improvedScore=intelligenceApi.getTurtleScore(improvedFixture),rawFixture={...JSON.parse(JSON.stringify(improvedFixture)),id:'OT-RAW',beds:0,baths:0,fullBathrooms:0,sqft:0,structureArea:0,yearBuilt:0,homeType:'',heating:'',cooling:'',parkingSpaces:0,propertyType:'raw-land',development:{driveway:'none',homesite:'unknown',utilities:'unknown'},developmentCost:{well:'allowance',septic:'allowance'},propertyIntelligence:{propertyProfile:{...improvedFixture.propertyIntelligence.propertyProfile,residenceStatus:'raw_land',existingResidencePresent:false,existingResidenceLivable:false,residenceCondition:'unknown',electric:'none',waterSource:'none',publicWater:'none',septicOrSewer:'none',septic:'none',internet:'none',cable:'none',driveway:'none',outbuildings:'none'},zillowLand:{...improvedFixture.propertyIntelligence.zillowLand,carport:'no',barn:'no',stable:'no',storageBuilding:'no'}}},rawScore=intelligenceApi.getTurtleScore(rawFixture),improvedReview=intelligenceApi.dataReview(improvedFixture),compareSource=app.slice(app.indexOf('function compareDevelopmentEstimate'),app.indexOf('function propertyIntelligenceSummary'));
const zillowPropagationChecks={
  parseNormalizeMapSaveShape:improvedMapping.updated.length>20&&improvedFixture.id==='OT-IMPROVED',
  residenceStatusCanonical:improvedFixture.propertyIntelligence.propertyProfile.residenceStatus==='likely_livable',
  homeFieldsPropagate:improvedFixture.beds===2&&improvedFixture.baths===2&&improvedFixture.sqft===1152&&improvedFixture.structureArea===1152&&improvedFixture.yearBuilt===2018,
  connectedAndAvailableStayDistinct:improvedFixture.propertyIntelligence.propertyProfile.publicWater==='available'&&improvedFixture.propertyIntelligence.propertyProfile.waterSource==='available',
  septicPresenceAndStatus:improvedFixture.propertyIntelligence.propertyProfile.septic==='recorded'&&improvedFixture.propertyIntelligence.propertyProfile.septicOrSewer==='recorded',
  cableAndInternetPropagate:improvedFixture.propertyIntelligence.propertyProfile.cable==='verified'&&improvedFixture.propertyIntelligence.propertyProfile.internet==='verified',
  terrainAttributesSeparate:['levelLand','private','slopedLand','wooded','mountainView'].every(field=>improvedFixture.propertyIntelligence.zillowLand[field]==='yes'),
  creekAndMountainViewPropagate:improvedFixture.propertyIntelligence.propertyProfile.waterFeatureType==='creek'&&improvedFixture.propertyIntelligence.zillowLand.mountainView==='yes',
  structuresRemainSeparate:['carport','barn','stable','storageBuilding'].every(field=>improvedFixture.propertyIntelligence.zillowLand[field]==='yes'),
  dossierReadsCanonicalFacts:['residenceStatus','sqft','structureArea','waterSource','septicOrSewer','electric','internet','Structures:','Land:'].every(token=>stabilizationSource.includes(token)),
  compareReadsCanonicalFacts:['TYS:','Acreage:','Existing house:','Living area:','Asking price:','Development estimate:'].every(token=>compareSource.includes(token)),
  importedFactsDriveScoring:improvedScore.categories.find(value=>value.id==='existingHomeInfrastructure').score>=8&&improvedScore.categories.find(value=>value.id==='landCharacterPrivacy').score>5&&improvedScore.categories.find(value=>value.id==='recreationWaterFeatures').score>5,
  developmentAssumptionsRespond:improvedFixture.development.homesite==='home'&&improvedFixture.development.driveway==='existing'&&improvedFixture.development.utilities==='onsite'&&improvedFixture.developmentCost.well==='existing-unverified'&&improvedFixture.developmentCost.septic==='existing-unverified',
  answeredQuestionsRemoved:!improvedReview.allIssues.some(issue=>/acreage|whether water exists|whether septic exists|whether a structure exists/i.test(`${issue.code} ${issue.found}`)),
  remainingQuestionsAreGenuine:improvedReview.allIssues.every(issue=>['home-unclear','utilities-unclear','second-site-unknown','water-unverified','acreage-conflict','type-conflict'].includes(issue.code)||issue.code.startsWith('source-conflict-')),
  repeatedRawTextIsIdempotent:zillowContext.window.OTZillowFacts.applyToProperty(improvedFixture,zillowContext.window.OTZillowFacts.parse(improvedZillowText)).updated.length===0,
  manualSourcePrecedencePreserved:zillowContext.window.OTZillowFacts.applyToProperty({...improvedFixture,acres:42,fieldSources:{...improvedFixture.fieldSources,acres:'user-confirmed'}},zillowContext.window.OTZillowFacts.parse('Lot size: 50.61 acres')).property.acres===42,
  likelyHomeMateriallyOutranksRaw:improvedScore.total>=rawScore.total+8,
  nonLivableDoesNotReceiveFullCredit:intelligenceApi.calculateSimplifiedScorecard({...improvedFixture,propertyIntelligence:{...improvedFixture.propertyIntelligence,propertyProfile:{...improvedFixture.propertyIntelligence.propertyProfile,residenceStatus:'non_livable',existingResidenceLivable:false,residenceCondition:'major-rehabilitation'}}}).categories.existingHomeInfrastructure.autoScore<improvedScore.categories.find(value=>value.id==='existingHomeInfrastructure').score,
  exceptionalRawSafeguardStillPasses:intelligenceApi.runRegressionChecks().checks.exceptionalVacantCanOutrankPoorImproved
};
add('Corrective Zillow propagation and home-value fixtures',{passed:Object.values(zillowPropagationChecks).every(Boolean),checks:zillowPropagationChecks});

const compareCorrectionChecks={
  onlySixCategoryBars:compareSource.includes('turtle.categories.map')&&!compareSource.includes('detailedScore'),
  overallTurtleScoreShown:compareSource.includes('turtle.total'),
  tysTimeShown:compareSource.includes("activeRoute?.(property,'airport')")&&compareSource.includes('formatDuration'),
  houseStatusAndSizeShown:compareSource.includes('compareHouseLabel')&&compareSource.includes('residenceSquareFootage'),
  acresPriceAndConditionalCostShown:compareSource.includes('property.acres')&&compareSource.includes('property.price')&&compareSource.includes('developmentEstimate!==null'),
  reviewAndSourceDiagnosticsAbsent:!compareSource.includes('dataReview')&&!compareSource.includes('data-review')&&!compareSource.includes('Source:'),
  secondaryProfileDetailsAbsent:!compareSource.includes('profileSummary')&&!compareSource.includes('profileBadges')&&!compareSource.includes('rankNote')&&!compareSource.includes('Baseline score'),
  mobileWidthRulePresent:read('styles.css').includes('@media(max-width:760px){.compare-decision-grid{grid-template-columns:1fr}')
};
add('Compact Compare decision screen',{passed:Object.values(compareCorrectionChecks).every(Boolean),checks:compareCorrectionChecks});
const automaticFactRecord={id:'OT-AUTO',name:'Automatic fixture',address:'1 Fact Rd',lat:35.4,lng:-84.3,acres:36,price:360000,propertyType:'existing-livable-home',site:{Driveway:'Existing',Electric:'Existing',Well:'$18k-$35k',Septic:'$12k-$25k'},development:{driveway:'existing',homesite:'prepared pad',utilities:'onsite'},notes:'Wooded private mountain setting with creek, trails, hunting, prepared pad, and a drive-by completed.',pros:['Strong recreation appeal','Existing residence'],cons:[],status:'Visited',scores:{Airport:70,Shopping:65,Value:65},destinations:[{name:'Airport',routeMinutes:60},{name:"Lowe's",routeMinutes:30},{name:'Home Depot',routeMinutes:40},{name:'Costco',routeMinutes:50},{name:'Grocery',routeMinutes:25},{name:'Hospital',routeMinutes:35}],propertyIntelligence:{scorecard:{ratings:{overallFeeling:{score:8}}},propertyProfile:{existingResidencePresent:true,existingResidenceLivable:true,residenceCondition:'livable',electric:'verified',waterSource:'verified-well',septicOrSewer:'verified',internet:'verified',driveway:'year-round',additionalBuildSite:'identified',additionalBuildSiteConfidence:'high',secondHomeAccess:'independent',utilityExtensionDifficulty:'low',multipleResidences:'permitted',woodedOpenMix:'mixed',slopeCharacter:'mixed-moderate',waterFeatureType:'creek',waterFeatureReliability:'verified-year-round',waterFloodRisk:'low'}}};
const automaticCard=intelligenceApi.calculateSimplifiedScorecard(automaticFactRecord),emptyCard=intelligenceApi.calculateSimplifiedScorecard({}),straightLineCard=intelligenceApi.calculateSimplifiedScorecard({...automaticFactRecord,destinations:[{name:'Airport',miles:12}],scores:{Value:65}}),manualCard=intelligenceApi.calculateSimplifiedScorecard(automaticFactRecord,{categories:{landBuildability:{manualScore:2}}});
const autoScoreChecks={allSixCategoriesScoreFromSavedFacts:Object.values(automaticCard.categories).every(value=>value.autoScore!==null),insufficientFactsStayExplicit:Object.values(emptyCard.categories).every(value=>value.autoScore===null&&value.confidence==='Not enough information'),routedMinutesScoreLocation:automaticCard.categories.locationConvenience.autoScore!==null,straightLineDistanceIgnored:straightLineCard.categories.locationConvenience.autoScore===null,legacyManualOverrideProtected:manualCard.categories.secondHomeBuildPotential.effectiveScore===2&&manualCard.categories.secondHomeBuildPotential.source==='manual',explanationsListFactsAndGaps:Object.values(automaticCard.categories).every(value=>Array.isArray(value.factsUsed)&&Array.isArray(value.missingFacts)),centralFactMappingAvailable:Object.keys(intelligenceApi.config.autoScoreFactMapping||{}).length===6,profileFactsStayOptional:intelligenceApi.normalizePropertyProfile({existingResidenceLivable:true}).existingResidenceLivable===true};
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
add('Property Intelligence storage and Profile wiring',{passed:["const PROPERTY_INTELLIGENCE_KEY='ot-property-intelligence-v1'","PROPERTY_INTELLIGENCE_KEY,'ot-version'",'rebindPropertyIntelligenceListControls','appendPropertyIntelligence','openPropertyScorecard','simplifiedScorecard','applyManualDraft','Save canonical Property Profile'].every(token=>app.includes(token)||propertyWorkflowSource.includes(token)),checks:{separateOptionalState:app.includes("const PROPERTY_INTELLIGENCE_KEY='ot-property-intelligence-v1'"),snapshotsIncludeIntelligenceState:app.includes("PROPERTY_INTELLIGENCE_KEY,'ot-version'"),listAndCompareControlsRebound:app.includes('rebindPropertyIntelligenceListControls'),dossierScoreAndProfileAvailable:app.includes('appendPropertyIntelligence')&&app.includes('openPropertyScorecard'),simplifiedScorecardStaysOptional:app.includes('simplifiedScorecard'),profileSaveUsesCanonicalPipeline:app.includes('applyManualDraft')&&app.includes('Save canonical Property Profile')}});add('Property save transaction wiring',{passed:['collection=properties,activePropertyId','showPropertySaveFailure','retryPendingPropertySave','downloadEmergencyPropertyBackup','prepareCollection?.(collection)','Recovery snapshot could not be created','active property could not be read back'].every(token=>app.includes(token)),checks:{candidateValidatedBeforePrimaryWrite:app.includes('prepareCollection?.(collection)')&&app.indexOf('prepareCollection?.(collection)')<app.indexOf('localStorage.setItem(STORAGE_KEY,staged)'),recoverySnapshotRequired:app.includes('Recovery snapshot could not be created'),temporaryWriteVerified:app.includes('Temporary storage verification failed.'),activeRecordReadBackVerified:app.includes('active property could not be read back'),retryActionWired:app.includes('retryPendingPropertySave'),emergencyBackupWired:app.includes('downloadEmergencyPropertyBackup'),formUpdateDoesNotMutateExisting:!app.includes('if(existing)Object.assign(existing,p)')}});

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
const importedContingency=metadataContext.window.OTPrecision.estimateCost({well:'existing-unverified',septic:'existing-unverified'}),connectedServices=metadataContext.window.OTPrecision.estimateCost({well:'not-needed-existing-service',septic:'not-needed-existing-service'}),developmentAssumptionChecks={unverifiedServicesStayVisible:importedContingency.unknown.includes('water connection / well verification')&&importedContingency.unknown.includes('septic / sewer inspection contingency'),confirmedServicesRemoveAllowances:!connectedServices.unknown.some(label=>/well|septic|sewer/.test(label)),editRoundTripRetainsImportedStates:precisionSource.includes('dataset.importedState')&&precisionSource.includes("['existing-unverified','not-needed-existing-service'].includes(retained)")};
add('Imported development assumptions',{passed:Object.values(developmentAssumptionChecks).every(Boolean),checks:developmentAssumptionChecks});
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
  for(const result of results.filter(result=>!result.passed))console.error(`  Failed checks: ${Object.entries(result.checks).filter(([,passed])=>!passed).map(([name])=>name).join(', ')}`);
  const failed=results.filter(result=>!result.passed);
  if(failed.length){console.error(`Failed suites: ${failed.map(result=>result.name).join(', ')}`);process.exitCode=1;}
})();
