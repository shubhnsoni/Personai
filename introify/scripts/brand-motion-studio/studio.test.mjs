import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,validate,buildMotion} from './core.mjs';
import {orbitFrame} from './orbit.mjs';
import {ribbonLoopFrame} from './ribbon.mjs';
import {exportMotionSvg} from './export-motion.mjs';
import {ribbonLogoTiming} from './ribbon-logo.mjs';
import {validateTake,buildTakeMotion} from './timeline.mjs';
const base=JSON.parse(readFileSync(new URL('../../src/components/brand/motion-data.json',import.meta.url)));
const ring=base.ring.split(';')[36];
test('morph starts and finishes 0.10s earlier at the approved playback speed',()=>{
 const c={...defaults,movement:'ribbon-logo',speed:1.7};
 const timing=ribbonLogoTiming(c),motion=buildMotion(base,c);
 assert.ok(Math.abs(timing.morphStart/c.speed-.14)<1e-10);
 assert.ok(timing.morphStart<timing.reveal);
 assert.ok(Math.abs(timing.logoStart/c.speed-(1.2/c.speed-.1))<1e-10);
 const opacity=motion.opacity.split(';').map(Number);
 assert.equal(opacity[5],0);
 assert.ok(opacity[6]>0&&opacity[13]>opacity[6]);
 assert.notEqual(motion.x.split(';')[6],motion.x.split(';')[13]);
 assert.equal(opacity[23],1);
});
test('whole icon controls preserve internal motion and export recorded rotation and positions',()=>{
 const c={...defaults,movement:'ribbon-logo'},positioned={...c,iconRotation:35,iconX:12,iconY:-18};
 const original=buildMotion(base,c),motion=buildMotion(base,positioned);
 for(const key of ['ring','body','x','y'])assert.equal(motion[key],original[key]);
 assert.equal(motion.iconRotate.split(';')[0],'35 88 100');
 assert.equal(motion.iconTranslate.split(';')[0],'12 -18');
 const take=buildTakeMotion(base,{name:'Whole icon placement',duration:5.6,loop:true,keyframes:[{time:0,settings:c},{time:.5,settings:positioned},{time:1,settings:c}]});
 assert.equal(take.iconRotate.split(';')[60],'35 88 100');
 assert.equal(take.iconTranslate.split(';')[60],'12 -18');
 assert.equal(take.iconRotate.split(';')[0],take.iconRotate.split(';')[120]);
 const template=readFileSync(new URL('../../public/brand/motion/introify-symbol-light.svg',import.meta.url),'utf8');
 const svg=exportMotionSvg(template,'symbol-light',take,positioned);
 assert.ok(svg.includes(`type="rotate" values="${take.iconRotate}"`));
 assert.ok(svg.includes(`type="translate" values="${take.iconTranslate}"`));
 assert.throws(()=>validate({iconRotation:181}));
 assert.throws(()=>validate({iconX:41}));
});
test('open ribbon tail stays anchored while the dot reveals the arc',()=>{
 for(const direction of [-1,1])for(const turns of [1,2,3]){
  const origin=ribbonLoopFrame(0,direction,turns).tip.map(v=>Math.round(v*1000)/1000);
  for(let i=0;i<=120;i++){
   const frame=ribbonLoopFrame(i/120,direction,turns);
   const points=frame.path.match(/-?\d*\.?\d+/g).map(Number);
   assert.deepEqual(points.slice(0,2),origin,`tail moved at ${(i/120*2.8).toFixed(2)}s`);
   assert.deepEqual(points.slice(-2),origin,'both edges must share the anchored tail');
  }
 }
});
test('trimmed sequence starts at the reveal and retains the logo performance and loop seam',()=>{
 const config={...defaults,movement:'ribbon-logo'};
 const sequence=buildMotion(base,config),lap=buildMotion(base,{...config,movement:'ribbon'});
 assert.equal(sequence.duration,5.43);
 for(const key of ['ring','ringOpacity','x','y','rx','ry','opacity']){
  const extended=sequence[key].split(';'),original=lap[key].split(';');
  if(['x','y','rx','ry'].includes(key))assert.equal(extended[0],original[0],`${key} must start at the reveal origin`);
  assert.equal(extended[0],extended[120],`${key} has a loop seam`);
 }
 assert.equal(sequence.opacity.split(';')[30],'1');
 assert.equal(sequence.rx.split(';')[0],'0');
 assert.ok(Number(sequence.rx.split(';')[1])>0);
 assert.equal(buildMotion(base,{...config,speed:2}).duration,2.715);
 const take=buildTakeMotion(base,{name:'Ribbon to logo',duration:5.6,loop:true,keyframes:[{time:0,settings:config},{time:1,settings:config}]});
 for(const [key,value] of Object.entries(take))if(typeof value==='string')assert.ok(!value.includes('NaN'),key);
});

