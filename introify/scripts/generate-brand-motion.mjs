import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const app = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(app, 'public/brand/motion');
const deliverables = path.join(app, '../.local/brand-motion');
await mkdir(destination, { recursive: true });
await mkdir(deliverables, { recursive: true });
const source = await readFile(path.join(app, 'src/components/brand/icon.tsx'), 'utf8');
const originalPath = [...source.matchAll(/<path d="([^"]+)"/g)].at(-1)[1];
const duration = 2.8;
const n = x => +x.toFixed(3);
const ease = t => t*t*t*(t*(t*6-15)+10);
// Independent, delayed tracks provide anticipation and follow-through.
// All tracks rest at the same pose on either side of the loop seam.
function track(t, keys) {
    for(let i=1;i<keys.length;i++) {
        if(t<=keys[i][0]) {
            const [a,x]=keys[i-1], [b,y]=keys[i];
            return x+(y-x)*ease(Math.max(0,Math.min(1,(t-a)/(b-a))));
        }
    }
    return keys.at(-1)[1];
}
function gentle(t) {
    const headY=track(t,[[0,0],[.1,3],[.24,-8],[.4,-1],[.5,1],[.7,0],[1,0]]);
    const headX=track(t,[[0,0],[.1,-1],[.26,3],[.42,1],[.65,0],[1,0]]);
    const tail=track(t,[[0,0],[.12,-3],[.28,9],[.44,-5],[.58,2],[.75,0],[1,0]]);
    const lift=track(t,[[0,0],[.13,2],[.3,-3],[.47,.8],[.69,0],[1,0]]);
    const squash=track(t,[[0,0],[.1,1],[.24,-.7],[.4,0],[1,0]]);
    const body=originalPath.replace(/[MC][^MCZ]*/g,command=> {
        const coordinates=command.slice(1).match(/-?\d*\.?\d+/g).map(Number);
        const deformed=[];
        for(let i=0;i<coordinates.length;i+=2) {
            const x=coordinates[i],y=coordinates[i+1];
            const tailWeight=Math.pow(Math.max(0,Math.min(1,(150-x)/136)),1.5);
            deformed.push(n(x+headX*.22*(1-tailWeight)),n(y+lift+tail*tailWeight));
        }
        return command[0]+deformed.join(' ');
    });
    return {t,body,x:133+headX,y:49+headY,rx:19*(1+.025*squash),ry:19*(1-.035*squash)};
}

// A real open ellipse band: both edges follow the same tilted ellipse.
// The interior remains transparent throughout the dedicated ribbon phase.
function openRibbon(progress, body, blend) {
    const tilt=-38*Math.PI/180, tail=4.95, head=2.65*(1-progress);
    const point=(u,side)=>{
        const theta=tail+(head-tail)*u;
        const halfWidth=10*Math.pow(Math.sin(Math.PI*u/2),.75);
        const x=(62+side*halfWidth)*Math.cos(theta);
        const y=(34+side*halfWidth)*Math.sin(theta);
        return [n(87+x*Math.cos(tilt)-y*Math.sin(tilt)),n(100+x*Math.sin(tilt)+y*Math.cos(tilt))];
    };
    const points=[...Array.from({length:81},(_,i)=>point(i/80,-1)),...Array.from({length:81},(_,i)=>point(1-i/80,1))];
    const commands=body.match(/[MC][^MCZ]*/g).map(c=>c.slice(1).match(/-?\d*\.?\d+/g).map(Number));
    const curves=commands.slice(1).map((c,i)=>[i===0?commands[0]:commands[i].slice(-2),c.slice(0,2),c.slice(2,4),c.slice(4,6)]);
    const sample=(u,segments)=>{
        const index=Math.min(segments.length-1,Math.floor(u*segments.length));
        const t=u*segments.length-index, q=1-t;
        return [0,1].map(axis=>q*q*q*segments[index][0][axis]+3*q*q*t*segments[index][1][axis]+3*q*t*t*segments[index][2][axis]+t*t*t*segments[index][3][axis]);
    };
    const target=[...Array.from({length:81},(_,i)=>sample(i/80,curves.slice(0,3))),...Array.from({length:81},(_,i)=>sample(i/80,curves.slice(3)))];
    return 'M'+points.map((p,i)=>p.map((v,axis)=>n(v+(target[i][axis]-v)*blend)).join(' ')).join('L')+'Z';
}
function state(t) {
    if(t === 1) return {...state(0), t:1};
    const enter=track(t,[[0,0],[.04,0],[.17,1],[1,1]]);
    const leave=track(t,[[0,0],[.78,0],[.98,1],[1,1]]);
    const rest=gentle(Math.max(0,Math.min(1,(t-.59)/.18)));
    const ribbonProgress=track(t,[[0,0],[.17,0],[.29,1],[1,1]]);
    const ringOpacity=track(t,[[0,0],[.13,0],[.19,1],[.61,1],[.62,0],[1,0]]);
    const shape=openRibbon(ribbonProgress,rest.body,track(t,[[0,0],[.47,0],[.61,1],[1,1]]));
    const x=115+18*enter-18*leave+(rest.x-133)*.65;
    const y=72-23*enter+23*leave+(rest.y-49)*.65;
    const r=4+15*enter-15*leave;
    const length=track(t,[[0,5],[.08,12],[.18,0],[.72,0],[.82,91],[.9,73],[1,5]]);
    const trailOpacity=track(t,[[0,0],[.05,0],[.12,.2],[.2,0],[.72,0],[.82,.6],[.92,.25],[1,0]]);
    const trail='M'+n(x-length*.82)+' '+n(y+length*.62)+'Q'+n(x-length*.36)+' '+n(y+length*.2-9)+' '+n(x)+' '+n(y)+'Q'+n(x-length*.25)+' '+n(y+length*.35+8)+' '+n(x-length*.82)+' '+n(y+length*.62)+'Z';
    return {t,body:shape,ring:shape,ringOpacity,x,y,rx:r*(rest.rx/19),ry:r*(rest.ry/19),
        opacity:track(t,[[0,0],[.49,0],[.61,1],[.74,1],[.85,0],[1,0]]),trail,trailOpacity};
}

