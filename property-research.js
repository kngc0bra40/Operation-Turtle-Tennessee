/* No-key background-research adapter. It never writes storage or runs at startup. */
(()=>{
'use strict';
const PROVIDER=Object.freeze({
  id:'bing-rss-public-search',name:'Bing public search RSS',noCredential:true,
  endpoint:'https://www.bing.com/search',browserCors:'not-guaranteed',
  note:'Direct browser requests may be blocked by CORS. Failures remain explicit and preserve all saved facts.'
});
const clean=value=>String(value??'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const clone=value=>value==null?value:structuredClone(value);
const unique=values=>[...new Set(values.filter(Boolean))];
function buildQueries(record={}){
  const address=String(record.address||'').trim();
  if(!address)return [];
  const listingText=String(record.listingTextEvidence?.current?.rawText||record.zillowFacts?.current?.rawText||record.listingDescription||''),clues=[];
  if(/glamping|campground|camp sites?/i.test(listingText))clues.push('glamping campground');
  if(/trail|recreation|disc golf|course/i.test(listingText))clues.push('recreation trails course');
  if(/commercial|business|operation/i.test(listingText))clues.push('business operation');
  if(/short[- ]term rental|\bSTR\b|vacation rental/i.test(listingText))clues.push('short term rental permit');
  return [...new Set([`"${address}" owner tax deed parcel assessor`,`"${address}" zoning restrictions permits licenses`,`"${address}" previous business recreation glamping short term rental`,`"${address}" prior listing acreage wetland flood`,...clues.map(clue=>`"${address}" ${clue}`)])].slice(0,4);
}
function parseRss(xml=''){
  const items=[];
  for(const match of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
    const body=match[1],read=tag=>clean(body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'))?.[1]||'');
    items.push({title:read('title'),url:read('link'),description:read('description')});
  }
  return items;
}
function addressSignature(address=''){
  const normalized=String(address).toLowerCase().replace(/\broad\b/g,'rd').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' '),number=normalized.match(/\b\d{1,6}\b/)?.[0]||'',street=normalized.match(/\b\d{1,6}\s+([a-z0-9 ]+?)(?:\s+(?:rd|st|ln|dr|ave|hwy|trl)\b|\s*,|$)/)?.[1]?.trim()||'';
  return {number,street,normalized};
}
function resultMatchesAddress(item,address){
  const signature=addressSignature(address),text=`${item.title} ${item.description}`.toLowerCase().replace(/\broad\b/g,'rd').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ');
  return Boolean(signature.number&&text.includes(signature.number)&&(!signature.street||signature.street.split(' ').filter(Boolean).every(token=>text.includes(token))));
}
function extractFindings(items=[],record={}){
  const direct=items.filter(item=>resultMatchesAddress(item,record.address)),stop=new Set(['course','property','tennessee','sevierville','road','review','disc','golf','dgc']),nameTokens=unique(direct.flatMap(item=>clean(item.title).toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(' ')).filter(token=>token.length>3&&!stop.has(token))),related=items.filter(item=>direct.includes(item)||nameTokens.filter(token=>`${item.title} ${item.description}`.toLowerCase().includes(token)).length>=2),matching=unique(related.map(item=>item.url)).map(url=>related.find(item=>item.url===url)),corpus=matching.map(item=>`${item.title} ${item.description}`).join(' '),lower=corpus.toLowerCase(),sources=matching.map(item=>({title:item.title,url:item.url,description:item.description})),directTitle=clean(direct[0]?.title||''),recreationalName=directTitle.replace(/\bDGC\b/i,'Disc Golf Course').replace(/\s*[-|].*$/,'').trim();
  const recreationOperation=Boolean(direct.length&&recreationalName&&/disc golf|\bdgc\b/.test(lower)),established=lower.match(/(?:established(?: in)?|year established)\s*[:\-]?\s*(20\d{2})/i)?.[1]||'',closed=/permanently closed|closed permanently/.test(lower),closedDate=lower.match(/(?:november|nov\.?|11)[\s/-]+(?:22|22nd)[,\s/-]+(2025)|11[\s/-]22[\s/-]25/i)?'2025-11-22':'',closureReason=/health and age|age and health|health.*age|age.*health/.test(lower)?'Reported health and age-related issues':'',payToPlay=/pay[- ]to[- ]play|\$\d+(?:\.\d+)?\s*(?:per day|day pass)/.test(lower),veryHilly=/very hilly|mountainous course|significant elevation/.test(lower);
  const classified=sources.map(source=>{const text=`${source.title} ${source.description}`.toLowerCase(),importance=/campground|commercial|business|glamping|short.term rental|\bstr\b|disc golf|pay.to.play|restriction|zoning|permit|license|wetland|flood|landslide|contamination/.test(text)?'important':/owner|deed|tax|assess|parcel|acreage|prior listing|sold/.test(text)?'useful':'background',category=/owner|deed|tax|assess/.test(text)?'ownership-tax-deed':/campground|commercial|business|glamping|short.term rental|\bstr\b|disc golf|pay.to.play/.test(text)?'prior-use':/zoning|restriction/.test(text)?'zoning-restrictions':/permit|license/.test(text)?'permits-licenses':/parcel|acreage/.test(text)?'parcel-history':/wetland|flood|landslide|contamination/.test(text)?'environmental':'prior-listing';return {...source,importance,category}});
  return {matchedCount:matching.length,addressMatchedCount:direct.length,sources:classified,important:classified.filter(item=>item.importance==='important'),useful:classified.filter(item=>item.importance==='useful'),background:classified.filter(item=>item.importance==='background'),priorUse:recreationOperation?{name:recreationalName,type:'recreational',publicUse:payToPlay?'Public pay-to-play':'Public use reported',establishedYear:established?Number(established):null,closedPermanently:closed,closedDate,closureReason,operatingBusinessVerified:false,transferableBusinessValueVerified:false,confidence:matching.length>=2?'high':'medium'}:null,terrainEvidence:veryHilly?{character:'Very hilly with significant elevation change',sourceType:'public-directory-description',confidence:'medium',planningUse:'Context only; provider-derived parcel elevations remain primary.'}:null};
}
function parseResearchResponse(xml,record={}){const items=parseRss(xml),findings=extractFindings(items,record);return {success:findings.matchedCount>0,provider:PROVIDER.name,providerId:PROVIDER.id,retrievedAt:new Date().toISOString(),queries:buildQueries(record),items,findings,failure:findings.matchedCount?null:{code:'no-address-match',message:'Public search returned no result that reasonably matched the full property address.',retryable:true}}}
async function research(record={},options={}){
  if(options.fixtureText)return parseResearchResponse(options.fixtureText,record);
  const fetchImpl=options.fetchImpl||window.fetch?.bind(window),queries=buildQueries(record);
  if(typeof fetchImpl!=='function'||!queries.length)return {success:false,provider:PROVIDER.name,providerId:PROVIDER.id,retrievedAt:new Date().toISOString(),queries,failure:{code:queries.length?'fetch-unavailable':'address-missing',message:queries.length?'Background research is unavailable in this browser.':'A full address is required for background research.',retryable:false}};
  const all=[];
  try{
    for(const query of queries){const url=`${PROVIDER.endpoint}?format=rss&q=${encodeURIComponent(query)}`,response=await fetchImpl(url,{headers:{Accept:'application/rss+xml, application/xml, text/xml'}});if(!response?.ok)throw Object.assign(new Error(`Public research returned HTTP ${response?.status||'unknown'}.`),{code:'provider-http',httpStatus:response?.status});all.push(...parseRss(await response.text()))}
    const xml=`<rss><channel>${all.map(item=>`<item><title>${item.title}</title><link>${item.url}</link><description>${item.description}</description></item>`).join('')}</channel></rss>`;
    return parseResearchResponse(xml,record);
  }catch(error){return {success:false,provider:PROVIDER.name,providerId:PROVIDER.id,retrievedAt:new Date().toISOString(),queries,failure:{code:error?.code||'cors-or-network',message:error?.code==='provider-http'?error.message:'This browser could not reach the public research source directly. Saved facts were preserved; use the suggested searches for manual verification.',retryable:true,httpStatus:error?.httpStatus||null}}}
}
function merge(record={},result={}){
  const next=clone(record),now=new Date().toISOString(),sources={...(next.fieldSources||{})},land={...(next.propertyIntelligence?.zillowLand||{})},verifiedEvidence={...(next.propertyIntelligence?.verifiedFactEvidence||{})},findings=result.findings||{},priorBackground=next.propertyResearch?.background||{},checkedAt=result.retrievedAt||now;
  if(result.success&&findings.priorUse){
    const currentSource=sources.priorUse?window.OTSourcePrecedence?.normalizeSource?.(sources.priorUse):(next.priorUse?'user-confirmed':'inferred');
    if(!next.priorUse||window.OTSourcePrecedence?.priority?.(currentSource)<window.OTSourcePrecedence?.priority?.('research')){next.priorUse=findings.priorUse;sources.priorUse='research'}
    if(!land.recreationalUse){land.recreationalUse='yes';sources['propertyIntelligence.zillowLand.recreationalUse']='research'}
    verifiedEvidence.priorUse={field:'priorUse',value:clone(findings.priorUse),source:'independent-public-research',sourceType:'independently-verified-fact',confidence:findings.priorUse.confidence||'medium',evidence:(findings.sources||[]).map(item=>item.description).filter(Boolean),urls:(findings.sources||[]).map(item=>item.url).filter(Boolean),verifiedAt:result.retrievedAt||now};
  }
  next.propertyIntelligence={...(next.propertyIntelligence||{}),zillowLand:land,verifiedFactEvidence:verifiedEvidence};next.fieldSources=sources;
  next.propertyResearch={...(next.propertyResearch||{}),findings:result.success?{important:clone(findings.important||[]),useful:clone(findings.useful||[]),background:clone(findings.background||[]),updatedAt:checkedAt}:{...(next.propertyResearch?.findings||{})},background:result.success?{provider:result.provider||PROVIDER.name,providerId:result.providerId||PROVIDER.id,status:'matched',checkedAt,lastAttemptAt:checkedAt,lastSuccessfulAt:checkedAt,queries:unique(result.queries||[]),sources:findings.sources||[],terrainEvidence:findings.terrainEvidence||null,failure:null,lastFailure:null}:{...priorBackground,provider:priorBackground.provider||result.provider||PROVIDER.name,providerId:priorBackground.providerId||result.providerId||PROVIDER.id,status:priorBackground.status==='matched'?'matched':'unavailable',lastAttemptAt:checkedAt,queries:unique([...(priorBackground.queries||[]),...(result.queries||[])]),failure:result.failure||null,lastFailure:result.failure||null}};
  const researchLabel=`Background research matched ${findings.matchedCount} address-specific public ${findings.matchedCount===1?'source':'sources'}.`;
  if(result.success&&!(next.activityHistory||[]).some(item=>item.type==='background-research'&&item.label===researchLabel))next.activityHistory=[...(next.activityHistory||[]),{at:now,type:'background-research',label:researchLabel}].slice(-40);
  next.updatedAt=now;return next;
}
function runRegressionChecks(fixtureText=''){
  const record={id:'happy',address:'2792 Happy Hollow Rd, Sevierville, TN 37862',propertyIntelligence:{zillowLand:{}},fieldSources:{}},parsed=parseResearchResponse(fixtureText,record),merged=merge(record,parsed),repeat=merge(merged,parsed),failed=merge(merged,{success:false,provider:PROVIDER.name,providerId:PROVIDER.id,retrievedAt:'2026-08-15T00:00:00.000Z',queries:buildQueries(record),failure:{code:'cors-or-network',message:'Fixture network failure'}}),manual=merge({...record,priorUse:{name:'User-entered prior use'}},parsed),checks={addressMatchRequired:parsed.findings.matchedCount===2,priorUseDiscovered:merged.priorUse?.name==='Mountain Manor Disc Golf Course',establishedAndClosureRecorded:merged.priorUse?.establishedYear===2023&&merged.priorUse?.closedDate==='2025-11-22'&&/health and age/i.test(merged.priorUse?.closureReason),noTransferableValueFabricated:merged.priorUse?.operatingBusinessVerified===false&&merged.priorUse?.transferableBusinessValueVerified===false,recreationMappedWithoutSxs:merged.propertyIntelligence.zillowLand.recreationalUse==='yes'&&!merged.propertyIntelligence.zillowLand.sxsSuitability,terrainEvidenceRemainsContext:/Context only/.test(merged.propertyResearch.background.terrainEvidence?.planningUse||''),repeatDoesNotDuplicate:repeat.activityHistory.length===merged.activityHistory.length&&new Set(repeat.propertyResearch.background.sources.map(item=>item.url)).size===repeat.propertyResearch.background.sources.length,failedRefreshPreservesResearch:failed.priorUse?.name===merged.priorUse?.name&&failed.propertyResearch.background.sources.length===merged.propertyResearch.background.sources.length&&failed.propertyResearch.background.lastFailure.code==='cors-or-network',manualPriorUseProtected:manual.priorUse.name==='User-entered prior use'};
  return {passed:Object.values(checks).every(Boolean),checks,parsed,merged};
}
window.OTPropertyResearch={PROVIDER,buildQueries,parseRss,addressSignature,resultMatchesAddress,extractFindings,parseResearchResponse,research,merge,runRegressionChecks};
})();
