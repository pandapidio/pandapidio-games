(() => {
'use strict';
const $=id=>document.getElementById(id);
const MP=window.ReiMultiplayerLocal;
if(!window.io||!MP){console.error('[ONLINE] Socket.IO ou multiplayer local indisponível.');return;}

const SERVER_URL=String(window.RDM_SERVER_URL||location.origin);
const socket=io(SERVER_URL,{transports:['polling','websocket'],upgrade:true,tryAllTransports:true,reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:450,reconnectionDelayMax:1800,timeout:12000});
const TOKEN_KEY='rdmOnlineTabTokenV3';
const RESUME_PREFIX='rdmOnlineResumeV3:';
const LATEST_KEY='rdmOnlineResumeLatestV3';
const makeToken=()=>{try{return 'r_'+crypto.randomUUID().replace(/-/g,'');}catch(_){return 'r_'+Date.now().toString(36)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);}};
function tabToken(){let t='';try{t=sessionStorage.getItem(TOKEN_KEY)||'';}catch(_){ }if(!t){t=makeToken();try{sessionStorage.setItem(TOKEN_KEY,t);}catch(_){ }}return t;}

const O={
  room:null,slot:0,playerId:null,resumeToken:tabToken(),host:false,started:false,lastSnapshot:0,inputSeq:0,lastInput:'',
  snapshotTimer:null,inputTimer:null,progressTimer:null,resumeHeartbeat:null,resumeUiTimer:null,networkWatchTimer:null,leaving:false,resuming:false,
  fullSnapshotAt:0,snapshotSeq:0,lastSnapshotSeq:0,snapshotHostPlayerId:null,netWarned:false,pendingActions:new Map(),pendingWipeDiamond:false,
  observed:{donated:0,revivesGiven:0,revived:0,kills:0},waveDamageBase:0,runRecorded:false
};
window.RDMOnline={socket,state:O,serverUrl:SERVER_URL,sendMilestone:(type,data={})=>{if(O.started&&O.host&&socket.connected)socket.emit('game:milestone',{type,data});}};

function profile(){
  let name='Capitão',portrait='assets/portraits/pirate.svg',title='Capitão',skinId='default';
  try{name=String(chronicle?.data?.name||$('captain-name')?.value||'Capitão').trim().slice(0,18)||'Capitão';}catch(_){name=String($('captain-name')?.value||'Capitão').trim().slice(0,18)||'Capitão';}
  try{portrait=typeof avatarSrc==='function'?avatarSrc(chronicle.data.profile.avatar):portrait;}catch(_){ }
  try{title=typeof captainTitleInfo==='function'?captainTitleInfo().name:title;}catch(_){ }
  try{skinId=(typeof selectedSkin!=='undefined'&&selectedSkin)||'default';}catch(_){ }
  return {name,portrait,title,skinId};
}
function setStatus(msg,kind=''){const el=$('online-connect-status');if(!el)return;el.textContent=msg;el.dataset.kind=kind;}
function applyLocalLootAward({gold=0,diamonds:amount=0,reason='chest'}={}){
  gold=Math.max(0,Math.floor(Number(gold)||0));amount=Math.max(0,Math.floor(Number(amount)||0));
  if(amount){diamonds+=amount;saveMeta?.();updateDiamondUI?.();}
  if(typeof voyage!=='undefined'){voyage.runGold=(voyage.runGold||0)+gold;voyage.runDiamonds=(voyage.runDiamonds||0)+amount;}
  const p=localPlayer();if(p?.stats){p.stats.goldCollected=(p.stats.goldCollected||0)+gold;p.stats.diamondsCollected=(p.stats.diamondsCollected||0)+amount;}
  try{if(gold)window.ReiChronicle?.addStat?.('gold',gold);if(amount)window.ReiChronicle?.addStat?.('diamonds',amount);if(reason==='chest')window.ReiChronicle?.addStat?.('chests',1);window.ReiChronicle?.persist?.();}catch(_){ }
  if(amount)notifyVoyage?.('DIAMANTES RECEBIDOS',`+${amount} ◆ do seu baú`,'#8fe8ff',2.7);
  return {gold,diamonds:amount};
}
function awardLootToSlot(slot,{gold=0,diamonds=0,reason='chest'}={}){
  gold=Math.max(0,Math.floor(Number(gold)||0));diamonds=Math.max(0,Math.floor(Number(diamonds)||0));
  if(!O.started||!O.host||!socket.connected||(!gold&&!diamonds))return false;
  if(Number(slot)===Number(O.slot)){applyLocalLootAward({gold,diamonds,reason});return true;}
  socket.emit('game:meta-award',{slot:Number(slot),gold,diamonds,reason});return true;
}
Object.assign(window.RDMOnline,{awardLoot:awardLootToSlot,awardDiamonds:(slot,diamonds,reason='chest')=>awardLootToSlot(slot,{diamonds,reason})});
function cleanCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);}
function clearNetLoops(){clearInterval(O.inputTimer);clearInterval(O.snapshotTimer);clearInterval(O.progressTimer);clearInterval(O.resumeHeartbeat);clearInterval(O.networkWatchTimer);O.inputTimer=O.snapshotTimer=O.progressTimer=O.resumeHeartbeat=O.networkWatchTimer=null;}
function localPlayer(){return MP.playerById?.(O.slot)||null;}
function roomHostIsMe(room=O.room){return !!room&&room.hostPlayerId?room.hostPlayerId===O.playerId:room?.hostId===socket.id;}
function roomMe(room=O.room){return room?.players?.find(p=>p.playerId===O.playerId)||room?.players?.find(p=>p.socketId===socket.id)||null;}
function setRoomIdentity(res){
  if(res?.resumeToken)O.resumeToken=res.resumeToken;
  if(res?.playerId)O.playerId=res.playerId;
  if(Number.isFinite(Number(res?.yourSlot)))O.slot=Number(res.yourSlot);
  try{sessionStorage.setItem(TOKEN_KEY,O.resumeToken);}catch(_){ }
}

