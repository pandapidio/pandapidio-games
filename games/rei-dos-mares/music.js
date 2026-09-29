/* Integrated original Rei dos Mares themes supplied by the user.
   One shared Web Audio context prevents overlap; pause/resume uses AudioContext suspend/resume. */
(function(){
"use strict";
const AudioCtx=window.AudioContext||window.webkitAudioContext;
let ctx=null,bus=null,menuTheme=null,gameTheme=null,current=null,unlocked=false,paused=false;
let volume=1;
try{const raw=localStorage.getItem('reiDosMaresMusicVolume');if(raw!==null){const v=Number(raw);if(Number.isFinite(v))volume=Math.max(0,Math.min(1,v));}}catch(_){}
function makeMenuTheme(shared){


"use strict";


let ctx = shared.ctx;
let master = null;
let running = false;
let scheduler = null;
let nextBar = 0;
let nextBarTime = 0;
let liveNodes = [];

const BPM = 132;
const Q = 60 / BPM;
const E = Q / 2;
const BAR = Q * 4;
const TOTAL_BARS = 96;
const LOOKAHEAD = 0.8;
const SCHEDULER_MS = 120;

const N = {
"C2":65.41,"D2":73.42,"Eb2":77.78,"E2":82.41,"F2":87.31,"G2":98.00,"A2":110.00,"Bb2":116.54,
"C3":130.81,"D3":146.83,"Eb3":155.56,"E3":164.81,"F3":174.61,"G3":196.00,"A3":220.00,"Bb3":233.08,
"C4":261.63,"D4":293.66,"Eb4":311.13,"E4":329.63,"F4":349.23,"G4":392.00,"A4":440.00,"Bb4":466.16,
"C5":523.25,"D5":587.33,"Eb5":622.25,"E5":659.25,"F5":698.46,"G5":783.99,"A5":880.00,"Bb5":932.33,
"C6":1046.50,"D6":1174.66
};

const P = [
["D3","F3","A3"],["Bb2","D3","F3"],["F3","A3","C4"],["C3","E3","G3"],
["D3","F3","A3"],["G2","Bb2","D3"],["Bb2","D3","F3"],["A2","E3","A3"],
["D3","F3","A3"],["C3","E3","G3"],["Bb2","D3","F3"],["A2","E3","A3"],
["G2","Bb2","D3"],["D3","F3","A3"],["C3","E3","G3"],["A2","E3","A3"]
];

const MOTIF_A = ["D4","F4","A4","D5","C5","A4","F4","G4","A4","C5","Bb4","G4","F4","E4","D4","A3"];
const MOTIF_B = ["A4","C5","D5","F5","E5","D5","C5","A4","Bb4","D5","F5","E5","D5","C5","A4","G4"];
const MOTIF_C = ["D5","C5","A4","F4","G4","A4","Bb4","A4","F4","D4","E4","F4","A4","G4","F4","E4"];
const MOTIF_D = ["F4","A4","C5","F5","E5","C5","A4","G4","Bb4","D5","G5","F5","D5","Bb4","A4","G4"];

function register(...nodes){
  const source=nodes.find(n=>n&&typeof n.stop==="function");
  if(!source)return;
  liveNodes.push(source);
  const cleanup=()=>{const i=liveNodes.indexOf(source);if(i>=0)liveNodes.splice(i,1);for(const n of nodes){try{n.disconnect()}catch(_){}}};
  try{source.addEventListener("ended",cleanup,{once:true})}catch(_){source.onended=cleanup}
}

function initAudio(){
  if (master) return;

  master = ctx.createGain();
  master.gain.value = 1;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 20;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.22;

  master.connect(compressor);
  compressor.connect(shared.bus);
}

function env(g,t,dur,peak,sustain,attack=0.01,release=0.08){
  const end = t + dur;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak),t+attack);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002,sustain),Math.min(end-release,t+attack+0.08));
  g.gain.setValueAtTime(Math.max(0.0002,sustain),Math.max(t+attack+0.08,end-release));
  g.gain.exponentialRampToValueAtTime(0.0001,end);
}