test('logo performs the existing gentle motion then returns to a thinner orbital ribbon',()=>{
 const sequence=buildMotion(base,{...defaults,movement:'ribbon-logo'});
 const gentle=buildMotion(base,{...defaults,movement:'gentle'});
 const xs=sequence.x.split(';').map(Number),radii=sequence.rx.split(';').map(Number);
 const timing=ribbonLogoTiming(defaults);
 const gentleFrame=(45/120*timing.duration-timing.logoStart)/timing.gentle*120,gx=gentle.x.split(';').map(Number),i=Math.floor(gentleFrame);
 assert.ok(Math.abs(xs[45]-(gx[i]+(gx[i+1]-gx[i])*(gentleFrame-i)))<.002);
 assert.notEqual(sequence.body.split(';')[30],sequence.body.split(';')[50]);
 for(const i of [105,110,115]){
  const polygon=sequence.ring.split(';')[i].match(/-?\d*\.?\d+/g).map(Number);
  const tip=[(polygon[160]+polygon[162])/2,(polygon[161]+polygon[163])/2];
  assert.ok(Math.hypot(xs[i]-tip[0],Number(sequence.y.split(';')[i])-tip[1])<.003);
  assert.ok(Math.hypot(polygon[160]-polygon[162],polygon[161]-polygon[163])<6,'departure cap should be thinner');
  assert.equal(sequence.opacity.split(';')[i],'0');
 }
 assert.ok(radii[100]>radii[110]&&radii[110]>radii[119]);
 assert.equal(radii[120],0);
});

test('camera controls affect the ribbons without distorting the approved gentle logo',()=>{
 const c={...defaults,movement:'ribbon-logo'};
 const original=buildMotion(base,c),rotated=buildMotion(base,{...c,rotationX:-87,rotationY:50,orbitDepth:1.3,orbitSize:1.1});
 const timing=ribbonLogoTiming(c);
 for(const key of ['body','x','y','rx','ry']){
  const a=original[key].split(';'),b=rotated[key].split(';');
  for(let i=0;i<=120;i++){
   const time=i/120*timing.duration;
   if(time>=timing.logoStart&&time<=timing.exitStart)assert.equal(b[i],a[i],`${key}: camera distorted logo at frame ${i}`);
  }
 }
 assert.notEqual(rotated.ring,original.ring);
});

