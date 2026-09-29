/* Run-only state. Cosmetic saves stay separate. All upgrade tuning is centralized here. */
const BUILD_BALANCE={
 prices:{common:250,rare:600,epic:1500,legendary:2500},speed:1.2,hull:.8,rapid:1.3,
 doubleReload:1.15,carpenter:{interval:8,heal:5,warshipHeal:8},powder:1.15,second:{threshold:.15,heal:20},veteran:{every:5,mult:2.5},warship:1.2,
 wage:{base:15,perFive:5},bravery:{resist:.25,sameDirectionDot:.62,minSpeed:22},training:1.75,lighthouse:{drop:.15,gold:1.20,bonusDiamondFactor:.5},protector:.25,maxResistance:.68,
 pierce:[1.25,1,.75],precise:{angle:.50,turn:2.05,budget:.48,range:360},impact:{speed:235,duration:.30,bossJolt:.18},reflect:{chance:.30,damage:3},
 robbery:.65,robberyRange:110,bonusDiamondFactor:.5,port:{repairCost:350,repairHeal:30,rerollCost:125},spreadShot:{angle:.16,center:.75,side:.35},hook:{range:145,damage:1.15,speed:1.20,duration:2},
 fire:{percent:.12,bossPercent:.025,duration:3.5,tick:.25},hellfire:{percent:.18,bossPercent:.065,bossDuration:7,explosionTaken:1.15},
 explosion:{radius:104,direct:1.30,splash:.90},frenzy:{duration:1.5,mult:1.25},
 spectral:{interval:10,duration:1.5},cadaver:{speed:1.35,duration:2,cooldown:3},ammo:1.15,drowned:{slow:.15,weaken:.15,bossWeaken:.15,duration:3},
 ecto:{radius:52,spectralRadius:76,slow:.15,duration:2,damage:.40,bossMultiplier:.5,max:18},beyond:{fire:1.20,speed:1.25},soul:{heal:5,duration:9,radius:38,max:32},
 scavenger:{repairChance:.30}
};
const BUILD_PATHS={neutral:{name:'Neutra',symbol:'◆',color:'#c4ced0'},marine:{name:'Marinheiro',symbol:'⚓',color:'#8ec9ec'},pirate:{name:'Pirata',symbol:'☠',color:'#df4f59'},undead:{name:'Morto-vivo',symbol:'☽',color:'#79d9b2'}};
const BUILD_RARITIES={common:'COMUM',rare:'RARA',epic:'ÉPICA',legendary:'LENDÁRIA'};
const CLASS_CHOICES={
 marine:{id:'class-marine',path:'marine',cls:'common',rarity:'CLASSE',name:'Marinheiro',desc:'Tanque e precisão. Aguente fogo pesado e transforme tiros difíceis em acertos confiáveis.',icon:'hull'},
 pirate:{id:'class-pirate',path:'pirate',cls:'common',rarity:'CLASSE',name:'Pirata',desc:'Dano massivo e curta distância. Quanto mais agressivo você joga, mais rápido a frota inimiga desaparece.',icon:'blast'},
 undead:{id:'class-undead',path:'undead',cls:'common',rarity:'CLASSE',name:'Morto-vivo',desc:'Velocidade e controle. Mova-se como um fantasma, amaldiçoe grupos e sobreviva com as almas dos afundados.',icon:'blood'}
};
const UPGRADES=[
 ['swift-oars','Maior Velocidade','neutral','common','+20% de velocidade de movimento.','swift'],
 ['thick-hull','Casco Grosso','neutral','common','Receba 20% menos dano.','hull'],
 ['carpenter','Carpinteiro','neutral','common','Recupere 5 de vida a cada 8 s de jogo ativo.','hull'],
 ['rapid-fire','Recarga Rápida','neutral','rare','+30% de frequência de disparo.','rapid'],
 ['refined-powder','Pólvora Refinada','neutral','rare','+15% de dano base dos canhões.','blast'],
 ['second-wind','Segundo Fôlego','neutral','rare','Uma vez por onda, ao chegar a 15% de vida ou menos, repare 20 de vida.','hull'],
 ['double-shot','Tiro Duplo','neutral','epic','Dispare duas balas completas por salva. Como compensação, a recarga fica 15% mais lenta.','double'],
 ['veteran','Artilheiro Veterano','neutral','epic','Cada quinta salva causa 250% do dano base em todas as suas balas.','pierce'],
 ['warship','Navio de Guerra','neutral','legendary','+20% de vida máxima e dano base. Preserva a proporção de vida.','double'],
 ['honest-work','Trabalho Digno','marine','common','A tripulação recebe salário crescente: +15 ouro, mais +5 para cada 5 ondas alcançadas, ao concluir uma onda.','hull'],
 ['sentry','Sem Medo','marine','common','Ao ser atingido por um projétil enquanto navega contra ou cruzando a trajetória dele, resista a 25% do dano. Sem recarga.','hull'],
 ['gunnery','Treino de Artilharia','marine','common','Projéteis viajam 75% mais rápido. A diferença é imediata e reduz muito o tempo para o alvo escapar.','rapid'],
 ['lighthouse','Farol','marine','rare','Aumenta a chance de saque em 15 pontos e dá +20% de ouro nos baús. O bônus de baús não multiplica diamantes na mesma proporção.','pierce'],
 ['protector','O Protetor','marine','rare','Receba 25% menos dano. Combina com outras defesas.','hull'],
 ['piercing-shot','Tiro Perfurante','marine','epic','Atravesse 3 alvos: 125%, 100% e 75% do dano base.','pierce'],
 ['precise-shot','Tiro Preciso','marine','epic','Tiros próximos do alvo corrigem a trajetória de forma forte e visível, sem se tornarem mísseis teleguiados.','pierce'],
 ['impact-shot','Tiro Impactante','marine','epic','Empurre navios com força baseada no peso deles. Leves voam longe; pesados cedem pouco; chefes sofrem um tranco visual.','blast'],
 ['counterattack','Contra-Ataque','marine','legendary','30% de chance de rebater um projétil prestes a acertar. O tiro devolvido causa 3× o dano original.','pierce'],
 ['sure-robbery','Roubo Certeiro','pirate','common','Destrua um navio a até 11 metros para ter 65% de chance de saque. Baús extras preservam o ouro, mas têm chance reduzida de diamantes.','hull'],
 ['spread-shot','Tiro Espalhado','pirate','common','Cada canhão dispara 3 balas em leque: 75% no centro e 35% em cada lateral. De perto, as três podem atingir o mesmo alvo e somar 145%. Somente a bala central recebe efeitos especiais.','blast'],
 ['boarding-hook','Abordagem','pirate','common','A até 14,5 metros do inimigo, cause +15% de dano. Afundar de perto concede +20% de movimento por 2 s.','hook'],
 ['flame-shot','Tiro Flamejante','pirate','rare','Queime 12% da vida máxima/s por 3,5 s. Chefes: 2,5%/s. Novos acertos renovam a duração.','flame'],
 ['loot-instinct','Saqueador','pirate','rare','Vasculhe melhor os baús: a chance de encontrar um kit de reparo sobe de 5% para 30%.','magnet'],
 ['explosive-shot','Tiro Explosivo','pirate','epic','Explosão em 10,4 metros: 130% no alvo direto e 90% nos vizinhos.','explosive'],
 ['combat-frenzy','Sangue Frio','pirate','epic','Afundar um inimigo concede +25% de dano por 1,5 s. Renova, não acumula.','flame'],
 ['hellfire','Fogo do Inferno','pirate','legendary','Requer Explosivo + Flamejante. Explosões espalham fogo negro: 18% da vida/s em comuns; 6,5%/s por 7 s em chefes. Alvos em fogo negro recebem +15% de dano explosivo.','flame'],
 ['spectral-look','Aparência Espectral','undead','common','A cada 10 s, fique espectral por 1,5 s. Inimigos deixam de iniciar perseguições e ataques novos, mas golpes já iniciados continuam.','blood'],
 ['cadaver-hull','Casco Cadavérico','undead','common','Receber dano dá +35% de movimento por 2 s. Intervalo mínimo: 3 s.','swift'],
 ['spectral-ammo','Munição Espectral','undead','common','Projéteis com área de colisão 15% maior. Amplia as poças de Ectoplasma de 5,2 para 7,6 metros.','blood'],
 ['drowned-curse','Maldição dos Afogados','undead','rare','Acertos e Ectoplasma amaldiçoam por 3 s: -15% de movimento e -15% de dano causado, inclusive em chefes.','blood'],
 ['ectoplasm','Ectoplasma','undead','epic','Poças de 5,2 metros por 2 s: entrada causa 40% do dano do tiro (chefes: metade). O alvo que cria a poça não sofre dano imediato dela.','blood'],
 ['beyond-speed','Velocidade do Além','undead','epic','+25% de movimento e +20% de frequência de disparo. Combina com Recarga Rápida.','rapid'],
 ['soul-devourer','Tiro Devorador de Alma','undead','legendary','Afundamentos deixam almas por 9 s. Passe sobre elas para recuperar 5 de vida.','blood']
].map(([id,name,path,cls,desc,icon])=>({id,name,path,cls,rarity:BUILD_RARITIES[cls],cost:BUILD_BALANCE.prices[cls],desc,icon}));
const upgradeById=Object.fromEntries(UPGRADES.map(u=>[u.id,u]));
let buildRun;
function resetBuild(){buildRun={path:null,pendingPath:null,active:0,elapsed:0,revives:0,awaitingDeath:false,carpenter:0,spectralClock:0,spectral:0,cadaver:0,cadaverCooldown:0,frenzy:0,boardingRush:0,bravery:0,guardPulse:0,projectiles:0,salvos:0,shop:null,lastDamage:null,metrics:{healing:{},damage:0,avoided:0,reflected:0,goldSpent:0},secondWave:0,wageWaves:new Set(),specializations:new Set(),specializationMilestones:new Set(),pools:[],souls:[],reflection:0};}
function isSpectral(){return !!buildRun&&buildRun.spectral>0;}
function classChoiceStage(){return !buildRun.path&&!buildRun.pendingPath;}
function initialClassChoice(){return !buildRun.path;}
function upgradeEligible(u){return !hasUpgrade(u.id)&&(u.path==='neutral'||u.path===buildRun.path)&&(u.id!=='hellfire'||hasUpgrade('flame-shot')&&hasUpgrade('explosive-shot'));}
function buildUpgradeChoices(){
 if(classChoiceStage())return Object.values(CLASS_CHOICES);
 if(initialClassChoice()){
  const pool=UPGRADES.filter(u=>u.path===buildRun.pendingPath&&u.cls==='common');
  const first=pickRandom(pool),rest=pool.filter(u=>u!==first),second=pickRandom(rest);
  return [first,second].filter(Boolean);
 }
 const out=[];
 for(const rarity of ['common','rare','epic']){
  let pool=UPGRADES.filter(u=>u.cls===rarity&&upgradeEligible(u));
  if(!pool.length)pool=UPGRADES.filter(u=>u.cls==='legendary'&&upgradeEligible(u)&&!out.includes(u));
  if(pool.length)out.push(pickRandom(pool));
 }
 return out;
}
function effectiveUpgradeCost(u){return initialClassChoice()?0:u.cls==='legendary'?u.cost:Math.round(u.cost*(wave<=15?.5:wave<=20?.75:1));}
function upgradeDescription(u){
 let desc=u.desc;
 if(u.id==='explosive-shot'&&hasUpgrade('hellfire'))desc='EVOLUÍDO EM FOGO DO INFERNO: explosões de 10,4 metros espalham fogo negro. Dano direto 130%; área 90%; alvos incendiados recebem +15% de dano explosivo.';
 if(u.id==='ectoplasm'&&hasUpgrade('spectral-ammo'))desc=desc.replace('5,2 metros','7,6 metros');
 if(u.id==='flame-shot'&&hasUpgrade('hellfire'))desc='CHAMAS NEGRAS: 18% da vida máxima/s em inimigos comuns; chefes queimam por 7 s a 6,5%/s. Aplicações renovam, não acumulam.';
 if(hasUpgrade(u.id)){
  const b=BUILD_BALANCE,seconds=x=>Math.max(0,x).toFixed(1);
  const carpenterHeal=hasUpgrade('warship')?b.carpenter.warshipHeal:b.carpenter.heal;
  const status={carpenter:`Próximo reparo em ${seconds(b.carpenter.interval-buildRun.carpenter)} s. Cura atual: ${carpenterHeal}.`,
   'second-wind':buildRun.secondWave===wave?'Já utilizado nesta onda.':'Disponível nesta onda.',
   veteran:`Próximo tiro especial em ${b.veteran.every-buildRun.salvos%b.veteran.every} salva(s).`,
   'spectral-look':isSpectral()?`Espectral por mais ${seconds(buildRun.spectral)} s.`:`Próxima aparição em ${seconds(b.spectral.interval-buildRun.spectralClock)} s.`,
   'cadaver-hull':buildRun.cadaverCooldown>0?`Disponível em ${seconds(buildRun.cadaverCooldown)} s.`:'Pronto para ativar.',
   'combat-frenzy':buildRun.frenzy>0?`Sangue Frio ativo: ${seconds(buildRun.frenzy)} s.`:'Aguardando um afundamento.',
   'boarding-hook':buildRun.boardingRush>0?`Impulso de abordagem: ${seconds(buildRun.boardingRush)} s.`:'Afunde de perto para ganhar impulso.'};
  if(status[u.id])desc+=' '+status[u.id];
 }
 return desc;
}
function recalcBuildStats(){
 const b=BUILD_BALANCE;
 const beyondMove=window.ReiEndgame?.hasSpecialization?.('undead-beyond')?1.32:b.beyond.speed;
 const beyondFire=window.ReiEndgame?.hasSpecialization?.('undead-beyond')?1.26:b.beyond.fire;
 player.speedMult=(hasUpgrade('swift-oars')?b.speed:1)*(hasUpgrade('beyond-speed')?beyondMove:1);
 player.fireRateMult=(hasUpgrade('rapid-fire')?b.rapid:1)*(hasUpgrade('beyond-speed')?beyondFire:1);
 player.damageMult=(hasUpgrade('refined-powder')?b.powder:1)*(hasUpgrade('warship')?b.warship:1);
 player.flame=hasUpgrade('flame-shot');player.doubleShot=hasUpgrade('double-shot');player.explosive=hasUpgrade('explosive-shot');player.piercing=hasUpgrade('piercing-shot');
}
function applyBuildUpgrade(id){
 const u=upgradeById[id];if(!u||hasUpgrade(id))return false;
 if(!buildRun.path){if(!buildRun.pendingPath||u.path!==buildRun.pendingPath||u.cls!=='common')return false;buildRun.path=u.path;buildRun.pendingPath=null;}
 if(!upgradeEligible(u))return false;
 acquiredUpgrades.add(id);if(id==='hellfire')addStat('hellfireBuilds');if(u.cls==='legendary')addStat('legendaryBuilds');const b=BUILD_BALANCE;
 if((id==='flame-shot'||id==='hellfire')&&typeof getBurnOverlayFrames==='function')setTimeout(()=>{try{getBurnOverlayFrames(id==='hellfire',false);getBurnOverlayFrames(id==='hellfire',true)}catch(_){}},0);
 if(id==='thick-hull')player.incomingDamageMult=b.hull;
 if(id==='warship'){const ratio=player.hp/player.maxHp;player.maxHp*=b.warship;player.hp=player.maxHp*ratio;}
 recalcBuildStats();refreshBuildHealth();updateUpgradeStrip();return true;
}
function refreshBuildHealth(){healthFill.style.width=`${player.hp/player.maxHp*100}%`;healthValue.textContent=String(Math.ceil(player.hp));}
function healBuild(amount,recipient=player,source="other"){const healed=Math.max(0,Math.min(amount,recipient.maxHp-recipient.hp));recipient.hp+=healed;if(recipient===player&&buildRun)buildRun.metrics.healing[source]=(buildRun.metrics.healing[source]||0)+healed;if(recipient===player)refreshBuildHealth();return healed;}
function playerHitCenter(){const skin=playerSkinMeta?.(player?.skinId||selectedSkin)||{};return{x:player.x,y:player.y+(skin.hitboxY??43),r:skin.hitboxR||28};}
function contactWith(e){const h=playerHitCenter();return Math.hypot(h.x-e.x,h.y-e.y)<(e.isBoss?e.r*.64+h.r*.68:e.r*.65+h.r*.76);}
function buildDropInfo(e){
 const near=hasUpgrade('sure-robbery')&&Math.hypot(player.x-e.x,player.y-e.y)<=BUILD_BALANCE.robberyRange;
 const bonus=near?BUILD_BALANCE.robbery-.30:(hasUpgrade('lighthouse')?BUILD_BALANCE.lighthouse.drop:0);
 return{chance:.30+Math.max(0,bonus),base:.30,bonusFactor:near?BUILD_BALANCE.bonusDiamondFactor:hasUpgrade('lighthouse')?BUILD_BALANCE.lighthouse.bonusDiamondFactor:1};
}
function buildDropChance(e){return buildDropInfo(e).chance;}
function buildKill(e){
 if(e.tutorial)return;
 const close=Math.hypot(player.x-e.x,player.y-e.y)<=BUILD_BALANCE.robberyRange;
 if(hasUpgrade('sure-robbery')&&close)addStat('closePlunder');
 const boardSpec=window.ReiEndgame?.hasSpecialization?.('pirate-boarding');
 if(hasUpgrade('boarding-hook')&&Math.hypot(player.x-e.x,player.y-e.y)<=(boardSpec?170:BUILD_BALANCE.hook.range))buildRun.boardingRush=boardSpec?2.6:BUILD_BALANCE.hook.duration;
 if(hasUpgrade('combat-frenzy'))buildRun.frenzy=window.ReiEndgame?.hasSpecialization?.('pirate-coldblood')?2.1:BUILD_BALANCE.frenzy.duration;
 if(hasUpgrade('soul-devourer')){buildRun.souls.push({x:clamp(e.x,55,W-55),y:clamp(e.y,95,H-55),life:BUILD_BALANCE.soul.duration,age:0,collected:false});if(buildRun.souls.length>BUILD_BALANCE.soul.max)buildRun.souls.shift();}
}
function collectSoul(soul,recipient){if(soul.collected||soul.life<=0||recipient.hp>=recipient.maxHp)return false;const ancient=window.ReiEndgame?.hasSpecialization?.('undead-souls'),radius=ancient?45:BUILD_BALANCE.soul.radius,heal=ancient?7:BUILD_BALANCE.soul.heal;if(Math.hypot(soul.x-recipient.x,soul.y-recipient.y)>radius)return false;soul.collected=true;healBuild(heal,recipient,"soul");addStat("soulsGathered");sfx('heal',.45,100);return true;}
function buildWaveReward(){
 if(!buildRun||buildRun.wageWaves.has(wave))return;buildRun.wageWaves.add(wave);
 if(hasUpgrade('honest-work')){const amount=BUILD_BALANCE.wage.base+BUILD_BALANCE.wage.perFive*Math.floor(wave/5);gold+=amount;voyage.runGold+=amount;addStat('gold',amount);goldEl.textContent=String(gold);addLootText(player.x,player.y-64,`TRABALHO DIGNO +${amount} OURO`,'gold');notifyVoyage('TRABALHO DIGNO',`Onda ${wave} concluída • +${amount} ouro da tripulação.`,BUILD_PATHS.marine.color,2.5);}
}
function braveryApplies(source,kind){
 if(kind!=='projectile'||!hasUpgrade('sentry')||!source)return false;
 const pv=Math.hypot(player.vx||0,player.vy||0),sv=Math.hypot(source.vx||0,source.vy||0);if(pv<BUILD_BALANCE.bravery.minSpeed||sv<1)return false;
 const dot=((player.vx||0)*(source.vx||0)+(player.vy||0)*(source.vy||0))/(pv*sv);
 return dot<BUILD_BALANCE.bravery.sameDirectionDot;
}
function buildDamageMultiplier(source,kind){
 const b=BUILD_BALANCE,owner=source?.owner||source?.source?.owner||source;let mult=player.incomingDamageMult||1;
 if(hasUpgrade('protector'))mult*=1-b.protector;
 if(window.ReiEndgame?.hasSpecialization?.('marine-fortress'))mult*=.92;
 if(braveryApplies(source,kind)){mult*=1-b.bravery.resist;buildRun.bravery=.28;}
 mult=Math.max(1-b.maxResistance,mult);
 if(owner?.drownedUntil>buildRun.active)mult*=1-(window.ReiEndgame?.hasSpecialization?.('undead-curse')?.20:b.drowned.weaken);
 return Math.max(1-b.maxResistance,mult);
}
function buildOnDamage(){
 const b=BUILD_BALANCE;
 if(hasUpgrade('cadaver-hull')&&buildRun.cadaverCooldown<=0){buildRun.cadaver=b.cadaver.duration;buildRun.cadaverCooldown=b.cadaver.cooldown;}
 if(hasUpgrade('second-wind')&&buildRun.secondWave!==wave&&player.hp<=player.maxHp*b.second.threshold ){buildRun.secondWave=wave;healBuild(b.second.heal,player,"secondWind");addLootText(player.x,player.y-42,'SEGUNDO FÔLEGO +20','heal');sfx('heal',.6);}
}
function shotBaseDamage(){const frenzyMult=window.ReiEndgame?.hasSpecialization?.('pirate-coldblood')?1.30:BUILD_BALANCE.frenzy.mult;return (player.damageMult||1)*(buildRun.frenzy>0?frenzyMult:1);}
function closeRangeDamage(e){
 let mult=1;
 if(hasUpgrade('boarding-hook')){const sp=window.ReiEndgame?.hasSpecialization?.('pirate-boarding'),range=sp?170:BUILD_BALANCE.hook.range,damage=sp?1.20:BUILD_BALANCE.hook.damage;if(Math.hypot(e.x-player.x,e.y-player.y)<=range)mult*=damage;}
 return mult;
}
function igniteEnemy(e){
 if(!enemyIsAlive(e))return;const b=BUILD_BALANCE,black=hasUpgrade('hellfire');
 const time=black?(e.isBoss?b.hellfire.bossDuration:Infinity):b.fire.duration;
 if(e.burn){e.burn.time=time;e.burn.black=black;e.burn.acc=0;e.burn.age=Math.max(e.burn.age||0,.35);}else e.burn={time,acc:0,black,age:0};
}
function applyDrownedCurse(e){if(!hasUpgrade('drowned-curse')||!enemyIsAlive(e))return;e.drownedUntil=buildRun.active+(window.ReiEndgame?.hasSpecialization?.('undead-curse')?4:BUILD_BALANCE.drowned.duration);}
function impactWeight(e){return e.isBoss?0:e.role==='scout'?1.85:e.role==='basic'?1.55:e.role==='ghost'?1.35:e.role==='bomber'?1.05:e.role==='rammer'?.62:e.role==='tank'?.42:e.role==='warden'?.32:1;}
function buildHit(e,s,x=e.x,y=e.y,area=false){
 const b=BUILD_BALANCE,primary=s.primaryPellet!==false;
 if(primary&&hasUpgrade('ectoplasm')&&!area){const original=e,profane=window.ReiEndgame?.hasSpecialization?.('undead-ecto'),baseRadius=hasUpgrade('spectral-ammo')?b.ecto.spectralRadius:b.ecto.radius;buildRun.pools.push({x,y,life:b.ecto.duration,age:0,radius:baseRadius*(profane?1.25:1),damage:s.damage*(profane?.48:b.ecto.damage),inside:new Set(original?[original]:[])});if(buildRun.pools.length>b.ecto.max)buildRun.pools.shift();}
 if(!enemyIsAlive(e))return;
 if(primary&&s.flame&&(!area||hasUpgrade('hellfire')))igniteEnemy(e);
 if(primary)applyDrownedCurse(e);
 if(primary&&hasUpgrade('impact-shot')){
  const len=Math.hypot(s.vx,s.vy)||1,w=impactWeight(e);
  if(e.isBoss){e.impactJolt=BUILD_BALANCE.impact.bossJolt+(window.ReiEndgame?.hasSpecialization?.('marine-impact')?.05:0);e.impactAngle=Math.atan2(s.vy,s.vx);}
  else {const force=b.impact.speed*(window.ReiEndgame?.hasSpecialization?.('marine-impact')?1.25:1);e.knock={x:s.vx/len*force*w,y:s.vy/len*force*w,time:b.impact.duration};}
 }
}
function steerBuildShot(s,dt){
 if(!hasUpgrade('precise-shot')||s.reflected||s.explosive||s.primaryPellet===false)return;
 const base=BUILD_BALANCE.precise,guided=window.ReiEndgame?.hasSpecialization?.('marine-guidance'),b=guided?{...base,turn:base.turn*1.18,budget:base.budget*1.18}:base,speed=Math.hypot(s.vx,s.vy);if(!speed)return;
 const a=Math.atan2(s.vy,s.vx),targets=enemies.filter(e=>enemyIsAlive(e)&&e.spawnShield<=0&&!s.hitIds.has(e));
 if(targets.some(e=>sweepCircle(s.x,s.y,s.x+s.vx*s.life,s.y+s.vy*s.life,e.x,e.y,e.r+8)!==null))return;
 let target=null,best=b.angle;
 for(const e of targets){const d=Math.hypot(e.x-s.x,e.y-s.y),angle=Math.atan2(e.y-s.y,e.x-s.x),delta=Math.atan2(Math.sin(angle-a),Math.cos(angle-a));if(d<b.range&&Math.abs(delta)<best){best=Math.abs(delta);target=delta;}}
 if(target===null)return;const turn=Math.sign(target)*Math.min(Math.abs(target),b.turn*dt,Math.max(0,b.budget-(s.turned||0)));s.turned=(s.turned||0)+Math.abs(turn);s.vx=Math.cos(a+turn)*speed;s.vy=Math.sin(a+turn)*speed;
}
function reflectBuildShot(s){
 if(!hasUpgrade('counterattack')||s.reflectable===false||s.reflectionChecked)return false;s.reflectionChecked=true;
 const counterSpec=window.ReiEndgame?.hasSpecialization?.('marine-counter'),reflectChance=BUILD_BALANCE.reflect.chance+(counterSpec?.08:0);if(Math.random()>=reflectChance)return false;
 const speed=Math.max(360,Math.hypot(s.vx,s.vy)||300),a=Math.atan2(-s.vy,-s.vx),damage=(s.damage||12)*(counterSpec?3.5:BUILD_BALANCE.reflect.damage);
 shots.push({x:player.x+Math.cos(a)*30,y:player.y+Math.sin(a)*30,vx:Math.cos(a)*speed*1.12,vy:Math.sin(a)*speed*1.12,life:3,damage,hitIds:new Set(),impactCount:0,reflected:true,spectral:false});
 buildRun.reflection=.42;buildRun.metrics.reflected++;addStat('reflections');burst(player.x,player.y,'splash',20);impactEffects.push({type:'counter',x:player.x,y:player.y,life:0,max:.46,seed:Math.random()*10});sfx('pierce',1,70);sfx('barrage-impact',.32,80);return true;
}
function updateBuild(dt,moving){
 const b=BUILD_BALANCE;buildRun.active+=dt;
 for(const key of ['cadaver','cadaverCooldown','frenzy','spectral','reflection','boardingRush','bravery','guardPulse'])buildRun[key]=Math.max(0,buildRun[key]-dt);
 if(hasUpgrade('carpenter')){buildRun.carpenter+=dt;while(buildRun.carpenter>=b.carpenter.interval){buildRun.carpenter-=b.carpenter.interval;healBuild(hasUpgrade('warship')?b.carpenter.warshipHeal:b.carpenter.heal,player,'carpenter');}}
 if(hasUpgrade('spectral-look')){buildRun.spectralClock+=dt;if(buildRun.spectralClock>=b.spectral.interval){buildRun.spectralClock-=b.spectral.interval;buildRun.spectral=b.spectral.duration;}}
 for(const e of enemies)if(e.knock&&!e.isBoss&&e.knock.time>0){const step=Math.min(dt,e.knock.time);e.x=clamp(e.x+e.knock.x*step,42,W-42);e.y=clamp(e.y+e.knock.y*step,103,H-45);e.knock.time-=dt;}
 if(hasUpgrade('ectoplasm'))for(const e of enemies)e.ectoSlow=false;
 for(const p of buildRun.pools){p.life-=dt;p.age+=dt;if(p.life<=0)continue;for(const e of enemies){if(!enemyIsAlive(e)||e.spawnShield>0)continue;const inside=Math.hypot(e.x-p.x,e.y-p.y)<(p.radius||b.ecto.radius)+e.r*.5;if(inside)e.ectoSlow=true;if(inside&&!p.inside.has(e)){p.inside.add(e);applyDrownedCurse(e);if(applyEnemyDamage(e,p.damage*(e.isBoss?b.ecto.bossMultiplier:1),'ectoplasm'))addStat('ectoEntries');}else if(!inside)p.inside.delete(e);}}
 buildRun.pools=buildRun.pools.filter(p=>p.life>0);
 for(const soul of buildRun.souls){soul.life-=dt;soul.age+=dt;collectSoul(soul,player);}buildRun.souls=buildRun.souls.filter(s=>s.life>0&&!s.collected);
}
function drawBuildPools(){drawMysticPools();}
const classAuraCache=new Map();
let classAuraDisabled=false;
function classAuraSource(){
 const id=player?.skinId||selectedSkin;
 if(id==='default'){const m=playerSkinMeta('default');return{img:defaultSkinImage,w:m.w,h:m.h,ox:0,oy:0,id,auraFadeTop:m.auraFadeTop||0};}
 const skin=playerSkinMeta?.(id),img=skinImages?.[id];
 if(!skin||!img)return null;
 return{img,w:skin.w,h:skin.h,ox:0,oy:0,id,auraFadeTop:skin.auraFadeTop||0};
}
/*
  v23.4: contorno compatível com execução direta por file://.
  Nunca lê pixels (getImageData/toDataURL). A própria transparência do PNG é
  usada como máscara via source-in e o resultado é cacheado uma única vez.
  Assim o navegador não pode interromper o loop por canvas "tainted" ao abrir
  index.html diretamente, e o custo durante a partida continua sendo mínimo.
*/
function classAuraArt(src,color){
 if(classAuraDisabled||!src?.img?.complete||!src.img.naturalWidth)return null;
 const key=`v303:${src.id}:${color}:${src.w}x${src.h}:fade${src.auraFadeTop||0}`;
 if(classAuraCache.has(key))return classAuraCache.get(key);
 try{
  const pad=30,w=Math.ceil(src.w+pad*2),h=Math.ceil(src.h+pad*2);
  const mask=document.createElement('canvas');mask.width=w;mask.height=h;
  const mg=mask.getContext('2d');mg.imageSmoothingEnabled=false;
  mg.drawImage(src.img,pad,pad,src.w,src.h);
  mg.globalCompositeOperation='source-in';mg.fillStyle=color;mg.fillRect(0,0,w,h);
  // Skins com mastros/bandeiras altas recebem o contorno principalmente no casco.
  // A identidade de classe continua forte sem transformar a bandeira em uma massa luminosa.
  if(src.auraFadeTop>0){
   mg.globalCompositeOperation='destination-in';
   const fade=mg.createLinearGradient(0,pad,0,pad+src.h),f=Math.max(.08,Math.min(.72,src.auraFadeTop));
   fade.addColorStop(0,'rgba(255,255,255,.04)');fade.addColorStop(Math.max(0,f-.13),'rgba(255,255,255,.10)');fade.addColorStop(Math.min(1,f+.16),'rgba(255,255,255,1)');fade.addColorStop(1,'rgba(255,255,255,1)');
   mg.fillStyle=fade;mg.fillRect(0,0,w,h);
  }
  mg.globalCompositeOperation='source-over';

  const glow=document.createElement('canvas');glow.width=w;glow.height=h;
  const gg=glow.getContext('2d');gg.imageSmoothingEnabled=false;
  for(const ring of [{r:9,a:.044,n:16},{r:6.2,a:.072,n:16},{r:3.5,a:.118,n:12}]){
   gg.globalAlpha=ring.a;
   for(let i=0;i<ring.n;i++){const a=i*Math.PI*2/ring.n;gg.drawImage(mask,Math.cos(a)*ring.r,Math.sin(a)*ring.r);}
  }

  const edge=document.createElement('canvas');edge.width=w;edge.height=h;
  const eg=edge.getContext('2d');eg.imageSmoothingEnabled=false;
  eg.globalAlpha=.78;
  for(let i=0;i<16;i++){const a=i*Math.PI/8;eg.drawImage(mask,Math.cos(a)*3.4,Math.sin(a)*3.4);}
  eg.globalCompositeOperation='destination-out';eg.globalAlpha=1;eg.drawImage(mask,0,0);eg.globalCompositeOperation='source-over';

  const art={glow,edge,w,h,pad};classAuraCache.set(key,art);return art;
 }catch(err){
  classAuraDisabled=true;classAuraCache.clear();
  console.warn('Contorno de classe desativado com segurança:',err);
  return null;
 }
}
function drawClassAura(layer='under'){
 if(classAuraDisabled||!player||!buildRun?.path)return;
 let auraCtxSaved=false;
 try{
  const p=BUILD_PATHS[buildRun.path],src=classAuraSource();if(!src)return;const art=classAuraArt(src,p.color);if(!art)return;
  const bob=Math.sin(t*2.7+(player.phase||0))*3,y=player.y+bob,pulse=.5+.5*Math.sin(t*2.2),dx=player.x-src.w/2-art.pad,dy=y-src.h/2-art.pad;
  ctx.save();auraCtxSaved=true;
  if(layer==='under'){
   ctx.globalCompositeOperation='source-over';
   ctx.globalAlpha=.36+.08*pulse;ctx.drawImage(art.glow,dx,dy);
   ctx.globalAlpha=.76+.12*pulse;ctx.drawImage(art.edge,dx,dy);
   const g=ctx.createRadialGradient(player.x,y+src.h*.29,6,player.x,y+src.h*.29,Math.min(86,src.w*.66));
   g.addColorStop(0,p.color+'1f');g.addColorStop(.58,p.color+'10');g.addColorStop(1,p.color+'00');
   ctx.fillStyle=g;ctx.globalAlpha=.78;ctx.beginPath();ctx.ellipse(player.x,y+src.h*.31,Math.min(78,src.w*.63),Math.max(9,src.h*.060),0,0,Math.PI*2);ctx.fill();
  }else if(buildRun.path==='marine'&&(hasUpgrade('protector')||hasUpgrade('sentry')||buildRun.reflection>0||buildRun.bravery>0||buildRun.guardPulse>0)){
   const q=Math.max(buildRun.reflection/.42,buildRun.bravery/.28,buildRun.guardPulse/.35,.16);ctx.globalAlpha=.12+.18*Math.min(1,q);ctx.strokeStyle='#cdefff';ctx.lineWidth=1.8;
   for(let i=0;i<3;i++){const a=-1.12+i*.56+t*.045;ctx.beginPath();ctx.arc(player.x,y+8,44+i*3,a,a+.38);ctx.stroke();}
  }
  ctx.restore();auraCtxSaved=false;
 }catch(err){
  if(auraCtxSaved){try{ctx.restore();}catch(_){ }}
  classAuraDisabled=true;classAuraCache.clear();
  console.warn('VFX de classe desativado com segurança:',err);
 }
}
function drawBuildEffects(){
 ctx.save();
 for(const soul of buildRun.souls){const y=soul.y+Math.sin(soul.age*4)*5;ctx.globalAlpha=Math.min(1,soul.life/2);ctx.drawImage(cachedVisual('build:soul',56,70,g=>{g.shadowColor='#8bffe0';g.shadowBlur=9;g.fillStyle='#c4fff0';g.beginPath();g.moveTo(28,9);g.bezierCurveTo(3,12,10,45,17,50);g.lineTo(24,44);g.lineTo(31,56);g.bezierCurveTo(53,33,44,13,28,9);g.fill();g.shadowBlur=0;g.fillStyle='#17665f';g.fillRect(22,24,3,5);g.fillRect(32,24,3,5);}),soul.x-28,y-35);}
 if(buildRun.reflection>0){ctx.globalAlpha=.75;ctx.strokeStyle='#e9fbff';ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(player.x,player.y,51+buildRun.reflection*24,35+buildRun.reflection*16,0,0,Math.PI*2);ctx.stroke();}
 if(buildRun.cadaver>0){ctx.globalAlpha=.32;ctx.strokeStyle='#a1f2d4';ctx.lineWidth=1.6;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(player.x-player.vx*.08-i*7,player.y-player.vy*.08+22+i*5);ctx.lineTo(player.x-player.vx*.16-i*11,player.y-player.vy*.16+25+i*6);ctx.stroke();}}
 if(buildRun.frenzy>0){ctx.globalAlpha=.62;ctx.strokeStyle='#8d161c';ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(player.x,player.y,51,-t*2.7,-t*2.7+Math.PI*1.45);ctx.stroke();ctx.fillStyle='#c72e31';for(let i=0;i<5;i++){const a=i*1.37+t*.7,r=44+(i%2)*10;ctx.globalAlpha=.24+.25*(i%2);ctx.beginPath();ctx.ellipse(player.x+Math.cos(a)*r,player.y+Math.sin(a)*r*.7,2.3,5,a,0,Math.PI*2);ctx.fill();}}
 if(buildRun.boardingRush>0){ctx.globalAlpha=.3;ctx.strokeStyle='#ff775f';ctx.lineWidth=1.5;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(player.x-player.vx*.10-i*9,player.y-player.vy*.10+16+i*7);ctx.lineTo(player.x-player.vx*.18-i*14,player.y-player.vy*.18+18+i*8);ctx.stroke();}}
 ctx.restore();
}
function renderBuildPanel(){
 const p=BUILD_PATHS[buildRun.path];renderBuildSynergies();document.getElementById('build-heading').textContent=p?`${p.symbol} ${p.name}`:'Classe definida na onda 5';
 const boardingSpeed=window.ReiEndgame?.hasSpecialization?.('pirate-boarding')?1.25:BUILD_BALANCE.hook.speed;const move=(player.speedMult*(buildRun.cadaver>0?BUILD_BALANCE.cadaver.speed:1)*(buildRun.boardingRush>0?boardingSpeed:1)).toFixed(2);
 document.getElementById('build-summary').textContent=`Vida ${Math.ceil(player.hp)}/${Math.round(player.maxHp)} • Dano base ×${player.damageMult.toFixed(2)} • Intervalo ${currentFireCooldown().toFixed(2)} s • Movimento ×${move}`;
 document.getElementById('build-list').innerHTML=[...acquiredUpgrades].map(id=>{const u=upgradeById[id];return `<article class="build-entry ${u.cls} path-${u.path}"><div><b>${u.name}</b><span>${u.rarity} · ${BUILD_PATHS[u.path].name}</span></div><p>${upgradeDescription(u)}</p></article>`;}).join('')||'<p class="build-empty">Sua viagem começa sem melhorias. Complete a onda 5 para escolher um caminho.</p>';
}
function renderUpgradeChoices(){
 if(!buildRun.shop){buildRun.shop={rerolled:false,repaired:false};upgradeChoices=buildUpgradeChoices();}
 const first=initialClassChoice(),choosingClass=classChoiceStage(),path=BUILD_PATHS[buildRun.path||buildRun.pendingPath];
 document.querySelector('.upgrade-topline h2').textContent=choosingClass?'ESCOLHA SEU CAMINHO':first?'ESCOLHA SEU PRIMEIRO TALENTO':upgradeChoices.length?'APRIMORE SUA BUILD':'ESTALEIRO DE EMERGÊNCIA';
 document.querySelector('.upgrade-topline p').textContent=choosingClass?'A classe define seu estilo. Depois, escolha 1 entre 2 melhorias comuns aleatórias gratuitamente.':first?`${path.symbol} ${path.name} escolhido • agora escolha um dos dois talentos iniciais. RNG permanece, mas a classe vem primeiro.`:`${path.symbol} ${path.name} + Neutras • Ofertas limitadas • Reparo e melhorias disputam o mesmo ouro.${wave<=20?' Tarifas costeiras reduzidas até a onda 20.':''}`;
 upgradeClose.classList.toggle('hidden',first);upgradeGold.textContent=String(gold);upgradeWave.textContent=String(wave);
 upgradeGrid.innerHTML=upgradeChoices.length?upgradeChoices.map(u=>{const classCard=u.id.startsWith('class-');return `<button class="upgrade-card ${u.cls} path-${u.path} ${classCard?'class-choice-card':''}" data-upgrade="${u.id}"><div class="build-path-label" style="color:${BUILD_PATHS[u.path].color}">${BUILD_PATHS[u.path].symbol} ${BUILD_PATHS[u.path].name}</div><div class="upgrade-rarity">${u.rarity}</div><div class="upgrade-icon">${buildUpgradeIcon(u)}</div><h3>${u.name}</h3><div class="upgrade-desc">${classCard?u.desc:upgradeDescription(u)}</div><div class="upgrade-bottom"><span class="upgrade-cost">${first?'GRATUITO':`<i class="gold-coin"></i> ${effectiveUpgradeCost(u)} OURO`}</span><span class="upgrade-tag">${classCard?'ESCOLHER CLASSE':first?'ESCOLHER TALENTO':'COMPRAR'}</span></div></button>`;}).join(''):'<p class="build-empty">Todas as melhorias deste caminho foram adquiridas. Seu estaleiro continua disponível.</p>';
 for(const card of upgradeGrid.querySelectorAll('[data-upgrade]')){const id=card.dataset.upgrade;if(id.startsWith('class-')){card.addEventListener('click',()=>chooseUpgrade(id));continue;}const u=upgradeById[id];card.disabled=hasUpgrade(u.id)||gold<effectiveUpgradeCost(u);card.classList.toggle('unaffordable',card.disabled);if(hasUpgrade(u.id))card.querySelector('.upgrade-tag').textContent='ADQUIRIDA';card.addEventListener('click',()=>chooseUpgrade(u.id));}
 renderPortServices();const saveBtn=document.getElementById('save-exit-upgrade');if(saveBtn){saveBtn.disabled=first;saveBtn.title=first?'Escolha sua classe e comece a viagem antes de criar um save.':'Salvar esta viagem neste estaleiro seguro.';}
}
function chooseUpgrade(id){
 if(state!=='upgrade')return;
 if(id.startsWith('class-')){const path=id.slice(6);if(!classChoiceStage()||!CLASS_CHOICES[path])return;buildRun.pendingPath=path;upgradeChoices=buildUpgradeChoices();sfx('upgrade',.72);renderUpgradeChoices();return;}
 const u=upgradeById[id];if(!u||!upgradeChoices.some(c=>c.id===id)||gold<effectiveUpgradeCost(u))return;
 const first=initialClassChoice(),cost=effectiveUpgradeCost(u);if(!applyBuildUpgrade(id))return;gold-=cost;buildRun.metrics.goldSpent+=cost;checkAchievements();goldEl.textContent=String(gold);sfx('upgrade',.9);if(first){closeUpgradeScreen();state='play';beginNextWave();}else renderUpgradeChoices();
}
function updateUpgradeStrip(){
 if(!upgradeStrip)return;const p=BUILD_PATHS[buildRun?.path];
 const specs=buildRun?.specializations instanceof Set?buildRun.specializations.size:0;upgradeStrip.innerHTML=p?`<div class="upgrade-chip class-chip" style="color:${p.color}">${p.symbol} ${p.name}<span> · ${acquiredUpgrades.size} melhorias${specs?` · ${specs} especializações`:''} · ESC</span></div>`:'';
}
function buildUpgradeIcon(u){
 if(u.id?.startsWith('class-')){
  const color=BUILD_PATHS[u.path].color;
  const inner=u.path==='marine'
   ? '<path d="M26 7v28m-8-18h16M12 28c0 12 6 19 14 19s14-7 14-19M12 28l8 7m20-7-8 7"/><path d="M20 9h12"/>'
   : u.path==='pirate'
   ? '<path d="M8 18c10-7 26-7 36 0"/><path d="M10 16l33 22"/><path d="M18 27c0-5 4-9 9-9s9 4 9 9-4 9-9 9-9-4-9-9z" fill="currentColor"/><path d="M22 25c3-2 7-2 10 0m-9 5c2 1 6 1 8 0" stroke="#031923" stroke-width="1.7"/>'
   : '<path d="M35 8c-13 3-18 18-10 28 5 7 13 9 21 5-5 8-16 12-26 7C7 42 4 26 11 15 16 7 26 4 35 8z"/><path d="M30 25c3-5 9-5 12 0-3 6-9 6-12 0zm6-2v4"/>';
  return `<svg class="build-glyph class-glyph" viewBox="0 0 52 52" aria-hidden="true" style="color:${color}"><circle cx="26" cy="26" r="24" fill="#031923" stroke="currentColor" opacity=".48"/><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
 }
 const symbols={
  sail:'M13 8l24 30m-5-5 9 3 4 9-9-4-4-8M39 8 15 38m5-5-9 3-4 9 9-4 4-8',
  shield:'M26 8 42 14v12c0 11-16 20-16 20S10 37 10 26V14zM18 26l5 5 12-13',
  repair:'M10 14l8-4 7 6-4 5 19 19-5 5-19-19-5 4-6-7z',
  reload:'M11 24a15 15 0 0 1 27-9l4 6M42 10v11H31M41 30a15 15 0 0 1-27 9l-4-6M10 44V33h11',
  powder:'M20 9h12v8l7 10v15H13V27l7-10zM19 30h14M26 25v11',
  heart:'M26 44 10 28C-1 9 17 5 26 19 35 5 53 9 42 28zM17 27h6l3-7 4 14 3-7h4',
  coin:'M26 7a19 19 0 1 0 0 38 19 19 0 0 0 0-38M26 14v24m6-19h-9l-4 4 14 6-4 4h-9',
  eye:'M5 26s8-13 21-13 21 13 21 13-8 13-21 13S5 26 5 26M26 19a7 7 0 1 0 0 14 7 7 0 0 0 0-14',
  beacon:'M20 20h12l5 25H15zM18 13l8-6 8 6v7H18zM4 13l9 3m26 0 9-3M4 25l9-3m26 0 9 3',
  aim:'M26 10a16 16 0 1 0 0 32 16 16 0 0 0 0-32M26 3v13m0 20v13M3 26h13m20 0h13M22 26h8m-4-4v8',
  hook:'M26 7v27c0 13-18 13-18 0v-8l7 8M21 8h10M26 20h10',
  flame:'M27 5c-3 13 18 17 12 32-5 13-28 10-29-3-1-8 6-13 11-19-1 7 1 9 4 10 6-3 7-9 2-20z',
  magnet:'M10 10h10v20a6 6 0 0 0 12 0V10h10v20a16 16 0 0 1-32 0zM10 19h10m12 0h10',
  soul:'M12 43V23a14 14 0 0 1 28 0v20l-7-5-7 6-7-6zM20 22v5m12-5v5',
  pool:'M6 37c1-12 15-4 16-17l4-12 6 13c-2 10 14 5 14 16-2 13-38 12-40 0zM16 36c7 4 15 4 23 0',
  blast:'m26 5 5 13 14-5-5 14 9 5-15 3 1 13-10-10-13 9 4-16-12-4 14-5z'
 };
 const types={'swift-oars':'sail','thick-hull':'shield',carpenter:'repair','rapid-fire':'reload','refined-powder':'powder','second-wind':'heart',warship:'shield','honest-work':'coin',sentry:'shield',gunnery:'aim',lighthouse:'beacon',protector:'shield','precise-shot':'aim','impact-shot':'blast',counterattack:'shield','sure-robbery':'coin','spread-shot':'blast','boarding-hook':'hook','flame-shot':'flame','loot-instinct':'repair','combat-frenzy':'blast',hellfire:'flame','spectral-look':'soul','cadaver-hull':'sail','spectral-ammo':'soul','drowned-curse':'eye',ectoplasm:'pool','beyond-speed':'reload','soul-devourer':'soul'};
 const d=symbols[types[u.id]];if(!d)return upgradeIconHTML(u.icon);
 return `<svg class="build-glyph" viewBox="0 0 64 64" aria-hidden="true" style="color:${BUILD_PATHS[u.path].color}"><circle cx="32" cy="32" r="30" fill="#031923" stroke="currentColor" opacity=".35"/><g transform="translate(6 6)" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g></svg>`;
}
function continueInfernoEffect(e,p){ctx.save();ctx.globalAlpha=(1-p)*.85;ctx.lineWidth=2;for(let i=0;i<9;i++){ctx.strokeStyle=i%3===0?'#ff7a34':i%2?'#b62c22':'#241818';const a=i*Math.PI*2/9+e.seed,r=15+p*72,x=e.x+Math.cos(a)*r,y=e.y+Math.sin(a)*r;ctx.beginPath();ctx.moveTo(x,y+9);ctx.quadraticCurveTo(x-9,y,x,y-19-Math.sin(t*16+i)*7);ctx.quadraticCurveTo(x+9,y,x,y+9);ctx.stroke();}ctx.restore();}
function drawBuildDebuffs(e){
 const cursed=e.drownedUntil>buildRun.active;if(!cursed)return;
 ctx.save();ctx.globalAlpha=.82;ctx.lineWidth=1.4;
 const y=e.y-(e.isBoss?95:76);ctx.strokeStyle='#b9ffe0';for(let i=0;i<3;i++){const a=t*1.2+i*Math.PI*2/3;ctx.beginPath();ctx.arc(e.x+Math.cos(a)*18,y+Math.sin(a)*5,3,0,Math.PI*2);ctx.stroke();}
 ctx.strokeStyle='#7fe0bf';ctx.beginPath();ctx.moveTo(e.x-8,y-8);ctx.lineTo(e.x,y);ctx.lineTo(e.x+8,y-8);ctx.moveTo(e.x-8,y+1);ctx.lineTo(e.x,y+9);ctx.lineTo(e.x+8,y+1);ctx.stroke();ctx.restore();
}