function synth(freq,t,dur,{type="triangle",gain=0.05,pan=0,filter=3500,detune=0,attack=0.01,release=0.08}={}){
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const p = ctx.createStereoPanner();
  const f = ctx.createBiquadFilter();

  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;

  p.pan.value = pan;
  f.type = "lowpass";
  f.frequency.value = filter;

  env(g,t,dur,gain,gain*0.45,attack,release);

  o.connect(f);
  f.connect(g);
  g.connect(p);
  p.connect(master);

  o.start(t);
  o.stop(t+dur+0.05);
  register(o,g,p,f);
}

function pluck(freq,t,dur=0.16,g=0.045,pan=0){
  synth(freq,t,dur,{type:"triangle",gain:g,pan,filter:4300,attack:0.003,release:0.045});
  synth(freq*2,t,dur*0.6,{type:"sine",gain:g*0.18,pan,filter:7000,attack:0.002,release:0.03});
}

function violin(freq,t,dur,g=0.04,pan=0.15){
  synth(freq,t,dur,{type:"sawtooth",gain:g,pan,filter:2600,detune:-3,attack:0.015,release:0.07});
  synth(freq,t,dur,{type:"triangle",gain:g*0.34,pan:-pan*0.4,filter:4800,detune:4,attack:0.01,release:0.06});
}

function brass(freq,t,dur,g=0.055,pan=0){
  synth(freq,t,dur,{type:"sawtooth",gain:g,pan,filter:1800,attack:0.03,release:0.12});
  synth(freq*2,t,dur,{type:"square",gain:g*0.1,pan,filter:1400,attack:0.03,release:0.1});
}

function flute(freq,t,dur,g=0.03,pan=0.25){
  synth(freq,t,dur,{type:"sine",gain:g,pan,filter:7800,attack:0.02,release:0.1});
}

function noiseHit(t,kind="snare",gain=0.03){
  const dur = kind==="hat" ? 0.05 : 0.13;
  const buffer = ctx.createBuffer(1,Math.ceil(ctx.sampleRate*dur),ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i] = Math.random()*2-1;

  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();

  src.buffer = buffer;
  f.type = kind==="hat" ? "highpass" : "bandpass";
  f.frequency.value = kind==="hat" ? 6200 : 1900;
  g.gain.setValueAtTime(gain,t);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);

  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
  src.stop(t+dur+0.02);
  register(src,g,f);
}

function kick(t,gain=0.09){
  const o = ctx.createOscillator();
  const g = ctx.createGain();

  o.type = "sine";
  o.frequency.setValueAtTime(110,t);
  o.frequency.exponentialRampToValueAtTime(48,t+0.12);

  g.gain.setValueAtTime(gain,t);
  g.gain.exponentialRampToValueAtTime(0.0001,t+0.17);

  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t+0.19);
  register(o,g);
}

function cymbal(t,gain=0.04){
  noiseHit(t,"hat",gain);
  noiseHit(t+0.02,"hat",gain*0.65);
  noiseHit(t+0.05,"hat",gain*0.42);
}

function pad(chord,t,dur,gain=0.012){
  chord.forEach((f,i)=>{
    synth(f,t,dur,{
      type:"sawtooth",
      gain,
      pan:(i-1)*0.18,
      filter:1200,
      detune:(i-1)*3,
      attack:0.18,
      release:0.25
    });
  });
}

function barEnergy(b){
  if (b < 8) return 0;
  if (b < 24) return 1;
  if (b < 44) return 2;
  if (b < 60) return 1;
  if (b < 80) return 3;
  return 4;
}

function motifForBar(b){
  if (b < 24) return MOTIF_A;
  if (b < 44) return MOTIF_B;
  if (b < 60) return MOTIF_D;
  if (b < 80) return MOTIF_C;
  return MOTIF_B;
}

