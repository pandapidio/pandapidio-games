/* Permanent records and cosmetic rewards. Legacy wallet keys remain compatible. */
const CHRONICLE_KEY='reiDosMaresChronicleV1';
const ACHIEVEMENTS=[
  {id:'port-repairs',name:'Madeira que resiste',desc:'Compre três reparos no estaleiro.',key:'portRepairs',goal:3,reward:2,title:'Mestre do Estaleiro',rarity:'rare'},
  {id:'repairs-master',name:'Casco de aço',desc:'Compre dez reparos no estaleiro.',key:'portRepairs',goal:10,reward:3,title:'Guardião do Casco',rarity:'epic'},
  {id:'port-rerolls',name:'Outro rumo',desc:'Troque as ofertas de cinco lojas.',key:'portRerolls',goal:5,reward:2,title:'Leitor das Marés',rarity:'rare'},
  {id:'reroll-master',name:'Mercador desconfiado',desc:'Troque as ofertas de dez lojas.',key:'portRerolls',goal:10,reward:3,title:'Senhor das Rotas',rarity:'epic'},
  {id:'fleet-reflection',name:'De volta ao remetente',desc:'Rebata 25 tiros com Contra-Ataque.',key:'reflections',goal:25,reward:2,title:'Escudo da Frota',rarity:'epic'},
  {id:'close-plunder',name:'A um passo do saque',desc:'Afunde 25 inimigos próximos com Roubo Certeiro.',key:'closePlunder',goal:25,reward:2,title:'Mestre da Abordagem',rarity:'rare'},
  {id:'ecto-master',name:'Rastro do além',desc:'Acerte inimigos 60 vezes com a entrada em poças de Ectoplasma.',key:'ectoEntries',goal:60,reward:2,title:'Alquimista Abissal',rarity:'epic'},
  {id:'soul-keeper',name:'Vozes no convés',desc:'Recolha 30 almas curativas.',key:'soulsGathered',goal:30,reward:2,title:'Condutor de Almas',rarity:'epic'},
  {id:'black-fire',name:'O fogo que não se apaga',desc:'Ative Fogo do Inferno.',key:'hellfireBuilds',goal:1,reward:2,title:'Portador das Chamas Negras',rarity:'legendary',secret:true,avatarReward:'hellfire-eye'},
  {id:'fifth-salvo',name:'A quinta palavra',desc:'Dispare 50 salvas do Artilheiro Veterano.',key:'veteranSalvos',goal:50,reward:2,title:'Mestre da Salva',rarity:'rare'},
  {id:'marine-path',name:'Disciplina em alto-mar',desc:'Conclua a onda 25 como Marinheiro.',key:'marineBuild25',goal:1,reward:3,title:'Mestre da Artilharia',rarity:'epic'},
  {id:'pirate-path',name:'Sem pedir licença',desc:'Conclua a onda 25 como Pirata.',key:'pirateBuild25',goal:1,reward:3,title:'Flagelo da Pólvora',rarity:'epic'},
  {id:'undead-path',name:'Além do último suspiro',desc:'Conclua a onda 25 como Morto-vivo.',key:'undeadBuild25',goal:1,reward:3,title:'Capitão do Além',rarity:'epic'},
  {id:'portrait-first',name:'Uma bandeira própria',desc:'Adquira seu primeiro retrato de capitão.',key:'portraits',goal:1,reward:1,title:'Porta-estandarte',rarity:'common'},
  {id:'portrait-collection',name:'Galeria de bandeiras',desc:'Adquira cinco retratos de capitão.',key:'portraits',goal:5,reward:3,title:'Mestre dos Estandartes',rarity:'epic'},
  {id:'portrait-arsenal',name:'Muralha de retratos',desc:'Adquira doze retratos de capitão.',key:'portraits',goal:12,reward:4,title:'Curador da Galeria',rarity:'legendary'},
  {id:'fog-voyager',name:'Além da cerração',desc:'Conclua três eventos de Banco de Névoa.',key:'fogClears',goal:3,reward:2,title:'Navegador da Névoa',rarity:'rare'},
  {id:'dead-voyager',name:'Os mortos não me levam',desc:'Conclua três eventos de Mar dos Mortos.',key:'deadClears',goal:3,reward:3,title:'Quebra-maldições',rarity:'epic',titleColor:'#9bdec4'},
  {id:'unscathed-boss',name:'Nem um arranhão',desc:'Derrote um chefe sem sofrer dano naquela onda.',key:'cleanBosses',goal:1,reward:3,title:'Intocável da Coroa',rarity:'legendary',secret:true},
  {id:'cleanboss-triple',name:'Nem a espuma me tocou',desc:'Derrote três chefes sem sofrer dano naquela onda.',key:'cleanBosses',goal:3,reward:4,title:'Fenda de Aço',rarity:'legendary',secret:true},
  {id:'last-breath',name:'Por um fio',desc:'Conclua uma onda a partir da 10 com dez de vida ou menos.',key:'closeCalls',goal:1,reward:2,title:'Teimoso Demais para Afundar',rarity:'secret',titleColor:'#e2b4a0',secret:true},
  {id:'fog-shadow',name:'Vulto na cerração',desc:'Conclua um Banco de Névoa sem sofrer dano.',key:'fogFlawless',goal:1,reward:2,title:'Vulto da Névoa',rarity:'secret',titleColor:'#bce0d7',secret:true},
  {id:'blockade',name:'A última muralha',desc:'Afunde a capitânia da onda 42.',key:'flagships',goal:1,reward:3,title:'Rompe-armadas',rarity:'epic'},
  {id:'admirals',name:'Nenhuma coroa é eterna',desc:'Derrote três almirantes do abismo no infinito.',key:'admirals',goal:3,reward:5,title:'Flagelo do Abismo',rarity:'legendary'},
  {id:'admirals-six',name:'O abismo recua',desc:'Derrote seis almirantes do abismo.',key:'admirals',goal:6,reward:6,title:'Almirante das Ruínas',rarity:'secret',secret:true},
  {id:'first',name:'Batismo de pólvora',desc:'Afunde 10 navios.',key:'kills',goal:10,reward:1,title:'Corsário',rarity:'common'},
  {id:'fleet',name:'Frota ao fundo',desc:'Afunde 100 navios.',key:'kills',goal:100,reward:3,title:'Caçador de Frotas',rarity:'rare'},
  {id:'legend',name:'Mil histórias no fundo',desc:'Afunde 1.000 navios.',key:'kills',goal:1000,reward:8,title:'Lenda dos Mares',rarity:'legendary'},
  {id:'chests',name:'Olhos no tesouro',desc:'Recolha 30 baús.',key:'chests',goal:30,reward:3,title:'Caça-tesouros',rarity:'common'},
  {id:'gold',name:'Fortuna da maré',desc:'Colete 5.000 de ouro.',key:'gold',goal:5000,reward:4,title:'Dono do Tesouro',rarity:'rare',avatarReward:'treasure-star'},
  {id:'wave10',name:'Além da costa',desc:'Alcance a onda 10.',key:'bestWave',goal:10,reward:2,title:'Capitão de Alto-mar',rarity:'common'},
  {id:'wave20',name:'Vinte velas no escuro',desc:'Alcance a onda 20.',key:'bestWave',goal:20,reward:2,title:'Escama de Tempestade',rarity:'rare'},
  {id:'marine',name:'Bandeira livre',desc:'Derrote o Almirante.',key:'marine',goal:1,reward:3,title:'Quebra-bloqueios',rarity:'rare',avatarReward:'admiral-seal'},
  {id:'blackbeard',name:'O mar não tem dono',desc:'Derrote Barba Negra.',key:'blackbeard',goal:1,reward:4,title:'Rival da Escuridão',rarity:'epic'},
  {id:'gate',name:'Do outro lado do véu',desc:'Destrua os três guardiões da onda 35.',key:'gate',goal:1,reward:5,title:'Atravessador do Véu',rarity:'epic'},
  {id:'wave35',name:'Portão dos Afogados',desc:'Alcance a onda 35.',key:'bestWave',goal:35,reward:3,title:'Nadador do Véu',rarity:'epic'},
  {id:'ghosts',name:'Descanso aos mortos',desc:'Afunde 40 navios fantasmas.',key:'ghosts',goal:40,reward:3,title:'Exorcista dos Mares',rarity:'rare'},
  {id:'weather',name:'Lobo do mar',desc:'Conclua os seis tipos de evento.',key:'eventTypes',goal:6,reward:5,title:'Lobo do Mar',rarity:'epic'},
  {id:'clean',name:'Casco intacto',desc:'Conclua 10 ondas sem receber dano.',key:'flawless',goal:10,reward:3,title:'Intocável',rarity:'rare'},
  {id:'clean-25',name:'Água não me alcança',desc:'Conclua 25 ondas sem receber dano.',key:'flawless',goal:25,reward:5,title:'Fantasma da Maré',rarity:'legendary'},
  {id:'king',name:'Rei dos Mares',desc:'Derrote o Capitão dos Mortos na onda 50.',key:'ghostKing',goal:1,reward:8,title:'Rei dos Mares',rarity:'legendary',avatarReward:'ghost-king-mark'},
  {id:'wave50',name:'A grande travessia',desc:'Alcance a onda 50.',key:'bestWave',goal:50,reward:4,title:'Coração do Furacão',rarity:'legendary'},
  {id:'endless',name:'Além da lenda',desc:'Alcance a onda 75 no infinito.',key:'bestWave',goal:75,reward:6,title:'Soberano do Infinito',rarity:'legendary'},
  {id:'specialist',name:'Rumo próprio',desc:'Escolha sua primeira especialização no infinito.',key:'specializations',goal:1,reward:3,title:'Arquiteto da Build',rarity:'epic'},
  {id:'specialist-3',name:'Plano do impossível',desc:'Escolha três especializações ao longo das viagens.',key:'specializations',goal:3,reward:5,title:'Mestre das Especializações',rarity:'legendary'},
  {id:'century',name:'Um século de marés',desc:'Alcance a onda 100.',key:'bestWave',goal:100,reward:8,title:'Lenda do Infinito',rarity:'legendary',avatarReward:'infinity-crown'},
  {id:'score-20k',name:'Pólvora e disciplina',desc:'Alcance 20.000 pontos.',key:'bestScore',goal:20000,reward:3,title:'Marechal do Convés',rarity:'rare'},
  {id:'score-50k',name:'Mar em chamas',desc:'Alcance 50.000 pontos.',key:'bestScore',goal:50000,reward:5,title:'Mito de Guerra',rarity:'legendary'},
  {id:'diamonds-10',name:'Brilho no casco',desc:'Consiga 10 diamantes pelos baús.',key:'diamonds',goal:10,reward:2,title:'Lapidador da Maré',rarity:'rare'},
  {id:'diamonds-40',name:'Tesouro que permanece',desc:'Consiga 40 diamantes pelos baús.',key:'diamonds',goal:40,reward:4,title:'Magnata dos Diamantes',rarity:'epic'},
  {id:'runs-10',name:'Habitante do mar',desc:'Complete 10 viagens.',key:'runs',goal:10,reward:2,title:'Velho Navegante',rarity:'rare'},
  {id:'runs-25',name:'Nascido para o convés',desc:'Complete 25 viagens.',key:'runs',goal:25,reward:4,title:'Cronista do Oceano',rarity:'epic'},
  {id:'deaths-5',name:'Voltei do fundo',desc:'Sofra 5 derrotas.',key:'deaths',goal:5,reward:2,title:'Sobrevivente da Ressaca',rarity:'common'},
  {id:'deaths-20',name:'Ainda assim eu volto',desc:'Sofra 20 derrotas.',key:'deaths',goal:20,reward:3,title:'Inquebrável',rarity:'rare'},
  {id:'bosses-5',name:'Caçador de capitães',desc:'Derrote 5 chefes.',key:'bosses',goal:5,reward:4,title:'Sentença dos Chefes',rarity:'epic'},
  {id:'storm-veteran',name:'No olho da tempestade',desc:'Conclua 5 eventos de Tempestade.',key:'stormClears',goal:5,reward:3,title:'Filho do Trovão',rarity:'epic'},
  {id:'armada-breaker-5',name:'Contra a armada inteira',desc:'Conclua 5 eventos de Armada.',key:'armadaClears',goal:5,reward:3,title:'Quebra-Formações',rarity:'epic'},
  {id:'treasure-routes',name:'Mapa sem margens',desc:'Conclua 10 eventos de Tesouro.',key:'treasureClears',goal:10,reward:3,title:'Cartógrafo do Ouro',rarity:'epic'},
  {id:'event-marathon',name:'O mar já tentou de tudo',desc:'Conclua 30 eventos marítimos.',key:'events',goal:30,reward:5,title:'Veterano das Marés',rarity:'legendary'},
  {id:'combined-chaos',name:'Mar em colapso',desc:'Conclua 5 ondas com dois ou mais eventos ativos ao mesmo tempo.',key:'combinedClears',goal:5,reward:5,title:'Domador do Caos',rarity:'legendary'},
  {id:'event-flawless-10',name:'Nem o evento me alcança',desc:'Conclua 10 ondas de evento sem sofrer dano.',key:'eventFlawless',goal:10,reward:5,title:'Intocável das Marés',rarity:'legendary'},
  {id:'coop-all-aboard',name:'Todos a bordo',desc:'Conclua a onda 15 com 3 capitães conectados e vivos.',key:'coopAllAboard',goal:1,reward:3,title:'Tripulação Completa',rarity:'epic'},
  {id:'coop-three-flags',name:'Três bandeiras',desc:'Chegue à onda 25 em cooperativo com Marinheiro, Pirata e Morto-vivo na mesma tripulação.',key:'coopThreeFlags',goal:1,reward:4,title:'Almirante das Três Bandeiras',rarity:'legendary'},
  {id:'coop-revives',name:'Ninguém fica para trás',desc:'Ajude a concluir 5 revives de aliados no estaleiro.',key:'coopRevives',goal:5,reward:4,title:'Salva-Vidas do Convés',rarity:'epic'},
  {id:'coop-donations',name:'Tesouro compartilhado',desc:'Doe 5.000 de ouro para aliados em partidas cooperativas.',key:'coopDonated',goal:5000,reward:4,title:'Tesoureiro da Tripulação',rarity:'epic'},
  {id:'coop-last-standing',name:'Último de pé',desc:'Conclua uma onda sendo o único capitão vivo da tripulação.',key:'coopLastStand',goal:1,reward:4,title:'Última Bandeira',rarity:'legendary'},
  {id:'coop-back-deck',name:'De volta ao convés',desc:'Seja revivido por um aliado em uma partida cooperativa.',key:'coopRevived',goal:1,reward:3,title:'Retornado das Profundezas',rarity:'rare'},
  {id:'coop-crown',name:'Uma tripulação, uma coroa',desc:'Derrote o chefe da onda 50 com 3 capitães na viagem cooperativa.',key:'coopCrown',goal:1,reward:6,title:'Coroa Compartilhada',rarity:'legendary'},
  {id:'coop-beyond',name:'Além juntos',desc:'Alcance a onda 75 em uma partida cooperativa.',key:'coopBestWave',goal:75,reward:5,title:'Companheiro do Infinito',rarity:'legendary'},
  {id:'coop-century',name:'Até o fim',desc:'Alcance a onda 100 em uma partida cooperativa.',key:'coopBestWave',goal:100,reward:7,title:'Irmão dos Cem Mares',rarity:'secret',secret:true},
  {id:'coop-runs-10',name:'Irmãos de maré',desc:'Participe de 10 viagens cooperativas.',key:'coopRuns',goal:10,reward:4,title:'Irmão de Maré',rarity:'epic'},
  {id:'kills-5000',name:'O oceano se lembra',desc:'Afunde 5.000 navios.',key:'kills',goal:5000,reward:10,title:'Catástrofe Naval',rarity:'secret',secret:true},
  {id:'cleanboss-five',name:'Sem direito a resposta',desc:'Derrote 5 chefes sem sofrer dano na onda deles.',key:'cleanBosses',goal:5,reward:7,title:'Executor Perfeito',rarity:'secret',secret:true},
  {id:'wave125',name:'Depois do impossível',desc:'Alcance a onda 125.',key:'bestWave',goal:125,reward:10,title:'Além do Horizonte',rarity:'secret',secret:true},
  {id:'score-100k',name:'Uma guerra inteira',desc:'Alcance 100.000 pontos.',key:'bestScore',goal:100000,reward:8,title:'Flagelo dos Sete Mares',rarity:'legendary'},
  {id:'platinum',name:'Platina',desc:'Conquiste todas as outras conquistas do jogo.',key:'allOtherAchievements',goal:0,reward:10,title:'Conquistador dos Sete Mares',rarity:'mythic',titleColor:'#ff4b4b',avatarReward:'silver-trophy'}
];
ACHIEVEMENTS.find(a=>a.id==='platinum').goal=ACHIEVEMENTS.length-1;
const chronicle={ready:false,data:null,dirty:false,clock:0,toast:null,queue:[],tab:'records',run:null,saveWarning:false};
function defaultChronicle(){return{version:1,name:'Capitão',title:'Capitão',profile:{avatar:'pirate',ownedAvatars:['pirate']},stats:{portRepairs:0,portRerolls:0,reflections:0,closePlunder:0,ectoEntries:0,soulsGathered:0,hellfireBuilds:0,veteranSalvos:0,legendaryBuilds:0,marineBuild25:0,pirateBuild25:0,undeadBuild25:0,portraits:0,fogClears:0,deadClears:0,stormClears:0,armadaClears:0,treasureClears:0,huntClears:0,combinedClears:0,eventFlawless:0,cleanBosses:0,closeCalls:0,fogFlawless:0,flagships:0,admirals:0,kills:0,bosses:0,marine:0,blackbeard:0,ghostKing:0,gate:0,ghosts:0,bestWave:0,bestScore:0,gold:0,diamonds:0,chests:0,runs:0,deaths:0,seconds:0,flawless:0,bestStreak:0,bestRunKills:0,events:0,specializations:0,coopRuns:0,coopBestWave:0,coopAllAboard:0,coopThreeFlags:0,coopRevives:0,coopDonated:0,coopLastStand:0,coopRevived:0,coopCrown:0},eventTypes:[],achievements:[],history:[],wallet:null};}
function safeNumber(v){return Number.isFinite(Number(v))?Math.max(0,Math.min(1e12,Number(v))):0;}
function validateChronicle(raw){
  if(!raw||raw.version!==1||!raw.stats)throw Error('Invalid record');
  const d=defaultChronicle();
  for(const k of Object.keys(d.stats))d.stats[k]=safeNumber(raw.stats[k]);
  d.name=typeof raw.name==='string'?raw.name.slice(0,24):'Capitão';
  d.achievements=Array.isArray(raw.achievements)?[...new Set(raw.achievements.filter(x=>ACHIEVEMENTS.some(a=>a.id===x)))]:[];
  d.title=['Capitão',...ACHIEVEMENTS.filter(a=>d.achievements.includes(a.id)).map(a=>a.title)].includes(raw.title)?raw.title:'Capitão';
  if(raw.profile&&typeof raw.profile==='object'){
    const ids=Array.isArray(raw.profile.ownedAvatars)?raw.profile.ownedAvatars.filter(id=>AVATARS.some(a=>a.id===id)):[];
    d.profile.ownedAvatars=[...new Set(['pirate',...ids])];
    d.profile.avatar=d.profile.ownedAvatars.includes(raw.profile.avatar)?raw.profile.avatar:'pirate';
  }
  d.stats.portraits=Math.max(d.stats.portraits,d.profile.ownedAvatars.length-1);
  d.eventTypes=Array.isArray(raw.eventTypes)?[...new Set(raw.eventTypes.filter(x=>['treasure','hunt','fog','armada','storm','dead'].includes(x)))]:[];
  d.history=Array.isArray(raw.history)?raw.history.filter(x=>x&&typeof x==='object').slice(0,12).map(x=>({wave:safeNumber(x.wave),score:safeNumber(x.score),class:typeof x.class==='string'?x.class:null,build:Array.isArray(x.build)?x.build.filter(id=>typeof id==='string').slice(0,40):[],specializations:Array.isArray(x.specializations)?x.specializations.filter(id=>typeof id==='string').slice(0,8):[],seconds:safeNumber(x.seconds),date:typeof x.date==='string'?x.date:'',reason:typeof x.reason==='string'?x.reason:'fim'})):[];
  if(raw.wallet&&Array.isArray(raw.wallet.ownedSkins))d.wallet={diamonds:safeNumber(raw.wallet.diamonds),ownedSkins:raw.wallet.ownedSkins.filter(x=>x==='default'||skinById[x]),selectedSkin:raw.wallet.selectedSkin};
  return d;
}
function loadChronicle(){
  let data=null;
  for(const key of [CHRONICLE_KEY,CHRONICLE_KEY+'Backup']){try{const s=localStorage.getItem(key);if(s){data=validateChronicle(JSON.parse(s));break;}}catch(_){}}
  chronicle.data=data||defaultChronicle();const d=chronicle.data;
  if(data?.wallet){diamonds=data.wallet.diamonds;ownedSkins=new Set(['default',...data.wallet.ownedSkins]);selectedSkin=ownedSkins.has(data.wallet.selectedSkin)?data.wallet.selectedSkin:'default';}
  else{diamonds=safeNumber(diamonds);ownedSkins=new Set(['default',...[...ownedSkins].filter(id=>skinById[id])]);if(!ownedSkins.has(selectedSkin))selectedSkin='default';}
  d.stats.bestWave=Math.max(d.stats.bestWave,safeNumber(highWave));d.stats.bestScore=Math.max(d.stats.bestScore,safeNumber(high));
  highWave=d.stats.bestWave;high=d.stats.bestScore;
  if(ownedSkins.has('secret-marine'))d.stats.marine=Math.max(1,d.stats.marine);
  if(ownedSkins.has('secret-blackbeard'))d.stats.blackbeard=Math.max(1,d.stats.blackbeard);
  if(ownedSkins.has('secret-pearl'))d.stats.ghostKing=Math.max(1,d.stats.ghostKing);
  chronicle.ready=true;checkAchievements();persistChronicle();refreshCaptainUI();
}
function persistChronicle(){
  if(!chronicle.ready)return;
  const d=chronicle.data;d.wallet={diamonds,ownedSkins:[...ownedSkins],selectedSkin};
  d.stats.bestScore=Math.max(d.stats.bestScore,high);d.stats.bestWave=Math.max(d.stats.bestWave,highWave);
  try{
    const json=JSON.stringify(d);localStorage.setItem(CHRONICLE_KEY,json);localStorage.setItem(CHRONICLE_KEY+'Backup',json);
    chronicle.dirty=false;chronicle.saveWarning=false;
  }catch(_){chronicle.saveWarning=true;}
}
function achievementValue(a){if(a.key==='eventTypes')return chronicle.data.eventTypes.length;if(a.key==='allOtherAchievements')return chronicle.data.achievements.filter(id=>id!=='platinum').length;return chronicle.data.stats[a.key]||0;}
function checkAchievements(){
  if(!chronicle.ready)return;
  for(const a of ACHIEVEMENTS){
    if(!chronicle.data.achievements.includes(a.id)&&achievementValue(a)>=a.goal){
      chronicle.data.achievements.push(a.id);diamonds+=a.reward;
      if(a.avatarReward&&avatarById?.[a.avatarReward]&&!chronicle.data.profile.ownedAvatars.includes(a.avatarReward))chronicle.data.profile.ownedAvatars.push(a.avatarReward);
      if(chronicle.run&&['play','transition','paused','upgrade','bossreward','victory','gameover'].includes(state))voyage.runDiamonds+=a.reward;
      const bonus=a.avatarReward?' • + retrato':'';
      chronicle.queue.push({name:a.name,text:`+${a.reward} diamantes${bonus} • título: ${a.title}`,time:4.8});
      chronicle.dirty=true;
    }
  }
  if(chronicle.dirty){persistChronicle();updateDiamondUI();}
}
function addStat(key,value=1){if(!chronicle.ready)return;chronicle.data.stats[key]=safeNumber((chronicle.data.stats[key]||0)+value);chronicle.dirty=true;}
function beginChronicleRun(){chronicle.run={finished:false,kills:0,streak:0,waveDamage:0,waves:new Set(),won:false};addStat('runs');persistChronicle();}
function recordKill(e){
  if(!chronicle.run||e.tutorial)return;
  addStat('kills');chronicle.run.kills++;
  chronicle.data.stats.bestRunKills=Math.max(chronicle.data.stats.bestRunKills,chronicle.run.kills);
  if(e.spectral||e.role==='ghost'||e.role==='warden'||e.variant==='boss-ghost')addStat('ghosts');
  if(e.role==='flagship')addStat('flagships');
  if(e.isBoss){if(chronicle.run.waveDamage===0)addStat('cleanBosses');addStat('bosses');addStat(e.bossKind);if(bossFight?.endless)addStat('admirals');}
  checkAchievements();
}
function recordWaveComplete(){
  const run=chronicle.run;if(!run||run.waves.has(wave))return;
  run.waves.add(wave);
  buildWaveReward();
  if(wave===25&&buildRun.path)addStat(buildRun.path+'Build25');
  if(run.waveDamage===0&&!voyage.tutorial.active){addStat('flawless');run.streak++;}else run.streak=0;
  chronicle.data.stats.bestStreak=Math.max(chronicle.data.stats.bestStreak,run.streak);
  if(wave>=10&&player.hp>0&&player.hp<=10)addStat('closeCalls');
  if(campaign.events.includes('fog')){addStat('fogClears');if(run.waveDamage===0)addStat('fogFlawless');}
  if(campaign.events.includes('dead'))addStat('deadClears');
  if(campaign.events.includes('storm'))addStat('stormClears');
  if(campaign.events.includes('armada'))addStat('armadaClears');
  if(campaign.events.includes('treasure'))addStat('treasureClears');
  if(campaign.events.includes('hunt'))addStat('huntClears');
  if(campaign.events.length>=2)addStat('combinedClears');
  if(campaign.events.length&&run.waveDamage===0)addStat('eventFlawless');
  for(const ev of campaign.events){addStat('events');if(!chronicle.data.eventTypes.includes(ev))chronicle.data.eventTypes.push(ev);}
  if(wave===35){addStat('gate');notifyVoyage('O VÉU FOI ROMPIDO','Os guardiões caíram. A origem da maldição espera na onda 50.','#a8e6c0',6);}
  run.waveDamage=0;checkAchievements();persistChronicle();
}
function finishChronicleRun(reason){
  const run=chronicle.run;if(!run||run.finished)return;
  run.finished=true;if(reason==='death')addStat('deaths');
  const specs=buildRun?.specializations instanceof Set?[...buildRun.specializations]:[];
  chronicle.data.history.unshift({wave,score,class:buildRun?.path||null,build:[...acquiredUpgrades],specializations:specs,seconds:Math.floor(buildRun?.elapsed||0),date:new Date().toISOString(),reason});
  chronicle.data.history=chronicle.data.history.slice(0,12);chronicle.dirty=true;
  high=Math.max(high,score);highWave=Math.max(highWave,wave);
  chronicle.data.stats.bestRunKills=Math.max(chronicle.data.stats.bestRunKills,run.kills);
  try{localStorage.setItem('reiDosMaresHighScore',String(high));localStorage.setItem('reiDosMaresHighWave',String(highWave));}catch(_){ }
  checkAchievements();persistChronicle();refreshCaptainUI();
}
function recordVictory(){
  if(chronicle.run)chronicle.run.won=true;
  high=Math.max(high,score);chronicle.data.stats.bestScore=high;checkAchievements();persistChronicle();
  document.getElementById('victory-captain').textContent=`${chronicle.data.name}, sua bandeira agora governa estes mares.`;
  document.getElementById('victory-run').textContent=`${score.toLocaleString('pt-BR')} pontos • ${chronicle.run?.kills||0} ${(chronicle.run?.kills||0)===1?'navio afundado':'navios afundados'}`;
}
function updateChronicle(dt){
  if(!chronicle.ready)return;
  if(state==='play'){
    addStat('seconds',dt);chronicle.clock+=dt;
    chronicle.data.stats.bestWave=Math.max(chronicle.data.stats.bestWave,wave);
    if(chronicle.clock>=2){chronicle.clock=0;checkAchievements();if(chronicle.dirty)persistChronicle();}
  }
  if(['play','menu','collection','victory'].includes(state)){
    if(!chronicle.toast&&chronicle.queue.length){chronicle.toast=chronicle.queue.shift();sfx('achievement',.65,500);}
    if(chronicle.toast){chronicle.toast.time-=dt;if(chronicle.toast.time<=0)chronicle.toast=null;}
  }
}
function refreshCaptainUI(){
  if(!chronicle.ready)return;
  const d=chronicle.data,el=document.getElementById('captain-signature');
  if(el)el.textContent=d.name===d.title?`${d.name} • UMA BANDEIRA, UMA LENDA`:`${d.name} • ${d.title}`;
  menuHigh.textContent=high;menuHighWave.textContent=highWave;updateDiamondUI();updateMenuShip();updateCaptainIdentity();
}
function resetChronicle(){
  chronicle.data=defaultChronicle();chronicle.run=null;chronicle.toast=null;chronicle.queue=[];
  try{localStorage.removeItem(CHRONICLE_KEY);localStorage.removeItem(CHRONICLE_KEY+'Backup');}catch(_){ }
  persistChronicle();refreshCaptainUI();
}
function openCollection(){state='collection';mouse.down=false;keys.clear();menu.classList.add('hidden');hideHud();document.getElementById('collection-screen').classList.remove('hidden');renderCollection();}
function renderCollection(){
  const d=chronicle.data,s=d.stats,content=document.getElementById('collection-content');
  document.getElementById('captain-name').value=d.name;
  updateCaptainIdentity();
  document.getElementById('collection-wallet').textContent=String(diamonds);
  document.querySelectorAll('[data-log-tab]').forEach(b=>b.classList.toggle('active',b.dataset.logTab===chronicle.tab));
  content.replaceChildren();
  if(chronicle.tab==='records'){
    const rows=[['MAIOR ONDA',Math.max(s.bestWave,highWave)],['MAIOR PONTUAÇÃO',Math.max(s.bestScore,high)],['NAVIOS AFUNDADOS',s.kills],['CHEFES DERROTADOS',s.bosses],['ALMIRANTES DO ABISMO',s.admirals],['CAPITÂNIAS AFUNDADAS',s.flagships],['OURO COLETADO',s.gold],['DIAMANTES DOS BAÚS',s.diamonds],['BAÚS ENCONTRADOS',s.chests],['VIAGENS',s.runs],['DERROTAS',s.deaths],['EVENTOS CONCLUÍDOS',s.events],['ONDAS SEM DANO',s.flawless],['MELHOR SEQUÊNCIA SEM DANO',s.bestStreak],['MAIS NAVIOS EM UMA VIAGEM',s.bestRunKills],['ESPECIALIZAÇÕES ESCOLHIDAS',s.specializations],['RETRATOS DESBLOQUEADOS',d.profile.ownedAvatars.length],['TÍTULOS DESBLOQUEADOS',d.achievements.length+1]];
    content.innerHTML=`<div class="records-grid">${rows.filter(([label])=>label!=="ALMIRANTES DO ABISMO"||s.admirals>0||s.bestWave>=60).filter(([label])=>label!=="CAPITÂNIAS AFUNDADAS"||s.flagships>0||s.bestWave>=42).map(([label,v])=>`<article><span>${label}</span><strong>${Math.floor(v).toLocaleString('pt-BR')}</strong></article>`).join('')}</div><p class="log-note"><span>⏱ ${Math.floor(s.seconds/60)} minutos no mar</span><span>✦ Conquistas: ${d.achievements.length}/${ACHIEVEMENTS.length}</span><span>⚑ Retratos: ${d.profile.ownedAvatars.length}/${AVATARS.length}</span></p>${d.history.length?`<h3 class="history-title">ÚLTIMAS VIAGENS</h3><div class="run-history">${d.history.slice(0,8).map(r=>`<article><b>Onda ${Math.floor(r.wave)}</b><span>${BUILD_PATHS[r.class]?.name||'Sem classe'} • ${Math.floor(r.score).toLocaleString('pt-BR')} pts • ${formatRunTime(r.seconds)}</span><small>${r.specializations?.length||0} especializações • ${(r.date?new Date(r.date).toLocaleDateString('pt-BR'):'')}</small></article>`).join('')}</div>`:''}`;
  }else if(chronicle.tab==='achievements'){
    content.innerHTML=`<p class="tab-intro">${d.achievements.length} de ${ACHIEVEMENTS.length} conquistas • Algumas recompensam também com retratos exclusivos.</p><div class="achievements-grid">${ACHIEVEMENTS.map(a=>{const unlocked=d.achievements.includes(a.id),secret=(a.secret||!achievementDiscovered(a))&&!unlocked,v=Math.min(a.goal,achievementValue(a)),r=TITLE_RARITIES[a.rarity];return `<article class="achievement-card ${unlocked?'earned':''} ${secret?'secret-achievement':''} ${a.rarity||'common'}"><div class="achievement-seal">${unlocked?'✦':secret?'?':'◇'}</div><div><h3>${secret?'Conquista secreta':a.name}</h3><p>${secret?'Há histórias que só o mar revela. Descubra este feito durante suas viagens.':a.desc}</p>${secret?'<small>REQUISITOS OCULTOS</small>':`<div class="achievement-meter"><i style="width:${v/a.goal*100}%"></i></div><small>${Math.floor(v)} / ${a.goal} • ◆ ${a.reward}</small><span class="achievement-title" style="color:${a.titleColor||r.color}">${r.label} • ${a.title}</span>${a.avatarReward?'<span class="achievement-bonus">RECOMPENSA EXTRA: RETRATO</span>':''}`}${unlocked?'<span class="earned-label">CONCLUÍDA</span>':''}</div></article>`;}).join('')}</div>`;
  }else if(chronicle.tab==='titles'){
    renderCaptainTitles(content);
  }else if(chronicle.tab==='portraits'){
    content.innerHTML='<p class="tab-intro">Seu estandarte acompanha o capitão no HUD. Retratos são cosméticos e vários agora são liberados por skins e conquistas.</p><div class="portraits-grid"></div>';
    renderAvatarCards(content.querySelector('.portraits-grid'));
  }else{
    const all=[{id:'default',name:'pirata',src:'assets/skin-default.png',rarity:'INICIAL'},...SKINS];
    content.innerHTML=`<div class="collection-ships">${all.map(s=>{const owned=ownedSkins.has(s.id),unknown=s.secret&&!owned;const condition=s.id==='secret-marine'?'Derrote o chefe da onda 15':s.id==='secret-blackbeard'?'Derrote o chefe da onda 25':s.id==='secret-pearl'?'Derrote o chefe da onda 50':s.id==='rei-dos-mares'?'Alcance a onda 100':'Segredo ainda não revelado';return `<article class="collection-ship ${unknown?'unknown':''}"><img src="${s.src}" alt="${unknown?'Navio desconhecido':s.name}"><span>${unknown?'SECRETO':s.rarity}</span><h3>${unknown?'???':s.name}</h3><p>${unknown?condition:owned?'Na sua coleção':`${s.cost} diamantes na loja`}</p><button data-collection-skin="${s.id}" ${unknown?'disabled':''}>${owned?(selectedSkin===s.id?'EQUIPADO':'EQUIPAR'):unknown?'DESCONHECIDO':'VISITAR LOJA'}</button></article>`;}).join('')}</div>`;
    content.querySelectorAll('[data-collection-skin]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.collectionSkin;if(ownedSkins.has(id)){selectedSkin=id;saveMeta();updateMenuShip();renderCollection();}else{document.getElementById('collection-screen').classList.add('hidden');openShop();}}));
  }
}
function initChronicleUI(){
  document.getElementById('collection-open').addEventListener('click',openCollection);
  document.getElementById('collection-close').addEventListener('click',()=>{document.getElementById('collection-screen').classList.add('hidden');goMenu();});
  document.querySelectorAll('[data-log-tab]').forEach(b=>b.addEventListener('click',()=>{chronicle.tab=b.dataset.logTab;renderCollection();}));
  document.getElementById('captain-name').addEventListener('change',e=>{chronicle.data.name=e.target.value.trim().slice(0,24)||'Capitão';persistChronicle();refreshCaptainUI();});
  window.addEventListener('pagehide',persistChronicle);
  initIdentityUI();
  loadChronicle();
}
function renderChronicleUI(){
  const toast=document.getElementById('achievement-toast'),n=chronicle.toast;
  toast.classList.toggle('hidden',!n||!['play','menu','collection','victory'].includes(state));
  if(n&&toast.dataset.name!==n.name){toast.dataset.name=n.name;toast.querySelector('b').textContent=n.name;toast.querySelector('span').textContent=n.text;}
  document.getElementById('save-status').classList.toggle('hidden',!chronicle.saveWarning);
}
function achievementDiscovered(a){const waveRequired={blockade:42,admirals:60,'admirals-six':75,endless:51,gate:35,king:50,specialist:70,'specialist-3':80,century:90,wave50:45};return !waveRequired[a.id]||chronicle.data.stats.bestWave>=waveRequired[a.id]||chronicle.data.achievements.includes(a.id);}

window.ReiChronicle={addStat,checkAchievements,persist:persistChronicle,data:()=>chronicle.data,achievementValue};