/* ---------- retorno por 30 s ---------- */
function resumeKey(token=O.resumeToken){return RESUME_PREFIX+String(token||'');}
function saveResumeCandidate(deadline,extra={}){
  if(!O.room?.code||!O.resumeToken||!deadline)return null;
  const item={code:O.room.code,resumeToken:O.resumeToken,playerId:O.playerId,slot:O.slot,deadline:Number(deadline),savedAt:Date.now(),...extra};
  try{localStorage.setItem(resumeKey(O.resumeToken),JSON.stringify(item));localStorage.setItem(LATEST_KEY,O.resumeToken);sessionStorage.setItem('rdmOnlineOwnResume',O.resumeToken);}catch(_){ }
  updateResumeButton();return item;
}
function rememberActiveSession(){
  if(!O.started||!O.room?.code||!O.resumeToken)return;
  const item={code:O.room.code,resumeToken:O.resumeToken,playerId:O.playerId,slot:O.slot,deadline:Date.now()+30000,savedAt:Date.now(),reason:'active'};
  try{localStorage.setItem(resumeKey(O.resumeToken),JSON.stringify(item));localStorage.setItem(LATEST_KEY,O.resumeToken);sessionStorage.setItem('rdmOnlineOwnResume',O.resumeToken);}catch(_){ }
}
function removeResumeCandidate(token=O.resumeToken){
  if(!token)return;try{localStorage.removeItem(resumeKey(token));const latest=localStorage.getItem(LATEST_KEY);if(latest===token)localStorage.removeItem(LATEST_KEY);}catch(_){ }updateResumeButton();
}
function readResumeCandidate(){
  const now=Date.now();let tokens=[];
  try{tokens=[sessionStorage.getItem('rdmOnlineOwnResume'),O.resumeToken,localStorage.getItem(LATEST_KEY)].filter(Boolean);}catch(_){tokens=[O.resumeToken].filter(Boolean);}
  for(const token of [...new Set(tokens)]){
    try{const raw=localStorage.getItem(resumeKey(token));if(!raw)continue;const x=JSON.parse(raw);if(x&&x.code&&x.resumeToken&&Number(x.deadline)>now)return x;if(x?.resumeToken)localStorage.removeItem(resumeKey(x.resumeToken));}catch(_){ }
  }
  return null;
}
function updateResumeButton(){
  const btn=$('resume-multiplayer-btn'),detail=$('resume-multiplayer-detail');if(!btn)return;if(O.started){btn.classList.add('hidden');return;}
  const x=readResumeCandidate();
  if(!x){btn.classList.add('hidden');clearInterval(O.resumeUiTimer);O.resumeUiTimer=null;return;}
  const left=Math.max(0,Math.ceil((x.deadline-Date.now())/1000));
  if(left<=0){removeResumeCandidate(x.resumeToken);btn.classList.add('hidden');return;}
  btn.classList.remove('hidden');if(detail)detail.textContent=`SALA ${x.code} • ${left}s`;
  if(!O.resumeUiTimer)O.resumeUiTimer=setInterval(()=>{const cur=readResumeCandidate();if(!cur){btn.classList.add('hidden');clearInterval(O.resumeUiTimer);O.resumeUiTimer=null;return;}const sec=Math.max(0,Math.ceil((cur.deadline-Date.now())/1000));if(detail)detail.textContent=`SALA ${cur.code} • ${sec}s`;if(sec<=0)removeResumeCandidate(cur.resumeToken);},250);
}
function setMenuVisible(){try{$('menu')?.classList.remove('hidden');}catch(_){ }}
function resumeSavedSession(){
  const x=readResumeCandidate();if(!x)return updateResumeButton();
  if(!socket.connected){setStatus('CONECTANDO AO SERVIDOR...');socket.connect();}
  O.resuming=true;O.resumeToken=x.resumeToken;O.playerId=x.playerId||null;O.slot=Number(x.slot)||0;
  socket.emit('room:resume',{code:x.code,resumeToken:x.resumeToken},res=>{
    O.resuming=false;
    if(!res?.ok){removeResumeCandidate(x.resumeToken);alert(res?.error||'Não foi possível retomar a viagem.');return;}
    setRoomIdentity(res);restoreOnlineGame(res,true);removeResumeCandidate(x.resumeToken);
  });
}

