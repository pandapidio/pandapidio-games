(() => {
'use strict';
const $=id=>document.getElementById(id);
const MP=window.ReiMultiplayerLocal;
if(!window.io||!MP){console.error('[RDM V4] Socket.IO ou camada multiplayer indisponível.');return;}

const isLocal=['localhost','127.0.0.1'].includes(location.hostname);
const SERVER_URL=String(window.RDM_V4_SERVER_URL||(isLocal?'http://localhost:3000':''));
if(!SERVER_URL){console.error('[RDM V4] RDM_V4_SERVER_URL não configurado.');return;}

const socket=io(SERVER_URL,{
  transports:['websocket','polling'],
  upgrade:true,
  tryAllTransports:true,
  reconnection:true,
  reconnectionAttempts:Infinity,
  reconnectionDelay:350,
  reconnectionDelayMax:1600,
  timeout:12000
});

const TOKEN_KEY='rdmOnlineTabTokenV4';
const RESUME_PREFIX='rdmOnlineResumeV4:';
const LATEST_KEY='rdmOnlineResumeLatestV4';
const makeToken=()=>{try{return 'r_'+crypto.randomUUID().replace(/-/g,'');}catch(_){return 'r_'+Date.now().toString(36)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);}};
function tabToken(){let t='';try{t=sessionStorage.getItem(TOKEN_KEY)||'';}catch(_){}
  if(!t){t=makeToken();try{sessionStorage.setItem(TOKEN_KEY,t);}catch(_){}}
  return t;
}
const O={
  room:null,slot:0,playerId:null,resumeToken:tabToken(),started:false,leaving:false,resuming:false,
  inputSeq:0,inputHistory:[],lastInputSentAt:performance.now(),inputTimer:null,resumeTimer:null,watchTimer:null,pingTimer:null,lastSnapshotAt:0,lastSnapshotSeq:0,
  rtt:0,snapshotHz:0,snapshotCount:0,snapshotWindowAt:performance.now(),serverHello:null,runRecorded:false
};
window.RDMOnline={
  socket,state:O,serverUrl:SERVER_URL,authoritative:true,
  sendMilestone:()=>{},
  awardLoot:()=>false,
  awardDiamonds:()=>false,
  debug:()=>({connected:socket.connected,started:O.started,room:O.room?.code,slot:O.slot,rtt:O.rtt,snapshotHz:O.snapshotHz,lastSnapshotAge:performance.now()-O.lastSnapshotAt,server:O.serverHello})
};

function profile(){
  let name='Capitão',portrait='assets/portraits/pirate.svg',title='Capitão',skinId='default';
  try{name=String(chronicle?.data?.name||$('captain-name')?.value||'Capitão').trim().slice(0,18)||'Capitão';}catch(_){}
  try{portrait=typeof avatarSrc==='function'?avatarSrc(chronicle.data.profile.avatar):portrait;}catch(_){}
  try{title=typeof captainTitleInfo==='function'?captainTitleInfo().name:title;}catch(_){}
  try{skinId=(typeof selectedSkin!=='undefined'&&selectedSkin)||'default';}catch(_){}
  return {name,portrait,title,skinId};
}
function setStatus(msg,kind=''){const el=$('online-connect-status');if(!el)return;el.textContent=msg;el.dataset.kind=kind;}
function cleanCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);}
function roomMe(room=O.room){return room?.players?.find(p=>p.playerId===O.playerId)||room?.players?.find(p=>p.socketId===socket.id)||null;}
function roomLeaderIsMe(room=O.room){const me=roomMe(room);return !!me?.isLobbyLeader||!!me?.isHost;}
function roomToConfig(room){return room.players.slice().sort((a,b)=>a.slot-b.slot).map(p=>({name:p.name,skinId:p.skinId,portrait:p.portrait,title:p.title,connected:p.connected!==false}));}
function setRoomIdentity(res){
  if(res?.resumeToken)O.resumeToken=res.resumeToken;
  if(res?.playerId)O.playerId=res.playerId;
  if(Number.isFinite(Number(res?.yourSlot)))O.slot=Number(res.yourSlot);
  try{sessionStorage.setItem(TOKEN_KEY,O.resumeToken);}catch(_){}
}

