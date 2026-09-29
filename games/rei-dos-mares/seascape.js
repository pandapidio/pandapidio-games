/* Animated water and cloud banks. Textures are generated once; painting does not change simulation state. */
const seaArt={pattern:null,context:null};
function seaTexture(){
  return cachedVisual('sea:surface',384,256,g=>{
    const img=g.createImageData(384,256),waves=[[2,1,1],[3,-2,.55],[7,3,.23],[11,-5,.12],[19,7,.07]];
    for(let y=0;y<256;y++)for(let x=0;x<384;x++){
      let height=0,slope=0;
      for(const [kx,ky,a] of waves){const q=Math.PI*2*(kx*x/384+ky*y/256);height+=Math.sin(q)*a;slope+=Math.cos(q)*a*ky;}
      const light=Math.max(0,Math.min(1,.46+slope*.105)),crest=Math.pow(light,5),i=(y*384+x)*4;
      img.data[i]=18+light*32+crest*45;img.data[i+1]=83+light*59+crest*28;img.data[i+2]=105+light*53+crest*20;img.data[i+3]=100+height*10;
    }
    g.putImageData(img,0,0);
  });
}
function paintSeascape(time,surfaceMix=1){
  const mix=clamp(surfaceMix,0,1);
  ctx.drawImage(cachedVisual('sea:depth',W,H,g=>{
    const bg=g.createLinearGradient(0,0,W*.35,H);bg.addColorStop(0,'#155566');bg.addColorStop(.32,'#0b4258');bg.addColorStop(1,'#042437');g.fillStyle=bg;g.fillRect(0,0,W,H);
    const glow=g.createRadialGradient(W*.36,-120,15,W*.36,0,W*.75);glow.addColorStop(0,'#86c8c82b');glow.addColorStop(.6,'#20777b0a');glow.addColorStop(1,'#00192b00');g.fillStyle=glow;g.fillRect(0,0,W,H);
    const depth=g.createRadialGradient(W*.5,H*.42,H*.2,W*.5,H*.42,W*.66);depth.addColorStop(0,'#01152200');depth.addColorStop(1,'#0115227a');g.fillStyle=depth;g.fillRect(0,0,W,H);
  }),0,0);
  if(!seaArt.pattern||seaArt.context!==ctx){seaArt.pattern=ctx.createPattern(cachedVisual('sea:scaled',768,320,g=>{g.imageSmoothingEnabled=true;g.drawImage(seaTexture(),0,0,768,320);}),'repeat');seaArt.context=ctx;}
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.fillStyle=seaArt.pattern;
  ctx.save();ctx.globalAlpha=.82;
  const dx=Math.floor((time*4.2)%768),dy=Math.floor((time*1.9)%320);
  ctx.translate(dx,dy);ctx.fillRect(-dx,-dy,W,H);ctx.restore();
  // Small irregular crests, not repeated horizontal bands.
  for(let level=0;level<3;level++){
    ctx.strokeStyle=['#63a4ad2b','#8bc5ca38','#b8e2da45'][level];ctx.lineWidth=level===2?1.15:.7;ctx.beginPath();
    for(let i=level;i<156;i+=3){
      const x=((i*197.31+time*(3+i%5))%(W+90))-45,y=30+(i*83.79)%(H-60)+Math.sin(time*.18+i)*7;
      const life=.5+.5*Math.sin(time*.55+i*2.7),len=(12+i%37)*life;
      if(len<2)continue;ctx.moveTo(x,y);ctx.quadraticCurveTo(x+len*.48,y-2-life*2.3,x+len,y+.2);
    }ctx.stroke();
  }
  ctx.restore();
  if(mix<1){ctx.fillStyle=`rgba(0,10,22,${(1-mix)*.61})`;ctx.fillRect(0,0,W,H);}
}
function cloudTexture(variant=0){
  return cachedVisual(`sea:cloud:${variant}`,320,192,g=>{
    // Overlapping, uneven lobes create a cloud silhouette without a visible ellipse edge.
    for(let i=0;i<15;i++){
      const x=32+(i*71+variant*37)%256,y=50+(i*47+variant*29)%95,r=38+(i*13)%45;
      const grad=g.createRadialGradient(x,y,1,x,y,r);grad.addColorStop(0,'#d2e4e32b');grad.addColorStop(.48,'#c0d7d41e');grad.addColorStop(1,'#b3cecc00');g.fillStyle=grad;g.fillRect(x-r,y-r,r*2,r*2);
    }
    // Soften the tile boundary before large-scale drawing.
    const pixels=g.getImageData(0,0,320,192);for(let y=0;y<192;y++)for(let x=0;x<320;x++){const mask=Math.pow(Math.max(0,Math.sin(Math.PI*x/319)*Math.sin(Math.PI*y/191)),.8);pixels.data[(y*320+x)*4+3]*=mask;}g.putImageData(pixels,0,0);
  });
}
function createFogBanks(){
  return Array.from({length:11},(_,i)=>({
    baseX:-260+(i%6)*285,baseY:125+Math.floor(i/6)*325+(i%3)*72,x:0,y:0,
    rx:285+(i%4)*30,ry:178+(i%3)*18,phase:i*1.37,variant:i%3,
    drift:18+(i%5)*3.5,vertical:10+(i%4)*3
  })).map(f=>({...f,x:f.baseX,y:f.baseY}));
}
function driftFogBanks(time){
  for(const f of campaign.fog){
    const span=W+f.rx*2+220;
    f.x=((f.baseX+time*f.drift+Math.sin(time*.16+f.phase)*42+f.rx+110)%span)-f.rx-110;
    f.y=f.baseY+Math.sin(time*.11+f.phase)*f.vertical+Math.cos(time*.045+f.phase)*22;
  }
}

function paintFogBanks(){
  if(!activeSea('fog')&&!bossFight?.kind?.includes('ghost'))return;
  const banks=activeSea('fog')?campaign.fog:Array.from({length:5},(_,i)=>({x:(i*289+t*11)%(W+500)-220,y:130+i*125,rx:290,ry:110,phase:i*1.7,variant:i%3}));
  ctx.save();ctx.imageSmoothingEnabled=true;
  for(const f of banks){
    const phase=t*.12+f.phase,swell=1+Math.sin(phase)*.065;
    // Higher clarity around the captain; projectile visibility uses the same moving bank positions.
    const near=Math.hypot(player.x-f.x,player.y-f.y)<160;
    ctx.globalAlpha=near?.82:1;
    ctx.drawImage(cloudTexture(f.variant),f.x-f.rx*swell,f.y-f.ry,f.rx*2*swell,f.ry*2);
    ctx.globalAlpha=near?.42:.58;
    ctx.drawImage(cloudTexture((f.variant+1)%3),f.x-f.rx*.80+Math.sin(phase)*35,f.y-f.ry*.75+Math.cos(phase)*12,f.rx*1.7,f.ry*1.5);
  }
  ctx.restore();
}
