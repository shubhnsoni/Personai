import {validate} from './core.mjs';
import {validateTake,buildTakeMotion} from './timeline.mjs';
import {refreshOptions,showSavedOption} from './options-ui.js';
const storage='introify-keyframe-draft-v1';
export function createRecorder(hooks){
 const $=id=>document.getElementById(id);
 let frames=[],selected=null,cached=null,lastAuto=-1,saving=false,pendingSave=null;
 const state={recording:false,preview:false,duration:2.8,loop:true};
 const panel=document.createElement('section');panel.className='keyframe-panel';panel.setAttribute('aria-label','Keyframe recorder');
 panel.innerHTML=`<div class="keyframe-heading"><div><h2>Keyframes & takes</h2><p>Scrub, adjust the controls, then add a keyframe. Record captures your changes while the animation plays.</p></div><span id="record-state">Ready</span></div><div class="keyframe-actions"><button id="add-key">＋ Add keyframe</button><button id="record-key">● Record changes</button><button id="play-take">▶ Play keyframes</button></div><div class="take-fields"><label>Take name<input id="take-name" maxlength="60" value="Take 1"></label><label>Duration (seconds)<input id="take-duration" type="number" min="1" max="20" step=".1" value="2.8"></label><label class="take-loop"><input id="take-loop" type="checkbox" checked>Return to first pose</label></div><div id="keyframes" class="keyframe-list" aria-label="Saved keyframes"></div><div class="keyframe-edit"><label>Selected time (seconds)<input id="key-time" type="number" min="0" step=".01" disabled></label><button id="remove-key" disabled>Delete keyframe</button><button id="clear-keys">Clear draft</button></div><div class="keyframe-actions"><button id="save-take" class="primary">Save as new take</button><button id="export-take">Export take JSON</button></div><div class="take-load"><label for="saved-takes">Saved takes</label><select id="saved-takes"><option value="">No saved takes yet</option></select><button id="load-take">Load take</button></div><p class="hint">Saved takes are separate files. Option 1 remains locked. While playing keyframes, SVG downloads use this take.</p>`;
 document.querySelector('.transport').after(panel);
 function take(){return validateTake({name:$('take-name').value,duration:state.duration,loop:state.loop,keyframes:frames});}
 function persist(){cached=null;try{if(!hooks.temporary)localStorage.setItem(storage,JSON.stringify({name:$('take-name').value,duration:state.duration,loop:state.loop,keyframes:frames}));}catch{}render();}
 function render(){
   $('record-state').textContent=state.recording?'● Recording':state.preview?'Take preview':`${frames.length} keyframes`;
   $('record-state').classList.toggle('recording',state.recording);
   $('record-key').textContent=state.recording?'■ Stop recording':'● Record changes';
   $('play-take').disabled=frames.length<2; $('save-take').disabled=frames.length<2||saving;$('export-take').disabled=frames.length<2;
   $('keyframes').replaceChildren();
   frames.forEach((f,i)=>{const b=document.createElement('button');b.textContent=`◆ ${(f.time*state.duration).toFixed(2)}s`;b.setAttribute('aria-label',`Keyframe ${i+1} at ${(f.time*state.duration).toFixed(2)} seconds`);b.setAttribute('aria-pressed',String(f.time===selected));b.onclick=()=>{state.preview=false;state.recording=false;selected=f.time;hooks.pause();hooks.setProgress(f.time);hooks.setConfig(f.settings);render();};$('keyframes').append(b);});
   $('key-time').disabled=selected===null;$('remove-key').disabled=selected===null;$('key-time').max=state.duration;$('key-time').value=selected===null?'':(selected*state.duration).toFixed(2);
 }
 function capture(automatic=false){
   let time=Math.round(hooks.getProgress()*1000)/1000;
   const settings=validate(hooks.getConfig());
   let index=frames.findIndex(f=>Math.abs(f.time-time)<.012);
   if(automatic&&index<0&&time-lastAuto<.04)index=frames.findIndex(f=>f.time===lastAuto);
   if(index>=0)frames[index]={time,settings};else if(frames.length<40)frames.push({time,settings});else return hooks.status('This take has 40 keyframes. Update or delete one before adding more.',true);
   if(automatic)lastAuto=time;
   frames.sort((a,b)=>a.time-b.time);selected=time;persist();
 }
 function finishRecord(){state.recording=false;hooks.pause();if(frames.length){hooks.setProgress(1);if(state.loop)hooks.setConfig(frames[0].settings);capture();}state.preview=frames.length>=2;cached=null;hooks.refresh();render();hooks.status('Recording stopped. Review the keyframes, then save this as a new take.');}
 $('add-key').onclick=()=>{capture();hooks.status('Keyframe saved at the current timeline position.');};
 $('record-key').onclick=()=>{if(state.recording)return finishRecord();state.preview=false;state.recording=true;lastAuto=-1;hooks.setProgress(0);capture();hooks.play();render();hooks.status('Recording one pass. Move any control, or use Add keyframe, to capture changes.');};
 $('play-take').onclick=()=>{try{take();state.recording=false;state.preview=true;cached=null;hooks.setProgress(0);hooks.refresh();hooks.play();render();}catch(e){hooks.status(e.message,true);}};
 $('take-duration').oninput=()=>{const value=Number($('take-duration').value);if(value<1||value>20||!Number.isFinite(value))return;state.duration=value;persist();if(state.preview)hooks.refresh();};
 $('take-loop').onchange=()=>{state.loop=$('take-loop').checked;persist();if(state.preview)hooks.refresh();};$('take-name').oninput=persist;
 $('key-time').onchange=()=>{const time=Math.round(Number($('key-time').value)/state.duration*1000)/1000;if(!Number.isFinite(time)||time<0||time>1||frames.some(f=>f.time!==selected&&Math.abs(f.time-time)<.001)){render();return hooks.status('Choose an unused time within this take.',true);}frames.find(f=>f.time===selected).time=time;selected=time;frames.sort((a,b)=>a.time-b.time);persist();};
 $('remove-key').onclick=()=>{frames=frames.filter(f=>f.time!==selected);selected=null;state.preview=false;persist();hooks.refresh();};
 $('clear-keys').onclick=()=>{state.recording=false;state.preview=false;frames=[];selected=null;hooks.pause();persist();hooks.refresh();};
 async function list(){try{const response=await fetch('/api/takes');if(!response.ok)throw Error('Unable to list saved takes.');const takes=await response.json();$('saved-takes').replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=takes.length?'Choose a saved take':'No saved takes yet';$('saved-takes').append(placeholder);for(const t of takes){const option=document.createElement('option');option.value=t.id;option.textContent=`${t.option?'Option '+t.option+' · ':''}${t.name} · ${t.keyframes} keys · ${new Date(t.savedAt).toLocaleTimeString()}`;$('saved-takes').append(option);}}catch(e){hooks.status(e.message,true);}}
 function load(input){const t=validateTake(input);frames=t.keyframes;state.duration=t.duration;state.loop=t.loop;state.preview=false;state.recording=false;selected=null;$('take-name').value=t.name;$('take-duration').value=t.duration;$('take-loop').checked=t.loop;hooks.pause();hooks.setProgress(0);hooks.setConfig(frames[0].settings);persist();}
 $('save-take').onclick=async()=>{if(saving)return;try{const snapshot=take(),fingerprint=JSON.stringify(snapshot);if(pendingSave?.fingerprint!==fingerprint)pendingSave={fingerprint,id:crypto.randomUUID()};saving=true;render();const response=await fetch('/api/takes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...snapshot,requestId:pendingSave.id})});const data=await response.json();if(!response.ok)throw Error(data.error);pendingSave=null;await list();$('saved-takes').value=data.id;hooks.status(`Saved Option ${data.option}: “${data.name}”, including all ${snapshot.keyframes.length} keyframes.`);showSavedOption(data.option,data.url);}catch(e){hooks.status(e.message,true);}finally{saving=false;render();}};
 $('load-take').onclick=async()=>{if(!$('saved-takes').value)return hooks.status('Choose a saved take first.');try{const r=await fetch('/api/takes/'+$('saved-takes').value);if(!r.ok)throw Error('Unable to load this take.');load(await r.json());hooks.status('Take loaded. Press Play keyframes to preview it.');}catch(e){hooks.status(e.message,true);}};
 $('export-take').onclick=()=>{try{hooks.download('introify-keyframe-take.json',JSON.stringify(take(),null,2),'application/json');}catch(e){hooks.status(e.message,true);}};
 try{const draft=hooks.temporary?null:JSON.parse(localStorage.getItem(storage)||'null');if(draft){state.duration=Math.max(1,Math.min(20,Number(draft.duration)||2.8));state.loop=draft.loop!==false;frames=Array.isArray(draft.keyframes)?draft.keyframes.slice(0,40).map(f=>({time:Math.max(0,Math.min(1,Number(f.time)||0)),settings:validate(f.settings)})):[];$('take-name').value=draft.name||'Take 1';$('take-duration').value=state.duration;$('take-loop').checked=state.loop;}}catch{}
 render();list();refreshOptions();
 return {state,getTake(){return frames.length?take():null;},onEdit(){state.preview=false;if(state.recording)capture(true);render();},boundary(){if(state.recording){finishRecord();return true;}if(state.preview&&!state.loop){hooks.pause();hooks.setProgress(1);return true;}return false;},motion(base){if(!state.preview)return null;if(!cached)cached=buildTakeMotion(base,take());return cached;},load};
}
