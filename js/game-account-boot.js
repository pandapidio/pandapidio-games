(async()=>{
 const scripts=[...document.querySelectorAll('script[type="application/pg-game"]')];
 async function start(){
  await PG.ready;
  for(const original of scripts){await new Promise((resolve,reject)=>{const s=document.createElement('script');if(original.hasAttribute('src')){s.src=original.getAttribute('src');s.onload=resolve;s.onerror=()=>reject(Error('Falha ao carregar o jogo.'));}else{s.textContent=original.textContent;}document.body.append(s);if(!original.hasAttribute('src'))resolve();});}
 }
 try{await start();}catch(e){PG.block(e);}
})();
