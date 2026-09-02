/* Desktop property map-mode controls. Mobile and tablet navigation is unchanged. */
(()=>{
'use strict';
let activeId='';
const $=id=>document.getElementById(id);
const desktop=()=>matchMedia('(min-width:900px)').matches;
function activePropertyId(){return activeId}
function showToolbar(show=true){const toolbar=$('propertyMapToolbar');if(toolbar)toolbar.hidden=!show||!desktop()}
function syncControls(){const record=activeId&&window.OTPropertyStore?.getProperty?.(activeId),assessment=$('propertyMapAssessmentBtn'),parcel=$('propertyMapParcelBtn'),planning=$('propertyMapPlanningBtn');if(parcel){parcel.disabled=!record;parcel.title=record?'Review or correct the Property Boundary':'Open a property first'}if(assessment){assessment.disabled=!record?.parcelGeometry;assessment.title=record?.parcelGeometry?'Run or retry the Land Assessment':'Parcel boundary required'}if(planning){planning.disabled=!record;planning.title=record?'Open Site Planning for this property':'Open a property first'}}
function enter(){if(!activeId||!desktop()){window.OTFeedback?.show?.('Open a property before entering map mode.','partial');return false}window.OTOverlayManager?.enterMapMode?.(activeId);showToolbar(true);syncControls();window.OTLandAssessment?.renderForProperty?.(activeId);return true}
function restore(){window.OTOverlayManager?.restorePanels?.();showToolbar(false)}
function install(){
 const previousOpen=window.openProperty;window.openProperty=function(id){activeId=String(id||'');window.OTRecreationLayers?.setActiveProperty?.(activeId);const result=previousOpen?.(id);syncControls();return result};
 $('propertyMapParcelBtn')?.addEventListener('click',()=>activeId&&window.OTParcelWorkflow?.open?.(activeId));
 $('propertyMapAssessmentBtn')?.addEventListener('click',async event=>{if(!activeId){window.OTFeedback?.show?.('Open a property before running Land Assessment.','partial');return}const record=window.OTPropertyStore?.getProperty?.(activeId),button=event.currentTarget;if(!record?.parcelGeometry){window.OTFeedback?.show?.('A confirmed Property Boundary is required before Land Assessment.','partial');return}button.disabled=true;button.textContent='Analyzing…';try{await window.OTLandAssessment?.run?.(activeId,{force:true,trigger:'map-toolbar'})}finally{button.disabled=false;button.textContent='Land Assessment'}});
 $('propertyMapPlanningBtn')?.addEventListener('click',()=>activeId&&window.OTPlanning?.open?.(activeId));
 $('propertyMapRestoreBtn')?.addEventListener('click',restore);
 addEventListener('resize',()=>{if(!desktop())showToolbar(false)});
 syncControls();
}
window.OTMapWorkspace={activePropertyId,enter,restore,syncControls};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
