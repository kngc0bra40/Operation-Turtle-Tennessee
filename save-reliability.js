/* Operation Turtle property-save validation and diagnostics.
   This is intentionally storage- and DOM-free so the app can validate a
   prospective record before replacing the current saved collection. */
(function(){
  'use strict';
  const SKIP=Symbol('skip');
  const isPlainObject=value=>Boolean(value)&&Object.prototype.toString.call(value)==='[object Object]';
  const validCoordinate=(lat,lng)=>Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))&&Number(lat)>=18&&Number(lat)<=72&&Number(lng)>=-180&&Number(lng)<=-66;
  const geometryCoordinatesValid=value=>{
    if(!Array.isArray(value))return false;
    if(value.length===2&&Number.isFinite(Number(value[0]))&&Number.isFinite(Number(value[1])))return validCoordinate(value[1],value[0]);
    return value.length>0&&value.every(geometryCoordinatesValid);
  };
  const geometryValid=value=>{
    if(value===undefined||value===null||value==='')return true;
    const geometry=value?.type==='Feature'?value.geometry:value;
    return Boolean(geometry&&['Polygon','MultiPolygon'].includes(geometry.type)&&geometryCoordinatesValid(geometry.coordinates));
  };
  const photosValid=value=>{
    if(value===undefined||value===null)return true;
    if(!isPlainObject(value))return false;
    const urls=[value.primary,...(Array.isArray(value.additional)?value.additional:[])].filter(Boolean);
    return urls.every(url=>typeof url==='string'&&/^https?:\/\//i.test(url));
  };
  function createError(code,message){const error=new Error(message);error.code=code;return error;}
  function sanitize(value,path='property',seen=new WeakSet(),issues=[]){
    if(value===undefined||typeof value==='function'||typeof value==='symbol'){issues.push({path,type:typeof value,action:'removed'});return SKIP;}
    if(value===null||typeof value==='string'||typeof value==='number'||typeof value==='boolean')return value;
    if(typeof value==='bigint')throw createError('invalid-data',`${path} contains a BigInt value that browser storage cannot preserve.`);
    if(value instanceof Date)return value.toISOString();
    if(typeof value!=='object')throw createError('invalid-data',`${path} contains an unsupported value.`);
    if(seen.has(value))throw createError('invalid-data',`${path} contains a circular reference.`);
    seen.add(value);
    let result;
    if(Array.isArray(value))result=value.map((item,index)=>{const cleaned=sanitize(item,`${path}[${index}]`,seen,issues);return cleaned===SKIP?null:cleaned;});
    else if(isPlainObject(value)){result={};Object.entries(value).forEach(([key,item])=>{const cleaned=sanitize(item,`${path}.${key}`,seen,issues);if(cleaned!==SKIP)result[key]=cleaned;});}
    else throw createError('invalid-data',`${path} contains a runtime object that cannot be stored safely.`);
    seen.delete(value);
    return result;
  }
  function validateCollection(collection){
    if(!Array.isArray(collection))throw createError('invalid-data','Property collection is not an array.');
    const ids=new Set();
    collection.forEach((property,index)=>{
      if(!isPlainObject(property))throw createError('invalid-data',`Property ${index+1} is not a plain data record.`);
      const id=String(property.id||'').trim();
      if(!id)throw createError('invalid-data',`Property ${index+1} is missing an ID.`);
      if(ids.has(id))throw createError('id-conflict',`Property ID ${id} appears more than once.`);
      ids.add(id);
      if(!String(property.address||'').trim()||!String(property.name||'').trim())throw createError('invalid-data',`Property ${id} is missing its required name or address.`);
      if(!validCoordinate(property.lat,property.lng))throw createError('invalid-data',`Property ${id} has invalid coordinates.`);
      if(!geometryValid(property.parcelGeometry))throw createError('invalid-geometry',`Property ${id} has invalid parcel geometry.`);
      if(!photosValid(property.photos))throw createError('invalid-photos',`Property ${id} has invalid photo data.`);
    });
    return true;
  }
  function prepareCollection(collection){
    const issues=[];
    const cleaned=sanitize(collection,'properties',new WeakSet(),issues);
    validateCollection(cleaned);
    const payload=JSON.stringify(cleaned);
    return {collection:cleaned,payload,bytes:payload.length,issues};
  }
  function estimatedStorageBytes(storage){
    try{return Object.keys(storage).reduce((total,key)=>total+String(key).length+(storage.getItem(key)||'').length,0);}catch{return null;}
  }
  function inspectProperty(property,collection=[],storage=typeof localStorage==='undefined'?null:localStorage){
    const report={serializedBytes:null,totalStoreBytes:null,unsupportedValues:[],hasCircularReference:false,invalidCoordinates:false,invalidGeometry:false,invalidPhotos:false,duplicateId:false,missingIdentity:false,storageAvailable:false};
    try{report.storageAvailable=Boolean(storage)&&typeof storage.getItem==='function'&&typeof storage.setItem==='function';report.totalStoreBytes=report.storageAvailable?estimatedStorageBytes(storage):null;}catch{}
    try{const prepared=prepareCollection([property]);report.serializedBytes=prepared.bytes;report.unsupportedValues=prepared.issues;}catch(error){const message=String(error?.message||error);report.hasCircularReference=/circular/i.test(message);report.invalidCoordinates=/coordinates/i.test(message);report.invalidGeometry=/geometry/i.test(message);report.invalidPhotos=/photo/i.test(message);report.missingIdentity=/missing.*(?:name|address|ID)/i.test(message);report.error=message;}
    const id=String(property?.id||'').trim();
    report.duplicateId=Boolean(id)&&collection.filter(item=>String(item?.id||'')===id).length>1;
    return report;
  }
  function failureDetails(error){
    const code=error?.code||'';
    const message=String(error?.message||error||'');
    if(code==='id-conflict'||/duplicate.*ID|ID.*appears more than once/i.test(message))return {code:'id-conflict',label:'Property ID conflict',message:'This property ID conflicts with another saved property. Choose a unique property ID before retrying.'};
    if(code==='invalid-geometry'||/geometry/i.test(message))return {code:'invalid-geometry',label:'Invalid parcel geometry',message:'The parcel boundary is invalid. Clear or redraw it, then retry the save.'};
    if(code==='invalid-photos'||/photo/i.test(message))return {code:'invalid-photo-data',label:'Invalid photo data',message:'One or more photo links are invalid. Correct or remove them, then retry the save.'};
    if(code==='temporary-verification'||/temporary.*verification|staged/i.test(message))return {code:'temporary-verification',label:'Temporary storage verification failed',message:'The browser could not verify a temporary save. Your saved property was not changed; retry after freeing storage or reloading the app.'};
    if(code==='storage-unavailable'||/security|storage.*unavailable|access.*denied/i.test(message))return {code:'storage-unavailable',label:'Browser storage unavailable',message:'This browser cannot access Operation Turtle storage for this page. Check private-browsing and site-storage settings.'};
    if(code==='storage-full'||/quota|storage.*full|recovery snapshot/i.test(message))return {code:'storage-full',label:'Browser storage is full',message:'Operation Turtle could not create the required recovery snapshot because browser storage is full. Export a complete backup and free browser storage before retrying.'};
    if(code==='invalid-data'||/invalid|missing|circular|unsupported/i.test(message))return {code:'invalid-property-data',label:'Invalid property data',message:'This edit contains data that cannot be safely saved. Review the property fields and retry; the previous record is intact.'};
    return {code:'unknown-save-error',label:'Unknown save error',message:'The property was not changed. Retry the save, or download an emergency copy of this edit.'};
  }
  function runRegressionChecks(){
    const property={id:'OT-999',name:'Fixture property',address:'1 Test Rd, TN',lat:35.4,lng:-84.3,photos:{primary:'https://example.com/photo.jpg',additional:['https://example.com/second.jpg']},parcel:{county:'Monroe',parcelId:'fixture'},parcelGeometry:{type:'Polygon',coordinates:[[[-84.3,35.4],[-84.31,35.4],[-84.3,35.41],[-84.3,35.4]]]}};
    const withUndefined={...property,optional:undefined,nested:{allowed:'yes',runtime:undefined},scorecard:{ratings:{privacy:{score:9}}},sitePlanning:{concepts:[{id:'concept-1',label:'Preserve me'}]}};
    const prepared=prepareCollection([withUndefined]);
    const duplicate=(()=>{try{prepareCollection([property,{...property,name:'Second'}]);return false;}catch(error){return error.code==='id-conflict';}})();
    const badGeometry=(()=>{try{prepareCollection([{...property,parcelGeometry:{type:'Polygon',coordinates:[[[-84.3,35.4],[999,999]]]} }]);return false;}catch(error){return error.code==='invalid-geometry';}})();
    const badPhotos=(()=>{try{prepareCollection([{...property,photos:{primary:'not-a-url',additional:[]}}]);return false;}catch(error){return error.code==='invalid-photos';}})();
    const circular={...property};circular.circular=circular;
    const circularBlocked=(()=>{try{prepareCollection([circular]);return false;}catch(error){return /circular/i.test(error.message);}})();
    const diagnostic=inspectProperty(property,[property],{getItem:()=>null,setItem:()=>{},key:()=>null,length:0});
    const checks={undefinedOptionalFieldsAreRemoved:prepared.collection[0].optional===undefined&&prepared.collection[0].nested.runtime===undefined,existingPropertyUpdatePreservesOptionalData:prepared.collection[0].sitePlanning.concepts[0].label==='Preserve me',photosPersist:prepared.collection[0].photos.additional.length===1,parcelAndGeoJsonPersist:prepared.collection[0].parcel.county==='Monroe'&&prepared.collection[0].parcelGeometry.type==='Polygon',scorecardDataPersists:prepared.collection[0].scorecard.ratings.privacy.score===9,duplicateIdsRejected:duplicate,invalidGeometryRejected:badGeometry,invalidPhotoDataRejected:badPhotos,circularValuesBlocked:circularBlocked,diagnosticsReportSerializableSize:diagnostic.serializedBytes>0,storageFullCategorized:failureDetails({name:'QuotaExceededError',message:'Quota exceeded'}).code==='storage-full',temporaryVerificationCategorized:failureDetails({code:'temporary-verification',message:'Temporary storage verification failed.'}).code==='temporary-verification',retryCandidateRemainsSerializable:prepareCollection([prepared.collection[0]]).bytes===prepared.bytes};
    return {passed:Object.values(checks).every(Boolean),checks};
  }
  window.OTSaveReliability={prepareCollection,validateCollection,inspectProperty,failureDetails,estimatedStorageBytes,runRegressionChecks};
  window.OTSaveReliabilityRegressionChecks={run:runRegressionChecks};
})();