/* ---------- lobby ---------- */
function openOnline(){
  unlockAudio?.();sfx?.('click',.55);
  $('multiplayer-online-screen').classList.remove('hidden');$('online-home').classList.remove('hidden');$('online-lobby').classList.add('hidden');
  setStatus(socket.connected?'SERVIDOR ONLINE':'CONECTANDO AO SERVIDOR...',socket.connected?'ok':'');
}
function closeOnline(){
  if(O.room&&!O.started)socket.emit('room:leave');
  $('multiplayer-online-screen').classList.add('hidden');
  if(!O.started){O.room=null;O.host=false;O.leaving=false;}
}
function roomToConfig(room){
  return room.players.slice().sort((a,b)=>a.slot-b.slot).map(p=>({name:p.name,skinId:p.skinId,portrait:p.portrait,title:p.title,connected:p.connected!==false}));
}
function renderLobby(room){
  O.room=room;O.host=roomHostIsMe(room);const me=roomMe(room);if(me){O.slot=me.slot;O.playerId=me.playerId||O.playerId;}
  $('online-home').classList.add('hidden');$('online-lobby').classList.remove('hidden');$('online-room-code').textContent=room.code;
  const list=$('online-player-list');const connected=room.players.filter(p=>p.connected!==false&&!p.expired);
  list.innerHTML=[0,1,2].map(slot=>{
    const p=room.players.find(x=>x.slot===slot&&!x.expired);
    if(!p)return `<article class="online-player empty"><div class="online-slot">${slot+1}</div><div><b>AGUARDANDO...</b><small>Vaga disponível</small></div></article>`;
    const local=p.playerId===O.playerId;const state=p.connected===false?'RETORNANDO...':'CONECTADO';
    return `<article class="online-player ${local?'local':''} ${p.connected===false?'offline':''}"><div class="online-slot">${slot+1}</div><img src="${p.portrait}" alt=""><div><b>${p.name}${p.isHost?' • HOST':''}</b><small>${p.title} • ${String(p.skinId).toUpperCase()}</small></div><span>${local?'VOCÊ':state}</span></article>`;
  }).join('');
  const start=$('online-start');start.classList.toggle('hidden',!O.host);start.disabled=!O.host||connected.length<2||room.started;
  $('online-lobby-message').textContent=connected.length<2?'Aguardando pelo menos mais um capitão...':O.host?'Tripulação pronta. Você decide quando zarpar.':'Aguardando o host iniciar a viagem.';
  setStatus(`SALA ${room.code} • ${connected.length}/3 JOGADORES`,'ok');
}
function enterRoomResponse(res){
  if(!res?.ok){setStatus(res?.error||'Não foi possível entrar na sala.','error');return;}
  setRoomIdentity(res);removeResumeCandidate(O.resumeToken);renderLobby(res.room);
}

/* ---------- progresso / conquistas coop ---------- */
function chronData(){try{return window.ReiChronicle?.data?.()||null;}catch(_){return null;}}
function addChron(key,n=1){if(n<=0)return;try{window.ReiChronicle?.addStat?.(key,n);window.ReiChronicle?.checkAchievements?.();window.ReiChronicle?.persist?.();}catch(_){ }}
function raiseChron(key,target){const d=chronData();const cur=Number(d?.stats?.[key]||0);if(target>cur)addChron(key,target-cur);}
function markOnce(key){const d=chronData();if(Number(d?.stats?.[key]||0)<1)addChron(key,1);}
function resetObserved(){const p=localPlayer();O.observed={donated:Number(p?.stats?.donated||0),revivesGiven:Number(p?.stats?.revivesGiven||0),revived:Number(p?.stats?.revived||0),kills:Number(p?.stats?.kills||0)};O.waveDamageBase=Number(p?.stats?.damageTaken||0);}
function syncCoopProgress(){
  if(!O.started)return;const p=localPlayer();if(!p)return;
  const cur={donated:Number(p.stats?.donated||0),revivesGiven:Number(p.stats?.revivesGiven||0),revived:Number(p.stats?.revived||0),kills:Number(p.stats?.kills||0)};
  if(cur.donated>O.observed.donated)addChron('coopDonated',cur.donated-O.observed.donated);
  if(cur.revivesGiven>O.observed.revivesGiven)addChron('coopRevives',cur.revivesGiven-O.observed.revivesGiven);
  if(cur.revived>O.observed.revived)addChron('coopRevived',cur.revived-O.observed.revived);
  if(cur.kills>O.observed.kills)addChron('kills',cur.kills-O.observed.kills);
  O.observed=cur;
  try{raiseChron('coopBestWave',Number(wave||0));}catch(_){ }
}
function onWaveMilestone(data={}){
  if(!O.started)return;syncCoopProgress();
  const connected=(data.connectedSlots||[]).map(Number),alive=(data.aliveSlots||[]).map(Number),paths=data.paths||[],events=data.events||[];
  const w=Number(data.wave)||0;
  raiseChron('coopBestWave',w);
  if(w>=15&&connected.length>=3&&alive.length>=3)markOnce('coopAllAboard');
  if(w>=25&&['marine','pirate','undead'].every(x=>paths.includes(x)))markOnce('coopThreeFlags');
  if(alive.length===1&&alive[0]===O.slot)markOnce('coopLastStand');
  if(w===50&&connected.length>=3)markOnce('coopCrown');
  // Convidados também registram eventos concluídos. O host já os registra em chronicle.js.
  if(!O.host){
    if(events.length){
      for(const ev of events){addChron('events',1);if(ev==='fog')addChron('fogClears',1);if(ev==='dead')addChron('deadClears',1);if(ev==='storm')addChron('stormClears',1);if(ev==='armada')addChron('armadaClears',1);if(ev==='treasure')addChron('treasureClears',1);if(ev==='hunt')addChron('huntClears',1);}
      if(events.length>=2)addChron('combinedClears',1);
      const nowD=Number(localPlayer()?.stats?.damageTaken||0);if(nowD<=O.waveDamageBase)addChron('eventFlawless',1);
    }
    const mine=localPlayer()?.build?.path;
    if(w>=25&&mine==='marine')markOnce('marineBuild25');
    if(w>=25&&mine==='pirate')markOnce('pirateBuild25');
    if(w>=25&&mine==='undead')markOnce('undeadBuild25');
    // Chefes e skins secretas pertencem a todos os participantes da vitória, não apenas ao navegador host.
    if(w===15){addChron('bosses',1);addChron('marine',1);try{unlockSecretSkin('secret-marine');}catch(_){ }}
    if(w===25){addChron('bosses',1);addChron('blackbeard',1);try{unlockSecretSkin('secret-blackbeard');}catch(_){ }}
    if(w===50){addChron('bosses',1);addChron('ghostKing',1);try{unlockSecretSkin('secret-pearl');}catch(_){ }}
    if(w>50&&w>=60&&w%10===0){addChron('bosses',1);addChron('admirals',1);try{diamonds+=2;voyage.runDiamonds=(voyage.runDiamonds||0)+2;const lp=localPlayer();if(lp?.stats)lp.stats.diamondsCollected=(lp.stats.diamondsCollected||0)+2;saveMeta?.();updateDiamondUI?.();}catch(_){ }}
  }
  O.waveDamageBase=Number(localPlayer()?.stats?.damageTaken||0);syncCoopProgress();
}

