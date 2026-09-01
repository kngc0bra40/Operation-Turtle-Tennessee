/* Operation Turtle 5.0 workspace coordination. No property or startup persistence. */
(()=>{
'use strict';
const definitions={
  dossier:{selector:'#drawer',label:'Property',isOpen:el=>el.classList.contains('open')},
  add:{selector:'#addView',label:'Add Property',isOpen:el=>el.classList.contains('active')},
  compare:{selector:'#compareView',label:'Compare',isOpen:el=>el.classList.contains('desktop-open')||el.classList.contains('active')&&matchMedia('(max-width:899px)').matches},
  settings:{selector:'#settingsPanel',label:'Settings',isOpen:el=>!el.hidden},
  dashboard:{selector:'#dashboardPanel',label:'Dashboard',isOpen:el=>!el.hidden},
  scorecard:{selector:'#scorecardPanel',label:'Property Profile',isOpen:el=>!el.hidden},
  planning:{selector:'#sitePlanningPanel',label:'Site Planning',isOpen:el=>!el.hidden},
  parcel:{selector:'#parcelFixPanel',label:'Fix Parcel',isOpen:el=>!el.hidden},
  listing:{selector:'#zillowFactsPanel',label:'Listing Details',isOpen:el=>!el.hidden},
  routes:{selector:'#routeEditPanel',label:'Route Details',isOpen:el=>!el.hidden}
};
const minimized=new Set();
let observerBusy=false,drag=null;
const byName=name=>{const config=definitions[name],element=config&&document.querySelector(config.selector);return element?{name,config,element}:null};
const isDesktop=()=>matchMedia('(min-width:900px)').matches;
function openNames(){return Object.keys(definitions).filter(name=>{const item=byName(name);return item&&item.config.isOpen(item.element)&&!minimized.has(name)})}
function headerFor(element){return element.querySelector('[data-panel-drag-handle],.drawer-head,.settings-head,.form-head,.compare-head,.workspace-panel-head')}
function ensureControls(name){
  const item=byName(name);if(!item||!isDesktop()||name==='routes')return;const header=headerFor(item.element);if(!header||header.querySelector('[data-panel-minimize]'))return;
  const minimizeButton=document.createElement('button');minimizeButton.type='button';minimizeButton.className='panel-minimize-btn';minimizeButton.dataset.panelMinimize=name;minimizeButton.setAttribute('aria-label',`Minimize ${item.config.label}`);minimizeButton.title='Minimize';minimizeButton.textContent='—';
  const existingClose=header.querySelector('.drawer-close,.form-close,[id^="close"]');existingClose?.parentElement===header?header.insertBefore(minimizeButton,existingClose):header.append(minimizeButton);
  if(name==='compare'&&!header.querySelector('[data-panel-close]')){const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='panel-close-btn';closeButton.dataset.panelClose=name;closeButton.setAttribute('aria-label','Close Compare');closeButton.title='Close';closeButton.textContent='✕';header.append(closeButton)}
}
function dockButton(name){const dock=document.getElementById('panelDock'),item=byName(name);if(!dock||!item)return;let button=dock.querySelector(`[data-panel-restore="${name}"]`);if(!button){button=document.createElement('button');button.type='button';button.dataset.panelRestore=name;button.textContent=item.config.label;dock.append(button)}dock.hidden=false}
function removeDockButton(name){const dock=document.getElementById('panelDock');dock?.querySelector(`[data-panel-restore="${name}"]`)?.remove();if(dock&&!dock.children.length)dock.hidden=true}
function hideElement(name,element){
  element.dataset.otMinimized='true';
  if(name==='dossier'){element.classList.remove('open');document.getElementById('drawerBackdrop')?.classList.remove('open')}
  else if(name==='add')element.classList.remove('active');
  else if(name==='compare'){element.classList.remove('desktop-open');const button=document.getElementById('desktopCompareBtn');if(button)button.textContent='Compare'}
  else element.hidden=true;
  if(name==='planning')document.getElementById('planningMapToolbar')?.setAttribute('hidden','');
}
function showElement(name,element){
  delete element.dataset.otMinimized;
  if(name==='dossier'){element.classList.add('open');if(!isDesktop())document.getElementById('drawerBackdrop')?.classList.add('open')}
  else if(name==='add'){if(isDesktop())element.classList.add('active');else document.querySelector('[data-view="addView"]')?.click()}
  else if(name==='compare'){if(isDesktop()){element.classList.add('desktop-open');const button=document.getElementById('desktopCompareBtn');if(button)button.textContent='Map'}else document.querySelector('[data-view="compareView"]')?.click()}
  else element.hidden=false;
  if(name==='planning')document.getElementById('planningMapToolbar')?.removeAttribute('hidden');
}
function minimize(name){const item=byName(name);if(!item||minimized.has(name)||!item.config.isOpen(item.element))return false;minimized.add(name);hideElement(name,item.element);dockButton(name);return true}
function restore(name){const item=byName(name);if(!item)return false;prepare(name);minimized.delete(name);removeDockButton(name);showElement(name,item.element);ensureControls(name);constrain(item.element);return true}
function clearMinimized(name){minimized.delete(name);removeDockButton(name);const item=byName(name);if(item)delete item.element.dataset.otMinimized}
function closeAdd(){const element=document.getElementById('addView');if(!element?.classList.contains('active'))return;document.getElementById('closeAddBtn')?.click();element.classList.remove('active');clearMinimized('add')}
function closeCompare(){const element=document.getElementById('compareView');if(!element)return;element.classList.remove('desktop-open');const button=document.getElementById('desktopCompareBtn');if(button)button.textContent='Compare';clearMinimized('compare')}
function closePanel(name){const item=byName(name);if(!item)return false;if(name==='add')closeAdd();else if(name==='compare')closeCompare();else if(name==='dossier')window.closeDrawer?.();else{const close=item.element.querySelector('[id^="close"],.drawer-close,.form-close');if(close)close.click();else item.element.hidden=true}clearMinimized(name);return true}
function prepare(name){
  if(!isDesktop())return;
  if(name==='compare'){closeAdd();minimize('dossier');['settings','dashboard','scorecard','parcel','planning','listing','routes'].forEach(closePanel)}
  else if(name==='planning'){closeAdd();minimize('dossier');['compare','settings','dashboard','scorecard','parcel','listing','routes'].forEach(closePanel)}
  else if(name==='parcel'){closeAdd();minimize('dossier');['compare','settings','dashboard','scorecard','planning','listing','routes'].forEach(closePanel)}
  else if(name==='add'){closeCompare();minimize('dossier');['settings','dashboard','scorecard','parcel','planning','listing','routes'].forEach(closePanel)}
  else if(['settings','dashboard','scorecard','listing','routes'].includes(name)){closeAdd();closeCompare();['planning','parcel'].forEach(closePanel);minimize('dossier')}
  else if(name==='dossier'){closeAdd();closeCompare();['settings','dashboard','scorecard','parcel','planning','listing','routes'].forEach(closePanel)}
}
function opened(name){clearMinimized(name);ensureControls(name);const item=byName(name);if(item)constrain(item.element)}
function constrain(element){if(!element||!isDesktop())return;const rect=element.getBoundingClientRect(),pad=10,maxLeft=Math.max(pad,innerWidth-Math.min(rect.width,innerWidth-pad*2)-pad),maxTop=Math.max(64,innerHeight-Math.min(rect.height,innerHeight-74)-pad);if(element.classList.contains('ot-drag-positioned')){element.style.left=`${Math.min(Math.max(pad,rect.left),maxLeft)}px`;element.style.top=`${Math.min(Math.max(64,rect.top),maxTop)}px`}}
function beginDrag(event){if(!isDesktop()||event.button!==0||event.target.closest('button,input,select,textarea,a,summary'))return;const header=event.target.closest('[data-panel-drag-handle],.drawer-head,.settings-head,.form-head,.compare-head,.workspace-panel-head');if(!header)return;const entry=Object.entries(definitions).map(([name])=>byName(name)).find(item=>item?.element.contains(header));if(!entry||!entry.config.isOpen(entry.element))return;const rect=entry.element.getBoundingClientRect();drag={entry,startX:event.clientX,startY:event.clientY,left:rect.left,top:rect.top,width:rect.width,height:rect.height};entry.element.classList.add('ot-drag-positioned');entry.element.style.left=`${rect.left}px`;entry.element.style.top=`${rect.top}px`;entry.element.style.right='auto';entry.element.style.bottom='auto';entry.element.style.width=`${rect.width}px`;entry.element.style.height=`${Math.min(rect.height,innerHeight-84)}px`;entry.element.style.transform='none';header.setPointerCapture?.(event.pointerId);event.preventDefault()}
function moveDrag(event){if(!drag)return;const pad=10,left=Math.min(Math.max(pad,drag.left+event.clientX-drag.startX),Math.max(pad,innerWidth-drag.width-pad)),top=Math.min(Math.max(64,drag.top+event.clientY-drag.startY),Math.max(64,innerHeight-drag.height-pad));drag.entry.element.style.left=`${left}px`;drag.entry.element.style.top=`${top}px`}
function endDrag(){drag=null}
function inspect(){if(observerBusy)return;observerBusy=true;try{for(const name of openNames()){ensureControls(name);const item=byName(name);if(item&&!item.element.dataset.otObservedOpen){prepare(name);item.element.dataset.otObservedOpen='true';opened(name)}}Object.keys(definitions).forEach(name=>{const item=byName(name);if(item&&!item.config.isOpen(item.element))delete item.element.dataset.otObservedOpen})}finally{observerBusy=false}}
function install(){
  document.getElementById('panelDock')?.setAttribute('hidden','');
  document.addEventListener('click',event=>{const minimizeButton=event.target.closest('[data-panel-minimize]'),restoreButton=event.target.closest('[data-panel-restore]'),closeButton=event.target.closest('[data-panel-close]');if(minimizeButton){event.preventDefault();minimize(minimizeButton.dataset.panelMinimize||Object.keys(definitions).find(name=>byName(name)?.element.contains(minimizeButton)));return}if(restoreButton){event.preventDefault();restore(restoreButton.dataset.panelRestore);return}if(closeButton){event.preventDefault();closePanel(closeButton.dataset.panelClose)}});
  document.addEventListener('pointerdown',beginDrag);document.addEventListener('pointermove',moveDrag);document.addEventListener('pointerup',endDrag);addEventListener('resize',()=>Object.keys(definitions).forEach(name=>constrain(byName(name)?.element)));
  new MutationObserver(inspect).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});inspect()
}
window.OTOverlayManager={prepare,opened,minimize,restore,close:closePanel,active:openNames,definitions};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
