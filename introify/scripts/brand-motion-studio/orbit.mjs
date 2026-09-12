const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
const mix=(a,b,t)=>a+(b-a)*t;
const n=v=>Math.round(v*1000)/1000;
const count=32;
const light=[-.35,-.55,.76];
function rotate([x,y,z],angle,config){
  // Rotate a ribbon in world space before perspective projection.
  const tilt=1.04*config.orbitDepth+config.rotationX*Math.PI/180,az=-.55+config.rotationZ*Math.PI/180;
  angle+=config.rotationY*Math.PI/180;
  const yt=y*Math.cos(tilt)-z*Math.sin(tilt),zt=y*Math.sin(tilt)+z*Math.cos(tilt);
  const xr=x*Math.cos(angle)+zt*Math.sin(angle),zr=-x*Math.sin(angle)+zt*Math.cos(angle);
  return [xr*Math.cos(az)-yt*Math.sin(az),xr*Math.sin(az)+yt*Math.cos(az),zr];
}
function project([x,y,z],lens){const p=lens/(lens-z);return [88+x*p,88+y*p,z];}
function color(u,normal,blend){
  const lighting=.55+.45*Math.abs(normal.reduce((sum,v,i)=>sum+v*light[i],0));
  const start=[9,117,250],end=[133,247,201];
  const tint=ease((u-.3)/.7);
  return '#'+start.map((v,i)=>Math.round(mix(mix(v,end[i],tint)*lighting,mix(v,end[i],tint),blend)).toString(16).padStart(2,'0')).join('');
}
export function orbitFrame(t,targetRing,targetHead,config){
  const blend=ease((t-.205)/.125);
  const turn=ease((t-.025)/(.18/config.orbitSpeed));
  const angle=turn*Math.PI*2*config.orbitTurns*config.orbitDirection;
  const emerge=ease(t/.065),grow=(.48+.3*ease(t/.2))*config.orbitSize;
  const dotEnvelope=ease(t/.045)*(1-blend);
  const z=config.attachDot?0:Math.cos(angle)*27*dotEnvelope*config.orbitDepth;
  const p=config.perspective/(config.perspective-z);
  const dot={x:mix(config.attachDot?88:88+Math.sin(angle)*19*p*dotEnvelope,targetHead.x,blend),y:mix(config.attachDot?88:88+(Math.cos(angle)-1)*8*p*dotEnvelope,targetHead.y,blend),r:mix(mix(5,10,emerge)*p,targetHead.r,blend)};
  const coords=targetRing.match(/-?\d*\.?\d+/g).map(Number);
  const reference=(u,side)=>{
    const index=side===-1?u*80:161-u*80;
    const a=Math.floor(index),b=Math.min(161,a+1),fraction=index-a;
    return [mix(coords[a*2],coords[b*2],fraction),mix(coords[a*2+1],coords[b*2+1],fraction),0];
  };
  const point=(u,side)=>{
    const theta=4.95*(1-u),width=10*Math.pow(Math.sin(Math.PI*u/2),.75);
    // One shared pivot at the center of the terminal cap. The ribbon rotates
    // around this exact point; the attached dot uses its projection, too.
    const xyz=rotate([((62+side*width)*Math.cos(theta)-62)*grow,(34+side*width)*Math.sin(theta)*grow,0],angle,config);
    const screen=project(xyz,config.perspective),target=reference(u,side);
    return screen.map((v,i)=>mix(v,target[i],blend));
  };
  const normal=rotate([0,0,1],angle,config);
  const opacity=ease((t-.025)/.045)*(1-ease((t-.305)/.025));
  const panels=Array.from({length:count},(_,i)=>{
    const u=i/count,v=(i+1)/count;
    const points=[point(u,-1),point(v,-1),point(v,1),point(u,1)];
    const depth=points.reduce((sum,q)=>sum+q[2],0)/4;
    const front=ease((depth-z+1.5)/3);
    return {d:'M'+points.map(q=>q.slice(0,2).map(n).join(' ')).join('L')+'Z',color:color((u+v)/2,normal,blend),front:n(opacity*front),back:n(opacity*(1-front))};
  });
  return {dot,panels,blend,tip:project(rotate([0,0,0],angle,config),config.perspective),highlight:n(.55+.3*(1-blend))};
}
