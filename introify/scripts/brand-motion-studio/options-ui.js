export async function refreshOptions(){
 try{const r=await fetch('/api/options');if(!r.ok)return;const data=await r.json();const top=document.getElementById('finalize'),take=document.getElementById('save-take');if(top)top.textContent=`Save Option ${data.nextNumber}`;if(take)take.textContent=`Save take as Option ${data.nextNumber}`;}
 catch{}
}
export function showSavedOption(option,url){
 let link=document.getElementById('latest-option');
 if(!link){link=document.createElement('a');link.id='latest-option';link.className='saved-option-link';document.getElementById('status').after(link);}
 link.textContent=`Open Option ${option} ↗`;link.href=url;
 refreshOptions();
}
