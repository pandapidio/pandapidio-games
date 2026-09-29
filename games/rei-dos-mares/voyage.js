/* Rei dos Mares v18 — tutorial, mensagens e organização das ondas.
   Carregado antes de game.js; funções só acessam a partida depois da inicialização. */
const ENEMY_ROLES = {
  scout: { name:'BATEDOR', tip:'Rápido e frágil. Antecipe o movimento lateral.', hp:1, speed:96, r:28, w:68, h:142, score:25, cost:1.25, color:'#7ee2e7' },
  bomber: { name:'BOMBARDEIRO', tip:'O círculo marca o impacto. Saia dele antes de fechar.', hp:2, speed:43, r:36, w:111, h:134, score:45, cost:2, color:'#ffce79' },
  tank: { name:'COURAÇADO', tip:'Resistente e lento. Contorne a salva e ataque pelos espaços.', hp:4, speed:31, r:43, w:116, h:143, score:65, cost:3, color:'#b8cbdf' },
  rammer: { name:'ARÍETE', tip:'A faixa vermelha anuncia a investida. Desvie para o lado.', hp:2, speed:52, r:33, w:88, h:143, score:45, cost:2, color:'#ff9585' },
  support: { name:'SUPORTE', tip:'Fortalece aliados próximos em 3 áreas: +12% de velocidade, +18% de cadência e 18% menos dano recebido. Priorize-o.', hp:3, speed:42, r:35, w:100, h:143, score:60, cost:2.6, color:'#a9e4ff' },
  sniper: { name:'LONGA DISTÂNCIA', tip:'Recua para manter distância e prepara tiros muito rápidos. Quebre sua linha de mira.', hp:2, speed:50, r:32, w:92, h:150, score:58, cost:2.4, color:'#f4dfa0' },
  miner: { name:'MINEIRO', tip:'Deixa minas armadas na água. Observe o brilho antes de atravessar uma área minada.', hp:3, speed:44, r:35, w:98, h:143, score:62, cost:2.7, color:'#f4a66c' },
  blocker: { name:'BLOQUEADOR', tip:'Ocupa espaço e empurra sua rota para posições ruins. Contorne seu casco pesado.', hp:5, speed:34, r:46, w:124, h:142, score:72, cost:3.4, color:'#c9d4df' },
  hunter: { name:'CAÇADOR', tip:'Rápido e agressivo. Pressiona diretamente e pune quem fica parado.', hp:2, speed:108, r:30, w:90, h:138, score:52, cost:2.1, color:'#ff9d91' }
};
const roleImages = Object.fromEntries(Object.keys(ENEMY_ROLES).map(id => [id, Object.assign(new Image(), {src:`assets/enemy-${id}.png`})]));
const SEA_EVENTS = {
  treasure:{name:'MARÉ DE TESOUROS', label:'MARÉ FAVORÁVEL', tip:'Baús à deriva e um navio cargueiro. Afunde a escolta e recolha o tesouro.', color:'#f5ce78'},
  hunt:{name:'CAÇADORES DOS FLANCOS', label:'TENAZA NO HORIZONTE', tip:'Embarcações leves tentam cercar pelos lados. Leia o flanco livre e atravesse a formação antes do aperto.', color:'#7ee2e7'},
  fog:{name:'BANCO DE NÉVOA', label:'VISIBILIDADE REDUZIDA', tip:'Nuvens de névoa atravessam o mar e escondem projéteis. Perto do navio, eles voltam a aparecer.', color:'#c5e1e7'},
  armada:{name:'MURALHA DA ARMADA', label:'ESCOLTA FECHADA', tip:'Couraçados formam uma linha de proteção para a artilharia. Rompa a muralha ou flanqueie a retaguarda.', color:'#e8b68a'},
  storm:{name:'TEMPESTADE', label:'MAR REVOLTO', tip:'Relâmpagos marcam a água antes de cair. Evite os círculos azuis.', color:'#94caff'},
  dead:{name:'MAR DOS MORTOS', label:'ÁGUAS AMALDIÇOADAS', tip:'Fantasmas emergem de portais. Abra espaço entre os navios e desvie das salvas espectrais.', color:'#95dfb9'},
  vortex:{name:'REDEMOINHO GIGANTE', label:'ÁGUA EM ESPIRAL', tip:'Um redemoinho colossal surge no campo de batalha e puxa navios para o centro. Respeite o anel externo e escape antes de ser tragado.', color:'#d4a8ff'},
  silence:{name:'SILÊNCIO ANTES DA TEMPESTADE', label:'CALMARIA ENGANOSA', tip:'O mar fica estranhamente quieto por alguns instantes. Depois, relâmpagos e ataques caem de uma vez. Respire, reposicione e prepare-se.', color:'#b5c9ff'},
  laststand:{name:'ÚLTIMO SOBREVIVENTE', label:'FRENESI FINAL', tip:'Quando restar apenas um inimigo, ele entra em frenesi, ganha vida extra e dispara com mais agressividade.', color:'#ff9b8d'},
  rival:{name:'CAÇADOR DE TESOURO RIVAL', label:'SAQUEADOR NO HORIZONTE', tip:'Um rival marcado com um cifrão na bandeira tenta roubar os baús do mar. Colete o tesouro antes dele ou afunde-o para recuperar a pilhagem.', color:'#7ae0a2'}
};
const voyage = {
  event:null, eventTime:0, hazardClock:6, hazards:[], plan:[], spawned:0, formation:'patrol', edge:0,
  notice:null, queue:[], seenRoles:new Set(), forcedTutorial:false, guide:false, shopExplained:false,
  tutorial:{active:false, step:0, time:0, distance:0, aim:0, target:null, killed:false, collected:false},
  ui:null, uiKey:'', runDiamonds:0, runGold:0, flash:0, waveGrace:0, menuTimer:0, silentIntro:0, rivalClock:-1
};
function metaFlag(key) { try { return localStorage.getItem(key) === '1'; } catch (_) { return false; } }
function setMetaFlag(key) { try { localStorage.setItem(key,'1'); } catch (_) {} }
function notifyVoyage(title, detail, color='#f5ce78', duration=4.5, image='') {
  const n={title,detail,color,time:duration,max:duration,image};
  if (voyage.notice) voyage.queue.push(n); else voyage.notice=n;
  if (voyage.queue.length>4) voyage.queue.shift();
}
function initVoyageUI() {
  voyage.ui = {
    tutorial:document.getElementById('tutorial-card'), title:document.getElementById('tutorial-title'),
    body:document.getElementById('tutorial-body'), count:document.getElementById('tutorial-count'),
    progress:document.getElementById('tutorial-progress'), next:document.getElementById('tutorial-next'),
    notice:document.getElementById('encounter-notice'), event:document.getElementById('sea-event'),
    shopHint:document.getElementById('first-shop-hint')
  };
  document.getElementById('tutorial-replay').addEventListener('click',()=>{voyage.forcedTutorial=true;start();});
  document.getElementById('tutorial-skip').addEventListener('click',()=>finishTutorial(true));
  voyage.ui.next.addEventListener('click',()=>{if(voyage.tutorial.active && voyage.tutorial.step===4) finishTutorial(false);});
  document.getElementById('field-guide-open').addEventListener('click',()=>showFieldGuide('menu'));
  document.getElementById('pause-guide-open').addEventListener('click',()=>showFieldGuide('paused'));
  document.getElementById('field-guide-close').addEventListener('click',()=>{
    document.getElementById('field-guide').classList.add('hidden');
    state=voyage.guideReturn||'menu';
  });
  document.getElementById('guide-hit-left').addEventListener('click',()=>flipGuideBook(-1));
  document.getElementById('guide-hit-right').addEventListener('click',()=>flipGuideBook(1));
  document.getElementById('guide-mobile-prev')?.addEventListener('click',e=>{e.stopPropagation();flipGuideBook(-1);});
  document.getElementById('guide-mobile-next')?.addEventListener('click',e=>{e.stopPropagation();flipGuideBook(1);});
  renderFieldGuide();
  document.getElementById('tutorial-replay').textContent=metaFlag('reiDosMaresTutorialSeen')?'REVER TUTORIAL':'APRENDER A JOGAR';
  window.addEventListener('blur',()=>{mouse.down=false;keys.clear();if(state==='play')openPause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){mouse.down=false;keys.clear();if(state==='play')openPause();}});
}

