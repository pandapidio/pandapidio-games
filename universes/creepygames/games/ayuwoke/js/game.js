'use strict';
/* =====================================================================
   AYUWOKE E A BATALHA DE AURA — minijogo de ritmo estilo Friday Night Funkin'
   Seções: 1 Config/Assets · 2 Áudio · 3 Entrada · 4 Desenho/animação · 5 Diálogo
           6 Cenas de história (intro, final, extra) · 7 Menu e dificuldade
           8 Charts · 9 Batalha · 10 Resultados/recorde · 11 Loop principal
   ===================================================================== */

/* ============ 1. CONFIG / ASSETS ============ */
const W = 1280, H = 720;
const AYU = 'Ayuwoke';                                   // nome do oponente (troque aqui se quiser outra grafia)
const BPM = 116.96, BEAT = 60000 / BPM;                  // trilha do Ayuwoke (ms por tempo)
const BAR_END = 38;                                      // último compasso com notas (música tem 40)
const cv = document.getElementById('c'), g = cv.getContext('2d');
const DIRS = ['left', 'down', 'up', 'right'];
const COL = ['#c24b99', '#00ffff', '#12fa05', '#f9393f'];
const FD = 'Impact,Haettenschweiler,"Arial Black","Arial Narrow Bold",sans-serif';   // fonte de títulos
const FT = '"Trebuchet MS",Verdana,sans-serif';                                     // fonte de texto
const SC = { jeff: 0.745, liu: 0.70, die: 0.851 };       // escala dos sprites novos
const IMG = {};
const AYU_POSE = ['f30', 'f21', 'f12', 'f33'];           // pose do Ayuwoke por direção
const LIU_POSE = ['liu_b2', 'liu_b3', 'liu_f0', 'liu_b1'];// pose da Liu por direção (modo extra)

/* Dificuldades. speed = px/ms das setas · win = [janela "bom", janela "perfeito"] em ms
   lvl = nível extra de densidade · duet = compasso em que os dois lados cantam juntos */
const MODES = {
  easy:   { id: 'easy',   name: 'FÁCIL',   mult: 0.5, col: '#5dd66b', speed: 0.60, win: [130, 55], missHp: 4.5, hit: [2.4, 1.2], ghost: 1.5, lvl: 0, duet: 32, pair: 0,    g16: false },
  medium: { id: 'medium', name: 'MÉDIO',   mult: 1,   col: '#ffc94a', speed: 0.74, win: [118, 50], missHp: 5.5, hit: [2.0, 1.0], ghost: 2.2, lvl: 1, duet: 24, pair: 0.12, g16: false },
  hard:   { id: 'hard',   name: 'DIFÍCIL', mult: 2,   col: '#ff4a4a', speed: 0.98, win: [100, 42], missHp: 8,   hit: [1.6, 0.8], ghost: 3.2, lvl: 2, duet: 12, pair: 0.15, g16: true },
  extra:  { id: 'extra',  name: 'EXTRA',   mult: 1.5, col: '#ff5a3c', speed: 0.90, win: [112, 48], missHp: 6.5, hit: [1.9, 0.95], ghost: 2.5 }
};

const files = { bg: 'ui/bg_bar.jpg', knife: 'ui/fx/knife.png', splash0: 'ui/fx/splash0.png', splash1: 'ui/fx/splash1.png', puddle: 'ui/fx/puddle.png',
  ic_jeff: 'ui/icons/jeff.png', ic_liu: 'ui/icons/liu.png', ic_ayu: 'ui/icons/ayu.png', liu_throw: 'sprites/liu/throw_empty.png' };
DIRS.forEach(k => files['jeff_' + k] = `sprites/jeff/${k}.png`);
for (let i = 0; i < 4; i++) { files['jeff_i' + i] = `sprites/jeff/idle${i}.png`; files['liu_b' + i] = `sprites/liu/pose${i}.png`; files['liu_f' + i] = `sprites/liu/face${i}.png`; }
for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) files[`ayu_f${r}${c}`] = `sprites/ayuwoki/f${r}${c}.png`;
for (let i = 0; i < 8; i++) files['ayu_die' + i] = `sprites/ayuwoki/die${i}.png`;
DIRS.forEach(d => ['receptor', 'note', 'press'].forEach(k => files[`${d}_${k}`] = `ui/fnf_arrows/${d}_${k}.png`));
const loadAll = () => Promise.all(Object.entries(files).map(([k, src]) => new Promise(r => {
  const im = new Image(); im.onload = im.onerror = r; im.src = src; IMG[k] = im;
})));

/* ============ 2. ÁUDIO ============ */
const AC = new (window.AudioContext || window.webkitAudioContext)();
const mk = (src, loop = false) => { const a = new Audio(src); a.loop = loop; a.preload = 'auto'; return a; };
const MUSIC = { calm: mk('audio/calm_intro.mp3', true), comic: mk('audio/comic_loop.mp3', true), battle: mk('audio/background_track.mp3'), extra: mk('audio/extra_track.mp3') };
const MJ = {};
['yow', 'bad-shamone', 'wow_8', 'michael-jackson-hee-hee', 'michael-jackson-vocal'].forEach(n => MJ[n] = mk(`audio/mj_effects/${n}.mp3`));
function sfx(n, vol = 1) { const a = MJ[n].cloneNode(); a.volume = vol; a.play().catch(() => {}); }
let curMusic = null;
function music(name, vol = 0.55) {                       // troca a trilha com fade
  const old = curMusic, nw = name ? MUSIC[name] : null; curMusic = nw;
  if (old && old !== nw) { const o = old, iv = setInterval(() => { o.volume = Math.max(0, o.volume - 0.08); if (o.volume <= 0) { o.pause(); clearInterval(iv); } }, 50); }
  if (nw) { nw.volume = vol; if (nw.paused) { nw.currentTime = 0; nw.play().catch(() => {}); } }
}
/* Voz sintetizada estilo FNF: bipes curtos. */
const VOICE = { jeff: ['square', 300, 60], liu: ['triangle', 190, 30], ayu: ['sawtooth', 420, 90], narr: ['sine', 500, 0] };
function bleep(freq, dur = 0.09, type = 'square', vol = 0.1) {
  const o = AC.createOscillator(), v = AC.createGain(), t = AC.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.85), t + dur);
  v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(v).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
}
function voice(who, i = 0) { const [type, f, r] = VOICE[who] || VOICE.narr; bleep(f + (i % 4) * r * 0.5 + Math.random() * r, 0.08, type, who === 'narr' ? 0.03 : 0.09); }
function thud(vol = 0.4) {                               // barulho de impacto (ruído filtrado)
  const n = AC.sampleRate * 0.3, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.15));
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), v = AC.createGain(); f.type = 'lowpass'; f.frequency.value = 900; v.gain.value = vol * 2.5;
  s.buffer = b; s.connect(f).connect(v).connect(AC.destination); s.start(); bleep(70, 0.25, 'sine', vol);
}
const tick = () => bleep(660, 0.05, 'square', 0.06);
const missSfx = () => { bleep(140, 0.16, 'sawtooth', 0.12); bleep(95, 0.22, 'square', 0.08); };   // erro no modo extra (sem MJ)

/* ============ 3. ENTRADA ============ */
const keys = {}, held = [false, false, false, false];
const LANE = { ArrowLeft: 0, a: 0, A: 0, ArrowDown: 1, s: 1, S: 1, ArrowUp: 2, w: 2, W: 2, ArrowRight: 3, d: 3, D: 3 };
let scene = {};
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const go = s => { scene = s; s.enter && s.enter(); };
function unlock() { AC.resume(); if (curMusic && curMusic.paused && !(scene === battle)) curMusic.play().catch(() => {}); }
addEventListener('keydown', e => {
  if (e.repeat) return; unlock();
  if (e.key in LANE) { e.preventDefault(); held[LANE[e.key]] = true; scene.lane && scene.lane(LANE[e.key]); }
  else if (['Enter', ' ', 'z', 'Z'].includes(e.key)) { e.preventDefault(); scene.confirm && scene.confirm(); }
  else if (e.key === 'Escape') { e.preventDefault(); scene.back && scene.back(); }
});
addEventListener('keyup', e => { if (e.key in LANE) held[LANE[e.key]] = false; });
function toCanvas(e) {                                   // coordenadas do mouse -> coordenadas 1280x720
  const r = cv.getBoundingClientRect(), s = Math.min(r.width / W, r.height / H), ox = r.left + (r.width - W * s) / 2, oy = r.top + (r.height - H * s) / 2;
  return [(e.clientX - ox) / s, (e.clientY - oy) / s];
}
addEventListener('pointermove', e => { if (scene.hover) scene.hover(...toCanvas(e)); });
addEventListener('pointerdown', e => { unlock(); if (scene.click) scene.click(...toCanvas(e)); else scene.confirm && scene.confirm(); });

