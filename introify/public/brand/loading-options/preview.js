const choices = [
  { id: 'sun', name: '01 · Fine sun', tag: 'PROGRESS IN SYNC', copy: 'The ring leads; each ray lights as progress passes it. One continuous, measured movement.' },
  { id: 'ring', name: '02 · Soft frame', tag: 'A NEW SILHOUETTE', copy: 'A softly rounded square draws itself around the icon. A clean alternative to a circle.' },
  { id: 'halo', name: '03 · Contour', tag: 'THREE QUIET LAYERS', copy: 'Three open arcs build from the inside out, like fine contours around the moving mark.' },
  { id: 'compass', name: '04 · Four beats', tag: 'SMALL & EXPRESSIVE', copy: 'Four short strokes take turns filling and settling. A little rhythm without a surrounding ring.' },
  { id: 'ticks', name: '05 · Sun dial', tag: 'LIGHT & RHYTHMIC', copy: 'A ring of 36 fine ticks lights in sequence, giving the icon room to lead.' },
  { id: 'base', name: '06 · Orbit base', tag: 'A DIFFERENT PERSPECTIVE', copy: 'Progress travels around a tilted ring beneath the icon, like a small illuminated base.' },
  { id: 'grounded', name: '07 · Grounded orbit', tag: 'STUDIO 04 · ONE SHARED CLOCK', copy: 'The ring meets the icon at its lowest point. Its leading edge arrives at contact, with one progress cycle for every 2.8-second take.' },
];
const root = document.querySelector('#collection');
const dialog = document.querySelector('#screen');
let selected = null;
let iconOption = 9;
try { selected = localStorage.getItem('introify-loader-choice'); } catch {}
let fullscreenChoice = choices[0], dark = false;
let progressTargets=[];
let cycleStart=performance.now();
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
function rays(count, start, end, extra = '') {
  return Array.from({length:count}, (_, i) => `<line ${extra} x1="64" y1="${64-start}" x2="64" y2="${64-end}" transform="rotate(${i*360/count} 64 64)" style="--i:${i}"/>`).join('');
}
function loader(id, mode) {
  if(id==='grounded')return `<div class="loader grounded"><img class="symbol motion" src="./grounded/loader-${mode}.svg" alt=""><img class="symbol still" src="./grounded/loader-${mode}-still.svg" alt=""></div>`;
  const circles = '<circle class="track" cx="64" cy="64" r="50"/><circle class="sweep" data-progress-part="0" cx="64" cy="64" r="50" pathLength="100" transform="rotate(-90 64 64)"/>';
  let frame='';
  if(id==='sun')frame=circles+`<g class="sun-rays">${Array.from({length:24},(_,i)=>`<line data-ray="${i}" x1="64" y1="9" x2="64" y2="4" transform="rotate(${i*15} 64 64)"/>`).join('')}</g>`;
  if(id==='ring'){
    const shape='M64 13 H94 Q115 13 115 34 V94 Q115 115 94 115 H34 Q13 115 13 94 V34 Q13 13 34 13 Z';
    frame=`<path class="track" d="${shape}"/><path class="sweep" data-progress-part="0" pathLength="100" d="${shape}"/>`;
  }
  if(id==='halo')frame=[43,51,59].map((r,i)=>{const x=(64-r*Math.sin(Math.PI/6)).toFixed(3),end=(64+r*Math.sin(Math.PI/6)).toFixed(3),y=(64+r*Math.cos(Math.PI/6)).toFixed(3);const shape=`M${x} ${y} A${r} ${r} 0 1 1 ${end} ${y}`;return `<path class="track" d="${shape}"/><path class="sweep" data-progress-part="${i}" data-parts="3" pathLength="100" d="${shape}"/>`;}).join('');
  if(id==='compass')frame=Array.from({length:4},(_,i)=>`<g transform="rotate(${i*90} 64 64)"><path class="beat-track" d="M59 12 H69"/><path class="beat-fill" data-progress-part="${i}" data-parts="4" pathLength="100" d="M59 12 H69"/></g>`).join('');
  if(id==='ticks')frame=`<g class="ticks">${rays(36,53,59)}${rays(36,53,59,'class="lit"')}</g>`;
  if(id==='base')frame=circles;
  return `<div class="loader ${id}"><svg class="frame" viewBox="0 0 128 128" aria-hidden="true">${frame}</svg><img class="symbol motion" src="/brand/motion/options/option-${iconOption}/introify-symbol-${mode}.svg" alt=""><img class="symbol still" src="./stills/option-${iconOption}-${mode}.svg" alt=""></div>`;
}
function stage(choice, mode) { return `<div class="stage ${mode}"><span class="mode">${mode.toUpperCase()}</span>${loader(choice.id,mode)}</div>`; }
function render() {
  root.innerHTML = choices.map(choice => `<article class="card" data-id="${choice.id}" data-selected="${selected===choice.id}"><div class="card-top"><span class="number">OPTION ${choice.name.slice(0,2)}</span><span class="tag">${choice.tag}</span></div><div class="pair">${stage(choice,'light')}${stage(choice,'dark')}</div><div class="card-copy"><h2>${choice.name}</h2><p>${choice.copy}</p><div class="actions"><button class="choose" data-choose="${choice.id}" aria-pressed="${selected===choice.id}">${selected===choice.id?'Selected ✓':'Choose this'}</button><button class="expand" data-preview="${choice.id}">View fullscreen ↗</button></div></div></article>`).join('');
  const choice = choices.find(c=>c.id===selected);
  document.querySelector('#selection-status').textContent = choice ? `Selected: ${choice.name} · Saved in this browser for your review.` : 'Choose a direction to save your preference.';
  collectProgress();
}
function screen() {
  document.querySelector('#screen-stage').innerHTML = stage(fullscreenChoice,dark?'dark':'light');
  document.querySelector('#screen-name').textContent = `${fullscreenChoice.name} · Icon ${fullscreenChoice.id==='grounded'?4:iconOption} · ${fullscreenChoice.id==='grounded'?'2.8s synchronized loop · ':''}Actual page-loading size`;
  document.querySelector('#switch-mode').textContent = `Switch to ${dark?'light':'dark'}`;
  collectProgress();
}
function collectProgress(){progressTargets=[...document.querySelectorAll('.loader')].map(el=>({el,parts:[...el.querySelectorAll('[data-progress-part]')],rays:[...el.querySelectorAll('[data-ray]')]}));}
// One clock drives the ring and ray thresholds; independent CSS animations can drift.
function paintProgress(now){
  const phase=((now-cycleStart)%6388)/6388;
  const progress=reducedMotion.matches ? 0.7 : Math.min(1,1-Math.pow(1-Math.min(1,phase/.89),1.65));
  const opacity=reducedMotion.matches?1:phase>.96?Math.max(0,(1-phase)/.04):1;
  for(const target of progressTargets){
    target.el.dataset.progress=progress.toFixed(4);
    for(const part of target.parts){const value=Math.max(0,Math.min(1,progress*Number(part.dataset.parts||1)-Number(part.dataset.progressPart)));part.style.strokeDashoffset=String(100-value*100);part.style.opacity=String(opacity);}
    for(const ray of target.rays){const lit=progress>0&&progress>=Number(ray.dataset.ray)/24;ray.setAttribute('data-lit',String(lit));ray.style.opacity=String((lit?1:.22)*opacity);}
  }
  requestAnimationFrame(paintProgress);
}
requestAnimationFrame(paintProgress);
root.addEventListener('click', event => {
  const choose = event.target.closest('[data-choose]'), preview = event.target.closest('[data-preview]');
  if (choose) { selected = choose.dataset.choose; try { localStorage.setItem('introify-loader-choice',selected); } catch {} render(); }
  if (preview) { fullscreenChoice = choices.find(c=>c.id===preview.dataset.preview); dark=false; screen(); dialog.showModal(); }
});
document.querySelector('#switch-mode').addEventListener('click',()=>{dark=!dark;screen();});
document.querySelector('#replay').addEventListener('click',()=>{cycleStart=performance.now();render();document.querySelectorAll('.symbol.motion').forEach(img=>{img.src=img.src.split('?')[0]+'?replay='+Date.now();});});
render();
document.querySelector('#icon-option').addEventListener('change',event=>{
  iconOption=Number(event.target.value);
  document.querySelector('.spec span').textContent=`01 / Saved icon ${iconOption}`;
  const link=document.querySelector('#download-icon');link.href=`/brand/motion/options/option-${iconOption}/introify-symbol-light.svg`;link.download=`introify-icon-option-${iconOption}.svg`;
  render();
});
function showSaved(options){
  const target=document.querySelector('#saved-options');target.replaceChildren();
  options.sort((a,b)=>b.option-a.option).forEach(option=>{
    const link=document.createElement('a');link.href=`/brand/loading-options/saved/option-${option.option}/settings.json`;link.download=`introify-loader-option-${option.option}.json`;link.textContent=`Loader ${option.option} · ${option.name} · Icon ${option.iconOption} ↗`;target.append(link);
  });
}
async function refreshSaved(){
  const response=await fetch('/api/loader-options');if(!response.ok)throw Error('Open this collection on port 3113 to save numbered presets.');
  const data=await response.json(),select=document.querySelector('#icon-option');select.replaceChildren();
  data.icons.forEach(icon=>{const option=document.createElement('option');option.value=icon.option;option.textContent=`Saved icon · Option ${icon.option}${Number.isFinite(icon.duration)?` (${icon.duration.toFixed(2)}s)`:''}`;select.append(option);});select.value=iconOption;
  showSaved(data.saved);
}
document.querySelector('#save-option').addEventListener('click',async()=>{
  const button=document.querySelector('#save-option'),status=document.querySelector('#save-status');
  if(!selected){status.textContent='Choose a loader design first.';return;}
  button.disabled=true;
  try{
    const response=await fetch('/api/loader-options',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),design:selected,iconOption:selected==='grounded'?4:iconOption,name:document.querySelector('#preset-name').value})});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Save failed.');
    status.textContent=`Saved Loader Option ${result.option} with Icon Option ${result.iconOption}. SVG files and settings are stored on disk.`;
    await refreshSaved();
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});
refreshSaved().catch(error=>{document.querySelector('#save-status').textContent=error.message;});
async function loadBrandArchive(){
  const response=await fetch('/brand/loaders/catalog.json');if(!response.ok)return;
  const catalog=await response.json(),nav=document.querySelector('#brand-archive');nav.replaceChildren();
  for(const entry of [...catalog.options,...(catalog.motionArchives||[])]){
    const link=document.createElement('a');link.href=entry.path;link.textContent=`${entry.kind==='motion'?'Studio ':''}${String(entry.option).padStart(2,'0')} · ${entry.name} · ${entry.status}`;nav.append(link);
  }
  const locked=catalog.options.find(entry=>entry.status==='locked');
  if(locked){
    selected=choices[locked.option-1].id;
    try{localStorage.setItem('introify-loader-choice',selected);}catch{}
    render();
    document.querySelector('#selection-status').textContent=`Locked: ${String(locked.option).padStart(2,'0')} · ${locked.name} · Preserved in the brand archive.`;
    document.querySelector(`[data-id="${selected}"] .tag`).textContent='LOCKED REFERENCE';
  }
}
loadBrandArchive().catch(()=>{});
