const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 1280;
const H = 720;
canvas.width = W;
canvas.height = H;
ctx.imageSmoothingEnabled = false;

const atlas = new Image();
let atlasReady = false;
atlas.onload = () => { atlasReady = true; };
atlas.onerror = () => { console.error('Falha ao carregar assets/tileset.png'); };
atlas.src = 'assets/tileset.png';
const lootClosed = new Image(); lootClosed.src = 'assets/chest-closed.png';
const lootOpen = new Image(); lootOpen.src = 'assets/chest-open.png';
const enemyWhiteImage = new Image(); enemyWhiteImage.src = 'assets/enemy-white.png';
const enemyWhite2Image = new Image(); enemyWhite2Image.src = 'assets/enemy-white2.png';
const bossImages = {
  marine: Object.assign(new Image(), { src:'assets/boss-marine.png' }),
  blackbeard: Object.assign(new Image(), { src:'assets/boss-blackbeard.png' }),
  ghost: Object.assign(new Image(), { src:'assets/boss-ghost.png' }),
  ghostKing: Object.assign(new Image(), { src:'assets/boss-ghost-king.png' })
};
const beamFrames = Array.from({ length: 6 }, (_, i) => {
  const img = new Image();
  img.src = `assets/beam-swim-${i + 1}.png`;
  return img;
});
const fxExplosionSmall = new Image(); fxExplosionSmall.src = 'assets/fx-small.png';
const fxExplosionMid = new Image(); fxExplosionMid.src = 'assets/fx-mid.png';
const fxExplosionLarge = new Image(); fxExplosionLarge.src = 'assets/fx-large.png';
const fxSmoke = new Image(); fxSmoke.src = 'assets/fx-smoke.png';

const menu = document.getElementById('menu');
const gameover = document.getElementById('gameover');
const hud = document.getElementById('hud');
const playBtn = document.getElementById('play-btn');
const againBtn = document.getElementById('again-btn');
const menuBtn = document.getElementById('menu-btn');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const healthFill = document.getElementById('health-fill');
const healthValue = document.getElementById('health-value');
const cooldownFill = document.getElementById('cooldown-fill');
const upgradeStrip = document.getElementById('upgrade-strip');
const menuHigh = document.getElementById('menu-highscore');
const menuHighWave = document.getElementById('menu-highwave');
const finalWave = document.getElementById('final-wave');
const finalScore = document.getElementById('final-score');
const finalTime = document.getElementById('final-time');
const reviveBtn = document.getElementById('revive-btn');
const reviveCostEl = document.getElementById('revive-cost');
const finalGold = document.getElementById('final-gold');
const newRecord = document.getElementById('new-record');
const goldEl = document.getElementById('gold');
const goldCard = goldEl?.closest('.hud-card');
const menuDiamonds = document.getElementById('menu-diamonds');
const shopDiamonds = document.getElementById('shop-diamonds');
const shop = document.getElementById('shop');
const shopBtn = document.getElementById('shop-btn');
const shopClose = document.getElementById('shop-close');
const upgradeScreen = document.getElementById('upgrade-screen');
const upgradeGrid = document.getElementById('upgrade-grid');
const upgradeGold = document.getElementById('upgrade-gold');
const upgradeWave = document.getElementById('upgrade-wave');
const upgradeClose = document.getElementById('upgrade-close');
const pauseScreen = document.getElementById('pause-screen');
const resumeBtn = document.getElementById('resume-btn');
const pauseMenuBtn = document.getElementById('pause-menu-btn');
const bossRewardScreen = document.getElementById('boss-reward-screen');
const bossRewardTitle = document.getElementById('boss-reward-title');
const bossRewardText = document.getElementById('boss-reward-text');
const bossRewardImage = document.getElementById('boss-reward-image');
const bossRewardBtn = document.getElementById('boss-reward-btn');
const victoryScreen = document.getElementById('victory-screen');
const victoryContinueBtn = document.getElementById('victory-continue-btn');
const victoryMenuBtn = document.getElementById('victory-menu-btn');
const bossNameEl = document.getElementById('boss-name');
const bossHpFill = document.getElementById('boss-hp-fill');
const bossHpWrap = document.getElementById('boss-hp-wrap');

const soundToggle = document.getElementById('sound-toggle');
const hudSoundToggle = document.getElementById('hud-sound-toggle');
const resetSaveBtn = document.getElementById('reset-save-btn');
const settingsOpenBtn=document.getElementById('settings-open');
const settingsScreen=document.getElementById('settings-screen');
const settingsCloseBtn=document.getElementById('settings-close');
const sfxVolumeSlider=document.getElementById('sfx-volume');
const musicVolumeSlider=document.getElementById('music-volume');
const sfxVolumeValue=document.getElementById('sfx-volume-value');
const musicVolumeValue=document.getElementById('music-volume-value');

/* Efeitos sonoros; a trilha procedural é gerenciada separadamente por ReiMusic. */
const AUDIO = {
  'barrage-launch':'assets/audio/barrage-launch.wav','barrage-impact':'assets/audio/barrage-impact.wav','ghost-impact':'assets/audio/ghost-impact.wav',wreck:'assets/audio/wreck.wav',
  thunder:'assets/audio/thunder.wav', charge:'assets/audio/charge.wav', ghost:'assets/audio/ghost.wav',
  'boss-entry':'assets/audio/boss-entry.wav', victory:'assets/audio/victory.wav', achievement:'assets/audio/achievement.wav',
  click:'assets/audio/click.wav', ui:'assets/audio/ui.wav', shoot:'assets/audio/shoot.wav',
  hit:'assets/audio/hit.wav', damage:'assets/audio/damage.wav', collect:'assets/audio/collect.wav',
  upgrade:'assets/audio/upgrade.wav', heal:'assets/audio/heal.wav', explosion:'assets/audio/explosion.wav', page:'assets/audio/page-flip.wav',
  pierce:'assets/audio/pierce.wav', flame:'assets/audio/flame.wav', 'fire-loop':'assets/audio/fire-loop.wav', sink:'assets/audio/sink.wav', wave:'assets/audio/wave.wav'
};
let savedSfxVolume=1;try{const raw=localStorage.getItem('reiDosMaresSfxVolume');if(raw!==null){const v=Number(raw);if(Number.isFinite(v))savedSfxVolume=Math.max(0,Math.min(1,v));}}catch(_){}
const audioState = { muted:savedSfxVolume<=0, sfxVolume:savedSfxVolume, unlocked:false, lastSfx:{}, burnLoop:null };
const sfxPools = {};
function initAudio(){
  for(const [name,src] of Object.entries(AUDIO)){
    sfxPools[name]=Array.from({length:3},()=>{const a=new Audio(src);a.preload='auto';a.volume=.22;return a;});
  }
  audioState.burnLoop=new Audio(AUDIO['fire-loop']||AUDIO.flame);audioState.burnLoop.preload='auto';audioState.burnLoop.loop=true;audioState.burnLoop.volume=.035*audioState.sfxVolume;
  updateSoundButtons();
}
function updateBurnAudio(count){
  const a=audioState.burnLoop;if(!a)return;const active=count>0;
  if(active&&audioState.unlocked&&!audioState.muted&&state==='play'){a.volume=Math.min(.065,.026+Math.min(6,count)*.006)*audioState.sfxVolume;if(a.paused)a.play().catch(()=>{});}else if(!a.paused){a.pause();a.currentTime=0;}
}
function unlockAudio(){ audioState.unlocked=true;if(window.ReiMusic){window.ReiMusic.unlock();syncMusicState(true);} }
function sfx(name, volume=1, cooldown=0){
  if(bossFight?.silence && bossFight.intro>bossFight.introMax-bossFight.silence) return;
  if(audioState.muted || !audioState.unlocked) return;
  const now=performance.now();
  if(cooldown && now-(audioState.lastSfx[name]||0)<cooldown) return;
  audioState.lastSfx[name]=now;
  const pool=sfxPools[name]; if(!pool) return;
  const a=pool.find(x=>x.paused||x.ended)||pool[0];
  a.pause(); a.currentTime=0; a.volume=Math.max(0,Math.min(.35,.22*volume*audioState.sfxVolume)); a.playbackRate=['shoot','hit','sink','explosion','collect'].includes(name)?.965+Math.random()*.07:1; a.play().catch(()=>{});
}
function setMuted(v){ audioState.muted=v;if(v)stopAllSfx();updateSoundButtons(); }
function setSfxVolume(v){audioState.sfxVolume=Math.max(0,Math.min(1,Number(v)||0));audioState.muted=audioState.sfxVolume<=0;try{localStorage.setItem('reiDosMaresSfxVolume',String(audioState.sfxVolume))}catch(_){}if(audioState.burnLoop&&!audioState.burnLoop.paused)audioState.burnLoop.volume=.035*audioState.sfxVolume;updateSoundButtons();updateSettingsUI();}
function updateSettingsUI(){if(sfxVolumeSlider){sfxVolumeSlider.value=String(audioState.sfxVolume);sfxVolumeValue.textContent=Math.round(audioState.sfxVolume*100)+'%';}if(musicVolumeSlider&&window.ReiMusic){const mv=window.ReiMusic.getVolume();musicVolumeSlider.value=String(mv);musicVolumeValue.textContent=Math.round(mv*100)+'%';}window.ReiEndgame?.updatePreferenceUI?.();}
function openSettings(){unlockAudio();if(!settingsScreen)return;settingsScreen.classList.remove('hidden');updateSettingsUI();sfx('ui',.45);}
function closeSettings(){if(!settingsScreen)return;settingsScreen.classList.add('hidden');sfx('click',.4);}
function updateSoundButtons(){
  const icon=`<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>${audioState.muted?'<path d="m17 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="1.7"/>':'<path d="M16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'}</svg>`;
  for(const btn of [soundToggle,hudSoundToggle])if(btn){btn.innerHTML=icon;btn.title=audioState.muted?'Ativar efeitos sonoros':'Desativar efeitos sonoros';btn.setAttribute('aria-label',btn.title);btn.setAttribute('aria-pressed',String(audioState.muted));}
}

initAudio();
const skinGrid = document.getElementById('skin-grid');
const menuShipImage = document.getElementById('menu-ship-image');

let high = 0;
let highWave = 0;
let diamonds = 0;
let ownedSkins = new Set(['default']);
let selectedSkin = 'default';
try {
  high = Number(localStorage.getItem('reiDosMaresHighScore') || 0);
  highWave = Number(localStorage.getItem('reiDosMaresHighWave') || 0);
  diamonds = Math.max(0, Number(localStorage.getItem('reiDosMaresDiamonds') || 0));
  const owned = JSON.parse(localStorage.getItem('reiDosMaresSkins') || '["default"]');
  if (Array.isArray(owned)) ownedSkins = new Set(['default', ...owned]);
  selectedSkin = localStorage.getItem('reiDosMaresSelectedSkin') || 'default';
  if (!ownedSkins.has(selectedSkin)) selectedSkin = 'default';
} catch (_) {
  high = 0; highWave = 0; diamonds = 0; ownedSkins = new Set(['default']); selectedSkin = 'default';
}
menuHigh.textContent = high;
menuHighWave.textContent = highWave;

const SKINS = [
  // Metadados de colisão/canhão são deliberadamente centrados no casco. A bandeira nunca é hitbox.
  { id:'straw', name:'rei dos piratas', rarity:'COMUM', rarityClass:'common', cost:12, src:'assets/skin-pirate.png', w:116, h:175, cannonY:32, hitboxY:43, hitboxR:28, auraFadeTop:.34 },
  { id:'papyrates', name:'papyrates', rarity:'COMUM', rarityClass:'common', cost:12, src:'assets/skin-papyrates.png', w:116, h:175, cannonY:32, hitboxY:43, hitboxR:28, auraFadeTop:.34 },
  { id:'pandapidio', name:'pandapidio', rarity:'COMUM', rarityClass:'common', cost:12, src:'assets/skin-pandapidio.png', w:145, h:186, cannonY:42, hitboxY:38, hitboxR:27, auraFadeTop:0 },
  { id:'caribe', name:'caribe', rarity:'RARA', rarityClass:'rare', cost:20, src:'assets/skin-caribe.png', w:116, h:184, cannonY:34, hitboxY:46, hitboxR:27, auraFadeTop:.36 },
  { id:'rock-revenge', name:'rock revenge', rarity:'RARA', rarityClass:'rare', cost:20, src:'assets/skin-rock-revenge.png', w:118, h:188, cannonY:43, hitboxY:41, hitboxR:27, auraFadeTop:.18 },
  { id:'holandez', name:'holandês voador', rarity:'ÉPICA', rarityClass:'epic', cost:80, src:'assets/skin-holandez.png', w:116, h:184, cannonY:34, hitboxY:46, hitboxR:27, auraFadeTop:.37 },
  { id:'gullit', name:'gullit', rarity:'ÉPICA', rarityClass:'epic', cost:80, src:'assets/skin-gullit.png', w:120, h:188, cannonY:44, hitboxY:41, hitboxR:27, projectile:'gullit', auraFadeTop:.15 },
  { id:'espectro-abissal', name:'espectro abissal', rarity:'ÉPICA', rarityClass:'epic', cost:80, src:'assets/skin-espectro-abissal.png', w:150, h:185, cannonY:41, hitboxY:39, hitboxR:29, auraFadeTop:.14 },
  { id:'beam', name:'beam', rarity:'LENDÁRIA', rarityClass:'legendary', cost:250, src:'assets/skin-beam.png', w:198, h:116, cannonY:10, hitboxY:5, hitboxR:31, auraFadeTop:0 },
  { id:'midas', name:'midas', rarity:'LENDÁRIA', rarityClass:'legendary', cost:250, src:'assets/skin-midas.png', w:132, h:185, cannonY:44, hitboxY:41, hitboxR:28, projectile:'gold', cosmeticFx:'gold', auraFadeTop:.12 },
  { id:'secret-marine', name:'herói da marinha', rarity:'SECRETA', rarityClass:'secret', cost:0, src:'assets/secret-marine.png', w:156, h:312, hitboxY:96, hitboxR:31, cannonY:58, cannonX:0, secret:true, auraFadeTop:.52 },
  { id:'secret-blackbeard', name:'são eles', rarity:'SECRETA', rarityClass:'secret', cost:0, src:'assets/secret-blackbeard.png', w:158, h:314, hitboxY:98, hitboxR:31, cannonY:60, cannonX:-8, secret:true, auraFadeTop:.52 },
  { id:'secret-pearl', name:'pérola negra', rarity:'SECRETA', rarityClass:'secret', cost:0, src:'assets/secret-pearl.png', w:158, h:314, hitboxY:98, hitboxR:31, cannonY:60, cannonX:-8, secret:true, auraFadeTop:.52 },
  { id:'rei-dos-mares', name:'rei dos mares', rarity:'SECRETA', rarityClass:'secret', cost:0, src:'assets/skin-rei-dos-mares.png', w:130, h:189, cannonY:43, hitboxY:41, hitboxR:28, projectile:'king', cosmeticFx:'royal', secret:true, unlockWave:100, auraFadeTop:.12 }
]
const skinById = Object.fromEntries(SKINS.map(s => [s.id, s]));
const DEFAULT_PLAYER_SKIN_META={id:'default',w:112,h:168,cannonX:0,cannonY:31,hitboxY:43,hitboxR:28,auraFadeTop:.34};
function playerSkinMeta(id){return !id||id==='default'?DEFAULT_PLAYER_SKIN_META:(skinById[id]||DEFAULT_PLAYER_SKIN_META);}
const skinImages = {};
for (const skin of SKINS) {
  const img = new Image();
  img.src = skin.src;
  skinImages[skin.id] = img;
}
const cosmeticProjectileImages={gullit:Object.assign(new Image(),{src:'assets/projectile-gullit.png'}),king:Object.assign(new Image(),{src:'assets/projectile-rei-dos-mares.png'}),gold:Object.assign(new Image(),{src:'assets/projectile-midas.svg'})};
const defaultSkinImage = new Image();
defaultSkinImage.src = 'assets/skin-default.png';