/* ============ 4. DESENHO / ANIMAÇÃO ============ */
/* Sprite com âncora no centro-base (pés). o: s escala · sx/sy esticar · flip · ang · al · glow */
function spr(im, x, y, o = {}) {
  if (!im || !im.width) return; const s = o.s ?? 1, sx = (o.sx ?? 1) * s, sy = (o.sy ?? 1) * s;
  g.save(); g.globalAlpha = o.al ?? 1; g.translate(x, y); g.rotate(o.ang || 0); g.scale(o.flip ? -sx : sx, sy);
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = 22; }
  g.drawImage(im, -im.width / 2, -im.height); g.restore();
}
function shadow(x, y, w, al = 0.38) { g.save(); g.fillStyle = `rgba(0,0,0,${al})`; g.beginPath(); g.ellipse(x, y - 3, w / 2, 9, 0, 0, 6.29); g.fill(); g.restore(); }
function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function txt(t, x, y, size = 28, col = '#fff', align = 'center', stroke = '#000', font = FT) {
  g.font = `bold ${size}px ${font}`; g.textAlign = align; g.textBaseline = 'middle';
  g.lineWidth = Math.max(3, size / 6); g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(t, x, y); g.fillStyle = col; g.fillText(t, x, y);
}
function wrap(t, mw) {
  const o = []; let l = '';
  for (const w of t.split(' ')) { const n = l ? l + ' ' + w : w; if (g.measureText(n).width > mw && l) { o.push(l); l = w; } else l = n; }
  o.push(l); return o;
}
const fmt = n => Math.round(n).toLocaleString('pt-BR');
const ease = p => p * p * (3 - 2 * p);
const lerp = (a, b, p) => a + (b - a) * p;
const tw = (o, k, to, ms, done) => { const from = o[k], t0 = performance.now(); (function s() { const p = Math.min(1, (performance.now() - t0) / ms); o[k] = from + (to - from) * p; p < 1 ? requestAnimationFrame(s) : done && done(); })(); };
function vignette(red) {
  const r = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, red ? 'rgba(40,0,4,.72)' : 'rgba(0,0,0,.6)'); g.fillStyle = r; g.fillRect(0, 0, W, H);
}
/* câmera: tudo entre camPush/camPop é desenhado em coordenadas do mundo */
function camPush(z = 1, cx = W / 2, cy = H / 2, sx = 0, sy = 0) {
  cx = Math.max(W / 2 / z, Math.min(W - W / 2 / z, cx)); cy = Math.max(H / 2 / z, Math.min(H - H / 2 / z, cy));
  g.save(); g.translate(W / 2 + sx, H / 2 + sy); g.scale(z, z); g.translate(-cx, -cy);
}
const camPop = () => g.restore();
function drawBg(red) {
  g.drawImage(IMG.bg, 0, 0, W, H); g.fillStyle = 'rgba(0,0,10,.28)'; g.fillRect(0, 0, W, H);
  if (red) { g.globalCompositeOperation = 'multiply'; g.fillStyle = '#ff4a3a'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(130,0,12,.22)'; g.fillRect(0, 0, W, H); }
}

/* ---- Idle animado: ciclo de frames + respiração + balanço + pulo no ritmo ---- */
const SEQ = {
  jeff: [['jeff_i0', 1100], ['jeff_i3', 900], ['jeff_i0', 700], ['jeff_i1', 1300], ['jeff_i3', 800], ['jeff_i2', 1000]],
  liu:  [['liu_b0', 1500], ['liu_b2', 1000], ['liu_b0', 1300], ['liu_f1', 1400], ['liu_b0', 1700], ['liu_b2', 800]],
  ayu:  [['ayu_f00', 800], ['ayu_f01', 700], ['ayu_f03', 800], ['ayu_f01', 700]]
};
function cyc(who, t, off = 0) {
  const s = SEQ[who]; let tot = 0; for (const e of s) tot += e[1]; let m = (t + off) % tot;
  for (const [k, d] of s) { if (m < d) return { k, age: m }; m -= d; } return { k: s[0][0], age: 0 };
}
function breathe(t, seed = 0, pulse = 0) {
  const b = Math.sin(t / 420 + seed);
  return { sy: 1 + b * 0.02 + pulse * 0.035, sx: 1 - b * 0.012 - pulse * 0.02, ang: Math.sin(t / 950 + seed * 1.7) * 0.02, dy: -Math.abs(Math.sin(t / 700 + seed)) * 3 - pulse * 6, dx: Math.sin(t / 1400 + seed) * 4 };
}
/* Desenha um personagem. o: key (frame forçado) · s · pulse · talk · glow · flip · off (fase do ciclo) */
function drawChar(who, x, y, t, o = {}) {
  const base = { jeff: SC.jeff, liu: SC.liu, ayu: 1 }[who]; let key = o.key, pop = 0;
  if (!key) { const c = cyc(who, t, o.off || 0); key = c.k; pop = Math.max(0, 1 - c.age / 220); }
  const b = breathe(t, o.seed ?? { jeff: 0, liu: 2, ayu: 4 }[who], o.pulse || 0), talk = o.talk ? Math.sin(t / 55) * 0.022 : 0, s = (o.s ?? base) * (o.sc || 1);
  const isDie = key.startsWith('ayu_die');
  shadow(x + b.dx, y, 190 * s * (who === 'ayu' && !isDie ? 0.85 : 1));
  spr(IMG[key], x + b.dx, y + b.dy, { s, sx: b.sx * (1 - pop * 0.03), sy: b.sy * (1 + pop * 0.05) + talk, ang: b.ang + (o.ang || 0), flip: o.flip, glow: o.glow, al: o.al });
}

/* ============ 5. DIÁLOGO / HISTÓRIA ============ */
let A;                                                       // atores do cenário
const resetActors = () => A = { jeff: { x: 300, y: 545 }, liu: { x: 650, y: 515, dx: 0, ang: 0 }, ayu: { x: 1500, y: 545, vis: 0, pose: null, moon: false, dy: 0 },
  exp: {}, flip: false, leaving: false, red: false, liuKey: null, shake: 0, flash: 0 };
/* expressões: agora aparecem NO PERSONAGEM (sprite trocado), não na caixa de diálogo */
const EXP = {
  jeff: { grin: 'jeff_i0', laugh: 'jeff_i2', tease: 'jeff_i1', ouch: 'jeff_i3' },
  liu:  { stern: 'liu_b0', yell: 'liu_f3', bored: 'liu_f1', side: 'liu_b2', smirk: 'liu_f2', laugh: 'liu_f0' }
};
const SPK = { jeff: { name: 'JEFF', col: '#b9a4ff' }, liu: { name: 'LIU', col: '#e0a069' }, ayu: { name: AYU.toUpperCase(), col: '#e6ecff' }, narr: { name: '', col: '#7d7d92' } };

const INTRO = [
  ['narr', 0, 'Um bar escuro, de madrugada. A porta range... Jeff e Liu invadem o local.'],
  ['jeff', 'grin', 'Hehehe... que lugar aconchegante. Cheiro de cerveja velha e de medo. Meu favorito.'],
  ['jeff', 'laugh', 'Sabe o que combinaria com esse chão? Sangue. Pode ser o seu mesmo, mano... hihihi!'],
  ['liu', 'bored', 'Cala a boca e procura pistas. O Ayuwoke trabalha pro Homem Sem Rosto. Se alguém sabe onde ele está, é esse cantor.'],
  ['jeff', 'tease', 'Poxa, Liu... a gente já é parceiro de crime. Podia até virar amigo de novo, né?'],
  ['liu', 'yell', 'Não force intimidade. Essa parceria é temporária. Ela não muda o ódio que eu sinto por você, meu irmão.'],
  ['jeff', 'ouch', 'Hehe... ai. Essa doeu. Só um pouquinho.'],
  { w: 3200, who: 'narr', text: '♪ ...alguém desliza de costas, no escuro...', fx: () => { music('comic'); sfx('michael-jackson-hee-hee'); A.ayu.vis = 1; A.ayu.moon = true; tw(A.ayu, 'x', 990, 2800, () => A.ayu.moon = false); } },
  ['ayu', 0, 'Hee-hee! O que dois... visitantes... fazem no meu bar a essa hora? SHAMONE!', () => sfx('bad-shamone')],
  ['liu', 'yell', 'Diz onde está o Homem Sem Rosto. Agora. Ou você morre.'],
  ['jeff', 'laugh', 'Por favor, diz que não. Eu adoro quando dizem que não. Hihihi!'],
  ['ayu', 0, 'Podem me matar! Não vão descobrir NADA. Só existe um jeito de me fazer falar...', () => sfx('michael-jackson-vocal', 0.8)],
  ['ayu', 0, '...me vencendo numa BATALHA DE FARMAR AURA! Hee-hee!'],
  ['jeff', 'grin', `Aura? Hehehe... você não sabe com quem tá dançando, ${AYU}. Vamos lá.`],
  ['liu', 'side', 'Vou assistir daqui. Se ele trapacear, eu corto ele.']
];
const OUTRO = [
  { w: 2600, who: 'narr', text: `A última nota ecoa. ${AYU} cai de joelhos, ofegante...`, fx: () => { A.ayu.pose = 'ayu_f22'; sfx('wow_8'); } },
  ['ayu', 0, 'Hee-hee... eu perdi. Que passos, Jeff! Nem o Rei do Pop faria melhor. Você tem aura de sobra.', () => A.ayu.pose = null],
  ['ayu', 0, 'Aqui está o papel. O Homem Sem Rosto está no casarão abandonado, no fim da estrada da floresta.'],
  ['jeff', 'grin', `Hehehe... valeu pela dança, ${AYU}. Foi divertido.`],
  { w: 2600, who: 'narr', text: 'Jeff sai do bar, assobiando.', fx: () => { music('calm'); A.leaving = true; tw(A.jeff, 'x', -260, 2400); } },
  ['liu', 'smirk', 'Ele acha que acabou. E você, cantor... obrigado pela informação.'],
  ['ayu', 0, 'Hee...? Espera! Nós tínhamos um acordo!', () => sfx('yow')],
  ['liu', 'yell', 'Isso não faz de você inocente. Matar psicopatas nunca deixou de ser o meu trabalho.']
];
const EX_INTRO = [
  ['narr', 0, 'MODO EXTRA. Depois daquela madrugada, o bar ficou vazio. Só restaram os dois irmãos.'],
  ['jeff', 'tease', 'Hehehe... sozinhos de novo, Liu. Que nostalgia.'],
  ['liu', 'stern', 'Cansei dessa risada. Vamos resolver isso do jeito que o cantor gostava: numa batalha de aura.'],
  ['jeff', 'laugh', 'Você? Dançando? Hihihi! Isso eu pago pra ver!'],
  ['liu', 'smirk', 'Se eu vencer, você some da minha frente. Se você vencer... eu paro de te perseguir. Só por hoje.'],
  ['jeff', 'grin', 'Fechado! Hehehe... Vem, maninha.'],
  ['liu', 'yell', 'NÃO ME CHAMA ASSIM!']
];
const EX_OUTRO = [
  ['narr', 0, 'A última nota ecoa. Os dois ofegam no meio do bar vazio.'],
  ['liu', 'bored', 'Tsc... você venceu. Só dessa vez.'],
  ['jeff', 'grin', 'Aura de sobra, mana. Hehehe...'],
  ['liu', 'yell', 'Eu disse: não me chama assim. Vai embora antes que eu mude de ideia.']
];

const story = {
  lines: [], i: 0, ch: 0, t0: 0, onEnd: null, wait: 0, box: true, locked: false, cur: null,
  run(lines, onEnd) { this.lines = lines; this.i = -1; this.onEnd = onEnd; this.box = true; this.next(); },
  next() {
    this.i++; if (this.i >= this.lines.length) { this.box = false; this.wait = 0; const f = this.onEnd; this.onEnd = null; return f && f(); }
    const l = this.lines[this.i], o = Array.isArray(l) ? { who: l[0], exp: l[1], text: l[2], fx: l[3] } : l;
    this.cur = o; this.ch = 0; this.t0 = performance.now(); this.wait = o.w ? performance.now() + o.w : 0; this.box = true;
    A.exp = {}; if (o.who !== 'narr' && o.exp) A.exp[o.who] = o.who === 'ayu' ? 'ayu_' + o.exp : EXP[o.who][o.exp];
    o.fx && o.fx();
  },
  skip() { if (!this.onEnd) return; this.box = false; this.wait = 0; const f = this.onEnd; this.onEnd = null; f(); },
  talking(who) { return this.box && this.cur && this.cur.who === who && this.ch < this.cur.text.length; },
  confirm() {
    if (!this.cur || this.wait || this.locked || !this.box) return;
    if (this.ch < this.cur.text.length) this.ch = this.cur.text.length; else this.next();
  },
  update() {
    const o = this.cur; if (!o || !this.box) return;
    const n = Math.min(o.text.length, Math.floor((performance.now() - this.t0) / 32));
    if (n > this.ch) { for (let k = this.ch; k < n; k++) if (k % 2 === 0 && o.text[k] !== ' ') voice(o.who, k); this.ch = n; }
    if (this.wait && performance.now() > this.wait) { this.wait = 0; this.next(); }
  },
  draw(skipHint) {
    const o = this.cur; if (!o || !this.box) return;
    const bx = 90, by = 586, bw = 1100, bh = 122, spk = SPK[o.who], now = performance.now();
    g.save(); g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = 26; g.shadowOffsetY = 6; rr(bx, by, bw, bh, 20); g.fillStyle = 'rgba(12,8,22,.93)'; g.fill(); g.restore();
    rr(bx, by, bw, bh, 20); g.lineWidth = 4; g.strokeStyle = spk.col; g.stroke();
    rr(bx + 8, by + 8, bw - 16, bh - 16, 14); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.10)'; g.stroke();
    if (o.who !== 'narr') {                                     // etiqueta com o nome + seta apontando para quem fala
      g.font = `bold 26px ${FD}`; const tw_ = g.measureText(spk.name).width + 44, tx = bx + 30, ty = by - 20;
      rr(tx, ty - 18, tw_, 38, 10); g.fillStyle = spk.col; g.fill(); g.lineWidth = 3; g.strokeStyle = '#000'; g.stroke();
      g.fillStyle = '#15101f'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(spk.name, tx + tw_ / 2, ty + 2);
      const ax = Math.max(bx + 70, Math.min(bx + bw - 70, { jeff: A.jeff.x, liu: A.liu.x + (A.liu.dx || 0), ayu: A.ayu.x }[o.who] || bx + 80));
      g.beginPath(); g.moveTo(ax - 15, by + 1); g.lineTo(ax + 15, by + 1); g.lineTo(ax, by - 15); g.closePath(); g.fillStyle = spk.col; g.fill(); g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke();
    }
    g.font = `${o.who === 'narr' ? 'italic ' : ''}bold 27px ${FT}`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = o.who === 'narr' ? '#cfd0e6' : '#fff';
    let left = this.ch, y = by + 26;
    for (const ln of wrap(o.text, bw - 80)) { g.fillText(ln.slice(0, left), bx + 40, y); left -= ln.length + 1; y += 36; if (left <= 0) break; }
    if (!this.wait && this.ch >= o.text.length && Math.floor(now / 400) % 2) txt('▼', bx + bw - 34, by + bh - 24, 22, spk.col === '#7d7d92' ? '#fff' : spk.col);
    if (skipHint) txt('ESC: pular', bx + bw - 12, by - 14, 16, '#aaa', 'right');
  }
};