function resumeKey(token=O.resumeToken){return RESUME_PREFIX+String(token||'');}
function saveResumeCandidate(deadline,extra={}){
  if(!O.room?.code||!O.resumeToken||!deadline)return null;
  const item={code:O.room.code,resumeToken:O.resumeToken,playerId:O.playerId,slot:O.slot,deadline:Number(deadline),savedAt:Date.now(),...extra};
  try{localStorage.setItem(resumeKey(O.resumeToken),JSON.stringify(item));localStorage.setItem(LATEST_KEY,O.resumeToken);sessionStorage.setItem('rdmOnlineOwnResumeV4',O.resumeToken);}catch(_){}
  updateResumeButton();return item;
}
function rememberActive(){
  if(!O.started||!O.room?.code)return;
  saveResumeCandidate(Date.now()+30000,{reason:'active'});
}
function removeResumeCandidate(token=O.resumeToken){
  if(!token)return;try{localStorage.removeItem(resumeKey(token));if(localStorage.getItem(LATEST_KEY)===token)localStorage.removeItem(LATEST_KEY);}catch(_){}
  updateResumeButton();
}
function readResumeCandidate(){
  const now=Date.now();let tokens=[];
  try{tokens=[sessionStorage.getItem('rdmOnlineOwnResumeV4'),O.resumeToken,localStorage.getItem(LATEST_KEY)].filter(Boolean);}catch(_){tokens=[O.resumeToken];}
  for(const token of [...new Set(tokens)]){
    try{
      const raw=localStorage.getItem(resumeKey(token));if(!raw)continue;
      const x=JSON.parse(raw);
      if(x?.code&&x?.resumeToken&&Number(x.deadline)>now)return x;
      if(x?.resumeToken)localStorage.removeItem(resumeKey(x.resumeToken));
    }catch(_){}
  }
  return null;
}
function updateResumeButton(){
  const btn=$('resume-multiplayer-btn'),detail=$('resume-multiplayer-detail');if(!btn)return;
  if(O.started){btn.classList.add('hidden');return;}
  const x=readResumeCandidate();
  if(!x){btn.classList.add('hidden');return;}
  const sec=Math.max(0,Math.ceil((x.deadline-Date.now())/1000));
  if(sec<=0){removeResumeCandidate(x.resumeToken);btn.classList.add('hidden');return;}
  btn.classList.remove('hidden');if(detail)detail.textContent=`SALA ${x.code} • ${sec}s • V4`;
}
setInterval(updateResumeButton,300);

function openOnline(){
  unlockAudio?.();sfx?.('click',.55);
  $('multiplayer-online-screen')?.classList.remove('hidden');
  $('online-home')?.classList.remove('hidden');
  $('online-lobby')?.classList.add('hidden');
  setStatus(socket.connected?'SERVIDOR V4 ONLINE':'CONECTANDO AO SERVIDOR V4...',socket.connected?'ok':'');
}
function closeOnline(){
  if(O.room&&!O.started)socket.emit('room:leave',{permanent:true});
  $('multiplayer-online-screen')?.classList.add('hidden');
  if(!O.started)O.room=null;
}
function renderLobby(room){
  O.room=room;const me=roomMe(room);if(me){O.slot=me.slot;O.playerId=me.playerId||O.playerId;}
  $('online-home')?.classList.add('hidden');$('online-lobby')?.classList.remove('hidden');
  if($('online-room-code'))$('online-room-code').textContent=room.code;
  const list=$('online-player-list'),active=room.players.filter(p=>p.connected!==false&&!p.expired);
  if(list)list.innerHTML=[0,1,2].map(slot=>{
    const p=room.players.find(x=>x.slot===slot&&!x.expired);
    if(!p)return `<article class="online-player empty"><div class="online-slot">${slot+1}</div><div><b>AGUARDANDO...</b><small>Vaga disponível</small></div></article>`;
    const local=p.playerId===O.playerId,state=p.connected===false?'RETORNANDO...':'CONECTADO';
    return `<article class="online-player ${local?'local':''} ${p.connected===false?'offline':''}"><div class="online-slot">${slot+1}</div><img src="${p.portrait}" alt=""><div><b>${p.name}${p.isLobbyLeader||p.isHost?' • LÍDER':''}</b><small>${p.title} • ${String(p.skinId).toUpperCase()}</small></div><span>${local?'VOCÊ':state}</span></article>`;
  }).join('');
  const leader=roomLeaderIsMe(room),start=$('online-start');
  if(start){start.classList.toggle('hidden',!leader);start.disabled=!leader||active.length<2||room.started;}
  if($('online-lobby-message'))$('online-lobby-message').textContent=active.length<2?'Aguardando pelo menos mais um capitão...':leader?'Você é líder apenas do lobby. Ao iniciar, o Railway simula a partida para todos.':'Aguardando o líder da sala iniciar.';
  setStatus(`V4 AUTORITATIVO • SALA ${room.code} • ${active.length}/3`,'ok');
}
function enterRoomResponse(res){
  if(!res?.ok){setStatus(res?.error||'Não foi possível entrar na sala.','error');return;}
  setRoomIdentity(res);removeResumeCandidate(O.resumeToken);renderLobby(res.room);
}