test('transferred timing, camera and orbit controls affect the new sequence',()=>{
 const c={...defaults,movement:'ribbon-logo'},original=buildMotion(base,c);
 for(const [key,value] of [['orbitSpeed',2],['ribbonHold',1.5],['logoHold',1.5],['exitTime',1.5]]){
  assert.notEqual(buildMotion(base,{...c,[key]:value}).duration,original.duration,key);
 }
 for(const [key,value] of [['rotationX',35],['rotationY',40],['rotationZ',30],['orbitDepth',1.3],['orbitSize',1.1],['orbitTurns',2],['orbitDirection',-1]]){
  assert.notEqual(buildMotion(base,{...c,[key]:value}).ring,original.ring,key);
 }
 assert.notEqual(buildMotion(base,{...c,rotationY:40,perspective:200}).ring,buildMotion(base,{...c,rotationY:40,perspective:700}).ring);
 const transformed=buildTakeMotion(base,{name:'Camera and placement',duration:5.6,loop:true,keyframes:[{time:0,settings:{...c,rotationX:25,rotationY:30,rotationZ:-20,dotX:21,dotY:-8,dotScale:1.2,ribbonX:-3,ribbonScale:.8}},{time:1,settings:c}]});
 for(const value of Object.values(transformed))if(typeof value==='string')assert.ok(!/NaN|Infinity/.test(value));
});
test('ribbon dot grows by 0.63s, reaches zero by 2.40s and stays hidden until restart',()=>{
 const motion=buildMotion(base,{...defaults,movement:'ribbon'});
 const radii=motion.rx.split(';').map(Number);
 assert.equal(motion.rx,motion.ry);
 assert.equal(radii[0],0);
 assert.equal(radii[120],0);
 assert.equal(radii[27],19); // 0.63 seconds of the 2.80 second cycle
 for(let i=1;i<=27;i++)assert.ok(radii[i]>radii[i-1]);
 for(let i=27;i<=85;i++)assert.equal(radii[i],19);
 for(let i=87;i<=103;i++)assert.ok(radii[i]<radii[i-1]);
 for(let i=103;i<=120;i++)assert.equal(radii[i],0);
 const fast=buildMotion(base,{...defaults,movement:'ribbon',speed:2});
 assert.equal(fast.duration,1.4);
 assert.equal(fast.rx,motion.rx);
});
test('open ribbon cap completes full laps without stopping, reversing or a loop seam',()=>{
 for(const direction of [-1,1])for(const turns of [1,2,3]){
  const frames=Array.from({length:121},(_,i)=>ribbonLoopFrame(i/120,direction,turns));
  const angles=frames.map(({tip:[x,y]})=>{
   const tilt=-38*Math.PI/180,dx=x-87,dy=y-100;
   return Math.atan2((-dx*Math.sin(tilt)+dy*Math.cos(tilt))/34,(dx*Math.cos(tilt)+dy*Math.sin(tilt))/62);
  });
  let total=0;
  for(let i=1;i<angles.length;i++){
   const delta=Math.atan2(Math.sin(angles[i]-angles[i-1]),Math.cos(angles[i]-angles[i-1]));
   assert.ok(Math.abs(delta+direction*turns*2*Math.PI/120)<1e-10,'cap must keep moving at the same angular speed');
   total+=delta;
  }
  assert.ok(Math.abs(total+direction*turns*2*Math.PI)<1e-9);
  assert.deepEqual(frames[0],frames[120]);
 }
});
test('dot and ribbon share their projected pivot at every tested turn angle',()=>{
 for(const rotationX of [-80,0,75])for(const rotationY of [-90,0,90])for(const rotationZ of [-45,0,60])for(const t of [.03,.07,.11,.16,.2]){
  const c={...defaults,rotationX,rotationY,rotationZ};
  const frame=orbitFrame(t,ring,{x:133,y:49,r:19},c);
  assert.equal(frame.dot.x,frame.tip[0]);assert.equal(frame.dot.y,frame.tip[1]);
  const cap=frame.panels.at(-1).d.match(/-?\d*\.?\d+/g).map(Number);
  const distance=Math.hypot((cap[2]+cap[4])/2-frame.dot.x,(cap[3]+cap[5])/2-frame.dot.y);
  assert.ok(distance<1,`cap projection drift ${distance}`);
 }
});
test('attachment compensates for independent dot and ribbon placements',()=>{
 const c={...defaults,dotX:21,dotY:-11,dotScale:1.4,ribbonX:-12,ribbonY:15,ribbonScale:.8};
 const motion=buildMotion(base,c);
 for(const i of [0,5,10,15,20]){
   const x=133+(Number(motion.x.split(';')[i])-133)*c.dotScale+c.dotX;
   const y=49+(Number(motion.y.split(';')[i])-49)*c.dotScale+c.dotY;
   assert.ok(Math.abs(x-(88+c.ribbonX))<.002);
   assert.ok(Math.abs(y-(100+(88-100)*c.ribbonScale+c.ribbonY))<.002);
 }
});
test('recorded take interpolates controls and bakes placements without opening a loop seam',()=>{
 const take={name:'Rotation check',duration:4,loop:true,keyframes:[{time:0,settings:defaults},{time:.4,settings:{...defaults,rotationY:75,dotX:10,ribbonX:-4,gap:22}}]};
 const motion=buildTakeMotion(base,take);
 assert.equal(motion.duration,4);assert.equal(motion.bakedPlacement,true);
 for(const [key,value] of Object.entries(motion))if(typeof value==='string'&&key!=='keyTimes'){
   const a=value.split(';');assert.equal(a.length,121,key);assert.equal(a[0],a.at(-1),key);assert.ok(!value.includes('NaN'));
 }
 assert.ok(motion.letteringTranslate.split(';').some(v=>Number(v.split(' ')[0])>160));
 for(const panel of motion.orbitPanels)for(const value of Object.values(panel)){const a=value.split(';');assert.equal(a.length,121);assert.equal(a[0],a.at(-1));}
});
test('invalid rotation and take inputs are rejected',()=>{
 assert.throws(()=>validate({rotationY:181}));assert.throws(()=>validate({orbitTurns:1.5}));assert.throws(()=>validate({attachDot:'yes'}));
 assert.throws(()=>validateTake({name:'x',duration:0,loop:true,keyframes:[]}));
 assert.throws(()=>validateTake({name:'x',duration:4,loop:true,keyframes:[{time:.5,settings:defaults},{time:.5,settings:defaults}]}));
});
test('ribbon starts at zero and its dot tracks the leading cap for the entire keyed loop',()=>{
 const c={...defaults,movement:'ribbon',ribbonScale:.7,ribbonX:-4,ribbonY:-17,dotX:-13,dotScale:1.2};
 const take={name:'Zero origin',duration:2.8,loop:true,keyframes:[{time:0,settings:c},{time:.356,settings:{...c,dotX:15,ribbonScale:1}},{time:1,settings:c}]};
 const motion=buildTakeMotion(base,take),paths=motion.ring.split(';'),xs=motion.x.split(';').map(Number),ys=motion.y.split(';').map(Number);
 const polygon=d=>d.match(/-?\d*\.?\d+/g).map(Number);
 const first=polygon(paths[0]);
 assert.equal(new Set(first.filter((_,i)=>i%2===0)).size,1);
 assert.equal(new Set(first.filter((_,i)=>i%2===1)).size,1);
 assert.equal(motion.ringOpacity.split(';')[0],'0');
 for(let i=0;i<121;i++){
   const p=polygon(paths[i]),tip=[(p[160]+p[162])/2,(p[161]+p[163])/2];
   assert.ok(Math.hypot(xs[i]-tip[0],ys[i]-tip[1])<.003,`detached at frame ${i}`);
 }
 assert.equal(paths[0],paths[120]);assert.equal(xs[0],xs[120]);assert.equal(ys[0],ys[120]);
 assert.ok(Math.hypot(xs[20]-xs[0],ys[20]-ys[0])>10);
});