/* ---------- rede de jogo ---------- */
function emitHostSnapshot(full=false){
  if(!O.host||!O.started||!socket.connected)return false;
  const snap=MP.makeSnapshot({lite:!full});if(!snap)return false;
  const seq=++O.snapshotSeq;snap._net={seq,full:!!full,sentAt:Date.now(),hostPlayerId:O.playerId||null};
  if(full){socket.emit('game:snapshot',snap);O.fullSnapshotAt=performance.now();}
  else socket.volatile.emit('game:snapshot',snap);
  return true;
}
function requestFreshSnapshot(reason='watchdog'){
  if(!O.started||O.host||!socket.connected)return;
  socket.emit('game:snapshot-request',{lastSeq:O.lastSnapshotSeq||0,reason});
}
function startNetLoops(){
  clearNetLoops();O.fullSnapshotAt=0;O.netWarned=false;
  O.inputTimer=setInterval(()=>{
    if(!O.started||O.host||!socket.connected)return;
    const input=MP.localInput();const key=JSON.stringify(input);
    if(key!==O.lastInput||O.inputSeq%2===0){O.lastInput=key;socket.volatile.emit('game:input',{seq:++O.inputSeq,input});}else O.inputSeq++;
  },33);
  if(O.host){
    O.snapshotTimer=setInterval(()=>{
      if(!O.started||!socket.connected)return;
      const now=performance.now(),mustFull=typeof state==='undefined'||state!=='play'||now-O.fullSnapshotAt>700;
      emitHostSnapshot(mustFull);
    },100);
  }else{
    O.lastSnapshot=performance.now();
    O.networkWatchTimer=setInterval(()=>{
      if(!O.started||O.host||!socket.connected)return;
      const age=performance.now()-O.lastSnapshot;
      if(age>850)requestFreshSnapshot(age>2400?'stalled':'watchdog');
      if(age>2400&&!O.netWarned){O.netWarned=true;notifyVoyage?.('SINCRONIZAÇÃO INSTÁVEL','Pedindo um novo estado ao host. A partida continuará assim que a rede responder.','#e6b77d',3.2);}
      if(age<900)O.netWarned=false;
    },400);
  }
  O.progressTimer=setInterval(syncCoopProgress,500);O.resumeHeartbeat=setInterval(rememberActiveSession,2000);rememberActiveSession();
}
function startGame(room){
  O.started=true;O.leaving=false;O.room=room;O.host=roomHostIsMe(room);const me=roomMe(room);O.slot=me?.slot??O.slot;O.playerId=me?.playerId||O.playerId;
  O.lastSnapshotSeq=0;O.snapshotSeq=0;O.snapshotHostPlayerId=O.host?O.playerId:null;O.lastSnapshot=performance.now();
  $('multiplayer-online-screen').classList.add('hidden');removeResumeCandidate(O.resumeToken);
  MP.startOnline(roomToConfig(room),{host:O.host,localSlot:O.slot,localInput:()=>MP.localInput()});
  if(!O.runRecorded){addChron('coopRuns',1);O.runRecorded=true;}resetObserved();startNetLoops();
  if(O.host){setTimeout(()=>emitHostSnapshot(true),40);setTimeout(()=>emitHostSnapshot(true),260);}
  else{setTimeout(()=>requestFreshSnapshot('game-start'),120);}
  notifyVoyage?.('TRIPULAÇÃO ONLINE',O.host?'Você é o host autoritativo desta viagem.':'Conectado ao mar do host.','#8ee6ee',4);
}
function restoreOnlineGame(res,fromMenu=false){
  O.room=res.room;O.started=true;O.leaving=false;O.host=roomHostIsMe(res.room);setRoomIdentity(res);
  O.lastSnapshotSeq=0;O.snapshotSeq=0;O.snapshotHostPlayerId=O.host?O.playerId:null;O.lastSnapshot=performance.now();
  $('multiplayer-online-screen')?.classList.add('hidden');
  if(!MP.enabled){MP.startOnline(roomToConfig(res.room),{host:O.host,localSlot:O.slot,localInput:()=>MP.localInput()});}
  MP.setOnlineRole?.(O.host,O.slot);
  if(res.lastSnapshot){MP.applySnapshot?.(res.lastSnapshot,true);O.lastSnapshotSeq=Number(res.lastSnapshot?._net?.seq||0);O.snapshotHostPlayerId=res.lastSnapshot?._net?.hostPlayerId||O.snapshotHostPlayerId;}
  if(res.playerState)MP.restorePlayerFromNet?.(O.slot,res.playerState);
  else MP.restorePlayerFromNet?.(O.slot,null);
  MP.forceOnlineUnpause?.();resetObserved();startNetLoops();syncReplicaUi();
  if(fromMenu)notifyVoyage?.('DE VOLTA AO CONVÉS','Você retomou exatamente o seu capitão e a viagem continua.','#83e0bd',5);
}
function pushImmediateSnapshot(){return emitHostSnapshot(true);}
function sendAction(action,payload={}){
  if(!O.started)return false;
  if(O.host){const ok=!!MP.performAction(O.slot,action,payload);if(ok)pushImmediateSnapshot();return ok;}
  const requestId='a_'+makeToken().slice(2,34);O.pendingActions.set(requestId,{action,payload,at:Date.now()});
  socket.emit('game:action',{requestId,action,payload});
  setTimeout(()=>{const pend=O.pendingActions.get(requestId);if(!pend)return;O.pendingActions.delete(requestId);if(pend.action==='ready'){MP.renderShop?.();notifyVoyage?.('SEM RESPOSTA DO HOST','O estado de PRONTO não foi confirmado. Tente novamente.','#e6b77d',2.6);}},6000);return requestId;
}
function leaveOnlineSession(allowResume=true){
  if(!O.started||O.leaving)return;
  O.leaving=true;clearNetLoops();
  if(allowResume){
    const provisional=Date.now()+30000;saveResumeCandidate(provisional,{reason:'menu'});
    socket.emit('room:leave',{permanent:false},res=>{if(res?.reconnectUntil)saveResumeCandidate(res.reconnectUntil,{reason:'menu'});});
  }else{
    removeResumeCandidate(O.resumeToken);
    socket.emit('room:leave',{permanent:true},()=>removeResumeCandidate(O.resumeToken));
  }
  O.started=false;O.host=false;O.leaving=false;O.runRecorded=false;O.pendingActions.clear();O.pendingWipeDiamond=false;
}
try{const baseGoMenu=goMenu;goMenu=function(){const terminal=O.started&&typeof state!=='undefined'&&['gameover','victory'].includes(state);if(O.started)leaveOnlineSession(!terminal);const r=baseGoMenu();if(terminal)removeResumeCandidate(O.resumeToken);setTimeout(updateResumeButton,0);return r;};}catch(_){ }

