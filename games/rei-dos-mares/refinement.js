/* v22: port services, honest combat telemetry, layered effects. No persistent run powers. */
function renderPortServices(){
 let box=document.getElementById('port-services');if(!box){box=document.createElement('div');box.id='port-services';upgradeGrid.after(box);}
 box.hidden=initialClassChoice();if(box.hidden)return;
 const b=BUILD_BALANCE.port;
 box.innerHTML=`<button id="port-repair" ${buildRun.shop.repaired||gold<b.repairCost||player.hp>=player.maxHp?'disabled':''}><strong>✚ ${buildRun.shop.repaired?"REPARO CONCLUÍDO":"REPARAR "+b.repairHeal+" DE VIDA"}</strong><span><i class="gold-coin"></i> ${b.repairCost} ouro · uma vez por visita</span></button><button id="port-reroll" ${buildRun.shop.rerolled||gold<b.rerollCost||!canReroll()?'disabled':''}><strong>↻ ${buildRun.shop.rerolled?'TROCA UTILIZADA':'TROCAR OFERTAS'}</strong><span><i class="gold-coin"></i> ${b.rerollCost} ouro · uma vez por visita</span></button><button id="port-depart"><strong>SEGUIR VIAGEM →</strong><span>Deixar o estaleiro</span></button>`;
 box.querySelector('#port-repair').onclick=repairAtPort;box.querySelector('#port-reroll').onclick=rerollPort;box.querySelector('#port-depart').onclick=()=>upgradeClose.click();
}
function canReroll(){if(initialClassChoice())return false;return ['common','rare','epic'].some(r=>{let pool=UPGRADES.filter(u=>u.cls===r&&upgradeEligible(u));if(!pool.length)pool=UPGRADES.filter(u=>u.cls==='legendary'&&upgradeEligible(u));return pool.some(u=>!upgradeChoices.includes(u));});}
function rerollPort(){
 const b=BUILD_BALANCE.port;if(state!=='upgrade'||initialClassChoice()||!buildRun.shop||buildRun.shop.rerolled||gold<b.rerollCost||!canReroll())return false;
 const old=upgradeChoices.slice(),out=[];
 for(const rarity of ['common','rare','epic']){
  let pool=UPGRADES.filter(u=>u.cls===rarity&&upgradeEligible(u));
  if(!pool.length)pool=UPGRADES.filter(u=>u.cls==='legendary'&&upgradeEligible(u)&&!out.includes(u));
  const fresh=pool.filter(u=>!old.includes(u));if(fresh.length)pool=fresh;
  if(pool.length)out.push(pickRandom(pool));
 }
 if(out.every(u=>old.includes(u)))return false;
 gold-=b.rerollCost;buildRun.metrics.goldSpent+=b.rerollCost;buildRun.shop.rerolled=true;upgradeChoices=out;addStat('portRerolls');checkAchievements();goldEl.textContent=String(gold);renderUpgradeChoices();sfx('click',.6);return true;
}
function renderBuildSynergies(){
 let node=document.getElementById('build-synergies');if(!node){node=document.createElement('div');node.id='build-synergies';document.getElementById('build-summary').after(node);}
 const synergies=[];
 if(hasUpgrade('hellfire'))synergies.push('🔥 FOGO DO INFERNO — explosões espalham fogo negro; alvos incendiados recebem +15% de dano explosivo.');
 if(hasUpgrade('veteran')&&hasUpgrade('double-shot'))synergies.push('SALVA VETERANA DUPLA — ambas as balas da quinta salva causam 250% de dano.');
 if(hasUpgrade('ectoplasm')&&hasUpgrade('spectral-ammo'))synergies.push('MARÉ ECTOPLÁSMICA — raio das poças ampliado para 7,6 metros.');
 if(hasUpgrade('drowned-curse')&&hasUpgrade('ectoplasm'))synergies.push('MALDIÇÃO DOS AFOGADOS — inimigos que entram no Ectoplasma também recebem -15% de movimento e dano.');
 if(hasUpgrade('rapid-fire')&&hasUpgrade('beyond-speed'))synergies.push('RECARGA DO ALÉM — frequência combinada ×1,56 e mobilidade espectral ampliada.');
 if(hasUpgrade('thick-hull')&&hasUpgrade('protector'))synergies.push('CASCO PROTEGIDO — 40% de redução combinada; Sem Medo pode levar a proteção ainda mais longe contra projéteis.');
 node.innerHTML=synergies.map(text=>`<p>${text}</p>`).join('')||'<p>Sinergias surgirão conforme você combinar melhorias.</p>';
}
function damageCause(source,kind){
 if(!source)return null;
 const owner=source.owner||source.source?.owner||source;
 if(source.attackKind==='depthcharges')return 'carga de profundidade';
 if(owner.isBoss){return owner.bossKind==='blackbeard'?'ataque de Barba Negra':owner.bossKind==='marine'?'ataque do Almirante da Marinha':'ataque do Capitão dos Mortos';}
 if(source.kind==='lightning')return 'raio da tempestade';
 if(source.kind==='vortex')return 'redemoinho';
 if(source.kind==='soulwall'||source.kind==='soulburst')return 'maré espectral';
 if(owner.role==='bomber')return 'bombardeiro';
 if(owner.role==='rammer'&&kind==='contact')return 'aríete';
 if(source.kind==='mortar')return 'bombardeio';
 if(source.kind==='barrage')return 'bombardeio em linha';
 if(kind==='contact')return 'colisão com navio inimigo';
 if(kind==='projectile')return 'tiro de canhão';return null;
}
function cleanCombatUI(){
 bossFight=null;campaign.damageFlash=0;campaign.damageDirection=null;campaign.bossDeath=null;
 voyage.notice=null;buildRun.pools=[];buildRun.souls=[];shots=[];enemyShots=[];voyage.queue=[];
 for(const id of ['boss-hp-wrap','encounter-notice','tutorial-card','sea-event','endgame-status'])document.getElementById(id)?.classList.add('hidden');
 document.getElementById('boss-intent').textContent='';
}
function drawVortexWater(){
 for(const h of voyage.hazards){if(h.kind!=='vortex')continue;
  ctx.save();ctx.translate(h.x,h.y);const fade=Math.min(1,h.life/.5);ctx.globalAlpha=fade;
  const bed=cachedVisual('vortex-bed',240,240,g=>{const d=g.createRadialGradient(120,120,5,120,120,119);d.addColorStop(0,'#00121bee');d.addColorStop(.3,'#032632c0');d.addColorStop(.7,'#17637355');d.addColorStop(1,'#46a5af00');g.fillStyle=d;g.fillRect(0,0,240,240);});ctx.drawImage(bed,-120,-120);
  for(let arm=0;arm<5;arm++){
   ctx.beginPath();for(let side=0;side<2;side++)for(let j=0;j<=36;j++){const k=side?36-j:j,r=9+k*3,a=arm*Math.PI*2/5+t*.9-k*.115+(side?.20+Math.sin(k*.22+t)*.025:0),x=Math.cos(a)*r,y=Math.sin(a)*r*.79;(side||j)?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fillStyle=arm%2?'#216b7c88':'#0b465fa6';ctx.fill();
   for(let j=6;j<34;j+=4){const r=9+j*3,a=arm*Math.PI*2/5+t*.9-j*.115;ctx.beginPath();ctx.ellipse(Math.cos(a)*r,Math.sin(a)*r*.79,3+j*.08,1.4,a+.7,0,Math.PI*1.6);ctx.strokeStyle='#bbebe4a8';ctx.lineWidth=1.4;ctx.stroke();}
  }
  ctx.globalAlpha=fade*.8;ctx.fillStyle='#001924';ctx.beginPath();ctx.ellipse(0,0,14+Math.sin(t*3),9,0,0,Math.PI*2);ctx.fill();
  for(let i=0;i<28;i++){const phase=(i/28+t*.10)%1,r=110*(1-phase),a=i*2.399+t*1.4+phase*4;ctx.globalAlpha=fade*Math.sin(phase*Math.PI)*.8;ctx.fillStyle=i%7===0?'#967250':'#bfe6df';ctx.fillRect(Math.cos(a)*r,Math.sin(a)*r*.75,i%7===0?6:3,2);}
  ctx.restore();
 }
}
// Newly drawn danger contours stay above translucent water and decorative particles.
function drawMysticPools(){
 ctx.save();for(const p of buildRun.pools){const r=p.radius||BUILD_BALANCE.ecto.radius,fade=Math.min(1,p.life/.4,p.age/.12);ctx.globalAlpha=fade;
  const surface=cachedVisual('ecto-pool',180,180,g=>{const d=g.createRadialGradient(90,90,3,90,90,88);d.addColorStop(0,'#0b444072');d.addColorStop(.55,'#2bba9266');d.addColorStop(.83,'#67e9b855');d.addColorStop(1,'#70ffd500');g.fillStyle=d;g.fillRect(0,0,180,180);});ctx.drawImage(surface,p.x-r,p.y-r,r*2,r*2);
  ctx.strokeStyle='#8affd3';ctx.lineWidth=1.4;ctx.globalAlpha=.65*fade;ctx.beginPath();for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,rr=r*(.9+.045*Math.sin(a*7+p.age*4)+.025*Math.cos(a*11-p.age*3));const x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
  for(let i=0;i<7;i++){const a=i*2.399+p.age*.25,rr=r*(.25+(i%3)*.2),phase=(p.age*.6+i/7)%1,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr-phase*22;ctx.globalAlpha=(1-phase)*fade*.7;ctx.fillStyle='#b7ffe7';ctx.fillRect(x,y,2,3);ctx.strokeStyle='#69e6c3';ctx.beginPath();ctx.ellipse(x,y+phase*9,4+phase*5,2,0,0,Math.PI*1.7);ctx.stroke();}
 }ctx.restore();
}

const captainAtlas=new Image();captainAtlas.src='assets/captains-atlas-v22.png';
function cohesiveBossSprite(img){
 if(!captainAtlas.complete||!captainAtlas.naturalWidth)return null;
 const index=Object.values(bossImages).indexOf(img);if(index<0)return null;
 const kind=Object.keys(bossImages)[index],cell={marine:0,blackbeard:1,ghost:2,ghostKing:3}[kind];if(cell===undefined)return null;
 return cachedVisual('captain-v22:'+kind,70,96,g=>{
  // Fixed alpha-trimmed atlas regions; works offline without pixel readback, then a shared 70 × 96 pixel grid.
  const cw=captainAtlas.naturalWidth/2,ch=captainAtlas.naturalHeight/2,surface=document.createElement('canvas');surface.width=cw;surface.height=ch;const c=surface.getContext('2d');c.drawImage(captainAtlas,(cell%2)*cw,Math.floor(cell/2)*ch,cw,ch,0,0,cw,ch);
  const [minX,minY,maxX,maxY]=[[163,31,549,604],[61,34,470,605],[158,17,565,600],[45,5,485,600]][cell];
  g.imageSmoothingEnabled=false;g.drawImage(surface,minX,minY,maxX-minX+1,maxY-minY+1,0,0,70,96);
 });
}
