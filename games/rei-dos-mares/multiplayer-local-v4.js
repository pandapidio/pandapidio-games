/*
  Rei dos Mares — Multiplayer Fase 1
  ----------------------------------
  Simulação cooperativa local para validar a arquitetura de 2–3 jogadores antes da rede.
  Não existe comunicação online neste arquivo. Cada jogador possui entidade, ouro, build,
  vida e estatísticas próprios, enquanto ondas, inimigos, chefes e o relógio são compartilhados.
*/
(() => {
'use strict';
const $=id=>document.getElementById(id);
const MP={
  enabled:false,count:2,players:[],context:null,worldTick:false,codes:new Set(),shop:null,
  setup:null,restartConfig:null,drawingExtras:false,selectedShopPlayer:0,lastHudKey:'',wipe:false,
  fullGameplay:false,online:null,remoteInputs:new Map(),localSlot:0,netSeq:1,wipeFund:null,replicaBossFx:null
};
window.ReiMultiplayerLocal=MP;

/* ---------- referências solo que serão preservadas ---------- */
const solo={
  start,goMenu,update,shoot,makePlayerProjectile,resolvePlayerShots,resolveEnemyShots,
  updateEnemyBurns,updateRoleEnemy,updateBossEnemy,enemyShoot,hitPlayer,endGame,reviveRun,
  reviveCostForWave,openUpgradeScreen,applyEnemyDamage,destroyEnemy,igniteEnemy,spawnChest,
  updateChests,drawShip,drawBuildPools,drawBuildEffects,drawClassAura,steerBuildShot,
  reflectBuildShot,recordWaveComplete,difficulty,admiralConfig,defeatBoss,isSpectral,
  openPause,closePause,updateVoyage
};

function connectedPlayers(){return MP.players.filter(p=>p.connected!==false);}
function shopParticipants(){return MP.players.filter(p=>p.connected!==false||p.resumeExpired!==true);}
function simulationPrimary(){
  if(!MP.enabled)return null;
  // Em online, cada navegador mantém o próprio capitão como referência visual/local.
  // O host continua sendo a única autoridade do mundo; convidados nunca usam o navio do host
  // como `player` primário, evitando fusão de controles/canhões após lojas e snapshots.
  if(MP.online){const local=playerById(MP.localSlot);if(local&&local.connected!==false)return local;}
  return connectedPlayers().find(p=>p.alive)||connectedPlayers()[0]||MP.players[0]||null;
}
function activeMpPlayer(){
  if(!MP.enabled)return null;
  if(MP.context)return MP.context;
  return MP.players.find(p=>p.entity===player)||simulationPrimary();
}
function alivePlayers(){return MP.players.filter(p=>p.connected!==false&&p.alive);}
function newBuildState(){
  const old=buildRun;resetBuild();const fresh=buildRun;buildRun=old;return fresh;
}
function syncPlayer(p){
  // A context change may select another captain after death; never transfer its ship.
  if(!p||player!==p.entity)return;
  p.gold=gold;p.upgrades=acquiredUpgrades;p.build=buildRun;
}
function activatePlayer(p){
  if(!p)return;
  player=p.entity;gold=p.gold;acquiredUpgrades=p.upgrades;buildRun=p.build;MP.context=p;
}
function restorePrimary(){
  const p=simulationPrimary();
  if(p){player=p.entity;gold=p.gold;acquiredUpgrades=p.upgrades;buildRun=p.build;}
  MP.context=null;
}
function withPlayer(p,fn){
  if(!MP.enabled||!p)return fn();
  const prev={player,gold,upgrades:acquiredUpgrades,build:buildRun,context:MP.context};
  const samePrimary=prev.player===p.entity;
  activatePlayer(p);
  try{return fn();}
  finally{
    syncPlayer(p);
    // Se o contexto temporário era o próprio jogador já ativo, restaurar `prev.gold`
    // reintroduzia o valor anterior e apagava recompensas (ex.: ouro de baú do host).
    if(samePrimary){player=p.entity;gold=p.gold;acquiredUpgrades=p.upgrades;buildRun=p.build;MP.context=prev.context;}
    else{player=prev.player;gold=prev.gold;acquiredUpgrades=prev.upgrades;buildRun=prev.build;MP.context=prev.context;}
  }
}
function playerById(id){return MP.players.find(p=>p.id===id)||null;}
function spawnPoint(i,count){
  if(count===2)return [{x:W*.42,y:H*.62},{x:W*.58,y:H*.62}][i];
  return [{x:W*.36,y:H*.64},{x:W*.50,y:H*.57},{x:W*.64,y:H*.64}][i]||{x:W/2,y:H*.62};
}
function cloneInitialPlayer(base,i,count,skinId){
  const p={...base};const pos=spawnPoint(i,count);
  Object.assign(p,{x:pos.x,y:pos.y,prevX:pos.x,prevY:pos.y,vx:0,vy:0,hp:100,maxHp:100,shot:0,inv:1.2,bob:i*.7,phase:i*.85,cannonAngle:-Math.PI/2,skinId,beamPhase:Math.random()*1.2,beamWakeClock:0,speedMult:1,damageMult:1,incomingDamageMult:1,fireRateMult:1,flame:false,doubleShot:false,explosive:false,piercing:false});
  return p;
}
function ownedSkinOptions(){
  const all=[{id:'default',name:'pirata'},...SKINS];
  return all.filter(s=>ownedSkins.has(s.id)&&!s.secret||ownedSkins.has(s.id));
}
function safeName(v,fallback){const s=String(v||'').trim().slice(0,18);return s||fallback;}
function pPortrait(p){return p.portrait||'assets/portraits/pirate.svg';}
function pClassName(p){return p.build?.path?BUILD_PATHS[p.build.path].name:'Sem classe';}

/* ---------- tela de configuração ---------- */
function renderSetup(){
  const box=$('mp-player-config');if(!box)return;
  const skins=ownedSkinOptions();
  box.innerHTML=Array.from({length:MP.count},(_,i)=>{
    const cfg=MP.setup?.[i]||{};
    const defaultName=i===0?(chronicle?.data?.name||'Capitão'):`Capitão ${i+1}`;
    const selected=cfg.skinId||(i===0?selectedSkin:(skins[i%skins.length]?.id||'default'));
    return `<article class="mp-player-setup ${i===MP.localSlot?'local':''}" data-setup-player="${i}"><h3>${i===0?'JOGADOR 1 • LOCAL':'JOGADOR '+(i+1)}</h3><label>NOME<input data-mp-name="${i}" maxlength="18" value="${safeName(cfg.name,defaultName)}"></label><label>SKIN<select data-mp-skin="${i}">${skins.map(s=>`<option value="${s.id}" ${s.id===selected?'selected':''}>${String(s.name).toUpperCase()}</option>`).join('')}</select></label></article>`;
  }).join('');
}
function collectSetup(){
  return Array.from({length:MP.count},(_,i)=>({
    name:safeName(document.querySelector(`[data-mp-name="${i}"]`)?.value,i===0?'Capitão':`Capitão ${i+1}`),
    skinId:document.querySelector(`[data-mp-skin="${i}"]`)?.value||'default'
  }));
}
function openMpSetup(){
  unlockAudio();sfx('click',.65);MP.count=2;MP.setup=null;
  document.querySelectorAll('[data-mp-count]').forEach(b=>b.classList.toggle('active',Number(b.dataset.mpCount)===2));
  renderSetup();$('multiplayer-setup-screen').classList.remove('hidden');
}
function closeMpSetup(){$('multiplayer-setup-screen').classList.add('hidden');sfx('ui',.4);}

/* ---------- criação e encerramento da sessão local ---------- */
function mpStartFromConfig(config){
  MP.enabled=true;MP.wipe=false;MP.wipeFund=null;MP.restartConfig=config.map(x=>({...x}));MP.count=config.length;MP.players=[];MP.shop=null;MP.codes.clear();
  solo.start();
  // O solo acabou de criar a entidade e build do P1; transformamos esse estado no contexto do primeiro capitão.
  const base=player,baseBuild=buildRun;
  for(let i=0;i<MP.count;i++){
    const c=config[i],entity=i===0?base:cloneInitialPlayer(base,i,MP.count,c.skinId);
    if(i===0){const pos=spawnPoint(0,MP.count);Object.assign(entity,{x:pos.x,y:pos.y,prevX:pos.x,prevY:pos.y,skinId:c.skinId});}
    const b=i===0?baseBuild:newBuildState();
    MP.players.push({id:i,name:c.name,skinId:c.skinId,entity,gold:0,upgrades:i===0?acquiredUpgrades:new Set(),build:b,alive:true,connected:true,ready:false,portrait:c.portrait||(i===0?avatarSrc(chronicle.data.profile.avatar):'assets/portraits/pirate.svg'),title:c.title||(i===0?captainTitleInfo().name:'Capitão'),aim:-Math.PI/2,stats:{damageDealt:0,damageTaken:0,deaths:0,aliveTime:0,donated:0,kills:0,received:0,revivesGiven:0,revived:0,lastStandWaves:0,goldCollected:0,diamondsCollected:0},shopChoices:[],shopRerolled:false,shopRepaired:false});
  }
  voyage.tutorial.active=false;voyage.guide=false;voyage.forcedTutorial=false;
  // beginFirstWave foi preparado antes da lista existir; refaz o plano com a dificuldade coop correta.
  prepareVoyageWave(1);waveRemainingToSpawn=voyage.plan.length;waveTotal=voyage.plan.length;voyage.spawned=0;waveSpawnClock=.65;
  restorePrimary();
  const ribbon=document.querySelector('#hud .hud-ribbon');if(ribbon)ribbon.classList.add('hidden');$('upgrade-strip')?.classList.add('hidden');$('mp-hud-ribbon')?.classList.remove('hidden');
  $('multiplayer-setup-screen').classList.add('hidden');
  notifyVoyage('TRIPULAÇÃO FORMADA',`${MP.count} capitães compartilham o mesmo mar. Sem colisão ou fogo amigo.`, '#8ee6ee',5);
  updateMpHud(true);
}
function cleanupMp(){
  MP.enabled=false;MP.fullGameplay=false;MP.players=[];MP.shop=null;MP.wipe=false;MP.wipeFund=null;MP.codes.clear();MP.context=null;MP.online=null;MP.remoteInputs.clear();MP.localSlot=0;MP.replicaBossFx=null;
  document.querySelector('#hud .hud-ribbon')?.classList.remove('hidden');$('upgrade-strip')?.classList.remove('hidden');$('mp-hud-ribbon')?.classList.add('hidden');$('mp-shop-screen')?.classList.add('hidden');$('mp-defeat-summary')?.classList.add('hidden');gameover.querySelector('.gameover-card')?.classList.remove('mp-coop-defeat');
  againBtn?.classList.remove('hidden');$('revive-btn')?.classList.remove('hidden');
}
start=function(){
  if(MP.enabled&&MP.restartConfig){return mpStartFromConfig(MP.restartConfig.map(x=>({...x})));}
  return solo.start();
};
goMenu=function(){const was=MP.enabled;if(was)cleanupMp();return solo.goMenu();};

/* ---------- dificuldade coop ---------- */
difficulty=function(n=wave){
  return solo.difficulty(n);
};
admiralConfig=function(kind){
  return solo.admiralConfig(kind);
};

/* ---------- input local ---------- */
window.addEventListener('keydown',e=>{if(MP.enabled)MP.codes.add(e.code);});
window.addEventListener('keyup',e=>MP.codes.delete(e.code));
MP.clearInput=()=>{MP.codes.clear();keys.clear();mouse.down=false;};
window.addEventListener('blur',()=>{if(MP.enabled)MP.clearInput();});
window.addEventListener('pointercancel',()=>{if(MP.enabled)MP.clearInput();});
document.addEventListener('visibilitychange',()=>{if(MP.enabled&&document.hidden)MP.clearInput();});
function axesFor(p){
  if(p?.connected===false)return {mx:0,my:0,ax:0,ay:0,fire:false};
  if(MP.online){
    if(MP.online.host){
      if(p.id===MP.localSlot)return MP.online.localInput?.()||{mx:0,my:0,ax:0,ay:0,fire:false};
      return MP.remoteInputs.get(p.id)||{mx:0,my:0,ax:0,ay:0,fire:false};
    }
    if(MP.online.replica&&p.id===MP.localSlot)return MP.online.localInput?.()||{mx:0,my:0,ax:0,ay:0,fire:false};
    if(MP.online.replica)return {mx:0,my:0,ax:0,ay:0,fire:false};
  }
  if(p.id===1){return {mx:(MP.codes.has('KeyL')?1:0)-(MP.codes.has('KeyJ')?1:0),my:(MP.codes.has('KeyK')?1:0)-(MP.codes.has('KeyI')?1:0),ax:(MP.codes.has('Numpad6')?1:0)-(MP.codes.has('Numpad4')?1:0),ay:(MP.codes.has('Numpad5')?1:0)-(MP.codes.has('Numpad8')?1:0),fire:MP.codes.has('Numpad0')};}
  if(p.id===2){return {mx:(MP.codes.has('KeyH')?1:0)-(MP.codes.has('KeyF')?1:0),my:(MP.codes.has('KeyG')?1:0)-(MP.codes.has('KeyT')?1:0),ax:(MP.codes.has('KeyU')?1:0)-(MP.codes.has('KeyY')?1:0),ay:(MP.codes.has('KeyN')?1:0)-(MP.codes.has('KeyB')?1:0),fire:MP.codes.has('KeyV')};}
  return {mx:0,my:0,ax:0,ay:0,fire:false};
}
function markPredictedPlayerShot(s,p){
  if(!s||!p)return;
  s.ownerId=p.id;s.team='player';
  if(MP.online?.authoritative&&p.id===MP.localSlot){
    s.__predictedLocal=true;
    s.__predictedAt=performance.now();
  }
}
function predictionConnected(){
  if(!MP.online?.replica||!MP.online.authoritative)return true;
  const net=window.RDMOnline;
  return !!(net?.socket?.connected&&net.state?.started&&performance.now()-net.state.lastSnapshotAt<=900);
}
function mpFireAt(p,angle){
  if(!p.alive||state!=='play'||!predictionConnected())return;
  withPlayer(p,()=>{
    const oldX=mouse.x,oldY=mouse.y,oldDown=mouse.down;
    mouse.x=p.entity.x+Math.cos(angle)*500;mouse.y=p.entity.y+Math.sin(angle)*500;mouse.down=false;
    const before=shots.length;solo.shoot();for(let i=before;i<shots.length;i++)markPredictedPlayerShot(shots[i],p);
    mouse.x=oldX;mouse.y=oldY;mouse.down=oldDown;
  });
}
shoot=function(){
  if(!MP.enabled)return solo.shoot();const p=activeMpPlayer();if(!p?.alive||p.connected===false)return;
  if(!predictionConnected())return;
  return withPlayer(p,()=>{const before=shots.length,ret=solo.shoot();for(let i=before;i<shots.length;i++)markPredictedPlayerShot(shots[i],p);return ret;});
};
makePlayerProjectile=function(...args){const s=solo.makePlayerProjectile(...args);if(MP.enabled)markPredictedPlayerShot(s,activeMpPlayer()||playerById(MP.localSlot));return s;};

function updateExtraPlayer(p,dt){
  if(p.connected===false){p.entity.vx=0;p.entity.vy=0;return;}if(!p.alive){p.entity.hp=0;return;}
  const e=p.entity,a=axesFor(p);e.prevX=e.x;e.prevY=e.y;e.bob+=dt*3;e.shot=Math.max(0,e.shot-dt);e.inv=Math.max(0,e.inv-dt);
  const al=Math.hypot(a.ax,a.ay);if(al>.1)p.aim=Math.atan2(a.ay,a.ax);e.cannonAngle=p.aim;
  let mx=a.mx,my=a.my,l=Math.hypot(mx,my)||1;mx/=l;my/=l;
  withPlayer(p,()=>{
    updateBuild(dt,!!(a.mx||a.my)||Math.hypot(e.vx,e.vy)>.1);
    const boardingSpeed=window.ReiEndgame?.hasSpecialization?.('pirate-boarding')?1.25:BUILD_BALANCE.hook.speed;
    const moveSpeed=360*(e.speedMult||1)*(p.build.cadaver>0?BUILD_BALANCE.cadaver.speed:1)*(p.build.boardingRush>0?boardingSpeed:1);
    e.vx+=(mx*moveSpeed-e.vx)*Math.min(1,dt*4.2);e.vy+=(my*moveSpeed-e.vy)*Math.min(1,dt*4.2);e.vx*=Math.pow(.90,dt*60);e.vy*=Math.pow(.90,dt*60);
    if(Math.abs(e.vx)>12)e.facingX=e.vx<0?-1:1;e.x=clamp(e.x+e.vx*dt,55,W-55);e.y=clamp(e.y+e.vy*dt,95,H-55);
    spawnBeamWake(e,dt);if(typeof spawnMidasTrail==='function')spawnMidasTrail(e,dt);
    if(a.fire)mpFireAt(p,p.aim);
  });
  p.stats.aliveTime+=dt;
  if(Math.hypot(e.vx,e.vy)>45&&Math.random()<dt*9)foam.push({x:e.x-e.vx*.10+(Math.random()-.5)*18,y:e.y-e.vy*.10+(Math.random()-.5)*16,life:.65,max:.65,size:3+Math.random()*4});
}


function predictReplicaPlayer(p,dt){
  if(!p?.alive||p.connected===false)return;
  const e=p.entity,a=axesFor(p);e.prevX=e.x;e.prevY=e.y;e.bob=(e.bob||0)+dt*3;e.shot=Math.max(0,(e.shot||0)-dt);
  const al=Math.hypot(a.ax,a.ay);if(al>.1)p.aim=Math.atan2(a.ay,a.ax);e.cannonAngle=p.aim;
  let mx=a.mx,my=a.my,l=Math.hypot(mx,my)||1;mx/=l;my/=l;
  const boardingSpeed=window.ReiEndgame?.hasSpecialization?.('pirate-boarding')?1.25:BUILD_BALANCE.hook.speed;
  const moveSpeed=360*(e.speedMult||1)*(p.build?.cadaver>0?BUILD_BALANCE.cadaver.speed:1)*(p.build?.boardingRush>0?boardingSpeed:1);
  e.vx+=(mx*moveSpeed-e.vx)*Math.min(1,dt*4.2);e.vy+=(my*moveSpeed-e.vy)*Math.min(1,dt*4.2);e.vx*=Math.pow(.90,dt*60);e.vy*=Math.pow(.90,dt*60);
  if(Math.abs(e.vx)>12)e.facingX=e.vx<0?-1:1;e.x=clamp(e.x+e.vx*dt,55,W-55);e.y=clamp(e.y+e.vy*dt,95,H-55);
  const net=window.RDMOnline?.state;
  if(net){
    const cx=Number(net.localCorrectionX)||0,cy=Number(net.localCorrectionY)||0;
    if(Math.abs(cx)>.01||Math.abs(cy)>.01){
      const k=1-Math.exp(-dt*7.5),sx=cx*k,sy=cy*k;
      e.x=clamp(e.x+sx,55,W-55);e.y=clamp(e.y+sy,95,H-55);
      net.localCorrectionX=cx-sx;net.localCorrectionY=cy-sy;
    }
  }
  // Predição apenas visual do próprio disparo. O servidor continua decidindo dano/acerto.
  if(a.fire&&e.shot<=0)mpFireAt(p,p.aim);
}

/* ---------- seleção de alvo e IA ---------- */
function chooseTarget(e,dt=.016){
  const alive=alivePlayers();if(!alive.length)return null;
  e.mpRetarget=(e.mpRetarget||0)-dt;let current=playerById(e.mpTargetId);
  if(!current?.alive||e.mpRetarget<=0){
    const viable=alive.filter(p=>p.build?.spectral<=0),pool=viable.length?viable:alive;
    current=pool.reduce((best,p)=>!best||Math.hypot(p.entity.x-e.x,p.entity.y-e.y)<Math.hypot(best.entity.x-e.x,best.entity.y-e.y)?p:best,null);
    e.mpTargetId=current?.id;e.mpRetarget=.22;
  }
  return current;
}
isSpectral=function(){
  if(!MP.enabled)return solo.isSpectral();
  if(MP.worldTick&&!MP.context)return false;
  return !!activeMpPlayer()?.build&&activeMpPlayer().build.spectral>0;
};
updateRoleEnemy=function(e,dt){
  if(!MP.enabled)return solo.updateRoleEnemy(e,dt);
  const target=chooseTarget(e,dt);if(!target)return true;
  return withPlayer(target,()=>solo.updateRoleEnemy(e,dt));
};
updateBossEnemy=function(e,dt){if(!MP.enabled)return solo.updateBossEnemy(e,dt);const p=chooseTarget(e,dt);return p?withPlayer(p,()=>solo.updateBossEnemy(e,dt)):undefined;};
enemyShoot=function(e){if(!MP.enabled)return solo.enemyShoot(e);const p=chooseTarget(e,0);return p?withPlayer(p,()=>solo.enemyShoot(e)):undefined;};

/* ---------- projéteis por proprietário ---------- */
steerBuildShot=function(s,dt){if(!MP.enabled||s.ownerId==null)return solo.steerBuildShot(s,dt);const p=playerById(s.ownerId);return p?withPlayer(p,()=>solo.steerBuildShot(s,dt)):solo.steerBuildShot(s,dt);};
reflectBuildShot=function(s){
  if(!MP.enabled)return solo.reflectBuildShot(s);const p=activeMpPlayer(),before=shots.length,ok=solo.reflectBuildShot(s);if(ok&&p)for(let i=before;i<shots.length;i++){shots[i].ownerId=p.id;shots[i].team='player';}return ok;
};
resolvePlayerShots=function(){
  if(!MP.enabled)return solo.resolvePlayerShots();
  for(const s of shots){
    if(s.life<=0||s.exploded)continue;const owner=playerById(s.ownerId??0);if(!owner)continue;
    withPlayer(owner,()=>{
      const ax=s.prevX??s.x,ay=s.prevY??s.y,candidates=[];
      for(const e of enemies){if(!enemyIsAlive(e)||s.hitIds.has(e))continue;const u=sweepEnemyProjectile(s,e);if(u!==null)candidates.push({e,u});}
      candidates.sort((a,b)=>a.u-b.u);
      for(const {e,u}of candidates){
        if(s.life<=0||!enemyIsAlive(e))break;const x=lerp(ax,s.x,u),y=lerp(ay,s.y,u);s.hitIds.add(e);
        if(e.spawnShield>0||(e.isBoss&&bossFight?.intro>0)){burst(x,y,'splash',5);s.life=0;break;}
        s.impactCount++;const positional=typeof campaignProjectileMultiplier==='function'?campaignProjectileMultiplier(e,s):1;const damage=s.damage*(s.piercing?BUILD_BALANCE.pierce[s.impactCount-1]:1)*closeRangeDamage(e)*positional;
        if(s.explosive){explodeShot(s,x,y,e);break;}
        const damaged=applyEnemyDamage(e,damage,'shot');if(damaged)buildHit(e,s,x,y);if(s.reflected&&damaged)impactEffects.push({type:'counter',x,y,life:0,max:.34,seed:Math.random()*10});
        sfx('hit',s.flame?.38:.42,55);burst(x,y,'splash',8);if(s.flame&&enemyIsAlive(e)){sfx('flame',.10,600);const current=impactEffects.find(f=>f.type==='flame'&&f.target===e);if(current)current.life=0;else impactEffects.push({type:'flame',target:e,life:0,max:3.1,seed:Math.random()*10});}
        shake=Math.max(shake,s.piercing?3:2);if(!s.piercing||s.impactCount>=3)s.life=0;else{sfx('pierce',.8,80);impactEffects.push({type:'pierce',x,y,life:0,max:.34,seed:Math.random()*10});}
      }
    });
  }
};
resolveEnemyShots=function(){
  if(!MP.enabled)return solo.resolveEnemyShots();
  for(const s of enemyShots){
    if(s.life<=0)continue;const hits=[];
    for(const p of alivePlayers()){
      const ent=p.entity,skin=playerSkinMeta?.(ent.skinId||selectedSkin)||{},off=skin.hitboxY??43,h={x:ent.x,y:ent.y+off,r:skin.hitboxR||28},prevY=(ent.prevY??ent.y)+off;
      const ax=(s.prevX??s.x)-(ent.prevX??ent.x),ay=(s.prevY??s.y)-prevY,u=sweepCircle(ax,ay,s.x-h.x,s.y-h.y,0,0,h.r);if(u!==null)hits.push({p,u});
    }
    hits.sort((a,b)=>a.u-b.u);if(!hits.length)continue;const target=hits[0].p;s.life=0;withPlayer(target,()=>{if(!reflectBuildShot(s))hitPlayer(s.damage||12,s,'projectile');});
  }
};

/* ---------- dano, kills, fogo e estatísticas ---------- */
applyEnemyDamage=function(e,amount,source='shot'){
  if(!MP.enabled)return solo.applyEnemyDamage(e,amount,source);const p=activeMpPlayer(),before=e.hp,ok=solo.applyEnemyDamage(e,amount,source);if(ok&&p){const dealt=Math.max(0,Math.min(before,before-e.hp));p.stats.damageDealt+=dealt;}return ok;
};
igniteEnemy=function(e){const ret=solo.igniteEnemy(e);if(MP.enabled&&e.burn)e.burn.ownerId=activeMpPlayer()?.id??e.burn.ownerId??0;return ret;};
destroyEnemy=function(e){
  if(!MP.enabled)return solo.destroyEnemy(e);if(e.destroyed)return;
  const p=activeMpPlayer();
  if(p&&!e.isBoss){p.stats.kills++;gold+=10;p.gold=gold;p.stats.goldCollected+=10;}
  return solo.destroyEnemy(e);
};
updateEnemyBurns=function(dt){
  if(!MP.enabled)return solo.updateEnemyBurns(dt);let burningCount=0;
  for(const e of enemies){if(!e.burn||!enemyIsAlive(e))continue;burningCount++;const burn=e.burn,bal=BUILD_BALANCE,finite=Number.isFinite(burn.time);burn.age=(burn.age||0)+dt;if(finite)burn.time-=dt;burn.acc+=dt;
    const owner=playerById(burn.ownerId??0)||MP.players[0];withPlayer(owner,()=>{while(burn.acc>=bal.fire.tick&&enemyIsAlive(e)){burn.acc-=bal.fire.tick;const pct=burn.black?(e.isBoss?bal.hellfire.bossPercent:bal.hellfire.percent):(e.isBoss?bal.fire.bossPercent:bal.fire.percent);applyEnemyDamage(e,e.max*pct*bal.fire.tick,'burn-tick');const count=burn.black?4:3;for(let i=0;i<count;i++)addParticle(e.x+(Math.random()-.5)*50,e.y-12+(Math.random()-.5)*28,burn.black?(i%2?'#d34325':'#151014'):(i%2?'#ff6b21':'#ffc447'),2+Math.random()*3,.45,(Math.random()-.5)*28,-35-Math.random()*38,.9);}});if(finite&&burn.time<=0)e.burn=null;
  }updateBurnAudio(burningCount);
};
hitPlayer=function(baseDamage=12,source=null,kind='projectile'){
  if(!MP.enabled)return solo.hitPlayer(baseDamage,source,kind);const p=activeMpPlayer();if(!p?.alive)return;const before=p.entity.hp;const ret=solo.hitPlayer(baseDamage,source,kind);p.stats.damageTaken+=Math.max(0,before-p.entity.hp);syncPlayer(p);return ret;
};
endGame=function(){
  if(!MP.enabled)return solo.endGame();const p=activeMpPlayer();if(!p||!p.alive)return;
  p.alive=false;p.entity.hp=0;p.deathAt=elapsed;p.ready=true;p.stats.deaths=(p.stats.deaths||0)+1;sfx('sink',.65,100);burst(p.entity.x,p.entity.y,'splash',24);notifyVoyage(`${p.name.toUpperCase()} AFUNDOU`,'A tripulação continua. O capitão poderá ser revivido no próximo estaleiro.','#f1a197',4);
  syncPlayer(p);updateMpHud(true);
  if(alivePlayers().length)return;
  MP.wipe=true;MP.wipeFund={total:0,by:{}};restorePrimary();solo.endGame();renderMpDefeat();updateReviveButton();
};
reviveCostForWave=function(n){return solo.reviveCostForWave(n);};
reviveRun=function(funded=false){
  if(!MP.enabled)return solo.reviveRun();
  if(state!=='gameover'||!MP.wipe)return false;
  const cost=reviveCostForWave(wave);
  if(MP.online){
    if(!funded&&(MP.wipeFund?.total||0)<cost){renderMpDefeat();sfx('ui',.55);return false;}
  }else{
    if(diamonds<cost){updateReviveButton();sfx('ui',.55);return false;}
    diamonds-=cost;saveMeta();updateDiamondUI();
  }
  for(const p of connectedPlayers()){
    p.alive=true;p.ready=false;p.entity.hp=Math.max(1,p.entity.maxHp*.60);p.entity.inv=2.8;p.entity.vx=0;p.entity.vy=0;p.deathAt=null;
    p.build.awaitingDeath=false;p.build.lastDamage=null;
    const pos=spawnPoint(p.id,MP.count);p.entity.x=pos.x;p.entity.y=pos.y;p.entity.prevX=pos.x;p.entity.prevY=pos.y;
  }
  MP.wipe=false;MP.wipeFund=null;MP.context=null;MP.codes.clear();
  restorePrimary();
  buildRun.awaitingDeath=false;buildRun.lastDamage=null;
  mouse.down=false;keys.clear();enemyShots=[];shots=[];clearVoyageHazards();campaign.damageFlash=0;
  for(const e of enemies){e.mpTargetId=null;e.mpRetarget=0;}
  if(bossFight){bossFight.attack=null;bossFight.attackClock=Math.max(1.8,bossFight.attackClock||0);bossFight.bursts=[];bossHpWrap.classList.remove('hidden');}
  gameover.classList.add('hidden');gameover.querySelector('.gameover-card')?.classList.remove('mp-coop-defeat');
  state='play';syncMusicState(true);
  for(const p of connectedPlayers()){impactEffects.push({type:'heal',x:p.entity.x,y:p.entity.y,life:0,max:.9,seed:Math.random()*10});ripples.push({x:p.entity.x,y:p.entity.y+24,life:0,max:1});}
  notifyVoyage('TRIPULAÇÃO DE VOLTA',`Todos os capitães reviveram por ${cost} diamantes.`,'#92e7ff',4);sfx('heal',1);updateMpHud(true);
  return true;
};
function renderMpDefeat(){
  const box=$('mp-defeat-summary');if(!box)return;
  const local=playerById(MP.localSlot)||simulationPrimary();
  // A tela de derrota é DOM local; convidados não executam solo.endGame(), então preenchemos
  // explicitamente os números da própria viagem em vez de herdar zeros do reset inicial.
  if(finalWave)finalWave.textContent=String(wave);if(finalScore)finalScore.textContent=String(score);if(finalTime)finalTime.textContent=formatRunTime(local?.build?.elapsed||elapsed);
  if(finalGold)finalGold.textContent=String(Math.round(Math.max(Number(local?.stats?.goldCollected)||0,Number(voyage.runGold)||0)));
  const fd=document.getElementById('final-diamonds');if(fd)fd.textContent=String(Math.round(Math.max(Number(local?.stats?.diamondsCollected)||0,Number(voyage.runDiamonds)||0)));
  const active=MP.players.filter(p=>p.connected!==false),pool=active.length?active:MP.players;
  const damage=pool.reduce((a,p)=>p.stats.damageDealt>a.stats.damageDealt?p:a,pool[0]),survive=pool.reduce((a,p)=>p.stats.aliveTime>a.stats.aliveTime?p:a,pool[0]),donor=pool.reduce((a,p)=>p.stats.donated>a.stats.donated?p:a,pool[0]);
  const cost=reviveCostForWave(wave),fund=Math.min(cost,MP.wipeFund?.total||0),pct=cost?Math.min(100,fund/cost*100):0;
  const fundPanel=MP.online&&!MP.online.authoritative?`<div class="mp-diamond-fund"><div><b>REVIVER A TRIPULAÇÃO</b><span>${fund} / ${cost} ◆</span></div><div class="mp-revive-progress"><i style="width:${pct}%"></i></div><p>Cada capitão contribui com os próprios diamantes. Sua contribuição não usa a carteira de outro jogador.</p><div class="mp-diamond-actions"><button data-mp-diamond="25">+25 ◆</button><button data-mp-diamond="50">+50 ◆</button><button data-mp-diamond="rest">CONTRIBUIR O RESTANTE</button></div></div>`:'';
  box.innerHTML=`<h3>RELATÓRIO DA TRIPULAÇÃO</h3><table class="mp-result-table"><thead><tr><th>CAPITÃO</th><th>DANO CAUSADO</th><th>VEZES QUE MORREU</th><th>TEMPO VIVO</th><th>OURO DOADO</th><th>ABATES</th></tr></thead><tbody>${pool.map(p=>`<tr><td>${p.name}</td><td>${Math.round(p.stats.damageDealt).toLocaleString('pt-BR')}</td><td>${Math.round(p.stats.deaths||0)}</td><td>${formatRunTime(p.stats.aliveTime)}</td><td>${Math.round(p.stats.donated)}</td><td>${p.stats.kills}</td></tr>`).join('')}</tbody></table><div class="mp-result-highlights"><span>MAIOR DANO • ${damage.name}</span><span>MAIS TEMPO VIVO • ${survive.name}</span><span>MAIOR DOADOR • ${donor.name}</span></div>${fundPanel}`;
  box.classList.remove('hidden');gameover.querySelector('.gameover-card')?.classList.add('mp-coop-defeat');
  againBtn?.classList.add('hidden');
  $('death-cause').textContent=MP.online?.authoritative?`Toda a tripulação afundou na onda ${wave}. Volte ao menu para iniciar uma nova viagem com o mesmo grupo.`:`Toda a tripulação afundou na onda ${wave}.`;
  if(MP.online&&$('revive-btn')){$('revive-btn').disabled=true;$('revive-btn').classList.add('hidden');}
}

/* ---------- boss ouro sem kill-steal ---------- */
defeatBoss=function(e){
  if(!MP.enabled)return solo.defeatBoss(e);if(e.destroyed)return;const previousContext=MP.context;const killer=activeMpPlayer()||simulationPrimary(),reward=bossFight?.cfg?.gold||0,endless=!!bossFight?.endless;const ret=solo.defeatBoss(e);syncPlayer(killer);
  // A recompensa em ouro é compartilhada sem kill-steal; mortos conectados continuam recebendo sua parte.
  killer.gold=Math.max(0,killer.gold-reward);const active=connectedPlayers(),share=Math.floor(reward/Math.max(1,active.length)),rest=reward-share*Math.max(1,active.length);active.forEach((p,i)=>p.gold+=share+(i<rest?1:0));
  // Em almirantes infinitos, o reparo de 20 HP é um prêmio de tripulação, não só de quem deu o último tiro.
  if(endless)for(const p of active)if(p!==killer&&p.alive)withPlayer(p,()=>healBuild(20,p.entity,'endlessBoss'));
  killer.gold+=10;killer.stats.goldCollected+=10;
  // Preserve the killer's context until the enclosing damage callback finishes.
  activatePlayer(killer);MP.context=previousContext;
  goldEl.textContent=String(killer.gold);updateMpHud(true);return ret;
};

/* ---------- baús, ouro individual e prioridade de saque ---------- */
spawnChest=function(x,y,meta={}){const before=chests.length,ret=solo.spawnChest(x,y,meta);if(MP.enabled&&chests.length>before){const p=MP.context;const c=chests[chests.length-1];if(p&&!meta.shared){c.ownerId=p.id;c.ownerLock=2;}}return ret;};
function awardMpChestFor(collector,chest){
  if(!collector||!chest)return {gold:0,diamonds:0};
  let amount=0,diamondGain=0;
  withPlayer(collector,()=>{
    const baseAmount=chest.tutorial?40:20+Math.floor(Math.random()*41);
    amount=Math.round(baseAmount*(hasUpgrade('lighthouse')?BUILD_BALANCE.lighthouse.gold:1));
    gold+=amount;collector.gold=gold;
    collector.stats.goldCollected=(collector.stats.goldCollected||0)+amount;
    sfx('collect',.30,40);flashUiReward(goldCard||goldEl);addLootText(chest.x,chest.y-28,`+${amount} OURO`,'gold');
    const factor=chest.tutorial?1:(chest.diamondFactor??1),roll=chest.tutorial?1:Math.random();
    if(roll<.02*factor){diamondGain=5;addLootText(chest.x,chest.y-48,'+5 DIAMANTES','diamond');sfx('achievement',.32,80);burst(chest.x,chest.y,'splash',22);}
    else if(roll<(.02+.20)*factor){diamondGain=1;addLootText(chest.x,chest.y-48,'+1 DIAMANTE','diamond');sfx('upgrade',.25,80);burst(chest.x,chest.y,'splash',18);}
    else burst(chest.x,chest.y,'boom',12);
    collector.stats.diamondsCollected=(collector.stats.diamondsCollected||0)+diamondGain;
    const repairChance=hasUpgrade('loot-instinct')?(window.ReiEndgame?.hasSpecialization?.('pirate-scavenger')?.40:BUILD_BALANCE.scavenger.repairChance):.05;
    if(Math.random()<repairChance&&player&&player.hp<player.maxHp){const healed=Math.min(20,player.maxHp-player.hp);healBuild(healed,player,'chest');addLootText(chest.x,chest.y-68,`KIT DE REPARO +${healed}`,'heal');impactEffects.push({type:'heal',x:chest.x,y:chest.y,life:0,max:.72,seed:Math.random()*10});sfx('heal',.48,120);for(let i=0;i<16;i++){const a=Math.random()*Math.PI*2,sp=35+Math.random()*75;addParticle(chest.x,chest.y,i%2?'#76e6a1':'#c8ffd9',1.8+Math.random()*2.5,.45+Math.random()*.35,Math.cos(a)*sp,Math.sin(a)*sp-20,.94);}}
  });
  const ownsPermanentMeta=!MP.online||collector.id===MP.localSlot;
  if(ownsPermanentMeta){
    diamonds+=diamondGain;onVoyageChest(chest,amount,diamondGain);saveMeta?.();updateDiamondUI?.();
  }else{
    window.RDMOnline?.awardLoot?.(collector.id,{gold:amount,diamonds:diamondGain,reason:'chest'});
  }
  restorePrimary();return {gold:amount,diamonds:diamondGain};
}
updateChests=function(dt){
  if(!MP.enabled)return solo.updateChests(dt);
  for(const c of chests){
    c.life+=dt;if(c.ownerLock>0)c.ownerLock-=dt;
    if(!c.collected&&c.life>=30){c.expired=true;for(let i=0;i<7;i++)addParticle(c.x,c.y,'#9f8761',1+Math.random()*2,.35,(Math.random()-.5)*35,-10-Math.random()*28,.9);continue;}
    if(!c.collected){
      const candidates=alivePlayers().filter(p=>c.ownerLock<=0||c.ownerId==null||p.id===c.ownerId).map(p=>({p,d:Math.hypot(c.x-p.entity.x,c.y-p.entity.y)})).filter(x=>x.d<58).sort((a,b)=>a.d-b.d);
      if(candidates.length){const collector=candidates[0].p;c.collected=true;c.collectedBy=collector.id;c.opened=.01;awardMpChestFor(collector,c);updateMpHud(true);}
    }
    if(c.collected)c.opened+=dt;
  }
  chests=chests.filter(c=>!c.expired&&(!c.collected||c.opened<.55));
};

/* ---------- hazards e contatos adicionais ---------- */
function mpDamageExtraPlayersFromHazards(dt){
  for(const h of voyage.hazards){if(!h.mpHits)h.mpHits=new Set();
    for(const p of alivePlayers()){if(p===simulationPrimary())continue;const ent=p.entity,skin=playerSkinMeta?.(ent.skinId||selectedSkin)||{},off=skin.hitboxY??43,ph={x:ent.x,y:ent.y+off,r:skin.hitboxR||28};
      if(h.kind==='vortex'&&h.life>h.delay&&h.life<h.delay+3.2){const dx=h.x-ph.x,dy=h.y-ph.y,d=Math.hypot(dx,dy)||1;if(d<190&&d>20){ent.x=clamp(ent.x+dx/d*24*dt,55,W-55);ent.y=clamp(ent.y+dy/d*24*dt,95,H-55);}const key=`v:${p.id}:${Math.floor(h.life)}`;if(d<h.r+ph.r*.68&&!h.mpHits.has(key)){h.mpHits.add(key);withPlayer(p,()=>hitPlayer(h.damage,h,'area'));}}
      else if(h.kind==='soulwall'&&h.life>=h.delay){const y=-50+(h.life-h.delay)*(h.speed||170),hit=Math.abs(ph.y-y)<44&&Math.abs(ph.x-h.gap)>h.width/2-18;if(hit&&!h.mpHits.has(p.id)){h.mpHits.add(p.id);withPlayer(p,()=>hitPlayer(h.damage,h,'area'));}}
      else if(h.kind==='mine'){if(!h.hit&&h.life>=h.delay&&Math.hypot(ph.x-h.x,ph.y-h.y)<h.r+ph.r*.62){h.hit=true;h.mpHits.add(p.id);withPlayer(p,()=>hitPlayer(h.damage,h,'area'));sfx('explosion',.55,90);burst(h.x,h.y,'boom',18);}}
      else if(h.hit&&!h.mpHits.has(p.id)&&h.life<h.delay+1.22){let hit=false;if(h.kind==='barrage')hit=h.axis==='x'?Math.abs(ph.y-h.y)<h.r+ph.r*.68:Math.abs(ph.x-h.x)<h.r+ph.r*.68;else if(!['vortex','mine'].includes(h.kind))hit=Math.hypot(ph.x-h.x,ph.y-h.y)<h.r+ph.r*.68;if(hit){h.mpHits.add(p.id);withPlayer(p,()=>hitPlayer(h.damage,h,'area'));}}
    }
  }
}
function mpEnemyContacts(){
  for(const e of enemies){if(!enemyIsAlive(e)||e.isBoss)continue;for(const p of alivePlayers()){const skin=playerSkinMeta?.(p.entity.skinId||selectedSkin)||{},off=skin.hitboxY??43,r=skin.hitboxR||28;if(Math.hypot(p.entity.x-e.x,p.entity.y+off-e.y)<e.r*.62+r*.72)withPlayer(p,()=>hitPlayer(e.rammingThisStep?23:e.role==='blocker'?Math.max(6,difficulty().damage*.55):difficulty().damage,e,'contact'));}}
}

/* ---------- alma do morto-vivo pode sustentar aliados ---------- */
function mpShareSouls(){
  const undead=connectedPlayers().find(p=>p.build?.path==='undead'&&p.build.souls?.length);if(!undead)return;
  withPlayer(undead,()=>{for(const soul of buildRun.souls){if(soul.collected)continue;for(const ally of alivePlayers()){if(soul.collected)break;if(ally.id===undead.id)continue;const before=ally.entity.hp;if(collectSoul(soul,ally.entity)&&ally.entity.hp>before){ally.stats.received+=ally.entity.hp-before;addLootText(ally.entity.x,ally.entity.y-48,`ALMA +${Math.round(ally.entity.hp-before)}`,'heal');}}}buildRun.souls=buildRun.souls.filter(s=>s.life>0&&!s.collected);});
}

/* Eventos de mar alternam o alvo entre capitães vivos, em vez de sempre mirar o P1. */
updateVoyage=function(dt){
  if(!MP.enabled)return solo.updateVoyage(dt);
  const alive=alivePlayers();if(!alive.length)return solo.updateVoyage(dt);
  const target=alive[(campaign.eventCount||0)%alive.length]||alive[0];
  return withPlayer(target,()=>solo.updateVoyage(dt));
};

/* ---------- atualização compartilhada ---------- */
function startReplicaEnemyDeathFx(e){
  if(!e||e.__deathFxStarted)return;
  e.__deathFxStarted=true;
  const boss=!!e.isBoss,ghost=e.bossKind==='ghostKing';
  sfx('sink',boss?1.05:.72,boss?120:70);
  burst(e.x,e.y,boss?'boom':'boom',boss?52:24);
  ripples.push({x:e.x,y:e.y+(boss?54:18),life:0,max:boss?1.35:.9});
  const count=boss?34:12;
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2,sp=(boss?70:30)+Math.random()*(boss?190:90);
    addParticle(e.x+(Math.random()-.5)*(boss?100:36),e.y+(Math.random()-.5)*(boss?90:30),
      ghost?(i%2?'#9effd5':'#c9ffea'):(i%3===0?'#6d4636':'#d8edf0'),
      2+Math.random()*(boss?5:3),.55+Math.random()*.7,Math.cos(a)*sp,Math.sin(a)*sp-40,.91);
  }
  if(boss)shake=Math.max(shake,13);
}
function startPlayerDeathFx(p){
  if(!p?.entity||p.deathFx)return;
  const e=p.entity;
  p.deathFx={life:0,max:1.45,x:e.x,y:e.y,seed:Math.random()*10,smokeClock:0};
  burst(e.x,e.y+20,'splash',26);
  ripples.push({x:e.x,y:e.y+28,life:0,max:1.15});
  for(let i=0;i<12;i++)addParticle(e.x+(Math.random()-.5)*44,e.y+(Math.random()-.5)*28,i%3===0?'#704536':'#d8edf0',2+Math.random()*3,.55+Math.random()*.5,(Math.random()-.5)*70,-30-Math.random()*55,.92);
  sfx('sink',.56,120);
}
function updatePlayerDeathFx(dt){
  for(const p of MP.players){
    const fx=p.deathFx;if(!fx)continue;
    fx.life+=dt;fx.smokeClock-=dt;
    if(fx.life<fx.max*.85&&fx.smokeClock<=0){
      fx.smokeClock=.11;
      addParticle(p.entity.x+(Math.random()-.5)*30,p.entity.y-10+(Math.random()-.5)*18,'#59656a',3+Math.random()*3,.65,(Math.random()-.5)*24,-35-Math.random()*25,.94);
      foam.push({x:p.entity.x+(Math.random()-.5)*34,y:p.entity.y+34+(Math.random()-.5)*10,life:.55,max:.55,size:4+Math.random()*4});
    }
    if(fx.life>=fx.max)p.deathFx=null;
  }
}
function drawPlayerDeathFx(p){
  const fx=p?.deathFx;if(!fx||!p.entity)return;
  const q=clamp(fx.life/fx.max,0,1),e=p.entity,dir=(p.id%2?1:-1);
  ctx.save();
  ctx.translate(e.x,e.y);
  ctx.rotate(dir*q*.34);
  ctx.scale(1-q*.12,1-q*.08);
  ctx.translate(-e.x,-e.y);
  ctx.globalAlpha=Math.max(0,1-q*.86);
  withPlayer(p,()=>solo.drawShip(e,true,1,q*34));
  ctx.restore();
  if(q<.72)drawNameplate(p,e.x,e.y+q*20);
}

function updateReplicaVisuals(dt){
  // Efeitos puramente visuais não vêm nos snapshots. Eles precisam envelhecer localmente;
  // caso contrário partículas antigas ficam congeladas para sempre no navegador convidado.
  lootTexts.forEach(l=>{l.y+=l.vy*dt;l.life-=dt;});lootTexts=lootTexts.filter(l=>l.life>0);
  updateParticles(dt);
  ripples.forEach(r=>{r.life+=dt;});ripples=ripples.filter(r=>r.life<r.max);
  foam.forEach(f=>{f.life-=dt;});foam=foam.filter(f=>f.life>0);
  if(typeof updateBeamEffects==='function')updateBeamEffects(dt);
  impactEffects.forEach(e=>{e.life+=dt;});impactEffects=impactEffects.filter(e=>e.life<e.max&&(e.type!=='flame'||(e.target&&e.target.burn&&enemyIsAlive(e.target))));
  shake*=Math.pow(.035,dt);
}
function ensureReplicaHud(){
  if(!MP.enabled||!MP.online?.replica)return;
  if(['transition','play','paused'].includes(state)){
    const q=state==='transition'?smooth(clamp(((transition||0)-3.25)/.85,0,1)):1;
    if(q>0)revealHud(q);
    document.querySelector('#hud .hud-ribbon')?.classList.add('hidden');
    $('upgrade-strip')?.classList.add('hidden');
    $('mp-hud-ribbon')?.classList.remove('hidden');
  }
}
function updateReplicaBossEntranceFx(dt){
  if(!bossFight?.intro){MP.replicaBossFx=null;return;}
  const e=enemies.find(x=>x?.isBoss&&!x?.destroyed);if(!e)return;
  let fx=MP.replicaBossFx;
  if(!fx||fx.kind!==bossFight.kind){
    fx=MP.replicaBossFx={kind:bossFight.kind,x:e.x,y:e.y,clock:0,ripple:0,impact:false,impact2:false};
    shake=Math.max(shake,11);sfx('boss-entry',1,500);
    notifyVoyage?.('CHEFE À VISTA',bossFight?.cfg?.name||'Uma presença colossal corta o horizonte.','#f1d28a',4.6);
    for(let i=0;i<3;i++)ripples.push({x:e.x,y:e.y+70+i*12,life:0,max:1.15+i*.15,boss:true});
  }
  const dx=e.x-fx.x,dy=e.y-fx.y,len=Math.hypot(dx,dy)||1,dirX=dx/len,dirY=dy/len;fx.x=e.x;fx.y=e.y;fx.clock-=dt;fx.ripple-=dt;
  if(fx.clock<=0){fx.clock=.045;const bx=e.x-dirX*82+(Math.random()-.5)*76,by=e.y-dirY*70+72+(Math.random()-.5)*20;foam.push({x:bx,y:by,life:.85,max:.85,size:5+Math.random()*8});for(let i=0;i<3;i++)addParticle(bx+(Math.random()-.5)*42,by,bossFight.kind==='ghostKing'?'#9af0cc':'#e5fbff',2+Math.random()*3.5,.48+Math.random()*.3,-dirX*(35+Math.random()*75)+(Math.random()-.5)*32,-dirY*(35+Math.random()*75)-25-Math.random()*35,.91);}
  if(fx.ripple<=0){fx.ripple=.17;ripples.push({x:e.x-dirX*60,y:e.y-dirY*45+76,life:0,max:1.05,boss:true});}
  const progress=bossFight.introMax?1-bossFight.intro/bossFight.introMax:0;
  if(!fx.impact&&progress>.34){fx.impact=true;shake=Math.max(shake,8);burst(e.x,e.y+70,'splash',26);}
  if(!fx.impact2&&progress>.72){fx.impact2=true;shake=Math.max(shake,13);burst(e.x,e.y+78,'splash',38);sfx('wreck',.52,250);}
}
function updateReplicaClient(dt){
  // Convidados NÃO simulam ondas, IA, dano, baús ou RNG. Eles apenas apresentam o estado
  // autoritativo recebido do host e fazem previsão do próprio movimento entre snapshots.
  if(!['paused','upgrade','guide','collection','bossreward','victory','gameover'].includes(state))t+=dt;
  updateReplicaVisuals(dt);updatePlayerDeathFx(dt);updateReplicaBossEntranceFx(dt);
  if(state==='transition'){
    transition=Math.min(4.25,(transition||0)+dt);ensureReplicaHud();restorePrimary();updateMpHud();return;
  }
  if(state!=='play'){restorePrimary();updateMpHud();return;}
  ensureReplicaHud();
  const local=playerById(MP.localSlot);
  if(local?.connected!==false&&local.alive)predictReplicaPlayer(local,dt);
  // Extrapolação visual curta para aliados e entidades do mundo. A posição volta suavemente
  // para o snapshot autoritativo assim que ele chega.
  for(const p of connectedPlayers()){
    if(p===local||!p.alive||!p.entity)continue;
    const e=p.entity;e.prevX=e.x;e.prevY=e.y;
    if(Number.isFinite(e.__netTargetX)&&Number.isFinite(e.__netTargetY)){
      e.__netTargetX+=Number(e.__netTargetVX||0)*dt;e.__netTargetY+=Number(e.__netTargetVY||0)*dt;
      const jitter=Math.max(0,Number(window.RDMOnline?.state?.jitter)||0),rate=jitter>18?18:jitter>9?23:30;
      const k=1-Math.exp(-dt*rate);e.x=clamp(e.x+(e.__netTargetX-e.x)*k,55,W-55);e.y=clamp(e.y+(e.__netTargetY-e.y)*k,95,H-55);
      e.vx=Number(e.__netTargetVX)||0;e.vy=Number(e.__netTargetVY)||0;
    }else{e.x=clamp(e.x+(e.vx||0)*dt,55,W-55);e.y=clamp(e.y+(e.vy||0)*dt,95,H-55);}
    e.bob=(e.bob||0)+dt*3;
  }
  for(const e of enemies){
    e.prevX=e.x;e.prevY=e.y;
    if(Number(e.sinking)>0||e.destroyed){
      e.sinking=Math.max(.01,Number(e.sinking)||.01)+dt;
      e.vx=(Number(e.vx)||0)*Math.pow(.035,dt);e.vy=(Number(e.vy)||0)*Math.pow(.035,dt);
      continue;
    }
    if(Number.isFinite(e.__netTargetX)&&Number.isFinite(e.__netTargetY)){
      e.__netTargetX+=Number(e.__netTargetVX||0)*dt;e.__netTargetY+=Number(e.__netTargetVY||0)*dt;
      const jitter=Math.max(0,Number(window.RDMOnline?.state?.jitter)||0),rate=jitter>18?16:jitter>9?21:27;
      const k=1-Math.exp(-dt*rate);e.x+=(e.__netTargetX-e.x)*k;e.y+=(e.__netTargetY-e.y)*k;e.vx=Number(e.__netTargetVX)||0;e.vy=Number(e.__netTargetVY)||0;
    }else{if(Number.isFinite(e.vx))e.x+=(e.vx||0)*dt;if(Number.isFinite(e.vy))e.y+=(e.vy||0)*dt;}
  }
  for(const list of [shots,enemyShots])for(const q of list){
    q.prevX=q.x;q.prevY=q.y;
    q.x+=(Number(q.vx)||0)*dt;q.y+=(Number(q.vy)||0)*dt;
    if(Number.isFinite(q.__netTargetX)&&Number.isFinite(q.__netTargetY)){
      q.__netTargetX+=Number(q.__netTargetVX||0)*dt;q.__netTargetY+=Number(q.__netTargetVY||0)*dt;
      const dx=q.__netTargetX-q.x,dy=q.__netTargetY-q.y,d=Math.hypot(dx,dy);
      if(d>1){
        const k=1-Math.exp(-dt*(d>180?22:14)),maxStep=(d>180?420:170)*dt,mag=Math.max(.001,d);
        const step=Math.min(d*k,maxStep);
        q.x+=dx/mag*step;q.y+=dy/mag*step;
      }
      q.vx=Number(q.__netTargetVX)||q.vx;q.vy=Number(q.__netTargetVY)||q.vy;
    }
    q.life=Math.max(0,(q.life??1)-dt);
  }
  restorePrimary();updateMpHud();
}
function ensureMpBossProgress(dt){
  if(!MP.enabled||MP.online?.replica||!bossFight?.defeated||wave===50)return;
  bossFight.mpDefeatAge=(bossFight.mpDefeatAge||0)+dt;
  // Proteção contra qualquer race do timer/DOM: um chefe derrotado nunca pode prender a viagem.
  if(state==='play'&&bossFight.mpDefeatAge>4.35){
    bossDefeatTimer=-1;bossHpWrap?.classList.add('hidden');
    showBossReward(bossFight.kind);
  }
  if(state==='bossreward'&&bossRewardScreen?.classList.contains('hidden'))bossRewardScreen.classList.remove('hidden');
}
update=function(dt){
  if(!MP.enabled)return solo.update(dt);
  if(MP.online?.replica)return updateReplicaClient(dt);
  const primary=simulationPrimary();restorePrimary();MP.worldTick=true;solo.update(dt);MP.worldTick=false;if(primary)syncPlayer(primary);ensureMpBossProgress(dt);
  if(primary&&!primary.alive){primary.entity.hp=0;primary.entity.vx=0;primary.entity.vy=0;}
  if(['transition','play','upgrade','specialization'].includes(state))for(const p of connectedPlayers())if(p!==primary&&p.build)p.build.elapsed=(p.build.elapsed||0)+dt;
  if(state==='play'){
    // Outros jogadores executam somente sua simulação pessoal; mundo/ondas avançam uma única vez.
    const extras=connectedPlayers().filter(p=>p!==primary).sort((a,b)=>(a.build?.path==='undead'?1:0)-(b.build?.path==='undead'?1:0));for(const p of extras)updateExtraPlayer(p,dt);
    if(primary)primary.stats.aliveTime+=primary.alive?dt:0;
    mpShareSouls();mpDamageExtraPlayersFromHazards(dt);mpEnemyContacts();
  }
  restorePrimary();updateMpHud();
};

/* ---------- desenho de todos os capitães no mesmo oceano ---------- */
function drawNameplate(p,x,y){ctx.save();ctx.textAlign='center';ctx.font='bold 9px monospace';ctx.fillStyle=p.connected===false?'#6f7b7f':p.alive?'#effbff':'#89969a';ctx.shadowColor='#001016';ctx.shadowBlur=4;ctx.fillText(p.name,x,y-96);ctx.restore();}
// A chamada externa do render solo desenha a aura antes/depois do navio primário.
// Em coop ela só pode existir enquanto esse capitão estiver vivo.
drawClassAura=function(layer='under'){if(!MP.enabled)return solo.drawClassAura(layer);const p=simulationPrimary();if(!p?.alive||p.connected===false)return;return withPlayer(p,()=>solo.drawClassAura(layer));};
drawShip=function(ship,isPlayer=false,alpha=1,offsetY=0){
  if(!MP.enabled||!isPlayer||MP.drawingExtras)return solo.drawShip(ship,isPlayer,alpha,offsetY);
  const primary=simulationPrimary();MP.drawingExtras=true;
  if(primary?.connected!==false){
    if(primary.alive){solo.drawShip(primary.entity,true,alpha,offsetY);drawNameplate(primary,primary.entity.x,primary.entity.y);}
    else if(primary.deathFx)drawPlayerDeathFx(primary);
  }
  for(const p of MP.players){
    if(p===primary||p.connected===false)continue;
    if(p.alive)withPlayer(p,()=>{solo.drawClassAura('under');solo.drawShip(p.entity,true,p.entity.inv>0&&Math.floor(t*18)%2===0?.35:1,0);solo.drawClassAura('over');drawNameplate(p,p.entity.x,p.entity.y);});
    else if(p.deathFx)drawPlayerDeathFx(p);
  }
  MP.drawingExtras=false;restorePrimary();
};
drawBuildPools=function(){if(!MP.enabled)return solo.drawBuildPools();for(const p of connectedPlayers())if(p.alive||p.build?.pools?.length)withPlayer(p,()=>solo.drawBuildPools());restorePrimary();};
drawBuildEffects=function(){if(!MP.enabled)return solo.drawBuildEffects();const primary=simulationPrimary();if(primary?.alive)withPlayer(primary,()=>solo.drawBuildEffects());for(const p of connectedPlayers())if(p!==primary&&p.alive)withPlayer(p,()=>solo.drawBuildEffects());restorePrimary();};

/* ---------- HUD ---------- */
function updateMpHud(force=false){
  if(!MP.enabled||window.RDMOnline?.serverSimulation)return;const wrap=$('mp-hud-ribbon');if(!wrap)return;
  const key=MP.players.map(p=>`${p.alive}:${p.connected!==false}:${Math.ceil(p.entity.hp)}:${Math.ceil(p.entity.maxHp)}:${Math.floor(p.gold)}:${p.build?.path||'-'}:${p.name}`).join('|')+`|w${wave}`;
  if(!force&&key===MP.lastHudKey)return;MP.lastHudKey=key;
  wrap.innerHTML=MP.players.map((p,i)=>{const hp=Math.max(0,p.entity.hp/p.entity.maxHp*100),path=p.build?.path?BUILD_PATHS[p.build.path]:null,status=p.connected===false?'SAIU DA VIAGEM':p.alive?(path?`${path.symbol} ${path.name}`:p.title):'☠ AFUNDADO';return `<article class="mp-hud-card ${i===MP.localSlot?'local':''} ${p.alive&&p.connected!==false?'':'dead'}"><img src="${pPortrait(p)}" alt=""><div class="mp-hud-ident"><b>${p.name}</b><small>${status}</small></div><div class="mp-hud-health"><div class="bar"><i style="width:${p.connected===false?0:hp}%;${path?`background:${path.color}`:''}"></i></div><span>${p.connected===false?'—':`${Math.ceil(Math.max(0,p.entity.hp))}/${Math.round(p.entity.maxHp)}`}</span></div><div class="mp-hud-gold">◉ ${Math.floor(p.gold)}</div></article>`;}).join('')+`<div class="mp-hud-wave"><span>ONDA</span><b>${wave}</b></div>`;
}

/* ---------- salário de cada build ---------- */
recordWaveComplete=function(){
  if(!MP.enabled)return solo.recordWaveComplete();
  const primary=simulationPrimary(),aliveAtFinish=alivePlayers().map(p=>p.id),connectedAtFinish=connectedPlayers().map(p=>p.id),paths=connectedPlayers().map(p=>p.build?.path).filter(Boolean),events=[...(campaign.events||[])];
  if(aliveAtFinish.length===1){const last=playerById(aliveAtFinish[0]);if(last)last.stats.lastStandWaves=(last.stats.lastStandWaves||0)+1;}
  const caller=activeMpPlayer(),previousContext=MP.context;
  if(caller)syncPlayer(caller);
  const ret=withPlayer(primary,()=>solo.recordWaveComplete());
  for(const p of connectedPlayers())if(p!==primary)withPlayer(p,()=>buildWaveReward());
  if(caller){activatePlayer(caller);MP.context=previousContext;}else restorePrimary();
  window.RDMOnline?.sendMilestone?.('waveComplete',{wave,aliveSlots:aliveAtFinish,connectedSlots:connectedAtFinish,paths,events});
  return ret;
};

/* ---------- estaleiro cooperativo ---------- */
function classReservations(exceptId=-1){return new Map(shopParticipants().filter(p=>p.id!==exceptId).map(p=>[p.build.pendingPath||p.build.path,p.id]).filter(([k])=>k));}
function allClassesSelected(){const active=shopParticipants();return active.length>0&&active.every(p=>!!(p.build.pendingPath||p.build.path));}
function allFirstTalentsSelected(){const active=shopParticipants();return active.length>0&&active.every(p=>!!p.build.path);}
function eligibleShopPlayers(){return shopParticipants();}
function mpOpenShop(){
  if(!MP.enabled)return solo.openUpgradeScreen();state='upgrade';mouse.down=false;keys.clear();MP.codes.clear();stopAllSfx();upgradeScreen.classList.add('hidden');$('specialization-screen')?.classList.add('hidden');$('mp-shop-screen').classList.remove('hidden');
  $('mp-shop-content').__shopHtml=null;$('mp-shop-tabs').__shopHtml=null;
  MP.selectedShopPlayer=MP.online?MP.localSlot:(eligibleShopPlayers()[0]?.id??connectedPlayers()[0]?.id??0);
  MP.shop={phase:wave===5&&!shopParticipants().every(p=>p.build.path)?'class':'normal',revives:Object.fromEntries(shopParticipants().filter(p=>!p.alive).map(p=>[p.id,0]))};
  for(const p of shopParticipants()){p.ready=false;p.shopRerolled=false;p.shopRepaired=false;p.shopChoices=[];p.build.shop={rerolled:false,repaired:false};}
  if(MP.shop.phase==='normal')prepareNormalChoices();
  // Especializações continuam individuais no infinito, mas aparecem antes das compras normais.
  if(MP.shop.phase==='normal'&&window.ReiEndgame?.mpListSpecs&&shopParticipants().some(p=>withPlayer(p,()=>window.ReiEndgame.mpListSpecs().length>0&&(wave===70||wave===90)))){
    MP.shop.phase='spec';for(const p of shopParticipants())p.specChoices=withPlayer(p,()=>window.ReiEndgame.mpListSpecs().slice().sort(()=>Math.random()-.5).slice(0,2));
  }
  renderMpShop();
};

openUpgradeScreen=mpOpenShop;
function authoritativeShopProfile(){
  const p=playerById(MP.localSlot);if(document.hidden||!p)return null;
  const e=p.entity||{};
  return {
    gold:Math.max(0,Math.floor(Number(p.gold)||0)),
    hp:Number(e.hp)||0,maxHp:Number(e.maxHp)||100,
    speedMult:Number(e.speedMult)||1,damageMult:Number(e.damageMult)||1,
    fireRateMult:Number(e.fireRateMult)||1,incomingDamageMult:Number(e.incomingDamageMult)||1,
    doubleShot:!!e.doubleShot,flame:!!e.flame,explosive:!!e.explosive,piercing:!!e.piercing,
    classPath:p.build?.pendingPath||p.build?.path||null
  };
}
MP.exportShopProfile=authoritativeShopProfile;
MP.openAuthoritativeShop=(serverShop)=>{
  if(!MP.enabled||!MP.online?.authoritative||!serverShop?.open)return false;
  const rev=Number(serverShop.revision)||0,readyKey=JSON.stringify(serverShop.ready||{});
  const fresh=!MP.shop||Number(MP.shop.__serverRevision)!==rev;
  const readyChanged=readyKey!==MP.serverShopReadyKey;
  if(fresh){
    mpOpenShop();
    if(MP.shop)MP.shop.__serverRevision=rev;
  }else{
    state='upgrade';
    $('mp-shop-screen')?.classList.remove('hidden');
  }
  MP.serverShop=netRevive(serverShop);MP.serverShopReadyKey=readyKey;
  for(const p of MP.players){
    if(serverShop.ready&&Object.prototype.hasOwnProperty.call(serverShop.ready,p.id))p.ready=!!serverShop.ready[p.id];
  }
  if(fresh||readyChanged)renderMpShop();
  updateMpHud(true);return true;
};
MP.closeAuthoritativeShop=()=>{
  if(!MP.enabled||!MP.online?.authoritative)return false;
  $('mp-shop-screen')?.classList.add('hidden');MP.serverShop=null;MP.serverShopReadyKey='';MP.shop=null;
  return true;
};
MP.applyAuthoritativeShopState=(serverShop,players=[])=>{
  if(Array.isArray(players))for(const sp of players){
    const p=playerById(Number(sp.id));if(!p)continue;
    if(sp.ready!==undefined)p.ready=!!sp.ready;
    if(sp.shopClassPath&&p.build&&!p.build.path&&p.id!==MP.localSlot)p.build.pendingPath=sp.shopClassPath;
  }
  if(serverShop?.open)return MP.openAuthoritativeShop(serverShop);
  MP.closeAuthoritativeShop();return true;
};

function prepareNormalChoices(){for(const p of MP.players){if(p.connected===false&&p.resumeExpired===true){p.shopChoices=[];continue;}p.shopChoices=withPlayer(p,()=>buildUpgradeChoices());}}
function renderMpShopTabs(){const tabs=$('mp-shop-tabs');if(MP.online)MP.selectedShopPlayer=MP.localSlot;const html=MP.players.map(p=>`<button data-mp-tab="${p.id}" class="${p.id===MP.selectedShopPlayer?'active':''} ${p.ready?'ready':''} ${p.alive&&p.connected!==false?'':'dead'}" ${MP.online&&p.id!==MP.localSlot?'disabled':''}>${p.name}<br><small>${p.connected===false?'SAIU':`${pClassName(p)} • ${Math.floor(p.gold)} ouro`}</small></button>`).join('');if(tabs.__shopHtml===html)return;tabs.__shopHtml=html;tabs.innerHTML=html;if(!MP.online)tabs.querySelectorAll('[data-mp-tab]').forEach(b=>b.onclick=()=>{MP.selectedShopPlayer=Number(b.dataset.mpTab);renderMpShop();});}
function renderClassPhase(p){
  const reserved=classReservations(p.id),participants=shopParticipants();
  const status=participants.map(pl=>{const path=pl.build.pendingPath||pl.build.path,bp=path&&BUILD_PATHS[path],temp=pl.connected===false;return `<span class="mp-class-status ${path?'picked':''} ${temp?'temporarily-away':''}" style="--class-color:${bp?.color||'#607780'}"><i></i><b>${pl.name}</b><small>${path?`${bp.symbol} ${bp.name}`:temp?'DESCONECTADO • escolha reservada por 30s':'ESCOLHENDO...'}</small></span>`;}).join('');
  const cards=Object.values(CLASS_CHOICES).map(c=>{const by=reserved.get(c.path),mine=p.build.pendingPath===c.path,bp=BUILD_PATHS[c.path],owner=by!=null?playerById(by):null,u={id:`class-${c.path}`,path:c.path};return `<button class="upgrade-card common path-${c.path} mp-choice-card mp-class-card ${mine?'selected':''} ${by!=null?'occupied':''}" data-mp-class="${c.path}" ${by!=null?'disabled':''} style="--class-color:${bp.color}"><div class="build-path-label" style="color:${bp.color}">${bp.symbol} ${bp.name}</div><div class="upgrade-rarity">CAMINHO DE CLASSE</div><div class="upgrade-icon">${buildUpgradeIcon(u)}</div><h3>${c.name}</h3><div class="upgrade-desc">${c.desc}</div><div class="upgrade-bottom"><span class="upgrade-cost">${mine?'CONFIRMADA':'GRATUITO'}</span><span class="upgrade-tag">${by!=null?`OCUPADA • ${owner?.name||'CAPITÃO'}`:mine?'AGUARDANDO':'ESCOLHER'}</span></div></button>`;}).join('');
  return `<div class="mp-player-shop-head"><div><h3>${p.name}</h3><small>${p.alive?'CAPITÃO EM COMBATE':'☠ AFUNDADO • você ainda pode definir sua build'}</small></div><span>CLASSES ÚNICAS • TODOS ESCOLHEM ANTES DOS TALENTOS</span></div><div class="mp-class-roster">${status}</div><div class="mp-class-grid">${cards}</div>`;
}
function mpUpgradeCard(p,u,mode='buy'){
  const cost=withPlayer(p,()=>effectiveUpgradeCost(u)),owned=p.upgrades.has(u.id),first=mode==='first',can=first?!owned:(!owned&&p.gold>=cost),attr=first?`data-mp-first="${u.id}"`:`data-mp-buy="${u.id}"`;
  return `<button class="upgrade-card ${u.cls} path-${u.path} mp-upgrade-card" ${attr} ${can?'':'disabled'}><div class="build-path-label" style="color:${BUILD_PATHS[u.path].color}">${BUILD_PATHS[u.path].symbol} ${BUILD_PATHS[u.path].name}</div><div class="upgrade-rarity">${u.rarity}</div><div class="upgrade-icon">${buildUpgradeIcon(u)}</div><h3>${u.name}</h3><div class="upgrade-desc">${withPlayer(p,()=>upgradeDescription(u))}</div><div class="upgrade-bottom"><span class="upgrade-cost">${owned?'ADQUIRIDA':first?'GRATUITO':`<i class="gold-coin"></i> ${cost} OURO`}</span><span class="upgrade-tag">${owned?'CONCLUÍDA':first?'ESCOLHER TALENTO':'COMPRAR'}</span></div></button>`;
}
function renderTalentPhase(p){return `<div class="mp-player-shop-head"><div><h3>${p.name}</h3><small>PRIMEIRO TALENTO DA CLASSE</small></div><span>${BUILD_PATHS[p.build.pendingPath||p.build.path]?.symbol||''} ${BUILD_PATHS[p.build.pendingPath||p.build.path]?.name||''}</span></div>${p.build.path?'<div class="mp-service-panel mp-wait-panel"><h4>ESCOLHA CONCLUÍDA</h4><p>Aguardando os outros capitães escolherem seu primeiro talento.</p></div>':`<div class="mp-upgrade-grid">${p.shopChoices.map(u=>mpUpgradeCard(p,u,'first')).join('')}</div>`}`;}
function upgradeCard(p,u){return mpUpgradeCard(p,u,'buy');}
function renderNormalPhase(p){
  const deadNotice=!p.alive?`<div class="mp-service-panel mp-dead-shop-note"><h4>☠ CAPITÃO AFUNDADO</h4><p>Você continua participando do estaleiro: pode comprar melhorias, trocar ofertas, escolher especializações e marcar pronto. Não pode doar ouro, contribuir para o próprio revive nem reparar o casco até voltar ao mar.</p><div class="mp-revive-progress"><i style="width:${Math.min(100,(MP.shop.revives[p.id]||0)/10)}%"></i></div><p>${MP.shop.revives[p.id]||0} / 1000 ouro para seu revive</p></div>`:'';
  const services=p.alive?`<div class="mp-service-panel"><h4>SERVIÇOS</h4><div class="mp-service-buttons"><button data-mp-repair ${p.shopRepaired||p.gold<BUILD_BALANCE.port.repairCost||p.entity.hp>=p.entity.maxHp?'disabled':''}>REPARAR +${BUILD_BALANCE.port.repairHeal} • ${BUILD_BALANCE.port.repairCost}</button><button data-mp-reroll ${p.shopRerolled||p.gold<BUILD_BALANCE.port.rerollCost?'disabled':''}>TROCAR OFERTAS • ${BUILD_BALANCE.port.rerollCost}</button></div></div>`:`<div class="mp-service-panel"><h4>SERVIÇOS DO CASCO</h4><p>Reparo bloqueado enquanto você estiver afundado.</p><div class="mp-service-buttons"><button disabled>REPARAR BLOQUEADO</button><button data-mp-reroll ${p.shopRerolled||p.gold<BUILD_BALANCE.port.rerollCost?'disabled':''}>TROCAR OFERTAS • ${BUILD_BALANCE.port.rerollCost}</button></div></div>`;
  return `<div class="mp-player-shop-head"><div><h3>${p.name}</h3><small>${p.alive?'PRONTO PARA ZARPAR':'AFUNDADO • PLANEJANDO A BUILD'}</small></div><span>${Math.floor(p.gold)} OURO • ${pClassName(p)}</span></div>${deadNotice}<div class="mp-upgrade-grid">${p.shopChoices.length?p.shopChoices.map(u=>upgradeCard(p,u)).join(''):'<div class="mp-service-panel"><h4>BUILD COMPLETA</h4><p>Não existem novas ofertas elegíveis para este capitão.</p></div>'}</div><div class="mp-services">${services}${renderTeamServices(p)}</div><button class="mp-ready-button ${p.ready?'ready':''}" data-mp-ready>${p.ready?'PRONTO ✓':'MARCAR COMO PRONTO'}</button>`;
}
function renderTeamServices(active){
  const donations=connectedPlayers().filter(x=>x.id!==active.id).map(target=>`<div class="mp-donation-row"><div><b>DOAR PARA ${target.name}</b><small> • ${Math.floor(target.gold)} ouro</small></div><div class="mp-service-buttons"><button data-mp-donate="${target.id}:100" ${!active.alive||active.gold<100?'disabled':''}>100</button><button data-mp-donate="${target.id}:500" ${!active.alive||active.gold<500?'disabled':''}>500</button><button data-mp-donate="${target.id}:max" ${!active.alive||active.gold<=0?'disabled':''}>MÁX.</button></div></div>`).join('');
  const revives=connectedPlayers().filter(x=>!x.alive&&x.id!==active.id).map(target=>{const pool=MP.shop.revives[target.id]||0,remain=Math.max(0,1000-pool);return `<div class="mp-revive-row"><div><b>REVIVER ${target.name}</b><div class="mp-revive-progress"><i style="width:${pool/10}%"></i></div><small>${pool}/1000 ouro</small></div><div class="mp-service-buttons"><button data-mp-revive="${target.id}:100" ${!active.alive||active.gold<Math.min(100,remain)?'disabled':''}>+100</button><button data-mp-revive="${target.id}:500" ${!active.alive||active.gold<Math.min(500,remain)?'disabled':''}>+500</button><button data-mp-revive="${target.id}:rest" ${!active.alive||active.gold<remain||remain<=0?'disabled':''}>PAGAR RESTO</button></div></div>`;}).join('');
  return `<div class="mp-service-panel"><h4>TRIPULAÇÃO</h4><p>Ouro só pode ser transferido no estaleiro. Revives aceitam contribuição de vários aliados.</p>${donations||'<p>Nenhum outro capitão.</p>'}${revives}</div>`;
}
function renderSpecPhase(p){
  const needs=p.specChoices?.length&&!p.build.specializationMilestones?.has?.(wave),path=p.build?.path||'marine',bp=BUILD_PATHS[path]||BUILD_PATHS.marine;
  const head=`<div class="mp-player-shop-head"><div><h3>${p.name}</h3><small>ESCOLHA DE ESPECIALIZAÇÃO</small></div><span>${bp.symbol} ${bp.name} • ONDA ${wave}</span></div>`;
  if(!needs)return head+'<div class="mp-service-panel mp-wait-panel"><h4>DECISÃO CONCLUÍDA</h4><p>Aguardando os demais capitães.</p></div>';
  const icon=buildUpgradeIcon({id:'class-'+path,path});
  const cards=p.specChoices.map(spec=>`<button class="upgrade-card epic path-${path} mp-spec-card" data-mp-spec="${spec.id}"><div class="build-path-label" style="color:${bp.color}">${bp.symbol} ${bp.name}</div><div class="upgrade-rarity">ESPECIALIZAÇÃO</div><div class="upgrade-icon">${icon}</div><h3>${spec.name}</h3><div class="upgrade-desc">${spec.desc}</div><div class="upgrade-bottom"><span class="upgrade-cost">${spec.tag||'MARCO DA BUILD'}</span><span class="upgrade-tag">ESCOLHER</span></div></button>`).join('');
  return head+`<div class="mp-upgrade-grid">${cards}</div>`;
}
function renderMpShop(){
  if(!MP.enabled||state!=='upgrade'||window.RDMOnline?.serverSimulation)return;if(MP.online)MP.selectedShopPlayer=MP.localSlot;renderMpShopTabs();const p=playerById(MP.selectedShopPlayer)||simulationPrimary()||MP.players[0],content=$('mp-shop-content');$('mp-shop-title').textContent=`ONDA ${wave} CONCLUÍDA`;$('mp-shop-wave').textContent=`ONDA ${wave}`;
  if(!p||p.connected===false){content.innerHTML='<div class="mp-service-panel"><h4>CAPITÃO FORA DA VIAGEM</h4><p>Este slot não participa mais desta sessão.</p></div>';updateMpShopFooter();return;}
  let html;if(MP.shop.phase==='class')html=renderClassPhase(p);else if(MP.shop.phase==='talent')html=renderTalentPhase(p);else if(MP.shop.phase==='firstdone')html=`<div class="mp-player-shop-head"><h3>TRIPULAÇÃO FORMADA</h3><span>CLASSES ÚNICAS CONFIRMADAS</span></div><div class="mp-service-panel"><h4>PRIMEIRAS BUILDS PRONTAS</h4><p>${connectedPlayers().map(x=>`${x.name}: ${BUILD_PATHS[x.build.path]?.name||'-'}`).join(' • ')}</p><p>A onda 6 começará quando a tripulação confirmar.</p></div>`;else if(MP.shop.phase==='spec')html=renderSpecPhase(p);else html=renderNormalPhase(p);
  if(content.__shopHtml!==html){content.__shopHtml=html;content.innerHTML=html;bindMpShopButtons(p);}
  updateMpShopFooter();
}
function bindMpShopButtons(p){
  document.querySelectorAll('[data-mp-class]').forEach(b=>b.onclick=()=>{const path=b.dataset.mpClass;if(classReservations(p.id).has(path))return;p.build.pendingPath=path;sfx('upgrade',.6);if(MP.online?.authoritative){MP.shop.phase='talent';p.shopChoices=withPlayer(p,()=>buildUpgradeChoices());}else if(allClassesSelected()){MP.shop.phase='talent';for(const pl of shopParticipants())pl.shopChoices=withPlayer(pl,()=>buildUpgradeChoices());}renderMpShop();});
  document.querySelectorAll('[data-mp-first]').forEach(b=>b.onclick=()=>{withPlayer(p,()=>applyBuildUpgrade(b.dataset.mpFirst));sfx('upgrade',.8);if(MP.online?.authoritative){p.ready=false;MP.shop.phase='firstdone';}else{p.ready=true;if(allFirstTalentsSelected()){MP.shop.phase='firstdone';for(const pl of shopParticipants())pl.ready=true;}}renderMpShop();updateMpHud(true);});
  document.querySelectorAll('[data-mp-buy]').forEach(b=>b.onclick=()=>{const u=upgradeById[b.dataset.mpBuy];if(!u)return;withPlayer(p,()=>{const cost=effectiveUpgradeCost(u);if(p.gold<cost||!applyBuildUpgrade(u.id))return;p.gold-=cost;gold=p.gold;p.build.metrics.goldSpent+=cost;});sfx('upgrade',.72);renderMpShop();updateMpHud(true);});
  document.querySelector('[data-mp-repair]')?.addEventListener('click',()=>{if(p.gold<BUILD_BALANCE.port.repairCost||p.shopRepaired)return;p.gold-=BUILD_BALANCE.port.repairCost;p.shopRepaired=true;withPlayer(p,()=>healBuild(BUILD_BALANCE.port.repairHeal,player,'port'));sfx('heal',.55);renderMpShop();updateMpHud(true);});
  document.querySelector('[data-mp-reroll]')?.addEventListener('click',()=>{if(p.gold<BUILD_BALANCE.port.rerollCost||p.shopRerolled)return;p.gold-=BUILD_BALANCE.port.rerollCost;p.shopRerolled=true;p.shopChoices=withPlayer(p,()=>buildUpgradeChoices());sfx('click',.55);renderMpShop();updateMpHud(true);});
  document.querySelectorAll('[data-mp-donate]').forEach(b=>b.onclick=()=>{const [id,raw]=b.dataset.mpDonate.split(':'),target=playerById(Number(id));if(!target||!p.alive)return;const amount=raw==='max'?Math.floor(p.gold):Math.min(Number(raw),Math.floor(p.gold));if(amount<=0)return;p.gold-=amount;target.gold+=amount;p.stats.donated+=amount;target.stats.received+=amount;sfx('collect',.26);renderMpShop();updateMpHud(true);});
  document.querySelectorAll('[data-mp-revive]').forEach(b=>b.onclick=()=>{const [id,raw]=b.dataset.mpRevive.split(':'),target=playerById(Number(id));if(!target||target.alive||!p.alive)return;const current=MP.shop.revives[target.id]||0,remain=1000-current,amount=raw==='rest'?remain:Math.min(Number(raw),remain);if(amount<=0||p.gold<amount)return;p.gold-=amount;p.stats.donated+=amount;MP.shop.revives[target.id]=current+amount;if(MP.shop.revives[target.id]>=1000)reviveAtShop(target,p);sfx('heal',.45);renderMpShop();updateMpHud(true);});
  document.querySelector('[data-mp-ready]')?.addEventListener('click',()=>{p.ready=!p.ready;sfx('ui',.4);renderMpShop();});
  document.querySelectorAll('[data-mp-spec]').forEach(b=>b.onclick=()=>{const spec=withPlayer(p,()=>window.ReiEndgame?.mpChooseSpec?.(b.dataset.mpSpec));if(spec){p.specChoices=[];sfx('upgrade',.8);}if(shopParticipants().every(x=>!x.specChoices?.length)){MP.shop.phase='normal';prepareNormalChoices();}renderMpShop();});
}
function reviveAtShop(p,contributor=null){if(p.connected===false)return;if(contributor){contributor.stats.revivesGiven=(contributor.stats.revivesGiven||0)+1;p.stats.revived=(p.stats.revived||0)+1;}p.alive=true;p.ready=false;p.entity.hp=Math.max(1,p.entity.maxHp*.70);p.entity.inv=2.4;p.entity.vx=p.entity.vy=0;const pos=spawnPoint(p.id,MP.count);p.entity.x=pos.x;p.entity.y=pos.y;p.deathAt=null;MP.shop.revives[p.id]=1000;notifyVoyage('DE VOLTA AO CONVÉS',`${p.name} foi revivido pela tripulação com 70% da vida.`,'#88ebc5',3.5);}
function updateMpShopFooter(){
  const status=$('mp-shop-status'),btn=$('mp-shop-continue'),active=shopParticipants();if(MP.shop.phase==='class'){const selected=active.filter(p=>p.build.pendingPath||p.build.path).length;status.textContent=`CLASSES • ${selected}/${active.length} escolhidas • classes repetidas são bloqueadas.`;btn.disabled=true;btn.textContent='AGUARDANDO CLASSES';}
  else if(MP.shop.phase==='talent'){const done=active.filter(p=>p.build.path).length;status.textContent=`PRIMEIRO TALENTO • ${done}/${active.length} concluídos.`;btn.disabled=true;btn.textContent='AGUARDANDO TALENTOS';}
  else if(MP.shop.phase==='firstdone'){status.textContent='Todos escolheram classes diferentes e seus primeiros talentos.';btn.disabled=false;btn.textContent='COMEÇAR ONDA 6';}
  else if(MP.shop.phase==='spec'){const left=active.filter(p=>p.specChoices?.length).length;status.textContent=`ESPECIALIZAÇÕES • ${left} capitão(ões) ainda precisam escolher.`;btn.disabled=left>0;btn.textContent=left?'AGUARDANDO ESPECIALIZAÇÕES':'SEGUIR AO ESTALEIRO';}
  else {const waiting=eligibleShopPlayers().filter(p=>!p.ready);status.textContent=waiting.length?`AGUARDANDO: ${waiting.map(p=>p.name).join(', ')}`:'Tripulação pronta para zarpar.';btn.disabled=waiting.length>0;btn.textContent=waiting.length?'AGUARDANDO A TRIPULAÇÃO':'SEGUIR VIAGEM';}
}
$('mp-shop-screen')?.addEventListener('click',e=>{
  if(!MP.enabled||!MP.online?.authoritative||MP.fullGameplay)return;
  const btn=e.target?.closest?.('button');if(!btn)return;
  if(btn.disabled)return;
  window.RDMOnline?.syncShopProfile?.();
  if(btn.hasAttribute('data-mp-ready')){
    const p=playerById(MP.localSlot);window.RDMOnline?.setShopReady?.(!!p?.ready);
  }
});
$('mp-shop-continue')?.addEventListener('click',e=>{
  if(!MP.enabled||!MP.online?.authoritative||MP.fullGameplay||state!=='upgrade')return;
  e.preventDefault();e.stopImmediatePropagation();
  window.RDMOnline?.syncShopProfile?.();
  window.RDMOnline?.setShopReady?.(true);
},true);

$('mp-shop-continue').addEventListener('click',()=>{if(!MP.enabled||state!=='upgrade')return;if(MP.shop.phase==='firstdone'){$('mp-shop-screen').classList.add('hidden');state='play';for(const p of MP.players)p.ready=false;restorePrimary();beginNextWave();updateMpHud(true);sfx('wave',.55);return;}if(MP.shop.phase==='spec'){MP.shop.phase='normal';prepareNormalChoices();renderMpShop();return;}if(MP.shop.phase!=='normal'||eligibleShopPlayers().some(p=>!p.ready))return;$('mp-shop-screen').classList.add('hidden');state='play';restorePrimary();beginNextWave();updateMpHud(true);sfx('wave',.55);});

/* ---------- especializações: helpers adicionados à API em runtime quando disponíveis ---------- */
if(window.ReiEndgame){
  // endgame.js expõe apenas o fluxo solo. Estes helpers são instalados abaixo por um pequeno patch no arquivo.
}

/* ---------- pausa coletiva e save ---------- */
openPause=function(){if(MP.enabled&&MP.online&&state!=='play'&&state!=='paused'){pauseScreen.classList.add('hidden');return false;}const ret=solo.openPause();if(MP.enabled&&state==='paused'){let tag=$('mp-pause-note');if(!tag){tag=document.createElement('p');tag.id='mp-pause-note';tag.className='mp-pause-note';tag.textContent='PAUSA COOPERATIVA • o tempo foi pausado para toda a tripulação';pauseScreen.querySelector('.pause-card')?.append(tag);}tag.classList.remove('hidden');}return ret;};
closePause=function(){return solo.closePause();};
if(window.ReiEndgame){
  const requestExitSolo=window.ReiEndgame.requestExit,saveSolo=window.ReiEndgame.saveAndExit;
  window.ReiEndgame.requestExit=()=>{if(!MP.enabled)return requestExitSolo();const modal=$('run-exit-screen'),save=$('run-save-exit'),msg=$('run-exit-message');save.disabled=true;msg.textContent='O save cooperativo será ligado junto da camada online. Nesta fase local, use Abandonar partida ou Retomar partida.';pauseScreen.classList.add('hidden');modal.classList.remove('hidden');};
  window.ReiEndgame.saveAndExit=()=>MP.enabled?false:saveSolo();
}

/* ---------- ações da tela de derrota multiplayer ----------
   game.js registra os callbacks solo antes deste arquivo carregar. Em multiplayer, capturamos
   o clique antes deles para garantir que o revive/recomeço/menu usem o estado cooperativo. */
function interceptMpGameoverAction(id,fn){
  const el=$(id);if(!el)return;
  el.addEventListener('click',ev=>{if(!MP.enabled)return;ev.preventDefault();ev.stopImmediatePropagation();fn();},true);
}
interceptMpGameoverAction('revive-btn',()=>reviveRun());
interceptMpGameoverAction('again-btn',()=>false);
interceptMpGameoverAction('menu-btn',()=>goMenu());

/* ---------- API da camada online (Fase 2) ---------- */
function netClone(value,seen=new WeakSet(),transport=false){
  if(typeof value==='number')return transport&&Number.isFinite(value)&&!Number.isInteger(value)?Math.round(value*10000)/10000:value;
  if(value==null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='function')return undefined;
  if(value instanceof Set)return {__set:[...value].map(v=>netClone(v,seen,transport))};
  if(value instanceof Map)return {__map:[...value].map(([k,v])=>[netClone(k,seen,transport),netClone(v,seen,transport)])};
  if(typeof Image!=='undefined'&&value instanceof Image)return undefined;
  if(typeof HTMLCanvasElement!=='undefined'&&value instanceof HTMLCanvasElement)return undefined;
  if(typeof value!=='object')return undefined;
  if(seen.has(value))return undefined; seen.add(value);
  if(Array.isArray(value)){const a=value.map(v=>netClone(v,seen,transport));seen.delete(value);return a;}
  const out={};for(const [k,v] of Object.entries(value)){if(['img','image','canvas','ctx'].includes(k)||(transport&&['inside','hitIds'].includes(k)))continue;const c=netClone(v,seen,transport);if(c!==undefined)out[k]=c;}seen.delete(value);return out;
}
function netWireClone(value){return netClone(value,new WeakSet(),true);}
function netRevive(value){
  if(!value||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(netRevive);
  if(Array.isArray(value.__set))return new Set(value.__set.map(netRevive));
  if(Array.isArray(value.__map))return new Map(value.__map.map(([k,v])=>[netRevive(k),netRevive(v)]));
  for(const k of Object.keys(value))value[k]=netRevive(value[k]);return value;
}
MP.startOnline=(config,opts={})=>{MP.localSlot=Number(opts.localSlot)||0;MP.online={host:!!opts.host,replica:!opts.host,authoritative:!!opts.authoritative,serverPaused:false,localInput:opts.localInput||null};mpStartFromConfig(config);MP.localSlot=Number(opts.localSlot)||0;MP.selectedShopPlayer=MP.localSlot;updateMpHud(true);return true;};
MP.setRemoteInput=(slot,input)=>{MP.remoteInputs.set(Number(slot),{mx:Number(input?.mx)||0,my:Number(input?.my)||0,ax:Number(input?.ax)||0,ay:Number(input?.ay)||0,fire:!!input?.fire});};
const netEnemySimulationKeys=new Set(['shot','volley','strafe','mineClock','age','ramTime','mpRetarget','mpTargetId','prevX','prevY']);
function netMotionClone(obj,enemy=false){
  if(!obj||typeof obj!=='object')return obj;
  const out={};
  for(const [k,v] of Object.entries(obj)){
    if(enemy&&netEnemySimulationKeys.has(k))continue;
    if(v==null||typeof v==='string'||typeof v==='number'||typeof v==='boolean')out[k]=v;
    else if(k==='burn'||k==='attack'||k==='buff'||k==='shield'||k==='target')out[k]=netClone(v);
  }
  return out;
}
function netPlayerEntity(e){
  if(!e)return null;
  const keys=['x','y','prevX','prevY','vx','vy','hp','maxHp','shot','inv','bob','phase','cannonAngle','skinId','beamPhase','beamWakeClock','speedMult','damageMult','incomingDamageMult','fireRateMult','flame','doubleShot','explosive','piercing','facingX','impactJolt'];
  const out={};for(const k of keys)if(e[k]!==undefined)out[k]=e[k];return out;
}
function netLiteList(list,enemy=false){
  return (list||[]).map(e=>netMotionClone(e,enemy));
}
function mergeNetList(oldList,raw,authoritativeTargets=false,entityKind=''){
  const source=oldList||[],inc=(raw||[]).map(netRevive),oldBy=new Map(source.filter(x=>x?.__netId!=null).map(x=>[x.__netId,x])),next=[];
  const predicted=source.filter(x=>x?.__predictedLocal&&x.__netId==null),usedPredicted=new Set();
  for(const n of inc){
    let o=n?.__netId!=null?oldBy.get(n.__netId):null;
    if(!o&&n?.team==='player'&&n?.ownerId!=null&&predicted.length){
      let best=null,bestScore=Infinity,bestD=Infinity;
      for(const q of predicted){
        if(usedPredicted.has(q)||Number(q.ownerId)!==Number(n.ownerId))continue;
        const d=Math.hypot((Number(q.x)||0)-(Number(n.x)||0),(Number(q.y)||0)-(Number(n.y)||0));
        const ql=Math.hypot(Number(q.vx)||0,Number(q.vy)||0)||1,nl=Math.hypot(Number(n.vx)||0,Number(n.vy)||0)||1;
        const dot=clamp(((Number(q.vx)||0)*(Number(n.vx)||0)+(Number(q.vy)||0)*(Number(n.vy)||0))/(ql*nl),-1,1);
        const score=d+(1-dot)*120;
        if(score<bestScore){best=q;bestScore=score;bestD=d;}
      }
      const rtt=Math.max(0,Number(window.RDMOnline?.state?.rtt)||0),maxD=clamp(120+rtt*.82,165,330),maxScore=maxD+80;
      if(best&&bestD<maxD&&bestScore<maxScore){o=best;usedPredicted.add(best);o.__netId=n.__netId;o.__predictedLocal=false;}
    }
    if(o){
      const ox=o.x,oy=o.y,ovx=o.vx,ovy=o.vy,nx=n.x,ny=n.y,nvx=n.vx,nvy=n.vy,oldSink=Number(o.sinking)||0;
      Object.assign(o,n);
      if(entityKind==='enemy'&&Number(n.sinking)>0){
        o.sinking=Math.max(oldSink,Number(n.sinking)||0);
        if(oldSink<=0)startReplicaEnemyDeathFx(o);
      }
      if(authoritativeTargets&&state==='play'&&Number.isFinite(ox)&&Number.isFinite(oy)&&Number.isFinite(nx)&&Number.isFinite(ny)){
        const d=Math.hypot(ox-nx,oy-ny);
        if(d<360){
          o.x=ox;o.y=oy;o.vx=Number.isFinite(ovx)?ovx:(nvx||0);o.vy=Number.isFinite(ovy)?ovy:(nvy||0);
          o.__netTargetX=nx;o.__netTargetY=ny;o.__netTargetVX=Number(nvx)||0;o.__netTargetVY=Number(nvy)||0;
        }
      }else if(state==='play'&&Number.isFinite(ox)&&Number.isFinite(oy)&&Number.isFinite(nx)&&Number.isFinite(ny)){
        const d=Math.hypot(ox-nx,oy-ny);
        if(d<260){o.x=ox+(nx-ox)*.58;o.y=oy+(ny-oy)*.58;}
      }
      next.push(o);
    }else{
      if(authoritativeTargets&&n&&Number.isFinite(n.x)&&Number.isFinite(n.y)){
        if(entityKind==='shot'||entityKind==='enemyShot'){
          const rtt=Math.max(0,Number(window.RDMOnline?.state?.rtt)||0),lead=clamp((rtt*.44+16)/1000,.012,.105);
          n.x+=Number(n.vx||0)*lead;n.y+=Number(n.vy||0)*lead;
        }
        n.__netTargetX=n.x;n.__netTargetY=n.y;n.__netTargetVX=Number(n.vx)||0;n.__netTargetVY=Number(n.vy)||0;
      }
      if(entityKind==='enemy'&&Number(n?.sinking)>0)startReplicaEnemyDeathFx(n);
      next.push(n);
    }
  }
  const now=performance.now(),rtt=Math.max(0,Number(window.RDMOnline?.state?.rtt)||0),predictedTTL=clamp(220+rtt*1.35,280,620);
  for(const q of predicted){
    if(usedPredicted.has(q))continue;
    if(now-(Number(q.__predictedAt)||now)<predictedTTL)next.push(q);
  }
  return next;
}
MP.makeSnapshot=(opts={})=>{
  if(!MP.enabled||!MP.online?.host)return null;
  // Snapshots read captain state; they must not commit stale globals into a new primary.
  restorePrimary();
  for(const list of [enemies,shots,enemyShots,chests])for(const e of list)if(e&&e.__netId==null)e.__netId=MP.netSeq++;
  const lite=!!opts.lite&&state==='play';
  const players=MP.players.map(p=>{
    const base={id:p.id,name:p.name,skinId:p.skinId,gold:p.gold,alive:p.alive,connected:p.connected!==false,ready:p.ready,portrait:p.portrait,title:p.title,aim:p.aim,deathAt:p.deathAt,entity:lite?netPlayerEntity(p.entity):p.entity};
    if(lite&&opts.richPlayers)Object.assign(base,{build:p.build,stats:p.stats});
    if(!lite)Object.assign(base,{stats:p.stats,shopChoices:p.shopChoices,shopRerolled:p.shopRerolled,shopRepaired:p.shopRepaired,specChoices:p.specChoices,build:p.build,upgrades:p.upgrades});
    return base;
  });
  if(lite){
    return netWireClone({v:2,lite:true,at:Date.now(),state,wave,score,elapsed,transition,waveRemainingToSpawn,waveTotal,waveSpawnClock,players,
      enemies:netLiteList(enemies,true),shots:netLiteList(shots),enemyShots:netLiteList(enemyShots),chests:netLiteList(chests),
      bossFight:bossFight||null,
      voyage:{hazards:voyage.hazards||[],weather:voyage.weather,event:voyage.event||null}
    });
  }
  return netWireClone({v:2,lite:false,at:Date.now(),state,wave,score,elapsed,transition,waveRemainingToSpawn,waveTotal,waveSpawnClock,players,enemies,shots,enemyShots,chests,bossFight,
    voyage:{hazards:voyage.hazards,weather:voyage.weather,event:voyage.event},campaignEvents:[...(campaign.events||[])],shop:MP.shop,wipeFund:MP.wipeFund});
};
MP.applySnapshot=(snap,force=false)=>{
  if(!MP.enabled||(!force&&!MP.online?.replica)||!snap||snap.v!==2)return false;
  MP.fullGameplay=!!snap.fullGameplay;
  const localBefore=playerById(MP.localSlot)?.entity;const localPos=localBefore?{x:localBefore.x,y:localBefore.y,vx:localBefore.vx,vy:localBefore.vy}:null;
  state=(snap.authoritativeV4&&snap.roomPaused&&snap.state==='play')?'paused':snap.state;wave=snap.wave;score=snap.score;elapsed=snap.elapsed;transition=snap.transition;waveRemainingToSpawn=snap.waveRemainingToSpawn;waveTotal=snap.waveTotal;waveSpawnClock=snap.waveSpawnClock;
  const incoming=(snap.players||[]).map(netRevive);
  for(const sp of incoming){
    let p=playerById(sp.id);if(!p)continue;
    const wasAlive=!!p.alive,previousDeathFx=p.deathFx||null;
    const prev=p.entity?{x:p.entity.x,y:p.entity.y,vx:p.entity.vx,vy:p.entity.vy}:null;
    const previousBuild=p.build,previousUpgrades=p.upgrades,previousStats=p.stats,previousEntity=p.entity;
    // Enquanto o estaleiro está aberto, este cliente mantém suas compras locais.
    // Snapshots em trânsito não podem desfazer um clique antes do servidor recebê-lo.
    const editingLocalShop=!snap.fullGameplay&&snap.authoritativeV4&&snap.state==='upgrade'&&snap.shop?.open&&MP.shop&&Number(MP.shop.__serverRevision)===Number(snap.shop.revision)&&p.id===MP.localSlot;
    const localGold=p.gold;
    const incomingEntity=sp.entity;delete sp.entity;Object.assign(p,sp);
    if(editingLocalShop)p.gold=localGold;
    if(sp.upgrades!==undefined)p.upgrades=sp.upgrades instanceof Set?sp.upgrades:new Set(sp.upgrades||[]);else p.upgrades=previousUpgrades;
    p.build=sp.build!==undefined?sp.build:previousBuild;p.stats=sp.stats!==undefined?sp.stats:previousStats;if(sp.shopClassPath&&p.build&&!p.build.path&&p.id!==MP.localSlot)p.build.pendingPath=sp.shopClassPath;
    if(editingLocalShop){p.entity=previousEntity;}
    else if(incomingEntity!==undefined){
      if(snap.authoritativeV4&&wasAlive&&p.alive&&previousEntity&&p.id!==MP.localSlot&&state==='play'){
        const nx=incomingEntity.x,ny=incomingEntity.y,nvx=incomingEntity.vx,nvy=incomingEntity.vy;
        Object.assign(previousEntity,incomingEntity);
        if(prev&&Number.isFinite(nx)&&Number.isFinite(ny)&&Math.hypot(prev.x-nx,prev.y-ny)<320){
          previousEntity.x=prev.x;previousEntity.y=prev.y;
          previousEntity.__netTargetX=nx;previousEntity.__netTargetY=ny;previousEntity.__netTargetVX=Number(nvx)||0;previousEntity.__netTargetVY=Number(nvy)||0;
        }
        p.entity=previousEntity;
      }else if(snap.lite&&previousEntity){Object.assign(previousEntity,incomingEntity);p.entity=previousEntity;}
      else p.entity=incomingEntity||previousEntity;
    }else p.entity=previousEntity;
    if(!snap.authoritativeV4&&prev&&p.entity&&p.id!==MP.localSlot&&state==='play'){
      const d=Math.hypot(prev.x-p.entity.x,prev.y-p.entity.y);
      if(d<220){p.entity.x=prev.x+(p.entity.x-prev.x)*.52;p.entity.y=prev.y+(p.entity.y-prev.y)*.52;}
    }
    if(wasAlive&&!p.alive&&p.connected!==false)startPlayerDeathFx(p);
    else if(p.alive)p.deathFx=null;
    else if(previousDeathFx&&!p.deathFx)p.deathFx=previousDeathFx;
  }
  if(localPos&&!snap.authoritativeV4){const lp=playerById(MP.localSlot);if(lp?.entity&&state==='play'){const dx=localPos.x-lp.entity.x,dy=localPos.y-lp.entity.y,d=Math.hypot(dx,dy);if(d<120){lp.entity.x+=dx*.72;lp.entity.y+=dy*.72;lp.entity.vx=localPos.vx*.62+lp.entity.vx*.38;lp.entity.vy=localPos.vy*.62+lp.entity.vy*.38;}}}
  enemies=mergeNetList(enemies,snap.enemies,!!snap.authoritativeV4,'enemy');shots=mergeNetList(shots,snap.shots,!!snap.authoritativeV4,'shot');enemyShots=mergeNetList(enemyShots,snap.enemyShots,!!snap.authoritativeV4,'enemyShot');chests=mergeNetList(chests,snap.chests,false,'chest');bossFight=netRevive(snap.bossFight||null);
  if(snap.voyage){voyage.hazards=netRevive(snap.voyage.hazards||[]);voyage.weather=snap.voyage.weather;voyage.event=netRevive(snap.voyage.event||null);}
  if(snap.shop!==undefined){if(snap.fullGameplay)MP.shop=netRevive(snap.shop||null);else if(snap.authoritativeV4)MP.serverShop=netRevive(snap.shop||null);else MP.shop=netRevive(snap.shop||null);}if(snap.wipeFund!==undefined)MP.wipeFund=netRevive(snap.wipeFund||null);if(Array.isArray(snap.campaignEvents))campaign.events=[...snap.campaignEvents];
  if(snap.campaignPresentation)Object.assign(campaign,netRevive(snap.campaignPresentation));
  if(snap.voyagePresentation)Object.assign(voyage,netRevive(snap.voyagePresentation));
  if(snap.infiniteMode!==undefined)infiniteMode=!!snap.infiniteMode;
  if(snap.bossReward!==undefined)bossReward=netRevive(snap.bossReward);
  if(snap.pendingBlackbeardLine!==undefined)pendingBlackbeardLine=!!snap.pendingBlackbeardLine;
  if(snap.fullGameplay){
    if(state==='upgrade'&&MP.shop){$('mp-shop-screen')?.classList.remove('hidden');renderMpShop();}
    else $('mp-shop-screen')?.classList.add('hidden');
  }
  restorePrimary();updateMpHud();return true;
};
MP.localInput=()=>{
  const p=playerById(MP.localSlot);if(document.hidden||!p)return {mx:0,my:0,ax:0,ay:0,fire:false};
  const right=MP.codes.has('KeyD')||MP.codes.has('ArrowRight')||keys.has('d')||keys.has('arrowright');
  const left=MP.codes.has('KeyA')||MP.codes.has('ArrowLeft')||keys.has('a')||keys.has('arrowleft');
  const down=MP.codes.has('KeyS')||MP.codes.has('ArrowDown')||keys.has('s')||keys.has('arrowdown');
  const up=MP.codes.has('KeyW')||MP.codes.has('ArrowUp')||keys.has('w')||keys.has('arrowup');
  let mx=(right?1:0)-(left?1:0),my=(down?1:0)-(up?1:0);
  let ax=mouse.x-p.entity.x,ay=mouse.y-p.entity.y,l=Math.hypot(ax,ay)||1;ax/=l;ay/=l;
  return {mx,my,ax,ay,fire:!!mouse.down};
};
MP.setOnlinePaused=(paused,by=0)=>{
  if(!MP.enabled)return false;
  const wasPaused=state==='paused';
  if(MP.online)MP.online.serverPaused=!!paused;
  if(state==='upgrade'||state==='specialization'){pauseScreen.classList.add('hidden');return false;}
  if(paused){
    if(!wasPaused){
      keys.clear();MP.codes.clear();mouse.down=false;
      stopAllSfx?.();
      state='paused';
      renderBuildPanel?.();
      pauseScreen.classList.remove('hidden');
      syncMusicState?.(true);
    }else pauseScreen.classList.remove('hidden');
  }else{
    if(wasPaused){
      keys.clear();MP.codes.clear();mouse.down=false;
      state='play';
      syncMusicState?.(true);
    }
    pauseScreen.classList.add('hidden');
  }
  let note=$('mp-pause-note');if(note&&paused)note.textContent=`PAUSA ONLINE • ${playerById(by)?.name||'um capitão'} pausou a viagem`;
  return state==='paused';
};
MP.setReadyFromNetwork=(slot,ready)=>{const p=playerById(Number(slot));if(!p)return false;p.ready=!!ready;renderMpShop();updateMpHud(true);return true;};
MP.performAction=(slot,action,payload={})=>{
  const p=playerById(Number(slot));if(!p||!MP.enabled||p.connected===false||(!MP.shop&&!['continue','wipe-diamond'].includes(action)))return false;
  if(action==='class'){
    if(MP.shop?.phase!=='class')return false;const path=payload.path;if(!CLASS_CHOICES[path]||classReservations(p.id).has(path))return false;
    p.build.pendingPath=path;if(allClassesSelected()){MP.shop.phase='talent';for(const pl of shopParticipants())pl.shopChoices=withPlayer(pl,()=>buildUpgradeChoices());}renderMpShop();return true;
  }
  if(action==='first'){
    if(MP.shop?.phase!=='talent'||!p.shopChoices?.some(u=>u.id===payload.id))return false;
    const ok=withPlayer(p,()=>applyBuildUpgrade(payload.id));p.ready=!!ok;if(allFirstTalentsSelected()){MP.shop.phase='firstdone';for(const pl of shopParticipants())pl.ready=true;}renderMpShop();updateMpHud(true);return !!ok;
  }
  if(action==='ready'){
    if(MP.shop?.phase!=='normal')return false;const desired=payload?.ready;p.ready=typeof desired==='boolean'?desired:!p.ready;renderMpShop();updateMpHud(true);return true;
  }
  if(action==='buy'){
    if(MP.shop?.phase!=='normal'||!p.shopChoices?.some(x=>x.id===payload.id))return false;
    const u=upgradeById[payload.id];if(!u)return false;let ok=false;withPlayer(p,()=>{const cost=effectiveUpgradeCost(u);if(p.gold>=cost&&applyBuildUpgrade(u.id)){p.gold-=cost;gold=p.gold;p.build.metrics.goldSpent+=cost;ok=true;}});renderMpShop();updateMpHud(true);return ok;
  }
  if(action==='repair'){
    if(MP.shop?.phase!=='normal'||!p.alive||p.gold<BUILD_BALANCE.port.repairCost||p.shopRepaired)return false;p.gold-=BUILD_BALANCE.port.repairCost;p.shopRepaired=true;withPlayer(p,()=>healBuild(BUILD_BALANCE.port.repairHeal,player,'port'));renderMpShop();updateMpHud(true);return true;
  }
  if(action==='reroll'){
    if(MP.shop?.phase!=='normal'||p.gold<BUILD_BALANCE.port.rerollCost||p.shopRerolled)return false;p.gold-=BUILD_BALANCE.port.rerollCost;p.shopRerolled=true;p.shopChoices=withPlayer(p,()=>buildUpgradeChoices());renderMpShop();return true;
  }
  if(action==='donate'){
    if(MP.shop?.phase!=='normal'||!p.alive)return false;const target=playerById(Number(payload.target));if(!target||target.connected===false||target.id===p.id)return false;const amount=payload.amount==='max'?Math.floor(p.gold):Math.min(Number(payload.amount)||0,Math.floor(p.gold));if(amount<=0)return false;p.gold-=amount;target.gold+=amount;p.stats.donated+=amount;target.stats.received+=amount;renderMpShop();updateMpHud(true);return true;
  }
  if(action==='revive'){
    if(MP.shop?.phase!=='normal'||!p.alive)return false;const target=playerById(Number(payload.target));if(!target||target.connected===false||target.alive||target.id===p.id)return false;const current=MP.shop.revives[target.id]||0,remain=1000-current,amount=payload.amount==='rest'?remain:Math.min(Number(payload.amount)||0,remain);if(amount<=0||p.gold<amount)return false;p.gold-=amount;p.stats.donated+=amount;MP.shop.revives[target.id]=current+amount;if(MP.shop.revives[target.id]>=1000)reviveAtShop(target,p);renderMpShop();updateMpHud(true);return true;
  }
  if(action==='wipe-diamond'){
    if(state!=='gameover'||!MP.wipe||!MP.online)return false;const cost=reviveCostForWave(wave),current=MP.wipeFund?.total||0,remain=Math.max(0,cost-current),amount=Math.min(Math.max(0,Math.floor(Number(payload.amount)||0)),remain);if(amount<=0)return false;if(!MP.wipeFund)MP.wipeFund={total:0,by:{}};MP.wipeFund.total+=amount;MP.wipeFund.by[p.id]=(MP.wipeFund.by[p.id]||0)+amount;renderMpDefeat();if(MP.wipeFund.total>=cost)reviveRun(true);return true;
  }
  if(action==='spec'){
    if(MP.shop?.phase!=='spec'||!p.specChoices?.some(x=>x.id===payload.id))return false;const spec=withPlayer(p,()=>window.ReiEndgame?.mpChooseSpec?.(payload.id));if(spec){p.specChoices=[];if(shopParticipants().every(x=>!x.specChoices?.length)){MP.shop.phase='normal';prepareNormalChoices();}renderMpShop();return true;}return false;
  }
  if(action==='continue'){
    if(MP.shop?.phase==='firstdone'){$('mp-shop-screen').classList.add('hidden');state='play';for(const q of connectedPlayers())q.ready=false;restorePrimary();beginNextWave();updateMpHud(true);return true;}
    if(MP.shop?.phase==='spec'&&shopParticipants().every(x=>!x.specChoices?.length)){MP.shop.phase='normal';prepareNormalChoices();renderMpShop();return true;}
    if(MP.shop?.phase==='normal'&&!eligibleShopPlayers().some(q=>!q.ready)){$('mp-shop-screen').classList.add('hidden');state='play';restorePrimary();beginNextWave();updateMpHud(true);return true;}return false;
  }
  return false;
};
MP.setOnlineRole=(isHost,localSlot=MP.localSlot)=>{
  if(!MP.enabled||!MP.online)return false;
  MP.localSlot=Number(localSlot);MP.online.host=!!isHost;MP.online.replica=!isHost;MP.selectedShopPlayer=MP.localSlot;MP.remoteInputs.clear();restorePrimary();updateMpHud(true);return true;
};
MP.handlePlayerLeft=(slot,temporary=true)=>{
  const p=playerById(Number(slot));if(!p)return false;
  if(p.connected!==false)p.suspendedState=netClone({id:p.id,name:p.name,skinId:p.skinId,gold:p.gold,alive:p.alive,ready:p.ready,portrait:p.portrait,title:p.title,aim:p.aim,stats:p.stats,shopChoices:p.shopChoices,shopRerolled:p.shopRerolled,shopRepaired:p.shopRepaired,specChoices:p.specChoices,deathAt:p.deathAt,entity:p.entity,build:p.build,upgrades:p.upgrades});
  p.connected=false;p.resumeExpired=!temporary;p.entity.vx=0;p.entity.vy=0;MP.remoteInputs.delete(p.id);
  if(MP.shop){if(!temporary)delete MP.shop.revives?.[p.id];if(MP.shop.phase==='class'&&!temporary){p.build.pendingPath=null;if(allClassesSelected()){MP.shop.phase='talent';for(const pl of shopParticipants())pl.shopChoices=withPlayer(pl,()=>buildUpgradeChoices());}}if(MP.shop.phase==='talent'&&!temporary&&allFirstTalentsSelected()){MP.shop.phase='firstdone';for(const pl of shopParticipants())pl.ready=true;}if(MP.shop.phase==='spec'&&!temporary&&shopParticipants().every(x=>!x.specChoices?.length))MP.shop.phase='normal';}
  if(MP.selectedShopPlayer===p.id)MP.selectedShopPlayer=MP.online?MP.localSlot:(connectedPlayers()[0]?.id??0);
  if(state==='paused'&&!MP.online?.authoritative)closePause();if(state==='upgrade')renderMpShop();if(state==='gameover'&&MP.wipe&&MP.online&&(MP.wipeFund?.total||0)>=reviveCostForWave(wave))reviveRun(true);restorePrimary();updateMpHud(true);return true;
};
MP.restorePlayerFromNet=(slot,raw)=>{
  const p=playerById(Number(slot));if(!p)return false;const st=raw?netRevive(netClone(raw)):p.suspendedState?netRevive(netClone(p.suspendedState)):null;
  if(st&&Number(st.id)===p.id){const fixedId=p.id;Object.assign(p,st);p.id=fixedId;p.upgrades=st.upgrades instanceof Set?st.upgrades:new Set(st.upgrades||[]);p.entity=st.entity||p.entity;p.build=st.build||p.build;}
  p.connected=true;p.resumeExpired=false;p.suspendedState=null;if(p.alive&&p.entity){p.entity.inv=Math.max(2,p.entity.inv||0);p.entity.x=clamp(p.entity.x,55,W-55);p.entity.y=clamp(p.entity.y,95,H-55);}
  restorePrimary();if(state==='upgrade')renderMpShop();updateMpHud(true);return true;
};
MP.forceOnlineShopView=()=>{if(!MP.enabled||!MP.online)return;MP.selectedShopPlayer=MP.localSlot;if(state==='upgrade')renderMpShop();};
MP.forceOnlineUnpause=()=>{pauseScreen.classList.add('hidden');if(state==='paused')state='play';keys.clear();mouse.down=false;syncMusicState(true);};
MP.renderShop=()=>{if(MP.enabled&&state==='upgrade'){if(MP.online)MP.selectedShopPlayer=MP.localSlot;renderMpShop();}};
MP.playerById=playerById;
MP.getWipeFund=()=>({total:MP.wipeFund?.total||0,cost:reviveCostForWave(wave),by:{...(MP.wipeFund?.by||{})}});
MP.activeCount=()=>connectedPlayers().length;
MP.renderDefeat=renderMpDefeat;
MP.prepareOnlineRestart=()=>{
  MP.wipe=false;MP.wipeFund=null;MP.shop=null;MP.codes.clear();MP.remoteInputs.clear();MP.replicaBossFx=null;
  mouse.down=false;keys.clear();shots=[];enemyShots=[];enemies=[];chests=[];
  impactEffects=[];foam=[];ripples=[];lootTexts=[];particles=[];
  bossFight=null;bossHpWrap?.classList.add('hidden');
  gameover?.classList.add('hidden');pauseScreen?.classList.add('hidden');$('mp-defeat-summary')?.classList.add('hidden');
  return true;
};

/* ---------- utilidades de teste ---------- */
MP.debug=()=>({enabled:MP.enabled,count:MP.count,state,wave,difficulty:difficulty(),players:MP.players.map(p=>({id:p.id,name:p.name,alive:p.alive,connected:p.connected!==false,hp:p.entity.hp,gold:p.gold,path:p.build.path,pending:p.build.pendingPath,upgrades:[...p.upgrades],stats:{...p.stats}})),shop:MP.shop?{phase:MP.shop.phase,revives:{...MP.shop.revives}}:null,shots:shots.map(s=>({ownerId:s.ownerId,life:s.life})),enemies:enemies.length});
MP.forceShop=()=>{if(MP.enabled)mpOpenShop();};
MP.damagePlayer=(id,amount)=>{const p=playerById(id);if(p){p.entity.inv=0;withPlayer(p,()=>hitPlayer(amount,{x:p.entity.x-50,y:p.entity.y},'projectile'));}};
MP.selectClass=(id,path)=>{const p=playerById(id);if(!p)return false;if(classReservations(id).has(path))return false;p.build.pendingPath=path;if(allClassesSelected()){MP.shop.phase='talent';for(const pl of shopParticipants())pl.shopChoices=withPlayer(pl,()=>buildUpgradeChoices());}return true;};
MP.selectFirst=(id,upgradeId)=>{const p=playerById(id);if(!p)return false;const ok=withPlayer(p,()=>applyBuildUpgrade(upgradeId));if(allFirstTalentsSelected()){MP.shop.phase='firstdone';for(const pl of shopParticipants())pl.ready=true;}return ok;};

/* ---------- UI events ---------- */
$('online-local-test')?.addEventListener('click',()=>{document.getElementById('multiplayer-online-screen')?.classList.add('hidden');openMpSetup();});
$('mp-setup-close')?.addEventListener('click',closeMpSetup);
document.querySelectorAll('[data-mp-count]').forEach(b=>b.addEventListener('click',()=>{MP.count=Number(b.dataset.mpCount);document.querySelectorAll('[data-mp-count]').forEach(x=>x.classList.toggle('active',x===b));renderSetup();}));
$('mp-start-local')?.addEventListener('click',()=>{const cfg=collectSetup();closeMpSetup();mpStartFromConfig(cfg);});

updateMpHud(true);
})();