function scheduleBar(b,t){
  const chord = P[b % P.length].map(n=>N[n]);
  const energy = barEnergy(b);
  const motif = motifForBar(b);

  pad(chord,t,BAR*0.95,0.009+energy*0.0015);

  // Intro: lighter and clearer
  if (b < 4){
    for(let i=0;i<8;i++){
      const f = chord[[0,1,2,1,0,1,2,1][i]];
      pluck(f,t+i*E,E*0.68,0.03,(i%2?0.12:-0.12));
    }
    if (b>=2){
      for(let i=0;i<4;i++) flute(N[MOTIF_A[i+b*2]],t+i*Q,Q*0.75,0.024,0.22);
    }
    return;
  }

  // Pirate-like plucked pulse
  for(let i=0;i<8;i++){
    const f = chord[[0,1,2,1,0,1,2,1][i]];
    pluck(f,t+i*E,E*0.68,0.028+energy*0.004,(i%2?0.12:-0.12));
  }

  // String ostinato
  for(let i=0;i<8;i++){
    const f = (i%4===0) ? chord[0]/2 : (i%2===0 ? chord[0] : chord[1]);
    violin(f,t+i*E,E*0.72,0.021+energy*0.004,-0.2);
  }

  // Percussion
  kick(t,0.07+energy*0.008);
  kick(t+2*Q,0.065+energy*0.008);
  noiseHit(t+Q,"snare",0.025+energy*0.004);
  noiseHit(t+3*Q,"snare",0.032+energy*0.005);
  for(let i=0;i<8;i++) noiseHit(t+i*E,"hat",0.007+energy*0.0015);

  if (energy>=2 && b%4===0) cymbal(t,0.022+energy*0.004);

  // Main melody
  const start = (b%4)*4;
  for(let i=0;i<4;i++){
    const note = motif[start+i];
    const f = N[note];
    if (energy===0) flute(f,t+i*Q,Q*0.75,0.028,0.22);
    else violin(f,t+i*Q,Q*0.78,0.035+energy*0.003,0.18);

    if (energy>=3 && (i===0 || i===2)){
      brass(f/2,t+i*Q,Q*0.68,0.03+energy*0.004,-0.1);
    }
  }

  // Heroic chord hits
  if (energy>=3 && b%2===0){
    brass(chord[0],t,Q*1.4,0.045,-0.1);
    brass(chord[1],t,Q*1.4,0.034,0.04);
    brass(chord[2],t,Q*1.4,0.032,0.12);
  }

  // Mid-section counter flute
  if (b>=44 && b<60 && b%2===1){
    const seq=[chord[2]*2,chord[1]*2,chord[0]*2,chord[1]*2];
    seq.forEach((f,i)=>flute(f,t+i*Q,Q*0.6,0.019,0.28));
  }

  // Finale lift
  if (b>=80 && b%4===0) cymbal(t,0.045);
}

function schedulerTick(){
  if(!running) return;

  const horizon = ctx.currentTime + LOOKAHEAD;
  while(nextBarTime < horizon){
    scheduleBar(nextBar,nextBarTime);
    nextBar++;
    nextBarTime += BAR;

    if(nextBar >= TOTAL_BARS){
      nextBar = 0; // seamless musical restart
    }
  }
}

async function startMusic(){
  try{
    initAudio();

    if(ctx.state === "suspended"){
      await ctx.resume();
    }

    running = true;
    nextBar = 0;
    nextBarTime = ctx.currentTime + 0.08;

    schedulerTick();
    scheduler = setInterval(schedulerTick,SCHEDULER_MS);

  }catch(err){
    console.error(err);
    running = false;
  }
}

function stopMusic(){
  running = false;
  if(scheduler){
    clearInterval(scheduler);
    scheduler = null;
  }

  liveNodes.forEach(n=>{
    try{ if(typeof n.stop==="function") n.stop(); }catch(e){}
    try{ n.disconnect(); }catch(e){}
  });
  liveNodes=[];

}


