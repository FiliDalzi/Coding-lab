/* ============================================================
   NEON RUNNER — CODING LAB
   app.js — Game Logic, Block Engine, Audio, Particles
   ============================================================ */

'use strict';

// ── PWA SERVICE WORKER ──────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  );
}

// ============================================================
// AUDIO ENGINE  (Web Audio API — zero external files)
// ============================================================
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function beep(freq, type = 'sine', dur = 0.08, vol = 0.14, delay = 0) {
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime + delay;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur);
  } catch (_) {}
}

const SFX = {
  drop:    () => { initAudio(); beep(440,'square',0.05,0.12); beep(660,'sine',0.07,0.09,0.04); },
  run:     () => { initAudio(); [220,330,440,550].forEach((f,i)=>beep(f,'sine',0.06,0.12,i*0.04)); },
  score:   () => { initAudio(); [523,659,784,1047].forEach((f,i)=>beep(f,'sine',0.1,0.2,i*0.07)); },
  error:   () => { initAudio(); beep(150,'sawtooth',0.15,0.25); beep(100,'sawtooth',0.1,0.2,0.1); },
  shield:  () => { initAudio(); for(let i=0;i<5;i++) beep(800+i*200,'sine',0.05,0.15,i*0.04); },
  jump:    () => { initAudio(); const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.type='sine'; const t=audioCtx.currentTime; o.frequency.setValueAtTime(300,t); o.frequency.exponentialRampToValueAtTime(900,t+0.12); g.gain.setValueAtTime(0.18,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.14); o.start(t); o.stop(t+0.14); },
  explode: () => { initAudio(); const buf=audioCtx.createBuffer(1,audioCtx.sampleRate*0.2,audioCtx.sampleRate),d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2); const s=audioCtx.createBufferSource(),g=audioCtx.createGain(); g.gain.value=0.28; s.buffer=buf; s.connect(g); g.connect(audioCtx.destination); s.start(); },
  collect: () => { initAudio(); beep(880,'sine',0.08,0.18); beep(1100,'sine',0.06,0.14,0.05); },
  teleport:() => { initAudio(); beep(200,'sawtooth',0.1,0.2); beep(800,'sine',0.1,0.18,0.1); },
  delete:  () => { initAudio(); beep(300,'sine',0.06,0.1); },
  nova:    () => { initAudio(); [200,400,600,800,1000].forEach((f,i)=>beep(f,'sawtooth',0.04,0.12,i*0.025)); },
};

// ============================================================
// PARTICLE SYSTEM (UI canvas overlay)
// ============================================================
const pCanvas = document.getElementById('particles-canvas');
const pCtx = pCanvas.getContext('2d');
let uiParticles = [];

function resizePCanvas() {
  pCanvas.width = window.innerWidth;
  pCanvas.height = window.innerHeight;
}
resizePCanvas();
window.addEventListener('resize', resizePCanvas);

function spawnUI(x, y, color, n = 18) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
    uiParticles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, color, size: 2+Math.random()*3, life: 30+Math.random()*20, maxLife: 50 });
  }
}

(function loopUI() {
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  uiParticles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
    const a = p.life / p.maxLife;
    pCtx.globalAlpha = a; pCtx.shadowBlur = 8; pCtx.shadowColor = p.color;
    pCtx.fillStyle = p.color;
    pCtx.beginPath(); pCtx.arc(p.x, p.y, p.size * a, 0, Math.PI*2); pCtx.fill();
  });
  pCtx.globalAlpha = 1; pCtx.shadowBlur = 0;
  uiParticles = uiParticles.filter(p => p.life > 0);
  requestAnimationFrame(loopUI);
})();

