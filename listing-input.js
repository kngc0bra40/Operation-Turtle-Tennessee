/* Canonical listing-input parser. It parses references only and never retrieves listing pages. */
(()=>{
'use strict';
const VERSION='1.0.0';
const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const suffixes=new Set(['rd','road','st','street','ave','avenue','ln','lane','dr','drive','hwy','highway','trl','trail','way','pike','blvd','boulevard','ct','court','cir','circle','hollow']);
function sourceFor(url=''){const value=url.toLowerCase();if(value.includes('zillow.'))return 'Zillow';if(value.includes('realtor.'))return 'Realtor.com';if(value.includes('redfin.'))return 'Redfin';if(value.includes('land.com')||value.includes('landwatch.'))return 'Land.com';if(value.includes('homes.com'))return 'Homes.com';return value?'Listing website':''}
function addressFromUrl(url=''){
 try{const parsed=new URL(url),path=decodeURIComponent(parsed.pathname).replace(/\+/g,' '),home=path.match(/\/homedetails\/([^/]+)/i)?.[1],redfin=path.match(/\/home\/[^/]*\/([^/]+)$/i)?.[1];let slug=(home||redfin||'').replace(/-\d+_zpid.*$/i,'').replace(/\/.*$/,'').replace(/-/g,' ').trim(),parts=slug.split(/\s+/),stateIndex=parts.findIndex(value=>/^(TN|Tennessee)$/i.test(value)),zip=parts[stateIndex+1];if(stateIndex<3||!/^\d{5}$/.test(zip||''))return clean(slug);const before=parts.slice(0,stateIndex),roadIndex=before.map(value=>value.replace(/\./g,'').toLowerCase()).findLastIndex(value=>suffixes.has(value));if(roadIndex<1)return clean(slug);return `${before.slice(0,roadIndex+1).join(' ')}, ${before.slice(roadIndex+1).join(' ')}, TN ${zip}`}catch{return ''}
}
function parse(value=''){
 const raw=clean(value);if(!raw)return {raw:'',url:'',address:'',source:'',zillowId:''};const url=/^https?:\/\//i.test(raw)?raw:'',source=sourceFor(url),zillowId=url.match(/\/(\d+)_zpid(?:\/|$)/i)?.[1]||'',address=url?addressFromUrl(url):raw;return {raw,url,address,source,zillowId};
}
function runRegressionChecks(){const url='https://www.zillow.com/homedetails/2792-Happy-Hollow-Rd-Sevierville-TN-37862/42509199_zpid/',parsed=parse(url),plain=parse('2792 Happy Hollow Rd, Sevierville, TN 37862'),checks={zillowAddress:parsed.address==='2792 Happy Hollow Rd, Sevierville, TN 37862',zillowId:parsed.zillowId==='42509199',originalUrl:parsed.url===url,source:parsed.source==='Zillow',plainAddress:plain.address==='2792 Happy Hollow Rd, Sevierville, TN 37862'&&plain.url===''};return {passed:Object.values(checks).every(Boolean),checks}}
window.OTListingInput={VERSION,sourceFor,addressFromUrl,parse,runRegressionChecks};
})();
