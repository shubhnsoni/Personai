import {defaults as legacyDefaults,validate as validateSettings,buildMotion,phasePosition} from './core.mjs';
const defaults={...legacyDefaults,movement:'ribbon-logo'};
const validate=input=>{const c=validateSettings(input);if(c.movement==='full')c.movement='ribbon-logo';return c;};
import {createRecorder} from './recorder.js';
import {showSavedOption} from './options-ui.js';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg',storageKey='introify-motion-studio-v1';
const sharedPreview=new URL(location.href).searchParams.get('preview')==='shared';
document.querySelector('[data-phase=".13"]').textContent='Reveal';
let config={...defaults},base,templates={},roots=[],progress=0,last=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,explicit=false,ready=false,finalized=null,dirty=true,refreshFrame=0,recorder,motionSeconds=2.8;
const groups=[['Timing & movement',[
 ['speed','Playback speed',.25,2.5,.05,'×'],['orbitSpeed','Reveal speed',1,2,.05,'×'],['orbitDepth','3D depth',.5,1.4,.05,'×'],['ribbonHold','Ribbon morph duration',.4,2.5,.1,'×'],['logoHold','Gentle logo duration',.4,2.5,.1,'×'],['exitTime','Departure duration',.4,2.5,.1,'×'],['strength','Dot movement strength',0,1.5,.05,'×']]],
 ['3D rotation & camera', [['rotationX','Rotation X',-180,180,1,'°'],['rotationY','Rotation Y',-180,180,1,'°'],['rotationZ','Rotation Z',-180,180,1,'°'],['perspective','Camera distance',200,700,10,''],['orbitSize','Orbit size',.5,1.2,.05,'×'],['orbitTurns','Full turns',1,3,1,'']]],
 ['Whole icon', [['iconRotation','Whole icon rotation',-180,180,1,'°'],['iconX','Whole icon X position',-40,40,1,' px'],['iconY','Whole icon Y position',-40,40,1,' px']]],
 ['Dot of the i', [['dotDelay','Dot delay',-.3,.3,.01,' cycle'],['dotX','Horizontal position',-30,30,1,' px'],['dotY','Vertical position',-25,25,1,' px'],['dotScale','Dot size',.5,1.5,.05,'×']]],
 ['Ribbon placement',[['ribbonX','Horizontal position',-20,20,1,' px'],['ribbonY','Vertical position',-20,20,1,' px'],['ribbonScale','Ribbon size',.7,1.2,.025,'×'],['gap','Space before lettering',0,50,1,' px']]]];