socket.on('connect',()=>{
  setStatus('SERVIDOR ONLINE','ok');console.log('[ONLINE] Conectado:',socket.id);
  if(O.started&&O.room?.code&&O.resumeToken&&!O.resuming){
    O.resuming=true;socket.emit('room:resume',{code:O.room.code,resumeToken:O.resumeToken},res=>{O.resuming=false;if(res?.ok){restoreOnlineGame(res,false);removeResumeCandidate(O.resumeToken);}else{O.started=false;clearNetLoops();saveResumeCandidate(Date.now()+1000);setMenuVisible();updateResumeButton();}});
  }
});
socket.on('disconnect',()=>{
  setStatus('CONEXÃO PERDIDA','error');
  if(O.started){clearNetLoops();const d=Date.now()+30000;saveResumeCandidate(d,{reason:'disconnect'});notifyVoyage?.('CONEXÃO INTERROMPIDA','Seu lugar fica reservado por 30 segundos. Tentando reconectar...','#ffb47b',6);}
});
socket.on('connect_error',err=>setStatus(`ERRO: ${err.message}`,'error'));
socket.on('room:state',room=>{
  if(!O.started){if(O.room?.code===room.code||$('multiplayer-online-screen')&&!$('multiplayer-online-screen').classList.contains('hidden'))renderLobby(room);return;}
  O.room=room;const me=roomMe(room);if(me){O.slot=me.slot;O.playerId=me.playerId||O.playerId;}
  const amHost=roomHostIsMe(room);if(amHost!==O.host){O.host=amHost;MP.setOnlineRole?.(O.host,O.slot);startNetLoops();}
});
socket.on('room:closed',data=>{clearNetLoops();O.started=false;O.room=null;O.host=false;removeResumeCandidate();alert(data?.message||'A sala foi encerrada.');try{goMenu();}catch(_){location.reload();}});
socket.on('game:start',startGame);
socket.on('game:remote-input',({slot,input})=>{if(O.host&&O.started)MP.setRemoteInput(slot,input);});
socket.on('game:snapshot',snap=>{
  if(O.host||!O.started||!snap)return;
  const seq=Number(snap?._net?.seq||0),replay=!!snap?._net?.replay,hostPlayerId=snap?._net?.hostPlayerId||null;
  if(hostPlayerId&&hostPlayerId!==O.snapshotHostPlayerId){O.snapshotHostPlayerId=hostPlayerId;O.lastSnapshotSeq=0;}
  if(!replay&&seq&&seq<=O.lastSnapshotSeq)return;
  if(seq)O.lastSnapshotSeq=Math.max(O.lastSnapshotSeq,seq);
  if(MP.applySnapshot(snap)){O.lastSnapshot=performance.now();O.netWarned=false;syncReplicaUi();syncCoopProgress();}
});
socket.on('game:snapshot-request-host',()=>{if(O.host&&O.started)pushImmediateSnapshot();});
socket.on('game:remote-action',({requestId,slot,action,payload})=>{
  if(!O.host||!O.started)return;
  const p=MP.playerById?.(slot),beforeGold=Number(p?.gold||0),fundBefore=MP.getWipeFund?.()||{total:0,cost:0},beforeOwned=action==='buy'&&p?.upgrades?.has?.(payload?.id);
  const requested=Math.max(0,Math.floor(Number(payload?.amount)||0)),wipeAccepted=action==='wipe-diamond'?Math.min(requested,Math.max(0,Number(fundBefore.cost||0)-Number(fundBefore.total||0))):0;
  const ok=!!MP.performAction(slot,action,payload);
  const afterGold=Number(p?.gold||0),afterOwned=action==='buy'&&p?.upgrades?.has?.(payload?.id);
  socket.emit('game:action-result',{requestId,ok,detail:{goldBefore:beforeGold,goldAfter:afterGold,spent:Math.max(0,beforeGold-afterGold),acceptedAmount:ok?wipeAccepted:0,upgradeApplied:!!(!beforeOwned&&afterOwned),ready:action==='ready'?!!p?.ready:undefined}});
  if(ok)pushImmediateSnapshot();
});
socket.on('game:action-result',({requestId,action,ok,detail={}})=>{
  const pending=O.pendingActions.get(requestId);O.pendingActions.delete(requestId);if(!pending)return;
  if(action==='wipe-diamond'){O.pendingWipeDiamond=false;const accepted=Math.max(0,Math.floor(Number(detail.acceptedAmount)||0));if(ok&&accepted>0){diamonds=Math.max(0,diamonds-accepted);saveMeta?.();updateDiamondUI?.();MP.renderDefeat?.();}else notifyVoyage?.('CONTRIBUIÇÃO NÃO APLICADA','O fundo mudou antes da sua contribuição. Nenhum diamante foi gasto.','#e6b77d',3);}
  else if(action==='ready'){
    if(ok&&typeof detail.ready==='boolean'){MP.setReadyFromNetwork?.(O.slot,detail.ready);MP.renderShop?.();}
    else {MP.renderShop?.();notifyVoyage?.('PRONTO NÃO CONFIRMADO','O estado do estaleiro mudou. Tente novamente.','#e6b77d',2.4);}
  }
  else if(!ok)notifyVoyage?.('AÇÃO NÃO APLICADA','O host recusou a ação porque o estado da partida mudou. Seu ouro não foi gasto.','#e6b77d',3);
});
socket.on('game:meta-award',payload=>applyLocalLootAward(payload||{}));
socket.on('game:milestone',({type,data})=>{if(type==='waveComplete')onWaveMilestone(data);});
socket.on('game:player-left',({slot,wasHost,reconnectUntil,name})=>{
  if(!O.started)return;MP.handlePlayerLeft?.(slot,true);const label=name||MP.playerById?.(slot)?.name||`Jogador ${Number(slot)+1}`;
  notifyVoyage?.('CAPITÃO DESCONECTADO',`${label} tem até ${Math.max(1,Math.ceil((Number(reconnectUntil)-Date.now())/1000))||30}s para retornar.${wasHost?' Um novo host assumiu a autoridade.':''}`,'#e4b48f',5);
});
socket.on('game:player-expired',({slot,name})=>{
  if(!O.started)return;MP.handlePlayerLeft?.(slot,false);notifyVoyage?.('CAPITÃO DEIXOU A VIAGEM',`${name||`Jogador ${Number(slot)+1}`} não retornou a tempo. Os demais continuam.`, '#d58b7d',5);
});
socket.on('game:player-rejoined',data=>{
  if(!O.started)return;MP.restorePlayerFromNet?.(data.slot,data.playerState||null);if(data.hostPlayerId&&O.room)O.room.hostPlayerId=data.hostPlayerId;
  notifyVoyage?.('CAPITÃO RETORNOU',`${data.name||`Jogador ${Number(data.slot)+1}`} voltou ao próprio navio.`, '#83e0bd',4);
});
socket.on('game:host-migrated',data=>{
  if(!O.started)return;
  const becoming=data?.hostPlayerId===O.playerId||data?.hostId===socket.id;
  if(data?.lastSnapshot&&becoming&&!O.host){try{MP.applySnapshot(data.lastSnapshot,true);}catch(_){ }}
  if(data?.departedSlot!=null)MP.handlePlayerLeft?.(data.departedSlot,true);
  O.host=becoming;if(O.room){O.room.hostId=data?.hostId;O.room.hostPlayerId=data?.hostPlayerId;}
  O.lastSnapshotSeq=0;O.snapshotSeq=0;O.snapshotHostPlayerId=data?.hostPlayerId||null;O.lastSnapshot=performance.now();
  MP.forceOnlineUnpause?.();MP.setOnlineRole?.(O.host,O.slot);startNetLoops();if(O.host)setTimeout(()=>pushImmediateSnapshot(),80);else setTimeout(()=>requestFreshSnapshot('host-migration'),140);
  if(O.host)notifyVoyage?.('VOCÊ É O NOVO HOST','A autoridade mudou, mas seu capitão, build, ouro, vida e skin continuam intactos.','#8ee6ee',5);
  else notifyVoyage?.('NOVO HOST DEFINIDO','A viagem continua sem trocar a identidade de nenhum capitão.','#8ee6ee',4);
});
socket.on('game:pause-request',({slot,paused})=>{
  if(!O.host||!O.started||typeof state==='undefined')return;if(!['play','paused'].includes(state))return;
  MP.setOnlinePaused(paused,slot);socket.emit('game:pause-state',{paused:state==='paused',by:slot});
});
socket.on('game:pause-state',({paused,by})=>{
  if(!O.started||O.host)return;if(typeof state!=='undefined'&&(state==='upgrade'||state==='specialization')){MP.forceOnlineUnpause?.();return;}MP.setOnlinePaused(paused,by);
});

