(() => {
  'use strict';

  /* =========================================================
     Bridge Bite
     You're on a bridge. The river flows toward you, carrying
     fish and junk. Aim the rod, cast, reel in. Junk jams the hook.
     ========================================================= */

  // ---------- tweakable numbers ----------
  const W = 320, H = 240;          // logical pixels, scaled up by CSS
  const ROUND_TIME = 60;           // seconds
  const CAST_SPEED = 150;          // px/s hook drops
  const EMPTY_REEL = 190;          // px/s reeling with nothing on the hook
  const MOVE_SPEED = 115;          // px/s along the bridge
  const FLOW_BASE = 38;            // px/s river surface scroll

  // layout
  const RAIL_Y = 35;
  const TIP_Y = 42;                // where the rod tip sits
  const REST_Y = 50;               // hook parked here
  const MAX_Y = H - 8;             // deepest the hook can go
  const X_MIN = 18, X_MAX = W - 18;

  const SAVE_KEY = 'bridge-bite-best';
  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ---------- colors ----------
  const C = {
    ink: '#1a1030',
    cream: '#ffe8b0',
    gold: '#ffd23f',
    coral: '#ff5d73',
    mint: '#7fd6c8',
    wood: '#7a4d32',
    woodDark: '#5e3a28',
    woodLight: '#a8714a',
    bank: '#16262c',
    bankRim: '#2c4b47',
    reed: '#4a8a54',
    line: '#e8dcc0',
    rod: '#d8c08a'
  };

  // ---------- helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => {
    const A = hexToRgb(a), B = hexToRgb(b);
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
  };
  const hash = n => {
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3);
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return n >>> 0;
  };
  const pad5 = n => String(n).padStart(5, '0');

  // ---------- pixel sprites ----------
  const PAL = {
    k: '#1a1030', w: '#fff3d6', o: '#ff8a3d', r: '#ff5d73', y: '#ffd23f',
    b: '#5cb8e0', d: '#1d5f7a', n: '#9a6240', N: '#5e3a28',
    s: '#c4cfd8', S: '#7d8a96', e: '#30303f', f: '#f2b48c'
  };

  function makeSprite(rows) {
    const h = rows.length, w = rows[0].length;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    rows.forEach((row, j) => {
      for (let i = 0; i < w; i++) {
        const ch = row[i];
        if (ch !== '.') { x.fillStyle = PAL[ch]; x.fillRect(i, j, 1, 1); }
      }
    });
    return c;
  }

  const SPR = {
    minnow: makeSprite([
      '...bb...',
      '..bbbb..',
      '.bkbbkb.',
      '.bbbbbb.',
      '.bwwwwb.',
      '.bwwwwb.',
      '..bwwb..',
      '..bbbb..',
      '...bb...',
      '..bddb..',
      '.bd..db.',
      'bd....db'
    ]),
    bass: makeSprite([
      '....oo....',
      '...oooo...',
      '..okooko..',
      '..oooooo..',
      '.ooyyyyoo.',
      '.oyyyyyyo.',
      '.ooyyyyoo.',
      '.ooyyyyoo.',
      '..oooooo..',
      '..oooooo..',
      '...oooo...',
      '...oooo...',
      '....rr....',
      '...rrrr...',
      '..rr..rr..',
      '.rr....rr.'
    ]),
    koi: makeSprite([
      '....yy....',
      '...yyyy...',
      '..ykyyky..',
      '..yyyyyy..',
      '.yywwwwyy.',
      '.ywwrrwwy.',
      '.yywwwwyy.',
      '.ywrrwwwy.',
      '.yywwwwyy.',
      '..yyyyyy..',
      '..yywwyy..',
      '...yyyy...',
      '...yyyy...',
      '....yy....',
      '...yyyy...',
      '..yy..yy..',
      '.yy....yy.',
      '.y......y.'
    ]),
    boot: makeSprite([
      '..nnnn....',
      '..nwwn....',
      '..nnnn....',
      '..nnnn....',
      '..nnnn....',
      '..nnnn....',
      '..nnnnn...',
      '..nnnnnnn.',
      '.nnnnnnnnn',
      'nnnnnnnnnn',
      'NNNNNNNNNN',
      'kkkkkkkkkk'
    ]),
    can: makeSprite([
      '.ssssss.',
      'sSSSSSSs',
      '.ssssss.',
      '.swwwws.',
      '.swrrws.',
      '.swrrws.',
      '.swwwws.',
      '.ssssss.',
      'sSSSSSSs',
      '.ssssss.'
    ]),
    tire: makeSprite([
      '...eeeeee...',
      '.eeeeeeeeee.',
      '.eeSSSSSSee.',
      'eeeS....Seee',
      'eeS......See',
      'eeS......See',
      'eeS......See',
      'eeeS....Seee',
      '.eeSSSSSSee.',
      '.eeeeeeeeee.',
      '...eeeeee...'
    ]),
    kid: makeSprite([
      '...yyyy...',
      '.yyyyyyyy.',
      '..ffffff..',
      '..fkffkf..',
      '..ffffff..',
      '..rrrrrr..',
      '.rrrrrrrr.',
      'frrrrrrrrf',
      'frrrrrrrrf',
      '..rrrrrr..',
      '..dddddd..',
      '..dd..dd..',
      '..dd..dd..',
      '..kk..kk..'
    ]),
    hook: makeSprite([
      '..s..',
      '..s..',
      '..s..',
      's.s..',
      'ssS..'
    ]),
    chest: makeSprite([
      '.NNNNNNNN.',
      'NnnnnnnnnN',
      'NnnnnnnnnN',
      'NNNNyyNNNN',
      'NnnnyynnnN',
      'NnnnnnnnnN',
      'NnnnnnnnnN',
      'NNNNNNNNNN',
      '.kkkkkkkk.'
    ])
  };

  // ---------- what floats down the river ----------
  const TYPES = {
    minnow: { kind: 'fish', pts: 10,  spr: 'minnow', w: 8,  h: 12, speed: [34, 46], amp: [5, 12],  freq: [1.2, 2.2], reel: 135, weight: 30, col: '#5cb8e0' },
    bass:   { kind: 'fish', pts: 25,  spr: 'bass',   w: 10, h: 16, speed: [28, 38], amp: [4, 9],   freq: [0.8, 1.5], reel: 105, weight: 20, col: '#ff8a3d' },
    koi:    { kind: 'fish', pts: 100, spr: 'koi',    w: 10, h: 18, speed: [52, 66], amp: [14, 26], freq: [1.4, 2.2], reel: 85,  weight: 5,  col: '#ffd23f' },
    boot:   { kind: 'junk', tangle: 2.2, spr: 'boot', w: 10, h: 12, speed: [26, 36], amp: [2, 5], freq: [0.5, 1], reel: 60, weight: 14, col: '#9a6240' },
    can:    { kind: 'junk', tangle: 1.6, spr: 'can',  w: 8,  h: 10, speed: [30, 40], amp: [2, 6], freq: [0.6, 1.2], reel: 70, weight: 14, col: '#c4cfd8' },
    tire:   { kind: 'junk', tangle: 3.0, spr: 'tire', w: 12, h: 11, speed: [24, 32], amp: [1, 4], freq: [0.4, 0.8], reel: 45, weight: 10, col: '#7d8a96' },
    chest:  { kind: 'fish', pts: 200, spr: 'chest', w: 10, h: 9, speed: [22, 28], amp: [1, 3], freq: [0.4, 0.8], reel: 50, weight: 2, col: '#ffd23f' }
  };
  for (const k in TYPES) TYPES[k].name = k;

  function pickType() {
    // koi get a little more common as the round goes on
    const bonus = Math.min(elapsed / 20, 3);
    let total = 0;
    const weights = Object.values(TYPES).map(t => {
      const w = t.name === 'koi' ? t.weight + bonus : t.weight;
      total += w;
      return w;
    });
    let r = Math.random() * total;
    const list = Object.values(TYPES);
    for (let i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r <= 0) return list[i];
    }
    return list[0];
  }

  // ---------- state ----------
  let mode = 'title';              // title | play | pause | over
  let score = 0, best = loadBest();
  let timeLeft = ROUND_TIME, elapsed = 0;
  let streak = 0, fishCount = 0, junkCount = 0;
  let timeUp = false, newBest = false;
  let overT = 0, shake = 0, scroll = 0, clock = 0, spawnT = 0, lastTick = 99;
  let flash = 0;                   // NEW: gold screen flash timer

  const player = { x: W / 2, bob: 0, moving: false };
  const hook = { state: 'idle', x: W / 2, y: REST_Y, caught: null, tangle: 0, tangleMax: 1 };
  const held = { left: false, right: false };

  let objs = [], particles = [], ripples = [], popups = [];

  // river surface streaks (purely visual)
  const streaks = Array.from({ length: 30 }, (_, i) => ({
    x: rand(X_MIN, X_MAX - 14),
    y: rand(0, H),
    len: Math.round(rand(4, 14)),
    spd: rand(0.6, 1.4),
    glint: i % 5 === 0
  }));

  const waterBands = Array.from({ length: 15 }, (_, i) => mix('#15627a', '#0a2c3e', i / 14));

  function loadBest() {
    try { return parseInt(localStorage.getItem(SAVE_KEY), 10) || 0; } catch (e) { return 0; }
  }
  function saveBest() {
    try { localStorage.setItem(SAVE_KEY, String(best)); } catch (e) { /* storage blocked, fine */ }
  }

  // ---------- sound (tiny WebAudio blips) ----------
  let actx = null, muted = false;

  function initAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
  }

  function tone(f0, f1, dur, type, vol, delay) {
    if (!actx || muted) return;
    const t = actx.currentTime + (delay || 0);
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    g.gain.setValueAtTime(vol || 0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  const sfx = {
    cast:  () => tone(700, 180, 0.22, 'square', 0.03),
    snag:  () => tone(300, 640, 0.1, 'square', 0.04),
    fish:  big => {
      [523, 659, 784].forEach((f, i) => tone(f, f, 0.08, 'square', 0.04, i * 0.07));
      if (big) tone(1047, 1047, 0.28, 'square', 0.04, 0.22);
    },
    junk:  () => { tone(140, 60, 0.3, 'sawtooth', 0.06); tone(90, 50, 0.3, 'square', 0.04, 0.05); },
    shake: () => tone(220, 330, 0.05, 'square', 0.03),
    free:  () => tone(400, 900, 0.12, 'square', 0.04),
    tick:  () => tone(880, 880, 0.05, 'square', 0.03),
    start: () => [262, 330, 392, 523].forEach((f, i) => tone(f, f, 0.08, 'square', 0.04, i * 0.06)),
    over:  () => [392, 330, 262, 196].forEach((f, i) => tone(f, f, 0.16, 'square', 0.05, i * 0.16))
  };

  const melody = [262, 330, 392, 330, 262, 330, 392, 523];
  let noteIndex = 0, musicTimer = 0;

  function updateMusic(dt) {
    if (mode !== 'play') return;
    musicTimer -= dt;
    if (musicTimer <= 0) {
      const f = melody[noteIndex] / 2;
      tone(f, f, 0.2, 'triangle', 0.025);
      noteIndex = (noteIndex + 1) % melody.length;
      musicTimer = 0.3;
    }
  }

  // ---------- spawning ----------
  function spawn(y) {
    const t = pickType();
    let x, tries = 0;
    do {
      x = rand(X_MIN + 8, X_MAX - 8);
      tries++;
    } while (tries < 8 && objs.some(o => !o.hooked && Math.abs(o.bx - x) < 24 && Math.abs(o.y - y) < 30));

    objs.push({
      type: t,
      bx: x, x: x, y: y,
      spd: rand(t.speed[0], t.speed[1]),
      amp: rand(t.amp[0], t.amp[1]),
      freq: rand(t.freq[0], t.freq[1]),
      phase: rand(0, Math.PI * 2),
      age: 0,
      hooked: false
    });
  }

  function flow() {
    return 1 + Math.min(elapsed, ROUND_TIME) / ROUND_TIME * 0.5;
  }

  function multiplier() {
    return 1 + Math.min(3, Math.floor(streak / 3));
  }

  // ---------- effects ----------
  function burst(x, y, col, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(20, 70);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col });
    }
  }
  function ripple(x, y) { ripples.push({ x, y, r: 2, life: 1 }); }
  function popup(x, y, str, col) { popups.push({ x, y, str, col, life: 1 }); }

  // ---------- game flow ----------
  function resetRound() {
    score = 0; timeLeft = ROUND_TIME; elapsed = 0;
    streak = 0; fishCount = 0; junkCount = 0;
    timeUp = false; newBest = false; lastTick = 99; shake = 0; flash = 0;
    objs = []; particles = []; ripples = []; popups = [];
    player.x = W / 2; player.bob = 0; player.moving = false;
    hook.state = 'idle'; hook.x = player.x; hook.y = REST_Y; hook.caught = null;
    for (let i = 0; i < 8; i++) spawn(rand(90, H));
    spawnT = 0.4;
  }

  function startGame() {
    resetRound();
    mode = 'play';
    sfx.start();
  }

  function endGame() {
    mode = 'over';
    overT = 0;
    if (score > best) { best = score; newBest = true; saveBest(); }
    sfx.over();
  }

  function togglePause() {
    if (mode === 'play') mode = 'pause';
    else if (mode === 'pause') mode = 'play';
  }

  function action() {
    initAudio();
    if (mode === 'title') { startGame(); return; }
    if (mode === 'over') { if (overT > 0.7) startGame(); return; }
    if (mode === 'pause') { mode = 'play'; return; }
    if (timeUp) return;

    if (hook.state === 'idle') {
      hook.state = 'cast';
      hook.x = player.x;
      ripple(hook.x, REST_Y + 4);
      sfx.cast();
    } else if (hook.state === 'cast') {
      hook.state = 'reel';          // changed your mind, pull it back
    } else if (hook.state === 'tangle') {
      hook.tangle -= 0.2;           // mash to shake junk loose
      sfx.shake();
      if (!REDUCED) shake = Math.max(shake, 0.06);
    }
  }

  function snag(o) {
    o.hooked = true;
    hook.caught = o;
    hook.state = 'reel';
    ripple(hook.x, hook.y + 4);
    burst(hook.x, hook.y + 4, o.type.col, 6);
    sfx.snag();
  }

  function land() {
    const o = hook.caught;
    if (!o) { hook.state = 'idle'; return; }

    if (o.type.kind === 'fish') {
      const mult = multiplier();
      const pts = o.type.pts * mult;
      score += pts;
      streak++;
      fishCount++;
      if (o.type.name === 'koi' && !REDUCED) flash = 0.3;
      popup(hook.x, REST_Y + 6, '+' + pts, o.type.name === 'koi' ? C.gold : C.cream);
      burst(hook.x, REST_Y + 8, o.type.col, 12);
      sfx.fish(o.type.name === 'koi');
      removeObj(o);
      hook.caught = null;
      hook.state = 'idle';
    } else {
      streak = 0;
      junkCount++;
      hook.state = 'tangle';
      hook.tangle = o.type.tangle;
      hook.tangleMax = o.type.tangle;
      if (!REDUCED) shake = 0.25;
      sfx.junk();
    }
  }

  function freeJunk() {
    const o = hook.caught;
    if (o) {
      burst(hook.x, REST_Y + 10, o.type.col, 14);
      removeObj(o);
    }
    popup(hook.x, REST_Y + 8, 'FREE', C.mint);
    sfx.free();
    hook.caught = null;
    hook.state = 'idle';
  }

  function removeObj(o) {
    const i = objs.indexOf(o);
    if (i >= 0) objs.splice(i, 1);
  }

  // ---------- update ----------
  function updateWorld(dt) {
    clock += dt;
    const f = flow();
    scroll += FLOW_BASE * f * dt;

    for (const s of streaks) {
      s.y -= FLOW_BASE * s.spd * f * dt;
      if (s.y < -2) { s.y = H + 2; s.x = rand(X_MIN, X_MAX - s.len); }
    }

    spawnT -= dt;
    if (spawnT <= 0) {
      spawn(H + 16);
      const p = Math.min(elapsed / ROUND_TIME, 1);
      spawnT = lerp(0.9, 0.5, p) * rand(0.7, 1.3);
    }

    for (const o of objs) {
      if (o.hooked) continue;
      o.age += dt;
      o.y -= o.spd * f * dt;
      o.x = clamp(o.bx + Math.sin(o.age * o.freq + o.phase) * o.amp, 16, W - 16);
    }
    objs = objs.filter(o => o.hooked || o.y > -24);

    for (const r of ripples) { r.r += 18 * dt; r.life -= dt * 1.6; }
    ripples = ripples.filter(r => r.life > 0);

    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 2.2; }
    particles = particles.filter(p => p.life > 0);

    for (const p of popups) { p.y -= 16 * dt; p.life -= dt * 0.9; }
    popups = popups.filter(p => p.life > 0);

    if (shake > 0) shake = Math.max(0, shake - dt);
    if (flash > 0) flash = Math.max(0, flash - dt);   // NEW: flash fades out
  }

  function updateHook(dt) {
    const h = hook;

    if (h.state === 'cast') {
      h.y += CAST_SPEED * dt;
      for (const o of objs) {
        if (o.hooked) continue;
        if (Math.abs(o.x - h.x) <= o.type.w / 2 + 2 && Math.abs(o.y - (h.y + 4)) <= o.type.h / 2 + 2) {
          snag(o);
          return;
        }
      }
      if (h.y >= MAX_Y) { h.y = MAX_Y; h.state = 'reel'; }

    } else if (h.state === 'reel') {
      const sp = h.caught ? h.caught.type.reel : EMPTY_REEL;
      h.y -= sp * dt;
      if (h.caught) {
        const o = h.caught;
        const jitter = o.type.kind === 'fish' ? Math.round(Math.sin(clock * 40)) : 0;
        o.x = h.x + jitter;
        o.y = h.y + 5 + o.type.h / 2 - 2;
      }
      if (h.y <= REST_Y) { h.y = REST_Y; land(); }

    } else if (h.state === 'tangle') {
      h.tangle -= dt;
      if (h.tangle <= 0) freeJunk();
    }
  }

  function updatePlay(dt) {
    elapsed += dt;

    if (!timeUp) {
      timeLeft -= dt;
      const sec = Math.ceil(timeLeft);
      if (sec <= 5 && sec > 0 && sec !== lastTick) { lastTick = sec; sfx.tick(); }
      if (timeLeft <= 0) { timeLeft = 0; timeUp = true; }
    }

    if (hook.state === 'idle' && !timeUp) {
      const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      player.moving = dir !== 0;
      if (dir) {
        player.x = clamp(player.x + dir * MOVE_SPEED * dt, X_MIN, X_MAX);
        player.bob += dt;
      }
      hook.x = player.x;
    } else {
      player.moving = false;
    }

    updateHook(dt);

    if (timeUp) {
      if (hook.state === 'idle' || hook.state === 'tangle') endGame();
      else if (hook.state === 'cast') hook.state = 'reel';
    }
  }

  // ---------- drawing ----------
  function text(str, x, y, o) {
    o = o || {};
    const size = o.size || 8;
    ctx.font = size + 'px "Press Start 2P", "Courier New", monospace';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'top';
    const off = o.shadowOff || 1;
    if (o.shadow !== null) {
      ctx.fillStyle = o.shadow || C.ink;
      ctx.fillText(str, x + off, y + off);
    }
    ctx.fillStyle = o.color || C.cream;
    ctx.fillText(str, x, y);
  }

  function pline(x0, y0, x1, y1, col) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    ctx.fillStyle = col;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  function drawWater() {
    for (let i = 0; i < waterBands.length; i++) {
      ctx.fillStyle = waterBands[i];
      ctx.fillRect(0, i * 16, W, 16);
    }
    for (const s of streaks) {
      ctx.fillStyle = s.glint ? 'rgba(255,150,100,0.2)' : (s.len > 9 ? '#2a8898' : '#1c6577');
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.glint ? s.len + 10 : s.len, 1);
    }
  }

  function drawBanks() {
    const base = Math.floor(scroll / 8);
    const off = scroll % 8;
    for (let j = 0; j <= 31; j++) {
      const idx = base + j;
      const y = Math.round(j * 8 - off);
      const eL = 10 + hash(idx * 2) % 6;
      const eR = 10 + hash(idx * 2 + 1) % 6;

      ctx.fillStyle = C.bank;
      ctx.fillRect(0, y, eL, 8);
      ctx.fillRect(W - eR, y, eR, 8);
      ctx.fillStyle = C.bankRim;
      ctx.fillRect(eL - 1, y, 1, 8);
      ctx.fillRect(W - eR, y, 1, 8);

      const hL = hash(idx * 7);
      if (hL % 5 === 0) {
        ctx.fillStyle = C.reed;
        ctx.fillRect(2 + hL % 6, y + 2, 1, 5);
        ctx.fillRect(4 + hL % 5, y + 3, 1, 4);
      } else if (hL % 4 === 0) {
        ctx.fillStyle = C.bankRim;
        ctx.fillRect(hL % 7, y + 3, 3, 2);
      }
      const hR = hash(idx * 11 + 3);
      if (hR % 5 === 0) {
        ctx.fillStyle = C.reed;
        ctx.fillRect(W - 4 - hR % 6, y + 2, 1, 5);
        ctx.fillRect(W - 7 - hR % 5, y + 3, 1, 4);
      } else if (hR % 4 === 0) {
        ctx.fillStyle = C.bankRim;
        ctx.fillRect(W - 8 - hR % 5, y + 3, 3, 2);
      }
    }
  }

  function drawAimGuide() {
    if (mode !== 'play' || hook.state !== 'idle' || timeUp) return;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    const x = Math.round(player.x);
    for (let y = REST_Y + 10; y < H; y += 8) ctx.fillRect(x, y, 1, 3);
  }

  function drawObjs() {
    for (const o of objs) {
      if (o.hooked) continue;
      const t = o.type, s = SPR[t.spr];
      const x = Math.round(o.x - t.w / 2), y = Math.round(o.y - t.h / 2);
      ctx.drawImage(s, x, y);
      if (t.name === 'koi' && Math.floor(o.age * 6 + o.phase) % 3 === 0) {
        ctx.fillStyle = '#fff3d6';
        const sx = x + (Math.floor(o.phase * 10) % 2 ? -2 : t.w + 1), sy = y + 4;
        ctx.fillRect(sx, sy - 1, 1, 3);
        ctx.fillRect(sx - 1, sy, 3, 1);
      }
    }
  }

  function drawRipples() {
    for (const r of ripples) {
      ctx.globalAlpha = clamp(r.life, 0, 1) * 0.6;
      ctx.strokeStyle = '#a8f0e0';
      ctx.lineWidth = 1;
      const w = Math.round(r.r * 2), h = Math.round(r.r);
      ctx.strokeRect(Math.round(r.x - r.r) + 0.5, Math.round(r.y - r.r / 2) + 0.5, w, h);
    }
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawDeck() {
    ctx.fillStyle = C.wood;
    ctx.fillRect(0, 0, W, 39);
    for (let x = 0; x < W; x += 10) {
      ctx.fillStyle = (x / 10) % 2 ? C.woodDark : '#6a412a';
      ctx.fillRect(x, 0, 1, 39);
    }
    ctx.fillStyle = C.woodDark;
    ctx.fillRect(0, 39, W, 1);
  }

  function drawPlayer() {
    const bob = player.moving && Math.floor(player.bob * 8) % 2 ? 1 : 0;
    ctx.drawImage(SPR.kid, Math.round(player.x) - 5, 21 + bob);
  }

  function drawRailing() {
    // beam
    ctx.fillStyle = C.woodLight;
    ctx.fillRect(0, RAIL_Y, W, 1);
    ctx.fillStyle = '#8f5c3b';
    ctx.fillRect(0, RAIL_Y + 1, W, 2);
    // posts
    for (let x = 8; x < W; x += 40) {
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(x, 31, 4, 11);
      ctx.fillStyle = C.woodLight;
      ctx.fillRect(x, 31, 4, 2);
    }
    // shadow the bridge throws on the water
    ctx.fillStyle = 'rgba(5,16,24,0.65)';
    ctx.fillRect(0, 42, W, 4);
    ctx.fillStyle = 'rgba(5,16,24,0.32)';
    ctx.fillRect(0, 46, W, 6);
  }

  function drawRod() {
    const px = Math.round(player.x);
    let bend = 0;
    if (hook.state === 'reel' && hook.caught) bend = 2;
    if (hook.state === 'tangle') bend = 3;
    pline(px + 4, 28, px, TIP_Y + bend, C.rod);
    pline(px + 5, 28, px + 1, TIP_Y + bend, C.rod);
  }

  function drawLineAndHook() {
    const hx = Math.round(hook.x);
    const hy = Math.round(hook.y);

    ctx.fillStyle = C.line;
    ctx.fillRect(hx, TIP_Y, 1, hy - TIP_Y);
    ctx.drawImage(SPR.hook, hx - 2, hy);

    const o = hook.caught;
    if (o) {
      const t = o.type;
      let ox = o.x, oy = o.y;
      if (hook.state === 'tangle' && !REDUCED) {
        ox += Math.round(Math.sin(clock * 50) * 1);
        oy = REST_Y + 5 + t.h / 2 - 2;
      }
      ctx.drawImage(SPR[t.spr], Math.round(ox - t.w / 2), Math.round(oy - t.h / 2));
    }
  }

  function drawTangleUI() {
    if (hook.state !== 'tangle') return;
    const blink = Math.floor(clock * 6) % 2 === 0;
    text('JAMMED! MASH SPACE', W / 2, 78, { align: 'center', color: blink ? C.coral : C.cream });
    const bw = 90, bx = Math.round(W / 2 - bw / 2), by = 92;
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx - 2, by - 2, bw + 4, 10);
    ctx.fillStyle = '#3a2162';
    ctx.fillRect(bx, by, bw, 6);
    ctx.fillStyle = C.coral;
    ctx.fillRect(bx, by, Math.round(bw * clamp(hook.tangle / hook.tangleMax, 0, 1)), 6);
  }

  function drawPopups() {
    for (const p of popups) {
      ctx.globalAlpha = clamp(p.life * 1.6, 0, 1);
      text(p.str, Math.round(p.x), Math.round(p.y), { align: 'center', color: p.col });
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    text('SCORE ' + pad5(score), 6, 4);
    const m = multiplier();
    if (mode !== 'title' && m > 1) text('x' + m, 100, 4, { color: C.gold });

    const low = timeLeft <= 10 && Math.floor(clock * 4) % 2 === 0;
    text('TIME ' + Math.ceil(timeLeft), W / 2 + 6, 4, { align: 'center', color: low ? C.coral : C.cream });

    text('BEST ' + pad5(best), W - 6, 4, { align: 'right' });

    if (muted) text('MUTE', W - 6, H - 12, { align: 'right' });
  }

  function dim(a) {
    ctx.fillStyle = 'rgba(18,10,36,' + a + ')';
    ctx.fillRect(0, 0, W, H);
  }

  function drawTitle() {
    dim(0.74);
    text('BRIDGE BITE', W / 2, 26, { size: 16, align: 'center', color: C.gold, shadow: C.coral, shadowOff: 2 });
    text('60 SECONDS ON THE BRIDGE', W / 2, 58, { align: 'center' });

    // fish values
    ctx.drawImage(SPR.minnow, 46, 80);  text('10', 60, 84);
    ctx.drawImage(SPR.bass, 112, 78);   text('25', 126, 84);
    ctx.drawImage(SPR.koi, 178, 77);    text('100', 192, 84, { color: C.gold });

    // junk
    ctx.drawImage(SPR.boot, 112, 108);
    ctx.drawImage(SPR.can, 146, 109);
    ctx.drawImage(SPR.tire, 174, 108);
    text('JUNK JAMS YOUR ROD. MASH SPACE.', W / 2, 128, { align: 'center', color: C.coral });

    text('LEFT RIGHT  AIM THE ROD', W / 2, 156, { align: 'center' });
    text('SPACE  CAST AND REEL', W / 2, 170, { align: 'center' });
    text('CATCH 3 FISH IN A ROW FOR X2', W / 2, 184, { align: 'center', color: C.mint });

    if (Math.floor(clock * 2) % 2 === 0) text('PRESS SPACE', W / 2, 212, { align: 'center', color: C.gold });
  }

  function drawOver() {
    dim(0.78);
    text('TIME UP', W / 2, 36, { size: 16, align: 'center', color: C.coral, shadow: C.ink, shadowOff: 2 });
    text('SCORE ' + pad5(score), W / 2, 84, { align: 'center', color: C.gold });
    text('FISH ' + fishCount + '   JUNK ' + junkCount, W / 2, 106, { align: 'center' });
    text('BEST ' + pad5(best), W / 2, 126, { align: 'center' });
    if (newBest && Math.floor(clock * 3) % 2 === 0) text('NEW BEST!', W / 2, 150, { align: 'center', color: C.mint });

    let rank = 'JUNK COLLECTOR';
    if (score >= 250) rank = 'BEGINNER';
    if (score >= 500) rank = 'FISHERMAN';
    if (score >= 1000) rank = 'FISH MASTER';
    text('RANK: ' + rank, W / 2, 166, { align: 'center', color: C.mint });

    if (overT > 0.7 && Math.floor(clock * 2) % 2 === 0) text('SPACE TO FISH AGAIN', W / 2, 196, { align: 'center', color: C.gold });
  }

  function drawPause() {
    dim(0.6);
    text('PAUSED', W / 2, 108, { size: 16, align: 'center', color: C.gold, shadow: C.coral, shadowOff: 2 });
    text('PRESS P OR SPACE', W / 2, 140, { align: 'center' });
  }

  function render() {
    ctx.save();
    if (shake > 0 && !REDUCED) {
      ctx.translate(Math.round(rand(-2, 2)), Math.round(rand(-2, 2)));
    }

    drawWater();
    drawBanks();
    drawAimGuide();
    drawObjs();
    drawRipples();
    drawParticles();
    drawDeck();
    drawPlayer();
    drawRailing();
    drawRod();
    drawLineAndHook();
    drawTangleUI();
    drawPopups();
    ctx.restore();

    const night = Math.min(elapsed / ROUND_TIME, 1) * 0.55;
    ctx.fillStyle = 'rgba(10, 5, 40, ' + night + ')';
    ctx.fillRect(0, 0, W, H);

    if (flash > 0) {
      ctx.fillStyle = 'rgba(255, 210, 63, ' + flash + ')';
      ctx.fillRect(0, 0, W, H);
    }

    drawHUD();

    if (mode === 'title') drawTitle();
    else if (mode === 'over') drawOver();
    else if (mode === 'pause') drawPause();
  }

  // ---------- main loop ----------
  let last = 0;
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (mode === 'play') {
      updateWorld(dt);
      updatePlay(dt);
      updateMusic(dt);
    } else if (mode === 'title') {
      updateWorld(dt);
    } else if (mode === 'over') {
      overT += dt;
      updateWorld(dt);
    }
    render();
    requestAnimationFrame(loop);
  }

  // ---------- input ----------
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };

  window.addEventListener('keydown', e => {
    if (KEYMAP[e.code]) {
      held[KEYMAP[e.code]] = true;
      e.preventDefault();
    } else if (['Space', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.code)) {
      e.preventDefault();
      if (!e.repeat) action();
    } else if (e.code === 'KeyM') {
      muted = !muted;
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      togglePause();
    }
  });

  window.addEventListener('keyup', e => {
    if (KEYMAP[e.code]) held[KEYMAP[e.code]] = false;
  });

  window.addEventListener('blur', () => {
    held.left = held.right = false;
    if (mode === 'play') mode = 'pause';
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'play') mode = 'pause';
  });

  canvas.addEventListener('pointerdown', () => {
    if (mode === 'title' || mode === 'over' || mode === 'pause') action();
  });

  // on-screen buttons for phones
  document.querySelectorAll('[data-key]').forEach(btn => {
    const k = btn.dataset.key;
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
      btn.classList.add('is-down');
      if (k === 'cast') action(); else held[k] = true;
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => {
      btn.addEventListener(ev, () => {
        btn.classList.remove('is-down');
        if (k !== 'cast') held[k] = false;
      });
    });
  });

  // ---------- go ----------
  resetRound();

  // wait a moment for the pixel font, but never block on it
  const fontReady = (document.fonts && document.fonts.load)
    ? document.fonts.load('16px "Press Start 2P"')
    : Promise.resolve();
  Promise.race([fontReady, new Promise(r => setTimeout(r, 1500))])
    .catch(() => {})
    .then(() => {
      last = performance.now();
      requestAnimationFrame(loop);
    });
})();
