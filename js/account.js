/* Contas e saves do portal: nunca soma recursos nem importa um save em uma conta existente. */
(function(){
'use strict';
const API=window.PG_API||'https://rei-dos-mares-server-production.up.railway.app';
const ROOT=new URL('../',document.currentScript.src).href;
const KEY='pg.account.v1',DIRTY='pg.pending.v1',REQUEST='pg.write.v1';
const avatars={panda:['Panda','assets/logo/favicon.png'],jeff:['Jeff','universes/creepygames/games/ayuwoke/ui/icons/jeff.png'],liu:['Liu','universes/creepygames/games/ayuwoke/ui/icons/liu.png'],ayuwoke:['Ayuwoke','universes/creepygames/games/ayuwoke/ui/icons/ayu.png'],blackbeard:['Barba Negra','games/rei-dos-mares/assets/boss-blackbeard.png'],ghost:['Rei Fantasma','games/rei-dos-mares/assets/boss-ghost-king.png'],marine:['Almirante','games/rei-dos-mares/assets/boss-marine.png']};
const own=k=>/^reiDosMares[A-Za-z0-9]+$/.test(k)||['ayuwoke_best','game_complete'].includes(k);
let session=null,suppress=false,timer=null,inflight=null,stopped=false,ready=false,cloudText='Conectando save…',needsLogin=false;
try{session=JSON.parse(localStorage.getItem(KEY));}catch(_){}
const rawSet=Storage.prototype.setItem,rawRemove=Storage.prototype.removeItem,rawClear=Storage.prototype.clear;
function collect(){const data={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(own(k))data[k]=localStorage.getItem(k);}return data;}
function saveSession(){rawSet.call(localStorage,KEY,JSON.stringify(session));}
function replace(data){
 const old=collect();suppress=true;
 try{for(const k of Object.keys(old))rawRemove.call(localStorage,k);for(const [k,v]of Object.entries(data)){if(!own(k)||typeof v!=='string')throw Error('Save da conta inválido.');rawSet.call(localStorage,k,v);}}
 catch(err){for(const k of Object.keys(collect()))rawRemove.call(localStorage,k);for(const [k,v]of Object.entries(old))rawSet.call(localStorage,k,v);throw err;}
 finally{suppress=false;}
}
function badge(text){cloudText=text;document.querySelectorAll('[data-cloud-status]').forEach(e=>e.textContent=text);}
async function api(path,options={}){
 const res=await fetch(API+'/accounts'+path,{...options,headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{}),...options.headers},signal:AbortSignal.timeout(12000)});
 const data=await res.json();if(!res.ok){const e=Error(data.error||'Não foi possível conectar.');e.status=res.status;throw e;}return data;
}
function changed(){if(suppress||!session||stopped)return;rawSet.call(localStorage,DIRTY,session.user.id);badge('Salvando…');clearTimeout(timer);timer=setTimeout(()=>flush().catch(problem),900);}
Storage.prototype.setItem=function(k,v){rawSet.call(this,k,v);if(this===localStorage&&own(String(k)))changed();};
Storage.prototype.removeItem=function(k){rawRemove.call(this,k);if(this===localStorage&&own(String(k)))changed();};
Storage.prototype.clear=function(){rawClear.call(this);if(this===localStorage&&session){saveSession();changed();}};
async function flush(){
 if(inflight){await inflight;if(localStorage.getItem(DIRTY)&&!stopped)return flush();return;}
 if(!session||stopped||!localStorage.getItem(DIRTY))return;
 let request=JSON.parse(localStorage.getItem(REQUEST)||'null');
 if(!request){request={progress:collect(),revision:session.revision,writeId:crypto.randomUUID()};rawSet.call(localStorage,REQUEST,JSON.stringify(request));}
 const encoded=JSON.stringify(request.progress),token=session.token;
 inflight=(async()=>{
  const result=await api('/progress',{method:'PUT',body:JSON.stringify(request)});
  if(session.token!==token)return;
  session.revision=result.revision;saveSession();rawRemove.call(localStorage,REQUEST);
  if(JSON.stringify(collect())===encoded){rawRemove.call(localStorage,DIRTY);badge('Progresso salvo');}else timer=setTimeout(()=>flush().catch(problem),500);
 })();try{await inflight;}finally{inflight=null;}
}
function problem(err){if(err.status===401){needsLogin=true;document.querySelector('#pg-relogin')?.removeAttribute('hidden');}badge(err.status===401?'Entre novamente para sincronizar':err.status===409?'Conflito de save — reabra o jogo':'Save pendente · reconectar');if(err.status===409){stopped=true;if(document.body.dataset.pgGame)block(err);}else if(document.body.dataset.pgGame&&!ready)block(err);}
function block(err){
 if(document.querySelector('#pg-block'))return;
 const layer=document.createElement('div');layer.id='pg-block';layer.className='pg-block';
 const box=document.createElement('div');box.className='pg-block-card';
 const h=document.createElement('h2');h.textContent='Seu progresso precisa de atenção';
 const p=document.createElement('p');p.textContent=err.message+' O save deste navegador foi preservado.';
 const retry=document.createElement('button');retry.textContent='Tentar novamente';retry.onclick=()=>location.reload();
 const back=document.createElement('a');back.href=ROOT;back.textContent='Voltar ao portal';if(err.status===409){const cloud=document.createElement('button');cloud.textContent='Carregar save da conta';cloud.onclick=()=>{rawSet.call(localStorage,'pg.conflictBackup',JSON.stringify(collect()));rawRemove.call(localStorage,DIRTY);rawRemove.call(localStorage,REQUEST);location.reload();};box.append(cloud);}
 box.append(h,p,retry,back);layer.append(box);document.body.append(layer);
}
async function bootstrap(){
 if(!session){ready=true;return;}
 if(localStorage.getItem(DIRTY)){await flush();if(localStorage.getItem(DIRTY))await flush();}
 const result=await api('/me');
 replace(result.progress);session.user=result.user;session.revision=result.revision;saveSession();rawRemove.call(localStorage,REQUEST);ready=true;badge('Progresso salvo');render();
}
let completeBoot,rejectBoot;
let settled=new Promise((resolve,reject)=>{completeBoot=resolve;rejectBoot=reject;});
async function init(){
 try{
  if(session&&navigator.locks){
   await navigator.locks.request('pg-active-game',{ifAvailable:true},async lock=>{
    if(!lock){if(document.body.dataset.pgGame)throw Error('Já existe um jogo aberto nesta conta. Feche a outra aba e tente novamente.');ready=true;completeBoot();return;}
    await bootstrap();completeBoot();
    if(document.body.dataset.pgGame)await new Promise(()=>{});
   });
  }else{await bootstrap();completeBoot();}
 }catch(e){rejectBoot(e);}
}
init();settled.catch(problem);
async function popup(mode='login'){
 const state=crypto.randomUUID(),u=new URL(API+'/accounts/window/');u.searchParams.set('origin',location.origin);u.searchParams.set('state',state);u.searchParams.set('mode',mode);
 // Open during the click gesture, including browsers that block delayed popups.
 const win=window.open('about:blank','pg-account-'+state,'popup,width=520,height=730');if(!win)throw Error('Permita a janela de conta no navegador e tente novamente.');
 win.document.title='Conectando · Pandapidio Games';win.document.body.textContent='Conectando sua conta…';
 try{
  try{await settled;await flush();}catch(err){if(err.status!==401)throw err;}
  if(stopped)throw Error('Resolva o conflito de save antes de mudar de conta.');
  const service=await api('/status');if(!service.ready)throw Error('As contas estão sendo preparadas. Seus dados continuam salvos neste navegador.');
  win.location.replace(u.href);
 }catch(err){win.close();throw err;}
 return new Promise((resolve,reject)=>{
  const check=setInterval(()=>{if(win.closed){cleanup();reject(Error('Janela de conta fechada.'));}},500);
  function cleanup(){clearInterval(check);removeEventListener('message',receive);}
  async function receive(e){
   if(e.origin!==u.origin||e.source!==win||e.data?.state!==state)return;
   if(e.data.type==='pg-ready')win.postMessage({type:'pg-init',state,progress:collect(),token:mode==='password'?session?.token:null},u.origin);
   if(e.data.type==='pg-password'){cleanup();win.close();resolve();}
   if(e.data.type==='pg-session'){
    cleanup();const result=e.data.data;
    try{replace(result.progress);session={token:result.token,user:result.user,revision:result.revision};saveSession();rawRemove.call(localStorage,DIRTY);rawRemove.call(localStorage,REQUEST);stopped=false;needsLogin=false;ready=true;settled=Promise.resolve();window.PG.ready=settled;badge('Progresso salvo');render();win.close();resolve();}
    catch(err){reject(err);}
   }
  }addEventListener('message',receive);
 });
}
function message(text){const e=document.querySelector('#pg-message');if(e)e.textContent=text;}
function render(){
 const button=document.querySelector('#pg-account-button');if(button){button.replaceChildren();const img=document.createElement('img');img.src=ROOT+avatars[session?.user.avatar||'panda'][1];img.alt='';const span=document.createElement('span');span.textContent=session?session.user.username:'Entrar';button.append(img,span);}
 const guest=document.querySelector('#pg-guest'),profile=document.querySelector('#pg-profile');if(guest)guest.hidden=!!session;if(profile)profile.hidden=!session;
 if(!session)return;
 badge(cloudText);
 if(document.querySelector('#pg-relogin'))document.querySelector('#pg-relogin').hidden=!needsLogin;
 document.querySelectorAll('[data-pg-name]').forEach(e=>e.textContent=session.user.username);
 document.querySelectorAll('[data-pg-date]').forEach(e=>e.textContent='Conta criada em '+new Date(session.user.createdAt).toLocaleDateString('pt-BR'));
 document.querySelectorAll('[data-avatar]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.avatar===session.user.avatar)));
}
function mount(){
 const css=document.createElement('link');css.rel='stylesheet';css.href=ROOT+'css/account.css';document.head.append(css);
 if(document.body.dataset.pgGame){const status=document.createElement('span');status.className='pg-game-status';status.dataset.cloudStatus='';status.textContent=session?cloudText:'Jogando como visitante';document.body.append(status);return;}
 const nav=document.createElement('div');nav.className='pg-account-nav';nav.innerHTML='<button id="pg-account-button" aria-haspopup="dialog">Entrar</button>';
 const dialog=document.createElement('dialog');dialog.id='pg-dialog';dialog.className='pg-dialog';
 dialog.innerHTML='<button class="pg-close" aria-label="Fechar">×</button><span class="pg-kicker">PANDAPIDIO GAMES</span><section id="pg-guest"><h2>Sua próxima aventura<br>começa com um nome.</h2><p>Uma conta para levar seus recordes, conquistas e recursos a qualquer dispositivo.</p><button class="pg-primary" id="pg-login">Entrar ou criar conta ↗</button><p class="pg-note">Conta nova recebe seu progresso atual. Ao entrar em uma conta existente, usamos o progresso dela.</p></section><section id="pg-profile" hidden><h2 data-pg-name></h2><p class="pg-note" data-pg-date></p><p class="pg-save" data-cloud-status>Progresso salvo</p><button id="pg-relogin" class="pg-primary" hidden>Entrar novamente ↗</button><h3>Escolha seu avatar</h3><div class="pg-avatars"></div><div class="pg-profile-actions"><button id="pg-password">Mudar senha ↗</button><button id="pg-logout">Sair da conta</button></div><p class="pg-note">Ao sair, este navegador volta a jogar como visitante com um progresso novo.</p></section><p id="pg-message" role="status" aria-live="polite"></p>';
 document.body.append(nav,dialog);
 dialog.querySelector('.pg-close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 document.querySelector('#pg-account-button').onclick=()=>dialog.showModal();
 document.querySelector('#pg-relogin').onclick=async()=>{try{await popup();document.querySelector('#pg-relogin').hidden=true;message('Conta reconectada.');}catch(e){message(e.message);}};
 document.querySelector('#pg-login').onclick=async()=>{try{await popup();message('Conta conectada. Seu progresso acompanha você.');}catch(e){message(e.message);}};
 document.querySelector('#pg-password').onclick=async()=>{try{await popup('password');message('Senha alterada.');}catch(e){message(e.message);}};
 document.querySelector('#pg-logout').onclick=async()=>{try{await flush();if(stopped)throw Error('Seu save está em conflito. Reabra o portal antes de sair.');await api('/session',{method:'DELETE'});replace({});session=null;rawRemove.call(localStorage,KEY);rawRemove.call(localStorage,DIRTY);rawRemove.call(localStorage,REQUEST);render();message('Você saiu. Seu progresso está guardado na conta.');}catch(e){message(e.message);}};
 for(const [id,[name,path]]of Object.entries(avatars)){
  const b=document.createElement('button');b.dataset.avatar=id;b.title=name;b.setAttribute('aria-label',name);const img=document.createElement('img');img.src=ROOT+path;img.alt='';b.append(img);
  b.onclick=async()=>{try{const result=await api('/profile',{method:'PATCH',body:JSON.stringify({avatar:id})});session.user=result.user;saveSession();render();message('Avatar atualizado.');}catch(e){message(e.message);}};dialog.querySelector('.pg-avatars').append(b);
 }
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
addEventListener('storage',e=>{if(e.key===KEY&&JSON.parse(e.newValue||'null')?.token!==session?.token)location.reload();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush().catch(problem);});
window.PG={ready:settled,api,flush,get user(){return session?.user;},login:popup,collect,replace,root:ROOT,block};
})();
