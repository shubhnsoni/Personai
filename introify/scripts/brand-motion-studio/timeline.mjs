import {clipMotion,validateRange} from './clip.mjs';
import {validate,buildSourceMotion} from './core.mjs';
const n=v=>Math.round(v*1000)/1000;
const easing=t=>t*t*(3-2*t);
export function validateTake(input){
  if(!input||typeof input!=='object')throw Error('Invalid take.');
  const name=typeof input.name==='string'?input.name.trim():'';
  if(!name||name.length>60)throw Error('Give the take a name of 1–60 characters.');
  if(typeof input.duration!=='number'||!Number.isFinite(input.duration)||input.duration<1||input.duration>20)throw Error('Take duration must be 1–20 seconds.');
  if(typeof input.loop!=='boolean')throw Error('Invalid loop setting.');
  if(!Array.isArray(input.keyframes)||input.keyframes.length<2||input.keyframes.length>40)throw Error('A take needs 2–40 keyframes.');
  const keyframes=input.keyframes.map(frame=>{
    if(typeof frame.time!=='number'||!Number.isFinite(frame.time)||frame.time<0||frame.time>1)throw Error('Keyframe time must be inside the timeline.');
    return {time:n(frame.time),settings:validate(frame.settings)};
  }).sort((a,b)=>a.time-b.time);
  if(keyframes.some((frame,i)=>i&&frame.time===keyframes[i-1].time))throw Error('Two keyframes cannot share the same time.');
  return {schemaVersion:1,baseVersion:8,name,duration:input.duration,loop:input.loop,keyframes,...validateRange(input.rangeStart,input.rangeEnd)};
}
const lerp=(a,b,t)=>a+(b-a)*t;
function stringMix(a,b,t){
  if(a[0]==='#'&&b[0]==='#')return '#'+[1,3,5].map(i=>Math.round(lerp(parseInt(a.slice(i,i+2),16),parseInt(b.slice(i,i+2),16),t)).toString(16).padStart(2,'0')).join('');
  const values=(b.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)||[]).map(Number);let i=0;
  return a.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi,v=>String(n(lerp(Number(v),values[i++]??Number(v),t))));
}
export function settingsAt(takeInput,time){
  const take=validateTake(takeInput),frames=take.keyframes;
  const after=frames.findIndex(frame=>frame.time>=time);
  if(after===0)return frames[0].settings;
  if(after===-1)return frames.at(-1).settings;
  const a=frames[after-1],b=frames[after],mix=easing((time-a.time)/(b.time-a.time));
  return Object.fromEntries(Object.entries(a.settings).map(([key,value])=>[key,typeof value==='number'&&!['orbitTurns','orbitDirection'].includes(key)?lerp(value,b.settings[key],mix):mix<.5?value:b.settings[key]]));
}
function placement(c){return {letteringTranslate:`${n(150+c.gap)} 0`};}
function bake(data,c){
 const point=(v,axis,dot)=>{const scale=dot?c.dotScale:c.ribbonScale,anchor=dot?(axis?49:133):(axis?100:88),offset=dot?(axis?c.dotY:c.dotX):(axis?c.ribbonY:c.ribbonX);return n(anchor+(v-anchor)*scale+offset);};
 const path=(value,dot)=>value.split(';').map(d=>{let axis=0;return d.replace(/-?\d*\.?\d+/g,v=>String(point(Number(v),axis++%2,dot)));}).join(';');
 const result={...data};
 for(const key of ['x','y'])result[key]=data[key].split(';').map(v=>point(Number(v),key==='y'?1:0,true)).join(';');
 for(const key of ['rx','ry'])result[key]=data[key].split(';').map(v=>n(Number(v)*c.dotScale)).join(';');
 for(const key of ['ring','body','trail'])result[key]=path(data[key],key==='trail');
 if(data.orbitPanels)result.orbitPanels=data.orbitPanels.map(p=>({...p,d:path(p.d,false)}));
 return result;
}
export function buildTakeMotion(base,input){
  const take=validateTake(input);
  const keys=[...take.keyframes];
  if(keys[0].time>0)keys.unshift({...keys[0],time:0});
  if(take.loop){if(keys.at(-1).time===1)keys[keys.length-1]={time:1,settings:keys[0].settings};else keys.push({time:1,settings:keys[0].settings});}
  const frames=keys.map(frame=>({...frame,motion:bake(buildSourceMotion(base,frame.settings),frame.settings),placement:placement(frame.settings)}));
  const strings=Object.keys(frames[0].motion).filter(k=>typeof frames[0].motion[k]==='string'&&k!=='keyTimes');
  const split=frames.map(frame=>Object.fromEntries(strings.map(k=>[k,frame.motion[k].split(';')])));
  const meshReference=frames.find(frame=>frame.motion.orbitPanels)?.motion.orbitPanels;
  const panelTracks=meshReference?frames.map(frame=>(frame.motion.orbitPanels??meshReference.map(p=>({...p,front:Array(121).fill('0').join(';'),back:Array(121).fill('0').join(';')}))).map(p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,v.split(';')])))):null;
  const out={duration:take.duration,keyTimes:base.keyTimes,loop:take.loop,bakedPlacement:true};
  const samples=Array.from({length:121},(_,i)=>{
    const time=i/120,after=frames.findIndex(f=>f.time>=time);
    if(after===0)return {a:0,b:0,mix:0};
    if(after===-1)return {a:frames.length-1,b:frames.length-1,mix:0};
    return {a:after-1,b:after,mix:easing((time-frames[after-1].time)/(frames[after].time-frames[after-1].time))};
  });
  const finish=values=>{if(take.loop)values[120]=values[0];return values.join(';');};
  for(const key of strings)out[key]=finish(samples.map(({a,b,mix},i)=>stringMix(split[a][key][i],split[b][key][i],mix)));
  for(const key of Object.keys(frames[0].placement))out[key]=finish(samples.map(({a,b,mix})=>stringMix(frames[a].placement[key],frames[b].placement[key],mix)));
  if(meshReference)out.orbitPanels=meshReference.map((_,panel)=>Object.fromEntries(['d','color','front','back'].map(key=>[key,finish(samples.map(({a,b,mix},i)=>stringMix(panelTracks[a][panel][key][i],panelTracks[b][panel][key][i],mix)))])));
  return clipMotion(out,take.rangeStart,take.rangeEnd);
}