return {start:startMusic, stop:stopMusic, isRunning:()=>running};

}
function makeGameTheme(shared){


"use strict";


let ctx=shared.ctx, master=null, running=false, scheduler=null;
let nextBar=0, nextBarTime=0, active=[];
const BPM=146;
const Q=60/BPM;
const E=Q/2;
const S=E/2;
const BAR=Q*4;
const TOTAL_BARS=144;
const LOOKAHEAD=.9;
const TICK_MS=110;

const N={
"C2":65.41,"D2":73.42,"Eb2":77.78,"E2":82.41,"F2":87.31,"G2":98.00,"A2":110.00,"Bb2":116.54,"B2":123.47,
"C3":130.81,"D3":146.83,"Eb3":155.56,"E3":164.81,"F3":174.61,"G3":196.00,"A3":220.00,"Bb3":233.08,"B3":246.94,
"C4":261.63,"D4":293.66,"Eb4":311.13,"E4":329.63,"F4":349.23,"G4":392.00,"A4":440.00,"Bb4":466.16,"B4":493.88,
"C5":523.25,"D5":587.33,"Eb5":622.25,"E5":659.25,"F5":698.46,"G5":783.99,"A5":880.00,"Bb5":932.33,"B5":987.77,
"C6":1046.50,"D6":1174.66,"E6":1318.51,"F6":1396.91
};

function keep(...nodes){
  const source=nodes.find(n=>n&&typeof n.stop==="function");
  if(!source)return;
  active.push(source);
  const cleanup=()=>{const i=active.indexOf(source);if(i>=0)active.splice(i,1);for(const n of nodes){try{n.disconnect()}catch(_){}}};
  try{source.addEventListener("ended",cleanup,{once:true})}catch(_){source.onended=cleanup}
}

function init(){
  if(master) return;
  master=ctx.createGain();
  master.gain.value=1;

  const comp=ctx.createDynamicsCompressor();
  comp.threshold.value=-17;
  comp.knee.value=18;
  comp.ratio.value=3.2;
  comp.attack.value=.008;
  comp.release.value=.22;

  const eq=ctx.createBiquadFilter();
  eq.type="highshelf";eq.frequency.value=5200;eq.gain.value=-1.3;

  master.connect(comp);
  comp.connect(eq);
  eq.connect(shared.bus);
}

function env(g,t,dur,peak,sustain,attack=.008,release=.07){
  const end=t+dur;
  const mid=Math.min(end-release,t+attack+.07);
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),t+attack);
  g.gain.exponentialRampToValueAtTime(Math.max(.0002,sustain),mid);
  g.gain.setValueAtTime(Math.max(.0002,sustain),Math.max(mid,end-release));
  g.gain.exponentialRampToValueAtTime(.0001,end);
}

function synth(freq,t,dur,o={}){
  const {
    type="triangle",gain=.05,pan=0,filter=3600,detune=0,
    attack=.008,release=.07
  }=o;
  const s=ctx.createOscillator(),g=ctx.createGain(),p=ctx.createStereoPanner(),f=ctx.createBiquadFilter();
  s.type=type;s.frequency.value=freq;s.detune.value=detune;
  p.pan.value=pan;f.type="lowpass";f.frequency.value=filter;
  env(g,t,dur,gain,gain*.44,attack,release);
  s.connect(f);f.connect(g);g.connect(p);p.connect(master);
  s.start(t);s.stop(t+dur+.05);
  keep(s,g,p,f);
}

function pluck(freq,t,dur=.13,g=.04,pan=0){
  synth(freq,t,dur,{type:"triangle",gain:g,pan,filter:4800,attack:.002,release:.035});
  synth(freq*2,t,dur*.52,{type:"sine",gain:g*.14,pan,filter:8500,attack:.002,release:.024});
}

function strings(freq,t,dur,g=.04,pan=.15){
  synth(freq,t,dur,{type:"sawtooth",gain:g,pan,filter:2750,detune:-3,attack:.01,release:.06});
  synth(freq,t,dur,{type:"triangle",gain:g*.28,pan:-pan*.35,filter:5200,detune:4,attack:.008,release:.05});
}

function brass(freq,t,dur,g=.055,pan=0){
  synth(freq,t,dur,{type:"sawtooth",gain:g,pan,filter:1900,attack:.026,release:.11});
  synth(freq*2,t,dur,{type:"square",gain:g*.085,pan,filter:1350,attack:.026,release:.09});
}

function flute(freq,t,dur,g=.026,pan=.25){
  synth(freq,t,dur,{type:"sine",gain:g,pan,filter:9000,attack:.016,release:.08});
  synth(freq*2,t,dur*.9,{type:"triangle",gain:g*.08,pan,filter:8000,attack:.015,release:.07});
}

function bell(freq,t,dur=.35,g=.025,pan=.18){
  synth(freq,t,dur,{type:"sine",gain:g,pan,filter:10000,attack:.003,release:.22});
  synth(freq*2.01,t,dur*.75,{type:"sine",gain:g*.45,pan:-pan,filter:10000,attack:.003,release:.18});
}

function pad(ch,t,dur,g=.009){
  ch.forEach((f,i)=>synth(f,t,dur,{
    type:"sawtooth",gain:g,pan:(i-1)*.18,filter:1100,
    detune:(i-1)*3,attack:.14,release:.22
  }));
}

