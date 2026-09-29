/* v18 combat tuning and active sea encounters. All timers use simulation time. */
const SPECIAL_ROLES={
  ghost:{name:'NAVIO FANTASMA',hp:3,speed:68,r:37,w:114,h:169,score:55,cost:1.8,color:'#99e4bc'},
  flagship:{name:'CAPITÂNIA DO BLOQUEIO',hp:30,speed:27,r:59,w:180,h:230,score:300,cost:14,color:'#f1d297'},
  warden:{name:'GUARDIÃO DO VÉU',hp:11,speed:24,r:57,w:153,h:200,score:150,cost:5,color:'#c4f5d7'}
};
const ENDLESS_MODS=[
  {id:'crossfire',name:'Fogo cruzado',desc:'Salvas adicionais e ataques pelos dois flancos.'},
  {id:'twins',name:'Artilharia dupla',desc:'Bombardeiros marcam duas áreas de impacto.'},
  {id:'revenants',name:'Último suspiro',desc:'Fantasmas deixam uma explosão anunciada ao afundar.'},
  {id:'pursuit',name:'Caçada implacável',desc:'Batedores mais velozes; menor intervalo entre grupos.'},
  {id:'squalls',name:'Mares sobrepostos',desc:'Dois eventos atuam ao mesmo tempo.'},
  {id:'ironline',name:'Linha de ferro',desc:'Couraçado, Bombardeiro e Aríete entram juntos em uma formação de ruptura.'},
  {id:'hauntedescort',name:'Escolta espectral',desc:'Navios fantasma passam a acompanhar as formações normais.'}
];
const campaign={events:[],mods:[],fog:[],damageFlash:0,waveTime:0,eventPulse:0,eventCount:0,interlude:false,bossMist:0,bossDeath:null,lastRegion:-1,guardianKills:0,lastStandGiven:false,giantVortex:null};
function combatSpec(id){return ENEMY_ROLES[id]||SPECIAL_ROLES[id];}
function activeSea(id){return campaign.events.includes(id);}
function endlessModifiers(n){
  if(n<51)return[];const cycle=Math.floor((n-51)/5),count=n<61?1:n<81?2:3,pool=n>=86?ENDLESS_MODS:ENDLESS_MODS.slice(0,5);
  return Array.from({length:count},(_,i)=>pool[(cycle+i*2)%pool.length].id);
}
function hasModifier(id){return campaign.mods.includes(id);}
function difficulty(n=wave){
  const growth=Math.max(0,n-8),endless=Math.max(0,n-50);
  const budget=n<6?n+2:n<=15?Math.round(n*1.35+2):Math.min(88,Math.round(n*1.48+2));
  return{damage:n<=5?10:Math.min(20,12+Math.floor(growth/10)),speed:Math.min(50,growth*.98),
    bullet:Math.min(380,270+growth*1.72),rate:Math.max(.62,1-growth*.0075),
    hp:n<12?0:Math.min(3.1,(n-8)*.042),endlessHp:Math.min(4.2,Math.log2(1+endless/14)),
    budget,maxAlive:n<10?17:n<30?23:29};
}
function resetCampaign(){Object.assign(campaign,{events:[],mods:[],fog:[],damageFlash:0,eventPulse:0,waveTime:0,eventCount:0,interlude:false,bossMist:0,bossDeath:null,lastRegion:-1,guardianKills:0,lastStandGiven:false,giantVortex:null});}
function buildCampaignWave(n,event,events=[event]){
  const sea=id=>events.includes(id);
  if(n<3)return Array(n+2).fill('basic');
  const eventBudgetMod=event==='treasure'?.95:event==='rival'?.92:1;const budget=(n===42?32:difficulty(n).budget)*eventBudgetMod,plan=[];let used=0;
  function add(role){const cost=combatSpec(role)?.cost||1;if(used+cost>budget+.01)return false;plan.push(role);used+=cost;return true;}
  const first={3:'scout',7:'bomber',10:'tank',13:'rammer',16:'support',20:'sniper',27:'hunter',32:'miner',38:'blocker'};
  if(first[n])add(first[n]);
  if(n===42){for(const role of ['flagship','tank','bomber','scout','tank'])add(role);}
  if(n===35){for(const role of ['warden','ghost','ghost','warden','ghost','ghost','warden'])add(role);}
  else if(sea('dead')){add('ghost');add('ghost');}
  if(sea('armada')){add('tank');add('bomber');add('tank');add('bomber');}
  if(sea('hunt')){add('scout');add('scout');}
  // Late difficulty comes more from deliberate formations than from pure HP inflation.
  if(n>=14&&n%4===0){add('tank');add('bomber');}
  if(n>=18&&n%5===2){add('rammer');add('scout');add('scout');}
  if(n>=24&&n%6===0){add('bomber');add('tank');add('scout');}
  if(n>=20&&n%7===1){add('support');add(n>=27?'hunter':'scout');add('scout');}
  if(n>=28&&n%8===3){add('sniper');add('hunter');add('tank');}
  if(n>=34&&n%9===2){add('miner');add('blocker');add('scout');}
  if(n>=41&&n%7===0){add('support');add('blocker');add('sniper');}
  const mods=endlessModifiers(n);
  if(mods.includes('twins')){add('bomber');add('bomber');}
  if(mods.includes('revenants')){add('ghost');add('ghost');}
  if(mods.includes('pursuit')){add('scout');add('scout');}
  if(mods.includes('ironline')){add('tank');add('bomber');add('rammer');}
  if(mods.includes('hauntedescort')){add('ghost');add('ghost');}
  while(used+1<=budget){
    let id='basic';const r=Math.random();
    if(sea('dead')&&Math.random()<.66)id='ghost';
    else if(n>=38&&r<.08)id='blocker';else if(n>=32&&r<.16)id='miner';else if(n>=27&&r<.25)id='hunter';else if(n>=20&&r<.33)id='sniper';else if(n>=16&&r<.41)id='support';else if(n>=13&&r<.52)id='rammer';else if(n>=10&&r<.64)id='tank';else if(n>=7&&r<.77)id='bomber';else if(r<(sea('hunt')?.94:.88))id='scout';
    if(first[n]&&id===first[n]&&plan.includes(id))id='basic';
    if(n<6&&plan.filter(x=>x==='scout').length>=(n<5?1:2))id='basic';
    if(n<10&&id==='bomber'&&plan.includes(id))id='basic';
    if(!add(id))add('basic');
  }
  // Na estreia de cada arquétipo novo, mostre exatamente uma unidade dele.
  // Isso deixa o jogador aprender seu comportamento antes das combinações de frota.
  if(first[n]){
    let kept=false;
    for(let i=0;i<plan.length;i++)if(plan[i]===first[n]){if(!kept)kept=true;else plan[i]='basic';}
  }
  return plan;
}
function prepareCampaignWave(n){
  campaign.mods=endlessModifiers(n);campaign.events=voyage.event?[voyage.event]:[];
  if(n>=51){
    if(!campaign.events.length)campaign.events=[['hunt','armada','dead','storm','fog','treasure','vortex','laststand','rival','silence'][Math.floor((n-51)/2)%10]];
    if(hasModifier('squalls')||n>=71){const pool=['storm','fog','hunt','armada','dead','treasure','vortex','laststand','rival'].filter(id=>id!==campaign.events[0]&&id!=='silence');campaign.events.push(pool[(Math.floor((n-51)/5)+1)%pool.length]);}
    voyage.event=campaign.events[0];
  }
  for(const ev of campaign.events)if(ev)setMetaFlag(`reiSeenEvent:${ev}`);
  campaign.waveTime=0;campaign.eventPulse=activeSea('storm')?.65:activeSea('dead')?1.4:activeSea('silence')?2.2:3;campaign.eventCount=0;campaign.lastStandGiven=false;
  campaign.giantVortex=activeSea('vortex')?{kind:'vortex',x:(n%2?W*.68:W*.32),y:H*.52,r:150,pull:72,hitClock:.8,phase:Math.random()*Math.PI*2}:null;
  campaign.interlude=n===35;campaign.guardianKills=0;campaign.bossDeath=null;
  campaign.fog=createFogBanks();driftFogBanks(0);
  if(n===35)notifyVoyage('35 • O PORTÃO DOS AFOGADOS','Destrua os três guardiões e a frota fantasma para atravessar o véu.','#b1e8c6',7);
  const region=n<15?0:n<30?1:n<40?2:3;
  if(region!==campaign.lastRegion){
    campaign.lastRegion=region;
    if(n>1&&!isBossWave(n))notifyVoyage(['ÁGUAS DA COSTA','MAR ABERTO','CÉU PARTIDO','O LIMIAR DOS MORTOS'][region],['','A marinha perdeu o controle. Frotas mais preparadas esperam por você.','O horizonte desaparece sob nuvens de pólvora.','As velas dos que afundaram voltaram ao horizonte.'][region],'#b5d7d5',5);
  }
  if(n===42)notifyVoyage('42 • O ÚLTIMO BLOQUEIO','A capitânia dispara bombardeios em linha. Rompa a escolta e afunde o navio de comando.','#f0d394',8);
  if(n===49)notifyVoyage('A ÚLTIMA TRAVESSIA','Além desta onda, todos os piratas que perderam o mar esperam por você.','#bbddc3',7);
  if(n===100)notifyVoyage('100 • MARCO DE PRESTÍGIO','Poucas bandeiras chegam tão longe. As frotas avançadas agora aparecem com maior variedade.','#f4d68c',7);
  if(n>=51&&(n-51)%5===0)notifyVoyage(`INFINITO • MARÉ ${1+Math.floor((n-51)/5)}`,campaign.mods.map(id=>{const m=ENDLESS_MODS.find(m=>m.id===id);return `${m.name}: ${m.desc}`;}).join(' '),'#dfbcff',6+campaign.mods.length);
}
function makeCampaignEnemy(role,x,y){
  const spec=combatSpec(role),d=difficulty(),isGhost=role==='ghost'||role==='warden';
  let hp=(spec?.hp||1)+(role==='tank'?d.hp*1.65:d.hp)+(wave>50?d.endlessHp:0);
  if(role==='scout')hp=1+d.hp*.65+d.endlessHp*.7;
  if(role==='hunter')hp=2+d.hp*.58+d.endlessHp*.65;
  if(role==='blocker')hp=5+d.hp*1.45+d.endlessHp*1.15;
  if(role==='support'||role==='miner')hp=(spec?.hp||3)+d.hp*.82+d.endlessHp*.85;
  if(role==='sniper')hp=2+d.hp*.68+d.endlessHp*.75;
  if(role==='warden')hp=11;
  if(role==='flagship')hp=30;
  const e={x,y,vx:0,vy:0,r:spec?.r||31,hp,max:hp,type:role==='basic'?'small':role,role,
    variant:isGhost?'boss-ghost':role==='basic'?(Math.random()<.5?'white':'white2'):role,
    phase:Math.random()*Math.PI*2,sinking:0,cannonAngle:0,shot:1.3+Math.random()*1.4,burn:null,destroyed:false,age:0,attack:null,
    volley:0,ramPhase:'approach',ramTime:1.7+Math.random(),strafe:Math.random()<.5?-1:1,spectral:isGhost,spawnShield:0,hitFlash:0,facingAngle:Math.PI/2,impactJolt:0,mineClock:2.2+Math.random()*1.5};
  if(isGhost&&!bossFight){
    const index=voyage.spawned;
    if(role==='warden'){const idx=voyage.plan.slice(0,index).filter(r=>r==='warden').length-1;e.x=[W*.22,W*.5,W*.78][Math.max(0,idx)%3];e.y=H*.29;}
    else{e.x=clamp(x,110,W-110);e.y=clamp(y,150,H-90);}
    if(Math.hypot(e.x-player.x,e.y-player.y)<170)e.x=player.x<W/2?W-170:170;
    e.spawnShield=1.3;e.shot=2.5;
  }
  return e;
}
function fogDensity(x,y){
  if(!activeSea('fog')||bossFight)return 0;
  let density=0;
  for(const f of campaign.fog){const d=((x-f.x)/f.rx)**2+((y-f.y)/f.ry)**2;if(d<1)density=Math.max(density,Math.min(1,(1-d)*2));}
  return density;
}
function projectileVisibility(s){const d=fogDensity(s.x,s.y);let a=1-d*.93;if(player&&Math.hypot(s.x-player.x,s.y-player.y)<92)a=Math.max(.72,a);return a;}
function campaignBullet(e,angle,speed,damage){
  if(enemyShots.length>=180)return;
  const gun=e.spectral?{x:e.x,y:e.y+32,length:40}:{x:e.x+13,y:e.y+30,length:31};
  const sx=gun.x+Math.cos(angle)*gun.length,sy=gun.y+Math.sin(angle)*gun.length;
  enemyShots.push({x:sx,y:sy,prevX:sx,prevY:sy,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:4.8,damage,owner:e,spectral:e.spectral,bossKind:e.spectral?'ghostKing':undefined});
  burst(sx,sy,'boom',4);sfx('shoot',.30,120);
}
function releasePendingEnemyAttack(e){
  if(!e?.attack||e.isBoss)return false;
  const cfg=difficulty();
  if(e.role==='flagship'){
    const axis=e.attack.axis||'x',pos=e.attack.lane||(axis==='x'?clamp(player.y,145,H-65):clamp(player.x,80,W-80));
    addCampaignHazard('barrage',axis==='x'?W/2:pos,axis==='x'?pos:H/2,27,1.05,cfg.damage,e,{axis});
    e.volley=(e.volley||0)+1;
    sfx('barrage-launch',.5,100);
  }else if(e.role==='bomber'){
    const tx=clamp(player.x+player.vx*.16,85,W-85),ty=clamp(player.y+player.vy*.16,120,H-65);
    addCampaignHazard('mortar',tx,ty,60,1.25,cfg.damage+5,e);
    if(hasModifier('twins'))addCampaignHazard('mortar',clamp(tx+120,85,W-85),clamp(ty+24,120,H-65),55,1.65,cfg.damage+5,e);
  }else{
    const offsets=e.role==='tank'?[-.14,.14]:e.role==='ghost'?[-.16,.16]:e.role==='warden'?[-.48,-.24,0,.24,.48]:e.role==='support'?[-.08,.08]:hasModifier('crossfire')?[-.1,.1]:[0];
    const speedMult=e.role==='sniper'?1.48:e.role==='tank'?.83:e.role==='hunter'?1.12:1;
    const bonus=e.role==='sniper'?5:e.role==='tank'?2:e.role==='support'?-2:0;
    for(const off of offsets)campaignBullet(e,e.attack.angle+off,cfg.bullet*speedMult,Math.max(5,cfg.damage+bonus));
  }
  e.attack=null;
  return true;
}
function supportBoosted(e){return e.role!=='support'&&enemies.some(s=>s.role==='support'&&enemyIsAlive(s)&&Math.hypot(s.x-e.x,s.y-e.y)<190);}
function advanceCampaignEnemy(e,dt){
  if(!e.role)return false;if(e.tutorial){e.vx=e.vy=0;return true;}
  e.age+=dt;e.hitFlash=Math.max(0,(e.hitFlash||0)-dt);
  if(e.spawnShield>0){e.spawnShield-=dt;e.vx=e.vy=0;return true;}
  const cfg=difficulty(),dx=player.x-e.x,dy=player.y-e.y,dist=Math.hypot(dx,dy)||1,a=Math.atan2(dy,dx);
  let speed=(combatSpec(e.role)?.speed||62)+cfg.speed;if(supportBoosted(e))speed*=1.12;if(e.lastStand)speed*=1.24;
  if(e.role==='tank'){const delta=Math.atan2(Math.sin(a-e.facingAngle),Math.cos(a-e.facingAngle));e.facingAngle+=clamp(delta,-dt*.68,dt*.68);}
  if(e.role==='scout'){speed+=12;if(hasModifier('pursuit'))speed*=1.13;}
  let tx=Math.cos(a)*speed,ty=Math.sin(a)*speed;
  const inside=e.x>40&&e.x<W-40&&e.y>100&&e.y<H-50;
  if(e.role==='scout'&&inside&&dist<270){const radial=dist<130?-.25:.35;tx=(Math.cos(a)*radial-Math.sin(a)*e.strafe)*speed;ty=(Math.sin(a)*radial+Math.cos(a)*e.strafe)*speed;}
  if((e.role==='bomber'||e.role==='ghost')&&inside){const radial=dist<235?-.6:dist>410?.85:.08;tx=(Math.cos(a)*radial-Math.sin(a)*e.strafe*.28)*speed;ty=(Math.sin(a)*radial+Math.cos(a)*e.strafe*.28)*speed;}
  if(e.role==='support'&&inside){const radial=dist<250?-.55:dist>370?.62:.04;tx=(Math.cos(a)*radial-Math.sin(a)*e.strafe*.32)*speed;ty=(Math.sin(a)*radial+Math.cos(a)*e.strafe*.32)*speed;}
  if(e.role==='sniper'&&inside){const radial=dist<430?-.95:dist>620?.72:.02;tx=(Math.cos(a)*radial-Math.sin(a)*e.strafe*.20)*speed;ty=(Math.sin(a)*radial+Math.cos(a)*e.strafe*.20)*speed;}
  if(e.role==='miner'&&inside){const radial=dist<235?-.48:dist>390?.55:.05;tx=(Math.cos(a)*radial-Math.sin(a)*e.strafe*.42)*speed;ty=(Math.sin(a)*radial+Math.cos(a)*e.strafe*.42)*speed;e.mineClock-=dt;if(e.mineClock<=0&&voyage.waveGrace<=0){addCampaignHazard('mine',e.x,e.y+32,30,.70,cfg.damage+6,e,{duration:8});e.mineClock=3.8+Math.random()*1.4;}}
  if(e.role==='hunter'){speed*=1.08;tx=Math.cos(a)*speed;ty=Math.sin(a)*speed;}
  if(e.role==='blocker'&&inside){const radial=dist<105?.08:1;tx=Math.cos(a)*speed*radial;ty=Math.sin(a)*speed*radial;if(dist<118&&dist>1){player.x=clamp(player.x+dx/dist*dt*44,55,W-55);player.y=clamp(player.y+dy/dist*dt*44,95,H-55);}}
  if(e.role==='tank'&&inside){
    if(activeSea('armada')){const escort=enemies.find(b=>b.role==='bomber'&&enemyIsAlive(b));if(escort){const aa=Math.atan2(player.y-escort.y,player.x-escort.x),gx=escort.x+Math.cos(aa)*100,gy=escort.y+Math.sin(aa)*100,ga=Math.atan2(gy-e.y,gx-e.x);tx=Math.cos(ga)*speed;ty=Math.sin(ga)*speed;}}
    else if(dist<200){tx*=.3;ty*=.3;}
  }
  if(e.role==='flagship'&&inside){tx*=.35;ty*=.35;}
  if(e.role==='warden'){tx=Math.sin(e.age*.7+e.phase)*18;ty=Math.cos(e.age*.5+e.phase)*12;}
  e.cannonAngle=a;e.rammingThisStep=false;
  if(e.role==='rammer'){
    e.ramTime-=dt;
    if(e.ramPhase==='approach'&&inside&&dist<480&&e.ramTime<=0){e.ramPhase='windup';e.ramTime=.88;e.ramAngle=a;}
    if(e.ramPhase==='windup'){tx=ty=0;if(e.ramTime>.28)e.ramAngle=Math.atan2(player.y+player.vy*.2-e.y,player.x+player.vx*.2-e.x);e.cannonAngle=e.ramAngle;if(e.ramTime<=0){e.ramPhase='charge';e.ramTime=.82;sfx('charge',.42,150);}}
    if(e.ramPhase==='charge'){e.rammingThisStep=true;e.vx=tx=Math.cos(e.ramAngle)*435;e.vy=ty=Math.sin(e.ramAngle)*435;e.cannonAngle=e.ramAngle;if(e.ramTime<=0||e.x<42||e.x>W-42||e.y<105||e.y>H-45){e.ramPhase='recover';e.ramTime=1.05;e.vx*=.15;e.vy*=.15;}}
    if(e.ramPhase==='recover'){tx=ty=0;if(e.ramTime<=0){e.ramPhase='approach';e.ramTime=2.5;}}
  }else{
    e.shot-=dt*(supportBoosted(e)?1.18:1)*(e.lastStand?1.55:1);
    if(e.shot<=0&&inside&&dist<860&&voyage.waveGrace<=0&&!e.attack&&!isSpectral()){
      e.attack={angle:a,time:e.role==='flagship'?1.05:e.role==='sniper'?1.05:e.role==='tank'?.75:e.role==='warden'?.9:.55};
      if(e.role==='flagship'){e.attack.axis=e.volley%2?'x':'y';e.attack.lane=e.attack.axis==='x'?clamp(player.y,145,H-65):clamp(player.x,80,W-80);}
      e.shot=({flagship:5.4,bomber:4.4,scout:3.65,tank:3.8,ghost:3.2,warden:3.8,support:4.6,sniper:5.1,miner:4.8,blocker:5.4,hunter:3.5}[e.role]||3.45)*cfg.rate+Math.random()*.45;
    }
    if(e.attack){
      e.attack.time-=dt;
      if(e.attack.time>.22&&!isSpectral()){const leadBase=e.role==='bomber'?(wave<15?.18:Math.min(.36,.18+(wave-15)*.005)):(wave<9?0:Math.min(.42,dist/cfg.bullet*.42));const lead=e.role==='bomber'?leadBase:leadBase;e.attack.angle=Math.atan2(player.y+player.vy*lead-e.y,player.x+player.vx*lead-e.x);}
      e.cannonAngle=e.attack.angle;if(e.role==='tank')tx=ty=0;
      if(e.attack.time<=0){
        if(e.role==='flagship'){
          const axis=e.attack.axis,pos=e.attack.lane;addCampaignHazard('barrage',axis==='x'?W/2:pos,axis==='x'?pos:H/2,27,1.05,cfg.damage,e,{axis});e.volley++;sfx('barrage-launch',.6,100);
        }else if(e.role==='bomber'){
          const lead=wave<15?.20:Math.min(.38,.20+(wave-15)*.005);const tx=isSpectral()?e.x+Math.cos(e.attack.angle)*360:player.x+player.vx*lead,ty=isSpectral()?e.y+Math.sin(e.attack.angle)*360:player.y+player.vy*lead;addCampaignHazard('mortar',clamp(tx,85,W-85),clamp(ty,120,H-65),60,1.25,cfg.damage+5,e);
          if(hasModifier('twins'))addCampaignHazard('mortar',clamp(player.x-player.vx*.8+130,85,W-85),clamp(player.y-player.vy*.8,120,H-65),55,1.65,cfg.damage+5,e);
        }else{
          const offsets=e.role==='tank'?[-.14,.14]:e.role==='ghost'?[-.16,.16]:e.role==='warden'?[-.48,-.24,0,.24,.48]:e.role==='support'?[-.08,.08]:hasModifier('crossfire')?[-.1,.1]:[0];
          const speedMult=e.role==='sniper'?1.48:e.role==='tank'?.83:e.role==='hunter'?1.12:1;
          const bonus=e.role==='sniper'?5:e.role==='tank'?2:e.role==='support'?-2:0;
          for(const off of offsets)campaignBullet(e,e.attack.angle+off,cfg.bullet*speedMult,Math.max(5,cfg.damage+bonus));
        }
        e.attack=null;
      }
    }
  }
  if(!['charge','windup'].includes(e.ramPhase))for(const other of enemies){if(other===e||!enemyIsAlive(other)||other.isBoss)continue;const ox=e.x-other.x,oy=e.y-other.y,od=Math.hypot(ox,oy),min=e.r+other.r+15;if(od>0&&od<min){tx+=ox/od*(1-od/min)*46;ty+=oy/od*(1-od/min)*46;}}
  const sm=Math.min(1,dt*2.6);e.vx+=(tx-e.vx)*sm;e.vy+=(ty-e.vy)*sm;
  const oldX=e.x,oldY=e.y;const curseSlowValue=window.ReiEndgame?.hasSpecialization?.('undead-curse')?.20:BUILD_BALANCE.drowned.slow;const cursedSlow=e.drownedUntil>buildRun.active?1-curseSlowValue:1;const slow=Math.min(cursedSlow,e.ectoSlow?1-BUILD_BALANCE.ecto.slow:1);e.x+=e.vx*dt*slow;e.y+=e.vy*dt*slow;
  if(inside){e.x=clamp(e.x,42,W-42);e.y=clamp(e.y,103,H-45);}
  const sx=e.x-oldX,sy=e.y-oldY,u=clamp(((player.x-oldX)*sx+(player.y-oldY)*sy)/(sx*sx+sy*sy||1),0,1);
  {const h=playerHitCenter();if(Math.hypot(h.x-oldX-sx*u,h.y-oldY-sy*u)<e.r*.65+h.r*.76)hitPlayer(e.rammingThisStep?23:e.role==='blocker'?Math.max(6,cfg.damage*.55):cfg.damage,e,'contact');}
  return true;
}
function addCampaignHazard(kind,x,y,r,delay,damage,source=null,extra={}){
  if(voyage.hazards.length>=9)return;
  if(kind==='mortar'&&voyage.hazards.filter(h=>h.kind===kind&&!h.hit).length>=4)return;
  if(kind==='mine'&&voyage.hazards.filter(h=>h.kind==='mine'&&!h.hit).length>=4)return;
  if(kind==='lightning'){
    const tide=voyage.hazards.find(h=>h.kind==='soulwall'&&Math.abs(h.y-player.y)<220);
    if(tide&&Math.abs(x-tide.gap)<tide.width/2+r)x=clamp(tide.gap+(x<tide.gap?-1:1)*(tide.width/2+r+32),85,W-85);
  }
  const h={kind,x,y,r,delay,damage,source:source?{x:source.x,y:source.y,owner:source}:null,spectral:source?.bossKind==='ghostKing',life:0,hit:false,seed:Math.random()*1000,tick:1,...extra};
  if(kind==='soulwall'){h.gap=clamp(x,140,W-140);h.width=extra.width||210;h.y=-50;h.speed=170;h.duration=5.4;}
  if(kind==='mine'){h.duration=extra.duration||8;h.armed=false;}
  if(kind==='barrage')h.points=barragePoints(h);
  voyage.hazards.push(h);return h;
}
function updateCampaign(dt){
  campaign.waveTime+=dt;campaign.damageFlash=Math.max(0,campaign.damageFlash-dt);
  driftFogBanks(campaign.waveTime);
  if(!bossFight&&!voyage.tutorial.active&&waveCompleteTimer<0){
    if(!(activeSea('silence')&&voyage.silentIntro>0))campaign.eventPulse-=dt;
    if(campaign.eventPulse<=0){
      const d=difficulty();campaign.eventCount++;
      if(activeSea('storm')||activeSea('silence')){
        addCampaignHazard('lightning',clamp(player.x+player.vx*.25,90,W-90),clamp(player.y+player.vy*.25,125,H-70),65,1.12,d.damage+2);
        if(wave>=30||activeSea('silence')){const x=clamp(player.x+(player.x<W/2?240:-240),90,W-90);addCampaignHazard('lightning',x,clamp(player.y-80,130,H-80),59,1.6,d.damage+2);}
      }
      if(activeSea('armada'))for(const e of enemies.filter(e=>enemyIsAlive(e)&&['tank','basic'].includes(e.role)).slice(0,4))e.shot=Math.min(e.shot,.2+Math.random()*.2);
      campaign.eventPulse=activeSea('storm')||activeSea('silence')?Math.max(2.45,3.4-wave*.02):activeSea('dead')?3.8:5.8;
    }
    if(activeSea('treasure')||activeSea('rival'))for(const c of chests.filter(c=>c.eventChest&&!c.collected)){c.x=clamp(c.x+Math.sin(t+c.phase)*dt*13,92,W-92);c.y=clamp(c.y+Math.cos(t*.7+c.phase)*dt*8,126,H-78);}
    if(activeSea('laststand')&&!campaign.lastStandGiven&&waveRemainingToSpawn<=0){
      const living=enemies.filter(enemyIsAlive);
      if(living.length===1){
        const e=living[0];
        campaign.lastStandGiven=true;e.lastStand=true;e.hp+=Math.max(3,e.max*.45);e.max=e.hp;e.hitFlash=.22;
        notifyVoyage('ÚLTIMO SOBREVIVENTE','O último navio entrou em frenesi: mais vida, mais velocidade e mais pressão.','#ff9b8d',4.8);
      }
    }
  }
  const gv=campaign.giantVortex;
  if(gv&&player&&state==='play'){
    gv.phase+=dt*1.85;gv.hitClock-=dt;
    const affect=(obj,strength=1)=>{
      const dx=gv.x-obj.x,dy=gv.y-obj.y,d=Math.hypot(dx,dy)||1;
      if(d>330)return;
      const q=1-d/330,force=gv.pull*q*q*strength;
      obj.x+=dx/d*force*dt;obj.y+=dy/d*force*dt;
      if('vx'in obj){const tangentX=-dy/d,tangentY=dx/d;obj.vx+=(dx/d*force*.34+tangentX*force*.18)*dt;obj.vy+=(dy/d*force*.34+tangentY*force*.18)*dt;}
    };
    affect(player,1);
    for(const e of enemies)if(enemyIsAlive(e)&&!e.isBoss)affect(e,.72);
    for(const sh of enemyShots)affect(sh,.28);
    for(const sh of shots)affect(sh,.16);
    const pd=Math.hypot(player.x-gv.x,player.y-gv.y);
    if(pd<58&&gv.hitClock<=0){gv.hitClock=.9;hitPlayer(Math.max(5,difficulty().damage*.42),gv,'area');shake=Math.max(shake,3);}
  }
  for(const h of voyage.hazards){
    h.life+=dt;
    if(h.kind==='soulwall'){
      if(h.life>=h.delay){h.y=-50+(h.life-h.delay)*h.speed;const ph=playerHitCenter(),hit=Math.abs(ph.y-h.y)<44&&Math.abs(ph.x-h.gap)>h.width/2-18;
        if(hit&&!h.hit){h.hit=true;hitPlayer(h.damage,h,'area');}}
      continue;
    }
    if(h.kind==='mine'){
      h.armed=h.life>=h.delay;
      if(h.armed&&!h.hit){const ph=playerHitCenter();if(Math.hypot(ph.x-h.x,ph.y-h.y)<h.r+ph.r*.62){h.hit=true;hitPlayer(h.damage,h,'area');sfx('explosion',.55,90);burst(h.x,h.y,'boom',18);ripples.push({x:h.x,y:h.y,life:0,max:1});}}
      continue;
    }
    if(h.kind==='vortex'&&h.life>h.delay&&h.life<h.delay+3.2){const ph=playerHitCenter(),dx=h.x-ph.x,dy=h.y-ph.y,d=Math.hypot(dx,dy)||1;if(d<190&&d>20){player.x=clamp(player.x+dx/d*24*dt,55,W-55);player.y=clamp(player.y+dy/d*24*dt,95,H-55);}if(d<h.r+ph.r*.68&&h.tick<=0){hitPlayer(h.damage,h,'area');h.tick=1;}h.tick=(h.tick??0)-dt;}
    if(h.life>=h.delay&&!h.hit){
      h.hit=true;
      const ph=playerHitCenter();if(h.kind==='barrage'){if(h.axis==='x'?Math.abs(ph.y-h.y)<h.r+ph.r*.68:Math.abs(ph.x-h.x)<h.r+ph.r*.68)hitPlayer(h.damage,h,'area');}
      else if(Math.hypot(ph.x-h.x,ph.y-h.y)<h.r+ph.r*.68)hitPlayer(h.damage,h,'area');
      if(h.kind==='barrage')impactBarrage(h);
      else if(h.kind==='lightning'){voyage.flash=.16;shake=Math.max(shake,4);sfx('thunder',.85,200);for(let i=0;i<22;i++)addParticle(h.x,h.y,i%3?'#d5f4ff':'#8bbcdb',1+Math.random()*3,.3+Math.random()*.6,(Math.random()-.5)*210,-Math.random()*180);}
      else if(h.kind==='soulburst')sfx('ghost',.5,150);else sfx('explosion',.38,130);
      if(!['barrage','vortex'].includes(h.kind)){burst(h.x,h.y,'splash',20);ripples.push({x:h.x,y:h.y,life:0,max:1});}
    }
  }
  voyage.hazards=voyage.hazards.filter(h=>h.life<h.delay+(h.kind==='soulwall'?5.4:h.kind==='vortex'?3.8:h.kind==='lightning'?.85:h.kind==='barrage'?1.18:h.kind==='mine'?(h.duration||8):.65));
}
function campaignEnemyDestroyed(e){
  recordKill(e);
  if(e.role==='warden')campaign.guardianKills++;
  if(e.role==='flagship'){for(const dx of [-70,0,70])spawnChest(e.x+dx,e.y+30);notifyVoyage('BLOQUEIO ROMPIDO','A capitânia afundou. Recolha a carga e termine de dispersar a escolta.','#f4d297',6);}
  if(e.spectral&&hasModifier('revenants')&&!bossFight)addCampaignHazard('soulburst',e.x,e.y,65,1.35,difficulty().damage);
  if(e.cargo){spawnChest(e.x,e.y);chests[chests.length-1].eventChest=true;}
  for(let i=0;i<7;i++){addParticle(e.x,e.y,'#a47b4a',3+Math.random()*4,.7+Math.random()*.4,(Math.random()-.5)*140,-30-Math.random()*95);const p=particles[particles.length-1];if(p){p.wood=true;p.spin=Math.random()*6;}}
}
function campaignDamageMultiplier(e){let mult=activeSea('armada')&&e.role==='bomber'&&enemies.some(t=>t.role==='tank'&&enemyIsAlive(t)&&Math.hypot(t.x-e.x,t.y-e.y)<165)?.65:1;if(supportBoosted(e))mult*=.82;if(e.role==='rammer'&&e.ramPhase==='recover')mult*=1.25;if(e.lastStand)mult*=.9;return mult;}
function campaignProjectileMultiplier(e,s){
  let mult=1;
  if(e.role==='tank'&&s){const speed=Math.hypot(s.vx||0,s.vy||0)||1,ix=-(s.vx||0)/speed,iy=-(s.vy||0)/speed,fx=Math.cos(e.facingAngle||0),fy=Math.sin(e.facingAngle||0),front=ix*fx+iy*fy;if(front>.48){mult*=.58;e.armorFlash=.16;sfx('hit',.24,80);}}
  return mult;
}
function campaignOcean(){
  if(!player||['menu','shop','collection','guide'].includes(state))return;
  ctx.save();const region=wave<15?0:wave<30?1:wave<40?2:3;
  ctx.fillStyle=['rgba(0,0,0,0)','rgba(13,30,57,.12)','rgba(23,29,46,.24)','rgba(12,53,39,.28)'][region];ctx.fillRect(0,0,W,H);
  if((activeSea('storm')||activeSea('silence'))&&!bossFight){ctx.fillStyle=activeSea('silence')?'rgba(8,14,27,.28)':'#0a132c55';ctx.fillRect(0,0,W,H);if(!activeSea('silence')||campaign.waveTime>voyage.silentIntro*.45){ctx.strokeStyle=activeSea('silence')?'rgba(216,233,247,.20)':'#cee6f35e';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<135;i++){const x=(i*137+t*210)%(W+80)-40,y=(i*83+t*490)%H;ctx.moveTo(x,y);ctx.lineTo(x-12,y+29);}ctx.stroke();}}
  if(activeSea('dead')||bossFight?.kind==='ghostKing'){
    ctx.fillStyle='#13553d47';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#88cea24d';ctx.lineWidth=2;
    for(let i=0;i<14;i++){const x=(i*149+t*15)%W,y=120+(i*97)%570;ctx.beginPath();ctx.ellipse(x,y,40+Math.sin(t+i)*18,7,Math.sin(t*.1+i)*.2,0,Math.PI*2);ctx.stroke();}
  }
  if(activeSea('hunt')){ctx.strokeStyle='#f5b67855';ctx.setLineDash([10,18]);ctx.strokeRect(20,95,W-40,H-115);ctx.setLineDash([]);ctx.strokeStyle='#9fe8f266';ctx.lineWidth=2;for(const side of [90,W-90]){ctx.beginPath();ctx.moveTo(side,125);ctx.lineTo(W/2,H/2+40);ctx.lineTo(side,H-40);ctx.stroke();}ctx.font='10px monospace';ctx.fillStyle='#bdeef3';ctx.fillText('FLANCOS HOSTIS',W/2,122);}
  if(activeSea('armada')){ctx.save();ctx.strokeStyle='#f5d9aa38';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(W*.18,140);ctx.lineTo(W*.5,98);ctx.lineTo(W*.82,140);ctx.stroke();ctx.beginPath();ctx.moveTo(W*.25,182);ctx.lineTo(W*.5,144);ctx.lineTo(W*.75,182);ctx.stroke();ctx.restore();}
  if(activeSea('treasure')||activeSea('rival'))for(const c of chests.filter(c=>c.eventChest&&!c.collected)){const g=ctx.createRadialGradient(c.x,c.y,2,c.x,c.y,60);g.addColorStop(0,'#efc76d44');g.addColorStop(1,'#efc76d00');ctx.fillStyle=g;ctx.fillRect(c.x-60,c.y-60,120,120);ctx.strokeStyle='#f8d890aa';ctx.beginPath();ctx.ellipse(c.x,c.y,25+Math.sin(t*2)*4,9,0,0,Math.PI*2);ctx.stroke();}
  if(campaign.giantVortex){
    const v=campaign.giantVortex;ctx.save();ctx.translate(v.x,v.y);const spin=t*1.55+v.phase;
    const bed=ctx.createRadialGradient(0,0,10,0,0,v.r*1.18);bed.addColorStop(0,'rgba(2,16,24,.92)');bed.addColorStop(.22,'rgba(12,48,63,.72)');bed.addColorStop(.62,'rgba(46,111,124,.28)');bed.addColorStop(1,'rgba(98,178,180,0)');ctx.fillStyle=bed;ctx.beginPath();ctx.ellipse(0,0,v.r*1.18,v.r*.78,0,0,Math.PI*2);ctx.fill();
    for(let arm=0;arm<7;arm++){
      ctx.beginPath();
      for(let j=0;j<=42;j++){const q=j/42,r=18+q*v.r,a=spin+arm*Math.PI*2/7-q*3.6+Math.sin(t*1.4+arm)*.08;const xx=Math.cos(a)*r,yy=Math.sin(a)*r*.70;j?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}
      ctx.strokeStyle=arm%2?'rgba(166,238,232,.62)':'rgba(83,173,185,.72)';ctx.lineWidth=arm%2?2:3;ctx.stroke();
    }
    for(let ring=0;ring<4;ring++){const rr=42+ring*28+Math.sin(t*2+ring)*4;ctx.globalAlpha=.26+.08*ring;ctx.strokeStyle=ring%2?'#b8f2e8':'#70c8d1';ctx.lineWidth=1.5;ctx.setLineDash([10+ring*2,8]);ctx.lineDashOffset=-t*(28+ring*9);ctx.beginPath();ctx.ellipse(0,0,rr,rr*.70,0,0,Math.PI*2);ctx.stroke();}
    ctx.setLineDash([]);ctx.globalAlpha=.86;ctx.fillStyle='#02151e';ctx.beginPath();ctx.ellipse(0,0,23+Math.sin(t*3)*2,15+Math.sin(t*2.4)*1.5,0,0,Math.PI*2);ctx.fill();
    for(let i=0;i<30;i++){const q=(i/30+t*.13)%1,r=v.r*(1-q),a=spin+i*2.399+q*4.8;ctx.globalAlpha=Math.sin(q*Math.PI)*.72;ctx.fillStyle=i%6===0?'#dffbf3':'#9bd9d6';ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r*.7,1.3+(i%4)*.45,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  ctx.restore();
}
function campaignFog(){paintFogBanks();}

function drawLightning(h){
  const age=h.life-h.delay;if(age<0||age>.8)return;
  const phase=Math.floor(age*28),flicker=age<.16?1:age<.45?(phase%3===0?.9:.25):Math.max(0,(.8-age)*1.5);
  const top=Math.min(-30,h.y-430),progress=Math.min(1,age/.075),points=[];
  for(let i=0;i<=12;i++){const q=i/12,j=i===0||i===12?0:Math.sin(i*19.17+h.seed+phase*.75)*(16+14*Math.sin(q*3));points.push({x:h.x+j,y:top+(h.y-top)*q});}
  ctx.save();ctx.globalAlpha=flicker;
  for(const [width,color]of [[11,'#8bbbff44'],[4,'#b7e7ff'],[1.6,'#ffffff']]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach((p,i)=>{if(i/12>progress)return;i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();}
  ctx.lineWidth=1.5;ctx.strokeStyle='#d6f0ff';for(let i=3;i<10;i+=3){const p=points[i],side=i%2?1:-1;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+side*31,p.y+15);ctx.lineTo(p.x+side*46,p.y+58);ctx.stroke();}
  ctx.globalAlpha=flicker*.45;ctx.fillStyle='#e1f5ff';ctx.beginPath();ctx.ellipse(h.x,h.y,20+age*85,7+age*23,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
function campaignSignals(){
  ctx.save();
  for(const e of enemies){
    if(!enemyIsAlive(e))continue;
    if(e.spawnShield>0||e.spectral){ctx.strokeStyle='#b1f5cda8';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y+45,e.r+15+Math.sin(t*6)*4,12,0,t*1.5,t*1.5+Math.PI*1.65);ctx.stroke();}
    if(activeSea('armada')&&e.role==='bomber'){const tank=enemies.find(b=>b.role==='tank'&&enemyIsAlive(b)&&Math.hypot(b.x-e.x,b.y-e.y)<165);if(tank){ctx.strokeStyle='#f5d08665';ctx.setLineDash([5,8]);ctx.beginPath();ctx.moveTo(e.x,e.y+25);ctx.lineTo(tank.x,tank.y+25);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.ellipse(e.x,e.y+18,56,60,0,0,Math.PI*2);ctx.stroke();}}
    if(e.role==='support'){ctx.save();ctx.strokeStyle='#9be5ff';ctx.globalAlpha=.34+.12*Math.sin(t*4+e.phase);ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(e.x,e.y+28,86,25,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([4,7]);ctx.globalAlpha=.22;ctx.beginPath();ctx.ellipse(e.x,e.y+28,178,48,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillStyle='#d5f7ff';ctx.globalAlpha=.9;ctx.fillText('AURA DE SUPORTE',e.x,e.y-116);ctx.restore();}
    if(supportBoosted(e)){ctx.save();const pulse=.42+.18*Math.sin(t*6+e.phase);ctx.strokeStyle='#8eeaff';ctx.fillStyle='#8eeaff';ctx.globalAlpha=pulse;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y+34,e.r+12,12,0,0,Math.PI*2);ctx.stroke();for(const dx of [-14,0,14]){ctx.beginPath();ctx.moveTo(e.x+dx,e.y-102);ctx.lineTo(e.x+dx,e.y-86);ctx.lineTo(e.x+dx+5,e.y-92);ctx.moveTo(e.x+dx,e.y-86);ctx.lineTo(e.x+dx-5,e.y-92);ctx.stroke();}ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText('BUFF +12% / +18%',e.x,e.y-114);ctx.restore();}
    if(e.role==='tank'){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.facingAngle||0);ctx.strokeStyle=e.armorFlash>0?'#fff1b6':'#b7c9d5';ctx.globalAlpha=e.armorFlash>0?.9:.42;ctx.lineWidth=e.armorFlash>0?3:1.5;ctx.beginPath();ctx.arc(0,0,e.r+12,-.7,.7);ctx.stroke();ctx.restore();e.armorFlash=Math.max(0,(e.armorFlash||0)-1/60);}
    if(e.lastStand){ctx.save();ctx.strokeStyle='#ffb09f';ctx.fillStyle='#ffd7b1';ctx.globalAlpha=.72+.12*Math.sin(t*7+e.phase);ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y+36,e.r+20,16,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([6,8]);ctx.beginPath();ctx.ellipse(e.x,e.y+36,e.r+30,23,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText('ÚLTIMO SOBREVIVENTE',e.x,e.y-114);ctx.restore();}
    if(e.role==='rammer'&&e.ramPhase==='recover'){ctx.save();ctx.strokeStyle='#ffd19a';ctx.globalAlpha=.7;ctx.setLineDash([5,7]);ctx.beginPath();ctx.ellipse(e.x,e.y+32,e.r+14,12,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
    if(e.role==='flagship'){ctx.save();ctx.strokeStyle='#f5d78e';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y+65,65,15,0,0,Math.PI*2);ctx.stroke();ctx.font='10px monospace';ctx.textAlign='center';ctx.fillStyle='#f5d78e';ctx.fillText('CAPITÂNIA',e.x,e.y-126);ctx.restore();if(e.attack){const a=e.attack;drawBarrageWarning({axis:a.axis,x:a.axis==='x'?W/2:a.lane,y:a.axis==='x'?a.lane:H/2,r:27},1-a.time/1.05);}}
    if(e.attack&&!['bomber','flagship'].includes(e.role)){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.attack.angle);ctx.strokeStyle=e.spectral?'#a8eed2ab':'#ffd89c99';ctx.lineWidth=1.5;ctx.setLineDash([8,10]);ctx.beginPath();ctx.moveTo(42,0);ctx.lineTo(230,0);ctx.stroke();ctx.restore();}
    if(e.ramPhase==='windup'){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.ramAngle);ctx.fillStyle='#ff8e722c';ctx.fillRect(0,-29,350,58);ctx.strokeStyle='#ffc0a6';ctx.setLineDash([10,8]);ctx.strokeRect(0,-29,350,58);ctx.setLineDash([]);for(let i=80;i<330;i+=65){ctx.beginPath();ctx.moveTo(i-12,-9);ctx.lineTo(i,0);ctx.lineTo(i-12,9);ctx.stroke();}ctx.restore();}
  }
  for(const h of voyage.hazards){
    const p=clamp(h.life/h.delay,0,1),hit=h.life>=h.delay,col=h.kind==='lightning'?'#bce7ff':['soulwall','soulburst'].includes(h.kind)?'#b3f7cb':h.kind==='vortex'?'#d49ef1':h.kind==='mine'?'#ff9b62':'#ffcb7c';
    ctx.save();ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=2;
    if(h.kind==='mine'){
      const armed=h.life>=h.delay,blink=.45+.4*Math.max(0,Math.sin(t*(armed?9:5)+h.seed));ctx.globalAlpha=armed?blink:.42;ctx.fillStyle='#271914';ctx.beginPath();ctx.arc(h.x,h.y,11,0,Math.PI*2);ctx.fill();ctx.strokeStyle=armed?'#ff8d5c':'#e0b27e';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(h.x-4,h.y-9);ctx.lineTo(h.x,h.y-16);ctx.lineTo(h.x+4,h.y-10);ctx.stroke();ctx.globalAlpha=.22;ctx.beginPath();ctx.arc(h.x,h.y,h.r+5,0,Math.PI*2);ctx.stroke();ctx.restore();continue;
    }
    if(h.kind==='soulwall'){
      const y=hit?h.y:105, stage=bossFight?.stage||1;
      if(!hit){
        ctx.globalAlpha=.075;ctx.fillRect(h.gap-h.width/2,100,h.width,H-100);
        ctx.globalAlpha=.78;ctx.setLineDash([8,10]);ctx.strokeRect(h.gap-h.width/2,100,h.width,H-100);ctx.setLineDash([]);
        ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillStyle='#d7ffe5';ctx.fillText('PASSAGEM',h.gap,140);
      }
      for(const [x,w]of [[0,h.gap-h.width/2],[h.gap+h.width/2,W-h.gap-h.width/2]]){
        if(w<=0)continue;
        const waveH=hit?62+stage*7:42;
        const grad=ctx.createLinearGradient(0,y-waveH,0,y+waveH);
        grad.addColorStop(0,'rgba(132,239,184,0)');grad.addColorStop(.32,`rgba(44,148,107,${hit?.32:.10})`);grad.addColorStop(.58,`rgba(18,75,66,${hit?.44:.13})`);grad.addColorStop(1,'rgba(8,35,38,0)');
        ctx.globalAlpha=1;ctx.fillStyle=grad;ctx.fillRect(x,y-waveH,w,waveH*2);
        // several crests form a possessed wall instead of one flat sine line
        for(let band=0;band<3;band++){
          ctx.globalAlpha=hit?(.84-band*.18):(.40-band*.10);ctx.strokeStyle=band===0?'#c6ffe0':band===1?'#75ddb0':'#397f72';ctx.lineWidth=band===0?3:1.5;
          ctx.beginPath();
          for(let xx=x;xx<=x+w;xx+=14){const yy=y-band*11+Math.sin(xx*.032-t*(9.5-band)+band*1.7)*(8+band*3)+Math.sin(xx*.009+t*2.2)*4;xx===x?ctx.moveTo(xx,yy):ctx.lineTo(xx,yy);}ctx.stroke();
        }
        if(hit){
          // foam, spray and subtle ghost eyes contained inside the dangerous wall
          ctx.fillStyle='#d9ffeb';ctx.globalAlpha=.48;
          for(let i=0;i<Math.min(28,Math.ceil(w/34));i++){const xx=x+((i*47+t*74)%(Math.max(1,w))),yy=y-20+Math.sin(i*2.7+t*5)*25,rr=1.5+(i%3);ctx.beginPath();ctx.arc(xx,yy,rr,0,Math.PI*2);ctx.fill();}
          ctx.globalAlpha=.17;ctx.fillStyle='#d5ffe9';
          for(let i=0;i<Math.min(7,Math.ceil(w/130));i++){const xx=x+54+i*128+Math.sin(t+i)*9,yy=y-7+Math.sin(t*.8+i*2)*15;ctx.beginPath();ctx.ellipse(xx-5,yy,2.4,4,0,0,Math.PI*2);ctx.ellipse(xx+5,yy,2.4,4,0,0,Math.PI*2);ctx.fill();}
        }
      }
    }else if(h.kind==='barrage'){
      drawNavalBarrage(h);
    }else{
      ctx.globalAlpha=hit?.1:.12;ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=hit?.4:.95;ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,Math.PI*2);ctx.stroke();ctx.lineWidth=3;ctx.beginPath();ctx.arc(h.x,h.y,h.r+5,-Math.PI/2,-Math.PI/2+p*Math.PI*2);ctx.stroke();
      if(h.kind==='mortar'&&!hit){const src=h.source||{x:h.x,y:h.y-100};ctx.fillStyle='#101a24';ctx.beginPath();ctx.arc(lerp(src.x,h.x,p),lerp(src.y,h.y,p)-Math.sin(p*Math.PI)*120,7,0,Math.PI*2);ctx.fill();}
      if(h.kind==='vortex'){ctx.save();ctx.globalAlpha=.35;ctx.strokeStyle='#c49dd4';ctx.setLineDash([5,14]);ctx.lineDashOffset=-t*40;ctx.beginPath();ctx.arc(h.x,h.y,190,0,Math.PI*2);ctx.stroke();ctx.restore();ctx.globalAlpha=.95;ctx.strokeStyle='#dfb6f9';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,Math.PI*2);ctx.stroke();}
      if(h.kind==='soulburst'&&hit){ctx.globalAlpha=1-(h.life-h.delay)/.65;ctx.beginPath();ctx.arc(h.x,h.y,h.r*(1+(h.life-h.delay)),0,Math.PI*2);ctx.stroke();}
    }
    ctx.restore();if(h.kind==='lightning')drawLightning(h);
  }
  const tu=voyage.tutorial,target=tu.active?(tu.step<=2?tu.target:tu.step===3?chests.find(c=>c.tutorial&&!c.collected):null):null;
  if(target){ctx.strokeStyle='#ffe09a';ctx.setLineDash([7,6]);ctx.beginPath();ctx.arc(target.x,target.y,tu.step===3?42:68,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ffe09a';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText(tu.step===3?'RECOLHA':'ALVO DE TREINO',target.x,target.y-82);}
  const flashPref=window.ReiEndgame?.prefs?.flash??1;if(voyage.flash>0&&flashPref>0){ctx.fillStyle=`rgba(200,226,255,${voyage.flash*.48*flashPref})`;ctx.fillRect(0,0,W,H);}
  ctx.restore();
}
function campaignFeedback(){
  const flashPref=window.ReiEndgame?.prefs?.flash??1;
  if(campaign.damageFlash>0&&flashPref>0){ctx.save();const g=ctx.createRadialGradient(W/2,H/2,250,W/2,H/2,730);g.addColorStop(0,'#c8443000');g.addColorStop(1,`rgba(204,54,37,${campaign.damageFlash*1.8*flashPref})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.restore();}
}
