(() => {
'use strict';
const coarse = matchMedia?.('(pointer: coarse)')?.matches || navigator.maxTouchPoints > 0;
if(!coarse)return;

document.documentElement.classList.add('rdm-mobile');
document.body.classList.add('rdm-mobile');

const root=document.getElementById('mobile-controls');
const stick=document.getElementById('mobile-stick');
const knob=document.getElementById('mobile-stick-knob');
const esc=document.getElementById('mobile-esc');
const sizeSlider=document.getElementById('joystick-size');
const sizeValue=document.getElementById('joystick-size-value');
if(!root||!stick||!knob)return;

function clampJoystickPercent(v){return Math.max(30,Math.min(100,Math.round(Number(v)||50)));}
function applyJoystickSize(v,save=true){
  const pct=clampJoystickPercent(v);
  const px=Math.round(100+pct*1.4); // 50% = 170px; 30% = 142px; 100% = 240px.
  const knobPx=Math.round(px*.39);
  document.documentElement.style.setProperty('--mobile-stick-size',px+'px');
  document.documentElement.style.setProperty('--mobile-knob-size',knobPx+'px');
  if(sizeSlider)sizeSlider.value=String(pct);
  if(sizeValue)sizeValue.textContent=pct+'%';
  if(save){try{localStorage.setItem('reiDosMaresJoystickSize',String(pct));}catch(_){}}
}
let savedJoystick=50;
try{const raw=localStorage.getItem('reiDosMaresJoystickSize');if(raw!==null)savedJoystick=clampJoystickPercent(raw);}catch(_){}
applyJoystickSize(savedJoystick,false);
sizeSlider?.addEventListener('input',()=>applyJoystickSize(sizeSlider.value,true));

root.classList.remove('hidden');

const move={pointer:null,x:0,y:0};
const aim={pointer:null};
const pressed=new Set();

function setMoveKey(k,on){
  if(on){keys.add(k);pressed.add(k);}
  else{keys.delete(k);pressed.delete(k);}
}
function clearMove(){
  for(const k of [...pressed])keys.delete(k);
  pressed.clear();move.x=move.y=0;
  knob.style.transform='translate(-50%,-50%)';
}
function applyStick(clientX,clientY){
  const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let dx=clientX-cx,dy=clientY-cy;
  const max=Math.max(18,r.width*.32),len=Math.hypot(dx,dy)||1,scale=Math.min(1,max/len);
  dx*=scale;dy*=scale;move.x=dx/max;move.y=dy/max;
  knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
  const dead=.22;
  setMoveKey('a',move.x<-dead);setMoveKey('d',move.x>dead);
  setMoveKey('w',move.y<-dead);setMoveKey('s',move.y>dead);
}
stick.addEventListener('pointerdown',e=>{
  if(move.pointer!==null)return;e.preventDefault();e.stopPropagation();unlockAudio?.();
  move.pointer=e.pointerId;stick.setPointerCapture?.(e.pointerId);applyStick(e.clientX,e.clientY);
});
stick.addEventListener('pointermove',e=>{if(e.pointerId!==move.pointer)return;e.preventDefault();applyStick(e.clientX,e.clientY);});
function endStick(e){if(e.pointerId!==move.pointer)return;move.pointer=null;clearMove();}
stick.addEventListener('pointerup',endStick);stick.addEventListener('pointercancel',endStick);stick.addEventListener('lostpointercapture',()=>{move.pointer=null;clearMove();});

function canvasPoint(e){
  const r=canvas.getBoundingClientRect();
  return {
    x:clamp((e.clientX-r.left)/r.width*W,0,W),
    y:clamp((e.clientY-r.top)/r.height*H,0,H)
  };
}
canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'||aim.pointer!==null||state!=='play')return;
  e.preventDefault();unlockAudio?.();aim.pointer=e.pointerId;canvas.setPointerCapture?.(e.pointerId);
  const p=canvasPoint(e),ox=mouse.x,oy=mouse.y;mouse.x=p.x;mouse.y=p.y;mouse.down=true;
  tutorialAimMoved?.(mouse.x-ox,mouse.y-oy);shoot?.();
},{passive:false});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerId!==aim.pointer)return;e.preventDefault();
  const p=canvasPoint(e),ox=mouse.x,oy=mouse.y;mouse.x=p.x;mouse.y=p.y;mouse.down=true;
  tutorialAimMoved?.(mouse.x-ox,mouse.y-oy);
},{passive:false});
function endAim(e){if(e.pointerId!==aim.pointer)return;aim.pointer=null;mouse.down=false;}
canvas.addEventListener('pointerup',endAim,{passive:false});canvas.addEventListener('pointercancel',endAim,{passive:false});
canvas.addEventListener('lostpointercapture',()=>{aim.pointer=null;mouse.down=false;});

esc.addEventListener('pointerdown',e=>{
  e.preventDefault();e.stopPropagation();unlockAudio?.();
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));
});

document.addEventListener('visibilitychange',()=>{if(document.hidden){clearMove();mouse.down=false;aim.pointer=null;}});
window.addEventListener('blur',()=>{clearMove();mouse.down=false;aim.pointer=null;});
})();