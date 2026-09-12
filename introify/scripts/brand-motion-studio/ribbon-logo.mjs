import {ribbonFrame} from './ribbon.mjs';

const round=v=>Math.round(v*1000)/1000;
const ease=t=>{const p=Math.max(0,Math.min(1,t));return p*p*(3-2*p);};
const mix=(a,b,t)=>a+(b-a)*t;
const pathMix=(a,b,t)=>{
 const values=b.match(/-?\d*\.?\d+/g).map(Number);let i=0;
 return a.replace(/-?\d*\.?\d+/g,v=>String(round(mix(Number(v),values[i++],t))));
};

/** Narrow departure ribbon, with its cap and dot on the same tilted orbit. */
export function departureFrame(progress,direction=1,turns=1){
 const p=Math.max(0,Math.min(1,progress)),turn=ease((p-.2)/.8);
 const scale=mix(1,.65,ease(p)),tilt=-38*Math.PI/180;
 const head=-direction*Math.PI*2*turn*turns;
 const project=(theta,width)=>{
  const x=(62+width)*Math.cos(theta)*scale,y=(34+width)*Math.sin(theta)*scale;
  return [87+x*Math.cos(tilt)-y*Math.sin(tilt),100+x*Math.sin(tilt)+y*Math.cos(tilt)];
 };
 const point=(u,side)=>project(head+4.95*(1-u),side*3*Math.pow(Math.sin(Math.PI*u/2),.75)*(1-ease(p)));
 const points=[...Array.from({length:81},(_,i)=>point(i/80,-1)),...Array.from({length:81},(_,i)=>point(1-i/80,1))];
 return {path:'M'+points.map(p=>p.map(round).join(' ')).join('L')+'Z',tip:project(head,0)};
}

export function ribbonLogoTiming(c){
 const reveal=.63/c.orbitSpeed,morphStart=.238/c.orbitSpeed,gentle=2.8*c.logoHold,exit=1.6*c.exitTime;
 // Advance both morph boundaries by 0.10s at the approved 1.70x speed,
 // preserving the transition duration and the dot's reveal trajectory.
 const logoStart=.46/c.orbitSpeed+.57*c.ribbonHold,morph=logoStart-morphStart;
 return {reveal,morphStart,morph,gentle,exit,logoStart,exitStart:logoStart+gentle,duration:logoStart+gentle+exit};
}

// Use one camera for the ribbon and dot, including their placement controls.
export function projectIconFrame(frame,c){
 const rad=Math.PI/180,rx=c.rotationX*rad,ry=c.rotationY*rad,rz=c.rotationZ*rad;
 const project=(x,y)=>{
  x=(x-88)*c.orbitSize/.8;y=(y-100)*c.orbitSize/.8*c.orbitDepth;
  const z=y*Math.sin(rx),yy=y*Math.cos(rx),xx=x*Math.cos(ry)+z*Math.sin(ry),zz=-x*Math.sin(ry)+z*Math.cos(ry);
  const perspective=c.perspective/Math.max(c.perspective*.15,c.perspective-zz);
  return {x:88+(xx*Math.cos(rz)-yy*Math.sin(rz))*perspective,y:100+(xx*Math.sin(rz)+yy*Math.cos(rz))*perspective,scale:perspective*c.orbitSize/.8};
 };
 const place=(v,axis,dot,inverse=false)=>{
  const anchor=dot?(axis?49:133):(axis?100:88),scale=dot?c.dotScale:c.ribbonScale,offset=dot?(axis?c.dotY:c.dotX):(axis?c.ribbonY:c.ribbonX);
  return inverse?anchor+(v-anchor-offset)/scale:anchor+(v-anchor)*scale+offset;
 };
 const out={...frame};
 for(const key of ['ring','body']){
  const coords=frame[key].match(/-?\d*\.?\d+/g).map(Number),values=[];
  for(let i=0;i<coords.length;i+=2){const p=project(place(coords[i],0,false),place(coords[i+1],1,false));values.push(round(place(p.x,0,false,true)),round(place(p.y,1,false,true)));}
  let i=0;out[key]=frame[key].replace(/-?\d*\.?\d+/g,()=>String(values[i++]));
 }
 const p=project(place(Number(frame.x),0,true),place(Number(frame.y),1,true));
 out.x=String(round(place(p.x,0,true,true)));out.y=String(round(place(p.y,1,true,true)));
 out.rx=String(round(Number(frame.rx)*p.scale));out.ry=String(round(Number(frame.ry)*p.scale));
 return out;
}

