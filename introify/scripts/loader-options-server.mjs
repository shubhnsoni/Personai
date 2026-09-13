import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicRoot=path.join(app,'public');
const savedRoot=path.join(publicRoot,'brand/loading-options/saved');
const origin='http://127.0.0.1:3113';
const designs=['sun','ring','halo','compass','ticks','base','grounded'];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
let saving=Promise.resolve();
async function icons(){
  const root=path.join(publicRoot,'brand/motion/options'), result=[];
  for(const entry of await readdir(root,{withFileTypes:true})){
    if(!entry.isDirectory()||!/^option-\d+$/.test(entry.name))continue;
    const manifest=JSON.parse(await readFile(path.join(root,entry.name,'manifest.json'),'utf8'));
    if(manifest.status==='locked')result.push({option:manifest.option,duration:manifest.duration,sourceHash:manifest.sourceHash});
  }
  return result.sort((a,b)=>a.option-b.option);
}
async function saved(){await mkdir(savedRoot,{recursive:true});const names=(await readdir(savedRoot)).filter(n=>/^option-\d+$/.test(n));return Promise.all(names.map(n=>readFile(path.join(savedRoot,n,'settings.json'),'utf8').then(JSON.parse)));}
async function save(input){
  if(!designs.includes(input.design)||!Number.isInteger(input.iconOption))throw Error('Choose a valid design and icon.');
  if(input.design==='grounded'&&input.iconOption!==4)throw Error('Grounded orbit uses Studio Option 04.');
  const icon=(await icons()).find(i=>i.option===input.iconOption);if(!icon)throw Error('Saved icon not found.');
  const prior=await saved();
  const existing=prior.find(p=>p.requestId===input.requestId);if(existing)return existing;
  if(!/^[a-f0-9-]{36}$/.test(input.requestId))throw Error('Invalid save request.');
  const option=Math.max(0,...prior.map(p=>p.option))+1;
  const directory=path.join(savedRoot,`option-${option}`);await mkdir(directory);
  const preset={schemaVersion:2,designRevision:6,option,name:typeof input.name==='string'?input.name.trim().slice(0,70)||`Loader ${option}`:`Loader ${option}`,design:input.design,iconOption:icon.option,iconSourceHash:icon.sourceHash,iconDuration:icon.duration,size:100.8,scale:0.7,placement:'viewport-center',iconOffset:{x:-4,y:-2},iconScale:input.design==='base'?1.3225:1,frameScale:input.design==='base'?0.72:1,progressCycleMs:6388,savedAt:new Date().toISOString(),requestId:input.requestId,files:{}};
  for(const mode of ['light','dark']){
    const source=path.join(publicRoot,`brand/motion/options/option-${icon.option}/introify-symbol-${mode}.svg`);
    const file=`icon-${mode}.svg`;await copyFile(source,path.join(directory,file));
    preset.files[file]=createHash('sha256').update(await readFile(source)).digest('hex');
  }
  // Preserve the rendering revision with each preset as the collection evolves.
  if(input.design==='grounded'){
    Object.assign(preset,{designRevision:8,iconScale:1.3225,internalIconScale:2,progressCycleMs:2800,clock:'single-svg-smil',geometry:JSON.parse(await readFile(path.join(publicRoot,'brand/loading-options/grounded/geometry-light.json'),'utf8'))});
    for(const mode of ['light','dark'])for(const suffix of ['','-still']){
      const file=`loader-${mode}${suffix}.svg`,source=path.join(publicRoot,'brand/loading-options/grounded',file);
      await copyFile(source,path.join(directory,file));
      preset.files[file]=createHash('sha256').update(await readFile(source)).digest('hex');
    }
  }
  for(const file of ['styles.css','preview.js']){
    const source=path.join(publicRoot,'brand/loading-options',file);
    await copyFile(source,path.join(directory,file));
    preset.files[file]=createHash('sha256').update(await readFile(source)).digest('hex');
  }
  await writeFile(path.join(directory,'settings.json'),JSON.stringify(preset,null,2)+'\n',{flag:'wx'});
  return preset;
}
http.createServer(async(req,res)=>{
  const send=(code,data,type='application/json')=>res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data));
  try{
    if(req.headers.host!=='127.0.0.1:3113'&&req.headers.host!=='localhost:3113')return send(403,{error:'Local preview only.'});
    const url=new URL(req.url,origin);
    if(req.method==='GET'&&url.pathname==='/api/loader-options')return send(200,{icons:await icons(),saved:await saved()});
    if(req.method==='POST'&&url.pathname==='/api/loader-options'){
      if(req.headers.origin!==origin&&req.headers.origin!=='http://localhost:3113')return send(403,{error:'Invalid origin.'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>4000)return send(413,{error:'Request too large.'});}
      const input=JSON.parse(body),pending=saving.then(()=>save(input));saving=pending.catch(()=>{});return send(201,await pending);
    }
    if(req.method!=='GET')return send(405,{error:'Method not allowed.'});
    const relative=url.pathname==='/'?'brand/loading-options/index.html':decodeURIComponent(url.pathname.slice(1));
    const file=path.resolve(publicRoot,relative);
    if(!file.startsWith(publicRoot+path.sep)||!relative.startsWith('brand/'))return send(403,{error:'Invalid path.'});
    send(200,await readFile(file),types[path.extname(file)]||'application/octet-stream');
  }catch(error){send(error.code==='ENOENT'?404:400,{error:error.code==='ENOENT'?'Not found':error.message});}
}).listen(3113,'127.0.0.1',()=>console.log(`Loader collection: ${origin}/`));