function kick(t,g=.082){
  const s=ctx.createOscillator(),a=ctx.createGain();
  s.type="sine";
  s.frequency.setValueAtTime(120,t);
  s.frequency.exponentialRampToValueAtTime(47,t+.1);
  a.gain.setValueAtTime(g,t);
  a.gain.exponentialRampToValueAtTime(.0001,t+.16);
  s.connect(a);a.connect(master);s.start(t);s.stop(t+.18);keep(s,a);
}

function noise(t,kind="snare",g=.03){
  const dur=kind==="hat"?.045:(kind==="tom"?.11:.12);
  const b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*dur),ctx.sampleRate);
  const data=b.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1;

  const src=ctx.createBufferSource(),a=ctx.createGain(),f=ctx.createBiquadFilter();
  src.buffer=b;
  if(kind==="hat"){f.type="highpass";f.frequency.value=6800;}
  else if(kind==="tom"){f.type="lowpass";f.frequency.value=1300;}
  else {f.type="bandpass";f.frequency.value=1900;f.Q.value=1.2;}
  a.gain.setValueAtTime(g,t);
  a.gain.exponentialRampToValueAtTime(.0001,t+dur);
  src.connect(f);f.connect(a);a.connect(master);
  src.start(t);src.stop(t+dur+.02);keep(src,a,f);
}

function timp(t,f=73.42,g=.06){
  const s=ctx.createOscillator(),a=ctx.createGain(),lp=ctx.createBiquadFilter();
  s.type="sine";s.frequency.setValueAtTime(f,t);s.frequency.exponentialRampToValueAtTime(f*.72,t+.19);
  lp.type="lowpass";lp.frequency.value=520;
  a.gain.setValueAtTime(g,t);a.gain.exponentialRampToValueAtTime(.0001,t+.32);
  s.connect(lp);lp.connect(a);a.connect(master);s.start(t);s.stop(t+.34);keep(s,a,lp);
}

function cymbal(t,g=.04){
  noise(t,"hat",g);noise(t+.018,"hat",g*.64);noise(t+.046,"hat",g*.40);
}

const PROG_A=[
["D3","F3","A3"],["C3","E3","G3"],["Bb2","D3","F3"],["C3","E3","G3"],
["D3","F3","A3"],["G2","Bb2","D3"],["Bb2","D3","F3"],["A2","E3","A3"]
];
const PROG_B=[
["G2","Bb2","D3"],["Bb2","D3","F3"],["D3","F3","A3"],["C3","E3","G3"],
["Bb2","D3","F3"],["F3","A3","C4"],["C3","E3","G3"],["A2","E3","A3"]
];
const PROG_C=[
["D3","F3","A3"],["F3","A3","C4"],["G2","Bb2","D3"],["Bb2","D3","F3"],
["C3","E3","G3"],["Bb2","D3","F3"],["A2","E3","A3"],["D3","F3","A3"]
];

// Original motifs, varied throughout.
const HERO=["D4","F4","A4","D5","C5","A4","G4","F4",
            "G4","Bb4","A4","F4","E4","G4","F4","D4"];
const SAIL=["A4","C5","D5","F5","E5","C5","A4","G4",
            "Bb4","D5","C5","A4","G4","F4","E4","D4"];
const STORM=["D5","C5","Bb4","A4","F4","G4","A4","C5",
             "Bb4","A4","G4","E4","F4","A4","G4","D4"];
const LIGHT=["F4","A4","C5","A4","G4","E4","F4","D4",
             "E4","G4","Bb4","G4","F4","D4","E4","A4"];

function section(b){
  if(b<8) return 0;      // intro
  if(b<24) return 1;     // main A
  if(b<40) return 2;     // variation
  if(b<56) return 3;     // lighter sea section
  if(b<72) return 4;     // build
  if(b<88) return 5;     // storm
  if(b<104) return 6;    // heroic return
  if(b<120) return 7;    // breakdown + rebuild
  return 8;              // finale
}
function progressionFor(sec){
  if(sec===3||sec===7) return PROG_B;
  if(sec===5) return PROG_C;
  return PROG_A;
}
function motifFor(sec){
  return [LIGHT,HERO,SAIL,LIGHT,HERO,STORM,SAIL,LIGHT,HERO][sec];
}
function energy(sec){
  return [0,2,3,1,3,4,4,2,5][sec];
}