function syncReplicaUi(){
  if(O.host||!O.started)return;MP.forceOnlineShopView?.();
  if(typeof state!=='undefined'&&['transition','play','paused'].includes(state)){try{revealHud?.(state==='transition'?Math.max(.01,Math.min(1,((transition||0)-3.25)/.85)):1);}catch(_){ }document.querySelector('#hud .hud-ribbon')?.classList.add('hidden');$('upgrade-strip')?.classList.add('hidden');$('mp-hud-ribbon')?.classList.remove('hidden');}
  const reward=$('boss-reward-screen'),victory=$('victory-screen');
  // A entidade do chefe chega pelo snapshot, mas a barra é DOM local e precisa ser reconstruída
  // no navegador convidado.
  const boss=Array.isArray(enemies)?enemies.find(e=>e?.isBoss&&!e?.destroyed):null;
  if(bossFight&&boss&&!bossFight.defeated&&typeof state!=='undefined'&&['play','paused'].includes(state)){
    bossHpWrap?.classList.remove('hidden');
    if(bossNameEl)bossNameEl.textContent=bossFight?.cfg?.name||bossFight?.name||'CHEFE';
    if(bossHpFill){const max=Math.max(1,Number(boss.max||boss.maxHp||boss.hp||1)),hp=Math.max(0,Number(boss.hp||0));bossHpFill.style.width=`${Math.max(0,Math.min(100,hp/max*100))}%`;}
  }else bossHpWrap?.classList.add('hidden');
  if(typeof state!=='undefined'&&state==='upgrade'){MP.forceOnlineUnpause?.();$('mp-shop-screen')?.classList.remove('hidden');MP.renderShop();}
  else $('mp-shop-screen')?.classList.add('hidden');
  if(typeof state!=='undefined'&&state==='gameover'){$('gameover')?.classList.remove('hidden');MP.renderDefeat?.();}
  else $('gameover')?.classList.add('hidden');
  if(typeof state!=='undefined'&&state==='bossreward'){
    reward?.classList.remove('hidden');
    const kind=bossFight?.kind||'marine',r=typeof secretForBoss==='function'?secretForBoss(kind):null;
    if($('boss-reward-title'))$('boss-reward-title').textContent='CHEFE DERROTADO • AGUARDANDO HOST';
    if($('boss-reward-text'))$('boss-reward-text').textContent='A recompensa pertence a toda a tripulação. O host está avançando a viagem.';
    if(r&&$('boss-reward-image'))$('boss-reward-image').src=skinById?.[r.id]?.src||'';
    if($('boss-reward-btn')){$('boss-reward-btn').disabled=true;$('boss-reward-btn').textContent='AGUARDANDO HOST';}
  }else if(reward){reward.classList.add('hidden');if($('boss-reward-btn')){$('boss-reward-btn').disabled=false;$('boss-reward-btn').textContent='CONTINUAR';}}
  if(typeof state!=='undefined'&&state==='victory'){
    victory?.classList.remove('hidden');
    if($('victory-captain'))$('victory-captain').textContent='A tripulação conquistou a coroa dos mares.';
  }else victory?.classList.add('hidden');
}

