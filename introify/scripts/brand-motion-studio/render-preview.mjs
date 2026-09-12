import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import {buildMotion,defaults} from './core.mjs';
const app=fileURLToPath(new URL('../../',import.meta.url));
const output=path.resolve(app,'../.local/brand-motion');
const base=JSON.parse(await readFile(path.join(app,'src/components/brand/motion-data.json'),'utf8'));
const data=buildMotion(base,defaults);
const tracks=Object.fromEntries(Object.entries(data).filter(([,v])=>typeof v==='string').map(([k,v])=>[k,v.split(';')]));
const panels=data.orbitPanels.map(p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,v.split(';')])));
function frame(i,dark=false){
 const get=k=>tracks[k][i];
 const mesh=side=>panels.map(p=>`<path d="${p.d[i]}" fill="${p.color[i]}" opacity="${p[side][i]}"/>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="340" viewBox="-20 -20 216 216"><defs><linearGradient id="body"><stop stop-color="#20e3ba"/><stop offset=".5" stop-color="#00aee8"/><stop offset="1" stop-color="${dark?'#5879f5':'#142a98'}"/></linearGradient><linearGradient id="ring" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#087bff"/><stop offset=".5" stop-color="#08bfec"/><stop offset="1" stop-color="#c6fbe0"/></linearGradient><radialGradient id="sphere" cx=".28" cy=".23" r=".82"><stop stop-color="#b5faff"/><stop offset=".22" stop-color="#20dcef"/><stop offset=".57" stop-color="#008fe1"/><stop offset="1" stop-color="${dark?'#2845bb':'#12267f'}"/></radialGradient><filter id="blur"><feGaussianBlur stdDeviation="2.5"/></filter></defs><path d="${get('trail')}" fill="url(#sphere)" opacity="${get('trailOpacity')}" filter="url(#blur)"/><path d="${get('ring')}" fill="url(#ring)" opacity="${get('ringOpacity')}"/><path d="${get('body')}" fill="url(#body)" opacity="${get('opacity')}"/>${mesh('back')}<ellipse cx="${get('x')}" cy="${get('y')}" rx="${get('rx')}" ry="${get('ry')}" fill="url(#sphere)"/>${mesh('front')}</svg>`;
}
const background=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="380"><rect width="360" height="380" fill="#f6f9fc"/><rect x="360" width="360" height="380" fill="#06090d"/></svg>');
const images=[];
for(let i=0;i<120;i+=2){const composites=await Promise.all([false,true].map(async(dark,index)=>({input:await sharp(Buffer.from(frame(i,dark))).png().toBuffer(),left:10+360*index,top:20})));images.push(await sharp(background).composite(composites).ensureAlpha().raw().toBuffer());}
await sharp(Buffer.concat(images),{raw:{width:720,height:380*60,channels:4,pageHeight:380}}).gif({loop:0,delay:Array.from({length:60},(_,i)=>i%3===0?40:50)}).toFile(path.join(output,'motion-3d-opening.gif'));
const samples=[0,6,10,14,18,22,26,30,34,38,42,60];
const cards=await Promise.all(samples.map(async(i,j)=>({input:await sharp(Buffer.from(frame(i))).resize(180,180).png().toBuffer(),left:(j%6)*180,top:Math.floor(j/6)*180})));
await sharp({create:{width:1080,height:360,channels:4,background:'#f6f9fc'}}).composite(cards).png().toFile(path.join(output,'motion-3d-opening-frames.png'));
await writeFile(path.join(output,'motion-3d-preview-data.json'),JSON.stringify(data));
console.log('Rendered 3D opening preview and frame sheet.');
