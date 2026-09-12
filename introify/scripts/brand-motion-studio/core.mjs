import {orbitFrame} from './orbit.mjs';
import {ribbonLoopFrame} from './ribbon.mjs';
import {buildRibbonLogo,ribbonLogoTiming} from './ribbon-logo.mjs';
export const defaults = Object.freeze({ speed:1, movement:'full', iconRotation:0, iconX:0, iconY:0, orbitSpeed:1, orbitDepth:1, rotationX:0, rotationY:0, rotationZ:0, perspective:260, orbitSize:.8, orbitTurns:1, orbitDirection:1, attachDot:true, ribbonHold:1, logoHold:1, exitTime:1, sync:true, dotDelay:0, strength:1, dotX:0, dotY:0, dotScale:1, ribbonX:0, ribbonY:0, ribbonScale:1, gap:0 });
export const limits = {speed:[.25,2.5],ribbonHold:[.4,2.5],logoHold:[.4,2.5],exitTime:[.4,2.5],dotDelay:[-.3,.3],strength:[0,1.5],dotX:[-30,30],dotY:[-25,25],dotScale:[.5,1.5],ribbonX:[-20,20],ribbonY:[-20,20],ribbonScale:[.7,1.2],gap:[0,50]};
Object.assign(limits,{orbitSpeed:[1,2],orbitDepth:[.5,1.4]});
Object.assign(limits,{iconRotation:[-180,180],iconX:[-40,40],iconY:[-40,40]});
Object.assign(limits,{rotationX:[-180,180],rotationY:[-180,180],rotationZ:[-180,180],perspective:[200,700],orbitSize:[.5,1.2],orbitTurns:[1,3],orbitDirection:[-1,1]});
export function validate(input) {
  if(!input || typeof input !== 'object') throw Error('Settings must be an object.');
  const result={...defaults};
  for(const [key,[min,max]] of Object.entries(limits)) {
    if(input[key]===undefined) continue;
    if(typeof input[key]!=='number'||!Number.isFinite(input[key])||input[key]<min||input[key]>max) throw Error(`Invalid ${key}.`);
    result[key]=input[key];
  }
  if(input.movement!==undefined&&!['full','ribbon','ribbon-logo','gentle'].includes(input.movement)) throw Error('Unknown movement.');
  for(const key of ['sync','attachDot'])if(input[key]!==undefined&&typeof input[key]!=='boolean') throw Error(`Invalid ${key} setting.`);
  if(!Number.isInteger(result.orbitTurns)||![-1,1].includes(result.orbitDirection))throw Error('Invalid orbit direction or turns.');
  return {...result,movement:input.movement??result.movement,sync:input.sync??result.sync,attachDot:input.attachDot??result.attachDot};
}
const rounded=v=>Math.round(v*1000)/1000;
const wholeIcon=(motion,c)=>({...motion,iconRotate:Array(121).fill(`${c.iconRotation} 88 100`).join(';'),iconTranslate:Array(121).fill(`${c.iconX} ${c.iconY}`).join(';')});
function sourceTime(t,c) {
  if(c.movement==='ribbon') return .13+.34*(1-Math.cos(t*2*Math.PI))/2;
  if(c.movement==='gentle') return .61+.13*(1-Math.cos(t*2*Math.PI))/2;
  const weights=[.33,.14*c.ribbonHold,.14,.13*c.logoHold,.26*c.exitTime];
  const base=[0,.29,.47,.61,.74,1],total=weights.reduce((a,b)=>a+b,0);
  let cursor=0;
  for(let i=0;i<weights.length;i++) {const end=cursor+weights[i]/total;if(t<=end||i===weights.length-1)return base[i]+(base[i+1]-base[i])*((t-cursor)/(end-cursor));cursor=end;}
  return 1;
}
export function buildMotion(base,input) {
  const c=validate(input),tracks={};
  if(c.movement==='ribbon-logo')return wholeIcon(buildRibbonLogo(base,c,buildMotion(base,{...c,movement:'ribbon'}),buildMotion(base,{...c,movement:'gentle'})),c);
  for(const [key,value] of Object.entries(base)) if(typeof value==='string'&&key!=='keyTimes') {
    tracks[key]=value.split(';').map(s=>({source:s,values:(s.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)||[]).map(Number)}));
  }
  function sample(key,t) {
    const track=tracks[key],f=Math.max(0,Math.min(1,t))*(track.length-1),a=track[Math.floor(f)],b=track[Math.min(track.length-1,Math.floor(f)+1)],mix=f%1;
    let i=0;
    return a.source.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi,()=>String(rounded(a.values[i]+((b.values[i]??a.values[i])-a.values[i++])*mix)));
  }
  const out={duration:rounded(base.duration/c.speed),keyTimes:base.keyTimes};
  for(const key of Object.keys(tracks)) {
    const values=Array.from({length:121},(_,i)=>{
      let t=i/120;
      const dot=['x','y','rx','ry','trail','trailOpacity'].includes(key);
      if(dot&&!c.sync) t=((t-c.dotDelay)%1+1)%1;
      const source=sourceTime(t,c);
      if((key==='trailOpacity')&&c.movement!=='full') return '0';
      if(['x','y'].includes(key)) {const anchor=key==='x'?133:49;return String(rounded(anchor+(Number(sample(key,source))-anchor)*c.strength));}
      if(['rx','ry'].includes(key)&&c.movement!=='full') return '19';
      if(key==='trail') {let coordinate=0;return sample(key,source).replace(/-?\d*\.?\d+/g,v=>{const anchor=coordinate++%2===0?133:49;return String(rounded(anchor+(Number(v)-anchor)*c.strength));});}
      return sample(key,source);
    });
    values[120]=values[0];out[key]=values.join(';');
  }
  if(c.movement==='full') {
    const headTracks=Object.fromEntries(['x','y','rx'].map(key=>[key,out[key].split(';').map(Number)]));
    const frames=Array.from({length:121},(_,i)=>{
      const t=i/120,source=sourceTime(t,c);
      // Complete the orbit before phase timing takes over the original ribbon.
      const orbitT=Math.min(1,source/.29)*.33;
      return orbitFrame(orbitT,sample('ring',Math.max(.29,source)),{x:headTracks.x[i],y:headTracks.y[i],r:headTracks.rx[i]},c);
    });
    for(const key of ['x','y','rx','ry','ringOpacity','opacity','trailOpacity']) {
      const values=out[key].split(';').map(Number);
      for(let i=0;i<121;i++) {
        const t=i/120,source=sourceTime(t,c);
        if(source<.29) {
          const f=frames[i];
          if(key==='x'||key==='y') {
            values[i]=f.dot[key];
            if(c.attachDot){const axis=key==='x',anchor=axis?133:49,bodyAnchor=axis?88:100,offset=axis?c.dotX:c.dotY,bodyOffset=axis?c.ribbonX:c.ribbonY;
              const attached=bodyAnchor+(f.tip[axis?0:1]-bodyAnchor)*c.ribbonScale+bodyOffset;
              const actual=anchor+(f.dot[key]-anchor)*c.dotScale+offset;
              values[i]+=(attached-actual)*(1-f.blend)/c.dotScale;
            }
          }
          else if(key==='rx'||key==='ry')values[i]=f.dot.r;
          else if(key==='ringOpacity')values[i]*=f.blend*f.blend;
          else values[i]=0;
        }
        if(source>.93&&['x','y','rx','ry'].includes(key)) {
          const t=Math.max(0,Math.min(1,(source-.93)/.07)),blend=t*t*(3-2*t);
          values[i]+=(values[0]-values[i])*blend;
        }
      }
      values[120]=values[0];out[key]=values.map(rounded).join(';');
    }
    out.orbitPanels=frames[0].panels.map((_,panel)=>{
      const result={};for(const key of ['d','color','front','back']){const values=frames.map(f=>f.panels[panel][key]);values[120]=values[0];result[key]=values.join(';');}return result;
    });
  }
  if(c.movement==='ribbon') {
    const frames=Array.from({length:121},(_,i)=>ribbonLoopFrame(i/120,c.orbitDirection,c.orbitTurns));
    out.ring=frames.map(f=>f.path).join(';');
    out.ringOpacity=frames.map(f=>f.progress>0?'1':'0').join(';');
    out.opacity=Array(121).fill('0').join(';');
    out.trailOpacity=Array(121).fill('0').join(';');
    // Reference cycle: grow through 0.63s, shrink from 2.00s to zero at
    // 2.40s, and stay hidden until the 2.80s loop restarts.
    const smooth=t=>{const p=Math.max(0,Math.min(1,t));return p*p*(3-2*p);};
    const dotRadius=frames.map((_,i)=>{
      const t=i/120;
      return rounded(19*smooth(t/(.63/2.8))*smooth((2.4/2.8-t)/(.4/2.8)));
    }).join(';');
    out.rx=dotRadius;
    out.ry=dotRadius;
    if(c.attachDot)for(const key of ['x','y']){
      const axis=key==='x'?0:1,anchor=axis===0?133:49,bodyAnchor=axis===0?88:100;
      const bodyOffset=axis===0?c.ribbonX:c.ribbonY,dotOffset=axis===0?c.dotX:c.dotY;
      out[key]=frames.map(f=>{
        const visibleTip=bodyAnchor+(f.tip[axis]-bodyAnchor)*c.ribbonScale+bodyOffset;
        // Compensate for the existing dot group transform. The final visible
        // dot center and leading ribbon cap share the exact same point.
        return rounded(anchor+(visibleTip-anchor-dotOffset)/c.dotScale);
      }).join(';');
    }
  }
  return wholeIcon(out,c);
}
export function phasePosition(target,input) {
  const c=validate(input);
  if(c.movement==='ribbon-logo'){
    const t=ribbonLogoTiming(c);
    return (target===0?0:target<=.29?t.reveal/2:target<=.47?t.reveal:target<=.74?t.logoStart+t.gentle/4:t.exitStart+t.exit/2)/t.duration;
  }
  let best=0,distance=Infinity;
  for(let i=0;i<=1000;i++){const next=Math.abs(sourceTime(i/1000,c)-target);if(next<distance){distance=next;best=i/1000;}}
  return best;
}