function fieldGuideEnemyCard(id,r){
  const seen=metaFlag(`reiSeenRole:${id}`)||(['scout'].includes(id)&&metaFlag('reiDosMaresTutorialSeen'));
  return seen
    ? `<article class="guide-entry threat-card"><img src="assets/enemy-${id}.png" alt="${r.name}"><div><h4>${r.name}</h4><p>${r.tip}</p>${id==='support'?'<small>BUFF CLARO • +12% velocidade • +18% cadência • 18% menos dano recebido</small>':''}</div></article>`
    : `<article class="guide-entry threat-card unknown"><div class="guide-unknown-art">?</div><div><h4>???</h4><p>Encontre esta ameaça durante uma viagem para registrá-la.</p></div></article>`;
}
function fieldGuideEventCard(id,ev){
  return metaFlag(`reiSeenEvent:${id}`)
    ? `<article class="guide-entry event-card"><h4 style="color:${ev.color}">${ev.name}</h4><p>${ev.tip}</p></article>`
    : `<article class="guide-entry event-card unknown"><h4>???</h4><p>Um fenômeno ainda não registrado.</p></article>`;
}
function fieldGuideBossCard(id,name,tip){
  const seen=metaFlag(`reiSeenBoss:${id}`),dead=metaFlag(`reiDefeatedBoss:${id}`);
  return seen
    ? `<article class="guide-entry boss-card"><h4>${name}</h4><p>${tip}</p><small>${dead?'Registrado como derrotado no Diário do Capitão.':'A primeira vitória revelará ainda mais detalhes.'}</small></article>`
    : `<article class="guide-entry boss-card unknown"><h4>???</h4><p>Chefe ainda não encontrado.</p></article>`;
}
function buildFieldGuidePages(){
  const enemyEntries=Object.entries(ENEMY_ROLES).map(([id,r])=>fieldGuideEnemyCard(id,r));
  const eventEntries=Object.entries(SEA_EVENTS).map(([id,ev])=>fieldGuideEventCard(id,ev));
  const bossEntries=[
    fieldGuideBossCard('marine','ALMIRANTE DA MARINHA','Disciplina naval, tiros de contenção e pressão defensiva.'),
    fieldGuideBossCard('blackbeard','BARBA NEGRA','Água corrompida, subordinados e agressão constante.'),
    fieldGuideBossCard('ghostKing','O CAPITÃO DOS MORTOS','A névoa fecha, as almas avançam e os ataques do além testam sua leitura do mar.')
  ];
  const infiniteEntries=ENDLESS_MODS.map(m=>`<article class="guide-entry mod-card"><h4>${m.name}</h4><p>${m.desc}</p></article>`).join('');
  return [
    {
      title:'Prólogo do Convés',
      subtitle:'Os primeiros passos de um novo capitão',
      content:`<div class="guide-hero"><img src="assets/captains-atlas-v22.png" alt="Atlas do capitão"><div><h3>BEM-VINDO A REI DOS MARES</h3><p>Use <b>WASD</b> ou as <b>setas</b> para navegar, mire com o mouse e segure o clique esquerdo para disparar. <b>ESC</b> pausa a viagem.</p><p><b>Ouro</b> compra melhorias naquela viagem. <b>Diamantes</b> permanecem após a derrota e compram skins, retratos e cosméticos.</p><div class="guide-ribbon">Sobreviva até a onda 5 para escolher sua classe e começar a montar sua build.</div></div></div>`
    },
    {
      title:'Classes e Progressão',
      subtitle:'Entenda o fluxo de uma partida',
      content:`<div class="guide-callout-grid"><article><h4>MARINHEIRO</h4><p>Mais defesa, constância e contra-ataque.</p></article><article><h4>PIRATA</h4><p>Mais agressão, fogo e risco recompensado.</p></article><article><h4>MORTO-VIVO</h4><p>Controle, debuffs e força tardia.</p></article></div><div class="guide-parchment"><p>A loja abre a cada cinco ondas normais. Nos marcos 15, 25 e 50 você enfrenta chefes. Na onda 35 cruza o Portão dos Afogados e na 42 encara a última capitânia antes do fim da campanha.</p><p>Após a onda 50, o modo infinito mantém sua build e libera especializações de classe nas ondas 70 e 90.</p></div>`
    },
    {
      title:'Ameaças do Horizonte',
      subtitle:'Leia os padrões inimigos',
      content:`<div class="guide-entry-grid">${enemyEntries.slice(0,5).join('')}</div>`
    },
    {
      title:'Mais Ameaças',
      subtitle:'Frotas especiais e funções avançadas',
      content:`<div class="guide-entry-grid">${enemyEntries.slice(5).join('')}</div><div class="guide-ribbon">Suporte fortalece aliados em um círculo azul: <b>+12% velocidade</b>, <b>+18% cadência</b> e <b>18% menos dano recebido</b>. O efeito também aparece visualmente nos inimigos buffados.</div>`
    },
    {
      title:'Sinais do Mar',
      subtitle:'Eventos e mudanças de rota',
      content:`<div class="guide-entry-grid">${eventEntries.slice(0,4).join('')}</div>`
    },
    {
      title:'Fenômenos Avançados',
      subtitle:'Os mares ficam mais cruéis com o tempo',
      content:`<div class="guide-entry-grid">${eventEntries.slice(4).join('')}</div><div class="guide-ribbon">Silêncio antes da tempestade só começa a aparecer depois da onda 50, quando o modo infinito assume o comando do mar.</div>`
    },
    {
      title:'Chefes Registrados',
      subtitle:'Cada batalha pede uma leitura diferente',
      content:`<div class="guide-entry-grid bosses">${bossEntries.join('')}</div><div class="guide-parchment"><p>Círculos, faixas, neblina, anéis e sombras sobre a água são avisos de ataque. Aprender esses sinais vale tanto quanto qualquer melhoria.</p></div>`
    },
    {
      title:'Atlas do Infinito',
      subtitle:'O mar continua após a campanha',
      content:`<div class="guide-entry-grid mods">${infiniteEntries}</div>`
    },
    {
      title:'Anotações Finais',
      subtitle:'Dicas rápidas do capitão',
      content:`<div class="guide-parchment"><ul class="guide-tips"><li>Baús desaparecem depois de um tempo; não deixe tesouro para trás.</li><li>Salve seu casco antes de caçar tesouro: posição ainda vale mais que dano.</li><li>Salvar e sair reinicia a onda atual quando você retornar.</li><li>Monte builds coerentes. Algumas classes escalam muito melhor quando seguem sua identidade.</li></ul></div>`
    }
  ];
}
function guideSinglePageMode(){
  return !!(window.matchMedia?.('(pointer: coarse)')?.matches||navigator.maxTouchPoints>0);
}
function renderGuideBookSpread(){
  const pages=buildFieldGuidePages(),single=guideSinglePageMode(),spread=document.getElementById('guide-spread');
  spread?.classList.toggle('single-page',single);
  const renderPage=(page,side,pageNumber)=>page?`<div class="book-leaf ${side}"><div class="book-page-number">${pageNumber}</div><span class="book-chapter">${page.subtitle}</span><h3>${page.title}</h3>${page.content}</div>`:'<div class="book-leaf blank"></div>';
  const leftEl=document.getElementById('guide-page-left'),rightEl=document.getElementById('guide-page-right'),indicator=document.getElementById('guide-page-indicator');
  const prev=document.getElementById('guide-mobile-prev'),next=document.getElementById('guide-mobile-next');
  if(single){
    voyage.guidePage=Math.max(0,Math.min(pages.length-1,voyage.guidePage||0));
    const page=pages[voyage.guidePage];
    leftEl.innerHTML='<div class="book-leaf blank"></div>';
    rightEl.innerHTML=renderPage(page,'right',voyage.guidePage+1);
    indicator.textContent=`PÁGINA ${voyage.guidePage+1} / ${pages.length}`;
    document.getElementById('guide-hit-left').classList.add('page-disabled');
    document.getElementById('guide-hit-right').classList.toggle('page-disabled',voyage.guidePage>=pages.length-1);
    if(prev)prev.disabled=voyage.guidePage<=0;
    if(next)next.disabled=voyage.guidePage>=pages.length-1;
    rightEl.scrollTop=0;
    return;
  }
  const totalSpreads=Math.ceil(pages.length/2);
  voyage.guidePage=Math.max(0,Math.min(totalSpreads-1,voyage.guidePage||0));
  const left=pages[voyage.guidePage*2],right=pages[voyage.guidePage*2+1];
  leftEl.innerHTML=renderPage(left,'left',voyage.guidePage*2+1);
  rightEl.innerHTML=renderPage(right,'right',voyage.guidePage*2+2);
  indicator.textContent=`PÁGINAS ${voyage.guidePage*2+1}–${Math.min(pages.length,voyage.guidePage*2+2)}`;
  document.getElementById('guide-hit-left').classList.toggle('page-disabled',voyage.guidePage===0);
  document.getElementById('guide-hit-right').classList.toggle('page-disabled',voyage.guidePage>=totalSpreads-1);
  if(prev)prev.disabled=voyage.guidePage===0;
  if(next)next.disabled=voyage.guidePage>=totalSpreads-1;
}
function renderFieldGuide(){ renderGuideBookSpread(); }
function flipGuideBook(step){
  const pages=buildFieldGuidePages(),single=guideSinglePageMode(),total=single?pages.length:Math.ceil(pages.length/2);
  const before=voyage.guidePage||0,next=Math.max(0,Math.min(total-1,before+step));
  if(next===before||voyage.guideTurning)return;
  voyage.guideTurning=true;
  const spread=document.getElementById('guide-spread');
  spread?.classList.remove('turn-next','turn-prev','turn-arrive-next','turn-arrive-prev');
  spread?.classList.add(step>0?'turn-next':'turn-prev');
  sfx('page',.46,75);
  setTimeout(()=>{
    voyage.guidePage=next;
    renderGuideBookSpread();
    spread?.classList.remove('turn-next','turn-prev');
    spread?.classList.add(step>0?'turn-arrive-next':'turn-arrive-prev');
    setTimeout(()=>{spread?.classList.remove('turn-arrive-next','turn-arrive-prev');voyage.guideTurning=false;},220);
  },180);
}
function showFieldGuide(from) {
  voyage.guideReturn=from;voyage.guidePage=0;state='guide';mouse.down=false;keys.clear();renderFieldGuide();
  document.getElementById('field-guide').classList.remove('hidden');
}
function resetVoyage() {
  resetCampaign();
  voyage.event=null;voyage.eventTime=0;voyage.hazards=[];voyage.notice=null;voyage.queue=[];
  voyage.plan=[];voyage.spawned=0;voyage.seenRoles=new Set();voyage.runDiamonds=0;voyage.runGold=0;
  voyage.guide=false;voyage.shopExplained=false;voyage.flash=0;voyage.waveGrace=0;voyage.silentIntro=0;voyage.rivalClock=-1;
  voyage.tutorial={active:false,step:0,time:0,distance:0,aim:0,target:null,killed:false,collected:false};
  voyage.uiKey='';
  keys.clear();
  document.getElementById('field-guide').classList.add('hidden');
}
function startVoyage() {
  const enabled=voyage.forcedTutorial || !metaFlag('reiDosMaresTutorialSeen');
  voyage.forcedTutorial=false;
  if(enabled) {
    voyage.tutorial.active=true;voyage.guide=true;
    setMetaFlag('reiDosMaresTutorialSeen');
    document.getElementById('tutorial-replay').textContent='REVER TUTORIAL';
  } else notifyVoyage('DE VOLTA AO LEME','ESC pausa a partida • Baús trazem ouro e podem conter diamantes.','#8ed8df',3.5);
}
function setTutorialStep(step) {voyage.tutorial.step=step;voyage.tutorial.time=0;voyage.uiKey='';sfx('ui',.35);}
function finishTutorial(skipped) {
  const tu=voyage.tutorial;
  if(!tu.active)return;
  tu.active=false;
  if(skipped){
    enemies=enemies.filter(e=>!e.tutorial);
    waveRemainingToSpawn=tu.killed?2:3;
    voyage.plan=Array(waveRemainingToSpawn).fill('basic');voyage.spawned=0;
  }
  waveTimer=0;waveSpawnClock=1.6;waveCompleteTimer=-1;
  setMetaFlag('reiDosMaresTutorialBasics');
  notifyVoyage('PRONTO PARA NAVEGAR','Sobreviva até a onda 5 para visitar a loja de melhorias. ESC para pausar.','#8ee2be',5);
  mouse.down=false;voyage.uiKey='';
}
function updateTutorial(dt) {
  const tu=voyage.tutorial;
  if(!tu.active)return;
  tu.time+=dt;
  if(tu.step===0){
    if(keys.has('w')||keys.has('a')||keys.has('s')||keys.has('d')||[...keys].some(k=>k.startsWith('arrow')))
      tu.distance+=Math.hypot(player.vx,player.vy)*dt;
    if(tu.distance>=110 && tu.time>1.2){
      setTutorialStep(1);
      const targetX=player.x<W/2?Math.min(W-180,player.x+300):Math.max(180,player.x-300);
      const e=createRoleEnemy('basic',targetX,clamp(player.y-90,170,H-140));
      e.tutorial=true;e.hp=1;e.max=1;e.shot=999;enemies.push(e);tu.target=e;
      waveRemainingToSpawn=2;voyage.plan=['basic','basic'];voyage.spawned=0;
    }
  }else if(tu.step===1 && tu.time>.8 && (tu.aim>55 || (tu.aim>8 && tu.target && Math.hypot(mouse.x-tu.target.x,mouse.y-tu.target.y)<90)))setTutorialStep(2);
  if(tu.killed && tu.step<=2)setTutorialStep(3);
  if(tu.collected && tu.step<=3)setTutorialStep(4);
}
function tutorialAimMoved(dx,dy) {if(voyage.tutorial.active)voyage.tutorial.aim+=Math.hypot(dx,dy);}
function onVoyageKill(e) {
  if(e.tutorial){
    voyage.tutorial.killed=true;
    spawnChest(e.x,e.y+10);chests[chests.length-1].tutorial=true;
    return true;
  }
  return false;
}
function onVoyageChest(chest,amount,diamondGain) {
  voyage.runGold+=amount;voyage.runDiamonds+=diamondGain;
  if(!chest.tutorial){addStat('gold',amount);addStat('diamonds',diamondGain);addStat('chests');checkAchievements();}
  if(chest.tutorial)voyage.tutorial.collected=true;
}
function explainFirstShop() {
  if(voyage.guide&&!voyage.shopExplained){
    voyage.shopExplained=true;
    setMetaFlag('reiDosMaresTutorialCompleted');
  }
  mouse.down=false;keys.clear();
}
function updateVoyageUI() {
  if(!voyage.ui)return;
  const ui=voyage.ui,tu=voyage.tutorial;
  const cardRight=!!player && player.x<W*.43 && player.y>H*.50;
  ui.tutorial.classList.toggle('on-right',cardRight);
  const show=state==='play'&&transition>=3.8&&tu.active;
  ui.tutorial.classList.toggle('hidden',!show);
  if(show){
    const key=String(tu.step);
    if(voyage.uiKey!==key){
      voyage.uiKey=key;
      const copy=[
        ['ASSUMA O LEME','Use <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ou as <b>setas</b> para navegar. Experimente mover seu navio.'],
        ['APONTE O CANHÃO','Mova o <b>mouse</b> em direção ao navio marcado. Seu canhão acompanha a mira. Este primeiro alvo não ataca.'],
        ['ABRA FOGO','<b>Clique ou segure o botão esquerdo</b> para atirar. Acerte o alvo marcado. A barra de recarga indica o próximo disparo.'],
        ['O TESOURO É SEU','Navegue até o <b>baú dourado</b> para recolhê-lo. Os inimigos podem deixar baús quando afundam.'],
        ['DUAS MOEDAS, DOIS DESTINOS','<span class="coin-lesson"><img src="assets/gold-coin.png" alt=""><span><b>Ouro</b> compra melhorias na partida e é perdido ao morrer ou sair.</span></span><span class="coin-lesson"><img src="assets/diamond.png" alt=""><span><b>Diamantes</b> podem vir nos baús, permanecem após a derrota e compram skins no menu.</span></span>']
      ][tu.step];
      ui.title.textContent=copy[0];ui.body.innerHTML=copy[1];ui.count.textContent=`PRIMEIRA VIAGEM • ${tu.step+1}/5`;
      ui.next.classList.toggle('hidden',tu.step!==4);
    }
    ui.progress.style.width=`${(tu.step+(tu.step===0?Math.min(1,tu.distance/110):.4))/5*100}%`;
  }
  const n=voyage.notice;
  ui.notice.classList.toggle('hidden',state!=='play'||!n||tu.active||transition<4.1);
  ui.notice.classList.toggle('on-left',!!player&&player.x>W*.56&&player.y>H*.50);
  if(n && ui.notice.dataset.title!==n.title){
    ui.notice.dataset.title=n.title;ui.notice.style.setProperty('--notice-color',n.color);
    ui.notice.innerHTML=`${n.image?`<img src="${n.image}" alt="">`:''}<div><b>${n.title}</b><p>${n.detail}</p></div>`;
  }
  const ev=voyage.event&&SEA_EVENTS[voyage.event];
  ui.event.classList.toggle('hidden',state!=='play'||!ev||!!bossFight||tu.active);
  if(ev) {ui.event.textContent=campaign.events.map(id=>SEA_EVENTS[id].name).join(' + ');ui.event.style.color=ev.color;}
  ui.shopHint.classList.toggle('hidden',!(state==='upgrade'&&voyage.guide&&wave===5));
}
function eventForWave(n) {
  const first={6:'treasure',8:'hunt',12:'fog',18:'armada',21:'storm',24:'rival',28:'dead',33:'vortex',35:'dead',42:'armada',51:'silence',57:'laststand',63:'vortex',69:'rival'};
  if(first[n])return first[n];
  if(n>50&&n%2===1&&n%5!==0){
    return ['hunt','armada','dead','storm','fog','treasure','vortex','laststand','rival','silence'][Math.floor((n-51)/2)%10];
  }
  if(n<30||n%3!==0||n%5===0||[14,24,49].includes(n))return null;
  return ['treasure','fog','hunt','storm','armada','dead','rival','vortex'][Math.floor((n-30)/3)%8];
}
function buildWavePlan(n,event,events=[event]){return buildCampaignWave(n,event,events);}