function scheduleBar(b,t){
  const sec=section(b);
  const prog=progressionFor(sec);
  const ch=prog[b%8].map(x=>N[x]);
  const en=energy(sec);
  const m=motifFor(sec);
  const local=b%16;

  pad(ch,t,BAR*.95,.0075+en*.0008);

  // section-specific bass patterns
  if(sec===3 || sec===7){
    pluck(ch[0]/2,t,Q*.75,.042,-.14);
    pluck(ch[2]/2,t+2*Q,Q*.75,.036,-.10);
  } else {
    pluck(ch[0]/2,t,Q*.74,.048+en*.003,-.13);
    pluck(ch[0]/2,t+2*Q,Q*.74,.044+en*.003,-.13);
  }

  // accompaniment changes often
  if(sec===0){
    for(let i=0;i<8;i++) pluck(ch[[0,1,2,1,0,1,2,1][i]],t+i*E,E*.7,.027,(i%2?.13:-.13));
  }
  else if(sec===1 || sec===4 || sec===6 || sec===8){
    for(let i=0;i<16;i++){
      const idx=[0,1,2,1][i%4];
      const f=(i%8===0)?ch[0]/2:ch[idx];
      strings(f,t+i*S,S*.72,.017+en*.002,(i%2?.18:-.18));
    }
  }
  else if(sec===2 || sec===5){
    for(let i=0;i<8;i++){
      const f=ch[[0,2,1,2,0,2,1,2][i]];
      strings(f,t+i*E,E*.68,.025+en*.002,(i%2?.17:-.17));
    }
    for(let i=0;i<4;i++) pluck(ch[i%3]*2,t+i*Q,Q*.45,.025,.2);
  }
  else {
    for(let i=0;i<8;i++) pluck(ch[[0,1,2,1,0,2,1,2][i]],t+i*E,E*.66,.028,(i%2?.14:-.14));
  }

  // percussion palette varies by section
  if(sec!==0){
    kick(t,.064+en*.007);
    if(sec!==3) kick(t+2*Q,.058+en*.006);

    if(sec===3){
      noise(t+Q,"snare",.018);
      noise(t+3*Q,"snare",.024);
    } else {
      noise(t+Q,"snare",.022+en*.0035);
      noise(t+3*Q,"snare",.03+en*.004);
    }

    const hatStep=(sec===5||sec===8)?S:E;
    const hatCount=(sec===5||sec===8)?16:8;
    for(let i=0;i<hatCount;i++) noise(t+i*hatStep,"hat",.0055+en*.0009);

    if(sec===5){
      noise(t+E,"tom",.025);
      noise(t+5*E,"tom",.03);
    }
    if((sec===4||sec===5||sec===8) && b%4===0){
      timp(t,73.42,.04+en*.004);
      timp(t+2*Q,87.31,.036+en*.003);
    }
    if((b%8===0) && en>=3) cymbal(t,.026+en*.003);
  }

  // Main melody: phrasing changes instead of same pattern every bar
  const phrase=(b%4)*4;
  if(sec===0){
    if(b>=2){
      for(let i=0;i<4;i++) flute(N[LIGHT[phrase+i]],t+i*Q,Q*.72,.022,.24);
    }
  } else if(sec===3){
    for(let i=0;i<4;i++){
      const f=N[m[phrase+i]];
      flute(f,t+i*Q,Q*.72,.025,.25);
      if(i===2) bell(f*2,t+i*Q,Q*.5,.012,-.2);
    }
  } else if(sec===7){
    // sparse call/response
    for(let i=0;i<2;i++){
      const f=N[m[phrase+i]];
      flute(f,t+i*Q,Q*.74,.024,.28);
    }
    for(let i=2;i<4;i++){
      const f=N[m[phrase+i]];
      strings(f,t+i*Q,Q*.72,.029,-.16);
    }
  } else {
    for(let i=0;i<4;i++){
      const f=N[m[phrase+i]];
      strings(f,t+i*Q,Q*.76,.031+en*.003,.16);
      if(en>=4 && (i===0||i===2)) brass(f/2,t+i*Q,Q*.64,.026+en*.003,-.11);
    }
  }

  // Countermelodies and accents
  if(sec===2 && b%2===1){
    const c=[ch[2]*2,ch[1]*2,ch[0]*2,ch[1]*2];
    c.forEach((f,i)=>flute(f,t+i*Q,Q*.52,.016,.30));
  }

  if(sec===4 && b%2===0){
    brass(ch[0],t,Q*1.2,.042,-.12);
    brass(ch[1],t,Q*1.2,.032,.02);
    brass(ch[2],t,Q*1.2,.03,.12);
  }

  if(sec===5){
    if(b%2===0){
      brass(ch[0],t,Q*.9,.046,-.13);
      brass(ch[2],t+2*Q,Q*.9,.042,.12);
    }
    if(local===7 || local===15){
      cymbal(t+3*Q,.05);
      timp(t+3*Q,73.42,.075);
    }
  }

  if(sec===6 && b%4===3){
    // little cadence answer
    [N["A4"],N["G4"],N["F4"],N["D4"]].forEach((f,i)=>brass(f/2,t+i*Q,Q*.55,.03,-.04));
  }

  if(sec===7 && b%4===0){
    bell(ch[2]*2,t,.4,.018,.16);
  }

  if(sec===8){
    if(b%2===0){
      brass(ch[0],t,Q*1.3,.05,-.12);
      brass(ch[1],t,Q*1.3,.038,.02);
      brass(ch[2],t,Q*1.3,.036,.13);
    }
    if(b%4===0) cymbal(t,.052);
    if(b===143){
      cymbal(t+2*Q,.072);
      timp(t+2*Q,73.42,.11);
      brass(N["D3"],t+2*Q,Q*2,.095,-.12);
      brass(N["A3"],t+2*Q,Q*2,.072,.03);
      brass(N["D4"],t+2*Q,Q*2,.058,.14);
    }
  }
}