// ============================================================
// TOAST & SCORE POPUP
// ============================================================
let toastY = 64;
function showToast(msg, color = 'var(--neon-cyan)') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.cssText = `top:${toastY}px;border-color:${color};color:${color};box-shadow:0 0 12px ${color}44;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3100);
}

function showScorePopup(x, y, txt, color = '#00f5ff') {
  const el = document.createElement('div');
  el.className = 'score-popup';
  const rect = document.getElementById('game-canvas').getBoundingClientRect();
  el.style.cssText = `left:${rect.left+x}px;top:${rect.top+y-20}px;color:${color};text-shadow:0 0 10px ${color};`;
  el.textContent = txt;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

function setStatus(msg, active = false) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.className = active ? 'active' : '';
}

// ============================================================
// GAME SELECTOR
// ============================================================
let currentGame = 'runner';

const GAME_CONFIGS = {
  runner:  { name: 'NEON RUNNER', sub: 'PLATFORM', color: 'var(--neon-cyan)',   badge: 'CODING LAB' },
  space:   { name: 'SPACE',        sub: 'EXPLORER',  color: 'var(--neon-pink)',   badge: 'CODING LAB' },
  maze:    { name: 'CYBER',        sub: 'MAZE',      color: 'var(--neon-purple)', badge: 'CODING LAB' },
  gravity: { name: 'GRAVITY',      sub: 'FLIP',      color: 'var(--neon-green)',  badge: 'CODING LAB' },
};

function selectGame(mode) {
  currentGame = mode;
  initAudio();
  SFX.run();
  const cfg = GAME_CONFIGS[mode];
  document.getElementById('logo-main').textContent = cfg.name;
  document.getElementById('logo-sub').textContent = cfg.sub;
  document.getElementById('logo-sub').style.color = cfg.color;
  document.getElementById('logo-badge').textContent = cfg.badge;
  document.getElementById('selector-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');

  // Reset
  clearWorkspace();
  wsBlocks = [];
  renderWorkspace();
  renderCode();
  renderBlockPanel(mode);
  initGameEngine(mode);
  updateHUD();
  setStatus('✓ ' + cfg.name + ' caricato! Trascina i blocchi per iniziare.');
  showToast('🚀 ' + cfg.name + ' — Iniziamo!', cfg.color);
}

document.getElementById('btn-home').addEventListener('click', () => {
  stopProgram();
  document.getElementById('selector-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
});

// ============================================================
// BLOCK DEFINITIONS (per-game mode)
// ============================================================
const BLOCKS = {
  runner: [
    { cat: '⚡ Movimento', items: [
      { id:'move_right',   type:'move',    icon:'→', label:'Vai_Avanti()' },
      { id:'move_left',    type:'move',    icon:'←', label:'Vai_Sinistra()' },
      { id:'jump',         type:'move',    icon:'↑', label:'Salto()' },
      { id:'boost_jump',   type:'move',    icon:'🚀', label:'Salto_Potenziato()' },
      { id:'dash',         type:'move',    icon:'⚡', label:"Scatto('avanti')" },
      { id:'orbit',        type:'move',    icon:'🌀', label:'Orbita()' },
    ]},
    { cat: '🧠 Logica', items: [
      { id:'repeat_forever',type:'logic',  icon:'∞', label:'Ripeti_Sempre {' },
      { id:'block_end',    type:'logic',   icon:'}', label:'} fine blocco' },
      { id:'if_obstacle',  type:'logic',   icon:'👁', label:'Se_Vedi_Ostacolo {' },
      { id:'repeat_n',     type:'logic',   icon:'🔁', label:'Ripeti(3) {' },
      { id:'wait_500',     type:'logic',   icon:'⏱', label:'Attendi(500)' },
      { id:'wait_200',     type:'logic',   icon:'⏱', label:'Attendi(200)' },
    ]},
    { cat: '✨ Effetti', items: [
      { id:'change_color', type:'fx',      icon:'🎨', label:"Cambia_Colore('random')" },
      { id:'shield',       type:'fx',      icon:'🛡', label:'Attiva_Scudo()' },
      { id:'explosion',    type:'fx',      icon:'💥', label:'Esplosione_Particelle()' },
      { id:'boost_speed',  type:'fx',      icon:'💨', label:'Boost_Velocità()' },
    ]},
    { cat: '⭐ Speciali', items: [
      { id:'ultra_combo',  type:'special', icon:'⭐', label:'Ultra_Combo()' },
      { id:'teleport',     type:'special', icon:'🌌', label:'Teletrasporto()' },
      { id:'invert_gravity',type:'special',icon:'🔃', label:'Inverti_Gravità()' },
      { id:'super_nova',   type:'special', icon:'💫', label:'Super_Nova()' },
    ]},
  ],
  space: [
    { cat: '🚀 Propulsione', items: [
      { id:'move_right',   type:'move',    icon:'→', label:'Spingi_Destra()' },
      { id:'move_left',    type:'move',    icon:'←', label:'Spingi_Sinistra()' },
      { id:'jump',         type:'move',    icon:'↑', label:'Spingi_Su()' },
      { id:'boost_jump',   type:'move',    icon:'🚀', label:'Iperspazio()' },
      { id:'dash',         type:'move',    icon:'⚡', label:'Turbo_Boost()' },
      { id:'orbit',        type:'move',    icon:'🌀', label:'Orbita_Pianeta()' },
    ]},
    { cat: '🧠 Logica', items: [
      { id:'repeat_forever',type:'logic',  icon:'∞', label:'Ciclo_Infinito {' },
      { id:'block_end',    type:'logic',   icon:'}', label:'} fine ciclo' },
      { id:'if_obstacle',  type:'logic',   icon:'🪨', label:'Se_Vedi_Asteroide {' },
      { id:'repeat_n',     type:'logic',   icon:'🔁', label:'Ripeti(3) {' },
      { id:'wait_500',     type:'logic',   icon:'⏱', label:'Attendi(500ms)' },
      { id:'wait_200',     type:'logic',   icon:'⏱', label:'Attendi(200ms)' },
    ]},
    { cat: '✨ Sistemi', items: [
      { id:'change_color', type:'fx',      icon:'🎨', label:'Cambia_Scia()' },
      { id:'shield',       type:'fx',      icon:'🛡', label:'Scudo_Energetico()' },
      { id:'explosion',    type:'fx',      icon:'💥', label:'Esplosione_Plasma()' },
      { id:'boost_speed',  type:'fx',      icon:'💨', label:'Accelera_Motori()' },
    ]},
    { cat: '⭐ Manovre', items: [
      { id:'ultra_combo',  type:'special', icon:'⭐', label:'Raggio_Stellare()' },
      { id:'teleport',     type:'special', icon:'🌌', label:'Teletrasporto()' },
      { id:'invert_gravity',type:'special',icon:'🔃', label:'Inverti_Gravità()' },
      { id:'super_nova',   type:'special', icon:'💫', label:'Super_Nova()' },
    ]},
  ],
  maze: [
    { cat: '🧭 Navigazione', items: [
      { id:'move_right',   type:'move',    icon:'→', label:'Vai_Destra()' },
      { id:'move_left',    type:'move',    icon:'←', label:'Vai_Sinistra()' },
      { id:'jump',         type:'move',    icon:'↑', label:'Vai_Su()' },
      { id:'boost_jump',   type:'move',    icon:'↓', label:'Vai_Giù()' },
      { id:'dash',         type:'move',    icon:'⚡', label:'Scatta()' },
      { id:'orbit',        type:'move',    icon:'🌀', label:'Ruota()' },
    ]},
    { cat: '🧠 Logica', items: [
      { id:'repeat_forever',type:'logic',  icon:'∞', label:'Loop_Infinito {' },
      { id:'block_end',    type:'logic',   icon:'}', label:'} chiudi' },
      { id:'if_obstacle',  type:'logic',   icon:'🧱', label:'Se_C\'è_Muro {' },
      { id:'repeat_n',     type:'logic',   icon:'🔁', label:'Ripeti(3) {' },
      { id:'wait_500',     type:'logic',   icon:'⏱', label:'Attendi(500)' },
      { id:'wait_200',     type:'logic',   icon:'⏱', label:'Attendi(200)' },
    ]},
    { cat: '✨ Cyber', items: [
      { id:'change_color', type:'fx',      icon:'🎨', label:'Cambia_HUD()' },
      { id:'shield',       type:'fx',      icon:'🛡', label:'Firewall()' },
      { id:'explosion',    type:'fx',      icon:'💥', label:'Hack_Nodo()' },
      { id:'boost_speed',  type:'fx',      icon:'💨', label:'Overclock()' },
    ]},
    { cat: '⭐ Speciali', items: [
      { id:'ultra_combo',  type:'special', icon:'⭐', label:'Ultra_Combo()' },
      { id:'teleport',     type:'special', icon:'🌌', label:'Teletrasporto()' },
      { id:'invert_gravity',type:'special',icon:'🔃', label:'Inverti_Gravità()' },
      { id:'super_nova',   type:'special', icon:'💫', label:'Super_Nova()' },
    ]},
  ],
  gravity: [
    { cat: '🔃 Movimento', items: [
      { id:'move_right',   type:'move',    icon:'→', label:'Corri_Destra()' },
      { id:'move_left',    type:'move',    icon:'←', label:'Corri_Sinistra()' },
      { id:'jump',         type:'move',    icon:'↕', label:'Flip_Gravità()' },
      { id:'boost_jump',   type:'move',    icon:'🚀', label:'Mega_Flip()' },
      { id:'dash',         type:'move',    icon:'⚡', label:'Scatto()' },
      { id:'orbit',        type:'move',    icon:'🌀', label:'Orbita()' },
    ]},
    { cat: '🧠 Logica', items: [
      { id:'repeat_forever',type:'logic',  icon:'∞', label:'Ripeti_Sempre {' },
      { id:'block_end',    type:'logic',   icon:'}', label:'} fine' },
      { id:'if_obstacle',  type:'logic',   icon:'👁', label:'Se_Vedi_Spike {' },
      { id:'repeat_n',     type:'logic',   icon:'🔁', label:'Ripeti(3) {' },
      { id:'wait_500',     type:'logic',   icon:'⏱', label:'Attendi(500)' },
      { id:'wait_200',     type:'logic',   icon:'⏱', label:'Attendi(200)' },
    ]},
    { cat: '✨ Effetti', items: [
      { id:'change_color', type:'fx',      icon:'🎨', label:'Cambia_Colore()' },
      { id:'shield',       type:'fx',      icon:'🛡', label:'Attiva_Scudo()' },
      { id:'explosion',    type:'fx',      icon:'💥', label:'Esplosione()' },
      { id:'boost_speed',  type:'fx',      icon:'💨', label:'Boost_Velocità()' },
    ]},
    { cat: '⭐ Speciali', items: [
      { id:'ultra_combo',  type:'special', icon:'⭐', label:'Ultra_Combo()' },
      { id:'teleport',     type:'special', icon:'🌌', label:'Teletrasporto()' },
      { id:'invert_gravity',type:'special',icon:'🔃', label:'Inverti_Gravità()' },
      { id:'super_nova',   type:'special', icon:'💫', label:'Super_Nova()' },
    ]},
  ],
};

// ── Build block palette ─────────────────────────────────────
function renderBlockPanel(mode) {
  const scroll = document.getElementById('blocks-scroll');
  scroll.innerHTML = '';
  const groups = BLOCKS[mode] || BLOCKS.runner;
  groups.forEach(grp => {
    const catEl = document.createElement('div');
    catEl.innerHTML = `<div class="cat-label">${grp.cat}</div>`;
    grp.items.forEach(b => {
      const el = document.createElement('div');
      el.className = `block-item bi-${b.type}`;
      el.draggable = true;
      el.dataset.id   = b.id;
      el.dataset.type = b.type;
      el.dataset.icon = b.icon;
      el.dataset.label= b.label;
      el.innerHTML = `<span class="block-icon">${b.icon}</span>${b.label}`;
      setupBlockDrag(el);
      catEl.appendChild(el);
    });
    scroll.appendChild(catEl);
  });
}

// ============================================================
// DRAG & DROP
// ============================================================
let dragData = null;
const dragGhost = document.getElementById('drag-ghost');

function setupBlockDrag(el) {
  el.addEventListener('dragstart', e => {
    dragData = { id: el.dataset.id, type: el.dataset.type, icon: el.dataset.icon, label: el.dataset.label };
    e.dataTransfer.effectAllowed = 'copy';
    dragGhost.className = `block-item bi-${el.dataset.type}`;
    dragGhost.innerHTML = `<span class="block-icon">${el.dataset.icon}</span>${el.dataset.label}`;
    dragGhost.style.opacity = '0.9';
    SFX.drop();
  });
  el.addEventListener('dragend', () => { dragGhost.style.opacity = '0'; dragData = null; });
}

document.addEventListener('dragover', e => {
  dragGhost.style.left = (e.clientX + 14) + 'px';
  dragGhost.style.top  = (e.clientY - 10) + 'px';
});

// ============================================================
// WORKSPACE STATE
// ============================================================
let wsBlocks = [];
let repeatCount = 3; // default for Ripeti(n)

function getDropZoneColor(type) {
  return { move:'#00f5ff', logic:'#ff0080', fx:'#39ff14', special:'#bf00ff' }[type] || '#00f5ff';
}

function renderWorkspace() {
  const dz = document.getElementById('drop-zone');
  // Remove all ws-blocks and slot markers, keep .drop-hint
  dz.querySelectorAll('.ws-block, .drop-zone-slot').forEach(el => el.remove());

  wsBlocks.forEach((b, i) => {
    // Slot before each block
    dz.appendChild(makeSlot(i));
    // Block
    const el = document.createElement('div');
    el.className = `ws-block ws-${b.type}`;
    el.dataset.idx = i;
    el.innerHTML = `<span style="flex-shrink:0">${b.icon}</span><span>${b.label}</span><button class="ws-del" title="Rimuovi">✕</button>`;
    el.querySelector('.ws-del').addEventListener('click', e => {
      e.stopPropagation();
      spawnUI(e.clientX, e.clientY, getDropZoneColor(b.type));
      wsBlocks.splice(i, 1);
      SFX.delete();
      renderWorkspace(); renderCode(); updateBlockCount();
    });
    dz.appendChild(el);
  });
  // Final slot
  dz.appendChild(makeSlot(wsBlocks.length));

  if (wsBlocks.length > 0) dz.classList.add('has-blocks');
  else dz.classList.remove('has-blocks');
  updateBlockCount();
}

function makeSlot(index) {
  const s = document.createElement('div');
  s.className = 'drop-zone-slot';
  s.dataset.idx = index;
  s.textContent = '+ inserisci qui';
  s.addEventListener('dragover', e => { e.preventDefault(); s.classList.add('drag-over'); });
  s.addEventListener('dragleave', () => s.classList.remove('drag-over'));
  s.addEventListener('drop', e => {
    e.preventDefault(); s.classList.remove('drag-over');
    if (!dragData) return;
    wsBlocks.splice(parseInt(s.dataset.idx), 0, { ...dragData });
    SFX.drop();
    spawnUI(e.clientX, e.clientY, getDropZoneColor(dragData.type));
    showToast(`✓ ${dragData.label}`, getDropZoneColor(dragData.type));
    setStatus(`Blocco aggiunto: ${dragData.label}`, true);
    renderWorkspace(); renderCode();
  });
  return s;
}

// Main drop zone fallback
const dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('dragover', e => e.preventDefault());
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  if (!dragData || e.target !== dropZone && !e.target.classList.contains('drop-hint')) return;
  wsBlocks.push({ ...dragData });
  SFX.drop();
  spawnUI(e.clientX, e.clientY, getDropZoneColor(dragData.type));
  showToast(`✓ ${dragData.label}`, getDropZoneColor(dragData.type));
  renderWorkspace(); renderCode();
});

function updateBlockCount() {
  const n = wsBlocks.length;
  document.getElementById('block-count').textContent = n + (n === 1 ? ' blocco' : ' blocchi');
}

function clearWorkspace() {
  wsBlocks = [];
  renderWorkspace(); renderCode();
}
document.getElementById('btn-clear').addEventListener('click', () => {
  if (isRunning) stopProgram();
  clearWorkspace();
  SFX.delete();
  setStatus('Workspace pulito.');
});

// ============================================================
// CODE GENERATOR
// ============================================================
function generateCode() {
  if (!wsBlocks.length) {
    return [
      { html:`<span class="code-comment">// Trascina blocchi nel workspace</span>`, type:'comment' },
      { html:`<span class="code-comment">// per generare il codice!</span>`, type:'comment' },
    ];
  }
  const lines = [];
  lines.push({ html:`<span class="code-comment">// 🚀 Programma generato</span>`, type:'meta' });
  lines.push({ html:`<span class="code-kw">async function</span> <span class="code-fn">programma</span>() {`, type:'meta' });

  let indent = 1;
  wsBlocks.forEach(b => {
    const pad = '  '.repeat(indent);
    let html = '';
    const id = b.id;
    if (id === 'block_end') {
      indent = Math.max(1, indent - 1);
      const p2 = '  '.repeat(indent);
      html = `${p2}<span class="code-kw">}</span>`;
    } else if (id === 'repeat_forever') {
      html = `${pad}<span class="code-kw">while</span>(<span class="code-kw">true</span>) {`;
      indent++;
    } else if (id === 'if_obstacle') {
      html = `${pad}<span class="code-kw">if</span>(<span class="code-fn-green">seVediOstacolo</span>()) {`;
      indent++;
    } else if (id === 'repeat_n') {
      html = `${pad}<span class="code-kw">for</span>(<span class="code-kw">let</span> i=<span class="code-num">0</span>; i&lt;<span class="code-num">3</span>; i++) {`;
      indent++;
    } else if (id === 'wait_500') {
      html = `${pad}<span class="code-kw">await</span> <span class="code-fn">attendi</span>(<span class="code-num">500</span>);`;
    } else if (id === 'wait_200') {
      html = `${pad}<span class="code-kw">await</span> <span class="code-fn">attendi</span>(<span class="code-num">200</span>);`;
    } else if (id === 'change_color') {
      html = `${pad}<span class="code-fn">cambiaColore</span>(<span class="code-str">'random'</span>);`;
    } else if (id === 'move_right') {
      html = `${pad}<span class="code-kw">await</span> <span class="code-fn">vaiAvanti</span>();`;
    } else if (id === 'move_left') {
      html = `${pad}<span class="code-kw">await</span> <span class="code-fn">vaiSinistra</span>();`;
    } else if (id === 'jump') {
      html = `${pad}<span class="code-kw">await</span> <span class="code-fn">salto</span>();`;
    } else if (id === 'boost_jump') {
      html = `${pad}<span class="code-kw">await</span> <span class="code-fn">saltoPotenziato</span>(); <span class="code-comment">// +boost</span>`;
    } else if (id === 'dash') {
      html = `${pad}<span class="code-kw">await</span> <span class="code-fn">scatto</span>(<span class="code-str">'avanti'</span>);`;
    } else if (id === 'orbit') {
      html = `${pad}<span class="code-kw">await</span> <span class="code-fn">orbita</span>(); <span class="code-comment">// 360°</span>`;
    } else if (id === 'shield') {
      html = `${pad}<span class="code-fn">attivaSCUDO</span>(); <span class="code-comment">// 3s</span>`;
    } else if (id === 'explosion') {
      html = `${pad}<span class="code-fn">esplosione</span>(); <span class="code-comment">// 💥</span>`;
    } else if (id === 'boost_speed') {
      html = `${pad}<span class="code-fn">boostVelocità</span>(); <span class="code-comment">// speedBoost+</span>`;
    } else if (id === 'ultra_combo') {
      html = `${pad}<span class="code-special">ultraCombo</span>(); <span class="code-comment">// ⭐ clear!</span>`;
    } else if (id === 'teleport') {
      html = `${pad}<span class="code-special">teletrasporto</span>(); <span class="code-comment">// 🌌</span>`;
    } else if (id === 'invert_gravity') {
      html = `${pad}<span class="code-special">invertiGravità</span>(); <span class="code-comment">// 🔃</span>`;
    } else if (id === 'super_nova') {
      html = `${pad}<span class="code-special">superNova</span>(); <span class="code-comment">// 💫 +200</span>`;
    } else {
      html = `${pad}<span class="code-fn">${b.label}</span>`;
    }
    lines.push({ html: html + (html.endsWith('{') || html.endsWith('}') ? '' : ''), blockIdx: lines.length - 2, type: b.type });
  });

  lines.push({ html:`}`, type:'meta' });
  lines.push({ html:``, type:'meta' });
  lines.push({ html:`<span class="code-comment">// ▶ avvio automatico</span>`, type:'meta' });
  lines.push({ html:`<span class="code-fn">programma</span>().<span class="code-fn">then</span>(() => <span class="code-fn">console</span>.<span class="code-fn">log</span>(<span class="code-str">"✅ Done!"</span>));`, type:'meta' });
  return lines;
}