function prepareVoyageWave(n) {
  voyage.event=null;voyage.eventTime=0;voyage.hazards=[];voyage.hazardClock=6;voyage.spawned=0;voyage.flash=0;voyage.silentIntro=0;voyage.rivalClock=-1;
  // Encounters never leak into a boss arena or its reward screen.
  if(isBossWave(n)){campaign.events=[];campaign.mods=[];voyage.plan=[];voyage.notice=null;voyage.queue=[];return;}
  voyage.event=eventForWave(n);
  prepareCampaignWave(n);
  voyage.plan=buildWavePlan(n,voyage.event,campaign.events);
  waveRemainingToSpawn=voyage.plan.length;waveTotal=waveRemainingToSpawn;
  voyage.formation=n<6?'patrol':activeSea('hunt')?'pincer':activeSea('armada')?'wedge':['line','pincer','wedge','patrol'][n%4];
  voyage.edge=Math.floor(Math.random()*4);
  voyage.waveGrace=1.6;
  if(voyage.event){
    const ev=SEA_EVENTS[voyage.event];notifyVoyage(ev.name,ev.tip,ev.color,5.4);
    waveSpawnClock=activeSea('silence')?4.6:2.4;
    if(activeSea('treasure')||activeSea('rival')){
      for(const x of [W*.28,W*.72]){spawnChest(x,H*.55);chests[chests.length-1].eventChest=true;}
    }
    if(activeSea('rival'))voyage.rivalClock=2.2;
    if(activeSea('silence'))voyage.silentIntro=2.6;
  }
  if(voyage.guide&&n===4)notifyVoyage('ESCOLHA SEU CAMINHO','Após a onda 5, escolha primeiro sua classe. Em seguida, escolha gratuitamente 1 entre 2 melhorias comuns aleatórias daquela classe.','#f5ce78',6);
  if(voyage.guide&&n===5)notifyVoyage('A LOJA ESTÁ PRÓXIMA','Afunde todos os inimigos. Você terá alguns segundos para recolher os baús.','#f5ce78',5);
}
function spawnPosition(index) {
  let edge=voyage.edge;
  if(voyage.formation==='patrol')edge=Math.floor(Math.random()*4);
  if(voyage.formation==='pincer')edge=(voyage.edge+((index%2)*2))%4;
  let along=.5;
  const slot=index%5;
  if(voyage.formation==='line')along=.22+slot*.14;
  else if(voyage.formation==='wedge')along=.5+[0,-.14,.14,-.28,.28][slot];
  else along=.18+Math.random()*.64;
  if(edge===0)return{x:-90,y:130+along*(H-240)};
  if(edge===1)return{x:130+along*(W-260),y:-95};
  if(edge===2)return{x:W+90,y:130+along*(H-240)};
  return{x:130+along*(W-260),y:H+95};
}
function createRoleEnemy(role,x,y){return makeCampaignEnemy(role,x,y);}

