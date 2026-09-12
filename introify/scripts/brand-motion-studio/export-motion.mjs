const initial=(motion,key)=>motion[key].split(';')[0];
export function exportMotionSvg(template,id,motion,config){
 const animate=(attribute,key)=>`<animate attributeName="${attribute}" values="${motion[key]}" keyTimes="${motion.keyTimes}" dur="${motion.duration}s" repeatCount="${motion.loop===false?'1':'indefinite'}" fill="freeze" calcMode="linear"/>`;
 const staticDot=`translate(${config.dotX} ${config.dotY}) translate(133 49) scale(${config.dotScale}) translate(-133 -49)`;
 const staticRibbon=`translate(${config.ribbonX} ${config.ribbonY}) translate(88 100) scale(${config.ribbonScale}) translate(-88 -100)`;
 const dot=motion.bakedPlacement?'':staticDot,ribbon=motion.bakedPlacement?'':staticRibbon;
 const path=(paint,shape,opacity,extra='')=>`<path fill="url(#${paint})" d="${initial(motion,shape)}" opacity="${initial(motion,opacity)}" ${extra}>${animate('d',shape)}${animate('opacity',opacity)}</path>`;
 const mesh=side=>!motion.orbitPanels?'':`<g transform="${ribbon}" data-depth="${side}">`+motion.orbitPanels.map(p=>'<path>'+[['d','d'],['fill','color'],['opacity',side]].map(([attr,key])=>`<animate attributeName="${attr}" values="${p[key]}" keyTimes="${motion.keyTimes}" dur="${motion.duration}s" repeatCount="${motion.loop===false?'1':'indefinite'}" fill="freeze" calcMode="linear"/>`).join('')+'</path>').join('')+'</g>';
 const sphere=motion.orbitPanels?'orbit-sphere':'head';
 const group=`<g class="motion"><g transform="${dot}">${path('head','trail','trailOpacity','filter="url(#soft)"')}</g><g transform="${ribbon}">${path('ribbon-color','ring','ringOpacity')}${path('brand','body','opacity')}</g>${mesh('back')}<g transform="${dot}"><ellipse fill="url(#${sphere})" cx="${initial(motion,'x')}" cy="${initial(motion,'y')}" rx="${initial(motion,'rx')}" ry="${initial(motion,'ry')}">${animate('cx','x')}${animate('cy','y')}${animate('rx','rx')}${animate('ry','ry')}</ellipse></g>${mesh('front')}</g>`;
 const wholeIcon=(contents,animated)=>{
  for(const [type,key,fallback] of [['rotate','iconRotate',`${config.iconRotation??0} 88 100`],['translate','iconTranslate',`${config.iconX??0} ${config.iconY??0}`]]){
   const values=motion[key]??Array(121).fill(fallback).join(';');
   const animation=animated?`<animateTransform attributeName="transform" type="${type}" values="${values}" keyTimes="${motion.keyTimes}" dur="${motion.duration}s" repeatCount="${motion.loop===false?'1':'indefinite'}" fill="freeze" calcMode="linear"/>`:'';
   contents=`<g transform="${type}(${values.split(';')[0]})">${animation}${contents}</g>`;
  }
  return contents;
 };
 let svg=template.replace(/<g class="motion">[\s\S]*?<\/g>/,()=>wholeIcon(group,true));
 if(motion.orbitPanels)svg=svg.replace('</defs>',`<radialGradient id="orbit-sphere" cx=".28" cy=".23" r=".82"><stop offset="0" stop-color="#b5faff"/><stop offset=".22" stop-color="#20dcef"/><stop offset=".57" stop-color="#008fe1"/><stop offset="1" stop-color="${id.endsWith('dark')?'#2845bb':'#12267f'}"/></radialGradient></defs>`);
 svg=svg.replace(/(<g class="still"[^>]*>)(<circle[^>]*\/>)(<path[^>]*\/>)(<\/g>)/,(_,a,b,c,d)=>wholeIcon(`${a}<g transform="${staticDot}">${b}</g><g transform="${staticRibbon}">${c}</g>${d}`,false));
 const logo=id.startsWith('logo'),gap=motion.letteringTranslate?Math.max(...motion.letteringTranslate.split(';').map(v=>Number(v.split(' ')[0])-150)):config.gap;
 svg=svg.replace(/^<svg[^>]*>/,`<svg xmlns="http://www.w3.org/2000/svg" width="${logo?940.41+gap:260}" height="${logo?302.41:260}" viewBox="-42 -42 ${logo?940.41+gap:260} ${logo?302.41:260}" role="img" aria-label="Introify">`);
 if(logo){const letterMotion=motion.letteringTranslate?`<animateTransform attributeName="transform" type="translate" values="${motion.letteringTranslate}" keyTimes="${motion.keyTimes}" dur="${motion.duration}s" repeatCount="${motion.loop===false?'1':'indefinite'}" fill="freeze"/>`:'';svg=svg.replace('<g transform="translate(150 0)">',`<g transform="translate(${150+config.gap} 0)">${letterMotion}`);}
 return svg;
}