function drawActors(t, opt = {}) {
  const sp = story.box && story.cur ? story.cur.who : null, gl = w => sp === w ? SPK[w].col : null;
  if (A.liu.vis !== false) drawChar('liu', A.liu.x + (A.liu.dx || 0), A.liu.y, t, { key: A.liuKey || A.exp.liu, flip: A.flip, talk: story.talking('liu'), glow: gl('liu'), ang: A.liu.ang || 0 });
  if (A.jeff.x > -260 && A.jeffOn !== false) drawChar('jeff', A.jeff.x, A.jeff.y + (A.leaving ? -Math.abs(Math.sin(t / 130)) * 16 : 0), t, { key: A.exp.jeff, talk: story.talking('jeff'), glow: gl('jeff'), pulse: A.leaving ? 0.4 : 0 });
  const a = A.ayu;
  if (a.vis && !opt.skipAyu) {
    const key = a.moon ? ['ayu_f00', 'ayu_f01', 'ayu_f03', 'ayu_f01'][Math.floor(t / 130) % 4] : (A.exp.ayu || a.pose || null);
    drawChar('ayu', a.x, a.y + (a.dy || 0), t, { key, ang: a.moon ? -0.05 : 0, talk: story.talking('ayu'), glow: gl('ayu'), pulse: a.moon ? 0.35 : 0 });
  }
}