function saveMeta() {
  persistChronicle();
  try {
    localStorage.setItem('reiDosMaresDiamonds', String(diamonds));
    localStorage.setItem('reiDosMaresSkins', JSON.stringify([...ownedSkins]));
    localStorage.setItem('reiDosMaresSelectedSkin', selectedSkin);
  } catch (_) {}
}
function resetSave() {
  const ok = window.confirm('Resetar todo o progresso? Isso apagará diamantes, skins, retratos, títulos, conquistas, diário e recordes deste navegador.');
  if (!ok) return;
  try {
    ['reiDosMaresDiamonds','reiDosMaresSkins','reiDosMaresSelectedSkin','reiDosMaresHighScore','reiDosMaresHighWave','reiDosMaresTutorialSeen','reiDosMaresTutorialBasics','reiDosMaresTutorialCompleted','reiDosMaresActiveRunV2','reiDosMaresActiveRunV3'].forEach(k => localStorage.removeItem(k));
  } catch (_) {}
  high = 0; highWave = 0; diamonds = 0; ownedSkins = new Set(['default']); selectedSkin = 'default';
  infiniteMode = false;
  document.getElementById('tutorial-replay').textContent='APRENDER A JOGAR';
  resetChronicle();
  menuHigh.textContent = '0'; menuHighWave.textContent = '0';
  updateDiamondUI(); updateMenuShip(); renderShop();window.ReiEndgame?.updateContinueButton?.();
  sfx('click', .65);
}
function updateDiamondUI() {
  menuDiamonds.textContent = String(diamonds);
  shopDiamonds.textContent = String(diamonds);
}
function flashUiReward(el){
  if(!el)return;
  el.classList.remove('resource-pop');
  void el.offsetWidth;
  el.classList.add('resource-pop');
  clearTimeout(el._resourcePopTimer);
  el._resourcePopTimer=setTimeout(()=>el.classList.remove('resource-pop'),420);
}
function selectedSkinData() { return skinById[selectedSkin] || null; }
function menuSkinSrc() { return selectedSkin === 'default' ? 'assets/skin-default.png' : (selectedSkinData()?.src || 'assets/skin-default.png'); }
function updateMenuShip() { menuShipImage.src = menuSkinSrc(); }

