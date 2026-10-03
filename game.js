"use strict";
const particlePool = [];                      // recycle bin for dead particles (see burst())
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let CW = 0, CH = 0, DPR = 1;
// Adaptive quality: phones render 2-3x more pixels than needed, and canvas glow (shadowBlur) is
// very costly on mobile GPUs. Start capped and step down automatically if frames run slow.
const QUALITY_STEPS = [{dpr:1.5, glow:1}, {dpr:1.25, glow:0.5}, {dpr:1, glow:0}];
let qLevel = 0, dprCap = QUALITY_STEPS[0].dpr, glowK = 1;
const _sbDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', {
    get(){ return _sbDesc.get.call(this); },
    set(v){ _sbDesc.set.call(this, v * glowK); }
});
const SIDEBAR = 34;                           // right-hand progress rail (screen px) — defined before the first resize()
// The WORLD is always WORLD_W wide, on every device — so every track, tower and level is
// identical for everyone. The view scales it uniformly to fit the screen (capped, and
// centred on very wide screens) instead of stretching the world to the screen.
let WORLD_W = 356;
let VIEW_K = 1, VIEW_OX = 0, VH = 0;                 // scale, x-offset, visible world height

function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, dprCap);
    CW = window.innerWidth; CH = window.innerHeight;
    const avail = CW - SIDEBAR;
    VIEW_K = Math.max(0.6, Math.min(1.3, avail / WORLD_W));
    VIEW_OX = Math.max(0, (avail - WORLD_W * VIEW_K) / 2);
    VH = CH / VIEW_K;
    canvas.width = Math.round(CW * DPR);
    canvas.height = Math.round(CH * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

/* ---------- Constants ---------- */
const PLAY_W = () => WORLD_W;                  // world units (identical on every device)
const SCREEN_PW = () => CW - SIDEBAR;           // screen pixels of the play area (for overlays)


// One shared pool of realistic player handles — standard and human-profile bots use the
// SAME style of name, because in a real lobby every "player" would. The behavior split
// (hesitation, aim quirks, no rubber-banding) is invisible; the naming must be too.
// A large, internationally varied pool of realistic-looking usernames — the kind you'd
// actually see on a mobile leaderboard or Discord: first name + numbers, dotted/underscored
// handles, the odd xX...Xx or misspelled-on-purpose one, across several languages so it
// doesn't read as one generated batch. No two bots in a race repeat, so it holds up.

// Bot difficulty presets. skill affects aim accuracy; think affects reaction speed;
// errMul scales the random aim error. Higher skill + lower think = tougher bots.
// Fixed bot competence — there's no difficulty picker anymore. This sits close to the
// old "hard" tier: bots are genuinely good, but never robotic or unbeatable.
const BOT_BASE = { aimX:78, aimY:58, thinkMin:0.62, thinkMax:1.05, reach:460 };   // a touch slower to react, but more accurate
let botDifficulty = null; // unused, kept only so any stray reference below doesn't crash
const PCOL = ["#35e0c8","#ff5470","#ffcf3f","#7c6bff"];

const PLAT = {
    normal:  "#4ade80",
    moving:  "#7c6bff",
    ice:     "#cfe9ff",
    fragile: "#ff9838",
    safety:  "#5b8def",
    boost:   "#35e0c8",
    finish:  "#ffffff"
};

/* ---------- State ---------- */
let state = 'menu';            // menu, countdown, playing, finished
let last = 0, cameraY = 0, camShake = 0;
let hapticsOn = true; try { hapticsOn = localStorage.getItem('rr_haptics') !== '0'; } catch(e){}
function haptic(p){ if (hapticsOn){ try { navigator.vibrate && navigator.vibrate(p); } catch(e){} } }
let platforms = [], players = [], particles = [], floaters = [];
let finishPlatform = null;
let ufos = [];                // active UFO abductions (and ones flying away)   // cached finish platform for this race, found by type not array index
let itemBoxes = [], shots = [], shockwaves = [], timeScale = 1, slowMoBudget = 1.8;
let windParticles = [];
let matchStart = 0, finishedCount = 0;
let hintTimer = 4;

/* input */
let dragging = false, sx=0, sy=0, cx=0, cy=0;

/* ---------- DOM ---------- */
const S = {
    start: document.getElementById('s-start'),
    lobby: document.getElementById('s-lobby'),
    results: document.getElementById('s-results'),
    pause: document.getElementById('s-pause'),
    over: document.getElementById('s-over'),
    pk: document.getElementById('s-pk'),
    summit: document.getElementById('s-summit'),
    levels: document.getElementById('s-levels'),
    lvdone: document.getElementById('s-lvdone'),
    pass: document.getElementById('s-pass'),
    settings: document.getElementById('s-settings'),
};
const hud = document.getElementById('hud');
const countdownEl = document.getElementById('countdown');
const posNum = document.getElementById('pos-num');
const hintEl = document.getElementById('hint');

let screenTransition = 0;
function showScreen(name) {
    { const fm = document.getElementById('finish-menu'); if (fm) fm.style.display = 'none'; }   // only shown right after you finish
    const transition = ++screenTransition;
    if (typeof SFX !== 'undefined' && SFX.music){
        if (name === 'start') SFX.music.set('menu');
    }
    ['start','lobby','results','pause','over','pk','summit','levels','lvdone','pass','settings','streak'].forEach(k => {
        const el = S[k];
        if (k === name) {
            el.style.display = 'flex';
            requestAnimationFrame(() => { el.style.opacity = 1; });
        } else {
            el.style.opacity = 0;
            setTimeout(() => { if (transition === screenTransition && S[name] !== el) el.style.display = 'none'; }, 360);
        }
    });
}

/* ---------- Particles / floaters ---------- */
function burst(cx, cy, color, count, speed) {
    if (particles.length > 400) return;
    if (gameMode === 'gauntlet'){ if (cy < cameraY - 400 || cy > cameraY + VH + 400) return; count = Math.ceil(count * 0.6); }
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = Math.random() * speed;
        const vx = Math.cos(angle) * spd;
        const vy = Math.sin(angle) * spd;
        const decay = 0.5 + Math.random() * 1.5;
        const s = 2 + Math.random() * 4;

        // OPTIMALISATIE: Recycle dode deeltjes als ze beschikbaar zijn
        if (particlePool.length > 0) {
            const p = particlePool.pop();
            p.x = cx; p.y = cy; p.vx = vx; p.vy = vy;
            p.life = 1; p.decay = decay; p.color = color; p.size = s;
            particles.push(p);
        } else {
            // Alleen een nieuw object maken als de pool helemaal leeg is
            particles.push({ x: cx, y: cy, vx, vy, life: 1, decay, color, size: s });
        }
    }
}
function floatText(){}   // on-screen pop-up words were removed on purpose; icons and sound carry the feedback

// Angular, rotating debris — reads as broken stone/ice, distinct from the round spark
// particles used everywhere else. A ceiling shattering is a one-time, memorable event.
let shardParticles = [];
/* =====================================================================
   SFX — tiny synthesized sounds (Web Audio, no files needed)
   ===================================================================== */
const SFX = (() => {
    let ac = null, comp = null, sfxBus = null, musBus = null, verbIn = null, dly = null, duck = null, noiseBuf = null, muted = false;
    let sfxVol = 0.5, musVol = 0.5, lastBump = 0;
    try { muted = localStorage.getItem('rr_mute') === '1'; } catch(e){}
    try { const v = localStorage.getItem('rr_sfxvol'); if (v !== null) sfxVol = Math.max(0, Math.min(1, +v)); } catch(e){}
    try { const v = localStorage.getItem('rr_musvol'); if (v !== null) musVol = Math.max(0, Math.min(1, +v)); } catch(e){}
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    let active = 0;   // sound sources currently playing: lets us cap the load so the audio thread never chokes
    function track(n){ active++; n.onended = () => { active--; }; }

    function ctx(){
        if (!ac){
            const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
            if (!AC) return null;
            try { ac = new AC({ latencyHint: 'interactive' }); } catch(e){ ac = new AC(); }
            // master chain: everything -> compressor -> out
            // Master chain with ZERO added latency: a static gain into a soft clipper that only rounds off
            // the very loudest peaks. (A DynamicsCompressor here added ~9 ms of built-in lookahead delay to
            // every single sound, which is exactly the "sound comes a beat late" feeling.)
            comp = ac.createGain(); comp.gain.value = 1.6;
            try {
                const shaper = ac.createWaveShaper(), cv = new Float32Array(4096);
                for (let i = 0; i < 4096; i++){ const x = i/2047.5 - 1, a = Math.abs(x); cv[i] = a < 0.6 ? x : Math.sign(x) * (0.6 + 0.4*Math.tanh((a - 0.6)/0.4)); }
                shaper.curve = cv; shaper.oversample = 'none';
                const out = ac.createGain(); out.gain.value = 0.95; comp.connect(shaper); shaper.connect(out); out.connect(ac.destination);
            } catch(e){ comp.connect(ac.destination); }
            sfxBus = ac.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(comp);
            musBus = ac.createGain(); musBus.gain.value = 0.0001; musBus.connect(comp);
            duck = ac.createGain(); duck.gain.value = 1; duck.connect(musBus);          // sidechain "pump" for the music
            // reverb: generated impulse response
            try {
                const len = Math.floor(ac.sampleRate * 0.8), ir = ac.createBuffer(1, len, ac.sampleRate);
                const d = ir.getChannelData(0); for (let i = 0; i < len; i++){ const x = 1 - i/len; d[i] = (Math.random()*2 - 1) * x*x*x; }
                const verb = ac.createConvolver(); verb.buffer = ir;
                verbIn = ac.createGain(); verbIn.gain.value = 1; const vOut = ac.createGain(); vOut.gain.value = 0.32;
                verbIn.connect(verb); verb.connect(vOut); vOut.connect(comp);
            } catch(e){ verbIn = comp; }
            // music echo (dotted eighth-ish), fed from music voices
            try {
                dly = ac.createDelay(1.0); dly.delayTime.value = 0.32;
                const fb = ac.createGain(); fb.gain.value = 0.32; const dOut = ac.createGain(); dOut.gain.value = 0.28;
                const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
                dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(dOut); dOut.connect(musBus);
            } catch(e){ dly = null; }
            const n = Math.floor(ac.sampleRate * 1.5); noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
            const nd = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) nd[i] = Math.random()*2 - 1;
        }
        if (ac.state !== 'running'){ try { const r = ac.resume(); if (r && r.catch) r.catch(() => {}); } catch(e){} }
        return ac;
    }
    function send(g, amt, target){ if (!amt || !target) return; const s = ac.createGain(); s.gain.value = amt; g.connect(s); s.connect(target); }
    function envelope(g, t0, peak, a, dur, rel, hold){
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + a);
        if (hold) g.gain.setValueAtTime(peak * hold, t0 + a + 0.001);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + rel);
    }
    // one synth voice: oscillator(s) -> optional filter sweep -> envelope -> bus (+ reverb/echo sends)
    function voice(o){
        const A = ctx(); if (!A) return;
        const isMus = o.bus === 'mus'; if (!isMus && muted) return;
        const t0 = (o.when !== undefined ? o.when : A.currentTime) + (o.at || 0), dur = o.t || 0.2, rel = o.r || 0.06;
        const g = A.createGain();
        let head = g;
        if (o.filter){
            const f = A.createBiquadFilter(); f.type = o.filter.type || 'lowpass'; f.Q.value = o.filter.q || 0.8;
            f.frequency.setValueAtTime(o.filter.f, t0);
            if (o.filter.f2) f.frequency.exponentialRampToValueAtTime(o.filter.f2, t0 + (o.filter.time || dur));
            f.connect(g); head = f;
        }
        const detunes = o.unison ? [-o.unison, o.unison] : [0];
        for (const dt of detunes){
            const osc = A.createOscillator(); osc.type = o.type || 'sine';
            osc.frequency.setValueAtTime(o.f, t0); if (osc.detune) osc.detune.value = dt;
            if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.glide || dur));
            if (o.vib){ const l = A.createOscillator(), lg = A.createGain(); l.frequency.value = o.vibRate || 6; lg.gain.value = o.vib; l.connect(lg); lg.connect(osc.frequency); track(l); l.start(t0); l.stop(t0 + dur + rel + 0.02); }
            osc.connect(head); track(osc); osc.start(t0); osc.stop(t0 + dur + rel + 0.02);
        }
        envelope(g, t0, (o.v || 0.2) / detunes.length, o.a || 0.004, dur, rel, o.hold);
        g.connect(isMus ? (o.duck ? duck : musBus) : sfxBus);
        if (!isMus) send(g, o.verb, verbIn); if (isMus) send(g, o.echo, dly);
    }
    function noise(o){
        const A = ctx(); if (!A) return;
        const isMus = o.bus === 'mus'; if (!isMus && muted) return;
        const t0 = (o.when !== undefined ? o.when : A.currentTime) + (o.at || 0), dur = o.t || 0.2;
        const src = A.createBufferSource(); src.buffer = noiseBuf;
        const f = A.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q || 0.8;
        f.frequency.setValueAtTime(o.f || 1200, t0); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
        const g = A.createGain(); envelope(g, t0, o.v || 0.2, o.a || 0.003, dur, o.r || 0.04);
        src.connect(f); f.connect(g); g.connect(isMus ? musBus : sfxBus); send(g, o.verb, verbIn);
        track(src); src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + (o.r || 0.04) + 0.02);
    }
    // Bell: FM for the shiny ones, or "lite" (one oscillator) for frequent/layered chimes — half the cost
    function bell(f, o = {}){
        const A = ctx(); if (!A || muted) return;
        const t0 = A.currentTime + (o.at || 0), dur = o.t || 0.5;
        const g = A.createGain(), car = A.createOscillator();
        g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(o.v || 0.15, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        if (o.lite){
            car.type = 'sine'; car.frequency.setValueAtTime(f * 1.012, t0); car.frequency.exponentialRampToValueAtTime(f, t0 + 0.05);
            car.connect(g); track(car);
            g.connect(sfxBus); send(g, o.verb === undefined ? 0.25 : o.verb, verbIn);
            car.start(t0); car.stop(t0 + dur + 0.02); return;
        }
        const mod = A.createOscillator(), mg = A.createGain();
        car.frequency.value = f; mod.frequency.value = f * (o.ratio || 3.5);
        mg.gain.setValueAtTime(f * (o.index || 2), t0); mg.gain.exponentialRampToValueAtTime(1, t0 + dur);
        mod.connect(mg); mg.connect(car.frequency); car.connect(g);
        g.connect(sfxBus); send(g, o.verb === undefined ? 0.3 : o.verb, verbIn);
        track(car); track(mod);
        car.start(t0); mod.start(t0); car.stop(t0 + dur + 0.02); mod.stop(t0 + dur + 0.02);
    }

    const P = {
        jump(k = 0.6){ voice({type:'triangle', f:220 + 160*k, f2:520 + 380*k, t:0.1, v:0.22, glide:0.08});
                       noise({f:900, f2:2600, t:0.07, v:0.06, q:0.6}); },
        boost(){ voice({type:'sawtooth', f:220, f2:880, t:0.25, v:0.12, filter:{f:600, f2:5000}, verb:0.2});
                 bell(1318.5, {at:0.08, t:0.4, v:0.08, lite:true}); noise({f:1500, f2:6000, t:0.25, v:0.08}); },
        land(){ voice({f:130, f2:55, t:0.09, v:0.3}); noise({type:'lowpass', f:1800, t:0.035, v:0.08}); },
        bump(){ const n = performance.now(); if (n - lastBump < 120) return; lastBump = n;
                voice({type:'square', f:170, f2:90, t:0.08, v:0.08, filter:{f:900}}); noise({f:500, t:0.05, v:0.1}); },
        pickup(){ [0, 4, 7].forEach((s, i) => bell(mtof(84 + s), {at: i*0.06, t: 0.4, v: 0.1, lite:true})); },
        item(){ voice({type:'sawtooth', f:330, f2:990, t:0.18, v:0.1, filter:{f:800, f2:4000}, verb:0.25}); },
        rocket(){ noise({f:300, f2:3500, t:0.55, v:0.3, q:0.7, verb:0.15});
                  voice({type:'sawtooth', f:80, f2:520, t:0.5, v:0.16, filter:{f:300, f2:3000}});
                  voice({f:60, f2:40, t:0.3, v:0.25}); },
        giant(){ voice({type:'square', f:70, f2:210, t:0.55, v:0.15, filter:{f:200, f2:1600}, verb:0.2});
                 voice({f:55, f2:40, t:0.5, v:0.28}); bell(262, {at:0.35, t:0.6, v:0.07, lite:true}); },
        bounce(){ [0, 0.14].forEach((d, i) => voice({type:'triangle', f:190 + i*80, f2:720 + i*260, t:0.11, v:0.17, at:d, vib:30, vibRate:22})); },
        chain(){ [0, 0.06, 0.13].forEach((d, i) => bell(1600 + i*230, {at:d, t:0.16, v:0.065, ratio:2.76, index:4, verb:0.1}));
                 noise({type:'highpass', f:4000, t:0.3, v:0.06}); },
        quake(){ noise({type:'lowpass', f:400, f2:90, t:0.9, v:0.35, q:1.2, verb:0.2});
                 voice({type:'sawtooth', f:55, f2:30, t:0.8, v:0.16, filter:{f:240}}); voice({f:48, f2:32, t:0.7, v:0.3}); },
        shield(){ P.pop(); [0, 7, 12].forEach((s, i) => voice({f:mtof(67 + s), t:0.55, v:0.075, a:0.06, at:i*0.03, verb:0.45})); },
        block(){ bell(2093, {t:0.35, v:0.1, ratio:2, index:1.5, verb:0.35}); },
        wind(){ P.pop(); noise({f:400, f2:1800, t:0.9, v:0.18, q:2.5, a:0.25, verb:0.3}); noise({f:900, f2:500, t:0.7, v:0.08, q:3, at:0.2}); },
        ufo(){ P.pop(); voice({f:520, f2:880, t:1.5, v:0.12, a:0.1, vib:45, vibRate:9, glide:1.3, verb:0.35});
               voice({type:'sawtooth', f:110, t:1.4, v:0.05, a:0.2, filter:{f:500}}); },
        coin(){ bell(1975.5, {t:0.12, v:0.11, verb:0.12, lite:true}); bell(2637, {at:0.06, t:0.35, v:0.12, ratio:2, index:1.2, verb:0.2}); },
        combo(){ [0, 4, 7, 12].forEach((s, i) => bell(mtof(79 + s), {at: i*0.045, t:0.28, v:0.075, lite:true})); },
        fall(){ voice({type:'sine', f:900, f2:180, t:0.55, v:0.14, vib:14, vibRate:7, glide:0.55}); },
        stumble(){ voice({f:120, f2:45, t:0.25, v:0.3}); noise({type:'lowpass', f:900, t:0.25, v:0.2});
                   voice({type:'sawtooth', f:400, f2:120, t:0.35, v:0.08, filter:{f:1200}}); },
        fail(){ [64, 63, 62, 59].forEach((m, i) => voice({type:'sawtooth', f:mtof(m-12), t: i === 3 ? 0.6 : 0.22, v:0.1, at:i*0.24, filter:{f:900}, verb:0.2})); },
        count(){ voice({type:'square', f:660, t:0.09, v:0.07, filter:{f:2500}}); },
        pop(){ voice({type:'sine', f:1500, f2:700, t:0.04, v:0.11, a:0.001, r:0.02}); },
        go(){ [0, 4, 7].forEach(s => voice({type:'sawtooth', f:mtof(72 + s), t:0.35, v:0.075, filter:{f:3000}, verb:0.3})); },
        finish(){ [[72,0],[76,0.09],[79,0.18],[84,0.27]].forEach(([m,d]) => voice({type:'sawtooth', f:mtof(m), t:0.3, v:0.08, at:d, filter:{f:2800}, verb:0.35}));
                  [60, 64, 67].forEach(m => voice({type:'triangle', f:mtof(m), t:0.9, v:0.05, at:0.36, a:0.02, verb:0.5}));
                  bell(2093, {at:0.36, t:0.9, v:0.08, lite:true}); },
        shatter(){ noise({type:'highpass', f:3000, t:0.3, v:0.25, verb:0.2});
                   for (let i = 0; i < 3; i++) bell(2500 + Math.random()*3000, {at: i*0.03, t:0.22, v:0.04, ratio:1.41, index:3, verb:0.2}); },
        star(i = 0){ bell(mtof(79 + [0, 4, 7][i % 3]), {t:0.5, v:0.1}); },
    };
    // Spammy sounds get a minimum gap; when the audio thread is busy only the important ones still play.
    const COOLDOWN = { coin:45, land:70, pickup:90, item:70, combo:120, shatter:150, chain:200, block:200, jump:40 };
    const CRITICAL = new Set(['jump','land','finish','go','count','fail','boost','stumble']);
    const lastPlay = {};

    /* ---- music: step sequencer (16th notes), 4-bar songs with drums, bass, chords, arp and lead ---- */
    const TRACKS = {
        menu: { bpm: 86, swing: 0.16,
            chords: [[57,60,64,67],[53,57,60,64],[48,52,55,59],[55,59,62,64]],     // Am7 · Fmaj7 · Cmaj7 · G6
            roots:  [45, 41, 48, 43],
            kick:  'x.........x.....', snare: '....x.......x...', hat: '..x...x...x...x.',
            bass:  'x.........x.....',
            lead: [76,null,null,72,null,null,74,null,76,null,null,null,79,null,76,null,
                   77,null,null,76,null,null,72,null,null,null,69,null,null,null,null,null,
                   72,null,null,74,null,null,76,null,79,null,null,77,null,76,null,74,
                   74,null,null,null,71,null,72,null,74,null,null,null,null,null,null,null],
            pad: 'rhodes' },
        race: { bpm: 138, swing: 0.02,
            chords: [[64,67,71],[60,64,67],[67,71,74],[62,66,69]],                   // Em · C · G · D
            roots:  [40, 36, 43, 38],
            kick:  'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
            bass:  '.x.x.x.x.x.x.x.x',
            lead: [76,null,79,null,83,null,81,79,null,76,null,74,76,null,null,null,
                   72,null,76,null,79,null,77,76,null,72,null,71,72,null,null,null,
                   79,null,83,null,86,null,83,81,null,79,null,78,79,null,null,null,
                   78,null,76,null,74,null,76,78,null,81,null,79,78,null,74,null],
            pad: 'saw' },
    };
    const MUSIC = (() => {
        let musicOn = true; try { musicOn = localStorage.getItem('rr_music') !== '0'; } catch(e){}
        let cur = null, timer = null, step = 0, nextTime = 0;
        function drum(kind, w, T){
            if (kind === 'k'){ voice({bus:'mus', when:w, f:150, f2:42, glide:0.12, t:0.28, v: T.pad === 'saw' ? 0.55 : 0.4});
                if (T.pad === 'saw'){ duck.gain.cancelScheduledValues(w); duck.gain.setValueAtTime(0.35, w); duck.gain.linearRampToValueAtTime(1, w + 0.2); } }
            if (kind === 's'){ noise({bus:'mus', when:w, f:1900, t:0.14, v: T.pad === 'saw' ? 0.22 : 0.12, q:0.7}); voice({bus:'mus', when:w, type:'triangle', f:200, f2:150, t:0.08, v:0.1}); }
            if (kind === 'h'){ noise({bus:'mus', when:w, type:'highpass', f:7500, t:0.035, v: T.pad === 'saw' ? 0.07 : 0.05}); }
        }
        function schedule(){
            const A = ctx(); if (!A || !cur) return;
            const T = TRACKS[cur], s16 = 60 / T.bpm / 4;
            while (nextTime < A.currentTime + 0.35){
                const i = step % 16, bar = Math.floor(step / 16) % 4;
                const w = nextTime + (i % 2 === 1 ? T.swing * s16 : 0);
                if (T.kick[i] === 'x') drum('k', w, T);
                if (T.snare[i] === 'x') drum('s', w, T);
                if (T.hat[i] === 'x') drum('h', w, T);
                const root = T.roots[bar], ch = T.chords[bar];
                if (T.bass[i] === 'x'){
                    const oct = (T.pad === 'saw' && i % 4 === 3) ? 12 : 0;
                    voice({bus:'mus', duck:true, when:w, type: T.pad === 'saw' ? 'sawtooth' : 'triangle', unison: 0,
                           f: mtof(root + oct), t: T.pad === 'saw' ? s16*1.6 : s16*8, v: T.pad === 'saw' ? 0.16 : 0.22,
                           filter: T.pad === 'saw' ? {f:1400, f2:300, time:s16*1.5, q:3} : {f:700} });
                }
                if (i === 0){                                            // chord pad at the top of each bar
                    ch.forEach(m => T.pad === 'saw'
                        ? voice({bus:'mus', duck:true, when:w, type:'sawtooth', unison:0, f:mtof(m), t:s16*15, v:0.045, a:0.05})
                        : voice({bus:'mus', when:w, type:'sine', f:mtof(m), t:s16*14, v:0.07, a:0.02, vib:2.5, vibRate:5, verb:0.35}));
                    if (T.pad !== 'saw') ch.forEach(m => voice({bus:'mus', when:w, type:'triangle', f:mtof(m+12), t:s16*3, v:0.025, verb:0.3}));
                }
                if (T.pad === 'saw' && i % 4 === 2){                   // driving arp in the race track
                    const m = ch[(Math.floor(i / 2)) % ch.length] + 12;
                    voice({bus:'mus', when:w, type:'square', f:mtof(m), t:s16*0.9, v:0.03, echo:0.5});
                }
                const note = T.lead[step % 64];
                if (note) voice({bus:'mus', when:w, type: T.pad === 'saw' ? 'sawtooth' : 'triangle', unison: 0,
                                 f: mtof(note), t: s16*1.7, v: T.pad === 'saw' ? 0.06 : 0.09,
                                 echo:0.45, vib: T.pad === 'saw' ? 0 : 3});
                step++; nextTime += s16;
            }
        }
        function level(to){ const A = ctx(); if (!A) return; const g = musBus.gain;
            try { g.cancelScheduledValues(A.currentTime); } catch(e){}
            g.setValueAtTime(Math.max(0.0001, g.value), A.currentTime); g.linearRampToValueAtTime(Math.max(0.0001, to), A.currentTime + 0.6); }
        return {
            get on(){ return musicOn; },
            set(track){
                if (true){ this.stop(); return; }   // background music disabled for now (kept for later; a real audio file can go here)
                if (!musicOn || muted || track === null){ this.stop(); return; }
                const A = ctx(); if (!A) return;
                if (cur === track && timer) return;
                cur = track; step = 0; nextTime = A.currentTime + 0.1;
                level(musVol * 0.6);
                if (!timer) timer = setInterval(schedule, 90);
                schedule();
            },
            stop(){ if (timer){ clearInterval(timer); timer = null; } cur = null; if (musBus) level(0); },
            setVol(v){ if (cur && musBus) level(v * 0.6); },
            toggle(){ musicOn = !musicOn; try { localStorage.setItem('rr_music', musicOn ? '1' : '0'); } catch(e){}
                if (!musicOn) this.stop(); return musicOn; }
        };
    })();

    return {
        play(name, arg){ try {
            const now = performance.now(), cd = COOLDOWN[name] || 0;
            if (cd && now - (lastPlay[name] || -1e9) < cd) return;
            if (active > 36 && !CRITICAL.has(name)) return;
            lastPlay[name] = now;
            if (P[name]) P[name](arg);
        } catch(e){} },
        toggle(){ muted = !muted; try { localStorage.setItem('rr_mute', muted ? '1' : '0'); } catch(e){} return muted; },
        get muted(){ return muted; },
        setMuted(v){ muted = !!v; try { localStorage.setItem('rr_mute', muted ? '1' : '0'); } catch(e){} },
        get sfxVol(){ return sfxVol; },
        get musVol(){ return musVol; },
        setSfxVol(v){ sfxVol = Math.max(0, Math.min(1, v)); try { localStorage.setItem('rr_sfxvol', sfxVol); } catch(e){} if (sfxBus){ try { sfxBus.gain.setTargetAtTime(sfxVol, ac.currentTime, 0.02); } catch(e){ sfxBus.gain.value = sfxVol; } } },
        setMusVol(v){ musVol = Math.max(0, Math.min(1, v)); try { localStorage.setItem('rr_musvol', musVol); } catch(e){} MUSIC.setVol(musVol); },
        unlock(){ try { ctx(); } catch(e){} },
        music: MUSIC,
    };
})();
if (typeof window !== 'undefined' && window.addEventListener){
    // Browsers won't let audio play until the first user gesture, so the very first tap or
    // key press unlocks the engine and kicks off the music for wherever you are.
    let kicked = false;
    const unlockOnce = () => {
        SFX.unlock();
        if (!kicked){
            kicked = true;
            try { SFX.music.set((typeof state !== 'undefined' && state !== 'menu') ? 'race' : 'menu'); } catch(e){}
        }
    };
    window.addEventListener('pointerdown', unlockOnce, { passive: true });
    window.addEventListener('keydown', unlockOnce);
    window.addEventListener('touchend', unlockOnce, { passive: true });
    window.addEventListener('click', unlockOnce);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) SFX.unlock(); });
}

function shatterCeiling(x, y, w){
    if (y > cameraY - 60 && y < cameraY + VH + 60) SFX.play('shatter');   // only when it happens on screen
    const n = Math.max(10, Math.min(22, Math.round(w/9)));
    for (let i=0;i<n;i++){
        const sx = x + rnd(-w/2, w/2);
        shardParticles.push({
            x: sx, y: y + rnd(-3,3),
            vx: rnd(-90,90) + (sx-x)*1.4, vy: rnd(-260,-60),
            rot: rnd(0, 6.3), rotV: rnd(-9,9),
            w: rnd(5,13), h: rnd(4,10),
            life: 1, decay: rnd(0.55,0.85),
            color: Math.random()<0.5 ? '#8a93a8' : '#5b6272'
        });
    }
    { const maxS = [140, 80, 40][qLevel]; if (shardParticles.length > maxS) shardParticles.splice(0, shardParticles.length-maxS); }
    ring(x, y, '#c9d1e3', 60, true);
    burst(x, y, '#eef2f8', 10, 160);
}
function updateShards(dt){
    const g = 2100;
    let k = 0;
    for (let i = 0; i < shardParticles.length; i++){
        const s = shardParticles[i];
        s.vy += g*dt; s.x += s.vx*dt; s.y += s.vy*dt; s.rot += s.rotV*dt;
        s.life -= s.decay*dt;
        if (s.life > 0) shardParticles[k++] = s;
    }
    shardParticles.length = k;
}

function drawShards(){
    for (const s of shardParticles){
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, s.life));
        ctx.translate(s.x, s.y); ctx.rotate(s.rot);
        ctx.fillStyle = s.color;
        ctx.fillRect(-s.w/2, -s.h/2, s.w, s.h);
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

/* ---------- Level gen ---------- */
function rnd(a,b){ return a + Math.random()*(b-a); }

// The race track is built from a SEED: the same seed always produces the exact same course,
// on every device (the world is fixed-width). For multiplayer the host just shares the seed.
let raceSeed = 0, matchSeed = 0;
function generateLevel(seed){
    raceSeed = (seed === undefined) ? ((Math.random() * 4294967296) >>> 0) : (seed >>> 0);
    const realRandom = Math.random;
    Math.random = pkRng(raceSeed);             // everything the track builder rolls comes from the seed…
    try { generateLevelTrack(); }
    finally { Math.random = realRandom; }      // …and gameplay randomness goes straight back to normal
}
function generateLevelTrack() {
    platforms = []; itemBoxes = []; finishPlatform = null; ufos = [];
    const pw = PLAY_W();
    // ground
    platforms.push({x:pw/2,y:START_Y,w:pw,h:40,type:'normal',active:true,ground:true});

    let y = START_Y - 170;
    let lastX = pw/2;
    let row = 0;
    const ceilingCandidates = [];   // platforms eligible for a ceiling, filled in below
    while (y > FINISH_Y + 300) {
        const diff = 1 - ((y - FINISH_Y) / TRACK);   // 0..1
        // Smaller vertical gaps = easier, less chance of one long fall
        const gap = 120 + rnd(0,45) + diff*55;

        // Wider platforms overall, shrink more gently with difficulty
        let width = 145 - diff*55 + rnd(0,25);
        if (width < 60) width = 60;

        const r = Math.random();
        let type = 'normal', speed=0, dir=1;

        if (r < 0.12 + diff*0.04)            { type='boost'; width=Math.max(width,70); }
        else if (r < 0.26 + diff*0.14)       { type='fragile'; }
        else if (r < 0.50 + diff*0.16)       { type='moving'; speed=rnd(60,120)+diff*70; dir=Math.random()<.5?1:-1; }
        else if (r < 0.70 + diff*0.10)       { type='ice'; }

        // Keep platforms reachable: modest horizontal shift from previous
        const maxShift = 120 + diff*45;
        let half = width/2;
        let x = lastX + rnd(-maxShift, maxShift);
        x = Math.max(half+6, Math.min(pw - half - 6, x));

        // Moving range: how far it slides each way, clamped to play area
        let range = 0, baseX = x;
        if (type === 'moving') {
            range = rnd(50, 130);
            const minB = half + 6 + range;
            const maxB = pw - half - 6 - range;
            baseX = Math.max(minB, Math.min(maxB, x));
            x = baseX;
        }

        platforms.push({x,y,w:width,h:18,type,speed,dir,active:true,breaking:false,breakT:0,respawn:0,
                        baseX, range, boostReady:true});

        // CEILING candidate: eligible only when the previous platform sits far enough to the
        // side that reaching this one already requires an angled jump, never one from
        // directly beneath — so a ceiling here can never block the route bots or you need.
        // Actual assignment (3-12 per race) happens once the whole level is laid out.
        if (type === 'normal' || type === 'ice') {
            const prevPl = platforms[platforms.length-2];   // the platform just before the one we pushed above
            const prevW = prevPl ? prevPl.w : 100;
            const clearance = Math.abs(x - lastX) - Math.min(width, prevW)/2;
            if (clearance > 2) ceilingCandidates.push(platforms.length - 1);   // index of the platform we just pushed
        }

        // item box floating above roughly every 6th-7th platform (you grab it on the way up).
        // About 1 in 4 of these drifts side to side, like the purple platforms, for a bit of
        // timing risk instead of always being a free grab.
        if (row % 6 === 3 && type !== 'moving') {
            itemBoxes.push(makeBox(x, y - 9 - 44, Math.random() < 0.28));
        }

        // SAFETY FLOOR: every ~10 rows, a wide platform spanning 80-90% of the
        // field, so a long fall is caught within one "section" instead of dropping
        // all the way to the start.
        if (row > 0 && row % 10 === 0) {
            const fw = pw * rnd(0.80, 0.90);
            const fx = pw/2 + rnd(-1,1) * (pw - fw)/2 * 0.5;
            platforms.push({x:fx, y:y - gap*0.5, w:fw, h:20, type:'safety',
                            active:true, breaking:false, breakT:0, respawn:0, baseX:fx, range:0, boostReady:true});
            // Mario Kart style item row above every safety floor
            for (const f of [-0.28, 0.28]) itemBoxes.push(makeBox(fx + f*fw, y - gap*0.5 - 10 - 44));
        }

        lastX = x;
        y -= gap;
        row++;
    }
    // Guarantee a reachable approach to the finish: a wide, safe platform
    // a comfortable jump below it, centered.
    platforms.push({x:pw/2, y:FINISH_Y+180, w:pw*0.7, h:18, type:'normal',
                    active:true, breaking:false, breakT:0, respawn:0, baseX:pw/2, range:0, boostReady:true});
    // finish
    platforms.push({x:pw/2,y:FINISH_Y,w:pw,h:40,type:'finish',active:true});
    for (const pl of platforms){ pl.quakeWarn = 0; pl.quakeDown = 0; }

    // Assign ceilings to a random 3-12 of the eligible candidates (never more than exist).
    // In the rare layout that comes up short on eligible spots, we simply place fewer —
    // never loosening the safety condition just to hit the target count.
    const ceilingCount = Math.min(ceilingCandidates.length, Math.round(rnd(3, 12)));
    for (const idx of [...ceilingCandidates].sort(() => Math.random() - 0.5).slice(0, ceilingCount)) {
        platforms[idx].ceiling = true;
    }
}

// One player object. Shared by the 4-player race and the 32-player Gauntlet.
function makePlayer(o){
    const local = !!o.local;
    return {
        id:o.id, name:o.name, local,
        color:o.color,
        x:o.x, y:o.y,
        vx:0, vy:0, r:12,
        mode:'idle', plat: platforms[0],
        finished:false, finishTime:0,
        best: START_Y,            // highest point reached (min y)
        thinkT: o.thinkT === undefined ? 0.2 : o.thinkT,
        botType:o.botType || null, afk:!!o.afk, afkT: 0,
        look:o.look,
        trailSamples:[], trailEmit:0,
        skill:o.skill,
        errMul: local ? 0 : 1,
        hesitating: false, hesitateFor: 0, catchUpNext: false,
        fumbleBias: rnd(-1, 1),                // human-only: a personal lean (over- or under-shoots)
        charged:false, squash:1, botBestY:START_Y, stuckCount:0,
        item:null, itemState:null, itemRoll:0, itemDelay:0, itemHold:0,
        giantT:0, rv:0, bounceT:0, chainT:0, chainPts:null, chainBy:null, rocketFx:0, rocketTrail:null,
        quakePending:0, quakeDrop:0, quakeShakeT:0, shieldT:0, windT:0, windSeed:Math.random()*1000, windPushX:0, windDir:1
    };
}

function initPlayers() {
    players = []; finishedCount = 0;
    const pw = PLAY_W();
    // Use the SAME names shown in the lobby, in the same slot order.
    const names = (matchBotNames && matchBotNames.length===3)
        ? matchBotNames
        : [...BOT_NAMES].sort(()=>Math.random()-0.5).slice(0,3);
    // Sporadically, one of the three bots this race is a "human" profile (hesitation,
    // imperfect route choices, a believable name) instead of the clean "standard" AI.
    // Decided once in startMatchmaking so the lobby name and in-race behavior always
    // match; most races have no human-profile bot at all — see matchHumanSlot.
    const humanSlot = matchHumanSlot;
    for (let i=0;i<4;i++){
        const local = i===0;
        const botType = local ? null : (i === humanSlot ? 'human' : 'standard');
        const afk = !local && Math.random() < 0.01;   // 1%: this player just stands there... at first
        players.push(makePlayer({
            id:i, name: local?"YOU":names[i-1], local,
            color: local ? skinColor() : (PCOL[i] === skinColor() ? '#35e0c8' : PCOL[i]),
            x: pw/2 + (i-1.5)*46, y: START_Y - 30,
            botType, afk,
            look: local ? myLook() : randomBotLook(),
            skill: local ? 1 : rnd(0.82, 1.15) * newPlayerEase(),   // per-bot variation, easier for your first races
        }));
    }
}

/* ---------- Launch ---------- */
// A hard ceiling on how fast you can ever be launched upward. Individual abilities (Boost,
// Rocket, Super Bounce) are each tuned to feel right on their own, but stacking them — e.g.
// a charged Boost jump immediately followed by a Rocket — could add their velocities
// together into an absurd, unfair skip up the track. This clamp only ever kicks in on that
// kind of stack; it never touches a normal jump.
                            // boosted jump is never touched — only a jump THEN a Rocket stacked
                            // on top of it (which would otherwise reach ~3700) gets reined in
function capUpwardVelocity(p){
    if (p.vy < -MAX_UP_VEL) p.vy = -MAX_UP_VEL;
}
function launchPlayer(p, dx, dy) {
    const mult = playerPowMul(p, false);
    // Launch purely from the drag: don't inherit the moving platform's velocity,
    // otherwise the aim flips the instant the platform reverses at its limit.
    p.vx = dx * POWER * mult;
    p.vy = dy * POWER * mult;
    // WIND: someone hit you with a gust — your launch gets pushed the same way the wind blows.
    if (p.windT > 0){
        p.vx += p.windDir * WIND_AIM_ERR * rnd(0.5, 1);
    }
    p.mode = 'air';
    p.plat = null;
    const pull = Math.min(1, Math.hypot(dx, dy) / MAX_DRAG);
    p.squash = 1.22 + pull * 0.32;                       // stronger stretch for a harder pull
    if (p.local){ haptic(p.charged ? [14, 20, 22] : 8 + Math.round(pull * 10)); camShake = Math.max(camShake, 1 + pull * 2); }
    if (p.local) SFX.play(p.charged ? 'boost' : 'jump', Math.min(1, Math.hypot(dx, dy) / MAX_DRAG));
    if (p.charged) {
        burst(p.x, p.y, PLAT.boost, 22, 260);
    } else {
        burst(p.x, p.y, p.color, 12, 160);
    }
    p.charged = false;
    capUpwardVelocity(p);
}

/* ================= ABILITIES / ITEM BOXES ================= */

// Per-player physics modifiers (used by the game, the aim preview AND the bot solver)
function playerG(p){ return GRAVITY * (p.chainT > 0 ? CHAIN_GRAV : 1); }
function playerPowMul(p, air){
    let m = 1;
    if (p.charged && !air) m *= BOOST_MULT;
    if (p.chainT > 0) m *= CHAIN_POW;
        return m;
}
function playerMaxV(p, air){ return MAX_DRAG * POWER * playerPowMul(p, air); }
function easeOutBack(x){ const c1=1.70158, c3=c1+1; return 1 + c3*Math.pow(x-1,3) + c1*Math.pow(x-1,2); }

/* ---- Effects helpers ---- */
function ring(x, y, color, max, flat){ shockwaves.push({x, y, r:4, max, life:1, color, flat:!!flat}); }
// A bounce always sends you up at least this fast, so a soft landing never gives a weak,
// disappointing rebound — every bounce is a real launch while the ability is active.
function bounceVy(incomingVy){ return -Math.max(BOUNCE_MIN_VY, Math.min(BOUNCE_MAXV, incomingVy*BOUNCE_RESTITUTION)); }
function springFx(p, kind){
    const k = p.r/BASE_R;
    let rx = p.x, ry = p.y, flat = true;
    if (kind === 'wall'){ rx = p.x < PLAY_W()/2 ? p.x - p.r*0.2 : p.x + p.r*0.2; ry = p.y; flat = false; }
    else { ry = p.y + p.r; }
    ring(rx, ry, ITEMS.bounce.color, 42*k, flat);
    burst(rx, ry, ITEMS.bounce.color, 12, 200);
    p.squash = kind === 'wall' ? 1 : 1.3;
    if (p.local) camShake = Math.max(camShake, 3);
}
function updateShockwaves(dt){
    for (let i=shockwaves.length-1;i>=0;i--){
        const s = shockwaves[i];
        s.life -= dt*2.4;
        s.r += (s.max - s.r) * Math.min(1, dt*9);
        if (s.life <= 0) shockwaves.splice(i,1);
    }
}
/* ---- WIND visuals: streaking particles that all drift the SAME way, like real crosswind ---- */
function updateWindFx(dt){
    for (const p of players){
        if (!(p.windT > 0) || p.finished) continue;
        const crowd = gameMode === 'gauntlet';                               // 31 players can be hit at once: only draw streaks where they are seen
        if (crowd && (p.y < cameraY - 80 || p.y > cameraY + VH + 80 || windParticles.length > 90)) continue;
        if (Math.random() < dt*(crowd ? 7 : 16)){
            const dir = p.windDir;
            windParticles.push({
                x: p.x - dir*44, y: p.y + rnd(-26,26), vx: dir*rnd(280,440), vy: rnd(-8,8),
                life: 1, decay: rnd(1.5,2.2), len: rnd(16,30)
            });
        }
    }
    let k = 0;
    for (let i=0;i<windParticles.length;i++){
        const w = windParticles[i];
        w.x += w.vx*dt; w.y += w.vy*dt; w.life -= w.decay*dt;
        if (w.life > 0) windParticles[k++] = w;
    }
    windParticles.length = k;
}
function drawWindFx(){
    if (!windParticles.length) return;
    ctx.save(); ctx.lineCap='round';
    ctx.globalAlpha = 0.35; ctx.strokeStyle = ITEMS.wind.color; ctx.lineWidth = 2;
    ctx.beginPath();                                   // one path for every streak: a single stroke instead of one per particle
    for (const w of windParticles){
        if (w.y < cameraY-60 || w.y > cameraY+VH+60) continue;
        const dir = Math.sign(w.vx) || 1;
        ctx.moveTo(w.x, w.y); ctx.lineTo(w.x - dir*w.len, w.y);
    }
    ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
}
// A single soft edge-glow on the side the wind is coming FROM, plus a small arrow-cluster
// icon — reads instantly as "wind from this side" without cluttering the screen.
function drawWindOverlayForLocal(){
    const lp = players[0];
    if (!lp || !(lp.windT > 0)) return;
    const dir = lp.windDir;
    const alpha = Math.min(1, lp.windT/6) * 0.28;
    ctx.save();
    const grd = ctx.createLinearGradient(dir>0?0:CW, 0, dir>0?CW*0.35:CW*0.65, 0);
    grd.addColorStop(0, `rgba(143,214,255,${alpha})`); grd.addColorStop(1, 'rgba(143,214,255,0)');
    ctx.fillStyle = grd; ctx.fillRect(dir>0?0:CW*0.65, 0, CW*0.35, CH);
    ctx.restore();
}

function drawShockwaves(){
    for (const s of shockwaves){
        ctx.globalAlpha = Math.max(0, s.life) * 0.8;
        ctx.strokeStyle = s.color; ctx.lineWidth = 3*s.life + 0.5;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.flat ? s.r*0.3 : s.r, 0, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

/* ---- Item boxes ---- */
function makeBox(x, y, moving){
    const box = {x, y, alive:true, respawn:0, appear:1, phase:Math.random()*6.28, moving:!!moving};
    if (moving){
        box.baseX = x;
        box.range = rnd(45, 100);
        box.speed = rnd(50, 90);
        box.dir = Math.random()<0.5 ? 1 : -1;
    }
    return box;
}

function rankFrac(p){
    const n = players.length; if (n < 2) return 0;
    let ahead = 0;
    for (const o of players){ if (o !== p && (o.finished || o.y < p.y)) ahead++; }
    return ahead / (n - 1);                  // 0 = leading, 1 = last
}
// Mario Kart style: the further behind you are, the better your odds of a rocket
// (or, in last place, an earthquake). f: 0 = leading, 1 = last place.
function rollItem(p){
    const f = rankFrac(p);
    const others = players.some(o => o !== p && !o.finished);
    const isLeader = !players.some(o => o !== p && !o.finished && o.y < p.y);
    // Quake needs SOME gap to the leader before it can appear (never in 1st), then ramps up:
    // a real but modest chance in 2nd, growing into a strong comeback tool in 3rd/4th.
    const quakeW = others ? Math.max(0, f - 0.18) * 1.1 : 0;
    // Shield is defensive: more useful (and more common) the further ahead you are —
    // you're the one everyone else's attacks are aimed at.
    const shieldW = 0.16 + 0.16*(1-f);
    // Wind is a mild offensive tool for whoever's behind: it doesn't touch the caster,
    // and a modest chance even near the front keeps it from feeling exclusively "loser-only".
    const windW = others ? 0.10 + 0.20*f : 0;
    // UFO is a comeback lifeline: last place (or near it), and the further you've fallen
    // behind the next player up, the likelier it gets.
    let ufoW = 0;
    if (others && !isLeader && f >= 0.6){
        let next = null;
        for (const o of players) if (o !== p && !o.finished && o.y < p.y && (!next || o.y > next.y)) next = o;
        const gap = next ? p.y - next.y : 0;
        if (gap > 400){
            ufoW = Math.min(0.6, 0.14 + (gap - 400) / 3000);
            if (f < 0.9) ufoW *= 0.5;   // 3rd place: possible when far behind, but half as likely as last
        }
    }
    const w = {
        rocket: 0.06 + 0.50*f,
        giant:  0.22,
        bounce: 0.30 - 0.08*f,
        chain:  (others && !isLeader) ? 0.12 + 0.16*f : 0,   // useless for the leader, so never roll it
        quake:  quakeW,
        shield: shieldW,
        wind:   windW,
        ufo:    ufoW,
    };
    let sum = 0; for (const k in w) sum += w[k];
    let r = Math.random()*sum;
    for (const k in w){ r -= w[k]; if (r <= 0) return k; }
    return 'bounce';
}

function updateItemBoxes(dt){
    const pw = PLAY_W();
    for (const b of itemBoxes){
        if (b.moving && b.alive){
            b.x += b.speed*b.dir*dt;
            const minX = Math.max(20, b.baseX - b.range), maxX = Math.min(pw-20, b.baseX + b.range);
            if (b.x < minX){ b.x = minX; b.dir = 1; }
            if (b.x > maxX){ b.x = maxX; b.dir = -1; }
        }
        if (!b.alive){ b.respawn -= dt; if (b.respawn <= 0){ b.alive = true; b.appear = 0; } continue; }
        if (b.appear < 1) b.appear = Math.min(1, b.appear + dt*2.5);
        for (const p of players){
            if (p.finished || p.itemState || p.itemCool > 0) continue;   // one item at a time + short cooldown
            if (Math.abs(p.x - b.x) < p.r + 15 && Math.abs(p.y - b.y) < p.r + 15){
                b.alive = false; b.respawn = 9;
                p.item = rollItem(p); p.itemState = 'rolling'; p.itemRoll = ROLL_TIME;
                if (p.local) SFX.play('pickup');
                for (let i=0;i<14;i++) burst(b.x, b.y, `hsl(${(i*26)%360},90%,65%)`, 1, 230);
                ring(b.x, b.y, '#ffffff', 40);
                if (p.local){
                    // make the roulette end exactly on the item you get
                    itemHUD.rollOffset = ((ITEM_KEYS.indexOf(p.item) - 13) % 4 + 4) % 4;
                }
                break;
            }
        }
    }
}

function drawItemBoxes(){
    const t = performance.now()/1000;
    for (const b of itemBoxes){
        if (!b.alive) continue;
        if (b.y < cameraY - 60 || b.y > cameraY + VH + 60) continue;
        // moving item boxes get the same kind of slide-range rail as purple platforms,
        // so you can read the timing before committing to a jump
        if (b.moving){
            const minX = Math.max(20, b.baseX - b.range), maxX = Math.min(PLAY_W()-20, b.baseX + b.range);
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2; ctx.lineCap='round';
            ctx.beginPath(); ctx.moveTo(minX, b.y); ctx.lineTo(maxX, b.y); ctx.stroke();
            ctx.restore();
        }
        const bob = Math.sin(t*2.4 + b.phase) * 4;
        const spin = t*2.2 + b.phase;
        const c = Math.cos(spin), sn = Math.sin(spin);
        const S = 26 * (0.35 + 0.65*easeOutBack(b.appear));
        const hue = (t*80 + b.phase*57) % 360;
        ctx.save(); ctx.translate(b.x, b.y + bob);
        // soft halo
        ctx.globalAlpha = 0.18 + 0.08*Math.sin(t*4 + b.phase);
        ctx.fillStyle = `hsl(${hue},95%,65%)`;
        ctx.beginPath(); ctx.arc(0, 0, S*0.95, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        // two visible faces of a cube spinning around its vertical axis
        const faces = [ {w:S*Math.abs(c), h:hue, light:1}, {w:S*Math.abs(sn), h:(hue+90)%360, light:0.7} ];
        if (c*sn < 0) faces.reverse();
        let left = -(faces[0].w + faces[1].w)/2;
        for (const f of faces){
            if (f.w > 0.6){
                const g = ctx.createLinearGradient(left, -S/2, left + f.w, S/2);
                g.addColorStop(0, `hsla(${f.h},92%,${Math.round(64*f.light)}%,0.95)`);
                g.addColorStop(1, `hsla(${(f.h+50)%360},92%,${Math.round(52*f.light)}%,0.95)`);
                ctx.fillStyle = g; roundRect(left, -S/2, f.w, S, Math.min(5, f.w/2)); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
                if (f.w > 3){ roundRect(left+1, -S/2+1, f.w-2, S-2, Math.min(4, f.w/2)); ctx.stroke(); }
                if (f.w > 8){
                    ctx.save(); ctx.translate(left + f.w/2, 1); ctx.scale(f.w/S, 1);
                    ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.font = '800 17px Bricolage Grotesque';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 0);
                    ctx.restore();
                }
            }
            left += f.w;
        }
        ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
}

/* ---- Per-frame ability timers (called from stepPlayer) ---- */
function tickAbilities(p, dt){
    if (p.itemCool > 0) p.itemCool -= dt;
    if (p.itemState === 'rolling'){
        p.itemRoll -= dt;
        if (p.itemRoll <= 0){
            p.itemState = 'ready'; p.itemHold = 0;
            // HUMAN: less uniform than the standard bots — sometimes impulsive (fires almost
            // immediately), sometimes forgets about it for a while. Standard bots stay on a
            // clean, predictable window.
            p.itemDelay = (p.botType === 'human')
                ? (Math.random() < 0.3 ? rnd(0.15, 0.4) : rnd(1.2, 3.2))
                : rnd(0.5, 1.6);
        }
    } else if (p.itemState === 'ready'){
        p.itemHold += dt;
        if (!p.local){ p.itemDelay -= dt; if (p.itemDelay <= 0 && botWantsItem(p)) activateItem(p); }
    }
    // GIANT: springy grow/shrink, feet stay planted on the platform
    if (p.giantT > 0){
        p.giantT -= dt;
        if (p.giantT <= 0){ p.giantT = 0; burst(p.x, p.y, ITEMS.giant.color, 16, 200); ring(p.x, p.y, ITEMS.giant.color, 50); }
    }
    const targetR = p.giantT > 0 ? BASE_R*GIANT_SCALE : BASE_R;
    if (Math.abs(targetR - p.r) > 0.05 || Math.abs(p.rv) > 0.5){
        p.rv += (targetR - p.r) * 170 * dt;
        p.rv *= Math.exp(-9*dt);
        p.r = Math.max(8, p.r + p.rv*dt);
        if (p.mode === 'idle' && p.plat) p.y = p.plat.y - p.plat.h/2 - p.r;
        const pw = PLAY_W();
        if (p.x < p.r) p.x = p.r;
        if (p.x > pw - p.r) p.x = pw - p.r;
    }
    // SUPER BOUNCE
    if (p.bounceT > 0){ p.bounceT -= dt; if (p.bounceT <= 0) p.bounceT = 0; }
    // CHAIN
    if (p.chainT > 0){ p.chainT -= dt; if (p.chainT <= 0) releaseChain(p); }
    // QUAKE (as a victim): a brief warning shake, then the ground actually gives way
    if (p.quakePending > 0){
        p.quakePending -= dt;
        if (p.quakePending <= 0) triggerQueuedQuakeFall(p);
    }
    if (p.quakeShakeT > 0) p.quakeShakeT -= dt;
    // SHIELD: just counts down until it expires unused
    if (p.shieldT > 0){ p.shieldT -= dt; if (p.shieldT <= 0) p.shieldT = 0; }
    if (p.shieldFxT > 0) p.shieldFxT -= dt;
    if (p.blockTxtT > 0) p.blockTxtT -= dt;
    // WIND: counts down; the actual drift/aim-error happens in stepPlayer/launchPlayer
    if (p.windT > 0){ p.windT -= dt; if (p.windT <= 0){ p.windT = 0; p.windPushX = 0; } }
    // ROCKET: brief flame trail while the boosted velocity is still fresh
    if (p.rocketFx > 0){
        p.rocketFx -= dt;
        emitFlame(p, Math.min(1, p.rocketFx/0.3));
        (p.rocketTrail = p.rocketTrail || []).push({x:p.x, y:p.y});
        if (p.rocketTrail.length > 8) p.rocketTrail.shift();
        if (p.rocketFx <= 0){ p.rocketFx = 0; p.rocketTrail = null; }
    }
}

function botWantsItem(p){
    switch (p.item){
        case 'rocket': return p.mode === 'idle' || (p.mode === 'air' && p.vy > 450);
        case 'giant':  return p.itemHold > 4 || players.some(o => o !== p && !o.finished && Math.hypot(o.x-p.x, o.y-p.y) < 300);
        case 'bounce': return true;
        case 'chain':  return !!pickChainTarget(p);
        case 'quake':  return p.mode === 'idle';   // fire from solid ground, not mid-air
        case 'shield': return true;                 // hold it defensively as soon as it's ready
        case 'wind':   return players.some(o => o !== p && !o.finished); // useless with nobody else left
        case 'ufo':    return p.mode === 'idle' || p.itemHold > 2;  // call it in from solid ground
    }
    return true;
}

function activateItem(p){
    if (p.itemState !== 'ready' || p.finished || p.ufoHold || state !== 'playing') return false;
    const it = p.item;
        const chainTarget = it === 'chain' ? pickChainTarget(p) : null;
    if (it === 'chain' && !chainTarget) return false;
    p.item = null; p.itemState = null; p.itemCool = 4;
    if (p.local) SFX.play({rocket:'rocket', shield:'shield', wind:'wind', quake:'quake', chain:'chain', giant:'giant', ufo:'ufo', bounce:'bounce'}[it] || 'item');
    if (it === 'rocket') startRocket(p);
    else if (it === 'giant'){
        p.giantT = GIANT_TIME; p.rv += 60;
        ring(p.x, p.y, ITEMS.giant.color, 80); burst(p.x, p.y, ITEMS.giant.color, 18, 240);
        if (p.local) camShake = Math.max(camShake, 6);
    } else if (it === 'bounce'){
        p.bounceT = BOUNCE_TIME;
        // Instant benefit: launches you into the air right away, so using it never
        // just burns the timer while you stand still waiting for it to end.
        p.mode = 'air'; p.plat = null;
        p.vy = Math.min(p.vy, 0) - BOUNCE_KICK;
        p.squash = 1.4;
        ring(p.x, p.y, ITEMS.bounce.color, 55);
    } else if (it === 'chain'){
        fireChain(p, chainTarget);
    } else if (it === 'quake'){
        startQuake(p);
    } else if (it === 'ufo'){
        startUfo(p);
    } else if (it === 'shield'){
        p.shieldT = SHIELD_TIME;
        p.windT = 0; p.quakePending = 0;                 // shrug off anything already on you
        if (p.chainT > 0) releaseChain(p);
        ring(p.x, p.y, ITEMS.shield.color, 50);
    } else if (it === 'wind'){
        startWind(p);
    }
    if (p.local) itemHUD.key = '';           // force a HUD refresh
    return true;
}

/* ---- QUAKE: shakes platforms ABOVE the field's average height (punishing whoever
   is ahead) while everything at/below stays solid — so it's a comeback tool aimed at
   the leaders, not random chaos. On top of that, whoever is significantly ahead of the
   caster gets knocked off their platform and drops back a bounded amount, so the pack
   is guaranteed to actually close up rather than just "maybe" via missed jumps.
   Safety floors never shake, and the caster's own current platform is spared. A visible
   warning always precedes a platform vanishing. */
const QUAKE_WARN = 1.1, QUAKE_DOWN = 3.2, QUAKE_DROP = 340, QUAKE_FALL_T = 0.6;
const SHIELD_TIME = 6;   // a full protective bubble for its whole duration, so kept fairly short
const WIND_TIME = 6, WIND_FORCE = 380, WIND_AIM_ERR = 85;   // a light, readable crosswind — nudges your jump, never wrecks it
// WIND: everyone EXCEPT the caster gets buffeted — their aim goes slightly random and
// they drift sideways while airborne, like an actual gust of crosswind. A shield blocks it.
function startWind(p){
    let hit = 0;
    const dir = Math.random() < 0.5 ? -1 : 1;      // one real crosswind direction, shared by everyone it hits
    for (const o of players){
        if (o === p || o.finished) continue;
        if (shieldBlocks(o)){ if (p.local) floatText(o.x, o.y - o.r - 18, 'BLOCKED!', ITEMS.shield.color); continue; }
        o.windT = WIND_TIME;
        o.windSeed = Math.random()*1000;
        o.windDir = dir;
        hit++;
    }
    ring(p.x, p.y, ITEMS.wind.color, 65);
    burst(p.x, p.y, ITEMS.wind.color, 16, 200);
    if (p.local) camShake = Math.max(camShake, 3);
    if (p.local && !hit) floatText(p.x, p.y - p.r - 18, 'NO TARGETS', ITEMS.wind.color);
}
function startQuake(p){
    const alive = players.filter(o => !o.finished);
    const avgY = alive.reduce((s,o) => s + o.y, 0) / alive.length;
    // Only shake platforms clearly above the pack (a healthy margin, not "one row up"),
    // and only in the stretch right above that margin — a comeback tool, not a purge of
    // the whole upper track. Also cap how many platforms go at once.
    const margin = 260;
    const candidates = platforms.filter(pl =>
        pl.active && pl.type !== 'safety' && pl.type !== 'finish' && pl.type !== 'moving' &&
        pl !== p.plat && pl.y < avgY - margin && pl.y > avgY - margin - 900);
    candidates.sort((a,b) => b.y - a.y);              // closest-above first
    const hitList = candidates.slice(0, 6);
    for (const pl of hitList){ pl.quakeWarn = QUAKE_WARN; pl.quakeDown = 0; }

    // Directly close the gap: anyone well ahead of the caster gets shaken loose and
    // actually FALLS a bounded distance — no teleport, you can see it happen. A short
    // warning shake plays first, then gravity does the rest at a boosted fall speed so
    // it reads as "the ground gave way", not a random jump in position.
    let shaken = 0;
    for (const o of alive){
        if (o === p) continue;
        const lead = p.y - o.y;                        // how far ahead o is of the caster
        if (lead < margin) continue;
        if (shieldBlocks(o)){ if (p.local) floatText(o.x, o.y - o.r - 18, 'BLOCKED!', ITEMS.shield.color); continue; }
        const drop = Math.min(QUAKE_DROP, lead * 0.55);
        o.quakePending = QUAKE_WARN;                    // warning shake first, THEN the fall triggers
        o.quakeDrop = drop;
        o.quakeShakeT = QUAKE_WARN;                      // visual shake while pending
        shaken++;
    }

    ring(p.x, p.y, ITEMS.quake.color, 70);
    burst(p.x, p.y, ITEMS.quake.color, 20, 220);
    if (p.local) camShake = Math.max(camShake, 6);
    const hit = hitList.length;
    if (p.local && !hit && !shaken) floatText(p.x, p.y - p.r - 18, 'NO TARGETS', ITEMS.quake.color);
}
// Resolves the queued fall once the warning shake has played out.
function triggerQueuedQuakeFall(o){
    o.quakePending = 0;
    o.mode = 'air'; o.plat = null;
    o.vy = Math.max(o.vy, 0) + o.quakeDrop / QUAKE_FALL_T;   // reach the drop distance in QUAKE_FALL_T seconds
    camShake = Math.max(camShake, o.local ? 8 : 0);
    burst(o.x, o.y, ITEMS.quake.color, 16, 220);
}

function updateQuakes(dt){
    for (const pl of platforms){
        if (pl.quakeWarn > 0){
            pl.quakeWarn -= dt;
            if (pl.quakeWarn <= 0){
                pl.quakeWarn = 0; pl.quakeDown = QUAKE_DOWN; pl.active = false; pl.respawn = 0;
                burst(pl.x, pl.y, ITEMS.quake.color, 18, 200);
                for (const p of players) if (p.mode === 'idle' && p.plat === pl){ p.mode='air'; p.plat=null; }
            }
        } else if (pl.quakeDown > 0){
            pl.quakeDown -= dt;
            if (pl.quakeDown <= 0){ pl.quakeDown = 0; pl.active = true; burst(pl.x, pl.y, PLAT.normal, 10, 140); }
        }
    }
}


/* ---- ROCKET: autopilot to a safe platform ~6 rows up, soft landing ---- */
// ROCKET: an instant upward boost stacked on top of your current velocity —
// not an autopilot. You keep steering; side walls, bounce, and gravity all still apply.
const ROCKET_KICK = 1650;
function startRocket(p){
    p.vy -= ROCKET_KICK;                          // stacks on top of current vy (up is negative)
    capUpwardVelocity(p);                          // ...but a boosted jump + rocket can't stack past the ceiling
    p.mode = 'air'; p.plat = null; p.squash = 1.5;
    p.rocketFx = 0.6;                              // flame trail duration, purely visual
    if (p.local) camShake = Math.max(camShake, 7);
    ring(p.x, p.y + p.r, ITEMS.rocket.color, 55, true);
    burst(p.x, p.y + p.r, ITEMS.rocket.color, 16, 220);
}
function emitFlame(p, amt){
    const k = p.r/BASE_R, cols = ['#fff4c2','#ffcf3f','#ff7a3d','#ff5470'];
    const n = Math.random() < amt ? 2 : 1;
    for (let i=0;i<n;i++){
        particles.push({x:p.x + rnd(-4,4)*k, y:p.y + p.r + 22*k, vx:rnd(-50,50), vy:rnd(200,420),
            life:1, decay:rnd(3,5), color:cols[(Math.random()*4)|0], size:rnd(2,4.5)*(0.7 + amt*0.5)});
    }
    if (Math.random() < 0.3)
        particles.push({x:p.x + rnd(-6,6)*k, y:p.y + p.r + 30*k, vx:rnd(-40,40), vy:rnd(60,140),
            life:1, decay:rnd(1.2,2), color:'rgba(185,194,214,0.45)', size:rnd(4,7)});
}
function drawRocketUnder(p){
    const k = p.r/BASE_R, t = performance.now()/1000;
    // glowing exhaust streak behind the rocket
    const tr = p.rocketTrail;
    if (tr && tr.length > 1){
        ctx.save(); ctx.lineCap = 'round';
        for (let i=1;i<tr.length;i++){
            const f = i/tr.length;
            ctx.strokeStyle = `rgba(255,${Math.round(120 + 90*f)},60,${0.08 + 0.35*f})`;
            ctx.lineWidth = (3 + 9*f)*k;
            ctx.beginPath(); ctx.moveTo(tr[i-1].x, tr[i-1].y + p.r + 20*k); ctx.lineTo(tr[i].x, tr[i].y + p.r + 20*k); ctx.stroke();
        }
        ctx.restore();
    }
    ctx.save(); ctx.translate(p.x, p.y + p.r - 2*k); ctx.scale(k, k);
    const fl = 14 + Math.sin(t*60)*4 + Math.random()*4;
    const g = ctx.createLinearGradient(0, 18, 0, 18 + fl*1.4);
    g.addColorStop(0, '#fff4c2'); g.addColorStop(0.4, '#ffcf3f'); g.addColorStop(1, 'rgba(255,84,112,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-5, 18); ctx.quadraticCurveTo(0, 18 + fl*1.6, 5, 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff5470';
    ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-11, 20); ctx.lineTo(-6, 17); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6, 8);  ctx.lineTo(11, 20);  ctx.lineTo(6, 17);  ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eef2f8'; roundRect(-6, 0, 12, 18, 4); ctx.fill();
    ctx.fillStyle = '#ff5470'; ctx.fillRect(-6, 6, 12, 3);
    ctx.fillStyle = '#6b7489'; ctx.fillRect(-4, 16, 8, 3);
    ctx.restore();
}

/* ---- WEIGHT CHAIN: a ball & chain on the nearest player ahead of you ---- */
function pickChainTarget(p){
    // Always goes after whoever is currently in 1st place — a real "blue shell" style
    // equalizer, not just "nearest person ahead". If the caster IS 1st, it has no target.
    let leader = null;
    for (const o of players){
        if (o.finished) continue;
        if (!leader || o.y < leader.y) leader = o;
    }
    if (!leader || leader === p) return null;
    return leader;
}
function fireChain(from, to){
    shots.push({ from, to, t:0, dur:0.5, x:from.x, y:from.y, spin:0 });
    if (from.local) camShake = Math.max(camShake, 4);
}
function updateShots(dt){
    for (let i=shots.length-1;i>=0;i--){
        const s = shots[i];
        s.t += dt; s.spin += dt*18;
        const k = Math.min(1, s.t/s.dur), e = 1 - Math.pow(1 - k, 2);
        s.x = s.from.x + (s.to.x - s.from.x)*e;
        s.y = s.from.y + (s.to.y - s.from.y)*e - Math.sin(k*Math.PI)*60;
        if (k >= 1){ attachChain(s.to, s.from); shots.splice(i,1); }
    }
}
// Returns true and consumes the shield if the target has one active — used to block
// chain hits, quake falls, and giant shoves. One hit, then it's gone.
// RACE: the shield is a bubble that shrugs off EVERY attack for its whole duration (wind, chain,
// quake, giant shoves, ordinary bumps). It isn't used up by a hit — each block just flashes.
function shieldBlocks(v){
    if (!(v.shieldT > 0)) return false;
    if (!(v.shieldFxT > 0)){
        v.shieldFxT = 0.35;
        ring(v.x, v.y, ITEMS.shield.color, 46);
        burst(v.x, v.y, ITEMS.shield.color, 10, 180);
        if (v.local) SFX.play('block');
    }
    return true;
}
function consumeShield(v){
    if (!(v.shieldT > 0)) return false;
    v.shieldT = 0;
    ring(v.x, v.y, ITEMS.shield.color, 60);
    burst(v.x, v.y, ITEMS.shield.color, 22, 240);
    if (v.local) camShake = Math.max(camShake, 4);
    return true;
}
function attachChain(v, src){
    if (v.finished) return;
    if (shieldBlocks(v)){ if (src && src.local) floatText(src.x, src.y - src.r - 18, 'BLOCKED!', ITEMS.shield.color); return; }
    v.chainT = CHAIN_TIME; v.chainBy = src;
    const ax = v.x, ay = v.y + v.r;
    v.chainPts = [];
    // standing: the chain lies on the floor trailing behind; airborne: it dangles below
    const grounded = v.mode === 'idle' && v.plat;
    const dir = (src && src.x > v.x) ? 1 : -1;               // trails toward where it came from
    for (let i=0;i<CHAIN_LINKS;i++){
        const x = grounded ? ax + dir*i*CHAIN_SEG : ax;
        const y = grounded ? ay - (i === CHAIN_LINKS-1 ? BALL_R : 2) : ay + i*CHAIN_SEG;
        v.chainPts.push({x, y, px:x, py:y - 2});
    }
    burst(v.x, v.y, '#c9d1e3', 18, 220);
    ring(v.x, v.y, '#c9d1e3', 55);
    if (v.mode === 'air' && v.vy < 0) v.vy *= 0.6;            // yanked down a bit
    if (v.local) camShake = Math.max(camShake, 9);
}
function releaseChain(p){
    p.chainT = 0;
    if (p.chainPts){
        const b = p.chainPts[p.chainPts.length-1];
        particles.push({x:b.x, y:b.y, vx:rnd(-60,60), vy:-120, life:1, decay:0.9, color:'#3a4152', size:8});
        burst(b.x, b.y, '#c9d1e3', 10, 160);
    }
    p.chainPts = null;
}
function updateChains(dt){
    const g = 2400*dt*dt;
    for (const p of players){
        if (!(p.chainT > 0) || !p.chainPts) continue;
        const pts = p.chainPts, n = pts.length;
        const ax = p.x, ay = p.y + p.r;
        for (let i=1;i<n;i++){                              // verlet integrate
            const q = pts[i];
            const vx = (q.x - q.px)*0.985, vy = (q.y - q.py)*0.985;
            q.px = q.x; q.py = q.y; q.x += vx; q.y += vy + g;
        }
        for (let it=0; it<6; it++){                         // keep link lengths
            pts[0].x = ax; pts[0].y = ay;
            for (let i=1;i<n;i++){
                const a = pts[i-1], b = pts[i];
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001;
                const segLen = i === n-1 ? CHAIN_SEG + BALL_R*0.7 : CHAIN_SEG;
                const diff = (d - segLen)/d;
                let wa = 0.5, wb = 0.5;
                if (i === 1){ wa = 0; wb = 1; }                // anchored to the player
                else if (i === n-1){ wa = 0.8; wb = 0.2; }     // heavy ball barely budges
                a.x += dx*diff*wa; a.y += dy*diff*wa;
                b.x -= dx*diff*wb; b.y -= dy*diff*wb;
            }
        }
        pts[0].x = ax; pts[0].y = ay; pts[0].px = ax; pts[0].py = ay;
        // links and ball rest on platforms instead of hanging through them
        for (let i=1;i<n;i++){
            const q = pts[i], rad = i === n-1 ? BALL_R : 2;
            for (const pl of platforms){
                if (!pl.active) continue;
                const top = pl.y - pl.h/2;
                if (q.y + rad < top || q.py + rad > top + 8) continue;   // must come from above
                if (q.x < pl.x - pl.w/2 || q.x > pl.x + pl.w/2) continue;
                q.y = top - rad;
                q.px = q.x - (q.x - q.px)*0.55;                        // drag friction
                if (q.py > q.y) q.py = q.y;
                break;
            }
        }
    }
}
function drawBall(x, y, R, ang){
    const gr = ctx.createRadialGradient(x - R*0.35, y - R*0.35, 1, x, y, R);
    gr.addColorStop(0, '#9aa3b8'); gr.addColorStop(0.45, '#3a4152'); gr.addColorStop(1, '#11141c');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(201,209,227,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, R*0.62, Math.PI*1.05 + ang*0.1, Math.PI*1.45 + ang*0.1); ctx.stroke();
}
function drawLinkChain(pts, alpha){
    for (let i=1;i<pts.length;i++){
        const a = pts[i-1], b = pts[i];
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.save(); ctx.translate((a.x + b.x)/2, (a.y + b.y)/2); ctx.rotate(ang);
        ctx.globalAlpha = alpha;
        ctx.lineCap = 'round';
        if (i % 2){ ctx.strokeStyle = '#c9d1e3'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(0, 0, CHAIN_SEG*0.72, 3.1, 0, 0, 7); ctx.stroke(); }
        else      { ctx.strokeStyle = '#8a93a8'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(-CHAIN_SEG*0.6, 0); ctx.lineTo(CHAIN_SEG*0.6, 0); ctx.stroke(); }
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}
function drawChains(){
    for (const p of players){
        if (p.finished || !(p.chainT > 0) || !p.chainPts) continue;
        const pts = p.chainPts, n = pts.length;
        const alpha = Math.min(1, p.chainT/0.4);
        drawLinkChain(pts, alpha);
        const b = pts[n-1];
        ctx.globalAlpha = alpha;
        drawBall(b.x, b.y, BALL_R, 0);
        ctx.globalAlpha = 1;
    }
    // chains in flight
    for (const s of shots){
        const pts = [], L = Math.hypot(s.x - s.from.x, s.y - s.from.y), N = Math.max(2, Math.floor(L/CHAIN_SEG));
        for (let i=0;i<=N;i++){ const k = i/N; pts.push({x: s.from.x + (s.x - s.from.x)*k, y: s.from.y + (s.y - s.from.y)*k}); }
        drawLinkChain(pts, 0.9);
        drawBall(s.x, s.y, BALL_R, s.spin);
    }
}


/* ---- Item slot HUD (roulette + active-ability timer) ---- */
const ICON_SVG = {
ufo: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="icUb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7CFF6B" stop-opacity=".85"/><stop offset="1" stop-color="#7CFF6B" stop-opacity="0"/></linearGradient><linearGradient id="icUh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f5fa"/><stop offset="1" stop-color="#5d6679"/></linearGradient><linearGradient id="icUd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9ffe3"/><stop offset="1" stop-color="#2f9d74"/></linearGradient></defs><path d="M19.5 24 L28.5 24 L38 46 L10 46 Z" fill="url(#icUb)"/><path d="M15.5 18 C15.5 8.5 32.5 8.5 32.5 18 Z" fill="url(#icUd)" stroke="#0d1017" stroke-width="1.6"/><ellipse cx="24" cy="15" rx="3.6" ry="3.9" fill="#5fd35a"/><ellipse cx="24" cy="20.5" rx="18" ry="5.8" fill="url(#icUh)" stroke="#0d1017" stroke-width="1.6"/><circle cx="13.5" cy="21.5" r="1.5" fill="#7CFF6B"/><circle cx="24" cy="23.3" r="1.5" fill="#fff"/><circle cx="34.5" cy="21.5" r="1.5" fill="#7CFF6B"/></svg>`,
rocket: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="icFl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c2"/><stop offset=".5" stop-color="#ffcf3f"/><stop offset="1" stop-color="#ff5470" stop-opacity="0"/></linearGradient></defs><g transform="rotate(35 24 24)"><path d="M18.5 33 Q24 51 29.5 33 Z" fill="url(#icFl)"/><path d="M17.5 24 L11 35 L17.5 33 Z" fill="#ff5470"/><path d="M30.5 24 L37 35 L30.5 33 Z" fill="#ff5470"/><path d="M24 3 C30 8.5 30.5 16 30.5 22 L30.5 33 L17.5 33 L17.5 22 C17.5 16 18 8.5 24 3 Z" fill="#eef2f8"/><path d="M24 3 C27.6 6.2 29.3 9.6 30 12.5 L18 12.5 C18.7 9.6 20.4 6.2 24 3 Z" fill="#ff5470"/><circle cx="24" cy="20.5" r="3.8" fill="#7c6bff" stroke="#0d1017" stroke-width="1.8"/><rect x="20.5" y="33" width="7" height="3" rx="1" fill="#6b7489"/></g></svg>`,
giant: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="38" height="38" rx="9" fill="none" stroke="#ffcf3f" stroke-width="2" stroke-dasharray="5 4" opacity=".55"/><g stroke="#ffcf3f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M16 16 L9 9 M9 15 V9 H15"/><path d="M32 16 L39 9 M39 15 V9 H33"/><path d="M16 32 L9 39 M9 33 V39 H15"/><path d="M32 32 L39 39 M39 33 V39 H33"/></g><rect x="17" y="17" width="14" height="14" rx="3.5" fill="#ffcf3f"/><circle cx="21.3" cy="23" r="1.7" fill="#0d1017"/><circle cx="26.7" cy="23" r="1.7" fill="#0d1017"/></svg>`,
bounce: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M10 43h28" stroke="#6b7489" stroke-width="4" stroke-linecap="round"/><path d="M15 40 L33 36.5 L15 33 L33 29.5 L15 26 L33 22.5" fill="none" stroke="#eef2f8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="14" y="4" width="20" height="17" rx="4.5" fill="#35e0c8"/><circle cx="20.5" cy="12" r="1.9" fill="#0d1017"/><circle cx="27.5" cy="12" r="1.9" fill="#0d1017"/><path d="M6 9h5M5 15h6M37 9h5M37 15h6" stroke="#35e0c8" stroke-width="2.4" stroke-linecap="round" opacity=".7"/></svg>`,
chain: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="icBall" cx=".35" cy=".35" r=".75"><stop offset="0" stop-color="#9aa3b8"/><stop offset=".45" stop-color="#3a4152"/><stop offset="1" stop-color="#11141c"/></radialGradient></defs><g fill="none" stroke-linecap="round"><rect x="4" y="6.5" width="12" height="7" rx="3.5" transform="rotate(40 10 10)" stroke="#c9d1e3" stroke-width="3"/><path d="M14.5 14 L19.5 18.5" stroke="#8a93a8" stroke-width="3.6"/><rect x="17" y="18" width="12" height="7" rx="3.5" transform="rotate(40 23 21.5)" stroke="#c9d1e3" stroke-width="3"/></g><circle cx="32" cy="33" r="11" fill="url(#icBall)"/><path d="M25.8 30.5 a6.5 6.5 0 0 1 4.6 -4.8" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
quake: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M4 34 L14 34 L18 24 L23 42 L28 18 L32 34 L44 34" fill="none" stroke="#ff5470" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 40h40" stroke="#8a2e3c" stroke-width="3" stroke-linecap="round" opacity=".6"/><path d="M9 15 L12 10 M39 15 L36 10 M24 9 L24 4" stroke="#ff5470" stroke-width="2.6" stroke-linecap="round" opacity=".75"/></svg>`,
shield: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="icSh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6f5c2"/><stop offset="1" stop-color="#33b56a"/></linearGradient></defs><path d="M24 4 L40 10 V22 C40 33 33 41 24 44 C15 41 8 33 8 22 V10 Z" fill="url(#icSh)" stroke="#0d1017" stroke-width="1.6"/><path d="M24 10 L34 14 V22 C34 30 29.5 36 24 38 C18.5 36 14 30 14 22 V14 Z" fill="none" stroke="#eafff2" stroke-width="1.6" opacity=".8"/><path d="M18 23 L22.5 27.5 L31 17.5" fill="none" stroke="#0d1017" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
wind: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#8fd6ff" stroke-width="3.4" stroke-linecap="round"><path d="M4 16 H30 a5 5 0 1 0 -4.5 -7.2"/><path d="M4 25 H36 a5.5 5.5 0 1 1 -5 7.9"/><path d="M4 34 H24 a4 4 0 1 1 -3.6 5.8"/></g></svg>`,
};
const slotEl = document.getElementById('item-slot');
const slotIcon = document.getElementById('item-icon');
const slotBadge = document.getElementById('item-badge');
const slotBar = document.getElementById('item-bar-fill');
const itemHUD = { key:'', rollOffset:0 };

function updateItemHUD(){
    const p = players[0]; if (!p) return;
    let mode = 'empty', icon = null, badge = '', prog = 0, col = '#35e0c8';
    if (p.itemState === 'rolling'){
        mode = 'rolling';
        const el = Math.max(0, ROLL_TIME - p.itemRoll);
        const idx = Math.min(13, Math.floor(Math.pow(el/ROLL_TIME, 0.55) * 14));   // decelerating wheel
        icon = ITEM_KEYS[(idx + itemHUD.rollOffset) % 4];
    } else if (p.itemState === 'ready'){ mode = 'ready'; icon = p.item; }
    else if (p.giantT > 0){ mode = 'active'; icon = 'giant'; prog = p.giantT/GIANT_TIME; col = ITEMS.giant.color; }
    else if (p.bounceT > 0){ mode = 'active'; icon = 'bounce'; badge = Math.ceil(p.bounceT)+'s'; prog = p.bounceT/BOUNCE_TIME; col = ITEMS.bounce.color; }
    else if (p.chainT > 0){ mode = 'active chained'; icon = 'chain'; prog = p.chainT/CHAIN_TIME; col = '#ff5470'; }
    else if (p.shieldT > 0){ mode = 'active'; icon = 'shield'; prog = p.shieldT/SHIELD_TIME; col = ITEMS.shield.color; }
    else if (p.windT > 0){ mode = 'active'; icon = 'wind'; prog = p.windT/WIND_TIME; col = ITEMS.wind.color; }
    const key = mode + '|' + icon + '|' + badge;
    if (key !== itemHUD.key){
        const prevMode = itemHUD.key.split('|')[0];
        itemHUD.key = key;
        slotEl.className = 'item-slot ' + mode;
        slotIcon.innerHTML = icon ? ICON_SVG[icon] : '';
        slotBadge.textContent = badge;
        slotBadge.style.display = badge ? 'grid' : 'none';
        if (mode === 'rolling' || (mode === 'ready' && prevMode === 'rolling')){
            slotIcon.animate([{transform:'scale(1.25)'},{transform:'scale(1)'}], {duration: mode==='ready'?380:110, easing:'cubic-bezier(.3,1.6,.5,1)'});
        }
    }
    const bw = (mode.startsWith('active') ? Math.max(0, prog)*100 : 0).toFixed(0) + '%', sd = (gameMode !== 'race' && mode === 'empty') ? 'none' : '';
    if (itemHUD.bw !== bw){ slotBar.style.width = bw; itemHUD.bw = bw; }
    if (itemHUD.bc !== col){ slotBar.style.background = col; itemHUD.bc = col; }
    if (itemHUD.sd !== sd){ slotEl.style.display = sd; itemHUD.sd = sd; }
}
slotEl.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    const p = players[0];
    if (p && activateItem(p)) slotEl.animate([{transform:'scale(.9)'},{transform:'scale(1)'}], {duration:180});
});
window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if ((e.code === 'Space' || e.key === 'e' || e.key === 'E') && players[0]){ e.preventDefault(); activateItem(players[0]); }
});

/* ---------- Input ---------- */
canvas.addEventListener('pointerdown', e => {
    // Allow aiming during the countdown too, so you can jump right on GO
    if (state !== 'playing' && state !== 'countdown') return;
    if (e.clientX > CW - SIDEBAR) return;
    const p = players[0];
    if (p.finished || p.mode !== 'idle') return;
    dragging = true; sx=cx=e.clientX; sy=cy=e.clientY;
});
canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    cx=e.clientX; cy=e.clientY;
});
function endDrag(){
    if (!dragging) return;
    dragging = false;
    if (state !== 'playing') return;   // released before GO: nothing happens
    const p = players[0];
    if (p.finished || p.mode !== 'idle') return;
    let dx = sx-cx, dy = sy-cy;
    const d = Math.hypot(dx,dy);
    if (d > 14) {
        if (d > MAX_DRAG){ dx=dx/d*MAX_DRAG; dy=dy/d*MAX_DRAG; }
        launchPlayer(p, dx, dy);
        hintEl.style.display='none';
    }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

/* ---------- Bot AI (smart) ---------- */
// Given a target dx (horizontal) and dy (vertical, negative = up), find a launch
// velocity within power limits. Solves the ballistic arc for a good flight time.
// The game integrates gravity per frame (vy += G*dt before moving), which makes real
// arcs sag ~0.5*G*dt*t below the ideal parabola. Include that so bots aim true.
const SIM_DT = 1/60;
function solveJump(dx, dy, maxV, g, preferredEffort = 0) {
    let best = null, bestCost = Infinity;
    for (let t = 0.35; t <= 1.2; t += 0.025) {
        const vy = (dy - 0.5 * g * t * t - 0.5 * g * SIM_DT * t) / t;
        const vx = dx / t;
        if (vy > 0) continue;                         // must be launched upward
        const vyArrival = vy + g * t;
        // Arrive clearly descending: apex must sit well above the landing spot
        // (vyArrival 340 ~= apex 24px above it), so small errors still land.
        if (vyArrival < 340) continue;
        const speed = Math.hypot(vx, vy);
        if (speed > maxV) continue;
        const speedCost = preferredEffort > 0 ? Math.abs(speed - maxV * preferredEffort) : speed;
        const cost = speedCost + Math.abs(vyArrival - 520) * 0.25;
        if (cost < bestCost) { bestCost = cost; best = {vx, vy, t}; }
    }
    return best;
}

// Where will a moving platform's center be after t seconds (with bouncing at its limits)?
function predictPlatX(pl, t) {
    if (pl.type !== 'moving') return pl.x;
    const pw = PLAY_W();
    const minX = Math.max(pl.w/2, pl.baseX - pl.range);
    const maxX = Math.min(pw - pl.w/2, pl.baseX + pl.range);
    const span = maxX - minX;
    if (span <= 0) return pl.x;
    // unfold the bounce into a straight line, then fold back
    let u = (pl.x - minX) + pl.speed * pl.dir * t;
    const period = span * 2;
    u = ((u % period) + period) % period;
    return minX + (u <= span ? u : period - u);
}

// Cheap check: does the ballistic arc from p toward target (with launch velocity sol)
// Cheap check: does the ballistic arc from p toward target (with launch velocity sol)
// pass through the underside of an INTACT ceiling platform before reaching the target?
// Ceilings are breakable (one hit shatters them for good), so this isn't a hard block for
// bots — just something they'd rather avoid, the way they already avoid ice or fragile.
function arcHitsCeiling(p, sol, target, ceilings){
    let x = p.x, y = p.y, vx = sol.vx, vy = sol.vy;
    const dt = 1/30, g = playerG(p);
    for (let t=0; t<2.5; t+=dt){
        const py = y;
        vy += g*dt; x += vx*dt; y += vy*dt;
        if (vy < 0){
            for (const pl of ceilings){
                if (!pl.active || !pl.ceiling || pl.ceilingBroken || pl === target) continue;
                const bottom = pl.y + pl.h/2;
                if (py - p.r >= bottom - 2 && y - p.r <= bottom &&
                    x + p.r > pl.x - pl.w/2 && x - p.r < pl.x + pl.w/2) return true;
            }
        }
        if (y <= target.y - target.h/2 - p.r) break;   // reached the target's height, stop checking
    }
    return false;
}
function evalTarget(p, pl, ceilings) {
    const halfW = pl.w/2;
    // Keep a safety margin from the edge; on wide platforms land close to where we are.
    const margin = Math.min(halfW * 0.55, p.r + 14);
    const landY = pl.y - pl.h/2 - p.r;
    const dy = landY - p.y;

    let sol = null, dx = 0;
    // For moving platforms, iterate: guess flight time -> predict position -> re-solve
    let tGuess = 0.6;
    for (let k = 0; k < 3; k++) {
        const cxp = predictPlatX(pl, tGuess);
        const tx = Math.max(cxp - halfW + margin, Math.min(cxp + halfW - margin, p.x));
        dx = tx - p.x;
        sol = solveJump(dx, dy, playerMaxV(p, !!p._air), playerG(p), 0.95);
        if (!sol || pl.type !== 'moving') break;
        tGuess = sol.t;
    }
    if (!sol) return null;                            // unreachable

    const gain = p.y - pl.y;                           // height gained (px)

    let score = gain * 0.9;                            // reward height
    score -= Math.abs(dx) * 0.4;                       // penalize sideways travel
    score += Math.min(pl.w, 200) * 0.4;                // prefer wide, forgiving platforms
    if (pl.type === 'ice')     score -= 50;
    if (pl.type === 'fragile') score -= 40;
    if (pl.type === 'moving')  score -= 35;
    if (pl.type === 'safety')  score += 20;
    if (pl.type === 'boost')   score += 70;
    if (pl.type === 'finish')  score += 2000;          // always go for the win when reachable
    // A ceiling in the way costs the bot a bonk and a stall, not the whole route — so it's
    // discouraged like a rough platform type, but the bot will still smash through one if
    // that's genuinely the best (or only) way up, same as it'll risk fragile or ice.
    if (arcHitsCeiling(p, sol, pl, ceilings)) score -= 130;
    return { score, sol, pl };
}

function updateBot(p, dt) {
    if (p.mode !== 'idle') return;
    // AFK: a rare player who just stands there — until, after 20s, a "backfill" bot takes
    // over their controls and starts playing normally (never with the human profile).
    if (p.afk){
        p.afkT += dt;
        if (p.afkT >= 20){ p.afk = false; p.botType = 'standard'; p.thinkT = rnd(0.3, 0.8); }
        else return;
    }
    const isHuman = p.botType === 'human';

    p.thinkT -= dt;
    // React fast on crumbling/ice/spike-adjacent situations
    if (p.plat && (p.plat.type === 'fragile')) p.thinkT -= dt * 1.5;   // a human hops off a crumbling platform quicker, not instantly
    if (p.plat && (p.plat.type === 'ice'))     p.thinkT -= dt * 1.2;

    if (p.hesitating) {
        p.hesitateFor -= dt;
        if (p.hesitateFor > 0) return;   // still "thinking it over" — don't even evaluate a jump yet
        p.hesitating = false;
    }

    // A hard floor on how soon after LANDING a bot may jump again. Aiming and releasing takes a person at least
    // half a second; the old countdown could be stale (after a slide, a fall or a rush) and fire one frame after landing.
    p.idleT = (p.idleT || 0) + dt;
    const standing = p.plat && p.plat.type;
    const minWait = (standing === 'fragile' ? 0.34 : standing === 'ice' ? 0.42 : 0.55) * (p.waitScale || 1) + (p.extraWait || 0);
    if (p.thinkT > 0 || p.idleT < minWait) return;

    // Track stagnation: how many think-cycles without gaining height
    if (p.botBestY === undefined) p.botBestY = p.y;
    if (p.y < p.botBestY - 5) { p.botBestY = p.y; p.stuckCount = 0; }
    else p.stuckCount = (p.stuckCount || 0) + 1;

    const ceilings = platforms.filter(pl => pl.active && pl.ceiling && !pl.ceilingBroken);

    // Consider platforms in a reachable window above
    let best = null, secondBest = null, nearest = null, nearestD = Infinity;
    for (const pl of platforms) {
        if (!pl.active) continue;
        if (pl === p.plat) continue;
        if (pl.y >= p.y - 20) continue;               // must be above
        if (pl.y < p.y - BOT_BASE.reach) continue;    // beyond this bot's ambition
        const e = evalTarget(p, pl, ceilings);
        if (!e) continue;
        if (!best || e.score > best.score) { secondBest = best; best = e; }
        else if (!secondBest || e.score > secondBest.score) secondBest = e;
        // track the geometrically closest option too, for the human "easy pick" heuristic below
        const d = Math.hypot(pl.x - p.x, pl.y - p.y);
        if (d < nearestD) { nearestD = d; nearest = e; }
    }

    // Fallback: if nothing above is reachable, hop to the best nearby platform
    if (!best) {
        for (const pl of platforms) {
            if (!pl.active || pl === p.plat) continue;
            if (Math.abs(pl.y - p.y) > 300) continue;
            const e = evalTarget(p, pl, ceilings);
            if (!e) continue;
            if (!best || e.score > best.score) best = e;
        }
    }
    if (!best) { p.thinkT = rnd(0.2, 0.4); return; }

    // Anti-stagnation: if stuck for a while, try the alternative target to break the loop
    if (p.stuckCount > 3 && secondBest) { best = secondBest; p.stuckCount = 0; }

    // HUMAN: sometimes goes for the platform that just LOOKS closest/easiest rather than
    // the mathematically optimal one — a believable, low-stakes misjudgment, never one
    // that's actively bad (it still has to be a real, reachable platform).
    const mistakeP = isHuman ? 0.22 : (p.mistake || 0);          // roster bots: weaker ones misjudge routes more often
    if (mistakeP && nearest && nearest !== best && Math.random() < mistakeP) best = nearest;

    let { vx, vy } = best.sol;

    // Rubber-banding: keep the race close to the human so you actually meet the bots.
    // HUMAN bots are deliberately exempt — the whole point is that they read as a real
    // player racing on their own merit, not a mechanism quietly tracking you. They only
    // ever vary from their own aim quirks and, occasionally, a real risky-jump hesitation.
    let thinkMul = 1, aimMul = 1;
    if (!isHuman) {
        const human = players[0];
        if (human && !human.local) { /* sim / spectator: no banding */ }
        else if (human && !human.finished) {
            const lead = human.y - p.y;
            const bandK = gameMode === 'gauntlet' ? GT_BAND : (window.RACE_BAND === undefined ? 1 : window.RACE_BAND);   // Ranked turns the rubber band off
            if (lead > 250) {                       // ahead: ease off
                const k = Math.min(1, (lead - 250) / 900) * bandK;
                thinkMul = 1 + k * 2.8;             // up to 3.8x longer pauses
                aimMul   = 1 + k * 1.0;             // up to 2x sloppier aim
            } else if (lead < -250) {               // behind: hurry up
                const k = Math.min(1, (-lead - 250) / 900) * bandK;
                thinkMul = 1 - k * 0.25;            // down to 0.75x pauses (never robotic-fast)
            }
        }
    } else {
        // HUMAN wants to win, plain and simple — no banding, and it actively competes:
        // closing in on the leader or on you sharpens its focus (shorter pauses), it never
        // lets up near the finish, and only very rarely hesitates before a genuinely risky
        // jump — briefly, and it makes the time straight back up with a sharper next jump,
        // the way a real competitive player would rather than just losing ground for good.
        const speed = Math.hypot(vx, vy);
        const maxV = playerMaxV(p, false);
        const effort = speed / maxV;                     // 0..1, how close to full-power this jump is
        const nearFinish = p.y < FINISH_Y + 1400;
        if (!(players[0] && players[0].finished) && !nearFinish && effort > 0.85 && Math.random() < 0.12) {
            p.hesitating = true;
            p.hesitateFor = rnd(0.18, 0.35);
            p.catchUpNext = true;                        // next think-pause will be shortened to compensate
            return;   // don't jump this frame — actually pause before committing
        }
        // Rival check is bot-vs-bot only — the human profile's pace must never depend on
        // where the actual player is, under any circumstance, so the local player is
        // explicitly excluded here even though it would otherwise qualify.
        const rival = players.reduce((best, o) => (o !== p && !o.local && !o.finished && (!best || o.y < best.y)) ? o : best, null);
        if (rival) {
            const gap = Math.abs(rival.y - p.y);
            if (gap < 500) thinkMul *= 0.85;             // a close race sharpens reaction time
        }
        if (p.catchUpNext) { thinkMul *= 0.75; p.catchUpNext = false; }
    }
    p.thinkMul = thinkMul;

    // SPRINT: once you've finished, nobody's actually being raced against anymore — so bots
    // stop being cautious and just close the race out quickly and cleanly, rather than
    // dragging on with their usual human-like misses and pauses.
    const sprintFinish = gameMode !== 'gauntlet' && !window.rankedMatch && players[0] && players[0].finished;
    const sprintMul = sprintFinish ? 0.35 : 1;
    const sprintThink = sprintFinish ? 0.6 : 1;

    if (isHuman) {
        // HUMAN aim error: a personal lean (this bot tends to slightly over- or under-shoot)
        // plus per-jump variability, instead of clean symmetric noise — reads as a person's
        // grip/timing quirk rather than a random-number generator.
        const person = p.fumbleBias || 0;
        vx += (person * 0.6 + rnd(-1, 1) * 0.8) * BOT_BASE.aimX * p.skill * sprintMul;
        vy += rnd(-1, 1) * BOT_BASE.aimY * 0.9 * p.skill * sprintMul;
    } else {
        vx += rnd(-1, 1) * BOT_BASE.aimX * p.skill * aimMul * sprintMul;
        vy += rnd(-1, 1) * BOT_BASE.aimY * p.skill * aimMul * sprintMul;
    }

    // Clamp to power
    const maxV = playerMaxV(p, !!p._air);
    const cur = Math.hypot(vx, vy);
    if (cur > maxV) { vx = vx / cur * maxV; vy = vy / cur * maxV; }

    // Launch (respect boost charge)
    const wasCharged = p.charged;
    p.vx = vx; p.vy = vy;
    p.mode = 'air'; p.plat = null; p.squash = 1.35;
    if (wasCharged) { p.charged = false; burst(p.x, p.y, PLAT.boost, 12, 200); }
    else burst(p.x, p.y, p.color, 8, 140);

    p.thinkT = rnd(BOT_BASE.thinkMin, BOT_BASE.thinkMax) * (p.thinkMul || 1) * sprintThink * (p.thinkScale || 1);
}

/* ---------- Collision (swept, no tunneling) ---------- */
function landOn(p, pl) {
    const impact = Math.abs(p.vy);
    if (p.local){ SFX.play('land'); haptic(impact > 1100 ? [12, 16, 10] : 7); if (impact > 1000) camShake = Math.max(camShake, Math.min(6, impact / 450)); }
    // dust puff where the feet hit the platform; harder landings throw more
    burst(p.x, pl.y - pl.h / 2, '#c9d1e3', 3 + Math.min(8, Math.round(impact / 260)), 70 + Math.min(120, impact / 12));
    if (impact > 1300) ring(p.x, pl.y - pl.h / 2, '#c9d1e3', 34 + Math.min(30, impact / 60), true);
    p.idleT = 0;
    p.extraWait = (!p.local && pl.type !== 'fragile' && !(players[0] && players[0].finished) && Math.random() < 0.10) ? rnd(0.4, 1.0) : 0;
    p.y = pl.y - pl.h/2 - p.r;
    p.vy = 0; p.mode='idle'; p.plat=pl; p.squash = Math.max(0.55, 0.78 - impact / 9000);
}

function handleFinish(p) {
    if (gameMode === 'parkour'){ pkSummit(p); return; }
    if (gameMode === 'level'){ lvComplete(p); return; }
    if (gameMode === 'gauntlet'){ gtFinish(p); return; }
    p.finished = true;
    p.finishTime = (Date.now()-matchStart)/1000;
    finishedCount++;
    burst(p.x, p.y, p.color, 30, 260);
    if (p.local){ SFX.play('finish'); showFinishMenu(true); haptic([30, 40, 30, 40, 80]); camShake = Math.max(camShake, 7); for (const c of ['#ffcf3f', '#ffffff', '#35e0c8', '#ff5470']) burst(p.x, p.y, c, 14, 340); ring(p.x, p.y, '#ffcf3f', 110); }
    if (window.rankedMatch){ if (p.local) Ranked.onLocalFinish(finishedCount); return; }   // Ranked ends the moment YOU cross the line: nobody after you can pass you
    checkEnd();
    maybePromptBotsDone();
}

function stepPlayer(p, dt) {
    if (p.finished) return;
    if (p.ufoHold) return;                         // being carried: the UFO owns your position
    if (p.dropT > 0) p.dropT -= dt;                // briefly ignores the platform it was stomped through
    const pw = PLAY_W();
    tickAbilities(p, dt);

    if (p.mode === 'idle') {
        if (!p.plat || !p.plat.active) { p.mode='air'; p.plat=null; }
        else {
            const pl = p.plat;
            if (pl.type==='moving') {
                p.x += pl.speed*pl.dir*dt; p.vx = pl.speed*pl.dir;
                if (p.x < pl.x-pl.w/2 || p.x > pl.x+pl.w/2){ p.mode='air'; p.plat=null; }
            } else if (pl.type==='ice') {
                p.x += p.vx*dt; p.vx *= 0.985;
                if (p.x < pl.x-pl.w/2 || p.x > pl.x+pl.w/2){ p.mode='air'; p.plat=null; }
            } else {
                p.x += p.vx*dt; p.vx *= 0.55;
                if (Math.abs(p.vx) < 4) p.vx = 0;
            }
            // fragile trigger
            if (pl.type==='fragile' && !pl.breaking){ pl.breaking=true; pl.breakT=0.9; }
            if (!p.local) updateBot(p, dt);
        }
    }

    if (p.mode === 'air') {
        const prevY = p.y;
        p.idleT = 0;                 // the wait-before-jumping clock only runs while standing, however you got airborne
        p.vy += playerG(p)*dt;
        // clamp fall speed to keep collisions safe
        if (p.vy > 2600) p.vy = 2600;
        // WIND: a real crosswind — one fixed direction for the whole duration (set once when
        // the gust hits you), with only its strength wavering a little. Never flips sides.
        if (p.windT > 0){
            const wobble = 0.75 + 0.25*Math.sin(p.windSeed + performance.now()/1000*2.2);
            p.windPushX = p.windDir * WIND_FORCE * wobble;
            p.vx += p.windPushX * dt;
        }
        p.x += p.vx*dt;
        p.y += p.vy*dt;

        // FINISH: the instant your whole body is above the finish line, you're done —
        // in EITHER direction (rising past it or landing down onto it) and regardless of
        // how far past it a big boost or bounce carries you, or how far sideways you are.
        // Found by type (not by array position — a broken ceiling or anything appended
        // later must never hide it). Uses the finish platform's REAL height, so it works in
        // every mode: the race finish, a Parkour level's finish and the Tower summit all sit
        // at different heights. The x-check has generous margin so a fast diagonal pass
        // can't slip through between two frames.
        if (!p.finished){
            const finishPl = finishPlatform || (finishPlatform = platforms.find(pl => pl.type === 'finish'));
            if (finishPl && (p.y + p.r) <= (finishPl.y + finishPl.h/2) &&
                p.x + p.r > finishPl.x - finishPl.w/2 - 40 && p.x - p.r < finishPl.x + finishPl.w/2 + 40){
                handleFinish(p);
            }
        }

        // side walls — Super Bounce turns them into a springboard (110% rebound)
        if (p.x < p.r){
            p.x=p.r;
            if (p.bounceT > 0 && p.vx < -40){ p.vx = Math.max(BOUNCE_MIN_VY*0.7, Math.min(BOUNCE_MAXV, -p.vx*BOUNCE_RESTITUTION)); springFx(p, 'wall'); }
            else p.vx*=-0.45;
        }
        if (p.x > pw - p.r){
            p.x=pw - p.r;
            if (p.bounceT > 0 && p.vx > 40){ p.vx = -Math.max(BOUNCE_MIN_VY*0.7, Math.min(BOUNCE_MAXV, p.vx*BOUNCE_RESTITUTION)); springFx(p, 'wall'); }
            else p.vx*=-0.45;
        }

        // ground catch — while Super Bounce is active, the floor launches you back up
        if (!p.finished && p.y > START_Y - p.r && p.vy > 0){
            if (p.bounceT > 0 && p.vy > 60){
                p.y = START_Y - p.r; p.vy = bounceVy(p.vy); springFx(p, 'floor');
            } else {
                landOn(p, platforms[0]);
                if (p.local && !p.wasGrounded && p.best < START_Y - 300){
                    showFall();
                }
            }
        }

        // swept UPWARD collision — a "ceiling": some platforms are sealed underneath and
        // block you from below... until you hit one hard enough. A single impact shatters
        // it for good — after that it's just a normal, open platform.
        if (!p.finished && p.vy < 0) {
            const pTopPrev = prevY - p.r;
            const pTopNow  = p.y - p.r;
            for (const pl of platforms) {
                if (!pl.active || !pl.ceiling || pl.ceilingBroken) continue;
                const bottom = pl.y + pl.h/2;
                if (pTopPrev >= bottom - 2 && pTopNow <= bottom) {
                    if (p.x + p.r > pl.x - pl.w/2 && p.x - p.r < pl.x + pl.w/2) {
                        pl.ceiling = false; pl.ceilingBroken = true;
                        p.y = bottom + p.r; p.vy = -p.vy * 0.3;   // still a soft bonk on the way through
                        shatterCeiling(p.x, bottom, pl.w);
                        camShake = Math.max(camShake, 7);
                        if (p.local) floatText(p.x, bottom + 20, "SHATTERED!", '#ffcf3f');
                        break;
                    }
                }
            }
        }

        // swept downward collision
        if (!p.finished && p.vy > 0) {
            const pBottomPrev = prevY + p.r;
            const pBottomNow  = p.y + p.r;
            for (const pl of platforms) {
                if (!pl.active) continue;
                if (pl.type==='finish') continue;    // finishing is handled unconditionally above
                if (pl === p.dropPlat && p.dropT > 0) continue;   // stomped through this one
                const top = pl.y - pl.h/2;
                if (pBottomPrev <= top + 2 && pBottomNow >= top) {
                    if (p.x + p.r > pl.x - pl.w/2 && p.x - p.r < pl.x + pl.w/2) {
                        // Super Bounce: rebound off the platform at 110% instead of landing
                        if (p.bounceT > 0 && pl.type !== 'finish' && p.vy > 60){
                            p.y = top - p.r; p.vy = bounceVy(p.vy);
                            if (pl.type==='fragile' && !pl.breaking){ pl.breaking=true; pl.breakT=0.9; }
                            springFx(p, 'floor');
                            break;
                        }
                        landOn(p, pl);
                        if (pl.type === 'boost') {
                            // Don't auto-jump. Land here; your NEXT launch is charged.
                            p.charged = true;
                            burst(p.x, top, PLAT.boost, 14, 180);
                        } else if (pl.type === 'finish') {
                            handleFinish(p);
                        } else {
                            p.charged = false;
                            burst(p.x, p.y, p.color, 6, 120);
                        }
                        break;
                    }
                }
            }
        }
    }

    // track best height + detect big falls for local player
    if (p.y < p.best) p.best = p.y;
    p.wasGrounded = (p.mode === 'idle');
}

let lastFallToast = 0;
function showFall() { SFX.play('fall'); }

/* ---------- Player-vs-player bumping ---------- */
function massOf(p){ return (p.r/BASE_R)**2 * (p.giantT > 0 ? 30 : 1) * ((p.rocketFx||0) > 0 ? 6 : 1); }

/* ---- UFO: abducts you and drops you at the height of the next player above ---- */
const UFO_ARRIVE = 0.85, UFO_BEAM = 0.45, UFO_RELEASE = 0.3, UFO_LEAVE = 0.9, UFO_HANG = 150;
function ufoEase(t){ return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2; }

function startUfo(p){
    // Who's the first player above you? (finished players count as sitting at the finish.)
    let above = null;
    for (const o of players){
        if (o === p || (gameMode === 'gauntlet' && o.gone)) continue;   // Gauntlet: players who left the stage don't count as "above"
        const oy = o.finished ? FINISH_Y - 30 : o.y;
        if (oy < p.y - 60 && (!above || oy > above.y)) above = { y: oy, finished: o.finished };
    }
    if (gameMode === 'gauntlet' && !above) return;                      // nobody to be set down beside: the item simply fizzles
    const toFinish = !above || above.finished;
    let dropX, dropY;
    if (toFinish){
        const fp = platforms.find(pl => pl.type === 'finish');
        dropX = fp ? fp.x : PLAY_W()/2;
        dropY = FINISH_Y - p.r - 34;
    } else {
        // A safe, still platform at (or just under) that player's height — never a moving,
        // crumbling or quaked-out one, and never lower than where you already are.
        const ty = above.y;
        const ok = pl => pl.active && !pl.ground && pl.type !== 'finish' && pl.type !== 'moving'
                         && pl.type !== 'fragile' && pl.y < p.y - 40;
        const occupant = pl => players.find(o => o !== p && !o.finished && o.plat === pl);
        let best = null, bestD = Infinity;
        for (const pl of platforms){
            if (!ok(pl)) continue;
            const standY = pl.y - pl.h/2 - p.r;
            let d = Math.abs(standY - ty) + (standY < ty - 60 ? 400 : 0);   // prefer at/below their height
            if (occupant(pl) && pl.w < 4*p.r + 40) d += 220;                 // too narrow to share without a shove
            if (d < bestD){ bestD = d; best = pl; }
        }
        if (!best){ for (const pl of platforms){ if (pl.active && !pl.ground && pl.type !== 'finish' && pl.y < p.y - 40){
            const d = Math.abs(pl.y - ty); if (d < bestD){ bestD = d; best = pl; } } } }
        if (!best){ dropX = PLAY_W()/2; dropY = FINISH_Y - p.r - 34; }
        else {
            // Set down on the far side from anyone already standing there, so nobody gets shoved off.
            const o = occupant(best);
            dropX = best.x;
            if (o) dropX = o.x < best.x ? best.x + best.w/2 - p.r - 8 : best.x - best.w/2 + p.r + 8;
            dropY = best.y - best.h/2 - p.r - 36;
        }
    }
    if (p.chainT > 0) releaseChain(p);
    p.quakePending = 0;
    p.ufoHold = true; p.mode = 'air'; p.plat = null; p.vx = 0; p.vy = 0; p.charged = false;
    ufos.push({ p, phase:'arrive', t:0, sx:p.x, sy:p.y - 720, x:p.x, y:p.y - 720,
                hx:p.x, hy:p.y - UFO_HANG, px0:p.x, py0:p.y, dropX, dropY, toFinish,
                carryT: Math.max(1.1, Math.min(3.2, Math.abs(p.y - dropY) / 1100)),
                beam:0, seed:Math.random()*10 });
    if (p.local) camShake = Math.max(camShake, 3);
}

function updateUfos(dt){
    for (let i = ufos.length - 1; i >= 0; i--){
        const u = ufos[i], p = u.p;
        u.t += dt;
        if (u.phase === 'arrive'){
            const k = ufoEase(Math.min(1, u.t / UFO_ARRIVE));
            u.x = u.sx + (u.hx - u.sx)*k; u.y = u.sy + (u.hy - u.sy)*k;
            if (u.t >= UFO_ARRIVE){ u.phase = 'beam'; u.t = 0; ring(p.x, p.y, ITEMS.ufo.color, 50); }
        } else if (u.phase === 'beam'){
            const k = Math.min(1, u.t / UFO_BEAM);
            u.beam = k;
            p.x = u.px0; p.y = u.py0 - 26*ufoEase(k); p.rv = 3;
            if (u.t >= UFO_BEAM){ u.phase = 'carry'; u.t = 0; u.cx0 = u.x; u.cy0 = u.y; u.ppx = p.x; u.ppy = p.y; }
        } else if (u.phase === 'carry'){
            const k = ufoEase(Math.min(1, u.t / u.carryT));
            u.x = u.cx0 + (u.dropX - u.cx0)*k;
            u.y = u.cy0 + ((u.dropY - UFO_HANG) - u.cy0)*k;
            const sway = Math.sin(u.t*5 + u.seed) * 6 * (1 - k);
            p.x = u.x + sway; p.y = u.y + UFO_HANG - 26*(1 - k) ; p.rv = 3;
            if (Math.random() < dt*30) particles.push({ x:p.x + rnd(-18,18), y:p.y + rnd(0,30), vx:rnd(-20,20), vy:-rnd(80,180),
                                                        life:1, decay:rnd(1.2,2), size:rnd(1.5,3), color:ITEMS.ufo.color });
            if (u.t >= u.carryT){
                u.phase = 'release'; u.t = 0;
                p.x = u.dropX; p.y = u.dropY; p.vx = 0; p.vy = 0;
                p.ufoHold = false; p.mode = 'air'; p.plat = null; p.rv = 0;
                burst(p.x, p.y, ITEMS.ufo.color, 16, 180);
                if (p.local) camShake = Math.max(camShake, 4);
            }
        } else if (u.phase === 'release'){
            u.beam = Math.max(0, 1 - u.t / UFO_RELEASE);
            if (u.t >= UFO_RELEASE){ u.phase = 'leave'; u.t = 0; u.lx0 = u.x; u.ly0 = u.y; }
        } else if (u.phase === 'leave'){
            const k = Math.min(1, u.t / UFO_LEAVE);
            u.x = u.lx0 + Math.sin(u.t*3 + u.seed)*20*k; u.y = u.ly0 - 900*k*k;
            if (u.t >= UFO_LEAVE) ufos.splice(i, 1);
        }
    }
}

function drawUfoBeams(){
    const t = performance.now()/1000;
    for (const u of ufos){
        if (u.beam <= 0.01) continue;
        const p = u.p, top = u.y + 10, bot = Math.max(top + 40, p.y + p.r + 16);
        const wTop = 16, wBot = 46 + 10*Math.sin(t*6 + u.seed);
        ctx.save(); ctx.globalAlpha = u.beam;
        const g = ctx.createLinearGradient(0, top, 0, bot);
        g.addColorStop(0, 'rgba(124,255,107,0.55)'); g.addColorStop(0.7, 'rgba(124,255,107,0.22)'); g.addColorStop(1, 'rgba(124,255,107,0.04)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(u.x - wTop, top); ctx.lineTo(u.x + wTop, top);
        ctx.lineTo(u.x + wBot, bot); ctx.lineTo(u.x - wBot, bot); ctx.closePath(); ctx.fill();
        // bright core
        const c = ctx.createLinearGradient(0, top, 0, bot);
        c.addColorStop(0, 'rgba(220,255,210,0.55)'); c.addColorStop(1, 'rgba(220,255,210,0)');
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(u.x - 5, top); ctx.lineTo(u.x + 5, top); ctx.lineTo(u.x + 14, bot); ctx.lineTo(u.x - 14, bot); ctx.closePath(); ctx.fill();
        // tractor rings travelling up the beam
        ctx.strokeStyle = 'rgba(180,255,170,0.7)'; ctx.lineWidth = 1.6;
        for (let k = 0; k < 4; k++){
            const f = ((t*0.9 + k/4) % 1);
            const yy = bot - (bot - top)*f;
            const ww = wBot + (wTop - wBot)*f;
            ctx.globalAlpha = u.beam * (1 - f) * 0.9;
            ctx.beginPath(); ctx.ellipse(u.x, yy, ww*0.9, 3.5, 0, 0, 7); ctx.stroke();
        }
        ctx.restore();
    }
}

function drawUfoCraft(){
    const t = performance.now()/1000;
    for (const u of ufos){
        const bob = Math.sin(t*3 + u.seed) * 3;
        const x = u.x, y = u.y + bob;
        ctx.save();
        // underglow
        const glow = ctx.createRadialGradient(x, y + 8, 2, x, y + 8, 60);
        glow.addColorStop(0, `rgba(124,255,107,${0.35 + 0.35*u.beam})`); glow.addColorStop(1, 'rgba(124,255,107,0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(x, y + 8, 60, 26, 0, 0, 7); ctx.fill();
        // dome (behind the hull's top edge)
        const dome = ctx.createLinearGradient(0, y - 22, 0, y - 2);
        dome.addColorStop(0, 'rgba(190,255,225,0.95)'); dome.addColorStop(1, 'rgba(40,150,110,0.75)');
        ctx.fillStyle = dome;
        ctx.beginPath(); ctx.ellipse(x, y - 4, 19, 17, 0, Math.PI, 0); ctx.fill();
        // tiny pilot
        ctx.fillStyle = '#5fd35a';
        ctx.beginPath(); ctx.ellipse(x, y - 9, 6, 6.5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#0d1017';
        ctx.beginPath(); ctx.ellipse(x - 2.4, y - 10, 1.5, 2.2, -0.3, 0, 7); ctx.ellipse(x + 2.4, y - 10, 1.5, 2.2, 0.3, 0, 7); ctx.fill();
        // glass highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x - 5, y - 8, 11, Math.PI*1.15, Math.PI*1.5); ctx.stroke();
        // hull
        const hull = ctx.createLinearGradient(0, y - 8, 0, y + 12);
        hull.addColorStop(0, '#f2f5fa'); hull.addColorStop(0.45, '#a7b0c2'); hull.addColorStop(1, '#3f4656');
        ctx.fillStyle = hull;
        ctx.beginPath(); ctx.ellipse(x, y + 2, 48, 11, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(13,16,23,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
        // rim band + chasing lights
        ctx.fillStyle = '#2b303b';
        ctx.beginPath(); ctx.ellipse(x, y + 4, 44, 5, 0, 0, Math.PI); ctx.fill();
        const n = 9;
        for (let k = 0; k < n; k++){
            const a = Math.PI*(0.08 + 0.84*k/(n-1));
            const lx = x + Math.cos(a)*40, ly = y + 4 + Math.sin(a)*4.2;
            const on = (Math.floor(t*10) + k) % 3 === 0;
            ctx.fillStyle = on ? '#ffffff' : '#7CFF6B';
            ctx.shadowBlur = on ? 10 : 6; ctx.shadowColor = '#7CFF6B';
            ctx.beginPath(); ctx.arc(lx, ly, on ? 2.4 : 1.8, 0, 7); ctx.fill();
        }
        ctx.shadowBlur = 0;
        // emitter
        ctx.fillStyle = `rgba(190,255,180,${0.6 + 0.4*u.beam})`;
        ctx.shadowBlur = 14; ctx.shadowColor = '#7CFF6B';
        ctx.beginPath(); ctx.ellipse(x, y + 12, 11, 3.5, 0, 0, 7); ctx.fill();
        ctx.restore();
    }
}

// Player-vs-player bumping.
//  - Ordinary players still shove each other apart (heavier ones, e.g. in a rocket boost, move less).
//  - A player standing on a platform is never pushed up or down, so someone landing on top of them cannot press them
//    through the platform: the lander is deflected sideways and slides off.
//  - A GIANT dominates: it is never moved by ordinary players, and anyone it hits is thrown away with a hop. A giant is
//    only pushed back by another giant or by a shield.
let bumpTick = 0;
function resolveBumps() {
    bumpTick++;
    for (let i = 0; i < players.length; i++) {
        const p1 = players[i];
        if (p1.dead || p1.gone || p1.finished || p1.ufoHold) continue;
        for (let j = i + 1; j < players.length; j++) {
            const p2 = players[j];
            if (p2.dead || p2.gone || p2.finished || p2.ufoHold) continue;
            const dx = p2.x - p1.x, dy = p2.y - p1.y, rs = p1.r + p2.r;
            const distSq = dx * dx + dy * dy;
            if (distSq >= rs * rs || distSq === 0) continue;
            if (p1.giantT > 0 || p2.giantT > 0) { giantHit(p1, p2, dx); continue; }
            const dist = Math.sqrt(distSq), overlap = rs - dist;
            const idle1 = p1.mode === 'idle', idle2 = p2.mode === 'idle';
            if (idle1 && idle2) {                         // two standing players: nudge apart sideways only
                const s = dx !== 0 ? Math.sign(dx) : (Math.random() < 0.5 ? -1 : 1), push = Math.min(overlap, rs - Math.abs(dx)) * 0.5;
                p1.x -= s * push; p2.x += s * push; p1.vx -= s * 0.5; p2.vx += s * 0.5;
            } else if (idle1 !== idle2) {                 // one stands, one is in the air: only the flyer gives way
                const S = idle1 ? p1 : p2, F = idle1 ? p2 : p1;
                // STOMP: landing on someone's head knocks them down through the platform they stand on
                if (F.vy > 150 && F.y < S.y - 4 && Math.abs(F.x - S.x) < rs * 0.8 && S.plat && !S.plat.ground && !(S._stompTick && bumpTick - S._stompTick < 30)) {
                    if (shieldBlocks(S)) { F.vy = -260; F.vx += (F.x >= S.x ? 1 : -1) * 120; continue; }
                    S._stompTick = bumpTick;
                    S.dropPlat = S.plat; S.dropT = 0.6;
                    S.mode = 'air'; S.plat = null; S.charged = false; S.vx *= 0.3; S.vy = Math.max(620, F.vy); S.squash = 0.6;
                    F.vy = -260; F.squash = 1.3;
                    burst(S.x, S.y + S.r, '#ffffff', 12, 220); ring(S.x, S.y, '#ffffff', 55);
                    if (S.local) { SFX.play('stumble'); haptic([30, 30, 70]); camShake = Math.max(camShake, 7); }
                    else if (F.local) { SFX.play('shatter'); haptic(20); }
                    continue;
                }
                const side = F.x !== S.x ? Math.sign(F.x - S.x) : (Math.random() < 0.5 ? -1 : 1);
                const need = Math.sqrt(Math.max(0, rs * rs - (F.y - S.y) * (F.y - S.y))) + 0.5;   // sideways distance that clears the overlap
                F.x = S.x + side * Math.max(need, Math.abs(F.x - S.x));
                F.vx += side * 80;
                if (F.vy > 0) F.vy *= 0.5;                // soften the fall onto the person below
            } else {                                      // both airborne: classic mass-weighted shove
                const m1 = massOf(p1), m2 = massOf(p2), w1 = m2 / (m1 + m2), w2 = m1 / (m1 + m2);
                const nx = dx / dist, ny = dy / dist;
                p1.x -= nx * overlap * w1; p1.y -= ny * overlap * w1;
                p2.x += nx * overlap * w2; p2.y += ny * overlap * w2;
                p1.vx -= nx * 0.5 * w1 * 2; p2.vx += nx * 0.5 * w2 * 2;
            }
        }
    }
}
function giantHit(p1, p2, dx) {
    const a = p1.giantT > 0 ? p1 : p2, v = a === p1 ? p2 : p1;
    if (v._knockTick && bumpTick - v._knockTick < 24 && !(v.giantT > 0)) return;
    if (a._knockTick && bumpTick - a._knockTick < 24 && v.giantT > 0) return;
    const speed = Math.hypot(a.vx, a.vy);
    const dir = Math.abs(dx) > 4 ? Math.sign(v.x - a.x) : (a.vx !== 0 ? Math.sign(a.vx) : (Math.random() < 0.5 ? -1 : 1));
    if (v.giantT > 0) { knockAway(v, dir, speed, a); knockAway(a, -dir, speed, v); return; }   // giant against giant: both fly
    if (shieldBlocks(v)) { a._knockTick = bumpTick; knockAway(a, -dir, speed * 0.6, v); return; }   // a shield bounces the giant back
    if (p_isRocket(v)) return;                                                                 // too fast to be shoved
    knockAway(v, dir, speed, a);
}
function knockAway(v, dir, srcSpeed, src) {
    v._knockTick = bumpTick;
    v.vx = dir * (520 + Math.min(900, srcSpeed * 0.9)) * (v.giantT > 0 ? 0.55 : 1);
    v.vy = -(430 + Math.min(420, srcSpeed * 0.3));
    v.mode = 'air'; v.plat = null; v.charged = false; v.squash = 1.3;
    if (v.chainT > 0) releaseChain(v);
    burst(v.x, v.y, src.color, 14, 260); ring(v.x, v.y, '#ffffff', 60);
    if (v.local) { SFX.play('stumble'); haptic([40, 30, 60]); camShake = Math.max(camShake, 8); }
    else if (src.local) { SFX.play('shatter'); haptic(25); camShake = Math.max(camShake, 4); }
}

function p_isRocket(p){ return (p.rocketFx||0) > 0.4; }   // mid-boost: too fast to be knocked off course

/* ---------- Update ---------- */
/* ---------- Update ---------- */
function updateCosmeticTrails(dt){
    for (const p of players){
        const trail = TRAIL_BY_ID[p.look && p.look.trail];
        const samples = p.trailSamples || (p.trailSamples = []);
        if (p._lod || p._off){ if (samples.length) samples.length = 0; continue; }   // Gauntlet: nobody sees these
        p.trailEmit -= dt;
        for (const sample of samples) sample.age += dt;
        const tLife = trailLife(trail);
        while (samples.length && samples[0].age > tLife) samples.shift();
        if (!trail || trail.style === 'none' || p.finished || p.ufoHold || Math.hypot(p.vx,p.vy) < 90 || p.trailEmit > 0) continue;
        samples.push({x:p.x,y:p.y,age:0,s:Math.random()});
        if (samples.length > trailMax(trail)) samples.shift();
        p.trailEmit = trailRate(trail);
    }
}
function update(dt) {
    // Pausing just puts a menu on screen — the race itself keeps running underneath,
    // exactly like unpaused play, so nothing about the world or your own square freezes.
    const bgRacing = state === 'paused' && (gameMode === 'race' || gameMode === 'gauntlet');
    if (state !== 'playing' && !bgRacing) return;

    // platforms
    const pw = PLAY_W();
    for (const pl of platforms) {
        if (!pl.active) {
            if (pl.quakeDown > 0) continue;     // quake handles its own timer/respawn
            pl.respawn -= dt;
            if (pl.respawn <= 0){ pl.active=true; pl.breaking=false; pl.breakT=0; burst(pl.x,pl.y,PLAT.normal,10,120); }
            continue;
        }
        if (pl.type==='moving') {
            pl.x += pl.speed*pl.dir*dt;
            const minX = Math.max(pl.w/2, pl.baseX - pl.range);
            const maxX = Math.min(pw - pl.w/2, pl.baseX + pl.range);
            if (pl.x < minX){ pl.x=minX; pl.dir*=-1; }
            if (pl.x > maxX){ pl.x=maxX; pl.dir*=-1; }
        }
        if (pl.breaking) {
            pl.breakT -= dt;
            if (pl.breakT <= 0) {
                pl.active=false; pl.respawn=2.5;
                burst(pl.x,pl.y,PLAT.fragile,26,220);
                for (const p of players) if (p.mode==='idle' && p.plat===pl){ p.mode='air'; p.plat=null; }
            }
        }
    }

    for (const p of players) stepPlayer(p, dt);
    updateCosmeticTrails(dt);

    // Player-vs-player collisions (square bumping)
    resolveBumps();
    updateItemBoxes(dt);
    updateShots(dt);
    updateChains(dt);
    updateShockwaves(dt);
    updateShards(dt);
    updateQuakes(dt);
    updateWindFx(dt);
    updateUfos(dt);
    if (gameMode === 'escape') updateEscape(dt);
    else if (gameMode === 'parkour') updateParkour(dt);
    else if (gameMode === 'level') updateLevel(dt);
    else if (gameMode === 'gauntlet') updateGauntlet(dt);

    // camera — follows you normally, or the player you're spectating after you've finished
    const escapeSpectate = gameMode === 'escape' && players[0].escape.dead
        ? players.reduce((best, p) => !p.escape.dead && (!best || p.y < best.y) ? p : best, null)
        : null;
    const camP = (spectating && spectateTarget && !spectateTarget.finished) ? spectateTarget : (gameMode === 'gauntlet' ? gtCamTarget() : (escapeSpectate || players[0]));
    const targetCam = camP.y - VH*0.62;
    cameraY += (targetCam - cameraY) * Math.min(1, 12*dt);
    if (camShake > 0.1) camShake *= Math.pow(0.001, dt); else camShake = 0;
    if (spectating) updateSpectate();

    // squash relax
    for (const p of players) p.squash += (1 - p.squash) * Math.min(1, 12*dt);

    // DEELTJES RECYCLEN (Hier is de code aangepast)
    let pIdx = 0;
    for (let i = 0; i < particles.length; i++) {
        const q = particles[i];
        q.vy += GRAVITY * 0.35 * dt;
        q.x += q.vx * dt; q.y += q.vy * dt; q.life -= q.decay * dt;
        
        if (q.life > 0) {
            particles[pIdx++] = q;
        } else {
            particlePool.push(q); // Dode deeltjes gaan nu hier de recycle-bak in!
        }
    }
    particles.length = pIdx;
    // Cap live particles (lower on slower quality levels) — the oldest are recycled first.
    const maxP = [320, 180, 100][qLevel] * (gameMode === 'gauntlet' ? 0.5 : 1);
    if (particles.length > maxP) { const dead = particles.splice(0, particles.length - maxP); for (const q of dead) particlePool.push(q); }

    // floaters
    let fIdx = 0;
    for (let i = 0; i < floaters.length; i++) {
        const f = floaters[i]; 
        f.y -= 40 * dt; f.life -= dt * 0.9; 
        if (f.life > 0) floaters[fIdx++] = f;
    }
    floaters.length = fIdx;

    // HUD position
    if (gameMode === 'race') updatePosition();
    updateItemHUD();
    if (hintTimer>0){ hintTimer-=dt; if (hintTimer<=0) hintEl.style.opacity=0; }
}
let lastPlace = 0;
function updatePosition() {
    // rank purely by current height (lower y = higher up). Finished players sit at the top,
    // ordered by their finish time. Falling back down immediately drops your place.
    const rank = players.map(p => ({p, key: p.finished ? -1e9 + p.finishTime : p.y}))
        .sort((a,b)=> a.key - b.key);
    let pos = rank.findIndex(r => r.p.local) + 1;
    if (pos !== lastPlace){
        const el = document.getElementById('pos-pill');
        posNum.textContent = pos;
        document.getElementById('pos-suf').textContent = pos===1 ? 'st' : pos===2 ? 'nd' : pos===3 ? 'rd' : 'th';
        el.className = 'place p' + Math.min(pos, 4);
        if (lastPlace) { void el.offsetWidth; el.classList.add('pop'); }   // pop on every change of place
        lastPlace = pos;
    }
}


/* ---------- End game ---------- */
function checkEnd() {
    if (finishedCount >= 4) {
        state = 'finished';
        setTimeout(showResults, 1100);
    }
}
function showResults() {
    if (typeof stopSpectate === 'function') stopSpectate();
    hud.style.display='none';
    const sorted = [...players].sort((a,b)=>{
        if (a.finished && b.finished) return a.finishTime-b.finishTime;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return a.y - b.y;
    });
    const you = sorted.findIndex(p=>p.local)+1;
    const sub = document.getElementById('result-sub');
    const msgs = ["Unbeatable.","Silver, so close.","Bronze, solid.","Fourth. Rage!"];
    const localP = players.find(p => p.local);
    const rw = rewardRace(you, !!(localP && localP.finished), matchLootId);
    sub.innerHTML = (msgs[you-1] || "") + (rw.noDrop ? `  ·  ${R('coin', rw.coins, {plus:true})}${R('xp', rw.xp, {plus:true})}${R('pass', rw.passPoints, {plus:true})}` : '') + (rewardRace.keyEarned ? `  ·  ${R('key', 1, {plus:true})}` : '');
    if (rewardRace.keyEarned) toast('Gauntlet key earned');
    sub.style.color = you===1 ? 'var(--gold)' : 'var(--muted)';

    const board = document.getElementById('board');
    board.innerHTML='';
    sorted.forEach((p,i)=>{
        const row=document.createElement('div');
        row.className = 'row' + (i===0?' first':'') + (p.local?' you':'');
        const t = p.finished ? p.finishTime.toFixed(2)+'s' : 'DNF';
        row.innerHTML = `<span class="rank">${i+1}</span>
            <span class="pip" style="background:${p.color}"></span>
            <span>${p.name}</span><span class="time">${t}</span>`;
        board.appendChild(row);
    });
    if (rw.noDrop) document.getElementById('loot-race').innerHTML = ''; else renderLootDrop('loot-race', rw);
    showScreen('results');
}

/* ---------- Draw ---------- */
function drawCosmeticTrails(viewTop, viewBottom){
    for (const p of players){
        if (p._lod || p._off) continue;
        const trail = TRAIL_BY_ID[p.look && p.look.trail];
        const samples = p.trailSamples;
        if (!trail || trail.style === 'none' || !samples || !samples.length) continue;
        const visible = samples.filter(sample => sample.y >= viewTop && sample.y <= viewBottom);
        if (trail.fx){ drawTrailFx(ctx, trail, visible, p.id); continue; }
        if ((trail.style === 'ribbon' || trail.style === 'comet') && visible.length > 1){
            ctx.save(); ctx.globalAlpha = 0.36; ctx.strokeStyle = trail.color; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); visible.forEach((sample,i) => i ? ctx.lineTo(sample.x,sample.y) : ctx.moveTo(sample.x,sample.y)); ctx.stroke(); ctx.restore();
        }
        for (const sample of visible){
            const fade = Math.max(0, 1 - sample.age/0.52);
            const size = 2 + fade*3.5;
            ctx.globalAlpha = fade * (trail.style === 'soft' ? 0.42 : 0.78);
            ctx.fillStyle = trail.style === 'prism' || trail.style === 'nebula' ? `hsl(${(sample.age*(trail.style === 'prism' ? 520 : 260) + p.id*77)%360} 95% 68%)` : trail.color;
            if (trail.style === 'spark' || trail.style === 'star'){
                ctx.save(); ctx.translate(sample.x,sample.y); ctx.rotate((sample.age*8+p.id)%6.28); ctx.fillRect(-size/2,-size/2,size,size); ctx.restore();
            } else if (trail.style === 'frost'){
                ctx.save();ctx.translate(sample.x,sample.y);ctx.rotate(Math.PI/4);ctx.fillRect(-size*.35,-size*.35,size*.7,size*.7);ctx.restore();
                ctx.fillRect(sample.x-size*.85,sample.y-.6,size*1.7,1.2);
            } else if (trail.style === 'blueprint'){
                ctx.fillRect(sample.x-size*.8,sample.y-.6,size*1.6,1.2);ctx.fillRect(sample.x-.6,sample.y-size*.8,1.2,size*1.6);
            } else if (trail.style === 'ember'){
                ctx.beginPath();ctx.moveTo(sample.x,sample.y-size*.8);ctx.lineTo(sample.x+size*.45,sample.y+size*.5);ctx.lineTo(sample.x-size*.45,sample.y+size*.5);ctx.closePath();ctx.fill();
            } else if (trail.style === 'glitch'){
                const jitter=((Math.floor(sample.age*90)+p.id)%3-1)*size*.65;ctx.fillRect(sample.x+jitter-size*.55,sample.y-size*.25,size*1.1,size*.5);
            } else if (trail.style === 'orbit'){
                ctx.beginPath();ctx.ellipse(sample.x,sample.y,size*.8,size*.38,sample.age*7,0,Math.PI*2);ctx.strokeStyle=trail.color;ctx.lineWidth=.8;ctx.stroke();
                ctx.beginPath();ctx.arc(sample.x+Math.cos(sample.age*7)*size*.7,sample.y+Math.sin(sample.age*7)*size*.35,size*.2,0,7);ctx.fill();
            } else {
                ctx.beginPath(); ctx.arc(sample.x,sample.y,size/2,0,Math.PI*2); ctx.fill();
            }
        }
    }
    ctx.globalAlpha = 1;
}

function draw() {
    ctx.fillStyle = (gameMode === 'gauntlet' && window.GT_BG) || '#0d1017';   // Gauntlet stages tint the floor colour (a cheap sky)
    ctx.fillRect(0,0,CW,CH);
    if (state==='menu') return;
    if (gameMode === 'parkour') drawParkourSky();
    else if (gameMode === 'level') drawLevelSky();
    else if (gameMode === 'gauntlet') gtDrawSky();

    ctx.save();
    const shakeX = (Math.random()-0.5)*camShake;
    const shakeY = (Math.random()-0.5)*camShake;
    ctx.translate(VIEW_OX + shakeX, shakeY);
    ctx.scale(VIEW_K, VIEW_K);
    ctx.translate(0, -cameraY);

    // OPTIMALISATIE: Bereken de zichtbare grenzen 1x (culling)
    const viewTop = cameraY - 100;
    const viewBottom = cameraY + VH + 100;

    // depth grid
    ctx.strokeStyle='rgba(255,255,255,0.035)'; ctx.lineWidth=1;
    const startG = Math.floor(cameraY/120)*120;
    for (let gy=startG; gy<cameraY+VH+120; gy+=120){
        ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(PLAY_W(),gy); ctx.stroke();
    }
    // progress markers every 2000px
    ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.font='700 12px Space Grotesk'; ctx.textAlign='left';
    if (gameMode === 'race') for (let my=Math.floor(START_Y/2000)*2000; my>FINISH_Y; my-=2000){
        if (my<cameraY-40||my>cameraY+VH+40) continue;
        const pct = Math.round((START_Y-my)/TRACK*100);
        ctx.fillText(pct+'%', 8, my-6);
        ctx.strokeStyle='rgba(255,255,255,0.04)';
        ctx.beginPath(); ctx.moveTo(0,my); ctx.lineTo(PLAY_W(),my); ctx.stroke();
    }

    // trajectory preview
    const lp = players[0];
    if ((state==='playing' || state==='countdown') && dragging && lp.mode==='idle' && !lp.finished) {
        let dx=sx-cx, dy=sy-cy; const d=Math.hypot(dx,dy);
        if (d>14){
            if (d>MAX_DRAG){ dx=dx/d*MAX_DRAG; dy=dy/d*MAX_DRAG; }
            const col = lp.charged ? 'rgba(53,224,200,0.85)' : lp.chainT>0 ? 'rgba(255,140,160,0.7)' : 'rgba(255,255,255,0.7)';
            if (gameMode === 'parkour' || gameMode === 'level') {
                // Parkour rules: only direction and power, never a hint of where you'll land.
                // A plain arrow whose length tracks how far you've dragged, up to MAX_DRAG —
                // past that it simply stops growing.
                const len = Math.min(d, MAX_DRAG) * 0.28;
                const ang = Math.atan2(dy, dx);
                const ex = lp.x + Math.cos(ang)*len, ey = lp.y + Math.sin(ang)*len;
                ctx.save();
                ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(lp.x, lp.y); ctx.lineTo(ex, ey); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(ex + Math.cos(ang)*7, ey + Math.sin(ang)*7);
                ctx.lineTo(ex + Math.cos(ang+2.6)*6, ey + Math.sin(ang+2.6)*6);
                ctx.lineTo(ex + Math.cos(ang-2.6)*6, ey + Math.sin(ang-2.6)*6);
                ctx.closePath(); ctx.fillStyle = col; ctx.fill();
                ctx.restore();
            } else {
                const mult = playerPowMul(lp, false);
                const G = playerG(lp);
                let X=lp.x, Y=lp.y, VX=dx*POWER*mult, VY=dy*POWER*mult;
                const pw=PLAY_W();
                ctx.fillStyle = col;
                for(let i=0;i<26;i++){
                    // two exact physics steps per dot (same integration as the game)
                    for(let k=0;k<2;k++){
                        VY+=G*SIM_DT; if(VY>2600)VY=2600; X+=VX*SIM_DT; Y+=VY*SIM_DT;
                        if(X<lp.r){X=lp.r;VX*=-0.45;} if(X>pw-lp.r){X=pw-lp.r;VX*=-0.45;}
                    }
                    const rr = 3.2 - i*0.08;
                    ctx.globalAlpha = Math.max(0.12, 1 - i/26);
                    ctx.beginPath(); ctx.arc(X,Y,Math.max(1,rr),0,7); ctx.fill();
                }
                ctx.globalAlpha=1;
            }
        }
    }

    // platforms
    for (const pl of platforms) {
        // Gebruik de nieuwe snelle view bounds
        if (pl.y < viewTop || pl.y > viewBottom) continue;
        
        if (pl.quakeDown > 0) continue;               // fully gone while the quake holds it down
        let shakeX = 0, shakeY = 0;
        if (pl.quakeWarn > 0){
            const k = 1 - pl.quakeWarn/QUAKE_WARN;    // ramps up as the collapse gets closer
            const amt = 2 + k*5;
            shakeX = (Math.random()-0.5)*amt; shakeY = (Math.random()-0.5)*amt*0.5;
        }
        ctx.save(); ctx.translate(pl.x + shakeX, pl.y + shakeY);
        if (!pl.active) {
            ctx.globalAlpha = Math.max(0, 0.25*(1-pl.respawn/2.5));
            ctx.fillStyle=PLAT.fragile; roundRect(-pl.w/2,-pl.h/2,pl.w,pl.h,4); ctx.fill();
            ctx.globalAlpha=1; ctx.restore(); continue;
        }
        // Draw the slide-range track for moving platforms (in world space, before local translate)
        if (pl.type==='moving' && pl.range>0){
            ctx.save();
            ctx.translate(-pl.x, -pl.y); // undo local translate to draw at absolute coords
            const trackY = pl.y;
            const minC = Math.max(pl.w/2, pl.baseX - pl.range);
            const maxC = Math.min(PLAY_W() - pl.w/2, pl.baseX + pl.range);
            const leftX = minC - pl.w/2;
            const rightX = maxC + pl.w/2;
            ctx.strokeStyle='rgba(124,107,255,0.22)';
            ctx.lineWidth=3; ctx.lineCap='round';
            ctx.beginPath(); ctx.moveTo(leftX, trackY); ctx.lineTo(rightX, trackY); ctx.stroke();
            ctx.fillStyle='rgba(124,107,255,0.40)';
            [leftX,rightX].forEach(ex=>{ ctx.fillRect(ex-2, trackY-7, 4, 14); });
            ctx.restore();
        }

        let col = PLAT[pl.type] || '#4ade80';
        if (pl.type==='fragile' && pl.breaking){
            const s=(1-pl.breakT)*5;
            ctx.translate((Math.random()-0.5)*s,(Math.random()-0.5)*s);
            col = (Math.floor(Date.now()/70)%2) ? '#fff' : PLAT.fragile;
        }
        if (pl.quakeWarn > 0 && Math.floor(pl.quakeWarn*10)%2===0){ col = ITEMS.quake.color; }
        if (pl.type==='ice'||pl.type==='boost'){ ctx.shadowBlur=12; ctx.shadowColor=col; }
        if (pl.quakeWarn > 0){ ctx.shadowBlur=14; ctx.shadowColor=ITEMS.quake.color; }
        ctx.fillStyle=col;
        roundRect(-pl.w/2,-pl.h/2,pl.w,pl.h,5); ctx.fill();
        ctx.shadowBlur=0;

        if (pl.ceiling){
            const uh = 18, w = pl.w;
            const t = performance.now()/1000;
            const pulse = 0.5 + 0.5*Math.sin(t*2.4 + pl.x*0.01);
            ctx.save();
            ctx.shadowBlur = 14 + pulse*12; ctx.shadowColor = '#ffb238';
            const rockGrad = ctx.createLinearGradient(0, pl.h/2, 0, pl.h/2+uh);
            rockGrad.addColorStop(0, '#6b7488'); rockGrad.addColorStop(0.55, '#454c5c'); rockGrad.addColorStop(1, '#22262f');
            ctx.fillStyle = rockGrad;
            ctx.beginPath(); ctx.moveTo(-w/2, pl.h/2);
            const teeth = Math.max(5, Math.round(w/13));
            const toothY = [];
            for (let i=0;i<=teeth;i++){
                const tx = -w/2 + (w*i/teeth);
                const ty = pl.h/2 + uh + (i%2===0 ? 0 : -6) + Math.sin(i*1.7+pl.x)*3;
                toothY.push(ty);
                ctx.lineTo(tx, ty);
            }
            ctx.lineTo(w/2, pl.h/2); ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0;
            const chunkN = Math.max(1, Math.round(w/95));
            for (let i=0;i<chunkN;i++){
                const cx = -w/2 + w*(i+0.5)/chunkN + Math.sin(i*7+pl.x)*10;
                const cy = pl.h/2 + uh*0.6;
                ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(i*3+pl.x)*0.3);
                ctx.fillStyle = '#363c48';
                ctx.beginPath(); ctx.moveTo(-6,-3); ctx.lineTo(5,-5); ctx.lineTo(6,4); ctx.lineTo(-4,6); ctx.closePath(); ctx.fill();
                ctx.restore();
            }
            ctx.strokeStyle = 'rgba(8,9,12,0.75)'; ctx.lineWidth = 2.2;
            const cracks = Math.max(3, Math.round(w/38));
            for (let i=1;i<cracks;i++){
                const cx = -w/2 + w*i/cracks + Math.sin(i*3+pl.y)*6;
                ctx.beginPath(); ctx.moveTo(cx, -pl.h*0.15);
                ctx.lineTo(cx + 3, pl.h/2 * 0.6);
                ctx.lineTo(cx - 4, pl.h/2);
                ctx.lineTo(cx + 2, pl.h/2 + uh*0.6);
                ctx.lineTo(cx - 3, pl.h/2 + uh*0.95);
                ctx.stroke();
            }
            ctx.strokeStyle = `rgba(255,178,56,${0.6+pulse*0.4})`; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-w/2, pl.h/2+1.5); ctx.lineTo(w/2, pl.h/2+1.5); ctx.stroke();
            ctx.restore();
        }

        if (pl.type==='finish'){
            ctx.fillStyle='#0d1017';
            for(let i=0;i<pl.w;i+=18){
                ctx.fillRect(-pl.w/2+i,-pl.h/2,9,pl.h/2);
                ctx.fillRect(-pl.w/2+i+9,0,9,pl.h/2);
            }
        }
        if (pl.type==='boost'){
            ctx.fillStyle='#05201c'; ctx.textAlign='center'; ctx.font='800 12px Space Grotesk';
            ctx.beginPath();
            ctx.moveTo(-6,3); ctx.lineTo(0,-5); ctx.lineTo(6,3); ctx.lineTo(2,3); ctx.lineTo(2,6); ctx.lineTo(-2,6); ctx.lineTo(-2,3);
            ctx.closePath(); ctx.fill();
        }
        if (pl.type==='safety'){
            ctx.fillStyle='rgba(13,16,23,0.30)';
            const n=Math.floor(pl.w/26);
            for(let i=0;i<n;i++){
                const bx=-pl.w/2 + 13 + i*26;
                ctx.beginPath();
                ctx.moveTo(bx-5, 3); ctx.lineTo(bx, -3); ctx.lineTo(bx+5, 3);
                ctx.lineTo(bx+3, 4); ctx.lineTo(bx, 0); ctx.lineTo(bx-3, 4);
                ctx.closePath(); ctx.fill();
            }
        }
        ctx.restore();
    }

    drawItemBoxes();
    if (gameMode === 'escape') drawEscapeWorldBack();
    else if (gameMode === 'parkour') drawParkourWorldBack();
    else if (gameMode === 'gauntlet') gtDrawWorldBack(viewTop, viewBottom);
    drawShockwaves();
    drawChains();
    drawWindFx();
    drawUfoBeams();

    // OPTIMALISATIE DEELTJES (Particles)
    for (const q of particles){
        // Negeer deeltjes die buiten beeld vallen
        if (q.y < viewTop || q.y > viewBottom) continue;
        ctx.globalAlpha=Math.max(0,q.life);
        ctx.fillStyle=q.color;
        // Vierkanten (fillRect) zijn enorm veel sneller dan cirkels (arc)
        ctx.fillRect(q.x - q.size/2, q.y - q.size/2, q.size, q.size);
    }
    ctx.globalAlpha=1;
    drawShards();

    // floaters
    for (const f of floaters){
        if (f.y < viewTop) continue; // Floaters culling
        ctx.globalAlpha=Math.max(0,f.life); ctx.fillStyle=f.color;
        ctx.font='800 18px Bricolage Grotesque'; ctx.textAlign='center';
        ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha=1;

    drawCosmeticTrails(viewTop, viewBottom);

    // players
    const nowT = performance.now()/1000;
    if (gameMode === 'gauntlet') gtPrepareDraw(viewTop, viewBottom);
    for (const p of players){
        if (p.finished) continue;
        
        // OPTIMALISATIE SPELERS: Sla over als hij ver buiten beeld is
        if (p.y + p.r < viewTop || p.y - p.r > viewBottom) continue;

        const k = p.r/BASE_R;
        if ((p.rocketFx||0) > 0) drawRocketUnder(p);
        let shakeX = 0, shakeY = 0;
        if (p.quakePending > 0){
            const k2 = 1 - p.quakePending/QUAKE_WARN;
            const amt = 2 + k2*6;
            shakeX = (Math.random()-0.5)*amt; shakeY = (Math.random()-0.5)*amt*0.6;
        }
        ctx.save(); ctx.translate(p.x+shakeX,p.y+shakeY);
        let alpha = p.local ? 1 : 0.8;
        if (p.giantT > 0 && p.giantT < 1.6 && Math.floor(nowT*12) % 2 === 0) alpha *= 0.45;   // about to shrink
        ctx.globalAlpha = alpha;

        // squash & stretch
        if (p.mode==='air'){
            const sp=Math.hypot(p.vx,p.vy);
            const st=Math.max(1,Math.min(1.5,1+sp/1600));
            const ang=Math.atan2(p.vy,p.vx);
            ctx.rotate(ang); ctx.scale(st,1/st); ctx.rotate(-ang);
        } else {
            ctx.scale(1/p.squash, p.squash);
        }

        // glow
        if (p.quakePending > 0 && Math.floor(p.quakePending*10)%2===0){ ctx.shadowBlur=24; ctx.shadowColor=ITEMS.quake.color; }
        else if (p.giantT > 0){ ctx.shadowBlur=26; ctx.shadowColor=ITEMS.giant.color; }
        else if (p.shieldT > 0){ ctx.shadowBlur=16+4*Math.sin(nowT*6); ctx.shadowColor=ITEMS.shield.color; }
        else if (p.windT > 0){ ctx.shadowBlur=14+8*Math.abs(Math.sin(nowT*8)); ctx.shadowColor=ITEMS.wind.color; }
        else if (p.bounceT > 0){ ctx.shadowBlur=18+6*Math.sin(nowT*10); ctx.shadowColor=ITEMS.bounce.color; }
        else if (p.local){ ctx.shadowBlur=16; ctx.shadowColor=p.color; }
        else { ctx.shadowBlur=0; }   // idle bots: no glow

        // SQUARE body
        const s = p.r;
        if (p._lod && p._spr){
            // Gauntlet crowd: a cached picture of the whole look (body, face, hat) instead of re-drawing every layer
            const f = s / GT_SPRITE.half;
            ctx.drawImage(p._spr, -GT_SPRITE.w / 2 * f, -GT_SPRITE.cy * f, GT_SPRITE.w * f, GT_SPRITE.h * f);
        } else {
        if (p.look && p.look.skin){ drawSkinBody(ctx, s, k, skinById(p.look.skin)); }
        else { ctx.fillStyle = p.color; roundRect(-s, -s, s*2, s*2, 4*k); ctx.fill(); }
        ctx.shadowBlur=0;
        if (p.chainT > 0){ ctx.fillStyle='rgba(17,20,28,0.30)'; roundRect(-s,-s,s*2,s*2,4*k); ctx.fill(); }
        ctx.strokeStyle='rgba(13,16,23,0.55)'; ctx.lineWidth=2*Math.sqrt(k);
        roundRect(-s,-s,s*2,s*2,4*k); ctx.stroke();

        // eyes
        ctx.fillStyle='#0d1017';
        const lx=Math.max(-3,Math.min(3,p.vx/500))*k, ly=Math.max(-2,Math.min(2,p.vy/900))*k;
        ctx.beginPath(); ctx.arc(-4*k+lx,-2*k+ly,2.4*k,0,7); ctx.arc(4*k+lx,-2*k+ly,2.4*k,0,7); ctx.fill();
        if (p.chainT > 0){          
            ctx.strokeStyle='#0d1017'; ctx.lineWidth=1.6*k; ctx.beginPath();
            ctx.moveTo(-7*k,-7*k); ctx.lineTo(-2*k,-5.5*k); ctx.moveTo(7*k,-7*k); ctx.lineTo(2*k,-5.5*k); ctx.stroke();
        }
        if (p.look){ drawFaceAcc(ctx, s, k, p.look.face); drawHatAcc(ctx, s, k, p.look.hat, nowT); }
        }
        ctx.shadowBlur=0;
        
        // SHIELD
        if (p.shieldT > 0){
            const fade = Math.min(1, p.shieldT/1.2);   
            const flicker = p.shieldT < 1.2 ? (Math.floor(nowT*14)%2===0 ? 1 : 0.3) : 1;
            ctx.globalAlpha = 0.55*fade*flicker;
            ctx.strokeStyle = ITEMS.shield.color; ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.arc(0, 0, s*1.7, 0, 7); ctx.stroke();
            ctx.globalAlpha = 0.12*fade*flicker;
            ctx.fillStyle = ITEMS.shield.color;
            ctx.beginPath(); ctx.arc(0, 0, s*1.7, 0, 7); ctx.fill();
            ctx.globalAlpha = 1;
        }
        ctx.restore();

        // super bounce
        let tagY = p.y - p.r - 8;
        if (p.bounceT > 0){
            const py = p.y - p.r - 12, frac = p.bounceT/BOUNCE_TIME;
            ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2.4;
            ctx.beginPath(); ctx.arc(p.x, py, 6, 0, 7); ctx.stroke();
            ctx.strokeStyle = ITEMS.bounce.color; ctx.shadowBlur = 8; ctx.shadowColor = ITEMS.bounce.color;
            ctx.beginPath(); ctx.arc(p.x, py, 6, -Math.PI/2, -Math.PI/2 + frac*2*Math.PI); ctx.stroke();
            ctx.shadowBlur = 0;
            tagY -= 16;
        }
        // name tag
        if (!p.local && !p._lod && !p._noName){
            const hatLift = (p.look && p.look.hat && p.look.hat !== 'none') ? 12 * (p.r / 12) : 0;
            ctx.globalAlpha=0.65; ctx.fillStyle='#fff'; ctx.font='700 10px Space Grotesk'; ctx.textAlign='center';
            ctx.fillText(p.name, p.x, tagY - hatLift);
            if (p.rkColor){ const tw = ctx.measureText(p.name).width / 2 + 7; ctx.fillStyle = p.rkColor; ctx.beginPath(); ctx.moveTo(p.x - tw, tagY - hatLift - 8); ctx.lineTo(p.x - tw + 3.5, tagY - hatLift - 4.5); ctx.lineTo(p.x - tw, tagY - hatLift - 1); ctx.lineTo(p.x - tw - 3.5, tagY - hatLift - 4.5); ctx.closePath(); ctx.fill(); }
            ctx.globalAlpha=1;
        }
    }
    drawUfoCraft();
    if (gameMode === 'escape') drawEscapeWorldFront();
    else if (gameMode === 'gauntlet') gtDrawWorldFront(viewTop, viewBottom);
    ctx.restore();

    if (VIEW_OX > 0.5){                              
        const x1 = VIEW_OX + WORLD_W * VIEW_K, pw = SCREEN_PW();
        ctx.fillStyle = 'rgba(5,7,11,0.72)';
        ctx.fillRect(0, 0, VIEW_OX, CH); ctx.fillRect(x1, 0, pw - x1, CH);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(VIEW_OX - 1, 0, 1, CH); ctx.fillRect(x1, 0, 1, CH);
    }
    drawWindOverlayForLocal();
    if (gameMode === 'escape'){ drawEscapeOverlay(); drawEscapeGauge(); }
    else if (gameMode === 'parkour') drawParkourGauge();
    else if (gameMode === 'level') drawLevelGauge();
    else if (gameMode === 'gauntlet'){ gtDrawOverlay(); gtDrawGauge(); }
    else drawMinimap();
}


function roundRect(x,y,w,h,r){
    // Gebruik de supersnelle native methode als de browser dit ondersteunt
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        return;
    }
    // Fallback voor zeer oude browsers
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}


function drawMinimap() {
    const x0 = CW - SIDEBAR;
    ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fillRect(x0,0,SIDEBAR,CH);
    ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.moveTo(x0,0); ctx.lineTo(x0,CH); ctx.stroke();
    // finish flag at top
    ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font='800 8px Space Grotesk'; ctx.textAlign='center';
    ctx.fillText('TOP', x0+SIDEBAR/2, 14);
    const top=24, bot=CH-16;
    const nowT = performance.now()/1000;
    for (const p of players){
        const effY = p.finished ? FINISH_Y : p.y;    // finished players sit at the top; everyone else shows their ACTUAL current spot
        const pct=Math.max(0,Math.min(1,(START_Y-effY)/TRACK));
        const my = bot - (bot-top)*pct;
        const cx = x0+SIDEBAR/2;

        // Subtle status ring/icon so you can tell what's happening to someone at a glance —
        // a Giant on the map, a chained straggler, a shielded runner, etc.
        let statusCol = null, pulse = false;
        if (p.giantT > 0)          { statusCol = ITEMS.giant.color; }
        else if (p.chainT > 0)     { statusCol = '#ff5470'; }
        else if (p.quakePending>0) { statusCol = ITEMS.quake.color; pulse = true; }
        else if (p.shieldT > 0)    { statusCol = ITEMS.shield.color; }
        else if (p.windT > 0)      { statusCol = ITEMS.wind.color; }
        else if (p.bounceT > 0)    { statusCol = ITEMS.bounce.color; }
        else if ((p.rocketFx||0)>0){ statusCol = ITEMS.rocket.color; }

        const dotR = p.local?7:5;
        if (statusCol){
            ctx.globalAlpha = pulse ? (0.35 + 0.35*Math.sin(nowT*10)) : 0.55;
            ctx.strokeStyle = statusCol; ctx.lineWidth = 2.4;
            ctx.beginPath(); ctx.arc(cx, my, dotR+4, 0, 7); ctx.stroke();
            ctx.globalAlpha = 1;
        }
        ctx.beginPath(); ctx.arc(cx, my, dotR, 0,7);
        ctx.fillStyle=p.color; ctx.fill();
        if (p.local){ ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke(); }
    }
}

/* ---------- Loop ---------- */
let simAcc = 0, hitStop = 0, drewOnce = false;
const SNAP_HZ = [30, 60, 90, 120, 144];
/* ---------- Render interpolation ---------- */
let prevCam = 0;
function snapshotPrev(){
    for (const p of players){ p._px = p.x; p._py = p.y; }
    for (const pl of platforms){ if (pl.type === 'moving') pl._px = pl.x; }
    prevCam = cameraY;
}
function applyInterp(a){
    const saved = [];
    for (const p of players){
        if (p._px === undefined || Math.abs(p.x - p._px) > 150 || Math.abs(p.y - p._py) > 150) continue;   // teleport/respawn: no blend
        saved.push(p, p.x, p.y);
        p.x = p._px + (p.x - p._px) * a; p.y = p._py + (p.y - p._py) * a;
    }
    const sp = [];
    for (const pl of platforms){
        if (pl.type !== 'moving' || pl._px === undefined || Math.abs(pl.x - pl._px) > 150) continue;
        sp.push(pl, pl.x); pl.x = pl._px + (pl.x - pl._px) * a;
    }
    const realCam = cameraY;
    if (Math.abs(cameraY - prevCam) < 150) cameraY = prevCam + (cameraY - prevCam) * a;
    return () => {
        for (let i = 0; i < saved.length; i += 3){ saved[i].x = saved[i+1]; saved[i].y = saved[i+2]; }
        for (let i = 0; i < sp.length; i += 2) sp[i].x = sp[i+1];
        cameraY = realCam;
    };
}

let qSlow = 0, qFast = 0;
function adaptQuality(rawDt){
    if (rawDt > 0.1) return;                          // tab switch / hitch, ignore
    if (rawDt > 0.024) { qSlow++; qFast = 0; } else { qFast++; qSlow = Math.max(0, qSlow - 1); }
    if (qSlow >= 45 && qLevel < QUALITY_STEPS.length - 1) {   // ~45 slow frames: step down
        qLevel++; dprCap = QUALITY_STEPS[qLevel].dpr; glowK = QUALITY_STEPS[qLevel].glow;
        qSlow = 0; resize();
    }
}
function loop(t){
    let dt=(t-last)/1000; last=t;
    adaptQuality(dt);
    if (dt>0.25) dt=0.25;            // tab switch / long hitch: don't try to catch up more than this
    for (const hz of SNAP_HZ){ const iv = 1/hz; if (Math.abs(dt - iv) < iv*0.06){ dt = iv; break; } }
    if (hitStop > 0){ hitStop -= dt; simAcc += dt * 0.2; }
    else simAcc += dt;
    let steps = 0;
    while (simAcc >= SIM_DT - 1e-6 && steps < 10) { snapshotPrev(); update(SIM_DT); simAcc -= SIM_DT; steps++; }
    if (simAcc < 0) simAcc = 0;
    if (steps === 10) simAcc %= SIM_DT;   // only throw away whole steps we truly can't afford

    // The simulation runs at a fixed 60 Hz, but screens refresh at 60/90/120 Hz and frame times
    // jitter. Draw the world blended between the last two sim states so motion stays even.
    const a = Math.min(1, simAcc / SIM_DT);
    const restore = applyInterp(a);
    draw();
    restore();
    drewOnce = true;

    requestAnimationFrame(loop);
}


/* ---------- Flow ---------- */
function buildLobby(revealBots) {
    const panel = document.getElementById('lobby-panel');
    const rows = [
        {name:'YOU', col:PCOL[0], ready:true},
        {name:null, col:PCOL[1]},
        {name:null, col:PCOL[2]},
        {name:null, col:PCOL[3]},
    ];
    panel.innerHTML='';
    rows.forEach((r,i)=>{
        const div=document.createElement('div');
        const revealed = i===0 || revealBots[i];
        div.className='slot'+(revealed?'':' empty');
        if (revealed){
            div.innerHTML=`<span class="pip" style="background:${r.col}"></span>
                <span>${i===0?'YOU':revealBots[i]}</span>
                <span class="status ready">Ready</span>`;
        } else {
            div.innerHTML=`<span class="pip" style="background:rgba(255,255,255,.1)"></span>
                <span>Joining…</span><div class="spinner"></div>`;
        }
        panel.appendChild(div);
    });
}

/* ---------- Pause / quit / "all bots finished" prompt ---------- */
let botsDonePrompted = false, pauseStart = 0;
function openPrompt(title, sub, buttons) {
    if (state !== 'playing') return;
    state = 'paused'; dragging = false; pauseStart = Date.now();
    document.getElementById('pause-title').textContent = title;
    document.getElementById('pause-sub').textContent = sub;
    const box = document.getElementById('pause-btns');
    box.innerHTML = '';
    buttons.forEach(([label, fn, ghost]) => {
        const b = document.createElement('button');
        b.className = 'btn' + (ghost ? ' ghost' : '');
        b.textContent = label;
        b.addEventListener('click', fn);
        box.appendChild(b);
    });
    showScreen('pause');
}
function resumeRace() {
    showScreen('');
    matchStart += Date.now() - pauseStart;   // paused time doesn't count
    state = 'playing';
}
function quitToMenu() {
    if (typeof stopSpectate === 'function') stopSpectate();
    state = 'menu'; dragging = false;
    hud.style.display = 'none';
    if (gameMode === 'parkour') pkWriteSave();          // leaving mid-climb keeps your spot
    if (window.rankedMatch) Ranked.forfeit(true);
    if (gameMode === 'gauntlet') gtLeave(true);
    gameMode = 'race'; document.body.classList.remove('mode-escape', 'mode-parkour', 'mode-level', 'mode-gauntlet'); lv = null;
    refreshStartMeta();
    showScreen('start');
}
function restartRace() {
    if (typeof stopSpectate === 'function') stopSpectate();
    state = 'menu'; dragging = false;
    hud.style.display = 'none';
    if (gameMode === 'escape') startEscape();
    else if (gameMode === 'parkour') { pkClearSave(); pkStart(null); }   // "Restart" = a fresh climb from the ground
    else if (gameMode === 'level') lvStart(lv.idx);
    else if (gameMode === 'gauntlet') gtForfeit();
    else startMatchmaking();
}
function giveUpToResults() {
    state = 'finished';
    showScreen('');
    showResults();
}
function syncSettingsUI(){
    const mOn = SFX.music.on, sOn = !SFX.muted;
    document.getElementById('set-music-on').classList.toggle('on', mOn);
    document.getElementById('set-sfx-on').classList.toggle('on', sOn);
    document.getElementById('set-haptics').classList.toggle('on', hapticsOn);
    document.getElementById('set-music-vol').value = Math.round(SFX.musVol * 100);
    document.getElementById('set-sfx-vol').value = Math.round(SFX.sfxVol * 100);
}
let settingsReturn = 'start';
function openSettings(from){ settingsReturn = from || 'start'; syncSettingsUI(); showScreen('settings'); }
document.getElementById('btn-settings').addEventListener('click', () => openSettings('start'));
document.getElementById('set-close').addEventListener('click', () => showScreen(settingsReturn));
document.getElementById('btn-gems').addEventListener('click', () => { menuTab('shop'); renderShop('resources'); SFX.play('count'); });
document.getElementById('set-haptics').addEventListener('click', () => {
    hapticsOn = !hapticsOn; try { localStorage.setItem('rr_haptics', hapticsOn ? '1' : '0'); } catch(e){}
    document.getElementById('set-haptics').classList.toggle('on', hapticsOn); if (hapticsOn) haptic(30);
});
document.getElementById('set-music-on').addEventListener('click', () => {
    const on = SFX.music.toggle();
    if (on){ SFX.setMuted(false); SFX.music.set(state === 'menu' ? 'menu' : 'race'); }
    syncSettingsUI(); syncMuteBtn();
});
document.getElementById('set-sfx-on').addEventListener('click', () => {
    SFX.setMuted(!SFX.muted);
    if (!SFX.muted) SFX.play('item'); else SFX.music.set(SFX.music.on ? (state==='menu'?'menu':'race') : null);
    syncSettingsUI(); syncMuteBtn();
});
document.getElementById('set-music-vol').addEventListener('input', e => SFX.setMusVol(e.target.value/100));
document.getElementById('set-sfx-vol').addEventListener('input', e => { SFX.setSfxVol(e.target.value/100); });
document.getElementById('set-sfx-vol').addEventListener('change', () => SFX.play('coin'));
document.getElementById('set-test').addEventListener('click', () => SFX.play('finish'));
document.getElementById('set-reset').addEventListener('click', () => {
    const panel = document.querySelector('#s-settings .set-panel');
    if (panel.querySelector('.set-confirm')) return;
    const box = document.createElement('div');
    box.className = 'set-confirm';
    box.innerHTML = '<p>Reset everything? This wipes coins, skins, stars, records and stats. It cannot be undone.</p>';
    const yes = document.createElement('button'); yes.className = 'btn'; yes.textContent = 'Yes, reset';
    const no = document.createElement('button'); no.className = 'btn ghost'; no.style.marginTop = '10px'; no.textContent = 'Cancel';
    yes.addEventListener('click', () => {
        ['rr_coins','rr_profile','rr_esc_best_score','rr_pk_best','rr_pk_best_time','rr_pk_save_v1','rr_pk_levels_v1','rr_pk_levels_v2'].forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
        if (window.Cloud) Cloud.afterReset();
        refreshStartMeta(); showScreen('start');
    });
    no.addEventListener('click', () => box.remove());
    box.appendChild(yes); box.appendChild(no);
    panel.appendChild(box);
    try { box.scrollIntoView({ block:'nearest' }); } catch(e){}
});
document.getElementById('btn-pause').addEventListener('click', () => {
    if (gameMode === 'gauntlet'){ gtPauseMenu(); return; }
    if (window.rankedMatch){ Ranked.pauseMenu(); return; }
    openPrompt('PAUSED', 'Catch your breath.', [
        ['Resume', resumeRace],
        ['Settings', () => openSettings('pause'), true],
        ['Restart', restartRace, true],
        ['Main menu', quitToMenu, true],
    ]);
});
function ordinal(n){ return n===1?'1st':n===2?'2nd':n===3?'3rd':n+'th'; }
let spectating = false, spectateTarget = null;
function stillRacing(){ return players.filter(p => !p.local && !p.finished); }
function setSpectate(target){
    spectateTarget = target;
    const bar = document.getElementById('spectate-bar');
    if (target){ document.getElementById('spectate-name').textContent = target.name; bar.style.display = 'flex'; }
    else bar.style.display = 'none';
}
function cycleSpectate(dir){
    const list = stillRacing();
    if (!list.length){ return; }
    let i = list.indexOf(spectateTarget);
    i = (i + dir + list.length) % list.length;
    setSpectate(list[i]);
    SFX.play('count');
}
function startSpectate(){
    spectating = true;
    resumeRace();                                   // unpause and let the race keep running
    showFinishMenu(true);
    const list = stillRacing();
    setSpectate(list[0] || null);
}
function stopSpectate(){
    spectating = false; spectateTarget = null;
    const bar = document.getElementById('spectate-bar');
    if (bar) bar.style.display = 'none';
}
function updateSpectate(){
    if (!spectating) return;
    // if the one we're watching just finished, jump to the next still racing
    if (!spectateTarget || spectateTarget.finished){
        const list = stillRacing();
        if (list.length) setSpectate(list[0]);
        else setSpectate(null);
    }
    // everyone's in -> show the results board
    if (players.every(p => p.finished)){ stopSpectate(); }
}
document.getElementById('spectate-prev').addEventListener('click', (e) => { e.stopPropagation(); cycleSpectate(-1); });
document.getElementById('spectate-next').addEventListener('click', (e) => { e.stopPropagation(); cycleSpectate(1); });

// "Main menu" button that appears the moment YOU finish a race. Your rewards are still granted.
const finishMenuBtn = document.getElementById('finish-menu');
function showFinishMenu(on){ finishMenuBtn.style.display = on ? 'flex' : 'none'; }
function leaveRaceToMenu(){
    const order = [...players].sort((a,b) => a.finished && b.finished ? a.finishTime-b.finishTime : a.finished ? -1 : b.finished ? 1 : a.y-b.y);
    const place = order.indexOf(players[0]) + 1;
    try { rewardRace(place, !!players[0].finished, matchLootId); } catch(e){}
    stopSpectate(); showFinishMenu(false);
    state = 'menu'; gameMode = 'race'; hud.style.display = 'none';
    document.body.classList.remove('mode-escape', 'mode-parkour', 'mode-level');
    refreshStartMeta(); showScreen('start');
}
finishMenuBtn.addEventListener('click', e => { e.stopPropagation(); SFX.play('count'); leaveRaceToMenu(); });
function maybePromptBotsDone() {
    if (botsDonePrompted || !players[0].finished) return;   // only makes sense once YOU'RE already done
    if (players.slice(1).every(b => b.finished)) return;    // everyone's in — the race is just ending normally
    botsDonePrompted = true;
    const place = [...players].sort((a,b)=>{
        if (a.finished && b.finished) return a.finishTime-b.finishTime;
        return a.finished ? -1 : b.finished ? 1 : a.y - b.y;
    }).indexOf(players[0]) + 1;
    setTimeout(() => openPrompt('YOU FINISHED ' + ordinal(place).toUpperCase(), "The others are still racing. What do you want to do?", [
        ['Keep watching', startSpectate],
        ['View results', giveUpToResults, true],
        ['Restart', restartRace, true],
        ['Main menu', leaveRaceToMenu, true],
    ]), 900);
}

document.getElementById('btn-again').addEventListener('click', startMatchmaking);
document.getElementById('btn-results-menu').addEventListener('click', () => {
    state = 'menu'; gameMode = 'race'; hud.style.display = 'none';
    document.body.classList.remove('mode-escape', 'mode-parkour', 'mode-level');
    refreshStartMeta(); showScreen('start');
});

let matchLootId = '';
let matchBotNames = [];   // the 3 bot names for THIS match (index 1..3)
let matchHumanSlot = 0;    // 0 = no human-profile bot this race; 1-3 = which slot has one

function startMatchmaking() {
    window.rankedMatch = false; window.RACE_BAND = undefined; window.matchBots = null;   // a normal quick match
    matchLootId = newLootId('race');
    // Decide ONCE, before the lobby even builds, whether this match has a "human" bot and
    // who it is — so the name shown in the lobby always matches who behaves that way in
    // the race. This is deliberately sporadic: most races are all standard bots, so the
    // rare human-like one doesn't become a pattern you can set your watch by.
    matchSeed = (Math.random() * 4294967296) >>> 0;   // this match's track (share it to race the same course)
    matchHumanSlot = (Math.random() < 0.22) ? (1 + Math.floor(Math.random()*3)) : 0;
    // All three names come from the same pool, in the same style, whether or not that
    // slot happens to be the human-profile one — the naming must never be the tell.
    matchBotNames = [...BOT_NAMES].sort(()=>Math.random()-0.5).slice(0,3);
    const reveal = [true,false,false,false];
    buildLobby(reveal);
    showScreen('lobby');
    const times = [700, 1500, 2200];
    [1,2,3].forEach((idx,i)=>{
        setTimeout(()=>{ reveal[idx]=matchBotNames[i]; buildLobby(reveal); }, times[i]);
    });
    setTimeout(startGame, 3100);
}

function startGame() {
    gameMode = 'race'; esc = null; pk = null; document.body.classList.remove('mode-escape', 'mode-parkour', 'mode-level'); lv = null;
    showScreen(''); // hide all overlays
    generateLevel(matchSeed); initPlayers(); botsDonePrompted = false;
    if (window.matchBots && window.BotRoster) BotRoster.applyTo(players.slice(1), window.matchBots);   // Ranked: roster opponents with their own skill
    beginRound();
}
function beginRound() {
    lastPlace = 0;
    hud.style.display='block';
    if (typeof SFX !== 'undefined' && SFX.music) SFX.music.set('race');
    dragging = false;
    cameraY = START_Y - VH*0.62;
    particles=[]; floaters=[]; shots=[]; shockwaves=[]; shardParticles=[]; timeScale=1; itemHUD.key='';
    hintTimer=4; hintEl.style.opacity=1; hintEl.style.display='block';

    state='countdown';
    countdownEl.style.display='block';
    const seq=[['3','#ff5470'],['2','#ff5470'],['1','#ffcf3f'],['GO!','#35e0c8']];
    seq.forEach((s,i)=>{
        setTimeout(()=>{
            countdownEl.textContent=s[0]; countdownEl.style.color=s[1];
            SFX.play(s[0]==='GO!' ? 'go' : 'count');
            if (s[0]==='GO!'){
                state='playing'; matchStart=Date.now();
                setTimeout(()=>countdownEl.style.display='none',600);
            }
        }, i*800);
    });
}


/* =====================================================================
   ESCAPE — solo endless climb with a rising void
   ===================================================================== */
let gameMode = 'race';          // 'race' | 'escape'
let esc = null;                 // escape-mode state (null outside escape)
const ESC_PICKUPS = { rocket:0.40, shield:0.32, giant:0.28 };   // no Super Bounce in solo
const ESC_WIDTH_MUL = 1.3;      // wider platforms than the race
const ESC_METERS = 10;          // px per displayed meter

function store(k, v){ try { localStorage.setItem(k, String(v)); } catch(e){} if (window.Cloud) Cloud.touch(); }
function load(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : Number(v); } catch(e){ return d; } }

// Canvas-ready copies of the item icons, so power-ups on the map use the exact same art as the HUD
const escIconImg = {};
if (typeof Image !== 'undefined') {
    for (const k of Object.keys(ESC_PICKUPS)) {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ICON_SVG[k].replace('<svg ', '<svg width="96" height="96" '));
        escIconImg[k] = img;
    }
}

function escNewState(){
    return { hazardY: START_Y + 480, t: 0,        // generous head start: a fumbled first jump isn't instant death
             topY: START_Y, lastX: PLAY_W()/2, row: 0,
             pickups: [], coinArr: [], embers: [], nextPickupRow: 7, nextCoinRow: 2,
             finished: false, lootId:newLootId('escape') };
}
function escRunnerState(){
    return { coins:0, bestY:START_Y, score:0, scoredM:0, shownScore:-1, shownC:-1,
             chain:0, mult:1, maxMult:1, landAt:0, lastLandY:START_Y,
             quickLaunch:false, prevMode:'idle', angerT:0, stumbles:0,
             hazardBuffer:0, dead:false, diedAt:0 };
}
function escDiff(){ return Math.min(1, (START_Y - esc.topY) / 14000); }
function escPickType(){
    let sum = 0; for (const k in ESC_PICKUPS) sum += ESC_PICKUPS[k];
    let r = Math.random()*sum;
    for (const k in ESC_PICKUPS){ r -= ESC_PICKUPS[k]; if (r <= 0) return k; }
    return 'rocket';
}

// One row of the endless tower. Same platform vocabulary as the race, scaled by height.
function escGenRow(){
    const pw = PLAY_W(), d = escDiff();
    const prevX = esc.lastX, prevY = esc.topY;
    const gap = 118 + rnd(0, 40) + d*62;
    const y = prevY - gap;
    let width = (150 - d*45 + rnd(0, 30)) * ESC_WIDTH_MUL;
    width = Math.max(95, Math.min(pw*0.62, width));

    const r = Math.random();
    let type = 'normal', speed = 0, dir = 1;
    if (esc.row > 2) {
        if (r < 0.10)                       { type = 'boost'; }
        else if (r < 0.10 + 0.16*d)         { type = 'fragile'; }
        else if (r < 0.26 + 0.20*d)         { type = 'moving'; speed = rnd(55, 105) + d*65; dir = Math.random()<.5?1:-1; }
        else if (r < 0.38 + 0.12*d)         { type = 'ice'; }
    }
    const half = width/2;
    const maxShift = 115 + d*45;
    let x = prevX + rnd(-maxShift, maxShift);
    x = Math.max(half+6, Math.min(pw-half-6, x));
    let range = 0, baseX = x;
    if (type === 'moving') {
        range = Math.min(rnd(40, 110), (pw - width - 12)/2);
        if (range < 25) { type = 'normal'; range = 0; }
        else { baseX = Math.max(half+6+range, Math.min(pw-half-6-range, x)); x = baseX; }
    }
    platforms.push({x, y, w:width, h:18, type, speed, dir, active:true, breaking:false, breakT:0, respawn:0,
                    baseX, range, boostReady:true, quakeWarn:0, quakeDown:0});

    // Coins trace the natural jump arc between two platforms — they reward the good line.
    if (esc.row >= esc.nextCoinRow) {
        const n = 3 + (Math.random()*3|0);
        for (let i=1;i<=n;i++){
            const t = i/(n+1);
            esc.coinArr.push({ x: prevX + (x-prevX)*t, y: (prevY-30) + ((y-30)-(prevY-30))*t - Math.sin(t*Math.PI)*70,
                               collectedBy:[], phase:Math.random()*6.28 });
        }
        esc.nextCoinRow = esc.row + 2 + (Math.random()*3|0);
    }
    // Power-ups sit visibly on a platform: land on it and it's yours, instantly.
    if (esc.row >= esc.nextPickupRow && type !== 'moving' && type !== 'fragile') {
        esc.pickups.push({ x, y: y - 42, type: escPickType(), collectedBy:[], phase:Math.random()*6.28 });
        esc.nextPickupRow = esc.row + 9 + (Math.random()*6|0);
    }
    esc.lastX = x; esc.topY = y; esc.row++;
}

function startEscape(){
    gameMode = 'escape';
    document.body.classList.remove('mode-parkour', 'mode-level'); pk = null; lv = null;
    document.body.classList.add('mode-escape');
    showScreen('');
    hud.style.display = 'block';
    esc = escNewState();
    comboHudKey = ''; hitStop = 0;
    escComboPill.style.display = 'none';
    platforms = []; itemBoxes = [];
    const pw = PLAY_W();
    platforms.push({x:pw/2, y:START_Y, w:pw, h:40, type:'normal', active:true, ground:true, quakeWarn:0, quakeDown:0});
    while (esc.topY > START_Y - VH*2.5) escGenRow();
    matchHumanSlot = 0;
    matchBotNames = [];
    initPlayers();
    if (window.BotRoster) BotRoster.applyTo(players.slice(1), BotRoster.pick(3, { mmr:Math.max(1200, prog().rk.mmr + 100), spread:260 }));   // named roster bots, some of them good
    for (const p of players) p.escape = escRunnerState();
    players[0].x = pw/2;
    beginRound();
}

function escApplyPickup(p, type){
    p.item = type; p.itemState = 'ready';
    activateItem(p);                               // the exact same ability effects as in the race
    if (type === 'shield') p.shieldT = 12;         // solo: the shield is your one "second chance"
    itemHUD.key = '';
}

/* ---- Flow combo ---- */
const FLOW_WINDOW = 1.25;                       // seconds you get after landing to launch again
const COMBO_COLORS = ['#ffffff', '#ffffff', '#35e0c8', '#ffcf3f', '#ff9838', '#ff5470'];
function comboMult(chain){ return chain >= 15 ? 5 : chain >= 10 ? 4 : chain >= 6 ? 3 : chain >= 3 ? 2 : 1; }
function escSetChain(n, p){
    const run = p.escape, before = run.mult;
    run.chain = n;
    run.mult = comboMult(n);
    if (run.mult > run.maxMult) run.maxMult = run.mult;
    if (run.mult > before){
        const col = COMBO_COLORS[run.mult];
        ring(p.x, p.y, col, 58);
        if (p.local){
            SFX.play('combo');
            escComboPill.animate([{transform:'scale(1.35)'},{transform:'scale(1)'}], {duration:320, easing:'cubic-bezier(.3,1.6,.5,1)'});
        }
        burst(p.x, p.y, col, 14, 200);
    } else if (n === 0 && before > 1 && p.local){
        escComboPill.animate([{transform:'scale(1)', opacity:1},{transform:'scale(.7)', opacity:0}], {duration:220});
    }
}
function escTrackFlow(p){
    const run = p.escape;
    const mode = p.mode, prev = run.prevMode;
    if (prev === 'air' && mode === 'idle'){                       // landed
        const higher = p.y < run.lastLandY - 30;
        if (higher && run.quickLaunch) escSetChain(run.chain + 1, p);
        else if (!higher && p.y > run.lastLandY + 40) escSetChain(0, p);   // fell back down
        if (higher || p.y > run.lastLandY + 40) run.lastLandY = p.y;
        run.landAt = esc.t;
    } else if (prev === 'idle' && mode === 'air'){                // launched (or slid off)
        run.quickLaunch = (esc.t - run.landAt) <= FLOW_WINDOW;
        if (!run.quickLaunch && run.chain > 0) escSetChain(0, p);
    }
    // standing around too long drains the combo
    if (mode === 'idle' && run.chain > 0 && esc.t - run.landAt > FLOW_WINDOW) escSetChain(0, p);
    run.prevMode = mode;
}

/* ---- Stumble: the first touch is a warning, not the end ---- */
const ANGER_TIME = 6;
function escRescueLaunch(p){
    // Fling the player at a real platform above, so the rescue is always a fair second chance
    let best = null, bs = -1e9;
    for (const pl of platforms){
        if (!pl.active || pl.type === 'fragile' || pl.ground) continue;
        const up = p.y - pl.y;
        if (up < 220 || up > 640) continue;
        const s = -Math.abs(pl.x - p.x) - Math.abs(up - 420)*0.5 + Math.min(pl.w, 200)*0.6 - (pl.type === 'moving' ? 80 : 0);
        if (s > bs){ bs = s; best = pl; }
    }
    p.mode = 'air'; p.plat = null; p.charged = false;
    if (best){
        const margin = Math.min(best.w/2*0.55, p.r + 12);
        const tx = Math.max(best.x - best.w/2 + margin, Math.min(best.x + best.w/2 - margin, p.x));
        const sol = solveJump(tx - p.x, (best.y - best.h/2 - p.r) - p.y, 2600, playerG(p));
        if (sol){ p.vx = sol.vx; p.vy = sol.vy; return; }
    }
    p.vx *= 0.3; p.vy = -1650;
}
function escStumble(lp){
    const run = lp.escape;
    if (lp.local) SFX.play('stumble');
    run.angerT = ANGER_TIME; run.stumbles++;
    run.hazardBuffer = 330;
    escSetChain(0, lp);
    escRescueLaunch(lp);
    if (lp.local){ hitStop = 0.32; camShake = Math.max(camShake, 14); }
    ring(lp.x, lp.y, '#ff5470', 100);
    burst(lp.x, lp.y, '#ff5470', 26, 280);
    burst(lp.x, lp.y, '#ffd0d8', 12, 180);
}

function updateEscape(dt){
    const runners = players.filter(p => p.escape && !p.escape.dead);
    if (!runners.length || esc.finished) return;
    esc.t += dt;

    // Keep the tower growing ahead of the camera, and drop what the void has swallowed
    while (esc.topY > cameraY - VH*1.5) escGenRow();
    const cut = esc.hazardY + 650;
    if (platforms.length > 60) platforms = platforms.filter(pl => pl.y < cut);
    esc.coinArr = esc.coinArr.filter(c => c.y < cut && players.some(p => !p.escape.dead && !c.collectedBy.includes(p.id)));
    esc.pickups = esc.pickups.filter(q => q.y < cut && players.some(p => !p.escape.dead && !q.collectedBy.includes(p.id)));

    // The void: a steady climb that speeds up over time, plus a leash — pull too far ahead
    // and it surges to close the gap. While ANGRY (after a stumble) the leash is short and it
    // sits right under you in plain view; survive the window and it drops back off-screen.
    const leader = runners.reduce((best, p) => p.y < best.y ? p : best);
    const gap = esc.hazardY - (leader.y + leader.r);
    let speed = 45 + Math.min(170, esc.t * 0.8);
    const leash = VH * 1.4;
    if (gap > leash) speed += (gap - leash) * 1.6;
    if (esc.t < 1.5) speed *= esc.t / 1.5;
    esc.hazardY -= speed * dt;
    let angry = false;
    for (const p of runners){
        const run = p.escape;
        run.hazardBuffer = Math.max(0, run.hazardBuffer - speed*dt);
        if (run.angerT > 0){
            run.angerT = Math.max(0, run.angerT - dt);
            angry = true;
            if (!run.angerT) ring(p.x, p.y, 'rgba(255,255,255,0.7)', 50);
        }
    }

    // Embers drifting up off the surface (a lot more of them when it's angry)
    if (Math.random() < dt*(angry ? 70 : 26)) esc.embers.push({ x: rnd(0, PLAY_W()), y: esc.hazardY + rnd(0, 30),
        vx: rnd(-25, 25), vy: -rnd(40, angry ? 220 : 120), life: 1, decay: rnd(0.5, 1.1), s: rnd(1.2, angry ? 4 : 3) });
    
    // Snelle "in-place" garbage collection voor embers
    let eIdx = 0;
    for (let i = 0; i < esc.embers.length; i++){
        const e = esc.embers[i]; e.x += e.vx*dt; e.y += e.vy*dt; e.life -= e.decay*dt;
        if (e.life > 0) esc.embers[eIdx++] = e;
    }
    esc.embers.length = eIdx;

    // Flow combo
    for (const p of runners) escTrackFlow(p);

    // Coins and power-ups
    for (const c of esc.coinArr){
        for (const p of runners){
            if (c.collectedBy.includes(p.id)) continue;
            if (Math.abs(c.x - p.x) < p.r + 11 && Math.abs(c.y - p.y) < p.r + 11){
                c.collectedBy.push(p.id);
                const run = p.escape;
                run.coins++;
                run.score += 10 * run.mult;
                if (p.local) SFX.play('coin');
                burst(c.x, c.y, '#ffcf3f', 6, 120);
            }
        }
    }
    for (const q of esc.pickups){
        for (const p of runners){
            if (q.collectedBy.includes(p.id)) continue;
            if (Math.abs(q.x - p.x) < p.r + 18 && Math.abs(q.y - p.y) < p.r + 18){
                q.collectedBy.push(p.id);
                ring(q.x, q.y, ITEMS[q.type].color, 46);
                burst(q.x, q.y, ITEMS[q.type].color, 16, 220);
                escApplyPickup(p, q.type);
            }
        }
    }

    for (const p of runners){
        const run = p.escape;
        if (p.y < run.bestY) run.bestY = p.y;
        const m = Math.max(0, Math.floor((START_Y - run.bestY) / ESC_METERS));
        if (m > run.scoredM){ run.score += (m - run.scoredM) * run.mult; run.scoredM = m; }
        if (p.local && run.score !== run.shownScore){ run.shownScore = run.score; escScoreEl.textContent = run.score.toLocaleString('en-US'); }
        if (p.local && run.coins !== run.shownC){
            run.shownC = run.coins; escCoinEl.textContent = run.coins;
            escCoinPill.animate([{transform:'scale(1.18)'},{transform:'scale(1)'}], {duration:180});
        }
        const personalHazard = esc.hazardY + run.hazardBuffer;
        if (p.y + p.r*0.5 > personalHazard){
            if (consumeShield(p)){
                p.mode = 'air'; p.plat = null; p.vy = -1800; p.vx *= 0.5;
                run.hazardBuffer += 240;
                camShake = p.local ? Math.max(camShake, 10) : camShake;
                ring(p.x, p.y, ITEMS.shield.color, 90);
            } else if (!run.angerT){
                escStumble(p);
            } else {
                escGameOver(p);
            }
        }
    }
    escUpdateComboHUD();
}


let comboHudKey = '';
function escUpdateComboHUD(){
    const lp = players[0];
    if (!lp || !lp.escape) return;
    const run = lp.escape;
    const show = run.chain > 0;
    const key = show + '|' + run.mult;
    if (key !== comboHudKey){
        comboHudKey = key;
        escComboPill.style.display = show ? '' : 'none';
        escComboX.textContent = '×' + run.mult;
        escComboPill.style.setProperty('--combo', COMBO_COLORS[run.mult]);
    }
    if (show){
        const left = lp.mode === 'idle' ? Math.max(0, 1 - (esc.t - run.landAt)/FLOW_WINDOW) : 1;
        escComboFill.style.width = (left*100) + '%';
    }
}

/* ---- ESCAPE drawing ---- */
function drawEscapeWorldBack(){
    const t = performance.now()/1000;
    // coins: a spinning gold disc
    for (const c of esc.coinArr){
        if (!players.some(p => !p.escape.dead && !c.collectedBy.includes(p.id)) || c.y < cameraY-30 || c.y > cameraY+VH+30) continue;
        const sx = Math.max(0.18, Math.abs(Math.cos(t*3 + c.phase)));
        const by = c.y + Math.sin(t*2.6 + c.phase)*2.5;
        ctx.save(); ctx.translate(c.x, by); ctx.scale(sx, 1);
        ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(255,207,63,0.7)';
        const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8);
        g.addColorStop(0, '#fff4c2'); g.addColorStop(0.5, '#ffcf3f'); g.addColorStop(1, '#c9901a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, 7); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(120,80,0,0.55)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, 7); ctx.stroke();
        ctx.restore();
    }
    // power-ups: a glowing badge with the item's icon, rotating orbit ring
    for (const q of esc.pickups){
        if (!players.some(p => !p.escape.dead && !q.collectedBy.includes(p.id)) || q.y < cameraY-50 || q.y > cameraY+VH+50) continue;
        const col = ITEMS[q.type].color;
        const by = q.y + Math.sin(t*2.2 + q.phase)*4;
        ctx.save(); ctx.translate(q.x, by);
        ctx.globalAlpha = 0.22 + 0.08*Math.sin(t*4 + q.phase);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 25, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(13,16,23,0.88)';
        ctx.shadowBlur = 16; ctx.shadowColor = col;
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.stroke();
        ctx.save(); ctx.rotate(t*1.8 + q.phase);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 23, 0, 1.1); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 23, Math.PI, Math.PI+1.1); ctx.stroke();
        ctx.restore();
        const img = escIconImg[q.type];
        if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -12, -12, 24, 24);
        else { ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        ctx.restore();
    }
}

function drawEscapeWorldFront(){
    const top = esc.hazardY;
    if (top > cameraY + VH + 220) return;
    const t = performance.now()/1000, pw = PLAY_W();
    const bottom = cameraY + VH + 60;
    // anger: 1 while angry, easing out over the last half second
    const angerT = players.reduce((max, p) => Math.max(max, p.escape ? p.escape.angerT : 0), 0);
    const anger = angerT > 0 ? Math.min(1, angerT / 0.5) : 0;
    const amp = 1 + anger*0.9, spd = 1 + anger*1.2;
    // heat haze above the surface
    const haze = ctx.createLinearGradient(0, top-150-anger*60, 0, top);
    haze.addColorStop(0, 'rgba(255,84,112,0)'); haze.addColorStop(1, `rgba(255,84,112,${0.20 + anger*0.18})`);
    ctx.fillStyle = haze; ctx.fillRect(0, top-150-anger*60, pw, 168+anger*60);   // runs under the wave troughs, so no hard seam
    // wavy molten surface
    const wave = (x) => top + (Math.sin(x*0.045 + t*3.1*spd)*4.5 + Math.sin(x*0.013 - t*1.6*spd)*7) * amp;
    ctx.beginPath(); ctx.moveTo(0, bottom);
    for (let x=0; x<pw; x+=8) ctx.lineTo(x, wave(x));
    ctx.lineTo(pw, wave(pw)); ctx.lineTo(pw, bottom); ctx.closePath();
    const body = ctx.createLinearGradient(0, top-10, 0, top+260);
    body.addColorStop(0, anger ? '#ff2e5c' : '#ff5470'); body.addColorStop(0.08, '#b81f4a'); body.addColorStop(0.35, '#4a0c22'); body.addColorStop(1, '#14060c');
    ctx.fillStyle = body; ctx.fill();
    // bright glowing lip — hotter and flickering while angry
    ctx.save();
    ctx.shadowBlur = 22 + anger*22; ctx.shadowColor = '#ff5470';
    ctx.strokeStyle = anger ? (Math.floor(t*14)%2 ? '#ffffff' : '#ffd0d8') : '#ffb3c1';
    ctx.lineWidth = 2.5 + anger*1.5;
    ctx.beginPath();
    for (let x=0; x<pw; x+=8){ const y = wave(x); if (x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
    ctx.lineTo(pw, wave(pw));
    ctx.stroke(); ctx.restore();
    // embers
    for (const e of esc.embers){
        ctx.globalAlpha = Math.max(0, e.life)*0.9;
        ctx.fillStyle = e.life > 0.5 ? '#ffd0d8' : '#ff5470';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.s, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// Screen-space: red pressure at the bottom edge as the void closes in, a pulsing danger frame
// while it's angry, plus a distance marker when it's still below the screen.
function drawEscapeOverlay(){
    const lp = players[0];
    if (!lp || !lp.escape || lp.escape.dead) return;
    const run = lp.escape;
    const t = performance.now()/1000, pw = SCREEN_PW();
    const gap = esc.hazardY + run.hazardBuffer - (lp.y + lp.r);
    const danger = Math.max(0, Math.min(1, 1 - gap/440));
    if (danger > 0){
        const pulse = danger > 0.6 ? 0.75 + 0.25*Math.sin(t*9) : 1;
        const g = ctx.createLinearGradient(0, CH, 0, CH*0.45);
        g.addColorStop(0, `rgba(255,84,112,${0.42*danger*pulse})`); g.addColorStop(1, 'rgba(255,84,112,0)');
        ctx.fillStyle = g; ctx.fillRect(0, CH*0.45, pw, CH*0.55);
    }
    if (run.angerT > 0){
        const fade = Math.min(1, run.angerT / 0.5);
        const beat = 0.55 + 0.45*Math.abs(Math.sin(t*5.5));
        const inset = 26;
        ctx.save();
        for (const [x0, y0, x1, y1] of [[0,0,pw,inset],[0,CH-inset,pw,CH],[0,0,inset,CH],[pw-inset,0,pw,CH]]){
            const vertical = (x1 - x0) < (y1 - y0);
            const g = vertical ? ctx.createLinearGradient(x0 === 0 ? 0 : pw, 0, x0 === 0 ? inset : pw-inset, 0)
                               : ctx.createLinearGradient(0, y0 === 0 ? 0 : CH, 0, y0 === 0 ? inset : CH-inset);
            g.addColorStop(0, `rgba(255,46,92,${0.55*fade*beat})`); g.addColorStop(1, 'rgba(255,46,92,0)');
            ctx.fillStyle = g; ctx.fillRect(x0, y0, x1-x0, y1-y0);
        }
        // a thin countdown bar along the top edge: how long until the void calms down
        ctx.fillStyle = `rgba(255,46,92,${0.9*fade})`;
        ctx.fillRect(0, 0, pw * (run.angerT / ANGER_TIME), 3);
        ctx.restore();
    }
    const screenY = (esc.hazardY - cameraY) * VIEW_K;
    if (screenY > CH + 10){
        const mDown = Math.round(gap / ESC_METERS);
        const cx = pw/2, by = CH - 22;
        ctx.fillStyle = 'rgba(13,16,23,0.75)';
        roundRect(cx-34, by-13, 68, 26, 13); ctx.fill();
        ctx.strokeStyle = 'rgba(255,84,112,0.55)'; ctx.lineWidth = 1.2;
        roundRect(cx-34, by-13, 68, 26, 13); ctx.stroke();
        ctx.fillStyle = '#ff5470'; ctx.font = '700 12px Space Grotesk'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(mDown + ' m', cx + 7, by+1);
        ctx.beginPath(); ctx.moveTo(cx-24, by-3); ctx.lineTo(cx-14, by-3); ctx.lineTo(cx-19, by+4); ctx.closePath(); ctx.fill();
        ctx.textBaseline = 'alphabetic';
    }
}

// The sidebar becomes a pressure gauge: your marker sits fixed, the void fills up toward it.
function drawEscapeGauge(){
    const lp = players[0];
    const run = lp && lp.escape;
    const x0 = CW - SIDEBAR;
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x0, 0, SIDEBAR, CH);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, CH); ctx.stroke();
    if (!lp || !run || !esc) return;
    const cx = x0 + SIDEBAR/2, top = 30, bot = CH - 16;
    // current height on top of the gauge
    const m = Math.max(0, Math.floor((START_Y - run.bestY) / ESC_METERS));
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '800 9px Space Grotesk'; ctx.textAlign = 'center';
    ctx.fillText(m + 'm', cx, 16);
    const markY = top + (bot - top)*0.30;
    const range = 1500;                                   // px of world below you the gauge shows
    const gap = Math.max(0, esc.hazardY + run.hazardBuffer - (lp.y + lp.r));
    const fillTop = Math.min(bot, markY + (bot - markY) * (gap / range));
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(cx-4, top, 8, bot-top, 4); ctx.fill();
    if (fillTop < bot){
        const angryFlash = run.angerT > 0 && Math.floor(performance.now()/120) % 2 === 0;
        const g = ctx.createLinearGradient(0, fillTop, 0, bot);
        g.addColorStop(0, angryFlash ? '#ffffff' : '#ff5470'); g.addColorStop(1, '#4a0c22');
        ctx.fillStyle = g; roundRect(cx-4, fillTop, 8, bot-fillTop, 4); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(cx, markY, 7, 0, 7);
    ctx.fillStyle = lp.color; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    if (lp.shieldT > 0){ ctx.strokeStyle = ITEMS.shield.color; ctx.globalAlpha = 0.6; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(cx, markY, 11, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
}


/* =====================================================================
   MAIN MENU — tabs, profile, XP/levels, coins, skins, stats
   ===================================================================== */

/* =====================================================================
   COSMETICS — skins (with patterns), headwear and face accessories.
   One set of draw functions is shared by the game, the shop and the menu,
   so what you see in the shop is exactly what you race in.
   Units: s = half the body size, k = s/12. Drawn in the player's local space.
   ===================================================================== */
const RARITY = {
    common:    { label:'Common',    color:'#9aa3b5' },
    rare:      { label:'Rare',      color:'#5b8def' },
    epic:      { label:'Epic',      color:'#b3a9ff' },
    legendary: { label:'Legendary', color:'#ffcf3f' },
};
const SKINS = [
    { id:'classic',  name:'Classic',     color:'#35e0c8', price:0,    rarity:'common',    pat:{k:'solid'} },
    { id:'lime',     name:'Lime',        color:'#9be15d', price:250,  rarity:'common',    pat:{k:'solid'} },
    { id:'ember',    name:'Ember',       color:'#ff9838', price:300,  rarity:'common',    pat:{k:'solid'} },
    { id:'frost',    name:'Frost',   color:'#cfe9ff', price:300,  rarity:'common',    pat:{k:'solid'} },
    { id:'rose',     name:'Rose',        color:'#ff7a90', price:450,  rarity:'common',    pat:{k:'solid'} },
    { id:'midnight', name:'Midnight',    color:'#5b8def', price:500,  rarity:'common',    pat:{k:'solid'} },
    { id:'violet',   name:'Violet', color:'#b3a9ff', price:650,  rarity:'rare',      pat:{k:'solid'} },
    { id:'polka',    name:'Polka',       color:'#ffcf3f', price:600,  rarity:'rare',      pat:{k:'dots', a:'#ffcf3f', b:'#fff4c2'} },
    { id:'sunset',   name:'Sunset',      color:'#ff7a5c', price:700,  rarity:'rare',      pat:{k:'grad', a:'#ffcf3f', b:'#ff5470'} },
    { id:'ocean',    name:'Ocean',       color:'#46b3e6', price:700,  rarity:'rare',      pat:{k:'grad', a:'#35e0c8', b:'#5b6ef0'} },
    { id:'candy',    name:'Candy',       color:'#ff8fb1', price:900,  rarity:'rare',      pat:{k:'stripes', a:'#ffffff', b:'#ff6f9c'} },
    { id:'camo',     name:'Camo',        color:'#6f8f4e', price:900,  rarity:'rare',      pat:{k:'camo', a:'#6f8f4e', b:'#4a6333', c:'#a3b87a'} },
    { id:'tiger',    name:'Tiger',       color:'#ff9838', price:1200, rarity:'epic',      pat:{k:'tiger', a:'#ff9838', b:'#1a1208'} },
    { id:'checker',  name:'Checkered', color:'#e8ecf2', price:1500, rarity:'epic',      pat:{k:'checker', a:'#f4f6fa', b:'#1a1d24'} },
    { id:'lava',     name:'Lava',       color:'#ff5a36', price:1600, rarity:'epic',      pat:{k:'lava'} },
    { id:'galaxy',   name:'Galaxy',      color:'#6b4fd8', price:1800, rarity:'epic',      pat:{k:'galaxy'} },
    { id:'chrome',   name:'Chrome',      color:'#c9d1e3', price:2500, rarity:'legendary', pat:{k:'metal', stops:['#f7f9fc','#9aa4b8','#eef2f8','#6b7488']} },
    { id:'gold',     name:'Gold',   color:'#ffcf3f', price:3000, rarity:'legendary', pat:{k:'metal', stops:['#fff4c2','#e0a525','#ffe28a','#b07a14']} },
    { id:'carbon',   name:'Carbon',  color:'#dce5ed', price:1100, rarity:'epic',      pat:{k:'carbon', a:'#242d38', b:'#657481'} },
    { id:'sakura',   name:'Sakura', color:'#ff85b3', price:1250, rarity:'epic',      pat:{k:'petal', a:'#6f284e', b:'#ff85b3', c:'#ffe2ef'} },
    { id:'monsoon',  name:'Jade', color:'#54efd0', price:1400, rarity:'epic',      pat:{k:'waves', a:'#073b43', b:'#18a98f', c:'#a5fff0'} },
    { id:'glacier',  name:'Glacier', color:'#bdefff', price:1750, rarity:'epic',      pat:{k:'marble', a:'#254966', b:'#bdefff', c:'#ffffff'} },
    { id:'circuit',  name:'Circuit',color:'#70ffbb', price:2200, rarity:'legendary', pat:{k:'circuit', a:'#092c2a', b:'#22d58e', c:'#fff27a'} },
    { id:'eclipse',  name:'Eclipse',color:'#f0cbff', price:2600, rarity:'legendary', pat:{k:'holo', stops:['#171521','#552c72','#c14d91','#3ce0ca']} },
    { id:'starforge',name:'Forge',    color:'#ff9f5c', price:2900, rarity:'legendary', pat:{k:'holo', stops:['#35142c','#a82f52','#ff9f5c','#ffe59c']} },
    { id:'deepsea',  name:'Deep Sea',color:'#57c6ff', price:3400, rarity:'legendary', pat:{k:'petal', a:'#102e5b', b:'#397ee8', c:'#9bf0ff'} },
];
const HATS = [
    { id:'none',       name:'None',        price:0,    rarity:'common' },
    { id:'cap',        name:'Cap',         price:200,  rarity:'common' },
    { id:'beanie',     name:'Beanie',      price:250,  rarity:'common' },
    { id:'flower',     name:'Flower',      price:300,  rarity:'common' },
    { id:'headphones', name:'Headphones',  price:400,  rarity:'rare' },
    { id:'bunny',      name:'Bunny Ears',  price:450,  rarity:'rare' },
    { id:'party',      name:'Party Hat',   price:500,  rarity:'rare' },
    { id:'chef',       name:'Chef',        price:550,  rarity:'rare' },
    { id:'cowboy',     name:'Cowboy',      price:600,  rarity:'rare' },
    { id:'antenna',    name:'Antennae',    price:650,  rarity:'rare' },
    { id:'propeller',  name:'Propeller',   price:800,  rarity:'epic' },
    { id:'tophat',     name:'Top Hat',     price:900,  rarity:'epic' },
    { id:'viking',     name:'Viking',      price:1100, rarity:'epic' },
    { id:'wizard',     name:'Wizard',      price:1300, rarity:'epic' },
    { id:'halo',       name:'Halo',        price:2200, rarity:'legendary' },
    { id:'crown',      name:'Crown',       price:3000, rarity:'legendary' },
    { id:'flighthelm', name:'Pilot Helmet',  price:1450, rarity:'epic' },
    { id:'foxcrest',   name:'Fox Hood',price:1650, rarity:'epic' },
    { id:'headband',   name:'Headband', price:1850, rarity:'epic' },
    { id:'spacehelm',  name:'Space Helmet', price:2450, rarity:'legendary' },
    { id:'petalcrown', name:'Blossom Crown', price:2750, rarity:'legendary' },
    { id:'voidhorns',  name:'Dark Antlers', price:3600, rarity:'legendary' },
];
const FACES = [
    { id:'none',     name:'None',          price:0,    rarity:'common' },
    { id:'blush',    name:'Blush',         price:150,  rarity:'common' },
    { id:'round',    name:'Round Glasses', price:250,  rarity:'common' },
    { id:'mustache', name:'Mustache',      price:300,  rarity:'common' },
    { id:'shades',   name:'Shades',        price:400,  rarity:'rare' },
    { id:'nerd',     name:'Nerd Glasses',  price:400,  rarity:'rare' },
    { id:'patch',    name:'Eye Patch',     price:450,  rarity:'rare' },
    { id:'hearts',   name:'Heart Specs',   price:550,  rarity:'rare' },
    { id:'3d',       name:'3D Glasses',    price:600,  rarity:'rare' },
    { id:'bandit',   name:'Bandit Mask',   price:700,  rarity:'epic' },
    { id:'aviator',  name:'Aviators',      price:900,  rarity:'epic' },
    { id:'monocle',  name:'Monocle',       price:1200, rarity:'epic' },
    { id:'visor',    name:'Visor',   price:2000, rarity:'legendary' },
    { id:'hologlass',name:'Holo Glasses',    price:1450, rarity:'epic' },
    { id:'startrace',name:'Star Marks',    price:1750, rarity:'epic' },
    { id:'frostmark',name:'Frost Marks',    price:1950, rarity:'epic' },
    { id:'foxmark',  name:'Fox Marks',   price:2300, rarity:'legendary' },
    { id:'pixelheart',name:'Pixel Heart',   price:2650, rarity:'legendary' },
    { id:'voidstitch',name:'Stitches',   price:3200, rarity:'legendary' },
];
const TRAILS = [
    { id:'none',       name:'No Trail',      color:'#8b95a7', price:0,    rarity:'common',    style:'none' },
    { id:'afterglow',  name:'Glow',     color:'#35e0c8', price:500,  rarity:'rare',      style:'soft' },
    { id:'cinder',     name:'Cinders',    color:'#ff8a52', price:800,  rarity:'epic',      style:'spark' },
    { id:'starlight',  name:'Starlight',     color:'#b3a9ff', price:1200, rarity:'epic',      style:'star' },
    { id:'aurora',     name:'Aurora',   color:'#67f0c1', price:2200, rarity:'legendary', style:'ribbon' },
    { id:'prism',      name:'Rainbow Trail',   color:'#ffcf3f', price:3200, rarity:'legendary', style:'prism' },
    { id:'blueprint',  name:'Chalk',     color:'#64d9ff', price:950,  rarity:'epic',      style:'blueprint' },
    { id:'comet',      name:'Comet',    color:'#fff1a8', price:1450, rarity:'epic',      style:'comet' },
    { id:'embers',     name:'Sparks',     color:'#ff7954', price:1650, rarity:'epic',      style:'ember' },
    { id:'glacierline',name:'Ice',   color:'#a7efff', price:1850, rarity:'epic',      style:'frost' },
    { id:'shadowcode', name:'Shadow',    color:'#8c8dff', price:2500, rarity:'legendary', style:'glitch' },
    { id:'nebula',     name:'Nebula',  color:'#ff71d2', price:2850, rarity:'legendary', style:'nebula' },
    { id:'tidal',      name:'Waves', color:'#62f5dc', price:3300, rarity:'legendary', style:'ribbon' },
    { id:'goldenhour', name:'Gold Dust',   color:'#ffcc69', price:3900, rarity:'legendary', style:'star' },
];
// Layered art for the built-in skins (src/data/skin-styles.js).
if (typeof SKIN_STYLES !== 'undefined') for (const s of SKINS) if (SKIN_STYLES[s.id]) Object.assign(s, SKIN_STYLES[s.id]);
if (typeof TRAIL_FX !== 'undefined') for (const t of TRAILS) if (TRAIL_FX[t.id]) t.fx = TRAIL_FX[t.id];
if (typeof ACCESSORY_STYLES !== 'undefined'){
    for (const h of HATS) if (ACCESSORY_STYLES.hats[h.id]) Object.assign(h, ACCESSORY_STYLES.hats[h.id]);
    for (const f of FACES) if (ACCESSORY_STYLES.faces[f.id]) Object.assign(f, ACCESSORY_STYLES.faces[f.id]);
}
// Items made in tools/designer.html (src/data/custom-cosmetics.js) join the built-in lists here.
if (typeof CUSTOM_COSMETICS !== 'undefined'){
    for (const [arr, key] of [[SKINS, 'skins'], [HATS, 'hats'], [FACES, 'faces'], [TRAILS, 'trails']])
        for (const it of (CUSTOM_COSMETICS[key] || [])) if (!arr.some(x => x.id === it.id)) arr.push(Object.assign({ custom:true }, it));
}
// Prices follow rarity, not the order items were written in: items inside a rarity are ranked by their listed
// price and spread across that rarity's range. Epic and legendary are deliberately a very long grind.
// Set priceLock:true on an item (designer: "Lock exact price") to keep its own price.
const PRICE_RANGES = { common:[250, 700], rare:[1800, 4200], epic:[7000, 14000], legendary:[35000, 70000] };
for (const arr of [SKINS, HATS, FACES, TRAILS]){
    for (const r of Object.keys(PRICE_RANGES)){
        const items = arr.filter(i => i.rarity === r && i.price > 0 && !i.priceLock).sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
        items.forEach((it, k) => {
            const t = items.length > 1 ? k / (items.length - 1) : 0, raw = PRICE_RANGES[r][0] + (PRICE_RANGES[r][1] - PRICE_RANGES[r][0]) * t;
            const step = raw < 2000 ? 50 : raw < 10000 ? 250 : 1000; it.price = Math.round(raw / step) * step;
        });
    }
}
if (typeof PREMIUM_COSMETICS !== 'undefined'){
    for (const [arr, key] of [[SKINS, 'skins'], [HATS, 'hats'], [FACES, 'faces'], [TRAILS, 'trails']])
        for (const it of (PREMIUM_COSMETICS[key] || [])) if (!arr.some(x => x.id === it.id)) arr.push(Object.assign({ premium:true, rarity:'legendary' }, it));
}
const TRAIL_BY_ID = Object.fromEntries(TRAILS.map(trail => [trail.id, trail]));
const COS_BY = { skin: SKINS, hat: HATS, face: FACES, trail: TRAILS };
const RESOURCE_PACKS = [
    { id:'field-notes', name:'Small Crate', price:80, xp:45, passPoints:30 },
    { id:'supply-cache', name:'Supply Drop', price:240, xp:160, passPoints:120 },
    { id:'season-crate', name:'Season Crate', price:600, xp:450, passPoints:360 },
];
const OUT = 'rgba(13,16,23,0.85)';

function rrPath(c, x, y, w, h, r){
    c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y); c.quadraticCurveTo(x+w, y, x+w, y+r);
    c.lineTo(x+w, y+h-r); c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
    c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r); c.quadraticCurveTo(x, y, x+r, y); c.closePath();
}
function rrPathAdd(c, x, y, w, h, r){
    c.moveTo(x+r, y); c.lineTo(x+w-r, y); c.quadraticCurveTo(x+w, y, x+w, y+r);
    c.lineTo(x+w, y+h-r); c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
    c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r); c.quadraticCurveTo(x, y, x+r, y); c.closePath();
}
function outline(c, k, w){ c.strokeStyle = OUT; c.lineWidth = (w || 1.3) * k; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }

// ---- body with pattern ----
function drawSkinBody(c, s, k, def){
    const P = def.pat || {k:'solid'};
    rrPath(c, -s, -s, s*2, s*2, 4*k);
    if (P.k === 'grad'){ const g = c.createLinearGradient(-s, -s, s, s); g.addColorStop(0, P.a); g.addColorStop(1, P.b); c.fillStyle = g; }
    else if (P.k === 'metal'){ const g = c.createLinearGradient(-s, -s, s*0.6, s); P.stops.forEach((col, i) => g.addColorStop(i/(P.stops.length-1), col)); c.fillStyle = g; }
    else if (P.k === 'galaxy'){ const g = c.createLinearGradient(-s, -s, s, s); g.addColorStop(0, '#2a1760'); g.addColorStop(0.6, '#4a2aa0'); g.addColorStop(1, '#1b3a8a'); c.fillStyle = g; }
    else if (P.k === 'lava'){ const g = c.createLinearGradient(0, -s, 0, s); g.addColorStop(0, '#5a1410'); g.addColorStop(1, '#b8321c'); c.fillStyle = g; }
    else c.fillStyle = P.a || def.color;
    c.fill();
    c.shadowBlur = 0;
    if (P.k === 'solid' || P.k === 'grad'){ skinDecals(c, s, k, def); return; }
    c.save(); rrPath(c, -s, -s, s*2, s*2, 4*k); c.clip();
    if (P.k === 'stripes'){ c.fillStyle = P.b; for (let x = -s*3; x < s*3; x += 7*k){ c.beginPath(); c.moveTo(x, -s); c.lineTo(x + 3.5*k, -s); c.lineTo(x + 3.5*k - s*2, s); c.lineTo(x - s*2, s); c.closePath(); c.fill(); } }
    if (P.k === 'dots'){ c.fillStyle = P.b; for (let y = -s + 3*k, r = 0; y < s; y += 6*k, r++) for (let x = -s + (r%2 ? 6 : 3)*k; x < s; x += 6*k){ c.beginPath(); c.arc(x, y, 1.5*k, 0, 7); c.fill(); } }
    if (P.k === 'checker'){ const q = s/2; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2){ c.fillStyle = P.b; c.fillRect(-s + i*q, -s + j*q, q, q); } }
    if (P.k === 'tiger'){ c.strokeStyle = P.b; c.lineCap = 'round'; c.lineWidth = 2*k;
        for (const [x, y, w] of [[-9,-8,6],[-3,-10,5],[4,-9,6],[9,-4,5],[-9,2,5],[3,4,6],[-2,9,5],[8,8,5]]){ c.beginPath(); c.moveTo(x*k, y*k); c.quadraticCurveTo((x+w*0.5)*k, (y+2)*k, (x+w)*k, (y+0.5)*k); c.stroke(); } }
    if (P.k === 'camo'){ for (const [x, y, r, col] of [[-6,-6,5,P.b],[5,-7,4,P.c],[6,4,5,P.b],[-5,6,4,P.c],[0,0,3,P.b],[-10,0,3,P.c],[10,-1,3,P.c]]){ c.fillStyle = col; c.beginPath(); c.ellipse(x*k, y*k, r*k, r*0.7*k, x*0.1, 0, 7); c.fill(); } }
    if (P.k === 'galaxy'){ c.fillStyle = '#ffffff'; for (const [x, y, r] of [[-8,-7,0.8],[6,-9,0.6],[9,-2,0.9],[-3,4,0.6],[4,8,0.8],[-9,7,0.6],[1,-4,0.5],[-6,-1,0.5]]){ c.globalAlpha = 0.9; c.beginPath(); c.arc(x*k, y*k, r*k, 0, 7); c.fill(); }
        c.globalAlpha = 0.35; c.fillStyle = '#ff7ad1'; c.beginPath(); c.ellipse(3*k, 2*k, 7*k, 3*k, -0.5, 0, 7); c.fill(); c.globalAlpha = 1; }
    if (P.k === 'lava'){ for (const [x, y, r] of [[-6,-5,2.4],[5,-2,3],[-2,6,2.6],[8,7,1.8],[-9,4,1.6],[2,-9,1.6]]){ const g = c.createRadialGradient(x*k, y*k, 0, x*k, y*k, r*k); g.addColorStop(0, '#ffe38a'); g.addColorStop(0.5, '#ff8a2a'); g.addColorStop(1, 'rgba(255,90,40,0)'); c.fillStyle = g; c.beginPath(); c.arc(x*k, y*k, r*k, 0, 7); c.fill(); } }
    if (P.k === 'metal'){ c.globalAlpha = 0.55; c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-s, -s*0.2); c.lineTo(-s*0.2, -s); c.lineTo(s*0.15, -s); c.lineTo(-s, s*0.15); c.closePath(); c.fill(); c.globalAlpha = 1; }
    c.restore();
    skinDecals(c, s, k, def);
}
function skinDecals(c, s, k, def){
    if (!def.layers || !def.layers.length) return;
    c.save(); rrPath(c, -s, -s, s*2, s*2, 4*k); c.clip(); drawCustomLayers(c, s, k, def.layers); c.restore();
}

// ---- headwear ----
// Shape-layer cosmetics from the designer (hats, faces, skin decals). Units: the body spans -12..12, y up is negative.
// Layer: {t:'rect'|'ellipse'|'poly', x,y, w,h,r | rx,ry | pts, rot, fill, fill2 (vertical gradient), stroke, sw, alpha, smooth, open, hidden}
function polyPath(c, pts, k, smooth, open){
    const P = pts.map(([x, y]) => [x*k, y*k]), n = P.length;
    if (!smooth || n < 3){ P.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); if (!open) c.closePath(); return; }
    const mid = (a, b) => [(a[0] + b[0])/2, (a[1] + b[1])/2];
    if (open){
        c.moveTo(P[0][0], P[0][1]);
        for (let i = 1; i < n - 1; i++){ const m = mid(P[i], P[i+1]); c.quadraticCurveTo(P[i][0], P[i][1], m[0], m[1]); }
        c.lineTo(P[n-1][0], P[n-1][1]); return;
    }
    const s0 = mid(P[n-1], P[0]); c.moveTo(s0[0], s0[1]);
    for (let i = 0; i < n; i++){ const m = mid(P[i], P[(i+1) % n]); c.quadraticCurveTo(P[i][0], P[i][1], m[0], m[1]); }
    c.closePath();
}
function layerCentre(L){ if (L.t !== 'poly') return [L.x, L.y]; if (!L._c){ let x = 0, y = 0; for (const p of L.pts){ x += p[0]; y += p[1]; } L._c = [x / L.pts.length, y / L.pts.length]; } return L._c; }
// Animation fields (premium cosmetics): spin (deg/s about the shape's centre), orbit (deg/s about pivot [px,py], default origin),
// bob {x,y,f,p} (sine drift), pulse {a,f,p} (opacity breathing), rainbow (hue cycle speed).
function drawCustomLayers(c, s, k, layers){
    const T = performance.now() / 1000;
    c.save();
    for (const L of layers){
        if (L.hidden) continue;
        c.save();
        let al = L.alpha === undefined ? 1 : L.alpha;
        if (L.orbit){ const pv = L.pivot || [0, 0]; c.translate(pv[0]*k, pv[1]*k); c.rotate(L.orbit * T * Math.PI / 180); c.translate(-pv[0]*k, -pv[1]*k); }
        if (L.bob){ const f = (L.bob.f || 1) * 6.2832, ph = L.bob.p || 0; c.translate(Math.sin(T*f + ph) * (L.bob.x || 0) * k, Math.sin(T*f + ph + 1.5708) * (L.bob.y || 0) * k); }
        if (L.pulse) al *= 1 - (L.pulse.a === undefined ? .3 : L.pulse.a) * (.5 + .5 * Math.sin(T * (L.pulse.f || 1) * 6.2832 + (L.pulse.p || 0)));
        c.globalAlpha = al;
        const spinRot = L.spin ? L.spin * T : 0;
        c.beginPath();
        let y0 = -1, y1 = 1;
        if (L.t === 'rect'){
            c.translate(L.x*k, L.y*k); c.rotate(((L.rot || 0) + spinRot)*Math.PI/180);
            rrPathAdd(c, -L.w/2*k, -L.h/2*k, L.w*k, L.h*k, Math.min(L.r || 0, L.w/2, L.h/2)*k); y0 = -L.h/2; y1 = L.h/2;
        } else if (L.t === 'ellipse'){
            c.translate(L.x*k, L.y*k); c.rotate(((L.rot || 0) + spinRot)*Math.PI/180);
            c.ellipse(0, 0, Math.max(.1, L.rx)*k, Math.max(.1, L.ry)*k, 0, 0, 7); y0 = -L.ry; y1 = L.ry;
        } else if (L.t === 'poly' && L.pts && L.pts.length >= (L.open ? 2 : 3)){
            if (spinRot){ const cc = layerCentre(L); c.translate(cc[0]*k, cc[1]*k); c.rotate(spinRot*Math.PI/180); c.translate(-cc[0]*k, -cc[1]*k); }
            polyPath(c, L.pts, k, L.smooth, L.open);
            if (L._y0 === undefined){ L._y0 = Infinity; L._y1 = -Infinity; for (const p of L.pts){ if (p[1] < L._y0) L._y0 = p[1]; if (p[1] > L._y1) L._y1 = p[1]; } }
            y0 = L._y0; y1 = L._y1;
        } else { c.restore(); continue; }
        let fill = L.fill, fill2 = L.fill2;
        if (L.rainbow){ const h = (T * L.rainbow * 60 + (L.hue || 0)) % 360; fill = 'hsl(' + h.toFixed(0) + ',92%,62%)'; if (fill2) fill2 = 'hsl(' + ((h + 50) % 360).toFixed(0) + ',92%,48%)'; }
        if (!L.open && fill && fill !== 'none'){
            if (fill2){ const g = c.createLinearGradient(0, y0*k, 0, y1*k); g.addColorStop(0, fill); g.addColorStop(1, fill2); c.fillStyle = g; }
            else c.fillStyle = fill;
            c.fill();
        }
        if (L.stroke){ c.strokeStyle = L.rainbow && L.open ? fill : L.stroke; c.lineWidth = (L.sw || 1)*k; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
        c.restore();
    }
    c.restore();
}
function customLayers(list, id){ const d = list.find(x => x.id === id); return d && d.layers ? d.layers : null; }
function drawHatAcc(c, s, k, id, t){
    if (!id || id === 'none') return;
    { const L = customLayers(HATS, id); if (L){ drawCustomLayers(c, s, k, L); return; } }
    const top = -s;
    c.save();
    if (id === 'cap'){
        // 3/4 view snapback: six-panel crown with seams, shaded side, curved brim with a darker underside, bolt logo
        const g = c.createLinearGradient(-s, top - 10*k, s*0.6, top + 2*k); g.addColorStop(0, '#ff7a8f'); g.addColorStop(0.55, '#e8364f'); g.addColorStop(1, '#a8203a');
        c.fillStyle = g; c.beginPath(); c.moveTo(-s*1.0, top + 2.5*k); c.bezierCurveTo(-s*1.05, top - 7*k, -s*0.35, top - 10.5*k, s*0.15, top - 10*k);
        c.bezierCurveTo(s*0.8, top - 9.5*k, s*1.05, top - 5*k, s*1.0, top + 2.5*k); c.closePath(); c.fill(); outline(c, k);
        c.strokeStyle = 'rgba(80,10,25,0.45)'; c.lineWidth = 0.8*k;
        for (const x of [-0.45, 0.15, 0.65]){ c.beginPath(); c.moveTo(s*0.15, top - 10*k); c.quadraticCurveTo(x*s, top - 5*k, x*s*1.15, top + 2*k); c.stroke(); }
        c.fillStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.ellipse(-s*0.5, top - 5.5*k, 1.6*k, 3.4*k, -0.5, 0, 7); c.fill();
        // bolt logo
        c.fillStyle = '#ffd84a'; c.beginPath(); c.moveTo(-1*k, top - 7*k); c.lineTo(-3.4*k, top - 2.4*k); c.lineTo(-1.2*k, top - 2.6*k); c.lineTo(-2.4*k, top + 0.6*k); c.lineTo(1.4*k, top - 4*k); c.lineTo(-0.6*k, top - 3.8*k); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(120,70,0,0.6)'; c.lineWidth = 0.5*k; c.stroke();
        // brim
        const bg = c.createLinearGradient(0, top - 1*k, 0, top + 4*k); bg.addColorStop(0, '#c92a44'); bg.addColorStop(1, '#6e1426');
        c.fillStyle = bg; c.beginPath(); c.moveTo(s*0.2, top + 1.8*k); c.bezierCurveTo(s*0.9, top - 1.5*k, s*1.7, top - 0.5*k, s*1.85, top + 2.5*k);
        c.bezierCurveTo(s*1.5, top + 4.2*k, s*0.8, top + 4*k, s*0.2, top + 3.2*k); c.closePath(); c.fill(); outline(c, k);
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.7*k; c.beginPath(); c.moveTo(s*0.5, top + 1.1*k); c.bezierCurveTo(s*1.0, top - 0.6*k, s*1.5, top - 0.1*k, s*1.7, top + 1.6*k); c.stroke();
        c.fillStyle = '#e8364f'; c.beginPath(); c.arc(s*0.15, top - 10*k, 1.3*k, 0, 7); c.fill(); outline(c, k, 0.8);
    }
    if (id === 'beanie'){
        // knitted: ribbed cuff, chevron knit texture, fluffy pompom with shading
        const g = c.createLinearGradient(-s, 0, s, 0); g.addColorStop(0, '#48c6ef'); g.addColorStop(1, '#2178a8');
        c.fillStyle = g; c.beginPath(); c.moveTo(-s*0.98, top + 3*k); c.bezierCurveTo(-s*1.02, top - 9*k, -s*0.4, top - 12*k, 0, top - 12*k);
        c.bezierCurveTo(s*0.4, top - 12*k, s*1.02, top - 9*k, s*0.98, top + 3*k); c.closePath(); c.fill(); outline(c, k);
        c.save(); c.clip(); c.strokeStyle = 'rgba(10,50,80,0.35)'; c.lineWidth = 0.8*k;
        for (let y = top - 10*k; y < top; y += 2.6*k) for (let x = -s; x < s; x += 3*k){ c.beginPath(); c.moveTo(x, y); c.lineTo(x + 1.5*k, y + 1.3*k); c.lineTo(x + 3*k, y); c.stroke(); }
        c.restore();
        const cg = c.createLinearGradient(0, top - 1.5*k, 0, top + 4*k); cg.addColorStop(0, '#1f6f9c'); cg.addColorStop(1, '#155478');
        c.fillStyle = cg; rrPath(c, -s*1.04, top - 1.5*k, s*2.08, 5.6*k, 2.2*k); c.fill(); outline(c, k);
        c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1*k; for (let x = -s + 1.6*k; x < s; x += 2.4*k){ c.beginPath(); c.moveTo(x, top - 0.6*k); c.lineTo(x, top + 3.2*k); c.stroke(); }
        const pg = c.createRadialGradient(-1.2*k, top - 14*k, 0.5*k, 0, top - 13*k, 4*k); pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#c9dbe6');
        c.fillStyle = pg; c.beginPath(); for (let i = 0; i < 14; i++){ const a = i/14*Math.PI*2, r = (i%2 ? 3.4 : 4.1)*k; c.lineTo(Math.cos(a)*r, top - 13*k + Math.sin(a)*r); } c.closePath(); c.fill(); outline(c, k, 0.9);
    }
    if (id === 'flower'){
        c.translate(s*0.62, top + 0.5*k);
        c.fillStyle = '#ff8fb1'; for (let i = 0; i < 5; i++){ const a = i/5*Math.PI*2; c.beginPath(); c.ellipse(Math.cos(a)*3*k, Math.sin(a)*3*k, 2.6*k, 2.6*k, 0, 0, 7); c.fill(); }
        c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(0, 0, 2.1*k, 0, 7); c.fill(); outline(c, k, 0.8);
        c.fillStyle = '#6fcf6a'; c.beginPath(); c.ellipse(-4.5*k, 3*k, 2.6*k, 1.2*k, 0.6, 0, 7); c.fill();
    }
    if (id === 'headphones'){
        c.strokeStyle = '#2b303b'; c.lineWidth = 2.6*k; c.lineCap = 'round'; c.beginPath(); c.arc(0, -1*k, s*1.08, Math.PI*1.08, Math.PI*1.92); c.stroke();
        c.strokeStyle = '#4a5162'; c.lineWidth = 1*k; c.beginPath(); c.arc(0, -1*k, s*1.08, Math.PI*1.12, Math.PI*1.88); c.stroke();
        for (const sx of [-1, 1]){ c.fillStyle = '#ff5470'; rrPath(c, sx*(s + 1*k) - 3*k, -6*k, 6*k, 11*k, 2.6*k); c.fill(); outline(c, k);
            c.fillStyle = 'rgba(255,255,255,0.3)'; rrPath(c, sx*(s + 1*k) - 1.6*k, -4.5*k, 1.6*k, 7*k, 0.8*k); c.fill(); }
    }
    if (id === 'bunny'){
        for (const [x, a, h] of [[-4.5, -0.18, 12], [5, 0.22, 13.5]]){
            c.save(); c.translate(x*k, top + 1*k); c.rotate(a);
            c.fillStyle = '#f4f6fa'; c.beginPath(); c.ellipse(0, -h*0.5*k, 3.2*k, h*0.55*k, 0, 0, 7); c.fill(); outline(c, k);
            c.fillStyle = '#ff9fbf'; c.beginPath(); c.ellipse(0, -h*0.5*k, 1.6*k, h*0.38*k, 0, 0, 7); c.fill();
            c.restore();
        }
    }
    if (id === 'party'){
        // glossy cone with zigzag trim, polka confetti and a paper tassel on top
        c.save(); c.translate(1.5*k, top + 1*k); c.rotate(0.16);
        const cone = () => { c.beginPath(); c.moveTo(-7.5*k, 0); c.quadraticCurveTo(-3*k, -9*k, 0, -18*k); c.quadraticCurveTo(3*k, -9*k, 7.5*k, 0); c.quadraticCurveTo(0, 2*k, -7.5*k, 0); c.closePath(); };
        const g = c.createLinearGradient(-7*k, 0, 7*k, 0); g.addColorStop(0, '#a58cff'); g.addColorStop(0.5, '#7c5cf0'); g.addColorStop(1, '#4e36b8');
        cone(); c.fillStyle = g; c.fill();
        c.save(); cone(); c.clip();
        c.fillStyle = '#ffcf3f'; for (const [x, y, r] of [[-2.5,-4,1.3],[2.8,-7,1.1],[-0.5,-11,1],[3.5,-2,0.9],[-4.5,-1.5,0.8]]){ c.beginPath(); c.arc(x*k, y*k, r*k, 0, 7); c.fill(); }
        c.fillStyle = '#35e0c8'; for (const [x, y] of [[1,-4.5],[-2,-8],[0.5,-14]]){ c.beginPath(); c.arc(x*k, y*k, 0.8*k, 0, 7); c.fill(); }
        c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.moveTo(-5*k, -1*k); c.quadraticCurveTo(-2.5*k, -9*k, -0.5*k, -16*k); c.lineTo(-1.8*k, -8*k); c.closePath(); c.fill();
        c.restore();
        cone(); outline(c, k);
        c.fillStyle = '#ff5470'; c.beginPath(); for (let i = 0; i <= 10; i++){ const x = -7.5*k + i*1.5*k; c.lineTo(x, (i%2 ? 1.2 : -0.6)*k); } c.lineTo(7.5*k, 2*k); c.lineTo(-7.5*k, 2*k); c.closePath(); c.fill();
        for (let i = 0; i < 5; i++){ const a = -Math.PI/2 + (i - 2)*0.45; c.strokeStyle = ['#ff5470','#ffcf3f','#35e0c8','#ff9838','#ffffff'][i]; c.lineWidth = 1.3*k;
            c.beginPath(); c.moveTo(0, -18*k); c.quadraticCurveTo(Math.cos(a)*3*k, -18*k + Math.sin(a)*3*k - 1*k, Math.cos(a)*4.5*k, -18*k + Math.sin(a)*4.5*k); c.stroke(); }
        c.restore();
    }
    if (id === 'chef'){
        // outline pass first, fill pass on top: one clean silhouette instead of overlapping rings
        const shapes = () => { c.beginPath(); c.arc(-5*k, top - 8*k, 5*k, 0, 7); c.moveTo(5.5*k + 5*k, top - 8*k); c.arc(5.5*k, top - 8*k, 5*k, 0, 7);
            c.moveTo(5.5*k, top - 11*k); c.arc(0, top - 11*k, 5.5*k, 0, 7); rrPathAdd(c, -s*0.8, top - 6*k, s*1.6, 7*k, 1.5*k); };
        shapes(); c.strokeStyle = OUT; c.lineWidth = 2.6*k; c.lineJoin = 'round'; c.stroke();
        c.fillStyle = '#f4f6fa'; shapes(); c.fill();
        c.strokeStyle = 'rgba(13,16,23,0.16)'; c.lineWidth = 0.8*k; for (const x of [-4, 0, 4]){ c.beginPath(); c.moveTo(x*k, top - 5*k); c.lineTo(x*k, top + 0.5*k); c.stroke(); }
        c.fillStyle = 'rgba(13,16,23,0.08)'; c.beginPath(); c.ellipse(3*k, top - 7*k, 4*k, 2*k, 0, 0, 7); c.fill();
    }
    if (id === 'cowboy'){
        c.fillStyle = '#9a6034'; c.beginPath(); c.moveTo(-7.5*k, top - 1*k); c.quadraticCurveTo(-9*k, top - 13*k, -3*k, top - 12*k);
        c.quadraticCurveTo(0, top - 9*k, 3*k, top - 12*k); c.quadraticCurveTo(9*k, top - 13*k, 7.5*k, top - 1*k); c.closePath(); c.fill(); outline(c, k);
        c.fillStyle = '#5e3a1c'; c.fillRect(-7.6*k, top - 4.5*k, 15.2*k, 2.8*k);
        c.fillStyle = '#ffcf3f'; c.beginPath(); c.arc(5*k, top - 3.1*k, 1.1*k, 0, 7); c.fill();
        c.fillStyle = '#b37745'; c.beginPath(); c.moveTo(-s*1.7, top - 4*k); c.quadraticCurveTo(-s*1.1, top + 2.5*k, 0, top + 1.5*k);
        c.quadraticCurveTo(s*1.1, top + 2.5*k, s*1.7, top - 4*k); c.quadraticCurveTo(s*1.2, top - 0.5*k, 0, top - 1.5*k);
        c.quadraticCurveTo(-s*1.2, top - 0.5*k, -s*1.7, top - 4*k); c.closePath(); c.fill(); outline(c, k);
        c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1*k; c.beginPath(); c.moveTo(-4*k, top - 10*k); c.quadraticCurveTo(-5*k, top - 7*k, -4.5*k, top - 5*k); c.stroke();
    }
    if (id === 'antenna'){
        // springy coiled stalks with glowing orbs
        for (const sx of [-1, 1]){
            c.strokeStyle = '#3a4050'; c.lineWidth = 1*k; c.beginPath(); c.moveTo(sx*3.5*k, top + 0.5*k);
            for (let i = 1; i <= 8; i++){ const tt = i/8; c.lineTo(sx*(3.5 + 3*tt)*k + (i%2 ? 1.3 : -1.3)*k, top - tt*9*k); } c.stroke();
            const ox = sx*6.5*k, oy = top - 11*k;
            const hg = c.createRadialGradient(ox, oy, 0, ox, oy, 4.5*k); hg.addColorStop(0, 'rgba(124,255,107,0.55)'); hg.addColorStop(1, 'rgba(124,255,107,0)');
            c.fillStyle = hg; c.beginPath(); c.arc(ox, oy, 4.5*k, 0, 7); c.fill();
            const og = c.createRadialGradient(ox - 0.8*k, oy - 0.8*k, 0.2*k, ox, oy, 2.3*k); og.addColorStop(0, '#f2ffe8'); og.addColorStop(0.45, '#8dff72'); og.addColorStop(1, '#2fb34a');
            c.fillStyle = og; c.beginPath(); c.arc(ox, oy, 2.3*k, 0, 7); c.fill(); outline(c, k, 0.7);
        }
        c.fillStyle = '#3a4050'; for (const sx of [-1, 1]){ c.beginPath(); c.ellipse(sx*3.5*k, top + 0.5*k, 1.8*k, 1*k, 0, 0, 7); c.fill(); }
    }
    if (id === 'propeller'){
        // classic propeller beanie: gradient panels, gold stem, spinning blades with a motion-blur disc
        const cols = [['#ff7a8f','#d93550'], ['#ffe07a','#e0a525'], ['#5ff0d6','#1fae98'], ['#7fa2ff','#3d5fd6']];
        for (let i = 0; i < 4; i++){ const a0 = Math.PI + i*Math.PI/4, a1 = a0 + Math.PI/4;
            const g = c.createLinearGradient(Math.cos(a0)*s, top + 2*k + Math.sin(a0)*s, Math.cos(a1)*s, top + 2*k + Math.sin(a1)*s); g.addColorStop(0, cols[i][0]); g.addColorStop(1, cols[i][1]);
            c.fillStyle = g; c.beginPath(); c.moveTo(0, top + 2*k); c.arc(0, top + 2*k, s*0.98, a0, a1); c.closePath(); c.fill(); }
        c.strokeStyle = 'rgba(13,16,23,0.35)'; c.lineWidth = 0.7*k; for (let i = 1; i < 4; i++){ const a = Math.PI + i*Math.PI/4; c.beginPath(); c.moveTo(0, top + 2*k); c.lineTo(Math.cos(a)*s*0.98, top + 2*k + Math.sin(a)*s*0.98); c.stroke(); }
        c.beginPath(); c.arc(0, top + 2*k, s*0.98, Math.PI, 0); outline(c, k);
        c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.ellipse(-s*0.4, top - 4*k, 2*k, 3.6*k, -0.6, 0, 7); c.fill();
        c.fillStyle = '#1d2029'; rrPath(c, -s*1.0, top + 1*k, s*2.0, 2*k, 1*k); c.fill();
        const sg = c.createLinearGradient(-0.8*k, 0, 0.8*k, 0); sg.addColorStop(0, '#ffe28a'); sg.addColorStop(1, '#b07a14');
        c.fillStyle = sg; c.fillRect(-0.8*k, top - 14*k, 1.6*k, 4.8*k);
        const spin = (t || 0) * 22;
        c.save(); c.translate(0, top - 14*k); c.scale(1, 0.32);
        c.fillStyle = 'rgba(200,210,230,0.18)'; c.beginPath(); c.arc(0, 0, 10*k, 0, 7); c.fill();
        c.rotate(spin);
        for (const a of [0, Math.PI]){ c.save(); c.rotate(a);
            const bg = c.createLinearGradient(0, -2*k, 0, 2*k); bg.addColorStop(0, '#f4f6fa'); bg.addColorStop(1, '#8e98ab');
            c.fillStyle = bg; c.beginPath(); c.moveTo(1*k, -1*k); c.quadraticCurveTo(6*k, -3.2*k, 10*k, -1.2*k); c.quadraticCurveTo(10.5*k, 0.5*k, 9*k, 1.5*k); c.quadraticCurveTo(5*k, 2*k, 1*k, 1*k); c.closePath(); c.fill();
            c.restore(); }
        c.restore();
        c.fillStyle = '#ff5470'; c.beginPath(); c.arc(0, top - 14*k, 1.4*k, 0, 7); c.fill(); outline(c, k, 0.7);
    }
    if (id === 'tophat'){
        c.fillStyle = '#1d2029'; rrPath(c, -s*0.62, top - 15*k, s*1.24, 15*k, 1.5*k); c.fill(); outline(c, k);
        c.fillStyle = '#ff5470'; c.fillRect(-s*0.62, top - 5.5*k, s*1.24, 2.6*k);
        c.fillStyle = '#1d2029'; c.beginPath(); c.ellipse(0, top + 0.2*k, s*1.05, 2.2*k, 0, 0, 7); c.fill(); outline(c, k);
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(-s*0.45, top - 14*k, 1.8*k, 8*k);
    }
    if (id === 'viking'){
        for (const sx of [-1, 1]){ c.fillStyle = '#f1e6c8'; c.beginPath(); c.moveTo(sx*s*0.72, top - 1*k); c.quadraticCurveTo(sx*s*1.45, top - 2*k, sx*s*1.3, top - 12*k); c.quadraticCurveTo(sx*s*1.15, top - 5*k, sx*s*0.6, top - 5*k); c.closePath(); c.fill(); outline(c, k); }
        const g = c.createLinearGradient(0, top - 9*k, 0, top + 2*k); g.addColorStop(0, '#c9d1e3'); g.addColorStop(1, '#7d879a');
        c.fillStyle = g; c.beginPath(); c.moveTo(-s*0.98, top + 2*k); c.quadraticCurveTo(-s*0.98, top - 9*k, 0, top - 9*k); c.quadraticCurveTo(s*0.98, top - 9*k, s*0.98, top + 2*k); c.closePath(); c.fill(); outline(c, k);
        c.fillStyle = '#6b5a3a'; c.fillRect(-s*0.98, top - 0.5*k, s*1.96, 2.8*k);
        c.fillStyle = '#d8b25a'; for (const x of [-7, -2.5, 2.5, 7]){ c.beginPath(); c.arc(x*k, top + 0.9*k, 0.8*k, 0, 7); c.fill(); }
    }
    if (id === 'wizard'){
        // crooked, slumping cone with fabric folds, embroidered moon & stars, shaded wide brim
        const cone = () => { c.beginPath(); c.moveTo(-8*k, top + 0.5*k); c.bezierCurveTo(-6*k, top - 7*k, -3*k, top - 13*k, 1*k, top - 18*k);
            c.bezierCurveTo(4*k, top - 22*k, 9*k, top - 21*k, 10.5*k, top - 16.5*k); c.bezierCurveTo(8*k, top - 18*k, 5.5*k, top - 16*k, 4.5*k, top - 12*k);
            c.bezierCurveTo(5*k, top - 7*k, 6.5*k, top - 3*k, 8*k, top + 0.5*k); c.closePath(); };
        const g = c.createLinearGradient(-8*k, 0, 8*k, 0); g.addColorStop(0, '#8a6cf0'); g.addColorStop(0.55, '#5a3fc0'); g.addColorStop(1, '#33217a');
        cone(); c.fillStyle = g; c.fill();
        c.save(); cone(); c.clip();
        c.strokeStyle = 'rgba(20,10,60,0.35)'; c.lineWidth = 1*k;
        c.beginPath(); c.moveTo(-3*k, top - 1*k); c.quadraticCurveTo(-1*k, top - 8*k, 2*k, top - 15*k); c.stroke();
        c.beginPath(); c.moveTo(3*k, top - 1*k); c.quadraticCurveTo(3.5*k, top - 6*k, 3.8*k, top - 11*k); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.14)'; c.beginPath(); c.moveTo(-6*k, top); c.bezierCurveTo(-4*k, top - 8*k, -2*k, top - 12*k, 0.5*k, top - 16*k); c.lineTo(-2*k, top - 8*k); c.closePath(); c.fill();
        c.restore();
        cone(); outline(c, k);
        // crescent moon
        c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(-1*k, top - 7*k, 2.6*k, 0, 7); c.fill();
        c.fillStyle = '#5a3fc0'; c.beginPath(); c.arc(0.2*k, top - 7.8*k, 2.2*k, 0, 7); c.fill();
        const star = (x, y, r) => { c.beginPath(); for (let i = 0; i < 10; i++){ const a = i/10*Math.PI*2 - Math.PI/2, rr = (i%2 ? 0.42 : 1)*r; c.lineTo(x + Math.cos(a)*rr, y + Math.sin(a)*rr); } c.closePath(); c.fill(); };
        c.fillStyle = '#ffe98a'; star(3*k, top - 13*k, 1.4*k); star(2.5*k, top - 3.5*k, 1.1*k); star(8.8*k, top - 17*k, 0.9*k);
        // brim
        const bg = c.createLinearGradient(0, top - 2*k, 0, top + 3*k); bg.addColorStop(0, '#4a33a0'); bg.addColorStop(1, '#241563');
        c.fillStyle = bg; c.beginPath(); c.ellipse(0, top + 0.8*k, s*1.28, 2.8*k, -0.05, 0, 7); c.fill(); outline(c, k);
        c.fillStyle = '#c9a23a'; c.beginPath(); c.moveTo(-7.8*k, top - 0.2*k); c.quadraticCurveTo(0, top + 1.8*k, 7.8*k, top - 0.2*k); c.lineTo(7.6*k, top - 1.8*k); c.quadraticCurveTo(0, top + 0.2*k, -7.6*k, top - 1.8*k); c.closePath(); c.fill();
    }
    if (id === 'halo'){
        // floating ring with a soft glow, a hot inner rim and a couple of sparkles; bobs gently
        const hy = top - 7*k + Math.sin((t || 0) * 3) * 0.8*k;
        const glow = c.createRadialGradient(0, hy, s*0.3, 0, hy, s*1.2); glow.addColorStop(0, 'rgba(255,220,110,0.28)'); glow.addColorStop(1, 'rgba(255,220,110,0)');
        c.fillStyle = glow; c.beginPath(); c.ellipse(0, hy, s*1.2, 5*k, 0, 0, 7); c.fill();
        c.strokeStyle = '#c98c14'; c.lineWidth = 2.8*k; c.beginPath(); c.ellipse(0, hy + 0.4*k, s*0.86, 2.6*k, 0, 0, 7); c.stroke();
        const rg = c.createLinearGradient(-s, 0, s, 0); rg.addColorStop(0, '#ffcf3f'); rg.addColorStop(0.5, '#fff6cc'); rg.addColorStop(1, '#ffcf3f');
        c.strokeStyle = rg; c.lineWidth = 1.8*k; c.beginPath(); c.ellipse(0, hy, s*0.86, 2.6*k, 0, 0, 7); c.stroke();
        c.fillStyle = '#ffffff'; for (const [x, y, r] of [[-s*0.7, hy - 3*k, 1.2*k], [s*0.8, hy + 2.5*k, 0.9*k]]){
            c.beginPath(); c.moveTo(x, y - r*2); c.lineTo(x + r*0.5, y - r*0.5); c.lineTo(x + r*2, y); c.lineTo(x + r*0.5, y + r*0.5); c.lineTo(x, y + r*2); c.lineTo(x - r*0.5, y + r*0.5); c.lineTo(x - r*2, y); c.lineTo(x - r*0.5, y - r*0.5); c.closePath(); c.fill(); }
    }
    if (id === 'crown'){
        const g = c.createLinearGradient(0, top - 11*k, 0, top + 1*k); g.addColorStop(0, '#fff1a8'); g.addColorStop(0.5, '#ffcf3f'); g.addColorStop(1, '#c98c14');
        c.fillStyle = g; c.beginPath(); c.moveTo(-s*0.85, top + 1*k); c.lineTo(-s*0.85, top - 7*k); c.lineTo(-s*0.45, top - 3*k); c.lineTo(0, top - 11*k); c.lineTo(s*0.45, top - 3*k); c.lineTo(s*0.85, top - 7*k); c.lineTo(s*0.85, top + 1*k); c.closePath(); c.fill(); outline(c, k);
        c.fillStyle = '#b8781a'; c.fillRect(-s*0.85, top - 1.5*k, s*1.7, 2*k);
        for (const [x, y, col] of [[0, -11, '#ff5470'], [-s*0.85/k, -7, '#5b8def'], [s*0.85/k, -7, '#5b8def']]){ c.fillStyle = col; c.beginPath(); c.arc(x*k, top + y*k, 1.5*k, 0, 7); c.fill(); outline(c, k, 0.7); }
        c.fillStyle = '#35e0c8'; c.beginPath(); c.arc(0, top - 0.5*k, 1.3*k, 0, 7); c.fill();
    }
    if (id === 'flighthelm'){
        const g=c.createLinearGradient(0,top-11*k,0,top+3*k);g.addColorStop(0,'#e7f0f5');g.addColorStop(.5,'#9daeba');g.addColorStop(1,'#4e626f');
        c.fillStyle=g;c.beginPath();c.moveTo(-s*.92,top+3*k);c.quadraticCurveTo(-s*.9,top-11*k,0,top-11*k);c.quadraticCurveTo(s*.9,top-11*k,s*.92,top+3*k);c.closePath();c.fill();outline(c,k);
        c.fillStyle='#d8b25a';c.fillRect(-s*.92,top+1*k,s*1.84,2*k);
        c.fillStyle='#202934';rrPath(c,-s*.76,top-2*k,s*1.52,4*k,2*k);c.fill();
        c.strokeStyle='#8deaff';c.lineWidth=1.1*k;c.beginPath();c.moveTo(-s*.65,top-1*k);c.quadraticCurveTo(0,top-4*k,s*.65,top-1*k);c.stroke();
        for(const x of [-s*.65,s*.65]){c.fillStyle='#ffcf3f';c.beginPath();c.arc(x,top+2*k,.9*k,0,7);c.fill();}
    }
    if (id === 'foxcrest'){
        for(const sx of [-1,1]){c.save();c.translate(sx*5*k,top);c.rotate(sx*.16);c.fillStyle='#d94d43';c.beginPath();c.moveTo(-4*k,2*k);c.lineTo(-2.4*k,-9*k);c.quadraticCurveTo(0,-6*k,4*k,2*k);c.closePath();c.fill();outline(c,k,.9);c.fillStyle='#ffcf9c';c.beginPath();c.moveTo(-1.7*k,-1*k);c.lineTo(-1.3*k,-6*k);c.lineTo(2*k,1*k);c.closePath();c.fill();c.restore();}
        c.fillStyle='#ffd078';c.beginPath();c.arc(0,top+1*k,2*k,0,7);c.fill();
    }
    if (id === 'headband'){
        const g=c.createLinearGradient(-s,top,s,top);g.addColorStop(0,'#7a102f');g.addColorStop(.5,'#ff426e');g.addColorStop(1,'#831a44');
        c.fillStyle=g;c.beginPath();c.moveTo(-s,top+1*k);c.quadraticCurveTo(0,top-5*k,s,top+1*k);c.lineTo(s,top+4*k);c.quadraticCurveTo(0,top-1*k,-s,top+4*k);c.closePath();c.fill();outline(c,k,.7);
        c.strokeStyle='rgba(255,230,240,.65)';c.lineWidth=.7*k;c.beginPath();c.moveTo(-s*.7,top+1*k);c.quadraticCurveTo(0,top-2*k,s*.7,top+1*k);c.stroke();
        c.fillStyle='#ff426e';c.beginPath();c.moveTo(s*.72,top+2*k);c.lineTo(s*1.42,top+6*k);c.lineTo(s*1.08,top+7*k);c.lineTo(s*1.5,top+10*k);c.lineTo(s*.68,top+5*k);c.closePath();c.fill();outline(c,k,.7);
    }
    if (id === 'spacehelm'){
        const g=c.createLinearGradient(-s,top-12*k,s,top+2*k);g.addColorStop(0,'rgba(198,246,255,.92)');g.addColorStop(.48,'rgba(81,135,174,.88)');g.addColorStop(1,'rgba(25,48,78,.96)');
        c.fillStyle=g;c.beginPath();c.ellipse(0,top-3*k,s*1.08,9*k,0,Math.PI,Math.PI*2);c.lineTo(s*1.08,top+3*k);c.quadraticCurveTo(0,top+6*k,-s*1.08,top+3*k);c.closePath();c.fill();outline(c,k,1.1);
        c.strokeStyle='rgba(235,255,255,.82)';c.lineWidth=1*k;c.beginPath();c.ellipse(0,top-3*k,s*.89,6.6*k,0,Math.PI,Math.PI*2);c.stroke();
        c.fillStyle='#ffcf3f';for(const sx of [-1,1]){c.beginPath();c.arc(sx*s*.78,top+2*k,1.1*k,0,7);c.fill();}
        c.fillStyle='rgba(255,255,255,.62)';c.beginPath();c.ellipse(-4*k,top-7*k,2.6*k,1*k,-.5,0,7);c.fill();
    }
    if (id === 'petalcrown'){
        const gold='#e9bd4d';for(const [x,y,color] of [[-7,-3,'#ff779e'],[-3,-7,'#ffe5ed'],[2,-8,'#ff779e'],[7,-3,'#fff0cf']]){
            c.fillStyle=color;c.beginPath();c.ellipse(x*k,(top+y*k),2.4*k,3.8*k,x*.08,0,7);c.fill();outline(c,k,.65);
        }
        c.strokeStyle=gold;c.lineWidth=1.2*k;c.beginPath();c.moveTo(-s*.9,top+2*k);c.quadraticCurveTo(0,top+4*k,s*.9,top+2*k);c.stroke();
        c.fillStyle='#5fc78b';c.beginPath();c.ellipse(-5*k,top+1*k,2.6*k,1.2*k,-.35,0,7);c.ellipse(4*k,top+1*k,2.6*k,1.2*k,.35,0,7);c.fill();
    }
    if (id === 'voidhorns'){
        for(const sx of [-1,1]){const g=c.createLinearGradient(0,top-14*k,0,top+2*k);g.addColorStop(0,'#d9c4ff');g.addColorStop(.5,'#795bd4');g.addColorStop(1,'#29213f');c.fillStyle=g;c.beginPath();c.moveTo(sx*4*k,top+2*k);c.quadraticCurveTo(sx*11*k,top-2*k,sx*10*k,top-14*k);c.quadraticCurveTo(sx*8*k,top-8*k,sx*6*k,top-8*k);c.quadraticCurveTo(sx*7*k,top-2*k,sx*4*k,top+2*k);c.fill();outline(c,k,.9);}
        c.fillStyle='#ff75d1';c.beginPath();c.arc(0,top-1*k,1.7*k,0,7);c.fill();
    }
    c.restore();
}

// ---- face accessories (drawn over the eyes at (±4k, -2k)) ----
function drawFaceAcc(c, s, k, id){
    { const L = id && customLayers(FACES, id); if (L){ drawCustomLayers(c, s, k, L); return; } }
    if (!id || id === 'none') return;
    const ey = -2*k;
    c.save();
    if (id === 'blush'){ c.fillStyle = 'rgba(255,111,156,0.55)'; for (const sx of [-1, 1]){ c.beginPath(); c.ellipse(sx*7*k, 3*k, 2.6*k, 1.5*k, 0, 0, 7); c.fill(); } }
    if (id === 'round'){ c.strokeStyle = '#1a1d24'; c.lineWidth = 1.1*k; for (const sx of [-1, 1]){ c.beginPath(); c.arc(sx*4*k, ey, 3.8*k, 0, 7); c.stroke(); }
        c.beginPath(); c.moveTo(-0.3*k, ey); c.lineTo(0.3*k, ey); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.25)'; for (const sx of [-1, 1]){ c.beginPath(); c.arc(sx*4*k - 1.2*k, ey - 1.3*k, 1*k, 0, 7); c.fill(); } }
    if (id === 'mustache'){ c.fillStyle = '#3a2615'; c.beginPath(); c.moveTo(0, 3*k);
        c.bezierCurveTo(-2*k, 1.5*k, -6*k, 2*k, -8*k, 5.5*k); c.bezierCurveTo(-6*k, 4*k, -3*k, 5.5*k, 0, 4.6*k);
        c.bezierCurveTo(3*k, 5.5*k, 6*k, 4*k, 8*k, 5.5*k); c.bezierCurveTo(6*k, 2*k, 2*k, 1.5*k, 0, 3*k); c.fill(); }
    if (id === 'shades'){ for (const sx of [-1, 1]){ const g = c.createLinearGradient(0, ey - 3*k, 0, ey + 3*k); g.addColorStop(0, '#3a3f4c'); g.addColorStop(1, '#0d0f14');
            c.fillStyle = g; rrPath(c, sx > 0 ? 0.8*k : -8.8*k, ey - 3*k, 8*k, 5.6*k, 2.2*k); c.fill(); outline(c, k, 0.9);
            c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.moveTo((sx > 0 ? 2.2 : -7.4)*k, ey - 1.8*k); c.lineTo((sx > 0 ? 4 : -5.6)*k, ey - 1.8*k); c.lineTo((sx > 0 ? 2.6 : -7)*k, ey + 0.6*k); c.closePath(); c.fill(); }
        c.strokeStyle = '#0d0f14'; c.lineWidth = 1.2*k; c.beginPath(); c.moveTo(-0.8*k, ey - 1.5*k); c.lineTo(0.8*k, ey - 1.5*k); c.stroke(); }
    if (id === 'nerd'){ c.strokeStyle = '#111318'; c.lineWidth = 1.8*k; for (const sx of [-1, 1]){ rrPath(c, sx > 0 ? 0.9*k : -8.1*k, ey - 3*k, 7.2*k, 6*k, 1*k); c.stroke(); }
        c.fillStyle = 'rgba(190,220,255,0.18)'; for (const sx of [-1, 1]){ rrPath(c, sx > 0 ? 0.9*k : -8.1*k, ey - 3*k, 7.2*k, 6*k, 1*k); c.fill(); }
        c.fillStyle = '#f4f6fa'; c.fillRect(-1.6*k, ey - 1.8*k, 3.2*k, 2.6*k); c.strokeStyle = 'rgba(13,16,23,0.4)'; c.lineWidth = 0.6*k; c.strokeRect(-1.6*k, ey - 1.8*k, 3.2*k, 2.6*k); }
    if (id === 'patch'){ c.strokeStyle = '#111318'; c.lineWidth = 1*k; c.beginPath(); c.moveTo(-s, -9*k); c.lineTo(s, 3*k); c.stroke();
        c.fillStyle = '#111318'; c.beginPath(); c.ellipse(-4*k, ey, 3.8*k, 3.4*k, -0.25, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.ellipse(-5*k, ey - 1.2*k, 1.2*k, 0.7*k, -0.3, 0, 7); c.fill(); }
    if (id === 'hearts'){ for (const sx of [-1, 1]){ c.save(); c.translate(sx*4.2*k, ey);
            c.fillStyle = '#ff4f8a'; c.beginPath(); c.moveTo(0, 3*k); c.bezierCurveTo(-5*k, -0.5*k, -3*k, -5*k, 0, -2.2*k); c.bezierCurveTo(3*k, -5*k, 5*k, -0.5*k, 0, 3*k); c.fill(); outline(c, k, 0.8);
            c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(-1.6*k, -1.4*k, 0.9*k, 0.6*k, -0.5, 0, 7); c.fill(); c.restore(); }
        c.strokeStyle = '#c93362'; c.lineWidth = 0.9*k; c.beginPath(); c.moveTo(-0.6*k, ey - 0.8*k); c.lineTo(0.6*k, ey - 0.8*k); c.stroke(); }
    if (id === '3d'){ c.fillStyle = '#f4f6fa'; rrPath(c, -9.5*k, ey - 3.4*k, 19*k, 6.8*k, 1.2*k); c.fill(); outline(c, k, 0.9);
        c.fillStyle = 'rgba(255,60,80,0.85)'; rrPath(c, -8.3*k, ey - 2.4*k, 7*k, 4.8*k, 0.8*k); c.fill();
        c.fillStyle = 'rgba(40,210,230,0.85)'; rrPath(c, 1.3*k, ey - 2.4*k, 7*k, 4.8*k, 0.8*k); c.fill(); }
    if (id === 'bandit'){ c.fillStyle = '#1a1d24'; c.beginPath(); rrPath(c, -s*1.02, ey - 3.2*k, s*2.04, 6.4*k, 2*k);
        c.moveTo(-4*k + 2.8*k, ey); c.arc(-4*k, ey, 2.8*k, 0, Math.PI*2, true); c.moveTo(4*k + 2.8*k, ey); c.arc(4*k, ey, 2.8*k, 0, Math.PI*2, true); c.fill('evenodd');
        c.strokeStyle = '#1a1d24'; c.lineWidth = 1.2*k; c.beginPath(); c.moveTo(s, ey); c.quadraticCurveTo(s + 4*k, ey + 2*k, s + 3*k, ey + 6*k); c.stroke(); }
    if (id === 'aviator'){ for (const sx of [-1, 1]){ c.save(); c.translate(sx*4.4*k, ey);
            const g = c.createLinearGradient(0, -3*k, 0, 3.5*k); g.addColorStop(0, '#ffb347'); g.addColorStop(1, '#8a3a16');
            c.fillStyle = g; c.beginPath(); c.moveTo(-3.6*k, -2.4*k); c.quadraticCurveTo(0, -3.4*k, 3.6*k, -2.4*k); c.quadraticCurveTo(3.8*k, 3.5*k, 0, 3.4*k); c.quadraticCurveTo(-3.8*k, 3.5*k, -3.6*k, -2.4*k); c.fill();
            c.strokeStyle = '#d8b25a'; c.lineWidth = 0.9*k; c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(-1.4*k, -0.8*k, 1.1*k, 0.6*k, -0.4, 0, 7); c.fill(); c.restore(); }
        c.strokeStyle = '#d8b25a'; c.lineWidth = 0.9*k; c.beginPath(); c.moveTo(-0.9*k, ey - 2.4*k); c.quadraticCurveTo(0, ey - 3.2*k, 0.9*k, ey - 2.4*k); c.stroke(); }
    if (id === 'monocle'){ c.strokeStyle = '#d8b25a'; c.lineWidth = 1.3*k; c.beginPath(); c.arc(4*k, ey, 3.9*k, 0, 7); c.stroke();
        c.fillStyle = 'rgba(200,230,255,0.22)'; c.beginPath(); c.arc(4*k, ey, 3.3*k, 0, 7); c.fill();
        c.strokeStyle = '#d8b25a'; c.lineWidth = 0.6*k; c.setLineDash([1*k, 0.8*k]); c.beginPath(); c.moveTo(7.6*k, ey + 1.5*k); c.quadraticCurveTo(10*k, ey + 7*k, 8*k, s); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(2.6*k, ey - 1.4*k, 0.8*k, 0, 7); c.fill(); }
    if (id === 'visor'){ const g = c.createLinearGradient(-s, 0, s, 0); g.addColorStop(0, '#5b6ef0'); g.addColorStop(0.5, '#35e0c8'); g.addColorStop(1, '#b36bff');
        c.fillStyle = '#12151c'; rrPath(c, -s*1.04, ey - 3.6*k, s*2.08, 7*k, 3.2*k); c.fill();
        c.fillStyle = g; c.globalAlpha = 0.85; rrPath(c, -s*0.96, ey - 2.6*k, s*1.92, 5*k, 2.4*k); c.fill(); c.globalAlpha = 1;
        c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(-s*0.8, ey - 1.6*k, s*1.6, 0.8*k);
        c.fillStyle = '#eafffb'; for (const sx of [-1, 1]){ c.beginPath(); c.arc(sx*4*k, ey + 0.4*k, 1.2*k, 0, 7); c.fill(); } }
    if (id === 'hologlass'){
        const g=c.createLinearGradient(-s,ey-4*k,s,ey+4*k);g.addColorStop(0,'rgba(85,242,237,.25)');g.addColorStop(.5,'rgba(228,255,255,.92)');g.addColorStop(1,'rgba(183,112,255,.4)');
        for(const sx of [-1,1]){c.fillStyle=g;c.beginPath();c.ellipse(sx*4*k,ey,3.8*k,3.2*k,0,0,7);c.fill();c.strokeStyle='#dcffff';c.lineWidth=.9*k;c.stroke();c.fillStyle='rgba(255,255,255,.8)';c.beginPath();c.ellipse(sx*4*k-1.1*k,ey-1*k,1*k,.55*k,-.4,0,7);c.fill();}
        c.strokeStyle='#77e9ed';c.lineWidth=1*k;c.beginPath();c.moveTo(-.5*k,ey);c.lineTo(.5*k,ey);c.stroke();
    }
    if (id === 'startrace'){
        c.strokeStyle='#b8a1ff';c.lineWidth=.85*k;
        for(const sx of [-1,1]){c.beginPath();c.arc(sx*4*k,ey,4.2*k,Math.PI*.12,Math.PI*.88);c.stroke();c.fillStyle='#fff1a4';c.beginPath();c.arc(sx*7.5*k,ey+2*k,1*k,0,7);c.fill();}
        c.strokeStyle='rgba(184,161,255,.75)';c.beginPath();c.moveTo(-s*.8,ey-7*k);c.lineTo(-s*.58,ey-4*k);c.moveTo(s*.8,ey-7*k);c.lineTo(s*.58,ey-4*k);c.stroke();
    }
    if (id === 'frostmark'){
        c.strokeStyle='#c7f7ff';c.lineWidth=.9*k;c.lineCap='round';
        for(const sx of [-1,1]){const x=sx*7*k;c.beginPath();c.moveTo(x,ey+1*k);c.lineTo(x+sx*1.5*k,ey+5*k);c.lineTo(x+sx*3*k,ey+7*k);c.moveTo(x+sx*1.5*k,ey+5*k);c.lineTo(x-sx*.5*k,ey+7*k);c.stroke();}
        c.fillStyle='rgba(145,238,255,.75)';c.beginPath();c.arc(0,ey+6*k,.8*k,0,7);c.fill();
    }
    if (id === 'foxmark'){
        c.fillStyle='#ff9c52';for(const sx of [-1,1]){c.save();c.translate(sx*7*k,ey+5*k);c.rotate(sx*.3);c.beginPath();c.moveTo(-2.5*k,-1*k);c.quadraticCurveTo(0,-4*k,2.4*k,-1*k);c.lineTo(.8*k,2*k);c.lineTo(0,1*k);c.lineTo(-.9*k,2*k);c.closePath();c.fill();c.restore();}
        c.fillStyle='#ffe4b7';c.beginPath();c.arc(0,ey+6*k,1.1*k,0,7);c.fill();
    }
    if (id === 'pixelheart'){
        const pixels=[[-2,-4],[1,-4],[-3,-3],[-2,-3],[1,-3],[2,-3],[-3,-2],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[-2,-1],[-1,-1],[0,-1],[1,-1],[-1,0],[0,0]];
        c.fillStyle='#ff5e9a';for(const [x,y]of pixels)c.fillRect(x*1.3*k,(ey+y*1.3*k),1.3*k,1.3*k);
        c.fillStyle='rgba(255,255,255,.8)';c.fillRect(-2.6*k,ey-3.9*k,.9*k,.9*k);
    }
    if (id === 'voidstitch'){
        c.strokeStyle='#17131e';c.lineWidth=2.8*k;c.beginPath();c.moveTo(-s*.9,ey-1*k);c.quadraticCurveTo(0,ey+5*k,s*.9,ey-1*k);c.stroke();
        c.strokeStyle='#dc71ff';c.lineWidth=.85*k;c.setLineDash([1.3*k,1.2*k]);c.beginPath();c.moveTo(-s*.82,ey-1*k);c.quadraticCurveTo(0,ey+4.2*k,s*.82,ey-1*k);c.stroke();c.setLineDash([]);
        c.fillStyle='#e9c4ff';for(const sx of [-1,1]){c.beginPath();c.arc(sx*4*k,ey,1.2*k,0,7);c.fill();}
    }
    c.restore();
}

// ---- full character (shop, menu, profile previews) ----
function renderLook(cv, look, opts){
    if (!cv || !cv.getContext) return;
    const c = cv.getContext('2d'); if (!c) return;
    const W = cv.width, H = cv.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
    const s = W * ((opts && opts.scale) || 0.24), k = s/12;
    c.translate(W/2, H * ((opts && opts.cy) || 0.6));
    const def = skinById(look.skin);
    drawSkinBody(c, s, k, def);
    rrPath(c, -s, -s, s*2, s*2, 4*k); c.strokeStyle = 'rgba(13,16,23,0.55)'; c.lineWidth = 2*k*0.6; c.stroke();
    c.fillStyle = '#0d1017'; c.beginPath(); c.arc(-4*k, -2*k, 2.4*k, 0, 7); c.arc(4*k, -2*k, 2.4*k, 0, 7); c.fill();
    drawFaceAcc(c, s, k, look.face);
    drawHatAcc(c, s, k, look.hat, 0.3);
}
// Bots start a bit weaker and reach full strength after about 15 races, so beginners can actually win.
function newPlayerEase(){ let r = 0; try { r = prog().races || 0; } catch(e){} return 0.86 + 0.14 * Math.min(1, r / 15); }
function randomBotLook(){
    // Bots draw from the full catalogue (built-ins and designer items), common to legendary.
    const pickAny = arr => arr[Math.floor(Math.random() * arr.length)].id;
    const pickReal = arr => arr[1 + Math.floor(Math.random() * (arr.length - 1))].id;
    return {
        skin: Math.random() < 0.78 ? pickAny(SKINS) : null,
        hat: Math.random() < 0.62 ? pickReal(HATS) : 'none',
        face: Math.random() < 0.5 ? pickReal(FACES) : 'none',
        trail: Math.random() < 0.4 ? pickReal(TRAILS) : 'none',
    };
}

const MODE_LABEL = { race:'Race · Quick match', escape:'Escape · Survival', parkour:'Levels · Dimensions', gauntlet:'The Gauntlet · 32 players', ranked:'Ranked · Season race' };
const MODE_ICON = { race:'mode-race', escape:'mode-escape', parkour:'mode-levels', gauntlet:'crown', ranked:'mode-ranked' };
function prog(){
    let d = {}; try { d = JSON.parse(localStorage.getItem('rr_profile')) || {}; } catch(e){}
    if (!d.name) d.name = 'Player';
    if (!Number.isFinite(d.xp)) d.xp = 0;
    if (!Number.isFinite(d.races)) d.races = 0;
    if (!Number.isFinite(d.wins)) d.wins = 0;
    if (!Number.isFinite(d.passPoints)) d.passPoints = 0;
    if (!Number.isFinite(d.passPointsEarned)) d.passPointsEarned = d.passPoints;
    if (!Number.isFinite(d.cosmeticPity)) d.cosmeticPity = 0;
    if (!Array.isArray(d.passClaimed)) d.passClaimed = [];
    if (!d.streak || typeof d.streak !== 'object') d.streak = { n:0, last:'' };
    d.gt = Object.assign({ runs:0, wins:0, best:0, crowned:false, keys:0, streak:0 }, (d.gt && typeof d.gt === 'object') ? d.gt : {});   // Gauntlet record
    for (const k of ['runs', 'wins', 'best', 'keys', 'streak']) if (!Number.isFinite(d.gt[k])) d.gt[k] = 0;
    d.gt.crowned = !!d.gt.crowned;
    d.rk = Object.assign({ mmr:1000, rp:0, placed:0, peak:0, season:0, hist:[], claimed:[], protect:0, streak:0, matches:0, wins:0, dropDay:'', dropN:0, sm:0, lastPlayed:-1, seasons:[] }, (d.rk && typeof d.rk === 'object') ? d.rk : {});   // Ranked record
    if (!Array.isArray(d.rk.hist)) d.rk.hist = []; if (!Array.isArray(d.rk.claimed)) d.rk.claimed = [];
    if (!d.pendingDrops || typeof d.pendingDrops !== 'object') d.pendingDrops = {};
    if (!Array.isArray(d.owned)) d.owned = ['classic'];
    if (!d.owned.includes('classic')) d.owned.push('classic');
    if (!d.trail || !TRAILS.some(trail => trail.id === d.trail)) d.trail = 'none';
    if (!d.lootGrants || typeof d.lootGrants !== 'object') d.lootGrants = {};
    if (!d.skin || !SKINS.some(s => s.id === d.skin)) d.skin = 'classic';
    if (!d.hat || !HATS.some(h => h.id === d.hat)) d.hat = 'none';
    if (!d.face || !FACES.some(f => f.id === d.face)) d.face = 'none';
    if (!['race', 'escape', 'parkour', 'gauntlet', 'ranked'].includes(d.lastMode)) d.lastMode = 'race';
    return d;
}
function saveProg(p){ try { localStorage.setItem('rr_profile', JSON.stringify(p)); } catch(e){} if (window.Cloud) Cloud.touch(); }
function levelInfo(xp){
    let lvl = 1, need = 120, into = Math.max(0, xp);
    while (into >= need){ into -= need; lvl++; need = 120 + (lvl-1)*40; }
    return { lvl, into, need };
}
function skinById(id){ return SKINS.find(s => s.id === id) || SKINS[0]; }
function myLook(){ const p = prog(); return { skin: p.skin, hat: p.hat, face: p.face, trail:p.trail }; }
function skinColor(){ return skinById(prog().skin).color; }
function addXp(n){ const p = prog(); p.xp += Math.max(0, Math.round(n)); saveProg(p); }
function gemCount(){ return load('rr_gems', 0); }
function addGems(n){ store('rr_gems', gemCount() + Math.max(0, Math.round(n))); }
function addCoins(n){ store('rr_coins', load('rr_coins', 0) + Math.max(0, Math.round(n))); }
function newLootId(mode){ return mode + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 9); }
// ---------- Supply drops ----------
// A drop is a pending ticket until it is opened. Opening (see src/ui/lootbox.js) lets the player tap it to
// level its rarity up; the final tier then decides the rewards (resolveDrop).
const DROP_TIERS = ['common', 'rare', 'epic', 'legendary'];
const DROP_COIN_MULT = { common:1, rare:1.75, epic:3, legendary:5 };
const DROP_XP_MULT = { common:1, rare:1.3, epic:1.7, legendary:2.2 };
const DROP_COSMETIC_CHANCE = { common:0.035, rare:0.09, epic:0.2, legendary:0.45 };
const DROP_RARITY_WEIGHTS = {
    common:    { common:60, rare:28, epic:9,  legendary:3 },
    rare:      { common:36, rare:40, epic:18, legendary:6 },
    epic:      { common:14, rare:34, epic:38, legendary:14 },
    legendary: { common:5,  rare:20, epic:40, legendary:35 },
};
function pickCosmetic(available, tier){
    const W = DROP_RARITY_WEIGHTS[tier] || DROP_RARITY_WEIGHTS.common, by = {};
    for (const it of available) (by[it.rarity] = by[it.rarity] || []).push(it);
    const rars = Object.keys(by);
    let x = Math.random() * rars.reduce((a, r) => a + (W[r] || 1), 0);
    for (const r of rars){ x -= (W[r] || 1); if (x <= 0) return by[r][Math.floor(Math.random() * by[r].length)]; }
    return available[0];
}
function awardLootDrop(id, base, opts){
    const p = prog();
    if (p.lootGrants[id]) return p.lootGrants[id];
    if (p.pendingDrops[id]) return p.pendingDrops[id];
    const r = Math.random();
    const drop = {
        id, pending:true, tier: (opts && opts.tier) || (r < 0.02 ? 'epic' : r < 0.14 ? 'rare' : 'common'),
        base:{ coins:Math.max(0, Math.round(base.coins || 0)), xp:Math.max(0, Math.round(base.xp || 0)), passPoints:Math.max(0, Math.round(base.passPoints || 0)) },
    };
    p.pendingDrops[id] = drop;
    saveProg(p);
    return drop;
}
// Turn a pending drop into rewards at the given final tier. Safe to call twice (second call returns the stored result).
function resolveDrop(id, tier){
    const p = prog();
    if (p.lootGrants[id]) return p.lootGrants[id];
    const pend = p.pendingDrops[id]; if (!pend) return null;
    tier = DROP_TIERS.includes(tier) ? tier : pend.tier;
    const drop = {
        id, tier,
        coins:Math.round(pend.base.coins * DROP_COIN_MULT[tier]),
        xp:Math.round(pend.base.xp * DROP_XP_MULT[tier]),
        passPoints:pend.base.passPoints,
        cosmetic:null,
    };
    // Gems are very rare: only epic and legendary drops can hold them, and only a legendary one can hold a premium (gem) cosmetic.
    drop.gems = 0;
    if (Math.random() < ({ epic:0.012, legendary:0.05 }[tier] || 0)) drop.gems = tier === 'legendary' ? 5 + Math.floor(Math.random() * 16) : 5;
    if (tier === 'legendary' && Math.random() < 0.004){
        const prem = [...SKINS, ...HATS, ...FACES, ...TRAILS].filter(i => i.premium && i.gemPrice && !i.exclusive && !p.owned.includes(i.id));
        if (prem.length){ drop.cosmetic = prem[Math.floor(Math.random() * prem.length)]; p.owned.push(drop.cosmetic.id); }
    }
    if (drop.gems) addGems(drop.gems);
    const available = [...SKINS, ...HATS, ...FACES, ...TRAILS].filter(item => item.price > 0 && !p.owned.includes(item.id));
    if (!drop.cosmetic && available.length && (p.cosmeticPity >= 24 || Math.random() < DROP_COSMETIC_CHANCE[tier])){
        drop.cosmetic = pickCosmetic(available, tier);
        p.owned.push(drop.cosmetic.id);
        p.cosmeticPity = 0;
    } else if (!drop.cosmetic && available.length){
        p.cosmeticPity++;
    } else if (!drop.cosmetic){
        drop.coins += 100;
    }
    p.xp += drop.xp;
    p.passPoints += drop.passPoints;
    p.passPointsEarned += drop.passPoints;
    store('rr_coins', load('rr_coins', 0) + drop.coins);
    delete p.pendingDrops[id];
    p.lootGrants[id] = drop;
    const grantIds = Object.keys(p.lootGrants);
    for (const oldId of grantIds.slice(0, Math.max(0, grantIds.length - 40))) delete p.lootGrants[oldId];
    saveProg(p);
    return drop;
}
// Anything left unopened is paid out at its starting tier whenever the player is back on the home screen.
function settlePendingDrops(){
    const p = prog();
    for (const id of Object.keys(p.pendingDrops)) resolveDrop(id, p.pendingDrops[id].tier);
}
function renderLootDrop(containerId, drop){
    const panel = document.getElementById(containerId);
    if (!panel || !drop) return;
    const tier = drop.tier || 'common';
    const TC = { common:'#35e0c8', rare:'#5b8def', epic:'#b3a9ff', legendary:'#ffcf3f' };
    panel.classList.remove('opening');
    panel.innerHTML = `<div class="loot-crate tier-${tier}" aria-hidden="true">${icon('drop', 'loot-ico')}</div><div class="loot-info"><button class="loot-open" type="button">${icon('drop')}<span>OPEN</span></button></div>`;
    panel.querySelector('.loot-crate').style.setProperty('--ic', TC[tier]);
    panel.querySelector('.loot-open').addEventListener('click', event => {
        const button = event.currentTarget;
        button.disabled = true;
        openLootbox(drop, { onDone: final => {
            final = final || drop;
            const chips = [R('coin', final.coins || 0, {plus:true}), R('xp', final.xp || 0, {plus:true})];
            if (final.passPoints) chips.push(R('pass', final.passPoints, {plus:true}));
            if (final.gems) chips.push(R('gem', final.gems, {plus:true}));
            if (final.cosmetic) chips.push(`<span class="rwd rwd-item"><canvas class="mini-item" width="112" height="112" style="--rc:${RARITY[final.cosmetic.rarity].color}"></canvas></span>`);
            panel.innerHTML = `<div class="loot-crate opened tier-${final.tier || tier}" aria-hidden="true">${icon('check')}</div><div class="loot-info"><div class="loot-items">${chips.join('')}</div></div>`;
            panel.querySelector('.loot-crate').style.setProperty('--ic', TC[final.tier || tier]);
            const mc = panel.querySelector('canvas.mini-item');
            if (mc && final.cosmetic){
                const slot = ['skin', 'hat', 'face', 'trail'].find(k => COS_BY[k].some(i => i.id === final.cosmetic.id)) || 'skin';
                if (slot === 'trail'){ mc.width = 180; mc.height = 112; mc.classList.add('wide'); try { drawTrailPreview(mc, final.cosmetic); } catch(e){} }
                else try { renderLook(mc, Object.assign({ skin:'classic', hat:'none', face:'none', trail:'none' }, { [slot]:final.cosmetic.id }), { scale:.42, cy:.58 }); } catch(e){}
            }
            refreshMenu();
        } });
    });
}
function escGameOver(p){
    const run = p.escape;
    if (run.dead) return;
    run.dead = true; run.diedAt = esc.t; p.finished = true;
    if (p.local){
        SFX.play('fail');
        const prevBest = load('rr_esc_best_score', 0);
        if (run.score > prevBest) store('rr_esc_best_score', run.score);
    }
    burst(p.x, p.y, p.color, 40, 320);
    burst(p.x, p.y, '#ff5470', 30, 260);
    ring(p.x, p.y, '#ff5470', 110);

    if (!players.every(o => o.escape.dead)) return;
    esc.finished = true; state = 'over'; dragging = false;
    const lp = players[0], localRun = lp.escape;
    const loot = awardLootDrop(esc.lootId, {
        coins:localRun.coins + 20,
        xp:Math.min(80, 10 + Math.floor(localRun.score / 150)),
        passPoints:25 + Math.floor(localRun.score / 120),
    });
    refreshMenu();
    const standings = [...players].sort((a,b) => b.escape.diedAt - a.escape.diedAt);
    const place = standings.indexOf(lp) + 1;
    const meters = Math.max(0, Math.floor((START_Y - localRun.bestY) / ESC_METERS));
    const prevBest = load('rr_esc_best_score', 0);
    const isBest = localRun.score >= prevBest && localRun.score > 0;
    const board = document.getElementById('esc-board');
    board.innerHTML = '';
    standings.forEach((runner, i) => {
        const row = document.createElement('div');
        row.className = 'row' + (i === 0 ? ' first' : '') + (runner.local ? ' you' : '');
        row.innerHTML = `<span class="rank">${i+1}</span><span class="pip" style="background:${runner.color}"></span><span>${runner.name}</span><span class="time">${runner.escape.score.toLocaleString('en-US')}</span>`;
        board.appendChild(row);
    });
    setTimeout(() => {
        hud.style.display = 'none';
        document.getElementById('over-m').textContent = localRun.score.toLocaleString('en-US');
        const bestEl = document.getElementById('over-best');
        bestEl.textContent = `PLACE ${place} / ${players.length} · ` + (isBest ? 'NEW BEST' : 'BEST ' + prevBest.toLocaleString('en-US'));
        bestEl.classList.toggle('muted', !isBest);
        document.getElementById('over-height').textContent = meters + ' m';
        document.getElementById('over-coins').textContent = '+' + localRun.coins;
        document.getElementById('over-combo').textContent = '×' + localRun.maxMult;
        renderLootDrop('loot-escape', loot);
        showScreen('over');
    }, 1100);
}
function toast(msg){
    let t = document.getElementById('toast'); if (!t){ t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}
function renderResourceShop(){
    const box = document.getElementById('m-resource-shop'); box.innerHTML = '';
    const head = document.createElement('div'); head.className = 'gem-head'; head.innerHTML = `<span>${R('gem', gemCount())}</span>`; box.appendChild(head);
    const grid = document.createElement('div'); grid.className = 'gem-grid'; box.appendChild(grid);
    for (const pack of GEM_PACKS){
        const card = document.createElement('button'); card.type = 'button'; card.className = 'gem-pack';
        card.innerHTML = `<span class="gp-art">${icon('gem').repeat(pack.icons)}</span><b>${pack.gems.toLocaleString('en-US')}</b><span class="gp-price">${pack.price}</span>`;
        card.addEventListener('click', () => {
            if (window.GEM_STORE && typeof window.GEM_STORE.buy === 'function'){ window.GEM_STORE.buy(pack, n => { addGems(n); SFX.play('finish'); refreshMenu(); renderResourceShop(); }); }
            else { toast('Store not connected yet'); SFX.play('fall'); }
        });
        grid.appendChild(card);
    }
}
function renderShop(cat){
    const grid = document.getElementById('m-skins'), resources = document.getElementById('m-resource-shop');
    const current = prog();
    grid.hidden = cat === 'resources'; resources.hidden = cat !== 'resources';
    document.querySelectorAll('.m-pill[data-cat]').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
    if (cat === 'resources'){ renderResourceShop(); return; }
    const rarityOrder = {common:0, rare:1, epic:2, legendary:3};
    const items = [...(COS_BY[cat] || SKINS)].filter(it => !it.exclusive || current.owned.includes(it.id)).sort((a,b) => (b.premium ? 1 : 0) - (a.premium ? 1 : 0) || rarityOrder[a.rarity]-rarityOrder[b.rarity] || (a.price || a.gemPrice || 0)-(b.price || b.gemPrice || 0) || a.name.localeCompare(b.name));
    const animated = [];
    grid.innerHTML = '';
    for (const it of items){
                const owned = current.owned.includes(it.id);
                const eq = current[cat] === it.id;
                const b = document.createElement('button');
                b.type = 'button'; b.style.setProperty('--rc', RARITY[it.rarity].color); b.title = RARITY[it.rarity].label;
                b.className = 'm-skin' + (eq ? ' eq' : '') + (it.rarity === 'legendary' ? ' leg' : '') + (it.premium ? ' prem' : '');
                b.innerHTML = `<span class="m-skin-pv"><canvas width="160" height="160"></canvas></span>` +
                    `<b>${it.name}</b>` +
                    (cat === 'trail' ? `<canvas class="tr-pv" width="300" height="100"></canvas>` : '') +
                    `<span class="m-skin-f"><span class="${owned ? (eq ? 'eqd' : 'own') : 'price'}">${owned ? (eq ? 'EQUIPPED' : 'OWNED') : it.premium ? R('gem', it.gemPrice) : R('coin', it.price)}</span></span>` + (it.premium ? `<span class="prem-tag">${icon('gem')}</span>` : '');
                const preview = { skin:cat === 'skin' ? it.id : current.skin, hat:cat === 'hat' ? it.id : current.hat, face:cat === 'face' ? it.id : current.face, trail:cat === 'trail' ? it.id : current.trail };
                renderLook(b.querySelector('canvas'), preview, { scale:0.22, cy:0.62 });
                { const tp = b.querySelector('canvas.tr-pv'); if (tp) drawTrailPreview(tp, it); }
                if (it.premium && cat !== 'trail') animated.push([b.querySelector('canvas'), preview]);
                b.addEventListener('click', () => {
                    const q = prog();
                    const slot = cat;
                    if (owned){
                        if (eq && slot !== 'skin') q[slot] = 'none'; else q[slot] = it.id;
                        saveProg(q); SFX.play('item'); refreshMenu(); renderShop(cat); return;
                    }
                    if (it.premium){
                        const gh = gemCount();
                        if (gh < it.gemPrice){ b.classList.remove('m-shake'); void b.offsetWidth; b.classList.add('m-shake'); SFX.play('fall'); renderShop('resources'); return; }
                        store('rr_gems', gh - it.gemPrice);
                        q.owned.push(it.id); q[slot] = it.id; saveProg(q);
                        SFX.play('pickup'); SFX.play('finish'); refreshMenu(); renderShop(cat); return;
                    }
                    const have = load('rr_coins', 0);
                    if (have < it.price){ b.classList.remove('m-shake'); void b.offsetWidth; b.classList.add('m-shake'); SFX.play('fall'); return; }
                    store('rr_coins', have - it.price);
                    q.owned.push(it.id); q[slot] = it.id; saveProg(q);
                    SFX.play('pickup'); SFX.play('coin');
                    refreshMenu(); renderShop(cat);
                });
                grid.appendChild(b);
    }
    clearInterval(renderShop._anim);
    if (animated.length) renderShop._anim = setInterval(() => {
        const gr = document.getElementById('m-skins'); if (gr.hidden || !gr.offsetParent){ clearInterval(renderShop._anim); return; }
        for (const [cv, look] of animated) renderLook(cv, look, { scale:0.22, cy:0.62 });
    }, 70);
}
// Red number badge ("something to claim / new"). n = 0 hides it.
function setBadge(el, n){
    if (!el) return;
    let b = el.querySelector(':scope > .nbadge');
    if (!n){ if (b) b.remove(); return; }
    if (!b){ b = document.createElement('b'); b.className = 'nbadge'; el.appendChild(b); }
    b.textContent = n > 99 ? '99+' : n;
}
// Shop items you have not seen yet (new releases). Everything that exists on the first launch counts as seen.
function shopItems(){ return [...SKINS, ...HATS, ...FACES, ...TRAILS].filter(i => i.price > 0 || i.premium); }
function refreshShopBadge(){
    const p = prog(), ids = shopItems().map(i => i.id);
    if (!Array.isArray(p.shopSeen)){ p.shopSeen = ids; saveProg(p); }
    const fresh = ids.filter(id => !p.shopSeen.includes(id) && !p.owned.includes(id)).length;
    setBadge(document.querySelector('.m-nav [data-go="shop"]'), fresh);
}
function markShopSeen(){ const p = prog(); p.shopSeen = shopItems().map(i => i.id); saveProg(p); refreshShopBadge(); }
function menuTab(tab){
    if (tab === 'shop') setTimeout(markShopSeen, 600);
    document.querySelectorAll('.m-tab').forEach(el => el.classList.toggle('on', el.dataset.tab === tab));
    document.querySelectorAll('.m-nav [data-go]').forEach(el => el.classList.toggle('on', el.dataset.go === tab));
    document.getElementById('m-body').scrollTop = 0;
}
function setLastMode(mode){
    const p = prog(); p.lastMode = mode; saveProg(p); refreshMenu();
    if (mode === 'escape') startEscape();
    else if (mode === 'parkour') openLevels();
    else startMatchmaking();
}
function refreshMenu(){
    const p = prog(), L = levelInfo(prog().xp), sk = skinById(p.skin);
    const root = document.getElementById('s-start');
    root.style.setProperty('--skin', sk.color);
    document.getElementById('m-lvl').textContent = L.lvl;
    document.getElementById('m-name').textContent = p.name;
    document.getElementById('m-xpfill').style.width = (100*L.into/L.need).toFixed(1) + '%';
    document.getElementById('m-xpfill2').style.width = (100*L.into/L.need).toFixed(1) + '%';
    document.getElementById('m-plvl').innerHTML = `Level ${L.lvl} · ${R('xp', L.into + ' / ' + L.need)}`;
    const inp = document.getElementById('m-name-input');
    if (document.activeElement !== inp) inp.value = p.name;
    document.getElementById('m-mode').textContent = MODE_LABEL[p.lastMode] || MODE_LABEL.race;
    document.getElementById('m-mode-ico').innerHTML = (p.lastMode === 'ranked' && window.Ranked) ? Ranked.emblem(Ranked.state().tier, 30) : icon(MODE_ICON[p.lastMode] || MODE_ICON.race);
    if (window.Ranked) Ranked.refreshHome();
    document.querySelectorAll('#s-start .m-card[data-mode]').forEach(c => c.classList.toggle('sel', c.dataset.mode === p.lastMode));
    renderPassHome(p);
    if (window.Streak) Streak.refreshHome();
    if (window.Gauntlet) Gauntlet.refreshHome();
    refreshShopBadge();
    renderLook(document.getElementById('m-hero'), myLook(), { scale:0.22, cy:0.62 });
    renderLook(document.getElementById('m-hero2'), myLook(), { scale:0.22, cy:0.62 });
    renderLook(document.getElementById('m-av'), myLook(), { scale:0.2, cy:0.66 });
    const hat = HATS.find(h => h.id === p.hat) || HATS[0], face = FACES.find(f => f.id === p.face) || FACES[0];
    const trail = TRAIL_BY_ID[p.trail] || TRAILS[0];
    document.getElementById('m-eq-hat-n').textContent = hat.name;
    document.getElementById('m-eq-face-n').textContent = face.name;
    document.getElementById('m-eq-hat').style.background = hat.id === 'none' ? '#232a37' : RARITY[hat.rarity].color;
    document.getElementById('m-eq-face').style.background = face.id === 'none' ? '#232a37' : RARITY[face.rarity].color;
    document.getElementById('m-eq-trail-n').textContent = trail.name;
    document.getElementById('m-eq-trail').style.background = trail.color;
    let d1 = 0, d2 = 0;
    try { d1 = dimLoad(DIMENSIONS[0]).stars.reduce((a,b) => a+b, 0); d2 = dimLoad(DIMENSIONS[1]).stars.reduce((a,b) => a+b, 0); } catch(e){}
    document.getElementById('m-d1').innerHTML = `${icon('star')} ${d1}/30`;
    document.getElementById('m-d2').innerHTML = (d1+d2) >= 28 ? `${icon('star')} ${d2}/30` : `28 ${icon('star')} to unlock`;
    document.getElementById('m-d2box').classList.toggle('locked', d1+d2 < 28);
    document.getElementById('m-tile-pk').innerHTML = `${icon('star')} ${d1+d2} / 60`;
    const save = pkLoadSave(), bestM = load('rr_pk_best', 0), bestT = load('rr_pk_best_time', 0);
    document.getElementById('m-tower').textContent = bestT ? pkFmtTime(bestT) : save ? `${save.m || 0} m` : bestM ? `${bestM} m` : '--';
    document.getElementById('m-eq-skin').style.background = sk.color;
    document.getElementById('m-eq-skin-n').textContent = sk.name;
    document.getElementById('m-s-races').textContent = p.races;
    document.getElementById('m-s-wins').textContent = p.wins;
    document.getElementById('m-s-crowns').textContent = p.gt.wins;
    document.getElementById('m-s-rate').textContent = p.races ? Math.round(100*p.wins/p.races) + '%' : '--';
    const esc = load('rr_esc_best_score', 0);
    document.getElementById('m-s-esc').textContent = esc ? esc.toLocaleString('en-US') : '--';
    document.getElementById('m-s-pk').innerHTML = `${icon('star')} ${d1 + d2}`;
    document.getElementById('m-s-tower').textContent = bestT ? pkFmtTime(bestT) : bestM ? `${bestM} m` : '--';
    document.getElementById('m-s-pass').textContent = p.passPoints.toLocaleString('en-US');
    renderShop('skin');
}

// Rewards after a race (place-based), shown on the results screen
function rewardRace(place, finished, lootId){
    const coins = finished ? [60, 40, 25, 15][place-1] || 10 : 10;
    const xp    = finished ? [60, 45, 35, 25][place-1] || 15 : 15;
    const passPoints = finished ? [50, 40, 32, 25][place-1] || 20 : 15;
    const id = lootId || newLootId('race');
    const pp = prog(), alreadyGranted = !!(pp.lootGrants[id] || pp.pendingDrops[id]);
    // Only the winner earns a supply drop; everyone else gets the base rewards straight away.
    let drop = null;
    if (place === 1 && finished) drop = awardLootDrop(id, {coins, xp, passPoints});
    else if (!alreadyGranted){
        const q = prog(); q.xp += xp; q.passPoints += passPoints; q.passPointsEarned += passPoints;
        q.lootGrants[id] = { id, tier:'common', coins, xp, passPoints, cosmetic:null, noDrop:true }; saveProg(q); store('rr_coins', load('rr_coins', 0) + coins);
    }
    if (!drop) drop = { noDrop:true, coins, xp, passPoints };
    rewardRace.keyEarned = false;
    if (!alreadyGranted){
        const p = prog(); p.races++; if (finished && place === 1) p.wins++;
        // three first places in a row earn a Gauntlet key
        if (finished && place === 1){ p.gt.streak++; if (p.gt.streak >= 3){ p.gt.streak = 0; p.gt.keys++; rewardRace.keyEarned = true; } }
        else p.gt.streak = 0;
        saveProg(p);
    }
    refreshMenu();
    return drop;
}

// wiring
document.querySelectorAll('#s-start [data-go]').forEach(b => b.addEventListener('click', () => { menuTab(b.dataset.go); SFX.play('count'); }));
document.querySelectorAll('#s-start .m-pill[data-cat]').forEach(b => b.addEventListener('click', () => { renderShop(b.dataset.cat); SFX.play('count'); }));
document.querySelectorAll('#s-start [data-shop]').forEach(b => b.addEventListener('click', () => { menuTab('shop'); renderShop(b.dataset.shop); }));
// Tap a mode on the Play tab to select it (it shows on the home screen), then press PLAY there.
function selectMode(mode){
    const p = prog(); p.lastMode = mode; saveProg(p);
    refreshMenu(); menuTab('home'); SFX.play('count');
}
function playSelected(){
    const m = prog().lastMode;
    if (m === 'escape') startEscape();
    else if (m === 'parkour') openLevels();
    else if (m === 'gauntlet') Gauntlet.open();
    else if (m === 'ranked') Ranked.open();
    else startMatchmaking();
}
document.getElementById('btn-home-play').addEventListener('click', playSelected);
document.getElementById('btn-pass-open').addEventListener('click', openPass);
document.getElementById('pz-claimall').addEventListener('click', claimAllPass);
document.getElementById('btn-pass-back').addEventListener('click', () => showScreen('start'));
document.querySelectorAll('#s-start .m-card[data-mode]').forEach(c => c.addEventListener('click', () => selectMode(c.dataset.mode)));
document.getElementById('m-tile-parkour').addEventListener('click', () => { setLastMode('parkour'); openLevels(); });
document.getElementById('m-friends-race').addEventListener('click', () => { setLastMode('race'); startMatchmaking(); });
{
    const inp = document.getElementById('m-name-input');
    const commit = () => {
        const v = inp.value.replace(/[^\p{L}\p{N}_.\- ]/gu, '').trim().slice(0, 16);
        const p = prog(); p.name = v || 'Player'; saveProg(p); refreshMenu();
    };
    inp.addEventListener('change', commit);
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); });
    inp.addEventListener('blur', commit);
}

/* ---- menu meta (best + wallet) ---- */
function refreshStartMeta(){
    settlePendingDrops();
    const best = load('rr_esc_best_score', 0), coins = load('rr_coins', 0);
    document.getElementById('start-best').textContent = best > 0 ? 'Best ' + best.toLocaleString('en-US') : '';
    document.getElementById('wallet-num').textContent = coins;
    document.getElementById('gem-num').textContent = gemCount().toLocaleString('en-US');
    try {
        const tot = dimTotalStars();
        const max = DIMENSIONS.filter(dm => !dm.hidden).reduce((a,dm) => a + dm.levels.length*3, 0);
        document.getElementById('start-pk').innerHTML = tot ? icon('star') + ' ' + tot + '/' + max : '';
    } catch(e){}
    const pkEl = document.getElementById('start-pk');
    const save = (typeof pkLoadSave === 'function') ? pkLoadSave() : null;
    const bestTime = load('rr_pk_best_time', 0), bestM = load('rr_pk_best', 0);
    try { refreshMenu(); menuTab('home'); } catch(e){}
    if (!pkEl.textContent) pkEl.textContent = save ? 'Tower ' + (save.m || 0) + ' m' : bestM ? 'Tower ' + bestM + ' m' : '';
}
const escScoreEl = document.getElementById('esc-score');
const escCoinEl = document.getElementById('esc-coins');
const escCoinPill = document.getElementById('esc-coin-pill');
const escComboPill = document.getElementById('esc-combo');
const escComboX = document.getElementById('esc-combo-x');
const escComboFill = document.getElementById('esc-combo-fill');
document.getElementById('btn-esc-again').addEventListener('click', startEscape);
document.getElementById('btn-esc-menu').addEventListener('click', () => {
    state = 'menu'; gameMode = 'race'; document.body.classList.remove('mode-escape');
    showScreen('start');
});


/* =====================================================================
   PARKOUR — a fixed 1000 m tower. No items, no nets, no timer pressure.
   Fall and you fall. Pure skill, Jump King style.
   ===================================================================== */
let pk = null;
const PK_SEED = 20260924;                 // same tower every attempt — learning it IS the game
const PK_HEIGHT_M = 1000;
const PK_HEIGHT = PK_HEIGHT_M * 10;       // px
const PK_ZONES = 5;
const PK_ZONE_COLORS = ['#35e0c8', '#5b8def', '#7c6bff', '#ffcf3f', '#ff5470'];
const PK_SAVE_KEY = 'rr_pk_save_v1';
let pkPlatCount = 0;                      // platforms[] length right after generation (index stability for saves)

function pkRng(seed){                      // mulberry32: tiny, fast, deterministic
    let a = seed >>> 0;
    return function(){
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function pkSummitY(){ return START_Y - PK_HEIGHT; }
function pkMeters(y){ return Math.max(0, Math.round((START_Y - 20 - (y + 12)) / 10)); }   // feet above the ground top

// Is a jump from platform A to platform B physically possible with some margin?
function pkReachable(ax, aw, ay, bx, bw, by){
    const effDx = Math.max(0, Math.abs(bx - ax) - (aw/2 - 14) - (bw/2 - 14));
    const maxV = MAX_DRAG * POWER * 0.9;             // leave headroom: no pixel-perfect max-power jumps
    return !!solveJump(effDx, by - ay, maxV, GRAVITY);
}

function pkGenerate(){
    const R = pkRng(PK_SEED), rr = (a,b) => a + R()*(b-a);
    const pw = PLAY_W(), summitY = pkSummitY();
    platforms = []; itemBoxes = []; finishPlatform = null;
    platforms.push({x:pw/2, y:START_Y, w:pw, h:40, type:'normal', active:true, ground:true, quakeWarn:0, quakeDown:0});
    let y = START_Y, x = pw/2, w = pw, lastZone = 0, side = R() < 0.5 ? -1 : 1;
    while (y > summitY + 260){
        const h = (START_Y - y) / PK_HEIGHT;         // 0..1 progress up the tower
        const zone = Math.min(PK_ZONES-1, Math.floor(h * PK_ZONES));
        let gap = 132 + rr(0, 44) + h*56;             // ~130 at the bottom, up to ~230 near the top
        let width = 112 - h*38 + rr(0, 22);           // ~110-135 wide at the bottom, ~75-95 at the top
        let type = 'normal', speed = 0, dir = 1;
        const restLedge = zone > lastZone;            // a wide breather at every zone boundary
        if (restLedge){ width = 190; gap = Math.min(gap, 170); lastZone = zone; }
        else {
            const r = R();
            if (r < 0.08 + h*0.14)                              { type = 'ice'; width = Math.max(width, 122); }   // slick, but wide enough to be fair
            else if (r < 0.08 + h*0.14 + 0.06 + h*0.16)         { type = 'moving'; speed = rr(45, 80) + h*55; dir = R() < 0.5 ? 1 : -1; }
            else if (h > 0.4 && r < 0.08 + h*0.14 + 0.06 + h*0.16 + (h-0.4)*0.22) type = 'fragile';
        }
        // zig-zag: usually switch sides, sometimes keep going the same way
        if (R() < 0.7) side = -side;
        const shift = rr(40, 110 + h*90) * side;
        const half = width/2;
        let nx = Math.max(half+6, Math.min(pw-half-6, x + shift));
        const ny = y - gap;
        // guarantee the jump is makeable; pull it closer until it is
        let guard = 0;
        while (!pkReachable(x, w, y, nx, width, ny) && guard++ < 30) nx += (x - nx) * 0.25;
        let range = 0, baseX = nx;
        if (type === 'moving'){
            range = Math.min(rr(35, 85), (pw - width - 12)/2);
            if (range < 25) { type = 'normal'; range = 0; }
            else {
                baseX = Math.max(half+6+range, Math.min(pw-half-6-range, nx));
                // every point of its track must be reachable, not just the middle
                if (!pkReachable(x, w, y, baseX-range, width, ny) || !pkReachable(x, w, y, baseX+range, width, ny)){ type = 'normal'; range = 0; baseX = nx; }
                else nx = baseX;
            }
        }
        platforms.push({x:nx, y:ny, w:width, h:18, type, speed, dir, active:true, breaking:false, breakT:0, respawn:0,
                        baseX, range, boostReady:true, quakeWarn:0, quakeDown:0, zone});
        x = nx; y = ny; w = width;
    }
    // the summit
    platforms.push({x:pw/2, y:summitY, w:pw, h:40, type:'finish', active:true, quakeWarn:0, quakeDown:0});
    pkPlatCount = platforms.length;
}

function pkLoadSave(){
    try { const s = JSON.parse(localStorage.getItem(PK_SAVE_KEY)); return (s && typeof s.idx === 'number') ? s : null; }
    catch(e){ return null; }
}
function pkWriteSave(){
    if (!pk || pk.done) return;
    const spl = platforms[pk.safeIdx];
    const m = spl ? pkMeters(spl.y - spl.h/2 - 12) : 0;
    try { localStorage.setItem(PK_SAVE_KEY, JSON.stringify({ idx: pk.safeIdx, dx: pk.safeDX, t: pk.t, falls: pk.falls, bestY: pk.bestY, m })); } catch(e){}
    const bm = pkMeters(pk.bestY);
    if (bm > load('rr_pk_best', 0)) store('rr_pk_best', bm);
}
function pkClearSave(){ try { localStorage.removeItem(PK_SAVE_KEY); } catch(e){} }

function pkFmtTime(t){
    t = Math.floor(t);
    const h = Math.floor(t/3600), m = Math.floor((t%3600)/60), s = t%60;
    return (h ? h + ':' + String(m).padStart(2,'0') : m) + ':' + String(s).padStart(2,'0');
}

// Entry point from the menu: continue a saved climb, or start fresh
function openParkour(){
    const save = pkLoadSave();
    if (!save){ pkStart(null); return; }
    document.getElementById('pk-save-m').textContent = save.m || 0;
    document.getElementById('pk-save-sub').textContent = save.falls + (save.falls === 1 ? ' fall' : ' falls') + ' · ' + pkFmtTime(save.t);
    showScreen('pk');
}
function pkStart(save){
    gameMode = 'parkour';
    document.body.classList.remove('mode-escape', 'mode-level'); lv = null;
    document.body.classList.add('mode-parkour');
    esc = null;
    showScreen('');
    hud.style.display = 'block';
    pkGenerate();
    matchHumanSlot = 0;
    initPlayers();
    players = [players[0]];
    const p = players[0];
    pk = { lootId:newLootId('tower'), t:0, falls:0, bestY:START_Y, lastLandY:START_Y - 32, safeIdx:0, safeDX:0, saveT:0,
           prevMode:'idle', shownM:-1, shownF:-1, shownT:-1, done:false, bestMark: 0 };
    p.x = PLAY_W()/2;
    if (save && platforms[save.idx] && save.idx < pkPlatCount){
        const pl = platforms[save.idx];
        p.plat = pl; p.mode = 'idle';
        p.x = Math.max(pl.x - pl.w/2 + 8, Math.min(pl.x + pl.w/2 - 8, pl.x + (save.dx || 0)));
        p.y = pl.y - pl.h/2 - p.r;
        pk.t = save.t || 0; pk.falls = save.falls || 0;
        pk.bestY = Math.min(save.bestY || START_Y, p.y);
        pk.lastLandY = p.y; pk.safeIdx = save.idx; pk.safeDX = p.x - pl.x;
    } else {
        pkClearSave();
    }
    pk.bestMark = Math.floor(pkMeters(pk.bestY) / 100);
    // no countdown: there's no clock pressure here, you just start climbing
    dragging = false;
    cameraY = p.y - VH*0.62;
    particles=[]; floaters=[]; shots=[]; shockwaves=[]; shardParticles=[]; timeScale=1; hitStop=0; itemHUD.key='';
    hintTimer = 4; hintEl.style.opacity = 1; hintEl.style.display = 'block';
    countdownEl.style.display = 'none';
    matchStart = Date.now();
    state = 'playing';
}

function updateParkour(dt){
    const lp = players[0];
    if (!lp || pk.done) return;
    pk.t += dt;

    // landings: track progress, count falls, remember where you last stood safely
    if (pk.prevMode === 'air' && lp.mode === 'idle' && lp.plat){
        const drop = lp.y - pk.lastLandY;
        if (drop > 180){
            pk.falls++;
            const lostM = Math.round(drop / 10);
            SFX.play('fall');
            if (lostM >= 20) floatText(lp.x, lp.y - lp.r - 18, '−' + lostM + ' m', '#ff5470');
            camShake = Math.max(camShake, Math.min(16, 4 + lostM/12));
        }
        // ice is slippery, not a trap: a landing bleeds off half your sideways speed so a
        // clean touchdown gives you time to aim before you slide off the edge
        if (lp.plat.type === 'ice') lp.vx *= 0.5;
        pk.lastLandY = lp.y;
        const idx = platforms.indexOf(lp.plat);
        if (idx >= 0){ pk.safeIdx = idx; pk.safeDX = lp.x - lp.plat.x; }
    }
    pk.prevMode = lp.mode;

    // new personal heights: a gold ring every 100 m you've never reached this climb
    if (lp.y < pk.bestY){
        pk.bestY = lp.y;
        const mark = Math.floor(pkMeters(pk.bestY) / 100);
        if (mark > pk.bestMark){
            pk.bestMark = mark;
            ring(lp.x, lp.y, '#ffcf3f', 70);
            burst(lp.x, lp.y, '#ffcf3f', 18, 220);
        }
    }

    // autosave every few seconds (only ever a spot you actually stood on)
    pk.saveT += dt;
    if (pk.saveT > 3){ pk.saveT = 0; pkWriteSave(); }

    // HUD
    const m = pkMeters(lp.y);
    if (m !== pk.shownM){ pk.shownM = m; pkHeightEl.textContent = m; }
    if (pk.falls !== pk.shownF){
        pk.shownF = pk.falls; pkFallsEl.textContent = pk.falls;
        if (pk.falls) pkFallsPill.animate([{transform:'scale(1.2)'},{transform:'scale(1)'}], {duration:200});
    }
    const ts = Math.floor(pk.t);
    if (ts !== pk.shownT){ pk.shownT = ts; pkTimeEl.textContent = pkFmtTime(ts); }
}

// Reached the top
function pkSummit(p){
    SFX.play('finish');
    if (pk.done) return;
    pk.done = true;
    const loot = awardLootDrop(pk.lootId, {coins:250, xp:150, passPoints:100});
    renderLootDrop('loot-summit', loot);
    state = 'over'; dragging = false;
    hitStop = 0.6; camShake = 10;
    for (const c of ['#ffcf3f', '#35e0c8', '#ff5470', '#7c6bff']) burst(p.x, p.y, c, 22, 320);
    ring(p.x, p.y, '#ffcf3f', 140); ring(p.x, p.y, '#ffffff', 90);
    const time = pk.t, falls = pk.falls;
    const prevBest = load('rr_pk_best_time', 0);
    const isBest = !prevBest || time < prevBest;
    if (isBest) store('rr_pk_best_time', Math.round(time));
    store('rr_pk_best', PK_HEIGHT_M);
    pkClearSave();
    setTimeout(() => {
        hud.style.display = 'none';
        document.getElementById('sum-time').textContent = pkFmtTime(time);
        const b = document.getElementById('sum-best');
        b.textContent = isBest ? 'NEW RECORD' : 'BEST ' + pkFmtTime(prevBest);
        b.classList.toggle('muted', !isBest);
        document.getElementById('sum-falls').textContent = falls;
        document.getElementById('sum-height').textContent = PK_HEIGHT_M + ' m';
        showScreen('summit');
        refreshStartMeta();
    }, 1600);
}

/* ---- PARKOUR drawing ---- */
// Screen-space: a soft glow in the colour of the zone you're looking at
function drawParkourSky(){
    const h = Math.max(0, Math.min(0.999, (START_Y - (cameraY + VH*0.6)) / PK_HEIGHT));
    const f = h * PK_ZONES, z = Math.floor(f), blend = f - z;
    const a = PK_ZONE_COLORS[z], b = PK_ZONE_COLORS[Math.min(PK_ZONES-1, z+1)];
    const g = ctx.createRadialGradient(SCREEN_PW()/2, -CH*0.1, 20, SCREEN_PW()/2, -CH*0.1, CH*1.1);
    const mix = blend > 0.8 ? b : a;                 // cross into the next zone's glow near the boundary
    g.addColorStop(0, mix + '2a'); g.addColorStop(1, mix + '00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, SCREEN_PW(), CH);
}

// World-space: meter ticks along the wall, and your best-ever line
function drawParkourWorldBack(){
    const pw = PLAY_W();
    const topM = pkMeters(cameraY - 40), botM = pkMeters(cameraY + VH + 40);
    const first = Math.floor(botM / 10) * 10;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (let m = first; m <= topM + 10; m += 10){
        if (m < 0 || m > PK_HEIGHT_M) continue;
        const y = START_Y - 20 - m*10;
        const major = m % 50 === 0;
        ctx.fillStyle = major ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.10)';
        ctx.fillRect(0, y - 0.75, major ? 16 : 8, 1.5);
        if (major && m > 0){
            ctx.font = '700 11px Space Grotesk';
            ctx.fillText(m + ' m', 20, y);
        }
    }
    // zone boundary bands
    for (let z = 1; z < PK_ZONES; z++){
        const y = START_Y - 20 - (PK_HEIGHT_M / PK_ZONES) * z * 10;
        if (y < cameraY - 20 || y > cameraY + VH + 20) continue;
        ctx.fillStyle = PK_ZONE_COLORS[z] + '22';
        ctx.fillRect(0, y - 1, pw, 2);
    }
    // best-ever line this climb (only when you're below it — otherwise it's just noise)
    const lp = players[0];
    const bestFeet = pk.bestY + 12;
    if (lp && pkMeters(pk.bestY) > 5 && lp.y > pk.bestY + 40 && bestFeet > cameraY - 10 && bestFeet < cameraY + VH + 10){
        ctx.save();
        ctx.strokeStyle = 'rgba(255,207,63,0.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(0, bestFeet); ctx.lineTo(pw, bestFeet); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,207,63,0.85)'; ctx.font = '800 10px Space Grotesk'; ctx.textAlign = 'right';
        ctx.fillText('BEST ' + pkMeters(pk.bestY) + ' m', pw - 6, bestFeet - 8);
        ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
}

// Sidebar: the whole tower, zone by zone, with you and your best
function drawParkourGauge(){
    const lp = players[0];
    const x0 = CW - SIDEBAR;
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x0, 0, SIDEBAR, CH);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, CH); ctx.stroke();
    const cx = x0 + SIDEBAR/2, top = 30, bot = CH - 16;
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '800 9px Space Grotesk'; ctx.textAlign = 'center';
    ctx.fillText('TOP', cx, 16);
    const segH = (bot - top) / PK_ZONES;
    for (let z = 0; z < PK_ZONES; z++){
        const y1 = bot - segH*(z+1), y0 = bot - segH*z;
        ctx.fillStyle = PK_ZONE_COLORS[z] + '40';
        roundRect(cx-3, y1 + 1, 6, y0 - y1 - 2, 3); ctx.fill();
    }
    if (!lp || !pk) return;
    const toY = (m) => bot - (bot - top) * Math.min(1, m / PK_HEIGHT_M);
    const by = toY(pkMeters(pk.bestY));
    ctx.fillStyle = '#ffcf3f'; ctx.fillRect(cx - 9, by - 1, 18, 2);
    const py = toY(pkMeters(lp.y));
    ctx.beginPath(); ctx.arc(cx, py, 7, 0, 7);
    ctx.fillStyle = lp.color; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
}

/* ---- wiring ---- */
const pkHeightEl = document.getElementById('pk-height');
const pkFallsEl = document.getElementById('pk-falls');
const pkFallsPill = document.getElementById('pk-falls-pill');
const pkTimeEl = document.getElementById('pk-time');
document.getElementById('btn-pk-continue').addEventListener('click', () => pkStart(pkLoadSave()));
document.getElementById('btn-pk-new').addEventListener('click', () => { pkClearSave(); pkStart(null); });
document.getElementById('btn-pk-back').addEventListener('click', () => openLevels());
document.getElementById('btn-sum-again').addEventListener('click', () => pkStart(null));
document.getElementById('btn-sum-menu').addEventListener('click', () => { state = 'menu'; gameMode = 'race'; document.body.classList.remove('mode-parkour'); refreshStartMeta(); openLevels(); });
// never lose progress when the tab/app goes to the background
if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pagehide', () => { if (gameMode === 'parkour') pkWriteSave(); });
    document.addEventListener('visibilitychange', () => { if (gameMode === 'parkour' && document.hidden) pkWriteSave(); });
}


/* =====================================================================
   LEVELS — 10 fixed, hand-paced levels. Identical for every player on
   every device (seeded layout on a fixed-width world). Each level
   teaches one idea; stars are earned on time.
   ===================================================================== */
let lv = null;
let curDim = 0;                          // which dimension's hub/level you're looking at or playing
const LV_KEY = 'rr_pk_levels_v1';        // legacy key, kept as Dimension 1's save for backward compatibility
// Pattern tokens, bottom -> top:
//   N normal · n narrow · W wide rest ledge · M moving · I ice · F crumbles · B boost (the NEXT gap needs the charge)
// Parkour levels. Tokens, bottom -> top:
//   N normal · n narrow · T needle (barely twice your width) · X long wall-to-wall leap
//   M moving · I ice · F crumbles.  No boosts, no rest ledges, no nets.
const DIM1_LEVELS = [
    { name:'Ledge Walk',  color:'#7c6bff', seed:21101, pattern:'NNnNNnNNnNNnN',           gap:[165,198], width:[74,90], shift:[90,160], par3:16, par2:54 },
    { name:'Wide Open',   color:'#8b7cff', seed:22202, pattern:'NXNnXNnXNNXnN',           gap:[168,202], width:[70,86], shift:[95,165], par3:25, par2:84 },
    { name:'Black Ice',   color:'#cfe9ff', seed:24404, pattern:'NIInIIInIIIIN',           gap:[170,206], width:[70,86], shift:[95,165], iceMin:88, par3:21, par2:72 },
    { name:'Crosswind',   color:'#8fd6ff', seed:27707, pattern:'XMXIXFXMXnXIX',           gap:[172,208], width:[64,80], shift:[100,170], iceMin:86, par3:32, par2:108 },
    { name:'Drift',       color:'#5b8def', seed:23303, pattern:'NMNMMnMNMMnMN',           gap:[168,205], width:[68,84], shift:[90,160], par3:48, par2:162 },
    { name:'Fault Line',  color:'#ff9838', seed:25505, pattern:'NFFnFFFnFFFFnF',          gap:[170,206], width:[66,82], shift:[95,165], par3:49, par2:165 },
    { name:'Clockwork',   color:'#ffcf3f', seed:28808, pattern:'MMFMMFnMMFMMTM',          gap:[170,204], width:[68,82], shift:[95,170], par3:61, par2:204 },
    { name:'Needle',      color:'#35e0c8', seed:26606, pattern:'nnTnnTnnnTnnTnT',         gap:[172,208], width:[62,76], shift:[95,170], par3:140, par2:465 },
    { name:'Glass Tower', color:'#ff5470', seed:29909, pattern:'IFInIFnIFTIFnIF',         gap:[175,210], width:[62,77], shift:[102,176], iceMin:86, par3:97, par2:324 },
    { name:'Last Breath', color:'#ff2e5c', seed:30010, pattern:'XMIFnXMFInTMXFInMXFnTN',  gap:[170,204], width:[66,80], shift:[100,175], iceMin:86, par3:90, par2:300 },
];
// Dimension 2: unlocked at 28 stars. Same rules, colder/inverted palette, and every
// number pushed further — narrower platforms, longer gaps, more hazard density.
const DIM2_LEVELS = [
    { name:'Hairline',    color:'#8fd6ff', seed:41101, pattern:'nnTFnnTnnFTnnnTnFT',      gap:[110,255], width:[52,64], shift:[100,175], par3:22, par2:66 },
    { name:'Overreach',   color:'#5ec8ff', seed:42202, pattern:'XnXTXFnXnFXTXnFX',        gap:[115,260], width:[50,62], shift:[105,180], par3:34, par2:96 },
    { name:'Deep Freeze', color:'#cfe9ff', seed:44404, pattern:'IITInIFITInIIFITnIF',     gap:[115,250], width:[58,68], shift:[105,180], iceMin:66, par3:27, par2:84 },
    { name:'Gale Force',  color:'#7c6bff', seed:47707, pattern:'XMIXFTXMIXnFTXMI',        gap:[120,255], width:[50,62], shift:[110,185], iceMin:64, par3:40, par2:120 },
    { name:'Freefall',    color:'#6b7ee8', seed:43303, pattern:'MTMnMFMTnMMFnTFMMnT',     gap:[115,250], width:[52,64], shift:[100,175], par3:58, par2:174 },
    { name:'Sheer Drop',  color:'#ff9838', seed:45505, pattern:'FTFnFFTnFFFTnFFn',        gap:[115,255], width:[50,62], shift:[105,180], par3:60, par2:180 },
    { name:'Deadlock',    color:'#ffcf3f', seed:48808, pattern:'MFTMFnMTFMFnMTFn',        gap:[115,250], width:[52,64], shift:[105,180], par3:74, par2:216 },
    { name:"Razor's Edge", color:'#35e0c8', seed:46606, pattern:'TnTFnTTnFTnTnFTTnTnFT',   gap:[120,260], width:[46,56], shift:[105,180], par3:168, par2:500 },
    { name:'Bottomless', color:'#ff5470', seed:49909, pattern:'IFTInIFTnIFTTInIFT',      gap:[120,258], width:[48,58], shift:[108,182], iceMin:62, par3:118, par2:360 },
    { name:'Last Light',  color:'#ff2e5c', seed:50010, pattern:'XMIFTnXMFITnTMXFInMXFTnT', gap:[115,255], width:[50,62], shift:[105,180], iceMin:64, par3:108, par2:340 },
];
const DIMENSIONS = [
    { key:'rr_pk_levels_v1',  name:'Dimension I',  unlockStars:0,  bg:'#0d1017', levels:DIM1_LEVELS },
    { key:'rr_pk_levels_v2',  name:'Dimension II', unlockStars:28, bg:'#070c14', levels:DIM2_LEVELS },
];
const LEVELS = DIMENSIONS[0].levels;   // kept for any code that still refers to LEVELS directly (dimension 1 default)
function dimTotalStars(){
    // total stars across ALL dimensions — this is what unlocks the next one
    let sum = 0;
    for (const dm of DIMENSIONS){
        if (dm.hidden) continue;
        const d = dimLoad(dm);
        sum += d.stars.reduce((a,b)=>a+b, 0);
    }
    return sum;
}
function dimUnlocked(idx){ return DIMENSIONS[idx].unlockStars <= dimTotalStars(); }
function dimLoad(dm){
    try { const d = JSON.parse(localStorage.getItem(dm.key)); if (d && Array.isArray(d.stars)) return d; } catch(e){}
    return { stars: dm.levels.map(() => 0), best: dm.levels.map(() => 0) };
}
function dimSave(dm, d){ try { localStorage.setItem(dm.key, JSON.stringify(d)); } catch(e){} if (window.Cloud) Cloud.touch(); }


function lvReach(ax, aw, ay, bx, bw, by, mult){
    const effDx = Math.max(0, Math.abs(bx - ax) - (aw/2 - 14) - (bw/2 - 14));
    const maxV = MAX_DRAG * POWER * 0.9 * (mult || 1);
    return !!solveJump(effDx, by - ay, maxV, GRAVITY);
}
// every standing spot on A (both ends of a moving track) must reach every spot on B
function lvPairOK(a, b, mult){
    const as = a.range ? [a.baseX - a.range, a.baseX + a.range] : [a.x];
    const bs = b.range ? [b.baseX - b.range, b.baseX + b.range] : [b.x];
    for (const ax of as) for (const bx of bs) if (!lvReach(ax, a.w, a.y, bx, b.w, b.y, mult)) return false;
    return true;
}

function lvGenerate(i){
    const L = DIMENSIONS[curDim].levels[i], R = pkRng(L.seed), rr = (a,b) => a + R()*(b-a);
    if (L.build){ L.build(); return; }
    const pw = PLAY_W();
    platforms = []; itemBoxes = []; finishPlatform = null;
    const ground = {x:pw/2, y:START_Y, w:pw, h:40, type:'normal', active:true, ground:true, quakeWarn:0, quakeDown:0, range:0, baseX:pw/2};
    platforms.push(ground);
    let prev = ground, side = R() < 0.5 ? -1 : 1, boostNext = false;
    for (const tok of L.pattern){
        let type = 'normal', width = rr(L.width[0], L.width[1]), gap = rr(L.gap[0], L.gap[1]);
        if (tok === 'W'){ width = 190; gap = Math.min(gap, 150); }
        if (tok === 'n') width *= 0.78;
        if (tok === 'T') width = 46;                                // a needle: barely twice your width
        if (tok === 'M') type = 'moving';
        if (tok === 'I'){ type = 'ice'; width = Math.max(width, L.iceMin || 122); }
        if (tok === 'F') type = 'fragile';
        if (tok === 'B') type = 'boost';
        const needsBoost = boostNext; boostNext = (tok === 'B');
        if (needsBoost){ gap = rr(335, 375); width = Math.max(width, 150); }
        if (R() < 0.72) side = -side;
        const half = width/2;
        let x;
        if (tok === 'X'){                                            // wall-to-wall: always toward the far side
            side = prev.x < pw/2 ? 1 : -1;
            x = Math.max(half+6, Math.min(pw-half-6, prev.x + rr(190, 250) * side));
        } else {
            x = Math.max(half+6, Math.min(pw-half-6, prev.x + rr(L.shift[0], L.shift[1]) * side));
        }
        const b = { x, y: prev.y - gap, w: width, h: 18, type, speed: 0, dir: 1, active:true, breaking:false, breakT:0, respawn:0,
                    baseX: x, range: 0, boostReady:true, quakeWarn:0, quakeDown:0 };
        if (type === 'moving'){
            b.speed = rr(55, 85) + i*3; b.dir = R() < 0.5 ? 1 : -1;       // hard, but always readable timing
            b.range = Math.min(rr(35, 80), (pw - width - 12)/2);
            if (b.range < 25){ b.type = 'normal'; b.range = 0; }
            else { b.baseX = Math.max(half+6+b.range, Math.min(pw-half-6-b.range, x)); b.x = b.baseX; }
        }
        const mult = needsBoost ? BOOST_MULT : 1;
        // 1) guarantee it's makeable: pull toward the previous platform, then shrink the gap
        let guard = 0;
        while (!lvPairOK(prev, b, mult) && guard++ < 60){
            if (guard < 30){ b.x += (prev.x - b.x) * 0.2; if (!b.range) b.baseX = b.x; else { b.baseX = b.x; } }
            else { b.y += 8; }
        }
        // 2) a boost gap must NOT be possible without the charge — that's the lesson
        if (needsBoost){
            let g2 = 0;
            while (lvPairOK(prev, b, 1) && g2++ < 12){
                b.y -= 10;
                if (!lvPairOK(prev, b, BOOST_MULT)){ b.y += 10; break; }
            }
        }
        platforms.push(b);

        // CEILING: disabled for now — saved for a later dimension. Some platforms would be
        // sealed underneath, blocking a jump straight up through them from below, only ever
        // added where it can't cost you the level (see the race-mode generator for the
        // live version of this logic and its safety condition).
        // if (type === 'normal' || type === 'ice') {
        //     const clearance = Math.abs(b.x - prev.x) - (b.w/2 + (prev.w||width)/2);
        //     if (clearance > 40 && R() < 0.35) b.ceiling = true;
        // }

        prev = b;
    }
    platforms.push({x:pw/2, y:prev.y - 150, w:pw, h:40, type:'finish', active:true, quakeWarn:0, quakeDown:0});
}

function lvLoad(){ return dimLoad(DIMENSIONS[curDim]); }
function lvSave(d){ dimSave(DIMENSIONS[curDim], d); }
function lvUnlocked(d, i){ return i === 0 || d.stars[i-1] > 0; }
function lvStarsFor(i, t){ const L = DIMENSIONS[curDim].levels[i]; return t <= L.par3 ? 3 : t <= L.par2 ? 2 : 1; }

/* ---- level select ---- */
const LOCK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
function openLevels(gotoDim){
    if (DIMENSIONS[curDim] && DIMENSIONS[curDim].hidden) curDim = 0;
    if (window.Tutorial) Tutorial.stop();
    if (gotoDim !== undefined) curDim = gotoDim;
    if (!dimUnlocked(curDim)) curDim = 0;              // safety: never land on a locked dimension
    const dim = DIMENSIONS[curDim];
    const d = lvLoad(), grid = document.getElementById('lv-grid');
    grid.innerHTML = '';
    let total = 0;
    dim.levels.forEach((L, i) => {
        total += d.stars[i];
        const open = lvUnlocked(d, i);
        const b = document.createElement('button');
        b.className = 'lv-tile' + (open ? '' : ' locked') + (d.stars[i] ? ' done' : '');
        b.style.setProperty('--lv', L.color);
        const stars = [0,1,2].map(k => `<span class="s${k < d.stars[i] ? ' on' : ''}">${icon('star')}</span>`).join('');
        const tc = { common:'#35e0c8', rare:'#5b8def', epic:'#b3a9ff', legendary:'#ffcf3f' }[lvDropTier(curDim, i)];
        const chest = open ? `<span class="lv-drop" title="3 stars: supply drop" style="--ic:${tc}">${icon('drop')}</span>` : '';
        b.innerHTML = chest + `<span class="lv-num">${i+1}</span><span class="lv-name">${L.name}</span>` +
                      (open ? `<span class="lv-stars">${stars}</span>` : `<span class="lv-lock">${LOCK_SVG}</span>`);
        b.addEventListener('click', () => {
            if (open) lvStart(i);
            else b.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}], {duration:260});
        });
        grid.appendChild(b);
    });
    document.getElementById('lv-total').textContent = total;
    document.getElementById('lv-total-max').textContent = '/' + dim.levels.length*3;

    // dimension tabs
    const tabsEl = document.getElementById('dim-tabs');
    tabsEl.innerHTML = '';
    const totalStars = dimTotalStars();
    DIMENSIONS.forEach((dm, di) => {
        if (dm.hidden) return;
        const unlocked = dimUnlocked(di);
        const t = document.createElement('button');
        t.className = 'dim-tab' + (di === curDim ? ' active' : '') + (unlocked ? '' : ' locked');
        t.innerHTML = unlocked ? dm.name : `${icon('lock')} ${dm.unlockStars} ${icon('star')}`;
        t.addEventListener('click', () => {
            if (unlocked) openLevels(di);
            else t.animate([{transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}], {duration:220});
        });
        tabsEl.appendChild(t);
    });
    document.getElementById('lv-hub-title').textContent = dim.name.toUpperCase();

    const save = pkLoadSave(), bestTime = load('rr_pk_best_time', 0), bestM = load('rr_pk_best', 0);
    document.getElementById('tower-meta').textContent = save ? 'Saved ' + (save.m || 0) + ' m' : bestTime ? 'Best ' + pkFmtTime(bestTime) : bestM ? 'Best ' + bestM + ' m' : '';
    showScreen('levels');
}

/* ---- playing a level ---- */
function lvStart(i){
    gameMode = 'level';
    document.body.classList.remove('mode-escape', 'mode-parkour');
    document.body.classList.add('mode-level');
    esc = null; pk = null;
    showScreen('');
    lvGenerate(i);
    matchHumanSlot = 0;
    initPlayers();
    players = [players[0]];
    players[0].x = PLAY_W()/2;
    lv = { lootId:newLootId('level'), idx:i, t:0, falls:0, prevMode:'idle', lastLandY: START_Y - 32, done:false, shownT:-1, shownF:-1,
           finishY: platforms[platforms.length-1].y, tutorial: !!DIMENSIONS[curDim].tutorial };
    lvNameEl.textContent = i + 1;
    beginRound();
}

function updateLevel(dt){
    const lp = players[0];
    if (!lp || lv.done) return;
    lv.t += dt;
    if (lv.tutorial && window.Tutorial) Tutorial.update(lp);
    if (lv.prevMode === 'air' && lp.mode === 'idle' && lp.plat){
        if (lp.y - lv.lastLandY > 150){
            lv.falls++;
            camShake = Math.max(camShake, 5);
        }
        if (lp.plat.type === 'ice') lp.vx *= 0.5;   // slick but fair (same rule as PARKOUR)
        lv.lastLandY = lp.y;
    }
    lv.prevMode = lp.mode;
    const ts = Math.floor(lv.t * 10);
    if (ts !== lv.shownT){ lv.shownT = ts; lvTimeEl.textContent = lvFmt(lv.t); }
    if (lv.falls !== lv.shownF){
        lv.shownF = lv.falls; lvFallsEl.textContent = lv.falls;
        if (lv.falls) lvFallsPill.animate([{transform:'scale(1.2)'},{transform:'scale(1)'}], {duration:200});
    }
}
function lvFmt(t){ const m = Math.floor(t/60), s = t - m*60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }

// Which supply drop a level gives for 3 stars: rarity by the level's difficulty and its dimension.
function lvDropTier(dim, i){
    const n = DIMENSIONS[dim].levels.length, f = i / Math.max(1, n - 1);
    return dim === 0 ? (f < 0.4 ? 'common' : f < 0.8 ? 'rare' : 'epic') : (f < 0.35 ? 'rare' : f < 0.7 ? 'epic' : 'legendary');
}
function lvComplete(p){
    SFX.play('finish');
    if (lv.done) return;
    lv.done = true;
    if (DIMENSIONS[curDim].tutorial){ state = 'over'; dragging = false; SFX.play('finish'); camShake = 8; for (const c of ['#35e0c8', '#ffcf3f', '#ffffff']) burst(p.x, p.y, c, 20, 300); Tutorial.finish(p); return; }
    state = 'over'; dragging = false;
    hitStop = 0.5; camShake = 8;
    const col = DIMENSIONS[curDim].levels[lv.idx].color;
    for (const c of [col, '#ffcf3f', '#ffffff']) burst(p.x, p.y, c, 20, 300);
    ring(p.x, p.y, '#ffcf3f', 120);
    const t = lv.t, i = lv.idx, stars = lvStarsFor(i, t);
    const d = lvLoad();
    const prevBest = d.best[i];
    const isBest = !prevBest || t < prevBest;
    if (isBest) d.best[i] = +t.toFixed(2);
    const prevStars = d.stars[i];
    const gainedStars = Math.max(0, stars - d.stars[i]);
    d.stars[i] = Math.max(d.stars[i], stars);
    // Three stars earn a supply drop whose starting rarity follows the level's difficulty (and the dimension);
    // anything less pays the base rewards straight away.
    let loot;
    if (stars >= 3 && prevStars < 3){   // the drop is a one-time reward for the first 3-star clear
        const n = DIMENSIONS[curDim].levels.length, f = i / Math.max(1, n - 1);
        const tier = lvDropTier(curDim, i);
        const coins = curDim === 0 ? Math.round(40 + f * 60) : Math.round(90 + f * 120);
        loot = awardLootDrop(lv.lootId, {coins, xp:25 + Math.round(f * 25), passPoints:50}, {tier});
    } else {
        const coins = gainedStars * 20, xp = 25, pp = 20 + stars * 10, q = prog();
        if (!q.lootGrants[lv.lootId] && !q.pendingDrops[lv.lootId]){
            q.xp += xp; q.passPoints += pp; q.passPointsEarned += pp;
            q.lootGrants[lv.lootId] = { id:lv.lootId, tier:'common', coins, xp, passPoints:pp, cosmetic:null, noDrop:true }; saveProg(q);
            store('rr_coins', load('rr_coins', 0) + coins);
        }
        loot = { noDrop:true, coins, xp, passPoints:pp };
    }
    lvSave(d);
    const L = DIMENSIONS[curDim].levels[i];
    setTimeout(() => {
        hud.style.display = 'none';
        document.getElementById('lvd-kicker').textContent = 'LEVEL ' + (i+1) + ' · ' + L.name.toUpperCase();
        document.getElementById('lvd-time').textContent = lvFmt(t);
        const sEl = document.getElementById('lvd-stars');
        sEl.innerHTML = [0,1,2].map(k => `<span class="star${k < stars ? ' on' : ''}" style="animation-delay:${0.15 + k*0.18}s">${icon('star')}</span>`).join('');
        const b = document.getElementById('lvd-best');
        b.textContent = isBest ? 'NEW BEST' : 'BEST ' + lvFmt(prevBest);
        b.classList.toggle('muted', !isBest);
        document.getElementById('lvd-falls').textContent = lv.falls;
        document.getElementById('lvd-targets').innerHTML = `${icon('star')}${icon('star')}${icon('star')} ${lvFmt(L.par3)} &nbsp;·&nbsp; ${icon('star')}${icon('star')} ${lvFmt(L.par2)}`;
        document.getElementById('btn-lvd-next').style.display = i < DIMENSIONS[curDim].levels.length - 1 ? '' : 'none';
        if (loot.noDrop) document.getElementById('loot-level').innerHTML = `<div class="loot-items">${R('coin', loot.coins, {plus:true})}${R('xp', loot.xp, {plus:true})}${R('pass', loot.passPoints, {plus:true})}</div>`;
        else renderLootDrop('loot-level', loot);
        showScreen('lvdone');
        refreshStartMeta();
    }, 1300);
}

/* ---- drawing ---- */
function drawLevelSky(){
    const col = DIMENSIONS[curDim].levels[lv.idx].color;
    const g = ctx.createRadialGradient(SCREEN_PW()/2, -CH*0.1, 20, SCREEN_PW()/2, -CH*0.1, CH*1.1);
    g.addColorStop(0, col + '24'); g.addColorStop(1, col + '00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, SCREEN_PW(), CH);
}
function drawLevelGauge(){
    const lp = players[0];
    const x0 = CW - SIDEBAR;
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x0, 0, SIDEBAR, CH);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, CH); ctx.stroke();
    if (!lp || !lv) return;
    const cx = x0 + SIDEBAR/2, top = 30, bot = CH - 16;
    const col = DIMENSIONS[curDim].levels[lv.idx].color;
    // finish flag
    ctx.fillStyle = '#ffffff';
    for (let k=0;k<3;k++){ ctx.fillRect(cx-6+k*4, 12 + (k%2)*4, 4, 4); ctx.fillRect(cx-6+k*4, 12 + ((k+1)%2)*4 + 4, 4, 4); }
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(cx-3, top, 6, bot-top, 3); ctx.fill();
    const prog = Math.max(0, Math.min(1, (START_Y - lp.y) / (START_Y - lv.finishY)));
    const py = bot - (bot - top) * prog;
    ctx.fillStyle = col + '99'; roundRect(cx-3, py, 6, bot - py, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, py, 7, 0, 7);
    ctx.fillStyle = lp.color; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
}

/* ---- wiring ---- */
const lvNameEl = document.getElementById('lv-num-hud');
const lvTimeEl = document.getElementById('lv-time');
const lvFallsEl = document.getElementById('lv-falls');
const lvFallsPill = document.getElementById('lv-falls-pill');
document.getElementById('btn-tower').addEventListener('click', openParkour);
document.getElementById('btn-lv-back').addEventListener('click', () => { refreshStartMeta(); showScreen('start'); });
document.getElementById('btn-lvd-next').addEventListener('click', () => lvStart(Math.min(DIMENSIONS[curDim].levels.length-1, lv.idx + 1)));
document.getElementById('btn-lvd-retry').addEventListener('click', () => lvStart(lv.idx));
document.getElementById('btn-lvd-levels').addEventListener('click', () => {
    state = 'menu'; gameMode = 'race'; document.body.classList.remove('mode-level'); openLevels();
});

refreshStartMeta();
function syncMuteBtn(){
    const mb = document.getElementById('btn-mute');
    if (!mb) return;
    const on = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.3 6.4a7.5 7.5 0 0 1 0 11.2"/></svg>';
    const off = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
    mb.innerHTML = SFX.muted ? off : on;
    mb.classList.toggle('muted', SFX.muted);
    mb.setAttribute('aria-label', SFX.muted ? 'Sound off' : 'Sound on');
}
{
    const mb = document.getElementById('btn-mute');
    syncMuteBtn();
    mb.addEventListener('click', (e) => {
        e.stopPropagation();
        const m = SFX.toggle();
        syncMuteBtn();
        // one button for everything: muting stops the music, unmuting brings back the
        // right track for wherever you are.
        if (m) SFX.music.stop();
        else if (SFX.music.on) SFX.music.set(state === 'menu' ? 'menu' : 'race');
    });
}
/* ---- Android / browser back button: pause or step back, never close the app ---- */
(function(){
    if (typeof history === 'undefined' || !history.pushState) return;
    // keep one spare history entry so the hardware Back button fires popstate instead of leaving
    history.pushState({ rr:1 }, '');
    window.addEventListener('popstate', () => {
        try {
            if (state === 'playing'){
                // pressing Back during a run = open the pause menu (same as the ❚❚ button)
                const pauseBtn = document.getElementById('btn-pause');
                if (pauseBtn && hud && hud.style.display !== 'none') pauseBtn.click();
            } else if (state === 'paused'){
                resumeRace();
            } else if (state === 'over' || state === 'finished'){
                // on a results / summit screen, Back goes to the main menu
                state = 'menu'; gameMode = 'race'; if (hud) hud.style.display = 'none';
                document.body.classList.remove('mode-escape','mode-parkour','mode-level');
                if (typeof stopSpectate === 'function') stopSpectate();
                refreshStartMeta(); showScreen('start');
            } else {
                // in menus: if we're on a sub-screen, go to the home tab; otherwise stay put
                const sub = ['s-levels','s-pk','s-settings','s-summit'].find(id => { const el = document.getElementById(id); return el && el.style.display === 'flex'; });
                if (sub) showScreen('start');
                else if (typeof menuTab === 'function') menuTab('home');
            }
        } catch(e){}
        history.pushState({ rr:1 }, '');   // always keep a spare entry so Back keeps working
    });
})();

/* start loop */
requestAnimationFrame(t=>{ last=t; requestAnimationFrame(loop); });