/* ============ 6. CENAS DE HISTÓRIA ============ */
/* ---- Introdução (modo normal) ---- */
const introScene = {
  enter() { resetActors(); music('calm', 0.5); story.locked = false; story.run(INTRO, () => startBattle(introScene.diff)); },
  update() { story.update(); }, confirm() { story.confirm(); }, back() { story.skip(); },
  draw(t) { camPush(); drawBg(); drawActors(t); camPop(); vignette(); story.draw(true); }
};
/* ---- Final (modo normal): faca arremessada, cravada no peito e a morte do Ayuwoke ---- */
const DIE_T = [0, 350, 750, 1200, 1750, 2300, 2850, 3350], DIE_END = 4800;    // início de cada frame da morte (ms após o impacto)
const KN = [[1, 272, -8], [-4, 248, -12], [-3, 216, -14], [2, 164, -22], [-21, 136, -26], [87, 109, -30]];   // ponto da faca em cada frame: dx, altura (px do sprite), ângulo (graus)
const KS = 0.38;                                                                // escala da faca
const outro = {
  phase: 0, t0: 0, hitAt: 0, parts: [], decals: [], trail: [], snd: [0, 0], lastDrip: 0,
  enter() {
    A.jeff = { x: 300, y: 545 }; A.liu = { x: 650, y: 515, dx: 0, ang: 0 }; A.ayu = { x: 990, y: 545, vis: 1, pose: null, moon: false, dy: 0 }; A.leaving = false; A.liuKey = null; A.flash = 0; A.shake = 0;
    music('comic', 0.5); this.phase = 0; this.hitAt = 0; this.parts = []; this.decals = []; this.trail = []; this.snd = [0, 0]; story.locked = false; story.run(OUTRO, () => this.kill());
  },
  kill() { this.phase = 1; this.t0 = performance.now(); story.locked = true; music(null); this.flying = false; },
  chest(i, ax, ay) { const k = KN[Math.min(i, 5)]; return [ax + k[0] * SC.die, ay - k[1] * SC.die, k[2] * Math.PI / 180]; },
  update() {
    story.update(); if (this.phase !== 1) return; const now = performance.now(), e = now - this.t0;
    const L = A.liu;
    if (!this.hitAt) {
      if (e < 600) { A.liuKey = 'liu_f2'; const p = ease(e / 600); L.ang = -0.05 * p; L.dx = -8 * p; }                 // preparação: faca para trás, sorriso maldoso
      else if (e < 720) { A.liuKey = 'liu_b1'; L.ang = 0; L.dx = lerp(-8, 30, (e - 600) / 120); }                          // braço estendido
      else { A.liuKey = 'liu_throw'; L.dx = 30; if (!this.flying) { this.flying = true; bleep(900, 0.15, 'sawtooth', 0.1); } }  // mão vazia: a faca saiu
      if (this.flying) {
        const p = Math.min(1, (e - 720) / 460), [cx, cy, a0] = this.chest(0, A.ayu.x, A.ayu.y), kl2 = IMG.knife.width * KS / 2;
        const sx = L.x + L.dx + 236 * SC.liu, sy = L.y - 150 * SC.liu, ex = cx - kl2 * Math.cos(a0), ey = cy - kl2 * Math.sin(a0);
        this.k = { x: lerp(sx, ex, p), y: lerp(sy, ey, p) - Math.sin(p * Math.PI) * 26, a: a0 + (1 - p) * (0.58 - 4 * Math.PI) };
        this.trail.push({ ...this.k }); if (this.trail.length > 5) this.trail.shift();
        if (p >= 1) { this.hitAt = now; this.flying = false; thud(); sfx('yow', 0.9); A.flash = 1; A.shake = 22; this.trail = []; }
      }
    } else {
      const h = now - this.hitAt; A.shake = Math.max(0, 22 - h / 25); A.flash = Math.max(0, 1 - h / 350);
      if (h > 900) { A.liuKey = null; L.dx = lerp(L.dx, 0, 0.05); L.ang = 0; }
      if (h > DIE_T[4] && !this.snd[0]) { this.snd[0] = 1; thud(0.25); }
      if (h > DIE_T[6] && !this.snd[1]) { this.snd[1] = 1; thud(0.32); }
      if (h > DIE_END && this.phase === 1) { this.phase = 2; this.endAt = now; store.set('game_complete', 'true'); window.game_complete = true; dispatchEvent(new CustomEvent('game_complete')); }
    }
  },
  confirm() {
    if (this.phase === 0) story.confirm();
    else if (this.phase === 2 && performance.now() - this.endAt > 1500) results.show({ kind: 'win', cfg: battle.cfg, res: battle.res });
  },
  drawDying(h) {                                                 // Ayuwoke morrendo (frames novos + faca + sangue)
    const a = A.ayu, ay = a.y, drift = 44 * ease(Math.min(1, h / 3300)) + 18 * Math.exp(-h / 120), ax = a.x + drift;
    let idx = 0; for (let i = 0; i < DIE_T.length; i++) if (h >= DIE_T[i]) idx = i;
    const k = Math.min(1, (h - DIE_T[idx]) / 80), [wx, wy, wa] = idx > 0 && k < 1 ? this.chest(idx - 1, ax, ay).map((v, j) => lerp(v, this.chest(idx, ax, ay)[j], k)) : this.chest(idx, ax, ay);
    // poça de sangue crescendo (atrás do corpo)
    if (h > DIE_T[3]) { const p = ease(Math.min(1, (h - DIE_T[3]) / 3000)), im = IMG.puddle; g.save(); g.translate(ax + 14, ay - 10); g.scale(0.85 * p, 0.85 * p); g.globalAlpha = 0.95; g.drawImage(im, -im.width / 2, -im.height / 2); g.restore(); }
    for (const d of this.decals) { g.fillStyle = '#5a0a10'; g.beginPath(); g.ellipse(d.x, d.y, d.r * 1.6, d.r * 0.6, 0, 0, 6.3); g.fill(); }
    if (h < 1500) { const im = IMG.splash0, p = h / 1500, s = 0.45 * (0.5 + 0.5 * Math.min(1, h / 140)); g.save(); g.globalAlpha = Math.max(0, 1 - p * p); g.translate(wx + 70, wy - 30); g.scale(s, s); g.drawImage(im, -im.width / 2, -im.height / 2); g.restore(); }
    shadow(ax, ay, 190 * SC.die * (idx >= 5 ? 1.5 : 1));
    const sq = h < 160 ? 1 - 0.08 * (1 - h / 160) : 1;
    if (idx > 0) spr(IMG['ayu_die' + (idx - 1)], ax, ay, { s: SC.die });
    spr(IMG['ayu_die' + idx], ax, ay, { s: SC.die, al: idx > 0 ? k : 1, sx: sq });
    if (idx <= 6) {                                              // faca cravada (só o cabo aparece) — some quando ele cai de bruços
      const al = idx === 6 ? 1 - k : 1, pen = Math.min(1, h / 90), wob = Math.sin(h / 18) * 0.08 * Math.exp(-h / 300), kl2 = IMG.knife.width * KS / 2, keo = (IMG.knife.width / 2 - 191) * KS;
      g.save(); g.globalAlpha = al; g.translate(wx, wy); g.rotate(wa + wob); g.beginPath(); g.rect(-400, -200, 400, 400); g.clip();
      g.translate(-kl2 + (kl2 + keo) * pen, 0); g.scale(KS, KS); g.drawImage(IMG.knife, -IMG.knife.width / 2, -IMG.knife.height / 2); g.restore();
    }
    if (h < 700) { const im = IMG.splash1, s = 0.3 * (0.6 + 0.4 * Math.min(1, h / 120)); g.save(); g.globalAlpha = Math.max(0, 1 - h / 700); g.translate(wx - 6, wy); g.scale(-s, s); g.drawImage(im, -im.width / 2, -im.height / 2); g.restore(); }
    // gotas de sangue caindo do ferimento
    const now = performance.now(); if (h < 2900 && now - this.lastDrip > 70) { this.lastDrip = now; this.parts.push({ x: wx, y: wy, vx: Math.random() * 1.6 - 0.4, vy: -Math.random() * 2.4, r: 2 + Math.random() * 2.4 }); }
    for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.4; if (p.y >= ay - 4 + Math.random() * 6) { p.dead = 1; this.decals.push({ x: p.x, y: ay - 2 + Math.random() * 8, r: p.r }); } g.fillStyle = '#a3121b'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.3); g.fill(); }
    this.parts = this.parts.filter(p => !p.dead); if (this.decals.length > 90) this.decals.shift();
  },
  draw(t) {
    const now = performance.now(), h = this.hitAt ? now - this.hitAt : -1, sh = (Math.random() - 0.5) * (A.shake || 0);
    let z = 1, cx = W / 2, cy = H / 2; if (h >= 0) { const p = ease(Math.min(1, h / 3600)); z = lerp(1, 1.28, p); cx = lerp(W / 2, A.ayu.x, p); cy = lerp(H / 2, 400, p); }
    camPush(z, cx, cy, sh, 0); drawBg(); drawActors(t, { skipAyu: h >= 0 });
    if (h >= 0) this.drawDying(h);
    if (this.flying && this.k) {                                 // faca girando + rastro
      this.trail.forEach((q, i) => { g.save(); g.globalAlpha = 0.12 * (i + 1); g.translate(q.x, q.y); g.rotate(q.a); g.scale(KS, KS); g.drawImage(IMG.knife, -IMG.knife.width / 2, -IMG.knife.height / 2); g.restore(); });
      g.save(); g.translate(this.k.x, this.k.y); g.rotate(this.k.a); g.scale(KS, KS); g.drawImage(IMG.knife, -IMG.knife.width / 2, -IMG.knife.height / 2); g.restore();
    }
    camPop(); vignette();
    if (A.flash > 0) { g.fillStyle = `rgba(255,255,255,${A.flash * 0.8})`; g.fillRect(0, 0, W, H); }
    story.draw();
    if (this.phase === 2) {
      const k = Math.min(1, (now - this.endAt) / 1200); g.fillStyle = `rgba(0,0,0,${0.85 * k})`; g.fillRect(0, 0, W, H);
      g.globalAlpha = k; txt('FIM', W / 2, 230, 110, '#fff', 'center', '#000', FD); txt(`${AYU} foi eliminado. Ele entregou a pista...`, W / 2, 335, 28, '#ddd');
      txt('...mas matar psicopatas nunca deixou de ser o trabalho da Liu.', W / 2, 380, 28, '#ddd');
      txt(`Pontuação final: ${fmt(battle.res.final)}`, W / 2, 470, 34, '#ffd54a'); txt('ENTER ou clique para ver os resultados', W / 2, 590, 22, '#aaa'); g.globalAlpha = 1;
    }
  }
};
/* ---- Modo extra: conversa antes e depois da batalha (Jeff x Liu) ---- */
const extraIntro = {
  enter() { resetActors(); A.red = true; A.liu = { x: 990, y: 545, dx: 0, ang: 0 }; music('calm', 0.5); story.locked = false; story.run(EX_INTRO, () => startBattle('extra')); },
  update() { story.update(); }, confirm() { story.confirm(); }, back() { story.skip(); },
  draw(t) { camPush(); drawBg(true); drawActors(t); camPop(); vignette(true); story.draw(true); }
};
const extraOutro = {
  enter() { resetActors(); A.red = true; A.liu = { x: 990, y: 545, dx: 0, ang: 0 }; music('calm', 0.5); story.locked = false; story.run(EX_OUTRO, () => results.show({ kind: 'win', cfg: battle.cfg, res: battle.res })); },
  update() { story.update(); }, confirm() { story.confirm(); },
  draw(t) { camPush(); drawBg(true); drawActors(t); camPop(); vignette(true); story.draw(); }
};

