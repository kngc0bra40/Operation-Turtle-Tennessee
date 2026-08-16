#!/usr/bin/env node
'use strict';

/* Fixture-only county routing and matching checks. It never reads browser storage. */
const fs=require('fs'),path=require('path'),vm=require('vm'),root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const context={window:{},structuredClone,URL,URLSearchParams,Date,Number,JSON,Math};context.window.window=context.window;vm.createContext(context);vm.runInContext(read('parcel-intelligence.js'),context);
const api=context.window.OTParcelIntelligence,fixture=JSON.parse(read('scripts/fixtures/parcel-coverage.json'));
const polygon=(lat,lng,size=.001)=>({type:'Polygon',coordinates:[[[lng-size,lat-size],[lng+size,lat-size],[lng+size,lat+size],[lng-size,lat+size],[lng-size,lat-size]]]});
const results=fixture.records.map(record=>{const property={id:`fixture-${record.county}`,address:record.address,lat:record.lat,lng:record.lng,acres:record.acres,parcel:{county:record.county,state:'TN'}},provider=api.providerFor(property),feature={type:'Feature',properties:record.properties,geometry:polygon(record.lat,record.lng)},result=api.resultForCandidates(property,provider,[feature],'2026-08-16T12:00:00.000Z');return {record,property,provider,result}});
const multiRecord={address:'100 Fixture Rd, Clinton, TN',lat:35.0005,lng:-83.9995,acres:42,parcel:{county:'Anderson',state:'TN'}},multiFeatures=[
 {type:'Feature',properties:{ADDRESS:'FIXTURE RD 100',PARCELID:'A-18',CALC_ACRE:18,OWNER:'SAME OWNER'},geometry:{type:'Polygon',coordinates:[[[-84,35],[-83.999,35],[-83.999,35.001],[-84,35.001],[-84,35]]]}},
 {type:'Feature',properties:{ADDRESS:'FIXTURE RD',PARCELID:'A-12',CALC_ACRE:12,OWNER:'SAME OWNER'},geometry:{type:'Polygon',coordinates:[[[-83.999,35],[-83.998,35],[-83.998,35.001],[-83.999,35.001],[-83.999,35]]]}},
 {type:'Feature',properties:{ADDRESS:'FIXTURE RD',PARCELID:'A-12B',CALC_ACRE:12,OWNER:'SAME OWNER'},geometry:{type:'Polygon',coordinates:[[[-83.998,35],[-83.997,35],[-83.997,35.001],[-83.998,35.001],[-83.998,35]]]}}
],multi=api.resultForCandidates(multiRecord,api.PROVIDERS.andersonTn,multiFeatures,'2026-08-16T12:00:00.000Z'),probableGeometry=results[0].result.geometry;
const checks={
 allConfiguredCountiesRoute:fixture.records.every(record=>api.providerFor({address:record.address,parcel:{county:record.county,state:'TN'}})),
 countyChoiceIsCorrect:results.every(item=>item.provider.county===item.record.county),
 everyFixtureMatches:results.every(item=>item.result.success),
 everyFixtureIsVerified:results.every(item=>item.result.state.id==='verified-gis-parcel'),
 prefixedStatewideFieldsNormalize:results.filter(item=>['Loudon','Monroe','McMinn'].includes(item.record.county)).every(item=>item.result.parcelId&&Math.abs(item.result.gisAcres-item.record.acres)<.00001),
 ruralHouseNumberOrderTolerated:results.find(item=>item.record.county==='McMinn').result.validation.addressMatch===true,
 addressQueryUsesConfiguredField:/Assessment_Data_53_ADDRESS/.test(api.buildQueryUrl(results.find(item=>item.record.county==='Loudon').property,api.PROVIDERS.loudonStatewide,{mode:'address'})),
 spatialQueryUsesCoordinate:api.buildQueryUrl(results[0].property,results[0].provider,{mode:'spatial'}).includes(encodeURIComponent(`${results[0].property.lng},${results[0].property.lat}`)),
 largeAcreageMismatchRequiresReview:multi.success===false&&multi.state.id==='parcel-review-required',
 adjacentSameOwnerParcelsDetected:multi.possibleMultiParcel&&multi.multiParcelSuggestion.combined&&multi.multiParcelSuggestion.gisAcres===42,
 multiParcelIsNotAcceptedForTerrain:multi.state.id!=='multi-parcel-property',
 probableGeometryRemainsARealPolygon:probableGeometry?.type==='Polygon',
 officialStateCorsLimitationDocumented:api.BLOCKED_SOURCES.some(source=>/cross-origin/i.test(source.reason))
};
for(const [name,passed] of Object.entries(checks))console.log(`${passed?'PASS':'FAIL'} ${name}`);
if(!Object.values(checks).every(Boolean)){console.error('Parcel coverage fixtures failed.');process.exitCode=1}else console.log(`PASS Parcel coverage fixtures: ${results.map(item=>item.record.county).join(', ')}`);