/* ---------- UI ---------- */
$('multiplayer-btn')?.addEventListener('click',openOnline);
$('resume-multiplayer-btn')?.addEventListener('click',resumeSavedSession);
$('online-close')?.addEventListener('click',closeOnline);
$('online-create')?.addEventListener('click',()=>{if(!socket.connected)return setStatus('Servidor ainda desconectado.','error');setStatus('CRIANDO SALA...');socket.emit('room:create',{profile:profile(),resumeToken:O.resumeToken},enterRoomResponse);});
$('online-join')?.addEventListener('click',()=>{const code=cleanCode($('online-code').value);$('online-code').value=code;if(code.length!==6)return setStatus('Digite um código de 6 caracteres.','error');setStatus('ENTRANDO NA SALA...');socket.emit('room:join',{code,profile:profile(),resumeToken:O.resumeToken},enterRoomResponse);});
$('online-code')?.addEventListener('input',e=>e.target.value=cleanCode(e.target.value));
$('online-code')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('online-join').click();});
$('online-start')?.addEventListener('click',()=>socket.emit('room:start',{},res=>{if(!res?.ok)setStatus(res?.error||'Não foi possível iniciar.','error');}));
$('online-leave')?.addEventListener('click',()=>{socket.emit('room:leave',{},()=>{O.room=null;$('online-lobby').classList.add('hidden');$('online-home').classList.remove('hidden');setStatus('SERVIDOR ONLINE','ok');});});
$('online-copy-code')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(O.room?.code||'');$('online-copy-code').textContent='COPIADO!';setTimeout(()=>$('online-copy-code').textContent='COPIAR CÓDIGO',1200);}catch(_){}});

