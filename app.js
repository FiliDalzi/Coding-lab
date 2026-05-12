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

  // MAZE mode: remap movement to grid directions
  if (G.gameMode === 'maze') {
    switch(b.id) {
      case 'move_right':    mazeMoveDir('E'); await sleep(300/s); return;
      case 'move_left':     mazeMoveDir('W'); await sleep(300/s); return;
      case 'jump':          mazeMoveDir('N'); await sleep(300/s); return;
      case 'boost_jump':    mazeMoveDir('S'); await sleep(300/s); return;
      case 'dash':          mazeMoveDir('E'); mazeMoveDir('E'); await sleep(400/s); return;
      case 'orbit':         ['E','N','W','S'].forEach(d=>mazeMoveDir(d)); await sleep(600/s); return;
      case 'if_obstacle': {
        highlightExec(idx); await sleep(80/s);
        const cell=mazeGrid[mazePlayerCell.r]?.[mazePlayerCell.c];
        if(cell&&!cell.walls['E']) G.addScore(10);
        return;
      }
      case 'ultra_combo':   G.ultraCombo(); G.screenShake(); await sleep(500/s); return;
      case 'teleport':      mazePlayerCell={c:0,r:0}; SFX.teleport(); showToast('🌌 Reset!','#bf00ff'); await sleep(400/s); return;
      case 'super_nova':    G.superNova(); G.screenShake(); await sleep(600/s); return;
    }
  }

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
  G.player.vy = 0; G.player.vx = 0; G.player.visualX = 0; G.player.visualY = 0;
  G.player.gravInvert = false; G.player.shield = false;
  G.obstacles = []; G.collectibles = []; G.gameParticles = []; G.trail = [];
  G.speedBoost = 1; G.scrollX = 0; G.shakeTimer = 0;

  if (mode === 'runner') {
    G.player.color = '#00f5ff'; G.trailColor = '#00f5ff'; G.trailIdx = 0;
    // BG: stars + city buildings
    G.bgStars = [];
    for (let i=0;i<50;i++) G.bgStars.push({ x:Math.random()*W, y:Math.random()*H*0.7, r:Math.random()*1.4+0.3, speed:Math.random()*0.4+0.1 });
    for (let i=0;i<20;i++) G.bgStars.push({ isBldg:true, x:Math.random()*W*1.5, bh:30+Math.random()*80, bw:15+Math.random()*35 });
    for (let i=0;i<3;i++) spawnObstacle(W + i*280);
    for (let i=0;i<4;i++) spawnCollectible();

  } else if (mode === 'space') {
    G.player.color = '#ff0080'; G.trailColor = '#ff6600'; G.trailIdx = 0;
    G.groundY = H - 10; // no real ground in space
    G.player.y = H/2 - G.player.h/2;
    G.bgStars = [];
    // parallax star layers
    for (let i=0;i<100;i++) G.bgStars.push({
      x:Math.random()*W, y:Math.random()*H,
      r:Math.random()*1.8+0.2,
      speed:Math.random()*0.8+0.2,
      starColor:['#ffffff','#aad4ff','#ffccaa','#ffffcc'][Math.floor(Math.random()*4)]
    });
    // nebula patches
    const nebColors=['#ff0080','#bf00ff','#00f5ff'];
    for(let i=0;i<6;i++) G.bgStars.push({
      isNebula:true, x:Math.random()*W, y:Math.random()*H,
      nr:80+Math.random()*120, nc:nebColors[i%3]
    });
    // Asteroid obstacles (custom shape)
    for (let i=0;i<3;i++) spawnObstacle(W + i*300);
    for (let i=0;i<4;i++) spawnCollectible();

  } else if (mode === 'maze') {
    G.player.color = '#bf00ff'; G.trailColor = '#bf00ff'; G.trailIdx = 0;
    G.bgStars = [];
    const chars='01アイウエオ+-=/\\|><!%';
    for(let i=0;i<60;i++) G.bgStars.push({
      x:Math.random()*W, y:Math.random()*H,
      r:0.6+Math.random()*0.4,
      rainSpeed:0.3+Math.random()*1.5,
      green:Math.random()>0.5,
      char:chars[Math.floor(Math.random()*chars.length)]
    });
    mazeGrid = buildMaze(MAZE_COLS, MAZE_ROWS);
    mazePlayerCell = {c:0, r:0};
    // Data node collectibles on maze cells
    G.collectibles = [];
    const positions=[{c:3,r:2},{c:6,r:5},{c:9,r:1},{c:5,r:6}];
    positions.forEach((pos,i)=>{
      G.collectibles.push({cx:pos.c, cy:pos.r, collected:false, color:COLORS[i], pulse:0});
    });

  } else if (mode === 'gravity') {
    G.player.color = '#39ff14'; G.trailColor = '#39ff14'; G.trailIdx = 0;
    G.bgStars = [];
    const chars2='01#@$%&*!?';
    for(let i=0;i<80;i++) G.bgStars.push({
      x:Math.random()*W, y:Math.random()*H,
      r:0.5+Math.random()*0.5,
      rainSpeed:0.4+Math.random()*2,
      green:Math.random()>0.3,
      char:chars2[Math.floor(Math.random()*chars2.length)]
    });
    for (let i=0;i<3;i++) spawnObstacle(W + i*260);
    for (let i=0;i<4;i++) spawnCollectible();
  }

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
  const mode = G.gameMode;
  if (mode === 'space') {
    const h = 22+Math.random()*30;
    const rockBumps = Array.from({length:8}, ()=>Math.random());
    G.obstacles.push({ x: x||W+50, y:Math.random()*(H-80)+20, w:h, h, color:'#ff6600', type:'asteroid', spinSpeed:Math.random()*1.5+0.3, rockBumps });
    if (Math.random()<0.25) {
      G.obstacles.push({ x:(x||W)+120+Math.random()*80, y:Math.random()*(H-40)+10, w:50, h:12, color:'#39ff14', type:'platform', isHelpPlatform:true });
    }
  } else {
    const types = ['wall','spike'];
    const t = types[Math.floor(Math.random()*types.length)];
    const h = t==='spike'?20 : 20+Math.random()*55;
    G.obstacles.push({ x: x || W+50, y:G.groundY-h, w:18, h, color:'#ff3366', type:t });
    if (Math.random() < 0.3) {
      G.obstacles.push({ x: (x||W)+80+Math.random()*100, y:G.groundY-80-Math.random()*60, w:60, h:10, color:'#00f5ff', type:'platform', isHelpPlatform:true });
    }
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

  // Maze: no physics, purely grid-based
  if (G.gameMode === 'maze') {
    G.gameParticles.forEach(gp => { gp.x+=gp.vx; gp.y+=gp.vy; gp.vy+=0.1; gp.life--; });
    G.gameParticles = G.gameParticles.filter(gp => gp.life > 0);
    G.collectibles.forEach(c => { if(!c.collected) c.pulse+=0.06; });
    G.scrollX += 0.5;
    return;
  }

  // Space: gravity-free (low drag only)
  if (G.gameMode === 'space') {
    p.vy *= 0.97; p.vx *= 0.96;
    p.y += p.vy; p.x += p.vx;
    p.y = Math.max(5, Math.min(H - p.h - 5, p.y));
    p.x = Math.max(10, Math.min(W - p.w - 10, p.x));
    p.grounded = false;
  } else {
    // Normal gravity
    const grav = p.gravInvert ? -0.55 : 0.55;
    p.vy += grav;
    p.y += p.vy; p.x += p.vx;
    p.vx *= 0.84;

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
  }

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
  G.scrollX += scroll;

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
  G.gameParticles.forEach(gp => { gp.x+=gp.vx; gp.y+=gp.vy; gp.vy+=0.15; gp.vx*=0.96; gp.life--; });
  G.gameParticles = G.gameParticles.filter(gp => gp.life > 0);

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

// ============================================================
// DRAW HELPERS (shared)
// ============================================================
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
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

function drawOverlay(accentColor) {
  if (!G.gameRunning) {
    const ac = accentColor || '#00f5ff';
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.58)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    ctx.font=`bold 16px 'Orbitron',monospace`;
    ctx.fillStyle=ac; ctx.shadowColor=ac; ctx.shadowBlur=22;
    ctx.fillText('▶ PREMI ESEGUI', W/2, H/2-10);
    ctx.font=`11px 'Rajdhani',sans-serif`;
    ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.shadowBlur=0;
    ctx.fillText('Costruisci il programma e avvialo', W/2, H/2+14);
    ctx.restore();
  }
}