/** Start at the reveal after the trimmed lap, then perform and depart. */
export function buildRibbonLogo(base,c,ribbon,gentle){
 const tracks=Object.fromEntries(Object.entries(ribbon).filter(([k,v])=>typeof v==='string'&&k!=='keyTimes').map(([k,v])=>[k,v.split(';')]));
 const baseTracks=Object.fromEntries(Object.entries(base).filter(([k,v])=>typeof v==='string'&&k!=='keyTimes').map(([k,v])=>[k,v.split(';')]));
 const gentleTracks=Object.fromEntries(Object.entries(gentle).filter(([k,v])=>typeof v==='string'&&k!=='keyTimes').map(([k,v])=>[k,v.split(';')]));
 const sampleGentle=t=>{
  const f=Math.max(0,Math.min(1,t))*120,a=Math.floor(f),b=Math.min(120,a+1);
  return Object.fromEntries(Object.entries(gentleTracks).map(([k,v])=>[k,pathMix(v[a],v[b],f-a)]));
 };
 const ring=baseTracks.ring[56],rest=sampleGentle(0),logo=rest.body;
 const head={x:Number(rest.x),y:Number(rest.y)};
 const timing=ribbonLogoTiming(c);
 const placed=(value,axis,attached)=>{
  const anchor=axis===0?133:49,bodyAnchor=axis===0?88:100;
  const bodyOffset=axis===0?c.ribbonX:c.ribbonY,dotOffset=axis===0?c.dotX:c.dotY;
  const tip=bodyAnchor+(value-bodyAnchor)*c.ribbonScale+bodyOffset;
  return attached?anchor+(tip-anchor-dotOffset)/c.dotScale:value;
 };
 const frames=Array.from({length:121},(_,i)=>{
  const time=i/120*timing.duration;
  if(time>=timing.logoStart&&time<=timing.exitStart){
   const frame=sampleGentle((time-timing.logoStart)/timing.gentle);
   return {...frame,ring:frame.body,ringOpacity:'0',opacity:'1',trailOpacity:'0'};
  }
  if(time>timing.exitStart){
   const p=(time-timing.exitStart)/timing.exit,morph=ease(p/.32),fade=1-ease((p-.6)/.4);
   const departure=departureFrame(p,c.orbitDirection,c.orbitTurns);
   const shape=pathMix(logo,departure.path,morph);
   const frame={...rest,ring:shape,body:shape,ringOpacity:String(round(morph*fade)),opacity:String(round((1-morph)*fade)),trailOpacity:'0',
    rx:String(round(19*(1-ease(p)))),ry:String(round(19*(1-ease(p))))};
   for(const [axis,key] of ['x','y'].entries())frame[key]=String(round(mix(head[key],placed(departure.tip[axis],axis,c.attachDot),morph)));
   return frame;
  }
  const reveal=ease(time/timing.reveal),morph=ease((time-timing.morphStart)/timing.morph);
  const opening=ribbonFrame(ring,reveal);
  const shape=pathMix(opening.path,logo,morph);
  const frame={...Object.fromEntries(Object.entries(tracks).map(([k,v])=>[k,v[0]])),ring:shape,body:shape,
   ringOpacity:String(round(1-morph)),opacity:String(round(morph)),trailOpacity:'0',
   rx:String(round(19*reveal)),ry:String(round(19*reveal))};
  for(const [axis,key] of ['x','y'].entries()){
   const start=placed(opening.tip[axis],axis,c.attachDot);
   frame[key]=String(round(mix(start,head[key],morph)));
  }
  return frame;
 }).map((frame,i)=>{
  const time=i/120*timing.duration;
  // Settle the camera back to the approved front-facing mark during the
  // morph. Rotation belongs to the ribbon, never the gentle logo pose.
  const amount=time<timing.logoStart?1-ease((time-timing.morphStart)/timing.morph):ease((time-timing.exitStart)/(timing.exit*.32));
  if(amount===0)return frame;
  return projectIconFrame(frame,{...c,rotationX:c.rotationX*amount,rotationY:c.rotationY*amount,rotationZ:c.rotationZ*amount,
   orbitDepth:mix(1,c.orbitDepth,amount),orbitSize:mix(.8,c.orbitSize,amount)});
 });
 frames[120]=frames[0];
 return {duration:round(timing.duration/c.speed),keyTimes:base.keyTimes,...Object.fromEntries(Object.keys(tracks).map(k=>[k,frames.map(f=>f[k]).join(';')]))};
}
