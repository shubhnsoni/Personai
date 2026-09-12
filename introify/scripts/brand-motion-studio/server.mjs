import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {defaults,validate,buildMotion} from './core.mjs';
import {validateTake,buildTakeMotion} from './timeline.mjs';
import {createOptionStore} from './options.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const app=path.resolve(root,'../..');
const output=path.resolve(app,'../.local/brand-motion');
const origin='http://127.0.0.1:3107';
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const motionPath=path.join(app,'src/components/brand/motion-data.json');
const options=createOptionStore(path.join(app,'public/brand/motion'));
await options.gallery();
const requestId=value=>{if(value===undefined)return randomUUID();if(typeof value!=='string'||! /^[a-f0-9-]{36}$/.test(value))throw Error('Invalid save ID.');return value;};
http.createServer(async(req,res)=>{
  const send=(status,data,type='application/json')=>res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data));
  try {
    if(req.headers.host!=='127.0.0.1:3107'&&req.headers.host!=='localhost:3107') return send(403,{error:'Local editor only.'});
    const url=new URL(req.url,origin);
    if(req.method==='POST'&&url.pathname==='/api/takes'){
      if(![origin,'http://localhost:3107'].includes(req.headers.origin))return send(403,{error:'Invalid origin.'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>100000)return send(413,{error:'Take too large.'});}
      const payload=JSON.parse(body),take=validateTake(payload),id=requestId(payload.requestId);let savedAt=new Date().toISOString();
      const base=JSON.parse(await readFile(motionPath,'utf8')),motion=buildTakeMotion(base,take);
      const directory=path.join(output,'takes');await mkdir(directory,{recursive:true});
      try{const previous=JSON.parse(await readFile(path.join(directory,id+'.json'),'utf8'));if(JSON.stringify(validateTake(previous))!==JSON.stringify(take))return send(409,{error:'This save ID was already used for a different take.'});savedAt=previous.savedAt;}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(path.join(directory,id+'.motion.json'),JSON.stringify(motion),{flag:'wx'});await writeFile(path.join(directory,id+'.json'),JSON.stringify({...take,id,savedAt},null,2),{flag:'wx'});}
      const option=await options.create({sourceKey:`take:${id}`,sourceTakeId:id,name:take.name,take:{...take,id,savedAt},settings:take.keyframes[0].settings,motion});
      return send(201,{id,name:take.name,savedAt,option:option.option,url:option.url});
    }
    if(req.method==='POST'&&url.pathname==='/api/finalize') {
      if(req.headers.origin!==origin&&req.headers.origin!=='http://localhost:3107')return send(403,{error:'Invalid origin.'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>100000)return send(413,{error:'Settings too large.'});}
      const payload=JSON.parse(body);if(!payload.settings)return send(409,{error:'Refresh the motion studio once so your save includes keyframes and an option number. Your browser draft is preserved.'});
      const settings=validate(payload.settings),take=payload.take?validateTake(payload.take):null,id=requestId(payload.requestId);
      const base=JSON.parse(await readFile(motionPath,'utf8'));
      const motion=take?buildTakeMotion(base,take):buildMotion(base,settings);
      const option=await options.create({sourceKey:`finalize:${id}`,name:take?.name??'Saved motion',settings:take?.keyframes[0].settings??settings,take,motion});
      const finalized={schemaVersion:1,baseVersion:8,finalizedAt:option.lockedAt,option:option.option,url:option.url,settings,...(take?{take}:{})};
      await mkdir(output,{recursive:true});
      await writeFile(path.join(output,'finalized-motion-data.json'),JSON.stringify({...finalized,...motion},null,2));
      await writeFile(path.join(output,'finalized-settings.json'),JSON.stringify(finalized,null,2));
      return send(200,{ok:true,finalizedAt:finalized.finalizedAt,path:'.local/brand-motion/finalized-settings.json',option:option.option,url:option.url,keyframes:take?.keyframes.length??0});
    }
    if(req.method!=='GET')return send(405,{error:'Method not allowed.'});
    if(url.pathname==='/api/options'){const saved=await options.list();return send(200,{options:saved.map(({option,name,keyframes,duration,url})=>({option,name,keyframes,duration,url})),nextNumber:Math.max(0,...saved.map(o=>o.option))+1});}
    if(url.pathname==='/api/takes'){
      let files=[];try{files=await readdir(path.join(output,'takes'));}catch{}
      const savedOptions=await options.list();
      const takes=await Promise.all(files.filter(f=>f.endsWith('.json')&&!f.endsWith('.motion.json')).map(async file=>{const t=JSON.parse(await readFile(path.join(output,'takes',file),'utf8')),option=savedOptions.find(o=>o.sourceTakeId===t.id);return {id:t.id,name:t.name,savedAt:t.savedAt,duration:t.duration,keyframes:t.keyframes.length,option:option?.option,url:option?.url};}));
      return send(200,takes.sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));
    }
    if(url.pathname.startsWith('/api/takes/')){
      const id=url.pathname.slice(11);if(!/^[a-f0-9-]{36}$/.test(id))return send(400,{error:'Invalid take ID.'});
      return send(200,await readFile(path.join(output,'takes',id+'.json')));
    }
    if(url.pathname==='/api/base')return send(200,await readFile(motionPath));
    if(url.pathname==='/api/shared-preview')return send(200,await readFile(path.join(output,'shared-preview-settings.json')));
    if(url.pathname==='/api/finalized') {
      try{return send(200,await readFile(path.join(output,'finalized-settings.json')));}catch{return send(200,{settings:defaults,finalizedAt:null});}
    }
    const brand=url.pathname.startsWith('/brand/');
    const base=brand?path.join(app,'public/brand'):root;
    const relative=brand?url.pathname.slice(7):url.pathname==='/'?'index.html':url.pathname.slice(1);
    const file=path.resolve(base,decodeURIComponent(relative));
    if(!file.startsWith(base+path.sep))return send(403,{error:'Invalid path.'});
    return send(200,await readFile(file),types[path.extname(file)]||'application/octet-stream');
  }catch(error){return send(error.code==='ENOENT'?404:400,{error:error.code==='ENOENT'?'Not found':error.message});}
}).listen(3107,'127.0.0.1',()=>console.log('Introify motion studio: '+origin));
