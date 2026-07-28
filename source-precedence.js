/* Central source-precedence policy. Pure helpers only; no startup reads or writes. */
(()=>{
  'use strict';

  const LEVELS=Object.freeze({
    inferred:0,
    research:1,
    'route-automation':1,
    listing:2,
    zillow:2,
    county:3,
    authoritative:3,
    'user-confirmed':4
  });
  const ALIASES=Object.freeze({
    manual:'user-confirmed',
    'user-entered':'user-confirmed',
    user:'user-confirmed',
    assessor:'county',
    gis:'county',
    automated:'research',
    saved:'inferred',
    legacy:'inferred',
    unknown:'inferred'
  });

  function normalizeSource(source='inferred'){
    const value=String(source||'inferred').trim().toLowerCase();
    return ALIASES[value]||value in LEVELS&&value||'inferred';
  }
  function priority(source){return LEVELS[normalizeSource(source)]??0}
  function isBlank(value){return value===undefined||value===null||value===''||(typeof value==='number'&&!Number.isFinite(value))}
  function sameValue(a,b){return String(a??'').trim().toLowerCase()===String(b??'').trim().toLowerCase()}
  function canReplace(currentValue,currentSource,candidateValue,candidateSource,{explicit=false}={}){
    if(isBlank(candidateValue))return {allowed:false,reason:'candidate-blank'};
    if(isBlank(currentValue))return {allowed:true,reason:'blank-current',source:explicit?'user-confirmed':normalizeSource(candidateSource)};
    if(sameValue(currentValue,candidateValue))return {allowed:false,matching:true,reason:'matching'};
    if(explicit)return {allowed:true,reason:'explicit-user-approval',source:'user-confirmed'};
    const current=normalizeSource(currentSource||'user-confirmed'),candidate=normalizeSource(candidateSource);
    return priority(candidate)>priority(current)
      ?{allowed:true,reason:'stronger-source',source:candidate}
      :{allowed:false,conflict:true,reason:'protected-by-source',source:current};
  }
  function preserveCandidate(record,field,value,source,status='rejected'){
    const next=record.sourceCandidates&&typeof record.sourceCandidates==='object'?record.sourceCandidates:{};
    const previous=Array.isArray(next[field])?next[field]:[];
    const candidate={value,source:normalizeSource(source),status,recordedAt:new Date().toISOString()};
    const duplicate=previous.some(item=>sameValue(item?.value,value)&&normalizeSource(item?.source)===candidate.source&&item?.status===status);
    record.sourceCandidates={...next,[field]:(duplicate?previous:[...previous,candidate]).slice(-5)};
    return record;
  }
  function valueAt(record,path){return String(path).split('.').reduce((value,key)=>value?.[key],record)}
  function markUserChanges(previous,next,paths=[]){
    const sources={...(next.fieldSources||{})};
    for(const path of paths){
      const before=previous?valueAt(previous,path):undefined,after=valueAt(next,path);
      if(!isBlank(after)&&(!previous||!sameValue(before,after)))sources[path]='user-confirmed';
    }
    next.fieldSources=sources;
    return next;
  }
  function runRegressionChecks(){
    const checks={
      userOverCounty:!canReplace('manual','user-confirmed','county','county').allowed,
      userOverZillow:!canReplace('manual','user-confirmed','zillow','zillow').allowed,
      userOverListing:!canReplace('manual','user-confirmed','listing','listing').allowed,
      userOverResearch:!canReplace('manual','user-confirmed','research','research').allowed,
      userOverRouteAutomation:!canReplace(25,'user-confirmed',20,'route-automation').allowed,
      countyOverZillow:!canReplace('county','county','zillow','zillow').allowed,
      zillowOverInference:canReplace('guess','inferred','zillow','zillow').allowed,
      explicitAcceptanceWins:canReplace('manual','user-confirmed','accepted','zillow',{explicit:true}).source==='user-confirmed'
    };
    const record={};preserveCandidate(record,'acres',50.61,'zillow');preserveCandidate(record,'acres',50.61,'zillow');
    checks.rejectedCandidatePreserved=record.sourceCandidates.acres.length===1&&record.sourceCandidates.acres[0].status==='rejected';
    const edited=markUserChanges({acres:20},{acres:21},['acres']);
    checks.userEditStamped=edited.fieldSources.acres==='user-confirmed';
    return {passed:Object.values(checks).every(Boolean),checks};
  }

  window.OTSourcePrecedence={levels:LEVELS,normalizeSource,priority,isBlank,sameValue,canReplace,preserveCandidate,markUserChanges,runRegressionChecks};
})();
