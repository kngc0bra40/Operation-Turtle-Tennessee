/* Operation Turtle 5.0 single-workspace coordination. No property or startup persistence. */
(()=>{
'use strict';
const definitions={
  dossier:{selector:'#drawer',label:'Property',isOpen:element=>element.classList.contains('open')},
  add:{selector:'#addView',label:'Add Property',isOpen:element=>element.classList.contains('active')},
  compare:{selector:'#compareView',label:'Compare',isOpen:element=>element.classList.contains('desktop-open')||element.classList.contains('active')&&matchMedia('(max-width:899px)').matches},
  settings:{selector:'#settingsPanel',label:'Settings',isOpen:element=>!element.hidden},
  dashboard:{selector:'#dashboardPanel',label:'Dashboard',isOpen:element=>!element.hidden},
  scorecard:{selector:'#scorecardPanel',label:'Property Profile',isOpen:element=>!element.hidden},
  planning:{selector:'#sitePlanningPanel',label:'Site Planning',isOpen:element=>!element.hidden},
  parcel:{selector:'#parcelFixPanel',label:'Fix Parcel',isOpen:element=>!element.hidden},
  listing:{selector:'#zillowFactsPanel',label:'Listing Details',isOpen:element=>!element.hidden},
  routes:{selector:'#routeEditPanel',label:'Route Details',isOpen:element=>!element.hidden}
};
const contextual=['settings','dashboard','scorecard','planning','parcel','listing','routes'];
let collapsedPropertyId='',observerBusy=false;
const byName=name=>{const config=definitions[name],element=config&&document.querySelector(config.selector);return element?{name,config,element}:null};
const isDesktop=()=>matchMedia('(min-width:900px)').matches;
function openNames(){return Object.keys(definitions).filter(name=>{const item=byName(name);return item&&item.config.isOpen(item.element)})}
function ensureDossierControl(){const drawer=document.getElementById('drawer'),header=drawer?.querySelector('.drawer-head');if(!header||header.querySelector('[data-collapse-property-panel]'))return;const button=document.createElement('button');button.type='button';button.className='panel-collapse-btn';button.dataset.collapsePropertyPanel='true';button.textContent='Collapse panel';button.title='Collapse the property panel and expand the map';const close=header.querySelector('.drawer-close');close?.parentElement===header?header.insertBefore(button,close):header.append(button)}
function closeAdd(){const element=document.getElementById('addView');if(!element?.classList.contains('active'))return;document.getElementById('closeAddBtn')?.click();element.classList.remove('active')}
function closeCompare(){const element=document.getElementById('compareView');if(!element)return;element.classList.remove('desktop-open');const button=document.getElementById('desktopCompareBtn');if(button)button.textContent='Compare'}
function closePanel(name){const item=byName(name);if(!item)return false;if(name==='add')closeAdd();else if(name==='compare')closeCompare();else if(name==='dossier')window.closeDrawer?.();else{const close=item.element.querySelector('[id^="close"],.drawer-close,.form-close');if(close)close.click();else item.element.hidden=true}return true}
function collapseDossier(){const drawer=document.getElementById('drawer');if(!isDesktop()||!drawer?.classList.contains('open'))return false;collapsedPropertyId=window.OTMapWorkspace?.activePropertyId?.()||collapsedPropertyId;drawer.classList.remove('open');document.getElementById('drawerBackdrop')?.classList.remove('open');const toolbar=document.getElementById('propertyMapToolbar');if(toolbar)toolbar.hidden=false;setTimeout(()=>window.OT_MAP?.invalidateSize?.(),50);return true}
function openDossier(){const drawer=document.getElementById('drawer');if(!isDesktop()||!drawer)return false;if(collapsedPropertyId&&window.openProperty)window.openProperty(collapsedPropertyId);else drawer.classList.add('open');const toolbar=document.getElementById('propertyMapToolbar');if(toolbar)toolbar.hidden=true;ensureDossierControl();setTimeout(()=>window.OT_MAP?.invalidateSize?.(),50);return true}
function prepare(name){if(!isDesktop())return;if(name==='dossier'){closeAdd();closeCompare();contextual.forEach(closePanel);return}if(name==='add'||name==='compare'){name==='add'?closeCompare():closeAdd();contextual.forEach(closePanel);collapseDossier();return}if(contextual.includes(name)){closeAdd();closeCompare();contextual.filter(other=>other!==name).forEach(closePanel);collapseDossier()}}
function opened(name){if(name==='dossier'){collapsedPropertyId=window.OTMapWorkspace?.activePropertyId?.()||collapsedPropertyId;ensureDossierControl()}window.OTFeedback?.show?.(`${definitions[name]?.label||'Panel'} opened.`,'status')}
function minimize(name){return name==='dossier'?collapseDossier():closePanel(name)}
function restore(name){return name==='dossier'?openDossier():false}
function enterMapMode(){if(!isDesktop())return false;closeAdd();closeCompare();document.querySelector('[data-view="mapView"]')?.click();return collapseDossier()}
function restorePanels(){return openDossier()}
function inspect(){if(observerBusy)return;observerBusy=true;try{const drawer=document.getElementById('drawer');if(drawer&&definitions.dossier.isOpen(drawer))ensureDossierControl()}finally{observerBusy=false}}
function install(){document.getElementById('panelDock')?.setAttribute('hidden','');document.addEventListener('click',event=>{const collapse=event.target.closest('[data-collapse-property-panel]');if(collapse){event.preventDefault();collapseDossier();return}const close=event.target.closest('[id^="close"],.form-close'),contextName=contextual.find(name=>byName(name)?.element.contains(close));if(close&&contextName&&collapsedPropertyId)setTimeout(openDossier,0)});new MutationObserver(inspect).observe(document.getElementById('drawer')||document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});inspect()}
window.OTOverlayManager={prepare,opened,minimize,restore,enterMapMode,restorePanels,collapseDossier,openDossier,close:closePanel,active:openNames,definitions};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
