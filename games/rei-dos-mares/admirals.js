/* Boss patterns: visible preparation, committed aim, execution, recovery. */
function admiralConfig(kind){
  const base={
    marine:{name:'ALMIRANTE DA MARINHA',hp:62,speed:48,image:bossImages.marine,w:245,h:325,damage:16,gold:260},
    blackbeard:{name:'BARBA NEGRA',hp:118,speed:46,image:bossImages.blackbeard,w:250,h:300,damage:18,gold:360},
    ghostKing:{name:'O CAPITÃO DOS MORTOS',hp:390,speed:54,image:bossImages.ghostKing,w:270,h:330,damage:30,gold:650}
  }[kind];
  if(infiniteMode&&wave>=60){
    const cycle=Math.floor((wave-60)/30),hp={marine:170,blackbeard:195,ghostKing:225}[kind];
    return {...base,name:({marine:'ALMIRANTE DE FERRO',blackbeard:'BARBA NEGRA • ECO DO ABISMO',ghostKing:'O REI SEM TÚMULO'})[kind],hp:Math.round(hp*(1+Math.min(.8,cycle*.10))),damage:Math.min(24,18+cycle),gold:260+Math.min(180,cycle*30)};
  }
  return base;
}
function initAdmiral(kind,e){
  const endless=infiniteMode&&wave>=60, intro=kind==='ghostKing'&&!endless?5.5:3.1;
  const silence=kind==='ghostKing'&&!endless?2.2:0;
  if(silence)stopAllSfx();
  Object.assign(bossFight,{endless,silence,intro,introMax:intro,phase:0,stage:1,patternIndex:0,attack:null,attackClock:1.1,bursts:[],entranceSound:false,entranceFxClock:0,entranceRippleClock:0,entranceImpact:false,entranceImpact2:false,origin:{x:e.x,y:e.y},vortex:null,phaseBarrier:0,phaseBurstDone:false,barriersUsed:{2:false,3:false},rewardNew:!ownedSkins.has(secretForBoss(kind).id)});
  e.entrancePrevX=e.x;e.entrancePrevY=e.y;
  campaign.events=[];campaign.mods=[];voyage.notice=null;voyage.queue=[];
  e.shot=99;mouse.down=false;
  if(!silence)sfx('boss-entry',.7);
}
function admiralBullet(e,angle,speed,damage){
  if(enemyShots.length>=185)return;
  const x=e.x+Math.cos(angle)*76,y=e.y+Math.sin(angle)*76;
  enemyShots.push({x,y,prevX:x,prevY:y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:4.6,owner:e,boss:true,bossKind:e.bossKind,spectral:e.bossKind==='ghostKing',damage});
}
function fanSalvo(e,angle,count,spread,speed,damage){for(let i=0;i<count;i++)admiralBullet(e,angle+(i-(count-1)/2)*spread,speed,damage);sfx('shoot',.5,90);burst(e.x+Math.cos(angle)*75,e.y+Math.sin(angle)*75,'boom',10);}
function bossAim(e){
  const visible=!isSpectral(),angle=visible?Math.atan2(player.y-e.y,player.x-e.x):(e.cannonAngle||Math.PI/2);
  return{visible,angle,x:visible?player.x:clamp(e.x+Math.cos(angle)*360,100,W-100),y:visible?player.y:clamp(e.y+Math.sin(angle)*360,145,H-90)};
}
function beginAdmiralAttack(e){
  const bf=bossFight,stage=bf.stage,aim=bossAim(e);
  const sequences={marine:['salvo','barrage','broadside'],blackbeard:['broadside','vortex','boarding','salvo'],ghostKing:stage===1?['soulwall','sigils','spiral','doomcross','summon','barrage']:stage===2?['echoes','undertow','graveyard','sigils','doomcross','spiral','summon','soulwall']:['doomcross','echoes','graveyard','spiral','undertow','soulwall','echoes','sigils','doomcross','summon']};
  if(bf.endless)sequences[e.bossKind].splice(1,0,{marine:'crossing',blackbeard:'depthcharges',ghostKing:'undertow'}[e.bossKind]);
  const kind=sequences[e.bossKind][bf.patternIndex++%sequences[e.bossKind].length];
  const names={crossing:'BATERIAS CRUZADAS',depthcharges:'CARGAS DO ABISMO',undertow:'CORRENTE DOS CONDENADOS',echoes:'ECOS DOS AFUNDADOS',doomcross:'CRUZ DO NAUFRÁGIO',graveyard:'CEMITÉRIO SUBMERSO',salvo:'BATERIA DE PROA',barrage:e.bossKind==='marine'?'BOMBARDEIO EM LINHA':'MARÉ DOS CONDENADOS',broadside:'SALVA ABERTA',vortex:'O MAR VAI TE ENGOLIR',boarding:'ABORDAGEM PIRATA',soulwall:'MARÉ DOS MORTOS',sigils:'MARCAS DO NAUFRÁGIO',spiral:'COROA ESPECTRAL',summon:'OS MORTOS RESPONDEM'};
  const duration=['barrage','crossing','depthcharges','vortex','undertow','doomcross'].includes(kind)?1.25:kind==='graveyard'?1.35:kind==='soulwall'?1.18:kind==='echoes'?1.30:1.02;
  bf.attack={kind,name:names[kind],time:duration,duration,angle:aim.angle,targets:[],gap:clamp(aim.x+(Math.random()<.5?-160:160),180,W-180),aimVisible:aim.visible};
  if(kind==='barrage'){
    const horizontal=bf.patternIndex%2===0;bf.attack.axis=horizontal?'x':'y';
    bf.attack.lanes=horizontal?[H*.29,H*.68]:[W*.24,W*.75];
    if(stage>=2)bf.attack.lanes.push(horizontal?H*.48:W*.50);
    if(e.bossKind==='ghostKing'&&stage>=2)bf.attack.lanes.push(horizontal?H*.82:W*.87);
    if(e.bossKind==='ghostKing'&&stage===3)bf.attack.lanes.push(horizontal?H*.18:W*.13);
  }
  if(kind==='crossing')bf.attack.targets=[{x:clamp(aim.x,100,W-100),y:clamp(aim.y,150,H-90)}];
  if(kind==='doomcross')bf.attack.targets=[{x:clamp(aim.x+player.vx*.20,130,W-130),y:clamp(aim.y+player.vy*.20,155,H-100)}];
  if(kind==='graveyard')bf.attack.targets=[{x:clamp(aim.x,150,W-150),y:clamp(aim.y,170,H-120)}];

  if(kind==='depthcharges')for(const dx of [-175,0,175])bf.attack.targets.push({x:clamp(aim.x+dx,100,W-100),y:clamp(aim.y+(dx===0?0:-135),150,H-90)});
  if(kind==='sigils'||kind==='vortex'||kind==='echoes'){
    bf.attack.targets.push({x:clamp(aim.x,100,W-100),y:clamp(aim.y,135,H-90)});
    if(stage>=2)bf.attack.targets.push({x:aim.x<W/2?W*.7:W*.3,y:aim.y<H/2?H*.72:H*.28});
    if(e.bossKind==='ghostKing'&&stage===3&&kind==='sigils')bf.attack.targets.push({x:clamp(player.x+player.vx*.28,115,W-115),y:clamp(player.y+player.vy*.28,150,H-95)});
  }
}
function executeAdmiralAttack(e,attack){
  const bf=bossFight,stage=bf.stage,dmg=bf.cfg.damage;
  if(attack.kind==='salvo'){
    fanSalvo(e,attack.angle,3+2*(stage>=2),.13,305,dmg);
    bf.bursts.push({time:.38,angle:attack.angle+.11,count:3,spread:.13,speed:305,damage:dmg},{time:.76,angle:attack.angle-.11,count:3,spread:.13,speed:305,damage:dmg});
  }else if(attack.kind==='broadside'){
    fanSalvo(e,attack.angle,stage>=2?9:7,.15,275,dmg);
    bf.bursts.push({time:.55,angle:attack.angle+.08,count:stage>=2?8:6,spread:.17,speed:290,damage:dmg});
  }else if(attack.kind==='barrage'){
    for(const pos of attack.lanes)addCampaignHazard('barrage',attack.axis==='x'?W/2:pos,attack.axis==='x'?pos:H/2,27,.95,dmg,e,{axis:attack.axis});
    sfx('barrage-launch',.7,100);
  }else if(attack.kind==='crossing'){
    const point=attack.targets[0];
    addCampaignHazard('barrage',W/2,point.y,27,1.05,dmg,e,{axis:'x'});
    addCampaignHazard('barrage',point.x,H/2,27,1.4,dmg,e,{axis:'y'});sfx('barrage-launch',.7,100);
  }else if(attack.kind==='depthcharges'){
    attack.targets.forEach((point,i)=>addCampaignHazard('mortar',point.x,point.y,62,1.15+i*.18,dmg,e,{attackKind:"depthcharges"}));sfx('barrage-launch',.55,100);
  }else if(attack.kind==='doomcross'){
    const p=attack.targets[0];
    addCampaignHazard('barrage',W/2,p.y,30,.72,stage===3?31:26,e,{axis:'x'});
    addCampaignHazard('barrage',p.x,H/2,30,.95,stage===3?31:26,e,{axis:'y'});
    addCampaignHazard('soulburst',clamp(p.x-125,90,W-90),clamp(p.y+105,125,H-75),70,1.08,stage===3?24:20,e);
    addCampaignHazard('soulburst',clamp(p.x+125,90,W-90),clamp(p.y-105,125,H-75),70,1.18,stage===3?24:20,e);
    fanSalvo(e,attack.angle,stage===3?7:5,.15,315,dmg);
    if(stage===3)bf.bursts.push({time:.48,angle:attack.angle+Math.PI,count:5,spread:.18,speed:275,damage:22});
    sfx('ghost',.8,100);
  }else if(attack.kind==='graveyard'){
    const c=attack.targets[0],n=stage===3?7:6;
    for(let i=0;i<n;i++){const a=i*Math.PI*2/n+(bossFight.patternIndex*.37),rr=stage===3?150:138;addCampaignHazard('soulburst',clamp(c.x+Math.cos(a)*rr,85,W-85),clamp(c.y+Math.sin(a)*rr,120,H-70),stage===3?70:64,.70+i*.07,stage===3?23:19,e);}
    addCampaignHazard('vortex',c.x,c.y,stage===3?78:68,.84,stage===3?23:18,e);
    if(stage===3)bf.bursts.push({time:.62,angle:attack.angle,count:8,spread:.16,speed:290,damage:22});
    sfx('ghost',.85,100);
  }else if(attack.kind==='undertow'){
    addCampaignHazard('soulwall',attack.gap,0,30,stage===3?.74:.86,stage===3?30:24,e,{width:stage===3?155:190});
    if(stage>=2)addCampaignHazard('soulwall',clamp(attack.gap+(attack.gap<W/2?120:-120),150,W-150),0,30,stage===3?1.28:1.40,stage===3?28:22,e,{width:stage===3?150:180});
    addCampaignHazard('vortex',clamp(attack.gap+(attack.gap<W/2?275:-275),110,W-110),H*.58,stage===3?78:70,.78,stage===3?24:19,e);
    if(stage===3)addCampaignHazard('vortex',clamp(attack.gap+(attack.gap<W/2?-250:250),110,W-110),H*.40,66,1.12,21,e);sfx('ghost',.75,100);
  }else if(attack.kind==='echoes'){
    fanSalvo(e,attack.angle,stage===3?9:stage===2?7:5,.12,stage===3?340:320,dmg);
    bf.bursts.push({time:.42,angle:attack.angle+.16,count:stage===3?8:6,spread:.13,speed:315,damage:dmg},{time:.78,angle:attack.angle-.14,count:stage===3?7:5,spread:.14,speed:305,damage:dmg});
    attack.targets.forEach((point,i)=>{addCampaignHazard('vortex',point.x,point.y,stage===3?76:66,.72+i*.14,stage===3?20:17,e); if(stage===3)addCampaignHazard('soulburst',point.x,point.y,66,1.02+i*.10,20,e);});
    if(stage===3)spawnAdmiralMinions(e,3,'ghost');
    sfx('ghost',.8,100);
  }else if(attack.kind==='vortex'){
    for(const point of attack.targets)addCampaignHazard('vortex',point.x,point.y,64,.55,14,e);
    fanSalvo(e,attack.angle,5,.22,245,16);
  }else if(attack.kind==='boarding'){
    spawnAdmiralMinions(e,stage>=2?3:2,'pirate');
    fanSalvo(e,attack.angle,5,.22,260,16);
  }else if(attack.kind==='soulwall'){
    addCampaignHazard('soulwall',attack.gap,0,30,stage===3?.68:.84,stage===3?30:23,e,{width:stage===3?148:188});
    if(stage>=2)addCampaignHazard('soulwall',clamp(attack.gap+(attack.gap<W/2?95:-95),150,W-150),0,30,stage===3?1.12:1.26,stage===3?26:20,e,{width:stage===3?142:170});
    if(stage>=2)bf.bursts.push({time:1.0,angle:attack.angle,count:stage===3?7:5,spread:.17,speed:260,damage:20});
  }else if(attack.kind==='sigils'){
    for(const point of attack.targets)addCampaignHazard('soulburst',point.x,point.y,stage===3?78:72,stage===3?.62:.75,stage===3?24:19,e);
  }else if(attack.kind==='spiral'){
    const safe=attack.angle;
    for(let ring=0;ring<(stage===3?5:stage===2?4:2);ring++)for(let i=0;i<(stage===3?22:18);i++){
      const count=stage===3?22:18,a=i*Math.PI*2/count+ring*.088,delta=Math.atan2(Math.sin(a-safe),Math.cos(a-safe));
      if(Math.abs(delta)<(stage===3?.31:.36))continue;
      bf.bursts.push({time:ring*(stage===3?.30:.42),angle:a,silent:true,count:1,spread:0,speed:240+ring*24,damage:stage===3?24:19});
    }
  }else if(attack.kind==='summon')spawnAdmiralMinions(e,stage===3?5:stage>=2?3:2,'ghost');
  if(['sigils','spiral','soulwall','summon','echoes'].includes(attack.kind))sfx('ghost',.55,180);
}
function spawnAdmiralMinions(e,count,kind){
  const existing=enemies.filter(x=>!x.isBoss&&enemyIsAlive(x)).length;
  const max=kind==='ghost'?6:4;
  for(let i=0;i<Math.min(count,max-existing);i++){
    const a=Math.PI*2*(i/count)+bossFight.patternIndex,dist=185;
    let x=clamp(e.x+Math.cos(a)*dist,110,W-110),y=clamp(e.y+Math.sin(a)*dist,160,H-90);
    if(Math.hypot(x-player.x,y-player.y)<150){x=player.x<W/2?W-130-i*65:130+i*65;y=H*.24+i*95;}
    const minion=makeCampaignEnemy(kind==='ghost'?'ghost':'basic',x,y);
    minion.hp=minion.max=kind==='ghost'?(e.bossKind==='ghostKing'&&bossFight.stage===3?5:3):2;minion.variant=kind==='ghost'?'boss-ghost':'pirate';minion.spawnShield=1.25;minion.shot=2.4;minion.summoned=true;
    enemies.push(minion);
  }
}
function ghostBossDamageGate(e,damage){
  const bf=bossFight;if(!bf||e.bossKind!=='ghostKing'||bf.endless||bf.intro>0||bf.phaseBarrier>0)return null;
  const gates=[{stage:2,ratio:.70},{stage:3,ratio:.36}];
  for(const g of gates){
    if(bf.barriersUsed?.[g.stage])continue;
    const gate=e.max*g.ratio;
    if(e.hp>gate&&e.hp-damage<=gate){
      if(!bf.barriersUsed)bf.barriersUsed={2:false,3:false};bf.barriersUsed[g.stage]=true;
      e.hp=gate-.001; e.burn=null; bf.stage=g.stage; bf.phaseBarrier=g.stage===2?2.4:2.8; bf.phaseBurstDone=false; bf.attack=null; bf.bursts=[]; bf.attackClock=99;
      notifyVoyage(`FASE ${g.stage}`,g.stage===2?'As almas formam uma couraça espectral. Sobreviva ao contra-ataque.':'O Capitão dos Mortos rompe o último selo. O mar inteiro ataca.','#b9ffd2',3);
      sfx('ghost',.9,100);
      return true;
    }
  }
  return null;
}
function updateAdmiralEntranceFx(e,dt,p){
  const bf=bossFight;if(!bf)return;
  const px=Number.isFinite(e.entrancePrevX)?e.entrancePrevX:e.x,py=Number.isFinite(e.entrancePrevY)?e.entrancePrevY:e.y;
  const dx=e.x-px,dy=e.y-py,len=Math.hypot(dx,dy)||1,dirX=dx/len,dirY=dy/len;
  e.entrancePrevX=e.x;e.entrancePrevY=e.y;
  bf.entranceFxClock-=dt;bf.entranceRippleClock-=dt;
  const onscreen=e.x>-120&&e.x<W+120&&e.y>-130&&e.y<H+80;
  if(onscreen&&bf.entranceFxClock<=0){
    bf.entranceFxClock=.045;
    const back=72+(e.bossKind==='ghostKing'?24:0),bx=e.x-dirX*back+(Math.random()-.5)*44,by=e.y-dirY*back+58+(Math.random()-.5)*18;
    foam.push({x:bx,y:by,life:.85,max:.85,size:5+Math.random()*7});
    foam.push({x:bx+(Math.random()-.5)*34,y:by+(Math.random()-.5)*10,life:.65,max:.65,size:3+Math.random()*5});
    const col=e.bossKind==='ghostKing'?(Math.random()<.5?'#79e5bd':'#d8fff0'):(e.bossKind==='blackbeard'?'#83919b':'#dff8ff');
    for(let i=0;i<2;i++)addParticle(bx+(Math.random()-.5)*38,by,col,2+Math.random()*3,.45+Math.random()*.35,-dirX*(35+Math.random()*70)+(Math.random()-.5)*25,-dirY*(35+Math.random()*70)-25-Math.random()*35,.91);
  }
  if(onscreen&&bf.entranceRippleClock<=0){bf.entranceRippleClock=.22;ripples.push({x:e.x-dirX*55,y:e.y-dirY*35+62,life:0,max:1.05,boss:true});}
  if(!bf.entranceImpact&&p>.43&&onscreen){
    bf.entranceImpact=true;shake=Math.max(shake,e.bossKind==='ghostKing'?13:9);
    burst(e.x,e.y+70,'splash',e.bossKind==='ghostKing'?36:27);ripples.push({x:e.x,y:e.y+70,life:0,max:1.35,boss:true});
    sfx(e.bossKind==='ghostKing'?'ghost':'wave',e.bossKind==='ghostKing'?.72:.58,80);
  }
  if(!bf.entranceImpact2&&p>.78&&onscreen){
    bf.entranceImpact2=true;shake=Math.max(shake,e.bossKind==='ghostKing'?16:12);
    burst(e.x,e.y+78,'splash',e.bossKind==='ghostKing'?52:40);
    ripples.push({x:e.x,y:e.y+76,life:0,max:1.55,boss:true},{x:e.x,y:e.y+84,life:0,max:1.9,boss:true});
    for(let i=0;i<12;i++)foam.push({x:e.x+(Math.random()-.5)*150,y:e.y+72+(Math.random()-.5)*28,life:.7+Math.random()*.45,max:1.1,size:4+Math.random()*8});
    sfx(e.bossKind==='ghostKing'?'ghost':'boss-entry',e.bossKind==='ghostKing'?.92:.82,180);
  }
}
function advanceAdmiral(e,dt){
  const bf=bossFight;if(!bf||bf.defeated)return;
  e.impactJolt=Math.max(0,(e.impactJolt||0)-dt);
  if(bf.intro>0){
    bf.intro=Math.max(0,bf.intro-dt);const silent=bf.silence;
    const p=smooth(clamp((bf.introMax-bf.intro-silent)/(bf.introMax-silent),0,1));
    e.x=lerp(bf.origin.x,W*.5,p);e.y=lerp(bf.origin.y,H*.27,p);e.vx=e.vy=0;updateAdmiralEntranceFx(e,dt,p);
    if(silent&&!bf.entranceSound&&bf.intro<bf.introMax-silent){bf.entranceSound=true;sfx('boss-entry',.8);}
    return;
  }
  if(bf.phaseBarrier>0){
    bf.phaseBarrier=Math.max(0,bf.phaseBarrier-dt);e.vx*=Math.max(0,1-dt*3);e.vy*=Math.max(0,1-dt*3);
    if(!bf.phaseBurstDone&&bf.phaseBarrier<(bf.stage>=3?2.15:1.85)){
      bf.phaseBurstDone=true;const d=bf.cfg.damage,px=clamp(player.x+player.vx*.22,105,W-105),py=clamp(player.y+player.vy*.22,145,H-85);
      addCampaignHazard('soulburst',px,py,78,.55,d,e);
      addCampaignHazard('soulburst',clamp(px-165,90,W-90),clamp(py+95,120,H-70),68,.88,d-3,e);
      addCampaignHazard('soulburst',clamp(px+165,90,W-90),clamp(py-95,120,H-70),68,1.05,d-3,e);
      fanSalvo(e,e.cannonAngle||Math.PI/2,bf.stage>=3?9:7,.14,320,d);
    }
    if(bf.phaseBarrier<=0)bf.attackClock=.42;
    return;
  }
  bf.phase+=dt;
  const stage=e.bossKind==='ghostKing'?(e.hp/e.max<.36?3:e.hp/e.max<.70?2:1):(e.hp/e.max<.5?2:1);
  if(stage>bf.stage){bf.stage=stage;notifyVoyage(`FASE ${stage}`,e.bossKind==='marine'?'A frota fecha o bloqueio.':e.bossKind==='blackbeard'?'A escuridão avança sobre o convés.':'O oceano inteiro responde ao capitão.','#f3cc92',3);sfx('wave',.6);}
  const targetX=W*.5+Math.sin(bf.phase*(e.bossKind==='marine'?.43:.3))*260,targetY=H*.28+Math.sin(bf.phase*.56)*55;
  const a=Math.atan2(targetY-e.y,targetX-e.x),speed=bf.cfg.speed;
  e.vx+=(Math.cos(a)*speed-e.vx)*Math.min(1,dt*1.8);e.vy+=(Math.sin(a)*speed-e.vy)*Math.min(1,dt*1.8);
  const bossCurseSlow=e.drownedUntil>buildRun.active?1-(window.ReiEndgame?.hasSpecialization?.('undead-curse')?.20:BUILD_BALANCE.drowned.slow):1,ectoSlow=e.ectoSlow?1-BUILD_BALANCE.ecto.slow:1,slow=Math.min(bossCurseSlow,ectoSlow);e.x=clamp(e.x+e.vx*dt*slow,120,W-120);e.y=clamp(e.y+e.vy*dt*slow,145,H*.56);
  if(!isSpectral())e.cannonAngle=Math.atan2(player.y-e.y,player.x-e.x);
  for(const b of bf.bursts){b.time-=dt;if(b.time<=0&&!b.fired){b.fired=true;if(b.silent)admiralBullet(e,b.angle,b.speed,b.damage);else fanSalvo(e,b.angle,b.count,b.spread,b.speed,b.damage);}}
  bf.bursts=bf.bursts.filter(b=>!b.fired);
  if(bf.attack){
    bf.attack.time-=dt;
    if(bf.attack.time>.32&&!isSpectral())bf.attack.angle=Math.atan2(player.y+player.vy*.2-e.y,player.x+player.vx*.2-e.x);
    if(bf.attack.time<=0){executeAdmiralAttack(e,bf.attack);bf.attack=null;const baseClock=e.bossKind==='ghostKing'?(stage===3?1.25:stage===2?1.75:2.45):stage>=2?3.2:4.1;bf.attackClock=baseClock;}
  }else{
    bf.attackClock-=dt;
    if(bf.attackClock<=0&&voyage.hazards.length<(e.bossKind==='ghostKing'?8:6))beginAdmiralAttack(e);
  }
  if(Math.hypot(e.x-player.x,e.y-player.y)<e.r*.64+17)hitPlayer(bf.cfg.damage,e,'contact');
}
function admiralDefeated(e){
  mouse.down=false;
  unlockSecretSkin(secretForBoss(e.bossKind).id);
  if(bossFight.endless){if(window.RDMOnline?.serverSimulation){for(const p of window.ReiMultiplayerLocal.players)if(p.connected!==false)window.RDMOnline.awardDiamonds(p.id,2,'endlessBoss');}diamonds+=2;voyage.runDiamonds+=2;healBuild(20,player,"endlessBoss");healthFill.style.width=`${player.hp/player.maxHp*100}%`;healthValue.textContent=String(Math.ceil(player.hp));updateDiamondUI();}
  buildKill(e);recordKill(e);recordWaveComplete();clearVoyageHazards();enemyShots=[];shots=[];bossFight.attack=null;bossFight.bursts=[];
  for(const minion of enemies){if(minion===e||minion.destroyed)continue;minion.destroyed=true;minion.sinking=.01;burst(minion.x,minion.y,'splash',9);}
  campaign.bossDeath={kind:e.bossKind,x:e.x,y:e.y};
  bossDefeatTimer=e.bossKind==='ghostKing'?3.8:3.05;
  player.inv=Math.max(player.inv,bossDefeatTimer+.5);
  sfx(e.bossKind==='ghostKing'?'victory':'explosion',.8);
}
function drawAdmiralSignals(){
  const bf=bossFight;if(!bf)return;
  if(bf.defeated){document.getElementById('boss-intent').textContent=bf.kind==='ghostKing'?'OCEANO LIBERTO':'FROTA AFUNDADA';drawBossAftermath();return;}
  const e=enemies.find(e=>e.isBoss);if(!e)return;
  const intent=document.getElementById('boss-intent');
  bossHpFill.style.width=`${clamp(e.hp/e.max,0,1)*100}%`;
  intent.textContent=bf.defeated?'OCEANO LIBERTO':bf.phaseBarrier>0?'CASCO ESPECTRAL • SOBREVIVA':bf.intro>0?(bf.silence&&bf.intro>bf.introMax-bf.silence?'… O MAR SILENCIOU …':'PREPARE-SE'):bf.attack?bf.attack.name:`FASE ${bf.stage} • REPOSICIONE-SE`;
  ctx.save();
  if(bf.phaseBarrier>0){
    const q=.5+.5*Math.sin(t*7);ctx.save();ctx.globalAlpha=.34+.18*q;ctx.strokeStyle='#b7ffe0';ctx.lineWidth=3;ctx.shadowColor='#70ffc1';ctx.shadowBlur=14;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(e.x,e.y+12,88+i*13,58+i*9,t*.13+i*.4,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  if(bf.intro>0){
    if(bf.silence){const dusk=bf.intro>3.3?.55:Math.max(0,bf.intro/3.3*.5);ctx.fillStyle=`rgba(0,10,18,${dusk})`;ctx.fillRect(0,0,W,H);ctx.fillStyle='#01111d99';ctx.fillRect(0,H-34,W,34);}
    const fade=Math.min(1,(bf.introMax-bf.intro)*1.4,bf.intro*1.7);ctx.globalAlpha=Math.max(0,fade);ctx.fillStyle='#031019bb';ctx.fillRect(0,H*.55,W,92);
    ctx.fillStyle=e.bossKind==='ghostKing'?'#c2eed2':'#f7e0ad';ctx.font='bold 25px Georgia';ctx.textAlign='center';ctx.fillText(bf.silence&&bf.intro>bf.introMax-bf.silence?'TODAS AS BANDEIRAS AFUNDADAS…':bf.cfg.name,W/2,H*.55+39);
    ctx.font='12px monospace';ctx.fillStyle='#b4d0cf';ctx.fillText(bf.endless?`ONDA ${wave} • NOVO PADRÃO DE ATAQUE • +2 DIAMANTES`:e.bossKind==='marine'?'A marinha exige sua rendição.':e.bossKind==='blackbeard'?'“O mar pertence a quem não teme a escuridão.”':'… SOB UM ÚNICO CAPITÃO.',W/2,H*.55+65);
  }
  const at=bf.attack;
  if(at){
    ctx.strokeStyle=e.bossKind==='ghostKing'?'#c4f3d3':'#ffd9a0';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=2;
    if(['salvo','broadside'].includes(at.kind)){
      ctx.save();ctx.translate(e.x,e.y);ctx.rotate(at.angle);ctx.globalAlpha=.13;ctx.beginPath();ctx.moveTo(60,0);ctx.arc(0,0,400,at.kind==='salvo'?-.32:-.78,at.kind==='salvo'?.32:.78);ctx.closePath();ctx.fill();ctx.globalAlpha=.9;ctx.setLineDash([12,10]);ctx.beginPath();ctx.moveTo(70,0);ctx.lineTo(400,0);ctx.stroke();ctx.restore();
    }
    if(at.kind==='doomcross'){
      const p=at.targets[0];ctx.save();ctx.strokeStyle='#bdf7d3';ctx.globalAlpha=.78;ctx.setLineDash([9,8]);ctx.beginPath();ctx.moveTo(0,p.y);ctx.lineTo(W,p.y);ctx.moveTo(p.x,95);ctx.lineTo(p.x,H);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=.16;ctx.fillStyle='#8bffbf';ctx.beginPath();ctx.arc(p.x,p.y,78,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(at.kind==='graveyard'){
      const p=at.targets[0];ctx.save();ctx.strokeStyle='#a8ffd2';ctx.globalAlpha=.7;ctx.setLineDash([7,8]);ctx.beginPath();ctx.arc(p.x,p.y,150,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#cffff0';ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText('SAIA DO CERCO',p.x,p.y-165);ctx.restore();
    }
    if(at.kind==='echoes'){ctx.save();ctx.globalAlpha=.85;ctx.strokeStyle='#a8ffd2';ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(at.angle)*430,e.y+Math.sin(at.angle)*430);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#d5ffe5';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillText('ECOS: ALMIRANTE + BARBA NEGRA',W/2,128);ctx.restore();}
    if(at.kind==='spiral'){
      ctx.save();ctx.translate(e.x,e.y);ctx.rotate(at.angle);ctx.strokeStyle='#a8ffd2';ctx.fillStyle='#74e9b0';ctx.globalAlpha=.12;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,560,-.39,.39);ctx.closePath();ctx.fill();ctx.globalAlpha=.85;ctx.setLineDash([8,10]);
      for(const a of [-.39,.39]){ctx.beginPath();ctx.moveTo(Math.cos(a)*95,Math.sin(a)*95);ctx.lineTo(Math.cos(a)*560,Math.sin(a)*560);ctx.stroke();}ctx.restore();
      ctx.save();ctx.fillStyle='#d2ffe2';ctx.font='11px monospace';ctx.textAlign='center';ctx.fillText('SETOR SEGURO',e.x+Math.cos(at.angle)*260,e.y+Math.sin(at.angle)*260);ctx.restore();
    }
    if(at.kind==='barrage')for(const lane of at.lanes)drawBarrageWarning({axis:at.axis,x:at.axis==='x'?W/2:lane,y:at.axis==='x'?lane:H/2,r:27,spectral:e.bossKind==='ghostKing'},1-at.time/at.duration);
    if(at.kind==='crossing'){const p=at.targets[0];for(const axis of ['x','y'])drawBarrageWarning({axis,x:p.x,y:p.y,r:27},1-at.time/at.duration);}
    if(['soulwall','undertow'].includes(at.kind)){ctx.save();ctx.strokeStyle='#b9ffd2';ctx.fillStyle='#b9ffd2';ctx.globalAlpha=.1;ctx.fillRect(at.gap-105,110,210,H-110);ctx.globalAlpha=.8;ctx.setLineDash([8,10]);ctx.strokeRect(at.gap-105,110,210,H-110);ctx.font='11px monospace';ctx.textAlign='center';ctx.fillText('PASSAGEM DA MARÉ',at.gap,H-45);ctx.restore();}
    for(const point of at.kind==='crossing'?[]:at.targets){ctx.globalAlpha=.75;ctx.setLineDash([7,8]);ctx.beginPath();ctx.arc(point.x,point.y,72,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  }
  ctx.restore();
}