/* ============ 7. MENU E DIFICULDADE ============ */
const inR = (r, x, y) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
function getBest() { try { return JSON.parse(store.get('ayuwoke_best')); } catch (e) { return null; } }
function button(x, y, w, h, label, sel, c1, c2, t) {           // botão estilizado do menu
  g.save(); g.translate(x + w / 2, y + h / 2); const s = sel ? 1.06 + Math.sin(t / 180) * 0.012 : 1; g.scale(s, s); g.translate(-w / 2, -h / 2);
  if (sel) { g.shadowColor = c1; g.shadowBlur = 34; }
  rr(0, 0, w, h, 18); if (sel) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; } else g.fillStyle = 'rgba(14,10,26,.86)'; g.fill();
  g.shadowBlur = 0; g.lineWidth = sel ? 5 : 3; g.strokeStyle = sel ? '#fff' : c1; g.stroke();
  if (sel) { g.save(); rr(0, 0, w, h, 18); g.clip(); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, 0, w, h * 0.45); g.restore(); }
  txt(label, w / 2, h / 2 + 2, 42, '#fff', 'center', '#000', FD);
  if (sel) { const b = Math.sin(t / 150) * 5; txt('▶', -34 + b, h / 2, 30, '#fff'); txt('◀', w + 34 - b, h / 2, 30, '#fff'); }
  g.restore();
}
function logoLine(str, cx, y, size, t, o) {                    // letras individuais com balanço, extrusão, contorno e degradê
  g.font = `${size}px ${FD}`; g.textBaseline = 'middle'; g.textAlign = 'center';
  const sp = o.sp || 4, ws = [...str].map(c => g.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0) + sp * (str.length - 1); let x = cx - tot / 2; const xs = [];
  [...str].forEach((c, i) => {
    const w = ws[i], px = x + w / 2, dy = Math.sin(t / 380 + i * 0.8) * (o.wob || 5), rot = Math.sin(t / 620 + i * 1.3) * (o.rot || 0.03); xs.push([px, dy]);
    if (c !== ' ') {
      g.save(); g.translate(px, y + dy); g.rotate(rot); g.font = `${size}px ${FD}`;
      for (let k = o.ext; k > 0; k -= 2) { g.fillStyle = o.extCol; g.fillText(c, 0, k); }
      g.lineJoin = 'round'; g.lineWidth = o.lw; g.strokeStyle = '#000'; g.strokeText(c, 0, 0);
      const gr = g.createLinearGradient(0, -size * 0.4, 0, size * 0.4); o.grad.forEach(([p, col]) => gr.addColorStop(p, col)); g.fillStyle = gr; g.fillText(c, 0, 0); g.restore();
    }
    x += w + sp;
  });
  return xs;
}
function logoW(str, size, sp) { g.font = `${size}px ${FD}`; return [...str].reduce((a, c) => a + g.measureText(c).width, 0) + sp * (str.length - 1); }
function drawLogo(t) {
  const gl = g.createRadialGradient(W / 2, 170, 20, W / 2, 170, 430); gl.addColorStop(0, `rgba(150,90,255,${0.42 + Math.sin(t / 700) * 0.08})`); gl.addColorStop(1, 'rgba(150,90,255,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, 420);
  const Y1 = 104; g.font = `158px ${FD}`; g.textBaseline = 'middle'; const bot = 158 * 0.37;
  const xs = logoLine(AYU.toUpperCase(), W / 2, Y1, 158, t, { sp: 6, ext: 14, extCol: '#2a0f4a', lw: 18, wob: 5, rot: 0.03, grad: [[0, '#ffffff'], [0.5, '#e4d8ff'], [1, '#9f78ff']] });
  const Y2 = Y1 + bot + 66;                                                         // 2ª linha logo abaixo da 1ª
  const wEA = logoW('E A', 46, 3), wB = logoW('BATALHA DE AURA', 78, 3), tot = wEA + 34 + wB, sx = W / 2 - tot / 2;
  logoLine('E A', sx + wEA / 2, Y2 - 6, 46, t, { sp: 3, ext: 6, extCol: '#5a0d16', lw: 10, wob: 3, rot: 0.04, grad: [[0, '#ffd0e6'], [1, '#ff5d9e']] });
  logoLine('BATALHA DE AURA', sx + wEA + 34 + wB / 2, Y2, 78, t + 500, { sp: 3, ext: 8, extCol: '#5a1608', lw: 12, wob: 3, rot: 0.02, grad: [[0, '#fff2a8'], [0.55, '#ffc23d'], [1, '#ff6a2b']] });
  xs.forEach(([px, dy], i) => {                                                     // sangue escorrendo das letras (por cima de tudo)
    if (i % 2 === 1) return; const len = 22 + 30 * (Math.sin(t / 650 + i * 2.1) * 0.5 + 0.5), y0 = Y1 + dy + bot - 8, x = px + ((i % 3) - 1) * 8;
    g.lineCap = 'round'; g.strokeStyle = '#000'; g.lineWidth = 16; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + len); g.stroke();
    g.strokeStyle = '#c1121f'; g.lineWidth = 9; g.beginPath(); g.moveTo(x, y0 - 4); g.lineTo(x, y0 + len); g.stroke();
    g.fillStyle = '#ee4a52'; g.beginPath(); g.arc(x - 2, y0 + len - 3, 2.6, 0, 6.3); g.fill();
  });
}
function drawEmbers(list, t, red) {
  for (const p of list) { p.y -= p.v; p.x += Math.sin(t / 900 + p.ph) * 0.4; if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
    g.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t / 700 + p.ph)); g.fillStyle = red ? '#ff7a3c' : '#c9a8ff'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.3); g.fill(); }
  g.globalAlpha = 1;
}
const menu = {
  sel: 0, rects: [], embers: [],
  items: [{ label: 'JOGAR', c1: '#9b6bff', c2: '#4b2aa8', act: () => go(diffScene) }, { label: 'MODO EXTRA', c1: '#ff5a3c', c2: '#a3141c', act: () => go(extraIntro) }],
  enter() { music('calm', 0.45); cv.style.cursor = 'default'; if (!this.embers.length) for (let i = 0; i < 46; i++) this.embers.push({ x: Math.random() * W, y: Math.random() * H, v: 0.3 + Math.random() * 0.8, r: 1 + Math.random() * 2.2, ph: Math.random() * 6 }); },
  lane(l) { if (l === 1 || l === 2) { this.sel = (this.sel + 1) % 2; tick(); } },
  hover(x, y) { const i = this.rects.findIndex(r => inR(r, x, y)); if (i >= 0 && i !== this.sel) { this.sel = i; tick(); } cv.style.cursor = i >= 0 ? 'pointer' : 'default'; },
  click(x, y) { const i = this.rects.findIndex(r => inR(r, x, y)); if (i >= 0) { this.sel = i; this.confirm(); } },
  confirm() { bleep(880, 0.1, 'square', 0.08); this.items[this.sel].act(); },
  draw(t) {
    camPush(); drawBg(); camPop(); g.fillStyle = 'rgba(8,4,20,.35)'; g.fillRect(0, 0, W, H); drawEmbers(this.embers, t, false); vignette();
    const pl = Math.max(0, 1 - (t % BEAT) / (BEAT * 0.6)) * 0.5;
    drawChar('liu', 375, 706, t, { s: SC.liu * 0.98, pulse: pl });
    drawChar('jeff', 165, 706, t, { s: SC.jeff * 1.12, pulse: pl });
    drawChar('ayu', 1095, 706, t, { s: 1.08, pulse: pl });
    drawLogo(t);
    this.rects = [];
    this.items.forEach((it, i) => { const x = 430, y = 392 + i * 108, w = 420, h = 80; this.rects.push([x, y, w, h]); button(x, y, w, h, it.label, i === this.sel, it.c1, it.c2, t); });
    const b = getBest();                                                          // recorde no canto inferior
    rr(24, 636, 400, 62, 14); g.fillStyle = 'rgba(10,6,22,.85)'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffd54a'; g.stroke();
    txt('RECORDE', 44, 656, 17, '#ffd54a', 'left'); txt(b ? fmt(b.score) : '—', 44, 681, 30, '#fff', 'left', '#000', FD);
    if (b) txt(MODES[b.mode].name, 404, 668, 22, MODES[b.mode].col, 'right', '#000', FD);
    txt('↑ ↓ escolher   ·   ENTER confirmar', W - 24, 690, 18, '#b9b3d6', 'right');
  }
};
const CARD = {
  easy:   { desc: 'Ritmo tranquilo, ideal para começar.', bars: [1, 1, 1] },
  medium: { desc: 'Notas mais rápidas e mais frequentes.', bars: [3, 3, 3] },
  hard:   { desc: 'Velocidade máxima e pouca margem de erro.', bars: [5, 5, 5] }
};
const diffScene = {
  sel: 0, ids: ['easy', 'medium', 'hard'], rects: [], back_r: [30, 26, 170, 46], embers: menu.embers,
  enter() { this.sel = 0; music('calm', 0.45); },
  lane(l) { if (l === 0) this.sel = (this.sel + 2) % 3; else if (l === 3) this.sel = (this.sel + 1) % 3; else return; tick(); },
  hover(x, y) { const i = this.rects.findIndex(r => inR(r, x, y)); if (i >= 0 && i !== this.sel) { this.sel = i; tick(); } cv.style.cursor = (i >= 0 || inR(this.back_r, x, y)) ? 'pointer' : 'default'; },
  click(x, y) { if (inR(this.back_r, x, y)) return this.back(); const i = this.rects.findIndex(r => inR(r, x, y)); if (i >= 0) { this.sel = i; this.confirm(); } },
  confirm() { bleep(880, 0.1, 'square', 0.08); introScene.diff = this.ids[this.sel]; go(introScene); },
  back() { tick(); go(menu); },
  draw(t) {
    camPush(); drawBg(); camPop(); g.fillStyle = 'rgba(8,4,20,.6)'; g.fillRect(0, 0, W, H); drawEmbers(this.embers, t, false); vignette();
    txt('ESCOLHA A DIFICULDADE', W / 2, 96, 62, '#fff', 'center', '#000', FD);
    txt('A dificuldade muda a pontuação final — vencer a batalha depende só de você.', W / 2, 146, 21, '#cfc8ff');
    this.rects = []; const cw = 330, ch = 390, gap = 40, x0 = (W - (3 * cw + 2 * gap)) / 2, y0 = 196;
    this.ids.forEach((id, i) => {
      const m = MODES[id], cd = CARD[id], sel = i === this.sel, x = x0 + i * (cw + gap); this.rects.push([x, y0, cw, ch]);
      g.save(); g.translate(x + cw / 2, y0 + ch / 2); const s = sel ? 1.05 + Math.sin(t / 220) * 0.008 : 0.96; g.scale(s, s); g.translate(-cw / 2, -ch / 2);
      if (sel) { g.shadowColor = m.col; g.shadowBlur = 36; }
      rr(0, 0, cw, ch, 22); g.fillStyle = 'rgba(14,10,28,.94)'; g.fill(); g.shadowBlur = 0; g.lineWidth = sel ? 6 : 3; g.strokeStyle = sel ? m.col : 'rgba(255,255,255,.25)'; g.stroke();
      g.save(); rr(0, 0, cw, ch, 22); g.clip(); g.globalAlpha = sel ? 1 : 0.7; g.fillStyle = m.col; g.fillRect(0, 0, cw, 84); g.restore();
      txt(m.name, cw / 2, 44, 54, '#fff', 'center', '#000', FD);
      txt('PONTUAÇÃO', cw / 2, 120, 17, '#aaa'); txt('×' + String(m.mult).replace('.', ','), cw / 2, 170, 66, m.col, 'center', '#000', FD);
      ['VELOCIDADE', 'NOTAS', 'EXIGÊNCIA'].forEach((lb, j) => { const yy = 226 + j * 36; txt(lb, 26, yy, 16, '#ccc', 'left'); for (let k = 0; k < 5; k++) { rr(158 + k * 30, yy - 9, 24, 18, 5); g.fillStyle = k < cd.bars[j] ? m.col : 'rgba(255,255,255,.14)'; g.fill(); } });
      g.font = `bold 20px ${FT}`; wrap(cd.desc, cw - 50).forEach((ln, j) => txt(ln, cw / 2, 344 + j * 26, 20, '#e8e4ff'));
      g.restore();
    });
    const hb = inR(this.back_r, 0, 0); rr(...this.back_r, 12); g.fillStyle = 'rgba(14,10,26,.86)'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#9b6bff'; g.stroke(); txt('◀ VOLTAR', 115, 49, 26, '#fff', 'center', '#000', FD);
    txt('← →  escolher   ·   ENTER confirmar   ·   ESC voltar', W / 2, 690, 19, '#b9b3d6');
  }
};

