/* v23.7 — longevidade do infinito, save seguro e acessibilidade visual. */
(() => {
'use strict';
const RUN_SAVE_KEY='reiDosMaresActiveRunV3';
const PREF_SHAKE='reiDosMaresShakeIntensity';
const PREF_FLASH='reiDosMaresFlashIntensity';
const el=id=>document.getElementById(id);
const clamp01=v=>Math.max(0,Math.min(1,Number(v)||0));
const readPref=(key,fallback)=>{try{const raw=localStorage.getItem(key);if(raw===null)return fallback;const v=Number(raw);return Number.isFinite(v)?clamp01(v):fallback}catch(_){return fallback}};
const prefs={shake:readPref(PREF_SHAKE,1),flash:readPref(PREF_FLASH,1)};

const SPECIALIZATIONS={
 marine:[
  {id:'marine-fortress',name:'Fortaleza Flutuante',desc:'A disciplina do casco chega ao limite: receba mais 8% de redução multiplicativa de dano.',tag:'DEFESA'},
  {id:'marine-guidance',name:'Doutrina de Precisão',desc:'Treino de Artilharia ganha +15% de velocidade adicional e Tiro Preciso corrige a trajetória com mais firmeza.',tag:'PRECISÃO'},
  {id:'marine-counter',name:'Resposta Imperial',desc:'Contra-Ataque ganha +8 pontos de chance de reflexão e devolve 3,5× o dano original.',tag:'CONTRA-ATAQUE'},
  {id:'marine-impact',name:'Peso da Marinha',desc:'Tiro Impactante empurra 25% mais e causa um tranco mais forte até em navios pesados.',tag:'CONTROLE'}
 ],
 pirate:[
  {id:'pirate-broadside',name:'Chumbo Cerrado',desc:'Tiro Espalhado fecha levemente o leque e suas balas laterais passam a causar 42% do dano base.',tag:'CURTA DISTÂNCIA'},
  {id:'pirate-boarding',name:'Abordagem Relâmpago',desc:'Abordagem alcança mais longe, causa 20% de bônus e o impulso dura 2,6 s com +25% de movimento.',tag:'ABORDAGEM'},
  {id:'pirate-coldblood',name:'Instinto Assassino',desc:'Sangue Frio dura 2,1 s e aumenta o dano em 30% enquanto estiver ativo.',tag:'DANO'},
  {id:'pirate-scavenger',name:'Saque de Guerra',desc:'Saqueador eleva a chance de Kit de Reparos nos baús para 40%.',tag:'SAQUE'}
 ],
 undead:[
  {id:'undead-ecto',name:'Maré Profana',desc:'Ectoplasma ganha 25% de área e a entrada passa a causar 48% do dano do disparo.',tag:'ÁREA'},
  {id:'undead-curse',name:'Maldição Abissal',desc:'Maldição dos Afogados dura 4 s e reduz movimento e dano em 20%.',tag:'DEBUFF'},
  {id:'undead-beyond',name:'Além do Além',desc:'Velocidade do Além passa a conceder +32% de movimento e +26% de frequência de disparo.',tag:'VELOCIDADE'},
  {id:'undead-souls',name:'Fome Ancestral',desc:'Almas curam 7 de vida e podem ser recolhidas de um pouco mais longe.',tag:'SUSTAIN'}
 ]
};

function normalizeNetSet(value){
 if(value instanceof Set)return value;
 if(Array.isArray(value))return new Set(value);
 if(value&&Array.isArray(value.__set))return new Set(value.__set);
 return new Set();
}
function specSet(){
 if(!buildRun)return new Set();
 if(!(buildRun.specializations instanceof Set))buildRun.specializations=normalizeNetSet(buildRun.specializations);
 return buildRun.specializations;
}
function milestoneSet(){
 if(!buildRun)return new Set();
 if(!(buildRun.specializationMilestones instanceof Set))buildRun.specializationMilestones=normalizeNetSet(buildRun.specializationMilestones);
 return buildRun.specializationMilestones;
}
function hasSpecialization(id){return specSet().has(id);}
function eligibleSpecs(){return (SPECIALIZATIONS[buildRun?.path]||[]).filter(s=>!hasSpecialization(s.id));}
function shouldOfferSpecialization(){return !!(infiniteMode&&buildRun?.path&&(wave===70||wave===90)&&!milestoneSet().has(wave)&&eligibleSpecs().length);}
function pickSpecializations(){
 const pool=[...eligibleSpecs()],out=[];
 while(pool.length&&out.length<2){const i=Math.floor(Math.random()*pool.length);out.push(pool.splice(i,1)[0]);}
 return out;
}
function openSpecialization(){
 const screen=el('specialization-screen'),grid=el('specialization-grid');if(!screen||!grid)return false;
 const choices=pickSpecializations();if(!choices.length){milestoneSet().add(wave);return false;}
 state='specialization';mouse.down=false;keys.clear();closeUpgradeScreen();
 el('specialization-wave').textContent=`ONDA ${wave} • DECISÃO RARA DO INFINITO`;
 const path=BUILD_PATHS[buildRun.path];
 grid.innerHTML=choices.map(s=>`<button class="specialization-option" data-spec="${s.id}" style="--spec:${path.color}"><span>${path.symbol} ${path.name} • ${s.tag}</span><h3>${s.name}</h3><p>${s.desc}</p><b>ESCOLHER ESPECIALIZAÇÃO</b></button>`).join('');
 grid.querySelectorAll('[data-spec]').forEach(btn=>btn.addEventListener('click',()=>chooseSpecialization(btn.dataset.spec),{once:true}));
 screen.classList.remove('hidden');syncMusicState(true);sfx('upgrade',.72);return true;
}
function chooseSpecialization(id){
 const spec=(SPECIALIZATIONS[buildRun.path]||[]).find(s=>s.id===id);if(!spec||hasSpecialization(id))return;
 specSet().add(id);milestoneSet().add(wave);addStat('specializations');checkAchievements();
 el('specialization-screen').classList.add('hidden');state='play';recalcBuildStats();updateUpgradeStrip();
 notifyVoyage('BUILD ESPECIALIZADA',spec.name,BUILD_PATHS[buildRun.path].color,3.4);sfx('upgrade',1);openUpgradeScreen();
}

let waveStartSnapshot=null;
function serializableBuild(){
 const b={...buildRun};
 b.wageWaves=[...(buildRun.wageWaves||[])];b.specializations=[...specSet()];b.specializationMilestones=[...milestoneSet()];b.pools=[];b.souls=[];
 return b;
}
function serializableChronicleRun(){
 const r=chronicle.run;if(!r)return null;
 return {...r,waves:[...(r.waves||[])]};
}
function activeRunSave(){
 try{
  const raw=localStorage.getItem(RUN_SAVE_KEY);
  if(raw){const d=JSON.parse(raw);if(d?.version===3)return d;}
  // Compatibilidade com a v23.7: saves antigos só podiam ser feitos no estaleiro,
  // então podem ser migrados com segurança para o novo formato sem perder a viagem.
  const legacyRaw=localStorage.getItem('reiDosMaresActiveRunV2');
  if(legacyRaw){
   const legacy=JSON.parse(legacyRaw);
   if(legacy?.version===2){
    const migrated={...legacy,version:3,resumeMode:'port'};
    localStorage.setItem(RUN_SAVE_KEY,JSON.stringify(migrated));
    localStorage.removeItem('reiDosMaresActiveRunV2');
    return migrated;
   }
  }
  return null;
 }catch(_){return null}
}
function updateContinueButton(){
 const btn=el('continue-run-btn'),detail=el('continue-run-detail');if(!btn)return;
 const d=activeRunSave();btn.classList.toggle('hidden',!d);
 if(d&&detail)detail.textContent=`ONDA ${d.wave} • ${BUILD_PATHS[d.build?.path]?.name||'SEM CLASSE'} • ${formatRunTime(d.build?.elapsed||0)}${d.resumeMode==='wave'?' • reinicia a onda':''}`;
}
function canSaveRun(){return !!player&&!!chronicle.run&&!chronicle.run.finished&&['play','paused','upgrade','specialization'].includes(state);}
function buildRunPayload(resumeMode='wave'){
 return {version:3,resumeMode,savedAt:Date.now(),wave,score,gold,infiniteMode,selectedSkin:player.skinId||selectedSkin,player:{...player},acquiredUpgrades:[...acquiredUpgrades],upgradeChoices:upgradeChoices.map(u=>u.id),build:serializableBuild(),chronicleRun:serializableChronicleRun(),voyage:{runGold:voyage.runGold,runDiamonds:voyage.runDiamonds}};
}
function captureWaveStart(){
 if(!player||!chronicle.run)return;
 const p=buildRunPayload('wave');
 p.build.shop=null;p.upgradeChoices=[];
 waveStartSnapshot=JSON.parse(JSON.stringify(p));
}
function saveCurrentRun(){
 if(!canSaveRun())return false;
 const atPort=state==='upgrade';
 let payload=atPort?buildRunPayload('port'):(waveStartSnapshot?JSON.parse(JSON.stringify(waveStartSnapshot)):buildRunPayload('wave'));
 // Saving during combat intentionally rolls the voyage back to the clean start of this wave.
 if(!atPort){payload.savedAt=Date.now();payload.resumeMode='wave';payload.wave=wave;}
 try{localStorage.setItem(RUN_SAVE_KEY,JSON.stringify(payload));updateContinueButton();return true}catch(_){notifyVoyage('SAVE INDISPONÍVEL','O navegador bloqueou o salvamento desta viagem.','#ffb1a4',4);return false}
}
function clearRunSave(){try{localStorage.removeItem(RUN_SAVE_KEY)}catch(_){}updateContinueButton();}
function returnMenuKeepingRun(){
 clearVoyageHazards();keys.clear();mouse.down=false;chronicle.run=null;state='menu';syncMusicState(true);transition=0;stopAllSfx();updateBurnAudio(0);
 el('specialization-screen')?.classList.add('hidden');el('run-exit-screen')?.classList.add('hidden');gameover.classList.add('hidden');closeUpgradeScreen();bossRewardScreen.classList.add('hidden');victoryScreen.classList.add('hidden');bossHpWrap.classList.add('hidden');pauseScreen.classList.add('hidden');hideHud();menu.classList.remove('hidden','leaving');menuHigh.textContent=high;menuHighWave.textContent=highWave;updateMenuShip();updateContinueButton();
}
function saveAndExit(){if(!saveCurrentRun()){sfx('ui',.5);return false}returnMenuKeepingRun();sfx('ui',.55);return true;}
function restoreBuild(raw){
 resetBuild();Object.assign(buildRun,raw||{});buildRun.wageWaves=new Set(raw?.wageWaves||[]);buildRun.specializations=new Set(raw?.specializations||[]);buildRun.specializationMilestones=new Set(raw?.specializationMilestones||[]);buildRun.pools=[];buildRun.souls=[];
}
function continueRun(){
 const d=activeRunSave();if(!d)return false;
 unlockAudio();reset();
 wave=d.wave;score=d.score;gold=d.gold;infiniteMode=!!d.infiniteMode;player={...player,...d.player,skinId:d.selectedSkin||d.player?.skinId||selectedSkin};acquiredUpgrades=new Set((d.acquiredUpgrades||[]).filter(id=>upgradeById[id]));restoreBuild(d.build);recalcBuildStats();
 chronicle.run=d.chronicleRun?{...d.chronicleRun,waves:new Set(d.chronicleRun.waves||[])}:{finished:false,kills:0,streak:0,waveDamage:0,waves:new Set(),won:false};
 voyage.runGold=d.voyage?.runGold||0;voyage.runDiamonds=d.voyage?.runDiamonds||0;buildRun.shop=d.build?.shop||null;upgradeChoices=(d.upgradeChoices||[]).map(id=>upgradeById[id]).filter(Boolean);
 scoreEl.textContent=String(score);goldEl.textContent=String(gold);waveEl.textContent=String(wave);refreshBuildHealth();updateUpgradeStrip();
 menu.classList.add('hidden');gameover.classList.add('hidden');pauseScreen.classList.add('hidden');bossRewardScreen.classList.add('hidden');victoryScreen.classList.add('hidden');bossHpWrap.classList.add('hidden');revealHud(1);
 clearRunSave();
 if(d.resumeMode==='port'){
   state='upgrade';if(!buildRun.shop)buildRun.shop={rerolled:false,repaired:false};renderUpgradeChoices();upgradeScreen.classList.remove('hidden');
   notifyVoyage('VIAGEM RETOMADA',`Onda ${wave} • de volta ao estaleiro onde a viagem foi salva.`,'#91e6d5',4);
 }else{
   state='play';upgradeScreen.classList.add('hidden');clearVoyageHazards();enemies=[];enemyShots=[];shots=[];chests=[];lootTexts=[];waveTimer=0;waveCompleteTimer=-1;prepareVoyageWave(wave);
   if(isBossWave(wave)){waveRemainingToSpawn=0;waveTotal=0;waveSpawnClock=0;startBossWave(bossKindForWave(wave));}
   else{bossFight=null;bossHpWrap.classList.add('hidden');waveRemainingToSpawn=voyage.plan.length;waveTotal=voyage.plan.length;voyage.spawned=0;waveSpawnClock=.75;voyage.waveGrace=1.15;}
   captureWaveStart();
   notifyVoyage('VIAGEM RETOMADA',`Onda ${wave} reiniciada do começo para manter o save justo e sem duplicar recompensas.`,'#91e6d5',4.5);
 }
 syncMusicState(true);return true;
}
function newRunRequested(){const saved=activeRunSave();if(saved&&!window.confirm(`Existe uma viagem salva na onda ${saved.wave}. Iniciar uma nova viagem apagará esse save. Continuar?`))return false;if(saved)clearRunSave();start();return true;}

function requestExit(){
 const modal=el('run-exit-screen'),save=el('run-save-exit'),msg=el('run-exit-message');if(!modal)return;
 const saveable=canSaveRun();save.disabled=!saveable;
 msg.textContent=saveable?(state==='upgrade'?`Você pode salvar neste estaleiro e voltar exatamente daqui.`:`Se salvar agora, a próxima sessão recomeça a onda ${wave} desde o início. Progresso obtido no meio desta onda não é duplicado.`):'Não existe uma viagem ativa que possa ser salva.';
 pauseScreen?.classList.add('hidden');modal.classList.remove('hidden');sfx('ui',.45);
}
function cancelExit(){el('run-exit-screen')?.classList.add('hidden');if(state==='paused')pauseScreen?.classList.remove('hidden');}
function abandonRun(){clearRunSave();el('run-exit-screen')?.classList.add('hidden');goMenu();}

function setPref(name,v){prefs[name]=clamp01(v);try{localStorage.setItem(name==='shake'?PREF_SHAKE:PREF_FLASH,String(prefs[name]))}catch(_){}updatePreferenceUI();}
function updatePreferenceUI(){
 const ss=el('shake-intensity'),fs=el('flash-intensity');if(ss){ss.value=String(prefs.shake);el('shake-intensity-value').textContent=Math.round(prefs.shake*100)+'%';}if(fs){fs.value=String(prefs.flash);el('flash-intensity-value').textContent=Math.round(prefs.flash*100)+'%';}
}

function mpListSpecs(){
 if(!infiniteMode||!(wave===70||wave===90)||!buildRun?.path||milestoneSet().has(wave))return [];
 return eligibleSpecs().map(s=>({...s}));
}
function mpChooseSpec(id){
 const spec=(SPECIALIZATIONS[buildRun?.path]||[]).find(s=>s.id===id);if(!spec||hasSpecialization(id)||milestoneSet().has(wave))return null;
 specSet().add(id);milestoneSet().add(wave);addStat('specializations');checkAchievements();recalcBuildStats();updateUpgradeStrip();return {...spec};
}
const api={prefs,hasSpecialization,shouldOfferSpecialization,openSpecialization,saveCurrentRun,saveAndExit,continueRun,clearRunSave,newRunRequested,requestExit,cancelExit,updateContinueButton,updatePreferenceUI,captureWaveStart,mpListSpecs,mpChooseSpec};
window.ReiEndgame=api;

el('continue-run-btn')?.addEventListener('click',continueRun);
el('save-exit-upgrade')?.addEventListener('click',saveAndExit);
el('run-save-exit')?.addEventListener('click',saveAndExit);
el('run-abandon')?.addEventListener('click',abandonRun);
el('run-exit-cancel')?.addEventListener('click',cancelExit);
el('shake-intensity')?.addEventListener('input',e=>setPref('shake',e.target.value));
el('flash-intensity')?.addEventListener('input',e=>setPref('flash',e.target.value));
updatePreferenceUI();updateContinueButton();
})();
