(() => {
'use strict';

// ------------------------------------------------------------
// DOM
// ------------------------------------------------------------
const $ = s => document.querySelector(s);
const canvas = $('#game');
const ui = {
  title: $('#titleScreen'), play: $('#playBtn'), continueBtn: $('#continueBtn'), letter: $('#letterScreen'), letterContinue: $('#letterContinue'),
  dialogue: $('#dialogue'), speaker: $('#speakerName'), text: $('#dialogueText'),
  objective: $('#objective'), interact: $('#interact'), controls: $('#controlsHint'), crosshair: $('#crosshair'),
  noiseHud: $('#noiseHud'), noiseFill: $('#noiseFill'),
  cam: $('#camLabel'), itemHud: $('#itemHud'), hand: $('#handSprite'), pickup: $('#pickup'), spriteOverlay: $('#spriteOverlay'),
  breaker: $('#breakerMini'), wire: $('#wireCanvas'), breakerExit: $('#breakerExit'), end: $('#endScreen'),
  lockpick: $('#lockpickScreen'), lockSweet: $('#lockSweet'), lockCursor: $('#lockCursor'), lockpickStatus: $('#lockpickStatus'), lockpickAction: $('#lockpickAction'),
  restart: $('#restartBtn'), fade: $('#fade'), death: $('#deathFlash'), deathText: $('#deathText'), fatherJumpscare: $('#fatherJumpscare'), oldladyJumpscare: $('#oldladyJumpscare'),
  caption: $('#caption'), captionSpeaker: $('#captionSpeaker'), captionText: $('#captionText'),
  pause: $('#pauseScreen'), resume: $('#resumeBtn'), menu: $('#menuBtn'), volume: $('#volumeSlider'), volumeValue: $('#volumeValue'), inventory: $('#inventoryScreen'), inventorySlots: $('#inventorySlots')
};

// ------------------------------------------------------------
// Small math library
// ------------------------------------------------------------
const M = {
  identity(){ return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },
  multiply(a,b){
    const o=new Float32Array(16);
    for(let c=0;c<4;c++) for(let r=0;r<4;r++) o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
    return o;
  },
  translate(x,y,z){ const o=M.identity();o[12]=x;o[13]=y;o[14]=z;return o; },
  scale(x,y,z){ const o=M.identity();o[0]=x;o[5]=y;o[10]=z;return o; },
  rotY(a){ const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); },
  perspective(fov,aspect,near,far){
    const f=1/Math.tan(fov/2), nf=1/(near-far),o=new Float32Array(16);
    o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;return o;
  },
  lookAt(eye,center,up){
    let zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2];let l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
    let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
    const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
    return new Float32Array([xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0, -(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1]);
  }
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const dist2=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);

// ------------------------------------------------------------
// Audio: synthesized SFX only (no music)
// ------------------------------------------------------------
class AudioFX {
  constructor(){
    this.ctx=null;this.master=null;this.roomHum=null;this.roomBuzz=null;this.roomGain=null;this.buzzGain=null;this.noiseLoop=null;this.noiseGain=null;this.dreadOsc=null;this.dreadGain=null;this.dreadOsc2=null;this.dreadGain2=null;this.dreadNoise=null;this.dreadNoiseGain=null;this.dreadFilter=null;
    this.lastStep=0;this.nextAmbient=0;this.volume=.80;
  }
  unlock(){
    try{
      if(!this.ctx){
        this.ctx=new (window.AudioContext||window.webkitAudioContext)();
        const comp=this.ctx.createDynamicsCompressor();comp.threshold.value=-20;comp.knee.value=18;comp.ratio.value=4;comp.attack.value=.003;comp.release.value=.22;
        this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.master.connect(comp);comp.connect(this.ctx.destination);
        this.startRoomBed();
      }
      if(this.ctx.state==='suspended') this.ctx.resume();
    }catch(e){}
  }
  setVolume(v){this.volume=clamp(v,0,1);if(this.master&&this.ctx)this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.03)}
  tone(freq=440,d=.08,type='sine',vol=.05,endFreq=null,delay=0){
    if(!this.ctx)return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+.007);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+d+.03);
  }
  noise(d=.12,vol=.06,filter=1000,delay=0,highpass=0){
    if(!this.ctx)return;const sr=this.ctx.sampleRate,buf=this.ctx.createBuffer(1,Math.ceil(sr*d),sr),a=buf.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*(1-i/a.length);const src=this.ctx.createBufferSource();src.buffer=buf;const lp=this.ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=filter;let node=lp;if(highpass>0){const hp=this.ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=highpass;lp.connect(hp);node=hp}const g=this.ctx.createGain();g.gain.value=vol;src.connect(lp);node.connect(g);g.connect(this.master);src.start(this.ctx.currentTime+delay);
  }
  click(){this.tone(620,.045,'square',.045,430)}
  paper(){this.noise(.24,.07,3600,0,650);this.noise(.18,.035,1800,.10,350)}
  button(){this.tone(310,.06,'square',.055,240);this.tone(690,.045,'sine',.03,620,.045)}
  deskBell(){this.tone(1320,.22,'sine',.085,1040);this.tone(1760,.16,'sine',.035,1420,.025)}
  blip(kind){if(kind==='recep'){this.tone(535,.042,'square',.045,455)}else{this.tone(188,.055,'sawtooth',.040,155)}}
  error(){this.tone(105,.18,'square',.08,62)}
  step(sprint=false){const n=performance.now();if(n-this.lastStep<(sprint?225:320))return;this.lastStep=n;this.noise(.07,sprint?.075:.055,520,0,65);this.tone(sprint?92:76,.055,'sine',.028,55)}
  jump(){this.noise(.08,.045,700);this.tone(105,.07,'sine',.03,130)}
  land(){this.noise(.11,.075,420);this.tone(63,.08,'sine',.035,45)}
  screwdriver(){this.noise(.30,.13,2100,0,240);this.tone(142,.24,'sawtooth',.05,83);this.tone(820,.10,'square',.026,510,.20)}
  attack(){this.noise(.15,.11,2700,0,300);this.tone(165,.13,'sawtooth',.045,92)}
  wire(){this.tone(780,.075,'square',.06,980);this.tone(1250,.06,'sine',.032,1420,.04)}
  power(){this.noise(.62,.15,2300);this.tone(47,.78,'sawtooth',.10,86);this.tone(940,.18,'sine',.08,1320,.38);this.tone(1880,.08,'square',.035,1500,.53)}
  door(){this.noise(.78,.12,1150,0,80);this.tone(72,.68,'sawtooth',.06,46);this.tone(185,.18,'square',.028,112,.48)}
  ding(){this.tone(784,.26,'sine',.12,760);this.tone(1175,.34,'sine',.075,1110,.10)}
  elevatorRide(){this.tone(42,2.7,'sawtooth',.075,58);this.noise(2.55,.07,520);this.tone(86,.38,'triangle',.035,65,.72);this.tone(61,.32,'sawtooth',.05,44,1.65)}
  elevatorJolt(){this.noise(.24,.13,520);this.tone(51,.23,'square',.07,38)}
  pickup(){this.tone(430,.14,'triangle',.09,610);this.tone(730,.12,'sine',.05,900,.10)}
  suspense(){this.noise(.42,.07,640,0,55);this.tone(42,.55,'sine',.035,35)}
  pipeClang(){this.tone(248,.12,'square',.035,170);this.tone(118,.28,'triangle',.05,73,.025);this.noise(.16,.035,1800)}
  horrorDoor(open=true){this.noise(open?.72:.55,open?.15:.11,1250,0,85);this.tone(open?88:112,open?.65:.48,'sawtooth',open?.075:.058,open?47:72);this.tone(open?214:176,.24,'triangle',.034,open?118:102,.22)}
  jumpscare(){this.noise(.88,.30,5600,0,280);this.noise(.62,.22,920,0,45);this.tone(63,.52,'sawtooth',.17,28);this.tone(910,.18,'square',.10,180,.06);this.tone(126,.30,'square',.09,41,.23)}
  girlBlip(){this.tone(410,.042,'triangle',.035,470);this.tone(690,.028,'sine',.018,620,.012)}
  tvHum(){this.tone(57,.24,'sawtooth',.018,53);this.noise(.16,.018,1700,0,280)}
  fatherShout(){this.noise(.72,.19,1200,0,75);this.tone(92,.66,'sawtooth',.15,47);this.tone(138,.40,'square',.055,71,.08)}
  fatherScream(){this.noise(.95,.34,6200,0,260);this.noise(.88,.24,2100,.02,120);this.tone(310,.62,'sawtooth',.18,78);this.tone(455,.52,'square',.10,120,.025);this.tone(180,.78,'sawtooth',.16,42,.05);this.tone(760,.20,'square',.08,190,.06)}
  monsterStep(){this.noise(.10,.10,390,0,45);this.tone(49,.11,'sine',.065,35)}
  doorSlam(){this.noise(.32,.18,850,0,60);this.tone(61,.34,'square',.12,31);this.tone(148,.14,'triangle',.045,77,.09)}
  glassHit(){this.noise(.28,.20,5200,0,650);this.tone(610,.12,'square',.08,205);this.tone(1180,.08,'sine',.045,520,.035)}
  glassBreak(){this.noise(.70,.28,7000,0,900);this.noise(.55,.15,1800,.08,180);this.tone(84,.48,'sawtooth',.13,34)}
  fatherPain(){this.tone(115,.62,'sawtooth',.12,46);this.noise(.44,.10,1400,0,100)}
  dissolve(){this.noise(1.1,.15,2100,0,40);this.tone(76,1.0,'sawtooth',.075,24);this.tone(310,.7,'triangle',.038,83,.08)}
  setDread(v){if(!this.ctx||!this.dreadGain)return;v=clamp(v,0,1);const t=this.ctx.currentTime;this.dreadGain.gain.setTargetAtTime(.0001+v*.115,t,.08);this.dreadGain2.gain.setTargetAtTime(.0001+v*.055,t,.10);this.dreadNoiseGain.gain.setTargetAtTime(.0001+v*.090,t,.07);this.dreadOsc.frequency.setTargetAtTime(34+v*12,t,.12);this.dreadOsc2.frequency.setTargetAtTime(67-v*18,t,.12);this.dreadFilter.frequency.setTargetAtTime(520+v*1900,t,.08)}
  dreadPulse(v){if(!this.ctx||v<.15)return;this.noise(.12+v*.16,.025+v*.07,900+v*2600);this.tone(58+v*28,.14+v*.10,'triangle',.018+v*.04,42)}
  startRoomBed(){
    if(!this.ctx)return;
    const h=this.ctx.createOscillator(),hg=this.ctx.createGain();h.type='sine';h.frequency.value=52;hg.gain.value=.0001;h.connect(hg);hg.connect(this.master);h.start();this.roomHum=h;this.roomGain=hg;
    const b=this.ctx.createOscillator(),bg=this.ctx.createGain();b.type='sawtooth';b.frequency.value=109;bg.gain.value=.0001;b.connect(bg);bg.connect(this.master);b.start();this.roomBuzz=b;this.buzzGain=bg;
    const sr=this.ctx.sampleRate,buf=this.ctx.createBuffer(1,sr*2,sr),arr=buf.getChannelData(0);for(let i=0;i<arr.length;i++)arr[i]=(Math.random()*2-1)*.55;const src=this.ctx.createBufferSource();src.buffer=buf;src.loop=true;const lp=this.ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=920;const ng=this.ctx.createGain();ng.gain.value=.0001;src.connect(lp);lp.connect(ng);ng.connect(this.master);src.start();this.noiseLoop=src;this.noiseGain=ng;
    const d=this.ctx.createOscillator(),dg=this.ctx.createGain();d.type='sawtooth';d.frequency.value=34;dg.gain.value=.0001;d.connect(dg);dg.connect(this.master);d.start();this.dreadOsc=d;this.dreadGain=dg;
    const d2=this.ctx.createOscillator(),dg2=this.ctx.createGain();d2.type='triangle';d2.frequency.value=67;dg2.gain.value=.0001;d2.connect(dg2);dg2.connect(this.master);d2.start();this.dreadOsc2=d2;this.dreadGain2=dg2;
    const dbuf=this.ctx.createBuffer(1,sr*2,sr),da=dbuf.getChannelData(0);for(let i=0;i<da.length;i++)da[i]=(Math.random()*2-1);const ds=this.ctx.createBufferSource();ds.buffer=dbuf;ds.loop=true;const df=this.ctx.createBiquadFilter();df.type='bandpass';df.frequency.value=520;df.Q.value=.55;const dng=this.ctx.createGain();dng.gain.value=.0001;ds.connect(df);df.connect(dng);dng.connect(this.master);ds.start();this.dreadNoise=ds;this.dreadNoiseGain=dng;this.dreadFilter=df;
  }
  setRoom(scene,power){
    if(!this.ctx||!this.roomGain)return;this.setDread(0);let hv=.022,bv=.002,nv=.006,hf=52,bf=109;
    if(scene==='floor1'){hv=power?.030:.055;bv=power?.005:.015;nv=power?.012:.030;hf=power?60:43;bf=power?120:87}
    else if(scene==='floor2'){hv=power?.035:.062;bv=power?.009:.020;nv=power?.018:.038;hf=power?58:39;bf=power?116:79}
    else if(scene==='floor3'){hv=power?.032:.058;bv=power?.008:.018;nv=power?.017:.040;hf=power?55:36;bf=power?112:76}
    else if(scene==='elevator'){hv=.052;bv=.012;nv=.022;hf=56;bf=112}
    else if(scene==='reception'){hv=.025;bv=.003;nv=.008;hf=51;bf=102}
    this.roomHum.frequency.setTargetAtTime(hf,this.ctx.currentTime,.15);this.roomBuzz.frequency.setTargetAtTime(bf,this.ctx.currentTime,.15);this.roomGain.gain.setTargetAtTime(hv,this.ctx.currentTime,.25);this.buzzGain.gain.setTargetAtTime(bv,this.ctx.currentTime,.25);this.noiseGain.gain.setTargetAtTime(nv,this.ctx.currentTime,.25);
  }
  ambient(scene,power,now){
    if(!this.ctx||now<this.nextAmbient)return;
    if(scene==='floor1'&&!power){this.nextAmbient=now+1800+Math.random()*3200;(Math.random()<.55?this.pipeClang():this.suspense())}
    else if(scene==='floor1'&&power){this.nextAmbient=now+5500+Math.random()*5000;if(Math.random()<.45)this.noise(.12,.025,1200)}
    else if(scene==='floor2'&&!power){this.nextAmbient=now+2100+Math.random()*2600;(Math.random()<.45?this.tvHum():this.suspense())}
    else if(scene==='floor2'&&power){this.nextAmbient=now+2600+Math.random()*3000;if(Math.random()<.55)this.pipeClang()}
    else if(scene==='floor3'&&!power){this.nextAmbient=now+1800+Math.random()*2400;(Math.random()<.5?this.suspense():this.noise(.16,.03,1800,0,220))}
    else if(scene==='floor3'&&power){this.nextAmbient=now+3200+Math.random()*2800;if(Math.random()<.45)this.pipeClang()}
    else if(scene==='reception'){this.nextAmbient=now+6500+Math.random()*6000;if(Math.random()<.4)this.tone(82,.18,'sine',.015,75)}
    else this.nextAmbient=now+4500;
  }
}
const sfx=new AudioFX();

// ------------------------------------------------------------
// Intro/menu audio: pre-rendered WAVs for a less synthetic sound.
// Browsers may block audible autoplay until the first user gesture, so we
// attempt it immediately and retry on any initial pointer/key interaction.
// ------------------------------------------------------------
class IntroAudio {
  constructor(){
    this.volume=.80;
    this.menu=new Audio('assets/menu_horror.wav');this.menu.loop=true;this.menu.preload='auto';this.menu.volume=.42*this.volume;
    this.click=new Audio('assets/menu_click.wav');this.click.preload='auto';this.click.volume=.92*this.volume;
    this.paper=new Audio('assets/paper_fold.wav');this.paper.preload='auto';this.paper.volume=1.0*this.volume;
    this.menuStarted=false;
  }
  setVolume(v){this.volume=clamp(v,0,1);this.menu.volume=.42*this.volume;this.click.volume=.92*this.volume;this.paper.volume=1.0*this.volume}
  startMenu(){
    if(this.menuStarted&&!this.menu.paused)return;
    this.menuStarted=true;
    const p=this.menu.play();if(p&&p.catch)p.catch(()=>{this.menuStarted=false});
  }
  stopMenu(){
    const a=this.menu;if(a.paused)return;
    const start=a.volume,steps=8;let i=0;
    const timer=setInterval(()=>{i++;a.volume=Math.max(0,start*(1-i/steps));if(i>=steps){clearInterval(timer);a.pause();a.currentTime=0;a.volume=.42*this.volume;this.menuStarted=false}},35);
  }
  oneShot(proto,volScale=1){
    try{const a=proto.cloneNode(true);a.volume=Math.min(1,proto.volume*volScale);const p=a.play();if(p&&p.catch)p.catch(()=>{})}catch(e){}
  }
  menuClick(){this.oneShot(this.click,1.0)}
  fold(){this.oneShot(this.paper,1.0)}
}
const introAudio=new IntroAudio();
// Best-effort autoplay. If the browser blocks it, the first input retries.
try{introAudio.startMenu()}catch(e){}
const unlockIntro=()=>{introAudio.startMenu();window.removeEventListener('pointerdown',unlockIntro,true);window.removeEventListener('keydown',unlockIntro,true)};
window.addEventListener('pointerdown',unlockIntro,true);window.addEventListener('keydown',unlockIntro,true);

// ------------------------------------------------------------
// WebGL tiny renderer
// ------------------------------------------------------------
const gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:false});
if(!gl){alert('Seu navegador não suporta WebGL.');return;}

const VS=`
attribute vec3 aPos;attribute vec3 aNormal;attribute vec2 aUV;
uniform mat4 uModel;uniform mat4 uViewProj;
varying vec2 vUV;varying vec3 vWorld;varying vec3 vNormal;varying float vDist;
void main(){vec4 w=uModel*vec4(aPos,1.0);vWorld=w.xyz;vNormal=normalize(mat3(uModel)*aNormal);vUV=aUV;gl_Position=uViewProj*w;vDist=gl_Position.w;}`;
const FS=`
precision mediump float;
uniform sampler2D uTex;uniform vec3 uTint;uniform vec2 uUVScale;uniform vec3 uCamera;uniform vec3 uViewDir;uniform float uAmbient;uniform vec3 uLightTint;uniform float uFlash;uniform float uEmissive;uniform vec3 uFogColor;uniform float uFogDensity;uniform float uAlphaCut;uniform float uSurfaceGloss;uniform float uOpacity5;uniform vec3 uLocalPos[3];uniform vec3 uLocalColor[3];
varying vec2 vUV;varying vec3 vWorld;varying vec3 vNormal;varying float vDist;
void main(){
  vec4 t=texture2D(uTex,vUV*uUVScale);if(t.a<uAlphaCut)discard;
  vec3 base=t.rgb*uTint;
  float sun=max(dot(normalize(vNormal),normalize(vec3(-.35,.78,.42))),0.0);
  float light=uAmbient + sun*.18;
  if(uFlash>0.0){vec3 toF=normalize(vWorld-uCamera);float cone=max(dot(toF,normalize(uViewDir)),0.0);float d=length(vWorld-uCamera);float spot=smoothstep(.83,.975,cone)*(1.0/(1.0+.11*d*d))*uFlash;light+=spot;}
  vec3 col=base*(light*uLightTint)+base*uEmissive;
  for(int i=0;i<3;i++){
    vec3 delta=uLocalPos[i]-vWorld;float d=length(delta);
    float bounce=.25+.75*max(dot(normalize(vNormal),normalize(delta)),0.0);
    col+=base*uLocalColor[i]*bounce/(1.0+1.4*d*d);
    if(uSurfaceGloss>0.0){vec3 eyeDir=normalize(uCamera-vWorld);float spec=pow(max(dot(reflect(-normalize(delta),normalize(vNormal)),eyeDir),0.0),36.0);col+=uLocalColor[i]*spec*uSurfaceGloss/(1.0+.12*d*d);}
  }
  float fog=1.0-exp(-uFogDensity*uFogDensity*vDist*vDist);col=mix(col,uFogColor,clamp(fog,0.0,.86));
  gl_FragColor=vec4(col,t.a*uOpacity5);
}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,VS));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
const loc={};['aPos','aNormal','aUV'].forEach(n=>loc[n]=gl.getAttribLocation(prog,n));['uModel','uViewProj','uTex','uTint','uUVScale','uCamera','uViewDir','uAmbient','uLightTint','uFlash','uEmissive','uFogColor','uFogDensity','uAlphaCut','uSurfaceGloss','uOpacity5','uLocalPos[0]','uLocalColor[0]'].forEach(n=>loc[n]=gl.getUniformLocation(prog,n));

// cube vertices: position normal uv
const cube=[];
function face(n,a,b,c,d){const pts=[a,b,c,a,c,d],uv=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];for(let i=0;i<6;i++)cube.push(...pts[i],...n,...uv[i]);}
face([0,0,1],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]);
face([0,0,-1],[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]);
face([1,0,0],[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]);
face([-1,0,0],[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]);
face([0,1,0],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]);
face([0,-1,0],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]);
const cubeBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,cubeBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cube),gl.STATIC_DRAW);

const quad=[-.5,0,0, 0,0,1, 0,1,  .5,0,0, 0,0,1, 1,1,  .5,1,0, 0,0,1, 1,0,  -.5,0,0, 0,0,1, 0,1,  .5,1,0, 0,0,1, 1,0,  -.5,1,0, 0,0,1, 0,0];
const quadBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quadBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(quad),gl.STATIC_DRAW);
const shapedGeometry={};
function frustumGeometry(key,top){
  const vertices=[],N=16;function vert(p,n,u,v){vertices.push(...p,...n,u,v)}
  for(let i=0;i<N;i++){let a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2;const p=[Math.cos(a)*.5,-.5,Math.sin(a)*.5],q=[Math.cos(b)*.5,-.5,Math.sin(b)*.5],r=[Math.cos(b)*top,.5,Math.sin(b)*top],t=[Math.cos(a)*top,.5,Math.sin(a)*top],n=[Math.cos((a+b)/2),.5-top,Math.sin((a+b)/2)];for(const [v,u,w]of [[p,0,0],[q,1,0],[r,1,1],[p,0,0],[r,1,1],[t,0,1]])vert(v,n,u,w);for(const v of [[0,.5,0],t,r])vert(v,[0,1,0],v[0]+.5,v[2]+.5);for(const v of [[0,-.5,0],q,p])vert(v,[0,-1,0],v[0]+.5,v[2]+.5);}
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);shapedGeometry[key]={buf,count:vertices.length/8};
}frustumGeometry('shade',.28);frustumGeometry('round',.5);
function bindGeom(buf){gl.bindBuffer(gl.ARRAY_BUFFER,buf);const st=8*4;gl.enableVertexAttribArray(loc.aPos);gl.vertexAttribPointer(loc.aPos,3,gl.FLOAT,false,st,0);gl.enableVertexAttribArray(loc.aNormal);gl.vertexAttribPointer(loc.aNormal,3,gl.FLOAT,false,st,3*4);gl.enableVertexAttribArray(loc.aUV);gl.vertexAttribPointer(loc.aUV,2,gl.FLOAT,false,st,6*4);}

function makeTextureFromCanvas(c,repeat=true){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);if((c.width&(c.width-1))===0&&(c.height&(c.height-1))===0)gl.generateMipmap(gl.TEXTURE_2D);else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);return t;}
function textureFromImage(img){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}

let seed=4157;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function pattern(kind){
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  if(kind==='wallpaper'){
    x.fillStyle='#817866';x.fillRect(0,0,256,256);for(let i=0;i<7000;i++){const v=90+Math.floor(rnd()*50);x.fillStyle=`rgba(${v+20},${v+15},${v},${.025+rnd()*.04})`;x.fillRect(rnd()*256,rnd()*256,1,1)}
    x.strokeStyle='rgba(38,34,28,.13)';x.lineWidth=1;for(let xx=20;xx<256;xx+=42){x.beginPath();x.moveTo(xx,0);x.lineTo(xx,256);x.stroke();for(let yy=20;yy<256;yy+=48){x.beginPath();x.arc(xx,yy,4,0,Math.PI*2);x.stroke()}}
  }else if(kind==='wood'){
    x.fillStyle='#4c3324';x.fillRect(0,0,256,256);for(let y=0;y<256;y+=32){x.fillStyle=`rgb(${63+Math.floor(rnd()*22)},${39+Math.floor(rnd()*14)},${27+Math.floor(rnd()*10)})`;x.fillRect(0,y,256,31);x.strokeStyle='rgba(12,8,5,.68)';x.strokeRect(0,y,256,32);for(let k=0;k<18;k++){x.strokeStyle='rgba(20,12,7,.18)';x.beginPath();x.moveTo(rnd()*256,y+4+rnd()*23);x.bezierCurveTo(rnd()*256,y+12,rnd()*256,y+18,rnd()*256,y+27);x.stroke()}}
  }else if(kind==='carpet'){
    x.fillStyle='#4d1718';x.fillRect(0,0,256,256);x.strokeStyle='rgba(205,155,86,.17)';for(let y=-64;y<320;y+=40)for(let xx=-64;xx<320;xx+=40){x.strokeRect(xx,y,20,20);x.strokeRect(xx+10,y+10,20,20)}for(let i=0;i<4000;i++){x.fillStyle=`rgba(255,220,170,${rnd()*.025})`;x.fillRect(rnd()*256,rnd()*256,1,1)}
  }else if(kind==='apartmentwall'){
    x.fillStyle='#665f58';x.fillRect(0,0,256,256);
    for(let i=0;i<3600;i++){const v=95+Math.floor(rnd()*35);x.fillStyle=`rgba(${v+12},${v+7},${v},${.018+rnd()*.032})`;x.fillRect(rnd()*256,rnd()*256,1,1)}
    x.strokeStyle='rgba(44,38,34,.10)';x.lineWidth=1;for(let xx=0;xx<256;xx+=64){x.beginPath();x.moveTo(xx,0);x.lineTo(xx,256);x.stroke()}
    x.fillStyle='rgba(45,38,34,.08)';for(let y=36;y<256;y+=72)x.fillRect(0,y,256,2);
  }else if(kind==='parquet'){
    x.fillStyle='#3b281f';x.fillRect(0,0,256,256);
    for(let y=0;y<256;y+=32){for(let xx=0;xx<256;xx+=64){const off=(y/32)%2?32:0;const px=(xx+off)%256;const r=58+Math.floor(rnd()*20),g=38+Math.floor(rnd()*12),b=28+Math.floor(rnd()*10);x.fillStyle=`rgb(${r},${g},${b})`;x.fillRect(px,y,62,30);x.strokeStyle='rgba(15,10,8,.62)';x.strokeRect(px,y,62,30);}}
    for(let i=0;i<600;i++){x.fillStyle=`rgba(210,165,115,${rnd()*.035})`;x.fillRect(rnd()*256,rnd()*256,1+rnd()*2,1)}
  }else if(kind==='rug'){
    x.fillStyle='#32191b';x.fillRect(0,0,256,256);x.strokeStyle='rgba(168,113,76,.34)';x.lineWidth=5;x.strokeRect(14,14,228,228);x.strokeStyle='rgba(128,82,60,.24)';x.lineWidth=2;x.strokeRect(28,28,200,200);
    for(let y=45;y<225;y+=34)for(let xx=45;xx<225;xx+=34){x.beginPath();x.moveTo(xx,y-8);x.lineTo(xx+8,y);x.lineTo(xx,y+8);x.lineTo(xx-8,y);x.closePath();x.stroke()}
    for(let i=0;i<2200;i++){x.fillStyle=`rgba(240,210,175,${rnd()*.018})`;x.fillRect(rnd()*256,rnd()*256,1,1)}
  }else if(kind==='nightwindow'){
    const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#07101d');g.addColorStop(.62,'#101b2a');g.addColorStop(1,'#1b2330');x.fillStyle=g;x.fillRect(0,0,256,256);
    for(let i=0;i<34;i++){const px=10+rnd()*236,py=8+rnd()*165,s=rnd()<.14?2:1;x.fillStyle=`rgba(220,228,235,${.18+rnd()*.38})`;x.fillRect(px,py,s,s)}
    const hg=x.createRadialGradient(177,65,3,177,65,44);hg.addColorStop(0,'rgba(231,235,222,.24)');hg.addColorStop(1,'rgba(231,235,222,0)');x.fillStyle=hg;x.fillRect(128,16,98,98);
    x.fillStyle='#d8d8c8';x.beginPath();x.arc(177,65,23,0,Math.PI*2);x.fill();x.fillStyle='rgba(115,121,116,.18)';x.beginPath();x.arc(168,58,5,0,Math.PI*2);x.fill();x.beginPath();x.arc(184,73,4,0,Math.PI*2);x.fill();
    x.fillStyle='rgba(103,119,139,.09)';for(let i=0;i<5;i++){const yy=112+i*22+rnd()*8;x.fillRect(-20+rnd()*35,yy,180+rnd()*110,5+rnd()*7)}
    x.fillStyle='#080c12';x.fillRect(0,216,256,40);for(let i=0;i<11;i++){const bx=i*25-5,hh=10+rnd()*25;x.fillRect(bx,216-hh,23,hh);if(rnd()>.45){x.fillStyle='rgba(208,171,91,.28)';x.fillRect(bx+6,222-hh,3,4);x.fillStyle='#080c12'}}
  }else if(kind==='darkwall'){
    x.fillStyle='#343a34';x.fillRect(0,0,256,256);for(let i=0;i<4500;i++){const a=.02+rnd()*.05;x.fillStyle=`rgba(${rnd()<.5?30:110},${70+Math.floor(rnd()*30)},${60+Math.floor(rnd()*20)},${a})`;x.fillRect(rnd()*256,rnd()*256,1+rnd()*2,1+rnd()*3)}x.fillStyle='rgba(20,22,19,.16)';for(let i=0;i<10;i++)x.fillRect(rnd()*256,0,2+rnd()*6,256*rnd())
  }else if(kind==='concrete'){
    x.fillStyle='#50504b';x.fillRect(0,0,256,256);for(let i=0;i<9000;i++){const v=60+Math.floor(rnd()*55);x.fillStyle=`rgba(${v},${v},${v-4},${.04+rnd()*.07})`;x.fillRect(rnd()*256,rnd()*256,1+rnd()*2,1+rnd()*2)}
  }else if(kind==='ceiling'){
    x.fillStyle='#8c887c';x.fillRect(0,0,256,256);for(let i=0;i<5000;i++){x.fillStyle=`rgba(35,33,30,${rnd()*.04})`;x.fillRect(rnd()*256,rnd()*256,1,1)}
  }else if(kind==='metal'){
    const g=x.createLinearGradient(0,0,256,0);g.addColorStop(0,'#55575a');g.addColorStop(.25,'#818386');g.addColorStop(.5,'#65676a');g.addColorStop(.75,'#8b8c8d');g.addColorStop(1,'#55575a');x.fillStyle=g;x.fillRect(0,0,256,256);for(let i=0;i<800;i++){x.fillStyle=`rgba(255,255,255,${rnd()*.035})`;x.fillRect(rnd()*256,rnd()*256,1,rnd()*8)}
  }else if(kind==='brass'){
    x.fillStyle='#80672d';x.fillRect(0,0,256,256);for(let i=0;i<1400;i++){x.fillStyle=`rgba(${140+Math.floor(rnd()*60)},${105+Math.floor(rnd()*40)},${35+Math.floor(rnd()*25)},${.03+rnd()*.08})`;x.fillRect(rnd()*256,rnd()*256,1,1+rnd()*8)}
  }else if(kind==='darkwood'){
    x.fillStyle='#2e1c13';x.fillRect(0,0,256,256);for(let y=0;y<256;y+=26){x.fillStyle=`rgba(105,61,35,${.22+rnd()*.12})`;x.fillRect(0,y,256,2);for(let k=0;k<8;k++){x.strokeStyle='rgba(146,91,51,.12)';x.beginPath();x.moveTo(0,y+rnd()*25);x.bezierCurveTo(60,y+rnd()*25,170,y+rnd()*25,256,y+rnd()*25);x.stroke()}}
  }else if(kind==='fabric'){
    x.fillStyle='#705140';x.fillRect(0,0,256,256);for(let i=0;i<8000;i++){x.fillStyle=`rgba(255,235,210,${rnd()*.025})`;x.fillRect(rnd()*256,rnd()*256,1,1)}
  }else if(kind==='black')x.fillStyle='#080808',x.fillRect(0,0,256,256);
  else if(kind==='white')x.fillStyle='#d7d1bd',x.fillRect(0,0,256,256);
  else if(kind==='red')x.fillStyle='#6d161b',x.fillRect(0,0,256,256);
  return c;
}
const textures={};['wallpaper','wood','carpet','apartmentwall','parquet','rug','nightwindow','darkwall','concrete','ceiling','metal','brass','darkwood','fabric','black','white','red'].forEach(k=>textures[k]=makeTextureFromCanvas(pattern(k),true));
function labelTexture(text,fg='#d44332'){const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');x.fillStyle='#080808';x.fillRect(0,0,c.width,c.height);x.fillStyle=fg;x.font='bold 82px monospace';x.textAlign='center';x.textBaseline='middle';x.shadowColor=fg;x.shadowBlur=10;x.fillText(text,128,66);return makeTextureFromCanvas(c,false)}
textures.indR=labelTexture('R');textures.ind1=labelTexture('1');textures.ind2=labelTexture('2');textures.ind3=labelTexture('3');
function controlsPosterTexture(){
  const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d');
  x.fillStyle='#d8d0b9';x.fillRect(0,0,512,512);
  x.fillStyle='#2b2925';x.fillRect(18,18,476,476);
  x.fillStyle='#cfc5aa';x.fillRect(27,27,458,458);
  x.fillStyle='#25231f';x.textAlign='center';x.textBaseline='middle';x.font='bold 38px monospace';x.fillText('CONTROLES',256,76);
  x.strokeStyle='#6e5a42';x.lineWidth=4;x.beginPath();x.moveTo(68,112);x.lineTo(444,112);x.stroke();
  const rows=[['SHIFT','CORRER'],['ESPAÇO','PULAR'],['CTRL / C','AGACHAR'],['Q','INVENTÁRIO']];
  rows.forEach((r,i)=>{const y=154+i*82;x.fillStyle='#39342e';x.fillRect(68,y-31,150,62);x.strokeStyle='#171513';x.lineWidth=4;x.strokeRect(68,y-31,150,62);x.fillStyle='#eee4ca';x.font='bold 24px monospace';x.fillText(r[0],143,y);x.fillStyle='#25231f';x.font='bold 27px monospace';x.textAlign='left';x.fillText(r[1],250,y);x.textAlign='center'});
  x.fillStyle='#675845';x.font='16px monospace';x.fillText('mantenha a calma',256,476);
  return makeTextureFromCanvas(c,false);
}
textures.controlsPoster=controlsPosterTexture();
function familyPhotoTexture(){
  const c=document.createElement('canvas');c.width=256;c.height=192;const x=c.getContext('2d');
  x.fillStyle='#1b120d';x.fillRect(0,0,256,192);x.fillStyle='#9a7956';x.fillRect(10,10,236,172);x.fillStyle='#b9ab91';x.fillRect(19,19,218,154);
  x.fillStyle='#6b665e';x.fillRect(24,24,208,144);x.fillStyle='#817b70';x.fillRect(24,112,208,56);
  const people=[{cx:72,cy:80,r:23,body:'#4a4038'},{cx:128,cy:94,r:17,body:'#6a4a45'},{cx:184,cy:80,r:22,body:'#4d514c'}];
  for(const p of people){x.fillStyle='#c8aa8c';x.beginPath();x.arc(p.cx,p.cy,p.r,0,Math.PI*2);x.fill();x.fillStyle=p.body;x.fillRect(p.cx-p.r*1.15,p.cy+p.r*.62,p.r*2.3,55)}
  x.fillStyle='rgba(25,20,16,.30)';for(let i=0;i<700;i++)x.fillRect(rnd()*256,rnd()*192,1,1);
  x.fillStyle='rgba(235,216,184,.18)';x.fillRect(28,30,4,130);x.fillRect(36,26,110,3);
  return makeTextureFromCanvas(c,false);
}
textures.familyPhoto=familyPhotoTexture();

function materials3(){
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
  g.fillStyle='#111c29';g.fillRect(0,0,256,256);for(let i=0;i<36;i++){g.fillStyle='rgba(195,211,221,.35)';g.fillRect(rnd()*256,rnd()*170,1,1);}for(let i=0;i<12;i++){let h=30+rnd()*45;g.fillStyle='#070d13';g.fillRect(i*24,256-h,22,h);g.fillStyle='#635944';g.fillRect(i*24+6,265-h,2,3);}textures.night3=makeTextureFromCanvas(c,false);
  g.fillStyle='#796c51';g.fillRect(0,0,256,256);for(let y=12;y<256;y+=36)for(let x=12;x<256;x+=36){g.fillStyle='#454d39';g.fillRect(x-2,y-7,4,17);g.fillRect(x-7,y,14,3);g.fillStyle='#9b7860';for(const [dx,dy]of [[-4,-4],[4,-4],[-4,4],[4,4]]){g.beginPath();g.arc(x+dx,y+dy,4,0,7);g.fill();}g.fillStyle='#c1a278';g.fillRect(x-2,y-2,4,4);}textures.floral=makeTextureFromCanvas(c,true);
  g.fillStyle='#251a10';g.fillRect(0,0,256,256);g.fillStyle='#b6a380';g.beginPath();g.arc(128,128,105,0,7);g.fill();g.strokeStyle='#2a241d';g.lineWidth=5;for(let i=0;i<12;i++){let a=i*Math.PI/6;g.beginPath();g.moveTo(128+Math.sin(a)*82,128+Math.cos(a)*82);g.lineTo(128+Math.sin(a)*95,128+Math.cos(a)*95);g.stroke();}g.beginPath();g.moveTo(82,93);g.lineTo(128,128);g.lineTo(165,66);g.stroke();textures.clock3=makeTextureFromCanvas(c,false);
  g.fillStyle='#49321f';g.fillRect(0,0,256,256);for(let i=0;i<800;i++){g.fillStyle='rgba(12,8,4,.08)';g.fillRect(rnd()*256,0,1,256);}
  for(const y of [22,126])for(const x of [18,135]){g.fillStyle='#21170f';g.fillRect(x,y,102,95);g.fillStyle='#756044';g.fillRect(x+3,y+3,96,89);g.fillStyle='#45301f';g.fillRect(x+8,y+8,86,79);g.strokeStyle='#967850';g.strokeRect(x+12,y+12,78,71);}
  g.fillStyle='#bba678';g.font='20px Georgia';g.textAlign='center';g.fillStyle='#b19b62';g.fillRect(211,105,14,34);g.fillRect(196,113,27,5);g.fillStyle='#0a0a08';g.fillRect(216,126,4,7);textures.door3=makeTextureFromCanvas(c,false);
}materials3();
const imageNames=['janitor_idle','janitor_talk1','janitor_talk2','receptionist_idle_upper','receptionist_talk_upper','breaker_closed','breaker_open','breaker_on','ghost_idle','girl_idle','girl_smoke','girl_talk','girl_worried','father_seated','father_walk1','father_walk2','father_walk3','father_walk4','father_die1','father_die2','father_die3','father_die4','tv_eye','tv_cracked','tv_broken','cigarette_smoke1','cigarette_smoke2','cigarette_smoke3','cigarette_smoke4','cigarette_smoke5','cigarette_smoke6','oldlady_idle','oldlady_talk','oldlady_worried','oldlady_walk1','oldlady_walk2','oldlady_walk3','oldlady_walk4','blackcat_sleep','blackcat_meow1','blackcat_meow2','orangecat_sleep','orangecat_meow1','orangecat_meow2','siamesecat_sleep','siamesecat_meow1','siamesecat_meow2','kitten_collectible','vault_door'];
const imgs={}, spriteTex={};
const assetsReady=Promise.all(imageNames.map(n=>new Promise(res=>{const im=new Image();im.onload=()=>{imgs[n]=im;spriteTex[n]=textureFromImage(im);res()};im.onerror=()=>res();im.src=location.protocol==='file:'&&window.PREDIO_LOCAL_SPRITES?window.PREDIO_LOCAL_SPRITES[n]:`assets/${n}.png`})));

function resize(){const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.floor(innerWidth*dpr)),h=Math.max(1,Math.floor(innerHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}}window.addEventListener('resize',resize);resize();

gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(.02,.02,.018,1);gl.uniform1i(loc.uTex,0);

// ------------------------------------------------------------
// World description
// ------------------------------------------------------------
let scene='none', objects=[], sprites=[], interactables=[], colliders=[], spriteOccluders=[], elevatorTarget='1';
const domSpriteEls=new Map();
const story={receptionistDone:false,elevatorUnlocked:false,janitorDone:false,hasScrewdriver:false,breakerOpened:false,powerOn:false,janitorPresent:true,horrorDoorTriggered:false,
  girlTalked:false,apartmentUnlocked:false,breaker2Opened:false,power2:false,fatherChasing:false,fatherDead:false,escapeSealed:false,tvDamage:0,girlPresent:true,cigaretteTaken:false,
  oldLadyTalked:false,frontDoorUnlocked:false,serviceUnlocked:false,breaker3Opened:false,power3:false,kittenTaken:false,oldLadyChasing:false};
const player={x:0,z:2.45,floorY:0,jumpY:0,yVel:0,yaw:0,pitch:0,eye:1.68,targetEye:1.68,bob:0,bobAmt:0,bobOffset:0};
let mode='menu', last=performance.now(), powerFlicker=0, elevatorDoors=0, elevatorDoorTarget=0, elevatorRideFX=0, elevatorRideStarted=0, pausePrevMode='world', attackBusy=false, wasAirborne=false;
let horrorDoorOpen=0,horrorDoorTarget=0,horrorIntensity=0,horrorDeathBusy=false,nextHorrorPulse=0;
let apartmentDoorOpen=.14,apartmentDoorTarget=.14,frontDoorOpen=.14,frontDoorTarget=.14,wireContext='floor1',floor2DeathBusy=false,floor3DeathBusy=false,captionTimer=0;
let fatherPos={x:0,z:-13.65},fatherPath=[],fatherPathTimer=0,fatherAnimClock=0,fatherStepClock=0,fatherStun=0,fatherDying=false,fatherDeathFrame=0,fatherDeathStarted=0;
let oldLadyPos={x:4.90,z:-5.10},oldLadyTarget={x:4.90,z:-5.10},oldLadyAnimClock=0,oldLadyAlertTimer=0,noiseLevel=0,lockpickDir=1,lockpickCursor=.08,lockpickSweet=.52,lockpickHits=0;
const floor3CatDefs=[{id:'cat0',x:6.05,z:-8.9,y:.49,type:'blackcat'},{id:'cat1',x:6.50,z:-4.2,y:1.66,type:'orangecat'},{id:'cat2',x:10.85,z:-8.6,y:.72,type:'siamesecat'},{id:'cat3',x:8.15,z:-9.65,y:1.52,type:'blackcat'},{id:'cat4',x:8.0,z:-1,y:.92,type:'orangecat'}];
let floor3CatState=floor3CatDefs.map(()=>({awakeUntil:0}));
let cameraSnapUntil=0,tvHitCooldownUntil=0,gazeDisturbance=0,currentCheckpoint='none';
let inventory=[];
let checkpointSnapshot10=null;
function restoreInventory10(cp){const d=checkpointSnapshot10?.checkpoint===cp?checkpointSnapshot10:readSave();inventory=d?.checkpoint===cp&&Array.isArray(d.inventory)?[...d.inventory]:inventory.filter(id=>cp==='janitor'?false:cp==='girl'?id==='cigarette':cp==='oldlady'?id!=='kitten'&&id!=='matches':id!=='matches');story.cigaretteTaken=inventory.includes('cigarette');story.kittenTaken=inventory.includes('kitten');renderInventory()}
const SAVE_KEY='predio_esquizito_save_v2';
const keys={};

function box(x,y,z,sx,sy,sz,tex,tint=[1,1,1],uv=[1,1],opts={}){objects.push({x,y,z,sx,sy,sz,tex,tint,uv,...opts})}
function solidRect(x,z,sx,sz,top=1.2,climbable=false,id=''){colliders.push({x,z,hx:sx/2,hz:sz/2,top,climbable,id})}
function occluderRect(x,z,sx,sz,id=''){spriteOccluders.push({x,z,hx:sx/2,hz:sz/2,id})}
function sprite(id,x,z,h,texName,opts={}){const im=imgs[texName];const ratio=im?im.width/im.height:.7;sprites.push({id,x,z,y:opts.y||0,h,w:h*ratio,texName,billboard:opts.billboard!==false,rotY:opts.rotY||0,visible:opts.visible!==false,alpha:opts.alpha??1,emissive:opts.emissive||0,...opts})}
function readSave(){try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;const d=JSON.parse(raw);return d&&['janitor','girl','oldlady','chef','wedding'].includes(d.checkpoint)?d:null}catch(e){return null}}
function saveCheckpoint(cp){checkpointSnapshot10={checkpoint:cp,inventory:[...inventory]};currentCheckpoint=cp;try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:2,checkpoint:cp,inventory:[...inventory]}))}catch(e){}refreshContinueButton()}
function clearSave(){checkpointSnapshot10=null;try{localStorage.removeItem(SAVE_KEY)}catch(e){}currentCheckpoint='none'}
function refreshContinueButton(){if(!ui.continueBtn)return;ui.continueBtn.classList.toggle('hidden',!readSave())}
function renderInventory(){
  if(!ui.inventorySlots)return;ui.inventorySlots.replaceChildren();
  if(!inventory.length){const e=document.createElement('div');e.className='inventoryEmpty';e.textContent='VAZIO';ui.inventorySlots.appendChild(e);return}
  for(const id of inventory){
    const slot=document.createElement('div');slot.className='inventorySlot';
    if(id==='cigarette'){const im=document.createElement('img');im.src='assets/cigarette_smoke1.png';im.alt='';slot.appendChild(im);const sp=document.createElement('span');sp.textContent='CIGARRO DA GAROTA';slot.appendChild(sp)}
    else if(id==='electricKey13'){slot.innerHTML='<span class="keyIcon13">⚿</span><span>CHAVE DA ELÉTRICA</span>';}
    else if(id==='matches'){const sp=document.createElement('span');sp.textContent='FÓSFOROS • BELLEVUE';slot.appendChild(sp)}
    else if(id==='kitten'){const im=document.createElement('img');im.src='assets/kitten_collectible.png';im.alt='';slot.appendChild(im);const sp=document.createElement('span');sp.textContent='GATINHA BB';slot.appendChild(sp)}
    ui.inventorySlots.appendChild(slot)
  }
}
function openInventory(){if(mode!=='world')return;mode='inventory';for(const k of Object.keys(keys))keys[k]=false;renderInventory();ui.inventory.classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock();sfx.click()}
function closeInventory(){if(mode!=='inventory')return;ui.inventory.classList.add('hidden');mode='world';sfx.click();requestLock()}
function collectCigarette(){if(story.cigaretteTaken)return;story.cigaretteTaken=true;if(!inventory.includes('cigarette'))inventory.push('cigarette');sprites=sprites.filter(s=>s.id!=='cigarette');interactables=interactables.filter(t=>t.id!=='cigarette');sfx.pickup();showCaption('','CIGARRO ADICIONADO AO INVENTÁRIO.',1150);renderInventory()}
function collectKitten(){if(story.kittenTaken)return;story.kittenTaken=true;if(!inventory.includes('kitten'))inventory.push('kitten');sprites=sprites.filter(s=>s.id!=='kitten');interactables=interactables.filter(t=>t.id!=='kitten');sfx.pickup();showCaption('','GATINHA BB ADICIONADA AO INVENTÁRIO.',1250);renderInventory()}
function loadCheckpoint(data){
  if(!data)return false;checkpointSnapshot10={...data,inventory:[...(data.inventory||[])]};inventory=Array.isArray(data.inventory)?data.inventory.filter(x=>x==='cigarette'||x==='kitten'||x==='matches'):[];story.cigaretteTaken=inventory.includes('cigarette');story.kittenTaken=inventory.includes('kitten');currentCheckpoint=data.checkpoint;
  story.receptionistDone=true;story.elevatorUnlocked=true;story.janitorDone=true;story.hasScrewdriver=true;story.horrorDoorTriggered=false;story.breakerOpened=false;story.powerOn=false;story.janitorPresent=true;
  ui.title.classList.add('hidden');ui.letter.classList.add('hidden');introAudio.stopMenu();ui.itemHud.classList.remove('hidden');ui.hand.classList.remove('hidden');ui.hand.src='assets/screwdriver_hold.png';ui.controls.classList.remove('hidden');
  if(data.checkpoint==='janitor'){
    setScene('floor1');player.x=0;player.z=-1.45;player.yaw=0;player.pitch=0;mode='world';setObjective('Encontre o disjuntor no fim do corredor');return true;
  }
  story.powerOn=true;story.janitorPresent=false;story.girlTalked=true;story.apartmentUnlocked=true;story.breaker2Opened=false;story.power2=false;story.fatherChasing=false;story.fatherDead=false;story.escapeSealed=false;story.tvDamage=0;story.girlPresent=true;
  if(data.checkpoint==='girl'){
    apartmentDoorOpen=1;apartmentDoorTarget=1;setScene('floor2');player.x=0;player.z=-6.55;player.yaw=0;player.pitch=0;mode='world';setObjective('Entre no apartamento e encontre o disjuntor');return true;
  }
  story.power2=true;story.fatherDead=true;if(data.checkpoint==='chef'){story.power3=true;resetKitchen4(true);return true}resetFloor3Checkpoint();return true;
}

function addElevatorExterior(axis,centerA,centerB,side='reception'){
  // axis x = mounted on x wall; axis z = mounted on z wall
  if(axis==='x'){
    const x=centerA,z=centerB;box(x,1.2,z-1.02,.16,2.55,.16,'brass',[1.15,1.0,.72],[1,2]);box(x,1.2,z+1.02,.16,2.55,.16,'brass',[1.15,1.0,.72],[1,2]);box(x,2.47,z,.16,.16,2.2,'brass',[1.15,1.0,.72],[2,1]);
    box(x-.025,1.18,z-.49,.10,2.25,.96,'metal',[.88,.86,.82],[1,2],{eDoor:'a',axis:'x',baseZ:z-.49});box(x-.025,1.18,z+.49,.10,2.25,.96,'metal',[.88,.86,.82],[1,2],{eDoor:'b',axis:'x',baseZ:z+.49});
    box(x-.08,2.68,z,.09,.24,.64,side==='reception'?'indR':side==='floor3'?'ind3':side==='floor2'?'ind2':'ind1',[1,1,1],[1,1],{emissive:.32});box(x-.1,1.25,z+1.28,.09,.18,.18,'brass',[1.2,1,.5],[1,1],{emissive:.05});
  }else{
    const x=centerA,z=centerB;box(x-1.02,1.2,z,.16,2.55,.16,'brass',[1.15,1.0,.72],[1,2]);box(x+1.02,1.2,z,.16,2.55,.16,'brass',[1.15,1.0,.72],[1,2]);box(x,2.47,z,2.2,.16,.16,'brass',[1.15,1.0,.72],[2,1]);
    box(x-.49,1.18,z-.025,.96,2.25,.10,'metal',[.88,.86,.82],[1,2],{eDoor:'a',axis:'z',baseX:x-.49});box(x+.49,1.18,z-.025,.96,2.25,.10,'metal',[.88,.86,.82],[1,2],{eDoor:'b',axis:'z',baseX:x+.49});
    box(x,2.68,z-.08,.64,.24,.09,side==='reception'?'indR':side==='floor3'?'ind3':side==='floor2'?'ind2':'ind1',[1,1,1],[1,1],{emissive:.32});box(x+1.28,1.25,z-.1,.18,.18,.09,'brass',[1.2,1,.5],[1,1],{emissive:.05});
  }
}
function addElevatorPreview(axis,centerA,centerB){
  // A shallow but fully modeled cabin behind the exterior doors. It is visible
  // before the transition, so an opening elevator never reveals a fake wall.
  if(axis==='x'){
    const wallX=centerA,cz=centerB,cx=wallX+.72;
    box(cx,-.03,cz,1.35,.08,1.86,'concrete',[.42,.40,.36],[2,2]);
    box(cx,2.42,cz,1.35,.10,1.86,'metal',[.62,.63,.60],[2,2]);
    box(wallX+1.37,1.18,cz,.10,2.40,1.86,'metal',[.54,.55,.53],[2,2]);
    box(cx,1.18,cz-.94,1.35,2.40,.08,'metal',[.54,.55,.53],[2,2]);
    box(cx,1.18,cz+.94,1.35,2.40,.08,'metal',[.54,.55,.53],[2,2]);
    box(wallX+1.31,.52,cz,.03,.92,1.68,'darkwood',[.68,.54,.43],[2,2]);
    box(cx,.52,cz-.90,1.25,.92,.03,'darkwood',[.68,.54,.43],[2,1]);box(cx,.52,cz+.90,1.25,.92,.03,'darkwood',[.68,.54,.43],[2,1]);
    box(cx,2.28,cz,.78,.06,.72,'white',[.86,.88,.82],[1,1],{elevatorLight:true});
    box(wallX+1.31,1.24,cz+.48,.03,.64,.34,'black',[.52,.52,.50],[1,1]);
  }else{
    const cx=centerA,wallZ=centerB,cz=wallZ+.72;
    box(cx,-.03,cz,1.86,.08,1.35,'concrete',[.42,.40,.36],[2,2]);
    box(cx,2.42,cz,1.86,.10,1.35,'metal',[.62,.63,.60],[2,2]);
    box(cx,1.18,wallZ+1.37,1.86,2.40,.10,'metal',[.54,.55,.53],[2,2]);
    box(cx-.94,1.18,cz,.08,2.40,1.35,'metal',[.54,.55,.53],[2,2]);
    box(cx+.94,1.18,cz,.08,2.40,1.35,'metal',[.54,.55,.53],[2,2]);
    box(cx,.52,wallZ+1.31,1.68,.92,.03,'darkwood',[.68,.54,.43],[2,2]);
    box(cx-.90,.52,cz,.03,.92,1.25,'darkwood',[.68,.54,.43],[1,2]);box(cx+.90,.52,cz,.03,.92,1.25,'darkwood',[.68,.54,.43],[1,2]);
    box(cx,2.28,cz,.72,.06,.78,'white',[.86,.88,.82],[1,1],{elevatorLight:true});
  }
}

function setScene(name){
  ui.noiseHud.classList.add('hidden');for(const k of Object.keys(keys))keys[k]=false;scene=name;objects=[];sprites=[];interactables=[];colliders=[];spriteOccluders=[];elevatorDoors=0;elevatorDoorTarget=0;player.floorY=0;
  domSpriteEls.clear();if(ui.spriteOverlay)ui.spriteOverlay.replaceChildren();
  if(name==='reception') buildReception();
  if(name==='floor1') buildFloor1();
  if(name==='floor2') buildFloor2();
  if(name==='floor3') buildFloor3();
  if(name==='floor4') buildFloor4();
  if(typeof hud4!=='undefined')hud4.classList.toggle('hidden',name!=='floor4');
  if(name==='elevator') buildElevator();
  remasterScene(name);
  sfx.setRoom(scene,scene==='floor2'?story.power2:scene==='floor3'?story.power3:story.powerOn);
}

// Architectural finish shared by the original floors; circulation stays clear.
function remasterScene(name){
  if(!['reception','floor1','floor2','elevator'].includes(name))return;
  const original=[...objects];
  const trim=[.65,.53,.39];
  for(const o of original){
    const wall=['wallpaper','apartmentwall','darkwall'].includes(o.tex)&&o.sy>=2.9;
    if(wall){
      // Wood skirting and picture rail follow each wall segment, never an opening.
      for(const [y,h] of [[.12,.20],[.84,.045],[2.77,.09]])
        box(o.x,y,o.z,o.sx<.3?o.sx+.055:o.sx,h,o.sz<.3?o.sz+.055:o.sz,'darkwood',trim,[Math.max(o.sx,o.sz),1]);
      if(name==='floor2'&&o.tex==='wallpaper')o.tint=[.69,.66,.59];
      if(name==='reception')o.tint=[.94,.87,.73];
    }
    const door=o.tex==='darkwood'&&o.sy>2&&o.sy<2.6&&(o.sx<.15||o.sz<.15);
    if(door){
      o.tex='door3';o.uv=[1,1];o.tint=name==='floor1'?[.60,.66,.60]:[.85,.78,.65];o.knockable=true;
      const alongZ=o.sx<.15,w=alongZ?o.sz:o.sx;
      // Static doorway casing; moving leaves retain their original hinge.
      const cx=o.apartmentDoor?0:o.x,cz=o.z;
      for(const sign of [-1,1])box(cx+(alongZ?0:sign*(w/2+.045)),1.19,cz+(alongZ?sign*(w/2+.045):0),alongZ?.14:.085,2.38,alongZ?.085:.14,'darkwood',trim);
      box(cx,2.38,cz,alongZ?.15:w+.18,.10,alongZ?w+.18:.15,'darkwood',trim);
    }
    if(o.powerLight){
      box(o.x,o.y+.025,o.z,o.sx+.12,.08,o.sz+.12,'metal',[.35,.38,.36]);
      for(const d of [-.32,0,.32])box(o.x,o.y-.048,o.z+d*o.sz,o.sx,.014,.018,'metal',[.28,.30,.29]);
    }
    if(o.tex==='white'&&o.sy>.18&&o.sx>.4&&o.sx<.6&&o.sz===o.sx){o.geometry='shade';o.tint=[1,.85,.61];}
  }
  function frame(x,y,z,w,h,rot=0){
    box(x,y,z,w+.10,h+.10,.045,'darkwood',trim,[1,1],{rotY:rot});
    // Box face uses the same orientation as its frame.
    box(x+Math.sin(rot)*.029,y,z+Math.cos(rot)*.029,w,h,.015,'familyPhoto',[.70,.65,.54],[1,1],{rotY:rot});
  }
  function sconce(x,z,rot=0){
    box(x,2.02,z,.16,.32,.08,'brass',[.68,.53,.30],[1,1],{rotY:rot});
    box(x+Math.sin(rot)*.08,2.08,z+Math.cos(rot)*.08,.12,.23,.12,'white',[1,.78,.44],[1,1],{geometry:'round',emissive:.48});
  }
  if(name==='reception'){
    objects=objects.filter(o=>!(o.tex==='brass'&&o.sx===2.35&&o.sy===.56));
    for(const o of objects)if(o.tex==='white'&&o.sy===.18)o.geometry='shade';
    const floor=objects.find(o=>o.y<0&&o.tex==='wood');floor.tex='parquet';floor.tint=[.85,.76,.62];
    const rug=objects.find(o=>o.tex==='carpet');rug.tex='rug';rug.uv=[1,2];rug.tint=[.80,.72,.59];
    // Recessed desk panels, fine trim, ledger and brass service bell.
    for(const x of [-.96,0,.96]){
      box(x,.47,-2.215,.84,.68,.035,'darkwood',[.50,.37,.23]);
      box(x,.47,-2.188,.72,.54,.025,'wood',[.72,.52,.32]);
    }
    box(0,.85,-2.17,3.05,.035,.03,'brass',[.72,.56,.28]);
    box(-.53,1.035,-2.42,.49,.032,.30,'darkwood',[.35,.30,.22]);
    box(-.53,1.055,-2.42,.44,.008,.26,'white',[.77,.69,.49]);
    for(let i=0;i<5;i++)box(-.53,1.061,-2.51+i*.04,.32,.002,.003,'black',[.3,.3,.3]);
    box(.78,1.06,-2.20,.18,.08,.18,'brass',[1,.84,.47],[1,1],{geometry:'shade'});
    frame(-2.7,1.9,-3.30,.95,.58);
    for(const x of [-2,2])sconce(x,-3.32);
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      const x=-1.05+col*.34,y=1.55+row*.3;
      box(x,y,-3.245,.018,.12,.02,'brass',[.85,.66,.32]);
      box(x,y-.07,-3.245,.065,.05,.025,'white',[.76,.65,.46]);
    }
    // Leather luggage on the existing cart, within its collider.
    box(3.38,.42,-1.38,.52,.48,.62,'fabric',[.48,.32,.22]);
    for(const x of [3.23,3.53])box(x,.42,-1.055,.04,.46,.012,'brass',[.52,.42,.26]);
    box(3.38,.69,-1.38,.18,.055,.075,'darkwood',[.37,.26,.18]);
    for(const x of [-3.78,-3.25,-2.72])box(x,.54,.17,.49,.14,.51,'fabric',[.76,.53,.38]);
  }
  if(name==='floor1'){
    // Maintenance character: cable conduits, repair plates and worn runner.
    box(0,.007,-6.1,1.32,.014,8.4,'concrete',[.51,.56,.51],[2,12]);
    for(const x of [-.97,.97])box(x,2.46,-6.0,.035,.035,9.25,'metal',[.49,.47,.36]);
    for(const z of [-2.1,-4.6,-7.1,-9.6])for(const x of [-1.03,1.03]){
      box(x,2.46,z,.09,.12,.12,'metal',[.44,.42,.35]);
      box(x,2.18,z,.065,.18,.15,'metal',[.46,.49,.43]);
    }
    box(-1.88,.69,.15,.32,1.38,.75,'metal',[.38,.45,.41]);
    solidRect(-1.88,.15,.32,.75,1.4,false,'maintenanceCabinet');
    for(const y of [.55,.68,.81,.94])box(-1.708,y,.15,.015,.027,.48,'black',[.22,.26,.22]);
    for(const x of [-1.7,1.7])sconce(x,2.61,Math.PI);
    box(0,2.24,-10.69,.62,.24,.05,'metal',[.50,.51,.40]);
    box(0,2.24,-10.65,.48,.13,.025,'white',[.82,.92,.70],[1,1],{emissive:.35});
  }
  if(name==='floor2'){
    for(const x of [-1.07,1.07])solidRect(x,-10.84,.42,.16,3,false,'entryJamb');
    for(const x of [-1.06,1.06])solidRect(x,-27.20,.88,.16,3,false,'serviceJamb');
    // Keep the girl outside the player's collision capsule at close range.
    if(story.girlPresent)solidRect(-.72,-4.05,.34,.34,1.70,false,'girl');
    for(const z of [-6.95,-9.55])frame(1.16,1.73,z,.65,.83,-Math.PI/2);
    for(const x of [-1.7,1.7])sconce(x,2.61,Math.PI);
    // Curtains stay flush to the window; the central view and walking lane are clear.
    for(const z of [-4.78,-3.32])for(let i=0;i<4;i++)box(-1.12+i*.012,1.65,z+i*.028,.07,1.60,.035,'fabric',[.42,.47,.48]);
    for(const z of [-18.7,-21.4]){
      frame(-4.08,1.69,z,.66,.82,Math.PI/2);
      frame(4.08,1.76,z,.72,.52,-Math.PI/2);
    }
    // Book spines rest on the existing shelves rather than floating in space.
    for(const y of [.34,.76,1.18])for(let i=0;i<9;i++)box(-3.65,y+.14,-14.03+i*.14,.28,.28+(i%3)*.025,.09,'fabric',[[.52,.32,.24],[.33,.42,.37],[.62,.52,.32]][i%3]);
    frame(3.1,1.92,-10.96,.82,.60,Math.PI);
    for(const x of [-.78,.78])box(x,.57,-15.697,.055,.035,.016,'brass',[.75,.60,.34]);
    // Cables lead toward the service panel without crossing floor space.
    for(const x of [-.88,.88])box(x,2.62,-26.75,.035,.035,4.6,'metal',[.48,.43,.29]);
    for(const x of [-.65,.65])box(x,1.48,-29.36,.045,2.62,.045,'metal',[.50,.48,.39]);
    box(0,.025,-28.30,1.20,.04,.68,'black',[.43,.43,.39]);
  }
  if(name==='elevator'){
    for(const x of [-1,1])for(const z of [-.72,.72])box(x,1.12,z,.04,.08,.09,'brass',[.68,.58,.36]);
    for(const x of [-.99,.99])box(x,1.13,0,.04,.045,1.5,'brass',[.85,.73,.46]);
    box(0,.014,0,1.68,.025,1.72,'rug',[.62,.58,.48]);
  }
}

function buildReception(){
  player.x=0;player.z=2.35;player.floorY=0;player.jumpY=0;player.yVel=0;player.yaw=0;player.pitch=0;
  // compact lobby, 9.0m x 7.0m
  box(0,-.09,0,9.0,.18,7.0,'wood',[1.0,.92,.82],[5,4]);box(0,3.04,0,9,.16,7,'ceiling',[.92,.88,.78],[5,4]);
  box(0,1.48,-3.5,9,3,.16,'wallpaper',[.96,.88,.72],[6,2]);box(-4.5,1.48,0,.16,3,7,'wallpaper',[.96,.88,.72],[5,2]);
  // right wall is split around the elevator opening
  box(4.5,1.48,-2.02,.16,3,2.96,'wallpaper',[.96,.88,.72],[3,2]);box(4.5,1.48,2.58,.16,3,1.84,'wallpaper',[.96,.88,.72],[2,2]);box(4.5,2.73,.55,.16,.50,2.20,'wallpaper',[.96,.88,.72],[2,1]);
  box(0,1.48,3.5,9,3,.16,'wallpaper',[.90,.83,.70],[6,2]);
  // baseboards and crown molding
  box(0,.09,-3.38,9,.18,.12,'darkwood',[1.05,.86,.7],[5,1]);box(-4.38,.09,0,.12,.18,7,'darkwood',[1.05,.86,.7],[5,1]);box(4.38,.09,0,.12,.18,7,'darkwood',[1.05,.86,.7],[5,1]);
  box(0,2.86,-3.38,9,.12,.12,'darkwood',[.86,.72,.58],[5,1]);
  // carpet runner
  box(0,.015,.52,2.05,.03,4.7,'carpet',[1,.94,.84],[2,5]);
  // reception desk and sprite
  box(0,.47,-2.52,3.05,.94,.58,'darkwood',[1.08,.93,.8],[3,1]);box(0,.97,-2.52,3.28,.10,.74,'darkwood',[1.16,.98,.8],[3,1]);
  box(0,.61,-2.20,2.35,.56,.06,'brass',[.55,.43,.24],[2,1]);
  sprite('receptionist',0,-2.77,1.34,'receptionist_idle_upper',{y:.94,emissive:.055});
  // sofa left
  box(-3.25,.27,.25,2.15,.48,.78,'fabric',[1.0,.72,.58],[2,1]);box(-3.25,.69,.56,2.15,.62,.20,'fabric',[.92,.66,.52],[2,1]);box(-4.19,.55,.28,.23,.72,.80,'fabric',[.92,.66,.52],[1,1]);box(-2.31,.55,.28,.23,.72,.80,'fabric',[.92,.66,.52],[1,1]);
  // side table + lamp
  box(-3.3,.33,-.65,.72,.07,.72,'darkwood',[1,.9,.75],[1,1]);box(-3.3,.17,-.65,.08,.34,.08,'darkwood',[1,.9,.75],[1,1]);box(-3.3,.86,-.65,.12,.75,.12,'brass',[.8,.68,.4],[1,1]);box(-3.3,1.25,-.65,.55,.22,.55,'white',[.86,.72,.52],[1,1],{emissive:.22});
  // wall frames
  box(-2.7,1.9,-3.39,1.22,.82,.05,'darkwood',[.9,.75,.55],[1,1]);box(-2.7,1.9,-3.35,1.02,.64,.03,'black',[.34,.32,.28],[1,1]);
  // modest old chandelier instead of a giant floating block
  box(0,2.82,.40,.08,.34,.08,'brass',[1.15,.88,.42],[1,1]);
  box(0,2.63,.40,.72,.05,.08,'brass',[1.05,.82,.42],[2,1]);
  box(-.33,2.48,.40,.18,.18,.18,'white',[1,.83,.50],[1,1],{emissive:.62});box(.33,2.48,.40,.18,.18,.18,'white',[1,.83,.50],[1,1],{emissive:.62});
  box(0,2.48,.12,.18,.18,.18,'white',[1,.83,.50],[1,1],{emissive:.50});
  // small hotel details: bell, key cubbies and a luggage cart
  box(.78,1.045,-2.20,.12,.08,.12,'brass',[1.35,1.03,.55],[1,1],{emissive:.08});
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){box(-1.05+col*.34,1.55+row*.30,-3.33,.28,.22,.06,'darkwood',[.74,.57,.42],[1,1]);box(-1.05+col*.34,1.55+row*.30,-3.29,.18,.10,.03,'black',[.5,.43,.34],[1,1]);}
  box(3.38,.08,-1.38,.58,.16,.78,'brass',[.72,.62,.40],[1,1]);box(3.15,.93,-1.38,.06,1.62,.06,'brass',[.85,.73,.42],[1,2]);box(3.61,.93,-1.38,.06,1.62,.06,'brass',[.85,.73,.42],[1,2]);box(3.38,1.72,-1.38,.52,.05,.06,'brass',[.85,.73,.42],[1,1]);
  box(3.22,.08,-1.65,.17,.17,.17,'black',[.45,.45,.43],[1,1]);box(3.55,.08,-1.65,.17,.17,.17,'black',[.45,.45,.43],[1,1]);
  // entrance doors behind player
  box(-.67,1.25,3.39,1.22,2.48,.08,'darkwood',[.95,.78,.62],[1,2]);box(.67,1.25,3.39,1.22,2.48,.08,'darkwood',[.95,.78,.62],[1,2]);box(-.67,1.35,3.34,.88,1.56,.04,'black',[.22,.25,.24],[1,1]);box(.67,1.35,3.34,.88,1.56,.04,'black',[.22,.25,.24],[1,1]);
  // real-looking elevator on right wall
  addElevatorPreview('x',4.48,.55);
  addElevatorExterior('x',4.39,.55,'reception');
  // Controls poster: teaches sprint/jump/crouch naturally inside the reception.
  box(3.18,1.65,-3.34,1.58,1.58,.045,'controlsPoster',[1,1,1],[1,1],{emissive:.045});
  box(3.18,1.65,-3.38,1.72,1.72,.06,'darkwood',[.72,.58,.44],[1,1]);
  // Physical furniture collision: no walking through the set dressing.
  solidRect(0,-2.52,3.35,.84,1.04,false);
  solidRect(-3.25,.22,2.18,.74,.52,true);solidRect(-3.25,.57,2.18,.22,1.00,false);
  solidRect(-4.19,.28,.25,.82,.92,false);solidRect(-2.31,.28,.25,.82,.92,false);
  solidRect(-3.30,-.65,.78,.78,.38,true);solidRect(3.38,-1.38,.72,.94,1.78,false);
  interactables.push({id:'receptionist',x:0,z:-2.22,range:2.1,label:'FALAR'});interactables.push({id:'elevator',x:4.02,z:.55,range:1.5,label:'USAR ELEVADOR'});
  setObjective('Fale com o recepcionista');
}

function buildFloor1(){
  player.x=0;player.z=1.68;player.floorY=0;player.jumpY=0;player.yVel=0;player.yaw=0;player.pitch=0;
  // lobby floor & ceiling
  box(0,-.09,.75,4.8,.18,4.1,'concrete',[.68,.67,.61],[4,3]);box(0,3.0,.75,4.8,.16,4.1,'ceiling',[.57,.59,.54],[4,3]);
  box(-2.4,1.46,.75,.16,3,4.1,'darkwall',[.68,.73,.66],[3,2]);box(2.4,1.46,.75,.16,3,4.1,'darkwall',[.68,.73,.66],[3,2]);
  // rear wall split around the elevator opening
  box(-1.75,1.46,2.8,1.30,3,.16,'darkwall',[.68,.73,.66],[1,2]);box(1.75,1.46,2.8,1.30,3,.16,'darkwall',[.68,.73,.66],[1,2]);box(0,2.73,2.8,2.20,.50,.16,'darkwall',[.68,.73,.66],[2,1]);
  // corridor
  box(0,-.09,-6.05,2.4,.18,9.6,'concrete',[.67,.66,.60],[2,9]);box(0,3.0,-6.05,2.4,.16,9.6,'ceiling',[.56,.58,.52],[2,9]);
  box(-1.2,1.46,-6.05,.16,3,9.6,'darkwall',[.62,.67,.61],[9,2]);
  // Right corridor wall is split around the second door so the room is a real 3D space.
  box(1.2,1.46,-3.26,.16,3,4.02,'darkwall',[.62,.67,.61],[4,2]);
  box(1.2,1.46,-8.59,.16,3,4.52,'darkwall',[.62,.67,.61],[5,2]);
  box(1.2,2.62,-5.80,.16,.76,1.05,'darkwall',[.62,.67,.61],[1,1]);
  box(0,1.46,-10.85,2.4,3,.16,'darkwall',[.62,.67,.61],[2,2]);
  // The forbidden room behind the second door on the right. Its surfaces are almost black;
  // the deeper the player walks, the flashlight and ambient illumination are also suppressed.
  box(3.25,-.09,-5.80,4.10,.18,4.20,'concrete',[.095,.095,.09],[4,4],{horrorRoom:true});
  box(3.25,3.0,-5.80,4.10,.16,4.20,'black',[.14,.14,.14],[3,3],{horrorRoom:true});
  box(5.30,1.46,-5.80,.16,3.0,4.20,'black',[.12,.11,.11],[3,2],{horrorRoom:true});
  box(3.25,1.46,-3.70,4.10,3.0,.16,'black',[.12,.11,.11],[3,2],{horrorRoom:true});
  box(3.25,1.46,-7.90,4.10,3.0,.16,'black',[.12,.11,.11],[3,2],{horrorRoom:true});
  // Automatic door: closed in the wall, then swings inward into the dark room.
  box(1.14,1.18,-5.80,.08,2.25,1.05,'darkwood',[.49,.41,.35],[1,2],{horrorDoor:true,hingeX:1.14,hingeZ:-6.325,doorHalf:.525});
  if(!story.powerOn)sprite('ghost',4.56,-5.80,1.86,'ghost_idle',{y:0,alpha:.64,ghost:true});
  occluderRect(1.20,-3.26,.20,4.02,'f1wallA');occluderRect(1.20,-8.59,.20,4.52,'f1wallB');occluderRect(3.25,-3.70,4.10,.20,'f1roomFront');occluderRect(3.25,-7.90,4.10,.20,'f1roomBack');

  // transition wall shoulders between lobby and corridor
  box(-1.8,1.46,-1.28,1.2,3,.16,'darkwall',[.66,.7,.64],[1,2]);box(1.8,1.46,-1.28,1.2,3,.16,'darkwall',[.66,.7,.64],[1,2]);
  // elevator exterior behind player
  addElevatorPreview('z',0,2.80);
  addElevatorExterior('z',0,2.72,'floor1');
  // janitor + cleaning cart
  if(story.janitorPresent)sprite('janitor',0,-.46,1.78,'janitor_idle',{emissive:.045});
  box(1.43,.48,.15,.65,.82,.42,'metal',[.52,.55,.54],[1,1]);box(1.43,.98,.15,.08,.85,.08,'metal',[.52,.55,.54],[1,1]);box(1.24,.20,-.02,.18,.18,.18,'black',[.4,.4,.4],[1,1]);box(1.62,.20,-.02,.18,.18,.18,'black',[.4,.4,.4],[1,1]);
  // utility doors on both sides
  const doorZ=[-3.2,-5.8,-8.35];
  for(const z of doorZ){
    box(-1.11,1.18,z,.08,2.25,1.05,'darkwood',[.58,.50,.43],[1,2]);
    box(-1.07,1.17,z+.34,.04,.10,.10,'brass',[.8,.65,.35],[1,1],{emissive:.03});
    if(z!==-5.8){box(1.11,1.18,z,.08,2.25,1.05,'darkwood',[.58,.50,.43],[1,2]);box(1.07,1.17,z-.34,.04,.10,.10,'brass',[.8,.65,.35],[1,1],{emissive:.03})}
  }
  // overhead fluorescent fixtures
  for(const z of [1.15,-1.9,-4.4,-6.9,-9.4])box(0,2.82,z,.52,.09,1.15,'white',[.92,.95,.85],[1,1],{powerLight:true});
  // pipes/cable trays to make corridor believable
  box(-.88,2.68,-6.1,.09,.09,8.9,'metal',[.45,.46,.43],[6,1]);box(.88,2.68,-6.1,.09,.09,8.9,'metal',[.45,.46,.43],[6,1]);
  // breaker fixed to end wall
  sprite('breaker',0,-10.72,1.18,story.powerOn?'breaker_on':story.breakerOpened?'breaker_open':'breaker_closed',{billboard:false,rotY:0,y:.55,emissive:.075});
  // Keep the player from walking through / inside the janitor sprite. Apart from being
  // physically correct, this prevents extreme close-up billboard distortion.
  if(story.janitorPresent)solidRect(0,-.46,.72,.50,1.78,false,'janitor');
  solidRect(1.43,.15,.78,.68,1.42,false);
  interactables.push({id:'janitor',x:0,z:-.46,range:2.15,label:'FALAR'});interactables.push({id:'breaker',x:0,z:-10.15,range:1.65,label:'ABRIR O DISJUNTOR'});interactables.push({id:'elevator',x:0,z:2.35,range:1.5,label:'USAR ELEVADOR'});
  setObjective(story.janitorDone?'Conserte o disjuntor no fim do corredor':'Fale com o faxineiro');
}


function buildFloor2(){
  player.x=0;player.z=1.70;player.floorY=0;player.jumpY=0;player.yVel=0;player.yaw=0;player.pitch=0;
  apartmentDoorOpen=story.apartmentUnlocked?1:.14;apartmentDoorTarget=apartmentDoorOpen;

  // Landing: closed shell, no visible void between pieces.
  box(0,-.09,.72,4.9,.18,4.15,'wood',[.48,.42,.34],[4,3]);box(0,3.02,.72,4.9,.16,4.15,'ceiling',[.50,.48,.43],[4,3]);
  box(-2.45,1.47,.72,.16,3.02,4.15,'wallpaper',[.48,.45,.39],[3,2]);box(2.45,1.47,.72,.16,3.02,4.15,'wallpaper',[.48,.45,.39],[3,2]);
  box(-1.78,1.47,2.80,1.34,3.02,.16,'wallpaper',[.48,.45,.39],[1,2]);box(1.78,1.47,2.80,1.34,3.02,.16,'wallpaper',[.48,.45,.39],[1,2]);box(0,2.75,2.80,2.22,.50,.16,'wallpaper',[.48,.45,.39],[2,1]);
  // Clean shoulder walls bridge the wide elevator landing to the narrow hall with no cracks.
  box(-1.865,1.47,-1.245,1.17,3.02,.22,'wallpaper',[.45,.42,.37],[1,2]);box(1.865,1.47,-1.245,1.17,3.02,.22,'wallpaper',[.45,.42,.37],[1,2]);
  solidRect(-1.865,-1.245,1.20,.24,3.00,false,'landingShoulderL');solidRect(1.865,-1.245,1.20,.24,3.00,false,'landingShoulderR');
  addElevatorPreview('z',0,2.80);addElevatorExterior('z',0,2.72,'floor2');

  // Residential hall.
  box(0,-.09,-6.05,2.55,.18,9.65,'carpet',[.35,.27,.26],[2,9]);box(0,3.02,-6.05,2.55,.16,9.65,'ceiling',[.45,.43,.40],[2,9]);
  box(-1.28,1.47,-6.05,.16,3.02,9.65,'wallpaper',[.41,.39,.36],[9,2]);box(1.28,1.47,-6.05,.16,3.02,9.65,'wallpaper',[.41,.39,.36],[9,2]);
  box(-1.07,1.47,-10.84,.42,3.02,.16,'wallpaper',[.41,.39,.36],[1,2]);box(1.07,1.47,-10.84,.42,3.02,.16,'wallpaper',[.41,.39,.36],[1,2]);box(0,2.72,-10.84,1.72,.54,.16,'wallpaper',[.41,.39,.36],[1,1]);
  box(-2.74,1.47,-10.84,2.92,3.02,.16,'wallpaper',[.35,.32,.30],[3,2]);box(2.74,1.47,-10.84,2.92,3.02,.16,'wallpaper',[.35,.32,.30],[3,2]);
  box(-1.13,.13,-6.05,.07,.18,9.52,'darkwood',[.30,.22,.18],[8,1]);box(1.13,.13,-6.05,.07,.18,9.52,'darkwood',[.30,.22,.18],[8,1]);
  for(const z of [-2.35,-5.55,-8.45]){
    box(-1.19,1.17,z,.08,2.24,1.02,'darkwood',[.45,.34,.28],[1,2]);box(1.19,1.17,z,.08,2.24,1.02,'darkwood',[.45,.34,.28],[1,2]);
    box(-1.15,1.12,z+.32,.04,.09,.09,'brass',[.72,.58,.30],[1,1],{emissive:.02});box(1.15,1.12,z-.32,.04,.09,.09,'brass',[.72,.58,.30],[1,1],{emissive:.02});
  }
  // Moonlit window; the sky texture is physically inside the window frame.
  box(-1.205,1.62,-4.05,.025,1.48,1.72,'nightwindow',[1,1,1],[1,1],{emissive:.20});
  box(-1.16,2.39,-4.05,.05,.08,1.86,'darkwood',[.46,.38,.31],[1,1]);box(-1.16,.85,-4.05,.05,.08,1.86,'darkwood',[.46,.38,.31],[1,1]);box(-1.08,.78,-4.05,.22,.12,1.95,'darkwood',[.42,.34,.29],[1,1]);
  box(-1.16,1.62,-4.91,.05,1.55,.08,'darkwood',[.46,.38,.31],[1,1]);box(-1.16,1.62,-3.19,.05,1.55,.08,'darkwood',[.46,.38,.31],[1,1]);
  if(story.girlPresent)sprite('girl',-.72,-4.05,1.70,'girl_idle',{y:0,girl:true});
  else if(story.girlTalked&&!story.cigaretteTaken)sprite('cigarette',-.98,-4.05,.60,'cigarette_smoke1',{y:.80,cigarette:true,alpha:.88});
  for(const z of [1.1,-1.9,-4.55,-7.15,-9.55])box(0,2.84,z,.54,.08,1.08,'white',[.82,.84,.77],[1,1],{powerLight:true});

  // Apartment front wall + door.
  box(.86,1.17,-10.78,1.72,2.25,.08,'darkwood',[.43,.32,.25],[1,2],{apartmentDoor:true,hingeX:.86,hingeZ:-10.78,doorHalf:.86});

  // LIVING ROOM: one continuous room, no separated wall pieces.
  box(0,-.09,-13.75,8.40,.18,5.50,'parquet',[.92,.88,.82],[7,5]);box(0,3.02,-13.75,8.40,.16,5.50,'ceiling',[.36,.35,.33],[6,4]);
  box(0,-.09,-10.94,1.72,.18,.34,'parquet',[.92,.88,.82],[2,1]);box(0,3.02,-10.94,1.72,.16,.34,'ceiling',[.36,.35,.33],[2,1]);
  box(-4.20,1.47,-13.71,.16,3.02,5.58,'apartmentwall',[.78,.74,.70],[5,2]);box(4.20,1.47,-13.71,.16,3.02,5.58,'apartmentwall',[.78,.74,.70],[5,2]);
  // Central rear wall only; side openings lead to the two loop corridors.
  box(0,1.47,-16.50,3.10,3.02,.16,'apartmentwall',[.76,.72,.68],[3,2]);
  box(0,.015,-13.70,4.20,.03,2.50,'rug',[.80,.72,.68],[2,2]);
  box(-4.00,.13,-13.75,.07,.18,5.30,'darkwood',[.30,.22,.18],[5,1]);box(4.00,.13,-13.75,.07,.18,5.30,'darkwood',[.30,.22,.18],[5,1]);

  // TWO SIDE CORRIDORS. Each has its own continuous floor, ceiling and both walls.
  box(-2.88,-.09,-20.00,2.45,.18,7.00,'parquet',[.86,.82,.77],[2,6]);box(-2.88,3.02,-20.00,2.45,.16,7.00,'ceiling',[.34,.33,.31],[2,6]);
  box(2.88,-.09,-20.00,2.45,.18,7.00,'parquet',[.86,.82,.77],[2,6]);box(2.88,3.02,-20.00,2.45,.16,7.00,'ceiling',[.34,.33,.31],[2,6]);
  // Outer walls.
  box(-4.20,1.47,-20.00,.16,3.02,7.00,'apartmentwall',[.74,.70,.66],[6,2]);box(4.20,1.47,-20.00,.16,3.02,7.00,'apartmentwall',[.74,.70,.66],[6,2]);
  // Inner walls / sealed central core.
  box(-1.55,1.47,-20.00,.16,3.02,7.00,'apartmentwall',[.72,.68,.64],[6,2]);box(1.55,1.47,-20.00,.16,3.02,7.00,'apartmentwall',[.72,.68,.64],[6,2]);
  box(-2.88,.015,-20.00,1.18,.03,6.35,'rug',[.72,.65,.62],[1,6]);box(2.88,.015,-20.00,1.18,.03,6.35,'rug',[.72,.65,.62],[1,6]);

  // BACK CORRIDOR connects the left and right corridors and exposes the breaker hallway.
  box(0,-.09,-24.35,8.40,.18,1.70,'parquet',[.84,.80,.75],[7,2]);box(0,3.02,-24.35,8.40,.16,1.70,'ceiling',[.34,.33,.31],[7,2]);
  box(-4.20,1.47,-24.35,.16,3.02,1.70,'apartmentwall',[.72,.68,.64],[2,2]);box(4.20,1.47,-24.35,.16,3.02,1.70,'apartmentwall',[.72,.68,.64],[2,2]);
  // Back wall split around centered breaker-hall doorway.
  box(-2.73,1.47,-25.20,2.94,3.02,.16,'apartmentwall',[.70,.67,.63],[3,2]);box(2.73,1.47,-25.20,2.94,3.02,.16,'apartmentwall',[.70,.67,.63],[3,2]);box(0,2.72,-25.20,2.52,.54,.16,'apartmentwall',[.70,.67,.63],[2,1]);
  // Core back wall: closes the central block cleanly.
  box(0,1.47,-23.50,3.10,3.02,.16,'apartmentwall',[.72,.68,.64],[3,2]);
  box(0,.015,-24.35,5.80,.03,.95,'rug',[.72,.65,.62],[5,1]);

  // BREAKER HALL: centered, long enough to read as a real passage.
  box(0,-.09,-26.35,2.50,.18,2.30,'parquet',[.82,.78,.73],[2,2]);box(0,3.02,-26.35,2.50,.16,2.30,'ceiling',[.35,.34,.32],[2,2]);
  box(-1.25,1.47,-26.35,.16,3.02,2.30,'apartmentwall',[.68,.65,.62],[2,2]);box(1.25,1.47,-26.35,.16,3.02,2.30,'apartmentwall',[.68,.65,.62],[2,2]);

  // BREAKER ROOM: complete floor, ceiling and four walls with a doorway back to the hall.
  box(0,-.09,-28.35,3.00,.18,2.30,'concrete',[.44,.42,.39],[3,2]);box(0,3.02,-28.35,3.00,.16,2.30,'ceiling',[.39,.38,.35],[3,2]);
  box(-1.50,1.47,-28.35,.16,3.02,2.30,'darkwall',[.43,.44,.40],[2,2]);box(1.50,1.47,-28.35,.16,3.02,2.30,'darkwall',[.43,.44,.40],[2,2]);
  box(0,1.47,-29.50,3.00,3.02,.16,'darkwall',[.43,.44,.40],[3,2]);
  box(-1.06,1.47,-27.20,.88,3.02,.16,'darkwall',[.43,.44,.40],[1,2]);box(1.06,1.47,-27.20,.88,3.02,.16,'darkwall',[.43,.44,.40],[1,2]);box(0,2.72,-27.20,1.24,.54,.16,'darkwall',[.43,.44,.40],[1,1]);

  // Fixtures make the route legible after the breaker is restored.
  for(const [lx,lz] of [[0,-12.25],[0,-15.10],[-2.88,-18.00],[-2.88,-21.70],[2.88,-18.00],[2.88,-21.70],[0,-24.35],[0,-26.35],[0,-28.35]]) box(lx,2.84,lz,.50,.08,.92,'white',[.78,.78,.70],[1,1],{powerLight:true});
  box(-3.72,1.00,-15.20,.15,1.70,.15,'metal',[.48,.48,.46],[1,1]);box(-3.72,1.92,-15.20,.54,.24,.54,'white',[.75,.70,.58],[1,1],{powerLight:true});

  // TV + armchair. The lane in front of the TV is intentionally clear.
  box(0,.38,-16.03,2.08,.70,.64,'darkwood',[.36,.27,.21],[2,1]);box(0,.82,-16.18,1.72,.09,.76,'darkwood',[.43,.32,.24],[2,1]);
  box(0,1.25,-16.38,1.78,1.06,.05,'black',[.12,.14,.12],[1,1],{emissive:.20,tvGlow:true});
  sprite('tv',0,-16.30,1.25,story.tvDamage===0?'tv_eye':story.tvDamage===1?'tv_cracked':'tv_broken',{y:.66,tv:true});
  box(-.70,.42,-14.20,1.50,.64,1.04,'fabric',[.40,.28,.23],[2,1]);box(-.70,1.00,-13.82,1.50,1.10,.26,'fabric',[.36,.25,.21],[2,1]);
  box(-1.47,.67,-14.16,.20,.48,1.00,'fabric',[.36,.25,.21],[1,1]);box(.07,.67,-14.16,.20,.48,1.00,'fabric',[.36,.25,.21],[1,1]);
  if(!story.power2&&!story.fatherDead)sprite('father_seated',-.70,-14.12,1.78,'father_seated',{y:.02,fatherSeated:true});
  if((story.fatherChasing||fatherDying)&&!story.fatherDead)sprite('father',fatherPos.x,fatherPos.z,2.48,'father_walk1',{y:0,monster:true});

  // Slim bookcase replaces the bulky sofa/table and stays flush to the wall.
  box(-3.93,.95,-13.45,.42,1.78,1.48,'darkwood',[.36,.26,.20],[1,2]);
  for(const sy of [.30,.72,1.14,1.56])box(-3.68,sy,-13.45,.50,.07,1.42,'darkwood',[.46,.34,.25],[1,1]);
  for(const bz of [-13.92,-13.62,-13.28,-12.98])box(-3.61,.54,bz,.18,.34,.16,'red',[.46,.31,.27],[1,1]);
  // A small family photograph: father, daughter and mother.
  box(-3.69,1.35,-13.08,.045,.62,.82,'familyPhoto',[1,1,1],[1,1],{emissive:.025});
  box(3.38,.42,-12.45,1.42,.86,.46,'darkwood',[.38,.28,.22],[2,1]);box(3.38,.98,-12.45,1.08,.08,.56,'darkwood',[.45,.33,.24],[2,1]);
  box(4.00,1.40,-12.47,.16,2.16,.42,'darkwood',[.32,.24,.20],[1,2]);

  // All furniture hugs walls; the center route remains open.
  solidRect(-3.93,-13.45,.48,1.54,1.88,false,'familyShelf');
  solidRect(3.38,-12.45,1.50,.58,1.06,false,'console2');solidRect(4.00,-12.47,.20,.48,2.16,false,'shelfTall');
  solidRect(-.70,-14.20,1.55,1.16,1.35,false,'chair2');solidRect(0,-16.18,2.16,.90,1.18,false,'tvStand');

  // Structural occlusion / monster collision exactly follows the new wall layout.
  for(const [x,z,sx,sz,id] of [
    [-1.55,-20.00,.18,7.00,'coreL'],[1.55,-20.00,.18,7.00,'coreR'],[0,-23.50,3.10,.18,'coreBack'],
    [-4.20,-20.00,.18,7.00,'outerL'],[4.20,-20.00,.18,7.00,'outerR'],[-4.20,-24.35,.18,1.70,'outerBackL'],[4.20,-24.35,.18,1.70,'outerBackR'],[0,-16.50,3.10,.18,'livingBack'],
    [-2.73,-25.20,2.94,.18,'backL'],[2.73,-25.20,2.94,.18,'backR'],[-1.25,-26.35,.18,2.30,'breakerHallL'],[1.25,-26.35,.18,2.30,'breakerHallR'],
    [-1.50,-28.35,.18,2.30,'breakerRoomL'],[1.50,-28.35,.18,2.30,'breakerRoomR'],[0,-29.50,3.00,.18,'breakerRoomBack']
  ]){occluderRect(x,z,sx,sz,id);solidRect(x,z,sx+.02,sz+.02,3.00,false,'wall_'+id)}
  occluderRect(-2.74,-10.84,2.94,.20,'apartmentFrontL');occluderRect(2.74,-10.84,2.94,.20,'apartmentFrontR');
  solidRect(-2.74,-10.84,2.94,.22,3.00,false,'wallFrontL');solidRect(2.74,-10.84,2.94,.22,3.00,false,'wallFrontR');

  sprite('breaker2',0,-29.22,1.18,story.power2?'breaker_on':story.breaker2Opened?'breaker_open':'breaker_closed',{y:.55,breaker:true});
  interactables.push({id:'girl',x:-.72,z:-4.05,range:2.05,label:'FALAR'});
  if(!story.girlPresent&&story.girlTalked&&!story.cigaretteTaken)interactables.push({id:'cigarette',x:-.98,z:-4.05,range:1.62,label:'PEGAR CIGARRO'});
  interactables.push({id:'breaker2',x:0,z:-28.62,range:1.90,label:'ABRIR O DISJUNTOR'});
  interactables.push({id:'elevator',x:0,z:2.35,range:1.5,label:'USAR ELEVADOR'});
  if(story.fatherDead)setObjective('Volte para o elevador');
  else if(story.girlTalked)setObjective(story.power2?(story.escapeSealed?'DESTRUA A TELEVISÃO':'FUJA DO APARTAMENTO'):'Entre no apartamento e encontre o disjuntor');
  else setObjective('Fale com a garota perto da janela');
}

// The third floor follows the supplied plan: hall, living room, bedroom,
// service room and a sealed vault. Geometry and collision share one definition.
function wall3(x,z,w,d,tex='wallpaper'){
  box(x,1.5,z,w,3,d,tex,[1.05,.96,.85],[Math.max(w,d)/2,1]);
  box(x,.10,z,w+.025,.20,d+.025,'darkwood',[1.3,1.15,1],[Math.max(w,d),1]);
  box(x,2.82,z,w+.025,.10,d+.025,'wood',[1.1,1,.85],[Math.max(w,d),1]);
  solidRect(x,z,w,d,3,false,'wall3');occluderRect(x,z,w,d,'wall3');
}
function room3(x,z,w,d,tex='parquet'){
  box(x,-.10,z,w,.20,d,tex,[1.5,1.35,1.20],[w/2,d/2]);
  box(x,3.02,z,w,.20,d,'ceiling',[.72,.67,.59],[w/2,d/2]);
}
function furniture3(id,x,z,w,d,h,tex='darkwood',tint=[1.6,1.35,1.1]){
  if(id==='kittenTable'){box(x,h-.07,z,w,.14,d,tex,tint,[2,1]);for(const dx of [-w*.4,w*.4])for(const dz of [-d*.36,d*.36])box(x+dx,h*.46,z+dz,.085,h*.92,.085,tex,tint);}
  else box(x,h/2,z,w,h,d,tex,tint,[2,1]);solidRect(x,z,w,d,id==='kittenTable'?.77:id==='bed3'?.71:id==='sofa'?.58:h,true,id);
}
function lamp3(x,z,y=1.05){
  box(x,y/2,z,.07,y,.07,'brass');box(x,.035,z,.32,.06,.32,'darkwood');
  box(x,y+.20,z,.48,.38,.48,'fabric',[1.8,1.55,1.0],[1,1],{emissive:.35,geometry:'shade'});
  box(x,y+.02,z,.25,.035,.25,'white',[1,.65,.28],[1,1],{emissive:.65});
}
function photo3(x,y,z,w=.42){box(x,y,z,w,.52,.07,'brass');box(x,y,z+.045,w-.065,.44,.015,'familyPhoto',[.85,.76,.62]);}
function buildFloor3(){
  player.x=0;player.z=1.65;player.floorY=0;player.jumpY=0;player.yVel=0;player.yaw=0;player.pitch=0;
  frontDoorOpen=story.frontDoorUnlocked?1:0;frontDoorTarget=frontDoorOpen;
  serviceDoorOpen=story.serviceUnlocked?1:0;oldLadyPath=[];oldLadyPathClock=0;
  room3(0,.35,2.8,5.3,'concrete');room3(0,-6.15,2.8,7.9,'carpet');
  wall3(-1.4,-3.65,.18,13);wall3(0,-10.1,2.98,.18);
  wall3(-1.28,3,.3,.18);wall3(1.28,3,.3,.18);box(0,2.75,3,2.3,.5,.18,'wallpaper');
  addElevatorPreview('z',0,3.02);addElevatorExterior('z',0,2.94,'floor3');
  // Main wall has a real 1.8m opening. No hidden wall behind the door.
  wall3(1.4,-8.2,.18,3.8);wall3(1.4,-2.15,.18,4.7);wall3(1.4,1.6,.18,2.8);
  box(1.4,2.8,-5.4,.18,.4,1.8,'wallpaper');
  for(const z of [-3,-6.4,-8.65]){
    box(-1.285,1.18,z,.045,2.35,1.18,'door3',[1.0,1,1],[1,1],{knockable:true});
    for(const dz of [-.65,.65])box(-1.24,1.2,z+dz,.1,2.45,.09,'darkwood',[1.9,1.6,1.3]);
    box(-1.24,2.45,z,.1,.12,1.39,'darkwood',[1.9,1.6,1.3]);
    box(-1.20,1.07,z-.4,.08,.09,.15,'brass',[1.5,1.4,1]);
  }
  box(0,1.65,-9.985,1.84,1.65,.04,'night3',[1,1,1],[1,1],{emissive:.24});
  for(const x of [-.98,0,.98])box(x,1.65,-9.94,.065,1.85,.10,'wood');
  for(const y of [.74,1.64,2.56])box(0,y,-9.94,2.02,.075,.10,'wood');
  box(0,.69,-9.87,2.1,.09,.28,'concrete');
  room3(4.2,-6.15,5.6,7.9);room3(9.5,-5.1,5,10);room3(9.5,1.35,5,2.7,'concrete');
  wall3(6.7,-10.1,10.8,.18);wall3(12,-3.65,.18,13);
  wall3(4.2,-2.2,5.6,.18);wall3(7,-8.85,.18,2.5);wall3(7,-2.85,.18,5.7);
  box(7,2.78,-6.65,.18,.44,1.9,'wallpaper');
  wall3(8.03,0,2.06,.18,'concrete');wall3(11.32,0,1.36,.18,'concrete');
  box(9.85,2.8,0,1.65,.4,.18,'concrete');wall3(9.5,2.7,5.18,.18,'concrete');wall3(7,1.35,.18,2.7,'concrete');
  // Sealed vault: backing wall plus fixed, depth-tested textured surface.
  box(4.45,1.35,-2.32,2.35,2.7,.12,'metal',[.48,.52,.5]);
  objects.push({x:4.45,y:.04,z:-2.40,sx:2.16,sy:2.58,sz:1,tex:'vault_door',tint:[.82,.91,.87],uv:[1,1],surface:true,rotY:Math.PI,emissive:.10});
  for(const x of [3.28,5.62])box(x,1.36,-2.41,.025,2.61,.025,'white',[.15,.48,.40],[1,1],{emissive:.4});
  box(4.45,.025,-2.42,2.30,.018,.06,'white',[.15,.45,.35],[1,1],{emissive:.45});
  for(const z of [-6.36,-4.44])box(1.36,1.34,z,.24,2.68,.13,'darkwood',[2,1.7,1.2]);
  box(1.36,2.69,-5.4,.24,.18,2.05,'wood',[1.9,1.65,1.3]);
  box(1.4,1.27,-5.4,.12,2.54,1.8,'door3',[1.4,1.15,.92],[1,1],{frontDoor:true});
  box(9.85,1.25,0,1.65,2.5,.12,'door3',[1.05,1,.88],[1,1],{serviceDoor:true});
  for(const [x,z] of [[0,-3],[0,-8],[4.4,-5.8],[9.5,-4.2],[10,1.3]]){box(x,2.86,z,.52,.08,.52,'brass');box(x,2.81,z,.43,.045,.43,'white',[1,.86,.65],[1,1],{powerLight:true});}
  // Layered domestic furniture, all outside the principal circulation routes.
  box(4.3,.014,-6.2,3.8,.025,4.4,'rug',[1.8,1.5,1.3],[1,1]);
  furniture3('sofa',4.0,-9.48,2.9,.87,.43,'floral');
  box(4,.87,-9.75,2.95,.78,.23,'floral',[1.15,1,.83],[3,1]);
  for(const x of [2.51,5.49])box(x,.63,-9.47,.22,.56,.92,'floral');
  for(const x of [3.1,4,4.9])box(x,.49,-9.39,.85,.18,.74,'floral',[1.05,.95,.8]);
  furniture3('kittenTable',4.9,-7.55,1.2,.72,.69);
  box(4.9,.73,-7.55,1.35,.08,.85,'wood',[1.6,1.4,1.2]);
  box(4.9,.78,-7.55,.83,.015,.53,'white',[.69,.67,.55]);
  box(5.33,.85,-7.5,.13,.14,.13,'white',[1,1,1],[1,1],{geometry:'round'});box(5.33,.926,-7.5,.10,.006,.10,'black',[1,1,1],[1,1],{geometry:'round'});
  furniture3('crystal',6.5,-4.2,.55,2.35,1.65);
  for(const y of [.40,.91,1.45]){box(6.18,y,-4.2,.07,.05,2.13,'brass');for(const z of [-4.9,-4.3,-3.7])box(6.17,y+.14,z,.11,.23,.13,'white',[.64,.73,.7]);}
  furniture3('tvStand',2.06,-3.0,.70,1.0,.65);box(2.08,1.00,-3,.64,.65,.77,'darkwood');box(2.415,1.01,-3,.035,.47,.60,'black');
  furniture3('chair3',6.05,-8.9,.74,.68,.47,'floral');box(6.06,.89,-9.17,.75,.8,.12,'wood');
  lamp3(2.0,-9.35,1.48);lamp3(6.55,-2.75,1.55);
  photo3(3.1,1.97,-9.96,.6);photo3(4.3,2.1,-9.96,.5);photo3(5.3,1.95,-9.96,.4);
  box(2.1,2.3,-9.95,.46,.57,.06,'clock3');
  // Bedroom: open access, bed and side furniture, five cats in total.
  furniture3('bed3',10.85,-8.62,1.72,2.35,.5,'wood');box(10.85,.59,-8.62,1.82,.23,2.33,'floral',[.82,.91,.88],[2,3]);
  box(10.85,.80,-9.51,1.82,.22,.53,'white',[.73,.7,.61]);box(10.85,.95,-9.87,1.99,1.3,.12,'wood');
  furniture3('bedside',9.28,-9.32,.62,.62,.7);lamp3(9.28,-9.32,1.0);
  furniture3('wardrobe',11.55,-4.75,.68,2.05,2.40);
  for(const z of [-5.25,-4.25])box(11.18,1.1,z,.05,.2,.06,'brass');
  furniture3('dresser',8.12,-1.0,1.47,.6,.9);
  for(const y of [.22,.49,.77]){box(8.12,y,-1.325,1.31,.20,.035,'wood');box(8.12,y,-1.36,.17,.045,.035,'brass');}
  photo3(8.33,1.24,-.95,.3);box(7.76,1.08,-1.0,.13,.28,.13,'white');
  furniture3('catShelf',8.15,-9.65,1.12,.55,1.4);box(8.15,1.47,-9.65,1.18,.07,.59,'wood');
  box(9.5,.012,-4,2.8,.02,3.9,'rug',[.9,1,1.05]);
  // Service room with exposed pipes and supplies.
  for(const x of [7.28,7.53]){box(x,1.5,2.48,.065,2.8,.065,'metal');box(x,2.73,1.35,.065,.065,2.35,'metal');}
  furniture3('serviceShelf',7.62,1.35,.65,1.5,1.2,'metal');
  for(const z of [.95,1.65])box(7.65,1.43,z,.44,.45,.44,'wood');
  box(10.25,1.55,2.51,1.0,1.40,.14,'metal',[.57,.6,.59]);
  sprite('breaker3',10.25,2.39,1.12,'breaker_closed',{y:1.0,breaker:true});
  oldLadyPos=story.oldLadyTalked?{x:4.9,z:-8.65}:{x:2.05,z:-5.4};oldLadyTarget={...oldLadyPos};
  sprite('oldlady',oldLadyPos.x,oldLadyPos.z,1.78,'oldlady_idle',{oldlady:true});
  for(const c of floor3CatDefs)sprite(c.id,c.x,c.z,.46,c.type+'_sleep',{y:c.y,cat:true});
  if(!story.kittenTaken)sprite('kitten',4.9,-7.55,.40,'kitten_collectible',{y:.79,kitten:true});
  interactables.push({id:'bigdoor',x:1.4,z:-5.4,range:1.8,label:'BATER NA PORTA'},
    {id:'serviceDoor',x:9.85,z:-.10,range:1.6,label:'ARROMBAR FECHADURA'},
    {id:'breaker3',x:10.25,z:2.36,range:1.65,label:'ABRIR DISJUNTOR'},
    {id:'elevator',x:0,z:2.65,range:1.5,label:'USAR ELEVADOR'});
  if(!story.kittenTaken)interactables.push({id:'kitten',x:4.9,z:-7.55,range:1.6,label:'PEGAR GATINHA'});
  setObjective(story.power3?'Volte para o elevador':!story.oldLadyTalked?'Bata na porta da casa':!story.frontDoorUnlocked?'Arrombe a porta sem fazer barulho':'Encontre o disjuntor • mova-se em silêncio');
}

function buildElevator(){
  player.x=0;player.z=.35;player.floorY=0;player.jumpY=0;player.yVel=0;player.yaw=0;player.pitch=0;
  box(0,-.07,0,2.15,.14,2.1,'concrete',[.38,.36,.32],[2,2]);box(0,2.46,0,2.15,.14,2.1,'metal',[.7,.72,.68],[2,2]);
  box(-1.08,1.2,0,.12,2.4,2.1,'metal',[.72,.72,.69],[2,2]);box(1.08,1.2,0,.12,2.4,2.1,'metal',[.72,.72,.69],[2,2]);box(0,1.2,1.05,2.15,2.4,.12,'metal',[.70,.70,.67],[2,2]);
  // front doors
  box(-.52,1.2,-1.05,1.02,2.4,.10,'metal',[.82,.81,.77],[1,2]);box(.52,1.2,-1.05,1.02,2.4,.10,'metal',[.82,.81,.77],[1,2]);
  // door frame / ceiling light / rails
  box(-1.02,1.25,-.97,.10,2.55,.15,'brass',[.72,.61,.36],[1,2]);box(1.02,1.25,-.97,.10,2.55,.15,'brass',[.72,.61,.36],[1,2]);box(0,2.48,-.97,2.10,.10,.15,'brass',[.72,.61,.36],[2,1]);
  box(0,2.29,.15,1.05,.08,.88,'white',[.9,.92,.85],[1,1],{emissive:.55,elevatorLight:true});
  box(0,.94,.96,1.55,.06,.06,'brass',[.74,.64,.43],[2,1]);box(-.97,.94,.1,.06,.06,1.25,'brass',[.74,.64,.43],[2,1]);
  // lower wood paneling makes the cabin feel like an old residential elevator
  box(-1.01,.53,.03,.05,1.00,1.72,'darkwood',[.72,.58,.46],[2,2]);box(1.01,.53,.03,.05,1.00,1.72,'darkwood',[.72,.58,.46],[2,2]);box(0,.53,.99,1.78,1.00,.05,'darkwood',[.72,.58,.46],[2,1]);
  box(0,2.25,-.94,.45,.18,.05,elevatorTarget==='4'?'ind3':elevatorTarget==='3'?'ind2':'ind1',[1,1,1],[1,1],{emissive:.42});
  // control panel on right wall
  box(1.00,1.28,-.20,.05,.72,.48,'black',[.55,.55,.53],[1,1]);for(let i=0;i<4;i++)box(.97,1.52-i*.16,-.20+.10*(i%2),.05,.08,.08,'brass',[1.2,.95,.5],[1,1],{emissive:.06});
}

// ------------------------------------------------------------
// Draw
// ------------------------------------------------------------
function viewData(){
  let shakeX=0,shakeY=0,shakeZ=0;if(scene==='elevator'&&elevatorRideFX>0){const t=(performance.now()-elevatorRideStarted)/1000;const a=.010+.010*Math.min(1,elevatorRideFX);shakeX=Math.sin(t*31)*a+Math.sin(t*13)*a*.55;shakeY=Math.sin(t*43)*a*.55;shakeZ=Math.sin(t*23)*a*.35;}
  if(gazeDisturbance>.01){const t=performance.now()*.001,a=.010*gazeDisturbance;shakeX+=Math.sin(t*37)*a+Math.sin(t*19)*a*.45;shakeY+=Math.sin(t*43)*a*.65;shakeZ+=Math.sin(t*29)*a*.30;}
  const eyeH=player.eye+player.floorY+player.jumpY+player.bobOffset+shakeY;const eye=[player.x+shakeX,eyeH,player.z+shakeZ];const cp=Math.cos(player.pitch),f=[Math.sin(player.yaw)*cp,Math.sin(player.pitch),-Math.cos(player.yaw)*cp];const center=[eye[0]+f[0],eye[1]+f[1],eye[2]+f[2]];const view=M.lookAt(eye,center,[0,1,0]);const proj=M.perspective(70*Math.PI/180,canvas.width/canvas.height,.04,45);return {eye,f,vp:M.multiply(proj,view)};
}
function setCommon(v){
  gl.uniformMatrix4fv(loc.uViewProj,false,v.vp);gl.uniform3fv(loc.uCamera,new Float32Array(v.eye));gl.uniform3fv(loc.uViewDir,new Float32Array(v.f));
  let amb=.6,tint=[1.0,.92,.78],flash=0,fog=[.10,.085,.06],fogD=.022;
  if(scene==='floor1'){
    amb=story.powerOn?.54:.20;tint=story.powerOn?[.96,.94,.84]:[.64,.73,.68];flash=story.powerOn?0:.95;fog=story.powerOn?[.075,.07,.055]:[.025,.033,.03];fogD=story.powerOn?.026:.060;
    if(!story.powerOn){const t=performance.now()*.001;amb*=.82+.18*(.5+.5*Math.sin(t*2.7))*(.72+.28*(.5+.5*Math.sin(t*7.1)));}
    if(powerFlicker>0)amb*=.18+Math.random()*1.12;
  }else if(scene==='floor2'){
    const inApartment=player.z<-10.85;
    if(story.power2){amb=.50;tint=[.91,.83,.71];flash=0;fog=[.050,.045,.041];fogD=.027;if(story.fatherChasing){const t=performance.now()*.001;amb*=.86+.14*(.5+.5*Math.sin(t*9.6));}}
    else{amb=inApartment?.27:.29;tint=inApartment?[.80,.75,.68]:[.70,.78,.91];flash=inApartment?.72:.58;fog=[.014,.018,.024];fogD=inApartment?.026:.028;}
    if(powerFlicker>0)amb*=.15+Math.random()*1.28;
  }else if(scene==='floor3'){
    const inHouse=floor3InsideHouse(player.x,player.z);
    if(story.power3){amb=inHouse?.42:.48;tint=[.88,.80,.70];flash=0;fog=[.048,.044,.042];fogD=.026;}
    else{amb=inHouse?.36:.34;tint=inHouse?[.95,.85,.72]:[.78,.83,.93];flash=.55;fog=[.023,.020,.019];fogD=.018;}
    if(powerFlicker>0)amb*=.16+Math.random()*1.18;
  }else if(scene==='floor4'){
    const cold=player.z<-13;amb=cold?.65:.55;tint=cold?[.88,.97,1]:[1,.86,.65];fog=[.052,.042,.032];fogD=.012;if(player.z<-20&&player.x>-5&&player.x<-.5){amb=.32;flash=.45;}
  }else if(scene==='elevator'){
    amb=.55;tint=[.82,.84,.78];fog=[.06,.06,.055];fogD=.025;if(elevatorRideFX>0){const t=(performance.now()-elevatorRideStarted)/1000;const pulse=Math.sin(t*25)+Math.sin(t*41)*.65;amb*=pulse>1.05?.18:(pulse<-.95?.62:1.0)}
  }
  if(scene==='floor1'&&!story.powerOn&&horrorIntensity>0){const q=horrorIntensity;amb*=1-q*.96;flash*=1-q*.91;tint=[tint[0]*(1-q*.68),tint[1]*(1-q*.76),tint[2]*(1-q*.70)];fog=[.004,.003,.004];fogD+=q*.10;}
  let lamps=[[0,0,0],[0,0,0],[0,0,0]],colors=[[0,0,0],[0,0,0],[0,0,0]];
  if(scene==='reception'){lamps=[[-3.3,1.4,-.65],[0,2.4,.4],[0,2,-2.4]];colors=[[.85,.49,.20],[.52,.35,.15],[.45,.29,.12]];}
  if(scene==='floor1'){lamps=[[0,2.5,-1.8],[0,2.5,-6.9],[0,2.2,-10.4]];colors=lamps.map(()=>story.powerOn?[.40,.46,.36]:[.08,.15,.10]);if(horrorIntensity>.1)colors=colors.map(c=>c.map(v=>v*(1-horrorIntensity)));}
  if(scene==='floor2'){lamps=[[-1,1.8,-4.05],[0,1.3,-15.9],[0,2.4,-28.4]];colors=[[.16,.30,.55],story.tvDamage<2?[.20,.36,.48]:[0,0,0],story.power2?[.50,.36,.17]:[.12,.10,.04]];}
  if(scene==='floor4'){lamps=[[0,2.5,-10],[-7,2.8,-18],[7,2.8,-22]];colors=[[.95,.57,.23],[.55,.66,.72],[.55,.66,.72]];}
  gl.uniform3fv(loc['uLocalPos[0]'],new Float32Array(lamps.flat()));gl.uniform3fv(loc['uLocalColor[0]'],new Float32Array(colors.flat()));
  gl.uniform1f(loc.uAmbient,amb);gl.uniform3fv(loc.uLightTint,new Float32Array(tint));gl.uniform1f(loc.uFlash,flash);gl.uniform3fv(loc.uFogColor,new Float32Array(fog));gl.uniform1f(loc.uFogDensity,fogD)
}
function modelMatrix(o){let t=M.translate(o.x,o.y,o.z);if(o.rotY)t=M.multiply(t,M.rotY(o.rotY));if(o.rotZ)t=M.multiply(t,new Float32Array([Math.cos(o.rotZ),Math.sin(o.rotZ),0,0,-Math.sin(o.rotZ),Math.cos(o.rotZ),0,0,0,0,1,0,0,0,0,1]));return M.multiply(t,M.scale(o.sx,o.sy,o.sz))}
function drawBox(o){
  if(o.service4){const a=(kitchen4.doorOpen||0)*Math.PI/2;o.rotY=-a;o.x=-3.3+Math.cos(a);o.z=-20.12+Math.sin(a);}
  if(o.eDoor){const open=elevatorDoors;if(o.axis==='x'){o.z=o.baseZ+(o.eDoor==='a'?-open:open)*.78}else{o.x=o.baseX+(o.eDoor==='a'?-open:open)*.78}}
  if(o.horrorDoor){const a=horrorDoorOpen*Math.PI*.5;o.rotY=a;o.x=o.hingeX+Math.sin(a)*o.doorHalf;o.z=o.hingeZ+Math.cos(a)*o.doorHalf;}
  if(o.apartmentDoor){const a=apartmentDoorOpen*Math.PI*.5;o.rotY=-a;o.x=o.hingeX-Math.cos(a)*o.doorHalf;o.z=o.hingeZ-Math.sin(a)*o.doorHalf;}
  if(o.frontDoor){const a=frontDoorOpen*Math.PI*.5;o.rotY=a;o.x=1.4+Math.sin(a)*.9;o.z=-6.3+Math.cos(a)*.9;}
  if(o.serviceDoor){const a=serviceDoorOpen*Math.PI*.5;o.rotY=-a;o.x=9.025+Math.cos(a)*.825;o.z=Math.sin(a)*.825;}
  if(o.surface){drawSurface(o);return;}
  const geo=shapedGeometry[o.geometry];bindGeom(geo?geo.buf:cubeBuf);if(geo)gl.disable(gl.CULL_FACE);gl.uniformMatrix4fv(loc.uModel,false,modelMatrix(o));gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[o.tex]);gl.uniform3fv(loc.uTint,new Float32Array(o.tint||[1,1,1]));gl.uniform2fv(loc.uUVScale,new Float32Array(o.uv||[1,1]));
  const eLight=o.elevatorLight&&elevatorRideFX>0?((Math.sin((performance.now()-elevatorRideStarted)*.026)+Math.sin((performance.now()-elevatorRideStarted)*.041)*.6)>1.05?.03:(o.emissive||.55)):(o.emissive||0);
  const scenePower=scene==='floor2'?story.power2:scene==='floor3'?story.power3:story.powerOn;let emissive=o.powerLight?(scenePower?1.08:.012):eLight;if(o.tvGlow)emissive=story.tvDamage>=2?.01:(story.power2?.08:.42);
  gl.uniform1f(loc.uEmissive,emissive);gl.uniform1f(loc.uAlphaCut,.02);gl.drawArrays(gl.TRIANGLES,0,geo?geo.count:36);if(geo)gl.enable(gl.CULL_FACE);
}
function spriteTextureName(s){
  if(s.id==='chef4')return mode==='dialogue'&&dialogueKind==='chef4'&&dialogueLines[dialogueIndex]?.[0]==='CHEF'?'chef4_'+(1+dialogueIndex%2):scene==='floor4'&&performance.now()<(kitchen4.chefTalkUntil||0)?'chef4_'+(kitchen4.chefPose||1):'chef4_0';
  if(s.id==='brute4')return kitchen4.eating>0?'brute4_2':performance.now()<(kitchen4.angryUntil||0)?'brute4_1':mode==='dialogue'&&dialogueLines[dialogueIndex]?.[0]==='BRUTAMONTE'?'brute4_1':'brute4_0';
  if(s.id==='breaker4')return kitchen4.power?'breaker_on':kitchen4.opened?'breaker_open':'breaker_closed';
  if(s.id==='receptionist')return npcTalk==='receptionist'?'receptionist_talk_upper':'receptionist_idle_upper';
  if(s.id==='janitor')return npcTalk==='janitor1'?'janitor_talk1':npcTalk==='janitor2'?'janitor_talk2':'janitor_idle';
  if(s.id==='girl'){
    if(npcTalk==='girl_worried')return 'girl_worried';if(npcTalk==='girl_talk')return 'girl_talk';
    return mode==='world'&&Math.floor(performance.now()/900)%7===5?'girl_smoke':'girl_idle';
  }
  if(s.id==='breaker')return story.powerOn?'breaker_on':story.breakerOpened?'breaker_open':'breaker_closed';
  if(s.id==='breaker2')return story.power2?'breaker_on':story.breaker2Opened?'breaker_open':'breaker_closed';
  if(s.id==='breaker3')return story.power3?'breaker_on':story.breaker3Opened?'breaker_open':'breaker_closed';
  if(s.id==='oldlady'){if(oldLadyPath.length&&mode!=='dialogue')return 'oldlady_walk'+(1+(Math.floor(oldLadyAnimClock*7)%4)); if(npcTalk==='oldlady_worried')return 'oldlady_worried'; if(npcTalk==='oldlady_talk')return 'oldlady_talk'; return 'oldlady_idle';}
  if(s.id==='tv')return story.tvDamage===0?'tv_eye':story.tvDamage===1?'tv_cracked':'tv_broken';
  if(s.id==='cigarette')return 'cigarette_smoke'+(1+(Math.floor(performance.now()/150)%6));
  if(s.id==='father'){
    if(fatherDying)return 'father_die'+Math.max(1,Math.min(4,fatherDeathFrame||1));
    return 'father_walk'+(1+(Math.floor(fatherAnimClock*7)%4));
  }
  return s.texName;
}
function clipPoint(vp,x,y,z){
  const w=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];
  if(w<=.035)return null;
  return {x:(vp[0]*x+vp[4]*y+vp[8]*z+vp[12])/w,y:(vp[1]*x+vp[5]*y+vp[9]*z+vp[13])/w,z:(vp[2]*x+vp[6]*y+vp[10]*z+vp[14])/w,w};
}
function segmentIntersectsRect(ax,az,bx,bz,r){
  let t0=0,t1=1,dx=bx-ax,dz=bz-az;const checks=[[-dx,ax-(r.x-r.hx)],[dx,(r.x+r.hx)-ax],[-dz,az-(r.z-r.hz)],[dz,(r.z+r.hz)-az]];
  for(const [p,q] of checks){if(Math.abs(p)<1e-8){if(q<0)return false;continue}const t=q/p;if(p<0){if(t>t1)return false;if(t>t0)t0=t}else{if(t<t0)return false;if(t<t1)t1=t}}
  return t0<=t1&&t0<.985;
}
function spriteOccluded(s){
  if(!spriteOccluders.length||s.ignoreOcclusion)return false;
  for(const r of spriteOccluders){if(segmentIntersectsRect(player.x,player.z,s.x,s.z,r))return true}
  return false;
}
function shouldShowSprite(s){
  if(!s.visible)return false;
  if(s.id==='ghost')return scene==='floor1'&&!story.powerOn&&story.horrorDoorTriggered&&horrorDoorOpen>.42;
  if(s.id==='girl')return scene==='floor2'&&story.girlPresent;
  if(s.id==='cigarette')return scene==='floor2'&&!story.girlPresent&&story.girlTalked&&!story.cigaretteTaken&&player.z>-10.70;
  if(s.id==='father_seated')return scene==='floor2'&&story.apartmentUnlocked&&apartmentDoorOpen>.56&&!story.power2&&!story.fatherDead&&player.z<-8.8;
  if(s.id==='father')return scene==='floor2'&&!story.fatherDead&&(story.fatherChasing||fatherDying);
  if(s.id==='tv')return scene==='floor2'&&story.apartmentUnlocked;
  if(s.id==='breaker2')return scene==='floor2'&&story.apartmentUnlocked;
  if(s.id==='oldlady')return scene==='floor3'&&(story.frontDoorUnlocked||mode==='dialogue'||frontDoorOpen>.2);
  if(s.id==='kitten')return scene==='floor3'&&!story.kittenTaken&&story.frontDoorUnlocked;
  if(s.id==='breaker3')return scene==='floor3'&&story.frontDoorUnlocked;
  if(s.id==='vaultdoor')return scene==='floor3'&&story.frontDoorUnlocked;
  if(/^cat\d+$/.test(s.id))return scene==='floor3'&&story.frontDoorUnlocked;
  return true;
}
function syncWorldSprites(v){
  // One world-space projection for every floor. Upright billboards never tilt
  // with camera pitch or distort their proportions when approached.
  if(ui.spriteOverlay.childElementCount)ui.spriteOverlay.replaceChildren();
  for(const s of sprites){
    if(!shouldShowSprite(s))continue;
    const tex=spriteTextureName(s),im=imgs[tex];if(!im)continue;
    const fixed=s.breaker||['breaker','breaker2','tv','father_seated'].includes(s.id)||!s.billboard;
    const angle=s.id==='breaker3'?Math.PI:fixed?s.rotY:scene==='floor4'?-Math.atan2(v.f[0],-v.f[2]):-player.yaw;
    let glow=scene==='floor3'?(story.power3?.17:.22):.22;
    if(s.id==='ghost')glow=.025;
    if(s.id==='tv')glow=story.tvDamage<2?.72:.08;
    if(s.id==='girl')glow=.38;
    drawSurface({x:s.x,y:s.y,z:s.z,sx:s.cat?.64:s.h*im.width/im.height,sy:s.cat?.64*im.height/im.width:s.h,sz:1,rotY:angle,tex,tint:[.95,.91,.85],emissive:glow});
  }
}
function render(){resize();gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(scene==='none'){if(ui.spriteOverlay)ui.spriteOverlay.replaceChildren();return}const v=viewData();setCommon(v);gl.disable(gl.BLEND);gl.depthMask(true);for(const o of objects)drawBox(o);syncWorldSprites(v);gl.depthMask(true);gl.enable(gl.CULL_FACE);}

// ------------------------------------------------------------
// Player movement / collisions
// ------------------------------------------------------------
function circleHitsRect(px,pz,r,c){const qx=clamp(px,c.x-c.hx,c.x+c.hx),qz=clamp(pz,c.z-c.hz,c.z+c.hz);return (px-qx)*(px-qx)+(pz-qz)*(pz-qz)<r*r}
function baseWalkable(x,z){
  if(scene==='floor4'){if(x>-5&&x<-.5&&z<-20&&(!kitchen4.door||(kitchen4.doorOpen||0)<.8))return false;return x>-11.65&&x<11.65&&z>-26.65&&z<2.65;}
  if(scene==='reception')return x>-4.22&&x<4.22&&z>-3.18&&z<3.18;
  if(scene==='floor1'){
    const lobby=x>-2.12&&x<2.12&&z>-1.15&&z<2.45;
    const corridor=x>-.96&&x<.96&&z<=-1.05&&z>-10.28;
    const roomReady=story.hasScrewdriver&&!story.powerOn&&horrorDoorOpen>.70;
    const doorway=roomReady&&x>.82&&x<1.62&&z>-6.25&&z<-5.35;
    const horrorRoom=roomReady&&x>=1.42&&x<5.02&&z>-7.62&&z<-3.98;
    return lobby||corridor||doorway||horrorRoom;
  }
  if(scene==='floor2'){
    const landing=x>-2.16&&x<2.16&&z>-1.18&&z<2.46;
    const hall=x>-1.02&&x<1.02&&z<=-1.02&&z>-10.56;
    const doorPass=story.apartmentUnlocked&&apartmentDoorOpen>.64;
    const entry=doorPass&&x>-.86&&x<.86&&z<=-10.42&&z>-11.40;
    const living=x>-4.00&&x<4.00&&z<=-10.98&&z>-16.38;
    const leftCorr=x>-4.00&&x<-1.68&&z<=-16.25&&z>-23.60;
    const rightCorr=x>1.68&&x<4.00&&z<=-16.25&&z>-23.60;
    const backCorr=x>-4.00&&x<4.00&&z<=-23.35&&z>-25.08;
    const breakerEntry=x>-1.08&&x<1.08&&z<=-24.95&&z>-27.10;
    const breakerRoom=x>-1.32&&x<1.32&&z<=-27.05&&z>-29.34;
    return landing||hall||entry||living||leftCorr||rightCorr||backCorr||breakerEntry||breakerRoom;
  }
  if(scene==='floor3'){
    if(x> -1.16&&x<1.16&&z>-9.86&&z<2.70)return true;
    if(story.frontDoorUnlocked&&frontDoorOpen>.90&&x>1.05&&x<1.78&&z>-6.07&&z<-4.73)return true;
    return floor3InsideHouse(x,z);
  }
  return false;
}
function walkable(x,z){
  if(!baseWalkable(x,z))return false;
  if(scene==='floor3'&&doorCollision3(x,z,.23))return false;
  // Door collision is local to each physical slab (doorCollision3 above).
  // Never gate a whole coordinate strip: it also crosses the elevator hallway.
  const feet=player.floorY+player.jumpY;
  for(const c of colliders){if(!circleHitsRect(x,z,.23,c))continue;if(c.climbable&&(feet>=c.top-.08||scene==='floor5'&&c.top<=.25))continue;return false}
  return true;
}
function monsterWalkable(x,z){
  if(!baseWalkable(x,z))return false;
  for(const r of spriteOccluders){if(circleHitsRect(x,z,.34,r))return false}
  for(const c of colliders){if(circleHitsRect(x,z,.34,c)){if(c.id==='chair2'||c.id==='tvStand')continue;return false}}
  return true;
}
function monsterHasLine(ax,az,bx,bz){
  for(const r of spriteOccluders){if(segmentIntersectsRect(ax,az,bx,bz,r))return false}
  return true;
}
function currentCeilingBottom(){
  if(scene==='floor4')return player.z<-18?8.3:3.3;
  if(scene==='reception')return 2.94;
  if(scene==='floor1'||scene==='floor2'||scene==='floor3')return 2.92;
  if(scene==='elevator')return 2.36;
  return 3.0;
}
function supportHeightAt(x,z,feet){let h=0;for(const c of colliders){if(!c.climbable)continue;if(x>c.x-c.hx+.10&&x<c.x+c.hx-.10&&z>c.z-c.hz+.10&&z<c.z+c.hz-.10&&(feet>=c.top-.10||scene==='floor5'&&c.top<=.25))h=Math.max(h,c.top)}return h}
function updateSupport(){const feet=player.floorY+player.jumpY;const h=supportHeightAt(player.x,player.z,feet);if(Math.abs(h-player.floorY)>.001){player.jumpY=Math.max(0,feet-h);player.floorY=h}}
function updatePlayer(dt){
  const worldMode=mode==='world';player.targetEye=(keys.ControlLeft||keys.ControlRight||keys.KeyC)?1.12:1.68;player.eye=lerp(player.eye,player.targetEye,1-Math.pow(.002,dt));
  if(worldMode){let f=(keys.KeyW?1:0)-(keys.KeyS?1:0),r=(keys.KeyD?1:0)-(keys.KeyA?1:0);if(f||r){const l=Math.hypot(f,r);f/=l;r/=l;const sprint=(keys.ShiftLeft||keys.ShiftRight)&&player.targetEye>1.4;const baseSpeed=player.targetEye<1.4?1.15:sprint?4.05:2.35;const speed=baseSpeed*(scene==='floor1'&&!story.powerOn?(1-.84*Math.pow(horrorIntensity,1.35)):1);const dx=(Math.sin(player.yaw)*f+Math.cos(player.yaw)*r)*speed*dt,dz=(-Math.cos(player.yaw)*f+Math.sin(player.yaw)*r)*speed*dt;const nx=player.x+dx,nz=player.z+dz;if(walkable(nx,player.z))player.x=nx;if(walkable(player.x,nz))player.z=nz;updateSupport();player.bob+=dt*(sprint?13.2:9.2);player.bobAmt=lerp(player.bobAmt,sprint?.045:.028,1-Math.pow(.001,dt));sfx.step(sprint)}else player.bobAmt=lerp(player.bobAmt,0,1-Math.pow(.005,dt));}
  const airborneBefore=player.jumpY>.001;player.yVel-=18.5*dt;player.jumpY+=player.yVel*dt;
  const bodyH=player.targetEye>1.4?1.80:1.28,maxJump=Math.max(0,currentCeilingBottom()-player.floorY-bodyH-.03);
  if(player.jumpY>maxJump){player.jumpY=maxJump;if(player.yVel>0){player.yVel=0;sfx.noise(.055,.026,720)}}
  if(player.jumpY<0){player.jumpY=0;if(airborneBefore&&player.yVel<-.8)sfx.land();player.yVel=0}updateSupport();
  player.bobOffset=(player.jumpY===0)?Math.sin(player.bob)*player.bobAmt:0;
}

// ------------------------------------------------------------
// Interaction helpers
// ------------------------------------------------------------
function forward2(){return [Math.sin(player.yaw),-Math.cos(player.yaw)]}
function canSeeTarget(t){const dx=t.x-player.x,dz=t.z-player.z,d=Math.hypot(dx,dz);if(d>t.range)return false;const f=forward2(),dot=(dx/d)*f[0]+(dz/d)*f[1];return dot>.90}
function activeInteraction(){
  if(mode!=='world')return null;
  for(const t of interactables){
    if(scene==='floor4'){if(t.id==='k4_matches'&&inventory.includes('matches'))continue;if(t.id==='k4_breaker'&&(!kitchen4.door||kitchen4.power))continue;if(t.id==='k4_serve'&&!kitchen4.plate)continue;if(t.id==='k4_elevator'&&(!kitchen4.power||kitchen4.phase==='orders'))continue;if(spriteOccluders.some(r=>segmentIntersectsRect(player.x,player.z,t.x,t.z,r)))continue;}
    if(t.id==='receptionist'&&story.receptionistDone)continue;
    if(t.id==='janitor'&&(!story.janitorPresent||story.janitorDone))continue;
    if(t.id==='girl'&&(!story.girlPresent||story.girlTalked))continue;
    if(t.id==='cigarette'&&(story.cigaretteTaken||story.girlPresent))continue;
    if(t.id==='kitten'&&(story.kittenTaken||!story.frontDoorUnlocked))continue;
    if(t.id==='breaker'&&(!story.janitorDone||story.powerOn))continue;
    if(t.id==='breaker2'&&(!story.girlTalked||story.power2))continue;
    if(t.id==='breaker3'&&(!story.frontDoorUnlocked||story.power3))continue;
    if(t.id==='bigdoor'&&story.frontDoorUnlocked)continue;
    if(t.id==='serviceDoor'&&(!story.frontDoorUnlocked||story.serviceUnlocked))continue;
    if(scene==='floor3'&&t.id==='breaker3'&&!story.serviceUnlocked)continue;
    if(scene==='floor3'&&t.id!=='bigdoor'&&spriteOccluders.some(r=>segmentIntersectsRect(player.x,player.z,t.x,t.z,r)))continue;
    if(t.id==='elevator'&&scene==='reception'&&!story.elevatorUnlocked)continue;
    if(t.id==='elevator'&&scene==='floor1'&&!story.powerOn)continue;
    if(t.id==='elevator'&&scene==='floor2'&&!story.fatherDead)continue;
    if(t.id==='elevator'&&scene==='floor3'&&!story.power3)continue;
    if(canSeeTarget(t))return t;
  }
  return null;
}
function updateHud(){
  const t=activeInteraction();
  if(t){let label=t.label;if(t.id==='breaker')label=story.breakerOpened?'CONECTAR OS FIOS':'ABRIR COM A CHAVE DE FENDA';if(t.id==='breaker2')label=story.breaker2Opened?'CONECTAR OS FIOS':'ABRIR COM A CHAVE DE FENDA';if(t.id==='breaker3')label=story.breaker3Opened?'CONECTAR OS FIOS':'ABRIR COM A CHAVE DE FENDA';if(t.id==='bigdoor')label=story.oldLadyTalked?'ARROMBAR A PORTA':'BATER NA PORTA';ui.interact.querySelector('kbd').textContent=t.id==='bigdoor'&&!story.oldLadyTalked?'CLIQUE':'E';ui.interact.querySelector('span').textContent=label;ui.interact.classList.remove('hidden')}
  else ui.interact.classList.add('hidden');
}
function interact(){
  if(mode==='dialogue'){advanceDialogue();return}
  if(mode!=='world')return;sfx.unlock();const t=activeInteraction();if(!t)return;
  if(t.id.startsWith('f5_')){interactFloor5(t.id);return}
  if(t.id.startsWith('k4_')){interactKitchen4(t.id);return}
  if(t.id==='receptionist'){
    sfx.deskBell();startDialogue('recep',[['RECEPCIONISTA','Boa noite.'],['RECEPCIONISTA','Você deve ser o neto da senhora do último andar.'],['RECEPCIONISTA','Ela ligou mais cedo. Parecia... cansada.'],['RECEPCIONISTA','O elevador está liberado para você.'],['RECEPCIONISTA','Se ele parar antes... não force as portas.']],()=>{story.receptionistDone=true;story.elevatorUnlocked=true;setObjective('Use o elevador')});
  }else if(t.id==='elevator'){
    sfx.button();
    if(scene==='reception')rideElevator('R','1',()=>{setScene('floor1');mode='world';setObjective('Fale com o faxineiro')});
    else if(scene==='floor1')rideElevator('1','2',()=>{setScene('floor2');mode='world';setObjective('Fale com a garota perto da janela')});
    else if(scene==='floor2')rideElevator('2','3',()=>{setScene('floor3');mode='world';setObjective('Bata na porta da casa')});
    else if(scene==='floor3'){rideElevator('3','4',()=>resetKitchen4(false));}
  }else if(t.id==='janitor'){
    sfx.noise(.10,.035,900);startDialogue('janitor',[['FAXINEIRO','Hm. Você subiu mesmo.'],['FAXINEIRO','Esse elevador está com problema faz dias.'],['FAXINEIRO','Cada andar tem um disjuntor. Se o andar fica sem energia, o elevador não passa dele.'],['FAXINEIRO','Toma. Você vai precisar disso.'],['FAXINEIRO','O quadro está no fim do corredor. Abre com a chave e junta os fios pelas cores.'],['FAXINEIRO','Quando a luz voltar, tenta o elevador de novo.']],()=>pickupScrewdriver());
  }else if(t.id==='girl'){
    startDialogue('girl',[
      ['GAROTA','Uau... o elevador voltou a funcionar.'],
      ['GAROTA','Tá procurando um disjuntor?'],
      ['GAROTA','É. Eu sei onde fica...'],
      ['GAROTA','Aquele apartamento no fim do corredor é onde eu moro com meu pai.'],
      ['GAROTA','Ele vive desligando essa merda porque acha que a TV só presta se a energia do andar estiver desligada.'],
      ['GAROTA','Então, se você for ligar o disjuntor, ele fica num quarto lá dentro.'],
      ['GAROTA','Mas cuidado pro meu pai não te ver.'],
      ['GAROTA','Ele pode ser meio agressivo às vezes...']
    ],()=>{story.girlTalked=true;story.apartmentUnlocked=true;apartmentDoorTarget=1;sfx.door();setObjective('Entre no apartamento e encontre o disjuntor');saveCheckpoint('girl')});
  }else if(t.id==='cigarette'){
    collectCigarette();
  }else if(t.id==='bigdoor'){
    if(!story.oldLadyTalked)knockOldLady();else openLockpick('front');
  }else if(t.id==='serviceDoor'){openLockpick('service');
  }else if(t.id==='kitten'){
    collectKitten();spatial3('meow',player.x,player.z,1);emitNoise3(player.x,player.z,1,true);showCaption('VELHA','O QUE VOCÊ FEZ COM A MINHA GATA?!',2400);setObjective(story.power3?'Corra para o elevador':'Ligue o disjuntor e fuja');
  }else if(t.id==='breaker'){
    if(!story.breakerOpened)openBreaker('floor1');else openWireGame('floor1');
  }else if(t.id==='breaker2'){
    if(!story.breaker2Opened)openBreaker('floor2');else openWireGame('floor2');
  }else if(t.id==='breaker3'){
    if(!story.breaker3Opened)openBreaker('floor3');else openWireGame('floor3');
  }
}
// ------------------------------------------------------------
// Dialogue / story
// ------------------------------------------------------------
let dialogueLines=[],dialogueIndex=0,dialogueDone=true,dialogueCallback=null,dialogueKind='recep',typingToken=0,npcTalk='';
function startDialogue(kind,lines,cb){mode='dialogue';dialogueKind=kind;dialogueLines=lines;dialogueIndex=0;dialogueCallback=cb;ui.dialogue.classList.remove('hidden');showLine()}
function showLine(){
  const [sp,tx]=dialogueLines[dialogueIndex];ui.speaker.textContent=sp;ui.text.textContent='';dialogueDone=false;
  if(dialogueKind==='recep')npcTalk='receptionist';else if(dialogueKind==='janitor')npcTalk=dialogueIndex%2?'janitor2':'janitor1';else if(dialogueKind==='girl')npcTalk=dialogueIndex>=6?'girl_worried':'girl_talk';else if(dialogueKind==='oldlady')npcTalk=dialogueLines[dialogueIndex][0]==='VOCÊ'?'':dialogueIndex>=6?'oldlady_worried':'oldlady_talk';else npcTalk='';
  const token=++typingToken;let i=0;const tick=()=>{if(token!==typingToken)return;if(i<tx.length){ui.text.textContent+=tx[i];if(tx[i]!==' '&&i%2===0){if(dialogueKind==='girl')sfx.girlBlip();else sfx.blip(dialogueKind)}i++;setTimeout(tick,dialogueKind==='recep'?31:dialogueKind==='girl'?34:37)}else{dialogueDone=true;npcTalk=''}};tick();
}
function advanceDialogue(){sfx.unlock();if(!dialogueDone){++typingToken;ui.text.textContent=dialogueLines[dialogueIndex][1];dialogueDone=true;npcTalk='';return}sfx.click();dialogueIndex++;if(dialogueIndex>=dialogueLines.length){ui.dialogue.classList.add('hidden');npcTalk='';mode='world';const cb=dialogueCallback;dialogueCallback=null;if(cb)cb()}else showLine()}

function pickupScrewdriver(){story.janitorDone=true;story.hasScrewdriver=true;story.horrorDoorTriggered=false;horrorDoorOpen=0;horrorDoorTarget=0;saveCheckpoint('janitor');ui.itemHud.classList.remove('hidden');ui.hand.classList.remove('hidden');ui.pickup.classList.remove('hidden');mode='pickup';setObjective('Encontre o disjuntor no fim do corredor');sfx.pickup();setTimeout(()=>{ui.pickup.classList.add('hidden');mode='world'},1250)}
function openBreaker(context='floor1'){wireContext=context;if(context==='floor2')story.breaker2Opened=true;else if(context==='floor3')story.breaker3Opened=true;else story.breakerOpened=true;mode='busy';ui.hand.src='assets/screwdriver_use.png';ui.hand.style.height='min(72vh,760px)';sfx.screwdriver();setTimeout(()=>{ui.hand.src='assets/screwdriver_twist.png'},250);setTimeout(()=>{if(mode!=='busy')return;ui.hand.src='assets/screwdriver_hold.png';ui.hand.style.height='';mode='world';openWireGame(context)},720)}
function setObjective(t){ui.objective.textContent=t;ui.objective.classList.toggle('hidden',!t)}

// ------------------------------------------------------------
// Elevator sequence in actual 3D cabin
// ------------------------------------------------------------
async function fadeTo(on){ui.fade.classList.toggle('on',on);await new Promise(r=>setTimeout(r,470))}
async function rideElevator(from,to,cb){
  elevatorTarget=to;mode='ride';ui.interact.classList.add('hidden');setObjective('');sfx.door();elevatorDoorTarget=1;
  // Let the player clearly see the modeled cabin behind the opening doors.
  await new Promise(r=>setTimeout(r,820));await fadeTo(true);setScene('elevator');await fadeTo(false);
  elevatorRideFX=1;elevatorRideStarted=performance.now();sfx.elevatorRide();
  await new Promise(r=>setTimeout(r,720));sfx.elevatorJolt();
  await new Promise(r=>setTimeout(r,850));sfx.elevatorJolt();
  await new Promise(r=>setTimeout(r,900));elevatorRideFX=0;sfx.ding();
  await new Promise(r=>setTimeout(r,520));await fadeTo(true);cb();await fadeTo(false);if(mode!=='ending')mode='world';
}

// ------------------------------------------------------------
// Wire minigame
// ------------------------------------------------------------
const wctx=ui.wire.getContext('2d');const colors=[{n:'red',c:'#dc4138'},{n:'blue',c:'#4188d5'},{n:'yellow',c:'#e0b938'},{n:'green',c:'#4fb95b'}];let left=[],right=[],links={},drag=null,mouse={x:0,y:0};
function setupWires(){const ys=[235,315,395,475];left=colors.map((o,i)=>({...o,x:207,y:ys[i]}));const order=[2,0,3,1].map(i=>colors[i]);right=order.map((o,i)=>({...o,x:514,y:ys[i]}));links={};drag=null;drawWires()}
function node(x,y,c){wctx.beginPath();wctx.arc(x,y,13,0,Math.PI*2);wctx.fillStyle='#171717';wctx.fill();wctx.lineWidth=5;wctx.strokeStyle=c;wctx.stroke();wctx.beginPath();wctx.arc(x,y,4,0,Math.PI*2);wctx.fillStyle='#e8ddc7';wctx.fill()}
function wire(a,b,c,alpha=1){wctx.save();wctx.globalAlpha=alpha;wctx.beginPath();wctx.moveTo(a.x,a.y);const mx=(a.x+b.x)/2;wctx.bezierCurveTo(mx,a.y,mx,b.y,b.x,b.y);wctx.strokeStyle='rgba(0,0,0,.72)';wctx.lineWidth=13;wctx.lineCap='round';wctx.stroke();wctx.strokeStyle=c;wctx.lineWidth=7;wctx.stroke();wctx.restore()}
function drawWires(){wctx.clearRect(0,0,720,600);wctx.fillStyle='rgba(0,0,0,.10)';wctx.fillRect(176,190,366,330);for(const l of left){if(links[l.n]){const r=right.find(q=>q.n===links[l.n]);if(r)wire(l,r,l.c)}}if(drag)wire(drag,mouse,drag.c,.85);for(const l of left)node(l.x,l.y,l.c);for(const r of right)node(r.x,r.y,r.c)}
function wirePos(e){const r=ui.wire.getBoundingClientRect();return{x:(e.clientX-r.left)*720/r.width,y:(e.clientY-r.top)*600/r.height}}
function near(p,a){return Math.hypot(p.x-a.x,p.y-a.y)<29}
ui.wire.addEventListener('pointerdown',e=>{const p=wirePos(e);drag=left.find(n=>!links[n.n]&&near(p,n))||null;if(drag){mouse=p;drawWires();sfx.click()}});
ui.wire.addEventListener('pointermove',e=>{if(!drag)return;mouse=wirePos(e);drawWires()});
ui.wire.addEventListener('pointerup',e=>{if(!drag)return;const p=wirePos(e),r=right.find(n=>near(p,n));if(r&&r.n===drag.n){links[drag.n]=r.n;sfx.wire()}else sfx.error();drag=null;drawWires();if(Object.keys(links).length===4)setTimeout(completeBreaker,280)});
function openWireGame(context='floor1'){wireContext=context;mode='minigame';if(document.pointerLockElement)document.exitPointerLock();ui.breaker.classList.remove('hidden');setupWires()}
ui.breakerExit.addEventListener('click',()=>{const done=wireContext==='floor5'?wedding5.power:wireContext==='floor4'?kitchen4.power:wireContext==='floor3'?story.power3:wireContext==='floor2'?story.power2:story.powerOn;if(done)return;ui.breaker.classList.add('hidden');mode='world';requestLock()});
function completeBreaker(){
  if(wireContext==='floor5'){completeBreaker5();return}
  if(wireContext==='floor4'){completeBreaker4();return}
  if(wireContext==='floor2'){completeFloor2Breaker();return}
  if(wireContext==='floor3'){completeFloor3Breaker();return}
  if(story.powerOn)return;story.powerOn=true;story.janitorPresent=false;sprites=sprites.filter(s=>s.id!=='janitor'&&s.id!=='ghost');colliders=colliders.filter(c=>c.id!=='janitor');if(horrorDoorOpen>.08||horrorDoorTarget>.08)sfx.horrorDoor(false);horrorDoorTarget=0;horrorIntensity=0;sfx.setDread(0);document.documentElement.style.setProperty('--dread','0');powerFlicker=1.15;sfx.power();sfx.setRoom('floor1',true);ui.breaker.classList.add('hidden');mode='world';setObjective('Volte para o elevador');requestLock();setTimeout(()=>{powerFlicker=0},1150)
}
function showCaption(speaker,text,duration=1700){
  clearTimeout(captionTimer);ui.captionSpeaker.textContent=speaker||'';ui.captionText.textContent=text;ui.caption.classList.remove('hidden');captionTimer=setTimeout(()=>ui.caption.classList.add('hidden'),duration);
}
function completeFloor2Breaker(){
  if(story.power2)return;story.power2=true;powerFlicker=1.25;sfx.power();sfx.setRoom('floor2',true);ui.breaker.classList.add('hidden');mode='world';requestLock();setObjective('...');
  setTimeout(()=>{sfx.fatherShout();showCaption('PAI','AAAHHH! EU MANDEI NÃO LIGAR ESSA MERDA, SUA INÚTIL!',2200)},420);
  setTimeout(()=>startFatherChase(),1120);setTimeout(()=>{powerFlicker=0},1300);
}
function completeFloor3Breaker(){
  if(story.power3)return;story.power3=true;powerFlicker=1.15;sfx.power();sfx.setRoom('floor3',true);ui.breaker.classList.add('hidden');mode='world';requestLock();setObjective('Volte para o elevador');showCaption('VELHA','NÃO! EU AVISEI!',1800);emitNoise3(player.x,player.z,1,true);oldLadyChaseLeft=14;setTimeout(()=>{powerFlicker=0},1180);
}

const fatherNav=[
  {x:-.70,z:-14.15,e:[1,2]},
  {x:-2.90,z:-16.15,e:[0,3]},{x:2.90,z:-16.15,e:[0,5]},
  {x:-2.90,z:-20.00,e:[1,4]},{x:-2.90,z:-24.30,e:[3,6]},
  {x:2.90,z:-20.00,e:[2,7]},{x:0,z:-24.30,e:[4,7,8]},
  {x:2.90,z:-24.30,e:[5,6]},
  {x:0,z:-26.20,e:[6,9]},{x:0,z:-28.15,e:[8]}
];
function nearestNav(x,z){let best=0,bd=1e9;for(let i=0;i<fatherNav.length;i++){const d=dist2(x,z,fatherNav[i].x,fatherNav[i].z);if(d<bd){bd=d;best=i}}return best}
function navPath(a,b){if(a===b)return[];const q=[a],prev=new Array(fatherNav.length).fill(-1);prev[a]=a;while(q.length){const n=q.shift();for(const k of fatherNav[n].e){if(prev[k]!==-1)continue;prev[k]=n;if(k===b){q.length=0;break}q.push(k)}}if(prev[b]===-1)return[];const out=[];for(let n=b;n!==a;n=prev[n])out.push(n);return out.reverse()}
function syncFatherSprite(){const f=sprites.find(q=>q.id==='father');if(f){f.x=fatherPos.x;f.z=fatherPos.z}}
function startFatherChase(){
  if(story.fatherDead||story.fatherChasing)return;story.fatherChasing=true;fatherDying=false;fatherPos={x:-.70,z:-14.12};fatherPath=[];fatherPathTimer=0;fatherAnimClock=0;fatherStepClock=0;fatherStun=0;
  sprites=sprites.filter(q=>q.id!=='father_seated'&&q.id!=='father');sprite('father',fatherPos.x,fatherPos.z,2.48,'father_walk1',{y:0,monster:true});
  document.querySelector('#gameShell').classList.add('chase');setObjective('FUJA DO APARTAMENTO');
}
function updateFather(dt,now){
  if(!story.fatherChasing||story.fatherDead||fatherDying)return;fatherAnimClock+=dt;
  if(fatherStun>0){fatherStun=Math.max(0,fatherStun-dt);syncFatherSprite();return}
  fatherPathTimer-=dt;
  const a=nearestNav(fatherPos.x,fatherPos.z),b=nearestNav(player.x,player.z);
  if(fatherPathTimer<=0||!fatherPath.length){fatherPath=navPath(a,b);fatherPathTimer=.20}
  let tx,tz;
  if(fatherPath.length){
    const n=fatherNav[fatherPath[0]],nd=dist2(fatherPos.x,fatherPos.z,n.x,n.z);
    if(nd<.30){fatherPath.shift();if(fatherPath.length){tx=fatherNav[fatherPath[0]].x;tz=fatherNav[fatherPath[0]].z}}
    if(tx===undefined){tx=n.x;tz=n.z}
  }else if(monsterHasLine(fatherPos.x,fatherPos.z,player.x,player.z)){
    tx=player.x;tz=player.z;
  }else{
    tx=fatherNav[a].x;tz=fatherNav[a].z;
  }
  const dx=tx-fatherPos.x,dz=tz-fatherPos.z,d=Math.hypot(dx,dz)||1;const speed=story.escapeSealed?2.02:1.78;
  const sx=dx/d*speed*dt,sz=dz/d*speed*dt;
  const nx=fatherPos.x+sx,nz=fatherPos.z+sz;
  if(monsterWalkable(nx,nz)){fatherPos.x=nx;fatherPos.z=nz}
  else{
    if(monsterWalkable(fatherPos.x+sx,fatherPos.z))fatherPos.x+=sx;
    if(monsterWalkable(fatherPos.x,fatherPos.z+sz))fatherPos.z+=sz;
    fatherPath=[];fatherPathTimer=0;
  }
  syncFatherSprite();
  fatherStepClock-=dt;if(fatherStepClock<=0){const pd=dist2(player.x,player.z,fatherPos.x,fatherPos.z);if(pd<10.5)sfx.monsterStep();fatherStepClock=.50}
  if(dist2(player.x,player.z,fatherPos.x,fatherPos.z)<.78)killByFather();
}
function threatLookAmount(x,z,maxDist=9,dotStart=.84){
  const dx=x-player.x,dz=z-player.z,d=Math.hypot(dx,dz);if(d>.001&&d<maxDist){const f=forward2(),dot=(dx/d)*f[0]+(dz/d)*f[1];if(dot>dotStart&&monsterHasLine(player.x,player.z,x,z))return clamp((dot-dotStart)/(1-dotStart),0,1)*clamp((maxDist-d)/(maxDist*.72),0,1)}return 0;
}
function updateFloor2(dt,now){
  if(['paused','inventory','dead','ride'].includes(mode))return;
  apartmentDoorOpen=lerp(apartmentDoorOpen,apartmentDoorTarget,1-Math.pow(.00005,dt));if(Math.abs(apartmentDoorOpen-apartmentDoorTarget)<.002)apartmentDoorOpen=apartmentDoorTarget;
  if(!story.girlTalked){sfx.setDread(0);document.documentElement.style.setProperty('--dread','0');return}
  if(!story.power2&&!floor2DeathBusy){const dDad=dist2(player.x,player.z,-.70,-14.12),dTv=dist2(player.x,player.z,0,-16.30);if(player.z<-11.35&&(dDad<1.20||dTv<1.45)){killByFather();return}const q=clamp((player.z+11.2)/-5.2,0,.34);sfx.setDread(q);document.documentElement.style.setProperty('--dread',String(q*.52))}
  if(story.fatherChasing&&!story.escapeSealed&&player.z>-11.98&&player.z<-10.55&&Math.abs(player.x)<1.30){story.escapeSealed=true;apartmentDoorTarget=0;sfx.doorSlam();showCaption('','A PORTA TRAVOU.',1150);setObjective('DESTRUA A TELEVISÃO')}
  updateFather(dt,now);
  if(story.fatherChasing){const d=dist2(player.x,player.z,fatherPos.x,fatherPos.z),q=clamp(.24+(5.7-d)*.09,.24,.86);sfx.setDread(q);document.documentElement.style.setProperty('--dread',String(q*.72))}
  else if(story.fatherDead){sfx.setDread(0);document.documentElement.style.setProperty('--dread','0')};
  let uneaseTarget=0;
  if(story.tvDamage<2&&story.apartmentUnlocked)uneaseTarget=Math.max(uneaseTarget,threatLookAmount(0,-16.30,7.6,.88)*(story.tvDamage===0?1:.72));
  if((story.fatherChasing||fatherDying)&&!story.fatherDead)uneaseTarget=Math.max(uneaseTarget,threatLookAmount(fatherPos.x,fatherPos.z,10.5,.84));
  gazeDisturbance=lerp(gazeDisturbance,uneaseTarget,1-Math.pow(.015,dt));document.documentElement.style.setProperty('--unease',gazeDisturbance.toFixed(3));document.querySelector('#gameShell').classList.toggle('uneasy',gazeDisturbance>.08);
  if(fatherDying){const age=now-fatherDeathStarted;fatherDeathFrame=Math.min(4,1+Math.floor(age/360));syncFatherSprite();if(age>1650)finishFatherDeath()}
}
function canHitPoint(x,z,range=2.0,dotNeed=.72){const dx=x-player.x,dz=z-player.z,d=Math.hypot(dx,dz);if(d>range)return false;const f=forward2();return (dx/d)*f[0]+(dz/d)*f[1]>dotNeed}
function tryHitTV(){
  if(scene!=='floor2'||!story.power2||story.fatherDead||fatherDying||!story.escapeSealed)return false;
  const now=performance.now();if(now<tvHitCooldownUntil)return false;
  // Aim at the front of the CRT, not its world-center behind the stand.
  const tx=0,tz=-15.82,dx=tx-player.x,dz=tz-player.z,d=Math.hypot(dx,dz);
  if(d>1.70)return false;
  const f=forward2(),dot=d>.001?((dx/d)*f[0]+(dz/d)*f[1]):1;
  if(dot<.52)return false;
  if(story.tvDamage===0){
    story.tvDamage=1;tvHitCooldownUntil=now+1150;fatherStun=.92;sfx.glassHit();sfx.fatherPain();powerFlicker=.38;
    showCaption('','A TELA RACHA.',900);setTimeout(()=>powerFlicker=0,420);return true;
  }
  if(story.tvDamage===1){
    story.tvDamage=2;tvHitCooldownUntil=now+650;sfx.glassBreak();beginFatherDeath();return true;
  }
  return false;
}
function beginFatherDeath(){
  if(fatherDying||story.fatherDead)return;
  // Stage the death at the apartment entrance so the player cannot miss it.
  fatherPos={x:0,z:-11.78};story.fatherChasing=false;fatherDying=true;fatherDeathFrame=1;fatherDeathStarted=performance.now();document.querySelector('#gameShell').classList.remove('chase');setObjective('');sfx.fatherPain();sfx.dissolve();
  let f=sprites.find(q=>q.id==='father');if(!f){sprite('father',fatherPos.x,fatherPos.z,2.48,'father_die1',{y:0,monster:true});f=sprites.find(q=>q.id==='father')}if(f){f.x=fatherPos.x;f.z=fatherPos.z;f.h=2.48}
  const dx=fatherPos.x-player.x,dz=fatherPos.z-player.z;player.yaw=Math.atan2(dx,-dz);player.pitch=.02;cameraSnapUntil=performance.now()+900;gazeDisturbance=1;document.documentElement.style.setProperty('--unease','1');
}
function finishFatherDeath(){
  if(!fatherDying)return;fatherDying=false;story.fatherDead=true;story.girlPresent=false;colliders=colliders.filter(c=>c.id!=='girl');story.fatherChasing=false;sprites=sprites.filter(q=>q.id!=='father'&&q.id!=='girl'&&q.id!=='cigarette');
  if(!story.cigaretteTaken){sprite('cigarette',-.98,-4.05,.60,'cigarette_smoke1',{y:.80,cigarette:true,alpha:.88});if(!interactables.some(t=>t.id==='cigarette'))interactables.push({id:'cigarette',x:-.98,z:-4.05,range:1.62,label:'PEGAR CIGARRO'})}
  apartmentDoorTarget=1;sfx.setDread(0);gazeDisturbance=0;document.documentElement.style.setProperty('--unease','0');document.querySelector('#gameShell').classList.remove('uneasy');sfx.door();showCaption('','Silêncio.',950);setObjective('Volte para o elevador');
}
async function killByFather(){
  if(floor2DeathBusy||story.fatherDead)return;floor2DeathBusy=true;mode='dead';for(const k of Object.keys(keys))keys[k]=false;if(document.pointerLockElement)document.exitPointerLock();document.querySelector('#gameShell').classList.remove('chase');sfx.jumpscare();sfx.fatherScream();sfx.fatherShout();ui.interact.classList.add('hidden');ui.crosshair.classList.add('hidden');ui.controls.classList.add('hidden');ui.fatherJumpscare.classList.remove('hidden');ui.death.classList.remove('hidden');ui.death.classList.add('fatherHit');
  await new Promise(r=>setTimeout(r,900));ui.fade.classList.add('on');await new Promise(r=>setTimeout(r,360));resetFloor2Checkpoint();ui.fatherJumpscare.classList.add('hidden');ui.death.classList.add('hidden');ui.death.classList.remove('fatherHit');ui.fade.classList.remove('on');await new Promise(r=>setTimeout(r,320));floor2DeathBusy=false;requestLock();
}
function resetFloor2Checkpoint(){
  restoreInventory10('girl');
  story.girlTalked=true;story.apartmentUnlocked=true;story.breaker2Opened=false;story.power2=false;story.fatherChasing=false;story.fatherDead=false;story.escapeSealed=false;story.tvDamage=0;story.girlPresent=true;story.cigaretteTaken=inventory.includes('cigarette');tvHitCooldownUntil=0;gazeDisturbance=0;document.documentElement.style.setProperty('--unease','0');document.querySelector('#gameShell').classList.remove('uneasy');fatherDying=false;fatherDeathFrame=0;document.querySelector('#gameShell').classList.remove('chase');document.documentElement.style.setProperty('--dread','0');fatherPos={x:-.70,z:-14.12};fatherPath=[];fatherStun=0;apartmentDoorOpen=1;apartmentDoorTarget=1;powerFlicker=0;sfx.setDread(0);setScene('floor2');player.x=0;player.z=-6.55;player.yaw=0;player.pitch=0;mode='world';ui.itemHud.classList.remove('hidden');ui.hand.classList.remove('hidden');ui.hand.src='assets/screwdriver_hold.png';setObjective('Entre no apartamento e encontre o disjuntor');
}

let serviceDoorOpen=0,oldLadyPath=[],oldLadyPathClock=0,oldLadyChaseLeft=0,noisePulse=0,noiseClock=0,wheelClock=0,oldLadySpeaking=0;
let lockContext='front',lockAngle=0,lockPressure=0,lockHolding=false,lockReady=false,lockTargets=[],lockSavedView=null,lockTicked=false;
const ladyHome={x:4.9,z:-8.65};
function floor3InsideHouse(x,z){return (x>1.63&&x<6.78&&z>-9.85&&z<-2.43)||(x>6.65&&x<11.75&&z>-9.85&&z<-.24)||(x>6.65&&x<7.36&&z>-7.35&&z<-5.97)||(story.serviceUnlocked&&x>9.27&&x<10.43&&z>-.45&&z<.45)||(story.serviceUnlocked&&x>7.24&&x<11.75&&z>.23&&z<2.45);}
function doorCollision3(x,z,r){
  const a=frontDoorOpen*Math.PI*.5,b=serviceDoorOpen*Math.PI*.5;
  return circleHitsRect(x,z,r,{x:1.4+Math.sin(a)*.9,z:-6.3+Math.cos(a)*.9,hx:Math.abs(Math.cos(a))*.06+Math.abs(Math.sin(a))*.9,hz:Math.abs(Math.sin(a))*.06+Math.abs(Math.cos(a))*.9})||circleHitsRect(x,z,r,{x:9.025+Math.cos(b)*.825,z:Math.sin(b)*.825,hx:Math.abs(Math.cos(b))*.825+Math.abs(Math.sin(b))*.06,hz:Math.abs(Math.sin(b))*.825+Math.abs(Math.cos(b))*.06});
}
function floor3MonsterWalkable(x,z){if(!floor3InsideHouse(x,z)||doorCollision3(x,z,.30))return false;return !colliders.some(c=>circleHitsRect(x,z,.30,c));}
function drawSurface(o){
  bindGeom(quadBuf);gl.disable(gl.CULL_FACE);gl.uniformMatrix4fv(loc.uModel,false,modelMatrix(o));gl.bindTexture(gl.TEXTURE_2D,spriteTex[o.tex]||textures[o.tex]);gl.uniform3fv(loc.uTint,new Float32Array(o.tint||[1,1,1]));gl.uniform2fv(loc.uUVScale,new Float32Array([1,1]));gl.uniform1f(loc.uEmissive,o.emissive||0);gl.uniform1f(loc.uAlphaCut,.15);gl.drawArrays(gl.TRIANGLES,0,6);gl.enable(gl.CULL_FACE);
}
// Directional procedural audio; no network, TTS or external dependencies.
function spatial3(kind,x,z,volume=.5){
  if(!sfx.ctx)return;const ctx=sfx.ctx,t=ctx.currentTime,dx=x-player.x,dz=z-player.z,d=Math.hypot(dx,dz),out=ctx.createGain(),pan=ctx.createStereoPanner();
  pan.pan.value=clamp((dx*Math.cos(player.yaw)+dz*Math.sin(player.yaw))/Math.max(1,d),-1,1);
  out.gain.value=volume/(1+.14*d*d);out.connect(pan);pan.connect(sfx.master);
  function voice(f,end,dur,type,gain,delay=0){const o=ctx.createOscillator(),g=ctx.createGain(),filter=ctx.createBiquadFilter();o.type=type;o.frequency.setValueAtTime(f,t+delay);o.frequency.exponentialRampToValueAtTime(end,t+delay+dur);filter.type='bandpass';filter.frequency.value=kind==='meow'?1250:kind==='scream'?710:420;filter.Q.value=1.2;g.gain.setValueAtTime(.001,t+delay);g.gain.exponentialRampToValueAtTime(gain,t+delay+.025);g.gain.exponentialRampToValueAtTime(.001,t+delay+dur);o.connect(filter);filter.connect(g);g.connect(out);o.start(t+delay);o.stop(t+delay+dur+.02);}
  if(kind==='meow'){voice(590,260,.58,'sawtooth',.35);voice(830,390,.43,'triangle',.16,.05);}
  else if(kind==='wheel'){voice(145,94,.22,'triangle',.18);voice(560,330,.11,'sine',.07);}
  else if(kind==='purr'){voice(34,29,.60,'sawtooth',.08);}
  else if(kind==='scream'){voice(195,61,.78,'sawtooth',.9);voice(390,124,.65,'sawtooth',.5,.03);voice(1520,440,.21,'square',.25,.08);sfx.noise(.65,.17,1600,0,130);}
  else {voice(118,72,.45,'sawtooth',.20);voice(186,107,.32,'triangle',.13,.17);}
  setTimeout(()=>{out.disconnect();pan.disconnect()},1200);
}
function emitNoise3(x,z,strength,chase=false){
  noisePulse=Math.max(noisePulse,strength);if(!story.frontDoorUnlocked||!floor3InsideHouse(x,z))return;
  const distance=dist2(x,z,oldLadyPos.x,oldLadyPos.z),walls=spriteOccluders.some(r=>segmentIntersectsRect(x,z,oldLadyPos.x,oldLadyPos.z,r));
  if(distance>strength*15*(walls?.70:1))return;
  alertOldLady(x,z,chase);
}
function alertOldLady(tx,tz,chase=false){
  if(!story.frontDoorUnlocked)return;oldLadyTarget={x:tx,z:tz};oldLadyAlertTimer=7;oldLadyPathClock=0;
  if(chase){oldLadyChaseLeft=6;story.oldLadyChasing=true;}
  if(oldLadySpeaking<=0&&!chase){showCaption('VELHA',['Quem tá aí?','Gato desgraçado...','Eu tô ouvindo.'][Math.floor(Math.random()*3)],1600);spatial3('murmur',oldLadyPos.x,oldLadyPos.z,.6);oldLadySpeaking=6;}
}
// Grid navigation fits the chair's full radius; no sliding through room walls.
function path3(start,goal){
  const step=.32,x0=1.6,z0=-9.85,nx=33,nz=40,nodes=new Map();
  let a=null,b=null,ad=1e9,bd=1e9;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=x0+i*step,z=z0+j*step;if(!floor3MonsterWalkable(x,z))continue;const n={x,z,i,j,key:j*nx+i};nodes.set(n.key,n);let d=dist2(x,z,start.x,start.z);if(d<ad){ad=d;a=n}d=dist2(x,z,goal.x,goal.z);if(d<bd){bd=d;b=n}}
  if(!a||!b)return[];const queue=[a],prev=new Map([[a.key,null]]);
  for(let q=0;q<queue.length;q++){const n=queue[q];if(n===b)break;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=(n.j+dj)*nx+n.i+di,other=nodes.get(k);if(!other||Math.abs(other.i-n.i)>1||prev.has(k))continue;prev.set(k,n.key);queue.push(other)}}
  if(!prev.has(b.key))return[];const result=[];for(let k=b.key;k!==null;k=prev.get(k))result.push(nodes.get(k));return result.reverse().slice(1);
}
function updateFloor3Cats(dt){
  for(let i=0;i<floor3CatDefs.length;i++){const c=floor3CatDefs[i],st=floor3CatState[i],sp=sprites.find(q=>q.id===c.id);if(!sp)continue;
    const near=story.frontDoorUnlocked&&floor3InsideHouse(player.x,player.z)&&dist2(player.x,player.z,c.x,c.z)<1.05&&!spriteOccluded(sp);
    if(near)st.awakeUntil=5;else st.awakeUntil=Math.max(0,st.awakeUntil-dt);
    st.call=(st.call||0)-dt;
    if(st.awakeUntil>0&&st.call<=0){st.call=2.0;spatial3('meow',c.x,c.z,.8);emitNoise3(c.x,c.z,.86);}
    st.purr=(st.purr||0)-dt;if(!st.awakeUntil&&st.purr<=0){st.purr=5.5+i*.3;spatial3('purr',c.x,c.z,.14);}
    sp.texName=c.type+'_'+(st.awakeUntil>0?(Math.floor(oldLadyAnimClock*4)%2?'meow1':'meow2'):'sleep');
  }
}
function updateNoise(dt){
  const inside=floor3InsideHouse(player.x,player.z);ui.noiseHud.classList.toggle('hidden',!inside||!story.frontDoorUnlocked);noisePulse=Math.max(0,noisePulse-dt*1.5);
  const moving=mode==='world'&&(keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD),crouch=player.targetEye<1.4,sprint=(keys.ShiftLeft||keys.ShiftRight)&&!crouch;
  const level=moving?(crouch?.045:sprint?.95:.26):0;noiseLevel=lerp(noiseLevel,Math.max(level,noisePulse),1-Math.exp(-dt*13));ui.noiseFill.style.width=(noiseLevel*100)+'%';ui.noiseHud.classList.toggle('loud',noiseLevel>.7);
  noiseClock-=dt;if(inside&&moving&&noiseClock<=0){noiseClock=.50;emitNoise3(player.x,player.z,level,sprint&&dist2(player.x,player.z,oldLadyPos.x,oldLadyPos.z)<5);}
}
function knockOldLady(){
  if(mode!=='world'||story.oldLadyTalked)return;mode='busy';sfx.tone(105,.1,'triangle',.10,55);sfx.tone(105,.1,'triangle',.10,55,.15);sfx.tone(105,.1,'triangle',.10,55,.3);
  setTimeout(()=>{if(scene!=='floor3'||mode!=='busy')return;spatial3('wheel',2,-5.4,.8);sfx.button();frontDoorTarget=.42;oldLadyPos={x:1.80,z:-4.92};oldLadyTarget={...oldLadyPos};
    startDialogue('oldlady',[
      ['VELHA','Quem é?'],['VELHA','Chega mais perto. Eu não enxergo porcaria nenhuma.'],['VOCÊ','Estou procurando o disjuntor. Preciso subir até a casa da minha avó.'],
      ['VELHA','Disjuntor? Não. Não vai mexer naquela merda.'],['VELHA','Enquanto esse andar fica apagado, o elevador não passa daqui.'],['VELHA','E é exatamente assim que tem que ficar.'],
      ['VELHA','Se esse elevador voltar a subir... aquele demônio pode descer.'],['VELHA','Vocês acham que eu sou louca. O síndico achava. O homem da limpeza também achava.'],
      ['VELHA','Sua avó sabe muito bem do que eu tô falando.'],['VOCÊ','O que a minha avó tem a ver com isso?'],['VELHA','Pergunta pra ela. Se chegar viva lá em cima.']
    ],()=>{story.oldLadyTalked=true;frontDoorTarget=0;oldLadyPos={...ladyHome};oldLadyTarget={...ladyHome};sfx.doorSlam();saveCheckpoint('oldlady');setObjective('Arrombe a porta sem fazer barulho');showCaption('','CHECKPOINT • 3º ANDAR',1700);});
  },2100);
}
function tryKnockDoor(){
  if(scene==='floor3'&&!story.oldLadyTalked&&canHitPoint(1.4,-5.4,1.9,.65)){knockOldLady();return true;}
  const door=objects.find(o=>(o.knockable||o.frontDoor||o.serviceDoor||o.horrorDoor||o.apartmentDoor||(o.tex==='wood'&&o.sy>1.9&&(o.sx<.2||o.sz<.2)))&&canHitPoint(o.x,o.z,1.65,.8));
  if(!door)return false;sfx.tone(110,.09,'triangle',.10,55);sfx.tone(110,.09,'triangle',.10,55,.14);sfx.tone(110,.09,'triangle',.10,55,.28);if(scene==='floor3')emitNoise3(player.x,player.z,.65);return true;
}
function openLockpick(context='front'){
  if(mode!=='world')return;lockContext=context;lockpickHits=0;lockAngle=0;lockPressure=0;lockHolding=false;lockReady=false;lockTicked=false;
  lockTargets=Array.from({length:context==='front'?3:4},()=>-.76+Math.random()*1.52);
  lockSavedView={x:player.x,z:player.z,yaw:player.yaw,pitch:player.pitch};
  player.yaw=context==='front'?Math.PI/2:Math.PI;player.pitch=-.15;mode='lockpick';for(const k of Object.keys(keys))keys[k]=false;
  ui.lockpick.classList.remove('hidden');ui.hand.classList.add('hidden');updateLockpickUI();if(document.pointerLockElement)document.exitPointerLock();
}
function closeLockpick(){
  for(const k of Object.keys(keys))keys[k]=false;lockHolding=false;ui.lockpick.classList.add('hidden');ui.hand.classList.remove('hidden');if(lockSavedView){player.yaw=lockSavedView.yaw;player.pitch=lockSavedView.pitch;}mode='world';requestLock();
}
function updateLockpickUI(){
  const near=Math.abs(lockAngle-lockTargets[lockpickHits])<(lockContext==='front'?.13:.10);const dial=document.querySelector('.lockMechanism');
  dial.style.setProperty('--angle',(lockAngle*67)+'deg');dial.style.setProperty('--pressure',lockPressure);dial.classList.toggle('resistance',near);dial.classList.toggle('ready',lockReady);
  ui.lockpickStatus.textContent=lockReady?'PINO ERGUIDO • SOLTE E PARA FIXAR':near?'RESISTÊNCIA • SEGURE E COM CUIDADO':'MOVA DEVAGAR • SINTA A RESISTÊNCIA';
  document.querySelector('#lockPins').innerHTML=lockTargets.map((_,i)=>'<i class="'+(i<lockpickHits?'fixed':i===lockpickHits?'active':'')+'"></i>').join('');
}
function updateLockpick(dt){
  if(mode!=='lockpick')return;const near=Math.abs(lockAngle-lockTargets[lockpickHits])<(lockContext==='front'?.13:.10);
  if(near&&!lockTicked){sfx.tone(970,.045,'sine',.035,740);lockTicked=true;}if(!near)lockTicked=false;
  if(lockHolding){lockPressure=Math.min(1,lockPressure+dt*(near?1.45:2.8));if(!near&&lockPressure>.32){lockHolding=false;failLockpick();return;}if(near&&lockPressure>=1&&!lockReady){lockReady=true;sfx.wire();}}
  else if(!lockReady)lockPressure=Math.max(0,lockPressure-dt*3);updateLockpickUI();
}
function lockpickAttempt(){
  if(mode!=='lockpick')return;lockHolding=false;if(!lockReady){lockPressure=0;return;}
  lockpickHits++;lockPressure=0;lockReady=false;sfx.wire();
  if(lockpickHits===lockTargets.length){
    if(lockContext==='front'){story.frontDoorUnlocked=true;frontDoorTarget=1;setObjective('Encontre o disjuntor • CTRL para andar em silêncio');showCaption('','A fechadura cede. Dentro da casa, até seus passos importam.',3200);}
    else {story.serviceUnlocked=true;setObjective('Conecte os fios do disjuntor');}
    closeLockpick();sfx.door();return;
  }lockTicked=false;updateLockpickUI();
}
async function failLockpick(){
  if(mode!=='lockpick')return;
  lockHolding=false;lockPressure=0;lockReady=false;sfx.pipeClang();sfx.noise(.24,.22,3400);
  if(lockContext==='front'){
    showCaption('VELHA','O que foi isso?',2600);spatial3('murmur',1.8,-4.92,.65);
    updateLockpickUI();return;
  }
  // A failed generator lock is a scripted encounter, independent of pathfinding.
  const f=forward2();oldLadyPos={x:player.x-f[0]*1.15,z:player.z-f[1]*1.15};
  const lady=sprites.find(s=>s.id==='oldlady');if(lady){lady.x=oldLadyPos.x;lady.z=oldLadyPos.z;}
  oldLadyPath=[];ui.lockpick.classList.add('hidden');ui.hand.classList.add('hidden');
  for(const k of Object.keys(keys))keys[k]=false;mode='busy';
  player.yaw=Math.atan2(oldLadyPos.x-player.x,-(oldLadyPos.z-player.z));player.pitch=-.08;
  cameraSnapUntil=performance.now()+1400;spatial3('wheel',oldLadyPos.x,oldLadyPos.z,.8);
  await new Promise(r=>setTimeout(r,280));if(scene==='floor3'&&mode==='busy')killByOldLady();
}
async function killByOldLady(){
  if(floor3DeathBusy)return;floor3DeathBusy=true;mode='dead';lockHolding=false;ui.lockpick.classList.add('hidden');ui.breaker.classList.add('hidden');ui.caption.classList.add('hidden');
  for(const k of Object.keys(keys))keys[k]=false;if(document.pointerLockElement)document.exitPointerLock();spatial3('scream',player.x,player.z,1);
  ui.death.classList.remove('hidden');ui.death.classList.add('oldladyHit');ui.oldladyJumpscare.classList.remove('hidden');ui.hand.classList.add('hidden');ui.interact.classList.add('hidden');ui.crosshair.classList.add('hidden');
  await new Promise(r=>setTimeout(r,820));ui.fade.classList.add('on');await new Promise(r=>setTimeout(r,370));resetFloor3Checkpoint();
  ui.oldladyJumpscare.classList.add('hidden');ui.death.classList.add('hidden');ui.death.classList.remove('oldladyHit');ui.fade.classList.remove('on');floor3DeathBusy=false;requestLock();
}
function resetFloor3Checkpoint(){
  const saved=checkpointSnapshot10?.checkpoint==='oldlady'?checkpointSnapshot10:readSave();story.oldLadyTalked=true;story.frontDoorUnlocked=false;story.serviceUnlocked=false;story.breaker3Opened=false;story.power3=false;story.oldLadyChasing=false;
  inventory=(saved?.checkpoint==='oldlady'?[...saved.inventory]:inventory.filter(x=>x!=='kitten'&&x!=='matches'))||[];story.kittenTaken=inventory.includes('kitten');
  noiseLevel=noisePulse=0;oldLadyChaseLeft=oldLadyAlertTimer=oldLadyAnimClock=0;floor3CatState=floor3CatDefs.map(()=>({awakeUntil:0,call:0}));
  document.querySelector('#gameShell').classList.remove('stealth');setScene('floor3');player.x=.1;player.z=-5.4;player.yaw=Math.PI/2;player.pitch=0;mode='world';ui.hand.classList.remove('hidden');ui.itemHud.classList.remove('hidden');ui.hand.src='assets/screwdriver_hold.png';renderInventory();
  setObjective('Arrombe a porta sem fazer barulho');
}
function updateFloor3(dt,now){
  if(['paused','inventory','dead','ending'].includes(mode))return;
  frontDoorOpen=lerp(frontDoorOpen,frontDoorTarget,1-Math.exp(-dt*3.1));serviceDoorOpen=lerp(serviceDoorOpen,story.serviceUnlocked?1:0,1-Math.exp(-dt*3));
  const sp=sprites.find(q=>q.id==='oldlady');if(!story.frontDoorUnlocked){if(sp){sp.x=oldLadyPos.x;sp.z=oldLadyPos.z}return;}
  if(!['world','lockpick','minigame'].includes(mode))return;
  updateNoise(dt);updateFloor3Cats(dt);oldLadyAnimClock+=dt;oldLadySpeaking=Math.max(0,oldLadySpeaking-dt);oldLadyChaseLeft=Math.max(0,oldLadyChaseLeft-dt);oldLadyAlertTimer=Math.max(0,oldLadyAlertTimer-dt);
  const inside=floor3InsideHouse(player.x,player.z);
  story.oldLadyChasing=oldLadyChaseLeft>0;
  if(story.oldLadyChasing&&inside)oldLadyTarget={x:player.x,z:player.z};
  else if(story.oldLadyChasing&&!inside){oldLadyTarget={x:1.95,z:-5.4};oldLadyChaseLeft=Math.min(oldLadyChaseLeft,2.5);}
  else if(oldLadyAlertTimer===0)oldLadyTarget={...ladyHome};
  if(story.power3&&!inside){oldLadyTarget={x:1.95,z:-5.4};oldLadyChaseLeft=0;story.oldLadyChasing=false;}
  oldLadyPathClock-=dt;if(oldLadyPathClock<=0){oldLadyPathClock=.6;oldLadyPath=path3(oldLadyPos,oldLadyTarget);}
  const target=oldLadyPath[0];if(target){const dx=target.x-oldLadyPos.x,dz=target.z-oldLadyPos.z,d=Math.hypot(dx,dz),amount=Math.min(d,dt*(story.oldLadyChasing?3.25:1.90));
    if(d<.04)oldLadyPath.shift();else {const x=oldLadyPos.x+dx/d*amount,z=oldLadyPos.z+dz/d*amount;if(floor3MonsterWalkable(x,z)){oldLadyPos.x=x;oldLadyPos.z=z;}else oldLadyPathClock=0;}
    wheelClock-=dt;if(wheelClock<=0){wheelClock=.48;spatial3('wheel',oldLadyPos.x,oldLadyPos.z,.48);}
  }
  if(sp){sp.x=oldLadyPos.x;sp.z=oldLadyPos.z;}
  const distance=dist2(player.x,player.z,oldLadyPos.x,oldLadyPos.z),clear=!spriteOccluders.some(r=>segmentIntersectsRect(player.x,player.z,oldLadyPos.x,oldLadyPos.z,r));
  if(inside&&clear&&distance<.66)killByOldLady();
  document.querySelector('#gameShell').classList.toggle('stealth',story.oldLadyChasing&&inside);
}

function horrorRoomAmount(){
  if(scene!=='floor1'||story.powerOn||!story.hasScrewdriver)return 0;
  if(player.x<=1.28||player.z<=-7.75||player.z>=-3.85)return 0;
  return clamp((player.x-1.28)/2.35,0,1);
}
function triggerHorrorDoorIfNeeded(){
  if(scene!=='floor1'||story.powerOn||!story.hasScrewdriver||story.horrorDoorTriggered)return;
  if(Math.abs(player.x)<.90&&player.z<-3.52&&player.z>-4.55){
    story.horrorDoorTriggered=true;horrorDoorTarget=1;sfx.horrorDoor(true);sfx.suspense();
    const dx=1.14-player.x,dz=-5.80-player.z;player.yaw=Math.atan2(dx,-dz);player.pitch=clamp(player.pitch,-.10,.10);cameraSnapUntil=performance.now()+80;
  }
}
function updateHorrorRoom(dt,now){
  triggerHorrorDoorIfNeeded();
  horrorDoorOpen=lerp(horrorDoorOpen,horrorDoorTarget,1-Math.pow(.00008,dt));
  if(Math.abs(horrorDoorOpen-horrorDoorTarget)<.002)horrorDoorOpen=horrorDoorTarget;
  horrorIntensity=horrorRoomAmount();sfx.setDread(horrorIntensity);document.documentElement.style.setProperty('--dread',horrorIntensity.toFixed(3));
  if(horrorIntensity>.18&&now>nextHorrorPulse){sfx.dreadPulse(horrorIntensity);nextHorrorPulse=now+820-(horrorIntensity*520)+Math.random()*380;}
  if(!horrorDeathBusy&&horrorIntensity>.94)killInHorrorRoom();
}
async function killInHorrorRoom(){
  if(horrorDeathBusy)return;horrorDeathBusy=true;mode='dead';for(const k of Object.keys(keys))keys[k]=false;if(document.pointerLockElement)document.exitPointerLock();sfx.jumpscare();sfx.setDread(0);ui.interact.classList.add('hidden');ui.crosshair.classList.add('hidden');ui.controls.classList.add('hidden');document.documentElement.style.setProperty('--dread','1');ui.death.classList.remove('hidden');ui.death.classList.add('hit');
  await new Promise(r=>setTimeout(r,820));ui.fade.classList.add('on');await new Promise(r=>setTimeout(r,430));resetFloor1Checkpoint();ui.death.classList.add('hidden');ui.death.classList.remove('hit');document.documentElement.style.setProperty('--dread','0');ui.fade.classList.remove('on');await new Promise(r=>setTimeout(r,360));horrorDeathBusy=false;requestLock();
}
function resetFloor1Checkpoint(){
  restoreInventory10('janitor');
  story.janitorDone=true;story.hasScrewdriver=true;story.breakerOpened=false;story.powerOn=false;story.janitorPresent=true;story.horrorDoorTriggered=false;horrorDoorOpen=0;horrorDoorTarget=0;horrorIntensity=0;powerFlicker=0;sfx.setDread(0);setScene('floor1');mode='pickup';ui.itemHud.classList.remove('hidden');ui.hand.classList.remove('hidden');ui.hand.src='assets/screwdriver_hold.png';ui.pickup.classList.remove('hidden');setObjective('Encontre o disjuntor no fim do corredor');setTimeout(()=>{if(mode==='pickup'){ui.pickup.classList.add('hidden');mode='world';requestLock()}},900);
}

function playAttack(){
  if(attackBusy||!story.hasScrewdriver||mode!=='world')return;
  attackBusy=true;sfx.attack();ui.hand.classList.remove('attackThrust');void ui.hand.offsetWidth;ui.hand.classList.add('attackThrust');ui.hand.src='assets/screwdriver_hold.png';
  setTimeout(()=>{if(attackBusy){ui.hand.src='assets/screwdriver_use.png';if(tryKnockDoor()){}else tryHitTV()}},88);
  setTimeout(()=>{ui.hand.src='assets/screwdriver_hold.png'},205);
  setTimeout(()=>{attackBusy=false;ui.hand.classList.remove('attackThrust')},300);
}
// ------------------------------------------------------------
// Input
// ------------------------------------------------------------
function requestLock(){if(canvas.requestPointerLock&&document.pointerLockElement!==canvas){try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{})}catch(e){}}}
window.addEventListener('keydown',e=>{if(mode==='kitchen')return;if(mode==='lockpick'){if(e.code==='KeyE'){e.preventDefault();if(!e.repeat)lockHolding=true;}else if(e.code==='Escape'){e.preventDefault();closeLockpick();}return;}if(e.code==='KeyQ'){e.preventDefault();if(mode==='inventory')closeInventory();else if(mode==='world')openInventory();return}if(e.code==='Escape'){if(mode==='inventory'){e.preventDefault();closeInventory();return}if(mode==='lockpick'){e.preventDefault();return}if(document.pointerLockElement===canvas)return;e.preventDefault();togglePause();return}if((e.code==='Enter'||e.code==='Space')&&!ui.title.classList.contains('hidden')){e.preventDefault();ui.play.click();return}if((e.code==='Enter'||e.code==='Space')&&!ui.letter.classList.contains('hidden')){e.preventDefault();ui.letterContinue.click();return}keys[e.code]=true;if(e.code==='KeyE'){e.preventDefault();interact()}if(e.code==='Space'&&mode==='world'&&player.jumpY<=.001){player.yVel=4.55;sfx.jump();if(scene==='floor3')emitNoise3(player.x,player.z,.8)}});
window.addEventListener('keyup',e=>{keys[e.code]=false;if(mode==='lockpick'&&e.code==='KeyE')lockpickAttempt();});
document.addEventListener('mousemove',e=>{if(mode==='lockpick'){if(!lockHolding&&!lockReady){const r=document.querySelector('.lockMechanism').getBoundingClientRect();lockAngle=clamp((e.clientX-r.left-r.width/2)/(r.width*.5),-1,1);updateLockpickUI();}return;}if(document.pointerLockElement!==canvas)return;if(mode!=='world'&&mode!=='ride')return;if(performance.now()<cameraSnapUntil)return;player.yaw+=e.movementX*.00215;player.pitch=clamp(player.pitch-e.movementY*.00195,-1.38,1.38)});
canvas.addEventListener('mousedown',e=>{if(e.button!==0)return;sfx.unlock();if(mode==='dialogue'){advanceDialogue();return}if(mode==='world'&&document.pointerLockElement!==canvas){requestLock();return}if(mode==='world'&&story.hasScrewdriver)playAttack()});
document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===canvas;if(locked&&!['world','dialogue'].includes(mode)){document.exitPointerLock();return}if(locked){ui.crosshair.classList.remove('hidden');ui.controls.classList.remove('hidden');ui.cam.classList.remove('hidden')}else{ui.crosshair.classList.add('hidden');ui.controls.classList.add('hidden');ui.cam.classList.add('hidden');if((mode==='world'||mode==='dialogue')&&scene!=='none')togglePause()}syncCursor12()});
if(ui.lockpickAction){ui.lockpickAction.addEventListener('pointerdown',e=>{e.preventDefault();lockHolding=true;ui.lockpickAction.setPointerCapture(e.pointerId)});ui.lockpickAction.addEventListener('pointerup',lockpickAttempt);ui.lockpickAction.addEventListener('pointercancel',()=>{lockHolding=false;lockPressure=0;});}
document.querySelector('#lockExit').addEventListener('click',closeLockpick);
ui.dialogue.addEventListener('click',advanceDialogue);

// ------------------------------------------------------------
// Pause menu
// ------------------------------------------------------------
function togglePause(){
  if(mode==='paused'){resumeGame();return}
  if(!['world','dialogue','minigame','pickup'].includes(mode))return;
  pausePrevMode=mode;mode='paused';for(const k of Object.keys(keys))keys[k]=false;if(document.pointerLockElement)document.exitPointerLock();ui.pause.classList.remove('hidden');sfx.click();
}
function resumeGame(){if(mode!=='paused')return;ui.pause.classList.add('hidden');mode=pausePrevMode;sfx.click();if(mode==='world')requestLock()}
ui.resume.addEventListener('click',()=>{sfx.unlock();resumeGame()});
ui.menu.addEventListener('click',()=>{sfx.unlock();sfx.click();setTimeout(()=>location.reload(),90)});
ui.volume.addEventListener('input',()=>{const v=Number(ui.volume.value);ui.volumeValue.textContent=v+'%';sfx.unlock();sfx.setVolume(v/100);introAudio.setVolume(v/100)});

// ------------------------------------------------------------
// Screens
// ------------------------------------------------------------
function showLetter(){
  sfx.unlock();introAudio.startMenu();introAudio.menuClick();ui.title.classList.add('hidden');ui.letter.classList.remove('hidden');
}
ui.play.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();clearSave();inventory=[];story.cigaretteTaken=false;showLetter()});
ui.continueBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();sfx.unlock();introAudio.menuClick();const data=readSave();if(data){gameStartCommitted=true;introAudio.stopMenu();loadCheckpoint(data)}});

let gameStartCommitted=false;
function startGameFromLetter(e){
  // This path is intentionally synchronous. No asset promise, audio promise,
  // pointer-lock request or transition is allowed to gate progression.
  if(e){e.preventDefault();e.stopPropagation()}
  if(gameStartCommitted)return;
  gameStartCommitted=true;
  sfx.unlock();introAudio.fold();introAudio.stopMenu();

  // Build the world first, then remove the paper overlay in the same click.
  // Assets continue preloading in the background; local sprites appear as soon
  // as their textures are ready and never block entering the reception.
  try{
    setScene('reception');
    mode='world';
    setObjective('Fale com o recepcionista');
  }catch(err){
    console.error('Falha ao iniciar recepção:',err);
    // Never strand the user on the letter even if rendering initialization fails.
    mode='world';
  }
  ui.letter.classList.add('hidden');
  ui.fade.classList.remove('on');
  ui.controls.classList.remove('hidden');
  ui.controls.textContent='clique na tela para controlar a câmera · WASD mover · SHIFT correr · ESPAÇO pular · CTRL agachar · Q inventário · E interagir · ESC pausar';
  // Do not request pointer lock from the paper button. The first click directly
  // on the 3D canvas activates mouse-look, avoiding browser-specific lock bugs.
}
ui.letterContinue.addEventListener('click',startGameFromLetter);
function showEnding(){if(currentCheckpoint==='oldlady')saveCheckpoint('oldlady');ui.noiseHud.classList.add('hidden');mode='ending';ui.end.classList.remove('hidden');ui.crosshair.classList.add('hidden');ui.controls.classList.add('hidden');ui.cam.classList.add('hidden');ui.hand.classList.add('hidden');ui.itemHud.classList.add('hidden');setObjective('');if(document.pointerLockElement)document.exitPointerLock()}
ui.restart.addEventListener('click',()=>location.reload());

// ------------------------------------------------------------
// Main loop
// ------------------------------------------------------------
function tick(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(scene!=='none'){elevatorDoors=lerp(elevatorDoors,elevatorDoorTarget,1-Math.pow(.0005,dt));if(scene==='floor1')triggerHorrorDoorIfNeeded();updatePlayer(dt);if(scene==='floor1')updateHorrorRoom(dt,now);else if(scene==='floor2')updateFloor2(dt,now);else if(scene==='floor3')updateFloor3(dt,now);else if(scene==='floor4')updateKitchen4(dt,now);else if(scene==='floor5')updateFloor5(dt,now);else{if(horrorIntensity){horrorIntensity=0;sfx.setDread(0);document.documentElement.style.setProperty('--dread','0')}if(gazeDisturbance){gazeDisturbance=0;document.documentElement.style.setProperty('--unease','0');document.querySelector('#gameShell').classList.remove('uneasy')}}if(mode==='lockpick')updateLockpick(dt);updateHud();sfx.ambient(scene,scene==='floor2'?story.power2:scene==='floor3'?story.power3:story.powerOn,now);if(powerFlicker>0)powerFlicker=Math.max(0,powerFlicker-dt);render()}requestAnimationFrame(tick)}
refreshContinueButton();renderInventory();requestAnimationFrame(tick);

// Fourth floor: isolated restaurant state; original floor systems remain intact.
const names4={meat:'Carne',potato:'Batata',salt:'Sal',bread:'Pão',cheese:'Queijo',lettuce:'Alface',carrot:'Cenoura',onion:'Cebola',water:'Água',chicken:'Frango',sauce:'Molho da casa',soup:'Sopa'};
const recipes4=[
 {name:'Prato do ajudante',time:420,parts:['meat:grilled','potato:boiled'],text:'Carne + batata + sal. Tempere a carne, corte a batata. Chapa: carne ao ponto (12–18 s). Panela: batata em MÉDIO por 10–16 s. Monte e sirva.'},
 {name:'Hambúrguer',time:260,parts:['bread:raw','meat:grilled','cheese:raw','lettuce:cut'],text:'Pão → carne temperada e AO PONTO → queijo → alface cortada. Monte nesta ordem. Chapa: 12–18 s.'},
 {name:'Bife com batatas',time:250,parts:['meat:grilled','potato:boiled'],text:'Carne temperada AO PONTO (chapa 12–18 s). Batata cortada na panela MÉDIO (10–16 s), sal. Monte carne → batata.'},
 {name:'Sopa da casa',time:260,parts:['soup:boiled','bread:raw'],text:'Corte cenoura e cebola. Na panela, adicione ÁGUA → CENOURA → CEBOLA → SAL. Cozinhe em BAIXO por 14–20 s. Monte sopa → pão.'},
 {name:'Frango assado',time:260,parts:['chicken:baked','potato:boiled','sauce:raw'],text:'Tempere frango com sal. Forno: 180 °C, 18 s. Retire após a campainha (até 8 s de tolerância). Batata cortada: MÉDIO por 10–16 s. Monte frango → batata → molho.'},
 {name:'Banquete do brutamonte',time:350,parts:['meat:grilled','potato:boiled','soup:boiled','bread:raw','sauce:raw'],text:'Carne temperada AO PONTO; batata cortada em MÉDIO; sopa em BAIXO (água → cenoura cortada → cebola cortada → sal). Use os dois queimadores. Monte carne → batata → sopa → pão → molho.'}
];
let kitchen4={phase:'arrival',order:0,left:420,patience:100,bag:[],jobs:{},selection:[],plate:null,eating:0,hintAt:0,chatter:15,cut:null,door:false,power:false,opened:false,called:false,uid:0};
const panel4=document.createElement('section');panel4.id='kitchenPanel';panel4.className='screen hidden';document.querySelector('#gameShell').append(panel4);
const hud4=document.createElement('div');hud4.id='kitchenHud';hud4.className='hidden';document.querySelector('#gameShell').append(hud4);
const attack4=document.createElement('div');attack4.id='bruteAttack';attack4.className='hidden';attack4.innerHTML='<img alt="" src="assets/brute_sheet.png">';document.querySelector('#gameShell').append(attack4);
function cropSheet4(file,rects,prefix){return new Promise(resolve=>{const im=new Image();im.onload=()=>{rects.forEach((r,i)=>{const c=document.createElement('canvas');c.width=r[2];c.height=r[3];const g=c.getContext('2d');g.drawImage(im,...r,0,0,c.width,c.height);const d=g.getImageData(0,0,c.width,c.height),a=d.data; // Connected background only: black outlines inside the silhouette remain.
 const seen=new Uint8Array(c.width*c.height),queue=[];function push(p){if(p<0||p>=seen.length||seen[p])return;seen[p]=1;if(a[p*4]<24&&a[p*4+1]<24&&a[p*4+2]<24)queue.push(p)}for(let x=0;x<c.width;x++){push(x);push((c.height-1)*c.width+x)}for(let y=0;y<c.height;y++){push(y*c.width);push(y*c.width+c.width-1)}for(let q=0;q<queue.length;q++){const p=queue[q];a[p*4+3]=0;if(p%c.width)push(p-1);if(p%c.width<c.width-1)push(p+1);push(p-c.width);push(p+c.width)}g.putImageData(d,0,0);imgs[prefix+i]=c;spriteTex[prefix+i]=textureFromImage(c);if(prefix==='brute4_'&&i===3)attack4.querySelector('img').src=c.toDataURL('image/png');});resolve()};im.onerror=resolve;im.src=location.protocol==='file:'&&window.PREDIO_RESTAURANT_SHEETS?window.PREDIO_RESTAURANT_SHEETS[file.split('/').pop()]:file;})}
const spritesReady4=Promise.all([cropSheet4('assets/chef_sheet.png',[[58,5,380,1135],[485,5,510,1135],[1080,5,456,1135]],'chef4_'),cropSheet4('assets/brute_sheet.png',[[0,395,389,510],[393,395,379,510],[774,395,380,510],[1155,385,381,520]],'brute4_')]);
function texture4(key,bg,draw){const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,512,512);draw(g);textures[key]=makeTextureFromCanvas(c,['tile4','wine4','gothic5','stone5','carpet5','mold5'].includes(key))}
texture4('wine4','#542c32',g=>{for(let x=0;x<512;x+=32){g.fillStyle='#623239';g.fillRect(x,0,3,512)}g.strokeStyle='#927454';g.strokeRect(18,18,476,476)});
texture4('tile4','#c5c5b2',g=>{g.strokeStyle='#757b71';g.lineWidth=5;for(let i=0;i<=512;i+=64){g.beginPath();g.moveTo(i,0);g.lineTo(i,512);g.moveTo(0,i);g.lineTo(512,i);g.stroke()}for(let i=0;i<65;i++){g.fillStyle='rgba(70,55,30,.1)';g.fillRect(rnd()*512,rnd()*512,2,12)}});
texture4('menu4','#ded0ab',g=>{g.fillStyle='#573c2b';g.textAlign='center';g.font='30px Georgia';g.fillText('RESTAURANTE',256,95);g.font='42px Georgia';g.fillText('BELLEVUE',256,155);g.font='22px Georgia';['HOTEL • DESDE 1948','Sopa da casa','Bife com batatas','Frango assado','Bom apetite.'].forEach((s,i)=>g.fillText(s,256,225+i*45));g.strokeStyle='#9e7b4c';g.strokeRect(24,24,464,464)});
texture4('staff4','#998776',g=>{g.fillStyle='#362c28';g.fillRect(25,28,462,338);for(let i=0;i<5;i++){g.fillStyle=i===1?'#b7966d':'#9b887a';g.beginPath();g.arc(80+i*86,170,25,0,7);g.fill();g.fillStyle=i===1?'#702d30':'#ddd0bb';g.fillRect(55+i*86,195,52,140)}g.fillStyle='#382a25';g.font='26px Georgia';g.fillText('EQUIPE • 1962',140,417);g.font='19px Georgia';g.fillText('Auxiliar de cozinha — desligado',60,468);g.fillRect(61,455,165,2)});
function stationLabel4(key,title){texture4(key,'#22312e',g=>{g.fillStyle='#e0d4b7';g.textAlign='center';g.font='bold 38px monospace';g.fillText(title,256,285);g.strokeStyle='#9b8768';g.strokeRect(12,160,488,180)})}
['DESPENSA','GELADEIRA','CORTE','TEMPERO','CHAPA','FOGÃO','FORNO','MONTAGEM','PIA','RECEITAS'].forEach((s,i)=>stationLabel4('sign4_'+i,s));
textures.ind4=labelTexture('4');textures.ind5=labelTexture('5');
function wall4(x,z,w,d,tex='wine4'){box(x,1.65,z,w,3.3,d,tex,[1,1,1],[Math.max(w,d)/2,1]);for(const [y,h]of [[.12,.24],[.85,.06],[3.12,.10]])box(x,y,z,w+.035,h,d+.035,'darkwood',[1.5,1.2,.8]);solidRect(x,z,w,d,3.3,false,'wall4');occluderRect(x,z,w,d,'wall4')}
function table4(x,z){box(x,.76,z,1.65,.12,1.35,'darkwood',[1.7,1.4,1]);box(x,.84,z,1.72,.035,1.42,'white',[1.3,1.2,1]);for(const dx of [-.66,.66])for(const dz of [-.52,.52])box(x+dx,.37,z+dz,.07,.75,.07,'darkwood');solidRect(x,z,1.75,1.45,.85,true,'table4');box(x,.70,z+.71,1.65,.25,.025,'white',[1.25,1.15,.95]);box(x,.70,z-.71,1.65,.25,.025,'white',[1.25,1.15,.95]);for(const dz of [-1.08,1.08]){box(x,.44,z+dz,.53,.08,.52,'wood');box(x,.85,z+dz+(dz>0?.22:-.22),.54,.78,.06,'darkwood');for(const dx of [-.2,.2])box(x+dx,.21,z+dz,.05,.42,.05,'darkwood');solidRect(x,z+dz,.57,.56,1.25,false,'chair4')}for(const dx of [-.48,.48]){box(x+dx,.867,z,.36,.025,.36,'white',[1.7,1.6,1.4],[1,1],{geometry:'round'});box(x+dx,.98,z+.32,.095,.2,.095,'metal',[1.3,1.3,1.4],[1,1],{geometry:'round'});box(x+dx+.24,.87,z,.025,.02,.32,'metal')}box(x,1,z,.20,.28,.06,'menu4');}
function counter4(x,z,w,d,title,index){box(x,.47,z,w,.88,d,'metal',[1.1,1.15,1.2],[3,1]);box(x,.96,z,w+.08,.12,d+.08,'metal',[1.6,1.7,1.8]);for(let xx=x-w/2+.35;xx<x+w/2;xx+=.7){box(xx,.50,z+d/2+.025,.035,.3,.025,'brass')}solidRect(x,z,w,d,1.02,false,'counter4');box(x,1.36,z+d/2+.035,w*.65,.32,.025,'sign4_'+index,[1.5,1.5,1.5],[1,1],{emissive:.15});interactables.push({id:'k4_'+title,x,z,range:2.25,label:title.toUpperCase()})}
function buildFloor4(){
 player.x=0;player.z=2.5;player.yaw=0;player.pitch=0;player.jumpY=0;player.yVel=0;
 box(0,-.1,-5,24,.2,16,'parquet',[1.65,1.35,1.05],[12,8]);box(0,3.4,-5,24,.2,16,'ceiling',[1.1,1,.83],[8,8]);box(0,-.1,-20,24,.2,14,'tile4',[1,1,1],[12,7]);box(0,3.4,-20,24,.2,14,'ceiling',[1.05,1.1,1.1],[8,7]);
 wall4(-12,-12,.2,30);wall4(12,-12,.2,30);wall4(0,-27,24,.2,'tile4');wall4(-6.6,3,10.8,.2);wall4(6.6,3,10.8,.2);box(0,2.9,3,2.4,.9,.2,'wine4');addElevatorPreview('z',0,3.03);addElevatorExterior('z',0,2.93,'floor4');box(0,2.65,2.83,.6,.25,.04,'ind4',[1,1,1],[1,1],{emissive:.5});
 // Full partition, two generous real doorways and a service hatch.
 wall4(-9,-13,6,.2,'tile4');box(-4.5,.53,-13,3,1.06,.22,'tile4');box(-4.5,1.10,-13,3.2,.10,.55,'metal',[1.4,1.4,1.3]);solidRect(-4.5,-13,3,.25,1.15,false,'pass4');box(-4.5,2.98,-13,3,.64,.22,'tile4');wall4(7.5,-13,9,.2,'tile4');wall4(0,-13,2,.2,'tile4');box(-2,3,-13,2,.6,.2,'tile4');box(2,3,-13,2,.6,.2,'tile4');
 for(const x of [-8,-4,4,8])for(const z of [-2,-7])table4(x,z);
 for(const x of [-7,0,7])for(const z of [-3,-9]){box(x,2.98,z,.05,.55,.05,'brass');box(x,2.7,z,.8,.1,.8,'brass',[1.5,1.3,.9],[1,1],{geometry:'round'});for(let i=0;i<5;i++){const a=i*1.256;box(x+Math.cos(a)*.42,2.63,z+Math.sin(a)*.42,.14,.28,.14,'white',[1.5,1.1,.6],[1,1],{geometry:'shade',emissive:.75})}}
 for(const x of [-11.75,11.75])for(const z of [-3,-8]){box(x,1.7,z,.08,1.65,2.2,'night3');for(const dz of [-1.15,1.15])box(x,1.7,z+dz,.22,1.9,.25,'fabric',[.65,.3,.28]);box(x,2.65,z,.25,.08,2.6,'brass');box(x,1.65,z+.04,.12,1.8,.06,'brass')}
 box(0,2.52,-12.43,3.8,.7,.04,'menu4',[1.5,1.3,1]);
 // Sprite includes the seated client and table, so no duplicate mesh clips it.
 sprite('brute4',0,-10.45,2.55,'brute4_0',{billboard:false,rotY:0,emissive:.32});solidRect(0,-10.6,2.6,1.65,2.6,false,'bruteTable');
 for(let i=0;i<5;i++){box(-10+i*.45,1.08,-16.55,.28,.12,.23,'white',i<3?[1.5,1,.25]:[.7,1.2,.35],[1,1],{geometry:'round'});}box(-9,1.12,-16.9,1.9,.1,.65,'wood',[1.2,.85,.5]);
 sprite('chef4',-4,-14.35,2.15,'chef4_0');solidRect(-4,-14.35,.8,.8,2.15,false,'chef');interactables.push({id:'k4_chef',x:-4,z:-14.35,range:2.6,label:'FALAR COM O CHEF'});
 counter4(-9,-16.7,3.2,1.1,'despensa',0);counter4(-9,-20,3.2,1.1,'geladeira',1);box(-9,1.68,-20,3.15,1.25,1.1,'metal');box(-9,1.65,-19.40,.07,1.1,.05,'black');for(const x of [-9.8,-8.2])box(x,1.65,-19.36,.06,.4,.06,'brass');
 counter4(-9,-24,3.2,1.1,'corte',2);box(-9,1.06,-23.75,1,.05,.6,'wood',[2,1.8,1.5]);box(-8.6,1.105,-23.65,.5,.025,.06,'metal');box(-8.25,1.11,-23.65,.2,.06,.08,'darkwood');
 counter4(-7,-21.7,2.5,1.1,'tempero',3);for(let i=0;i<4;i++)box(-7.8+i*.5,1.16,-21.7,.16,.25,.16,'white',[1.5,1.3,.8],[1,1],{geometry:'round'});
 counter4(2,-24,3,1.2,'chapa',4);box(2,1.045,-24,2.3,.05,.8,'black');for(let i=0;i<10;i++)box(1+i*.22,1.08,-24,.025,.025,.8,'metal');box(2,2.7,-24,3.3,.45,1.4,'metal',[1.2,1.25,1.3],[1,1],{geometry:'shade'});box(2,3.12,-24,.65,.4,.65,'metal');
 counter4(7,-24,3,1.2,'fogão',5);for(const dx of [-.65,.65]){box(7+dx,1.08,-24,.65,.1,.65,'black',[1,1,1],[1,1],{geometry:'round'});box(7+dx,1.23,-24,.55,.28,.55,'metal',[1.5,1.5,1.6],[1,1],{geometry:'round'});box(7+dx,1.37,-24,.56,.04,.56,'black',[1,1,1],[1,1],{geometry:'round'});box(7+dx,1.43,-24,.08,.1,.08,'darkwood')}
 counter4(10,-20,1.4,1.3,'forno',6);box(10,.48,-19.32,1,.5,.025,'black');box(10,.8,-19.28,.8,.06,.06,'metal');
 counter4(3,-17,4,1.3,'montagem',7);for(let i=0;i<4;i++)box(1.6+i*.8,1.06,-17,.5,.035,.5,'white',[1.6,1.6,1.5],[1,1],{geometry:'round'});
 counter4(8,-16.7,2.7,1.1,'pia',8);box(8,1.03,-16.7,1,.02,.65,'black');box(8,1.17,-17,.035,.3,.035,'metal');box(8,1.3,-16.87,.035,.035,.28,'metal');
 counter4(-4,-17,2.4,1.1,'receitas',9);box(-4,1.06,-16.85,.6,.035,.48,'menu4');
 for(const x of [-9,7])for(const z of [-16.7,-24])for(const y of [1.85,2.3]){box(x,y,z-.65,3.2,.06,.45,'wood',[1.3,1.2,.9]);for(let i=0;i<6;i++)box(x-1.3+i*.5,y+.15,z-.67,.24,.27,.24,'white',[1,.8,.5],[1,1],{geometry:'round'})}
 for(const x of [-7,0,7])for(const z of [-16,-22]){box(x,3.2,z,3.3,.12,.5,'metal');box(x,3.12,z,3,.04,.28,'white',[.9,1.1,1.3],[1,1],{emissive:.85,fluorescent4:true})}
 // Breaker room in back-left; unlocked reward door at z=-21, x=-5.
 wall4(-5,-23.5,.16,7,'tile4');wall4(-.5,-23.5,.16,7,'tile4');wall4(-4.15,-20,1.7,.16,'tile4');wall4(-.9,-20,.8,.16,'tile4');box(-2.3,3.04,-20,2,.52,.16,'tile4');
 sprite('breaker4',-2,-26.86,1.02,'breaker_closed',{y:.8,billboard:false,rotY:0,breaker:true});interactables.push({id:'k4_breaker',x:-2,z:-26.8,range:1.9,label:'ABRIR COM A CHAVE DE FENDA'});
 box(-2.3,1.45,-20.12,2,2.8,.12,'metal',[.75,.8,.8],[1,2],{service4:true});solidRect(-2.3,-20.12,2,.2,3.3,false,'service4');occluderRect(-2.3,-20.12,2,.2,'service4');
 box(-4.85,2.45,-22.4,.15,.15,4.4,'metal');box(-4.85,1.5,-25.9,.18,2.1,.18,'metal');for(let i=0;i<3;i++)box(-4, .35+i*.6,-26,1,.5,.7,'wood',[1,1,.9]);
 box(-11.86,1.8,-15.4,.05,.8,1.1,'staff4');interactables.push({id:'k4_photo',x:-11.4,z:-15.4,range:2,label:'OBSERVAR FOTO ANTIGA'});box(-11.3,.9,-18.2,.55,.05,.45,'wood');if(!inventory.includes('matches'))box(-11.3,.96,-18.2,.25,.08,.16,'menu4',[1,1,1],[1,1],{matches4:true});interactables.push({id:'k4_matches',x:-11.3,z:-18.2,range:1.6,label:'PEGAR CAIXA DE FÓSFOROS'});
 interactables.push({id:'k4_serve',x:0,z:-10.4,range:2.5,label:'SERVIR'},{id:'k4_elevator',x:0,z:2.8,range:2.3,label:'SUBIR AO 5º ANDAR'});
}
function resetKitchen4(saved=false){kitchen4={phase:saved?'orders':'arrival',order:saved?1:0,left:saved?recipes4[1].time:420,patience:100,bag:[],jobs:{},selection:[],plate:null,eating:0,hintAt:0,chatter:18,cut:null,door:false,power:false,opened:false,called:saved,uid:0};panel4.classList.add('hidden');attack4.classList.add('hidden');ui.pause.classList.add('hidden');ui.end.classList.add('hidden');ui.controls.classList.remove('hidden');setScene('floor4');mode='world';if(saved){player.x=-2;player.z=-15;setObjective('Ajude o chef — consulte o caderno de receitas')}else setObjective('Explore o restaurante');ui.hand.classList.remove('hidden');ui.itemHud.classList.remove('hidden');}
function addItem4(kind,state='raw',quality=100){if(kitchen4.bag.length>=16){showCaption('CHEF','A bandeja está cheia. Use a pia para descartar algo.',2000);return}kitchen4.bag.push({id:++kitchen4.uid,kind,state,quality,seasoned:false});sound4('pickup');}
function itemName4(a){return (names4[a.kind]||a.kind)+(a.state==='raw'?'':a.state==='cut'?' · cortado':a.state==='grilled'?' · grelhado':a.state==='baked'?' · assado':' · cozido')+(a.seasoned?' · temperado':'')}
function button4(label,fn,disabled=false){const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=fn;panel4.querySelector('.kbody').append(b);return b}
function closeKitchenPanel4(){if(mode==='kitchen'){mode='world';panel4.classList.add('hidden');kitchen4.cut=null;requestLock()}}
function panelBase4(title,help){mode='kitchen';if(document.pointerLockElement)document.exitPointerLock();for(const k of Object.keys(keys))keys[k]=false;panel4.classList.remove('hidden');panel4.innerHTML='<div class="kcard"><div class="khead"><small>BELLEVUE • COZINHA</small><button id="kclose">VOLTAR · E / ESC</button></div><h2></h2><p class="khelp"></p><div class="kbody"></div><p class="kstatus" aria-live="polite"></p></div>';panel4.querySelector('h2').textContent=title;panel4.querySelector('.khelp').textContent=help;panel4.querySelector('#kclose').onclick=closeKitchenPanel4;}
function feedback4(t){const p=panel4.querySelector('.kstatus');if(p)p.textContent=t}
function selectBag4(filter,fn){const list=kitchen4.bag.filter(filter);if(!list.length)feedback4('Nenhum componente disponível. Pegue ingredientes na despensa ou na geladeira.');list.forEach(a=>button4(itemName4(a),()=>fn(a)))}
function removeItem4(a){kitchen4.bag=kitchen4.bag.filter(b=>b.id!==a.id)}
function openStation4(st){
 if(kitchen4.phase==='arrival'){showCaption('CHEF','Ei! Você aí! Venha falar comigo antes.',1800);return}
 if(kitchen4.plate&&st!=='receitas'&&st!=='pia'){showCaption('','Você está carregando um prato. Sirva-o ou descarte na pia.',1800);return}
 if(st==='receitas'){panelBase4('Caderno de receitas','Os aparelhos continuam cozinhando enquanto você consulta. ESC volta para a cozinha.');recipes4.forEach((r,i)=>{const p=document.createElement('article');p.className='recipe4';p.innerHTML='<strong></strong><p></p>';p.querySelector('strong').textContent=(i===0?'TREINO':`PEDIDO ${i}`)+' — '+r.name;p.querySelector('p').textContent=r.text;panel4.querySelector('.kbody').append(p)});return}
 if(st==='despensa'||st==='geladeira'){panelBase4(st==='despensa'?'Despensa':'Geladeira / freezer','Pegue cada ingrediente. A bandeja da cozinha é separada do inventário Q.');(st==='despensa'?['potato','bread','salt','carrot','onion','water','sauce']:['meat','chicken','cheese','lettuce']).forEach(k=>button4(names4[k],()=>{addItem4(k);feedback4(names4[k]+' na bandeja.')}));sound4(st==='geladeira'?'fridge':'paper');return}
 if(st==='corte'){panelBase4('Estação de corte','Escolha um ingrediente. Faça 3 cortes com ESPAÇO ou o botão quando a marca estiver na faixa dourada. Erros reduzem a qualidade.');selectBag4(a=>['potato','carrot','onion','lettuce'].includes(a.kind)&&a.state==='raw',a=>{kitchen4.cut={item:a,clock:0,hits:0,miss:0};panel4.querySelector('.kbody').innerHTML='<div class="cuttrack"><i></i><b></b></div>';button4('CORTAR · ESPAÇO',cutAttempt4);feedback4('0 / 3 cortes')});return}
 if(st==='tempero'){panelBase4('Bancada de tempero','Use uma porção de sal para temperar carne, frango ou batata.');selectBag4(a=>['meat','chicken','potato'].includes(a.kind)&&!a.seasoned,a=>{const salt=kitchen4.bag.find(i=>i.kind==='salt');if(!salt){feedback4('Pegue sal na despensa.');return}removeItem4(salt);a.seasoned=true;sound4('salt');openStation4('tempero');feedback4('Temperado.');});return}
 if(st==='chapa'){openCook4('grill');return}if(st==='forno'){openCook4('oven');return}if(st==='fogão'){panelBase4('Fogão — dois queimadores','Use MÉDIO para batatas e BAIXO para sopa. A panela continua no fogo quando você sai.');button4('PANELA 1',()=>openCook4('pot1'));button4('PANELA 2',()=>openCook4('pot2'));return}
 if(st==='pia'){panelBase4('Pia','Descarte componentes para corrigir o preparo. O relógio continua.');button4('DESCARTAR PRATO',()=>{kitchen4.plate=null;sound4('water');feedback4('Prato descartado.');},!kitchen4.plate);selectBag4(()=>true,a=>{removeItem4(a);sound4('water');openStation4('pia')});return}
 if(st==='montagem'){panelBase4('Montagem do prato','Escolha componentes na ordem da receita. Você pode desfazer a montagem antes de finalizar.');kitchen4.selection=[];selectBag4(a=>['grilled','baked','boiled'].includes(a.state)||['bread','cheese','sauce'].includes(a.kind)||(a.kind==='lettuce'&&a.state==='cut'),a=>{if(kitchen4.selection.includes(a.id))return;kitchen4.selection.push(a.id);feedback4('Montagem: '+kitchen4.selection.map(id=>itemName4(kitchen4.bag.find(i=>i.id===id))).join(' → '))});button4('DESFAZER',()=>{kitchen4.selection=[];feedback4('Montagem vazia.')});button4('FINALIZAR PRATO',finishPlate4);}
}
function cutAttempt4(){const c=kitchen4.cut;if(!c)return;const p=(Math.sin(c.clock*3.2)+1)/2;if(p<.38||p>.64)c.miss++;sound4('knife');c.hits++;c.clock+=.7;feedback4(`${c.hits} / 3 cortes${c.miss?' · corte irregular':''}`);if(c.hits>=3){c.item.state='cut';c.item.quality-=c.miss*7;kitchen4.cut=null;openStation4('corte');feedback4(c.miss?'Cortado. Alguns pedaços ficaram irregulares.':'Corte limpo.')} }
function openCook4(slot){
 const j=kitchen4.jobs[slot],pot=slot.startsWith('pot'),oven=slot==='oven';panelBase4(pot?'Panela '+slot.slice(-1):oven?'Forno':'Chapa',pot?'Batatas: MÉDIO 10–16 s. Sopa: BAIXO 14–20 s; água → cenoura → cebola → sal.':oven?'Frango temperado: 180 °C por 18 s. Ajuste o termostato e o timer ANTES de ligar.':'Carne ao ponto: 12–18 s. A cor e o som mudam com o cozimento.');
 if(j){const meter=document.createElement('div');meter.id='cookMeter4';panel4.querySelector('.kbody').append(meter);if(pot){['BAIXO','MÉDIO','ALTO'].forEach((t,i)=>button4(t,()=>{j.temp=i;feedback4('Temperatura: '+t)}));if(j.kind==='soup'&&!j.sealed){button4('ADICIONAR CENOURA',()=>soupAdd4(slot,'carrot'));button4('ADICIONAR CEBOLA',()=>soupAdd4(slot,'onion'));button4('ADICIONAR SAL / INICIAR',()=>soupAdd4(slot,'salt'));}}
 button4('RETIRAR',()=>retrieve4(slot));button4('DESCARTAR / DESLIGAR',()=>{delete kitchen4.jobs[slot];sound4('water');openCook4(slot)});return}
 if(pot){selectBag4(a=>a.kind==='potato'&&a.state==='cut',a=>startCook4(slot,a,1,0));button4('SOPA — COMEÇAR COM ÁGUA',()=>{const a=kitchen4.bag.find(a=>a.kind==='water');if(!a){feedback4('Pegue água na despensa.');return}removeItem4(a);kitchen4.jobs[slot]={kind:'soup',state:'boiled',quality:100,seasoned:true,temp:0,elapsed:0,parts:['water'],sealed:false};sound4('water');openCook4(slot)});return}
 if(oven){const line=document.createElement('div');line.innerHTML='<label>Temperatura <select id="ovenTemp4"><option>160</option><option selected>180</option><option>220</option></select> °C</label> <label>Timer <select id="ovenTime4"><option>12</option><option selected>18</option><option>26</option></select> s</label>';panel4.querySelector('.kbody').append(line);selectBag4(a=>a.kind==='chicken'&&a.state==='raw',a=>startCook4(slot,a,Number(panel4.querySelector('#ovenTemp4').value),Number(panel4.querySelector('#ovenTime4').value)));}else selectBag4(a=>a.kind==='meat'&&a.state==='raw',a=>startCook4(slot,a,1,0));
}
function startCook4(slot,a,temp,timer){removeItem4(a);kitchen4.jobs[slot]={...a,temp,timer,elapsed:0,sealed:true,bell:false,state:slot==='grill'?'grilled':slot==='oven'?'baked':'boiled'};sound4(slot==='grill'?'sizzle':slot==='oven'?'oven':'water');openCook4(slot)}
function soupAdd4(slot,kind){const j=kitchen4.jobs[slot];const a=kitchen4.bag.find(a=>a.kind===kind&&(kind==='salt'||a.state==='cut'));if(!a){feedback4('Falta '+names4[kind]+(kind!=='salt'?' cortada.':'.'));return}if(j.parts.includes(kind)){feedback4('Já está na panela.');return}removeItem4(a);const expected=['water','carrot','onion','salt'][j.parts.length];if(kind!==expected)j.quality-=18;j.quality=Math.min(j.quality,a.quality);j.parts.push(kind);if(j.parts.length===4){j.sealed=true;j.elapsed=0}sound4('water');openCook4(slot)}
function cookQuality4(j,slot){let lo=slot==='grill'?12:j.kind==='soup'?14:slot==='oven'?18:10,hi=slot==='grill'?18:j.kind==='soup'?20:slot==='oven'?26:16;let q=j.quality;const t=j.elapsed;const diff=t<lo?lo-t:t>hi?t-hi:0;q-=diff*5;if(slot==='oven'){q-=Math.abs(j.temp-180)*.8+Math.abs(j.timer-18)*3;if(!j.bell)q-=12;}else if(slot.startsWith('pot')){q-=Math.abs(j.temp-(j.kind==='soup'?0:1))*22;if(!j.sealed)q-=50}if(['meat','chicken','potato'].includes(j.kind)&&!j.seasoned)q-=12;return clamp(q,0,100)}
function retrieve4(slot){const j=kitchen4.jobs[slot];if(!j)return;if(kitchen4.bag.length>=16){feedback4('Bandeja cheia. Descarte algo na pia antes de retirar.');return}const q=cookQuality4(j,slot);const it={id:++kitchen4.uid,kind:j.kind,state:j.state,quality:q,seasoned:j.seasoned};kitchen4.bag.push(it);delete kitchen4.jobs[slot];sound4('plate');openCook4(slot);feedback4(q>=85?'Preparo no ponto.':q>=70?'Preparo aceitável.':'Preparo duvidoso.');}
function finishPlate4(){const parts=kitchen4.selection.map(id=>kitchen4.bag.find(a=>a.id===id)).filter(Boolean);if(!parts.length){feedback4('Escolha componentes primeiro.');return}const expected=recipes4[kitchen4.order].parts;let q=100;expected.forEach((tag,i)=>{const match=parts.find(a=>a.kind+':'+a.state===tag);if(!match)q-=32;else{q-= (100-match.quality)/expected.length;if(parts[i]!==match)q-=5}});q-=Math.max(0,parts.length-expected.length)*18;if(parts.some(a=>a.quality<35))q=Math.min(q,60);kitchen4.plate={quality:clamp(q,0,100),parts};parts.forEach(removeItem4);kitchen4.selection=[];sound4('plate');closeKitchenPanel4();showCaption('',(kitchen4.plate.quality>=95?'PERFEITO':kitchen4.plate.quality>=70?'BOM':'DUVIDOSO')+' — leve o prato à mesa do cliente.',2200);}
function tutorialHint4(){const k=kitchen4;if(k.plate)return 'Leve o prato à mesa do cliente e sirva com E.';if(!k.bag.length&&!Object.keys(k.jobs).length)return 'Pegue carne na geladeira; batata e sal na despensa. Pegue duas porções de sal.';if(k.bag.some(a=>a.kind==='potato'&&a.state==='raw'))return 'Corte a batata na tábua. ESPAÇO quando a marca estiver no dourado.';if(k.bag.some(a=>['meat','potato'].includes(a.kind)&&!a.seasoned))return 'Tempere a carne e a batata na bancada de tempero, usando sal.';if(k.bag.some(a=>a.kind==='meat'&&a.state==='raw'))return 'Coloque a carne na chapa. Retire AO PONTO, entre 12 e 18 segundos.';if(k.bag.some(a=>a.kind==='potato'&&a.state==='cut'))return 'Batata cortada na panela, fogo MÉDIO. Retire entre 10 e 16 segundos.';if(Object.keys(k.jobs).length)return 'Observe os aparelhos. Você pode sair da estação e voltar para retirar.';return 'Na montagem, selecione carne → batata e finalize o prato.'}
function interactKitchen4(id){const k=kitchen4,st=id.slice(3);
 if(st==='chef'){
 if(k.phase==='arrival'){startDialogue('chef4',[
 ['CHEF','Ei! Você aí! Ah, finalmente alguém.'],['CHEF','Meu ajudante resolveu se demitir bem no meio do expediente.'],['CHEF','Sem aviso. Sem despedida. E sem terminar os pedidos.'],['CHEF','Tá vendo aquele cavalheiro? Ele está... com fome.'],['BRUTAMONTE','CADÊ MINHA COMIDA?!'],['CHEF','Bastante fome.'],['VOCÊ','Eu só preciso encontrar o disjuntor.'],['CHEF','O quadro elétrico? Numa sala atrás da cozinha. A porta fica trancada durante o expediente.'],['CHEF','Me ajude a terminar os pedidos dele e eu deixo você entrar.'],['CHEF','Vamos treinar com carne e batatas. Não se preocupe: esse primeiro prato fica por minha conta.'],['CHEF','Ingredientes na despensa e geladeira. Corte a batata, tempere com sal. Carne na chapa; batata na panela.'],['CHEF','Observe o ponto, monte o prato e sirva. Consulte o caderno se precisar.']],()=>{k.phase='tutorial';setObjective('Ajude o chef — prepare o prato de treino');sound4('paper')});return}
 if(performance.now()<k.hintAt){showCaption('CHEF','Dê uma olhada no caderno enquanto isso.',1500);return}k.hintAt=performance.now()+12000;showCaption('CHEF',k.phase==='tutorial'?tutorialHint4():k.door?'Como prometido. A sala está aberta.':recipes4[k.order].text,6500);return}
 if(st==='serve'){serve4();return}if(st==='elevator'){if(k.phase==='orders')return showCaption('CHEF','Calma, ainda estamos no expediente. Já já você pode subir.',2400);if(k.power)(loadWeddingAssets5(),rideElevator('4','5',()=>resetFloor5()));else showCaption('','O elevador aguarda a energia do andar.',1800);return}
 if(st==='breaker'){if(!k.door)return;if(k.power)return;if(!k.opened){k.opened=true;openBreaker('floor4')}else openWireGame('floor4');return}
 if(st==='photo'){showCaption('','Hotel Bellevue, 1962. A funcionária de vermelho parece familiar. “Auxiliar de cozinha — desligado”. O nome está riscado.',5000);return}
 if(st==='matches'){if(!inventory.includes('matches')){inventory.push('matches');objects=objects.filter(o=>!o.matches4);saveCheckpoint(currentCheckpoint);renderInventory();sound4('pickup');showCaption('','Caixa de fósforos Bellevue adicionada ao inventário Q.',2200)}return}
 openStation4(st);
}
function penalty4(reason,amount){if(kitchen4.phase==='tutorial'){kitchen4.left=420;showCaption('CHEF','Quase. Vamos tentar outra vez. '+reason,3500);return}kitchen4.patience=Math.max(0,kitchen4.patience-amount);kitchen4.angryUntil=performance.now()+3000;sound4('slam');showCaption('BRUTAMONTE',reason,2400);if(kitchen4.patience<=0)killBrute4();else setTimeout(()=>{if(scene==='floor4'&&mode!=='dead')showCaption('CHEF','Ele ainda está esperando o mesmo pedido. Você pode corrigir o prato.',2800)},2600)}
function serve4(){const k=kitchen4;if(!k.plate){showCaption('BRUTAMONTE','EU TÔ COM FOME!',1400);sound4('grunt');return}const q=k.plate.quality;k.plate=null;if(q<70){penalty4('QUE MERDA É ESSA?',q<35?55:30);k.left=Math.max(k.left,110);return}k.phase=k.order===0?'tutorialEating':'eating';k.eating=5;sound4('chew');showCaption('','Ele devora o prato sem olhar para os talheres.',2000)}
function nextOrder4(){const k=kitchen4;k.bag=[];k.jobs={};if(k.order===0){startDialogue('chef4',[['CHEF','Muito bem. Você já pegou o jeito.'],['CHEF','Agora é com você. E aconselho não fazê-lo esperar.']],()=>{k.order=1;k.phase='orders';k.left=recipes4[1].time;saveCheckpoint('chef');showCaption('','SAVE 4 — DEPOIS DO TUTORIAL DO CHEF',2400);setObjective('Ajude o chef — cinco pedidos restantes')});return}if(k.order===5){k.phase='reward';startDialogue('chef4',[['BRUTAMONTE','... Bom.'],['CHEF','Parabéns. Você cozinha melhor que o último.'],['VOCÊ','O último?'],['CHEF','Meu ajudante.'],['CHEF','Como prometido.']],()=>{k.door=true;k.phase='breaker';colliders=colliders.filter(o=>o.id!=='service4');spriteOccluders=spriteOccluders.filter(o=>o.id!=='service4');solidRect(-3.3,-19.12,.14,2,2.8,false,'openService4');occluderRect(-3.3,-19.12,.14,2,'openService4');sound4('keys');setObjective('Ligue o disjuntor — sala atrás da cozinha')});return}k.order++;k.left=recipes4[k.order].time;k.phase='orders';sound4('paper');showCaption('BRUTAMONTE','MAIS.',1200);if(k.order===4)startDialogue('chef4',[['VOCÊ','Esse cara sempre come assim?'],['CHEF','Sempre que está com fome.'],['VOCÊ','E quando ele não está?'],['CHEF','...'],['CHEF','Nunca vi.']],()=>setObjective('Ajude o chef — pedido 4 de 5'));}
async function killBrute4(){if(mode==='dead')return;panel4.classList.add('hidden');mode='dead';if(document.pointerLockElement)document.exitPointerLock();ui.controls.classList.add('hidden');for(const k of Object.keys(keys))keys[k]=false;ui.crosshair.classList.add('hidden');sound4('slam');gazeDisturbance=8;showCaption('','A mesa estala.',600);await new Promise(r=>setTimeout(r,650));gazeDisturbance=0;attack4.classList.remove('hidden');sound4('attack');await new Promise(r=>setTimeout(r,850));ui.fade.classList.add('on');sound4('bite');attack4.classList.add('hidden');await new Promise(r=>setTimeout(r,800));resetKitchen4(true);ui.fade.classList.remove('on');showCaption('','SAVE 4 — pedidos reiniciados',2200);requestLock()}
function completeBreaker4(){if(kitchen4.power)return;kitchen4.power=true;powerFlicker=1.1;sfx.power();ui.breaker.classList.add('hidden');mode='world';setObjective('Volte para o elevador');showCaption('CHEF','Prontinho.',1800);requestLock()}
function updateKitchen4(dt,now){const k=kitchen4;hud4.classList.toggle('hidden',scene!=='floor4'||mode==='ending');if(scene!=='floor4')return;
 const running=['world','kitchen'].includes(mode);
 if(running){k.doorOpen=lerp(k.doorOpen||0,k.door?1:0,1-Math.exp(-dt*4));if(k.cut){k.cut.clock+=dt;const b=panel4.querySelector('.cuttrack b');if(b)b.style.left=((Math.sin(k.cut.clock*3.2)+1)*50)+'%'}
 for(const [slot,j]of Object.entries(k.jobs)){if(j.sealed){j.wallTime=(j.wallTime||0)+dt;const desired=j.kind==='soup'?0:1;if(slot.startsWith('pot'))j.temperatureError=(j.temperatureError||0)+dt*Math.abs(j.temp-desired);const rate=slot.startsWith('pot')?[.68,1,1.52][j.temp]/(j.kind==='soup'?.68:1):slot==='oven'?clamp(j.temp/180,.6,1.45):1;j.elapsed+=dt*rate;if(slot==='oven'&&!j.bell&&j.wallTime>=j.timer){j.bell=true;sound4('bell')}if(j.swirl)j.swirl=Math.max(0,j.swirl-dt);}}
 if(['orders','tutorial'].includes(k.phase)){k.left-=dt;if(k.left<=0){penalty4('ANDA LOGO! A COMIDA!',30);k.left=k.phase==='tutorial'?420:100}k.chatter-=dt;if(k.chatter<=0){k.chatter=18+Math.random()*15;k.angryUntil=now+2400;sound4('grunt');if(k.phase==='tutorial')showCaption('CHEF',tutorialHint4(),4500);else showCaption('BRUTAMONTE',['EU TÔ COM FOME!','ANDA LOGO!','VOCÊ TÁ COZINHANDO OU PLANTANDO A COMIDA?!'][Math.floor(Math.random()*3)],2400)} }
 if(k.eating>0){k.eating-=dt;if(Math.floor((k.eating+dt)*3)!==Math.floor(k.eating*3))sound4('chew');if(k.eating<=0)nextOrder4()}
 if(!k.called&&player.z<-5){k.called=true;showCaption('CHEF','Ei! Você aí! Finalmente alguém.',2300)}
 const m=panel4.querySelector('#cookMeter4');if(m){const slots=Object.entries(k.jobs);m.textContent=slots.map(([s,j])=>{const t=j.elapsed;return `${s==='grill'?'CHAPA':s==='oven'?'FORNO':s==='pot1'?'PANELA 1':'PANELA 2'}: ${t.toFixed(1)} s · ${s==='grill'?(t<6?'CRUA':t<12?'MAL PASSADA':t<=18?'AO PONTO':t<=24?'BEM PASSADA':'QUEIMADA'):j.bell?'CAMPAINHA — RETIRE':j.sealed?'COZINHANDO':'ADICIONE OS INGREDIENTES'}`}).join(' | ')}
 if(Object.keys(k.jobs).length&&now>(k.soundAt||0)){k.soundAt=now+900;sound4(Object.keys(k.jobs).includes('grill')?'sizzle':'simmer')}
 if(k.left<40&&k.phase==='orders'&&now>(k.tickAt||0)){k.tickAt=now+1000;sound4('tick')}
 }
 ui.hand.classList.toggle('hidden',!['arrival','breaker'].includes(k.phase));
 const hudText4P='<small>'+ (k.phase==='tutorial'?'TREINO • SEM RISCO':k.door?'EXPEDIENTE ENCERRADO':k.order?'PEDIDO '+k.order+' / 5':'RESTAURANTE BELLEVUE')+'</small><strong>'+(!k.door&&k.phase!=='arrival'?recipes4[k.order].name:'Hotel • desde 1948')+'</strong>'+(!k.door&&k.phase!=='arrival'?'<span class="'+(k.left<40?'urgent4':'')+'">'+Math.floor(Math.max(0,k.left)/60)+':'+String(Math.floor(Math.max(0,k.left)%60)).padStart(2,'0')+'</span><label>PACIÊNCIA <meter min="0" max="100" value="'+k.patience+'"></meter></label>':'')+'<p>'+Object.entries(k.jobs).map(([slot,j])=>(slot==='grill'?'CHAPA':slot==='oven'?'FORNO':'PANELA '+slot.slice(-1))+' '+Math.floor(j.elapsed)+'s'+(j.bell?' • RETIRE':'')).join(' · ')+'</p><p>'+ (k.plate?'PRATO NA MÃO — leve à mesa':k.bag.map(itemName4).join(' · ')||'Bandeja vazia')+'</p>'+(k.phase==='tutorial'?'<em>'+tutorialHint4()+'</em>':'');
 if(hud4.dataset.lastHtml!==hudText4P){hud4.innerHTML=hudText4P;hud4.dataset.lastHtml=hudText4P;}
 for(const o of objects)if(o.fluorescent4){const fault=!k.power&&Math.sin(now*.00028+o.z)>.997-k.order*.0015;o.emissive=fault&&Math.sin(now*.036+o.x)>.4?.12:.85;}
 const food=objects.filter(o=>o.food4);for(const o of food)objects.splice(objects.indexOf(o),1);
 if(k.jobs.grill){const t=k.jobs.grill.elapsed;box(2,1.14,-24,.65,.10,.42,'white',t<6?[1.1,.25,.22]:t<12?[.75,.42,.23]:t<19?[.48,.24,.10]:[.13,.09,.05],[1,1],{geometry:'round',food4:true})}
}
const audioBuffers4={};function sound4(kind){if(!sfx.ctx)return;const buf=audioBuffers4[kind];if(!buf)return;const src=sfx.ctx.createBufferSource();src.buffer=buf;const gain=sfx.ctx.createGain();gain.gain.value=['slam','attack'].includes(kind)?.7:kind==='sizzle'||kind==='simmer'?.16:.38;src.connect(gain);gain.connect(sfx.master);src.start()}
async function loadAudio4(){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C();await Promise.all(['pickup','paper','fridge','knife','salt','sizzle','oven','water','plate','slam','grunt','chew','keys','attack','bite','bell','simmer','tick'].map(async kind=>{try{let b;if(location.protocol==='file:'&&window.PREDIO_RESTAURANT_AUDIO){const raw=atob(window.PREDIO_RESTAURANT_AUDIO[kind]);b=Uint8Array.from(raw,v=>v.charCodeAt(0)).buffer}else{const r=await fetch('assets/kitchen_'+kind+'.wav');b=await r.arrayBuffer()}audioBuffers4[kind]=await c.decodeAudioData(b)}catch(e){console.warn('Audio restaurant indisponible:',kind)}}));await c.close()}loadAudio4();
window.addEventListener('keydown',e=>{if(mode==='kitchen'){if(e.code==='Space'){e.preventDefault();if(!e.repeat)cutAttempt4()}if(e.code==='Escape'||e.code==='KeyE'){e.preventDefault();closeKitchenPanel4()}}});

// Restaurant v0.8: all material/architecture changes are scoped to floor4.
function material4P(name,width,height,repeat,paint){const c=document.createElement('canvas');c.width=width;c.height=height;const g=c.getContext('2d');let seed=194812;const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};paint(g,rand,width,height);textures[name]=makeTextureFromCanvas(c,repeat);}
material4P('oak4P',1024,1024,true,(g,r,w,h)=>{g.fillStyle='#40281b';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=128)for(let x=-((y/128)%2)*256;x<w;x+=512){const tone=80+r()*25;g.fillStyle=`rgb(${tone},${tone*.62},${tone*.39})`;g.fillRect(x+3,y+3,506,122);const grad=g.createLinearGradient(0,y,0,y+128);grad.addColorStop(0,'#ffffff0d');grad.addColorStop(.6,'#00000000');grad.addColorStop(1,'#00000026');g.fillStyle=grad;g.fillRect(x+3,y+3,506,122);for(let j=0;j<95;j++){g.strokeStyle=r()>.5?'#cfaa7420':'#150c0a32';g.lineWidth=.5+r();const yy=y+r()*128;g.beginPath();g.moveTo(x+6,yy);g.bezierCurveTo(x+150,yy-2+r()*4,x+360,yy+4-r()*8,x+500,yy);g.stroke()}for(const xx of [x+12,x+496])for(const yy of [y+12,y+116]){g.fillStyle='#21150f';g.fillRect(xx,yy,3,3)}}for(let i=0;i<4500;i++){g.fillStyle='#f7cda408';g.fillRect(r()*w,r()*h,1+r()*7,1)}});
material4P('wine4',1024,1024,true,(g,r,w,h)=>{g.fillStyle='#4b2530';g.fillRect(0,0,w,h);for(let y=-128;y<h;y+=128)for(let x=-128;x<w;x+=128){const xx=x+(y%256?64:0),yy=y;g.strokeStyle='#916b5347';g.lineWidth=2;g.beginPath();g.moveTo(xx,yy-50);g.bezierCurveTo(xx+36,yy-15,xx+45,yy+4,xx,yy+53);g.bezierCurveTo(xx-45,yy+4,xx-36,yy-15,xx,yy-50);g.stroke();for(const s of [-1,1]){g.beginPath();g.moveTo(xx,yy+36);g.bezierCurveTo(xx+s*55,yy+9,xx+s*6,yy-48,xx,yy+2);g.stroke();g.fillStyle='#9b77632e';g.beginPath();g.ellipse(xx+s*15,yy-2,4,18,s*.55,0,Math.PI*2);g.fill()}}for(let i=0;i<6500;i++){g.fillStyle=r()>.5?'#ffe1ab08':'#00000012';g.fillRect(r()*w,r()*h,1,2)}const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#00000012');grad.addColorStop(.5,'#ffffff00');grad.addColorStop(1,'#00000038');g.fillStyle=grad;g.fillRect(0,0,w,h)});
material4P('tile4',1024,1024,true,(g,r,w,h)=>{g.fillStyle='#716f61';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=128)for(let x=-128;x<w;x+=256){let xx=x+(y%256?128:0);const v=183+r()*20;g.fillStyle=`rgb(${v+8},${v+8},${v})`;g.fillRect(xx+4,y+4,248,120);g.fillStyle='#ffffff38';g.fillRect(xx+5,y+5,246,2);g.fillStyle='#171e211c';g.fillRect(xx+5,y+119,246,4);for(let i=0;i<16;i++){g.fillStyle='#67614f12';g.fillRect(xx+r()*256,y+r()*128,2+r()*6,1)}}});
material4P('floorTile4P',1024,1024,true,(g,r,w,h)=>{g.fillStyle='#727568';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=256)for(let x=0;x<w;x+=256){let c=(x+y)%512===0?169:191;g.fillStyle=`rgb(${c},${c+3},${c-11})`;g.fillRect(x+4,y+4,248,248);for(let i=0;i<800;i++){g.fillStyle=r()>.5?'#f9f5da12':'#343b3312';g.fillRect(x+r()*256,y+r()*256,1+r()*3,1+r()*3)}g.strokeStyle='#f2eac328';g.strokeRect(x+6,y+6,244,244)}});
material4P('steel4P',512,512,true,(g,r,w,h)=>{const grad=g.createLinearGradient(0,0,w,0);grad.addColorStop(0,'#767f7f');grad.addColorStop(.25,'#b1b8b6');grad.addColorStop(.5,'#d0d2c8');grad.addColorStop(.8,'#919c9b');grad.addColorStop(1,'#737e7c');g.fillStyle=grad;g.fillRect(0,0,w,h);for(let i=0;i<1600;i++){g.strokeStyle=r()>.5?'#ffffff16':'#0614151a';g.beginPath();const y=r()*h;g.moveTo(r()*w,y);g.lineTo(r()*w,y+.2);g.stroke()}for(let i=0;i<35;i++){g.strokeStyle='#515d5633';g.beginPath();const x=r()*w,y=r()*h;g.moveTo(x,y);g.lineTo(x+10+r()*55,y+r()*4);g.stroke()}});
material4P('cloth4P',512,512,true,(g,r,w,h)=>{g.fillStyle='#d6c8a8';g.fillRect(0,0,w,h);for(let i=0;i<w;i+=3){g.fillStyle='#ffffff12';g.fillRect(i,0,1,h);g.fillStyle='#55412f12';g.fillRect(0,i,w,1)}g.strokeStyle='#a992681c';g.lineWidth=2;for(let i=0;i<20;i++){g.beginPath();g.arc(r()*w,r()*h,10+r()*30,0,7);g.stroke()}});
material4P('runner4P',512,512,true,(g,r,w,h)=>{g.fillStyle='#54232b';g.fillRect(0,0,w,h);for(const x of [12,28,484,500]){g.fillStyle='#97704b';g.fillRect(x,0,3,h)}for(let y=0;y<h;y+=96){g.strokeStyle='#97704b66';g.beginPath();g.moveTo(256,y+12);g.lineTo(330,y+48);g.lineTo(256,y+84);g.lineTo(182,y+48);g.closePath();g.stroke()}for(let i=0;i<3500;i++){g.fillStyle='#00000013';g.fillRect(r()*w,r()*h,1,2)}});
material4P('ceramic4P',256,256,false,(g,r,w,h)=>{g.fillStyle='#dfdac7';g.fillRect(0,0,w,h);g.strokeStyle='#bdac7c';g.lineWidth=2;g.strokeRect(5,5,246,246);for(let i=0;i<450;i++){g.fillStyle='#b5a9900c';g.fillRect(r()*w,r()*h,1,1)}});
function placard4P(name,title,subtitle){material4P(name,1024,256,false,g=>{g.fillStyle='#1e302a';g.fillRect(0,0,1024,256);g.strokeStyle='#ac9363';g.lineWidth=4;g.strokeRect(14,14,996,228);g.strokeRect(24,24,976,208);g.fillStyle='#e1d4ae';g.font='bold 74px Georgia';g.textAlign='center';g.fillText(title,512,126);g.font='24px monospace';g.fillStyle='#b4a887';g.fillText(subtitle||'HOTEL BELLEVUE • DESDE 1948',512,190)});}
['DESPENSA','GELADEIRA','CORTE','TEMPERO','CHAPA','FOGÃO','FORNO','MONTAGEM','PIA','RECEITAS'].forEach((s,i)=>placard4P('sign4_'+i,s,['INGREDIENTES SECOS','MANTENHA A PORTA FECHADA','FACA AFIADA • CUIDADO','SAL DA CASA','OBSERVE O PONTO','DOIS QUEIMADORES','TERMOSTATO + TIMER','PASSE DE SERVIÇO','ÁGUA E LOUÇA','CADERNO DO CHEF'][i]));
placard4P('hotelBadge4P','BELLEVUE','RESTAURANTE DO HOTEL • DESDE 1948');
material4P('window4P',512,512,false,(g,r,w,h)=>{const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#07121d');grad.addColorStop(1,'#29363a');g.fillStyle=grad;g.fillRect(0,0,w,h);for(let i=0;i<10;i++){let x=i*63-15,hh=100+r()*240;g.fillStyle='#0a171e';g.fillRect(x,h-hh,55,hh);for(let y=h-hh+15;y<h;y+=35)for(let xx=x+9;xx<x+48;xx+=17){g.fillStyle=r()>.7?'#a7965a66':'#1b2c34';g.fillRect(xx,y,7,11)}}g.strokeStyle='#9cafaa22';for(let i=0;i<65;i++){g.beginPath();const x=r()*w,y=r()*h;g.moveTo(x,y);g.lineTo(x-3,y+20+r()*75);g.stroke()}g.strokeStyle='#958b6f';g.lineWidth=7;g.strokeRect(12,12,488,488);g.beginPath();g.moveTo(256,12);g.lineTo(256,500);g.moveTo(12,245);g.lineTo(500,245);g.stroke()});
const buildFloor4V070=buildFloor4;
buildFloor4=function(){buildFloor4V070();for(const o of objects){if(o.tex==='parquet')o.tex='oak4P';if(o.tex==='metal')o.tex='steel4P';if(o.tex==='night3')o.tex='window4P';if(o.tex==='white'&&!o.emissive)o.tex='ceramic4P';if(o.tex==='tile4'&&o.sy<.3){o.tex='floorTile4P';o.uv=[6,3.5]}if(o.tex==='ceiling')o.tint=[.80,.79,.71];if(o.tex==='menu4'&&o.sx>3){o.tex='hotelBadge4P';o.y=2.91;o.sy=.42;}if(o.tex==='ceramic4P'&&o.sx>1.6&&o.sy<.3){o.tex='cloth4P';o.uv=[2,2];o.tint=[1.05,1.01,.90]}}
 box(0,.014,-4.8,2.85,.025,8.3,'runner4P',[1,1,1],[1,3]);
 // Entry desk and two columns frame the hotel restaurant, leaving a 4.5m route.
 for(const x of [-2.45,2.45]){box(x,1.63,.3,.20,3.26,.30,'darkwood',[1.2,.9,.62]);box(x,.16,.3,.38,.32,.46,'darkwood');box(x,3.08,.3,.38,.24,.46,'brass');solidRect(x,.3,.3,.4,3.3,false,'entryColumn4P')}
 box(0,3.1,.3,4.7,.23,.35,'darkwood',[1.2,.9,.62]);box(0,2.93,.16,2.8,.25,.05,'hotelBadge4P',[1.15,1.08,.85],[1,1],{emissive:.12});
 box(-9,.59,1.3,2.8,1.18,1.1,'darkwood',[1.2,1,.75]);box(-9,1.22,1.3,2.92,.08,1.2,'oak4P');solidRect(-9,1.3,2.9,1.2,1.3,false,'hostDesk4P');box(-9,1.30,1.15,.62,.06,.42,'menu4');box(-8.1,1.32,1.1,.18,.13,.18,'brass',[1.7,1.5,1],[1,1],{geometry:'round'});
 for(const x of [-11.82,11.82])for(const z of [-.6,-5.15,-10.6]){box(x,1.65,z,.18,3.28,.25,'darkwood',[1.1,.85,.62]);box(x,2.2,z,.28,.09,.55,'brass');box(x,2.0,z,.27,.36,.25,'cloth4P',[1.4,1.1,.6],[1,1],{geometry:'shade',emissive:.30});}
 // Coffer beams sit against the physical ceiling, clear of all head movement.
 for(const z of [-.3,-5,-10])box(0,3.32,z,23.8,.09,.14,'darkwood',[.9,.7,.52]);for(const x of [-10,-3.1,3.1,10])box(x,3.32,-5,.12,.09,15.7,'darkwood',[.9,.7,.52]);
 for(const x of [-11.71,11.71])for(const z of [-2.9,-8])for(const dz of [-1.03,1.03]){box(x,1.75,z+dz,.12,1.95,.13,'brass',[1.5,1.2,.8]);for(let n=0;n<6;n++)box(x-.035*(x>0?1:-1),1.77,z+dz+n*.035,.10,1.8,.026,'cloth4P',[.8,.35,.38]);}
 // Sideboard against the right wall, modeled with drawers, bottles and dishes.
 box(11.16,.54,-11.1,1.02,1.08,2.8,'darkwood',[1.15,.9,.65]);box(11.15,1.12,-11.1,1.16,.08,2.94,'oak4P');solidRect(11.15,-11.1,1.1,2.9,1.18,false,'sideboard4P');for(const z of [-12,-11.1,-10.2]){box(10.6,.75,z,.03,.03,.25,'brass');for(let n=0;n<3;n++)box(11.1,1.17+n*.026,z,.36,.025,.36,'ceramic4P',[1,1,1],[1,1],{geometry:'round'})}
 // Kitchen details occupy tops and wall margins, never the work lanes.
 for(const x of [-10.1,-9.5,-8.9]){box(x,1.28,-16.9,.24,.4,.24,'wine4',[.68,.76,.48],[1,1],{geometry:'round'});box(x,1.5,-16.9,.11,.08,.11,'brass',[1,1,1],[1,1],{geometry:'round'})}
 for(const x of [1.1,1.65,2.2,2.75]){box(x,.67,-23.34,.10,.10,.05,'black',[1,1,1],[1,1],{geometry:'round'});box(x,.69,-23.30,.05,.03,.05,'brass')}
 for(const z of [-15.5,-18.5,-23.2,-26]){box(11.80,2.74,z,.07,.12,2.5,'steel4P');box(11.80,2.74,z-.75,.15,.22,.10,'steel4P');}
 for(let n=0;n<7;n++){box(6.3+n*.24,2.28,-24.63,.08,.37,.08,'steel4P',[1,1,1],[1,1],{geometry:'round'});box(6.3+n*.24,2.06,-24.63,.20,.20,.08,n%2?'oak4P':'steel4P',[1,1,1],[1,1],{geometry:'round'})}
 box(7,2.46,-24.64,2.4,.05,.08,'brass');box(-9,1.075,-23.75,1.1,.035,.7,'oak4P',[1.4,1.2,.8],[1,1]);
 for(const x of [-9,-4,3,8])for(let n=0;n<3;n++)box(x+n*.17,1.08,-16.86,.38,.025,.38,'ceramic4P',[1,1,1],[1,1],{geometry:'round'});
 // Industrial reward room: ceramic fuse housings, conduit elbows, hazard stripe.
 box(-2,2.3,-26.89,1.5,.12,.03,'brass',[.7,.65,.35]);for(let x=-2.7;x<-1.2;x+=.18)box(x,2.31,-26.87,.07,.10,.03,'black');for(const x of [-3.1,-1.1]){box(x,2.44,-26.8,.055,.86,.07,'steel4P');box(x,2.87,-25.2,.055,.055,3.2,'steel4P')}
};
const setSceneV070=setScene;setScene=function(name){setSceneV070(name);document.querySelector('#gameShell').classList.toggle('restaurantPolish',name==='floor4');};
// Fresnel/specular is enabled solely for restaurant materials.
const syncWorldSpritesV070=syncWorldSprites;syncWorldSprites=function(v){gl.uniform1f(loc.uSurfaceGloss,0);syncWorldSpritesV070(v)};
const drawBoxV070=drawBox;drawBox=function(o){gl.uniform1f(loc.uSurfaceGloss,scene==='floor4'?o.tex==='steel4P'?.32:o.tex==='brass'?.2:o.tex==='ceramic4P'?.12:0:0);drawBoxV070(o)};
const setCommonV070=setCommon;setCommon=function(v){setCommonV070(v);if(scene!=='floor4')return;const cold=v.eye[2]<-13;gl.uniform1f(loc.uAmbient,cold?.47:.40);gl.uniform3fv(loc.uLightTint,new Float32Array(cold?[.87,.95,.97]:[1,.85,.67]));gl.uniform1f(loc.uFogDensity,.016);};

// Readable, tactile preparation: heat exposure, two-sided grilling and stirring.
function flipMeat4P(){const j=kitchen4.jobs.grill;if(!j||j.flipped)return;j.flipped=true;j.flipTime=j.elapsed;sound4('knife');sound4('sizzle');feedback4(j.elapsed>=5&&j.elapsed<=10?'Virada limpa. Os dois lados estão dourando.':'Carne virada. Observe o ponto dos dois lados.');openCook4('grill');}
function stirSoup4P(slot){const j=kitchen4.jobs[slot];if(!j||j.kind!=='soup'||!j.sealed)return;j.stirred=true;j.stirTime=j.elapsed;j.swirl=1;sound4('water');feedback4('A sopa está homogênea. Mantenha o fogo baixo.');}
const startCook4V070=startCook4;startCook4=function(slot,a,temp,timer){if(kitchen4.jobs[slot]){feedback4('Esse aparelho já está ocupado. Retire ou descarte o preparo.');return}startCook4V070(slot,a,temp,timer);const j=kitchen4.jobs[slot];j.wallTime=0;j.temperatureError=0;j.flipped=false;j.stirred=false;};
const quality4V070=cookQuality4;cookQuality4=function(j,slot){let q=quality4V070(j,slot);if(slot.startsWith('pot')&&j.wallTime>0){q+=Math.abs(j.temp-(j.kind==='soup'?0:1))*22;q-=Math.min(40,(j.temperatureError||0)/Math.max(1,j.wallTime)*22);}if(slot==='grill'&&j.elapsed>4){if(!j.flipped)q-=18;else q-=Math.min(22,Math.max(0,5-j.flipTime,j.flipTime-10)*4);}if(j.kind==='soup'&&j.sealed&&!j.stirred)q-=10;return clamp(q,0,100);};
recipes4.forEach(r=>{if(r.text.includes('Chapa:'))r.text=r.text.replace('Chapa:','Vire a carne entre 5–10 s. Chapa:');else if(r.text.includes('chapa 12–18'))r.text=r.text.replace('chapa 12–18','virar 5–10 s; chapa 12–18');if(r.name==='Banquete do brutamonte')r.text+=' Vire a carne e mexa a sopa uma vez.';if(r.name==='Sopa da casa')r.text+=' Mexa uma vez durante o cozimento.'});
function targetCut4P(c){return [.50,.32,.67][c.hits%3]}
const cutAttempt4V070=cutAttempt4;cutAttempt4=function(){const c=kitchen4.cut;if(!c)return;const p=(Math.sin(c.clock*3.2)+1)/2,t=targetCut4P(c),good=Math.abs(p-t)<.13;if(!good)c.miss++;c.hits++;c.clock+=.78;c.flash=good?'clean':'rough';c.flashUntil=performance.now()+280;sound4('knife');feedback4(`${c.hits} / 3 cortes • ${good?'Corte limpo':'Pedaços irregulares'}`);if(c.hits>=3){c.item.state='cut';c.item.quality=Math.max(0,c.item.quality-c.miss*7);kitchen4.cut=null;openStation4('corte');feedback4(c.miss?'Cortado. A textura ficou irregular, mas ainda pode ser aproveitado.':'Cortado com precisão.')}else{const bar=panel4.querySelector('.cuttrack i');if(bar){bar.style.left=(targetCut4P(c)-.13)*100+'%';bar.style.width='26%'}}};
function drawFood4P(g,kind,state,x,y,s=1){g.save();g.translate(x,y);g.scale(s,s);g.lineWidth=2;g.strokeStyle='#41291d';const ellipse=(xx,yy,rx,ry,col)=>{g.fillStyle=col;g.beginPath();g.ellipse(xx,yy,rx,ry,0,0,7);g.fill();};if(kind==='meat'){ellipse(0,0,66,32,state==='raw'?'#b96565':state==='burnt'?'#2c2921':state==='seared'?'#9b5e3f':state==='overdone'?'#5b3b25':'#844b2c');ellipse(-22,-8,22,7,state==='raw'?'#e0a29a':state==='seared'?'#d4846a':state==='burnt'?'#4c4031':'#b2743d');g.strokeStyle=state==='raw'?'#e5b0a0':'#38271b';g.lineWidth=4;for(let i=0;i<5;i++){g.beginPath();g.moveTo(-48+i*21,-18);g.lineTo(-28+i*21,19);g.stroke()}}else if(kind==='chicken'){ellipse(0,0,62,33,state==='raw'?'#d2aa85':state==='burnt'?'#40321e':'#b87b32');ellipse(-43,20,22,12,'#9e6029');ellipse(43,20,22,12,'#9e6029');g.fillStyle='#e9ddbd';g.fillRect(-60,18,14,7);g.fillRect(48,18,14,7);for(let i=0;i<7;i++)ellipse(-30+i*10,-8,2,3,'#dbab50');}else if(kind==='potato'){for(let i=0;i<5;i++){g.save();g.translate((i%3)*29-30,Math.floor(i/3)*18-6);g.rotate((i-2)*.3);ellipse(0,0,19,10,state==='raw'?'#aa8350':'#d1ac57');g.restore()}}else if(kind==='lettuce'){for(let i=0;i<6;i++)ellipse(Math.sin(i)*28,Math.cos(i)*12,27,15,i%2?'#588046':'#7c9e53')}else if(kind==='carrot'){g.fillStyle='#c77c37';g.beginPath();g.moveTo(-48,-13);g.lineTo(49,0);g.lineTo(-48,16);g.closePath();g.fill();for(let i=0;i<5;i++){g.strokeStyle='#8c512e';g.beginPath();g.moveTo(-33+i*16,-7);g.lineTo(-30+i*16,7);g.stroke()}}else if(kind==='onion'){ellipse(0,0,38,27,'#b6a483');g.strokeStyle='#e4d8b6';for(let i=0;i<3;i++){g.beginPath();g.ellipse(0,0,10+i*10,22,0,0,7);g.stroke()}}else if(kind==='bread'){ellipse(0,0,57,25,'#a7753e');ellipse(0,-5,53,21,'#ceac6b');g.strokeStyle='#eee0ae';g.lineWidth=3;for(let i=0;i<3;i++){g.beginPath();g.moveTo(-24+i*22,-17);g.lineTo(-16+i*22,10);g.stroke()}}else if(kind==='cheese'){g.fillStyle='#d7b755';g.fillRect(-47,-21,94,42);for(let i=0;i<7;i++)ellipse(Math.sin(i*7)*35,Math.cos(i*3)*12,4,3,'#b69a43')}else if(kind==='soup'){ellipse(0,0,60,30,'#d6ccb3');ellipse(0,-4,51,23,'#987344');for(let i=0;i<9;i++)ellipse(Math.sin(i*2.4)*35,Math.cos(i*1.7)*15,5,3,i%2?'#bf8c46':'#718050');}else if(kind==='sauce'){ellipse(0,0,26,14,'#d6ccb3');ellipse(0,-3,21,10,'#86462f');}else if(kind==='salt'){g.fillStyle='#e3dacc';g.fillRect(-16,-27,32,50);ellipse(0,-27,17,6,'#78847b');g.fillStyle='#998559';g.fillRect(-12,-3,24,10);}else if(kind==='water'){g.fillStyle='#889d9866';g.fillRect(-18,-28,36,51);g.fillStyle='#859d9f';g.fillRect(-16,-3,32,24)}g.restore();}
function canvasStation4P(kind,slot){let c=panel4.querySelector('.workVisual4P');if(c)return c;c=document.createElement('canvas');c.width=640;c.height=230;c.className='workVisual4P';c.dataset.kind=kind;c.dataset.slot=slot||'';panel4.querySelector('.kbody').prepend(c);paintStation4P(c,performance.now());return c;}
function paintStation4P(c,now){const g=c.getContext('2d'),kind=c.dataset.kind,slot=c.dataset.slot,j=kitchen4.jobs[slot];g.clearRect(0,0,640,230);g.fillStyle='#252d27';g.fillRect(0,0,640,230);let grad=g.createLinearGradient(0,0,0,230);grad.addColorStop(0,'#ffffff09');grad.addColorStop(1,'#00000050');g.fillStyle=grad;g.fillRect(0,0,640,230);if(kind==='cut'){g.fillStyle='#987149';g.fillRect(85,28,470,162);for(let i=0;i<20;i++){g.strokeStyle='#482f2529';g.beginPath();g.moveTo(85,30+i*8);g.lineTo(555,30+i*8);g.stroke()}const cut=kitchen4.cut;drawFood4P(g,cut?.item.kind||'carrot',cut?.item.state||'raw',310,115,1);if(cut){for(let i=0;i<cut.hits;i++)drawFood4P(g,cut.item.kind,'cut',430+i*27,138,.25);const y=65+(cut.flashUntil>now?26:0);g.fillStyle='#c0c5be';g.beginPath();g.moveTo(253,y);g.lineTo(373,y+15);g.lineTo(390,y+38);g.lineTo(253,y+32);g.closePath();g.fill();g.fillStyle='#3b2e23';g.fillRect(191,y+3,62,23)}}else if(kind==='assemble'){g.fillStyle='#57635a';g.fillRect(0,0,640,230);g.fillStyle='#dfd4b6';g.beginPath();g.ellipse(320,123,223,83,0,0,7);g.fill();g.strokeStyle='#ad9867';g.lineWidth=3;g.beginPath();g.ellipse(320,123,209,73,0,0,7);g.stroke();const parts=kitchen4.selection.map(id=>kitchen4.bag.find(i=>i.id===id)).filter(Boolean);parts.forEach((a,i)=>drawFood4P(g,a.kind,a.state,220+(i%3)*105,95+Math.floor(i/3)*55,.64));}else{const oven=slot==='oven',pot=slot.startsWith('pot');g.fillStyle='#101512';g.beginPath();g.ellipse(320,123,pot?125:215,pot?65:83,0,0,7);g.fill();if(pot){g.fillStyle='#8c9791';g.beginPath();g.ellipse(320,115,120,54,0,0,7);g.fill();g.fillStyle=j?.kind==='soup'?'#8c734f':'#62695a';g.beginPath();g.ellipse(320,110,109,44,0,0,7);g.fill();if(j){drawFood4P(g,j.kind==='soup'?'carrot':'potato','boiled',310,118,.75);for(let i=0;i<12;i++){g.strokeStyle='#d4d6ab77';g.beginPath();g.arc(250+(i*19)%140,99+Math.sin(now*.003+i)*17,2+Math.sin(now*.004+i)*1.5,0,7);g.stroke()}}}else{g.strokeStyle='#67736b';g.lineWidth=2;for(let i=0;i<16;i++){g.beginPath();g.moveTo(136+i*23,64);g.lineTo(111+i*23,177);g.stroke()}if(j)drawFood4P(g,j.kind,j.elapsed<6?'raw':j.elapsed<12?'seared':j.elapsed<19?'cooked':j.elapsed<25?'overdone':'burnt',320,126,oven?1.45:1.7)}if(j?.sealed){for(let i=0;i<7;i++){const y=130-((now*.045+i*21)%110);g.strokeStyle='#efe2b126';g.lineWidth=3;g.beginPath();g.moveTo(258+i*20,y);g.bezierCurveTo(260+i*20,y-15,252+i*20,y-25,262+i*20,y-35);g.stroke()}const lo=slot==='grill'?12:j.kind==='soup'?14:oven?18:10,hi=slot==='grill'?18:j.kind==='soup'?20:oven?26:16,progress=Math.min(1,j.elapsed/(hi+8));g.fillStyle='#161d18';g.fillRect(70,203,500,9);g.fillStyle='#b69d66';g.fillRect(70+500*lo/(hi+8),203,500*(hi-lo)/(hi+8),9);g.fillStyle='#e2ddc7';g.fillRect(70+500*progress-2,199,4,17)}}}
const openStation4V070=openStation4;openStation4=function(st){openStation4V070(st);if(mode!=='kitchen')return;panel4.dataset.station=st;panel4.classList.toggle('recipeBook4P',st==='receitas');if(st==='corte')canvasStation4P('cut');if(st==='montagem'){canvasStation4P('assemble');button4('RETIRAR ÚLTIMO COMPONENTE',()=>{kitchen4.selection.pop();feedback4(kitchen4.selection.length?'Último componente removido.':'Prato vazio.');});}if(st==='despensa'||st==='geladeira')for(const b of panel4.querySelectorAll('.kbody button')){const kind=Object.keys(names4).find(k=>names4[k]===b.textContent);if(!kind)continue;const icon=document.createElement('canvas');icon.width=128;icon.height=70;icon.className='ingredientIcon4P';drawFood4P(icon.getContext('2d'),kind,'raw',64,35,.77);b.prepend(icon);b.dataset.kind=kind;}if(st==='receitas'){const pages=[...panel4.querySelectorAll('.recipe4')];const tabs=document.createElement('nav');tabs.className='recipeTabs4P';for(let i=0;i<pages.length;i++){const b=document.createElement('button');b.textContent=i?'PEDIDO '+i:'TREINO';b.onclick=()=>{pages.forEach((p,j)=>p.hidden=j!==i);for(const bb of tabs.children)bb.classList.toggle('active',bb===b)};tabs.append(b);pages[i].hidden=i!==kitchen4.order;}panel4.querySelector('.kbody').prepend(tabs);tabs.children[kitchen4.order]?.classList.add('active');}};
const openCook4V070=openCook4;openCook4=function(slot){openCook4V070(slot);panel4.dataset.station=slot;panel4.classList.remove('recipeBook4P');canvasStation4P('cook',slot);const j=kitchen4.jobs[slot];if(j&&slot==='grill')button4(j.flipped?'CARNE JÁ VIRADA':'VIRAR CARNE',flipMeat4P,!!j.flipped);if(j?.kind==='soup'&&j.sealed)button4(j.stirred?'SOPA JÁ MEXIDA':'MEXER SOPA',()=>stirSoup4P(slot),!!j.stirred);for(const b of panel4.querySelectorAll('.kbody button')){if(['BAIXO','MÉDIO','ALTO'][j?.temp]===b.textContent)b.classList.add('activeTemperature4P')}};
const held4P=document.createElement('canvas');held4P.width=640;held4P.height=320;held4P.id='heldPlate4P';held4P.className='hidden';document.querySelector('#gameShell').append(held4P);
function paintHeld4P(){const g=held4P.getContext('2d');g.clearRect(0,0,640,320);g.fillStyle='#242525';g.beginPath();g.moveTo(490,320);g.lineTo(459,213);g.lineTo(562,224);g.lineTo(620,320);g.fill();g.fillStyle='#cba787';g.beginPath();g.ellipse(466,222,56,25,-.13,0,7);g.fill();g.fillStyle='#d6ccaf';g.beginPath();g.ellipse(320,191,234,91,-.08,0,7);g.fill();g.strokeStyle='#ae9463';g.lineWidth=4;g.beginPath();g.ellipse(320,191,217,80,-.08,0,7);g.stroke();kitchen4.plate?.parts.forEach((a,i)=>drawFood4P(g,a.kind,a.state,213+i%3*102,168+Math.floor(i/3)*58,.69));}

// Directed sequences use a separate camera; player coordinates never teleport.
let film4P=null,dialogShot4P=null,lastDialogueShot4P='';
const filmBars4P=document.createElement('div');filmBars4P.id='restaurantFilm4P';filmBars4P.className='hidden';filmBars4P.innerHTML='<div class="filmTop4P"><small>HOTEL BELLEVUE</small><span>QUARTO ANDAR</span></div><div class="filmBottom4P"><span>E — PULAR CENA</span></div>';document.querySelector('#gameShell').append(filmBars4P);
function startFilm4P(kind,shots,done){if(scene!=='floor4'||mode==='dead')return;film4P={kind,shots,index:0,t:0,done,entered:false};mode='cinematic';for(const k of Object.keys(keys))keys[k]=false;panel4.classList.add('hidden');filmBars4P.classList.remove('hidden');ui.crosshair.classList.add('hidden');ui.controls.classList.add('hidden');}
function finishFilm4P(){if(!film4P)return;const done=film4P.done;film4P=null;filmBars4P.classList.add('hidden');ui.caption.classList.add('hidden');mode='world';for(const k of Object.keys(keys))keys[k]=false;ui.controls.classList.remove('hidden');if(document.pointerLockElement===canvas)ui.crosshair.classList.remove('hidden');if(done)done();if(mode==='world'&&document.pointerLockElement!==canvas)requestLock();}
function shotView4P(shot,t){const p=clamp(t/(shot.duration||3),0,1),smooth=p*p*(3-2*p),eye=shot.eye.map((v,i)=>v+(shot.push?.[i]||0)*smooth),target=shot.target,f=target.map((v,i)=>v-eye[i]);const len=Math.hypot(...f)||1;for(let i=0;i<3;i++)f[i]/=len;const view=M.lookAt(eye,target,[0,1,0]),proj=M.perspective((shot.fov||57)*Math.PI/180,canvas.width/canvas.height,.04,45);return {eye,f,vp:M.multiply(proj,view)};}
const viewDataV070=viewData;viewData=function(){if(scene==='floor4'){if(film4P)return shotView4P(film4P.shots[film4P.index],film4P.t);if(mode==='dialogue'&&dialogueKind==='chef4'&&dialogShot4P)return shotView4P(dialogShot4P,(performance.now()-dialogShot4P.start)/1000);}return viewDataV070();};
const showLineV070=showLine;showLine=function(){showLineV070();if(scene!=='floor4'||dialogueKind!=='chef4')return;const sp=dialogueLines[dialogueIndex][0];filmBars4P.classList.remove('hidden');filmBars4P.querySelector('.filmBottom4P span').textContent='E — CONTINUAR';const key=sp==='BRUTAMONTE'?'brute':sp==='CHEF'?'chef':'player';if(key!==lastDialogueShot4P){dialogShot4P=key==='brute'?{eye:[0,1.72,-6.8],target:[0,1.7,-10.45],push:[0,.02,-.18],duration:5,fov:51}:key==='chef'?{eye:[-3.1,1.74,-11.7],target:[-4,1.58,-14.35],push:[-.08,0,-.12],duration:6,fov:54}:{eye:[-.9,1.68,-12],target:[-4,1.52,-14.35],push:[0,0,0],duration:5,fov:62};dialogShot4P.start=performance.now();lastDialogueShot4P=key;}if(sp==='BRUTAMONTE'&&dialogueLines[dialogueIndex][1].includes('CADÊ')){sound4('slam');gazeDisturbance=2.5;setTimeout(()=>gazeDisturbance=0,350)};};
const advanceDialogueV070=advanceDialogue;advanceDialogue=function(){const reward=scene==='floor4'&&kitchen4.phase==='reward'&&mode==='dialogue';advanceDialogueV070();if(scene!=='floor4')return;if(mode!=='dialogue'){lastDialogueShot4P='';dialogShot4P=null;filmBars4P.classList.add('hidden');}if(reward&&kitchen4.phase==='breaker'&&mode==='world')startFilm4P('reward',[{eye:[-2.1,1.7,-14.8],target:[-4,1.5,-14.35],duration:1.6,text:'Como prometido.',speaker:'CHEF',sound:'keys'},{eye:[-2.25,1.67,-18.2],target:[-2.3,1.35,-20.12],push:[0,0,-.3],duration:2.3,text:'A porta da manutenção está aberta.',speaker:''}],()=>setObjective('Ligue o disjuntor — sala atrás da cozinha'));};
const serve4V070=serve4;serve4=function(){const q=kitchen4.plate?.quality;serve4V070();if(q>=70&&kitchen4.eating>0)startFilm4P('serve',[{eye:[.3,1.65,-7.4],target:[0,1.18,-10.45],push:[-.10,-.08,-.25],duration:1.6,text:'Você coloca o prato na mesa.',sound:'plate'},{eye:[-.7,1.8,-7.5],target:[0,1.73,-10.45],push:[.15,0,-.12],duration:2.6,text:kitchen4.order===5?'Ele finalmente desacelera.':'Ele mal dá tempo de pousar o prato.',sound:'chew'},{eye:[-2.2,1.7,-12],target:[-4,1.57,-14.35],duration:1.5,text:kitchen4.order===5?'O chef continua sorrindo.':'Já vou separar a próxima comanda.',speaker:'CHEF'}],()=>{kitchen4.eating=.05;});};
const penalty4V070=penalty4;penalty4=function(reason,amount){const tutorial=kitchen4.phase==='tutorial';penalty4V070(reason,amount);if(!tutorial&&kitchen4.patience>0&&mode!=='dead')startFilm4P('warning',[{eye:[0,1.7,-7.5],target:[0,1.85,-10.45],push:[0,0,-.1],duration:1.6,text:reason,speaker:'BRUTAMONTE',sound:'slam'},{eye:[-2.2,1.7,-12.2],target:[-4,1.55,-14.35],duration:1.5,text:'Respire. Você ainda consegue corrigir esse pedido.',speaker:'CHEF'}]);};
const resetKitchen4V070=resetKitchen4;resetKitchen4=function(saved=false){film4P=null;dialogShot4P=null;lastDialogueShot4P='';filmBars4P.classList.add('hidden');resetKitchen4V070(saved);kitchen4.introSeen=saved;kitchen4.lastUi4P=0;held4P.classList.add('hidden');};
const updateKitchen4V070=updateKitchen4;updateKitchen4=function(dt,now){
 if(scene!=='floor4')return;if(film4P&&mode!=='paused'&&mode!=='dead'){mode='cinematic';const film=film4P,shot=film.shots[film.index];if(!film.entered){film.entered=true;if(shot.text)showCaption(shot.speaker||'',shot.text,Math.max(1600,shot.duration*1000+400));if(shot.sound)sound4(shot.sound);filmBars4P.querySelector('.filmBottom4P span').textContent='E — PULAR CENA';}film.t+=dt;if(kitchen4.door)kitchen4.doorOpen=lerp(kitchen4.doorOpen||0,1,1-Math.exp(-dt*4));if(film.t>=shot.duration){film.t=0;film.index++;film.entered=false;if(film.index>=film.shots.length)finishFilm4P();}}
 if(!film4P&&mode==='world'&&kitchen4.phase==='arrival'&&!kitchen4.introSeen&&player.z<.75){kitchen4.introSeen=true;kitchen4.called=true;startFilm4P('arrival',[{eye:[0,1.68,1.3],target:[0,1.55,-10.45],push:[0,0,-.5],duration:2.4,text:'Um restaurante... aqui?',speaker:'VOCÊ'},{eye:[1.8,1.7,-4.9],target:[0,1.7,-10.45],push:[-.25,0,-.15],duration:2.6,text:'O salão inteiro está vazio. Exceto por ele.',speaker:''},{eye:[-2.8,1.74,-11.6],target:[-4,1.6,-14.35],duration:2.4,text:'Ei! Você aí! Finalmente alguém.',speaker:'CHEF',sound:'bell'}],()=>setObjective('Fale com o chef junto ao passe'));}
 updateKitchen4V070(dt,now);const k=kitchen4;filmBars4P.classList.toggle('hidden',!film4P&&!(mode==='dialogue'&&dialogueKind==='chef4'));hud4.classList.toggle('hidden',!!film4P||mode==='dialogue'||mode==='dead'||mode==='ending');ui.hand.classList.toggle('hidden',!!film4P||mode==='dialogue'||!['arrival','breaker'].includes(k.phase));held4P.classList.toggle('hidden',!k.plate||!['world','paused'].includes(mode));if(k.plate){if(held4P.dataset.quality!==String(k.plate.quality)||held4P.dataset.parts!==JSON.stringify(k.plate.parts)){paintHeld4P();held4P.dataset.quality=String(k.plate.quality);held4P.dataset.parts=JSON.stringify(k.plate.parts)}held4P.style.transform=`translateY(${Math.sin(player.bob)*3}px)`;}
 if(k.cut){const bar=panel4.querySelector('.cuttrack i');if(bar){bar.style.left=(targetCut4P(k.cut)-.13)*100+'%';bar.style.width='26%';}}
 if(now-k.lastUi4P>45){k.lastUi4P=now;const visual=panel4.querySelector('.workVisual4P');if(visual)paintStation4P(visual,now);}
 const chef=sprites.find(s=>s.id==='chef4');if(chef)chef.h=2.15+Math.sin(now*.0017)*.004;
};
panel4.addEventListener('click',()=>{if(kitchen4.cut&&!panel4.querySelector('.workVisual4P'))canvasStation4P('cut');if(panel4.dataset.station==='montagem'){for(const b of panel4.querySelectorAll('.kbody button')){const a=kitchen4.bag.find(i=>itemName4(i)===b.textContent);if(a)b.classList.toggle('selectedComponent4P',kitchen4.selection.includes(a.id))}}});
const tutorialHint4V070=tutorialHint4;tutorialHint4=function(){const j=kitchen4.jobs.grill;if(j&&!j.flipped)return 'Vire a carne entre 5 e 10 segundos para dourar os dois lados. Retire AO PONTO.';return tutorialHint4V070();};
window.addEventListener('keydown',e=>{if(scene==='floor4'&&mode==='cinematic'&&['KeyE','Space'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)finishFilm4P();}},true);
const togglePauseV070=togglePause;togglePause=function(){if(scene==='floor4'&&mode==='cinematic'){pausePrevMode='cinematic';mode='paused';for(const k of Object.keys(keys))keys[k]=false;if(document.pointerLockElement)document.exitPointerLock();ui.pause.classList.remove('hidden');sfx.click();return;}togglePauseV070();};
// Fatal attack is a staged close encounter with the supplied arm-grab sprite.
killBrute4=async function(){if(mode==='dead')return;film4P=null;filmBars4P.classList.add('hidden');held4P.classList.add('hidden');panel4.classList.add('hidden');mode='dead';if(document.pointerLockElement)document.exitPointerLock();ui.controls.classList.add('hidden');ui.crosshair.classList.add('hidden');for(const k of Object.keys(keys))keys[k]=false;kitchen4.angryUntil=performance.now()+5000;gazeDisturbance=7;sound4('slam');showCaption('','A mesa estala. Você não tem tempo de recuar.',650);await new Promise(r=>setTimeout(r,700));gazeDisturbance=0;ui.caption.classList.add('hidden');if(sfx.master&&sfx.ctx)sfx.master.gain.setTargetAtTime(.001,sfx.ctx.currentTime,.018);await new Promise(r=>setTimeout(r,130));if(sfx.master&&sfx.ctx)sfx.master.gain.setTargetAtTime(sfx.volume,sfx.ctx.currentTime,.018);attack4.classList.remove('hidden');attack4.style.setProperty('--lunge','1');sound4('attack');setTimeout(()=>attack4.style.setProperty('--lunge','1.22'),50);await new Promise(r=>setTimeout(r,780));ui.fade.classList.add('on');sound4('bite');await new Promise(r=>setTimeout(r,470));attack4.classList.add('hidden');await new Promise(r=>setTimeout(r,350));resetKitchen4(true);ui.fade.classList.remove('on');showCaption('','SAVE 4 — o expediente recomeça depois do tutorial.',2200);requestLock();};

// Working doors, burners and quieter spatial kitchen audio.
material4P('stillLife4P',512,512,false,(g,r,w,h)=>{g.fillStyle='#242720';g.fillRect(0,0,w,h);const grad=g.createRadialGradient(270,225,10,270,225,310);grad.addColorStop(0,'#74633d');grad.addColorStop(1,'#141c16');g.fillStyle=grad;g.fillRect(0,0,w,h);g.fillStyle='#534234';g.fillRect(0,350,512,162);g.fillStyle='#a58d67';g.beginPath();g.ellipse(263,360,155,35,0,0,7);g.fill();for(let i=0;i<6;i++){g.fillStyle=['#a26745','#8f7945','#a8965b'][i%3];g.beginPath();g.ellipse(180+i*26,300-Math.sin(i)*38,33,40,.15,0,7);g.fill();g.fillStyle='#695e35';g.fillRect(180+i*26,258-Math.sin(i)*38,3,12)}g.fillStyle='#294035';g.fillRect(358,160,55,185);g.fillRect(373,110,25,62);g.fillStyle='#c4b381';g.fillRect(360,215,51,70);for(let i=0;i<6500;i++){g.fillStyle=r()>.5?'#f5dc960c':'#07100b0c';g.fillRect(r()*w,r()*h,3,3)}});
const buildFloor4PBase=buildFloor4;buildFloor4=function(){buildFloor4PBase();for(const o of objects){if(Math.abs(o.z+24)<.01&&Math.abs(o.y-1.37)<.01&&o.tex==='black')o.potLid4P=o.x<7?'pot1':'pot2';if(o.z===-19.36&&o.sx===.06)o.hiddenFridgeHandle4P=true;}
 for(const side of [-1,1]){const hinge=side<0?-10.575:-7.425;box(side<0?-9.81:-8.19,1.69,-19.42,1.5,1.2,.055,'steel4P',[.86,.91,.92],[1,1],{fridgeDoor4P:side,hinge4P:hinge,half4P:.765});box(side<0?-9.25:-8.75,1.69,-19.34,.06,.39,.075,'brass',[1.2,1.1,.85],[1,1],{fridgeDoor4P:side,hinge4P:hinge,half4P:1.31,handle4P:true})}
 for(const x of [-11.69,11.69])for(const z of [-.2,-5.4,-10.5]){box(x,1.7,z,.065,1.12,.9,'brass',[1.15,.87,.49]);box(x+(x<0?.04:-.04),1.7,z,.065,1.02,.80,'stillLife4P',[1.1,.99,.79]);}
 for(const x of [-11.90,11.90]){box(x,.52,-4.75,.065,1.04,15.4,'darkwood',[.9,.73,.58],[1,12]);for(const z of [-11.7,-9.8,-7.9,-6,-4.1,-2.2,-.3,1.6]){box(x+(x<0?.04:-.04),.56,z,.09,.84,1.7,'oak4P',[.62,.55,.46],[1,1]);for(const dz of [-.81,.81])box(x+(x<0?.1:-.1),.56,z+dz,.06,.82,.028,'brass',[.6,.51,.34]);}box(x+(x<0?.08:-.08),1.07,-4.75,.12,.045,15.4,'brass',[.85,.68,.43]);}
};
const drawBox4PBase=drawBox;drawBox=function(o){if(scene==='floor4'){if(o.hiddenFridgeHandle4P)return;if(o.potLid4P&&kitchen4.jobs[o.potLid4P])return;if(o.fridgeDoor4P){const a=(kitchen4.fridgeOpen4P||0)*.85,side=o.fridgeDoor4P;o.rotY=side<0?-a:a;o.x=o.hinge4P+(side<0?1:-1)*Math.cos(a)*o.half4P;o.z=-19.42+Math.sin(a)*o.half4P+(o.handle4P?.055:0);}}drawBox4PBase(o)};
const sound4V070=sound4;sound4=function(kind){if(!sfx.ctx||!audioBuffers4[kind])return;const src=sfx.ctx.createBufferSource();src.buffer=audioBuffers4[kind];const gain=sfx.ctx.createGain(),positions={sizzle:[2,-24],simmer:[7,-24],oven:[10,-20],fridge:[-9,-20],knife:[-9,-24],slam:[0,-10.45],grunt:[0,-10.45],chew:[0,-10.45],water:[8,-16.7]};const pos=positions[kind],v=viewData();let volume=['slam','attack'].includes(kind)?.7:kind==='sizzle'||kind==='simmer'?.16:.38;if(pos){const dx=pos[0]-v.eye[0],dz=pos[1]-v.eye[2],dist=Math.hypot(dx,dz);volume*=clamp(1-dist/28,.28,1);if(sfx.ctx.createStereoPanner){const pan=sfx.ctx.createStereoPanner();const yaw=Math.atan2(v.f[0],-v.f[2]);pan.pan.value=clamp((dx*Math.cos(yaw)+dz*Math.sin(yaw))/Math.max(2,dist),-.88,.88);src.connect(pan);pan.connect(gain);}else src.connect(gain);}else src.connect(gain);gain.gain.value=volume;gain.connect(sfx.master);src.start();};
const updateKitchen4PBase=updateKitchen4;updateKitchen4=function(dt,now){updateKitchen4PBase(dt,now);if(scene!=='floor4')return;const k=kitchen4;if(mode!=='paused')k.fridgeOpen4P=lerp(k.fridgeOpen4P||0,mode==='kitchen'&&panel4.dataset.station==='geladeira'?1:0,1-Math.exp(-dt*8));objects=objects.filter(o=>!o.burner4P);for(const slot of ['pot1','pot2']){const j=k.jobs[slot];if(!j)continue;const cx=slot==='pot1'?6.35:7.65;box(cx,1.415,-24,.46,.025,.46,'ceramic4P',j.kind==='soup'?[.65,.51,.29]:[.68,.71,.44],[1,1],{geometry:'round',burner4P:true});if(j.sealed)for(let i=0;i<7;i++){const a=i*Math.PI*2/7;box(cx+Math.cos(a)*.29,1.13,-24+Math.sin(a)*.29,.055,.045+.015*Math.sin(now*.035+i),.055,'white',[.24,.50,1.4],[1,1],{geometry:'shade',emissive:.32,burner4P:true});}}
};

// Organic silhouettes and folded leaves, reused by food and snowbanks.
function geometry10(name,leaf=false){const data=[],N=18,L=12,put=(p,n,uv)=>data.push(...p,...n,...uv);for(let i=0;i<L;i++)for(let j=0;j<N;j++){const at=(ii,jj)=>{const u=jj/N,v=ii/L,a=u*Math.PI*2,b=v*Math.PI;if(leaf){const radius=v*.5,edge=1+.12*Math.sin(a*7);return {p:[Math.cos(a)*radius*edge,.10*Math.sin(a*3)*v+.08*v*v,Math.sin(a)*radius],n:[0,1,0],uv:[.5+Math.cos(a)*v/2,.5+Math.sin(a)*v/2]}}const nx=Math.sin(b)*Math.cos(a),ny=Math.cos(b),nz=Math.sin(b)*Math.sin(a),r=.5*(1+.055*Math.sin(a*3)*Math.sin(b)*Math.sin(b));return{p:[nx*r,ny*.5,nz*r],n:[nx,ny,nz],uv:[u,v]}};const p=at(i,j),q=at(i+1,j),r=at(i+1,j+1),t=at(i,j+1);for(const v of [p,q,r,p,r,t])put(v.p,v.n,v.uv)}const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);shapedGeometry[name]={buf,count:data.length/8}}
geometry10('organic10');geometry10('leaf10',true);
function iceGeometry10(name,inverted=false){const vertices=[],N=7,at=(ring,j)=>{const a=j/N*Math.PI*2,yy=[-.5,-.28,.23,.5][ring],r=[.46,.51,.35,.035][ring]*(1+.1*Math.sin(j*5));return [Math.cos(a)*r+(ring===3?.13:0),inverted?-yy:yy,Math.sin(a)*r]};const tri=(a,b,c)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],d=Math.hypot(...n)||1;for(const p of [a,b,c])vertices.push(...p,...n.map(x=>x/d),p[0]+.5,p[1]+.5)};for(let i=0;i<3;i++)for(let j=0;j<N;j++){const a=at(i,j),b=at(i,(j+1)%N),c=at(i+1,(j+1)%N),d=at(i+1,j);tri(a,b,c);tri(a,c,d)}for(let j=0;j<N;j++){tri([0,inverted?.5:-.5,0],at(0,(j+1)%N),at(0,j));tri([.13,inverted?-.5:.5,0],at(3,j),at(3,(j+1)%N))}const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);shapedGeometry[name]={buf,count:vertices.length/8}}
iceGeometry10('iceShard10');iceGeometry10('icicle10',true);

texture4('beef10','#b46363',g=>{g.strokeStyle='#edd0b494';g.lineWidth=3;for(let i=0;i<38;i++){g.beginPath();g.moveTo(0,i*17);g.bezierCurveTo(180,i*17-45,290,i*17+50,512,i*17-30);g.stroke()}g.fillStyle='#813d3c88';for(let i=0;i<180;i++)g.fillRect((i*83)%512,(i*131)%512,3,6)});
texture4('sear10','#805031',g=>{for(let i=0;i<1800;i++){g.fillStyle=i%2?'#ba825644':'#33231e44';g.fillRect((i*83)%512,(i*139)%512,4,5)}});
texture4('crumb10','#d5a54c',g=>{for(let i=0;i<2200;i++){g.fillStyle=i%3?'#96632b66':'#ffdda778';g.fillRect((i*43)%512,(i*137)%512,3+i%4,3)}});
texture4('bun10','#c79450',g=>{for(let i=0;i<1900;i++){g.fillStyle=i%2?'#ffe2ab33':'#80502333';g.fillRect((i*127)%512,(i*53)%512,3,2)}});
texture4('leaf10','#639c45',g=>{g.strokeStyle='#b8cf7eaa';g.lineWidth=4;g.beginPath();g.moveTo(256,512);g.lineTo(256,0);g.stroke();g.lineWidth=2;for(let i=0;i<10;i++){g.beginPath();g.moveTo(256,60+i*44);g.lineTo(i%2?480:30,10+i*44);g.stroke()}});

// v0.10 — compact, direct preparation. Isolated from the first three floors.
const R9={duration:300,goal:420,cookTime:10,burnTime:19};
const dishes9=[
 {id:'burger',name:'Hambúrguer',parts:['bread:raw','meat:grilled','lettuce:cut','cheese:raw','tomato:cut'],icons:['bread','meat','lettuce','cheese','tomato']},
 {id:'fries',name:'Batata frita',parts:['potato:fried'],icons:['potato']},
 {id:'chicken',name:'Frango empanado',parts:['chicken:fried'],icons:['chicken']},
 {id:'salad',name:'Salada',parts:['lettuce:cut','tomato:cut'],icons:['lettuce','tomato']}
];
names4.tomato='Tomate';
let propClock9=0,deathToken9=0,heldPulse9=0,lastGuide9='';
const prep9=document.createElement('div');prep9.id='prep9';prep9.className='hidden';document.querySelector('#gameShell').append(prep9);
const snow9=document.createElement('canvas');snow9.id='snow9';snow9.width=800;snow9.height=500;snow9.className='hidden';document.querySelector('#gameShell').append(snow9);
const icon9={};
function foodDraw9(g,a,x,y,s=1){g.save();g.translate(x,y);g.scale(s,s);g.lineJoin='round';g.lineCap='round';const burnt=a.state==='burnt',raw=['raw','cut','undercooked'].includes(a.state),cut=a.state==='cut';const shape=(points,c)=>{g.beginPath();points.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fillStyle=c;g.fill();g.strokeStyle=burnt?'#171614':'#463725';g.lineWidth=1.6;g.stroke()};const oval=(xx,yy,rx,ry,c)=>{g.fillStyle=c;g.beginPath();g.ellipse(xx,yy,rx,ry,0,0,7);g.fill()};const leaf=(xx,yy,r,angle=0)=>{g.save();g.translate(xx,yy);g.rotate(angle);let ps=[];for(let i=0;i<22;i++){const t=i/22*Math.PI*2;ps.push([Math.cos(t)*r*(1+(i%3)*.12),Math.sin(t)*r*.62*(1+(i%2)*.22)])}shape(ps,'#649245');g.strokeStyle='#b2c879';g.lineWidth=1.4;g.beginPath();g.moveTo(-r*.8,0);g.lineTo(r*.8,0);for(let i=-2;i<=2;i++){g.moveTo(i*r/3,0);g.lineTo(i*r/3+r*.2,-r*.4);g.moveTo(i*r/3,0);g.lineTo(i*r/3+r*.2,r*.4)}g.stroke();g.restore()};
 if(a.kind==='lettuce'){if(cut)for(let i=0;i<8;i++)leaf(Math.sin(i*4)*27,Math.cos(i*3)*15,12+i%3*3,i*.7);else{leaf(-14,0,31,-.4);leaf(16,4,29,.5);leaf(0,-12,30,.1);oval(0,17,6,4,'#c5d09b')}}
 if(a.kind==='tomato'){if(cut){for(let q=0;q<3;q++){g.save();g.translate((q-1)*24,(q%2)*9);oval(0,2,24,15,'#7b2b21');oval(0,0,24,15,'#d5573e');oval(0,0,20,11,'#ef9070');oval(0,0,16,9,'#b13c2c');for(let i=0;i<7;i++){const t=i*.9;oval(Math.cos(t)*12,Math.sin(t)*7,2,1.4,'#f3d293')}g.restore()}}else{const grad=g.createRadialGradient(-12,-14,3,0,0,35);grad.addColorStop(0,'#ed8b64');grad.addColorStop(.6,'#c94a36');grad.addColorStop(1,'#792c25');oval(0,0,31,27,grad);shape([[-17,-21],[-6,-25],[-7,-35],[1,-29],[13,-33],[9,-24],[23,-21],[8,-19],[2,-12],[-3,-22]],'#527b39');g.strokeStyle='#c68665';g.lineWidth=1;g.beginPath();g.arc(-8,4,12,1.7,2.7);g.stroke()}}
 if(a.kind==='bread'){oval(0,12,41,17,'#9c6d39');const grad=g.createLinearGradient(0,-32,0,19);grad.addColorStop(0,'#e5bb75');grad.addColorStop(1,'#a16a37');oval(0,-3,43,28,grad);g.strokeStyle='#88552c';g.beginPath();g.ellipse(0,8,40,10,0,0,Math.PI);g.stroke();g.fillStyle='#fff0ca';for(let i=0;i<18;i++){g.save();g.translate(Math.sin(i*7)*34,-6+Math.cos(i*4)*15);g.rotate(i*.9);g.fillRect(-2,-.8,4,1.6);g.restore()}}
 if(a.kind==='cheese'){shape([[-39,-17],[26,-23],[41,17],[-27,25]],'#d5a03b');shape([[-39,-19],[26,-25],[41,14],[-27,21]],'#f0c75d');g.strokeStyle='#fff0a9';g.beginPath();g.moveTo(-33,-15);g.lineTo(23,-21);g.stroke()}
 if(a.kind==='meat'){const points=cut||!raw?[[-34,-11],[-16,-22],[20,-20],[37,-6],[33,15],[8,23],[-24,18],[-39,1]]:[[-43,-12],[-21,-24],[8,-21],[34,-5],[45,14],[16,27],[-22,19],[-40,4]];shape(points,burnt?'#29251f':raw?'#b66e70':'#855031');if(raw){g.strokeStyle='#f3c3b5';g.lineWidth=2;for(let i=0;i<5;i++){g.beginPath();g.moveTo(-28+i*12,-10);g.bezierCurveTo(-14+i*12,-4,-27+i*12,6,-13+i*12,14);g.stroke()}oval(-16,-11,5,2,'#e2a998')}else{g.strokeStyle=burnt?'#141412':'#39261e';g.lineWidth=3;for(let i=0;i<4;i++){g.beginPath();g.moveTo(-30+i*15,-12);g.lineTo(-18+i*15,13);g.stroke()}for(let i=0;i<20;i++)oval(Math.sin(i*4)*30,Math.cos(i*3)*16,1.4,1,burnt?'#534733':'#ca925c')}}
 if(a.kind==='chicken'){for(let q=0;q<2;q++){g.save();g.translate((q-.5)*34,q*13-5);g.rotate(q?.25:-.2);shape([[-18,-21],[-2,-30],[15,-22],[22,-2],[12,20],[-6,28],[-19,16],[-24,-2]],burnt?'#332b22':raw?'#d1a18e':'#d4a14b');if(raw){g.strokeStyle='#efd0bb';g.beginPath();g.moveTo(-14,-12);g.quadraticCurveTo(7,-8,8,13);g.stroke()}else for(let i=0;i<55;i++)oval(Math.sin(i*7)*17,Math.cos(i*3)*22,1.4+i%2,1,burnt?i%2?'#1d1b17':'#65513a':i%2?'#9b6b31':'#f1ce81');g.restore()}}
 if(a.kind==='potato'){if(cut||!raw){for(let i=0;i<9;i++){g.save();g.translate((i%5)*14-28,Math.floor(i/5)*12);g.rotate((i-4)*.11);shape([[-4,-26],[5,-26],[6,21],[-4,24]],burnt?'#352c22':cut?'#e5ce91':'#dbb255');g.strokeStyle=burnt?'#1e1b16':cut?'#fff2c7':'#f9d982';g.beginPath();g.moveTo(-2,-21);g.lineTo(-2,17);g.stroke();g.restore()}}else{g.save();g.rotate(-.25);shape([[-30,-12],[-12,-23],[17,-18],[33,0],[20,19],[-11,23],[-31,9]],'#ab8355');oval(-10,-8,12,4,'#c8a474');for(let i=0;i<8;i++)oval(Math.sin(i*4)*23,Math.cos(i*3)*14,1.6,1,'#775639');g.restore()}}
 g.restore()}
for(const kind of ['bread','meat','chicken','potato','lettuce','tomato','cheese']){const c=document.createElement('canvas');c.width=110;c.height=62;foodDraw9(c.getContext('2d'),{kind,state:'raw'},55,32,.64);icon9[kind]=c.toDataURL()}
texture4('ice9','#a1bdc4',g=>{g.fillStyle='#c3d6d5';for(let i=0;i<160;i++){const x=(i*83)%512,y=(i*171)%512;g.beginPath();g.moveTo(x,y);g.lineTo(x+35,y-45);g.lineTo(x+75,y+16);g.fill()}g.strokeStyle='#63899188';for(let i=0;i<22;i++){g.beginPath();g.moveTo(i*27,0);g.lineTo(i*19,512);g.stroke()}});
texture4('snowfloor9','#d2dedb',g=>{for(let i=0;i<2400;i++){g.fillStyle=i%2?'#8caab722':'#ffffff44';g.fillRect((i*47)%512,(i*83)%512,3,2)}g.strokeStyle='#9cb2bb';g.lineWidth=3;for(let i=0;i<8;i++){g.beginPath();g.ellipse(250+(i%2)*12,i*65,12,20,.3,0,7);g.stroke()}});
// Remove the painted tabletop only; keep every normal pose seated at a real table.
const seatedReady9=spritesReady4.then(()=>{for(let i=0;i<3;i++){const im=imgs['brute4_'+i];if(!im)continue;const c=document.createElement('canvas');c.width=im.width;c.height=378;c.getContext('2d').drawImage(im,0,0,im.width,378,0,0,im.width,378);imgs['brute4_'+i]=c;spriteTex['brute4_'+i]=textureFromImage(c)}if(scene==='floor4'){const s=sprites.find(s=>s.id==='brute4');if(s)s.w=s.h*imgs.brute4_0.width/378}});
function worktop9(x,z,w,d=1){box(x,.47,z,w,.86,d,'steel4P');box(x,.94,z,w+.08,.1,d+.08,'steel4P');solidRect(x,z,w,d,1,false,'work9');for(let xx=x-w/2+.2;xx<x+w/2;xx+=.65){box(xx,.55,z+d/2+.035,.04,.24,.04,'black');box(xx,.54,z+d/2+.055,.045,.16,.02,'brass')}}
function target9(id,x,z,label,range=2){interactables.push({id:'k4_'+id,x,z,label,range})}
buildFloor4=function(){
 player.x=0;player.z=2.5;player.yaw=0;player.pitch=0;player.jumpY=0;player.floorY=0;player.yVel=0;
 box(0,-.1,-2.5,14,.2,11,'oak4P',[1.25,1.05,.83],[7,5.5]);box(0,3.4,-2.5,14,.2,11,'ceiling',[.85,.82,.71],[5,4]);
 box(0,-.1,-11,14,.2,6,'floorTile4P',[1,1,1],[7,3]);box(0,3.4,-11,14,.2,6,'ceiling',[.9,.96,.96],[5,3]);
 wall4(-7,-5.5,.2,17);wall4(7,-5.5,.2,17);wall4(-4.05,3,5.9,.2);wall4(4.05,3,5.9,.2);box(0,2.95,3,2.2,.7,.2,'wine4');addElevatorPreview('z',0,3.03);addElevatorExterior('z',0,2.93,'floor4');box(0,2.65,2.83,.6,.25,.04,'ind4',[1,1,1],[1,1],{emissive:.5});
 // Left doorway, wide observation window, and chef's service hatch.
 wall4(-6.4,-8,1.2,.18,'tile4');wall4(-3.45,-8,1.1,.18,'tile4');box(-4.9,3.04,-8,1.8,.52,.18,'tile4');
 box(.5,.51,-8,6.8,1.02,.18,'tile4');solidRect(.5,-8,6.8,.2,1.05,false,'windowSill9');box(.5,3.05,-8,6.8,.5,.18,'tile4');
 // Only low/high surfaces occlude; the open window cannot hide the seated client.
 box(.5,1.07,-8,7,.08,.32,'oak4P');for(const x of [-2.94,3.94])box(x,1.93,-8,.12,1.8,.25,'darkwood');
 box(5.45,.48,-8,2.9,.96,.3,'tile4');solidRect(5.45,-8,2.9,.35,1.02,false,'pass9');box(5.25,1.04,-8,3.15,.12,.8,'oak4P');box(5.45,3.02,-8,2.9,.56,.18,'tile4');
 for(const x of [-4.6,4.6])for(const z of [-1,-4.8])table4(x,z);
 // The customer stays seated, behind a substantial oak table.
 box(0,.79,-5.75,2.65,.16,1.5,'oak4P',[1.35,1.15,.88],[2,1]);for(const x of [-1.1,1.1])for(const z of [-6.3,-5.2])box(x,.36,z,.12,.72,.12,'darkwood');solidRect(0,-5.75,2.7,1.55,1,false,'bruteTable9');
 box(0,.52,-6.65,1.4,.13,.7,'darkwood');box(0,.63,-6.95,1.45,.42,.12,'darkwood');sprite('brute4',0,-6.2,1.78,'brute4_0',{y:.85,w:1.83,billboard:false,rotY:0,emissive:.12});
 sprite('chef4',5,-9.2,2.05,'chef4_0');solidRect(5,-9.2,.7,.6,2.1,false,'chef9');target9('chef',5,-9.2,'FALAR COM O CHEF',2.6);target9('serve',5,-9.2,'ENTREGAR AO CHEF',3.3);
 for(const x of [-3.8,0,3.8]){box(x,2.98,-3,.04,.6,.04,'brass');box(x,2.68,-3,.7,.1,.7,'brass',[1.2,1,.7],[1,1],{geometry:'round'});for(let i=0;i<5;i++){const a=i*1.256;box(x+Math.cos(a)*.35,2.59,-3+Math.sin(a)*.35,.14,.24,.14,'cloth4P',[1.5,1.2,.7],[1,1],{geometry:'shade',emissive:.7})}}
 for(const x of [-6.83,6.83]){box(x,1.75,-3.1,.06,1.7,2.4,'window4P');for(const dz of [-1.25,1.25])box(x,1.8,-3.1+dz,.12,1.9,.22,'cloth4P',[.7,.28,.32]);box(x,2.8,-3.1,.12,.08,2.8,'brass')}
 box(0,2.88,-7.83,3,.34,.035,'hotelBadge4P');box(0,.012,-1.6,2.4,.02,7,'runner4P',[1,1,1],[1,2]);for(const z of [0,-4,-7.8])box(0,3.3,z,13.8,.08,.13,'darkwood');
 // Compact U shaped kitchen. All work happens within a few steps.
 worktop9(-4.2,-10.0,1.75,1.3);box(-4.2,.99,-10.0,1.4,.04,1,'black');box(-4.2,1.015,-10.0,1.22,.02,.8,'steel4P',[.7,.65,.6]);for(const x of [-4.6,-3.85])box(x,.69,-9.9,.12,.12,.05,'black',[1,1,1],[1,1],{geometry:'round'});box(-4.2,2.65,-10.0,2,.35,1.3,'steel4P',[1,1,1],[1,1],{geometry:'shade'});target9('grill',-4.2,-10.0,'USAR FOGÃO');
 worktop9(-4.2,-12.4,1.75,1.3);box(-4.2,1.02,-12.4,1.15,.12,.85,'black');box(-4.2,1.06,-12.4,.91,.07,.62,'brass',[.65,.55,.32]);for(const dx of [-.3,.3]){box(-4.2+dx,1.11,-12.4,.38,.025,.59,'steel4P');box(-4.2+dx,1.14,-12.38,.035,.035,.3,'black')}target9('fryer',-4.2,-12.4,'USAR FRITADEIRA');
 worktop9(-2.35,-12.7,2.1,1.2);box(-2.35,1.035,-12.7,1.3,.07,.85,'oak4P',[1.5,1.35,1]);target9('board',-2.35,-12.7,'USAR TÁBUA');
 worktop9(2.9,-12.7,2.2,1.2);box(2.9,1.015,-12.7,1.45,.025,.77,'black');box(2.9,1.03,-12.7,1.22,.025,.65,'steel4P',[.6,.65,.67]);box(3.35,1.28,-13.03,.035,.45,.035,'steel4P');box(3.25,1.49,-12.9,.22,.035,.28,'steel4P');target9('sink',2.9,-12.7,'ABRIR / FECHAR A TORNEIRA');
 worktop9(-.4,-9.15,1.6,1.1);target9('assembly2',-.4,-9.15,'MONTAR / PEGAR PRATO',1.8);worktop9(2,-9.15,2.2,1.1);for(let i=0;i<4;i++)box(2.6,1.02+i*.025,-9.2,.5,.025,.5,'ceramic4P',[1,1,1],[1,1],{geometry:'round'});target9('assembly',2,-9.15,'MONTAR / PEGAR PRATO');
 // Open rack faces west: narrow back, separate shelves, no coplanar faces.
 box(6.53,1.04,-11.8,.055,2.08,1.9,'darkwood');for(const z of [-12.74,-10.86])box(6.15,1.04,z,.78,2.08,.065,'darkwood');for(const y of [.32,.85,1.38,1.97])box(6.14,y,-11.8,.82,.065,1.9,'oak4P');solidRect(6.14,-11.8,.87,2.0,2.1,false,'shelf9');target9('shelf',5.92,-11.8,'PEGAR INGREDIENTE',2.1);
 box(4.7,.39,-10.65,.58,.78,.58,'steel4P',[.7,.7,.65],[1,1],{geometry:'round'});box(4.7,.81,-10.65,.64,.06,.64,'black',[1,1,1],[1,1],{geometry:'round',trashLid9:true});solidRect(4.7,-10.65,.62,.62,.85,false,'bin9');target9('trash',4.7,-10.65,'DESCARTAR COMIDA',1.7);
 for(const x of [-3,3]){box(x,3.19,-11,2.9,.12,.32,'steel4P');box(x,3.1,-11,2.7,.04,.23,'white',[.9,1.05,1.15],[1,1],{emissive:.8})}
 // Cold store: an obvious provision route, with an inaccessible frosted depth.
 wall4(-6.75,-14,.5,.18,'tile4');wall4(-3.05,-14,3.5,.18,'tile4');box(-5.65,3.06,-14,1.7,.48,.18,'tile4');wall4(4.15,-14,5.7,.18,'tile4');box(0,3.04,-14,2.6,.52,.18,'tile4');box(0,1.4,-14.04,2.45,2.8,.13,'steel4P',[.82,.91,.93],[1,1],{freezerDoor9:true});box(.9,1.25,-13.87,.09,.65,.09,'darkwood',[.8,.8,.7],[1,1],{freezerHandle9:true});for(const x of [-1.33,1.33])box(x,1.4,-14,.12,2.85,.28,'steel4P',[.48,.53,.55]);solidRect(0,-14,2.45,.2,3.3,false,'freezerDoor9');occluderRect(0,-14,2.45,.2,'freezerDoor9');target9('freezer',0,-13.95,'ABRIR / FECHAR FREEZER',2.2);
 // An ordinary door opens onto a much larger, impossible winter chamber.
 box(0,-.12,-16,7,.24,4,'snowfloor9',[1,1,1],[4,3]);box(0,3.4,-16,7,.2,4,'ice9');wall4(-3.5,-16,.2,4,'ice9');wall4(3.5,-16,.2,4,'ice9');
 box(0,-.12,-30,20,.24,24,'snowfloor9',[1,1,1],[12,14]);box(0,8.4,-30,20,.2,24,'ice9',[.65,.85,1],[9,10]);
 const iceWall=(x,z,w,d)=>{box(x,4.15,z,w,8.3,d,'ice9',[.75,.92,1],[Math.max(w,d)/2,3]);solidRect(x,z,w,d,8.3,false,'iceWall10');occluderRect(x,z,w,d,'iceWall10')};iceWall(-10,-30,.25,24);iceWall(10,-30,.25,24);iceWall(0,-42,20,.3);iceWall(-6.75,-18,6.5,.25);iceWall(6.75,-18,6.5,.25);
 // Provisions face the entrance, well past the swept area of the open door.
 for(const x of [-.95,.95])for(const z of [-19.75,-20.35])box(x,.8,z,.055,1.6,.055,'steel4P');for(const y of [.45,1.05])box(0,y,-20.05,2.0,.07,.85,'steel4P');for(const x of [-.48,.48]){box(x,1.15,-19.97,.75,.18,.5,'ceramic4P');foodMesh9({kind:x<0?'meat':'chicken',state:'raw'},x,1.30,-19.97,1.4)}solidRect(0,-20.05,2.1,.94,1.65,false,'coldShelf9');target9('provisions',0,-19.75,'PEGAR CARNE E FRANGO',2.4);
 box(0,2.8,-20.2,1.8,.09,.3,'white',[.85,.97,1],[1,1],{emissive:.8});
 // Sculpted ice, icicles and snowbanks leave an obvious central path.
 for(let i=0;i<24;i++){const side=i%2?1:-1,z=-21-Math.floor(i/2)*1.55,x=side*(4.5+Math.sin(i*7)*2);const h=1.2+(i%5)*.72;box(x,h/2,z,1.4,h,1.8,'ice9',[.72,.90,1],[1,2],{geometry:'iceShard10',rotY:i*.7});solidRect(x,z,1.4,1.8,h,false,'iceRock10');box(x,.22,z,2.3,.44,2.4,'snowfloor9',[1,1,1],[1,1],{geometry:'organic10'})}
 for(let i=0;i<26;i++)box(-9+(i*2.7)%18,7.7,-19-(i*3.3)%21,.28,1.3+i%3*.6,.28,'ice9',[.8,.95,1],[1,1],{geometry:'icicle10'});
 box(0,2.9,-40,5.5,5.8,1.3,'ice9',[.5,.72,.86],[2,3],{geometry:'shade'});solidRect(0,-40,5.5,1.3,5.8,false,'sealedIce10');
 // Maintenance room, a reward beside the cold store.
 box(-5.5,-.1,-16,3,.2,4,'floorTile4P');box(-5.5,3.4,-16,3,.2,4,'ceiling');wall4(-7,-16,.2,4,'tile4');wall4(-4,-16,.2,4,'tile4');wall4(-5.5,-18,3,.2,'tile4');box(-5.65,1.4,-14,1.7,2.8,.14,'steel4P',[.65,.7,.67],[1,1],{maintenanceDoor9:true});solidRect(-5.65,-14,1.7,.2,3.3,false,'maintenanceDoor9');occluderRect(-5.65,-14,1.7,.2,'maintenanceDoor9');
 sprite('breaker4',-5.5,-17.87,1.02,'breaker_closed',{y:.8,billboard:false,rotY:0,breaker:true});target9('breaker',-5.5,-17.82,'ABRIR COM A CHAVE DE FENDA',1.9);box(-6.7,2.7,-16,.12,.12,3.5,'steel4P');box(-6.65,.4,-17.2,.7,.8,.55,'wood');
 target9('elevator',0,2.8,'SUBIR AO 5º ANDAR',2.3);
 box(6.86,1.82,-9.6,.05,.8,1.1,'staff4');target9('photo',6.55,-9.6,'OBSERVAR FOTO ANTIGA',1.8);
 box(6.65,.82,-10.2,.4,.06,.5,'oak4P');if(!inventory.includes('matches'))box(6.65,.9,-10.2,.22,.08,.15,'menu4',[1,1,1],[1,1],{matches4:true});target9('matches',6.6,-10.2,'PEGAR FÓSFOROS',1.3);
 for(const o of objects)if(o.tex==='darkwood'&&o.z<-14.1){o.tex='ice9';o.tint=[.8,.92,1]}kitchen4.visibleDirty=true;
};
const walk9=walkable;walkable=function(x,z){if(scene==='floor4'){for(const o of objects){if(!o.freezerDoor9&&!o.maintenanceDoor9)continue;const a=o.rotY||0,dx=x-o.x,dz=z-o.z,lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a);if(circleHitsRect(lx,lz,.23,{x:0,z:0,hx:o.sx/2,hz:o.sz/2}))return false}}return walk9(x,z)};
const baseWalk9=baseWalkable;baseWalkable=function(x,z){if(scene!=='floor4')return baseWalk9(x,z);return (x>-6.65&&x<6.65&&z>-13.82&&z<2.65)||(x>-3.15&&x<3.15&&z>-18.1&&z<=-13.7)||(x>-9.65&&x<9.65&&z>-41.65&&z<-18)||(kitchen4.door&&x>-6.65&&x<-4.3&&z>-17.65&&z<=-13.7)};
const common9=setCommon;setCommon=function(v){common9(v);if(scene!=='floor4')return;const cold=v.eye[2]<-14,kitch=v.eye[2]<-8;gl.uniform1f(loc.uAmbient,cold?.52:kitch?.56:.43);gl.uniform3fv(loc.uLightTint,new Float32Array(cold?[.72,.88,1]:kitch?[.92,.98,1]:[1,.85,.68]));gl.uniform1f(loc.uFogDensity,cold?.048:.016);if(cold)gl.uniform3fv(loc.uFogColor,new Float32Array([.12,.21,.29]));gl.uniform3fv(loc['uLocalPos[0]'],new Float32Array([0,2.7,-5.7,0,2.8,-11,0,2.8,-18]));gl.uniform3fv(loc['uLocalColor[0]'],new Float32Array([.85,.49,.19,.45,.56,.6,.3,.5,.75]));};
// Do not use arrival or service camera cuts. Only the special ending conversation.
showLine=function(){showLineV070();if(scene!=='floor4'||dialogueKind!=='chef4')return;if(kitchen4.phase==='reward'){const sp=dialogueLines[dialogueIndex][0];dialogShot4P=sp==='BRUTAMONTE'?{eye:[0,1.7,-3.6],target:[0,1.8,-6.2],duration:5,fov:54}:{eye:[4,1.7,-10.3],target:[5,1.55,-9.2],duration:5,fov:58};dialogShot4P.start=performance.now();filmBars4P.classList.remove('hidden')}else{dialogShot4P=null;filmBars4P.classList.add('hidden')}};
advanceDialogue=function(){advanceDialogueV070();if(scene==='floor4'&&mode!=='dialogue'){dialogShot4P=null;filmBars4P.classList.add('hidden')}};
resetKitchen4=function(saved=false){if(saved)restoreInventory10('chef');deathToken9++;film4P=null;dialogShot4P=null;lastDialogueShot4P='';filmBars4P.classList.add('hidden');panel4.classList.add('hidden');attack4.classList.add('hidden');held4P.classList.add('hidden');ui.pause.classList.add('hidden');ui.end.classList.add('hidden');ui.fade.classList.remove('on');ui.controls.classList.remove('hidden');ui.caption.classList.add('hidden');prep9.classList.add('hidden');
 kitchen4={phase:saved?'tutorial':'arrival',lesson:0,order:0,left:0,score:0,goal:R9.goal,stocked:saved?(checkpointSnapshot10?.stocked9??true):false,held:null,plate:null,assembly:[],board:null,jobs:{},orders:[],seq:0,uid:0,eating:0,transfer:0,chatter:20,door:false,power:false,opened:false,called:saved,freezerOpen:false,doorOpen:0,water:false,visibleDirty:true};
 kitchen4.assemblies=[kitchen4.assembly,[]];kitchen4.bench=0;kitchen4.bestScore=checkpointSnapshot10?.bestScore10||0;kitchen4.challengeAsked=checkpointSnapshot10?.challengeAsked10||false;kitchen4.matchesUnlocked=inventory.includes('matches')||kitchen4.bestScore>=700;setScene('floor4');mode='world';if(saved){player.x=-3.7;player.z=-9;setObjective('Treino sem tempo — fale com o chef para obter ajuda')}else setObjective('Explore o restaurante');lastGuide9='';
};
const save9=saveCheckpoint;saveCheckpoint=function(cp){save9(cp);if(cp==='chef'&&scene==='floor4'){try{const d=readSave();d.version=4;d.stocked9=!!kitchen4.stocked;d.bestScore10=kitchen4.bestScore||0;d.challengeAsked10=!!kitchen4.challengeAsked;checkpointSnapshot10={...d,inventory:[...d.inventory]};localStorage.setItem(SAVE_KEY,JSON.stringify(d))}catch(e){}}};
function newOrder9(){const k=kitchen4,index=[0,1,3,2,0,1,2,3][k.seq%8];k.seq++;return {id:k.seq,dish:index,left:index===0?110:90,total:index===0?110:90}}
function startShift9(){const k=kitchen4;k.phase='orders';k.left=R9.duration;k.score=0;k.orders=[newOrder9(),newOrder9()];k.held=null;k.plate=null;k.assemblies=[[],[]];k.bench=0;k.assembly=k.assemblies[0];k.board=null;k.jobs={};k.transfer=0;k.eating=0;k.comments10=[];k.visibleDirty=true;setObjective('Sirva ao chef — consiga 420 pontos em 5 minutos');sound4('paper')}
function tutorialHint9(){const k=kitchen4;if(!k.stocked)return 'Abra o freezer no fundo. Pegue a caixa de carne e frango na mesa iluminada em frente à entrada. Você só precisa buscar as provisões uma vez.';if(k.plate){const c=plateScore9(k.plate,dishes9[k.lesson]);if(!c.valid)return c.errors.join(' ')+' Apoie numa bancada vazia; R escolhe um ingrediente para corrigir.';}if(k.plate)return 'Prato pronto! Leve ao passe de madeira, olhe para o chef e aperte E para entregar.';if(k.board)return k.board.hits>=2?'E na tábua para pegar a comida cortada.':'ESPAÇO: dois cortes quando a marca estiver no dourado. Você está usando sua chave de fenda. E cancela o corte.';if(k.held){const a=k.held;if(['meat','lettuce','tomato','potato'].includes(a.kind)&&a.state==='raw')return 'E na tábua para apoiar o ingrediente. Depois faça dois cortes com ESPAÇO e pegue com E.';if(a.kind==='meat'&&a.state==='cut')return 'E no fogão para grelhar. Entre 4 e 8 segundos, E para virar com a chave de fenda; quando estiver no ponto, E para retirar.';if(a.kind==='chicken'&&a.state==='raw'||a.kind==='potato'&&a.state==='cut')return 'E na fritadeira. O frango é empanado ao entrar no cesto. Retire com E quando a barra estiver dourada, entre 10 e 19 segundos.';return 'E na bancada dos pratos para acrescentar este ingrediente. Com a mão vazia, E pega o prato montado. R escolhe um ingrediente da bancada para corrigir.'}if(Object.keys(k.jobs).length)return 'O preparo continua enquanto você anda. Acompanhe as barras de preparo: dourado é o ponto; vermelho é queimado. Volte ao aparelho e retire com E.';if(k.assembly.length)return 'Alface e tomate precisam ser cortados. Carne: cortar, grelhar e virar. Complete os ingredientes da comanda na bancada. Com a mão vazia, E pega o prato. Errou? Use a lixeira para recomeçar.';return ['Treino 1: hambúrguer. Pegue carne na estante; corte, grelhe e vire. Acrescente pão, alface cortada, queijo e tomate cortado ao prato.','Treino 2: batata frita. Pegue batata na estante; corte e frite até o ponto. Monte e entregue ao chef.','Treino 3: frango empanado. Pegue frango; E na fritadeira empana e abaixa o cesto. Retire no dourado, monte e entregue.','Treino 4: salada. Corte alface e tomate. Ponha os dois no prato e entregue.'][k.lesson]}
function chefGuide9(){const hint=tutorialHint9();showCaption('CHEF',hint,6500);lastGuide9=hint}
function pick9(kind){const k=kitchen4;if(k.held||k.plate||k.board?.hits<2){showCaption('CHEF','Uma coisa de cada vez. Deixe a comida na estação ou no prato.',2600);return false}if(['meat','chicken'].includes(kind)&&!k.stocked){showCaption('CHEF','As provisões estão no freezer. Pegue a caixa uma vez e abastecemos a estante.',3500);return false}k.held={id:++k.uid,kind,state:'raw',quality:100};heldPulse9=.5;k.visibleDirty=true;sound4('pickup');return true}
openStation4=function(st){if(st!=='shelf')return interactKitchen4('k4_'+st);if(!['tutorial','orders'].includes(kitchen4.phase)){showCaption('CHEF','Venha conversar comigo primeiro.',1800);return}if(kitchen4.held||kitchen4.plate){showCaption('','Sua mão está ocupada.',1400);return}panelBase4('Estante','Escolha um ingrediente • teclas 1–7 • E / ESC fecha');panel4.classList.add('compact9');const kinds=['bread','lettuce','tomato','cheese','potato',...(kitchen4.stocked?['meat','chicken']:[])];kinds.forEach((kind,i)=>{const b=button4(`${i+1} · ${names4[kind]}`,()=>{if(pick9(kind))closeKitchenPanel4()});const im=new Image();im.src=icon9[kind];im.alt='';b.prepend(im);b.dataset.kind9=kind});};
function startJob9(slot){const k=kitchen4,a=k.held;if(!a)return showCaption('CHEF','Pegue o ingrediente primeiro.',2000);if(slot==='grill'&&!(a.kind==='meat'&&a.state==='cut'))return showCaption('CHEF','O hambúrguer precisa de carne cortada. Use a tábua.',3000);if(slot==='fryer'&&!(a.kind==='chicken'&&a.state==='raw'||a.kind==='potato'&&a.state==='cut'))return showCaption('CHEF','A fritadeira aceita frango cru ou batata cortada.',2600);k.jobs[slot]={...a,elapsed:0,flipped:false,flipTime:0};k.held=null;k.visibleDirty=true;sound4('sizzle');heldPulse9=.4;}
function jobState9(j){return j.elapsed<10?'raw':j.elapsed<19?'cooked':'burnt'}
function useJob9(slot){const k=kitchen4,j=k.jobs[slot];if(!j)return startJob9(slot);if(k.held||k.plate)return showCaption('CHEF','Libere a mão antes de usar o aparelho.',2200);if(slot==='grill'&&!j.flipped&&j.elapsed<19){j.flipped=true;j.flipTime=j.elapsed;playAttack();heldPulse9=.5;sound4('sizzle');showCaption('CHEF',j.elapsed>=4&&j.elapsed<=8?'Isso! Agora espere dourar dos dois lados.':'Virou. Observe o ponto antes de retirar.',2400);k.visibleDirty=true;return}const state=jobState9(j),q=state==='burnt'?0:state==='raw'?Math.max(0,100-(10-j.elapsed)*13):100;k.held={id:j.id,kind:j.kind,state:state==='burnt'?'burnt':state==='raw'?'undercooked':slot==='grill'?'grilled':'fried',quality:Math.max(0,q-(slot==='grill'&&(!j.flipped||j.flipTime<3||j.flipTime>9)?18:0))};delete k.jobs[slot];k.visibleDirty=true;heldPulse9=.5;sound4('plate');if(state==='burnt')showCaption('CHEF','Queimou. Jogue na lixeira; descartar não tira pontos.',3200)}
cutAttempt4=function(){const b=kitchen4.board;if(!b||b.hits>=2||mode!=='world')return;const p=(Math.sin(b.clock*3.2)+1)/2,target=[.5,.32,.67][b.hits],good=Math.abs(p-target)<.15;b.hits++;if(!good)b.item.quality-=5;b.clock=0;b.flash=.25;playAttack();sound4('knife');heldPulse9=.45;if(b.hits===2){b.item.state='cut';kitchen4.visibleDirty=true;showCaption('CHEF','Pronto. E na tábua para pegar.',2000)}};
function useBoard9(){const k=kitchen4;if(k.board){if(k.held||k.plate)return showCaption('','Mão ocupada.',1500);if(k.board.hits<2){k.held=k.board.item;k.board=null;showCaption('','Corte interrompido. Você pode tentar de novo.',2200)}else{k.held=k.board.item;k.board=null;sound4('pickup')}k.visibleDirty=true;return}if(!k.held||!['meat','lettuce','tomato','potato'].includes(k.held.kind)||k.held.state!=='raw')return showCaption('CHEF','Apoie carne, batata, alface ou tomate crus na tábua.',3000);k.board={item:k.held,hits:0,clock:0,flash:0};k.held=null;k.visibleDirty=true;chefGuide9()}
finishPlate4=function(){const k=kitchen4;if(k.held||k.plate)return;if(!k.assembly.length)return showCaption('CHEF','Com um ingrediente na mão, E nesta bancada para colocá-lo no prato.',2800);k.plate={parts:k.assembly.map(a=>({...a}))};k.assemblies[k.bench||0]=[];k.assembly=k.assemblies[k.bench||0];k.visibleDirty=true;heldPulse9=.6;sound4('plate')};
function assembly9(index=0){const k=kitchen4;k.bench=index;k.assembly=k.assemblies[index];if(k.plate){if(k.assembly.length)return showCaption('CHEF','Esta bancada está ocupada. Use a outra para apoiar o prato.',2800);k.assemblies[index]=k.plate.parts;k.assembly=k.assemblies[index];k.plate=null;k.visibleDirty=true;sound4('plate');showCaption('CHEF','Prato apoiado. R escolhe um ingrediente; E pega o prato.',3200);return}if(k.held){if(k.assembly.length>=5)return showCaption('CHEF','O prato está cheio. Descarte a montagem na lixeira se errou.',2600);k.assembly.push(k.held);k.held=null;k.visibleDirty=true;heldPulse9=.35;sound4('plate')}else finishPlate4()}
function discard9(){const k=kitchen4;k.trashAnim=.65;if(k.held)k.held=null;else if(k.plate)k.plate=null;else if(k.assembly.length){k.assemblies[k.bench||0]=[];k.assembly=k.assemblies[k.bench||0]}else return showCaption('','Nada para descartar na mão ou no prato.',1600);k.visibleDirty=true;sound4('water');showCaption('','Descartado — nenhum ponto perdido.',1700)}
function plateScore9(plate,dish){const pool=dish.parts.slice(),errors=[];let extra=0;for(const a of plate.parts){const tag=a.kind+':'+a.state,index=pool.indexOf(tag);if(index>=0)pool.splice(index,1);else{extra++;const required=dish.parts.find(t=>t.split(':')[0]===a.kind);errors.push(required&&a.state==='raw'&&required.endsWith(':cut')?`Corte ${names4[a.kind].toLowerCase()} na tábua.`:a.state==='burnt'?`${names4[a.kind]} queimou; troque este ingrediente.`:a.state==='undercooked'||a.kind==='meat'&&a.state!=='grilled'?`${names4[a.kind]} ainda precisa chegar ao ponto.`:required?`${names4[a.kind]} tem preparo errado.`:`${names4[a.kind]} não entra neste pedido.`)}}for(const tag of pool){const kind=tag.split(':')[0];if(!plate.parts.some(a=>a.kind===kind))errors.push(`Falta ${names4[kind].toLowerCase()}.`)}const bad=plate.parts.some(a=>a.quality<35||a.state==='burnt'),quality=plate.parts.reduce((v,a)=>v+a.quality,0)/Math.max(1,plate.parts.length);return {valid:!pool.length&&!extra&&!bad,quality,missing:pool.length,extra,bad,errors:[...new Set(errors)]}}
function critique10(dish,quality,late=false){const good=[['ESSE PÃO NÃO ATRAPALHA A CARNE. BOM! MANDA OUTRO!','ISSO É HAMBÚRGUER! O RESTO DA VACA TÁ ONDE?!'],['CROCANTE! DEVIA VIR NUM BALDE!','ESSA BATATA PRESTA. MAS ESSA PORÇÃO É PRA FORMIGA?!'],['FRANGO BOM! PODIA TER TRAZIDO O GALINHEIRO TODO!','CROCANTE POR FORA! AGORA ME DÁ MAIS!'],['FOLHA?! HMPF... PELO MENOS TÁ FRESCA.','ISSO NÃO É COMIDA DE GENTE GRANDE... MAS TÁ BOM!']];if(late)return 'ESFRIOU ESPERANDO! EU QUASE COMI A MESA!';if(quality<95)return ['A CARNE PODIA SER MELHOR! EU ACEITO... DESSA VEZ!','TÁ MEIO TORTA ESSA BATATA! MAS EU COMO!','ESSE FRANGO SOFREU! O PRÓXIMO FAZ DIREITO!','CORTOU ISSO COM O QUÊ?! HMPF... PASSA!'][dish];return good[dish][kitchen4.servedCount10%2]}
serve4=function(){const k=kitchen4;if(!k.plate)return; if(k.transfer>0)return showCaption('CHEF','Só um instante, estou levando este. Segure o próximo aí, por favor.',1600);const d=k.phase==='tutorial'?dishes9[k.lesson]:null;let oi=-1,check;if(d)check=plateScore9(k.plate,d);else{oi=k.orders.findIndex(o=>plateScore9(k.plate,dishes9[o.dish]).valid);if(oi>=0)check=plateScore9(k.plate,dishes9[k.orders[oi].dish]);else check=k.orders.map(o=>plateScore9(k.plate,dishes9[o.dish])).sort((a,b)=>(a.missing+a.extra)-(b.missing+b.extra))[0]||{valid:false,errors:['Não há uma comanda para este prato.']}}
 if(!check.valid){k.visibleDirty=true;showCaption('CHEF','Opa, deixa eu conferir. '+(check.errors?.join(' ')||'Confira a qualidade dos ingredientes.')+' Apoie o prato numa bancada vazia; R escolhe um ingrediente para corrigir. Não precisa repetir o treino.',9000);return}
 const dishIndex=d?k.lesson:k.orders[oi].dish;let late=false;if(k.phase==='orders'){const o=k.orders[oi];late=o.left/o.total<.3;const points=Math.round(70+20*check.quality/100+20*o.left/o.total);k.score+=points;k.orders.splice(oi,1);k.orders.push(newOrder9());showCaption('CHEF',`Caprichado! +${points} pontos. Deixa comigo, você já pode preparar o próximo.`,2400)}else showCaption('CHEF','Aí sim! Eu levo. Pode olhar pela janela — ele não costuma usar o guardanapo.',2600);
 k.servedCount10=(k.servedCount10||0)+1;k.comments10=k.comments10||[];k.comments10.push({delay:1.8,text:critique10(dishIndex,check.quality,late)});k.servedPlate=k.plate;k.plate=null;k.transfer=1.1;k.eating=0;k.visibleDirty=true;sound4('plate');heldPulse9=.5;
};
function lessonDone9(){const k=kitchen4;k.lesson++;if(k.lesson<4){chefGuide9();return}k.phase='ready';setObjective('Treino concluído — fale com o chef para começar');saveCheckpoint('chef');startDialogue('chef4',[['CHEF','Olha só! Quatro pratos e todos os dedos no lugar. Já é um excelente começo.'],['CHEF','No expediente você terá cinco minutos para conseguir pelo menos 420 pontos.'],['CHEF','As comandas lembram os ingredientes e o preparo. E tem duas bancadas: pode adiantar um prato enquanto outro doura. Eu faço as entregas.'],['CHEF','Se queimar, lixeira. Ninguém vai cobrar pelo lixo. Melhor uma tentativa nova que um hambúrguer de carvão.'],['CHEF','Ele decide se comeu o suficiente quando o relógio toca. Até lá, respire. E não respire em cima da salada.'],['CHEF','Quando estiver pronto, fale comigo para começar.']],()=>{mode='world'})}
function awardMatches10(){const k=kitchen4;if(inventory.includes('matches'))return;k.matchesUnlocked=true;inventory.push('matches');objects=objects.filter(o=>!o.matches4);renderInventory();sound4('pickup');showCaption('CHEF','Palavra de chef: a caixinha é sua. Setecentos pontos! Meu ajudante antigo não chegava nem perto.',5500);saveCheckpoint('chef')}
function finishShift9(){const k=kitchen4;if(k.phase!=='orders')return;k.left=0;k.phase='result';k.orders=[];k.held=null;k.plate=null;k.assemblies=[[],[]];k.bench=0;k.assembly=k.assemblies[0];k.board=null;k.jobs={};k.transfer=0;k.eating=0;k.comments10=[];panel4.classList.add('hidden');if(mode==='kitchen')mode='world';if(k.score>=k.goal){k.bestScore=Math.max(k.bestScore||0,k.score);k.matchesUnlocked=k.bestScore>=700||inventory.includes('matches');k.phase='reward';const lines=[['BRUTAMONTE','HMPF. TÔ SATISFEITO... POR ENQUANTO.'],['BRUTAMONTE','JÁ JÁ É HORA DE JANTAR DE NOVO. NÃO SOME COM ESSA PANELA!'],['CHEF','Um elogio! Quer dizer... vindo dele, isso conta como elogio.'],['CHEF','Você cozinha melhor que o último. Meu ajudante, digo.'],['CHEF',k.door?'A porta continua aberta. Se quiser fazer hora extra, é só falar comigo.':'Como prometido, vou abrir a sala do quadro. Muito obrigado pela mãozinha.']];if(k.matchesUnlocked&&!inventory.includes('matches'))lines.push(['CHEF','E passou dos setecentos! A caixa de fósforos é sua. Eu prometi, eu cumpro.']);else if(k.challengeAsked)lines.push(['CHEF','A caixa ainda fica comigo. Quer tentar setecentos? Pode fazer hora extra, sem repetir o treino.']);startDialogue('chef4',lines,()=>{k.door=true;k.phase='breaker';colliders=colliders.filter(c=>c.id!=='maintenanceDoor9');spriteOccluders=spriteOccluders.filter(c=>c.id!=='maintenanceDoor9');if(k.matchesUnlocked&&!inventory.includes('matches'))awardMatches10();else saveCheckpoint('chef');k.visibleDirty=true;setObjective(k.power?'Volte para o elevador — ou faça hora extra com o chef':'Ligue o disjuntor — porta à esquerda do freezer')})}else startDialogue('chef4',[['BRUTAMONTE','ISSO NÃO DEU NEM PRO COMEÇO! AINDA TÔ COM FOME!'],['BRUTAMONTE','SE NÃO TEM COMIDA... VOU TER QUE COMER VOCÊ!'],['CHEF','Senhor, calma. Ele só... ah.']],()=>killBrute4())}
function overtime10(){const k=kitchen4;startDialogue('chef4',[['CHEF','Que foi, quer fazer hora extra?'],['CHEF','Cinco minutos, pelo menos 420 pontos. E setecentos valem a caixinha, se ela ainda está comigo. Sem treino desta vez.']],()=>{panelBase4('Hora extra?','Um novo expediente • mínimo 420 pontos • fósforos: 700');panel4.classList.add('compact9');button4('Sim, vamos cozinhar',()=>{closeKitchenPanel4();startShift9();showCaption('CHEF','É disso que eu gosto! Mãos à obra — o cavalheiro já está escolhendo o jantar.',4500)});button4('Não, vou continuar',()=>{closeKitchenPanel4();setObjective(k.power?'Volte para o elevador':'Ligue o disjuntor — porta à esquerda do freezer')})})}
interactKitchen4=function(id){const st=id.slice(3),k=kitchen4;
 if(st==='chef'||st==='serve'&&k.plate){if(k.plate&&['tutorial','orders'].includes(k.phase)){serve4();return}if(k.phase==='arrival'){startDialogue('chef4',[['CHEF','Ei! Você aí! Se trouxe duas mãos, chegou na hora certa.'],['CHEF','Meu ajudante se demitiu no meio do expediente. Sem aviso, sem despedida... e sem lavar a panela.'],['CHEF','Está vendo aquele cavalheiro? Ele está... com fome.'],['BRUTAMONTE','CADÊ MINHA COMIDA?!'],['CHEF','Bastante fome. Precisa do quadro elétrico? Fica atrás da cozinha.'],['CHEF','Me dê uma mãozinha e eu abro a porta pra você. Primeiro vamos treinar, sem relógio. Não sou um carrasco.'],['CHEF','No fundo há um freezer. Pegue a caixa de carne e frango na mesa iluminada em frente à entrada.'],['CHEF','Carne, batata, alface e tomate precisam ser cortados na tábua. Pão e queijo entram como estão. A comanda lembra tudo.'],['CHEF','Sua chave de fenda serve pra cortar e virar a carne. Eu sei, eu sei... a vigilância sanitária não precisa saber.'],['CHEF','Vamos fazer quatro pratos. As comandas mostram o que entra em cada prato, e como preparar. E comigo sempre dá uma dica.']],()=>{k.phase='tutorial';k.lesson=0;setObjective('Treino sem tempo — busque as provisões no freezer');saveCheckpoint('chef');chefGuide9()});return}if(k.phase==='ready'){startShift9();return}if(k.phase==='tutorial'){chefGuide9();return}if(k.phase==='orders'){showCaption('CHEF','Duas comandas, duas bancadas. Pode adiantar um prato enquanto o outro doura. Eu levo os pedidos — você fica com a parte gostosa da confusão.',5000);return}if(k.phase==='breaker'){overtime10();return}showCaption('CHEF','Como prometido. O quadro fica à esquerda do freezer.',3000);return}
 if(st==='freezer'){if(k.held||k.plate)return showCaption('','Libere a mão para abrir a porta pesada.',2000);k.freezerOpen=!k.freezerOpen;if(k.freezerOpen){colliders=colliders.filter(c=>c.id!=='freezerDoor9');spriteOccluders=spriteOccluders.filter(c=>c.id!=='freezerDoor9')}else{if(player.z<-14.4)return (k.freezerOpen=true);solidRect(0,-14,2.45,.2,3.3,false,'freezerDoor9');occluderRect(0,-14,2.45,.2,'freezerDoor9')}sound4('fridge');return}
 if(st==='provisions'){if(!['tutorial','orders','ready'].includes(k.phase))return showCaption('','Caixas de carne e frango. O chef deve saber o que fazer.',2400);if(k.stocked)return showCaption('','As provisões já estão na estante da cozinha.',2400);k.stocked=true;saveCheckpoint('chef');sound4('pickup');k.visibleDirty=true;showCaption('CHEF','Provisões recebidas! Carne e frango agora estão na estante. Comece pelo hambúrguer.',5000);return}
 if(st==='elevator'){if(k.phase==='orders')return showCaption('CHEF','Ainda temos um expediente para terminar, meu amigo.',2500);if(k.power)(loadWeddingAssets5(),rideElevator('4','5',()=>resetFloor5()));else showCaption('','O elevador aguarda a energia do andar.',1800);return}
 if(st==='breaker'){if(!k.door||k.power)return;if(!k.opened){k.opened=true;openBreaker('floor4')}else openWireGame('floor4');return}
 if(st==='photo'){showCaption('','Hotel Bellevue, 1962. Um nome foi riscado: “Auxiliar de cozinha — desligado”.',4300);return}
 if(st==='matches'){if(inventory.includes('matches'))return;if(k.matchesUnlocked)return awardMatches10();k.challengeAsked=true;k.visibleDirty=true;showCaption('CHEF','Você quer isso? Hmmm... Se atingir 700 pontos em um expediente, eu te dou. Palavra de chef! Pra abrir a porta bastam 420. A caixinha exige capricho.',8000);return}
 if(!['tutorial','orders','ready'].includes(k.phase))return showCaption('CHEF','Venha falar comigo antes.',2200);
 if(st==='shelf')return openStation4(st);if(st==='grill'||st==='fryer')return useJob9(st);if(st==='board')return useBoard9();if(st==='assembly'||st==='assembly2')return assembly9(st==='assembly2'?1:0);if(st==='trash')return discard9();if(st==='sink'){k.water=!k.water;sound4('water');return}
};
const interaction9=activeInteraction;activeInteraction=function(){if(scene!=='floor4')return interaction9();if(mode!=='world')return null;const cand=interactables.filter(t=>{if(t.id==='k4_serve'&&!kitchen4.plate)return false;if(t.id==='k4_chef'&&kitchen4.plate)return false;if(t.id==='k4_matches'&&inventory.includes('matches'))return false;if(t.id==='k4_breaker'&&(!kitchen4.door||kitchen4.power))return false;if(t.id==='k4_elevator'&&(!kitchen4.power||kitchen4.phase==='orders'))return false;const dx=t.x-player.x,dz=t.z-player.z,d=Math.hypot(dx,dz),f=forward2();const visible=t.id==='k4_serve'?d<=t.range&&(d<.4||(dx*f[0]+dz*f[1])/d>.52):canSeeTarget(t);return visible&&!spriteOccluders.some(r=>r.id!=='freezerDoor9'&&segmentIntersectsRect(player.x,player.z,t.x,t.z,r))});for(const t of cand)if(t.id==='k4_assembly'||t.id==='k4_assembly2'){const parts=kitchen4.assemblies[t.id==='k4_assembly2'?1:0];t.label=kitchen4.plate?'APOIAR PRATO':kitchen4.held?'ACRESCENTAR AO PRATO':parts.length?'PEGAR PRATO · R RETIRA INGREDIENTE':'MONTAR PRATO'}return cand.sort((a,b)=>Math.hypot(player.x-a.x,player.z-a.z)-Math.hypot(player.x-b.x,player.z-b.z))[0]||null};
// Special failure scene: slam, brief silence, lunge, blackout. No explicit gore.
killBrute4=async function(){if(scene!=='floor4'||mode==='dead')return;const token=++deathToken9;mode='dead';kitchen4.phase='dead';panel4.classList.add('hidden');film4P=null;filmBars4P.classList.add('hidden');hud4.classList.add('hidden');held4P.classList.add('hidden');prep9.classList.add('hidden');ui.hand.classList.add('hidden');for(const key of Object.keys(keys))keys[key]=false;ui.crosshair.classList.add('hidden');ui.controls.classList.add('hidden');if(document.pointerLockElement)document.exitPointerLock();sound4('slam');gazeDisturbance=8;showCaption('','A mesa estala.',600);await new Promise(r=>setTimeout(r,600));if(token!==deathToken9||scene!=='floor4')return;gazeDisturbance=0;await new Promise(r=>setTimeout(r,140));attack4.style.setProperty('--lunge','.65');attack4.classList.remove('hidden');sound4('attack');requestAnimationFrame(()=>attack4.style.setProperty('--lunge','1.15'));await new Promise(r=>setTimeout(r,750));if(token!==deathToken9||scene!=='floor4')return;ui.fade.classList.add('on');attack4.classList.add('hidden');sound4('bite');await new Promise(r=>setTimeout(r,850));if(token!==deathToken9||scene!=='floor4')return;resetKitchen4(true);showCaption('CHEF','Vamos tentar outra vez. Primeiro o treino, sem tempo.',3500);requestLock()};
function plateFoodDraw9(g,parts,x,y,scale=1){const get=kind=>parts.find(a=>a.kind===kind);if(get('bread')&&get('meat')){g.save();g.translate(x,y);g.scale(scale,scale);g.strokeStyle='#58402b';g.lineWidth=1.7;const bottom=g.createLinearGradient(0,14,0,38);bottom.addColorStop(0,'#e3b878');bottom.addColorStop(1,'#9e6b37');g.fillStyle=bottom;g.beginPath();g.moveTo(-70,19);g.quadraticCurveTo(-77,31,-61,37);g.quadraticCurveTo(0,50,64,36);g.quadraticCurveTo(76,29,70,17);g.closePath();g.fill();g.stroke();if(get('lettuce')){g.fillStyle='#75964c';g.beginPath();g.moveTo(-70,10);for(let i=0;i<15;i++)g.lineTo(-70+i*10,8+(i%2)*6);g.lineTo(72,24);for(let i=14;i>=0;i--)g.lineTo(-70+i*10,20+(i%3)*4);g.closePath();g.fill();g.strokeStyle='#46662e';g.stroke()}
 foodDraw9(g,get('meat'),0,5,1.9);if(get('cheese')){g.fillStyle='#e8bd50';g.strokeStyle='#9d742f';g.beginPath();g.moveTo(-69,-6);g.lineTo(37,-15);g.lineTo(70,-2);g.lineTo(49,18);g.lineTo(37,9);g.lineTo(-57,6);g.closePath();g.fill();g.stroke();g.strokeStyle='#ffe4a1';g.beginPath();g.moveTo(-62,-4);g.lineTo(36,-12);g.stroke()}
 if(get('tomato'))foodDraw9(g,get('tomato'),0,-13,1.4);const top=g.createLinearGradient(-15,-64,15,-14);top.addColorStop(0,'#efcd8d');top.addColorStop(.55,'#d5a45e');top.addColorStop(1,'#a9783e');g.fillStyle=top;g.strokeStyle='#75502d';g.beginPath();g.moveTo(-73,-23);g.bezierCurveTo(-70,-48,-35,-64,0,-65);g.bezierCurveTo(38,-63,73,-46,73,-23);g.bezierCurveTo(44,-8,-47,-6,-73,-23);g.closePath();g.fill();g.stroke();g.strokeStyle='#f4d79c';g.beginPath();g.moveTo(-63,-26);g.bezierCurveTo(-60,-42,-40,-51,-22,-55);g.stroke();g.fillStyle='#fbebc4';for(let i=0;i<23;i++){g.save();g.translate(Math.sin(i*4)*56,-33+Math.cos(i*3)*17);g.rotate(i*.7);g.beginPath();g.ellipse(0,0,2.5,.9,0,0,7);g.fill();g.restore()}g.restore();return}
 if(get('lettuce')&&get('tomato')){foodDraw9(g,get('lettuce'),x,y,scale*1.6);foodDraw9(g,get('tomato'),x,y,scale*1.5);return}parts.forEach((a,i)=>foodDraw9(g,a,x+(i-(parts.length-1)/2)*60*scale,y,scale*1.4))}
function drawHeld9(now){const k=kitchen4,a=k.held,p=k.plate;held4P.classList.toggle('hidden',!(a||p)||!['world','paused','inventory'].includes(mode));if(!a&&!p)return;const g=held4P.getContext('2d');g.clearRect(0,0,640,320);g.fillStyle='#272829';g.beginPath();g.moveTo(490,320);g.lineTo(450,227);g.lineTo(557,224);g.lineTo(622,320);g.fill();g.fillStyle='#cba787';g.beginPath();g.ellipse(462,226,55,24,-.13,0,7);g.fill();if(p){g.fillStyle='#d9d1b9';g.beginPath();g.ellipse(320,190,220,85,-.06,0,7);g.fill();g.strokeStyle='#a48b59';g.lineWidth=3;g.stroke();g.fillStyle='#ece7d4';g.beginPath();g.ellipse(320,185,174,59,-.06,0,7);g.fill();g.strokeStyle='#bdb59e';g.lineWidth=1;g.stroke();plateFoodDraw9(g,p.parts,320,182,1.25)}else foodDraw9(g,a,360,209,2.1);held4P.style.transform=`translateY(${Math.sin(player.bob)*3-heldPulse9*10}px)`}
function paintHud9(now){const k=kitchen4,tutorial=k.phase==='tutorial';const orders=tutorial?[{id:0,dish:[0,1,2,3][k.lesson],left:0,total:1}]:k.orders;const panels=orders.map(o=>{const d=dishes9[o.dish];return `<article class="ticket9"><b>${d.name}</b><div>${d.icons.map(kind=>`<span><img src="${icon9[kind]}" alt=""><small>${names4[kind]}</small><em>${kind==='meat'?'cortar → grelhar':kind==='chicken'?'fritar':kind==='potato'?'cortar → fritar':['lettuce','tomato'].includes(kind)?'cortar':'pronto'}</em></span>`).join('')}</div>${tutorial?'':`<meter min="0" max="${o.total}" value="${Math.max(0,o.left)}"></meter>`}</article>`}).join('');const html=`<div class="shift9"><b>${tutorial?'TREINO · SEM TEMPO':k.phase==='orders'?`${Math.floor(k.left/60)}:${String(Math.floor(k.left%60)).padStart(2,'0')} · ${k.score} / ${k.goal} PONTOS${k.challengeAsked?' · FÓSFOROS 700':''}`:k.phase==='ready'?'PRONTO PARA COMEÇAR':k.door?'EXPEDIENTE ENCERRADO':'BELLEVUE'}</b>${k.phase==='orders'?'<small>Meta ao fim do expediente · descarte sem multa</small>':''}</div><div class="tickets9">${panels}</div>`;
 if(hud4.dataset.lastHtml!==html){hud4.innerHTML=html;hud4.dataset.lastHtml=html}hud4.classList.toggle('hidden',k.phase==='arrival'||!['world','paused','kitchen'].includes(mode));const board=k.board;const jobs=Object.entries(k.jobs);let guide=tutorial?tutorialHint9():'';if(guide&&!ui.caption.classList.contains('hidden')&&ui.captionText.textContent===guide)guide='';prep9.classList.toggle('hidden',!['world','paused','kitchen'].includes(mode)||!(guide||board||jobs.length));const progress=board&&board.hits<2?`<div class="cut9"><i style="left:${([.5,.32,.67][board.hits]-.15)*100}%;width:30%"></i><b style="left:${(Math.sin(board.clock*3.2)+1)*50}%"></b></div><small>ESPAÇO · corte ${board.hits+1}/2 · E na tábua cancela</small>`:'';prep9.innerHTML=`${jobs.map(([s,j])=>`<div class="job9"><span>${s==='grill'?'FOGÃO':'FRITADEIRA'} · ${names4[j.kind]} · ${jobState9(j)==='burnt'?'QUEIMADO':jobState9(j)==='cooked'?'NO PONTO':s==='grill'&&!j.flipped?'VIRE COM E':'PREPARANDO'}</span><div><i style="width:${Math.min(100,j.elapsed/23*100)}%;background:${j.elapsed>=19?'#a54d3a':j.elapsed>=10?'#c6ae67':'#769b8c'}"></i><b></b></div></div>`).join('')}${progress}${guide?`<p>${guide}</p>`:''}`}
function foodMesh9(a,x,y,z,size=1){const burnt=a.state==='burnt',raw=['raw','cut','undercooked'].includes(a.state),cut=a.state==='cut',white=[1,1,1];const part=(dx,dy,dz,w,h,d,tex,tint=white,geo='organic10',rot=0)=>box(x+dx*size,y+dy*size,z+dz*size,w*size,h*size,d*size,tex,burnt?[.18,.15,.12]:tint,[1,1],{geometry:geo,rotY:rot,dynamic9:true});
 if(a.kind==='lettuce'){for(let i=0;i<(cut?7:4);i++){const t=i*2.4;part(Math.sin(t)*.11,i*.006,Math.cos(t)*.075,cut?.15:.29,.2,cut?.12:.23,'leaf10',i%2?[.8,1,.7]:[1,1,1],'leaf10',t)}part(0,0,0,.1,.02,.04,'white',[.68,.8,.48],'leaf10')}
 if(a.kind==='tomato'){if(cut){for(let q=0;q<3;q++){const dx=(q-1)*.10,dz=(q%2)*.08;part(dx,q*.008,dz,.21,.026,.18,'white',[.8,.17,.10]);part(dx,.017+q*.008,dz,.17,.015,.145,'white',[1,.42,.25]);part(dx,.025+q*.008,dz,.12,.01,.10,'white',[.74,.16,.09]);for(let i=0;i<6;i++)part(dx+Math.cos(i)*.052,.032+q*.008,dz+Math.sin(i)*.04,.012,.005,.008,'white',[1,.81,.47])}}else{part(0,.08,0,.27,.22,.26,'white',[.85,.22,.13]);for(let i=0;i<5;i++)part(Math.cos(i*1.256)*.025,.195,Math.sin(i*1.256)*.025,.09,.05,.035,'leaf10',white,'leaf10',i*1.256)}}
 if(a.kind==='bread'){part(0,.055,0,.36,.15,.31,'bun10');part(0,.008,0,.33,.045,.29,'bun10',[.76,.68,.58]);for(let i=0;i<12;i++){const dx=Math.sin(i*7)*.13,dz=Math.cos(i*4)*.11;part(dx,.105+Math.sqrt(Math.max(0,1-dx*dx/.025-dz*dz/.018))*.025,dz,.018,.007,.008,'white',[1,.88,.64],'organic10',i)}}
 if(a.kind==='cheese'){part(0,0,0,.32,.008,.27,'white',[.96,.75,.32],null,.2);part(.145,-.006,.10,.07,.017,.06,'white',[.88,.64,.25],null,.3)}
 if(a.kind==='meat'){part(0,.015,0,cut||!raw?.35:.45,.085,cut||!raw?.30:.25,raw?'beef10':'sear10');if(!raw)for(let i=-1;i<=1;i++)part(i*.075,.054,0,.012,.004,.23,'white',[.21,.14,.09],null,.3)}
 if(a.kind==='chicken'){for(let i=0;i<2;i++)part((i-.5)*.15,i*.025,0,.20,.115,.32,raw?'beef10':'crumb10',raw?[1.18,1.4,1.2]:white,'organic10',i?.32:-.23)}
 if(a.kind==='potato'){if(cut||!raw){for(let i=0;i<9;i++)part((i%4-1.5)*.055,Math.floor(i/4)*.018,(i%2)*.04,.033,.03,.22,'white',cut?[.95,.82,.57]:[.92,.68,.28],null,(i-4)*.1)}else{part(0,.04,0,.3,.15,.21,'bun10',[.85,.84,.81]);for(let i=0;i<5;i++)part(Math.sin(i)*.105,.109,Math.cos(i)*.06,.011,.005,.008,'white',[.42,.30,.17])}}
}
function plateMesh10(parts,x,y,z){if(!parts.length)return;const has=kind=>parts.find(a=>a.kind===kind);if(has('bread')&&has('meat')){foodMesh9(has('bread'),x,y,z,1.3);if(has('lettuce'))foodMesh9(has('lettuce'),x,y+.10,z,1.25);foodMesh9(has('meat'),x,y+.16,z,1.3);if(has('cheese'))foodMesh9(has('cheese'),x,y+.23,z,1.3);if(has('tomato'))foodMesh9(has('tomato'),x,y+.25,z,1.1);foodMesh9(has('bread'),x,y+.31,z,1.3);return}if(has('lettuce')&&has('tomato')){foodMesh9(has('lettuce'),x,y,z,1.65);foodMesh9(has('tomato'),x,y+.05,z,1.5);return}parts.forEach((a,i)=>foodMesh9(a,x+(i-(parts.length-1)/2)*.17,y+Math.floor(i/3)*.05,z,1.65))}
function dynamicProps9(now){const k=kitchen4;objects=objects.filter(o=>!o.dynamic9);for(const x of [-.48,.48])foodMesh9({kind:x<0?'meat':'chicken',state:'raw'},x,1.30,-19.97,1.4);for(const [i,kind]of ['bread','lettuce','tomato','cheese','potato',...(k.stocked?['meat','chicken']:[])].entries())foodMesh9({kind,state:'raw'},5.95,.45+Math.floor(i/2)*.53,-11.8+(i%2?-.47:.47),.95);
 if(k.board){const b=k.board;foodMesh9(b.item,-2.35,1.12,-12.7,2);if(b.flash>0)box(-2.35,1.30+b.flash,-12.7,.05,.12,.65,'steel4P',[1.4,1.1,.8],[1,1],{dynamic9:true,rotY:.7})}
 for(const [s,j]of Object.entries(k.jobs)){const x=-4.2,z=s==='grill'?-10.0:-12.4;foodMesh9({...j,state:jobState9(j)==='cooked'?(s==='grill'?'grilled':'fried'):jobState9(j)==='raw'&&s==='grill'?'cut':jobState9(j)},x,1.16+Math.sin(j.elapsed*11)*.007,z,2.2);for(let i=0;i<7;i++){const p=(now*.00055+i*.16)%1;box(x+Math.sin(i*4)*.38,1.25+p*.6,z+Math.cos(i*3)*.3,.018,.12*(1-p),.018,'white',[.6,.65,.6],[1,1],{dynamic9:true})}if(s==='fryer')for(let i=0;i<8;i++)box(x+Math.sin(i*2)*.42,1.10+Math.sin(now*.012+i)*.012,z+Math.cos(i*2)*.27,.03,.03,.03,'brass',[1.1,.9,.35],[1,1],{geometry:'round',dynamic9:true})}
 for(let bi=0;bi<2;bi++){const x=bi===0?2:-.4;box(x,1.04,-9.15,.88,.035,.68,'ceramic4P',[1,1,1],[1,1],{geometry:'round',dynamic9:true});plateMesh10(k.assemblies[bi],x,1.10,-9.15)}if(k.water)for(let i=0;i<8;i++)box(3.2,1.1+i*.04,-12.79,.015,.035,.018,'white',[.57,.75,.89],[1,1],{dynamic9:true});
 if(k.transfer>0){const p=1-k.transfer/1.1;box(5*(1-p),1.12,-8+2.25*p,.85,.04,.6,'ceramic4P',[1,1,1],[1,1],{geometry:'round',dynamic9:true});plateMesh10(k.servedPlate?.parts||[],5*(1-p),1.19,-8+2.25*p)}if(k.eating>0)for(let i=0;i<3;i++)box((i-1)*.65,.89,-5.5,.5,.025,.45,'ceramic4P',[1,1,1],[1,1],{geometry:'round',dynamic9:true});
 for(const o of objects){if(o.freezerHandle9){const a=k.freezerAnim||0;o.x=-1.2+2.1*Math.cos(a)+.17*Math.sin(a);o.z=-14.04-2.1*Math.sin(a)+.17*Math.cos(a);o.rotY=a}if(o.trashLid9)o.y=.81+(k.trashAnim||0)*.5;if(o.freezerDoor9){o.x=-1.2+1.2*Math.cos(k.freezerAnim||0);o.z=-14.04-1.2*Math.sin(k.freezerAnim||0);o.rotY=k.freezerAnim||0}if(o.maintenanceDoor9){o.x=-6.5+.85*Math.cos((k.doorOpen||0)*Math.PI/2);o.z=-14+.85*Math.sin((k.doorOpen||0)*Math.PI/2);o.rotY=-(k.doorOpen||0)*Math.PI/2}}
}
function snowPaint9(now){const inside=player.z<-14.4&&(player.z<-18||Math.abs(player.x)<3.5);snow9.classList.toggle('hidden',!inside||!['world','paused'].includes(mode));if(!inside)return;const g=snow9.getContext('2d');g.clearRect(0,0,800,500);for(let i=0;i<240;i++){const y=(i*79+now*.035*(.6+i%3))%500,x=(i*97+Math.sin(now*.0006+i)*24)%800;g.fillStyle=i%3?'#d3e7eb65':'#ffffffa0';g.beginPath();g.arc(x,y,1+i%3*.5,0,7);g.fill()}}
updateKitchen4=function(dt,now){if(scene!=='floor4'){hud4.classList.add('hidden');held4P.classList.add('hidden');prep9.classList.add('hidden');snow9.classList.add('hidden');return}const k=kitchen4,running=['world','kitchen'].includes(mode);if(running){propClock9+=dt;k.trashAnim=Math.max(0,(k.trashAnim||0)-dt);heldPulse9=Math.max(0,heldPulse9-dt);k.freezerAnim=lerp(k.freezerAnim||0,k.freezerOpen?1.45:0,1-Math.exp(-dt*6));k.doorOpen=lerp(k.doorOpen||0,k.door?1:0,1-Math.exp(-dt*5));if(k.board){if(Math.hypot(player.x+2.35,player.z+12.7)<2.3)k.board.clock+=dt;k.board.flash=Math.max(0,(k.board.flash||0)-dt)}for(const j of Object.values(k.jobs))j.elapsed+=dt;
 if(k.transfer>0){k.transfer=Math.max(0,k.transfer-dt);if(!k.transfer){k.eating=2.4;sound4('chew')}}else if(k.eating>0){k.eating=Math.max(0,k.eating-dt);if(!k.eating&&k.phase==='tutorial')lessonDone9()}
 if(k.phase==='orders'){k.left=Math.max(0,k.left-dt);for(const o of k.orders)o.left-=dt;for(let i=k.orders.length-1;i>=0;i--)if(k.orders[i].left<=0){k.orders.splice(i,1);k.orders.push(newOrder9());k.angryUntil=now+1600;sound4('slam');showCaption('CHEF','Esse pedido passou. Faça o próximo; você ainda pode atingir a meta.',2800)}if(k.left<=0)finishShift9();else if(k.left<30&&now>(k.tickAt||0)){k.tickAt=now+1000;sound4('tick')}}
 if(k.phase==='tutorial'&&ui.caption.classList.contains('hidden')&&Math.hypot(player.x-5,player.z+9.2)<5){const hint=tutorialHint9();if(hint!==lastGuide9){lastGuide9=hint;showCaption('CHEF',hint,4800)}}if(k.comments10?.length){for(const c of k.comments10)c.delay-=dt;if(k.comments10[0].delay<=0){showCaption('BRUTAMONTE',k.comments10.shift().text,3800)}}if(k.phase==='arrival'&&!k.called&&player.z<-2){k.called=true;showCaption('CHEF','Ei! Você aí! Finalmente alguém.',2600)}
 if(['tutorial','orders'].includes(k.phase)){k.chatter-=dt;if(k.chatter<=0){k.chatter=22;sound4('grunt');k.angryUntil=now+1400;showCaption(k.phase==='tutorial'?'CHEF':'BRUTAMONTE',k.phase==='tutorial'?'Sem pressa. O treino não tem tempo.':'VOCÊ TÁ COZINHANDO OU PLANTANDO A COMIDA?!',2500)}}if(Object.keys(k.jobs).length&&now>(k.soundAt||0)){k.soundAt=now+1100;sound4('sizzle')}}
 if(mode==='dead')return;ui.hand.classList.toggle('hidden',!!k.held||!!k.plate||mode==='dialogue');drawHeld9(now);k.hudClock9=(k.hudClock9||0)+dt;if(k.visibleDirty||k.hudClock9>=.1){paintHud9(now);k.hudClock9=0;k.visibleDirty=false}dynamicProps9(now);snowPaint9(now);
 const chef=sprites.find(s=>s.id==='chef4');if(chef)chef.rotY=0;const brute=sprites.find(s=>s.id==='brute4');if(brute)brute.h=1.78+(k.eating>0?Math.sin(propClock9*18)*.022:0);
};
const scene9=setScene;setScene=function(name){scene9(name);if(name!=='floor4'){prep9.classList.add('hidden');snow9.classList.add('hidden');held4P.classList.add('hidden');panel4.classList.add('hidden');filmBars4P.classList.add('hidden')}};
sound4=function(kind){if(!sfx.ctx||!audioBuffers4[kind])return;const src=sfx.ctx.createBufferSource();src.buffer=audioBuffers4[kind];const gain=sfx.ctx.createGain();let volume=['slam','attack'].includes(kind)?.7:['sizzle','simmer'].includes(kind)?.15:.36;const pos={sizzle:[-4.2,-11.4],knife:[-2.35,-12.7],fridge:[0,-14],slam:[0,-5.75],grunt:[0,-6.2],chew:[0,-6.2],water:[2.9,-12.7],plate:[3,-9]}[kind];if(pos){const dx=pos[0]-player.x,dz=pos[1]-player.z,dist=Math.hypot(dx,dz);volume*=clamp(1-dist/22,.3,1);if(sfx.ctx.createStereoPanner){const pan=sfx.ctx.createStereoPanner();pan.pan.value=clamp((dx*Math.cos(player.yaw)+dz*Math.sin(player.yaw))/Math.max(2,dist),-.85,.85);src.connect(pan);pan.connect(gain)}else src.connect(gain)}else src.connect(gain);gain.gain.value=volume;gain.connect(sfx.master);src.start()};
// All shortcuts are scoped to the restaurant. Existing movement/inventory stay intact.
window.addEventListener('keydown',e=>{if(scene!=='floor4'||e.repeat)return;if(e.code==='KeyE'&&mode==='world'){e.preventDefault();e.stopImmediatePropagation();interact();return}if(mode==='kitchen'&&/^Digit[1-7]$/.test(e.code)){e.preventDefault();e.stopImmediatePropagation();panel4.querySelectorAll('.kbody button')[Number(e.code.slice(-1))-1]?.click();return}if(mode==='world'&&e.code==='Space'&&kitchen4.board&&kitchen4.board.hits<2&&Math.hypot(player.x+2.35,player.z+12.7)<2.3){e.preventDefault();e.stopImmediatePropagation();cutAttempt4()}},true);
const closePanel9=closeKitchenPanel4;closeKitchenPanel4=function(){closePanel9();panel4.classList.remove('compact9')};


const caption10=showCaption;showCaption=function(speaker,text,duration){caption10(speaker,text,duration);if(scene==='floor4'&&speaker==='CHEF'){kitchen4.chefPose=kitchen4.chefPose===1?2:1;kitchen4.chefTalkUntil=performance.now()+(duration||3000)}if(scene==='floor4'&&speaker==='BRUTAMONTE')kitchen4.angryUntil=performance.now()+(duration||3000)};
function removePart10(index,partIndex=-1){const k=kitchen4;if(k.held||k.plate)return showCaption('CHEF','Libere a mão para retirar um ingrediente.',2200);k.bench=index;k.assembly=k.assemblies[index];if(!k.assembly.length)return;k.held=k.assembly.splice(partIndex<0?k.assembly.length-1:partIndex,1)[0];heldPulse9=.5;k.visibleDirty=true;sound4('pickup')}
function correctPlate10(index){const k=kitchen4;if(k.held||k.plate)return showCaption('CHEF','Apoie o prato e libere a mão primeiro.',2500);const parts=k.assemblies[index];if(parts.length<=1)return removePart10(index);panelBase4('Corrigir o prato','Escolha só o ingrediente que quer retirar. O resto fica na bancada.');panel4.classList.add('compact9');parts.forEach((a,i)=>button4(names4[a.kind]+' · '+(['bread','cheese'].includes(a.kind)?'pronto':({raw:'cru',cut:'cortado',grilled:'grelhado',fried:'frito',burnt:'queimado',undercooked:'mal cozido'}[a.state]||a.state)),()=>{removePart10(index,i);closeKitchenPanel4()}))}
window.addEventListener('keydown',e=>{if(scene==='floor4'&&mode==='world'&&e.code==='KeyR'&&!e.repeat){const t=activeInteraction();if(t?.id==='k4_assembly'||t?.id==='k4_assembly2'){e.preventDefault();e.stopImmediatePropagation();correctPlate10(t.id==='k4_assembly2'?1:0)}}},true);

// v0.11 — The wedding: isolated investigation, equipment and spectral systems.
const F5_NPCS={
 bride:{name:'NOIVA',x:0,z:-33.2,h:1.7,tex:'bride5',spawn:[0,-30.5],note:'A noiva lembra o apagão e os gritos perto do altar. A irmã, o padre e o coroinha sobreviveram. Ela não partirá sem o marido.',lines:[['NOIVA','Você... consegue me ver? Eu estava aqui. Esperando que ele lembrasse os votos.'],['NOIVA','Trocaram minhas flores. Minha irmã perdeu um sapato. O padre queria começar, e a banda ainda afinava os instrumentos. Um casamento perfeitamente normal.'],['NOIVA','Então as luzes se apagaram. Ouvi gritos. Quando consegui olhar de novo... ninguém se movia.'],['NOIVA','Minha irmã escapou. O padre também. E o rapaz que ajudava na cerimônia, o coroinha.'],['NOIVA','Meu marido não voltou. Não vou deixá-lo aqui sozinho. Você pode procurar por ele?'],['NOIVA','Há outras pessoas presas a esta noite. Procure junto da banda, das mesas, do bufê e da cozinha. Talvez tenham visto o que eu não vi.']]},
 music:{name:'MUSICISTA',x:-7.8,z:-23.5,h:2.1,tex:'music5',spawn:[-7.8,-21.8],note:'O padre insistiu em guardar os equipamentos da banda na sala elétrica, úmida e apertada, embora houvesse uma despensa melhor. O coroinha circulava pela área. O primeiro grito veio do altar.',lines:[['MUSICISTA','Meu primeiro contrato de verdade. A carreira inteira durou uma música e meia. Não recomendo.'],['MUSICISTA','Antes da cerimônia, o padre mandou guardar nossas caixas e os cabos na sala do quadro elétrico. Pelo corredor dos fundos.'],['MUSICISTA','Um buraco úmido, sem espaço. Havia uma despensa vazia! Nós discutimos, mas ele insistiu.'],['MUSICISTA','O coroinha passava por ali o tempo todo. Não sei se ajudava ou se conferia alguma coisa.'],['MUSICISTA','As luzes caíram. O primeiro grito veio do altar. Depois... não consegui identificar quem estava correndo.'],['MUSICISTA','Um dia eu ainda termino aquela música. Nem que a plateia continue morta.']]},
 cousin:{name:'PRIMA DA NOIVA',x:8.7,z:-14,h:2.05,tex:'cousin5',spawn:[8.7,-15.8],note:'A prima conversou com o coroinha. Ele recusou a sala elétrica com um “lá não”, ficou nervoso e consultou o relógio. Ela ouviu alguém correndo durante o apagão.',lines:[['PRIMA DA NOIVA','Eu tinha treinado para pegar o buquê. Cotovelo pronto, concorrência estudada. E olha como terminou.'],['PRIMA DA NOIVA','O coroinha era bonitinho. Fui conversar com ele, sabe? Sem testemunhas demais.'],['PRIMA DA NOIVA','Sugeri aquela sala do quadro elétrico, nos fundos. Ele disse “lá não”. Bem depressa. Ficou nervoso.'],['PRIMA DA NOIVA','Logo depois olhou para o relógio. Já não prestava atenção em mim. Parecia esperar a hora de alguma coisa.'],['PRIMA DA NOIVA','Quando ficou escuro, ouvi passos correndo. Não vi de quem eram. Não tive tempo.'],['PRIMA DA NOIVA','Se achar meu buquê algum dia... eu ainda quero vencer aquela disputa.']]},
 brother:{name:'IRMÃO DO NOIVO',x:8.7,z:-32.8,h:2.1,tex:'brother5',spawn:[8.7,-30.4],note:'O irmão estava ao lado do noivo. O noivo caiu sobre ele poucos segundos após o apagão; depois ele também morreu. O ataque começou no altar quase imediatamente.',lines:[['IRMÃO DO NOIVO','Décadas esperando esse bufê. Eu nem tenho estômago mais e continuo com fome. Isso devia ser ilegal.'],['IRMÃO DO NOIVO','Eu era o padrinho. Fiquei ao lado do meu irmão, no altar. Ele estava tão nervoso que quase esqueceu meu nome.'],['IRMÃO DO NOIVO','As luzes apagaram e, em poucos segundos, ele caiu sobre mim. Eu tentei segurá-lo.'],['IRMÃO DO NOIVO','Logo depois foi a minha vez. Não vi quem nos atacou. Foi rápido demais.'],['IRMÃO DO NOIVO','Se encontrar um espírito furioso com a roupa do noivo... é ele. Ficou preso àquela noite.'],['IRMÃO DO NOIVO','Você trabalha no restaurante? Não? Pena. Eu já tinha uma encomenda muito grande.']]},
 chef:{name:'COZINHEIRO',x:17.1,z:-16.2,h:2.1,tex:'chef5',spawn:[16,-14.8],note:'O cozinheiro viu o padre discutir com a banda sobre a sala elétrica, apesar da despensa livre. O padre consultava o relógio. Depois do apagão houve gritos, passos e cadeiras arrastadas.',lines:[['COZINHEIRO','Bem-vindo. Eu recomendaria o frango, mas já passou um pouquinho do ponto. Uns bons anos.'],['COZINHEIRO','Eu vinha do restaurante lá de baixo. Naquela noite fiquei responsável pelo bufê.'],['COZINHEIRO','Vi o padre discutir com os músicos. Ele queria tudo na sala elétrica, mesmo com nossa despensa livre. E não parava de olhar o relógio.'],['COZINHEIRO','Quando faltou luz, ouvi gritos, gente correndo, cadeiras arrastadas. Não vi o rosto de quem me matou.'],['COZINHEIRO','Deixei um menino pequeno. Mal alcançava o balcão... gostava de ficar na cozinha comigo. Espero que tenha crescido bem.'],['COZINHEIRO','Se um dia descobrir como ele está, volte para me contar. Não preciso de receita. Só de notícia.']]},
 echo:{name:'CONVIDADA',x:-17,z:-23.5,h:1.9,tex:'cousin5',spawn:[-16,-21.5],note:'Uma convidada ainda procura sua bolsa no camarim.',lines:[['CONVIDADA','Deixei minha bolsa aqui. Só vim buscar antes da última dança.'],['CONVIDADA','Você acha que já está tarde? Minha família deve estar me esperando.']]},
 porter:{name:'AJUDANTE',x:-17,z:-12.5,h:1.9,tex:'chef5',spawn:[-16,-11],note:'Um ajudante lembra uma bandeja caída.',lines:[['AJUDANTE','Eu derrubei uma bandeja. Ninguém brigou comigo.'],['AJUDANTE','Depois do grito, isso deixou de ter importância.']]}
};
let wedding5={},cameraOwned5=false,equipped5='screwdriver',flashLeft5=0,photoLeft5=0,cameraPulse5=0,deathBusy5=false,coupleTime5=0,lastVoice5=0;
const freshWedding5=()=>({revealed:[],heard:[],purged:[],groomSeen:false,cleared:false,power:false,opened:false,spawn:[0,1.4],yaw:0,checkpointNpc:null,witchStage:0});
const mainIds5=['bride','music','cousin','brother','chef'];
const hostileDefs5=[{id:'h0',x:-9.6,z:-7},{id:'h1',x:-17,z:-33},{id:'h2',x:17,z:-33.5},{id:'h3',x:-13,z:-40.5}];let enemies5=[];
const equipment5=document.createElement('div');equipment5.id='equipment5';equipment5.className='equipment5 hidden';equipment5.innerHTML='<button data-eq="screwdriver"><img src="assets/screwdriver_item.png" alt=""/><b>1</b></button><button data-eq="camera"><img src="assets/camera5_0.png" alt=""/><b>2</b><i></i></button><small>SCROLL · EQUIPAMENTO</small>';document.querySelector('#gameShell').append(equipment5);
const heldCamera5=document.createElement('div');heldCamera5.className='heldCamera5 hidden';heldCamera5.innerHTML='<img src="assets/camera5_1.png" alt="Câmera em mãos"/><div class="cameraScreen5"><span>◻</span><small>FOTOGRAFAR · DIREITO<br>FLASH · ESQUERDO</small></div>';document.querySelector('#gameShell').append(heldCamera5);
const photoFx5=document.createElement('div');photoFx5.className='photoFx5';document.querySelector('#gameShell').append(photoFx5);
const photographImage5=document.createElement('img');photographImage5.className='photographImage5 hidden';document.querySelector('#gameShell').append(photographImage5);
const spectral5=document.createElement('canvas');spectral5.width=1000;spectral5.height=700;spectral5.className='spectral5 hidden';document.querySelector('#gameShell').append(spectral5);
const notebook5=document.createElement('section');notebook5.className='notebook5 hidden';document.querySelector('#gameShell').append(notebook5);
const deduction5=document.createElement('section');deduction5.className='deduction5 hidden';document.querySelector('#gameShell').append(deduction5);
const jump5=document.createElement('img');jump5.className='jump5 hidden';jump5.alt='';document.querySelector('#gameShell').append(jump5);
const letterbox5=document.createElement('div');letterbox5.className='letterbox5 hidden';document.querySelector('#gameShell').append(letterbox5);
const investigationHint5=document.createElement('div');investigationHint5.className='investigationHint5 hidden';document.querySelector('#gameShell').append(investigationHint5);
let spritesPromise5=null;function loadWeddingAssets5(){if(spritesPromise5)return spritesPromise5;spritesPromise5=Promise.all(Object.entries(window.PREDIO_WEDDING_SPRITES||{}).map(([n,src])=>new Promise(resolve=>{const im=new Image();imgs[n]=im;im.onload=()=>{spriteTex[n]=textureFromImage(im);if(n==='book12_0')textures.bookCover12=spriteTex[n];resolve(true)};im.onerror=()=>resolve(false);im.src=src})));return spritesPromise5}
const audio5={};let audioLoading5=null,ambSource5=null;
async function initAudio5(){if(!sfx.ctx)return;if(audioLoading5)return audioLoading5;audioLoading5=Promise.all(Object.entries(window.PREDIO_WEDDING_AUDIO||{}).map(async([n,src])=>{const bytes=await (await fetch(src)).arrayBuffer();audio5[n]=await sfx.ctx.decodeAudioData(bytes)}));return audioLoading5}
function sound5(kind,volume=.4,rate=1,pos=null){if(!sfx.ctx)return;initAudio5();const buffer=audio5[kind];if(!buffer)return;const src=sfx.ctx.createBufferSource(),gain=sfx.ctx.createGain();src.buffer=buffer;src.playbackRate.value=rate;if(pos){const dx=pos[0]-player.x,dz=pos[1]-player.z,d=Math.hypot(dx,dz);volume/=1+.06*d*d;const pan=sfx.ctx.createStereoPanner();pan.pan.value=clamp((dx*Math.cos(player.yaw)+dz*Math.sin(player.yaw))/Math.max(1,d),-.85,.85);gain.connect(pan);pan.connect(sfx.master)}else gain.connect(sfx.master);gain.gain.value=volume;src.connect(gain);src.start();return src}
function equip5(kind){if(!cameraOwned5&&kind==='camera')return;if(scene==='floor4'&&(kitchen4.held||kitchen4.plate))return;equipped5=kind;equipmentPaint5();if(scene==='floor5'&&kind==='camera')showCaption('','BOTÃO DIREITO: FOTO · ESQUERDO: FLASH · J: CADERNO',2600)}
function equipmentPaint5(){const visible=cameraOwned5&&['world','paused'].includes(mode);if(cameraOwned5){ui.itemHud.classList.add('hidden');ui.hand.classList.toggle('hidden',equipped5==='camera'||['dialogue','cinematic5','notebook5','deduction5','inventory','dead','ending'].includes(mode))}equipment5.classList.toggle('hidden',!visible);heldCamera5.classList.toggle('hidden',!visible||equipped5!=='camera'||!['world','paused'].includes(mode));if(visible){ui.itemHud.classList.add('hidden');ui.hand.classList.toggle('hidden',equipped5==='camera'||mode==='dialogue'||mode==='cinematic5');equipment5.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.eq===equipped5));equipment5.querySelector('i').style.transform=`scaleX(${clamp(1-flashLeft5/3.8,0,1)})`;heldCamera5.style.transform=`translateY(${Math.sin(player.bob)*player.bobAmt*150+cameraPulse5*24}px) rotate(${Math.sin(player.bob*.5)*player.bobAmt*8}deg)`}}
const oldBlip5=sfx.blip.bind(sfx);sfx.blip=function(kind){if(scene==='floor5'&&kind?.startsWith('ghost5')){const now=performance.now();if(now-lastVoice5>160){lastVoice5=now;const id=kind.split(':')[1];sound5('voice',.06,id==='bride'||id==='cousin'?1.5:id==='brother'?.7:1)}return}oldBlip5(kind)};
function wall5(x,z,w,d,h=6,tex='gothic5'){box(x,h/2,z,w,h,d,tex,[1,1,1],[Math.max(w,d)/2,h/3]);solidRect(x,z,w,d,h,false,'wall5');occluderRect(x,z,w,d,'wall5');for(const [y,t]of[[.15,.3],[1.1,.06],[h-.15,.18]])box(x,y,z,w+.04,t,d+.04,'darkwood',[.85,.7,.65]);}
function portalWall5(axis,constant,min,max,doors,h=6){let last=min;for(const [center,width]of [...doors].sort((a,b)=>a[0]-b[0])){const a=center-width/2,b=center+width/2;if(a>last){const mid=(last+a)/2;if(axis==='x')wall5(constant,mid,.26,a-last,h);else wall5(mid,constant,a-last,.26,h)}if(axis==='x'){box(constant,3.05,center,.3,.3,width+.15,'darkwood',[1.2,1,.8]);box(constant,(h+3.2)/2,center,.26,h-3.2,width,'gothic5');solidRect(constant,center,.26,width, h,false,'lintel5');colliders.pop()}else box(center,(h+3.2)/2,constant,width,h-3.2,.26,'gothic5');last=b;}if(last<max){const mid=(last+max)/2;if(axis==='x')wall5(constant,mid,.26,max-last,h);else wall5(mid,constant,max-last,.26,h)}}
function prop5(x,y,z,w,h,d,tex='darkwood',tint=[1,1,1],shape){box(x,y,z,w,h,d,tex,tint,[1,1],shape?{geometry:shape}:{});solidRect(x,z,w,d,y+h/2,false,'furniture5')}
function chair5(x,z,angle=0){box(x,.47,z,.58,.12,.56,'darkwood');box(x,.96,z+.24,.6,.86,.09,'darkwood');box(x,.96,z+.18,.46,.55,.06,'wine4');for(const dx of[-.22,.22])for(const dz of[-.2,.2])box(x+dx,.23,z+dz,.05,.46,.05,'darkwood');solidRect(x,z,.64,.64,1.4,false,'chair5')}
function table5(x,z){prop5(x,.83,z,2,.16,2,'darkwood',[1,1,1],'round');box(x,.93,z,2.04,.03,2.04,'cloth4P',[.75,.70,.63],[1,1],{geometry:'round'});box(x,.40,z,.23,.78,.23,'darkwood');for(let i=0;i<3;i++){const a=i*2.094;box(x+Math.sin(a)*.65,.97,z+Math.cos(a)*.65,.4,.025,.4,'ceramic4P',[.8,.8,.7],[1,1],{geometry:'round'});box(x+Math.sin(a+.4)*.63,1.08,z+Math.cos(a+.4)*.63,.09,.22,.09,'steel4P',[.6,.7,.8],[1,1],{geometry:'round'});}candle5(x,z,1)}
function candle5(x,z,y=1){box(x,y+.16,z,.06,.32,.06,'white',[.85,.78,.62],[1,1],{geometry:'round'});box(x,y+.35,z,.035,.09,.035,'white',[1,.62,.15],[1,1],{emissive:1});box(x,y-.015,z,.24,.06,.24,'brass',[1,1,1],[1,1],{geometry:'round'})}
function arch5(x,z,span,base,h,axis='z'){const points=[];for(let i=0;i<=32;i++){const xx=-span/2+span*i/32,yy=base+h*Math.sqrt(Math.max(0,1-((Math.abs(xx)+span/2)/span)**2))/Math.sqrt(.75);points.push([axis==='z'?x+xx:x,yy,axis==='z'?z:z+xx]);}for(let i=1;i<points.length;i++)beam12(points[i-1],points[i],.13,'stone5',[.78,.73,.65]);for(const q of[-span/2,span/2])box(axis==='z'?x+q:x,base/2,axis==='z'?z:z+q,.16,base,.16,'stone5',[.75,.72,.65]);}
function lancet12(x,y,z,w,h,rot=0){if(!shapedGeometry.lancet12){const data=[],poly=[[-.5,-.5],[.5,-.5],[.5,.15]];for(let i=0;i<=24;i++){const xx=.5-i/24,yy=.15+.35*Math.sqrt(Math.max(0,1-(Math.abs(xx)+.5)**2))/Math.sqrt(.75);poly.push([xx,yy]);}const put=p=>data.push(p[0],p[1],0,0,0,1,p[0]+.5,.5-p[1]);for(let i=1;i<poly.length-1;i++){put(poly[0]);put(poly[i]);put(poly[i+1]);}const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);shapedGeometry.lancet12={buf,count:data.length/8};}box(x,y,z,w,h,1,'stained12',[.85,.77,1],[1,1],{geometry:'lancet12',emissive:.22,rotY:rot});}
function picture5(x,z,rot=0,tex='portrait5'){box(x,2.1,z,1.3,1.8,.08,'brass',[.62,.48,.3],[1,1],{rotY:rot});box(x+Math.sin(rot)*.05,2.1,z+Math.cos(rot)*.05,1.13,1.61,.025,tex,[.85,.83,.80],[1,1],{rotY:rot})}
function texturesWedding5(){if(textures.gothic5)return;
 texture4('gothic5','#302933',(g)=>{g.strokeStyle='#69546b';g.lineWidth=2;for(let x=0;x<512;x+=64)for(let y=0;y<512;y+=100){g.beginPath();g.ellipse(x+32,y+50,18,35,0,0,7);g.stroke();g.beginPath();g.moveTo(x+32,y+18);g.bezierCurveTo(x+50,y+45,x+7,y+55,x+32,y+82);g.stroke()}for(let i=0;i<2000;i++){g.fillStyle='#00000015';g.fillRect(rnd()*512,rnd()*512,rnd()*4,1)}});
 texture4('stone5','#716b66',g=>{for(let y=0;y<512;y+=85)for(let x=0;x<512;x+=170){g.strokeStyle='#272422';g.lineWidth=2;g.strokeRect(x+(y%170?85:0),y,170,85)}for(let i=0;i<6000;i++){g.fillStyle='#13101016';g.fillRect(rnd()*512,rnd()*512,2,2)}});
 texture4('carpet5','#552b35',g=>{for(let x of[12,28,484,500]){g.strokeStyle='#b19b67';g.lineWidth=3;g.beginPath();g.moveTo(x,0);g.lineTo(x,512);g.stroke()}for(let y=20;y<512;y+=64){g.strokeStyle='#bd926d77';g.beginPath();g.moveTo(256,y);g.lineTo(279,y+20);g.lineTo(256,y+40);g.lineTo(233,y+20);g.closePath();g.stroke()}});
 texture4('window5','#152136',g=>{g.strokeStyle='#866d65';g.lineWidth=8;for(let x=0;x<512;x+=64){g.beginPath();g.moveTo(x,0);g.lineTo(x+256,512);g.stroke();g.beginPath();g.moveTo(x+256,0);g.lineTo(x,512);g.stroke()}g.fillStyle='#67628b88';g.beginPath();g.arc(256,220,100,0,7);g.fill();g.strokeStyle='#a19578';g.strokeRect(18,18,476,476)});
 texture4('mold5','#3b4141',g=>{for(let i=0;i<6000;i++){g.fillStyle=i%3?'#141b1780':'#81908144';g.fillRect(rnd()*512,rnd()*512,2+rnd()*8,1+rnd()*24)}g.strokeStyle='#161815';g.lineWidth=3;for(let y=0;y<512;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke()}});
 texture4('portrait5','#1c1922',g=>{g.fillStyle='#b8a088';g.font='italic 34px Georgia';g.textAlign='center';g.fillText('Uma última dança',256,60);g.fillStyle='#9e9282';g.beginPath();g.ellipse(200,240,34,40,0,0,7);g.fill();g.beginPath();g.ellipse(300,220,30,36,0,0,7);g.fill();g.fillStyle='#302c36';g.fillRect(164,279,80,180);g.fillStyle='#afa493';g.beginPath();g.moveTo(300,255);g.lineTo(390,460);g.lineTo(238,460);g.closePath();g.fill();g.fillStyle='#766954';g.font='22px Georgia';g.fillText('BELLEVUE · 1964',256,496)});
}
// v0.12 — Bellevue chapel. All positions are metres, all furniture is grounded.
const GROOM12={x:18.5,z:-46.1};
const wingLamps12=[];
function beam12(a,b,width,tex='darkwood',tint=[1,1,1]){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],horizontal=Math.hypot(dx,dz);box((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,Math.hypot(horizontal,dy),width,width,tex,tint,[1,1],{rotY:-Math.atan2(dz,dx),rotZ:Math.atan2(dy,horizontal)})}
function textures12(){texturesWedding5();if(textures.plaster12)return;
 const tile=(name,bg,fn)=>{const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,512,512);fn(g);textures[name]=makeTextureFromCanvas(c,true)};
 tile('plaster12','#74695f',g=>{for(let i=0;i<18000;i++){const n=rnd();g.fillStyle=n>.6?'#ffffff09':'#1911150b';g.fillRect(rnd()*512,rnd()*512,1+rnd()*6,1+rnd()*4)}for(let i=0;i<10;i++){let x=rnd()*512,y=rnd()*512;g.strokeStyle='#29222438';g.lineWidth=.7;g.beginPath();g.moveTo(x,y);for(let j=0;j<6;j++){x+=(rnd()-.5)*14;y+=rnd()*16;g.lineTo(x,y)}g.stroke()}});
 tile('panel12','#33262a',g=>{for(let x=0;x<512;x+=128){const gr=g.createLinearGradient(x,0,x+128,0);gr.addColorStop(0,'#151419');gr.addColorStop(.08,'#76634a');gr.addColorStop(.15,'#382b2c');gr.addColorStop(.9,'#33292e');gr.addColorStop(1,'#141015');g.fillStyle=gr;g.fillRect(x,0,128,512);g.strokeStyle='#746048';g.lineWidth=3;g.strokeRect(x+20,35,88,442);g.strokeStyle='#111018';g.strokeRect(x+24,39,80,434)}for(let i=0;i<2200;i++){g.fillStyle='#b28c4411';g.fillRect(rnd()*512,rnd()*512,.5,5+rnd()*24)}});
 tile('parquet12','#5c4131',g=>{for(let y=0;y<512;y+=64)for(let x=0;x<512;x+=128){const xx=x+(y%128?64:0);g.fillStyle=['#584031','#674a34','#725039','#4c392e'][(x/128+y/64)%4];g.fillRect(xx,y,128,64);g.strokeStyle='#211b17';g.lineWidth=2;g.strokeRect(xx,y,128,64);for(let i=0;i<70;i++){g.fillStyle=i%2?'#cca06e13':'#100d0b20';g.fillRect(xx+rnd()*128,y+rnd()*64,5+rnd()*55,1)}}});
 tile('slate12','#4b4c50',g=>{for(let y=0;y<512;y+=128)for(let x=0;x<512;x+=128){g.fillStyle=['#44434a','#555159','#4b484e'][(x/128+y/128)%3];g.fillRect(x+2,y+2,124,124);g.strokeStyle='#81787544';g.strokeRect(x+4,y+4,120,120)}for(let i=0;i<6000;i++){g.fillStyle='#09091118';g.fillRect(rnd()*512,rnd()*512,3,2)}});
 texture4('stained12','#141921',g=>{const q=g.createRadialGradient(256,230,10,256,230,350);q.addColorStop(0,'#c5ad82');q.addColorStop(.32,'#786791');q.addColorStop(1,'#243341');g.fillStyle=q;g.fillRect(0,0,512,512);g.strokeStyle='#171820';g.lineWidth=9;for(let x=-512;x<1024;x+=64){g.beginPath();g.moveTo(x,0);g.lineTo(x+512,512);g.stroke();g.beginPath();g.moveTo(x+512,0);g.lineTo(x,512);g.stroke()}g.lineWidth=13;g.beginPath();g.arc(256,225,123,0,7);g.stroke();g.fillStyle='#cfb79588';g.beginPath();g.moveTo(256,70);g.lineTo(295,225);g.lineTo(256,385);g.lineTo(216,225);g.closePath();g.fill();g.stroke();g.lineWidth=18;g.strokeRect(7,7,498,498)});
 texture4('mirror12','#627077',g=>{const l=g.createLinearGradient(0,0,512,512);l.addColorStop(0,'#89999e');l.addColorStop(.45,'#35454d');l.addColorStop(.5,'#53606c');l.addColorStop(1,'#172b35');g.fillStyle=l;g.fillRect(0,0,512,512);g.strokeStyle='#b6bec46b';g.lineWidth=2;g.beginPath();g.moveTo(512,0);g.lineTo(320,170);g.lineTo(350,210);g.lineTo(200,440);g.moveTo(320,170);g.lineTo(110,145);g.stroke();for(let i=0;i<1000;i++){g.fillStyle='#9c927a1a';g.fillRect(rnd()*512,rnd()*512,2,3)}});
}
function wall12(x,z,w,d,h=4,tex='plaster12'){box(x,h/2,z,w,h,d,tex,[1,1,1],[Math.max(w,d)/3,h/3]);solidRect(x,z,w,d,h,false,'wall12');occluderRect(x,z,w,d,'wall12');box(x,.65,z,w+.045,1.3,d+.045,tex==='mold5'?'rust13':'panel12',[1,1,1],[Math.max(w,d)/1.8,1]);for(const [y,t]of[[.08,.16],[1.31,.06],[h-.12,.16]])box(x,y,z,w+.09,t,d+.09,'darkwood',[.85,.72,.6]);}
function doorway12(axis,c,min,max,center,width=2.2,h=4,label=''){const a=center-width/2,b=center+width/2,seg=(lo,hi)=>{if(hi<=lo)return;axis==='x'?wall12(c,(lo+hi)/2,.3,hi-lo,h):wall12((lo+hi)/2,c,hi-lo,.3,h)};seg(min,a);seg(b,max);const top=3.05;axis==='x'?box(c,(h+top)/2,center,.3,h-top,width,'plaster12'):box(center,(h+top)/2,c,width,h-top,.3,'plaster12');for(const v of[a,b]){axis==='x'?box(c,1.5,v,.42,3,.19,'stone5'):box(v,1.5,c,.19,3,.42,'stone5');}arch5(axis==='x'?c:center,axis==='x'?center:c,width,2.5,.65,axis);if(label)sign12(axis==='x'?c+.19:center,2.96,axis==='x'?center:c+.2,label,axis==='x'?Math.PI/2:0);}
function sign12(x,y,z,label,rot=0){const key='sign12_'+label;if(!textures[key])texture4(key,'#252027',g=>{g.strokeStyle='#aa9370';g.lineWidth=7;g.strokeRect(12,160,488,190);g.fillStyle='#e1c9a3';g.textAlign='center';g.font='30px Georgia';g.fillText(label,256,263)});box(x,y,z,1.7,.48,.035,key,[1,1,1],[1,1],{rotY:rot});}
function lamp12(x,z,y=2.45){box(x,y-.1,z,.14,.43,.14,'brass',[.65,.55,.43]);box(x,y+.17,z,.20,.28,.20,'white',[.9,.68,.38],[1,1],{emissive:.22,dynamic12:true,wingLight12:true});wingLamps12.push([x,y+.2,z]);}
function pew12(x,z){const w=5.5;box(x,.49,z,w,.16,.78,'oak4P',[.63,.48,.36],[3,1]);box(x,.96,z+.30,w,.92,.12,'oak4P',[.6,.45,.32],[3,1]);box(x,1.45,z+.30,w+.05,.12,.17,'darkwood');for(const dx of[-w/2,w/2]){box(x+dx,.73,z,.16,1.45,.93,'darkwood');box(x+dx,1.49,z+.19,.27,.17,.4,'darkwood');box(x+dx,1.64,z+.28,.18,.20,.18,'darkwood',[.6,.47,.34],[1,1],{geometry:'organic10'});for(const dz of[-.29,.29])box(x+dx,.14,z+dz,.23,.28,.23,'darkwood');box(x+dx,1.25,z+.28,.065,.3,.065,'brass',[.65,.5,.3]);}box(x,.18,z+.68,w,.07,.3,'darkwood');for(const dx of[-2,0,2])box(x+dx,.24,z,.12,.48,.5,'darkwood');solidRect(x,z+.1,w+.25,1.25,1.5,false,'pew12');}
function chandelier12(z){beam12([0,8.12,z],[0,4.9,z],.045,'brass');box(0,4.9,z,.25,.36,.25,'brass',[.65,.5,.32],[1,1],{geometry:'shade'});for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a)*1.1,zz=z+Math.sin(a)*1.1;beam12([0,4.75,z],[x,4.45,zz],.055,'brass');beam12([x,4.45,zz],[x,4.7,zz],.05,'brass');candle5(x,zz,4.73);}for(let i=0;i<16;i++){const a=i*Math.PI/8,b=(i+1)*Math.PI/8;beam12([Math.cos(a)*1.1,4.46,z+Math.sin(a)*1.1],[Math.cos(b)*1.1,4.46,z+Math.sin(b)*1.1],.045,'brass');}}
function window12(side,z){const x=side*9.81;lancet12(x,3.5,z,1.85,2.9,side<0?Math.PI/2:-Math.PI/2);for(const zz of[z-.99,z+.99])box(x-side*.08,3.2,zz,.16,3.5,.15,'stone5');box(x-side*.1,1.85,z,.25,.16,2.25,'stone5');arch5(x-side*.12,z,2.02,3.94,1.05,'x');box(x-side*.08,3.5,z,.10,2.9,.055,'brass',[.55,.52,.43]);}
function flowers12(x,z,base){box(x,base+.22,z,.4,.44,.4,'stone5',[.8,.75,.66],[1,1],{geometry:'shade'});for(let i=0;i<7;i++){const a=i*2.4,xx=x+Math.sin(a)*.20,zz=z+Math.cos(a)*.20,yy=base+.6+(i%3)*.07;beam12([x,base+.32,z],[xx,yy,zz],.018,'darkwood',[.45,.5,.35]);for(let j=0;j<4;j++){const b=j*1.57;box(xx+Math.sin(b)*.055,yy,zz+Math.cos(b)*.055,.12,.09,.1,'cloth4P',[.6,.46,.48],[1,1],{geometry:'organic10'});}}}
function table12(x,z){table5(x,z);for(const d of[-1,1]){chair12(x+d*1.4,z,d*Math.PI/2);chair12(x,z+d*1.4,d<0?Math.PI:0)}}
function chair12(x,z,a){const put=(dx,y,dz,w,h,d,tex='darkwood')=>box(x+Math.cos(a)*dx+Math.sin(a)*dz,y,z-Math.sin(a)*dx+Math.cos(a)*dz,w,h,d,tex,[.7,.59,.47],[1,1],{rotY:a});put(0,.48,0,.52,.12,.51);put(0,.56,0,.46,.08,.44,'wine4');for(const dx of[-.2,.2])for(const dz of[-.2,.2])put(dx,.24,dz,.055,.48,.055);put(0,1.02,.23,.5,.7,.065);put(0,1.0,.185,.38,.46,.025,'wine4');solidRect(x,z,.65,.65,1.4,false,'chair12');}
function sink12(x,z){prop5(x,.46,z,.28,.92,.26,'ceramic4P');box(x,.94,z,1.12,.19,.65,'ceramic4P',[.8,.81,.75],[1,1],{geometry:'organic10'});box(x,1.045,z,.63,.025,.38,'darkwood',[.13,.18,.2],[1,1],{geometry:'organic10'});box(x,1.12,z-.24,.045,.24,.045,'steel4P');box(x,1.23,z-.13,.04,.04,.25,'steel4P');box(x,1.94,z-.31,1.17,1.3,.06,'brass',[.6,.52,.42]);box(x,1.94,z-.267,1.06,1.17,.02,'mirror12');}
function toilet12(x,z){box(x,.19,z,.4,.38,.55,'ceramic4P',[.72,.74,.67],[1,1],{geometry:'shade'});box(x,.43,z,.59,.22,.78,'ceramic4P',[.76,.78,.73],[1,1],{geometry:'organic10'});box(x,.555,z,.36,.026,.48,'darkwood',[.25,.25,.21],[1,1],{geometry:'organic10'});box(x,.82,z-.37,.62,.74,.24,'ceramic4P',[.8,.81,.77]);box(x,.84,z-.225,.16,.055,.045,'steel4P');solidRect(x,z,.75,1.08,1.2,false,'toilet12');}
function bathroom12(side,z0,z1){const x=side*18.5;box(x,.005,(z0+z1)/2,8.7,.015,Math.abs(z1-z0),'slate12',[.72,.83,.84],[6,5]);for(const xx of[side*17,side*20.5])toilet12(xx,z1+1);wall12(side*18.7,z1+1.7,.1,3,2.1,'plaster12');sinkWall13(side*16.1,z0-.56);box(side*22.65,1.1,z1+2,.11,.21,.21,'white');sign12(side*16.3,2.7,z0-.4,side<0?'CAVALHEIROS':'SENHORAS');}
function buildFloor5(){textures12();if(!textures.bookCover12&&imgs.book12_0?.complete)textures.bookCover12=textureFromImage(imgs.book12_0);if(!textures.bookCover12)textures.bookCover12=textures.darkwood;wingLamps12.length=0;placeNpcs12();enemies5=hostileDefs5.map(d=>({...d,state:'dormant',reveal:0,clock:0,path:[],pathAt:0,purified:wedding5.purged.includes(d.id)}));
 // Nave: pitched roof, full walls, side aisles and clear crossing between only two portals.
 box(0,-.10,-15.5,20,.2,37,'parquet12',[1,1,1],[6,13]);wall12(0,-34,20,.32,8.6);doorway12('z',3,-10,10,0,2.5,8.6);
 for(const side of[-1,1]){doorway12('x',side*10,-34,3,-15,3.5,5.2);const run=10,rise=3.2;box(side*5,6.9,-15.5,Math.hypot(run,rise),.28,37,'plaster12',[.62,.58,.54],[4,12],{rotZ:-side*Math.atan2(rise,run)});for(const z of[-2,-9,-22,-29])window12(side,z);for(const z of[1,-7,-23,-33]){box(side*9.68,2.6,z,.42,5.2,.56,'stone5',[.8,.75,.69]);box(side*9.65,.14,z,.66,.28,.82,'stone5');box(side*9.65,4.98,z,.65,.28,.8,'stone5');beam12([side*9.7,5.03,z],[0,8.2,z],.16,'stone5',[.63,.6,.55]);solidRect(side*9.68,z,.45,.60,5.2,false,'pillar12');}}
 box(0,8.23,-15.5,.20,.20,37,'stone5');box(0,.014,-15,2.75,.028,33,'carpet5',[.88,.73,.7],[1,10]);for(const z of[-5,-10,-19,-24])for(const side of[-1,1])pew12(side*5,z);for(const z of[-5,-15,-25])chandelier12(z);
 // Closed sanctuary. Nothing opens directly into the service rooms behind the bride.
 box(0,.10,-31.2,8,.2,5.2,'slate12',[.87,.79,.69],[5,3]);solidRect(0,-31.2,8,5.2,.2,true,'altarStep12');box(0,.19,-28.7,8,.17,.6,'stone5');
 box(0,.80,-32,3.3,1.2,1,'stone5',[.7,.64,.56]);box(0,1.45,-32,3.7,.15,1.35,'stone5');box(0,1.54,-32,3.75,.04,1.4,'cloth4P',[.75,.68,.62]);box(0,1.02,-31.476,1.45,1.05,.022,'gothic5',[.73,.50,.65],[1,1]);box(0,.55,-31.46,1.46,.05,.04,'brass',[.73,.59,.36]);box(0,1.05,-31.45,.035,.35,.015,'brass',[.9,.73,.4]);box(0,1.12,-31.44,.21,.035,.016,'brass',[.9,.73,.4]);solidRect(0,-32,3.8,1.5,1.6,false,'altar12');for(const xx of[-1.4,1.4])candle5(xx,-32,1.58);box(0,1.61,-31.9,.42,.08,.54,'darkwood');box(0,1.66,-31.9,.36,.025,.48,'white',[.8,.75,.63]);
 for(const side of[-1,1]){const x=side*3.1;box(x,.6,-32,.66,.8,.66,'stone5');flowers12(x,-32,1.0);arch5(side*5.8,-33.70,2.1,3.6,1.3);lancet12(side*5.8,3,-33.74,1.85,3.8);}arch5(0,-33.7,5,3.4,2);box(0,3.6,-33.5,.14,2.1,.16,'brass',[.8,.66,.4]);box(0,4,-33.5,1.1,.13,.17,'brass',[.8,.66,.4]);
 if(!textures.rose12)texture4('rose12','#151520',g=>{g.clearRect(0,0,512,512);g.translate(256,256);g.fillStyle='#27212e';g.beginPath();g.arc(0,0,246,0,7);g.fill();for(let i=0;i<12;i++){const a=i*Math.PI/6;g.save();g.rotate(a);g.fillStyle=['#746292','#997b76','#536b84'][i%3];g.beginPath();g.ellipse(0,-141,39,85,0,0,7);g.fill();g.strokeStyle='#c6ae75';g.lineWidth=5;g.stroke();g.restore();}g.fillStyle='#a18a76';g.beginPath();g.arc(0,0,49,0,7);g.fill();g.strokeStyle='#9d8a65';g.lineWidth=13;g.beginPath();g.arc(0,0,239,0,7);g.stroke();g.lineWidth=4;g.beginPath();g.arc(0,0,58,0,7);g.stroke();});box(0,5.65,-33.70,1.75,1.75,1,'rose12',[.88,.76,.93],[1,1],{surface:true,emissive:.19});
 for(const side of[-1,1]){const x=side*3.5,z=-29.6;box(x,.25,z,.65,.10,.65,'brass',[.48,.4,.28],[1,1],{geometry:'round'});beam12([x,.3,z],[x,1.75,z],.07,'brass');for(const dx of[-.28,0,.28]){beam12([x,1.4,z],[x+dx,1.75,z],.035,'brass');candle5(x+dx,z,1.76);}solidRect(x,z,.7,.65,2.2,false,'candelabra12');}
 // Music dais: riser, front step, supported music stand and instrument case.
 box(-6.8,.12,-28,4.2,.24,4.3,'oak4P',[.52,.38,.28],[2,2]);solidRect(-6.8,-28,4.2,4.3,.24,true,'stage12');box(-6.8,.06,-25.7,4.3,.12,.4,'darkwood');solidRect(-6.8,-25.7,4.3,.4,.12,true,'stageStep12');box(-8,.4,-29.3,1.1,.25,.48,'darkwood');box(-7.9,.55,-29.3,.8,.06,.3,'wine4');beam12([-5.4,.25,-27.3],[-5.4,1.53,-27.3],.045,'brass');for(let i=0;i<3;i++){const a=i*2.094;beam12([-5.4,.55,-27.3],[-5.4+Math.cos(a)*.36,.26,-27.3+Math.sin(a)*.36],.035,'brass');}box(-5.4,1.53,-27.3,.61,.39,.045,'darkwood');box(-5.4,1.53,-27.267,.52,.31,.014,'white',[.77,.72,.62]);for(let i=0;i<5;i++)box(-5.4,1.43+i*.032,-27.25,.44,.005,.005,'darkwood');
 // Elevator is unobstructed. Its actual cabin is sealed behind the opening.
 box(0,-.09,4.4,2.5,.18,3,'ceramic4P');box(0,2.8,4.4,2.5,.18,3,'steel4P');wall12(-1.3,4.4,.18,3,2.8,'steel4P');wall12(1.3,4.4,.18,3,2.8,'steel4P');wall12(0,5.9,2.6,.18,2.8,'steel4P');box(-.7,1.35,2.98,1,2.7,.07,'metal',[1,1,1],[1,1],{eDoor:'a',baseX:-.7});box(.7,1.35,2.98,1,2.7,.07,'metal',[1,1,1],[1,1],{eDoor:'b',baseX:.7});sign12(0,3.45,2.75,'V · CAPELA BELLEVUE',Math.PI);
 // Two galleries, with rooms opening away from the nave. Opposite bathroom extremities.
 for(const side of[-1,1]){const x=side*16.5;box(x,-.10,-22.5,13,.2,35,'parquet12',[.62,.62,.67],[5,13]);box(x,4.12,-22.5,13,.24,35,'plaster12',[.55,.56,.58],[4,12]);wall12(side*23,-22.5,.3,35);wall12(x,-5,13,.3);if(side<0)wall12(x,-40,13,.3);wall12(side*10,-36.9,.3,5.8);for(const z of[-9,-18,-29,-38])lamp12(side*10.4,z);}
 // West: dining (front), catering kitchen, gentlemen's lavatory (deep end).
 doorway12('x',-14,-20,-5,-13,2.3,4,'BUFÊ');doorway12('x',-14,-32,-20,-26,2.3,4,'COZINHA');doorway12('x',-14,-40,-32,-35.2,2.3,4,'CAVALHEIROS');wall12(-18.5,-20,9,.3);wall12(-18.5,-32,9,.3);
 for(const [x,z]of[[-18,-10],[-18,-16]])table12(x,z);prop5(-21.9,.47,-13.8,1.2,.94,7.6,'darkwood');box(-21.9,.97,-13.8,1.3,.04,7.7,'cloth4P',[.64,.6,.51],[1,4]);for(let i=0;i<5;i++){const z=-10.7-i*1.5;box(-21.9,1.03,z,.82,.06,.75,'steel4P',[.7,.68,.62],[1,1],{geometry:'round'});box(-21.9,1.14,z,.70,.2,.60,'steel4P',[.5,.55,.55],[1,1],{geometry:'organic10'});box(-21.9,1.29,z,.2,.045,.04,'brass');}flowers12(-18,-10,.96);
 // Kitchen: counters at the perimeter, sink, range and pot rack.
 prop5(-21.95,.51,-26.4,1.5,1.02,7.8,'steel4P',[.55,.62,.6]);box(-21.95,1.04,-26.4,1.58,.07,7.9,'steel4P');for(const z of[-23,-24.3,-25.6,-26.9,-28.2,-29.5]){box(-21.15,.51,z,.045,.85,1.1,'steel4P',[.6,.65,.63]);box(-21.1,.74,z,.065,.05,.42,'brass');}for(const z of[-24,-25]){box(-21.8,1.10,z,.62,.04,.62,'black');box(-21.8,1.27,z,.41,.32,.41,'steel4P',[.5,.55,.56],[1,1],{geometry:'round'});box(-21.8,1.44,z,.47,.035,.47,'steel4P',[.7,.7,.64],[1,1],{geometry:'round'});}box(-21.9,2.5,-24.5,1.7,.35,2.7,'steel4P',[.4,.43,.45]);box(-22.45,3.3,-24.5,.45,1.4,.5,'steel4P');box(-21.8,1.09,-28,.85,.026,1.1,'darkwood');box(-21.8,1.13,-28,.64,.03,.8,'steel4P');beam12([-22.4,1.1,-28],[-22.4,1.5,-28],.055,'steel4P');beam12([-22.4,1.5,-28],[-22,1.5,-28],.055,'steel4P');prop5(-16,1.1,-30.6,1.6,2.2,.7,'darkwood');for(let y=.45;y<2.2;y+=.53){box(-16,y,-30.5,1.6,.045,.6,'oak4P');for(const x of[-16.5,-16,-15.5])box(x,y+.17,-30.5,.25,.31,.25,'ceramic4P',[.55,.52,.46],[1,1],{geometry:'round'});}bathroom12(-1,-32,-40);
 // East: ladies' lavatory at the front; dance floor and a dogleg service vestibule.
 doorway12('x',14,-13,-5,-10,2.3,4,'SENHORAS');doorway12('x',14,-34,-13,-23,2.8,4,'SALÃO DE DANÇA');doorway12('x',14,-40,-34,-37,2.3,4,'SERVIÇO');wall12(18.5,-13,9,.3);wall12(18.5,-34,9,.3);bathroom12(1,-5,-13);
 box(18.5,.02,-23.5,7.7,.025,17.8,'parquet12',[1.06,.88,.64],[5,10]);for(const x of[14.55,22.45])box(x,.04,-23.5,.09,.025,18.2,'brass',[.45,.37,.27]);for(const z of[-14.45,-32.55])box(18.5,.04,z,8,.025,.09,'brass',[.45,.37,.27]);for(const z of[-17,-30]){box(22.72,2.2,z,.065,2.3,3.4,'brass',[.42,.36,.29]);box(22.67,2.2,z,.032,2.14,3.22,'mirror12');}for(const z of[-16,-30.5]){prop5(16,.39,z,2.25,.18,.72,'darkwood');box(16,.54,z,2.2,.14,.69,'wine4',[.54,.43,.43]);box(16,.91,z-.3,2.25,.8,.1,'darkwood');for(const x of[15.1,16.9])box(x,.18,z,.09,.36,.58,'darkwood');}beam12([18.5,4,-23],[18.5,3.15,-23],.04,'brass');box(18.5,3,-23,.38,.36,.38,'mirror12',[.6,.66,.72],[1,1],{geometry:'organic10'});
 for(const side of[-1,1])for(const z of side<0?[-8,-17,-23,-29,-35]:[-8,-16,-25,-31,-37]){const x=side*22.79;box(x,2.7,z,.07,1.7,1.1,'mirror12',[.35,.38,.48]);arch5(x-side*.06,z,1.22,3.1,.5,'x');box(x-side*.06,1.83,z,.15,.10,1.4,'stone5',[.5,.48,.45]);lamp12(side*22.5,z+1.4,2.5);}for(const side of[-1,1])for(const z of[-5.4,-13,-20,-27,-33.9,-39.5]){box(side*18.5,3.85,z,8.8,.18,.14,'darkwood',[.5,.4,.35]);box(side*18.5,3.78,z,.18,.3,.26,'brass',[.38,.32,.23]);}
 // Deep electrical branch: solid dogleg, red-lit doorway, no route behind the altar.
 box(16.5,-.1,-42,13,.2,4,'slate12',[.55,.58,.6],[5,2]);box(16.5,3.42,-42,13,.18,4,'mold5');wall12(10,-42,.3,4,3.4,'mold5');wall12(23,-42,.3,4,3.4,'mold5');wall12(12,-40,4,.3,3.4);doorway12('z',-44,10,23,18.5,2.6,3.4,'QUADRO ELÉTRICO');
 box(18.5,-.1,-49,9,.2,10,'slate12',[.43,.46,.48],[4,4]);box(18.5,3.7,-49,9,.2,10,'mold5',[.5,.53,.51],[3,4]);wall12(14,-49,.3,10,3.6,'mold5');wall12(23,-49,.3,10,3.6,'mold5');wall12(18.5,-54,9,.3,3.6,'mold5');
 for(const x of[14.6,22.4])for(const z of[-46,-49,-52]){beam12([x,3.25,z+1.2],[x,3.25,z-1.2],.09,'steel4P',[.4,.43,.43]);beam12([x,3.25,z],[x,.3,z],.06,'steel4P',[.4,.43,.43]);}
 prop5(15.3,1.1,-51,1.1,2.2,2.8,'steel4P',[.39,.43,.42]);for(let y=.3;y<2.1;y+=.55){box(15.3,y,-51,1.2,.06,2.9,'darkwood');for(let i=0;i<3;i++)box(15.4,y+.2,-52+i*.8,.7,.34,.55,'wood',[.48,.44,.37]);}box(18.5,1.4,-53.78,2.8,2.4,.1,'steel4P',[.35,.39,.4]);for(let i=0;i<8;i++)beam12([17.5+i*.28,3.5,-53.75],[17.5+i*.28,2.45,-53.75],.023,'darkwood');
 sprite('f5_breaker',18.5,-53.67,1.25,'breaker_closed',{y:.76,billboard:false,rotY:0});interactables.push({id:'f5_breaker',x:18.5,z:-53.3,range:2.5,label:'ABRIR COM A CHAVE DE FENDA'});if(!wedding5.cleared)solidRect(18.5,-46.7,9,.15,3.6,false,'ward5');
 // Four-legged camera support with a leather notebook visibly under the camera.
 const cx=1.5,cz=-1.5;for(const dx of[-.34,.34])for(const dz of[-.3,.3]){beam12([cx+dx,.04,cz+dz],[cx+dx*.35,1.19,cz+dz*.35],.042,'steel4P',[.55,.53,.5]);box(cx+dx,.025,cz+dz,.095,.05,.095,'black');}box(cx,1.19,cz,.55,.06,.46,'darkwood');solidRect(cx,cz,.72,.69,1.23,false,'cameraStand12');if(!cameraOwned5){box(cx,1.255,cz,.44,.07,.36,'darkwood',[.4,.35,.31]);box(cx,1.257,cz-.018,.405,.04,.33,'white',[.67,.61,.49]);box(cx,1.302,cz,.45,.024,.37,'bookCover12');sprite('f5_camera',cx,cz,.47,'camera5_0',{y:1.31});interactables.push({id:'f5_camera',x:cx,z:cz,range:2.4,label:'PEGAR CÂMERA E CADERNO'});objects.slice(-3).forEach(o=>o.pickupBook12=true)}
 for(const[id,n]of Object.entries(F5_NPCS)){if(id==='bride'&&wedding5.cleared)continue;sprite('f5_'+id,n.x,n.z,n.h,n.tex+'_0',{y:id==='music'?.24:id==='bride'?.2:.02,visible:wedding5.revealed.includes(id)});interactables.push({id:'f5_'+id,x:n.x,z:n.z,range:3.5,label:'CONVERSAR · '+n.name});}
 if(!wedding5.cleared)sprite('f5_groom',GROOM12.x,GROOM12.z,2.5,'groom5_bad_0',{y:.16,visible:wedding5.groomSeen});interactables.push({id:'f5_groom',...GROOM12,range:5.1,label:'CONFRONTAR O ESPÍRITO'});interactables.push({id:'f5_elevator',x:0,z:2.7,range:2.3,label:'SUBIR AO 6º ANDAR'});for(const e of enemies5)sprite('f5_'+e.id,e.x,e.z,2,'hostile5_reveal_0',{visible:false,y:.1});navGrid5=null;
}

const oldScene5=setScene;setScene=function(name){oldScene5(name);if(name==='floor5'){loadWeddingAssets5();buildFloor5();}for(const el of[heldCamera5,equipment5,spectral5,notebook5,deduction5,letterbox5,investigationHint5])el.classList.add('hidden');photoFx5.className='photoFx5';photographImage5.classList.add('hidden');if(ambSource5){try{ambSource5.stop()}catch(e){}ambSource5=null}if(name==='floor5'){initAudio5().then(()=>{if(scene==='floor5')ambSource5=sound5('ambience',.11)});equipmentPaint5()}else {heldBook12.classList.add('hidden');stopViolin12();if(!story.hasScrewdriver)ui.hand.classList.add('hidden')}};
const base5=baseWalkable;baseWalkable=function(x,z){if(scene!=='floor5')return base5(x,z);return (Math.abs(x)<11.8&&z<2.8&&z>-38.2)||(Math.abs(x)<21.8&&z<-8.1&&z>-42.8)||(Math.abs(x)<3.8&&z<-42.6&&z>-55.8)};
const ceil5=currentCeilingBottom;currentCeilingBottom=function(){return scene==='floor5'?(player.z<-43?4:Math.abs(player.x)>12||player.z<-38?3.4:6):ceil5()};
const common5=setCommon;setCommon=function(v){common5(v);gl.uniform1f(loc.uOpacity5,1);if(scene!=='floor5')return;const dirty=player.z<-43,side=Math.abs(player.x)>12||player.z<-38,t=performance.now()*.001;gl.uniform1f(loc.uAmbient,wedding5.power?.58:dirty?.35:side?.43:.47);gl.uniform3fv(loc.uLightTint,new Float32Array(dirty?[.70,.82,.88]:[.92,.85,.93]));gl.uniform1f(loc.uFlash,dirty?.3:0);gl.uniform3fv(loc.uFogColor,new Float32Array([.026,.024,.040]));gl.uniform1f(loc.uFogDensity,.012);const lamps=[-5,-13,-22,-31].sort((a,b)=>Math.abs(a-player.z)-Math.abs(b-player.z));let positions=lamps.slice(0,3).flatMap(z=>[0,4.3,z]),colors=lamps.slice(0,3).flatMap(()=>[1.7,1.05,.65]);if(side||dirty){positions=[player.x,2.9,player.z-2,player.x,2.9,player.z+3,0,2.8,-47];colors=[.45,.55,.7,.4,.5,.65,.3,.2,.25]}gl.uniform3fv(loc['uLocalPos[0]'],new Float32Array(positions));gl.uniform3fv(loc['uLocalColor[0]'],new Float32Array(colors))};
const view5=viewData;viewData=function(){if(scene!=='floor5')return view5();let eye=[player.x,player.eye+player.floorY+player.jumpY+player.bobOffset,player.z],f=[Math.sin(player.yaw)*Math.cos(player.pitch),Math.sin(player.pitch),-Math.cos(player.yaw)*Math.cos(player.pitch)];if(mode==='cinematic5'||mode==='dialogue'&&dialogueKind==='ghost5:couple'){let center=[0,1.4,-46.5];eye=[2.8,1.7,-43.5];if(coupleTime5>1.5&&coupleTime5<5.2){const z=lerp(-33.2,-46.7,clamp((coupleTime5-1.5)/3.7,0,1));eye=[.9,1.75,z+3.8];center=[0,1.2,z]}const len=Math.hypot(...center.map((v,i)=>v-eye[i]));f=center.map((v,i)=>(v-eye[i])/len)}const view=M.lookAt(eye,eye.map((v,i)=>v+f[i]),[0,1,0]);return {eye,f,vp:M.multiply(M.perspective(70*Math.PI/180,canvas.width/canvas.height,.04,90),view)}};
const sprites5=syncWorldSprites;syncWorldSprites=function(v){if(scene!=='floor5')return sprites5(v);gl.uniform1f(loc.uSurfaceGloss,0);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);for(const s of [...sprites].sort((a,b)=>Math.hypot(b.x-v.eye[0],b.z-v.eye[2])-Math.hypot(a.x-v.eye[0],a.z-v.eye[2]))){if(!s.visible)continue;let tex=s.texName;const id=s.id.slice(3),npc=F5_NPCS[id];if(npc){tex=npc.tex+'_'+npcPose12(id);}if(s.id==='f5_groom')tex='groom5_bad_'+Math.floor(performance.now()/260)%3;if(s.id==='f5_breaker')tex=wedding5.power?'breaker_on':wedding5.opened?'breaker_open':'breaker_closed';const e=enemies5.find(e=>'f5_'+e.id===s.id);if(e){tex=(e.state==='reveal'?'hostile5_reveal_':'hostile5_')+(e.state==='reveal'?Math.min(2,Math.floor(e.reveal*4)):1+Math.floor(e.clock*4)%2)}if(s.override5)tex=s.override5;const im=imgs[tex];if(!im||!im.complete||!im.width)continue;gl.uniform1f(loc.uOpacity5,s.fade5??1);const angle=s.billboard===false?s.rotY:-Math.atan2(v.f[0],-v.f[2]);drawSurface({x:s.x,y:s.y+(npc||e?Math.sin(performance.now()*.0014+s.x)*.027:0),z:s.z,sx:s.h*im.width/im.height,sy:s.h,sz:1,rotY:angle,tex,tint:[1,1,1],emissive:s.id==='f5_camera'? .1:.32})}gl.uniform1f(loc.uOpacity5,1);gl.depthMask(true);gl.disable(gl.BLEND)};
function line5(ax,az,bx,bz){return !spriteOccluders.some(r=>segmentIntersectsRect(ax,az,bx,bz,r))&&!colliders.some(r=>r.top>=1.7&&!r.climbable&&segmentIntersectsRect(ax,az,bx,bz,r))}
function aimed5(x,z,range,cone=.84){const dx=x-player.x,dz=z-player.z,d=Math.hypot(dx,dz),f=forward2();return d<range&&(d<.2||(dx*f[0]+dz*f[1])/d>cone)&&line5(player.x,player.z,x,z)}
const interaction5=activeInteraction;activeInteraction=function(){if(scene!=='floor5')return interaction5();if(mode!=='world')return null;return interactables.filter(t=>{const id=t.id.slice(3);if(F5_NPCS[id]&&!wedding5.revealed.includes(id))return false;if(id==='bride'&&wedding5.cleared)return false;if(id==='groom'&&(!wedding5.groomSeen||wedding5.cleared))return false;if(id==='breaker'&&(!wedding5.cleared||wedding5.power))return false;if(id==='elevator'&&!wedding5.power)return false;if(id==='camera'&&cameraOwned5)return false;return aimed5(t.x,t.z,t.range,.64)}).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]||null};
function objective5(){setObjective(wedding5.power?'Volte para o elevador':wedding5.cleared?'Ligue o disjuntor na sala dos fundos':!cameraOwned5?'Explore o salão · pegue a câmera':!wedding5.heard.includes('bride')?'Fotografe o altar e descubra quem está chorando':mainIds5.every(id=>wedding5.heard.includes(id))?'Procure o espírito do noivo no corredor técnico':'Investigue a última noite · '+mainIds5.filter(id=>wedding5.heard.includes(id)).length+'/5 testemunhos · J: caderno')}
function saveWedding5(npc=null){if(npc){wedding5.checkpointNpc=npc;wedding5.spawn=[...F5_NPCS[npc].spawn];const n=F5_NPCS[npc];wedding5.yaw=Math.atan2(n.x-wedding5.spawn[0],-(n.z-wedding5.spawn[1]))}const data={version:5,checkpoint:'wedding',inventory:[...inventory],cameraOwned:cameraOwned5,equipment:equipped5,wedding:JSON.parse(JSON.stringify(wedding5))};checkpointSnapshot10=data;currentCheckpoint='wedding';try{localStorage.setItem(SAVE_KEY,JSON.stringify(data))}catch(e){showCaption('','Não foi possível gravar o checkpoint neste navegador.',3000)}refreshContinueButton()}
const saveBase5=saveCheckpoint;saveCheckpoint=function(cp){if(cp==='wedding')return saveWedding5();saveBase5(cp)};
const loadBase5=loadCheckpoint;loadCheckpoint=function(data){if(data?.checkpoint!=='wedding'){cameraOwned5=false;equipped5='screwdriver';return loadBase5(data)}wedding5={...freshWedding5(),...JSON.parse(JSON.stringify(data.wedding||{}))};for(const k of['revealed','heard','purged'])if(!Array.isArray(wedding5[k]))wedding5[k]=[];cameraOwned5=!!data.cameraOwned;equipped5=cameraOwned5&&data.equipment==='camera'?'camera':'screwdriver';inventory=(data.inventory||[]).filter(x=>['cigarette','kitten','matches','electricKey13'].includes(x));story.hasScrewdriver=story.janitorDone=story.receptionistDone=story.elevatorUnlocked=story.powerOn=story.power2=story.power3=story.fatherDead=story.oldLadyTalked=true;story.kittenTaken=inventory.includes('kitten');story.cigaretteTaken=inventory.includes('cigarette');checkpointSnapshot10=JSON.parse(JSON.stringify(data));currentCheckpoint='wedding';flashLeft5=photoLeft5=0;coupleTime5=0;setScene('floor5');const spawn=wedding5.spawn||[0,1.4];Object.assign(player,{x:spawn[0],z:spawn[1],yaw:wedding5.yaw||0,pitch:0,floorY:0,jumpY:0,yVel:0,eye:1.68,targetEye:1.68});mode='world';ui.title.classList.add('hidden');ui.pause.classList.add('hidden');ui.crosshair.classList.remove('hidden');ui.hand.src='assets/screwdriver_hold.png';renderInventory();equipmentPaint5();objective5();return true};
function resetFloor5(){wedding5=freshWedding5();cameraOwned5=false;equipped5='screwdriver';flashLeft5=photoLeft5=0;story.hasScrewdriver=true;setScene('floor5');Object.assign(player,{x:0,z:1.4,yaw:0,pitch:0,floorY:0,jumpY:0,yVel:0});mode='world';ui.hand.classList.remove('hidden');ui.crosshair.classList.remove('hidden');objective5();saveWedding5()}
function interactFloor5(id){id=id.slice(3);if(id==='camera'){cameraOwned5=true;equipped5='camera';sprites=sprites.filter(s=>s.id!=='f5_camera');sound5('shutter',.3);equipmentPaint5();objective5();saveWedding5();showCaption('','CÂMERA · DIREITO: FOTOGRAFAR · ESQUERDO: FLASH · SCROLL: TROCAR · J: CADERNO',6500);return}if(F5_NPCS[id])return talkNpc5(id);if(id==='groom'){if(!mainIds5.every(id=>wedding5.heard.includes(id)))return startDialogue('ghost5:groom',[['ESPÍRITO','Você não sabe. NÃO SABE!'],['','Ouça os outros convidados antes de confrontar este espírito.']],()=>objective5());return beginDeduction5()}if(id==='breaker'){if(equipped5==='camera')equip5('screwdriver');wedding5.opened=true;return openBreaker('floor5')}if(id==='elevator'&&wedding5.power)return rideElevator('5','6',()=>{ui.end.querySelector('.bigFloor')&&(ui.end.querySelector('.bigFloor').textContent='6');showEnding()})}
function talkNpc5(id){const n=F5_NPCS[id],first=!wedding5.heard.includes(id);startDialogue('ghost5:'+id,first?n.lines:[[n.name,'Ainda estou aqui. O que lembro está nas suas anotações.']],()=>{if(first){wedding5.heard.push(id);saveWedding5(id);showCaption('','CHECKPOINT · '+n.name+' · testemunho anotado',2200)}objective5();equipmentPaint5()})}
function photo5(){if(mode!=='world'||equipped5!=='camera'||!cameraOwned5||photoLeft5>0)return false;sfx.unlock();initAudio5();photoLeft5=.85;cameraPulse5=1;render();try{photographImage5.src=canvas.toDataURL('image/jpeg',.75);photographImage5.classList.remove('hidden');setTimeout(()=>photographImage5.classList.add('hidden'),180)}catch(e){}sound5('shutter',.5);photoFx5.className='photoFx5 photograph';setTimeout(()=>photoFx5.classList.remove('photograph'),240);if(scene!=='floor5')return true;
 const targets=Object.entries(F5_NPCS).filter(([id])=>!wedding5.revealed.includes(id)&&!(id==='bride'&&wedding5.cleared)&&!(id==='witch'&&wedding5.witchStage>=1&&!wedding5.cleared)).map(([id,n])=>({id,...n,type:'npc'}));for(const e of enemies5)if(!e.purified&&e.state==='dormant')targets.push({...e,type:'hostile'});if(!wedding5.groomSeen&&!wedding5.cleared)targets.push({id:'groom',...GROOM12,type:'groom'});
 const target=targets.filter(n=>aimed5(n.x,n.z,18,.84)).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0];if(!target){showCaption('','A fotografia não revelou nenhuma presença nova.',1400);return true}sound5('reveal',.35);const sp=sprites.find(s=>s.id==='f5_'+target.id);if(sp)sp.visible=true;if(target.type==='npc'){wedding5.revealed.push(target.id);showCaption('','Uma presença surgiu: '+target.name+'. Aproxime-se e converse.',2400)}else if(target.type==='groom'){wedding5.groomSeen=true;showCaption('ESPÍRITO','NÃO CHEGUE MAIS PERTO!',2200)}else{const e=enemies5.find(e=>e.id===target.id);e.state='reveal';e.reveal=0;showCaption('','ESPÍRITO CORROMPIDO · flash esquerdo para se defender',2100)}objective5();return true}
function flash5(){if(mode!=='world'||equipped5!=='camera'||!cameraOwned5||flashLeft5>0)return false;sfx.unlock();initAudio5();flashLeft5=3.8;cameraPulse5=1;photoFx5.className='photoFx5 flash';setTimeout(()=>photoFx5.classList.remove('flash'),420);sound5('flash',.5);let hit=false;if(scene==='floor5'){for(const e of enemies5){if(!e.purified&&e.state!=='dormant'&&aimed5(e.x,e.z,12,.85)){e.purified=true;e.state='purified';wedding5.purged.push(e.id);const sp=sprites.find(s=>s.id==='f5_'+e.id);if(sp){sp.purify5=.8;sp.fade5=1;}sound5('purify',.3);hit=true}}if(wedding5.groomSeen&&!wedding5.cleared&&aimed5(GROOM12.x,GROOM12.z,12,.85)){showCaption('ESPÍRITO','A LUZ NÃO APAGA O QUE FIZERAM!',2600);hit=true}if(!hit)showCaption('','O flash precisa recarregar. Continue se movendo.',1500)}return true}
function openNotebook5(){if(mode!=='world')return;mode='notebook5';if(document.pointerLockElement)document.exitPointerLock();notebook5.replaceChildren();const title=document.createElement('h2');title.textContent='A última noite';const count=document.createElement('p');count.textContent=mainIds5.filter(id=>wedding5.heard.includes(id)).length+' de 5 testemunhos · J ou ESC para fechar';notebook5.append(title,count);for(const id of wedding5.heard){const n=F5_NPCS[id];if(!n)continue;const article=document.createElement('article');const h=document.createElement('h3');h.textContent=n.name;const p=document.createElement('p');p.textContent=n.note;article.append(h,p);notebook5.append(article)}if(!wedding5.heard.length){const p=document.createElement('p');p.textContent='Ainda não ouvi nenhuma testemunha. Fotografar pode revelar quem ficou nesta noite.';notebook5.append(p)}const close=document.createElement('button');close.textContent='FECHAR CADERNO';close.onclick=closeNotebook5;notebook5.append(close);notebook5.classList.remove('hidden');equipmentPaint5()}
function closeNotebook5(){notebook5.classList.add('hidden');mode='world';requestLock();equipmentPaint5()}
function beginDeduction5(){startDialogue('ghost5:groom',[['ESPÍRITO','Quem fez isso?'],['ESPÍRITO','Se ouviu a verdade... diga os dois nomes.']],()=>showQuestion5(0))}
let deductionAnswer5=null;
function showQuestion5(index){mode='deduction5';if(document.pointerLockElement)document.exitPointerLock();deduction5.replaceChildren();deduction5.classList.remove('hidden');const h=document.createElement('h2');h.textContent=index?'Quem apagou as luzes?':'Quem matou os convidados?';const p=document.createElement('p');p.textContent='O espírito espera sua resposta.';deduction5.append(h,p);const names=index?['O padre','O coroinha','A irmã da noiva','O musicista']:['O musicista','O cozinheiro','O coroinha','O padre'];names.forEach((name,i)=>{const b=document.createElement('button');b.textContent=name;b.onclick=()=>answerDeduction5(index,i);deduction5.append(b)});equipmentPaint5()}
function answerDeduction5(index,choice){if(mode!=='deduction5')return;if(index===0){deductionAnswer5=choice;showQuestion5(1);return}deduction5.classList.add('hidden');if(deductionAnswer5!==3||choice!==1){startDialogue('ghost5:groom',[['ESPÍRITO','Não... mas isso não faz sentido. MENTIROSO!']],()=>killGhost5(true));return}startDialogue('ghost5:groom',[['VOCÊ','O padre atacou os convidados. O coroinha cortou a energia. O ataque começou no altar, enquanto alguém cortava a energia na elétrica.'],['VOCÊ','Vou encontrá-los. E descobrir por quê.'],['ESPÍRITO','Ela... ainda me espera?']],()=>startCouple5())}
function startCouple5(){wedding5.cleared=true;colliders=colliders.filter(c=>c.id!=='ward5');objects=objects.filter(o=>!o.ward5);navGrid5=null;mode='cinematic5';setObjective('');ui.caption.classList.add('hidden');coupleTime5=.001;letterbox5.classList.remove('hidden');ui.hand.classList.add('hidden');heldCamera5.classList.add('hidden');ui.interact.classList.add('hidden');sound5('purify',.4);sound5('waltz',.19);const groom=sprites.find(s=>s.id==='f5_groom');if(groom){groom.visible=true;groom.override5='groom5_0';groom.h=2.25}const bride=sprites.find(s=>s.id==='f5_bride');if(bride)bride.visible=false;ui.crosshair.classList.add('hidden')}
function updateCouple5(dt){if(mode!=='cinematic5')return;coupleTime5+=dt;objects=objects.filter(o=>!o.weddingParticle5);if(coupleTime5<1.5){for(let i=0;i<24;i++){const a=i*.72+coupleTime5*4,r=1.3*(1-coupleTime5/1.6);box(Math.cos(a)*r,.3+(i%8)*.3,-47+Math.sin(a)*r,.025,.05,.025,'white',[1,.72,.3],[1,1],{geometry:'organic10',emissive:.7,weddingParticle5:true})}}const groom=sprites.find(s=>s.id==='f5_groom'),bride=sprites.find(s=>s.id==='f5_bride');if(coupleTime5>1.5&&coupleTime5<5.2){if(bride){bride.visible=true;bride.override5='bride5_3';bride.h=2.15;bride.z=lerp(-33.2,-46.7,clamp((coupleTime5-1.5)/3.7,0,1));bride.x=0}}if(coupleTime5>=5.2&&coupleTime5<6.8){if(bride)bride.visible=false;if(groom)groom.override5='groom5_2'}if(coupleTime5>=6.8){if(groom)groom.override5='couple5_1';coupleTime5=0;startDialogue('ghost5:couple',[['NOIVA','Você conseguiu. Ele voltou para mim.'],['NOIVO','Obrigado por não desistir de nós.'],['NOIVA','Pela primeira vez, esta noite pode acabar.'],['NOIVO','Os outros ainda têm algo esperando por eles. Se puder... volte.']],()=>{mode='cinematic5';coupleTime5=-2.8})}else if(coupleTime5<0){/* handled separately below */}}
function finishCouple5(dt){if(mode!=='cinematic5'||coupleTime5>=0)return;coupleTime5=Math.min(0,coupleTime5+dt);const groom=sprites.find(s=>s.id==='f5_groom');if(groom){groom.y=.15+(2.8+coupleTime5)*.65;groom.fade5=-coupleTime5/2.8}if(coupleTime5===0){sprites=sprites.filter(s=>s.id!=='f5_groom'&&s.id!=='f5_bride');mode='world';letterbox5.classList.add('hidden');ui.crosshair.classList.remove('hidden');wedding5.spawn=[0,-46];wedding5.yaw=0;player.x=0;player.z=-46;player.yaw=0;player.pitch=0;saveWedding5();objective5();equipmentPaint5();requestLock()}}
function completeBreaker5(){if(wedding5.power)return;wedding5.power=true;sfx.power();powerFlicker=.9;ui.breaker.classList.add('hidden');mode='world';wedding5.spawn=[0,-52.7];wedding5.yaw=Math.PI;saveWedding5();objective5();requestLock();showCaption('','CLACK. O elevador voltou a funcionar.',2300)}
async function killGhost5(boss=false){if(deathBusy5||scene!=='floor5')return;deathBusy5=true;mode='dead';++typingToken;ui.dialogue.classList.add('hidden');ui.caption.classList.add('hidden');deduction5.classList.add('hidden');notebook5.classList.add('hidden');letterbox5.classList.add('hidden');ui.crosshair.classList.add('hidden');for(const k of Object.keys(keys))keys[k]=false;if(document.pointerLockElement)document.exitPointerLock();sound5('attack',.8,.9);jump5.src='assets/'+(boss?'groom5_bad_2':'hostile5_reveal_2')+'.png';jump5.classList.remove('hidden');equipmentPaint5();await new Promise(r=>setTimeout(r,950));ui.fade.classList.add('on');await new Promise(r=>setTimeout(r,390));jump5.classList.add('hidden');loadCheckpoint(checkpointSnapshot10?.checkpoint==='wedding'?checkpointSnapshot10:readSave());ui.fade.classList.remove('on');deathBusy5=false;requestLock()}
let navGrid5=null;const navStep5=.5;
function ghostWalk5(x,z){if(!baseWalkable(x,z))return false;return !colliders.some(c=>!(c.climbable&&c.top<.3)&&circleHitsRect(x,z,.27,c))}
function path5(from,to){const W=93,H=121,MINX=-23,MINZ=-56;if(!navGrid5){navGrid5=new Map();for(let iz=0;iz<H;iz++)for(let ix=0;ix<W;ix++){const x=MINX+ix*.5,z=MINZ+iz*.5;if(ghostWalk5(x,z))navGrid5.set(ix+iz*W,{ix,iz,x,z});}}const near=p=>{let best=null,d=Infinity;for(const n of navGrid5.values()){const q=(n.x-p.x)**2+(n.z-p.z)**2;if(q<d){d=q;best=n;}}return best;};const start=near(from),end=near(to);if(!start||!end)return[];const sk=start.ix+start.iz*W,ek=end.ix+end.iz*W,queue=[sk],prev=new Map([[sk,null]]);let at=0;while(at<queue.length){const k=queue[at++];if(k===ek)break;const n=navGrid5.get(k);for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const ix=n.ix+dx,iz=n.iz+dz;if(ix<0||ix>=W||iz<0||iz>=H)continue;const nk=ix+iz*W;if(navGrid5.has(nk)&&!prev.has(nk)){prev.set(nk,k);queue.push(nk);}}}if(!prev.has(ek))return[];const result=[];for(let k=ek;k!==sk;k=prev.get(k))result.push(navGrid5.get(k));return result.reverse();}
let ambienceAt5=0;function updateFloor5(dt,now){if(scene!=='floor5')return;equipmentPaint5();const visible=['world','paused'].includes(mode);spectral5.classList.toggle('hidden',!visible);investigationHint5.classList.toggle('hidden',!cameraOwned5||!visible);investigationHint5.textContent='J · CADERNO'+(flashLeft5>0?'  |  FLASH RECARREGANDO':'');if(mode==='cinematic5'){if(coupleTime5<0)finishCouple5(dt);else updateCouple5(dt);return}if(mode==='dialogue'&&dialogueKind==='ghost5:couple'){const g=sprites.find(s=>s.id==='f5_groom');if(g)g.override5=dialogueLines[dialogueIndex]?.[0]==='NOIVA'?'couple5_3':'couple5_2';return}if(mode!=='world')return;
 flashLeft5=Math.max(0,flashLeft5-dt);photoLeft5=Math.max(0,photoLeft5-dt);cameraPulse5=Math.max(0,cameraPulse5-dt*4);if(now>ambienceAt5){ambienceAt5=now+7600;sound5('ambience',.08);}

 for(const e of enemies5){const sp=sprites.find(s=>s.id==='f5_'+e.id);if(e.purified){if(sp?.purify5>0){sp.purify5=Math.max(0,sp.purify5-dt);sp.fade5=sp.purify5/.8;sp.y+=dt*.7;if(sp.purify5===0)sp.visible=false}continue}if(e.state==='dormant')continue;e.clock+=dt;if(e.state==='reveal'){e.reveal+=dt;if(e.reveal>.8)e.state='chase';continue}e.pathAt-=dt;if(e.pathAt<=0){e.pathAt=.9;e.path=path5(e,player)}const next=e.path[0];if(next){const dx=next.x-e.x,dz=next.z-e.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*1.55);if(d<.06)e.path.shift();else{const nx=e.x+dx/d*step,nz=e.z+dz/d*step;if(ghostWalk5(nx,nz)){e.x=nx;e.z=nz}else e.pathAt=0}}if(sp){sp.x=e.x;sp.z=e.z;}if(Math.hypot(e.x-player.x,e.z-player.z)<.7&&line5(e.x,e.z,player.x,player.z)){killGhost5();break}}
 const g=spectral5.getContext('2d');g.clearRect(0,0,1000,700);for(let i=0;i<35;i++){const x=(i*173+Math.sin(now*.0003+i)*35)%1000,y=(i*73-now*.005+7000)%700;g.fillStyle=i%3?'#c3b2e22a':'#e8dfe93a';g.beginPath();g.arc(x,y,i%3?1:1.8,0,7);g.fill()}}
// v0.12 character direction, equipment, notebook and checkpoint-owned collectibles.
let notebookOwned12=false,ectoplasm12=0,bookSpread12=0,violinSource12=null,violinGain12=null,violinDecode12=null,violinBuffer12=null,repelCooldown12=0,lightningTime12=0,lightningLethal12=false;
const heldBook12=document.createElement('img');heldBook12.src='assets/book12_0.png';heldBook12.alt='Caderno em mãos';heldBook12.className='heldBook12 hidden';document.querySelector('#gameShell').append(heldBook12);
const lightning12=document.createElement('canvas');lightning12.width=1200;lightning12.height=800;lightning12.className='lightning12 hidden';document.querySelector('#gameShell').append(lightning12);
const bookButton12=document.createElement('button');bookButton12.dataset.eq='notebook';bookButton12.innerHTML='<img src="assets/book12_0.png" alt="Caderno"/><b>3</b>';equipment5.insertBefore(bookButton12,equipment5.querySelector('small'));
const configNpc12={bride:[0,-30,0,-27.6],music:[-6.8,-27.9,-6.8,-25],brother:[-19.9,-8.1,-18.6,-7.1],chef:[-20,-26.2,-18,-26.2],cousin:[19,-23,17,-23]};
for(const[id,a]of Object.entries(configNpc12)){Object.assign(F5_NPCS[id],{x:a[0],z:a[1],spawn:a.slice(2),poses:id==='bride'?[1,2,1,2,1,2]:id==='brother'?[1,2,2,2,1,1]:[1,2,1,3,2,1]});}
F5_NPCS.music.poses=[1,2,1,2,1,2];
F5_NPCS.brother.name='IRMÃO MAIS VELHO DO NOIVO';F5_NPCS.brother.lines=F5_NPCS.brother.lines.map(l=>[F5_NPCS.brother.name,l[1]]);
F5_NPCS.bride.lines=[['NOIVA','Você está me olhando... Está mesmo me vendo? Achei que ninguém mais fosse chegar.'],['NOIVA','Nós morávamos aqui no prédio. Meu marido adorava esta capela do hotel. Insistiu que não havia lugar melhor para casar.'],['NOIVA','Vieram os vizinhos, os hóspedes antigos... quase todo mundo conhecia todo mundo. Mais de duzentas pessoas.'],['NOIVA','A luz apagou bem na hora dos votos. Ouvi um grito perto de mim. Depois outro. Quando consegui ver alguma coisa... já era tarde.'],['NOIVA','Minha irmã conseguiu sair. O padre e o coroinha também. Meu marido... eu nunca mais o encontrei.'],['NOIVA','Você pode procurá-lo? Não consigo ir embora sem saber onde ele ficou. Talvez alguém nas outras salas tenha visto alguma coisa.']];
F5_NPCS.music.lines=[['MUSICISTA','Ah. Alguém de carne e osso. Faz tempo que a minha plateia não respira.'],['MUSICISTA','O padre encasquetou com as caixas da banda: queria tudo na sala elétrica, no fim da ala leste. Umidade por todo lado!'],['MUSICISTA','Disse que havia uma despensa vazia. Ele não quis ouvir. E o coroinha ia e voltava daquele corredor.'],['MUSICISTA','Quando as luzes caíram, o primeiro grito veio do altar. Nunca esqueci. O resto virou uma confusão de passos e cadeiras.'],['MUSICISTA','Sabe... falar com alguém vivo me fez lembrar por que eu tocava. Não era pelo contrato. Era pelo que a música fazia com a gente.'],['MUSICISTA','Acho que vou tentar de novo. Vou tocar até esta cerimônia acabar de verdade. Até não sobrar ninguém esperando para ir embora.']];
F5_NPCS.cousin.lines=[['PRIMA DA NOIVA','Ai, que susto! Você chegou de fininho ou eu desaprendi a ouvir gente viva?'],['PRIMA DA NOIVA','Eu estava louca para estrear esta pista. Mas antes fui conversar com o coroinha. Bonitinho, ele. Péssimo de conversa.'],['PRIMA DA NOIVA','Sugeri um cantinho mais quieto: a sala do quadro elétrico. Ele soltou um “lá não” tão seco que até perdi a graça.'],['PRIMA DA NOIVA','Ficou olhando o relógio. Eu falando e ele contando os minutos. Parecia ter um compromisso marcado.'],['PRIMA DA NOIVA','Aí tudo apagou. Ouvi alguém correndo, mas não deu para ver quem. Nem cheguei a dançar.'],['PRIMA DA NOIVA','E eu tinha treinado para pegar o buquê! Se ainda encontrar aquilo por aí, me avisa. Morta, sim. Derrotada, jamais.']];
F5_NPCS.brother.lines=[['IRMÃO MAIS VELHO DO NOIVO','Se veio anunciar o bufê, chegou umas décadas atrasado. Mas pode anunciar. Eu espero.'],['IRMÃO MAIS VELHO DO NOIVO','Sou o irmão mais velho do noivo. Fui padrinho. Nunca vi aquele sujeito tão nervoso... quase colocou a aliança no meu dedo.'],['IRMÃO MAIS VELHO DO NOIVO','Eu estava do lado dele quando apagaram as luzes. Mal deu tempo de perguntar o que houve. Ele caiu nos meus braços.'],['IRMÃO MAIS VELHO DO NOIVO','Segundos. Foi coisa de segundos. Tentei segurá-lo e senti o golpe. Depois disso... acordei assim.'],['IRMÃO MAIS VELHO DO NOIVO','Às vezes ouço meu irmão gritar lá para os fundos. É a voz dele. Mas cheia de uma raiva que ele nunca teve.'],['IRMÃO MAIS VELHO DO NOIVO','Se conseguir chegar perto, diz que eu ainda estou aqui. E que ele continua me devendo um jantar.']];
F5_NPCS.chef.lines=[['COZINHEIRO','Pode entrar. Só não prove nada. Pela aparência, até eu comeria... e eu sei há quanto tempo está aí.'],['COZINHEIRO','Eu trabalhava no restaurante do andar de baixo. Subi para cuidar do casamento destes dois. Gente boa. Mereciam uma festa bonita.'],['COZINHEIRO','Antes de começar, ouvi o padre discutindo com os músicos. Queria as caixas deles na elétrica. Eu ofereci a despensa, vazia. Ele insistiu.'],['COZINHEIRO','O homem consultava o relógio a cada minuto. Depois veio o apagão, a gritaria... Não vi quem entrou na cozinha.'],['COZINHEIRO','Meu menino ficou em casa. Era deste tamanhinho. Gostava de sentar no balcão para me ver cozinhar.'],['COZINHEIRO','Se algum dia descobrir o que foi feito dele, me conta? Não precisa trazer notícia boa. Só... alguma notícia.']];
delete F5_NPCS.echo;delete F5_NPCS.porter;
F5_NPCS.younger={name:'IRMÃO MAIS NOVO DO NOIVO',x:-20.5,z:-36.4,h:1.9,tex:'younger12',spawn:[-18.6,-36.4],poses:[1,2,1,3,2],note:'O irmão mais novo morreu no banheiro. Não presenciou o ataque. A vergonha de como morreu ainda o prende aqui.',lines:[['IRMÃO MAIS NOVO DO NOIVO','Fecha a... ah. Não tem mais graça pedir privacidade agora, né?'],['IRMÃO MAIS NOVO DO NOIVO','Sou o irmão mais novo do noivo. E antes que pergunte: não vi merda nenhuma naquela chacina. Só a da privada.'],['IRMÃO MAIS NOVO DO NOIVO','Eu estava cagando. No casamento do meu irmão. E morri cagando. Você tem ideia da humilhação?'],['IRMÃO MAIS NOVO DO NOIVO','Podia ter sido salvando alguém. Lutando. Qualquer coisa! Mas não. Me pegaram de calça arriada. Literalmente.'],['IRMÃO MAIS NOVO DO NOIVO','Como é que uma alma descansa sabendo que vai ser lembrada assim? Não conta para o meu irmão. O mais velho, principalmente.']]};
F5_NPCS.witch={name:'???',x:20.6,z:-8.5,h:2.08,tex:'witch12',spawn:[18.6,-8.5],poses:[1,2,3],note:'Uma mulher no banheiro feminino se recusou a dizer o nome e desapareceu rindo. Ela parecia saber mais do que queria contar.',lines:[['???','O que foi? Está achando que vou dizer quem sou e o que vi, igual a todo mundo?'],['???','Hahahaha! Você é uma graça.'],['???','Vai. Tem gente precisando de você. Se quiser mesmo me conhecer... me encontre outra vez.']]};
const witchLines12=[['???','Uau. Conseguiu me encontrar. E de brinde desvendou quem era o assassino. Que homem, hein.'],['???','Queria saber sobre mim, né, gatinho?'],['BRUXA','Sou uma bruxa. Mas não precisa se assustar: não transformo um homem em poção há décadas. Hahahaha.'],['BRUXA','Quanto ao caso... eu sempre soube quem era o assassino. Mas você acha que um padre velho mataria mais de duzentas pessoas sozinho, sem enxergar nada?'],['BRUXA','É. Mataria, sim. Foi o que ele fez, afinal.'],['BRUXA','Eu enxergava naquela escuridão, graças à magia deste pingente. E o que vi não era só um velho armado.'],['BRUXA','Pouco antes de eu morrer... havia alguma coisa nele. Pior que qualquer fantasma corrompido que você já encontrou.'],['BRUXA','Aquilo devia ser o próprio demônio...']];
function placeNpcs12(){const w=F5_NPCS.witch,second=(wedding5.witchStage||0)>=1;Object.assign(w,{x:second?21.6:20.6,z:second?-51.3:-8.5,spawn:second?[20,-50.5]:[18.6,-8.5],name:wedding5.witchStage===2?'BRUXA':'???'});}
hostileDefs5.splice(0,hostileDefs5.length,...[[-7.6,-3],[8,-11],[-8,-20],[8,-32],[-12,-7],[-12,-22],[-12,-30],[-18,-18],[-16,-23],[-16,-38],[12,-7],[12,-18],[12,-31],[17,-19],[21,-27],[18.5,-38],[11.8,-38.7],[20.5,-42]].map((p,i)=>({id:'h'+i,x:p[0],z:p[1]})));
function syncCursor12(){const free=!['world','dialogue','cinematic5','dead','pickup','elevator'].includes(mode);document.querySelector('#gameShell').classList.toggle('pointerLocked12',!!document.pointerLockElement&&!free);if(free&&document.pointerLockElement)document.exitPointerLock();if(!story.hasScrewdriver){ui.hand.classList.add('hidden');ui.itemHud.classList.add('hidden');}}
requestLock=function(){if(mode!=='world'||!canvas.requestPointerLock||document.pointerLockElement===canvas)return;try{const p=canvas.requestPointerLock();if(p?.then)p.then(()=>syncCursor12()).catch(()=>{})}catch(e){}};
equip5=function(kind){if(!['screwdriver','camera','notebook'].includes(kind)||kind==='screwdriver'&&!story.hasScrewdriver||kind==='camera'&&!cameraOwned5||kind==='notebook'&&!notebookOwned12)return;if(scene==='floor4'&&(kitchen4.held||kitchen4.plate))return;equipped5=kind;equipmentPaint5();if(kind==='notebook')showCaption('','CADERNO · ESQUERDO: ABRIR · DIREITO: FECHAR',2600)};
equipmentPaint5=function(){const visible=cameraOwned5&&['world','paused'].includes(mode);equipment5.classList.toggle('hidden',!visible);heldCamera5.classList.toggle('hidden',!visible||equipped5!=='camera');heldBook12.classList.toggle('hidden',!visible||equipped5!=='notebook');if(cameraOwned5||!story.hasScrewdriver){ui.itemHud.classList.add('hidden');ui.hand.classList.toggle('hidden',!story.hasScrewdriver||equipped5!=='screwdriver'||!['world','paused'].includes(mode));}equipment5.querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',b.dataset.eq===equipped5);b.classList.toggle('hidden',b.dataset.eq==='notebook'&&!notebookOwned12||b.dataset.eq==='screwdriver'&&!story.hasScrewdriver)});equipment5.querySelector('i').style.transform=`scaleX(${clamp(1-flashLeft5/3.8,0,1)})`;const t=`translateY(${Math.sin(player.bob)*player.bobAmt*150+cameraPulse5*24}px)`;heldCamera5.style.transform=t;heldBook12.style.transform=t;syncCursor12()};
objective5=function(){setObjective(wedding5.power?'Volte para o elevador':wedding5.cleared?'Ligue o disjuntor na elétrica':!cameraOwned5?'Explore a capela · pegue a câmera e o caderno':!wedding5.heard.includes('bride')?'Fotografe o altar e descubra quem está chorando':mainIds5.every(id=>wedding5.heard.includes(id))?'Confronte o espírito na elétrica · ala leste':'Investigue a última noite · '+mainIds5.filter(id=>wedding5.heard.includes(id)).length+'/5 testemunhos');};
const saveWeddingBefore12=saveWedding5;saveWedding5=function(npc=null){saveWeddingBefore12(npc);const d=JSON.parse(JSON.stringify(checkpointSnapshot10));d.version=6;d.layout=12;d.notebookOwned=notebookOwned12;d.ectoplasm=ectoplasm12;checkpointSnapshot10=d;try{localStorage.setItem(SAVE_KEY,JSON.stringify(d))}catch(e){showCaption('','Não foi possível gravar seu progresso.',2200)}};
const loadBefore12=loadCheckpoint;loadCheckpoint=function(data){stopViolin12();notebookOwned12=data?.checkpoint==='wedding'&&(data.notebookOwned??data.cameraOwned);ectoplasm12=Math.max(0,Math.floor(Number(data?.ectoplasm)||0));if(data?.checkpoint!=='wedding'){ectoplasm12=0;notebookOwned12=false;heldBook12.classList.add('hidden');return loadBefore12(data)}const d=JSON.parse(JSON.stringify(data));d.wedding={...freshWedding5(),...d.wedding};for(const k of['heard','revealed'])d.wedding[k]=(d.wedding[k]||[]).filter(id=>F5_NPCS[id]);wedding5=d.wedding;placeNpcs12();if(d.wedding.checkpointNpc&&!F5_NPCS[d.wedding.checkpointNpc])d.wedding.checkpointNpc=null;if(!d.layout||d.layout<12){const id=d.wedding.checkpointNpc,n=F5_NPCS[id];d.wedding.spawn=d.wedding.power?[18.5,-52]:d.wedding.cleared?[18.5,-47.8]:n?[...n.spawn]:[0,1.4];d.wedding.yaw=d.wedding.power?Math.PI:0;d.wedding.purged=[];}const result=loadBefore12(d);equipped5=d.equipment==='notebook'&&notebookOwned12?'notebook':equipped5;repelCooldown12=0;repelView12=0;lightningTime12=0;lightning12.classList.add('hidden');if(!walkable(player.x,player.z)){player.x=0;player.z=1.4;}renderInventory();equipmentPaint5();startViolin12();return result};
const resetBefore12=resetFloor5;resetFloor5=function(){notebookOwned12=false;ectoplasm12=0;repelCooldown12=0;stopViolin12();resetBefore12()};
const invBefore12=renderInventory;renderInventory=function(){invBefore12();if(ectoplasm12>0){ui.inventorySlots.querySelector('.inventoryEmpty')?.remove();const el=document.createElement('div');el.className='inventorySlot ectoplasm12';el.innerHTML='<i aria-hidden="true"></i><span>ECTOPLASMA × '+ectoplasm12+'</span>';el.title='Resíduo dos espíritos corrompidos que você purificou.';ui.inventorySlots.append(el)}};
const useBefore12=interactFloor5;interactFloor5=function(id){if(id==='f5_camera'){if(cameraOwned5)return;cameraOwned5=notebookOwned12=true;equipped5='camera';sprites=sprites.filter(s=>s.id!=='f5_camera');objects=objects.filter(o=>!o.pickupBook12);clearBatches5();sound5('shutter',.3);equipmentPaint5();objective5();saveWedding5();showCaption('','CÂMERA + CADERNO COLETADOS · SCROLL troca equipamento · 2 câmera · 3 caderno',6500);return}if(id==='f5_breaker')equip5('screwdriver');return useBefore12(id)};
talkNpc5=function(id){const n=F5_NPCS[id];if(!n)return;const first=!wedding5.heard.includes(id),witchSecond=id==='witch'&&wedding5.witchStage===1;const repeat={bride:'Ele sempre perdia as coisas. Chaves, relógio... Agora fui eu que o perdi.',music:'Pode continuar procurando. Vou tocar um pouco. Assim ninguém precisa ficar neste silêncio.',cousin:'Eu devia ter desconfiado. Quem troca uma conversa comigo por um relógio?',brother:'Ainda por aqui? Se achar meu irmão, não esquece o que eu pedi.',chef:'A cozinha está vazia faz tanto tempo... Obrigado pela visita.',younger:'Você não contou para ninguém, contou? Eu estou morto, mas ainda tenho uma reputação. Ao menos tinha.',witch:'Eu já disse o que vi. Quer mais o quê? Que eu te possua? Hahahaha.'};let lines=witchSecond?witchLines12:first?n.lines:[[n.name,repeat[id]]];startDialogue('ghost5:'+id,lines,()=>{if(first)wedding5.heard.push(id);if(id==='witch'&&first){wedding5.witchStage=1;wedding5.revealed=wedding5.revealed.filter(x=>x!=='witch');saveWedding5('witch');placeNpcs12();const s=sprites.find(s=>s.id==='f5_witch');if(s){s.x=n.x;s.z=n.z;s.visible=false;}const it=interactables.find(t=>t.id==='f5_witch');if(it){it.x=n.x;it.z=n.z;}sound5('reveal',.25,.75);}else if(witchSecond){wedding5.witchStage=2;placeNpcs12();saveWedding5('witch');}else if(first)saveWedding5(id);if(first||witchSecond)showCaption('','CHECKPOINT · conversa registrada no caderno',2300);if(id==='music')startViolin12();objective5();equipmentPaint5()})};
function npcPose12(id){const n=F5_NPCS[id];if(mode==='dialogue'&&dialogueKind==='ghost5:'+id){const p=n.poses||[1,2];return p[dialogueIndex%p.length]}return id==='music'&&wedding5.heard.includes('music')?3:0;}
const flashBefore12=flash5;flash5=function(){const before=new Set(wedding5.purged||[]),result=flashBefore12();if(scene==='floor5'&&result){const added=wedding5.purged.filter(id=>!before.has(id)).length;if(added){ectoplasm12+=added;renderInventory();showCaption('','ECTOPLASMA +'+added+' · '+ectoplasm12+' no inventário',1700)}}return result};
function stopViolin12(){if(violinSource12){try{violinSource12.stop()}catch(e){}violinSource12.disconnect();violinSource12=null;}violinGain12?.disconnect();violinGain12=null;}
async function startViolin12(){if(scene!=='floor5'||!wedding5.heard?.includes('music')||!sfx.ctx||violinSource12)return;if(!violinDecode12)violinDecode12=(async()=>{const bytes=await (await fetch(window.PREDIO_VIOLIN_12)).arrayBuffer();violinBuffer12=await sfx.ctx.decodeAudioData(bytes)})();await violinDecode12;if(scene!=='floor5'||!wedding5.heard.includes('music')||violinSource12)return;const src=sfx.ctx.createBufferSource(),gain=sfx.ctx.createGain();src.buffer=violinBuffer12;src.loop=true;src.connect(gain);gain.connect(sfx.master);gain.gain.value=.15;src.start();violinSource12=src;violinGain12=gain;}
function volumeViolin12(){if(scene!=='floor5'){stopViolin12();return}if(wedding5.heard?.includes('music')&&!violinSource12)startViolin12();if(violinGain12){const d=Math.hypot(player.x-F5_NPCS.music.x,player.z-F5_NPCS.music.z);violinGain12.gain.setTargetAtTime(.045+.34/(1+(d/7)**1.5),sfx.ctx.currentTime,.25)}}
function bookEntries12(){const ids=wedding5.heard||[],a=ids.filter(id=>F5_NPCS[id]).map(id=>({id,name:F5_NPCS[id].name,note:id==='witch'&&wedding5.witchStage===2?'Ela se revelou uma bruxa. O pingente permitia enxergar no escuro. Viu algo demoníaco no padre durante o massacre. O que estava dentro dele?':F5_NPCS[id].note,done:id==='bride'&&wedding5.cleared}));if(wedding5.cleared)a.push({id:'groom',name:'NOIVO',note:'O padre atacou; o coroinha apagou as luzes. Ao ouvir a verdade, ele se lembrou da esposa. Os dois partiram juntos.',done:true});return a;}
function paintBook12(){notebook5.replaceChildren();notebook5.className='notebook5 bookOpen12';const nav=document.createElement('nav');nav.className='bookmarks12';['✦','?','?','?'].forEach((v,i)=>{const b=document.createElement('button');b.textContent=v;b.disabled=i>0;b.title=i?'Ainda não há anotações nesta seção':'Fantasmas';b.setAttribute('aria-label',b.title);b.onclick=()=>{bookSpread12=0;paintBook12()};nav.append(b)});notebook5.append(nav);const entries=bookEntries12(),pages=Math.max(1,Math.ceil(entries.length/2));bookSpread12=clamp(bookSpread12,0,pages-1);const leaves=document.createElement('div');leaves.className='bookLeaves12';for(let i=0;i<2;i++){const page=document.createElement('article');page.className='bookPage12';const n=entries[bookSpread12*2+i];const small=document.createElement('small');small.textContent=i?'TESTEMUNHOS · BELLEVUE':'A ÚLTIMA NOITE';page.append(small);const h=document.createElement('h2');h.textContent=n?n.name:entries.length?'Ainda há histórias por ouvir.':'Quem ficou nesta noite?';page.append(h);const p=document.createElement('p');p.textContent=n?n.note:entries.length?'Nem toda alma está presa pelo mesmo motivo.':'A câmera revela presenças invisíveis. Preciso fotografar o altar e conversar com quem ficou aqui.';page.append(p);if(n?.done){page.classList.add('released12');const stamp=document.createElement('strong');stamp.textContent='Encontrou a paz';page.append(stamp)}else if(n){const p2=document.createElement('em');p2.textContent=['bride','music','cousin','brother','chef'].includes(n.id)?'Ouvido e anotado.':'Uma história para voltar a visitar.';page.append(p2)}const num=document.createElement('footer');num.textContent=String(bookSpread12*2+i+1).padStart(2,'0');page.append(num);leaves.append(page)}notebook5.append(leaves);const controls=document.createElement('div');controls.className='bookControls12';const prev=document.createElement('button');prev.textContent='← Anterior';prev.disabled=bookSpread12===0;prev.onclick=()=>{bookSpread12--;paintBook12();sfx.click()};const count=document.createElement('span');count.textContent=(bookSpread12+1)+' / '+pages;const next=document.createElement('button');next.textContent='Próxima →';next.disabled=bookSpread12===pages-1;next.onclick=()=>{bookSpread12++;paintBook12();sfx.click()};const close=document.createElement('button');close.textContent='Fechar · botão direito';close.onclick=closeNotebook5;controls.append(prev,count,next,close);notebook5.append(controls)}
openNotebook5=function(){if(mode!=='world'||!notebookOwned12||equipped5!=='notebook')return;mode='notebook5';for(const k of Object.keys(keys))keys[k]=false;if(document.pointerLockElement)document.exitPointerLock();paintBook12();equipmentPaint5()};
function lightningBurst12(lethal){lightningLethal12=lethal;lightningTime12=lethal?1.25:.65;lightning12.classList.remove('hidden');sound5('attack',lethal?.75:.4,lethal?.8:1.3);gazeDisturbance=lethal?1:.6;}
function drawLightning12(dt){if(lightningTime12<=0){lightning12.classList.add('hidden');return}lightningTime12=Math.max(0,lightningTime12-dt);const g=lightning12.getContext('2d'),w=1200,h=800,t=lightningTime12;g.clearRect(0,0,w,h);const q=g.createRadialGradient(w*.5,h*.6,20,w*.5,h*.6,800);q.addColorStop(0,'#ed163611');q.addColorStop(1,'#71031599');g.fillStyle=q;g.fillRect(0,0,w,h);g.lineJoin='round';for(let j=0;j<(lightningLethal12?5:3);j++){const points=[[w*(.2+j*.16),0]];for(let i=1;i<9;i++)points.push([w*.5+Math.sin(i*19+j*8+t*45)*180*(1-i/10),i*h*.115]);for(const[width,color]of[[18,'#df053144'],[7,'#ed1735'],[2,'#ffe5df']]){g.strokeStyle=color;g.lineWidth=width;g.beginPath();points.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.stroke();}}lightning12.style.opacity=String(Math.min(1,t*4));}
const ordinaryDeath12=killGhost5;killGhost5=async function(boss=false){if(!boss)return ordinaryDeath12(false);if(deathBusy5||scene!=='floor5')return;deathBusy5=true;mode='dead';++typingToken;for(const el of[ui.dialogue,ui.caption,deduction5,notebook5,letterbox5,ui.crosshair])el.classList.add('hidden');for(const k of Object.keys(keys))keys[k]=false;if(document.pointerLockElement)document.exitPointerLock();lightningBurst12(true);equipmentPaint5();await new Promise(r=>setTimeout(r,1050));ui.fade.classList.add('on');await new Promise(r=>setTimeout(r,550));loadCheckpoint(checkpointSnapshot10?.checkpoint==='wedding'?checkpointSnapshot10:readSave());ui.fade.classList.remove('on');deathBusy5=false;requestLock()};
function repel12(){if(wedding5.cleared||repelCooldown12>0)return;wedding5.groomSeen=true;const s=sprites.find(s=>s.id==='f5_groom');if(s)s.visible=true;repelCooldown12=2;lightningBurst12(false);repelView12=Math.min(0,player.z+42.15);player.x=18.5;player.z=-42.15;player.jumpY=player.yVel=0;player.yaw=0;player.pitch=-.08;showCaption('ESPÍRITO','SAIA! NÃO ENTRE AQUI!',2200);objective5();}
let repelView12=0;
let reunionPath12=[],reunionDistance12=0,reunionDuration12=0;
startCouple5=function(){wedding5.cleared=true;colliders=colliders.filter(c=>c.id!=='ward5');navGrid5=null;mode='cinematic5';setObjective('');ui.caption.classList.add('hidden');coupleTime5=.001;letterbox5.classList.remove('hidden');ui.hand.classList.add('hidden');heldCamera5.classList.add('hidden');heldBook12.classList.add('hidden');ui.interact.classList.add('hidden');ui.crosshair.classList.add('hidden');sound5('purify',.4);reunionPath12=path5({x:0,z:-30},{x:18.5,z:-45.8});reunionDistance12=reunionPath12.reduce((s,p,i)=>s+(i?Math.hypot(p.x-reunionPath12[i-1].x,p.z-reunionPath12[i-1].z):0),0);reunionDuration12=Math.max(5,reunionDistance12/5.2);const groom=sprites.find(s=>s.id==='f5_groom');if(groom){groom.visible=true;groom.override5='groom5_0';groom.h=2.2}const bride=sprites.find(s=>s.id==='f5_bride');if(bride)bride.visible=false;};
function routePosition12(distance){for(let i=1;i<reunionPath12.length;i++){const a=reunionPath12[i-1],b=reunionPath12[i],d=Math.hypot(b.x-a.x,b.z-a.z);if(distance<=d)return{x:lerp(a.x,b.x,distance/d),z:lerp(a.z,b.z,distance/d)};distance-=d;}return reunionPath12.at(-1)||{x:18.5,z:-45.8}}
updateCouple5=function(dt){coupleTime5+=dt;const groom=sprites.find(s=>s.id==='f5_groom'),bride=sprites.find(s=>s.id==='f5_bride'),end=1.7+reunionDuration12;if(coupleTime5>1.7&&coupleTime5<end){const p=routePosition12((coupleTime5-1.7)*5.2);if(bride){bride.visible=true;bride.override5='bride5_3';bride.h=2.0;bride.x=p.x;bride.z=p.z;bride.y=Math.abs(p.x)<4&&p.z<-28.5?.2:.03;}}if(coupleTime5>=end&&coupleTime5<end+1.6){if(bride)bride.visible=false;if(groom)groom.override5='groom5_2';}if(coupleTime5>=end+1.6){if(groom)groom.override5='couple5_1';coupleTime5=0;startDialogue('ghost5:couple',[['NOIVA','Eu ouvi você me chamar. Achei que nunca mais...'],['NOIVO','Eu estava aqui. Só não conseguia lembrar como voltar.'],['NOIVA','Obrigada. Por procurar. Por não deixar a gente sozinho.'],['NOIVO','Os outros ainda têm suas próprias histórias. Se puder, volte por eles.'],['NOIVA','Agora vem. Estão nos esperando.']],()=>{mode='cinematic5';coupleTime5=-2.8})}};
finishCouple5=function(dt){coupleTime5=Math.min(0,coupleTime5+dt);const g=sprites.find(s=>s.id==='f5_groom');if(g){g.y=.15+(2.8+coupleTime5)*.6;g.fade5=-coupleTime5/2.8}if(coupleTime5===0){sprites=sprites.filter(s=>!['f5_groom','f5_bride'].includes(s.id));mode='world';letterbox5.classList.add('hidden');ui.crosshair.classList.remove('hidden');wedding5.spawn=[18.5,-47.8];wedding5.yaw=0;Object.assign(player,{x:18.5,z:-47.8,yaw:0,pitch:0,floorY:0,jumpY:0});saveWedding5();objective5();equipmentPaint5();requestLock()}};
completeBreaker5=function(){if(wedding5.power)return;wedding5.power=true;sfx.power();powerFlicker=.9;ui.breaker.classList.add('hidden');mode='world';wedding5.spawn=[18.5,-52];wedding5.yaw=Math.PI;saveWedding5();objective5();requestLock();showCaption('','CLACK. As luzes das alas e o elevador voltaram.',2500)};
let arcTick12=0;
function roomArcs12(dt){arcTick12-=dt;if(arcTick12>0)return;arcTick12=.11;objects=objects.filter(o=>!o.arc12);if(wedding5.cleared)return;for(let j=0;j<3;j++){let a=[18.5,1.4,-46.1];for(let i=1;i<=5;i++){const b=[18.5+Math.sin(j*2.1+i*.9+performance.now()*.014)*i*.32,1.4+Math.cos(j*2+i)*i*.24,-46.1+Math.sin(i+j)*.6];beam12(a,b,.018,'white',[1,.025,.06]);Object.assign(objects.at(-1),{arc12:true,dynamic12:true,emissive:1});a=b;}}}
const floorUpdateBefore12=updateFloor5;updateFloor5=function(dt,now){if(scene!=='floor5')return;drawLightning12(dt);roomArcs12(dt);volumeViolin12();repelView12*=Math.exp(-dt*13);repelCooldown12=Math.max(0,repelCooldown12-dt);for(const o of objects)if(o.wingLight12){o.emissive=wedding5.power?.9:.05;o.tint=wedding5.power?[1,.83,.59]:[.26,.27,.32];}if(mode==='world'&&!wedding5.cleared&&wedding5.electricUnlocked13&&doors13.electric?.open&&player.x>14&&player.z<-43.7)repel12();floorUpdateBefore12(dt,now);investigationHint5.textContent=equipped5==='notebook'?'ESQUERDO · ABRIR CADERNO':equipped5==='camera'?'DIREITO · FOTOGRAFAR   ESQUERDO · FLASH'+(flashLeft5>0?' · '+flashLeft5.toFixed(1)+'s':''):'SCROLL · EQUIPAMENTOS';};
const viewBefore12=viewData;viewData=function(){if(scene!=='floor5')return viewBefore12();let eye=[player.x,player.eye+player.floorY+player.jumpY+player.bobOffset,player.z],f=[Math.sin(player.yaw)*Math.cos(player.pitch),Math.sin(player.pitch),-Math.cos(player.yaw)*Math.cos(player.pitch)];if(mode==='cinematic5'||mode==='dialogue'&&dialogueKind==='ghost5:couple'){let center=[18.5,1.3,-46.1];eye=[19.9,1.8,-43.5];if(coupleTime5>1.7&&coupleTime5<1.7+reunionDuration12){const p=routePosition12((coupleTime5-1.7)*5.2),ahead=routePosition12(Math.min(reunionDistance12,(coupleTime5-1.7)*5.2+2.5));center=[p.x,1.2,p.z];eye=[ahead.x,1.75,ahead.z];if(Math.hypot(eye[0]-p.x,eye[2]-p.z)<1){eye=[19.9,1.7,-43.5];}}const d=Math.hypot(...center.map((v,i)=>v-eye[i]));f=center.map((v,i)=>(v-eye[i])/Math.max(.01,d));}if(mode==='world')eye[2]+=repelView12;if(lightningTime12>0){eye[0]+=Math.sin(performance.now()*.071)*.045*lightningTime12;eye[1]+=Math.sin(performance.now()*.099)*.045*lightningTime12;}const v=M.lookAt(eye,eye.map((x,i)=>x+f[i]),[0,1,0]);return{eye,f,vp:M.multiply(M.perspective(70*Math.PI/180,canvas.width/canvas.height,.04,95),v)}};
baseWalkable=function(x,z){if(scene!=='floor5')return base5(x,z);return(Math.abs(x)<9.83&&z<2.83&&z>-33.83)||(Math.abs(x)>9.65&&Math.abs(x)<22.83&&z<-5.16&&z>-39.84)||(x>10.16&&x<22.83&&z<-39.6&&z>-43.84)||(x>14.16&&x<22.83&&z<-43.65&&z>-53.83)};
currentCeilingBottom=function(){if(scene!=='floor5')return ceil5();return player.z<-44?3.6:player.z<-40?3.3:Math.abs(player.x)>10?4:8.35-Math.abs(player.x)*.32};
setCommon=function(v){common5(v);gl.uniform1f(loc.uOpacity5,1);if(scene!=='floor5')return;const side=Math.abs(player.x)>10,dirty=player.z<-40,t=performance.now()*.001;gl.uniform1f(loc.uAmbient,wedding5.power?(side?.54:.46):dirty?.18:side?.25:.43);gl.uniform3fv(loc.uLightTint,new Float32Array(side?[.69,.76,.92]:[1,.86,.72]));gl.uniform1f(loc.uFlash,side?.2:0);gl.uniform3fv(loc.uFogColor,new Float32Array([.016,.017,.028]));gl.uniform1f(loc.uFogDensity,side?.013:.009);let lamps=[-5,-15,-25].map(z=>({p:[0,4.6,z],c:[2.8,1.65,.75]}));if(side)lamps=wingLamps12.map(p=>({p,c:wedding5.power?[1.5,1.25,.85]:[.12,.17,.28]}));if(side&&player.x>14&&player.z<-34&&player.z>-40)lamps.unshift({p:[21.8,1.5,-36.8],c:[1.2,.66,.32]});if(dirty&&!wedding5.cleared)lamps.push({p:[18.5,2,-46],c:[2.5+.8*Math.sin(t*15),.045,.11]});if(lightningTime12>0)lamps.unshift({p:[player.x,1.7,player.z-1],c:[5,.03,.03]});lamps.sort((a,b)=>Math.hypot(a.p[0]-player.x,a.p[2]-player.z)-Math.hypot(b.p[0]-player.x,b.p[2]-player.z));while(lamps.length<3)lamps.push({p:[0,0,0],c:[0,0,0]});gl.uniform3fv(loc['uLocalPos[0]'],new Float32Array(lamps.slice(0,3).flatMap(l=>l.p)));gl.uniform3fv(loc['uLocalColor[0]'],new Float32Array(lamps.slice(0,3).flatMap(l=>l.c)))};
ui.play.addEventListener('click',()=>{cameraOwned5=notebookOwned12=false;ectoplasm12=0;equipped5='screwdriver';story.hasScrewdriver=false;stopViolin12();equipmentPaint5()},true);
window.addEventListener('wheel',e=>{if(cameraOwned5&&mode==='world'){e.preventDefault();const list=['screwdriver','camera',...(notebookOwned12?['notebook']:[])];equip5(list[(list.indexOf(equipped5)+(e.deltaY>=0?1:list.length-1))%list.length]);}},{passive:false});
window.addEventListener('keydown',e=>{if(e.repeat)return;if(mode==='notebook5'&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeNotebook5();return}if(mode==='notebook5'&&['ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();bookSpread12+=e.code==='ArrowRight'?1:-1;paintBook12();return}if(cameraOwned5&&mode==='world'&&['Digit1','Digit2','Digit3'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();equip5(['screwdriver','camera','notebook'][Number(e.code.slice(-1))-1]);}},true);
window.addEventListener('mousedown',e=>{if(mode==='notebook5'&&e.button===2){e.preventDefault();e.stopImmediatePropagation();closeNotebook5();return}if(e.target!==canvas||!cameraOwned5||mode!=='world'||equipped5==='screwdriver'||![0,2].includes(e.button))return;e.preventDefault();e.stopImmediatePropagation();sfx.unlock();if(document.pointerLockElement!==canvas){requestLock();return}if(equipped5==='notebook'){if(e.button===0)openNotebook5();return}e.button===2?photo5():flash5();},true);
window.addEventListener('contextmenu',e=>{if(mode==='notebook5'||cameraOwned5&&mode==='world')e.preventDefault()});equipment5.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(mode==='world')equip5(b.dataset.eq)});

// v0.13 — tangible doors, the confessional key, paper notes and returning souls.
let doors13={},curtainParts13=[],keyParts13=[],curtainProgress13=0;
sign12=function(){};
function sinkWall13(x,z){const oi=objects.length,ci=colliders.length;sink12(0,0);for(const o of objects.slice(oi)){o.x=x-o.x;o.z=z-o.z;o.rotY=(o.rotY||0)+Math.PI;}for(const c of colliders.slice(ci)){c.x=x-c.x;c.z=z-c.z;}solidRect(x,z,1.14,.72,1.08,false,'basin13');}
function state13(){wedding5.doors13||={};wedding5.respawns13||={};if(wedding5.electricUnlocked13===undefined)wedding5.electricUnlocked13=!!wedding5.cleared;for(const id of wedding5.purged)if(wedding5.respawns13[id]===undefined)wedding5.respawns13[id]=180;}
function textures13(){if(textures.rust13)return;texture4('rust13','#394342',g=>{for(let i=0;i<13000;i++){g.fillStyle=['#9a53263b','#26190f55','#c3804233','#82918518'][i%4];g.fillRect(rnd()*512,rnd()*512,1+rnd()*9,1+rnd()*4)}g.strokeStyle='#172021';g.lineWidth=5;g.strokeRect(11,11,490,490);for(const x of[24,488])for(const y of[24,488]){g.fillStyle='#b0a089';g.beginPath();g.arc(x,y,5,0,7);g.fill();}});
 for(const [name,color,kind]of[['male13','#346cba','man'],['female13','#ae3c4b','woman'],['danger13','#ddae38','danger']])texture4(name,'#26282b',g=>{g.fillStyle=color;g.fillRect(16,16,480,480);g.strokeStyle='#e9e5d3';g.lineWidth=7;g.strokeRect(29,29,454,454);g.fillStyle='#f2eadb';if(kind==='danger'){g.fillStyle='#292623';g.beginPath();g.moveTo(256,64);g.lineTo(462,430);g.lineTo(50,430);g.closePath();g.fill();g.fillStyle='#e5bc48';g.beginPath();g.moveTo(275,149);g.lineTo(198,294);g.lineTo(263,280);g.lineTo(238,388);g.lineTo(329,238);g.lineTo(267,251);g.closePath();g.fill();}else{g.beginPath();g.arc(256,113,37,0,7);g.fill();g.lineCap='round';g.strokeStyle='#f2eadb';g.lineWidth=32;g.beginPath();g.moveTo(211,188);g.lineTo(178,291);g.moveTo(301,188);g.lineTo(334,291);g.moveTo(231,297);g.lineTo(231,413);g.moveTo(281,297);g.lineTo(281,413);g.stroke();if(kind==='woman'){g.beginPath();g.moveTo(228,174);g.lineTo(284,174);g.lineTo(326,323);g.lineTo(186,323);g.closePath();g.fill();}else g.fillRect(214,173,84,144);}});
 texture4('linen13','#a79a89',g=>{for(let i=0;i<512;i+=3){g.fillStyle=i%2?'#e5d9bc19':'#49382b18';g.fillRect(i,0,1,512);g.fillRect(0,i,512,1)}for(let i=0;i<400;i++){g.fillStyle='#58493312';g.fillRect(rnd()*512,rnd()*512,1+rnd()*7,1+rnd()*12)}});
}
function addDoor13(id,x,z,width,closed,opened,tex,icon){const d={id,x,z,width,closed,opened,open:!!wedding5.doors13[id],angle:0,parts:[]};d.angle=d.open?opened:closed;doors13[id]=d;const part=(xx,y,zz,w,h,dep,t,opts={})=>{box(xx,y,zz,w,h,dep,t,[1,1,1],[1,1],{dynamic12:true,...opts});const o=objects.at(-1);d.parts.push({o,x:xx,y,z:zz});};part(width/2,1.43,0,width,2.86,.12,tex);for(const xx of[.10,width-.1])part(xx,1.43,.075,.06,2.65,.035,'brass');for(const y of[.18,2.68])part(width/2,y,.075,width-.15,.06,.04,'brass');for(const y of[.65,2.1])part(.025,y,0,.14,.22,.21,'rust13');for(const face of[-1,1]){part(width-.26,1.12,face*.13,.31,.045,.045,'brass');part(width-.39,1.12,face*.1,.05,.13,.08,'brass');part(width/2,1.94,face*.072,.45,.57,.022,icon);}
 interactables.push({id:'f5_door13_'+id,x:x+Math.cos(closed)*width*.5,z:z-Math.sin(closed)*width*.5,range:2.8,label:'ABRIR PORTA',custom13:true});poseDoor13(d);return d;}
function poseDoor13(d){const c=Math.cos(d.angle),s=Math.sin(d.angle);for(const p of d.parts){Object.assign(p.o,{x:d.x+c*p.x+s*p.z,y:p.y,z:d.z-s*p.x+c*p.z,rotY:d.angle});}const target=interactables.find(t=>t.id==='f5_door13_'+d.id);if(target){target.x=d.x+c*(d.width-.30);target.z=d.z-s*(d.width-.30);}const id='door13_'+d.id;colliders=colliders.filter(r=>r.id!==id);spriteOccluders=spriteOccluders.filter(r=>r.id!==id);const x=d.x+c*d.width/2,z=d.z-s*d.width/2,w=Math.abs(c)*d.width+Math.abs(s)*.13,dep=Math.abs(s)*d.width+Math.abs(c)*.13;solidRect(x,z,w,dep,2.86,false,id);occluderRect(x,z,w,dep,id);}
function checkpointHere13(){wedding5.spawn=[player.x,player.z];wedding5.yaw=player.yaw;saveWedding5();}
function toggleDoor13(id){const d=doors13[id];if(!d)return;if(id==='electric'&&!wedding5.electricUnlocked13){if(!inventory.includes('electricKey13')){showCaption('','Trancada. A chave deve ter ficado com alguém da capela.',3200);sfx.click();return;}inventory=inventory.filter(i=>i!=='electricKey13');wedding5.electricUnlocked13=true;renderInventory();showCaption('','A chave gira com dificuldade. Fechadura destrancada.',2800);}
 if(d.open&&Math.hypot(player.x-d.x,player.z-d.z)<d.width+.28){showCaption('','Afaste-se um pouco para fechar a porta.',1800);return;}d.open=!d.open;wedding5.doors13[id]=d.open;navGrid5=null;sfx.door();checkpointHere13();}
function buildConfessional13(){const back=-9.68,front=-8.14,z=-1.05;wall12(back,z,.16,3.85,2.85,'panel12');for(const zz of[z-1.94,z+.35,z+1.94]){wall12((back+front)/2,zz,front-back,.11,2.76,'panel12');}box(-8.9,2.87,z,1.85,.17,4.12,'darkwood');box(-8.9,2.99,z,1.68,.10,3.93,'brass',[.55,.42,.25]);for(const zz of[z-1.96,z+.35,z+1.96]){box(front,1.42,zz,.17,2.85,.17,'darkwood');box(front,2.64,zz,.23,.17,.23,'brass');}arch5(front,z-.8,2.1,2.24,.5,'x');arch5(front,z+1.12,1.52,2.24,.5,'x');
 // Seat belongs to the alcove, not a solid box filling the interior.
 prop5(-9.1,.60,z-.79,1.02,.15,1.45,'darkwood');for(const zz of[z-1.32,z-.25])box(-9.2,.28,zz,.09,.55,.09,'darkwood');box(-9.3,1.03,z-.79,.12,.79,1.45,'panel12');box(-9.08,.69,z-.79,.84,.035,1.33,'wine4',[.57,.37,.38]);box(front-.04,1.46,z+1.1,.08,1.7,1.25,'darkwood');for(let j=0;j<9;j++)beam12([front+.015,.7+j*.16,z+.53],[front+.015,1.2+j*.16,z+1.68],.018,'brass',[.4,.33,.24]);
 curtainParts13=[];for(let i=0;i<22;i++){box(front+.035,1.38,z-1.83+i*.094,.075,2.20,.11,'wine4',[.56+(i%2)*.19,.34,.39],[1,2],{dynamic12:true});curtainParts13.push({o:objects.at(-1),z:z-1.83+i*.094});}box(front,2.53,z-.8,.065,.07,2.26,'brass');interactables.push({id:'f5_curtain13',x:front+.14,z:z-.8,range:2.55,label:'ABRIR CORTINA',custom13:true});
 keyParts13=[];if(!wedding5.keyTaken13&&!wedding5.electricUnlocked13){const oi=objects.length;for(let i=0;i<16;i++){const a=i*Math.PI/8,b=(i+1)*Math.PI/8;beam12([-8.98+Math.cos(a)*.09,.737,z-.78+Math.sin(a)*.09],[-8.98+Math.cos(b)*.09,.737,z-.78+Math.sin(b)*.09],.02,'brass',[1.5,1.2,.65]);}box(-8.83,.737,z-.78,.21,.022,.025,'brass',[1.5,1.2,.65]);box(-8.74,.737,z-.73,.025,.022,.09,'brass',[1.5,1.2,.65]);keyParts13=objects.slice(oi);for(const o of keyParts13)o.dynamic12=true;interactables.push({id:'f5_key13',x:-8.89,z:z-.78,range:2.7,label:'PEGAR CHAVE DA ELÉTRICA',custom13:true});}curtainProgress13=wedding5.curtainOpen13?1:0;poseCurtain13();solidRect(-8.9,z+.99,1.55,1.85,2.7,false,'confessional13');}
function poseCurtain13(){const target=interactables.find(t=>t.id==='f5_curtain13');if(target)target.z=-1.85+curtainProgress13*1.88;for(let i=0;i<curtainParts13.length;i++){const {o,z}=curtainParts13[i];o.z=z+curtainProgress13*(1.77-i*.078);o.sz=.11-curtainProgress13*.068;}const id='curtain13';colliders=colliders.filter(r=>r.id!==id);if(curtainProgress13<.85)solidRect(-8.10,-1.85,.08,2.13,2.5,false,id);spriteOccluders=spriteOccluders.filter(r=>r.id!==id);if(curtainProgress13<.85)occluderRect(-8.10,-1.85,.08,2.13,id);}
function buildDressing13(){// Perimeter furniture leaves a three metre route to the service door.
 box(18.5,.018,-37.5,7.8,.025,5.8,'carpet5',[.66,.55,.61],[2,2]);prop5(21.92,.74,-36.85,1.32,.14,3.45,'darkwood');for(const z of[-35.5,-38.15])for(const x of[21.5,22.37])box(x,.36,z,.075,.72,.075,'darkwood');box(22.70,1.82,-36.85,.12,1.85,2.72,'brass',[.6,.45,.28]);box(22.62,1.82,-36.85,.022,1.67,2.52,'mirror12');for(const z of[-35.55,-38.15]){candle5(21.85,z,.85);box(22.1,.92,z+.18,.15,.26,.12,'brass',[.6,.44,.3]);}box(21.8,.855,-36.8,.6,.05,.42,'linen13');flowers12(21.95,-37.55,.84);prop5(20.3,.48,-36.9,.68,.18,.78,'darkwood');box(20.3,.60,-36.9,.69,.12,.79,'wine4');for(const z of[-37.18,-36.62])for(const x of[20.03,20.57])box(x,.21,z,.06,.42,.06,'darkwood');
 prop5(16.7,.34,-34.65,3.5,.18,.87,'darkwood');box(16.7,.50,-34.65,3.4,.17,.88,'linen13',[.77,.69,.71]);box(16.7,.99,-34.37,3.55,.87,.18,'wine4',[.5,.37,.44]);for(const x of[15.04,18.36]){box(x,.74,-34.65,.13,.55,.98,'darkwood');box(x,.16,-34.65,.13,.30,.72,'darkwood');}prop5(22,.36,-41.7,1.25,.72,2.2,'darkwood');box(22,.745,-41.7,1.32,.06,2.25,'linen13',[.57,.51,.45]);for(const z of[-42.5,-40.9])box(21.33,.37,z,.025,.35,.085,'brass');
 // A wall-mounted clothes rail, a faded veil and a forgotten pair of shoes.
 beam12([15,2.1,-39.2],[17.2,2.1,-39.2],.045,'brass');for(const x of[15,17.2])beam12([x,2.1,-39.2],[x,2.1,-39.8],.035,'brass');for(let i=0;i<10;i++)box(15.45+i*.09,1.41,-39.16+Math.sin(i)*.025,.11,1.29,.035,'linen13',[.78,.75,.70]);for(const x of[16.58,16.85]){box(x,.075,-39.25,.17,.12,.37,'linen13',[.65,.56,.48],[1,1],{geometry:'organic10'});box(x,.07,-39.10,.07,.14,.07,'darkwood');}lamp12(22.3,-36.8,2.85);
}
function buildIndustry13(){for(const x of[15.1,21.9]){prop5(x,.17,-48.8,1.35,.34,2.4,'stone5',[.46,.44,.39]);box(x,1.08,-48.8,1.03,1.5,1.7,'rust13');box(x,1.89,-48.8,1.14,.16,1.85,'rust13');for(let i=0;i<7;i++)box(x,1.15+i*.055,-47.938,.72,.019,.02,'black');for(const dx of[-.29,.29]){box(x+dx,1.60,-47.915,.19,.19,.023,'ceramic4P');box(x+dx,1.60,-47.894,.012,.13,.01,'darkwood',[1,1,1],[1,1],{rotZ:.6});}solidRect(x,-48.8,1.35,2.4,2,false,'machine13');}
 // Open flywheel and teeth mounted to the west machine, with every axle supported.
 for(const [x,y,z,r]of[[15.1,1.05,-47.87,.38],[15.65,1.45,-47.88,.22]]){for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16;beam12([x+Math.cos(a)*r,y+Math.sin(a)*r,z],[x+Math.cos(b)*r,y+Math.sin(b)*r,z],.045,'rust13');if(i%2===0)beam12([x+Math.cos(a)*r,y+Math.sin(a)*r,z],[x+Math.cos(a)*(r+.07),y+Math.sin(a)*(r+.07),z],.05,'rust13');if(i%8===0)beam12([x,y,z],[x+Math.cos(a)*r,y+Math.sin(a)*r,z],.035,'brass');}box(x,y,z+.03,.12,.12,.13,'brass');}
 for(const x of[14.3,22.7]){beam12([x,.4,-52.8],[x,3.15,-52.8],.12,'rust13');beam12([x,3.15,-52.8],[18.5,3.15,-52.8],.1,'rust13');for(const y of[.7,2.7])box(x,y,-52.8,.22,.08,.22,'rust13');}beam12([20.45,3.48,-53.4],[20.45,2.71,-53.4],.07,'rust13');box(20.45,2.48,-53.4,.64,.49,.64,'brass',[.52,.40,.23],[1,1],{geometry:'shade'});box(20.45,2.22,-53.4,.72,.065,.72,'brass',[.5,.37,.22],[1,1],{geometry:'round'});box(20.45,2.16,-53.4,.08,.16,.08,'rust13');beam12([20.45,2.12,-53.4],[20.45,.45,-53.4],.013,'linen13');
 for(let i=0;i<9;i++)beam12([17.4+i*.24,3.45,-44.3],[17.4+i*.24,3.45,-53.5],.018,'darkwood');lamp12(18.5,-51.8,3.35);
}
const buildBefore13=buildFloor5;buildFloor5=function(){state13();buildBefore13();textures13();doors13={};buildConfessional13();buildDressing13();buildIndustry13();addDoor13('male',-14,-36.35,2.3,-Math.PI/2,-Math.PI,'panel12','male13');addDoor13('female',14,-11.15,2.3,-Math.PI/2,0,'panel12','female13');if(wedding5.electricUnlocked13&&wedding5.doors13.electric===undefined)wedding5.doors13.electric=true;addDoor13('electric',17.2,-44,2.6,0,Math.PI/2,'rust13','danger13');
 // Recessed elevator surround: pilasters, stone courses and a fan-shaped crown.
 for(const x of[-1.55,1.55]){box(x,1.47,2.72,.30,2.94,.34,'stone5',[.8,.74,.67]);box(x,.18,2.65,.47,.36,.44,'stone5');box(x,2.87,2.64,.46,.18,.43,'brass',[.58,.45,.29]);for(const dx of[-.09,.09])box(x+dx,1.55,2.53,.035,2.42,.035,'brass',[.4,.32,.23]);}arch5(0,2.60,3.4,2.92,1.05);for(const x of[-4.5,4.5]){box(x,2.1,2.79,3.4,3.1,.05,'panel12',[.82,.72,.68],[2,1]);box(x,3.68,2.69,3.55,.08,.16,'brass',[.44,.36,.26]);}navGrid5=null;};
const actBefore13=activeInteraction;activeInteraction=function(){if(scene!=='floor5'||mode!=='world')return actBefore13();const targets=interactables.filter(t=>t.custom13&&!(t.id==='f5_key13'&&(wedding5.keyTaken13||curtainProgress13<.85))).filter(t=>{const dx=t.x-player.x,dz=t.z-player.z,d=Math.hypot(dx,dz),f=forward2(),ignore=t.id.startsWith('f5_door13_')?'door13_'+t.id.slice(10):t.id==='f5_curtain13'?'curtain13':null;return d<t.range&&(d<.25||(dx*f[0]+dz*f[1])/d>.57)&&!spriteOccluders.some(r=>r.id!==ignore&&segmentIntersectsRect(player.x,player.z,t.x,t.z,r));});for(const t of targets){if(t.id==='f5_curtain13')t.label=wedding5.curtainOpen13?'FECHAR CORTINA':'ABRIR CORTINA';else if(t.id.startsWith('f5_door13_')){const id=t.id.slice(10);t.label=id==='electric'&&!wedding5.electricUnlocked13?(inventory.includes('electricKey13')?'DESTRANCAR · CHAVE DA ELÉTRICA':'EXAMINAR FECHADURA'):doors13[id].open?'FECHAR PORTA':'ABRIR PORTA';}}const original=actBefore13();if(original&&!original.custom13)targets.push(original);return targets.sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]||null;};
const useBefore13=interactFloor5;interactFloor5=function(id){if(id.startsWith('f5_door13_'))return toggleDoor13(id.slice(10));if(id==='f5_curtain13'){wedding5.curtainOpen13=!wedding5.curtainOpen13;paperSound13();return;}if(id==='f5_key13'){if(!wedding5.curtainOpen13||wedding5.keyTaken13||wedding5.electricUnlocked13)return;wedding5.keyTaken13=true;inventory.push('electricKey13');objects=objects.filter(o=>!keyParts13.includes(o));keyParts13=[];renderInventory();sound5('shutter',.13,1.6);showCaption('','CHAVE DA ELÉTRICA · guardada no inventário',3200);checkpointHere13();objective5();return;}return useBefore13(id);};
const saveBefore13=saveWedding5;saveWedding5=function(npc=null){state13();saveBefore13(npc);const d=checkpointSnapshot10;d.version=7;d.layout=13;try{localStorage.setItem(SAVE_KEY,JSON.stringify(d))}catch(e){showCaption('','Não foi possível gravar seu progresso.',2200)}};
const loadBefore13=loadCheckpoint;loadCheckpoint=function(data){if(data?.checkpoint!=='wedding')return loadBefore13(data);const d=JSON.parse(JSON.stringify(data));if(!d.layout||d.layout<13){d.wedding||={};d.wedding.electricUnlocked13=!!d.wedding.cleared;d.wedding.doors13={electric:!!d.wedding.cleared};if(!d.wedding.cleared&&d.wedding.spawn?.[1]<-43.5)d.wedding.spawn=[18.5,-42.15];}return loadBefore13(d);};
const objectiveBefore13=objective5;objective5=function(){objectiveBefore13();if(scene==='floor5'&&!wedding5.cleared&&mainIds5.every(id=>wedding5.heard?.includes(id))&&!wedding5.electricUnlocked13)setObjective(inventory.includes('electricKey13')?'Destranque a elétrica · no fim da ala leste':'Procure a chave · confira o confessionário na entrada');};
F5_NPCS.chef.lines.splice(4,0,['COZINHEIRO','A chave da elétrica? O padre guardava as dele no confessionário, ali na entrada. Dizia que nos bolsos pesavam. Até nisso ele tinha mania.']);F5_NPCS.chef.poses=[1,2,1,2,1,2,1];
const flashBefore13=flash5;flash5=function(){const before=new Set(enemies5.filter(e=>e.purified).map(e=>e.id));flashBefore13();for(const e of enemies5)if(e.purified&&!before.has(e.id))wedding5.respawns13[e.id]=180;};
function tickRespawns13(dt){if(scene!=='floor5'||mode!=='world')return;for(const[id,left]of Object.entries(wedding5.respawns13||{})){wedding5.respawns13[id]=Math.max(0,left-dt);if(wedding5.respawns13[id]>0)continue;const e=enemies5.find(e=>e.id===id),origin=hostileDefs5.find(e=>e.id===id);if(e&&origin){Object.assign(e,{x:origin.x,z:origin.z,state:'dormant',reveal:0,clock:0,path:[],pathAt:0,purified:false});const sp=sprites.find(s=>s.id==='f5_'+id);if(sp){Object.assign(sp,{x:origin.x,z:origin.z,y:.1,visible:false,fade5:1});delete sp.override5;sp.purify5=0;}wedding5.purged=wedding5.purged.filter(i=>i!==id);}delete wedding5.respawns13[id];}}
const updateBefore13=updateFloor5;updateFloor5=function(dt,now){if(scene!=='floor5')return;const live=mode==='world';if(live){tickRespawns13(dt);for(const d of Object.values(doors13)){const target=d.open?d.opened:d.closed;if(Math.abs(d.angle-target)>.001){d.angle+=clamp(target-d.angle,-dt*1.9,dt*1.9);poseDoor13(d);navGrid5=null;}}const target=wedding5.curtainOpen13?1:0;if(Math.abs(target-curtainProgress13)>.001){curtainProgress13+=clamp(target-curtainProgress13,-dt*2.3,dt*2.3);poseCurtain13();}}updateBefore13(dt,now);};
let paperBuffer13=null,lastSpread13=-1;
function paperSound13(){if(!sfx.ctx||!sfx.master)return;const a=sfx.ctx;if(!paperBuffer13){paperBuffer13=a.createBuffer(2,Math.floor(a.sampleRate*.43),a.sampleRate);for(let c=0;c<2;c++){const b=paperBuffer13.getChannelData(c);let prev=0;for(let i=0;i<b.length;i++){const t=i/a.sampleRate,n=Math.random()*2-1;prev=prev*.62+n*.38;const env=Math.sin(Math.PI*Math.min(1,t/.43))**1.5*(.5+.5*Math.sin(t*27)**2);b[i]=(n-prev)*env*.34+(Math.random()<.0015?n*.14:0);}}}const src=a.createBufferSource(),gain=a.createGain(),filter=a.createBiquadFilter();src.buffer=paperBuffer13;src.playbackRate.value=.94+Math.random()*.1;filter.type='lowpass';filter.frequency.value=5600;gain.gain.value=.33;src.connect(filter);filter.connect(gain);gain.connect(sfx.master);src.start();}
const personalNotes13={
 bride:['Ela ainda espera por ele. Moravam aqui; casaram na capela do hotel. A luz caiu durante os votos. Mais de duzentos convidados.','A irmã dela, o padre e o coroinha escaparam. Por quê só esses três?','Não consigo prometer nada. Mas vou procurar.'],
 music:['O padre quis guardar as caixas da banda na elétrica. Havia uma despensa vazia. Ele insistiu mesmo assim.','O coroinha ia e voltava por lá. O primeiro grito veio do altar. Isso importa.','Ele voltou a tocar. O silêncio estava pior.'],
 cousin:['Ela chamou o coroinha para um canto mais quieto. Quando sugeriu a elétrica: “lá não”. Nervoso. Olhando o relógio.','O que ele estava esperando? Ela ouviu passos no apagão, mas não viu de quem.','Ainda quer ganhar o buquê. Não vou apostar contra.'],
 brother:['O irmão mais velho era padrinho. Estava junto do noivo quando apagou. Segundos depois, segurava o irmão nos braços.','O ataque começou perto do altar. Não houve tempo para alguém cruzar o salão inteiro.','Ele brinca com o bufê. Mas a voz mudou quando falou do irmão.'],
 chef:['O cozinheiro também viu a discussão das caixas. Ofereceu a despensa. O padre recusou e continuou olhando o relógio.','A chave da elétrica ficava no confessionário, na entrada. Vale abrir a cortina.','Deixou um filho pequeno. Preciso lembrar desse pedido.'],
 younger:['O irmão mais novo estava no banheiro. Não viu o ataque. Morreu antes de conseguir sair.','Ele pediu segredo, principalmente para o irmão mais velho. Acho que posso guardar isso.','Não é uma pista. Ainda assim, alguém precisava ouvi-lo.'],
 witch:['Ela riu da minha cara. Não disse o nome, não contou o que viu e desapareceu.','Parecia saber exatamente o que eu ia perguntar. Onde será que foi parar?','“Me encontre outra vez.” Isso foi convite ou ameaça?'],
 groom:['O padre atacou. O coroinha apagou as luzes. Quando ouviu a verdade, ele conseguiu lembrar dela.','Ela veio correndo. Ele a abraçou como se a festa ainda pudesse acabar bem.','Foram embora juntos. Pelo menos estes dois.']};
const entriesBefore13=bookEntries12;bookEntries12=function(){return entriesBefore13().map(n=>{let notes=personalNotes13[n.id]||[n.note,'',''];if(n.id==='witch'&&wedding5.witchStage===2)notes=['Uma bruxa. O pingente deixava enxergar no escuro. Ela viu o padre matar... mas jura que havia outra coisa nele.','Disse que aquilo era pior que os corrompidos. “O próprio demônio.” Não parecia brincadeira dessa vez.','Ela sempre soube. Por que me deixou descobrir sozinho?'];if(n.id==='bride'&&wedding5.cleared)notes=['Encontrei o marido. A raiva tinha apagado as lembranças boas, mas ele voltou a reconhecê-la.','Ela não estava esperando a festa recomeçar. Só queria ir embora com ele.','Não precisei fazer uma promessa. Consegui cumprir mesmo assim.'];return{...n,name:n.id==='brother'?'O irmão mais velho':n.id==='younger'?'O irmão mais novo':n.id==='witch'?(wedding5.witchStage===2?'A bruxa':'A desconhecida'):n.id==='groom'?'O noivo':n.id==='music'?'O violinista':n.id==='cousin'?'A prima':n.id==='chef'?'O cozinheiro':'A noiva',note:notes[0],clue:notes[1],aside:notes[2]};});};
paintBook12=function(){const entries=bookEntries12(),count=Math.max(1,Math.ceil(entries.length/2));bookSpread12=clamp(bookSpread12,0,count-1);const turned=lastSpread13>=0&&lastSpread13!==bookSpread12,back=lastSpread13>bookSpread12;lastSpread13=bookSpread12;notebook5.replaceChildren();notebook5.className='notebook5 bookOpen12 book13';const nav=document.createElement('nav');nav.className='bookmarks12';['✦','?','?','?'].forEach((label,i)=>{const b=document.createElement('button');b.textContent=label;b.disabled=i>0;b.title=i?'Ainda não escrevi nada aqui':'Quem ficou nesta noite';b.setAttribute('aria-label',b.title);b.onclick=()=>{bookSpread12=0;paintBook12()};nav.append(b)});notebook5.append(nav);const leaves=document.createElement('div');leaves.className='bookLeaves12';if(turned){leaves.classList.add(back?'turnBack13':'turn13');paperSound13();}for(let i=0;i<2;i++){const n=entries[bookSpread12*2+i],page=document.createElement('article');page.className='bookPage12';const add=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;page.append(el);return el;};add('small','BELLEVUE  /  QUINTO ANDAR');add('h2',n?n.name:i?'Antes de seguir':'Uma noite presa aqui');if(n){const figure=document.createElement('div');figure.className='sketch13';const im=document.createElement('img');im.src='assets/'+(n.id==='groom'?'groom5_0':F5_NPCS[n.id].tex+'_0')+'.png';im.alt='Retrato de '+n.name;figure.append(im);const caption=document.createElement('span');caption.textContent=n.done?'lembrei deste rosto':'esboço de memória';figure.append(caption);page.append(figure);add('p',n.note);add('p',n.clue,'clue13');add('em',n.aside);if(n.done){page.classList.add('released12');add('strong','✓  Encontrou a paz','check13');}}else{add('p',i?'Nem todos estão presos aqui pelo mesmo motivo. Ouvir cada um pode ser tão importante quanto descobrir o assassino.':'Vim procurando minha avó. Agora tenho uma câmera que fotografa quem ninguém mais vê. Melhor anotar antes que eu também ache que inventei tudo.');add('div',i?'✧':'◈','inkArt13');add('em',i?'Deixar espaço para as histórias que ainda faltam.':'Fotografar para revelar. Conversar para entender.');}add('footer',String(bookSpread12*2+i+1).padStart(2,'0'));leaves.append(page);}notebook5.append(leaves);const controls=document.createElement('div');controls.className='bookControls12';const prev=document.createElement('button');prev.textContent='← Voltar';prev.disabled=bookSpread12===0;prev.onclick=()=>{bookSpread12--;paintBook12()};const num=document.createElement('span');num.textContent=(bookSpread12+1)+' / '+count;const next=document.createElement('button');next.textContent='Virar →';next.disabled=bookSpread12===count-1;next.onclick=()=>{bookSpread12++;paintBook12()};const close=document.createElement('button');close.textContent='Fechar · botão direito';close.onclick=closeNotebook5;controls.append(prev,num,next,close);notebook5.append(controls);};
// Layered filaments have stable spatial anchors and continuous, low-amplitude motion.
function filament13(g,a,b,seed,t,strength=1){const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/Math.max(1,len),ny=dx/Math.max(1,len),points=[];for(let i=0;i<=18;i++){const u=i/18,w=Math.sin(u*Math.PI),offset=w*(Math.sin(i*2.37+seed)*len*.035+Math.sin(t*8+i*1.63+seed)*len*.018);points.push([a[0]+dx*u+nx*offset,a[1]+dy*u+ny*offset]);}g.save();g.globalCompositeOperation='screen';g.lineJoin=g.lineCap='round';for(const [width,color,blur]of[[8,'rgba(244,14,54,.12)',15],[3,'rgba(255,36,73,.68)',6],[.85,'rgba(255,233,224,.95)',0]]){g.strokeStyle=color;g.lineWidth=width*strength;g.shadowColor='#ff123b';g.shadowBlur=blur*strength;g.beginPath();points.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.stroke();}g.restore();return points;}
drawLightning12=function(dt){if(lightningTime12<=0){lightning12.classList.add('hidden');return;}lightningTime12=Math.max(0,lightningTime12-dt);const g=lightning12.getContext('2d'),w=1200,h=800,t=performance.now()*.001,life=lightningTime12;g.clearRect(0,0,w,h);const pulse=g.createRadialGradient(600,430,10,600,430,680);pulse.addColorStop(0,'#ff5d7522');pulse.addColorStop(.4,'#b9092310');pulse.addColorStop(1,'#42001055');g.fillStyle=pulse;g.fillRect(0,0,w,h);for(let j=0;j<(lightningLethal12?7:4);j++){const a=j*2.399,targ=[600+Math.cos(a)*650,400+Math.sin(a)*480],pts=filament13(g,[600,430],targ,j*7,t,1.7);for(const k of[7,12])filament13(g,pts[k],[pts[k][0]+Math.sin(j+k)*110,pts[k][1]+Math.cos(j-k)*100],j+k,t, .7);}lightning12.style.opacity=String(Math.min(1,life*5));};
const atmosphere13=document.createElement('canvas');atmosphere13.width=1200;atmosphere13.height=800;atmosphere13.className='atmosphere13 hidden';document.querySelector('#gameShell').append(atmosphere13);
roomArcs12=function(){objects=objects.filter(o=>!o.arc12);};
function renderArcs13(){const g=atmosphere13.getContext('2d');g.clearRect(0,0,1200,800);const visible=scene==='floor5'&&!wedding5.cleared&&['world','paused','dialogue','deduction5'].includes(mode);atmosphere13.classList.toggle('hidden',!visible);if(!visible)return;const v=viewData(),m=v.vp,t=performance.now()*.001,project=p=>{const w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];if(w<.08)return null;return[(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w*600+600,400-(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w*400];};const center=[18.5,1.55,-46.1];if(!line5(v.eye[0],v.eye[2],center[0],center[2]))return;const a=project(center);if(!a)return;for(let j=0;j<8;j++){const angle=j*Math.PI/4,b3=[18.5+Math.cos(angle)*1.15,1.65+Math.sin(angle)*1.25,-46.1+Math.sin(j*4)*.35],b=project(b3);if(!b||!line5(v.eye[0],v.eye[2],b3[0],b3[2]))continue;const pts=filament13(g,a,b,j*13,t,clamp(8/Math.hypot(player.x-18.5,player.z+46.1),.5,1.3));if(j%2===0){const c=project([b3[0]+Math.cos(j)*.45,b3[1]-.35,b3[2]]);if(c)filament13(g,pts[10],c,j,t,.5);}}}

// Static scenery is merged by material on floor five; original renderers are unchanged.
let batches5=null;function batchEligible5(o){return !o.geometry&&!o.surface&&!o.eDoor&&!o.ward5&&!o.weddingParticle5&&!o.dynamic12}
function clearBatches5(){if(batches5)for(const b of batches5)gl.deleteBuffer(b.buf);batches5=null}
function compileBatches5(){const groups=new Map();for(const o of objects){if(!batchEligible5(o))continue;const tint=o.tint||[1,1,1],key=o.tex+':'+tint.join(',')+':'+(o.emissive||0);let group=groups.get(key);if(!group){group={tex:o.tex,tint,emissive:o.emissive||0,data:[]};groups.set(key,group)}const m=modelMatrix(o),uv=o.uv||[1,1];for(let i=0;i<cube.length;i+=8){const x=cube[i],y=cube[i+1],z=cube[i+2],nx=cube[i+3],ny=cube[i+4],nz=cube[i+5];group.data.push(m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14],m[0]*nx+m[4]*ny+m[8]*nz,m[1]*nx+m[5]*ny+m[9]*nz,m[2]*nx+m[6]*ny+m[10]*nz,cube[i+6]*uv[0],cube[i+7]*uv[1])}}batches5=[...groups.values()].map(g=>{g.buf=gl.createBuffer();g.count=g.data.length/8;gl.bindBuffer(gl.ARRAY_BUFFER,g.buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.data),gl.STATIC_DRAW);delete g.data;return g})}
const renderBase5=render;render=function(){syncCursor12();renderArcs13();if(scene!=='floor5')return renderBase5();resize();gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const v=viewData();setCommon(v);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);gl.depthMask(true);if(!batches5)compileBatches5();gl.uniformMatrix4fv(loc.uModel,false,M.identity());gl.uniform2fv(loc.uUVScale,new Float32Array([1,1]));gl.uniform1f(loc.uAlphaCut,.02);gl.uniform1f(loc.uSurfaceGloss,0);for(const b of batches5){bindGeom(b.buf);gl.bindTexture(gl.TEXTURE_2D,textures[b.tex]);gl.uniform3fv(loc.uTint,new Float32Array(b.tint));gl.uniform1f(loc.uEmissive,b.emissive);gl.drawArrays(gl.TRIANGLES,0,b.count)}for(const o of objects)if(!batchEligible5(o))drawBox(o);syncWorldSprites(v);gl.depthMask(true);gl.enable(gl.CULL_FACE)};
const sceneBatches5=setScene;setScene=function(name){clearBatches5();sceneBatches5(name)};
// Small test hooks, harmless in the shipped build.
window.__GAME_TEST__={get doors13(){return doors13},toggleDoor13,tickRespawns13,poseDoor13,paintBook12,get ectoplasm(){return ectoplasm12},get notebookOwned(){return notebookOwned12},get violin(){return {active:!!violinSource12,gain:violinGain12?.gain.value,loop:violinSource12?.loop,master:sfx.master?.gain.value,duration:violinBuffer12?.duration}},get lightning(){return {time:lightningTime12,lethal:lightningLethal12}},get reunionDuration(){return reunionDuration12},npcPose12,bookEntries12,repel12,startViolin12,volumeViolin12,syncCursor12,GROOM12,get batches5(){return batches5?.length||0},get wireLinks(){return {...links}},get wireContext(){return wireContext},loadWeddingAssets5,resetFloor5,photo5,flash5,equip5,talkNpc5,interactFloor5,openNotebook5,closeNotebook5,beginDeduction5,answerDeduction5,showQuestion5,startCouple5,updateFloor5,completeBreaker5,killGhost5,saveWedding5,path5,ghostWalk5,line5,get wedding(){return wedding5},get enemies5(){return enemies5},get cameraOwned(){return cameraOwned5},get equipped(){return equipped5},get flashLeft(){return flashLeft5},get audio5(){return Object.keys(audio5)},F5_NPCS,correctPlate10,removePart10,overtime10,awardMatches10,plateFoodDraw9,foodDraw9,foodMesh9,R9,dishes9,pick9,startJob9,useJob9,useBoard9,assembly9,discard9,plateScore9,startShift9,finishShift9,tutorialHint9,seatedReady9,get film(){return film4P},startFilm4P,finishFilm4P,flipMeat4P,stirSoup4P,targetCut4P,get kitchen(){return kitchen4},get audio4(){return Object.keys(audioBuffers4)},recipes4,resetKitchen4,openStation4,openCook4,addItem4,cutAttempt4,startCook4,soupAdd4,retrieve4,cookQuality4,finishPlate4,serve4,nextOrder4,penalty4,updateKitchen4,completeBreaker4,closeKitchenPanel4,spritesReady4,killBrute4,get oldLadyPos(){return {...oldLadyPos}},get oldLadyTarget(){return {...oldLadyTarget}},get noise(){return noiseLevel},get catStates(){return floor3CatState},get lockTargets(){return lockTargets},get lockAngle(){return lockAngle},get lockHits(){return lockpickHits},get frontDoorOpen(){return frontDoorOpen},get serviceDoorOpen(){return serviceDoorOpen},get objects(){return objects},get occluders(){return spriteOccluders},floor3InsideHouse,floor3MonsterWalkable,path3,openLockpick,updateLockpick,lockpickAttempt,failLockpick,resetFloor3Checkpoint,emitNoise3,updateFloor3,updateFloor3Cats,updateNoise,knockOldLady,completeFloor3Breaker,collectKitten,keys,get scene(){return scene},get mode(){return mode},story,player,get sprites(){return sprites},get colliders(){return colliders},get horrorDoorOpen(){return horrorDoorOpen},get horrorIntensity(){return horrorIntensity},get apartmentDoorOpen(){return apartmentDoorOpen},get fatherPos(){return {...fatherPos}},get fatherDying(){return fatherDying},get inventory(){return [...inventory]},get currentCheckpoint(){return currentCheckpoint},get gazeDisturbance(){return gazeDisturbance},readSave,saveCheckpoint,loadCheckpoint,collectCigarette,openInventory,closeInventory,canWalk:walkable,forceScene:setScene,setMode:v=>mode=v,updatePlayer,currentCeilingBottom,updateFather,monsterWalkable,interact,completeBreaker,completeFloor2Breaker,openWireGame,rideElevator,playAttack,togglePause,advanceDialogue,activeInteraction,renderOnce:render,resetFloor1Checkpoint,resetFloor2Checkpoint,triggerHorrorDoorIfNeeded,updateHorrorRoom,updateFloor2,startFatherChase,tryHitTV,finishFatherDeath,killByFather,getDomSprites:()=>Array.from(ui.spriteOverlay?.querySelectorAll('img')||[]).map(e=>({src:e.getAttribute('src'),display:e.style.display,left:e.style.left,top:e.style.top,width:e.style.width,height:e.style.height,zIndex:e.style.zIndex,distance:e.dataset.worldDistance,brightness:e.style.getPropertyValue('--sprite-brightness')}))};
})();