function clearLoops(){
  clearInterval(O.inputTimer);clearInterval(O.resumeTimer);clearInterval(O.watchTimer);clearInterval(O.pingTimer);
  O.inputTimer=O.resumeTimer=O.watchTimer=O.pingTimer=null;
}
function startLoops(){
  clearLoops();O.lastSnapshotAt=performance.now();O.snapshotCount=0;O.snapshotWindowAt=performance.now();
  O.inputTimer=setInterval(()=>{
    if(!O.started||!socket.connected)return;
    const now=performance.now(),dt=Math.max(.005,Math.min(.05,(now-O.lastInputSentAt)/1000));O.lastInputSentAt=now;
    const input=MP.localInput(),seq=++O.inputSeq;
    O.inputHistory.push({seq,input:{...input},dt});if(O.inputHistory.length>120)O.inputHistory.splice(0,O.inputHistory.length-120);
    socket.volatile.emit('game:input',{seq,input,clientTime:now});
  },20);
  O.resumeTimer=setInterval(rememberActive,1800);
  O.watchTimer=setInterval(()=>{
    if(!O.started||!socket.connected)return;
    const age=performance.now()-O.lastSnapshotAt;
    if(age>900)socket.emit('game:resync-request');
    if(age>2200)notifyVoyage?.('SINCRONIZAÇÃO INTERROMPIDA','Sem estado novo do servidor. Tentando ressincronizar...','#e6b77d',2.6);
  },450);
  O.pingTimer=setInterval(()=>{
    if(!socket.connected)return;const t0=performance.now();
    socket.emit('net:ping',{clientTime:t0},()=>{O.rtt=Math.round(performance.now()-t0);updateNetBadge();});
  },1200);
  rememberActive();updateNetBadge();
}
function ensureNetBadge(){
  let el=document.getElementById('rdm-v4-net');
  if(el)return el;
  el=document.createElement('div');el.id='rdm-v4-net';
  el.style.cssText='position:absolute;right:14px;bottom:12px;z-index:80;padding:5px 8px;border:1px solid #7bd8e755;border-radius:999px;background:#03151dcc;color:#bceff6;font:700 8px monospace;letter-spacing:.5px;pointer-events:none';
  document.getElementById('game-wrap')?.appendChild(el);return el;
}
function updateNetBadge(){
  const el=ensureNetBadge();if(!el)return;
  el.textContent=`V4 SERVER • ${socket.connected?'ONLINE':'OFFLINE'} • ${O.rtt||'—'}ms • ${O.snapshotHz||0}Hz`;
  el.style.display=O.started?'block':'none';
}
function startGame(room){
  O.started=true;O.leaving=false;O.room=room;const me=roomMe(room);O.slot=me?.slot??O.slot;O.playerId=me?.playerId||O.playerId;
  O.inputSeq=0;O.inputHistory=[];O.lastInputSentAt=performance.now();O.lastSnapshotSeq=0;
  $('multiplayer-online-screen')?.classList.add('hidden');removeResumeCandidate(O.resumeToken);
  MP.startOnline(roomToConfig(room),{host:false,localSlot:O.slot,localInput:()=>MP.localInput()});
  MP.setOnlineRole?.(false,O.slot);
  startLoops();
  notifyVoyage?.('MULTIPLAYER V4','A partida agora é simulada pelo servidor. Nenhum jogador é o host do gameplay.','#8ee6ee',5);
}
function restoreGame(res,fromMenu=false){
  O.room=res.room;O.started=true;O.leaving=false;O.inputHistory=[];O.lastInputSentAt=performance.now();setRoomIdentity(res);
  $('multiplayer-online-screen')?.classList.add('hidden');
  if(!MP.enabled)MP.startOnline(roomToConfig(res.room),{host:false,localSlot:O.slot,localInput:()=>MP.localInput()});
  MP.setOnlineRole?.(false,O.slot);
  if(res.snapshot)MP.applySnapshot?.(res.snapshot,true);
  MP.forceOnlineUnpause?.();startLoops();syncReplicaUi();
  if(fromMenu)notifyVoyage?.('DE VOLTA AO CONVÉS','Seu capitão voltou ao estado mantido pelo servidor.','#83e0bd',4);
}
function resumeSavedSession(){
  const x=readResumeCandidate();if(!x)return updateResumeButton();
  O.resuming=true;O.resumeToken=x.resumeToken;O.playerId=x.playerId||null;O.slot=Number(x.slot)||0;
  socket.emit('room:resume',{code:x.code,resumeToken:x.resumeToken},res=>{
    O.resuming=false;
    if(!res?.ok){removeResumeCandidate(x.resumeToken);alert(res?.error||'Não foi possível retomar a viagem.');return;}
    restoreGame(res,true);removeResumeCandidate(x.resumeToken);
  });
}
function leaveOnline(allowResume=true){
  if(!O.started||O.leaving)return;
  O.leaving=true;clearLoops();
  if(allowResume){
    saveResumeCandidate(Date.now()+30000,{reason:'menu'});
    socket.emit('room:leave',{permanent:false},res=>{if(res?.reconnectUntil)saveResumeCandidate(res.reconnectUntil,{reason:'menu'});});
  }else{
    removeResumeCandidate(O.resumeToken);socket.emit('room:leave',{permanent:true});
  }
  O.started=false;O.leaving=false;updateNetBadge();
}
try{
  const baseGoMenu=goMenu;
  goMenu=function(){
    const terminal=O.started&&typeof state!=='undefined'&&['gameover','victory'].includes(state);
    if(O.started)leaveOnline(!terminal);
    const r=baseGoMenu();if(terminal)removeResumeCandidate(O.resumeToken);return r;
  };
}catch(_){}