function renderCode() {
  const container = document.getElementById('code-lines');
  container.innerHTML = '';
  generateCode().forEach((l, i) => {
    const div = document.createElement('div');
    div.className = 'code-line';
    div.id = `cl-${i}`;
    div.innerHTML = `<span class="code-ln">${i+1}</span><span>${l.html}</span>`;
    container.appendChild(div);
  });
}

// ============================================================
// EXECUTION ENGINE
// ============================================================
let isRunning = false;
let speedFactor = 2;

document.getElementById('speed-slider').addEventListener('input', function() {
  speedFactor = parseFloat(this.value);
});

function highlightExec(blockIdx) {
  document.querySelectorAll('.ws-block').forEach((el, i) => {
    el.classList.toggle('executing', i === blockIdx);
  });
  // code mirror: +2 offset for header lines
  document.querySelectorAll('#code-lines .code-line').forEach((el, i) => {
    el.classList.toggle('active-line', i === blockIdx + 2);
    if (i === blockIdx + 2) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function clearHighlight() {
  document.querySelectorAll('.ws-block').forEach(el => el.classList.remove('executing'));
  document.querySelectorAll('#code-lines .code-line').forEach(el => el.classList.remove('active-line'));
}

function sleep(ms) { return new Promise(r => setTimeout(r, Math.max(30, ms))); }

async function executeBlock(b, idx) {
  if (!isRunning) return;
  highlightExec(idx);
  setStatus(`▶ ${b.label}`, true);
  const s = speedFactor;

  switch (b.id) {
    case 'move_right':      G.movePlayer(3, 0);       await sleep(220/s); break;
    case 'move_left':       G.movePlayer(-3, 0);      await sleep(220/s); break;
    case 'jump':            G.jumpPlayer(8);           await sleep(280/s); break;
    case 'boost_jump':      G.jumpPlayer(16); G.screenShake(); await sleep(380/s); break;
    case 'dash':            G.scattPlayer();            await sleep(220/s); break;
    case 'orbit':           G.orbitPlayer();            await sleep(600/s); break;
    case 'change_color':    G.changeTrailColor();       await sleep(80/s);  break;
    case 'shield':          G.activateShield();         await sleep(300/s); break;
    case 'explosion':       G.bigExplosion(); G.screenShake(); await sleep(300/s); break;
    case 'boost_speed':     G.boostSpeed();             await sleep(180/s); break;
    case 'ultra_combo':     G.ultraCombo(); G.screenShake(); await sleep(500/s); break;
    case 'teleport':        G.teleport();               await sleep(400/s); break;
    case 'invert_gravity':  G.invertGravity();          await sleep(700/s); break;
    case 'super_nova':      G.superNova(); G.screenShake(); await sleep(600/s); break;
    case 'wait_500':        await sleep(500/s); break;
    case 'wait_200':        await sleep(200/s); break;
    case 'repeat_forever':
    case 'if_obstacle':
    case 'repeat_n':
    case 'block_end':       await sleep(60/s); break;
    default:                await sleep(100/s);
  }
}

async function executeBlocks(blocks) {
  const hasForever = blocks.some(b => b.id === 'repeat_forever');
  const workBlocks = blocks.filter(b => b.id !== 'repeat_forever' && b.id !== 'block_end');

  do {
    for (let i = 0; i < workBlocks.length; i++) {
      if (!isRunning) return;
      // Obstacle avoidance for Se_Vedi_Ostacolo
      if (workBlocks[i].id === 'if_obstacle') {
        highlightExec(i);
        await sleep(80/speedFactor);
        if (G.seVediOstacolo()) G.jumpPlayer(10);
        continue;
      }
      await executeBlock(workBlocks[i], i);
    }
  } while (hasForever && isRunning);
}

async function runProgram() {
  if (isRunning) return;
  if (!wsBlocks.length) { showToast('⚠ Aggiungi blocchi!', 'var(--neon-orange)'); return; }
  initAudio(); SFX.run();
  isRunning = true;
  G.gameRunning = true;

  document.getElementById('btn-run').classList.add('running');
  document.getElementById('btn-run').textContent = '⚡ RUNNING';
  document.getElementById('running-badge').style.display = 'inline-flex';
  setStatus('▶ Programma in esecuzione...', true);
  showToast('▶ Programma avviato!', 'var(--neon-green)');

  await executeBlocks([...wsBlocks]);
  if (isRunning) stopProgram();
}

function stopProgram() {
  isRunning = false;
  G.gameRunning = false;
  document.getElementById('btn-run').classList.remove('running');
  document.getElementById('btn-run').textContent = '▶ ESEGUI';
  document.getElementById('running-badge').style.display = 'none';
  clearHighlight();
  setStatus('■ Programma terminato.');
}

document.getElementById('btn-run').addEventListener('click', runProgram);
document.getElementById('btn-stop').addEventListener('click', () => { stopProgram(); SFX.error(); });

// ============================================================
// GAME ENGINE
// ============================================================
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');
let W = 0, H = 0;

// Game state namespace
const G = {
  // player
  player: { x:80, y:0, vy:0, vx:0, w:18, h:18, grounded:false, shield:false, shieldTimer:0, color:'#00f5ff', gravInvert:false, orbiting:false, orbitAngle:0, orbitCenter:null },
  // world
  obstacles: [], collectibles: [], bgStars: [], gameParticles: [], trail: [],
  trailColor: '#00f5ff',
  trailColors: ['#00f5ff','#ff0080','#39ff14','#bf00ff','#ff6600','#ffff00'],
  trailIdx: 0,
  speedBoost: 1,
  groundY: 0,
  scrollX: 0,
  frameCount: 0,
  shakeTimer: 0, shakeX: 0, shakeY: 0,
  gameRunning: false,
  gameMode: 'runner',

  // Actions (called by execution engine)
  movePlayer(vx, vy = 0) { this.player.vx += vx; if(vy) this.player.vy += vy; },
  jumpPlayer(force) {
    if (this.player.grounded || Math.abs(this.player.y - this.groundY + this.player.h) < 4) {
      this.player.vy = this.player.gravInvert ? force : -force;
      SFX.jump();
    }
  },
  scattPlayer() { this.player.vx += 12; this.spawnGameParticles(this.player.x, this.player.y+this.player.h/2, this.trailColor, 10); SFX.jump(); },
  orbitPlayer() {
    this.player.orbiting = true;
    this.player.orbitCenter = { x: this.player.x + 60, y: this.groundY - 50 };
    this.player.orbitAngle = 0;
    setTimeout(() => { this.player.orbiting = false; }, 600 / speedFactor);
  },
  changeTrailColor() {
    this.trailIdx = (this.trailIdx + 1) % this.trailColors.length;
    this.trailColor = this.trailColors[this.trailIdx];
    this.player.color = this.trailColor;
    this.spawnGameParticles(this.player.x+this.player.w/2, this.player.y+this.player.h/2, this.trailColor, 12);
    SFX.collect();
  },
  activateShield() {
    this.player.shield = true; this.player.shieldTimer = 180;
    this.spawnGameParticles(this.player.x+this.player.w/2, this.player.y+this.player.h/2, '#00f5ff', 20);
    SFX.shield(); showToast('🛡 Scudo attivato!', '#00f5ff');
  },
  bigExplosion() {
    this.spawnGameParticles(this.player.x+this.player.w/2, this.player.y+this.player.h/2, this.trailColor, 40);
    this.spawnGameParticles(this.player.x+this.player.w/2, this.player.y+this.player.h/2, '#fff', 20);
    this.addScore(50); showScorePopup(this.player.x, this.player.y, '+50', '#ff6600');
    SFX.explode();
  },
  boostSpeed() {
    this.speedBoost = Math.min(3.5, this.speedBoost + 0.9);
    this.spawnGameParticles(this.player.x-5, this.player.y+this.player.h/2, '#ffff00', 10);
    SFX.drop(); showToast('💨 Speed Boost!', '#ffff00');
  },
  ultraCombo() {
    this.obstacles.forEach(o => { if(o.x < W+100) this.spawnGameParticles(o.x, o.y, o.color, 12); });
    this.obstacles = this.obstacles.filter(o => o.x < 0 || o.x > W + 100);
    this.addScore(300); showScorePopup(this.player.x, this.player.y, '⭐ +300 ULTRA!', '#ffff00');
    SFX.score(); showToast('⭐ ULTRA COMBO!', '#ffff00');
  },
  teleport() {
    this.spawnGameParticles(this.player.x+this.player.w/2, this.player.y+this.player.h/2, this.trailColor, 20);
    this.player.x = 40 + Math.random() * (W - 120);
    this.player.y = this.groundY - this.player.h - 10;
    this.spawnGameParticles(this.player.x+this.player.w/2, this.player.y+this.player.h/2, '#bf00ff', 20);
    SFX.teleport(); showToast('🌌 Teletrasportato!', '#bf00ff');
  },
  invertGravity() {
    this.player.gravInvert = !this.player.gravInvert;
    this.player.vy = this.player.gravInvert ? -10 : 10;
    this.spawnGameParticles(this.player.x+this.player.w/2, this.player.y+this.player.h/2, '#bf00ff', 25);
    SFX.nova(); showToast(this.player.gravInvert ? '🔃 Gravità invertita!' : '🔃 Gravità normale!', '#bf00ff');
  },
  superNova() {
    for (let i=0;i<8;i++) {
      const angle = (Math.PI*2/8)*i;
      const cx = this.player.x+this.player.w/2, cy = this.player.y+this.player.h/2;
      for (let j=1;j<=5;j++) {
        this.gameParticles.push({ x:cx, y:cy, vx:Math.cos(angle)*j*2.5, vy:Math.sin(angle)*j*2.5, color:this.trailColors[j%this.trailColors.length], size:4, life:35, maxLife:35 });
      }
    }
    this.addScore(200); showScorePopup(this.player.x, this.player.y, '💫 +200 NOVA', '#ff0080');
    SFX.nova(); showToast('💫 SUPER NOVA!', '#ff0080');
  },
  screenShake() {
    this.shakeTimer = 12;
    const gc = document.getElementById('game-panel');
    gc.classList.remove('screen-shake');
    void gc.offsetWidth;
    gc.classList.add('screen-shake');
    setTimeout(() => gc.classList.remove('screen-shake'), 450);
  },
  seVediOstacolo() {
    const p = this.player;
    return this.obstacles.some(o => o.x - p.x > 0 && o.x - p.x < 100 && !o.isHelpPlatform);
  },
  addScore(n) {
    gameScore += n; updateHUD();
    if (gameScore > 0 && gameScore % 500 === 0) {
      gameLevel++; updateHUD();
      showToast(`🎉 Livello ${gameLevel}!`, 'var(--neon-green)'); SFX.score();
    }
  },
  spawnGameParticles(x, y, color, n) {
    for (let i=0;i<n;i++) {
      const a = Math.random()*Math.PI*2, sp = 1+Math.random()*5;
      this.gameParticles.push({ x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-1.5, color, size:2+Math.random()*3.5, life:20+Math.random()*20, maxLife:40 });
    }
  },
};

// HUD
let gameScore = 0, gameLives = 3, gameLevel = 1, gameTime = 60;
let timerInterval = null;

function updateHUD() {
  document.getElementById('hud-score').textContent = gameScore;
  document.getElementById('hud-level').textContent = 'LV ' + gameLevel;
  const hearts = ['💀','❤','❤❤','❤❤❤'];
  document.getElementById('hud-lives').textContent = hearts[Math.max(0, gameLives)];
}

function startTimer() {
  clearInterval(timerInterval);
  gameTime = 60;
  document.getElementById('hud-time').textContent = gameTime;
  document.getElementById('hud-time').classList.remove('timer-warn');
  timerInterval = setInterval(() => {
    gameTime--;
    const el = document.getElementById('hud-time');
    el.textContent = gameTime;
    if (gameTime <= 10) el.classList.add('timer-warn');
    if (gameTime <= 0) { clearInterval(timerInterval); showToast('⏰ Tempo scaduto!', 'var(--neon-pink)'); }
  }, 1000);
}

// GAME ENGINE INIT
const COLORS = ['#00f5ff','#ff0080','#39ff14','#ff6600','#bf00ff','#ffff00'];

function initGameEngine(mode) {
  G.gameMode = mode;
  resizeCanvas();
  G.groundY = H - 50;
  G.player.x = 80; G.player.y = G.groundY - G.player.h;
  G.player.vy = 0; G.player.vx = 0;
  G.player.gravInvert = false; G.player.shield = false;
  G.player.color = '#00f5ff'; G.trailColor = '#00f5ff'; G.trailIdx = 0;
  G.obstacles = []; G.collectibles = []; G.gameParticles = []; G.trail = [];
  G.speedBoost = 1; G.scrollX = 0; G.shakeTimer = 0;

  // BG stars
  G.bgStars = [];
  for (let i=0;i<80;i++) G.bgStars.push({ x:Math.random()*W, y:Math.random()*H*0.85, r:Math.random()*1.6+0.3, speed:Math.random()*0.5+0.1, b:Math.random() });

  // Initial obstacles/collectibles
  for (let i=0;i<3;i++) spawnObstacle(W + i*280);
  for (let i=0;i<4;i++) spawnCollectible();

  gameScore = 0; gameLives = 3; gameLevel = 1;
  updateHUD();
  startTimer();
}

function resizeCanvas() {
  const panel = document.getElementById('game-panel');
  canvas.width  = panel.clientWidth;
  canvas.height = panel.clientHeight - 28 - 28; // minus title+statusbar
  W = canvas.width; H = canvas.height;
  if (G.groundY) G.groundY = H - 50;
}
window.addEventListener('resize', resizeCanvas);

function spawnObstacle(x) {
  const types = ['wall','spike'];
  const t = types[Math.floor(Math.random()*types.length)];
  const h = t==='spike'?20 : 20+Math.random()*55;
  G.obstacles.push({ x: x || W+50, y:G.groundY-h, w:18, h, color:'#ff3366', type:t });
  // occasionally a help platform
  if (Math.random() < 0.3) {
    G.obstacles.push({ x: (x||W)+80+Math.random()*100, y:G.groundY-80-Math.random()*60, w:60, h:10, color:'#00f5ff', type:'platform', isHelpPlatform:true });
  }
}
function spawnCollectible() {
  G.collectibles.push({ x:200+Math.random()*(W-260), y:G.groundY-60-Math.random()*100, r:8, collected:false, pulse:Math.random()*Math.PI*2, color:COLORS[Math.floor(Math.random()*COLORS.length)] });
}

function rectsOverlap(a, b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

// PHYSICS UPDATE
function updateGame() {
  const p = G.player;
  // Shake
  if (G.shakeTimer > 0) { G.shakeX=(Math.random()-0.5)*8*G.shakeTimer/10; G.shakeY=(Math.random()-0.5)*8*G.shakeTimer/10; G.shakeTimer--; }
  else { G.shakeX=0; G.shakeY=0; }

  // Gravity
  const grav = p.gravInvert ? -0.55 : 0.55;
  p.vy += grav;
  p.y += p.vy; p.x += p.vx;
  p.vx *= 0.84;

  // Ground & ceiling
  if (!p.gravInvert) {
    if (p.y >= G.groundY - p.h) { p.y = G.groundY - p.h; p.vy = 0; p.grounded = true; }
    else p.grounded = false;
  } else {
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
    else p.grounded = false;
  }

  // Platform landings
  G.obstacles.forEach(o => {
    if (o.isHelpPlatform && rectsOverlap(p, o) && p.vy > 0) {
      p.y = o.y - p.h; p.vy = 0; p.grounded = true;
    }
  });

  // Orbit
  if (p.orbiting && p.orbitCenter) {
    p.orbitAngle += 0.1;
    p.x = p.orbitCenter.x + Math.cos(p.orbitAngle)*50;
    p.y = p.orbitCenter.y + Math.sin(p.orbitAngle)*30;
  }

  p.x = Math.max(10, Math.min(W - p.w - 10, p.x));

  // Trail
  G.trail.unshift({ x:p.x+p.w/2, y:p.y+p.h/2, color:G.trailColor, life:18 });
  if (G.trail.length > 22) G.trail.pop();
  G.trail.forEach(t => t.life--);
  G.trail = G.trail.filter(t => t.life > 0);

  // World scroll
  const scroll = 1.8 * G.speedBoost;
  G.obstacles.forEach(o => o.x -= scroll);
  G.collectibles.forEach(c => { c.x -= scroll*0.7; c.pulse += 0.08; });
  G.obstacles = G.obstacles.filter(o => o.x > -80);
  G.collectibles = G.collectibles.filter(c => !c.collected && c.x > -30);
  if (G.obstacles.filter(o=>!o.isHelpPlatform).length < 3) spawnObstacle();
  if (G.collectibles.length < 3) spawnCollectible();
  G.speedBoost = Math.max(1, G.speedBoost * 0.997);

  // Obstacle collisions
  G.obstacles.forEach(o => {
    if (!o.isHelpPlatform && rectsOverlap(p, o)) {
      if (p.shield) {
        o.x = -999;
        G.spawnGameParticles(p.x+p.w/2, p.y+p.h/2, '#00f5ff', 18);
        SFX.collect(); G.addScore(50);
      } else {
        hitPlayer();
      }
    }
  });

  // Collectible collisions
  G.collectibles.forEach(c => {
    if (c.collected) return;
    const dx = p.x+p.w/2-c.x, dy = p.y+p.h/2-c.y;
    if (Math.sqrt(dx*dx+dy*dy) < c.r+12) {
      c.collected = true;
      G.spawnGameParticles(c.x, c.y, c.color, 14);
      SFX.collect(); G.addScore(100);
      showScorePopup(c.x, c.y, '+100', c.color);
    }
  });

  // Particles
  G.gameParticles.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.vx*=0.96; p.life--; });
  G.gameParticles = G.gameParticles.filter(p => p.life > 0);

  // Shield timer
  if (p.shield) { p.shieldTimer--; if (p.shieldTimer<=0) p.shield=false; }
}

function hitPlayer() {
  gameLives = Math.max(0, gameLives - 1);
  updateHUD(); G.screenShake();
  G.spawnGameParticles(G.player.x+G.player.w/2, G.player.y+G.player.h/2, '#ff3366', 28);
  SFX.error(); showToast('💥 Colpito!', 'var(--neon-pink)');
  setStatus('⚠ Ostacolo colpito!', false);
  G.player.vx = -8; G.player.vy = -5;
  if (gameLives <= 0) { showToast('💀 GAME OVER!', 'var(--neon-pink)'); setStatus('GAME OVER! Premi ESEGUI per ricominciare.'); stopProgram(); }
}

// DRAW HELPERS
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

function drawBg() {
  ctx.fillStyle = '#020408'; ctx.fillRect(0,0,W,H);

  // bg stars
  G.bgStars.forEach(s => {
    s.x -= s.speed;
    if (s.x < 0) { s.x=W; s.y=Math.random()*H*0.8; }
    s.b = 0.4 + Math.sin(Date.now()*0.002+s.x)*0.3;
    ctx.save(); ctx.globalAlpha=s.b;
    ctx.fillStyle='#fff'; ctx.shadowColor='#fff'; ctx.shadowBlur=3;
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // grid
  if (G.gameRunning) {
    ctx.save(); ctx.globalAlpha=0.035; ctx.strokeStyle='#00f5ff'; ctx.lineWidth=1;
    const off = G.scrollX % 44;
    for (let x=-off;x<W;x+=44) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    ctx.restore();
  }

  // Speed lines when running
  if (G.gameRunning && G.speedBoost > 1.2) {
    ctx.save(); ctx.globalAlpha=0.05*(G.speedBoost-1); ctx.strokeStyle='#00f5ff'; ctx.lineWidth=1.5;
    for (let i=0;i<8;i++) {
      const y = (Date.now()*0.4+i*70)%H;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawGround() {
  const g = G.groundY;
  ctx.save();
  const grd = ctx.createLinearGradient(0,g,0,H);
  grd.addColorStop(0,'rgba(0,245,255,0.25)'); grd.addColorStop(1,'rgba(0,245,255,0.02)');
  ctx.fillStyle=grd; ctx.fillRect(0,g,W,H-g);
  ctx.strokeStyle='#00f5ff'; ctx.lineWidth=2; ctx.shadowColor='#00f5ff'; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.moveTo(0,g); ctx.lineTo(W,g); ctx.stroke();
  // Grid on ground
  ctx.lineWidth=0.5; ctx.globalAlpha=0.15; ctx.shadowBlur=0;
  const off=G.scrollX%44;
  for(let x=-off;x<W;x+=44){ ctx.beginPath(); ctx.moveTo(x,g); ctx.lineTo(x,H); ctx.stroke(); }
  ctx.restore();
}

function drawObstacles() {
  G.obstacles.forEach(o => {
    if (o.x > W+80 || o.x < -80) return;
    ctx.save();
    if (o.isHelpPlatform) {
      ctx.fillStyle='rgba(0,245,255,0.25)'; ctx.strokeStyle='#00f5ff'; ctx.lineWidth=2;
      ctx.shadowColor='#00f5ff'; ctx.shadowBlur=8;
      roundRect(o.x, o.y, o.w, o.h, 3); ctx.fill(); ctx.stroke();
    } else if (o.type==='wall') {
      const gr=ctx.createLinearGradient(o.x,o.y,o.x+o.w,o.y+o.h);
      gr.addColorStop(0,'#ff0080'); gr.addColorStop(1,'#bf00ff');
      ctx.fillStyle=gr; ctx.shadowColor='#ff0080'; ctx.shadowBlur=12;
      ctx.fillRect(o.x,o.y,o.w,o.h);
      ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
      for(let i=0;i<o.h;i+=10){ ctx.beginPath(); ctx.moveTo(o.x,o.y+i); ctx.lineTo(o.x+o.w,o.y+i); ctx.stroke(); }
    } else if (o.type==='spike') {
      ctx.fillStyle='#ff6600'; ctx.shadowColor='#ff6600'; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.moveTo(o.x,o.y+o.h); ctx.lineTo(o.x+o.w/2,o.y); ctx.lineTo(o.x+o.w,o.y+o.h); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  });
}

function drawCollectibles() {
  G.collectibles.forEach(c => {
    if (c.collected || c.x > W+60 || c.x < -30) return;
    const sc = 1+Math.sin(c.pulse)*0.15;
    ctx.save(); ctx.globalAlpha=0.85+Math.sin(c.pulse*1.3)*0.15;
    ctx.shadowColor=c.color; ctx.shadowBlur=15;
    ctx.font=`${Math.round(c.r*2*sc)}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('⭐', c.x, c.y);
    ctx.restore();
  });
}

function drawPlayer() {
  const p = G.player;
  // Trail
  G.trail.forEach((t,i) => {
    const al=((i+1)/G.trail.length)*0.55, sz=p.w*0.45*(i/G.trail.length)+2;
    ctx.save(); ctx.globalAlpha=al; ctx.shadowColor=G.trailColor; ctx.shadowBlur=8;
    ctx.fillStyle=G.trailColor;
    ctx.fillRect(t.x-sz/2, t.y-sz/2, sz, sz);
    ctx.restore();
  });
  // Shield
  if (p.shield) {
    ctx.save(); ctx.strokeStyle='#00f5ff'; ctx.lineWidth=2.5;
    ctx.shadowColor='#00f5ff'; ctx.shadowBlur=18;
    ctx.globalAlpha=0.65+Math.sin(Date.now()*0.012)*0.25;
    ctx.beginPath(); ctx.arc(p.x+p.w/2, p.y+p.h/2, p.w+4, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  // Body
  ctx.save();
  ctx.shadowColor=p.color; ctx.shadowBlur=14;
  const gr=ctx.createLinearGradient(p.x,p.y,p.x+p.w,p.y+p.h);
  gr.addColorStop(0,p.color); gr.addColorStop(1,'#bf00ff');
  ctx.fillStyle=gr; roundRect(p.x,p.y,p.w,p.h,4); ctx.fill();
  ctx.globalAlpha=0.28; ctx.fillStyle='#fff';
  roundRect(p.x+3,p.y+2,p.w-6,p.h*0.38,2); ctx.fill();
  ctx.restore();
  // Eyes
  ctx.save(); ctx.fillStyle='#fff'; ctx.shadowColor='#fff'; ctx.shadowBlur=5;
  ctx.fillRect(p.x+4,p.y+4,3,3); ctx.fillRect(p.x+11,p.y+4,3,3);
  ctx.fillStyle='#000'; ctx.fillRect(p.x+5,p.y+5,1.5,1.5); ctx.fillRect(p.x+12,p.y+5,1.5,1.5);
  ctx.restore();
}

function drawParticles() {
  G.gameParticles.forEach(p => {
    const al=p.life/p.maxLife;
    ctx.save(); ctx.globalAlpha=al; ctx.shadowColor=p.color; ctx.shadowBlur=7;
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size*al,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

function drawOverlay() {
  if (!G.gameRunning) {
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    ctx.font=`bold 16px 'Orbitron',monospace`;
    ctx.fillStyle='#00f5ff'; ctx.shadowColor='#00f5ff'; ctx.shadowBlur=20;
    ctx.fillText('▶ PREMI ESEGUI', W/2, H/2-10);
    ctx.font=`11px 'Rajdhani',sans-serif`;
    ctx.fillStyle='rgba(0,245,255,0.45)'; ctx.shadowBlur=0;
    ctx.fillText('Costruisci il programma e avvialo', W/2, H/2+14);
    ctx.restore();
  }
}

// MAIN GAME LOOP
function gameLoop() {
  ctx.save();
  ctx.translate(G.shakeX, G.shakeY);
  if (G.gameRunning) updateGame();
  drawBg(); drawGround(); drawObstacles(); drawCollectibles(); drawPlayer(); drawParticles(); drawOverlay();
  ctx.restore();
  requestAnimationFrame(gameLoop);
}

// ============================================================
// BOOT
// ============================================================
window.addEventListener('load', () => {
  // Start selector screen
  document.getElementById('selector-screen').classList.remove('hidden');
  // Pre-render bg
  resizeCanvas();
  gameLoop();
});