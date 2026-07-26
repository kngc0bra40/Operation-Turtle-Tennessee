(function(){
'use strict';
const enabled=window.OT_CONFIG?.developerMode===true;
const state={startedAt:performance.now(),mapLoadMs:null,lastSave:null,propertyId:'',concept:'',coordinateSource:''};
function storageBytes(){try{return Object.keys(localStorage).filter(key=>key.startsWith('ot-')).reduce((total,key)=>total+(localStorage.getItem(key)||'').length,0)}catch{return 0}}
function ensurePanel(){if(!enabled||document.getElementById('otDiagnostics'))return document.getElementById('otDiagnostics');const panel=document.createElement('aside');panel.id='otDiagnostics';panel.className='ot-diagnostics';panel.setAttribute('aria-live','polite');document.body.appendChild(panel);return panel}
function render(){if(!enabled)return;const panel=ensurePanel();if(!panel)return;const save=state.lastSave,rows=[['Map',state.mapLoadMs===null?'pending':`${Math.round(state.mapLoadMs)} ms`],['Save',save?`${save.success?'ok':'failed'} · ${Math.round(save.durationMs||0)} ms`:'none'],['Storage',`${(storageBytes()/1024).toFixed(1)} KB`],['Property',state.propertyId||'none'],['Concept',state.concept||'none'],['Coordinates',state.coordinateSource||'unknown']];panel.innerHTML=`<b>Developer diagnostics</b>${rows.map(([label,value])=>`<span>${label}: ${String(value)}</span>`).join('')}`}
function setContext(next={}){Object.assign(state,Object.fromEntries(Object.entries(next).filter(([,value])=>value!==undefined)));render()}
function recordSave(next={}){state.lastSave={...next,at:new Date().toISOString()};render()}
function recordMapReady(){state.mapLoadMs=performance.now()-state.startedAt;render()}
window.OTDiagnostics={enabled,recordSave,recordMapReady,setContext,render,getState:()=>({...state,storageBytes:storageBytes()})};
document.addEventListener('DOMContentLoaded',render);
})();