function replayPredictedEntity(base,input,dt){
  const e={...base},a=input||{};let mx=Number(a.mx)||0,my=Number(a.my)||0,l=Math.hypot(mx,my);if(l>1){mx/=l;my/=l;}
  const sp=360*(e.speedMult||1);
  e.vx=(Number(e.vx)||0)+(mx*sp-(Number(e.vx)||0))*Math.min(1,dt*4.2);
  e.vy=(Number(e.vy)||0)+(my*sp-(Number(e.vy)||0))*Math.min(1,dt*4.2);
  e.vx*=Math.pow(.90,dt*60);e.vy*=Math.pow(.90,dt*60);
  e.x=Math.max(55,Math.min(1280-55,(Number(e.x)||0)+e.vx*dt));
  e.y=Math.max(95,Math.min(720-55,(Number(e.y)||0)+e.vy*dt));
  const ax=Number(a.ax)||0,ay=Number(a.ay)||0;if(Math.hypot(ax,ay)>.1)e.cannonAngle=Math.atan2(ay,ax);
  return e;
}
function reconcileSnapshot(snap){
  const me=snap?.players?.find?.(p=>Number(p.id)===Number(O.slot));if(!me?.entity)return snap;
  const ack=Math.max(0,Number(me.lastProcessedInput)||0);
  O.inputHistory=O.inputHistory.filter(x=>x.seq>ack);
  let e={...me.entity};
  for(const pending of O.inputHistory)e=replayPredictedEntity(e,pending.input,pending.dt);
  me.entity={...me.entity,x:e.x,y:e.y,vx:e.vx,vy:e.vy,cannonAngle:e.cannonAngle};
  return snap;
}