/* ============ 8. CHARTS ============ */
/* Fácil = o chart original (mesma semente). Médio/difícil: mais densidade, duetos mais cedo e (difícil) padrões de 16avos. */
function makeChart(c) {
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let s2 = 99; const r2 = () => (s2 = (s2 * 1664525 + 1013904223) >>> 0) / 4294967296;      // sorteio separado: não altera o chart fácil
  const T8 = [[1, 0, 1, 0, 1, 0, 1, 0], [1, 0, 0, 1, 0, 1, 1, 0], [1, 1, 0, 1, 0, 0, 1, 0], [1, 0, 1, 1, 0, 1, 0, 1], [1, 1, 1, 0, 1, 1, 0, 1]];
  const dbl = p => p.flatMap(v => [v, 0]);                                                  // 8 slots -> 16 slots
  const T16 = [[1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0], [1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1],
               [1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1], [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1]];
  const notes = [], prev = [-1, -1], rep = [0, 0];
  for (let bar = 2; bar <= BAR_END; bar++) {
    const sec = (bar - 2) >> 1, duet = bar >= c.duet, sides = duet ? [0, 1] : [sec % 2 === 0 ? 1 : 0];
    for (const side of sides) {
      const lvl = Math.min(4, Math.floor(bar / 8) + (rnd() < 0.35 ? 1 : 0) + c.lvl);
      const pat = (duet && side === 1) ? dbl(T8[1]) : (c.g16 && lvl >= 3 ? T16[(lvl - 3) * 2 + (bar & 1)] : dbl(T8[lvl]));
      pat.forEach((on, slot) => {
        if (!on) return; let l; do { l = Math.floor(rnd() * 4); } while (l === prev[side] && rep[side] >= 2);
        rep[side] = l === prev[side] ? rep[side] + 1 : 0; prev[side] = l;
        notes.push({ t: (bar * 4 + slot / 4) * BEAT, lane: l, side, hit: false, miss: false });
        if (c.pair && side === 0 && slot % 2 === 0 && !pat[slot + 1] && !pat[slot + 2] && slot < 14 && r2() < c.pair)          // 16avo extra (médio/difícil)
          notes.push({ t: (bar * 4 + (slot + 1) / 4) * BEAT, lane: (l + 1 + Math.floor(r2() * 3)) % 4, side, hit: false, miss: false });
      });
    }
  }
  return notes.sort((a, b) => a.t - b.t);
}

