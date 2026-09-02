/* Desktop property map-mode controls. Mobile and tablet navigation is unchanged. */
(()=>{
'use strict';
let activeId='';
const $=id=>document.getElementById(id);
const desktop=()=>matchMedia('(min-width:900px)').matches;
function activePropertyId(){return activeId}
function showToolbar(show=true){const toolbar=$('propertyMapToolbar');if(toolbar)toolbar.hidden=!show||!desktop()}
function enter(){if(!activeId||!desktop())return false;window.OTOverlayManager?.enterMapMode?.(activeId);showToolbar(true);window.OTLandAssessment?.renderForProperty?.(activeId);return true}
function restore(){window.OTOverlayManager?.restorePanels?.();showToolbar(false)}
function install(){
 const previousOpen=window.openProperty;window.openProperty=function(id){activeId=String(id||'');window.OTRecreationLayers?.setActiveProperty?.(activeId);return previousOpen?.(id)};
 document.addEventListener('click',event=>{const button=event.target.closest('#drawer .dossier-tabs button');if(button?.textContent.trim()==='Map & Site'&&desktop())setTimeout(enter,0)});
 $('propertyMapParcelBtn')?.addEventListener('click',()=>activeId&&window.OTParcelWorkflow?.open?.(activeId));
 $('propertyMapAssessmentBtn')?.addEventListener('click',async event=>{if(!activeId)return;const button=event.currentTarget;button.disabled=true;button.textContent='Assessing…';try{await window.OTLandAssessment?.run?.(activeId,{force:true,trigger:'map-toolbar'})}finally{button.disabled=false;button.textContent='Land Assessment'}});
 $('propertyMapPlanningBtn')?.addEventListener('click',()=>activeId&&window.OTPlanning?.open?.(activeId));
 $('propertyMapRestoreBtn')?.addEventListener('click',restore);
 addEventListener('resize',()=>{if(!desktop())showToolbar(false)});
}
window.OTMapWorkspace={activePropertyId,enter,restore};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