$('mp-shop-screen')?.addEventListener('click',e=>{
  if(!O.started)return;const b=e.target.closest('button');if(!b)return;
  if(b.dataset.mpTab!=null){e.preventDefault();e.stopImmediatePropagation();MP.forceOnlineShopView?.();return;}
  let action=null,payload={};
  if(b.dataset.mpClass){action='class';payload={path:b.dataset.mpClass};}
  else if(b.dataset.mpFirst){action='first';payload={id:b.dataset.mpFirst};}
  else if(b.dataset.mpBuy){action='buy';payload={id:b.dataset.mpBuy};}
  else if(b.hasAttribute('data-mp-repair'))action='repair';
  else if(b.hasAttribute('data-mp-reroll'))action='reroll';
  else if(b.dataset.mpDonate){const [target,amount]=b.dataset.mpDonate.split(':');action='donate';payload={target:Number(target),amount};}
  else if(b.dataset.mpRevive){const [target,amount]=b.dataset.mpRevive.split(':');action='revive';payload={target:Number(target),amount};}
  else if(b.hasAttribute('data-mp-ready')){action='ready';const me=MP.playerById?.(O.slot);payload={ready:!me?.ready};b.disabled=true;b.textContent='CONFIRMANDO...';}
  else if(b.dataset.mpSpec){action='spec';payload={id:b.dataset.mpSpec};}
  else if(b.id==='mp-shop-continue')action='continue';
  if(action){e.preventDefault();e.stopImmediatePropagation();sendAction(action,payload);}
},true);

// Fundo coletivo de diamantes do full wipe: a carteira local só é debitada DEPOIS que
// o host confirma quanto realmente entrou no fundo. Isso evita perder gemas por atraso/race.
$('gameover')?.addEventListener('click',e=>{
  if(!O.started)return;const b=e.target.closest('[data-mp-diamond]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();
  const fund=MP.getWipeFund?.();if(!fund)return;const remaining=Math.max(0,fund.cost-fund.total);if(!remaining)return;
  if(O.pendingWipeDiamond){notifyVoyage?.('AGUARDANDO CONFIRMAÇÃO','Sua contribuição anterior ainda está sendo confirmada.','#8ee6ee',2.2);return;}
  let wanted=b.dataset.mpDiamond==='rest'?remaining:Number(b.dataset.mpDiamond)||0;wanted=Math.min(remaining,wanted,Math.max(0,Math.floor(Number(diamonds)||0)));
  if(wanted<=0){notifyVoyage?.('DIAMANTES INSUFICIENTES','Você não possui diamantes disponíveis para contribuir.','#e6b77d',3);return;}
  if(O.host){const ok=sendAction('wipe-diamond',{amount:wanted}),accepted=ok?wanted:0;if(accepted>0){diamonds=Math.max(0,diamonds-accepted);saveMeta?.();updateDiamondUI?.();MP.renderDefeat?.();}}
  else{O.pendingWipeDiamond=true;sendAction('wipe-diamond',{amount:wanted});}
},true);

window.addEventListener('keydown',e=>{
  if(!O.started||e.key!=='Escape'||e.repeat)return;if(typeof state==='undefined')return;
  if(state==='upgrade'||state==='specialization'){e.preventDefault();e.stopImmediatePropagation();MP.forceOnlineUnpause?.();return;}
  if(!['play','paused'].includes(state))return;e.preventDefault();e.stopImmediatePropagation();const want=state!=='paused';
  if(O.host){MP.setOnlinePaused(want,O.slot);socket.emit('game:pause-state',{paused:state==='paused',by:O.slot});}else socket.emit('game:pause-request',{paused:want});
},true);
$('resume-btn')?.addEventListener('click',e=>{if(!O.started||typeof state==='undefined'||state!=='paused')return;e.preventDefault();e.stopImmediatePropagation();if(O.host){MP.setOnlinePaused(false,O.slot);socket.emit('game:pause-state',{paused:false,by:O.slot});}else socket.emit('game:pause-request',{paused:false});},true);

window.addEventListener('beforeunload',()=>{if(O.started&&O.room?.code)saveResumeCandidate(Date.now()+30000,{reason:'unload'});});
window.addEventListener('pageshow',updateResumeButton);
setInterval(()=>{if(!$('menu')?.classList.contains('hidden'))updateResumeButton();},1000);

Object.assign(window.RDMOnline,{refreshResume:updateResumeButton,resumeSaved:resumeSavedSession,readResume:readResumeCandidate});
setStatus(socket.connected?'SERVIDOR ONLINE':'CONECTANDO AO SERVIDOR...',socket.connected?'ok':'');updateResumeButton();
})();