function spawnVoyageEnemy() {
  const role=voyage.plan[voyage.spawned]||'basic';
  const p=spawnPosition(voyage.spawned++),e=createRoleEnemy(role,p.x,p.y);
  if(activeSea('treasure')&&voyage.spawned===1)e.cargo=true;
  enemies.push(e);
  if(ENEMY_ROLES[role]&&!voyage.seenRoles.has(role)){
    voyage.seenRoles.add(role);setMetaFlag(`reiSeenRole:${role}`);const r=ENEMY_ROLES[role];
    notifyVoyage(`NOVO INIMIGO • ${r.name}`,r.tip,r.color,5.5,`assets/enemy-${role}.png`);
  }
}
function clearVoyageHazards(){voyage.hazards=[];voyage.flash=0;}
function updateVoyage(dt){
  updateTutorial(dt);voyage.waveGrace=Math.max(0,voyage.waveGrace-dt);
  if(voyage.notice&&!voyage.tutorial.active&&transition>=4.1){voyage.notice.time-=dt;if(voyage.notice.time<=0)voyage.notice=voyage.queue.shift()||null;}
  voyage.eventTime+=dt;voyage.flash=Math.max(0,voyage.flash-dt);
  updateCampaign(dt);
}

function addSeaHazard(kind,x,y,r,delay,damage,source=null){return addCampaignHazard(kind,x,y,r,delay,damage,source);}

function aimEnemyShot(e,angle,speed=300,damage=12){campaignBullet(e,angle,speed,damage);}

function updateRoleEnemy(e,dt){return advanceCampaignEnemy(e,dt);}

function drawVoyageSea(){campaignOcean();}

function drawVoyageFog(){campaignFog();}

function drawVoyageSignals(){campaignSignals();}

window.addEventListener('keydown',e=>{if(state!=='guide')return;if(e.key==='ArrowRight'||e.key.toLowerCase()==='d'){e.preventDefault();flipGuideBook(1);}if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a'){e.preventDefault();flipGuideBook(-1);}});