function syncReplicaUi(){
  if(!O.started)return;
  MP.forceOnlineShopView?.();
  if(typeof state!=='undefined'&&['transition','play','paused'].includes(state)){
    try{revealHud?.(state==='transition'?Math.max(.01,Math.min(1,((transition||0)-3.25)/.85)):1);}catch(_){}
    document.querySelector('#hud .hud-ribbon')?.classList.add('hidden');
    $('upgrade-strip')?.classList.add('hidden');
    $('mp-hud-ribbon')?.classList.remove('hidden');
  }
  const boss=Array.isArray(enemies)?enemies.find(e=>e?.isBoss&&!e?.destroyed):null;
  if(bossFight&&boss&&!bossFight.defeated&&typeof state!=='undefined'&&['play','paused'].includes(state)){
    bossHpWrap?.classList.remove('hidden');
    if(bossNameEl)bossNameEl.textContent=bossFight?.cfg?.name||'CHEFE';
    if(bossHpFill){const max=Math.max(1,Number(boss.max||boss.maxHp||boss.hp||1)),hp=Math.max(0,Number(boss.hp||0));bossHpFill.style.width=`${Math.max(0,Math.min(100,hp/max*100))}%`;}
  }else bossHpWrap?.classList.add('hidden');
  if(typeof state!=='undefined'&&state==='gameover'){
    $('gameover')?.classList.remove('hidden');MP.renderDefeat?.();
    const revive=$('revive-btn');if(revive){revive.disabled=true;revive.textContent='REVIVER • INDISPONÍVEL NO TESTE V4';}
  }else $('gameover')?.classList.add('hidden');
}

socket.on('server:hello',hello=>{
  O.serverHello=hello;
  if(hello?.protocol!=='rdm-v4'||!hello?.authoritative){
    setStatus('SERVIDOR INCOMPATÍVEL COM O TESTE V4','error');
    console.error('[RDM V4] protocolo inesperado',hello);return;
  }
  setStatus('SERVIDOR V4 ONLINE','ok');
});
socket.on('connect',()=>{
  setStatus('SERVIDOR V4 ONLINE','ok');
  if(O.started&&O.room?.code&&O.resumeToken&&!O.resuming){
    O.resuming=true;
    socket.emit('room:resume',{code:O.room.code,resumeToken:O.resumeToken},res=>{
      O.resuming=false;
      if(res?.ok){restoreGame(res,false);removeResumeCandidate(O.resumeToken);}
      else{O.started=false;clearLoops();saveResumeCandidate(Date.now()+1000);try{goMenu();}catch(_){}}
    });
  }
});
socket.on('disconnect',()=>{
  setStatus('CONEXÃO PERDIDA','error');updateNetBadge();
  if(O.started){clearLoops();saveResumeCandidate(Date.now()+30000,{reason:'disconnect'});notifyVoyage?.('CONEXÃO INTERROMPIDA','Seu capitão continua salvo no servidor por 30 segundos.','#ffb47b',5);}
});
socket.on('connect_error',err=>setStatus(`ERRO: ${err.message}`,'error'));
socket.on('room:state',room=>{
  if(!O.started){if(O.room?.code===room.code||($('multiplayer-online-screen')&&!$('multiplayer-online-screen').classList.contains('hidden')))renderLobby(room);return;}
  O.room=room;const me=roomMe(room);if(me){O.slot=me.slot;O.playerId=me.playerId||O.playerId;}
});
socket.on('game:start',startGame);
socket.on('game:snapshot',snap=>{
  if(!O.started||!snap?.authoritativeV4)return;
  const seq=Number(snap.seq)||0;if(seq&&seq<=O.lastSnapshotSeq)return;O.lastSnapshotSeq=seq||O.lastSnapshotSeq;
  O.lastSnapshotAt=performance.now();O.snapshotCount++;
  const now=performance.now(),span=now-O.snapshotWindowAt;if(span>=1000){O.snapshotHz=Math.round(O.snapshotCount*1000/span);O.snapshotCount=0;O.snapshotWindowAt=now;updateNetBadge();}
  reconcileSnapshot(snap);
  if(MP.applySnapshot?.(snap)){syncReplicaUi();}
});
socket.on('game:pause-state',({paused,by})=>{if(!O.started)return;MP.setOnlinePaused?.(!!paused,Number(by)||0);});
socket.on('game:player-left',({slot,name,reconnectUntil})=>{
  if(!O.started)return;MP.handlePlayerLeft?.(slot,true);
  notifyVoyage?.('CAPITÃO DESCONECTADO',`${name||'Um capitão'} pode retornar por mais ${Math.max(1,Math.ceil((Number(reconnectUntil)-Date.now())/1000))||30}s. O servidor continua a partida normalmente.`,'#e4b48f',4.5);
});
socket.on('game:player-expired',({slot,name})=>{if(O.started){MP.handlePlayerLeft?.(slot,false);notifyVoyage?.('CAPITÃO DEIXOU A VIAGEM',`${name||'Um capitão'} não retornou a tempo.`,'#d58b7d',4);}});
socket.on('game:player-rejoined',({slot,name})=>{if(O.started){MP.restorePlayerFromNet?.(slot,null);notifyVoyage?.('CAPITÃO RETORNOU',`${name||'Um capitão'} voltou à viagem.`,'#83e0bd',3.5);}});