const timeline=Array.from({length:121},(_,i)=>state(i/120));
const frames=Array.from({length:40},(_,i)=>state(i/39));
const palettes={light:['#20E3BA','#00C7E8','#0073D5','#142A98'],dark:['#5EF3D2','#31DFFF','#329EFF','#5879F5']};
const keys=timeline.map(f=>n(f.t)).join(';');
const animate=(attribute,values)=>'<animate attributeName="'+attribute+'" values="'+values.join(';')+'" keyTimes="'+keys+'" dur="'+duration+'s" repeatCount="indefinite" calcMode="linear"/>';
function svg(mode,animated,s=state(.8)) {
    const stops=palettes[mode].map((color,i)=>'<stop offset="'+[0,.32,.64,1][i]+'" stop-color="'+color+'"/>').join('');
    const a=(name,get)=>animated?animate(name,timeline.map(f=>typeof get(f)==='number'?n(get(f)):get(f))):'';
    const body='<path fill="url(#brand)" d="'+s.body+'" opacity="'+n(s.opacity)+'">'+a('d',f=>f.body)+a('opacity',f=>f.opacity)+'</path>';
    const trail='<path fill="url(#head)" filter="url(#soft)" d="'+s.trail+'" opacity="'+n(s.trailOpacity)+'">'+a('d',f=>f.trail)+a('opacity',f=>f.trailOpacity)+'</path>';
    const ring='<path fill="url(#ribbon-color)" d="'+s.ring+'" opacity="'+n(s.ringOpacity)+'">'+a('d',f=>f.ring)+a('opacity',f=>f.ringOpacity)+'</path>';
    const head='<ellipse fill="url(#head)" cx="'+n(s.x)+'" cy="'+n(s.y)+'" rx="'+n(s.rx)+'" ry="'+n(s.ry)+'">'+a('cx',f=>f.x)+a('cy',f=>f.y)+a('rx',f=>f.rx)+a('ry',f=>f.ry)+'</ellipse>';
    const still='<g class="still" fill="url(#brand)"><circle cx="133" cy="49" r="19"/><path d="'+originalPath+'"/></g>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="176" height="176" viewBox="0 0 176 176" role="img" aria-label="Introify animated icon"><title>Introify — a friendly hello / '+mode+'</title><style>.still{display:none}@media(prefers-reduced-motion:reduce){.motion{display:none}.still{display:inline}}.force-motion .motion{display:inline}.force-motion .still{display:none}</style><defs><linearGradient id="brand" gradientUnits="userSpaceOnUse" x1="20" y1="65" x2="145" y2="113">'+stops+'</linearGradient><linearGradient id="head" x1="0" y1="0" x2="1" y2=".65">'+stops+'</linearGradient><linearGradient id="ribbon-color" gradientUnits="userSpaceOnUse" x1="24" y1="139" x2="148" y2="61"><stop stop-color="#087BFF"/><stop offset=".48" stop-color="#08BFEC"/><stop offset=".82" stop-color="#6CECC3"/><stop offset="1" stop-color="#C6FBE0"/></linearGradient><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter></defs><g class="'+(animated?'motion':'frame')+'">'+trail+ring+body+head+'</g>'+(animated?still:'')+'</svg>';
}

