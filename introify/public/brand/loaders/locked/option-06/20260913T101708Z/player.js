const iconOption=9; let progressTargets=[]; const cycleStart=performance.now(); const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function rays(count, start, end, extra = '') {
  return Array.from({length:count}, (_, i) => `<line ${extra} x1="64" y1="${64-start}" x2="64" y2="${64-end}" transform="rotate(${i*360/count} 64 64)" style="--i:${i}"/>`).join('');
}
function loader(id, mode) {
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
  return `<div class="loader ${id}"><svg class="frame" viewBox="0 0 128 128" aria-hidden="true">${frame}</svg><img class="symbol motion" src="./icon-${mode}.svg" alt=""><img class="symbol still" src="./icon-${mode}-still.svg" alt=""></div>`;
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

document.querySelector('.panels').innerHTML=['light','dark'].map(mode=>`<div class="stage ${mode}"><span class="mode">${mode.toUpperCase()}</span>${loader('base',mode)}</div>`).join(''); collectProgress();