function renderShop() {
  updateDiamondUI();
  skinGrid.innerHTML = '';
  document.querySelectorAll('[data-shop-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.shopTab===harborUI.tab);b.setAttribute('aria-pressed',String(b.dataset.shopTab===harborUI.tab));});
  skinGrid.classList.toggle('hidden',harborUI.tab!=='ships');
  document.getElementById('portrait-grid').classList.toggle('hidden',harborUI.tab!=='portraits');
  document.getElementById('shop-caption').textContent=harborUI.tab==='ships'?'Navios desbloqueados também podem ser equipados no diário.':'Compre uma vez. Seu retrato fica com você em todas as viagens.';
  if(harborUI.tab==='portraits'){renderAvatarCards(document.getElementById('portrait-grid'));return;}

  for (const skin of SKINS) {
    if (skin.secret && !ownedSkins.has(skin.id)) continue;
    const card = document.createElement('article');
    const owned = ownedSkins.has(skin.id);
    const equipped = selectedSkin === skin.id;
    card.className = `skin-card${owned ? ' owned' : ''}${equipped ? ' equipped' : ''}`;
    card.innerHTML = `
      <div class="skin-preview"><img src="${skin.src}" alt="${skin.name}"></div>
      <div class="skin-name">${skin.name}</div>
      <div class="rarity ${skin.rarityClass}">${skin.rarity}</div>
      <div class="skin-cost">${skin.secret ? '★' : `<img src="assets/diamond.png" alt=""> ${skin.cost}`}</div>
      <button class="skin-action"></button>`;
    const action = card.querySelector('.skin-action');
    if (equipped) {
      action.textContent = 'EQUIPADO';
      action.className += ' equipped-btn';
      action.disabled = true;
    } else if (owned) {
      action.textContent = 'EQUIPAR';
      action.className += ' owned-btn';
      action.addEventListener('click', () => equipSkin(skin.id));
    } else if (diamonds >= skin.cost) {
      action.textContent = `COMPRAR • ${skin.cost} ◆`;
      action.addEventListener('click', () => buySkin(skin.id));
    } else {
      action.textContent = `FALTAM ${skin.cost - diamonds} ◆`;
      action.className += ' locked-btn';
      action.disabled = true;
    }
    skinGrid.appendChild(card);
  }
}
function openShop() {
  unlockAudio(); sfx('ui', .7);
  state = 'shop';
  syncMusicState(true);
  mouse.down = false;
  hideHud();
  menu.classList.add('hidden');
  gameover.classList.add('hidden');
  shop.classList.remove('hidden');
  renderShop();
  document.querySelector('.shop-catalog').scrollTop=0;
  document.getElementById('shop-close-top').focus({preventScroll:true});
}
function closeShop() {
  sfx('click', .7);
  state = 'menu';
  syncMusicState(true);
  mouse.down = false;
  shop.classList.add('hidden');
  menu.classList.remove('hidden', 'leaving');
  document.getElementById('shop-btn').focus({preventScroll:true});
  updateMenuShip();
  updateDiamondUI();
  menuHigh.textContent = high;
  menuHighWave.textContent = highWave;
}
function equipSkin(id) {
  if (!ownedSkins.has(id)) return;
  selectedSkin = id;
  sfx('ui', .8);
  saveMeta();
  updateMenuShip();
  renderShop();
}
function buySkin(id) {
  const skin = skinById[id];
  if (!skin || ownedSkins.has(id) || diamonds < skin.cost) return;
  diamonds -= skin.cost;
  sfx('upgrade', .8);
  ownedSkins.add(id);
  selectedSkin = id;
  saveMeta();
  updateMenuShip();
  renderShop();
}

const keys = new Set();
const mouse = { x: W * 0.58, y: H * 0.45, down: false };

let state = 'menu';
let lastMusicMode='';
function desiredMusicMode(){
  if(state==='paused'||state==='gameover'||(state==='guide'&&voyage?.guideReturn==='paused'))return 'pause';
  if(['menu','shop','collection','victory'].includes(state)||(state==='guide'&&voyage?.guideReturn==='menu'))return 'menu';
  if(['transition','play','upgrade','bossreward','specialization'].includes(state))return 'game';
  return 'pause';
}
function syncMusicState(force=false){
  if(!audioState.unlocked||!window.ReiMusic)return;
  const mode=desiredMusicMode();if(!force&&mode===lastMusicMode)return;lastMusicMode=mode;
  if(mode==='pause')window.ReiMusic.pause();else window.ReiMusic.use(mode);
}

let t = 0;
let last = 0;
let transition = 0;
let score = 0;
let elapsed = 0;
let shake = 0;
let player = null;
let enemies = [];
let chests = [];
let gold = 0;
let lootTexts = [];
let shots = [];
let enemyShots = [];
let particles = [];
let ripples = [];
let foam = [];
let midasTrail = [];
let treasureHunters = [];
let beamBubbles = [];
let beamBursts = [];
let impactEffects = [];
let beamWakeClock = 0;
let wave = 1;
let waveTimer = 0;
let waveSpawnClock = 0;
let waveRemainingToSpawn = 0;
let waveTotal = 0;
let waveCompleteTimer = -1;
let upgradeChoices = [];
let acquiredUpgrades = new Set();
let bossFight = null;
let bossDefeatTimer = -1;
let bossReward = null;
let infiniteMode = false;
let pendingBlackbeardLine = false;
function hasUpgrade(id) { return acquiredUpgrades.has(id); }
function upgradeRarityClass(r) { return Object.keys(BUILD_RARITIES).find(k=>BUILD_RARITIES[k]===r)||'common'; }
function pickRandom(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
function upgradeIconHTML(icon) {
  if (icon === 'double') return '<div class="icon-cannon double"><div class="tube"></div><div class="tube"></div><div class="base"></div><div class="spark"></div></div>';
  return `<div class="icon-cannon ${icon}"><div class="tube"></div><div class="base"></div><div class="spark"></div></div>`;
}
function repairAtPort(){
 const b=BUILD_BALANCE.port;
 if(state!=='upgrade'||initialClassChoice()||buildRun.shop?.repaired||gold<b.repairCost||player.hp>=player.maxHp)return;
 gold-=b.repairCost;buildRun.metrics.goldSpent+=b.repairCost;healBuild(b.repairHeal,player,'port');addStat('portRepairs');checkAchievements();goldEl.textContent=String(gold);
 buildRun.shop.repaired=true;sfx('heal',.7);renderUpgradeChoices();
}
function openUpgradeScreen() {
  if (state === 'gameover' || state === 'victory' || state === 'bossreward') return;
  if(state==='upgrade')return;
  if(window.ReiEndgame?.shouldOfferSpecialization?.()){if(window.ReiEndgame.openSpecialization())return;}
  buildRun.shop=null;
  state = 'upgrade';
  clearVoyageHazards();
  explainFirstShop();
  mouse.down = false;
  renderUpgradeChoices();
  upgradeScreen.classList.remove('hidden');
}
function closeUpgradeScreen() {
  upgradeScreen.classList.add('hidden');
}
function isBossWave(n){return n<=50?[15,25,50].includes(n):infiniteMode&&n>=60&&n%10===0;}
function bossKindForWave(n) {
  if(n>50)return ['marine','blackbeard','ghostKing'][Math.floor((n-60)/10)%3];
  return n === 15 ? 'marine' : n === 25 ? 'blackbeard' : 'ghostKing';
}
function bossConfig(kind){return admiralConfig(kind);}

function startBossWave(kind) {
  setMetaFlag(`reiSeenBoss:${kind}`);
  voyage.event=null; clearVoyageHazards();
  const cfg=bossConfig(kind);
  enemies=[]; enemyShots=[]; shots=[];
  bossFight={kind,defeated:false,cfg};
  bossDefeatTimer=-1;
  const spawnX = kind === 'marine' ? W*0.50 : (kind === 'blackbeard' ? W+150 : W*0.50);
  const spawnY = kind === 'blackbeard' ? H*.28 : -190;
  const vx = kind === 'blackbeard' ? -30 : 0;
  const e={x:spawnX,y:spawnY,vx,vy:0,r:kind==='ghostKing'?105:92,hp:cfg.hp,max:cfg.hp,type:'boss',isBoss:true,bossKind:kind,phase:Math.random()*Math.PI*2,sinking:0,cannonAngle:Math.PI/2,shot:1.4,burn:null,destroyed:false,variant:'boss'};
  enemies.push(e);
  initAdmiral(kind,e);
  bossHpWrap.classList.remove('hidden');
  bossNameEl.textContent=cfg.name;
  bossHpFill.style.width='100%';
  addLootText(player.x, player.y-70, kind==='marine'?'CHEGOU A MARINHA!':kind==='blackbeard'?'BARBA NEGRA SURGIU!':'OS MORTOS SE ERGUEM!', 'reward');
  if(kind!=='ghostKing')sfx('wave',.65);
}
function beginNextWave() {
  recordWaveComplete();
  wave += 1;
  if (wave > highWave) {
    highWave = wave;
    try { localStorage.setItem('reiDosMaresHighWave', String(highWave)); } catch (_) {}
    menuHighWave.textContent = highWave;
  }
  waveTimer = 0;
  waveCompleteTimer = -1;
  waveEl.textContent = String(wave);
  if(wave===100&&!ownedSkins.has('rei-dos-mares')){
    unlockSecretSkin('rei-dos-mares');
    notifyVoyage('SKIN SECRETA DESBLOQUEADA','REI DOS MARES • sua bandeira chegou à onda 100.','#f3ce6b',7,'assets/skin-rei-dos-mares.png');
    addStat('wave100Skin');checkAchievements();
  }
  prepareVoyageWave(wave);
  window.ReiEndgame?.captureWaveStart?.();
  if (isBossWave(wave)) {
    waveRemainingToSpawn=0; waveTotal=0; waveSpawnClock=0;
    startBossWave(bossKindForWave(wave));
    return;
  }
  bossFight=null; bossHpWrap.classList.add('hidden');
  waveSpawnClock = voyage.event ? 2.4 : 1.05;
  addLootText(player.x, player.y - 60, `ONDA ${wave}`, 'reward');
  sfx('wave', .85);
}
function beginFirstWave() {
  wave = 1;
  if (wave > highWave) { highWave = wave; try { localStorage.setItem('reiDosMaresHighWave', String(highWave)); } catch (_) {} }
  waveTimer = 0;
  waveSpawnClock = 0.65;
  waveRemainingToSpawn = 3;
  waveTotal = 3;
  waveCompleteTimer = -1;
  bossFight=null; bossHpWrap.classList.add('hidden');
  waveEl.textContent = '1';
  prepareVoyageWave(1);
  window.ReiEndgame?.captureWaveStart?.();
}
function updateWaves(dt) {
  if (bossFight || voyage.tutorial.active) return;
  waveTimer += dt;
  if (voyage.silentIntro > 0) {
    voyage.silentIntro = Math.max(0, voyage.silentIntro - dt);
    if (voyage.silentIntro <= 0 && activeSea('silence')) notifyVoyage('A TEMPESTADE DESPERTA', 'O silêncio acabou. O céu volta a rachar e o mar inteiro fica perigoso.', '#b5c9ff', 4.6);
    return;
  }
  if (waveRemainingToSpawn > 0) {
    waveSpawnClock -= dt;
    if (waveSpawnClock <= 0 && enemies.filter(enemyIsAlive).length < difficulty().maxAlive) {
      spawnEnemy(wave);
      waveRemainingToSpawn--;
      const pace=activeSea('hunt')?(voyage.spawned%3===0?1.8:.25):voyage.formation==='line'||voyage.formation==='wedge'?.58:.86;
      waveSpawnClock=Math.max(.24,pace-Math.min(wave,50)*.005)*(hasModifier('pursuit')?.85:1);
    }
  }
  const living = enemies.filter(enemyIsAlive);
  const allSpawned = waveRemainingToSpawn <= 0;
  if (allSpawned && !living.length && waveCompleteTimer < 0) {
    recordWaveComplete();
    waveCompleteTimer = wave % 5 === 0 ? 3 : 1.4;
    clearVoyageHazards();
    enemyShots = [];
    if (wave % 5 === 0) notifyVoyage('ÁGUAS LIMPAS', 'Recolha os baús. A loja abrirá em instantes.', '#f5ce78', 3);
  }

  if (waveCompleteTimer >= 0) {
    waveCompleteTimer -= dt;
    if (waveCompleteTimer <= 0) {
      if (wave % 5 === 0) openUpgradeScreen();
      else beginNextWave();
    }
  }
}

function unlockSecretSkin(id) {
  if (!ownedSkins.has(id)) {
    ownedSkins.add(id);
    saveMeta();
  }
  renderShop();
}
function secretForBoss(kind) {
  if (kind === 'marine') return { id:'secret-marine', name:'herói da marinha' };
  if (kind === 'blackbeard') return { id:'secret-blackbeard', name:'são eles' };
  return { id:'secret-pearl', name:'pérola negra' };
}
function showBossReward(kind) {
  setMetaFlag(`reiDefeatedBoss:${kind}`);
  const reward=secretForBoss(kind);
  bossReward={kind,...reward};
  unlockSecretSkin(reward.id);
  bossRewardTitle.textContent=bossFight?.rewardNew?'NOVA SKIN SECRETA':'CHEFE DERROTADO';
  bossRewardText.textContent=bossFight.rewardNew?`Você derrotou o chefe e desbloqueou “${reward.name}” na loja.`:`Você venceu outra vez. “${reward.name}” já faz parte da sua coleção.`;
  bossRewardImage.src=skinById[reward.id].src;
  bossRewardScreen.classList.remove('hidden');
  state='bossreward';
  if(bossFight.endless){bossRewardTitle.textContent='ALMIRANTE DO ABISMO DERROTADO';bossRewardText.textContent=`Onda ${wave} vencida • +${bossFight.cfg.gold} ouro • +2 diamantes • reparo de 20 de vida. A próxima frota aguarda.`;}
  if(kind==='blackbeard'&&!bossFight.endless)pendingBlackbeardLine=true;
}
function continueAfterBossReward() {
  bossRewardScreen.classList.add('hidden');
  if (!bossReward) return;
  if (bossReward.kind==='blackbeard' && pendingBlackbeardLine) {
    pendingBlackbeardLine=false;
    showBossDialogue();
    return;
  }
  enemies=[]; enemyShots=[]; shots=[];
  state='play';
  bossReward=null;
  openUpgradeScreen();
}
function showBossDialogue() {
  bossRewardTitle.textContent='BARBA NEGRA';
  bossRewardText.textContent='“A morte te aguarda na onda 50.”';
  bossRewardImage.src=skinById['secret-blackbeard'].src;
  bossRewardBtn.textContent='CONTINUAR';
  bossRewardScreen.classList.remove('hidden');
  state='bossreward';
}
function defeatBoss(e) {
  if (!bossFight || bossFight.defeated) return;
  bossFight.defeated=true;
  e.destroyed=true; e.sinking=.01;
  score += e.bossKind==='ghostKing'?1000:(e.bossKind==='blackbeard'?650:400);
  scoreEl.textContent=String(score);
  const bossGold=bossFight.cfg.gold;
  gold += bossGold;voyage.runGold+=bossGold;
  goldEl.textContent=String(gold);
  sfx('sink',1.15,100);
  burst(e.x,e.y,'boom',60);
  for(let i=0;i<44;i++){
    const a=Math.random()*Math.PI*2, sp=80+Math.random()*260;
    addParticle(e.x,e.y, e.bossKind==='ghostKing' ? (Math.random()<.5?'#8affc8':'#baffef') : '#d7f5ff', 2+Math.random()*5,.5+Math.random()*.7,Math.cos(a)*sp,Math.sin(a)*sp-50,.9);
  }
  ripples.push({x:e.x,y:e.y,life:0,max:1.25});
  shake=Math.max(shake,14);
  addStat('gold',bossGold);
  admiralDefeated(e);
  bossHpFill.style.width='0%';
}
function updateBossEnemy(e,dt){advanceAdmiral(e,dt);}

const TA = {
  water:  [35, 48, 130, 135],
  water2: [172, 49, 130, 135],
  pirate: [620, 40, 145, 275],
  pirate2:[760, 48, 155, 230],
  white:  [620, 328, 150, 255],
  white2: [760, 335, 160, 245],
  island: [500, 1010, 470, 170]
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, p) { return a + (b - a) * p; }
function smooth(p) { return p * p * (3 - 2 * p); }

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function mixColor(a, b, p) {
  const ar = hexToRgb(a), br = hexToRgb(b);
  return `rgb(${Math.round(lerp(ar[0], br[0], p))},${Math.round(lerp(ar[1], br[1], p))},${Math.round(lerp(ar[2], br[2], p))})`;
}

function resize() {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(W * d));
  canvas.height = Math.max(1, Math.floor(H * d));
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

function drawSprite(key, x, y, w, h, rot = 0, alpha = 1) {
  if (!atlasReady) return;
  const r = TA[key];
  if (!r) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas, r[0], r[1], r[2], r[3], -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawImageSprite(img, x, y, w, h, rot = 0, alpha = 1, flipX = false) {
  if (!img || !img.complete) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(flipX ? -1 : 1, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cohesiveBossSprite(img)||img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawBeam(ship, alpha, x, y) {
  // A animação foi feita para parecer uma criatura nadando, não um barco tremendo.
  // O ciclo é deliberadamente mais lento que a versão anterior e preserva a proporção
  // de cada frame para evitar achatamento/distorção.
  const speed = Math.hypot(ship.vx || 0, ship.vy || 0);
  const fps = speed > 35 ? 6.35 : 5.35;
  const frameIndex = Math.floor((t + (ship.beamPhase || 0)) * fps) % beamFrames.length;
  const img = beamFrames[frameIndex];
  if (!img || !img.complete || !img.naturalWidth) return;

  const maxW = 250;
  const maxH = 145;
  const fit = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
  const w = Math.round(img.naturalWidth * fit);
  const h = Math.round(img.naturalHeight * fit);
  const movingX = Math.abs(ship.vx || 0) > 12 ? ship.vx : ((ship.facingX || 1) * 12);
  const flipX = movingX < 0;
  const swimBob = Math.sin((t + (ship.beamPhase || 0)) * Math.PI * 1.55) * 1.5;
  drawImageSprite(img, x, y + swimBob, w, h, 0, alpha, flipX);
}

function ocean(time,surfaceMix=1){paintSeascape(time,surfaceMix);}

function addParticle(x, y, color, size = 3, life = .5, vx = 0, vy = 0, drag = 0.94) {
  if(particles.length>=780)return;
  particles.push({ x, y, vx, vy, life, max: life, size, color, drag });
}

function burst(x, y, type = 'boom', amount) {
  const n = amount ?? (type === 'splash' ? 22 : 18);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 120 + 35;
    const color = type === 'splash'
      ? (Math.random() < .55 ? '#8deaff' : '#e3fbff')
      : (Math.random() < .45 ? '#ffd66b' : '#667785');
    addParticle(x, y, color, Math.random() * 4 + 2, Math.random() * .5 + .3,
      Math.cos(a) * s, Math.sin(a) * s, 0.90);
  }
}

function reset() {
  resetVoyage();
  resetBuild();
  score = 0;
  gold = 0;
  elapsed = 0;
  wave = 1;
  waveTimer = 0;
  waveSpawnClock = 0;
  waveRemainingToSpawn = 0;
  waveTotal = 0;
  waveCompleteTimer = -1;
  acquiredUpgrades = new Set();
  bossFight = null;
  bossDefeatTimer = -1;
  bossReward = null;
  infiniteMode = false;
  pendingBlackbeardLine = false;
  bossRewardScreen.classList.add('hidden');
  victoryScreen.classList.add('hidden');
  bossHpWrap.classList.add('hidden');
  shake = 0;
  enemies = [];
  chests = [];
  lootTexts = [];
  shots = [];
  enemyShots = [];
  particles = [];
  ripples = [];
  foam = [];
  midasTrail = [];
  treasureHunters = [];
  beamBubbles = [];
  beamBursts = [];
  impactEffects = [];
  beamWakeClock = 0;
  player = {
    x: W / 2,
    y: H / 2,
    vx: 0,
    vy: 0,
    hp: 100,
    maxHp: 100,
    shot: 0,
    inv: 0,
    bob: 0,
    phase: 0,
    cannonAngle: -Math.PI / 2,
    skinId: selectedSkin,
    beamPhase: Math.random() * 1.2,
    facingX: 1,
    beamWakeClock: 0,
    speedMult: 1,
    damageMult: 1,
    incomingDamageMult: 1,
    fireRateMult: 1,
    flame: false,
    doubleShot: false,
    explosive: false,
    piercing: false
  };
  scoreEl.textContent = '0';
  goldEl.textContent = '0';
  waveEl.textContent = '1';
  upgradeScreen.classList.add('hidden');
  updateUpgradeStrip();
  healthFill.style.width = '100%';
  healthValue.textContent = '100';
  cooldownFill.style.width = '100%';
}

function revealHud(p) {
  const q = clamp(p, 0, 1);
  hud.classList.remove('hidden');
  hud.style.opacity = String(q);
  hud.style.transform = `translateY(${-18 * (1 - q)}px) scale(${0.98 + q * 0.02})`;
}

function hideHud() {
  hud.classList.add('hidden');
  hud.style.opacity = '';
  hud.style.transform = '';
}

function start() {
  unlockAudio(); sfx('click', .7);
  reset();
  state = 'transition';
  syncMusicState(true);
  transition = 0;
  mouse.x = W * .62;
  mouse.y = H * .42;
  mouse.down = false;
  gameover.classList.add('hidden');
  closeUpgradeScreen();
  bossRewardScreen.classList.add('hidden');
  victoryScreen.classList.add('hidden');
  bossHpWrap.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  hideHud();
  menu.classList.remove('hidden');
  menu.classList.remove('leaving');
  requestAnimationFrame(() => menu.classList.add('leaving'));
  clearTimeout(voyage.menuTimer);
  voyage.menuTimer=setTimeout(() => {
    if (state !== 'menu') menu.classList.add('hidden');
  }, 520);
  beginFirstWave();
  beginChronicleRun();
  startVoyage();
}

function goMenu() {
  finishChronicleRun(state==='victory'?'victory':state==='gameover'?'death':'menu');
  document.getElementById('collection-screen').classList.add('hidden');
  clearTimeout(voyage.menuTimer);
  clearVoyageHazards();
  voyage.tutorial.active=false;voyage.notice=null;voyage.queue=[];
  keys.clear();
  unlockAudio(); sfx('click', .7);
  state = 'menu';
  syncMusicState(true);
  transition = 0;
  mouse.down = false;
  gameover.classList.add('hidden');
  closeUpgradeScreen();
  bossRewardScreen.classList.add('hidden');
  victoryScreen.classList.add('hidden');
  bossHpWrap.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  hideHud();
  menu.classList.remove('hidden', 'leaving');
  menuHigh.textContent = high;
  menuHighWave.textContent = highWave;
  updateMenuShip();
}

function openPause(){
  if(state !== 'play') return;
  stopAllSfx();
  state='paused';
  syncMusicState(true);
  mouse.down=false;
  keys.clear();
  renderBuildPanel();
  pauseScreen.classList.remove('hidden');
  sfx('ui', .7);
}
function closePause(){
  if(state !== 'paused') return;
  keys.clear();mouse.down=false;
  state='play';
  syncMusicState(true);
  pauseScreen.classList.add('hidden');
  sfx('click', .65);
}

function playerCannonBase(ship=player){
  if(!ship)return{x:0,y:0};
  const id=ship.skinId||selectedSkin,skin=playerSkinMeta(id);
  return{x:ship.x+(skin.cannonX||0),y:ship.y+(id==='beam'?10:(skin.cannonY??31))};
}
function getAimAngle(x, y) {
  const base=playerCannonBase(player);
  return Math.atan2(y-base.y,x-base.x);
}

function currentFireCooldown() { return .70 * (hasUpgrade('double-shot')?BUILD_BALANCE.doubleReload:1) / (player?.fireRateMult || 1); }
function makePlayerProjectile(x,y,angle,speed,damage,{primary=true,veteran=false}={}){
  const special=primary;
  return {
    x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:1.7,
    damage,veteran,primaryPellet:primary,cosmeticProjectile:skinById[player?.skinId||selectedSkin]?.projectile||null,
    ecto:special&&hasUpgrade('ectoplasm'),
    cursed:special&&hasUpgrade('drowned-curse'),
    inferno:special&&hasUpgrade('hellfire'),
    spectral:special&&hasUpgrade('spectral-ammo'),
    radius:8*(special&&hasUpgrade('spectral-ammo')?Math.sqrt(BUILD_BALANCE.ammo):1),
    hitIds:new Set(),
    flame:special&&!!player.flame,
    explosive:special&&!!player.explosive,
    piercing:special&&!!player.piercing&&!player.explosive,
    impactCount:0
  };
}
function shoot() {
  if (state !== 'play' || !player || player.shot > 0 || bossFight?.defeated) return;
  if(bossFight?.silence && bossFight.intro>bossFight.introMax-bossFight.silence) return;
  if(voyage.tutorial.active && voyage.tutorial.step!==2) return;
  const aim = getAimAngle(mouse.x, mouse.y);
  player.cannonAngle = aim;
  const perpX=-Math.sin(aim),perpY=Math.cos(aim);
  const barrelCount=player.doubleShot?2:1;
  const spreadShot=hasUpgrade('spread-shot');
  const guidance=window.ReiEndgame?.hasSpecialization?.('marine-guidance'),speed=600*(hasUpgrade('gunnery')?BUILD_BALANCE.training*(guidance?1.15:1):1);
  buildRun.salvos++;
  const veteran=hasUpgrade('veteran')&&buildRun.salvos%BUILD_BALANCE.veteran.every===0;
  if(veteran)addStat('veteranSalvos');
  const baseDamage=shotBaseDamage()*(veteran?BUILD_BALANCE.veteran.mult:1);
  const b=BUILD_BALANCE.spreadShot,broadside=window.ReiEndgame?.hasSpecialization?.('pirate-broadside'),spreadAngle=broadside?.145:b.angle,sideDamage=broadside?.42:b.side;
  const pattern=spreadShot
    ? [{angle:0,mult:b.center,primary:true},{angle:-spreadAngle,mult:sideDamage,primary:false},{angle:spreadAngle,mult:sideDamage,primary:false}]
    : [{angle:0,mult:1,primary:true}];
  const cannonBase=playerCannonBase(player),barrelLength=(player.skinId||selectedSkin)==='beam'?38:40;
  for(let barrel=0;barrel<barrelCount;barrel++){
    const side=barrelCount===2?(barrel===0?-1:1):0;
    const barrelOffset=barrelCount===2?8:0;
    const x=cannonBase.x+Math.cos(aim)*barrelLength+perpX*barrelOffset*side;
    const y=cannonBase.y+Math.sin(aim)*barrelLength+perpY*barrelOffset*side;
    for(const pellet of pattern){
      shots.push(makePlayerProjectile(x,y,aim+pellet.angle,speed,baseDamage*pellet.mult,{primary:pellet.primary,veteran}));
      buildRun.projectiles++;
    }
  }
  player.shot=currentFireCooldown();
  const volume=player.doubleShot?1:(spreadShot?.95:.85),muzzleX=cannonBase.x+Math.cos(aim)*(barrelLength-3),muzzleY=cannonBase.y+Math.sin(aim)*(barrelLength-3);
  sfx('shoot',volume,55);
  burst(muzzleX,muzzleY,'boom',player.doubleShot?(spreadShot?16:12):(spreadShot?11:8));
  const particles=player.doubleShot?(spreadShot?14:10):(spreadShot?9:6);
  for(let i=0;i<particles;i++){
    const angle=aim+(spreadShot?(Math.random()-.5)*.34:0);
    addParticle(muzzleX,muzzleY,'#fff2c2',Math.random()*3+1,.18,Math.cos(angle)*Math.random()*120,Math.sin(angle)*Math.random()*120,.82);
  }
}


function enemyIsAlive(e) { return e.sinking <= 0 && !e.destroyed; }
function applyEnemyDamage(e, amount, source = 'shot') {
  if (!enemyIsAlive(e) || e.spawnShield>0 || (e.isBoss&&bossFight?.intro>0) || (e.isBoss&&bossFight?.phaseBarrier>0)) return false;
  e.hitFlash=.09;
  const dealt=amount*campaignDamageMultiplier(e);
  if(e.isBoss&&e.bossKind==='ghostKing'&&typeof ghostBossDamageGate==='function'&&ghostBossDamageGate(e,dealt))return true;
  e.hp -= dealt;

  if (e.hp <= 0) destroyEnemy(e);
  return true;
}
function destroyEnemy(e) {
  if (e.destroyed) return;
  if (e.isBoss) { defeatBoss(e); return; }
  if(e.attack&&typeof releasePendingEnemyAttack==='function')releasePendingEnemyAttack(e);
  buildKill(e);
  e.destroyed = true;
  e.sinking = .01;
  campaignEnemyDestroyed(e);
  score += combatSpec(e.role)?.score || (e.type === 'heavy' ? 55 : 20);
  scoreEl.textContent = String(score);
  sfx('sink', .8, 55);
  burst(e.x, e.y, 'boom', 24);
  if (player.skinId === 'beam') beamImpactBurst(e.x, e.y);
  for (let i = 0; i < 10; i++) addParticle(e.x, e.y, '#2a3640', 4 + Math.random() * 3, .8,
    (Math.random() - .5) * 100, -40 - Math.random() * 120, .92);
  if (!onVoyageKill(e)) {
    const drop=buildDropInfo(e),roll=Math.random();
    if(roll<drop.chance)spawnChest(e.x,e.y+4,{bonusLoot:roll>=drop.base,diamondFactor:roll>=drop.base?drop.bonusFactor:1});
  }
}
function explodeShot(s, x, y, directTarget) {
  if (s.exploded) return;
  s.exploded = true;
  s.life = 0;
  sfx('explosion', 1, 70);
  shake = Math.max(shake, 8);
  impactEffects.push({ type:'explosion', inferno:!!s.inferno, x, y, life:0, max:.58, seed:Math.random()*10 });
  for (let i=0;i<28;i++) {
    const a=Math.random()*Math.PI*2, sp=60+Math.random()*180;
    const c=s.inferno?(Math.random()<.5?'#111010':(Math.random()<.55?'#c52f22':'#ff762e')):(Math.random()<.55?'#ffad45':(Math.random()<.5?'#ffd77b':'#59666e'));
    addParticle(x,y,c,2+Math.random()*5,.35+Math.random()*.55,Math.cos(a)*sp,Math.sin(a)*sp,.9);
  }
  ripples.push({x,y,life:0,max:.75});
  for (const e of enemies) {
    if (!enemyIsAlive(e)) continue;
    const d=Math.hypot(e.x-x,e.y-y);
    if (e===directTarget || d < BUILD_BALANCE.explosion.radius) {
      const infernoBonus=e.burn?.black?BUILD_BALANCE.hellfire.explosionTaken:1;
      const dmg = s.damage*(e===directTarget?BUILD_BALANCE.explosion.direct:BUILD_BALANCE.explosion.splash)*closeRangeDamage(e)*infernoBonus;
      const damaged=applyEnemyDamage(e,dmg,'explosion');
      if(damaged)buildHit(e,s,x,y,e!==directTarget);
    }
  }
}
function updateEnemyBurns(dt) {
 let burningCount=0;
 for(const e of enemies){
  if(!e.burn||!enemyIsAlive(e))continue;burningCount++;
  const burn=e.burn,bal=BUILD_BALANCE,finite=Number.isFinite(burn.time);
  burn.age=(burn.age||0)+dt;if(finite)burn.time-=dt;burn.acc+=dt;
  while(burn.acc>=bal.fire.tick&&enemyIsAlive(e)){
   burn.acc-=bal.fire.tick;
   const pct=burn.black?(e.isBoss?bal.hellfire.bossPercent:bal.hellfire.percent):(e.isBoss?bal.fire.bossPercent:bal.fire.percent);
   applyEnemyDamage(e,e.max*pct*bal.fire.tick,'burn-tick');
   const count=burn.black?4:3;
   for(let i=0;i<count;i++)addParticle(e.x+(Math.random()-.5)*50,e.y-12+(Math.random()-.5)*28,burn.black?(i%2?'#d34325':'#151014'):(i%2?'#ff6b21':'#ffc447'),2+Math.random()*3,.45,(Math.random()-.5)*28,-35-Math.random()*38,.9);
  }
  if(finite&&burn.time<=0)e.burn=null;
 }
 updateBurnAudio(burningCount);
}
function enemyShoot(e) {
  if (!player||isSpectral()) return;
  const a = Math.atan2(player.y - e.y, player.x - e.x);
  e.cannonAngle = a;
  const sx = e.x + Math.cos(a) * 42;
  const sy = e.y + Math.sin(a) * 42;
  enemyShots.push({ x: sx, y: sy, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, life: 3.4,owner:e });
  sfx('shoot', .34, 170);
  burst(sx, sy, 'boom', 6);
}

function hitPlayer(baseDamage = 12,source=null,kind='projectile') {
  if (state !== 'play' || !player || player.inv > 0 || voyage.tutorial.active) return;
  if(bossFight?.intro>0 || bossFight?.defeated) return;
  const damage = baseDamage * buildDamageMultiplier(source,kind);
  if(buildRun?.path==='marine'&&damage<baseDamage)buildRun.guardPulse=.35;
  buildRun.lastDamage=damageCause(source,kind);buildRun.metrics.damage+=Math.min(player.hp,damage);buildRun.metrics.avoided+=Math.max(0,baseDamage-damage);
  campaign.damageFlash=.32;
  campaign.damageDirection=source?Math.atan2(source.y-player.y,source.x-player.x):null;
  if(chronicle.run)chronicle.run.waveDamage+=damage;
  player.hp = Math.max(0,player.hp-damage);
  buildOnDamage();
  player.inv = .76;
  sfx('damage', .9, 180);
  shake = 10;
  burst(player.x, player.y, 'splash', 18);
  healthFill.style.width = `${Math.max(0, player.hp / player.maxHp * 100)}%`;
  healthValue.textContent = String(Math.ceil(Math.max(0, player.hp)));
  if (player.hp <= 0) endGame();
}

function formatRunTime(seconds){
  const total=Math.max(0,Math.floor(seconds||0)),m=Math.floor(total/60),s=total%60,h=Math.floor(m/60),mm=m%60;
  return h>0?`${h}:${String(mm).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${mm}:${String(s).padStart(2,'0')}`;
}
function reviveCostForWave(n){return Math.max(6,Math.round(5+Math.max(1,n)*1.4));}
function updateReviveButton(){
  if(!reviveBtn)return;const cost=reviveCostForWave(wave),can=diamonds>=cost;
  reviveCostEl.textContent=String(cost);reviveBtn.disabled=!can;reviveBtn.classList.toggle('unaffordable',!can);
  reviveBtn.title=can?'Voltar para a mesma luta.':'Diamantes insuficientes para reviver.';
}
function endGame() {
  if (state === 'gameover') return;
  const recordBefore=high;
  state = 'gameover';buildRun.awaitingDeath=true;syncMusicState(true);
  mouse.down=false;keys.clear();clearVoyageHazards();enemyShots=[];shots=[];updateBurnAudio(0);
  document.getElementById('death-cause').textContent=buildRun.lastDamage?'Afundado por: '+buildRun.lastDamage:'Causa do naufrágio não registrada.';
  document.getElementById('final-diamonds').textContent=String(voyage.runDiamonds);
  pauseScreen.classList.add('hidden');closeUpgradeScreen();bossHpWrap.classList.add('hidden');
  finalScore.textContent = score;finalGold.textContent = voyage.runGold;finalWave.textContent = wave;if(finalTime)finalTime.textContent=formatRunTime(buildRun.elapsed);
  updateReviveButton();
  const nr = score > recordBefore;newRecord.classList.toggle('hidden',!nr);
  setTimeout(() => { if (state === 'gameover') gameover.classList.remove('hidden'); }, 380);
}
function reviveRun(){
  if(state!=='gameover'||!buildRun?.awaitingDeath)return false;
  const cost=reviveCostForWave(wave);if(diamonds<cost){updateReviveButton();sfx('ui',.6);return false;}
  diamonds-=cost;saveMeta();updateDiamondUI();buildRun.revives++;buildRun.awaitingDeath=false;buildRun.lastDamage=null;
  player.hp=Math.max(1,player.maxHp*.60);player.inv=2.6;player.vx=player.vy=0;refreshBuildHealth();
  enemyShots=[];shots=[];clearVoyageHazards();if(bossFight){bossFight.attack=null;bossFight.attackClock=Math.max(1.6,bossFight.attackClock||0);bossFight.bursts=[];bossHpWrap.classList.remove('hidden');}
  gameover.classList.add('hidden');state='play';syncMusicState(true);mouse.down=false;keys.clear();campaign.damageFlash=0;
  impactEffects.push({type:'heal',x:player.x,y:player.y,life:0,max:.9,seed:Math.random()*10});for(let i=0;i<26;i++){const a=Math.random()*Math.PI*2,sp=45+Math.random()*120;addParticle(player.x,player.y,i%3?'#8deaff':'#fff0ad',2+Math.random()*3,.55+Math.random()*.3,Math.cos(a)*sp,Math.sin(a)*sp,.91);}ripples.push({x:player.x,y:player.y+24,life:0,max:1});
  sfx('heal',1);notifyVoyage('DE VOLTA AO CONVÉS',`Reviveu por ${cost} diamantes • 60% da vida restaurada.`,'#92e7ff',3.2);return true;
}


function addLootText(x, y, text, type='gold') {
  lootTexts.push({ x, y, text, type, life: 1.15, max: 1.15, vy: -32 });
}
function awardChest(chest) {
  const baseAmount = chest.tutorial ? 40 : 20 + Math.floor(Math.random() * 41);
  const amount=Math.round(baseAmount*(hasUpgrade('lighthouse')?BUILD_BALANCE.lighthouse.gold:1));
  const diamondsBefore=diamonds;
  sfx('collect', .30, 40);
  gold += amount;
  flashUiReward(goldCard||goldEl);
  addLootText(chest.x, chest.y - 28, `+${amount} OURO`, 'gold');
  const diamondFactor=chest.tutorial?1:(chest.diamondFactor??1),roll = chest.tutorial ? 1 : Math.random();
  if (roll < 0.02*diamondFactor) {
    diamonds += 5;
    sfx('achievement', .32, 80);
    addLootText(chest.x, chest.y - 48, '+5 DIAMANTES', 'diamond');
    burst(chest.x, chest.y, 'splash', 22);
  } else if (roll < (0.02+0.20)*diamondFactor) {
    diamonds += 1;
    sfx('upgrade', .25, 80);
    addLootText(chest.x, chest.y - 48, '+1 DIAMANTE', 'diamond');
    burst(chest.x, chest.y, 'splash', 18);
  } else {
    burst(chest.x, chest.y, 'boom', 12);
  }
  const repairChance=hasUpgrade('loot-instinct')?(window.ReiEndgame?.hasSpecialization?.('pirate-scavenger')?.40:BUILD_BALANCE.scavenger.repairChance):.05;
  if (Math.random() < repairChance && player && player.hp < player.maxHp) {
    const healed = Math.min(20, player.maxHp - player.hp);
    healBuild(healed,player,'chest');
    healthFill.style.width = `${player.hp / player.maxHp * 100}%`;
    healthValue.textContent = String(Math.ceil(player.hp));
    addLootText(chest.x, chest.y - 68, `KIT DE REPARO +${healed}`, 'heal');
    impactEffects.push({ type:'heal', x:chest.x, y:chest.y, life:0, max:.72, seed:Math.random()*10 });
    sfx('heal', .48, 120);
    for (let i=0;i<16;i++) {
      const a=Math.random()*Math.PI*2, sp=35+Math.random()*75;
      addParticle(chest.x,chest.y,i%2?'#76e6a1':'#c8ffd9',1.8+Math.random()*2.5,.45+Math.random()*.35,Math.cos(a)*sp,Math.sin(a)*sp-20,.94);
    }
  }
  onVoyageChest(chest,amount,diamonds-diamondsBefore);
  saveMeta(); updateDiamondUI(); goldEl.textContent = String(gold);
}
function spawnChest(x, y,meta={}) {
  const safeX = clamp(x, 92, W - 92);
  const safeY = clamp(y, 126, H - 78);
  chests.push({ x: safeX, y: safeY, phase: Math.random() * Math.PI * 2, life: 0, opened: 0, collected: false,diamondFactor:meta.diamondFactor??1,bonusLoot:!!meta.bonusLoot });
}
function spawnBeamWake(ship, dt) {
  const speed = Math.hypot(ship.vx || 0, ship.vy || 0);
  if (ship.skinId !== 'beam' || speed < 28) return;
  ship.beamWakeClock = (ship.beamWakeClock || 0) - dt;
  if (ship.beamWakeClock > 0) return;
  ship.beamWakeClock = 0.075;

  const dirX = ship.vx / (speed || 1);
  const dirY = ship.vy / (speed || 1);
  const bx = ship.x - dirX * 78 + (Math.random() - .5) * 12;
  const by = ship.y - dirY * 38 + (Math.random() - .5) * 12;
  foam.push({ x: bx, y: by, life: .48, max: .48, size: 3 + Math.random() * 4 });
  if (Math.random() < .62) {
    beamBubbles.push({
      x: bx + (Math.random() - .5) * 18,
      y: by + (Math.random() - .5) * 18,
      vx: -dirX * 10 + (Math.random() - .5) * 18,
      vy: -dirY * 10 - 8 - Math.random() * 14,
      r: 1.5 + Math.random() * 2.2,
      life: .7 + Math.random() * .35,
      max: .7 + Math.random() * .35
    });
  }
}


function spawnMidasTrail(ship, dt) {
  const speed=Math.hypot(ship.vx||0,ship.vy||0);
  if(ship.skinId!=='midas'||speed<38)return;
  ship.midasTrailClock=(ship.midasTrailClock||0)-dt;
  if(ship.midasTrailClock>0)return;
  ship.midasTrailClock=.055;
  const dx=ship.vx/speed,dy=ship.vy/speed,px=-dy,py=dx;
  for(const side of [-1,1]){
    const life=.9+Math.random()*.28;
    midasTrail.push({
      x:ship.x-dx*58+px*side*18+(Math.random()-.5)*5,
      y:ship.y-dy*58+py*side*18+46+(Math.random()-.5)*4,
      vx:-dx*(7+Math.random()*9),vy:-dy*(7+Math.random()*9),
      life,max:life,rx:15+Math.random()*8,ry:3.2+Math.random()*1.8,
      angle:Math.atan2(dy,dx),seed:Math.random()*20
    });
  }
  if(midasTrail.length>72)midasTrail.splice(0,midasTrail.length-72);
}
function updateMidasTrail(dt) {
  midasTrail.forEach(w => { w.x += w.vx * dt; w.y += w.vy * dt; w.life -= dt; });
  midasTrail = midasTrail.filter(w => w.life > 0);
}
function drawMidasTrail() {
  for(const w of midasTrail){
    const p=clamp(w.life/w.max,0,1),age=1-p,spread=1+age*.58;
    ctx.save();ctx.translate(w.x,w.y);ctx.rotate(w.angle);
    ctx.globalAlpha=p*.58;ctx.strokeStyle='#dcae3e';ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(0,0,w.rx*spread,w.ry*(1+age*.55),0,0,Math.PI*1.72);ctx.stroke();
    ctx.globalAlpha=p*.30;ctx.strokeStyle='#ffe7a1';ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(-3,0,w.rx*.72*spread,w.ry*.62,0,.18,Math.PI*1.55);ctx.stroke();
    ctx.globalAlpha=p*.22;ctx.fillStyle='#f8cf67';
    const sx=-w.rx*.35+Math.sin(t*7+w.seed)*w.rx*.18;ctx.fillRect(sx,-1.2,2.2,2.2);
    ctx.restore();
  }
}
function spawnTreasureHunter() {
  if (treasureHunters.length || !activeSea('rival')) return;
  const fromLeft = Math.random() < .5;
  const x = fromLeft ? -80 : W + 80;
  const y = H * (.34 + Math.random() * .34);
  treasureHunters.push({ x, y, vx: 0, vy: 0, hp: 3, max: 3, r: 30, side: fromLeft ? 1 : -1, phase: Math.random() * 10, stolen: 0, leaving: false, hitFlash: 0 });
  notifyVoyage('RIVAL À VISTA', 'O caçador de tesouro rival está tentando roubar os baús marcados.', '#7ae0a2', 4.4);
}
function treasureHunterDrops(h) {
  const total = Math.max(1, Math.min(3, h.stolen || 1));
  for (let i = 0; i < total; i++) spawnChest(clamp(h.x + (i - (total - 1) / 2) * 26, 92, W - 92), clamp(h.y + 18, 126, H - 78), { bonusLoot: true });
}
function updateTreasureHunters(dt) {
  if (voyage.rivalClock > 0 && activeSea('rival')) {
    voyage.rivalClock -= dt;
    if (voyage.rivalClock <= 0) spawnTreasureHunter();
  }
  for (const h of treasureHunters) {
    h.hitFlash = Math.max(0, (h.hitFlash || 0) - dt);
    let target = null;
    for (const c of chests) {
      if (c.collected || c.expired) continue;
      const d = Math.hypot(c.x - h.x, c.y - h.y);
      if (!target || d < target.d) target = { chest: c, d };
    }
    let tx = h.side > 0 ? W + 110 : -110;
    let ty = clamp(h.y, 130, H - 90);
    if (target && !h.leaving) { tx = target.chest.x; ty = target.chest.y; }
    else h.leaving = true;
    const a = Math.atan2(ty - h.y, tx - h.x), speed = h.leaving ? 165 : 126;
    h.vx += (Math.cos(a) * speed - h.vx) * Math.min(1, dt * 2.6);
    h.vy += (Math.sin(a) * speed - h.vy) * Math.min(1, dt * 2.6);
    h.x += h.vx * dt; h.y += h.vy * dt;
    if (target && target.d < 54 && !target.chest.collected) {
      target.chest.expired = true;
      h.stolen += 1;
      addLootText(h.x, h.y - 56, 'RIVAL ROUBOU!', 'damage');
      h.leaving = true;
    }
    for (const s of shots) {
      if (s.hitTreasureHunter || Math.hypot(s.x - h.x, s.y - h.y) > h.r + (s.radius || 8)) continue;
      s.hitTreasureHunter = true; s.life = 0;
      h.hp -= Math.max(.9, (s.damage || 1) * .11);
      h.hitFlash = .16;
      burst(s.x, s.y, 'boom', 4);
      if (h.hp <= 0) {
        treasureHunterDrops(h);
        addLootText(h.x, h.y - 62, 'TESOURO RECUPERADO', 'reward');
        sfx('sink', .7, 110);
        burst(h.x, h.y + 8, 'splash', 22);
        h.dead = true;
        break;
      }
    }
  }
  treasureHunters = treasureHunters.filter(h => !h.dead && h.x > -160 && h.x < W + 160 && h.y > 70 && h.y < H + 120);
}
function drawTreasureHunters() {
  for (const h of treasureHunters) {
    const bob = Math.sin(t * 2.7 + h.phase) * 3;
    const alpha = h.hitFlash > 0 ? .72 : 1;
    ctx.save();
    ctx.globalAlpha=.24;ctx.fillStyle='#061018';ctx.beginPath();ctx.ellipse(h.x,h.y+54+bob,47,9,0,0,Math.PI*2);ctx.fill();ctx.restore();
    drawWake(h.x-h.vx*.07,h.y+50+bob,.15,.9);
    // Caçador de recompensas: reaproveita um navio real da frota de bandeira branca
    // em vez do antigo desenho geométrico provisório.
    if(enemyWhite2Image.complete&&enemyWhite2Image.naturalWidth){
      const tilt=clamp((h.vx||0)/300,-.08,.08);
      drawImageSprite(enemyWhite2Image,h.x,h.y+bob,112,164,tilt,alpha,false);
    }else drawImageSprite(enemyWhiteImage,h.x,h.y+bob,112,164,0,alpha,false);
    // Pequeno distintivo dourado identifica o rival sem descaracterizar o sprite.
    ctx.save();ctx.translate(h.x+29,h.y-49+bob);ctx.globalAlpha=.94;ctx.fillStyle='#1a1210';ctx.strokeStyle='#f0c75e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#ffe18a';ctx.font='bold 13px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('$',0,1);ctx.restore();
    ctx.save();ctx.globalAlpha=.9;ctx.fillStyle='#061119';ctx.fillRect(h.x-25,h.y-84+bob,50,5);ctx.fillStyle=h.hitFlash>0?'#fff3cf':'#e4bc52';ctx.fillRect(h.x-25,h.y-84+bob,50*(h.hp/h.max),5);ctx.fillStyle='#f5dfab';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('CAÇADOR DE RECOMPENSAS',h.x,h.y-94+bob);ctx.restore();
  }
}
function beamImpactBurst(x, y) {
  beamBursts.push({ x, y, life: 0, max: .72 });
  shake = Math.max(shake, 8);
  for (let i = 0; i < 34; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 70 + Math.random() * 190;
    const water = Math.random() < .72;
    addParticle(x, y, water ? (Math.random() < .5 ? '#8deaff' : '#e9fdff') : '#587b91',
      2 + Math.random() * 4, .35 + Math.random() * .45, Math.cos(a) * s, Math.sin(a) * s - 35, .91);
  }
  ripples.push({ x, y: y + 8, life: 0, max: 1.0, beam: true });
}

function updateBeamEffects(dt) {
  beamBubbles.forEach(b => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vy -= 3 * dt;
    b.life -= dt;
  });
  beamBubbles = beamBubbles.filter(b => b.life > 0);
  beamBursts.forEach(b => { b.life += dt; });
  beamBursts = beamBursts.filter(b => b.life < b.max);
}

function drawBeamEffects() {
  beamBursts.forEach(b => {
    const p = clamp(b.life / b.max, 0, 1);
    const eased = smooth(p);
    ctx.save();
    ctx.globalAlpha = (1 - p) * .72;
    ctx.strokeStyle = '#a8efff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 8, 16 + eased * 72, 7 + eased * 25, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = (1 - p) * .38;
    ctx.strokeStyle = '#e9ffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 8 + eased * 28, Math.PI * .08, Math.PI * .92);
    ctx.stroke();
    ctx.restore();
  });

  beamBubbles.forEach(b => {
    ctx.save();
    ctx.globalAlpha = clamp(b.life / b.max, 0, 1) * .72;
    ctx.strokeStyle = '#b9f5ff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function updateChests(dt) {
  for (const c of chests) {
    c.life += dt;
    if(!c.collected&&c.life>=30){c.expired=true;for(let i=0;i<7;i++)addParticle(c.x,c.y,'#9f8761',1+Math.random()*2,.35,(Math.random()-.5)*35,-10-Math.random()*28,.9);continue;}
    const dist = Math.hypot(c.x - player.x, c.y - player.y);
    if (!c.collected && dist < 58) {
      c.collected = true;
      c.opened = 0.01;
      awardChest(c);
    }
    if (c.collected) c.opened += dt;
  }
  chests = chests.filter(c => !c.expired && (!c.collected || c.opened < .55));
}
function drawLootSprites() {
  for (const c of chests) {
    const bob = Math.sin(t * 3.1 + c.phase) * 2.5;
    const p = c.collected ? clamp(c.opened / .55, 0, 1) : 0;
    ctx.save();
    const expiryFade=!c.collected&&c.life>25?clamp((30-c.life)/5,0,1):1;const expiryBlink=!c.collected&&c.life>27?(.72+.28*Math.sin(t*16+c.phase)):1;ctx.globalAlpha = (c.collected ? 1 - p : 1)*expiryFade*expiryBlink;
    const glow = ctx.createRadialGradient(c.x, c.y + bob, 2, c.x, c.y + bob, 30);
    glow.addColorStop(0, 'rgba(255,210,86,.18)');
    glow.addColorStop(1, 'rgba(255,210,86,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(c.x - 34, c.y + bob - 34, 68, 68);
    ctx.translate(c.x, c.y + bob);
    const chestImg = c.collected ? lootOpen : lootClosed;
    if (chestImg.complete) ctx.drawImage(chestImg, -30, -27, 60, 54);
    else {
      ctx.fillStyle = '#8a4f24'; ctx.fillRect(-22, -14, 44, 28);
      ctx.strokeStyle = '#f6c35c'; ctx.lineWidth = 2; ctx.strokeRect(-22, -14, 44, 28);
    }
    ctx.restore();
  }
}

function drawLootTexts() {
  lootTexts.forEach(l => {
    const p = clamp(l.life / l.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, p * 1.8);
    ctx.fillStyle = l.type === 'diamond' ? '#7ee9ff' : (l.type === 'heal' ? '#baf7ff' : (l.type === 'reward' ? '#fff1ba' : '#ffd56d'));
    ctx.font = '900 15px monospace'; ctx.textAlign = 'center'; ctx.shadowColor = '#001018'; ctx.shadowBlur = 5;
    ctx.fillText(l.text, l.x, l.y); ctx.restore();
  });
}

function spawnEnemy(currentWave = wave) {
  spawnVoyageEnemy();
}

function updateTransition(dt) {
  const handoffStart = 3.0;
  const handoffEnd = 4.25;
  const hudStart = 3.25;

  transition += dt;

  if (transition >= handoffStart && state === 'transition') {
    state = 'play';
  }

  if (transition >= hudStart) {
    revealHud(smooth((transition - hudStart) / .85));
  }

  updateParticles(dt);
}

function update(dt) {
  updateChronicle(dt);
  if(buildRun&&['transition','play','upgrade','specialization'].includes(state))buildRun.elapsed+=dt;
  if (!['paused','upgrade','guide','collection','bossreward','victory','gameover'].includes(state)) t += dt;

  // A cinemática continua rodando durante o começo do gameplay, evitando qualquer corte
  // enquanto o mar clareia e o HUD entra na tela.
  if ((state === 'transition' || state === 'play') && transition < 4.25) {
    updateTransition(dt);
    if (state === 'transition') return;
  }
  if (state !== 'play') return;
  if (transition >= 4.25) revealHud(1);

  elapsed += dt;
  player.prevX=player.x;player.prevY=player.y;
  player.bob += dt * 3.0;
  player.shot = Math.max(0, player.shot - dt);
  player.inv = Math.max(0, player.inv - dt);
  spawnBeamWake(player, dt);
  spawnMidasTrail(player, dt);
  player.cannonAngle = getAimAngle(mouse.x, mouse.y);

  let ax = 0;
  let ay = 0;
  if (keys.has('w') || keys.has('arrowup')) ay -= 1;
  if (keys.has('s') || keys.has('arrowdown')) ay += 1;
  if (keys.has('a') || keys.has('arrowleft')) ax -= 1;
  if (keys.has('d') || keys.has('arrowright')) ax += 1;
  const len = Math.hypot(ax, ay) || 1;
  ax /= len;
  ay /= len;

  if(!(bossFight?.intro>0)&&!bossFight?.defeated)updateBuild(dt,!!(ax||ay)||Math.hypot(player.vx,player.vy)>.1);
  const boardingSpeed=window.ReiEndgame?.hasSpecialization?.('pirate-boarding')?1.25:BUILD_BALANCE.hook.speed;
  const moveSpeed = 360 * (player.speedMult || 1)*(buildRun.cadaver>0?BUILD_BALANCE.cadaver.speed:1)*(buildRun.boardingRush>0?boardingSpeed:1);
  player.vx += (ax * moveSpeed - player.vx) * Math.min(1, dt * 4.2);
  player.vy += (ay * moveSpeed - player.vy) * Math.min(1, dt * 4.2);
  player.vx *= Math.pow(.90, dt * 60);
  player.vy *= Math.pow(.90, dt * 60);
  if (Math.abs(player.vx) > 12) player.facingX = player.vx < 0 ? -1 : 1;
  player.x = clamp(player.x + player.vx * dt, 55, W - 55);
  player.y = clamp(player.y + player.vy * dt, 95, H - 55);

  if (bossDefeatTimer >= 0) {
    bossDefeatTimer -= dt;
    if (bossDefeatTimer <= 0 && bossFight && bossFight.defeated && state === 'play') {
      bossHpWrap.classList.add('hidden');
      if (wave === 50) {
        const reward=secretForBoss('ghostKing');
        unlockSecretSkin(reward.id);
        bossReward={kind:'ghostKing',...reward};
        victoryScreen.classList.remove('hidden');
        bossRewardImage.src=skinById[reward.id].src;
        state='victory';
        recordVictory();
      } else {
        showBossReward(bossFight.kind);
      }
    }
  }
  if(state !== 'play') return;
  updateVoyage(dt);
  if(state !== 'play') return;
  updateWaves(dt);
  if(state !== 'play') return;

  shots.forEach(s => {
    steerBuildShot(s,dt);
    s.prevX = s.x; s.prevY = s.y;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
  });
  enemyShots.forEach(s => {
    s.prevX=s.x;s.prevY=s.y;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
  });
  shots = shots.filter(s => s.life > 0 && s.x > -120 && s.x < W + 120 && s.y > -120 && s.y < H + 120);
  enemyShots = enemyShots.filter(s => s.life > 0 && s.x > -160 && s.x < W + 160 && s.y > -160 && s.y < H + 160);

  enemies.forEach(e => {
    e.prevX=e.x;e.prevY=e.y;
    if (e.sinking > 0) {
      updateShipSinking(e,dt);
      return;
    }
    if (e.isBoss) {
      updateBossEnemy(e, dt);
      return;
    }

    if(isSpectral()&&!e.attack){e.spawnShield=Math.max(0,e.spawnShield-dt);e.vx*=Math.pow(.02,dt);e.vy*=Math.pow(.02,dt);e.x+=e.vx*dt*(e.ectoSlow?1-BUILD_BALANCE.ecto.slow:1);e.y+=e.vy*dt*(e.ectoSlow?1-BUILD_BALANCE.ecto.slow:1);if(contactWith(e))hitPlayer(difficulty().damage,e,'contact');return;}
    if (updateRoleEnemy(e,dt)) return;
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    const lateEase = wave > 10 ? .91 : 1;
    const speed = (e.type === 'heavy' ? 36 + elapsed * .15 : 53 + elapsed * .22) * lateEase;
    e.vx += (Math.cos(a) * speed - e.vx) * dt * 1.15;
    e.vy += (Math.sin(a) * speed - e.vy) * dt * 1.15;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.cannonAngle = a;
    e.shot -= dt;

    const dist = Math.hypot(e.x - player.x, e.y - player.y);
    if (e.shot <= 0 && dist < 690) {
      enemyShoot(e);
      e.shot = Math.max(1.65, 3.2 - elapsed * .005) + Math.random() * .85;
    }
    if (dist < 52) hitPlayer(12,e,'contact');
  });

  if(state !== 'play') return;
  resolvePlayerShots();
  resolveEnemyShots();

  if(state !== 'play') return;
  updateEnemyBurns(dt);

  enemies = enemies.filter(e => {
    if (e.sinking > 0) {
      if (e.sinking > sinkingDuration(e)) {
        ripples.push({ x: e.x, y: e.y + 12, life: 0, max: .8 });
        burst(e.x, e.y + 12, 'splash', 25);
        return false;
      }
      return true;
    }
    if(e.isBoss)return true; // The final boss waits offscreen during the silent entrance.
    return e.x > -180 && e.x < W + 180 && e.y > -180 && e.y < H + 180;
  });

  updateTreasureHunters(dt);
  updateChests(dt);
  lootTexts.forEach(l => { l.y += l.vy * dt; l.life -= dt; });
  lootTexts = lootTexts.filter(l => l.life > 0);

  if (Math.hypot(player.vx, player.vy) > 45 && Math.random() < dt * 16) {
    foam.push({
      x: player.x - player.vx * .10 + (Math.random() - .5) * 18,
      y: player.y - player.vy * .10 + (Math.random() - .5) * 16,
      life: .65,
      max: .65,
      size: 3 + Math.random() * 4
    });
  }

  updateParticles(dt);
  ripples.forEach(r => { r.life += dt; });
  ripples = ripples.filter(r => r.life < r.max);
  foam.forEach(f => { f.life -= dt; });
  foam = foam.filter(f => f.life > 0);
  updateMidasTrail(dt);
  updateBeamEffects(dt);
  impactEffects.forEach(e => { e.life += dt; });
  impactEffects = impactEffects.filter(e => e.life < e.max && (e.type !== 'flame' || (e.target && e.target.burn && enemyIsAlive(e.target))));

  shake *= Math.pow(.035, dt);
  cooldownFill.style.width = `${(1 - player.shot / currentFireCooldown()) * 100}%`;
}

function updateParticles(dt) {
  particles.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(p.drag, dt * 60);
    p.vy *= Math.pow(p.drag, dt * 60);
    p.life -= dt;
  });
  particles = particles.filter(p => p.life > 0);
}

function drawWake(x, y, strength = .25, scale = 1) {
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.strokeStyle = '#ddfbff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, 52 * scale, 9 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + 25 * scale, y + 3, 25 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
function drawMidasWake(x,y,strength=.28,scale=1){
  drawWake(x,y,strength*.42,scale);
  ctx.save();
  ctx.globalAlpha=strength*.42;
  ctx.strokeStyle='#f0c55d';
  ctx.lineWidth=2.1;
  ctx.beginPath();ctx.ellipse(x-4*scale,y,62*scale,11*scale,0,0,Math.PI*2);ctx.stroke();
  ctx.globalAlpha=strength*.22;
  ctx.fillStyle='#e3b246';
  ctx.beginPath();ctx.ellipse(x-20*scale,y+1,56*scale,6.5*scale,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=strength*.32;
  ctx.strokeStyle='#ffe39d';
  ctx.beginPath();ctx.ellipse(x-34*scale,y+1,34*scale,4.2*scale,0,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}

function drawCannon(x, y, angle, scale = 1, alpha = 1, style = 'normal') {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#4a301d';
  ctx.strokeStyle = '#11161a';
  ctx.lineWidth = 3 * scale;
  ctx.beginPath(); ctx.roundRect(-8*scale + x, -3*scale + y, 16*scale, 9*scale, 3*scale); ctx.fill(); ctx.stroke();
  ctx.translate(x, y); ctx.rotate(angle);
  let metal = style === 'explosive' ? '#8b6528' : '#20282d';
  if (style === 'flame') metal = '#30383d';
  if(style==='inferno')metal='#201413';if(style==='curse')metal='#24534c';if(style==='gold')metal='#b88418';
  ctx.fillStyle = metal; ctx.strokeStyle = '#0a0e11'; ctx.lineWidth = 4*scale;
  ctx.beginPath(); ctx.moveTo(-2*scale,-5*scale); ctx.lineTo(37*scale,-4*scale); ctx.lineTo(44*scale,0); ctx.lineTo(37*scale,4*scale); ctx.lineTo(-2*scale,5*scale); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = style === 'pierce' ? '#83d9f2' : style==='gold' ? '#f3cf69' : '#59646d';
  ctx.fillRect(27*scale,-2.5*scale,12*scale,5*scale);
  ctx.fillStyle = '#aeb8bd'; ctx.fillRect(9*scale,-4*scale,3*scale,8*scale);
  if(style==='ecto'||style==='spectral'){ctx.fillStyle=style==='ecto'?'#55d5b6':'#9ae8de';ctx.fillRect(15*scale,-4*scale,25*scale,8*scale);ctx.fillStyle='#d7fff0';ctx.fillRect(19*scale,-3*scale,15*scale,2*scale);if(style==='ecto'){for(let i=0;i<3;i++){ctx.fillStyle='#61ecba';ctx.fillRect((20+i*8)*scale,3*scale,3*scale,(4+Math.sin(t*4+i)*2)*scale);}}}
  if(style==='inferno'||style==='curse'){ctx.strokeStyle=style==='inferno'?'#f05b31':'#91e7c9';ctx.lineWidth=2*scale;ctx.strokeRect(28*scale,-4*scale,10*scale,8*scale);}
  if (style === 'rapid') { ctx.fillStyle='#8e9aa2'; ctx.fillRect(17*scale,-5*scale,3*scale,10*scale); }
  if (style === 'pierce') { ctx.strokeStyle='#9eeaff'; ctx.lineWidth=2*scale; ctx.strokeRect(29*scale,-4*scale,9*scale,8*scale); }
  if (style === 'flame') {
    ctx.fillStyle='#ffb42d'; ctx.beginPath(); ctx.arc(46*scale,0,5*scale,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff0a0'; ctx.beginPath(); ctx.arc(47*scale,0,2*scale,0,Math.PI*2); ctx.fill();
  }
  if (style === 'explosive') {
    ctx.strokeStyle='#e8a13b'; ctx.lineWidth=2*scale; ctx.beginPath(); ctx.moveTo(8*scale,-5*scale);ctx.lineTo(14*scale,5*scale);ctx.moveTo(14*scale,-5*scale);ctx.lineTo(20*scale,5*scale);ctx.stroke();
  }
  if(style==='gold'){ctx.strokeStyle='#fff2b0';ctx.lineWidth=1.5*scale;ctx.strokeRect(28*scale,-4*scale,10*scale,8*scale);}
  ctx.fillStyle=style==='gold'?'#7d5608':'#11181e'; ctx.beginPath(); ctx.arc(42*scale,0,5*scale,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=style==='gold'?'#f9df88':'#68757d'; ctx.beginPath(); ctx.arc(40.5*scale,0,2*scale,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawBeamCannon(x, y, angle, scale = 1, alpha = 1, style = 'normal') {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x,y);
  ctx.fillStyle = '#3e5661'; ctx.strokeStyle='#0b141a'; ctx.lineWidth=3*scale;
  ctx.beginPath(); ctx.roundRect(-14*scale,4*scale,28*scale,10*scale,4*scale); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='#738d98'; ctx.lineWidth=1.5*scale;
  for(let i=-9;i<=9;i+=6){ctx.beginPath();ctx.moveTo(i*scale,5*scale);ctx.lineTo(i*scale,13*scale);ctx.stroke();}
  ctx.rotate(angle);
  let metal = style==='inferno'?'#201413':style==='curse'?'#24534c':style==='ecto'?'#48b79c':style==='spectral'?'#87cfc9':style==='explosive' ? '#6d6046' : '#303c44';
  ctx.fillStyle=metal; ctx.strokeStyle='#081016'; ctx.lineWidth=3.5*scale;
  ctx.beginPath();ctx.moveTo(-7*scale,-5*scale);ctx.lineTo(30*scale,-4.5*scale);ctx.lineTo(38*scale,0);ctx.lineTo(30*scale,4.5*scale);ctx.lineTo(-7*scale,5*scale);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle=style==='pierce'?'#82dff5':'#6b7c86';
  ctx.fillRect(7*scale,-4*scale,4*scale,8*scale);ctx.fillRect(23*scale,-4*scale,4*scale,8*scale);
  ctx.fillStyle='#aab9c1';ctx.fillRect(28*scale,-2*scale,5*scale,2*scale);
  if(style==='ecto'){ctx.fillStyle='#9dffdb';for(let i=0;i<3;i++)ctx.fillRect((12+i*8)*scale,2*scale,3*scale,(4+Math.sin(t*4+i)*2)*scale);}
  if(style==='flame'){ctx.fillStyle='#ff9e2c';ctx.beginPath();ctx.arc(42*scale,0,5*scale,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff0a0';ctx.beginPath();ctx.arc(43*scale,0,2*scale,0,Math.PI*2);ctx.fill();}
  if(style==='pierce'){ctx.strokeStyle='#a5efff';ctx.lineWidth=2*scale;ctx.strokeRect(29*scale,-4*scale,8*scale,8*scale);}
  if(style==='explosive'){ctx.strokeStyle='#d89a43';ctx.lineWidth=2*scale;ctx.beginPath();ctx.moveTo(7*scale,-5*scale);ctx.lineTo(13*scale,5*scale);ctx.moveTo(13*scale,-5*scale);ctx.lineTo(19*scale,5*scale);ctx.stroke();}
  ctx.fillStyle='#10181e';ctx.beginPath();ctx.arc(38*scale,0,4.5*scale,0,Math.PI*2);ctx.fill();ctx.fillStyle='#65737c';ctx.beginPath();ctx.arc(37*scale,0,2.2*scale,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawPlayerSkin(ship, alpha, x, y) {
  const id = ship.skinId || selectedSkin;
  if (id === 'default') {
    drawSprite('pirate', x, y, 112, 168, 0, alpha);
    return;
  }
  if (id === 'beam') {
    drawBeam(ship, alpha, x, y);
    return;
  }
  const skin = skinById[id] || skinById.straw;
  const img = skinImages[id];
  if (!img || !img.complete) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x - skin.w / 2, y - skin.h / 2, skin.w, skin.h);
  if(skin.cosmeticFx==='royal'){
    ctx.fillStyle='#f6c94f';ctx.globalAlpha=.22+.14*Math.max(0,Math.sin(t*1.9));
    for(let i=0;i<2;i++){const a=t*.42+i*Math.PI,rx=skin.w*.42;ctx.beginPath();ctx.arc(x+Math.cos(a)*rx,y+Math.sin(a)*skin.h*.16,1.7,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
}

function drawShip(ship, isPlayer = false, alpha = 1, offsetY = 0) {
  const phase = Number.isFinite(ship.phase) ? ship.phase : 0;
  const bob = Math.sin(t * 2.7 + phase) * 3;
  const jolt = ship.impactJolt > 0 ? ship.impactJolt : 0;
  const x = ship.x + (jolt ? Math.sin(t*73 + phase)*jolt*16 : 0);
  const y = ship.y + bob + offsetY + (jolt ? Math.cos(t*61 + phase)*jolt*8 : 0);
  const scale = isPlayer ? 1.0 : (ship.isBoss ? 1 : (ship.variant === 'boss-ghost' ? 1.28 : (ship.type === 'heavy' ? 1.10 : .90)));
  const sprite = isPlayer ? 'pirate' : ship.variant;
  const skinId = isPlayer ? (ship.skinId || selectedSkin) : null;
  const roleSpec = !isPlayer && combatSpec(ship.role);
  if(ship.spawnShield>0)alpha*=Math.max(.12,1-ship.spawnShield/1.6);
  const tilt=ship.sinking>0?Math.sin(phase+1)*Math.min(.28,ship.sinking*.2):0;
  const sw = roleSpec ? roleSpec.w : isPlayer ? 112 : (ship.isBoss ? ship.bossKind==='ghostKing'?270:250 : 108 * scale);
  const sh = roleSpec ? roleSpec.h : isPlayer ? 168 : (ship.isBoss ? ship.bossKind==='ghostKing'?330:(ship.bossKind==='marine'?325:300) : 150 * scale);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(3,12,18,.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 51 * scale, 48 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const speed=Math.hypot(ship.vx||0,ship.vy||0);
  const wakeStrength=(.10+Math.min(.22,speed/550)) * alpha;
  if(ship.isBoss){
    // Chefes deslocam muito mais água que um barco normal: rastro largo + segunda esteira.
    const bossWake=.20+Math.min(.28,speed/260);
    drawWake(x-(ship.vx||0)*.13,y+82,bossWake*alpha,2.05);
    drawWake(x-(ship.vx||0)*.22,y+94,bossWake*.55*alpha,1.48);
  }else drawWake(x - ship.vx * .09, y + 49 * scale, wakeStrength, scale);

  if (isPlayer && (ship.skinId || selectedSkin) !== 'default') {
    drawPlayerSkin(ship, alpha, x, y);
  } else if (!isPlayer) {
    let enemyImg;
    if (ship.isBoss) enemyImg = ship.bossKind==='marine' ? bossImages.marine : ship.bossKind==='blackbeard' ? bossImages.blackbeard : bossImages.ghostKing;
    else if(ship.role==='flagship')enemyImg=bossImages.marine;
    else if(ship.role==='warden')enemyImg=bossImages.ghostKing;
    else if(ship.spectral||ship.role==='ghost')enemyImg=bossImages.ghost;
    else if(ship.variant==='pirate')drawSprite('pirate',x,y,sw,sh,tilt,alpha);
    else if (roleSpec) enemyImg=roleImages[ship.role];
    else if (ship.variant === 'boss-ghost') enemyImg = bossImages.ghost;
    else enemyImg = ship.variant === 'white2' ? enemyWhite2Image : enemyWhiteImage;
    if (enemyImg) drawImageSprite(enemyImg, x, y, sw, sh, tilt, alpha, false);
  } else {
    drawSprite(sprite, x, y, sw, sh, 0, alpha);
  }

  if(ship.sinking>0)return;
  if (!isPlayer && (ship.isBoss || ship.role === 'flagship' || ship.role === 'bomber' || ship.role === 'rammer' || ship.spectral)) return;
  const cannonScale = isPlayer ? 1.0 : .82 * scale;
  const style = isPlayer ? (hasUpgrade('ectoplasm')?'ecto':hasUpgrade('hellfire')?'inferno':hasUpgrade('drowned-curse')?'curse':hasUpgrade('spectral-ammo')?'spectral':skinId==='midas'?'gold':ship.explosive ? 'explosive' : ship.flame ? 'flame' : ship.piercing ? 'pierce' : ship.fireRateMult > 1 ? 'rapid' : 'normal') : 'normal';
  const skinMeta=isPlayer?playerSkinMeta(skinId||'default'):(skinId?skinById[skinId]:null);
  const cannonY = skinId === 'beam' ? y + 10 : y + (skinMeta?.cannonY ?? 31);
  const cannonX = skinId === 'beam' ? x : x + (isPlayer ? (skinMeta?.cannonX ?? 0) : 13);
  if (skinId === 'beam') {
    if (ship.doubleShot) {
      const a=ship.cannonAngle ?? 0, px=-Math.sin(a), py=Math.cos(a);
      drawBeamCannon(cannonX + px*7, cannonY + py*7, a, .78, alpha, style);
      drawBeamCannon(cannonX - px*7, cannonY - py*7, a, .78, alpha, style);
    } else drawBeamCannon(cannonX, cannonY, ship.cannonAngle ?? 0, .86, alpha, style);
  } else if (ship.doubleShot) {
    const a=ship.cannonAngle ?? 0, px=-Math.sin(a), py=Math.cos(a);
    drawCannon(cannonX + px*8, cannonY + py*8, a, cannonScale*.82, alpha, style);
    drawCannon(cannonX - px*8, cannonY - py*8, a, cannonScale*.82, alpha, style);
  } else drawCannon(cannonX, cannonY, ship.cannonAngle ?? 0, cannonScale, alpha, style);
}

function drawProjectiles(){drawCachedProjectiles();}

function drawImpactEffects(){
  impactEffects.forEach(e=>{
    const p=clamp(e.life/e.max,0,1),q=smooth(p);
    if(e.type==='explosion'){
      if(e.inferno){ctx.save();ctx.globalAlpha=(1-p)*.85;ctx.strokeStyle='#f15e33';ctx.fillStyle='#15100fda';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,12+q*80,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();continueInfernoEffect(e,p);return;}
      const img=p<.42?fxExplosionSmall:(p<.75?fxExplosionMid:fxExplosionLarge),size=p<.42?72:(p<.75?110:145);
      ctx.save();ctx.globalAlpha=(1-p)*.98;ctx.imageSmoothingEnabled=false;ctx.translate(e.x,e.y);ctx.rotate(Math.sin(e.seed+e.life*8)*.04);ctx.drawImage(img,-size/2,-size/2,size,size);ctx.restore();
      if(p>.18){ctx.save();ctx.globalAlpha=(1-p)*.5;ctx.drawImage(fxSmoke,e.x-62-q*18,e.y-55-q*22,124+q*36,110+q*35);ctx.restore();}
    }else if(e.type==='pierce'){
      ctx.save();ctx.globalAlpha=(1-p)*.9;ctx.strokeStyle='#b8f5ff';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(e.x,e.y,8+q*22,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#65dfff';ctx.lineWidth=1.2;for(let i=0;i<10;i++){const a=e.seed+i*Math.PI/3;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*7,e.y+Math.sin(a)*7);ctx.lineTo(e.x+Math.cos(a)*(20+q*18),e.y+Math.sin(a)*(20+q*18));ctx.stroke();}ctx.restore();
    }else if(e.type==='heal'){
      ctx.save();
      const a=(1-p)*.95;
      ctx.globalAlpha=a; ctx.strokeStyle='#9affc0'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(e.x,e.y,10+q*28,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=a*.72; ctx.strokeStyle='#55df91'; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.arc(e.x,e.y,17+q*38,-Math.PI*.15,Math.PI*1.15); ctx.stroke();
      ctx.fillStyle='#c8ffd9'; ctx.shadowColor='#58e99a'; ctx.shadowBlur=8;
      for(let i=0;i<3;i++){
        const ang=-Math.PI*.72+i*.72, xx=e.x+Math.cos(ang)*(8+q*24), yy=e.y+Math.sin(ang)*(8+q*24)-q*18;
        ctx.beginPath(); ctx.moveTo(xx,yy+5); ctx.lineTo(xx-4,yy); ctx.lineTo(xx,yy-5); ctx.lineTo(xx+4,yy); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }else if(e.type==='flame'&&e.target){
      const x=e.target.x,y=e.target.y,black=e.target.burn?.black;ctx.save();ctx.globalAlpha=.9*(1-.10*p);ctx.globalCompositeOperation=black?'source-over':'lighter';
      const anchors=[[-28,8],[-17,-20],[-5,16],[8,-8],[20,-24],[29,10],[0,-37],[-27,-30],[25,-4]];
      for(let i=0;i<anchors.length;i++){const [ox,oy]=anchors[i],xx=x+ox,yy=y+oy+Math.sin(t*13+i*1.7+e.seed)*3,sc=.85+(i%3)*.18+.12*Math.sin(t*17+i);ctx.fillStyle=black?(i%3===0?'#ff7b2c':i%2?'#08080b':'#b92d22'):(i%3===0?'#fff1a3':i%2?'#ff641d':'#ffbd35');ctx.beginPath();ctx.moveTo(xx,yy+15*sc);ctx.quadraticCurveTo(xx-7*sc,yy+4,xx-2,yy-10*sc);ctx.quadraticCurveTo(xx+8*sc,yy+1,xx+2,yy+15*sc);ctx.fill();if(black){ctx.strokeStyle='#f05a2a';ctx.globalAlpha=.55;ctx.stroke();ctx.globalAlpha=.9*(1-.10*p);}}
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=black?.34:.20;ctx.fillStyle=black?'#111317':'#4a4b4d';for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(x-22+i*15,y-50-Math.sin(t*2+i)*6,7+i*1.4,0,Math.PI*2);ctx.fill();}ctx.restore();
    }else if(e.type==='counter'){
      ctx.save();ctx.globalAlpha=(1-p)*.92;ctx.strokeStyle='#e9fbff';ctx.lineWidth=3;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(e.x,e.y,18+q*(28+i*15),0,Math.PI*2);ctx.stroke();}ctx.strokeStyle='#6fdcff';ctx.lineWidth=1.5;for(let i=0;i<8;i++){const a=i*Math.PI/4+e.seed;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*14,e.y+Math.sin(a)*14);ctx.lineTo(e.x+Math.cos(a)*(36+q*30),e.y+Math.sin(a)*(36+q*30));ctx.stroke();}ctx.restore();
    }
  });
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    if(p.wood){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.spin+p.life*4);ctx.fillRect(-p.size,-1,p.size*2,3);ctx.restore();return;}
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (.4 + .6 * p.life / p.max), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawBossEnvironment() {
  if (!bossFight) return;
  const k = bossFight.kind;
  if (k === 'blackbeard') {
    // Darken the scene, but keep the corruption localized to the boss's water.
    ctx.save();
    ctx.fillStyle = 'rgba(0,3,7,.26)';
    ctx.fillRect(0,0,W,H);
    const boss = enemies.find(x => x.isBoss);
    if (boss) {
      const pulse = .5 + .5 * Math.sin(t * .8);
      const g = ctx.createRadialGradient(boss.x, boss.y + 35, 30, boss.x, boss.y + 35, 250);
      g.addColorStop(0, 'rgba(2,7,8,.62)');
      g.addColorStop(.45, 'rgba(2,9,10,.34)');
      g.addColorStop(1, 'rgba(2,9,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(boss.x-270,boss.y-220,540,520);
      // Thin oily ripples, irregular and subtle rather than black blobs.
      ctx.strokeStyle = `rgba(5,12,13,${.34 + pulse*.10})`;
      ctx.lineWidth = 3;
      for (let i=0;i<5;i++) {
        const rr = 55 + i*31 + Math.sin(t*.7+i)*4;
        ctx.beginPath();
        ctx.ellipse(boss.x, boss.y+58, rr, rr*.19, 0, 0, Math.PI*2);
        ctx.stroke();
      }
      // A few small oil flecks anchored around the boss waterline.
      for (let i=0;i<18;i++) {
        const a = i*2.399 + t*.04;
        const rr = 70 + ((i*37)%150);
        const fx = boss.x + Math.cos(a)*rr;
        const fy = boss.y + 52 + Math.sin(a)*rr*.18;
        ctx.globalAlpha = .18 + (i%3)*.05;
        ctx.fillStyle = '#111a1a';
        ctx.beginPath();
        ctx.ellipse(fx,fy,2+(i%4),1+(i%2),a,0,Math.PI*2);
        ctx.fill();
      }
    }
    ctx.restore();
  } else if (k === 'ghostKing') {
    ctx.save();
    const stage = bossFight.stage || 1;
    const pulse = .5 + .5*Math.sin(t*.55);
    // Possessed sea grows more oppressive each phase without covering combat readability.
    const seaAlpha = stage===1 ? .19 : stage===2 ? .245 : .29;
    ctx.fillStyle = `rgba(18,91,68,${seaAlpha})`;
    ctx.fillRect(0,0,W,H);
    const shade = ctx.createLinearGradient(0,90,0,H);
    shade.addColorStop(0,`rgba(0,16,20,${.10+stage*.025})`);
    shade.addColorStop(.55,'rgba(0,18,20,.03)');
    shade.addColorStop(1,`rgba(0,9,14,${.13+stage*.025})`);
    ctx.fillStyle=shade;ctx.fillRect(0,90,W,H-90);

    // Layered rolling fog. Wide translucent banks create depth instead of flat rectangles.
    const banks = 9 + stage*2;
    for (let i=0;i<banks;i++) {
      const y = 72 + i*(720/banks) + Math.sin(t*(.14+i*.003)+i*1.7)*20;
      const x = ((i*257 + t*(8+i*.72))%(W+620))-310;
      const wide = 470 + (i%3)*95;
      const g = ctx.createRadialGradient(x,y,20,x,y,wide);
      const a=(stage===1?.105:stage===2?.135:.16)*(i%2?1:.82);
      g.addColorStop(0,`rgba(190,240,211,${a})`);
      g.addColorStop(.42,`rgba(160,224,190,${a*.78})`);
      g.addColorStop(1,'rgba(148,218,182,0)');
      ctx.fillStyle=g;
      ctx.beginPath();ctx.ellipse(x,y,wide,50+stage*7,0,0,Math.PI*2);ctx.fill();
    }

    // Haunted current lines and tiny spectral glints keep the water alive.
    ctx.strokeStyle=`rgba(119,227,174,${.09+stage*.022})`;
    ctx.lineWidth=1.5+stage*.18;
    for(let i=0;i<8;i++){
      const y=135+i*88+Math.sin(t*.28+i)*14;
      ctx.beginPath();
      for(let x=0;x<=W;x+=36){
        const yy=y+Math.sin(x*.014+t*.62+i)*5+Math.sin(x*.006-t*.31)*3;
        if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha=.18+stage*.035;
    ctx.fillStyle='#c8ffe0';
    for(let i=0;i<10+stage*3;i++){
      const gx=(i*193+t*(7+i%4))%W, gy=118+(i*101)%620;
      const r=1.2+(i%3)*.65+pulse*.4;
      ctx.beginPath();ctx.arc(gx,gy,r,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
}

function drawBossHighlight(){if(state!=="gameover")drawAdmiralSignals();}


const flameSpriteSets={normal:null,inferno:null};
function getFlameSprites(black=false){
  const key=black?'inferno':'normal';
  if(flameSpriteSets[key])return flameSpriteSets[key];
  const frames=[];
  for(let f=0;f<8;f++){
    const c=document.createElement('canvas');c.width=58;c.height=74;const g=c.getContext('2d');
    const pulse=Math.sin((f/8)*Math.PI*2)*.5+.5;
    g.globalCompositeOperation='source-over';
    const smoke=g.createRadialGradient(29,18,3,29,18,22);
    smoke.addColorStop(0,black?'rgba(8,8,11,.28)':'rgba(95,86,78,.14)');
    smoke.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=smoke;g.beginPath();g.ellipse(29,16,18,10,0,0,Math.PI*2);g.fill();
    const tongues=[[-13,44,18,34],[-2,35,20,42],[12,43,17,32],[0,48,24,28]];
    tongues.forEach((tup,i)=>{
      const [ox,oy,w,h]=tup; const sway=Math.sin((f+i*1.6)*.95)*2.4; const top=oy-h-(i%2?pulse*6:(1-pulse)*4);
      const grad=g.createLinearGradient(0,oy,0,top);
      if(black){
        grad.addColorStop(0,'rgba(2,2,4,.98)');
        grad.addColorStop(.42,'rgba(5,5,8,.97)');
        grad.addColorStop(.78,'rgba(18,6,10,.94)');
        grad.addColorStop(1,'rgba(92,16,26,.72)');
      }else{
        grad.addColorStop(0,'rgba(112,28,9,.88)');
        grad.addColorStop(.32,'rgba(208,61,19,.94)');
        grad.addColorStop(.72,'rgba(255,151,34,.95)');
        grad.addColorStop(1,'rgba(255,242,168,.75)');
      }
      g.fillStyle=grad;
      g.beginPath();
      g.moveTo(29+ox-w*.36,oy);
      g.bezierCurveTo(29+ox-w*.7,oy-h*.18,29+ox-w*.25+sway,oy-h*.58,29+ox+sway*.55,top);
      g.bezierCurveTo(29+ox+w*.22+sway*.35,oy-h*.56,29+ox+w*.68,oy-h*.14,29+ox+w*.32,oy);
      g.closePath(); g.fill();
      if(!black){
        g.globalAlpha=.68; g.fillStyle='rgba(255,248,205,.75)';
        g.beginPath();g.moveTo(29+ox-w*.11,oy-3);g.quadraticCurveTo(29+ox-w*.18+sway*.25,oy-h*.28,29+ox+sway*.25,top+h*.22);g.quadraticCurveTo(29+ox+w*.18,oy-h*.20,29+ox+w*.10,oy-3);g.closePath();g.fill(); g.globalAlpha=1;
      }
    });
    frames.push(c);
  }
  flameSpriteSets[key]=frames; return frames;
}
const burnOverlayCache={};
function getBurnOverlayFrames(black=false,boss=false){
 const key=(black?'inferno':'normal')+(boss?':boss':':ship');if(burnOverlayCache[key])return burnOverlayCache[key];
 const Wc=boss?250:170,Hc=boss?330:215,frames=[],flames=getFlameSprites(black);
 const positions=boss
  ? [[.25,.71,.96],[.38,.57,1.04],[.50,.76,1.12],[.63,.56,1.0],[.76,.70,.94],[.30,.39,.90],[.47,.31,.98],[.67,.40,.94],[.50,.17,.86]]
  : [[.25,.70,.94],[.39,.55,.98],[.52,.73,1.03],[.70,.55,.91],[.49,.32,.92],[.29,.35,.84],[.69,.37,.86]];
 for(let f=0;f<12;f++){
  const c=document.createElement('canvas');c.width=Wc;c.height=Hc;const g=c.getContext('2d');g.imageSmoothingEnabled=true;
  const glow=g.createRadialGradient(Wc*.5,Hc*.64,5,Wc*.5,Hc*.64,Wc*.38);glow.addColorStop(0,black?'rgba(76,8,16,.16)':'rgba(255,88,18,.18)');glow.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=glow;g.beginPath();g.ellipse(Wc*.5,Hc*.63,Wc*.39,Hc*.29,0,0,Math.PI*2);g.fill();
  positions.forEach((pos,i)=>{
    const [rx,ry,base]=pos,variant=(f*5+i*3)%flames.length,fl=flames[variant];
    const sc=base*(.80+((f*17+i*29)%31)/100),ang=((f*13+i*7)%15-7)*Math.PI/180;
    const x=rx*Wc+Math.sin((f+i)*1.37)*3,y=ry*Hc+Math.cos((f*.7+i)*1.11)*2;
    const w=fl.width*sc*(boss?1.12:1),h=fl.height*sc*(boss?1.10:1);
    g.save();g.translate(x,y);g.rotate(ang);g.globalAlpha=.88+((i+f)%3)*.04;g.drawImage(fl,-w/2,-h*.78,w,h);g.restore();
  });
  g.globalAlpha=black?.16:.12;g.fillStyle=black?'#050507':'#4a4541';
  for(let i=0;i<(boss?6:4);i++){const ph=((f+i*2)%12)/12,x=Wc*(.32+i/(boss?8:6))+(i%2?5:-4),y=Hc*(.27-ph*.10);g.beginPath();g.ellipse(x,y,5+ph*6,3+ph*4,0,0,Math.PI*2);g.fill();}
  frames.push(c);
 }
 burnOverlayCache[key]=frames;return frames;
}
function drawBurningShip(e){
 if(!e.burn||e.sinking>0)return;
 const black=e.burn.black,age=e.burn.age||0,intensity=clamp(age/.75,.35,1),boss=!!e.isBoss;
 const overlays=getBurnOverlayFrames(black,boss),idx=Math.floor((t*(black?10.5:12.5)+(e.phase||0)*4)%overlays.length),ov=overlays[idx];
 const w=boss?230:Math.min(156,Math.max(118,e.r*1.72)),h=boss?315:190;
 ctx.save();ctx.globalAlpha=.94*intensity;ctx.drawImage(ov,e.x-w/2,e.y-h*.56,w,h);ctx.restore();
}

function drawGameplay() {
  ripples.forEach(r => {
    const p = clamp(r.life / r.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = (1 - p) * .55;
    ctx.strokeStyle = '#bcefff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, 18 + p * 55, 7 + p * 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  foam.forEach(f => {
    ctx.save();
    ctx.globalAlpha = f.life / f.max;
    ctx.fillStyle = '#d8fbff';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  drawBeamEffects();
  drawVortexWater();
  drawMidasTrail();
  drawBuildPools();
  drawLootSprites();
  drawTreasureHunters();

  enemies.forEach(e => {
    const alpha = e.sinking > 0 ? clamp(1 - e.sinking / sinkingDuration(e), 0, 1) : 1;
    const sinkOffset = e.sinking > 0 ? e.sinking * 13 : 0;
    drawShip(e, false, alpha, sinkOffset);
    if(enemyIsAlive(e))drawBuildDebuffs(e);
    drawBurningShip(e);
    if (e.sinking <= 0 && !e.isBoss) {
      ctx.save();
      ctx.globalAlpha = .82;
      ctx.fillStyle = '#061119';
      ctx.fillRect(e.x - 30, e.y - 63, 60, 4);
      ctx.fillStyle = e.hitFlash>0?'#fff5cb':e.spectral?'#9ee6c0':'#e75b4f';
      ctx.fillRect(e.x - 30, e.y - 63, 60 * (e.hp / e.max), 4);
      ctx.restore();
    }
  });

  drawVoyageFog();
  drawProjectiles();
  drawImpactEffects();

  const playerAlpha = player.inv > 0 && Math.floor(t * 18) % 2 === 0 ? .35 : 1;
  drawClassAura('under');
  drawShip(player, true, isSpectral()?Math.max(.32,playerAlpha*.55):playerAlpha);
  drawClassAura('over');
  drawParticles();
  drawBuildEffects();
  if(state!=="gameover")drawVoyageSignals();
  drawLootTexts();

  ctx.save();
  ctx.translate(mouse.x, mouse.y);
  ctx.strokeStyle = '#e9fbffcc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.moveTo(-22, 0); ctx.lineTo(-7, 0);
  ctx.moveTo(22, 0); ctx.lineTo(7, 0);
  ctx.moveTo(0, -22); ctx.lineTo(0, -7);
  ctx.moveTo(0, 22); ctx.lineTo(0, 7);
  ctx.stroke();
  ctx.fillStyle = '#f6c35c';
  ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function transitionOverlay() {
  const handoffStart = 3.0;
  const handoffEnd = 4.25;
  if (transition < handoffStart) return;
  const q = smooth(clamp((transition - handoffStart) / (handoffEnd - handoffStart), 0, 1));

  // Restos da profundidade desaparecem aos poucos; a luz e a leitura do mar mudam sem corte.
  ctx.save();
  ctx.fillStyle = `rgba(0,12,21,${(1 - q) * .50})`;
  ctx.fillRect(0, 0, W, H);

  const light = ctx.createRadialGradient(W / 2, 70, 10, W / 2, 70, 520);
  light.addColorStop(0, `rgba(232,254,255,${.30 * (1 - q)})`);
  light.addColorStop(.6, `rgba(144,230,255,${.12 * (1 - q)})`);
  light.addColorStop(1, 'rgba(144,230,255,0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = (1 - q) * .35;
  ctx.fillStyle = '#c8f7ff';
  for (let i = 0; i < 22; i++) {
    const x = (i * 71 + t * 12) % W;
    const y = H - ((i * 89 + t * (60 + i * 2)) % (H + 90));
    ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawTransition() {
  const p = smooth(clamp(transition / 3.15, 0, 1));
  ocean(t, p);

  // Feixes de luz e partículas dão continuidade à subida.
  ctx.save();
  ctx.globalAlpha = .12 + p * .22;
  ctx.fillStyle = '#e9ffff';
  ctx.beginPath();
  ctx.moveTo(W * .25, 0);
  ctx.lineTo(W * .38, 0);
  ctx.lineTo(W * .58, H);
  ctx.lineTo(W * .42, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = .24;
  for (let i = 0; i < 34; i++) {
    const x = (i * 97 + t * 18) % W;
    const y = H - ((i * 53 + transition * (80 + i * 2)) % (H + 100));
    const r = 1.5 + (i % 4);
    ctx.fillStyle = '#b8f5ff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // A subida termina com o navio chegando no mesmo ponto onde o gameplay começa.
  const startY = H * .94;
  const targetY = H / 2;
  const shipY = lerp(startY, targetY, p);
  const shipAlpha = smooth(clamp(transition / .45, 0, 1));
  drawShip({
    x: W / 2,
    y: shipY,
    vx: 0,
    vy: 0,
    phase: 0,
    cannonAngle: -Math.PI / 2
  }, true, shipAlpha);

  const vignette = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 720);
  vignette.addColorStop(0, 'rgba(0,7,12,0)');
  vignette.addColorStop(1, `rgba(0,8,16,${.55 * (1 - p)})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function render() {
  updateEndgameHUD();
  updateVoyageUI();
  renderChronicleUI();
  if (state === 'menu'||state==='collection'||state==='shop'||(state==='guide'&&voyage.guideReturn==='menu')) {
    ocean(t * .85, .10);
    return;
  }

  // Durante o handoff, o jogo real já está visível por baixo da camada final da cinemática.
  if (state === 'transition') {
    drawTransition();
    if (transition >= 3.0) {
      ocean(t, smooth(clamp((transition - 3.0) / 1.25, 0, 1)));
      drawGameplay();
      transitionOverlay();
    }
    return;
  }

  const surfaceBlend = transition > 3.0 ? smooth(clamp((transition - 3.0) / 1.25, 0, 1)) : 1;
  ocean(t, surfaceBlend);
  drawBossEnvironment();
  drawVoyageSea();

  ctx.save();
  const shakePref=window.ReiEndgame?.prefs?.shake??1;if (shake > 0&&shakePref>0) ctx.translate(Math.sin(t*93)*shake*.5*shakePref,Math.cos(t*117)*shake*.5*shakePref);
  if (player) drawGameplay();
  ctx.restore();
  drawBossHighlight();
  campaignFeedback();
  if(state==='play')drawDamageDirection();

  if (transition < 4.25 && state === 'play') transitionOverlay();
}

function loop(ts) {
  const dt = Math.min(.033, (ts - last) / 1000 || .016);
  last = ts;
  syncMusicState();
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    e.preventDefault();
    const exitScreen=document.getElementById('run-exit-screen');if(exitScreen&&!exitScreen.classList.contains('hidden')){window.ReiEndgame?.cancelExit?.();return;}
    if(settingsScreen&&!settingsScreen.classList.contains('hidden')){closeSettings();return;}
    if(state==='shop'){closeShop();return;}
    if(state==='collection'){document.getElementById('collection-close').click();return;}
    if(state==='guide'){document.getElementById('field-guide-close').click();return;}
    if (state === 'play') openPause();
    else if (state === 'paused') closePause();
    return;
  }
  if (state !== 'play' && state !== 'transition') return;
  keys.add(k);
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const oldX=mouse.x,oldY=mouse.y;
  mouse.x = clamp((e.clientX - r.left) / r.width * W, 0, W);
  mouse.y = clamp((e.clientY - r.top) / r.height * H, 0, H);
  if(state==='play')tutorialAimMoved(mouse.x-oldX,mouse.y-oldY);
});
canvas.addEventListener('mousedown', e => {
  if(e.button!==0 || state!=='play') return;
  mouse.down = true;
  shoot();
});
window.addEventListener('mouseup', () => { mouse.down = false; });
window.addEventListener('pointerdown', () => unlockAudio(), { once:false, passive:true });
setInterval(() => { if (mouse.down) shoot(); }, 90);

playBtn.addEventListener('click', () => { if(window.ReiEndgame?.newRunRequested)return window.ReiEndgame.newRunRequested(); start(); });
againBtn.addEventListener('click', () => { if(state==='gameover')finishChronicleRun('death'); start(); });
if(reviveBtn)reviveBtn.addEventListener('click',reviveRun);
menuBtn.addEventListener('click', goMenu);
shopBtn.addEventListener('click', openShop);
shopClose.addEventListener('click', closeShop);
if(soundToggle) soundToggle.addEventListener('click', e => { e.stopPropagation(); unlockAudio(); setMuted(!audioState.muted); });
if(resetSaveBtn) resetSaveBtn.addEventListener('click', e => { e.stopPropagation(); resetSave(); });
if(hudSoundToggle) hudSoundToggle.addEventListener('click', e => { e.stopPropagation(); unlockAudio(); setMuted(!audioState.muted); });
if(settingsOpenBtn)settingsOpenBtn.addEventListener('click',e=>{e.stopPropagation();openSettings();});
if(settingsCloseBtn)settingsCloseBtn.addEventListener('click',closeSettings);
if(sfxVolumeSlider)sfxVolumeSlider.addEventListener('input',()=>setSfxVolume(sfxVolumeSlider.value));
if(musicVolumeSlider)musicVolumeSlider.addEventListener('input',()=>{unlockAudio();window.ReiMusic?.setVolume(musicVolumeSlider.value);updateSettingsUI();});
resumeBtn.addEventListener('click', closePause);
pauseMenuBtn.addEventListener('click', () => { if(window.ReiEndgame?.requestExit) window.ReiEndgame.requestExit(); else goMenu(); });
upgradeClose.addEventListener('click', () => { if (state !== 'upgrade'||initialClassChoice()) return; sfx('click', .7); closeUpgradeScreen(); state = 'play'; beginNextWave(); });
bossRewardBtn.addEventListener('click', () => {
  if(state!=='bossreward') return;
  sfx('click',.7);
  if (bossReward && bossReward.kind==='blackbeard' && pendingBlackbeardLine && bossRewardText.textContent.includes('morte te aguarda')) {
    pendingBlackbeardLine=false; enemies=[]; enemyShots=[]; shots=[]; state='play'; bossRewardScreen.classList.add('hidden'); bossReward=null; openUpgradeScreen(); return;
  }
  continueAfterBossReward();
});
victoryContinueBtn.addEventListener('click', () => {
  if(state!=='victory') return;
  sfx('click',.7); victoryScreen.classList.add('hidden'); bossHpWrap.classList.add('hidden'); enemies=[]; enemyShots=[]; shots=[]; infiniteMode=true; state='play'; bossReward=null; openUpgradeScreen();
});
victoryMenuBtn.addEventListener('click', () => { if(state!=='victory') return; goMenu(); });
updateDiamondUI();
updateMenuShip();
initVoyageUI();
initChronicleUI();
updateSettingsUI();

// Diagnóstico simples para teste automatizado local.
window.__reiDebug = () => ({
  state,
  transition: Number(transition.toFixed(3)),
  player: player ? {
    x: Number(player.x.toFixed(2)),
    y: Number(player.y.toFixed(2)),
    hp: player.hp,
    phase: player.phase,
    cannonAngle: Number(player.cannonAngle.toFixed(3))
  } : null,
  enemies: enemies.length,
  chests: chests.length,
  gold,
  diamonds,
  selectedSkin,
  enemyVariants: enemies.map(e => e.variant),
  shots: shots.length,
  enemyShots: enemyShots.length,
  hudOpacity: hud.style.opacity,
  score,
  wave,
  highWave,
  runElapsed:buildRun?.elapsed||0,
  reviveCost:reviveCostForWave(wave),
  waveRemainingToSpawn,
  acquiredUpgrades:[...acquiredUpgrades],
  bossFight: bossFight ? {kind:bossFight.kind, defeated:bossFight.defeated, hp: enemies.find(e=>e.isBoss)?.hp ?? 0} : null,
  infiniteMode,
  tutorial:{active:voyage.tutorial.active,step:voyage.tutorial.step},
  seaEvent:voyage.event,
  formation:voyage.formation,
  hazards:voyage.hazards.length,
  enemyRoles:enemies.filter(enemyIsAlive).map(e=>e.role||e.type),
  ownedSkins:[...ownedSkins],
  atlasReady
});
