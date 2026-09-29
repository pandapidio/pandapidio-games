/* Shared visual effects and collision geometry. Rendering never advances gameplay. */
const visualCache = new Map();
function cachedVisual(key,width,height,paint){
  if(!visualCache.has(key)){
    const surface=document.createElement('canvas');surface.width=width;surface.height=height;
    paint(surface.getContext('2d'));visualCache.set(key,surface);
  }
  return visualCache.get(key);
}
function projectileSprite(style,boss=false){
  return cachedVisual(`shot:${style}:${boss}`,64,32,g=>{
    g.translate(42,16);
    const colors={ecto:['#19554f','#78f5bd'],curse:['#17423d','#8cebc8'],inferno:['#100d0c','#f0602f'],normal:['#080d11','#778d99'],gold:['#f6cb72','#ffe5a3'],black:['#332337','#eb9185'],ghost:['#99ffd5','#76e7c0'],pierce:['#e3fcff','#70dfff'],reflect:['#f7fdff','#63dcff'],fire:['#ffe6a0','#ff8c35'],blast:['#ffdc8b','#ff8c46']};
    const [core,glow]=colors[style]||colors.gold;
    const trail=g.createLinearGradient(-46,0,2,0);trail.addColorStop(0,glow+'00');trail.addColorStop(.72,glow+'77');trail.addColorStop(1,glow);
    g.fillStyle=trail;g.beginPath();g.ellipse(-20,0,24,style==='blast'?5:3,0,0,Math.PI*2);g.fill();
    g.shadowColor=glow;g.shadowBlur=style==='normal'?3:8;g.fillStyle=core;g.beginPath();g.arc(0,0,boss?8:6.8,0,Math.PI*2);g.fill();g.shadowBlur=0;
    g.strokeStyle=style==='normal'?'#a1adb8':glow;g.lineWidth=1.2;g.stroke();
    g.fillStyle='#ffffff';g.globalAlpha=.7;g.beginPath();g.arc(-2,-2,1.8,0,Math.PI*2);g.fill();g.globalAlpha=1;
    if(['ghost','pierce','reflect'].includes(style)){g.strokeStyle=glow;g.lineWidth=1;g.beginPath();g.arc(0,0,10,0,Math.PI*2);g.stroke();}
  });
}
function drawCachedProjectiles(){
  for(const s of [...shots,...enemyShots]){
    if(s.life<=0)continue;
    const friendly=s.hitIds instanceof Set;
    const style=friendly?(s.ecto?'ecto':s.inferno?'inferno':s.reflected?'reflect':s.cursed?'curse':s.spectral?'ghost':s.veteran?'gold':s.explosive?'blast':s.flame?'fire':s.piercing?'pierce':'normal'):(s.spectral||s.bossKind==='ghostKing'?'ghost':s.bossKind==='blackbeard'?'black':'gold');
    ctx.save();ctx.globalAlpha=projectileVisibility(s);ctx.translate(s.x,s.y);ctx.rotate(Math.atan2(s.vy,s.vx));
    ctx.drawImage(projectileSprite(style,!!s.boss),-42,-16);
    if(friendly&&s.cosmeticProjectile&&cosmeticProjectileImages?.[s.cosmeticProjectile]?.complete){
      const img=cosmeticProjectileImages[s.cosmeticProjectile],size=s.cosmeticProjectile==='king'?22:20;
      ctx.save();ctx.rotate(-Math.atan2(s.vy,s.vx)+(s.cosmeticProjectile==='gullit'?t*4.5:0));ctx.globalAlpha=.98;ctx.drawImage(img,-size/2,-size/2,size,size);ctx.restore();
    }
    if(friendly&&s.ecto){ctx.strokeStyle='#adffe1';ctx.lineWidth=2;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-3,-5+i*5);ctx.quadraticCurveTo(-13,Math.sin(t*15+i)*5,-20-i*4,Math.sin(t*12+i)*7);ctx.stroke();}ctx.fillStyle='#81ffd1';ctx.fillRect(-5,-5,8,3);}
    if(friendly&&s.reflected){ctx.strokeStyle='#dffaff';ctx.globalAlpha=.9;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-8,-7);ctx.lineTo(-34,0);ctx.lineTo(-8,7);ctx.stroke();ctx.globalAlpha=projectileVisibility(s);}
    if(friendly&&s.veteran){ctx.strokeStyle='#fff1b5';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.stroke();}
    if(friendly&&s.flame){ctx.fillStyle=s.inferno?'#e14727':'#ffab4e';ctx.beginPath();ctx.moveTo(-7,-4);ctx.lineTo(-21-Math.sin(t*37)*5,0);ctx.lineTo(-7,4);ctx.fill();}
    ctx.restore();
  }
}
function fogSprite(){
  return cachedVisual('fog',256,256,g=>{const grad=g.createRadialGradient(128,128,8,128,128,128);grad.addColorStop(0,'#d7e8e682');grad.addColorStop(.48,'#bfd4d252');grad.addColorStop(1,'#aac6c800');g.fillStyle=grad;g.fillRect(0,0,256,256);});
}
// Earliest intersection of a segment and a circle, including a starting overlap.
function sweepCircle(ax,ay,bx,by,cx,cy,r){
  const dx=bx-ax,dy=by-ay,ox=ax-cx,oy=ay-cy,c=ox*ox+oy*oy-r*r;
  if(c<=0)return 0;const a=dx*dx+dy*dy;if(a<1e-9)return null;
  const b=2*(ox*dx+oy*dy),disc=b*b-4*a*c;if(disc<0)return null;
  const u=(-b-Math.sqrt(disc))/(2*a);return u>=0&&u<=1?u:null;
}
function barragePoints(h){
  if(h.points)return h.points;
  const horizontal=h.axis==='x',length=horizontal?W:H-90,count=Math.ceil(length/78);
  return Array.from({length:count},(_,i)=>({x:horizontal?(i+.5)*W/count:h.x,y:horizontal?h.y:90+(i+.5)*(H-90)/count}));
}
function drawBarrageWarning(h,progress=0){
  const horizontal=h.axis==='x',x=horizontal?0:h.x-h.r,y=horizontal?h.y-h.r:90,w=horizontal?W:h.r*2,height=horizontal?h.r*2:H-90;
  ctx.save();ctx.fillStyle=h.spectral?'#a9f3c7':'#ffc37c';ctx.globalAlpha=.08+progress*.13;ctx.fillRect(x,y,w,height);
  ctx.globalAlpha=.65+progress*.3;ctx.strokeStyle=h.spectral?'#bbf9d0':'#ffd399';ctx.lineWidth=1.7;ctx.setLineDash([10,8]);ctx.lineDashOffset=-t*24;ctx.strokeRect(x,y,w,height);ctx.setLineDash([]);
  for(const p of barragePoints(h)){ctx.beginPath();ctx.moveTo(p.x-7,p.y);ctx.lineTo(p.x+7,p.y);ctx.moveTo(p.x,p.y-7);ctx.lineTo(p.x,p.y+7);ctx.stroke();}
  ctx.restore();
}
function impactBarrage(h){
  sfx(h.spectral?'ghost-impact':'barrage-impact',.85,90);shake=Math.max(shake,4);
  for(const p of barragePoints(h)){
    for(let i=0;i<5;i++)addParticle(p.x,p.y,h.spectral?'#c4ffe1':i%2?'#ffdb98':'#d7f3ff',1.5+Math.random()*2,.4+Math.random()*.35,(Math.random()-.5)*90,-45-Math.random()*140,.93);
  }
}
function drawNavalBarrage(h){
  const age=h.life-h.delay,p=clamp(h.life/h.delay,0,1),spectral=!!h.spectral;
  if(age<0){
    drawBarrageWarning(h,p);
    for(const [i,target]of barragePoints(h).entries()){
      const source=h.source||{x:target.x-60,y:-70};
      const q=p,x=lerp(source.x,target.x,q),y=lerp(source.y,target.y,q)-Math.sin(q*Math.PI)*(100+i%3*22);
      const prev=Math.max(0,q-.07),px=lerp(source.x,target.x,prev),py=lerp(source.y,target.y,prev)-Math.sin(prev*Math.PI)*(100+i%3*22);
      ctx.save();ctx.strokeStyle=spectral?'#b4ffd08c':'#ffd18fa3';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.stroke();
      ctx.translate(x,y);ctx.rotate(Math.atan2(y-py,x-px));ctx.drawImage(projectileSprite(spectral?'ghost':'blast',true),-42,-16);ctx.restore();
    }
    return;
  }
  const fade=Math.max(0,1-age/1.18),rise=Math.sin(Math.min(1,age/.7)*Math.PI);
  ctx.save();ctx.globalAlpha=fade;
  const horizontal=h.axis==='x';ctx.fillStyle=spectral?'#adf5cf36':'#ddf5ff38';ctx.fillRect(horizontal?0:h.x-h.r,horizontal?h.y-h.r:90,horizontal?W:h.r*2,horizontal?h.r*2:H-90);
  for(const [i,point]of barragePoints(h).entries()){
    const jet=(32+i%4*10)*rise;
    ctx.fillStyle=spectral?'#c5ffe0':'#e4faff';ctx.globalAlpha=fade*.75;
    ctx.beginPath();ctx.moveTo(point.x-25,point.y+8);ctx.quadraticCurveTo(point.x-6,point.y-jet*.38,point.x-9,point.y-jet);ctx.quadraticCurveTo(point.x,point.y-jet*.7,point.x+4,point.y-jet-12);ctx.quadraticCurveTo(point.x+12,point.y-jet*.1,point.x+25,point.y+8);ctx.fill();
    ctx.globalAlpha=fade;ctx.strokeStyle=spectral?'#a0f9cb':'#c4f3ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(point.x,point.y,14+age*33,7+age*13,0,0,Math.PI*2);ctx.stroke();
    if(age<.19){ctx.fillStyle=spectral?'#edfff0':'#fff1c0';ctx.beginPath();ctx.arc(point.x,point.y,9+(1-age/.19)*13,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
}
function sinkingDuration(e){return e.isBoss?2.85:1.65;}
function updateShipSinking(e,dt){
  e.sinking+=dt;
  if(e.isBoss){
    e.sinkPulse=(e.sinkPulse||0)-dt;
    if(e.sinkPulse<=0&&e.sinking<2.3){e.sinkPulse=.32;const x=e.x+Math.sin(e.sinking*17)*65,y=e.y+Math.cos(e.sinking*11)*70;burst(x,y,e.bossKind==='ghostKing'?'splash':'boom',9);sfx('wreck',.34,250);}
  }
}
function drawBossAftermath(){
  const death=campaign.bossDeath;if(!death||!bossFight?.defeated)return;
  const duration=bossFight.kind==='ghostKing'?3.8:3.05,p=clamp(1-bossDefeatTimer/duration,0,1),ghost=death.kind==='ghostKing';
  ctx.save();ctx.strokeStyle=ghost?'#caffdf':'#ffdda0';ctx.globalAlpha=(1-p)*.8;ctx.lineWidth=3;
  for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(death.x,death.y+60,60+p*340+i*35,15+p*90+i*9,0,0,Math.PI*2);ctx.stroke();}
  if(ghost){ctx.fillStyle='#c6ffdf';for(let i=0;i<18;i++){const a=i*2.399;ctx.globalAlpha=(1-p)*.6;ctx.beginPath();ctx.arc(death.x+Math.cos(a)*(35+p*200),death.y+Math.sin(a)*90-p*250,2+(i%3),0,Math.PI*2);ctx.fill();}}
  ctx.restore();
}
function drawDamageDirection(){
  const d=campaign.damageDirection;if(d==null||campaign.damageFlash<=0)return;
  ctx.save();ctx.translate(player.x,player.y);ctx.rotate(d);ctx.strokeStyle='#ffcfb0';ctx.lineWidth=3;ctx.globalAlpha=Math.min(1,campaign.damageFlash*4);ctx.beginPath();ctx.arc(0,0,45,-.3,.3);ctx.stroke();ctx.restore();
}
function stopAllSfx(){
  for(const pool of Object.values(sfxPools))for(const a of pool){a.pause();a.currentTime=0;}
  if(audioState?.burnLoop){audioState.burnLoop.pause();audioState.burnLoop.currentTime=0;}
}
function updateEndgameHUD(){
  const el=document.getElementById('endgame-status');
  const visible=state==='play'&&infiniteMode&&!bossFight;
  el.classList.toggle('hidden',!visible);
  if(visible){
    const next=60+Math.max(0,Math.floor((wave-50)/10))*10;
    const text=`ALMIRANTE NA ${next} • ${campaign.mods.map(id=>ENDLESS_MODS.find(m=>m.id===id).name).join(' · ')}`;
    if(el.textContent!==text)el.textContent=text;
  }
}
function resolvePlayerShots(){
  for(const s of shots){
    if(s.life<=0||s.exploded)continue;
    const ax=s.prevX??s.x,ay=s.prevY??s.y,candidates=[];
    for(const e of enemies){
      if(!enemyIsAlive(e)||s.hitIds.has(e))continue;
      const ex=e.prevX??e.x,ey=e.prevY??e.y;
      const u=sweepCircle(ax-ex,ay-ey,s.x-e.x,s.y-e.y,0,0,e.r+(s.radius||8));
      if(u!==null)candidates.push({e,u});
    }
    candidates.sort((a,b)=>a.u-b.u);
    for(const {e,u}of candidates){
      if(s.life<=0)break;
      if(!enemyIsAlive(e))continue;
      const x=lerp(ax,s.x,u),y=lerp(ay,s.y,u);
      s.hitIds.add(e);
      if(e.spawnShield>0||(e.isBoss&&bossFight?.intro>0)){
        burst(x,y,'splash',5);s.life=0;break;
      }
      s.impactCount++;
      const positional=typeof campaignProjectileMultiplier==='function'?campaignProjectileMultiplier(e,s):1;
      const damage=s.damage*(s.piercing?BUILD_BALANCE.pierce[s.impactCount-1]:1)*closeRangeDamage(e)*positional;
      if(s.explosive){explodeShot(s,x,y,e);break;}
      const damaged=applyEnemyDamage(e,damage,'shot');
      if(damaged)buildHit(e,s,x,y);
      if(s.reflected&&damaged)impactEffects.push({type:'counter',x,y,life:0,max:.34,seed:Math.random()*10});
      sfx('hit',s.flame?.38:.42,55);burst(x,y,'splash',8);
      if(s.flame&&enemyIsAlive(e)){
        sfx('flame',.10,600);
        const current=impactEffects.find(f=>f.type==='flame'&&f.target===e);
        if(current)current.life=0;else impactEffects.push({type:'flame',target:e,life:0,max:3.1,seed:Math.random()*10});
      }
      shake=Math.max(shake,s.piercing?3:2);
      if(!s.piercing||s.impactCount>=3)s.life=0;
      else{sfx('pierce',.8,80);impactEffects.push({type:'pierce',x,y,life:0,max:.34,seed:Math.random()*10});}
    }
  }
}
function resolveEnemyShots(){
  for(const s of enemyShots){
    const h=playerHitCenter(),hitOffset=playerSkinMeta?.(player.skinId||selectedSkin)?.hitboxY??43,prevY=(player.prevY??player.y)+hitOffset;
    const ax=(s.prevX??s.x)-(player.prevX??player.x),ay=(s.prevY??s.y)-prevY;
    if(s.life>0&&sweepCircle(ax,ay,s.x-h.x,s.y-h.y,0,0,h.r)!==null){s.life=0;if(!reflectBuildShot(s))hitPlayer(s.damage||12,s,'projectile');}
  }
}