test('playback range trims every track without changing speed or endpoint poses',()=>{
 const c={...defaults,movement:'ribbon-logo'};
 const full=buildMotion(base,c),clip=buildMotion(base,{...c,rangeStart:.25,rangeEnd:.75});
 assert.equal(clip.duration,full.duration*.5);
 for(const key of ['x','y','rx','ring','body','iconRotate','iconTranslate']){
  assert.equal(clip[key].split(';')[0],full[key].split(';')[30],key+' start');
  assert.equal(clip[key].split(';').at(-1),full[key].split(';')[90],key+' end');
 }
 assert.equal(clip.keyTimes.split(';').length,121);
 assert.ok(!JSON.stringify(clip).includes('NaN'));
 assert.deepEqual(buildMotion(base,{...c,rangeStart:0,rangeEnd:1}),full);
 assert.throws(()=>validate({...c,rangeStart:.8,rangeEnd:.5}));
 assert.throws(()=>validate({...c,rangeStart:.5,rangeEnd:.5}));
});

test('keyframe take range is preserved and applied after the full take is baked',()=>{
 const settings={...defaults,movement:'ribbon-logo'};
 const take={name:'Trimmed take',duration:4,loop:false,keyframes:[{time:0,settings},{time:1,settings:{...settings,iconRotation:30}}]};
 const full=buildTakeMotion(base,take),selected={...take,rangeStart:.25,rangeEnd:.75},clip=buildTakeMotion(base,selected);
 assert.equal(validateTake(selected).rangeStart,.25);
 assert.equal(validateTake(selected).rangeEnd,.75);
 assert.equal(clip.duration,2);
 for(const key of ['x','ring','iconRotate','letteringTranslate']){
  assert.equal(clip[key].split(';')[0],full[key].split(';')[30]);
  assert.equal(clip[key].split(';').at(-1),full[key].split(';')[90]);
 }
 const template=readFileSync(new URL('../../public/brand/motion/introify-logo-light.svg',import.meta.url),'utf8');
 const svg=exportMotionSvg(template,'logo-light',clip,settings);
 assert.match(svg,/dur="2s"/);assert.ok(!svg.includes('NaN'));
});
