const n=v=>Math.round(v*1000)/1000;
/** One continuous lap: the cap reveals a ribbon from a fixed tail origin. */
export function ribbonLoopFrame(progress, direction=1, turns=1){
 const t=Math.max(0,Math.min(1,progress));
 const phase=t===1?0:t;
 const head=4.95-direction*phase*Math.PI*2*turns;
 // Reveal only the arc already travelled by the dot. The tail stays at
 // angle 4.95; only the band's width contracts as the loop disappears.
 const envelope=Math.sin(Math.PI*phase)**2;
 const length=phase*Math.PI*2*turns,tilt=-38*Math.PI/180;
 const project=(theta,width)=>{
   const x=(62+width)*Math.cos(theta),y=(34+width)*Math.sin(theta);
   return [87+x*Math.cos(tilt)-y*Math.sin(tilt),100+x*Math.sin(tilt)+y*Math.cos(tilt)];
 };
 const point=(u,side)=>project(head+direction*length*(1-u),side*10*Math.pow(Math.sin(Math.PI*u/2),.75)*envelope);
 const points=[...Array.from({length:81},(_,i)=>point(i/80,-1)),...Array.from({length:81},(_,i)=>point(1-i/80,1))];
 return {path:'M'+points.map(point=>point.map(n).join(' ')).join('L')+'Z',tip:project(head,0),progress:envelope};
}
/** Reveal the saved ribbon from its actual first vertex, not a pre-drawn arc. */
export function ribbonFrame(fullPath,progress){
 const coordinates=fullPath.match(/-?\d*\.?\d+/g).map(Number);
 const p=Math.max(0,Math.min(1,progress));
 const edge=(u,outer)=>{
   const index=outer?161-u*80:u*80;
   const a=Math.floor(index),b=Math.min(161,a+1),fraction=index-a;
   return [0,1].map(axis=>coordinates[2*a+axis]+(coordinates[2*b+axis]-coordinates[2*a+axis])*fraction);
 };
 const inner=edge(p,false),outer=edge(p,true);
 const tip=inner.map((v,i)=>(v+outer[i])/2);
 const points=[...Array.from({length:81},(_,i)=>edge(i/80*p,false)),...Array.from({length:81},(_,i)=>edge((1-i/80)*p,true))];
 return {path:'M'+points.map(point=>point.map(n).join(' ')).join('L')+'Z',tip,progress:p};
}
