(function(){
'use strict';
const $=id=>document.getElementById(id);
let offset=0,trash=false,total=0,selected=null,request=0,checking=false;
const date=value=>new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
function status(text){$('admin-status').textContent=text;}
function fail(e){status(e.message);if(e.status===401||e.status===403){request++;$('admin-inbox').hidden=true;$('admin-gate').hidden=false;$('gate-text').textContent=e.message;$('admin-login').hidden=e.status!==401;$('delete-dialog').close();dispatchEvent(new Event('pg-admin-denied'));$('feedback-list').replaceChildren();clearDetail();}}
function clearDetail(){selected=null;$('detail-content').hidden=true;$('detail-placeholder').hidden=false;$('detail-placeholder').textContent='Escolha um feedback para ler.';}
async function openItem(id){
 const version=++request;clearDetail();$('detail-placeholder').textContent='Carregando mensagem…';
 try{const {item}=await PG.api('/admin/feedback/'+id);if(version!==request)return;selected=item;$('detail-meta').textContent=item.username+' · '+date(item.created_at);$('detail-subject').textContent=item.subject;$('detail-message').textContent=item.message;$('detail-content').hidden=false;$('detail-placeholder').hidden=true;$('feedback-delete').hidden=!!item.deleted_at;$('feedback-restore').hidden=!item.deleted_at;document.querySelectorAll('.feedback-row').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));}
 catch(e){if(version===request){$('detail-placeholder').textContent='Não foi possível carregar a mensagem.';fail(e);}}
}
async function load(){
 const version=++request;clearDetail();status('');$('list-state').textContent='Carregando feedbacks…';$('feedback-list').replaceChildren();$('page-prev').disabled=true;$('page-next').disabled=true;
 try{const result=await PG.api('/admin/feedback?offset='+offset+'&trash='+(trash?'1':'0'));if(version!==request)return;
  if(offset>=result.total&&offset>0){offset=Math.max(0,Math.ceil(result.total/result.limit-1)*result.limit);return load();}
  total=result.total;$('feedback-total').textContent=String(total);$('list-heading').textContent=trash?'Lixeira':'Recebidos';$('list-state').textContent=result.items.length?'':trash?'A lixeira está vazia.':'Nenhum feedback por enquanto.';
  for(const item of result.items){const b=document.createElement('button');b.className='feedback-row';b.dataset.id=item.id;b.setAttribute('aria-pressed','false');const title=document.createElement('strong'),meta=document.createElement('span');title.textContent=item.subject;meta.textContent=item.username+' · '+date(item.created_at);b.append(title,meta);b.onclick=()=>openItem(item.id);$('feedback-list').append(b);}
  $('page-label').textContent=total?(offset+1)+'–'+Math.min(offset+result.limit,total)+' de '+total:'0 mensagens';$('page-prev').disabled=offset===0;$('page-next').disabled=offset+result.limit>=total;
 }catch(e){if(version===request){$('list-state').textContent='Não foi possível carregar. Use Atualizar para tentar novamente.';fail(e);}}
}
async function check(){
 if(checking)return;checking=true;
 try{await PG.ready;if(!PG.user){$('admin-gate').hidden=false;$('admin-inbox').hidden=true;$('gate-text').textContent='Entre na sua conta de administrador para ler os feedbacks.';$('admin-login').hidden=false;return;}
  await PG.api('/admin/feedback?offset=0');$('admin-gate').hidden=true;$('admin-inbox').hidden=false;$('admin-login').hidden=true;$('admin-retry').hidden=true;dispatchEvent(new Event('pg-admin-ready'));await load();
 }catch(e){fail(e);$('admin-retry').hidden=false;}finally{checking=false;}
}
$('admin-login').onclick=async()=>{try{await PG.login();await check();}catch(e){status(e.message);}};
$('admin-retry').onclick=()=>location.reload();$('admin-refresh').onclick=load;
for(const [id,value] of [['tab-inbox',false],['tab-trash',true]])$(id).onclick=()=>{trash=value;offset=0;$('tab-inbox').setAttribute('aria-pressed',String(!trash));$('tab-trash').setAttribute('aria-pressed',String(trash));load();};
$('page-prev').onclick=()=>{offset=Math.max(0,offset-30);load();};$('page-next').onclick=()=>{offset+=30;load();};
$('feedback-delete').onclick=()=>{if(!selected)return;$('delete-subject').textContent=selected.subject;$('delete-dialog').showModal();};$('delete-cancel').onclick=()=>$('delete-dialog').close();
$('delete-confirm').onclick=async()=>{if(!selected)return;const id=selected.id;$('delete-confirm').disabled=true;try{await PG.api('/admin/feedback/'+id,{method:'DELETE'});$('delete-dialog').close();await load();status('Feedback movido para a lixeira.');}catch(e){fail(e);}finally{$('delete-confirm').disabled=false;}};
$('feedback-restore').onclick=async()=>{if(!selected)return;const id=selected.id;$('feedback-restore').disabled=true;try{await PG.api('/admin/feedback/'+id+'/restore',{method:'POST'});await load();status('Feedback restaurado para Recebidos.');}catch(e){fail(e);}finally{$('feedback-restore').disabled=false;}};
addEventListener('pg-account-change',()=>{request++;clearDetail();$('feedback-list').replaceChildren();$('delete-dialog').close();check();});check();
})();