$('multiplayer-btn')?.addEventListener('click',openOnline);
$('resume-multiplayer-btn')?.addEventListener('click',resumeSavedSession);
$('online-close')?.addEventListener('click',closeOnline);
$('online-create')?.addEventListener('click',()=>{
  if(!socket.connected)return setStatus('Servidor V4 ainda desconectado.','error');
  setStatus('CRIANDO SALA V4...');socket.emit('room:create',{profile:profile(),resumeToken:O.resumeToken},enterRoomResponse);
});
$('online-join')?.addEventListener('click',()=>{
  const code=cleanCode($('online-code')?.value);if($('online-code'))$('online-code').value=code;
  if(code.length!==6)return setStatus('Digite um código de 6 caracteres.','error');
  setStatus('ENTRANDO NA SALA V4...');socket.emit('room:join',{code,profile:profile(),resumeToken:O.resumeToken},enterRoomResponse);
});
$('online-code')?.addEventListener('input',e=>e.target.value=cleanCode(e.target.value));
$('online-code')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('online-join')?.click();});
$('online-start')?.addEventListener('click',()=>socket.emit('room:start',{},res=>{if(!res?.ok)setStatus(res?.error||'Não foi possível iniciar.','error');}));
$('online-leave')?.addEventListener('click',()=>socket.emit('room:leave',{permanent:true},()=>{O.room=null;$('online-lobby')?.classList.add('hidden');$('online-home')?.classList.remove('hidden');setStatus('SERVIDOR V4 ONLINE','ok');}));
$('online-copy-code')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(O.room?.code||'');$('online-copy-code').textContent='COPIADO!';setTimeout(()=>$('online-copy-code').textContent='COPIAR CÓDIGO',1000);}catch(_){}});

window.addEventListener('keydown',e=>{
  if(!O.started||e.key!=='Escape'||e.repeat)return;
  if(typeof state==='undefined'||!['play','paused'].includes(state))return;
  e.preventDefault();e.stopImmediatePropagation();
  socket.emit('game:pause-request',{paused:state!=='paused'});
},true);
$('resume-btn')?.addEventListener('click',e=>{
  if(!O.started||typeof state==='undefined'||state!=='paused')return;
  e.preventDefault();e.stopImmediatePropagation();socket.emit('game:pause-request',{paused:false});
},true);

updateResumeButton();updateNetBadge();
})();