await writeFile(path.join(app,'src/components/brand/motion-data.json'),JSON.stringify({duration,keyTimes:keys,ring:timeline.map(f=>f.ring).join(';'),ringOpacity:timeline.map(f=>n(f.ringOpacity)).join(';'),body:timeline.map(f=>f.body).join(';'),opacity:timeline.map(f=>n(f.opacity)).join(';'),trail:timeline.map(f=>f.trail).join(';'),trailOpacity:timeline.map(f=>n(f.trailOpacity)).join(';'),x:timeline.map(f=>n(f.x)).join(';'),y:timeline.map(f=>n(f.y)).join(';'),rx:timeline.map(f=>n(f.rx)).join(';'),ry:timeline.map(f=>n(f.ry)).join(';')},null,2));

const lettering={};
for(const [mode,asset] of [['light','forest'],['dark','signature']]) {
    const art=await readFile(path.join(app,'public/brand/introify-'+asset+'.svg'),'utf8');
    lettering[mode]=art.match(/<g transform="translate\(150 0\)">([\s\S]*?)<\/g>/)[1];
}
function lockup(mode,animated,s=state(.6)) {
    const symbol=svg(mode,animated,s).replace(/^<svg[^>]+>/,'').replace(/<\/svg>$/,'');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="856.41" height="218.41" viewBox="0 0 856.41 218.41" role="img" aria-label="Introify"><g transform="translate(-18.2 -24) scale(1.3)">'+symbol+'</g><g transform="translate(150 0)">'+lettering[mode]+'</g></svg>';
}

for (const mode of ['light','dark']) {
    await writeFile(path.join(destination,`introify-symbol-${mode}.svg`),svg(mode,true));
    await writeFile(path.join(destination,`introify-logo-${mode}.svg`),lockup(mode,true));
    const frameDir=path.join(deliverables,'frames',mode);
    await mkdir(frameDir,{recursive:true});
    const thumbs=[];
    for(let i=0;i<frames.length;i++) {
        const contents=svg(mode,false,frames[i]);
        await writeFile(path.join(frameDir,`${String(i+1).padStart(2,'0')}.svg`),contents);
        thumbs.push({input:await sharp(Buffer.from(contents)).resize(140,140).png().toBuffer(),left:i%8*176+18,top:Math.floor(i/8)*190+8});
    }
    const labels=frames.map((_,i)=>`<text x="${i%8*176+15}" y="${Math.floor(i/8)*190+176}">${String(i+1).padStart(2,'0')}</text>`).join('');
    const board=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1408" height="950"><rect width="1408" height="950" fill="${mode==='light'?'#fafbfc':'#07080a'}"/><g font-family="sans-serif" font-size="11" fill="#82909f">${labels}</g></svg>`);
    await sharp(board).composite(thumbs).png().toFile(path.join(deliverables,`storyboard-${mode}.png`));
}
await writeFile(path.join(deliverables,'manifest.json'),JSON.stringify({version:6,motion:"ribbon-form-gentle-settle-comet",duration,frames:40,animationSamples:121,dimensions:[176,176],modes:['light','dark'],format:'SVG / SMIL',background:'transparent'},null,2));
console.log('Generated hollow-ribbon loop v6: ribbon, logo, comet, 2.8 seconds, light/dark SVGs and 80 frames.');

if(process.argv.includes('--preview')) {
    const previewFrames=[];
    const background=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="260"><rect width="520" height="260" fill="#f8fafb"/><rect x="520" width="520" height="260" fill="#07080a"/></svg>');
    for(let i=0;i<70;i++) {
        const current=state(i/70);
        const light=await sharp(Buffer.from(lockup('light',false,current))).resize(460).png().toBuffer();
        const dark=await sharp(Buffer.from(lockup('dark',false,current))).resize(460).png().toBuffer();
        previewFrames.push(await sharp(background).composite([{input:light,left:30,top:70},{input:dark,left:550,top:70}]).ensureAlpha().raw().toBuffer());
    }
    await sharp(Buffer.concat(previewFrames),{raw:{width:1040,height:260*70,channels:4,pageHeight:260}}).gif({loop:0,delay:40,dither:0}).toFile(path.join(deliverables,'motion-v6-preview.gif'));
    console.log('Rendered 70-frame animated preview.');
}
