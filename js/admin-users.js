(function(){
'use strict';
const $=id=>document.getElementById(id);
const avatars={panda:'assets/logo/favicon.png',jeff:'universes/creepygames/games/ayuwoke/ui/icons/jeff.png',liu:'universes/creepygames/games/ayuwoke/ui/icons/liu.png',ayuwoke:'universes/creepygames/games/ayuwoke/ui/icons/ayu.png',blackbeard:'games/rei-dos-mares/assets/boss-blackbeard.png',ghost:'games/rei-dos-mares/assets/boss-ghost-king.png',marine:'games/rei-dos-mares/assets/boss-marine.png'};
const actions={ban:['Banir conta','A conta será desconectada e não poderá entrar nem enviar feedbacks. O progresso fica preservado; você pode desbanir depois.'],unban:['Desbanir conta','A pessoa poderá entrar novamente com sua senha e acessar seu progresso.'],'grant-admin':['Dar acesso de administrador','Esta conta poderá ler e excluir feedbacks, ver todos os usuários, banir contas e administrar permissões.'],'revoke-admin':['Retirar acesso de administrador','A conta continuará funcionando como usuário comum e perderá o acesso ao painel.']};
let offset=0,version=0,pending=null,busy=false;
function denied(){version++;$('admin-inbox').hidden=true;$('admin-gate').hidden=false;$('gate-text').textContent='Entre com uma conta de administrador para acessar o painel.';$('users-list').replaceChildren();$('user-dialog').close();pending=null;}
function error(e){$('admin-status').textContent=e.message;if(e.status===401||e.status===403){denied();$('gate-text').textContent=e.message;$('admin-login').hidden=e.status!==401;}}
function ask(user,action){pending={id:user.id,action};$('user-action-title').textContent=actions[action][0];$('user-action-name').textContent=user.username;$('user-action-description').textContent=actions[action][1];$('user-action-confirm').textContent=actions[action][0];$('user-dialog').showModal();}
async function load(){
 const current=++version;$('users-list').replaceChildren();$('users-state').textContent='Carregando contas…';$('users-prev').disabled=true;$('users-next').disabled=true;
 try{const r=await PG.api('/admin/users?offset='+offset);if(current!==version)return;
  if(offset>=r.total&&offset>0){offset=Math.max(0,Math.ceil(r.total/r.limit-1)*r.limit);return load();}
  $('users-state').textContent=r.total===0?'Nenhuma conta criada.':r.total+' conta'+(r.total===1?'':'s')+' no site';
  for(const user of r.items){const row=document.createElement('article');row.className='user-row';const img=document.createElement('img');img.src=PG.root+(avatars[user.avatar]||avatars.panda);img.alt='Avatar de '+user.username;img.width=52;img.height=52;
   const info=document.createElement('div');info.className='user-info';const name=document.createElement('strong');name.textContent=user.username+(user.id===PG.user.id?' (você)':'');const created=document.createElement('span');created.textContent='Criada em '+new Date(user.createdAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});const badge=document.createElement('span');badge.className='user-badge';badge.textContent=user.bannedAt?'Banida':user.isAdmin?'Administrador':'Usuário';info.append(name,created,badge);
   const buttons=document.createElement('div');buttons.className='user-actions';for(const action of [user.bannedAt?'unban':'ban',user.isAdmin?'revoke-admin':'grant-admin']){const b=document.createElement('button');b.textContent=actions[action][0];b.disabled=user.id===PG.user.id||(action==='ban'&&user.isAdmin)||(action==='grant-admin'&&!!user.bannedAt);if(user.id===PG.user.id)b.title='Sua própria conta está protegida.';else if(action==='ban'&&user.isAdmin)b.title='Retire o acesso de administrador antes de banir.';else if(action==='grant-admin'&&user.bannedAt)b.title='Desbana a conta primeiro.';if(action==='ban')b.className='admin-danger';b.onclick=()=>ask(user,action);buttons.append(b);}row.append(img,info,buttons);$('users-list').append(row);
  }
  $('users-page').textContent=r.total?(offset+1)+'–'+Math.min(offset+r.limit,r.total)+' de '+r.total:'0 contas';$('users-prev').disabled=offset===0;$('users-next').disabled=offset+r.limit>=r.total;
 }catch(e){if(current===version){$('users-state').textContent='Não foi possível carregar as contas. Use Atualizar.';error(e);}}
}
function section(users){$('section-feedback').setAttribute('aria-pressed',String(!users));$('section-users').setAttribute('aria-pressed',String(users));$('feedback-section').hidden=users;$('users-section').hidden=!users;$('admin-status').textContent='';if(users)load();}
$('section-feedback').onclick=()=>section(false);$('section-users').onclick=()=>section(true);$('users-refresh').onclick=load;
$('users-prev').onclick=()=>{offset=Math.max(0,offset-30);load();};$('users-next').onclick=()=>{offset+=30;load();};
$('user-action-cancel').onclick=()=>{if(!busy){pending=null;$('user-dialog').close();}};
$('user-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();else pending=null;});
$('user-action-confirm').onclick=async()=>{if(!pending||busy)return;const action=pending;busy=true;$('user-action-confirm').disabled=true;$('user-action-cancel').disabled=true;
 try{await PG.api('/admin/users/'+action.id,{method:'PATCH',body:JSON.stringify({action:action.action})});pending=null;$('user-dialog').close();await load();$('admin-status').textContent='Conta atualizada.';}catch(e){error(e);}finally{busy=false;$('user-action-confirm').disabled=false;$('user-action-cancel').disabled=false;}};
addEventListener('pg-admin-denied',denied);addEventListener('pg-account-change',denied);addEventListener('pg-admin-ready',()=>{if(!$('users-section').hidden)load();});
})();
