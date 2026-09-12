const numberPattern=/-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
export function validateRange(start=0,end=1){
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>1||end-start<.001)throw Error('End must be after start within the animation.');
 return {rangeStart:start,rangeEnd:end};
}
/** Sample every track on one interval, including camera, placement and depth. */
export function clipMotion(motion,start=0,end=1){
 validateRange(start,end);
 if(start===0&&end===1)return motion;
 const times=motion.keyTimes.split(';').map(Number);
 const mix=(a,b,t)=>{
  if(a.startsWith('#')&&b.startsWith('#'))return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
  const numbers=(b.match(numberPattern)||[]).map(Number);let i=0;
  return a.replace(numberPattern,v=>String(Math.round((Number(v)+(numbers[i++]-Number(v))*t)*1000)/1000));
 };
 const sample=track=>{
  const values=track.split(';');
  return Array.from({length:121},(_,i)=>{
   const time=start+(end-start)*i/120;
   let right=times.findIndex(t=>t>=time);if(right<0)right=times.length-1;
   if(right===0)return values[0];
   return mix(values[right-1],values[right],(time-times[right-1])/(times[right]-times[right-1]));
  }).join(';');
 };
 const result={...motion,duration:motion.duration*(end-start),keyTimes:Array.from({length:121},(_,i)=>String(i/120)).join(';')};
 for(const [key,value] of Object.entries(motion))if(typeof value==='string'&&key!=='keyTimes')result[key]=sample(value);
 if(motion.orbitPanels)result.orbitPanels=motion.orbitPanels.map(panel=>Object.fromEntries(Object.entries(panel).map(([key,value])=>[key,sample(value)])));
 return result;
}