for(const [title,controls] of groups){const field=document.createElement('fieldset');field.innerHTML='<legend>'+title+'</legend>';
 if(title==='Timing & movement')field.insertAdjacentHTML('beforeend','<div class="control"><label for="movement">Movement sequence</label><select id="movement"><option value="ribbon-logo">Ribbon loop → logo morph</option><option value="ribbon">Open ribbon loop</option><option value="gentle">Gentle logo motion</option></select></div>');
 if(title==='Dot of the i')field.insertAdjacentHTML('beforeend','<label class="check"><input id="sync" type="checkbox" checked>Sync dot with ribbon</label><p class="hint">Turn off sync to let the dot lead or follow. Position values are relative to the original artwork.</p>');
 if(title==='3D rotation & camera')field.insertAdjacentHTML('beforeend','<label class="check"><input id="attachDot" type="checkbox" checked>Attach dot to ribbon tip</label><div class="control"><label for="orbitDirection">Turn direction</label><select id="orbitDirection"><option value="1">Forward</option><option value="-1">Reverse</option></select></div><p class="hint">Camera controls shape the ribbon reveal and departure. The finished logo always settles into its front view.</p>');
 for(const [key,label,min,max,step,unit] of controls)field.insertAdjacentHTML('beforeend',`<div class="control"><label for="${key}">${label}<output id="${key}-value"></output></label><input id="${key}" type="range" min="${min}" max="${max}" step="${step}" data-unit="${unit}"></div>`);
 if(title==='Dot of the i')field.insertAdjacentHTML('beforeend','<div class="row"><button id="center-dot">Keep dot still</button><button id="reset-dot">Reset dot</button></div>');
 if(title==='Whole icon')field.insertAdjacentHTML('beforeend','<p class="hint">Rotate and move the dot and ribbon together, including the finished logo pose.</p><button id="reset-icon">Reset whole icon</button>');
 $('settings').append(field);
}
function status(message,error=false){$('status').textContent=message;$('status').style.color=error?'#ffb2ad':'';}
function syncControls(){for(const [key,value] of Object.entries(config)){const el=$(key);if(!el)continue;if(el.type==='checkbox')el.checked=value;else el.value=value;const out=$(key+'-value');if(out)out.value=Number(value).toFixed(key==='dotDelay'?2:el.step<1?2:0)+(el.dataset.unit||'');}$('dotDelay').disabled=config.sync;for(const key of ['orbitSpeed','orbitDepth','ribbonHold','logoHold','exitTime','rotationX','rotationY','rotationZ','perspective','orbitSize'])$(key).disabled=config.movement!=='ribbon-logo';}
function group(node,transform){const wrapper=node.ownerDocument.createElementNS(ns,'g');wrapper.setAttribute('transform',transform);node.parentNode.insertBefore(wrapper,node);wrapper.append(node);}
function compile(id,motion){const doc=new DOMParser().parseFromString(templates[id],'image/svg+xml'),svg=doc.documentElement;
 const layer=svg.querySelector('.motion'),paths=layer.querySelectorAll(':scope > path'),head=layer.querySelector('ellipse');
 const update=(node,map)=>{for(const a of node.querySelectorAll('animate')){const key=map[a.getAttribute('attributeName')];if(key){a.setAttribute('values',motion[key]);a.setAttribute('dur',motion.duration+'s');node.setAttribute(a.getAttribute('attributeName'),motion[key].split(';')[0]);}}};
 update(paths[0],{d:'trail',opacity:'trailOpacity'});update(paths[1],{d:'ring',opacity:'ringOpacity'});update(paths[2],{d:'body',opacity:'opacity'});update(head,{cx:'x',cy:'y',rx:'rx',ry:'ry'});
 const staticDot=`translate(${config.dotX} ${config.dotY}) translate(133 49) scale(${config.dotScale}) translate(-133 -49)`;
 const staticRibbon=`translate(${config.ribbonX} ${config.ribbonY}) translate(88 100) scale(${config.ribbonScale}) translate(-88 -100)`;
 const dot=motion.bakedPlacement?'':staticDot,ribbon=motion.bakedPlacement?'':staticRibbon;
 group(head,dot);group(paths[0],dot);group(paths[1],ribbon);group(paths[2],ribbon);
 if(motion.orbitPanels){
   const defs=svg.querySelector('defs'),paint=doc.createElementNS(ns,'radialGradient');
   paint.id='orbit-sphere';paint.setAttribute('cx','.28');paint.setAttribute('cy','.23');paint.setAttribute('r','.82');
   for(const [offset,color] of [[0,'#b5faff'],[.22,'#20dcef'],[.57,'#008fe1'],[1,id.endsWith('dark')?'#2845bb':'#12267f']]){const stop=doc.createElementNS(ns,'stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color',color);paint.append(stop);}defs.append(paint);head.setAttribute('fill','url(#orbit-sphere)');
   for(const side of ['back','front']){
     const mesh=doc.createElementNS(ns,'g');mesh.setAttribute('data-depth',side);mesh.setAttribute('transform',ribbon);
     for(const panel of motion.orbitPanels){const path=doc.createElementNS(ns,'path');for(const [attribute,key] of [['d','d'],['fill','color'],['opacity',side]]){path.setAttribute(attribute,panel[key].split(';')[0]);const a=doc.createElementNS(ns,'animate');a.setAttribute('attributeName',attribute);a.setAttribute('values',panel[key]);a.setAttribute('keyTimes',motion.keyTimes);a.setAttribute('dur',motion.duration+'s');a.setAttribute('repeatCount','indefinite');a.setAttribute('calcMode','linear');path.append(a);}mesh.append(path);}
     if(side==='back')layer.insertBefore(mesh,head.parentElement);else layer.append(mesh);
   }
 }
 const still=svg.querySelector('.still');group(still.querySelector('circle'),staticDot);group(still.querySelector('path'),staticRibbon);
 for(const node of [layer,still]){
  let current=node;
  for(const [type,key,fallback] of [['rotate','iconRotate',`${config.iconRotation} 88 100`],['translate','iconTranslate',`${config.iconX} ${config.iconY}`]]){
   const values=motion[key]??Array(121).fill(fallback).join(';');
   group(current,`${type}(${values.split(';')[0]})`);current=current.parentElement;
   if(node===layer){const a=doc.createElementNS(ns,'animateTransform');a.setAttribute('attributeName','transform');a.setAttribute('type',type);a.setAttribute('values',values);a.setAttribute('keyTimes',motion.keyTimes);a.setAttribute('dur',motion.duration+'s');a.setAttribute('repeatCount','indefinite');current.append(a);}
  }
 }
 if(id.startsWith('logo')){svg.lastElementChild.setAttribute('transform',`translate(${150+config.gap} 0)`);svg.setAttribute('viewBox',`-42 -42 ${940.41+config.gap} 302.41`);svg.setAttribute('width',940.41+config.gap);svg.setAttribute('height','302.41');}
 else{svg.setAttribute('viewBox','-42 -42 260 260');svg.setAttribute('width','260');svg.setAttribute('height','260');}
 if(id.startsWith('logo')&&motion.letteringTranslate){const a=doc.createElementNS(ns,'animateTransform');a.setAttribute('attributeName','transform');a.setAttribute('type','translate');a.setAttribute('values',motion.letteringTranslate);a.setAttribute('keyTimes',motion.keyTimes);a.setAttribute('dur',motion.duration+'s');a.setAttribute('repeatCount','indefinite');svg.lastElementChild.append(a);}
 if(motion.loop===false)for(const a of svg.querySelectorAll('animate,animateTransform')){a.setAttribute('repeatCount','1');a.setAttribute('fill','freeze');}
 // Inline previews need distinct paint/filter IDs. Exports use the same valid IDs.
 for(const node of svg.querySelectorAll('[id]')){const old=node.id,newId=id+'-'+old;node.id=newId;for(const other of svg.querySelectorAll('*'))for(const attr of [...other.attributes])if(attr.value.includes('url(#'+old+')'))other.setAttribute(attr.name,attr.value.replaceAll('url(#'+old+')','url(#'+newId+')'));}
 return svg;
}
function currentMotion(){return recorder?.motion(base)??buildMotion(base,config);}
function rebuild(){if(!ready)return;const motion=currentMotion();motionSeconds=motion.duration;roots=[];for(const id of Object.keys(templates)){const svg=compile(id,motion);$(id).replaceChildren(document.importNode(svg,true));const live=$(id).firstElementChild;live.pauseAnimations();roots.push(live);}draw();}
function change(edit=true){config=validate(config);if(edit)recorder?.onEdit();syncControls();dirty=!finalized?.finalizedAt||JSON.stringify(config)!==JSON.stringify(finalized.settings);$('state').textContent=sharedPreview?'Shared preview':dirty?'Draft · autosaved':'Finalized';$('save-title').textContent=sharedPreview?'Shared preview. Export or save your changes to keep them.':dirty?'Your draft saves automatically in this browser.':'These settings are finalized for implementation.';try{if(!sharedPreview)localStorage.setItem(storageKey,JSON.stringify(config));}catch{status('Browser storage is unavailable. Export your settings to keep a copy.',true);}cancelAnimationFrame(refreshFrame);refreshFrame=requestAnimationFrame(rebuild);}
for(const key of Object.keys(defaults))$(key).addEventListener('input',e=>{config[key]=e.target.type==='checkbox'?e.target.checked:key==='movement'?e.target.value:Number(e.target.value);change();});
$('center-dot').onclick=()=>{Object.assign(config,{strength:0,dotX:0,dotY:0,dotDelay:0,sync:true});change();};
$('reset-dot').onclick=()=>{for(const key of ['dotX','dotY','dotScale','dotDelay','strength','sync'])config[key]=defaults[key];change();};
$('reset-icon').onclick=()=>{Object.assign(config,{iconRotation:0,iconX:0,iconY:0});change();};
const presets={reference:defaults,snappy:{...defaults,speed:1.6,ribbonHold:.8,logoHold:1.3,exitTime:.7},calm:{...defaults,speed:.65,ribbonHold:1.4,logoHold:1.5,strength:.6}};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{config={...presets[b.dataset.preset]};progress=0;change();status('Preset applied. You can keep adjusting every setting.');});
function duration(){return recorder&&(recorder.state.preview||recorder.state.recording)?recorder.state.duration:motionSeconds;}
function draw(){const seconds=duration();const animationSeconds=recorder?.state.recording?motionSeconds:seconds;for(const root of roots){root.setCurrentTime(progress*animationSeconds);root.classList.toggle('force-motion',explicit);}$('scrub').value=progress;$('time').value=(progress*seconds).toFixed(2)+' / '+seconds.toFixed(2)+' s';$('play').textContent=playing?'Pause':'Play';}
function tick(now){if(last&&playing&&ready){const next=progress+Math.min(now-last,100)/1000/duration();if(next>=1&&recorder?.boundary())progress=1;else progress=next%1;draw();}last=now;requestAnimationFrame(tick);}
$('play').onclick=()=>{playing=!playing;explicit=true;draw();};$('restart').onclick=()=>{progress=0;playing=true;explicit=true;draw();};$('scrub').oninput=e=>{progress=Number(e.target.value);playing=false;explicit=true;draw();};
document.querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>{progress=phasePosition(Number(b.dataset.phase),config);playing=false;explicit=true;draw();});
function download(name,contents,type){const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>{if(!ready)return;const id=b.dataset.download;download('introify-'+id+'-custom.svg',new XMLSerializer().serializeToString(compile(id,currentMotion())),'image/svg+xml');status('Downloaded SVG with your current settings and active keyframes.');});
$('export').onclick=()=>download('introify-motion-settings.json',JSON.stringify({schemaVersion:1,baseVersion:7,settings:config},null,2),'application/json');
$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{try{const file=$('file').files[0];if(!file)return;if(file.size>100000)throw Error('Settings file is too large.');const data=JSON.parse(await file.text());if(data.keyframes)recorder.load(data);else{config=validate(data.settings??data);change();}status('Settings imported.');}catch(error){status(error.message,true);}finally{$('file').value='';}};
$('reset').onclick=()=>{config={...defaults};progress=0;change();status('Original reference settings restored.');};
$('restore').onclick=()=>{if(!finalized?.finalizedAt)return status('No finalized settings yet. Save an option first.');if(finalized.take)recorder.load(finalized.take);else{config=validate(finalized.settings);change();}status('Loaded your last saved settings and keyframes.');};
let pendingOption=null;
$('finalize').onclick=async()=>{if($('finalize').disabled)return;$('finalize').disabled=true;try{const snapshot={settings:validate(config),take:recorder.getTake()},fingerprint=JSON.stringify(snapshot);if(pendingOption?.fingerprint!==fingerprint)pendingOption={fingerprint,id:crypto.randomUUID()};const response=await fetch('/api/finalize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...snapshot,requestId:pendingOption.id})});const data=await response.json();if(!response.ok)throw Error(data.error);pendingOption=null;finalized={...snapshot,finalizedAt:data.finalizedAt,option:data.option};change(false);status(`Saved Option ${data.option}${data.keyframes?', including all '+data.keyframes+' keyframes':''}. Earlier options are unchanged.`);showSavedOption(data.option,data.url);}catch(error){status('Could not save option: '+error.message,true);}finally{$('finalize').disabled=false;}};
recorder=createRecorder({temporary:sharedPreview,getConfig:()=>config,getProgress:()=>progress,setProgress:value=>{progress=value;explicit=true;draw();},setConfig:value=>{config=validate(value);change(false);},pause:()=>{playing=false;draw();},play:()=>{playing=true;explicit=true;draw();},refresh:rebuild,status,download});
try {
 const ids=['logo-light','logo-dark','symbol-light','symbol-dark'];
 const responses=await Promise.all(['/api/base','/api/finalized',...ids.map(id=>'/brand/motion/introify-'+id+'.svg')].map(url=>fetch(url).then(r=>{if(!r.ok)throw Error('Unable to load '+url);return r.text();})));
 base=JSON.parse(responses[0]);finalized=JSON.parse(responses[1]);ids.forEach((id,i)=>templates[id]=responses[i+2]);
 if(sharedPreview){const response=await fetch('/api/shared-preview',{cache:'no-store'});if(!response.ok)throw Error('Shared preview settings are unavailable.');config=validate((await response.json()).settings);}
 else try{const draft=localStorage.getItem(storageKey);config=validate(draft?JSON.parse(draft):finalized.settings);}catch{status('A previous draft could not be loaded. Using the reference settings.',true);}
 ready=true;change();$('play').disabled=false;$('restart').disabled=false;$('finalize').disabled=false;
}catch(error){status(error.message,true);$('time').value='Preview unavailable';}
syncControls();requestAnimationFrame(tick);
