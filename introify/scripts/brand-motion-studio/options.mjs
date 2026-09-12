import path from 'node:path';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {exportMotionSvg} from './export-motion.mjs';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const css='*{box-sizing:border-box}body{margin:0;background:#0c1118;color:#f1f7fc;font:15px Arial,sans-serif;padding:36px}main{max-width:1100px;margin:auto}h1{font-size:34px;letter-spacing:-.04em}p{color:#a3b5c5;line-height:1.6}.tag{color:#8eeccd;font-size:12px;letter-spacing:.1em}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:25px}article{border:1px solid #31414e;border-radius:18px;padding:24px;background:#f6f9fc;color:#4c6170}article.dark{background:#06090d;color:#a3b5c5}img{width:100%;height:160px;display:block}img.icon{height:220px}a{color:inherit}footer{margin:25px 0;font-size:13px;color:#a3b5c5}.links{display:flex;gap:20px;flex-wrap:wrap}.grid>a{display:block;border:1px solid #31414e;border-radius:15px;padding:20px;text-decoration:none}.grid>a img{height:120px}@media(max-width:650px){body{padding:24px 16px}.grid{grid-template-columns:1fr}h1{font-size:28px}}';
const page=(title,content)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${css}</style></head><body><main>${content}</main></body></html>`;
export function createOptionStore(brand){
 const root=path.join(brand,'options');let queue=Promise.resolve();
 async function list(){let names=[];try{names=await readdir(root);}catch(e){if(e.code!=='ENOENT')throw e;}
  const rows=await Promise.all(names.filter(n=>/^option-\d+$/.test(n)).map(async name=>{try{const m=JSON.parse(await readFile(path.join(root,name,'manifest.json'),'utf8'));return {...m,url:`/brand/motion/options/${name}/index.html`};}catch(e){if(e.code!=='ENOENT')throw e;return null;}}));return rows.filter(Boolean).sort((a,b)=>a.option-b.option);
 }
 async function gallery(){const options=await list();await mkdir(root,{recursive:true});await writeFile(path.join(root,'index.html'),page('Introify · Saved options',`<span class="tag">SAVED MOTION OPTIONS</span><h1>Every version, kept.</h1><p>Each option preserves its settings, keyframes and animation assets. Saving creates a new number.</p><div class="grid">${options.map(o=>`<a href="option-${o.option}/index.html"><span class="tag">OPTION ${o.option}</span><h2>${escape(o.name||'Locked selection')}</h2><img src="option-${o.option}/introify-logo-dark.svg" alt="Introify Option ${o.option}"><p>${o.keyframes?o.keyframes+' keyframes':'Saved settings'}${o.duration?' · '+o.duration+' seconds':''}</p></a>`).join('')}</div><footer><a href="/">Back to motion studio</a></footer>`));}
 async function create(input){
  const sourceHash=createHash('sha256').update(JSON.stringify({settings:input.settings,take:input.take??null,motion:input.motion})).digest('hex');
  const existing=(await list()).find(o=>o.sourceKey===input.sourceKey);if(existing){if(existing.sourceHash!==sourceHash)throw Error('This save ID already belongs to different settings.');await gallery();return existing;}
  const ids=['logo-light','logo-dark','symbol-light','symbol-dark'],assets={};
  assets['settings.json']=JSON.stringify({schemaVersion:1,baseVersion:8,settings:input.settings},null,2);
  assets['motion-data.json']=JSON.stringify(input.motion);
  if(input.take)assets['take.json']=JSON.stringify(input.take,null,2);
  for(const id of ids)assets[`introify-${id}.svg`]=exportMotionSvg(await readFile(path.join(brand,'introify-'+id+'.svg'),'utf8'),id,input.motion,input.settings);
  await mkdir(root,{recursive:true});let number;
  let destination;
  for(;;){const names=await readdir(root);number=Math.max(0,...names.map(n=>Number(n.match(/^option-(\d+)$/)?.[1]||0)))+1;destination=path.join(root,'option-'+number);try{await mkdir(destination);break;}catch(e){if(e.code!=='EEXIST')throw e;}}
  const manifest={option:number,status:'locked',name:input.name||`Option ${number}`,sourceKey:input.sourceKey,sourceHash,sourceTakeId:input.sourceTakeId??null,lockedAt:new Date().toISOString(),duration:input.motion.duration,keyframes:input.take?.keyframes.length??0,files:{}};
  assets['index.html']=page(`Introify · Option ${number}`,`<span class="tag">SAVED OPTION · ${number}</span><h1>Option ${number}. ${escape(manifest.name)}</h1><p>${manifest.keyframes?manifest.keyframes+' keyframes · ':''}${manifest.duration} seconds · ${input.motion.loop===false?'Plays once':'Looping'}<br>This version is saved separately. Future saves create a new option.</p><div class="grid">${ids.map(id=>`<article class="${id.endsWith('dark')?'dark':''}"><p>${id.replace('-',' · ')}</p><img class="${id.startsWith('symbol')?'icon':''}" src="introify-${id}.svg" alt="Introify ${id}"><a href="introify-${id}.svg" download>Download SVG ↗</a></article>`).join('')}</div><footer class="links">${input.take?'<a href="take.json" download>Download keyframes</a>':''}<a href="settings.json" download>Download settings</a><a href="../index.html">All options</a><a href="/">Motion studio</a></footer>`);
  for(const [name,value] of Object.entries(assets)){await writeFile(path.join(destination,name),value,{flag:'wx'});manifest.files[name]=createHash('sha256').update(value).digest('hex');}
  await writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});await gallery();return {...manifest,url:`/brand/motion/options/option-${number}/index.html`};
 }
 return {list,gallery,create(input){const next=queue.then(()=>create(input));queue=next.catch(()=>{});return next;}};
}
