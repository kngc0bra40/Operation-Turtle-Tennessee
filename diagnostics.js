(function(){
'use strict';
const enabled=window.OT_CONFIG?.developerMode===true;
const state={startedAt:performance.now(),mapLoadMs:null,lastSave:null,propertyId:'',concept:'',coordinateSource:''};
function storageReport(){return window.OTSaveReliability?.storageReport?.(localStorage)||{totalBytes:0,softLimitBytes:0,pressure:false,items:[]}}
function formatBytes(bytes){return bytes>=1024*1024?`${(bytes/1024/1024).toFixed(2)} MB`:`${(bytes/1024).toFixed(1)} KB`}
function storageBytes(){return storageReport().totalBytes}
function ensurePanel(){if(!enabled||document.getElementById('otDiagnostics'))return document.getElementById('otDiagnostics');const panel=document.createElement('aside');panel.id='otDiagnostics';panel.className='ot-diagnostics';panel.setAttribute('aria-live','polite');document.body.appendChild(panel);return panel}
function render(){if(!enabled)return;const panel=ensurePanel();if(!panel)return;const save=state.lastSave,storage=storageReport(),rows=[['Map',state.mapLoadMs===null?'pending':`${Math.round(state.mapLoadMs)} ms`],['Save',save?`${save.success?'ok':'failed'} · ${Math.round(save.durationMs||0)} ms`:'none'],['Storage',`${formatBytes(storage.totalBytes)}${storage.pressure?' · pressure':''}`],['Property',state.propertyId||'none'],['Concept',state.concept||'none'],['Coordinates',state.coordinateSource||'unknown']];const report=storage.items.length?`<details class="ot-storage-report"><summary>Storage report (${storage.items.length} keys)</summary>${storage.items.map(item=>`<span>${item.key}: ${formatBytes(item.bytes)} · ${item.percentage}% · ${item.recordCount} record${item.recordCount===1?'':'s'} · ${item.classification}</span>`).join('')}</details>`:'';panel.innerHTML=`<b>Developer diagnostics</b>${rows.map(([label,value])=>`<span>${label}: ${String(value)}</span>`).join('')}${report}`}
function setContext(next={}){Object.assign(state,Object.fromEntries(Object.entries(next).filter(([,value])=>value!==undefined)));render()}
function recordSave(next={}){state.lastSave={...next,at:new Date().toISOString()};render()}
function recordMapReady(){state.mapLoadMs=performance.now()-state.startedAt;render()}
window.OTDiagnostics={enabled,recordSave,recordMapReady,setContext,render,getStorageReport:storageReport,getState:()=>({...state,storageBytes:storageBytes(),storageReport:storageReport()})};
document.addEventListener('DOMContentLoaded',render);
})();
