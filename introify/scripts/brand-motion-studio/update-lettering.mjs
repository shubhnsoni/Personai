import {readFileSync,writeFileSync} from 'node:fs';

const app=new URL('../../',import.meta.url);
const component=new URL('src/components/brand/wordmark.tsx',app);
const dataFile=new URL('src/components/brand/lettering-data.json',app);
const source=readFileSync(component,'utf8');
let ntr;
try { ntr=JSON.parse(readFileSync(dataFile,'utf8')).ntr; }
catch { ntr=[...source.matchAll(/<path d="([^"]+)" fill="currentColor"/g)].slice(0,3).map(m=>m[1]); }
if(ntr.length!==3)throw Error('Expected the three original n, t and r outlines.');
const data={ntr,
 o:'M400 56 C433 56 459 82 459 115 C459 148 433 174 400 174 C367 174 341 148 341 115 C341 82 367 56 400 56 Z M400 82 C381 82 367 96 367 115 C367 134 381 148 400 148 C419 148 433 134 433 115 C433 96 419 82 400 82 Z',
 i:'M478 59 L507 59 L510 62 L510 171 L475 171 L475 62 Z',
 f:'M535 171 L535 85 L522 85 L522 59 L536 59 C537 24 557 3 587 3 C597 3 605 5 613 9 L605 33 C600 30 594 29 588 29 C575 29 567 39 567 59 L621 59 L621 85 L567 85 L567 171 Z',
 y:'M596 59 L628 59 L628 116 C628 132 632 139 642 139 C655 139 666 119 677 92 L690 59 L720 59 L675 172 C663 204 647 219 621 219 C607 219 595 215 585 209 L596 185 C604 189 612 191 620 191 C635 191 643 182 650 164 L653 156 C644 166 634 171 623 171 C604 171 596 154 596 127 Z',
 bridge:'M367 115 C367 134 381 148 400 148 C437 148 475 122 475 82 L510 82 C504 125 462 174 400 174 C367 174 341 148 341 115 Z'};
writeFileSync(dataFile,JSON.stringify(data,null,2)+'\n');
for(const mode of ['light','dark']){
 const file=new URL(`public/brand/motion/introify-logo-${mode}.svg`,app);
 const svg=readFileSync(file,'utf8'),start=svg.lastIndexOf('<g transform="translate(150 0)">');
 if(start<0)throw Error('Lettering group not found.');
 const ink=mode==='dark'?'#fdfdfd':'#111111',accent=mode==='dark'?'#00ccec':'#0073d5',id=`letter-${mode}`;
 const paths=data.ntr.map(d=>`<path d="${d}" fill="${ink}"/>`).join('');
 const lettering=`<g transform="translate(150 0)"><defs><linearGradient id="${id}-o" x1="390" y1="70" x2="451" y2="154" gradientUnits="userSpaceOnUse"><stop offset=".35" stop-color="${ink}"/><stop offset=".7" stop-color="${mode==='dark'?'#b8b8b8':'#343434'}"/><stop offset="1" stop-color="#626262"/></linearGradient><linearGradient id="${id}-join" x1="407" y1="158" x2="495" y2="100" gradientUnits="userSpaceOnUse"><stop stop-color="${ink}"/><stop offset=".5" stop-color="${mode==='dark'?'#72f4ed':'#31576e'}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs>${paths}<path d="${data.o}" fill="url(#${id}-o)" fill-rule="evenodd"/><path d="${data.i}" fill="${accent}"/><circle cx="492.5" cy="32" r="17.5" fill="${accent}"/><path d="${data.f}" fill="${accent}"/><path d="${data.y}" fill="${accent}"/><path d="${data.bridge}" fill="url(#${id}-join)"/></g>`;
 writeFileSync(file,svg.slice(0,start)+lettering+'</svg>\n');
 if(mode==='dark'){
  const signatureFile=new URL('public/brand/introify-signature.svg',app);
  const signature=readFileSync(signatureFile,'utf8'),letterStart=signature.lastIndexOf('<g transform="translate(150 0)">');
  if(letterStart<0)throw Error('Signature lettering group not found.');
  writeFileSync(signatureFile,(signature.slice(0,letterStart)+lettering+'</svg>\n').replaceAll('856.41','870').replaceAll('218.41','219'));
 }
}