/* ============ 9. BATALHA ============ */
const STRUM_Y = 105, NS = 0.88, GAP = 106, LX = [70, 800];
function startBattle(id) { battle.cfg = MODES[id]; go(battle); }
const battle = {
  cfg: MODES.easy,
  enter() {
    const c = this.cfg, ex = this.ex = c.id === 'extra', now = performance.now();
    this.notes = ex ? EXTRA.notes.map(n => ({ t: n[0], lane: n[1], side: n[2], hit: false, miss: false })) : makeChart(c);
    this.audio = ex ? MUSIC.extra : MUSIC.battle; this.startAt = ex ? EXTRA.startAt * 1000 : 0; this.endMs = ex ? EXTRA.dur * 1000 - 250 : 80500; this.beatMs = ex ? 60000 / 96.4 : BEAT;
    this.score = 0; this.combo = 0; this.maxCombo = 0; this.hp = 50; this.cnt = { p: 0, g: 0, m: 0 }; this.parts = []; this.pops = [];
    this.pulse = 0; this.flash = 0; this.zoom = 0; this.shake = 0; this.banner = 0; this.bannerTxt = ''; this.lastBeat = -1; this.bi = 0; this.ai = 0;
    this.oppPress = [0, 0, 0, 0]; this.jp = { key: null, until: 0 }; this.op = { key: null, until: 0 }; this.mood = { jeff: { key: null, until: 0 }, opp: { key: null, until: 0 } }; this.singer = 'jeff';
    this.phase = 'count'; this.t0 = now; this.cd = -1; this.lastMiss = 0; this.lastAT = 0; this.lastPT = now; this.paused = false; this.res = null;
    const a = this.audio; a.pause(); a.currentTime = 0; a.volume = ex ? 0.8 : 0.9; music(null); a.onended = () => this.phase === 'play' && this.win();
    cv.style.cursor = 'default';
  },
  acc() { const n = this.cnt.p + this.cnt.g + this.cnt.m; return n ? Math.round((this.cnt.p + this.cnt.g * 0.6) / n * 100) : 100; },
  begin() { const a = this.audio; try { a.currentTime = this.startAt / 1000; } catch (e) {} a.play().catch(() => {}); this.lastAT = a.currentTime; this.lastPT = performance.now(); this.phase = 'play'; this.bi = EXTRA_FIRST(this.startAt); },
  ms() {                                                        // relógio da música = audio.currentTime (suavizado entre atualizações)
    const a = this.audio; if (a.currentTime !== this.lastAT) { this.lastAT = a.currentTime; this.lastPT = performance.now(); }
    return this.lastAT * 1000 + (a.paused ? 0 : Math.min(60, performance.now() - this.lastPT));
  },
  cms() { return this.phase === 'play' ? this.ms() : this.startAt - Math.max(0, 4 * this.beatMs - (performance.now() - this.t0)); },
  lane(l) {
    if (this.phase !== 'play' || this.paused) return; const c = this.cfg, ms = this.ms(), now = performance.now(); this.press = this.press || [0, 0, 0, 0]; this.press[l] = 1;
    let best = null, bd = 1e9; for (const n of this.notes) { if (n.t - ms > c.win[0]) break; if (n.side || n.hit || n.miss || n.lane !== l) continue; const d = Math.abs(n.t - ms); if (d <= c.win[0] && d < bd) { best = n; bd = d; } }
    this.jp = { key: 'jeff_' + DIRS[l], until: now + 260 }; this.singer = 'jeff'; if (!this.ex) voice('jeff', l * 2);
    if (!best) { this.hp = Math.max(0, this.hp - c.ghost); if (this.hp <= 0) this.lose(); return; }
    best.hit = true; const perfect = bd <= c.win[1];
    this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); this.score += (perfect ? 350 : 200) + Math.min(this.combo, 50) * 3;
    this.cnt[perfect ? 'p' : 'g']++; this.hp = Math.min(100, this.hp + c.hit[perfect ? 0 : 1]);
    this.popup(perfect ? 'PERFEITO!' : 'BOM', perfect ? '#7dffb0' : '#ffe066'); if (perfect) this.burst(LX[0] + l * GAP + 48, STRUM_Y, COL[l]);
    if (this.combo % 10 === 0) { this.mood.jeff = { key: 'jeff_i2', until: now + 900 }; this.mood.opp = { key: this.ex ? 'liu_f3' : 'liu_f0', until: now + 1300 }; }
  },
  miss() {
    const c = this.cfg, now = performance.now(); this.combo = 0; this.cnt.m++; this.hp = Math.max(0, this.hp - c.missHp); this.popup('ERROU', '#ff5c5c'); this.shake = 6;
    this.jp = { key: 'jeff_down', until: now + 350 }; this.mood.opp = { key: this.ex ? 'liu_f2' : 'liu_f3', until: now + 1000 };
    if (now - this.lastMiss > 900) { this.lastMiss = now; if (this.ex) missSfx(); else sfx(['yow', 'wow_8', 'bad-shamone'][Math.floor(Math.random() * 3)], 0.8); }   // no extra: sem efeitos do MJ
  },
  popup(t, c) { this.pops.push({ t, c, y: 290, life: 1 }); },
  burst(x, y, c) { for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 5; this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c }); } },
  say(t) { this.banner = 1; this.bannerTxt = t; },
  onBeat(b) {
    this.pulse = 1;
    if (this.ex) { if (b % 4 === 0) this.zoom = 1; return; }
    if (b % 4 === 0) { this.zoom = 1; const bar = b / 4;
      if (bar > 0 && bar % 8 === 0) { sfx('michael-jackson-hee-hee', 0.7); this.flash = 0.5; this.say('HEE-HEE!'); }   // "especial" do Ayuwoke a cada 8 compassos
      if (bar === 12 || bar === 28) sfx('wow_8', 0.6);
    }
  },
  update() {
    if (this.paused) return; const now = performance.now(), c = this.cfg;
    if (this.phase === 'lose') { if (now - this.loseAt > 1800) this.showRes(); return; }
    if (this.phase === 'count') {
      const el = now - this.t0, k = Math.floor(el / this.beatMs); if (k !== this.cd && k <= 3) { this.cd = k; bleep(k < 3 ? 330 : 660, 0.15, 'square', 0.15); this.pulse = 1; }
      if (el >= 4 * this.beatMs) this.begin(); return;
    }
    if (this.phase !== 'play') return; const ms = this.ms();
    if (!this.ex) { const b = Math.floor(ms / BEAT); if (b > this.lastBeat && ms > 0) { this.lastBeat = b; this.onBeat(b); } }
    else {
      while (this.bi < EXTRA.beats.length && ms >= EXTRA.beats[this.bi]) { this.bi++; this.onBeat(this.bi); }
      while (this.ai < EXTRA.acc.length && ms >= EXTRA.acc[this.ai]) { this.ai++; this.flash = 0.35; this.shake = 7; this.say('AURA!'); }
    }
    for (const n of this.notes) {
      if (n.t - ms > c.win[0]) break;
      if (n.side === 1 && !n.hit && ms >= n.t) { n.hit = true; this.op = { key: (this.ex ? LIU_POSE : AYU_POSE.map(k => 'ayu_' + k))[n.lane], until: now + 260 }; this.oppPress[n.lane] = 1; this.singer = 'opp'; if (!this.ex) voice('ayu', n.lane * 2); }
      else if (n.side === 0 && !n.hit && !n.miss && ms > n.t + c.win[0]) { n.miss = true; this.miss(); }
    }
    for (let i = 0; i < 4; i++) { this.oppPress[i] *= 0.86; if (this.press) this.press[i] *= 0.86; }
    if (this.hp <= 0) this.lose(); else if (ms > this.endMs) this.win();
  },
  finish() {                                                    // fecha a pontuação (com o multiplicador visual) e salva o recorde
    const c = this.cfg, raw = this.score, final = Math.round(raw * c.mult), best = getBest(), record = final > 0 && (!best || final > best.score);
    if (record) store.set('ayuwoke_best', JSON.stringify({ score: final, mode: c.id }));
    this.res = { raw, mult: c.mult, final, acc: this.acc(), maxCombo: this.maxCombo, record, prev: best ? best.score : 0, p: this.cnt.p, gd: this.cnt.g, m: this.cnt.m };
  },
  win() { if (this.phase === 'win') return; this.phase = 'win'; this.audio.pause(); this.finish(); go(this.ex ? extraOutro : outro); },
  lose() { if (this.phase === 'lose') return; this.phase = 'lose'; this.audio.pause(); this.loseAt = performance.now(); this.finish(); if (this.ex) missSfx(); else sfx('yow'); },
  showRes() { results.show({ kind: 'lose', cfg: this.cfg, res: this.res }); },
  pause() { if (this.phase !== 'play' || this.paused) return; this.paused = true; this.audio.pause(); },
  resume() { if (!this.paused) return; this.paused = false; this.audio.play().catch(() => {}); this.lastAT = this.audio.currentTime; this.lastPT = performance.now(); },
  back() { if (this.paused) this.resume(); else this.pause(); },
  confirm() { if (this.phase === 'lose' && performance.now() - this.loseAt > 600) this.showRes(); else if (this.paused) { this.paused = false; this.audio.pause(); go(menu); } },
  drawLane(side, ms) {
    const x0 = LX[side], al = side ? 0.75 : 1, sp = this.cfg.speed;
    for (let l = 0; l < 4; l++) {
      const x = x0 + l * GAP + 48, pr = side ? this.oppPress[l] > 0.3 : held[l];
      g.globalAlpha = al; const im = IMG[`${DIRS[l]}_${pr ? 'press' : 'receptor'}`]; if (im.width) g.drawImage(im, x - im.width * NS / 2, STRUM_Y - im.height * NS / 2, im.width * NS, im.height * NS); g.globalAlpha = 1;
    }
    for (const n of this.notes) {
      if ((n.t - ms) * sp > H + 60) break; if (n.side !== side || (side === 0 ? n.hit : n.hit && ms > n.t + 50)) continue;
      const y = STRUM_Y + (n.t - ms) * sp; if (y < -80) continue;
      const im = IMG[`${DIRS[n.lane]}_note`]; g.globalAlpha = n.miss ? 0.35 : al; g.drawImage(im, x0 + n.lane * GAP + 48 - im.width * NS / 2, y - im.height * NS / 2, im.width * NS, im.height * NS); g.globalAlpha = 1;
    }
  },
  draw(t) {
    const c = this.cfg, ex = this.ex, ms = this.cms(), now = performance.now(), paused = this.paused;
    if (!paused) { this.pulse *= 0.9; this.zoom *= 0.92; this.flash *= 0.9; this.banner *= 0.97; this.shake *= 0.85; }
    const z = 1 + this.pulse * 0.008 + this.zoom * 0.025, sh = (Math.random() - 0.5) * this.shake;
    camPush(z, W / 2, H / 2, sh, 0); drawBg(ex);
    if (ex) { g.fillStyle = `rgba(255,50,30,${0.05 + this.pulse * 0.12})`; g.fillRect(0, 0, W, H); }
    else { const hue = (ms / BEAT * 12) % 360; g.fillStyle = `hsla(${hue},80%,55%,${0.06 + this.pulse * 0.1})`; g.fillRect(0, 0, W, H); }   // luzes coloridas pulsando no beat
    const pl = this.pulse * 0.6, jm = this.mood.jeff, om = this.mood.opp, singJ = now < this.jp.until, singO = now < this.op.until;
    if (!ex) drawChar('liu', 640, 600, t, { key: now < om.until ? om.key : null, flip: this.singer === 'jeff', pulse: pl });        // Liu assiste do meio
    drawChar('jeff', 300 + (singJ ? (Math.random() - 0.5) * 3 : 0), 665, t, { key: singJ ? this.jp.key : (now < jm.until ? jm.key : null), s: singJ ? 1 : undefined, pulse: singJ ? 0 : pl });
    if (ex) drawChar('liu', 990, 665, t, { key: singO ? this.op.key : (now < om.until ? om.key : null), pulse: singO ? 0 : pl });
    else drawChar('ayu', 990, 665, t, { key: singO ? this.op.key : null, pulse: singO ? 0 : pl });
    camPop(); vignette(ex);
    if (this.flash > 0.02) { g.fillStyle = `rgba(255,255,255,${this.flash})`; g.fillRect(0, 0, W, H); }
    // ---- HUD ----
    this.drawLane(1, ms); this.drawLane(0, ms);
    for (const p of this.parts) { if (!paused) { p.x += p.vx; p.y += p.vy; p.life -= 0.04; } g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 5 * p.life + 1, 0, 6.3); g.fill(); } g.globalAlpha = 1; this.parts = this.parts.filter(p => p.life > 0);
    for (const p of this.pops) { if (!paused) { p.y -= 1.2; p.life -= 0.025; } g.globalAlpha = Math.max(0, p.life); txt(p.t, LX[0] + 200, p.y, 40, p.c); if (this.combo > 3) txt(this.combo + ' combo', LX[0] + 200, p.y + 40, 24, '#fff'); } g.globalAlpha = 1; this.pops = this.pops.filter(p => p.life > 0);
    const bx = 340, bw = 600, by = 648, hp = this.hp / 100;                      // barra de aura: empurra pro lado de quem está ganhando
    g.fillStyle = '#000'; g.fillRect(bx - 5, by - 5, bw + 10, 26); g.fillStyle = '#f2f2f2'; g.fillRect(bx, by, bw, 16); g.fillStyle = ex ? '#ff5a3c' : '#9b6bff'; g.fillRect(bx, by, bw * hp, 16);
    const ix = bx + bw * hp, ic = 1 + this.pulse * 0.14; g.save(); g.translate(ix - 30, by + 8); g.scale(ic, ic); g.drawImage(IMG.ic_jeff, -36, -40, 72, 72); g.restore();
    g.save(); g.translate(ix + 30, by + 8); g.scale(ic, ic); g.drawImage(ex ? IMG.ic_liu : IMG.ic_ayu, -36, -40, 72, 72); g.restore();
    txt(`AURA ${fmt(this.score * c.mult)}   ·   PRECISÃO ${this.acc()}%   ·   COMBO ${this.combo}`, W / 2, 706, 22, '#fff');
    txt(`${c.name}  ·  ×${String(c.mult).replace('.', ',')}`, 16, 706, 20, c.col, 'left', '#000', FD);
    if (this.phase === 'play') { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, W, 6); g.fillStyle = c.col; g.fillRect(0, 0, W * Math.min(1, ms / this.endMs), 6); }
    if (this.banner > 0.1) { g.globalAlpha = this.banner; txt(this.bannerTxt, W / 2, 330, 90 + (1 - this.banner) * 60, '#fff', 'center', '#000', FD); g.globalAlpha = 1; }
    if (this.phase === 'count') { const k = Math.min(3, Math.floor((now - this.t0) / this.beatMs)); txt(['3', '2', '1', 'VAI!'][k], W / 2, 300, 120, '#ffd54a', 'center', '#000', FD); }
    if (this.phase === 'lose') { const k = Math.min(1, (now - this.loseAt) / 500); g.fillStyle = `rgba(0,0,0,${0.75 * k})`; g.fillRect(0, 0, W, H); g.globalAlpha = k;
      txt(ex ? 'LIU VENCEU A BATALHA' : `${AYU.toUpperCase()} VENCEU A BATALHA`, W / 2, 320, 62, '#ff5c5c', 'center', '#000', FD); txt(ex ? 'Aura insuficiente. Treina mais, irmão.' : 'Aura insuficiente... hee-hee!', W / 2, 390, 30, '#fff'); g.globalAlpha = 1; }
    if (paused) { g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(0, 0, W, H); txt('PAUSADO', W / 2, 290, 96, '#fff', 'center', '#000', FD); txt('ESC — continuar', W / 2, 400, 30, '#ffd54a'); txt('ENTER — sair para o menu', W / 2, 450, 26, '#ccc'); }
  }
};
const EXTRA_FIRST = ms => { let i = 0; while (i < EXTRA.beats.length && EXTRA.beats[i] < ms) i++; return i; };