function tick(){
  if(!running) return;
  const horizon=ctx.currentTime+LOOKAHEAD;
  while(nextBarTime<horizon){
    scheduleBar(nextBar,nextBarTime);
    nextBar++;
    nextBarTime+=BAR;
    if(nextBar>=TOTAL_BARS) nextBar=0;
  }
}

async function start(){
  try{
    init();
    if(ctx.state==="suspended") await ctx.resume();
    if(running) return;

    running=true;
    nextBar=0;
    nextBarTime=ctx.currentTime+.08;
    tick();
    scheduler=setInterval(tick,TICK_MS);

  }catch(err){
    console.error(err);
    running=false;
  }
}

function stop(){
  running=false;
  if(scheduler){clearInterval(scheduler);scheduler=null}
  active.forEach(n=>{
    try{if(typeof n.stop==="function")n.stop()}catch(e){}
    try{n.disconnect()}catch(e){}
  });
  active=[];
}


return {start, stop, isRunning:()=>running};

}
function ensure(){
 if(!AudioCtx)return false;
 if(ctx)return true;
 ctx=new AudioCtx();bus=ctx.createGain();bus.gain.value=volume;bus.connect(ctx.destination);
 const shared={ctx,bus};menuTheme=makeMenuTheme(shared);gameTheme=makeGameTheme(shared);return true;
}
async function unlock(){
 unlocked=true;if(!ensure())return false;
 try{if(ctx.state==='suspended'&&!paused)await ctx.resume();}catch(_){}
 return true;
}
async function use(kind){
 if(!unlocked||!ensure())return;
 const wanted=kind==='game'?'game':'menu';
 if(current===wanted){if(paused){paused=false;try{await ctx.resume()}catch(_){}}return;}
 if(menuTheme?.isRunning())menuTheme.stop();if(gameTheme?.isRunning())gameTheme.stop();
 current=wanted;paused=false;try{if(ctx.state==='suspended')await ctx.resume();}catch(_){}
 if(wanted==='game')await gameTheme.start();else await menuTheme.start();
}
async function pause(){if(!ctx||paused)return;paused=true;try{await ctx.suspend()}catch(_){}}
async function resume(){if(!ctx||!paused)return;paused=false;try{await ctx.resume()}catch(_){}}
function stop(){if(menuTheme?.isRunning())menuTheme.stop();if(gameTheme?.isRunning())gameTheme.stop();current=null;paused=false;}
function setVolume(v){volume=Math.max(0,Math.min(1,Number(v)||0));try{localStorage.setItem('reiDosMaresMusicVolume',String(volume))}catch(_){}if(bus&&ctx)bus.gain.setTargetAtTime(volume,ctx.currentTime,.04);}
function getVolume(){return volume}
window.ReiMusic={unlock,use,pause,resume,stop,setVolume,getVolume,get current(){return current},get paused(){return paused}};
})();
