'use strict';
const form=document.querySelector('#feedback-form'),statusEl=document.querySelector('#feedback-status'),area=document.querySelector('#feedback-message');
area.addEventListener('input',()=>document.querySelector('#feedback-count').textContent=area.value.length.toLocaleString('pt-BR')+' / 5.000');
form.addEventListener('submit',async e=>{
 e.preventDefault();const b=form.querySelector('button');b.disabled=true;
 try{
  if(!PG.user)await PG.login();else await PG.ready;
  const data=Object.fromEntries(new FormData(form));await PG.api('/feedback',{method:'POST',body:JSON.stringify(data)});
  form.reset();document.querySelector('#feedback-count').textContent='0 / 5.000';statusEl.textContent='Feedback enviado. Obrigado por ajudar o Pandapidio Games!';
 }catch(err){statusEl.textContent=err.message;}finally{b.disabled=false;}
});