/* ============ 10. RESULTADOS / RECORDE ============ */
const results = {
  d: null, t0: 0, rects: [],
  show(d) {
    this.d = d; const ex = d.cfg.id === 'extra';
    this.again = d.kind === 'lose' ? () => startBattle(d.cfg.id) : (ex ? () => startBattle('extra') : () => go(diffScene));
    this.againLabel = d.kind === 'lose' ? 'TENTAR DE NOVO' : (ex ? 'JOGAR DE NOVO' : 'OUTRA DIFICULDADE'); go(this);
  },
  enter() { this.t0 = performance.now(); if (this.d.kind === 'win') music('calm', 0.45); else music(null); },
  hover(x, y) { cv.style.cursor = this.rects.some(r => inR(r, x, y)) ? 'pointer' : 'default'; },
  click(x, y) { if (inR(this.rects[0], x, y)) this.confirm(); else if (inR(this.rects[1], x, y)) this.back(); },
  confirm() { if (performance.now() - this.t0 > 500) { bleep(880, 0.1, 'square', 0.08); this.again(); } },
  back() { go(menu); },
  draw(t) {
    const d = this.d, r = d.res, c = d.cfg, ex = c.id === 'extra', now = performance.now(), k = Math.min(1, (now - this.t0) / 1400);
    camPush(); drawBg(ex); camPop(); g.fillStyle = 'rgba(6,3,16,.72)'; g.fillRect(0, 0, W, H); vignette(ex);
    const win = d.kind === 'win';
    txt(win ? (ex ? 'VITÓRIA NO MODO EXTRA!' : 'VITÓRIA!') : (ex ? 'LIU VENCEU A BATALHA' : `${AYU.toUpperCase()} VENCEU A BATALHA`), W / 2, 96, win ? 84 : 64, win ? '#ffd54a' : '#ff5c5c', 'center', '#000', FD);
    txt(ex ? 'MODO EXTRA' : `Dificuldade: ${c.name}`, W / 2, 158, 26, c.col, 'center', '#000', FD);
    g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 24; rr(300, 196, 680, 372, 24); g.fillStyle = 'rgba(14,10,28,.94)'; g.fill(); g.restore(); rr(300, 196, 680, 372, 24); g.lineWidth = 4; g.strokeStyle = c.col; g.stroke();
    const row = (l, v, y, col = '#fff') => { txt(l, 340, y, 24, '#bdb6dd', 'left'); txt(v, 940, y, 28, col, 'right', '#000', FD); };
    row('Aura bruta', fmt(r.raw * k), 240); row('Multiplicador da dificuldade', '×' + String(r.mult).replace('.', ','), 284, c.col);
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(340, 314, 600, 2);
    txt('PONTUAÇÃO FINAL', W / 2, 348, 24, '#ffd54a'); txt(fmt(r.final * ease(k)), W / 2, 412, 84, '#fff', 'center', '#000', FD);
    row('Precisão', r.acc + '%', 480); row('Maior combo', String(r.maxCombo), 518);
    if (r.record) { const s = 1 + Math.sin(t / 160) * 0.06; g.save(); g.translate(W / 2, 604); g.scale(s, s); txt('★ NOVO RECORDE! ★', 0, 0, 42, '#ffd54a', 'center', '#000', FD); g.restore(); }
    else txt(`Recorde: ${fmt(Math.max(r.prev, 0))}`, W / 2, 604, 26, '#ffd54a');
    this.rects = [[270, 636, 350, 56], [660, 636, 350, 56]];
    [[this.againLabel, 0, c.col === '#ffc94a' ? '#ffc94a' : '#9b6bff'], ['MENU', 1, '#6c6a85']].forEach(([lb, i, col]) => { const [x, y, w, h] = this.rects[i]; rr(x, y, w, h, 14); g.fillStyle = 'rgba(14,10,26,.9)'; g.fill(); g.lineWidth = 3; g.strokeStyle = col; g.stroke(); txt((i ? 'ESC — ' : 'ENTER — ') + lb, x + w / 2, y + h / 2 + 2, 24, '#fff', 'center', '#000', FD); });
  }
};

/* ============ 11. LOOP PRINCIPAL ============ */
let last = performance.now();
function frame(now) {
  const dt = now - last; last = now; g.clearRect(0, 0, W, H);
  scene.update && scene.update(dt); scene.draw(now); requestAnimationFrame(frame);
}
resetActors();
g.fillStyle = '#000'; g.fillRect(0, 0, W, H); txt('carregando...', W / 2, H / 2, 32);
loadAll().then(() => { go(menu); requestAnimationFrame(frame); });