// ============================================================
// ① NEON RUNNER — neon city platform runner
// ============================================================
function drawRunner() {
  const t = Date.now();
  // Sky gradient — deep blue-black with neon city glow at horizon
  const sky = ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#020408');
  sky.addColorStop(0.6,'#040d18');
  sky.addColorStop(1,'#0a0428');
  ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

  // City silhouette in background
  ctx.save(); ctx.globalAlpha=0.18;
  const cityColors=['#00f5ff','#ff0080','#bf00ff'];
  G.bgStars.forEach((s,i) => {
    if (s.isBldg) {
      s.x -= 0.35;
      if (s.x < -s.bw) { s.x=W+s.bw; }
      const cc = cityColors[i%3];
      ctx.fillStyle=cc;
      ctx.fillRect(s.x, H-s.bh-50, s.bw, s.bh);
      // window grid
      ctx.fillStyle='rgba(255,255,255,0.4)';
      for(let wy=H-s.bh-50+4; wy<H-54; wy+=8) {
        for(let wx=s.x+3; wx<s.x+s.bw-3; wx+=6) {
          if(Math.random()<0.3) ctx.fillRect(wx,wy,3,4);
        }
      }
    }
  });
  ctx.restore();

  // Stars
  G.bgStars.forEach(s => {
    if (s.isBldg) return;
    s.x -= s.speed;
    if (s.x < 0) { s.x=W; s.y=Math.random()*H*0.6; }
    const alpha = 0.3 + Math.sin(t*0.002+s.x)*0.3;
    ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle='#fff';
    ctx.shadowColor='#aaf'; ctx.shadowBlur=3;
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // Speed lines
  if (G.gameRunning && G.speedBoost > 1.2) {
    ctx.save(); ctx.globalAlpha=0.06*(G.speedBoost-1); ctx.strokeStyle='#00f5ff'; ctx.lineWidth=1.5;
    for(let i=0;i<8;i++) {
      const y=(t*0.4+i*70)%H;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }
    ctx.restore();
  }

  // Neon ground
  const g=G.groundY;
  ctx.save();
  const grd=ctx.createLinearGradient(0,g,0,H);
  grd.addColorStop(0,'rgba(0,245,255,0.3)'); grd.addColorStop(1,'rgba(0,245,255,0.02)');
  ctx.fillStyle=grd; ctx.fillRect(0,g,W,H-g);
  ctx.strokeStyle='#00f5ff'; ctx.lineWidth=2; ctx.shadowColor='#00f5ff'; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.moveTo(0,g); ctx.lineTo(W,g); ctx.stroke();
  // Perspective grid
  ctx.lineWidth=0.5; ctx.globalAlpha=0.12; ctx.shadowBlur=0;
  const off=G.scrollX%44;
  for(let x=-off;x<W;x+=44) { ctx.beginPath(); ctx.moveTo(x,g); ctx.lineTo(x,H); ctx.stroke(); }
  ctx.restore();

  // Horizontal grid lines in sky
  if (G.gameRunning) {
    ctx.save(); ctx.globalAlpha=0.03; ctx.strokeStyle='#00f5ff'; ctx.lineWidth=1;
    const offV = G.scrollX % 44;
    for(let x=-offV;x<W;x+=44) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,g); ctx.stroke(); }
    ctx.restore();
  }

  // Obstacles (walls + spikes) — neon city style
  G.obstacles.forEach(o => {
    if (o.x > W+80 || o.x < -80) return;
    ctx.save();
    if (o.isHelpPlatform) {
      ctx.fillStyle='rgba(0,245,255,0.2)'; ctx.strokeStyle='#00f5ff';
      ctx.lineWidth=2; ctx.shadowColor='#00f5ff'; ctx.shadowBlur=10;
      roundRect(o.x,o.y,o.w,o.h,3); ctx.fill(); ctx.stroke();
    } else if (o.type==='wall') {
      const gr=ctx.createLinearGradient(o.x,o.y,o.x+o.w,o.y+o.h);
      gr.addColorStop(0,'#ff0080'); gr.addColorStop(1,'#bf00ff');
      ctx.fillStyle=gr; ctx.shadowColor='#ff0080'; ctx.shadowBlur=14;
      ctx.fillRect(o.x,o.y,o.w,o.h);
      // danger stripes
      ctx.fillStyle='rgba(0,0,0,0.25)';
      for(let i=0;i<o.h;i+=10) ctx.fillRect(o.x,o.y+i,o.w,5);
      // top glow bar
      ctx.fillStyle='rgba(255,255,255,0.3)';
      ctx.fillRect(o.x,o.y,o.w,3);
    } else if (o.type==='spike') {
      ctx.fillStyle='#ff6600'; ctx.shadowColor='#ff6600'; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.moveTo(o.x,o.y+o.h); ctx.lineTo(o.x+o.w/2,o.y); ctx.lineTo(o.x+o.w,o.y+o.h); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(255,255,100,0.5)'; ctx.lineWidth=1; ctx.stroke();
    }
    ctx.restore();
  });

  // Collectibles — floating neon stars
  G.collectibles.forEach(c => {
    if (c.collected || c.x>W+60||c.x<-30) return;
    const sc=1+Math.sin(c.pulse)*0.2;
    ctx.save(); ctx.globalAlpha=0.82+Math.sin(c.pulse*1.3)*0.18;
    ctx.shadowColor=c.color; ctx.shadowBlur=18;
    ctx.font=`${Math.round(c.r*2.2*sc)}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('⭐',c.x,c.y);
    // orbit ring
    ctx.strokeStyle=c.color+'66'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(c.x,c.y,(c.r+6+Math.sin(c.pulse)*3),0,Math.PI*2); ctx.stroke();
    ctx.restore();
  });

  // Player trail
  const p=G.player;
  G.trail.forEach((tr,i)=>{
    const al=((i+1)/G.trail.length)*0.55, sz=p.w*0.45*(i/G.trail.length)+2;
    ctx.save(); ctx.globalAlpha=al; ctx.shadowColor=G.trailColor; ctx.shadowBlur=8;
    ctx.fillStyle=G.trailColor;
    ctx.fillRect(tr.x-sz/2,tr.y-sz/2,sz,sz);
    ctx.restore();
  });

  // Shield
  if(p.shield){
    ctx.save(); ctx.strokeStyle='#00f5ff'; ctx.lineWidth=2.5;
    ctx.shadowColor='#00f5ff'; ctx.shadowBlur=20;
    ctx.globalAlpha=0.6+Math.sin(t*0.012)*0.25;
    ctx.beginPath(); ctx.arc(p.x+p.w/2,p.y+p.h/2,p.w+5,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  // Player — neon cube with eyes
  ctx.save();
  ctx.shadowColor=p.color; ctx.shadowBlur=16;
  const gr=ctx.createLinearGradient(p.x,p.y,p.x+p.w,p.y+p.h);
  gr.addColorStop(0,p.color); gr.addColorStop(1,'#bf00ff');
  ctx.fillStyle=gr; roundRect(p.x,p.y,p.w,p.h,4); ctx.fill();
  ctx.globalAlpha=0.28; ctx.fillStyle='#fff';
  roundRect(p.x+3,p.y+2,p.w-6,p.h*0.38,2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.fillStyle='#fff'; ctx.shadowColor='#fff'; ctx.shadowBlur=5;
  ctx.fillRect(p.x+4,p.y+4,3,3); ctx.fillRect(p.x+11,p.y+4,3,3);
  ctx.fillStyle='#000'; ctx.fillRect(p.x+5,p.y+5,1.5,1.5); ctx.fillRect(p.x+12,p.y+5,1.5,1.5);
  ctx.restore();

  drawParticles();
  drawOverlay('#00f5ff');
}

// ============================================================
// ② SPACE EXPLORER — asteroid field in deep space
// ============================================================
function drawSpace() {
  const t = Date.now();
  // Deep space bg
  const sky=ctx.createRadialGradient(W/2,H/2,10,W/2,H/2,H);
  sky.addColorStop(0,'#05051a'); sky.addColorStop(1,'#010108');
  ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

  // Nebula clouds
  G.bgStars.forEach(s => {
    if (s.isNebula) {
      const nx = (s.x - G.scrollX*0.1) % W;
      const alpha=0.04+Math.sin(t*0.0005+s.x)*0.02;
      ctx.save(); ctx.globalAlpha=alpha;
      const ng=ctx.createRadialGradient(nx,s.y,0,nx,s.y,s.nr);
      ng.addColorStop(0,s.nc); ng.addColorStop(1,'transparent');
      ctx.fillStyle=ng; ctx.beginPath(); ctx.arc(nx,s.y,s.nr,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  });

  // Stars (parallax layers)
  G.bgStars.forEach(s => {
    if (s.isNebula) return;
    s.x -= s.speed;
    if (s.x < 0) { s.x=W; s.y=Math.random()*H; }
    const alpha=0.35+Math.sin(t*0.001+s.x)*0.35;
    ctx.save(); ctx.globalAlpha=alpha;
    ctx.fillStyle=s.starColor||'#fff';
    ctx.shadowColor=s.starColor||'#aaf'; ctx.shadowBlur=4;
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // Distant planet (decorative)
  const px2=W*0.82, py2=H*0.22;
  ctx.save();
  const pGr=ctx.createRadialGradient(px2-8,py2-8,2,px2,py2,45);
  pGr.addColorStop(0,'#3a0060'); pGr.addColorStop(0.6,'#1a0035'); pGr.addColorStop(1,'#08000f');
  ctx.fillStyle=pGr; ctx.shadowColor='#bf00ff'; ctx.shadowBlur=20;
  ctx.beginPath(); ctx.arc(px2,py2,40,0,Math.PI*2); ctx.fill();
  // Planet rings
  ctx.save(); ctx.globalAlpha=0.35; ctx.strokeStyle='#bf00ff'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(px2,py2+5,62,12,0.2,0,Math.PI*2); ctx.stroke();
  ctx.restore(); ctx.restore();

  // Asteroids (obstacles)
  G.obstacles.forEach(o => {
    if (o.x>W+80||o.x<-80) return;
    if (o.isHelpPlatform) {
      // fuel pod
      ctx.save(); ctx.shadowColor='#39ff14'; ctx.shadowBlur=12;
      ctx.fillStyle='rgba(57,255,20,0.2)'; ctx.strokeStyle='#39ff14'; ctx.lineWidth=1.5;
      roundRect(o.x,o.y,o.w,o.h,5); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#39ff14'; ctx.font='10px serif';
      ctx.textAlign='center'; ctx.fillText('⛽',o.x+o.w/2,o.y+o.h/2+4);
      ctx.restore();
    } else {
      // asteroid
      ctx.save(); ctx.shadowColor='#ff6600'; ctx.shadowBlur=8;
      const spin=(t*0.001*(o.spinSpeed||0.5))%(Math.PI*2);
      ctx.translate(o.x+o.w/2,o.y+o.h/2); ctx.rotate(spin);
      ctx.fillStyle='#2a1a08';
      ctx.beginPath();
      for(let i=0;i<8;i++){
        const a=(Math.PI*2/8)*i, r2=o.w/2*(0.75+o.rockBumps[i]*0.25);
        i===0?ctx.moveTo(Math.cos(a)*r2,Math.sin(a)*r2):ctx.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#ff6600'; ctx.lineWidth=1.5; ctx.stroke();
      // crater
      ctx.fillStyle='rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.arc(-o.w*0.15,-o.w*0.1,o.w*0.2,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  });

  // Collectibles — space crystals
  G.collectibles.forEach(c => {
    if (c.collected||c.x>W+60||c.x<-30) return;
    const sc=1+Math.sin(c.pulse)*0.18;
    ctx.save(); ctx.globalAlpha=0.9;
    ctx.shadowColor=c.color; ctx.shadowBlur=20;
    ctx.translate(c.x,c.y); ctx.rotate(c.pulse*0.5); ctx.scale(sc,sc);
    ctx.fillStyle=c.color;
    ctx.beginPath();
    ctx.moveTo(0,-c.r); ctx.lineTo(c.r*0.5,0); ctx.lineTo(0,c.r);
    ctx.lineTo(-c.r*0.5,0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1; ctx.stroke();
    ctx.restore();
  });

  // Spaceship player — triangle body with engine glow
  const p=G.player;
  G.trail.forEach((tr,i)=>{
    const al=((i+1)/G.trail.length)*0.6;
    ctx.save(); ctx.globalAlpha=al; ctx.shadowColor='#ff6600'; ctx.shadowBlur=10;
    ctx.fillStyle='#ff6600';
    ctx.beginPath(); ctx.arc(tr.x,tr.y,2+(i/G.trail.length)*3,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
  if(p.shield){
    ctx.save(); ctx.strokeStyle='#00f5ff'; ctx.lineWidth=2;
    ctx.shadowColor='#00f5ff'; ctx.shadowBlur=15;
    ctx.globalAlpha=0.5+Math.sin(t*0.01)*0.3;
    ctx.beginPath(); ctx.arc(p.x+p.w/2,p.y+p.h/2,p.w+6,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.shadowColor='#ff0080'; ctx.shadowBlur=18;
  // Engine flame
  ctx.fillStyle='#ff6600';
  ctx.globalAlpha=0.8+Math.sin(t*0.02)*0.2;
  ctx.beginPath();
  ctx.moveTo(p.x+4,p.y+p.h); ctx.lineTo(p.x+p.w-4,p.y+p.h);
  ctx.lineTo(p.x+p.w/2,p.y+p.h+8+Math.sin(t*0.03)*4); ctx.closePath(); ctx.fill();
  ctx.globalAlpha=1;
  // Body
  const sgr=ctx.createLinearGradient(p.x,p.y,p.x+p.w,p.y+p.h);
  sgr.addColorStop(0,'#ff0080'); sgr.addColorStop(1,'#bf00ff');
  ctx.fillStyle=sgr;
  ctx.beginPath();
  ctx.moveTo(p.x+p.w/2,p.y);
  ctx.lineTo(p.x+p.w,p.y+p.h);
  ctx.lineTo(p.x+p.w/2,p.y+p.h-4);
  ctx.lineTo(p.x,p.y+p.h); ctx.closePath(); ctx.fill();
  // Cockpit
  ctx.fillStyle='rgba(0,245,255,0.5)';
  ctx.beginPath(); ctx.ellipse(p.x+p.w/2,p.y+p.h*0.45,4,5,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  drawParticles();
  drawOverlay('#ff0080');
}

// ============================================================
// ③ CYBER MAZE — top-down grid maze with hacker aesthetic
// ============================================================
const MAZE_COLS=12, MAZE_ROWS=8;
let mazeGrid=[], mazeGoal={c:10,r:6}, mazePlayerCell={c:0,r:0};

function buildMaze(cols,rows) {
  const g=[];
  for(let r=0;r<rows;r++) { g[r]=[]; for(let c=0;c<cols;c++) g[r][c]={walls:{N:true,S:true,E:true,W:true},visited:false}; }
  // DFS carve
  function carve(r,c) {
    g[r][c].visited=true;
    const dirs=[['N',-1,0],['S',1,0],['E',0,1],['W',0,-1]].sort(()=>Math.random()-0.5);
    for(const[d,dr,dc] of dirs) {
      const nr=r+dr, nc=c+dc;
      if(nr>=0&&nr<rows&&nc>=0&&nc<cols&&!g[nr][nc].visited) {
        const opp={N:'S',S:'N',E:'W',W:'E'};
        g[r][c].walls[d]=false; g[nr][nc].walls[opp[d]]=false;
        carve(nr,nc);
      }
    }
  }
  carve(0,0); return g;
}

function drawMaze() {
  const t=Date.now();
  // Black terminal background with scanlines
  ctx.fillStyle='#020a02'; ctx.fillRect(0,0,W,H);
  // Scanlines
  ctx.save(); ctx.globalAlpha=0.04;
  for(let y=0;y<H;y+=3) { ctx.fillStyle='#000'; ctx.fillRect(0,y,W,1); }
  ctx.restore();

  // Neon grid ticks
  ctx.save(); ctx.globalAlpha=0.06; ctx.strokeStyle='#39ff14'; ctx.lineWidth=0.5;
  for(let x=0;x<W;x+=20) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y=0;y<H;y+=20) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.restore();

  if (!mazeGrid.length) return;
  const cellW=Math.floor((W-40)/MAZE_COLS), cellH=Math.floor((H-60)/MAZE_ROWS);
  const offX=20, offY=30;

  // Draw maze cells
  mazeGrid.forEach((row,r)=>{
    row.forEach((cell,c)=>{
      const cx=offX+c*cellW, cy=offY+r*cellH;
      // Visited cell glow
      if(cell.visited) {
        ctx.save(); ctx.globalAlpha=0.07;
        ctx.fillStyle='#39ff14';
        ctx.fillRect(cx,cy,cellW,cellH);
        ctx.restore();
      }
      // Walls
      ctx.save(); ctx.strokeStyle='#39ff14'; ctx.lineWidth=2;
      ctx.shadowColor='#39ff14'; ctx.shadowBlur=5;
      if(cell.walls.N){ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+cellW,cy);ctx.stroke();}
      if(cell.walls.S){ctx.beginPath();ctx.moveTo(cx,cy+cellH);ctx.lineTo(cx+cellW,cy+cellH);ctx.stroke();}
      if(cell.walls.W){ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx,cy+cellH);ctx.stroke();}
      if(cell.walls.E){ctx.beginPath();ctx.moveTo(cx+cellW,cy);ctx.lineTo(cx+cellW,cy+cellH);ctx.stroke();}
      ctx.restore();
    });
  });

  // Goal marker
  const gcx=offX+mazeGoal.c*cellW+cellW/2, gcy=offY+mazeGoal.r*cellH+cellH/2;
  ctx.save(); ctx.shadowColor='#ffff00'; ctx.shadowBlur=20;
  ctx.fillStyle='#ffff00';
  ctx.font=`${Math.round(cellH*0.6)}px serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🚪',gcx,gcy);
  ctx.restore();

  // Collectibles as "data nodes"
  G.collectibles.forEach(c=>{
    if(c.collected) return;
    const pulse=0.7+Math.sin(t*0.005+c.cx)*0.3;
    ctx.save(); ctx.globalAlpha=pulse; ctx.shadowColor=c.color; ctx.shadowBlur=14;
    const cx2=offX+c.cx*cellW+cellW/2, cy2=offY+c.cy*cellH+cellH/2;
    ctx.strokeStyle=c.color; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(cx2,cy2,cellW*0.25,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle=c.color;
    ctx.font=`${Math.round(cellH*0.45)}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('◆',cx2,cy2);
    ctx.restore();
  });

  // Player — glowing dot with tracer
  const p=G.player;
  const pcx=offX+mazePlayerCell.c*cellW+cellW/2, pcy=offY+mazePlayerCell.r*cellH+cellH/2;
  // Update player visual position
  p.visualX=p.visualX||pcx; p.visualY=p.visualY||pcy;
  p.visualX+=(pcx-p.visualX)*0.2; p.visualY+=(pcy-p.visualY)*0.2;
  ctx.save(); ctx.shadowColor='#bf00ff'; ctx.shadowBlur=22;
  ctx.fillStyle='#bf00ff';
  ctx.beginPath(); ctx.arc(p.visualX,p.visualY,cellW*0.28,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=0.4; ctx.strokeStyle='#00f5ff'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(p.visualX,p.visualY,cellW*0.4+Math.sin(t*0.01)*3,0,Math.PI*2); ctx.stroke();
  ctx.restore();
  // Face
  ctx.save(); ctx.fillStyle='#fff'; ctx.font=`${Math.round(cellW*0.42)}px serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('😎',p.visualX,p.visualY+1);
  ctx.restore();

  // Particles
  G.gameParticles.forEach(gp=>{
    const al=gp.life/gp.maxLife;
    ctx.save(); ctx.globalAlpha=al; ctx.shadowColor=gp.color; ctx.shadowBlur=7;
    ctx.fillStyle=gp.color;
    ctx.beginPath(); ctx.arc(gp.x,gp.y,gp.size*al,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // HUD overlay
  ctx.save(); ctx.font=`10px 'Share Tech Mono',monospace`; ctx.fillStyle='#39ff14';
  ctx.textAlign='left';
  ctx.fillText(`POSIZIONE: [${mazePlayerCell.c},${mazePlayerCell.r}]  GOAL: [${mazeGoal.c},${mazeGoal.r}]`, offX, offY-12);
  ctx.restore();

  drawOverlay('#39ff14');
}

// Maze player movement
function mazeMoveDir(dir) {
  const cell=mazeGrid[mazePlayerCell.r]?.[mazePlayerCell.c];
  if(!cell||cell.walls[dir]) { SFX.error(); showToast('🧱 Muro!','#ff0080'); return false; }
  const moves={N:[0,-1],S:[0,1],E:[1,0],W:[-1,0]};
  const[dc,dr]=moves[dir];
  const nc=mazePlayerCell.c+dc, nr=mazePlayerCell.r+dr;
  if(nc<0||nc>=MAZE_COLS||nr<0||nr>=MAZE_ROWS) return false;
  mazePlayerCell.c=nc; mazePlayerCell.r=nr;
  SFX.drop();
  G.spawnGameParticles(
    20+mazePlayerCell.c*(Math.floor((W-40)/MAZE_COLS))+Math.floor((W-40)/MAZE_COLS)/2,
    30+mazePlayerCell.r*(Math.floor((H-60)/MAZE_ROWS))+Math.floor((H-60)/MAZE_ROWS)/2,
    '#39ff14', 6
  );
  // Check collectibles
  G.collectibles.forEach(c=>{
    if(!c.collected&&c.cx===mazePlayerCell.c&&c.cy===mazePlayerCell.r) {
      c.collected=true; G.addScore(150); SFX.collect();
      showToast('◆ Nodo Hackerato! +150','#bf00ff');
    }
  });
  // Check goal
  if(mazePlayerCell.c===mazeGoal.c&&mazePlayerCell.r===mazeGoal.r) {
    G.addScore(500); SFX.score();
    showToast('🚪 USCITA TROVATA! +500 pts','#ffff00');
    G.screenShake();
    // Regenerate maze
    setTimeout(()=>{ mazeGrid=buildMaze(MAZE_COLS,MAZE_ROWS); mazePlayerCell={c:0,r:0}; },1500);
  }
  return true;
}

// ============================================================
// ④ GRAVITY FLIP — dual-platform neon flipper
// ============================================================
function drawGravity() {
  const t=Date.now();
  // Gradient bg — green/yellow theme
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#010802'); bg.addColorStop(0.5,'#020f04'); bg.addColorStop(1,'#030f01');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // Matrix-style rain dots
  G.bgStars.forEach(s=>{
    s.y+=s.rainSpeed||0.5;
    if(s.y>H){ s.y=0; s.x=Math.random()*W; }
    const alpha=0.1+Math.sin(t*0.003+s.x)*0.08;
    ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=s.green?'#39ff14':'#00f5ff';
    ctx.font=`${s.r*6}px monospace`;
    ctx.fillText(s.char||'0',s.x,s.y);
    ctx.restore();
  });

  // Top ceiling platform
  ctx.save();
  const tGrd=ctx.createLinearGradient(0,0,0,14);
  tGrd.addColorStop(0,'rgba(57,255,20,0.35)'); tGrd.addColorStop(1,'rgba(57,255,20,0.05)');
  ctx.fillStyle=tGrd; ctx.fillRect(0,0,W,14);
  ctx.strokeStyle='#39ff14'; ctx.lineWidth=2; ctx.shadowColor='#39ff14'; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.moveTo(0,14); ctx.lineTo(W,14); ctx.stroke();
  // Grid on ceiling
  ctx.lineWidth=0.5; ctx.globalAlpha=0.12; ctx.shadowBlur=0;
  const off2=G.scrollX%44;
  for(let x=-off2;x<W;x+=44){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,14); ctx.stroke(); }
  ctx.restore();

  // Bottom floor platform
  const g=G.groundY;
  ctx.save();
  const bGrd=ctx.createLinearGradient(0,g,0,H);
  bGrd.addColorStop(0,'rgba(57,255,20,0.35)'); bGrd.addColorStop(1,'rgba(57,255,20,0.05)');
  ctx.fillStyle=bGrd; ctx.fillRect(0,g,W,H-g);
  ctx.strokeStyle='#39ff14'; ctx.lineWidth=2; ctx.shadowColor='#39ff14'; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.moveTo(0,g); ctx.lineTo(W,g); ctx.stroke();
  const off3=G.scrollX%44;
  ctx.lineWidth=0.5; ctx.globalAlpha=0.12; ctx.shadowBlur=0;
  for(let x=-off3;x<W;x+=44){ ctx.beginPath(); ctx.moveTo(x,g); ctx.lineTo(x,H); ctx.stroke(); }
  ctx.restore();

  // Gravity arrows
  const p=G.player;
  const arrowColor=p.gravInvert?'#ffff00':'#39ff14';
  for(let xi=60;xi<W;xi+=80){
    ctx.save(); ctx.globalAlpha=0.12; ctx.strokeStyle=arrowColor; ctx.fillStyle=arrowColor; ctx.lineWidth=1;
    const ay=H/2, aDir=p.gravInvert?-14:14;
    ctx.beginPath(); ctx.moveTo(xi,ay-aDir*0.5); ctx.lineTo(xi,ay+aDir*0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xi-4,ay+aDir*0.3); ctx.lineTo(xi,ay+aDir*0.5); ctx.lineTo(xi+4,ay+aDir*0.3); ctx.fill();
    ctx.restore();
  }

  // Obstacles — energy barriers
  G.obstacles.forEach(o=>{
    if(o.x>W+80||o.x<-80) return;
    ctx.save();
    if(o.isHelpPlatform){
      ctx.fillStyle='rgba(57,255,20,0.15)'; ctx.strokeStyle='#39ff14';
      ctx.lineWidth=2; ctx.shadowColor='#39ff14'; ctx.shadowBlur=8;
      roundRect(o.x,o.y,o.w,o.h,3); ctx.fill(); ctx.stroke();
    } else {
      // Energy spike/gate
      const pulse2=0.5+Math.sin(t*0.008+o.x)*0.5;
      ctx.fillStyle=`rgba(255,100,0,${0.6+pulse2*0.3})`; ctx.shadowColor='#ff6600'; ctx.shadowBlur=14;
      ctx.fillRect(o.x,o.y,o.w,o.h);
      // Energy lines
      ctx.strokeStyle='rgba(255,255,0,0.5)'; ctx.lineWidth=1;
      for(let i=2;i<o.h;i+=6){ ctx.beginPath(); ctx.moveTo(o.x,o.y+i); ctx.lineTo(o.x+o.w,o.y+i); ctx.stroke(); }
    }
    ctx.restore();
  });

  // Collectibles — gravity orbs
  G.collectibles.forEach(c=>{
    if(c.collected||c.x>W+60||c.x<-30) return;
    const orb=1+Math.sin(c.pulse)*0.2;
    ctx.save(); ctx.shadowColor=c.color; ctx.shadowBlur=20;
    ctx.fillStyle=c.color; ctx.globalAlpha=0.85;
    ctx.beginPath(); ctx.arc(c.x,c.y,c.r*orb,0,Math.PI*2); ctx.fill();
    // Inner glow
    ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(c.x-c.r*0.25,c.y-c.r*0.25,c.r*0.35,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // Player — flipping diamond/rhombus
  G.trail.forEach((tr,i)=>{
    const al=((i+1)/G.trail.length)*0.5;
    ctx.save(); ctx.globalAlpha=al; ctx.shadowColor=G.trailColor; ctx.shadowBlur=6;
    ctx.fillStyle=G.trailColor;
    ctx.beginPath(); ctx.arc(tr.x,tr.y,3*(i/G.trail.length)+1,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
  if(p.shield){
    ctx.save(); ctx.strokeStyle='#39ff14'; ctx.lineWidth=2;
    ctx.shadowColor='#39ff14'; ctx.shadowBlur=18;
    ctx.globalAlpha=0.55+Math.sin(t*0.01)*0.3;
    ctx.beginPath(); ctx.arc(p.x+p.w/2,p.y+p.h/2,p.w+5,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  ctx.save(); ctx.shadowColor=p.gravInvert?'#ffff00':'#39ff14'; ctx.shadowBlur=18;
  const flip=p.gravInvert?-1:1;
  ctx.translate(p.x+p.w/2,p.y+p.h/2); ctx.scale(1,flip);
  const dgr=ctx.createLinearGradient(-p.w/2,-p.h/2,p.w/2,p.h/2);
  dgr.addColorStop(0,'#39ff14'); dgr.addColorStop(1,'#ffff00');
  ctx.fillStyle=dgr;
  ctx.beginPath(); ctx.moveTo(0,-p.h/2); ctx.lineTo(p.w/2,0); ctx.lineTo(0,p.h/2); ctx.lineTo(-p.w/2,0); ctx.closePath(); ctx.fill();
  // Eyes
  ctx.fillStyle='#000'; ctx.fillRect(-5,-3,3,3); ctx.fillRect(2,-3,3,3);
  ctx.restore();

  drawParticles();
  drawOverlay('#39ff14');
}

// ============================================================
// GAME LOOP DISPATCHER
// ============================================================
function gameLoop() {
  ctx.save();
  ctx.translate(G.shakeX, G.shakeY);
  if (G.gameRunning) updateGame();
  switch(G.gameMode) {
    case 'space':   drawSpace();   break;
    case 'maze':    drawMaze();    break;
    case 'gravity': drawGravity(); break;
    default:        drawRunner();  break;
  }
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