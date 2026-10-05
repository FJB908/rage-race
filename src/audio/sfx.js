// SOUND: calm, warm, satisfying. Everything is SYNTHESISED once at build time (tools/bake-audio.js renders it with this very file) and shipped as
// small ogg files in src/audio/bank/. At run time the game only plays finished recordings: no oscillators, filters or offline rendering happen while you
// play, so a busy phone cannot make the sound crackle. The synthesis code below stays as the source of the sounds and as a fallback if the files are missing.
//  * SFX: soft marimba / kalimba / vibraphone / felt sounds, all tuned to the same pentatonic C so rapid sounds always blend.
//  * MUSIC: instrumental jazz-meets-classical tracks (walking bass, brushes, rhodes, vibraphone, flute, harpsichord, strings, piano).
//    Tracks: menu (ballad), race (baroque swing), escape (nocturne), gauntlet (jazz waltz), levels (bossa).
// Loaded BEFORE game.js. API: SFX.play(name, arg), SFX.music.set(track|null) / stop / toggle / setVol, SFX.toggle / setMuted / setSfxVol / setMusVol / unlock.
const SFX = (() => {
    let ac = null, comp = null, bankBus = null, sfxBus = null, musBus = null, verbIn = null, musVerb = null, dly = null, noiseBuf = null, muted = false, extCtx = null;
    let sfxVol = 0.5, musVol = 0.5, lastBump = 0, lastAny = 0;
    try { muted = localStorage.getItem('rr_mute') === '1'; } catch (e) {}
    try { const v = localStorage.getItem('rr_sfxvol'); if (v !== null) sfxVol = Math.max(0, Math.min(1, +v)); } catch (e) {}
    try { const v = localStorage.getItem('rr_musvol'); if (v !== null) musVol = Math.max(0, Math.min(1, +v)); } catch (e) {}
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const nm = s => { const m = /^([A-G])([#b]?)(\d)$/.exec(s); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
    const PENT = [0, 2, 4, 7, 9];                       // major pentatonic: every combination sounds pleasant
    const pent = (root, i) => root + PENT[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);
    let active = 0;                                     // sources playing right now: caps the load so the audio thread never chokes
    function track(n) { if (offline) return; active++; n.onended = () => { active--; }; }

    let offline = false;                                // true while a music loop is being rendered ahead of time (nothing in real time)
    function makeVerb(A, secs, damp, level) {           // a mono generated impulse response (cheap to convolve)
        try {
            const len = Math.floor(A.sampleRate * secs), ir = A.createBuffer(1, len, A.sampleRate), d = ir.getChannelData(0);
            let lp = 0; for (let i = 0; i < len; i++) { const x = 1 - i / len; lp += (((Math.random() * 2 - 1) * x * x * x) - lp) * damp; d[i] = lp * 2.2; }
            const cv = A.createConvolver(); cv.buffer = ir; const inG = A.createGain(), outG = A.createGain(); outG.gain.value = level;
            inG.connect(cv); cv.connect(outG); return { inG, outG };
        } catch (e) { return null; }
    }
    function makeNoise(A) { const n = Math.floor(A.sampleRate * 1.5), buf = A.createBuffer(1, n, A.sampleRate), nd = buf.getChannelData(0); for (let i = 0; i < n; i++) nd[i] = Math.random() * 2 - 1; return buf; }
    function makeDelay(A, target) {                     // gentle echo for the music (dotted eighth)
        try {
            const d = A.createDelay(1.0); d.delayTime.value = 0.36;
            const fb = A.createGain(); fb.gain.value = 0.26; const dOut = A.createGain(); dOut.gain.value = 0.22;
            const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
            d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(dOut); dOut.connect(target); return d;
        } catch (e) { return null; }
    }
    function ctx() {
        if (!ac) {
            const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
            if (!extCtx && !AC) return null;
            if (extCtx) ac = extCtx; else { try { ac = new AC({ latencyHint: 'playback' }); } catch (e) { ac = new AC(); } }   // a bit more buffer than 'interactive': fewer underruns when the game is busy drawing
            comp = ac.createGain(); comp.gain.value = 1.25;
            try {                                       // soft saturation instead of a (laggy) compressor
                const shaper = ac.createWaveShaper(), cv = new Float32Array(4096);
                for (let i = 0; i < 4096; i++) { const x = i / 2047.5 - 1; cv[i] = Math.tanh(x * 1.1) / Math.tanh(1.1); }
                shaper.curve = cv; shaper.oversample = 'none';
                const out = ac.createGain(); out.gain.value = 0.92; comp.connect(shaper); shaper.connect(out); out.connect(ac.destination);
            } catch (e) { comp.connect(ac.destination); }
            sfxBus = ac.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(comp);
            bankBus = ac.createGain(); bankBus.gain.value = 2; bankBus.connect(sfxBus);       // the recordings are baked 6 dB down (see tools/bake-audio.js)
            musBus = ac.createGain(); musBus.gain.value = 0.0001; musBus.connect(comp);
            const v1 = makeVerb(ac, 0.9, 0.5, 0.3); if (v1) { verbIn = v1.inG; v1.outG.connect(comp); } else verbIn = comp;
            noiseBuf = makeNoise(ac);
            bankDecode();
        }
        if (!offline && ac.state === 'suspended' && ac.resume) { try { const r = ac.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
        return ac;
    }
    const send = (g, amt, target) => { if (!amt || !target) return; const s = ac.createGain(); s.gain.value = amt; g.connect(s); s.connect(target); };
    function envelope(g, t0, peak, a, dur, rel, hold) {
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + a);
        if (hold) g.gain.setValueAtTime(peak * hold, t0 + a + 0.001);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + rel);
    }
    // one synth voice: oscillator(s) -> optional filter (with sweep) -> envelope -> bus (+ reverb / echo sends)
    function voice(o) {
        const A = ctx(); if (!A) return;
        const isMus = o.bus === 'mus'; if (!isMus && muted) return;
        const t0 = (o.when !== undefined ? o.when : A.currentTime) + (o.at || 0), dur = o.t || 0.2, rel = o.r || 0.06;
        const g = A.createGain(); let head = g;
        if (o.filter) {
            const f = A.createBiquadFilter(); f.type = o.filter.type || 'lowpass'; f.Q.value = o.filter.q || 0.7;
            f.frequency.setValueAtTime(o.filter.f, t0);
            if (o.filter.f2) f.frequency.exponentialRampToValueAtTime(o.filter.f2, t0 + (o.filter.time || dur));
            f.connect(g); head = f;
        }
        const detunes = o.unison ? [-o.unison, o.unison] : [0];
        for (const dt of detunes) {
            const osc = A.createOscillator(); osc.type = o.type || 'sine';
            osc.frequency.setValueAtTime(o.f, t0); if (dt && osc.detune) osc.detune.value = dt;
            if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.glide || dur));
            if (o.vib) { const l = A.createOscillator(), lg = A.createGain(); l.frequency.value = o.vibRate || 5; lg.gain.value = o.vib; l.connect(lg); lg.connect(osc.frequency); track(l); l.start(t0); l.stop(t0 + dur + rel + 0.02); }
            osc.connect(head); track(osc); osc.start(t0); osc.stop(t0 + dur + rel + 0.02);
        }
        envelope(g, t0, (o.v || 0.2) / detunes.length, Math.max(o.a || 0.008, 0.008), dur, rel, o.hold);
        g.connect(isMus ? musBus : sfxBus);
        if (isMus) { send(g, o.echo, dly); send(g, o.verb, musVerb); } else send(g, o.verb, verbIn);
    }
    function noise(o) {
        const A = ctx(); if (!A) return;
        const isMus = o.bus === 'mus'; if (!isMus && muted) return;
        const t0 = (o.when !== undefined ? o.when : A.currentTime) + (o.at || 0), dur = o.t || 0.2;
        const src = A.createBufferSource(); src.buffer = noiseBuf;
        const f = A.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q || 0.7;
        f.frequency.setValueAtTime(o.f || 1200, t0); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
        const g = A.createGain(); envelope(g, t0, o.v || 0.2, Math.max(o.a || 0.02, 0.02), dur, Math.max(o.r || 0.08, 0.08));
        const sm = A.createBiquadFilter(); sm.type = 'lowpass'; sm.frequency.value = 7000; sm.Q.value = 0.4;      // no harsh edges: noise is always softened
        src.connect(f); f.connect(sm); sm.connect(g); g.connect(isMus ? musBus : sfxBus);
        if (isMus) send(g, o.verb, musVerb); else send(g, o.verb, verbIn);
        track(src); src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + Math.max(o.r || 0.08, 0.08) + 0.04);
    }

    /* ================================================================== instruments (shared by SFX and music) ==== */
    // each takes (frequency, o) where o = { v: volume, t: length, at/when: start, bus: 'mus' for music, verb, echo }
    const base = o => ({ bus: o.bus, when: o.when, at: o.at, verb: o.verb, echo: o.echo });
    const I = {
        // marimba / kalimba: a round fundamental, a quick bright 4th partial and a tiny wooden tick
        pluck(f, o = {}) { const b = base(o), t = o.t || 0.55, v = o.v || 0.16;
            voice(Object.assign({ f, t, v, a: 0.003, r: 0.08 }, b));
            if (f * 4 < 5000) voice(Object.assign({ f: f * 4, t: 0.07, v: v * 0.22, a: 0.002, r: 0.03 }, b, { verb: 0 })); },
        // vibraphone: bell-like, slow decay, slight chorus
        vibe(f, o = {}) { const b = base(o), t = o.t || 1.3, v = o.v || 0.12;
            voice(Object.assign({ f, t, v, a: 0.004, r: 0.2 }, b)); voice(Object.assign({ f: f * 1.004, t, v: v * 0.6, a: 0.004, r: 0.2 }, b, { verb: 0 }));
            if (f * 4 < 5000) voice(Object.assign({ f: f * 4, t: 0.18, v: v * 0.18, a: 0.002, r: 0.05 }, b, { verb: 0 })); },
        // rhodes-like electric piano
        epiano(f, o = {}) { const b = base(o), t = o.t || 1.1, v = o.v || 0.1;
            voice(Object.assign({ f, t, v, a: 0.004, r: 0.15, filter: { f: 2800, f2: 900, time: t } }, b));
            voice(Object.assign({ f: f * 2, t: t * 0.5, v: v * 0.22, a: 0.003, r: 0.08 }, b, { verb: 0 }));
            voice(Object.assign({ f: f * 7.02, t: 0.1, v: v * 0.09, a: 0.002, r: 0.03 }, b, { verb: 0 })); },
        // soft acoustic piano
        piano(f, o = {}) { const b = base(o), t = o.t || 0.9, v = o.v || 0.12;
            voice(Object.assign({ type: 'triangle', f, t, v, a: 0.004, r: 0.18, filter: { f: Math.min(5000, f * 7), f2: Math.max(500, f * 1.5), time: t } }, b));
            voice(Object.assign({ f: f * 2, t: t * 0.6, v: v * 0.3, a: 0.003, r: 0.1 }, b, { verb: 0 }));
            voice(Object.assign({ f: f * 3, t: t * 0.3, v: v * 0.1, a: 0.003, r: 0.06 }, b, { verb: 0 })); },
        // upright bass: warm triangle with a little finger noise; second harmonic keeps it audible on phone speakers
        bass(f, o = {}) { const b = { bus: o.bus, when: o.when, at: o.at }, t = o.t || 0.42, v = o.v || 0.2;
            voice(Object.assign({ type: 'triangle', f, t, v, a: 0.006, r: 0.1, filter: { f: 520, f2: 240, time: t } }, b));
            voice(Object.assign({ f: f * 2, t: t * 0.6, v: v * 0.35, a: 0.005, r: 0.06 }, b)); },
        // harpsichord: plucked, glassy, short
        harpsi(f, o = {}) { const b = base(o), t = o.t || 0.4, v = o.v || 0.07;
            voice(Object.assign({ type: 'sawtooth', f, t, v, a: 0.002, r: 0.06, filter: { f: 3400, f2: 1000, time: 0.25 } }, b));
            voice(Object.assign({ f: f * 2, t: t * 0.5, v: v * 0.4, a: 0.002, r: 0.04 }, b, { verb: 0 })); },
        // nylon guitar
        guitar(f, o = {}) { const b = base(o), t = o.t || 0.5, v = o.v || 0.09;
            voice(Object.assign({ type: 'triangle', f, t, v, a: 0.003, r: 0.08, filter: { f: 2600, f2: 1100, time: t } }, b));
            voice(Object.assign({ f: f * 2, t: t * 0.5, v: v * 0.3, a: 0.003, r: 0.05 }, b, { verb: 0 })); },
        // flute: breathy sine with vibrato
        flute(f, o = {}) { const b = base(o), t = o.t || 0.6, v = o.v || 0.09;
            voice(Object.assign({ f, t, v, a: 0.07, r: 0.18, vib: f * 0.006, vibRate: 5.1, hold: 0.9 }, b));
            voice(Object.assign({ f: f * 2, t, v: v * 0.12, a: 0.09, r: 0.15 }, b, { verb: 0 })); },
        // strings: slow, soft, detuned
        strings(f, o = {}) { const b = base(o), t = o.t || 2.4, v = o.v || 0.035;
            voice(Object.assign({ type: 'sawtooth', f, t, v, a: Math.min(0.9, t * 0.35), r: 0.7, unison: 7, filter: { f: 1000, q: 0.5 }, vib: f * 0.003, vibRate: 4.6 }, b)); },
        // warm cello for the dark tracks
        cello(f, o = {}) { const b = base(o), t = o.t || 1, v = o.v || 0.07;
            voice(Object.assign({ type: 'sawtooth', f, t, v, a: 0.12, r: 0.25, filter: { f: 1100, q: 0.6 }, vib: f * 0.005, vibRate: 5.3, hold: 0.9 }, b)); },
    };
    // percussion: brushes and a feathered kick, always soft
    const D = {
        ride(w, v = 1) { voice({ bus: 'mus', when: w, f: 3150, t: 0.09, v: 0.006 * v, a: 0.012, r: 0.1 }); voice({ bus: 'mus', when: w, f: 4260, t: 0.07, v: 0.004 * v, a: 0.012, r: 0.08 }); },
        chick() {},
        kick(w, v = 1) { voice({ bus: 'mus', when: w, f: 90, f2: 50, glide: 0.12, t: 0.18, v: 0.09 * v, a: 0.01, r: 0.08 }); },
        brush() {},
        rim(w, v = 1) { voice({ bus: 'mus', when: w, f: 760, f2: 700, t: 0.05, v: 0.03 * v, a: 0.01, r: 0.05 }); },
    };
    const bell = (f, o = {}) => I.vibe(f, Object.assign({ t: 0.9, v: 0.1, verb: 0.3 }, o));

    /* ================================================================== sound effects ==== */
    const P = {
        // movement
        jump(k = 0.6) { const n = pent(60, Math.round(k * 5) + 1);
            I.pluck(mtof(n), { t: 0.3, v: 0.16, verb: 0.18 });
            voice({ f: mtof(n - 12), f2: mtof(n), glide: 0.07, t: 0.09, v: 0.07, a: 0.004 });
            noise({ type: 'bandpass', f: 700, f2: 2400, q: 0.5, t: 0.09, v: 0.035, a: 0.01 }); },
        land() { voice({ f: 150, f2: 62, t: 0.1, v: 0.26, a: 0.003 }); noise({ type: 'lowpass', f: 900, t: 0.045, v: 0.08, a: 0.002 }); I.pluck(mtof(48), { t: 0.18, v: 0.05 }); },
        bump() { const n = performance.now(); if (n - lastBump < 120) return; lastBump = n;
            voice({ f: 210, f2: 120, t: 0.1, v: 0.14, a: 0.003 }); noise({ type: 'lowpass', f: 700, t: 0.06, v: 0.09 }); },
        bounce() { [0, 0.13].forEach((d, i) => voice({ f: 240 + i * 90, f2: 640 + i * 260, glide: 0.1, t: 0.12, v: 0.14, at: d, vib: 24, vibRate: 20, a: 0.004, verb: 0.15 })); I.pluck(mtof(72), { at: 0.05, t: 0.3, v: 0.07 }); },
        fall() { voice({ f: 780, f2: 150, t: 0.6, v: 0.1, glide: 0.6, vib: 10, vibRate: 6, a: 0.02, filter: { f: 1800, f2: 400 }, verb: 0.2 }); noise({ type: 'bandpass', f: 1200, f2: 300, t: 0.5, v: 0.025, a: 0.05 }); },
        stumble() { voice({ f: 135, f2: 52, t: 0.22, v: 0.24 }); noise({ type: 'lowpass', f: 700, t: 0.18, v: 0.14 }); voice({ f: 330, f2: 180, t: 0.3, v: 0.05, filter: { f: 900 }, verb: 0.2 }); },
        // items and powers
        pickup() { [0, 2, 4, 7].forEach((s, i) => I.vibe(mtof(pent(72, i + 1)), { at: i * 0.055, t: 0.7, v: 0.075, verb: 0.35 })); },
        item() { voice({ f: 330, f2: 660, glide: 0.18, t: 0.2, v: 0.07, filter: { f: 1200, f2: 3500 }, verb: 0.3 }); I.vibe(mtof(79), { at: 0.1, t: 0.8, v: 0.07, verb: 0.35 }); },
        boost() { [0, 1, 2, 3, 4].forEach(i => I.pluck(mtof(pent(64, i * 2)), { at: i * 0.05, t: 0.5, v: 0.08, verb: 0.3 }));
            voice({ f: 220, f2: 660, glide: 0.3, t: 0.3, v: 0.06, filter: { f: 700, f2: 3200 }, verb: 0.25 }); noise({ type: 'bandpass', f: 900, f2: 4000, t: 0.3, v: 0.04, a: 0.08, verb: 0.2 }); },
        rocket() { noise({ type: 'bandpass', f: 250, f2: 2600, q: 0.6, t: 0.6, v: 0.18, a: 0.06, verb: 0.25 });
            voice({ f: 95, f2: 420, glide: 0.55, t: 0.55, v: 0.1, a: 0.04, filter: { f: 400, f2: 2200 }, verb: 0.2 }); voice({ f: 62, f2: 44, t: 0.3, v: 0.2 }); },
        giant() { [55, 82.4, 110, 164.8].forEach((f, i) => voice({ f, t: 1.3, v: 0.12 / (i + 1) ** 0.5, a: 0.02, r: 0.4, verb: 0.3 })); bell(262, { at: 0.2, t: 1.1, v: 0.06 }); },
        chain() { [0, 0.07, 0.15].forEach((d, i) => I.pluck(1500 + i * 210, { at: d, t: 0.16, v: 0.05, verb: 0.2 })); },
        quake() { noise({ type: 'lowpass', f: 260, f2: 70, q: 1, t: 1, v: 0.25, a: 0.06, verb: 0.2 }); voice({ f: 52, f2: 34, t: 0.9, v: 0.2, a: 0.03, vib: 5, vibRate: 11 }); },
        shield() { P.pop(); [0, 4, 7, 11].forEach((s, i) => voice({ f: mtof(67 + s), t: 0.8, v: 0.06, a: 0.08, at: i * 0.04, verb: 0.5 })); bell(mtof(91), { at: 0.2, t: 0.9, v: 0.05 }); },
        block() { I.vibe(2093, { t: 0.5, v: 0.07, verb: 0.35 }); I.vibe(1568, { at: 0.04, t: 0.5, v: 0.05, verb: 0.35 }); },
        wind() { P.pop(); noise({ type: 'bandpass', f: 380, f2: 1500, q: 1.4, t: 1, v: 0.1, a: 0.3, verb: 0.3 }); noise({ type: 'bandpass', f: 800, f2: 450, q: 1.8, t: 0.8, v: 0.045, at: 0.25, a: 0.2 }); },
        ufo() { P.pop(); voice({ f: 480, f2: 760, t: 1.5, v: 0.08, a: 0.15, vib: 40, vibRate: 7, glide: 1.4, verb: 0.4 }); voice({ type: 'triangle', f: 120, t: 1.4, v: 0.04, a: 0.3, filter: { f: 450 } }); },
        // rewards
        coin() { I.pluck(mtof(79), { t: 0.14, v: 0.1, verb: 0.15 }); I.vibe(mtof(84), { at: 0.06, t: 0.5, v: 0.09, verb: 0.3 }); },
        combo() { [0, 1, 2, 3].forEach(i => I.pluck(mtof(pent(72, i + 1)), { at: i * 0.05, t: 0.3, v: 0.07, verb: 0.2 })); },
        star(i = 0) { I.vibe(mtof(pent(72, 1 + (i % 3) * 2)), { t: 0.9, v: 0.11, verb: 0.35 }); I.pluck(mtof(pent(84, 1 + (i % 3) * 2)), { t: 0.3, v: 0.04 }); },
        claim() { I.pluck(mtof(76), { t: 0.2, v: 0.09, verb: 0.2 }); [0, 1, 2].forEach(i => I.vibe(mtof(pent(79, i * 2)), { at: 0.07 + i * 0.07, t: 0.9, v: 0.08, verb: 0.35 })); },
        buy() { I.pluck(mtof(72), { t: 0.15, v: 0.1 }); I.pluck(mtof(79), { at: 0.07, t: 0.16, v: 0.1 }); I.vibe(mtof(84), { at: 0.15, t: 0.9, v: 0.09, verb: 0.35 }); },
        equip() { noise({ type: 'bandpass', f: 600, f2: 2400, t: 0.12, v: 0.045, a: 0.02, verb: 0.2 }); I.pluck(mtof(81), { at: 0.06, t: 0.3, v: 0.09, verb: 0.3 }); },
        levelup() { [0, 2, 4, 5, 7].forEach(i => I.vibe(mtof(pent(67, i)), { at: i * 0.08, t: 1.1, v: 0.08, verb: 0.4 })); [60, 64, 67, 71].forEach(m => I.piano(mtof(m), { at: 0.45, t: 1.2, v: 0.07, verb: 0.4 })); },
        // chest
        boom() { noise({ type: 'lowpass', f: 2200, f2: 90, q: 1, t: 1.0, v: 0.34, a: 0.003, verb: 0.3 }); voice({ f: 130, f2: 38, t: 0.6, v: 0.34, a: 0.003, glide: 0.5 }); voice({ f: 60, f2: 30, t: 0.9, v: 0.2, a: 0.01 }); },
        tick(k = 0) { voice({ f: 980 + k * 900, t: 0.05, v: 0.07 + k * 0.05, a: 0.002, r: 0.03 }); },
        knock(n = 0) { const k = Math.min(6, n); voice({ f: 190 + k * 18, f2: 110 + k * 8, t: 0.1, v: 0.22 }); noise({ type: 'bandpass', f: 1400 + k * 150, q: 2, t: 0.04, v: 0.1 }); I.pluck(mtof(pent(55, k)), { t: 0.25, v: 0.07, verb: 0.2 }); },
        tierup() { [0, 1, 2, 3, 4, 5].forEach(i => I.vibe(mtof(pent(67, i + 1)), { at: i * 0.06, t: 1, v: 0.07, verb: 0.4 })); },
        open() { [48, 55, 59, 64, 67, 71, 74].forEach((m, i) => I.piano(mtof(m), { at: i * 0.012, t: 1.8, v: 0.06, verb: 0.5 }));
            [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => I.vibe(mtof(pent(76, i)), { at: 0.12 + i * 0.05, t: 1.2, v: 0.06, verb: 0.45 }));
            voice({ f: 70, f2: 45, t: 0.5, v: 0.22 }); },
        // feedback
        fail() { [76, 74, 72, 69].forEach((m, i) => I.epiano(mtof(m), { at: i * 0.2, t: i === 3 ? 1.2 : 0.5, v: 0.09, verb: 0.35 })); },
        error() { voice({ f: 196, t: 0.12, v: 0.1, filter: { f: 700 }, verb: 0.15 }); voice({ f: 175, t: 0.18, v: 0.1, at: 0.11, filter: { f: 700 }, verb: 0.15 }); },
        // interface
        count() { voice({ f: 880, t: 0.06, v: 0.08, a: 0.01, r: 0.05 }); },
        tap() { voice({ f: 1250, f2: 1000, t: 0.035, v: 0.045, a: 0.002, r: 0.02 }); },
        select() { I.pluck(mtof(81), { t: 0.18, v: 0.07, verb: 0.15 }); },
        back() { I.pluck(mtof(72), { t: 0.18, v: 0.06, verb: 0.15 }); },
        toggle() { voice({ f: 700, f2: 950, glide: 0.04, t: 0.06, v: 0.08, a: 0.002 }); },
        pop() { voice({ f: 1400, f2: 700, t: 0.045, v: 0.08, a: 0.002, r: 0.02 }); },
        whoosh() { noise({ type: 'bandpass', f: 300, f2: 2200, q: 0.5, t: 0.25, v: 0.05, a: 0.07, verb: 0.2 }); },
        // match flow
        go() { [60, 64, 67, 71, 74].forEach((m, i) => I.piano(mtof(m), { at: i * 0.015, t: 1.1, v: 0.07, verb: 0.35 })); I.vibe(mtof(88), { at: 0.08, t: 1, v: 0.06, verb: 0.4 }); },
        finish() { [0, 2, 4, 5, 7, 9].forEach(i => I.vibe(mtof(pent(60, i)), { at: i * 0.07, t: 1.2, v: 0.085, verb: 0.4 }));
            [48, 55, 59, 64, 67].forEach(m => I.piano(mtof(m), { at: 0.5, t: 1.6, v: 0.07, verb: 0.45 })); },
        // stingers: the moments worth a little fanfare
        lead() { [0, 2, 4].forEach(i => I.vibe(mtof(pent(79, i)), { at: i * 0.05, t: 0.8, v: 0.07, verb: 0.35 })); I.pluck(mtof(91), { at: 0.15, t: 0.3, v: 0.05, verb: 0.3 }); },
        qualify() { [0, 1, 2, 4].forEach((k, i) => I.vibe(mtof(pent(72, k + 1)), { at: i * 0.07, t: 0.9, v: 0.08, verb: 0.35 })); I.piano(mtof(72), { at: 0.28, t: 1, v: 0.06, verb: 0.35 }); I.piano(mtof(79), { at: 0.28, t: 1, v: 0.05, verb: 0.35 }); },
        elim() { [71, 67, 62].forEach((m, i) => I.epiano(mtof(m), { at: i * 0.18, t: i === 2 ? 1.1 : 0.45, v: 0.08, verb: 0.4 })); voice({ f: 90, f2: 48, t: 0.5, v: 0.14, a: 0.01 }); },
        win() { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => I.vibe(mtof(m), { at: i * 0.06, t: 1.6, v: 0.085, verb: 0.4 }));
            [48, 55, 60, 64, 67].forEach((m, j) => I.piano(mtof(m), { at: 0.42 + j * 0.012, t: 2.2, v: 0.075, verb: 0.45 }));
            [55, 60, 64, 67].forEach(m => I.strings(mtof(m), { at: 0.4, t: 2.4, v: 0.04 }));
            bell(mtof(96), { at: 0.55, t: 1.4, v: 0.06 }); voice({ f: 70, f2: 44, t: 0.5, v: 0.2, at: 0.42 });
            [0, 1, 2, 3, 4].forEach(i => I.pluck(mtof(pent(84, i)), { at: 0.9 + i * 0.06, t: 0.4, v: 0.04, verb: 0.35 })); },
        gtwin() { [0, 2, 4, 5, 7, 9, 11, 12].forEach((i, k) => I.vibe(mtof(pent(60, i)), { at: k * 0.07, t: 1.5, v: 0.08, verb: 0.4 }));
            [[48, 55, 60, 64, 67], [53, 60, 65, 69, 72], [55, 59, 62, 67, 71], [48, 55, 60, 64, 72]].forEach((ch, c) => ch.forEach((m, j) => I.piano(mtof(m), { at: 0.65 + c * 0.55 + j * 0.012, t: c === 3 ? 2.6 : 1.1, v: 0.075, verb: 0.5 })));
            [55, 60, 64, 67, 72].forEach(m => I.strings(mtof(m), { at: 0.6, t: 3.4, v: 0.045 }));
            [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => I.vibe(mtof(pent(84, i)), { at: 2.5 + i * 0.07, t: 1.2, v: 0.06, verb: 0.45 }));
            voice({ f: 66, f2: 40, t: 0.7, v: 0.22, at: 0.65 }); voice({ f: 66, f2: 40, t: 1.2, v: 0.22, at: 2.2 }); bell(mtof(96), { at: 2.3, t: 1.8, v: 0.07 }); },
        shatter() { for (let i = 0; i < 4; i++) I.pluck(mtof(pent(84, i + Math.floor(Math.random() * 3))), { at: i * 0.035, t: 0.25, v: 0.045, verb: 0.35 }); },
    };
    const COOLDOWN = { coin: 45, land: 70, pickup: 90, item: 70, combo: 120, shatter: 150, chain: 200, block: 200, jump: 40, tap: 60, knock: 30 };
    const CRITICAL = new Set(['win', 'gtwin', 'qualify', 'elim', 'lead', 'jump', 'land', 'finish', 'go', 'count', 'fail', 'boost', 'stumble', 'open', 'knock', 'boom', 'tick']);
    const lastPlay = {};

    /* ================================================================== music ==== */
    // A bar = { r: bass root (midi), q: chord quality for the walking bass, v: voicing (midi) for the comping, a: arpeggio notes, m: melody [[step, 'E5', length], ...] }
    // Steps are EIGHTH notes (8 per bar in 4/4, 6 in 3/4). Swing delays every off-beat eighth.
    const QUAL = { maj: [4, 7], min: [3, 7], dom: [4, 7], m7b5: [3, 6] };
    const B = (r, q, v, m, a) => ({ r, q, v, m, a });
    const TRACKS = {
        // calm lounge ballad: rhodes, upright, brushes, vibraphone then flute
        menu: { bpm: 76, swing: 0.3, spb: 8, bass: 'walk', drums: 'ballad', comp: 'epiano', mel: ['vibe', 'flute'], pad: true, bars: [
            B(48, 'maj', [64, 67, 71, 74], [[0, 'E5', 3], [3, 'D5', 1], [4, 'C5', 2], [6, 'G4', 2]]),
            B(45, 'dom', [67, 71, 73, 76], [[0, 'A4', 2], [2, 'C#5', 2], [4, 'E5', 3], [7, 'D5', 1]]),
            B(50, 'min', [65, 69, 72, 76], [[0, 'F5', 3], [3, 'E5', 1], [4, 'D5', 2], [6, 'A4', 2]]),
            B(43, 'dom', [65, 69, 71, 76], [[0, 'B4', 2], [2, 'D5', 2], [4, 'G5', 4]]),
            B(52, 'min', [67, 71, 74, 76], [[0, 'G5', 3], [3, 'E5', 1], [4, 'B4', 2], [6, 'D5', 2]]),
            B(45, 'dom', [67, 71, 73, 76], [[0, 'C#5', 2], [2, 'E5', 2], [4, 'A5', 3], [7, 'G5', 1]]),
            B(50, 'min', [65, 69, 72, 76], [[0, 'F5', 2], [2, 'E5', 1], [3, 'D5', 1], [4, 'C5', 2], [6, 'A4', 2]]),
            B(43, 'dom', [65, 71, 74], [[0, 'B4', 2], [2, 'D5', 2], [4, 'F5', 2], [6, 'D5', 2]]),
            B(41, 'maj', [64, 67, 69, 72], [[0, 'A5', 3], [3, 'G5', 1], [4, 'F5', 2], [6, 'C5', 2]]),
            B(46, 'dom', [68, 74, 79], [[0, 'D5', 2], [2, 'F5', 2], [4, 'G5', 3], [7, 'F5', 1]]),
            B(52, 'min', [67, 71, 74, 76], [[0, 'E5', 3], [3, 'G5', 1], [4, 'B5', 3], [7, 'A5', 1]]),
            B(45, 'dom', [67, 71, 73, 76], [[0, 'G5', 2], [2, 'E5', 2], [4, 'C#5', 2], [6, 'A4', 2]]),
            B(50, 'min', [65, 69, 72, 76], [[0, 'D5', 2], [2, 'F5', 2], [4, 'A5', 3], [7, 'G5', 1]]),
            B(43, 'dom', [65, 69, 71, 76], [[0, 'F5', 2], [2, 'E5', 2], [4, 'D5', 2], [6, 'B4', 2]]),
            B(48, 'maj', [64, 67, 71, 74], [[0, 'E5', 4], [4, 'G5', 4]]),
            B(48, 'maj', [64, 67, 71, 74], [[0, 'C6', 8]]),
        ] },
        // baroque swing: harpsichord figuration à la Bach over a walking bass and ride cymbal, vibraphone cantus on top
        race: { bpm: 134, swing: 0.27, spb: 8, bass: 'walk', drums: 'swing', comp: 'harpsi', mel: ['vibe', 'vibe'], pad: true, bars: [
            B(45, 'min', null, [[0, 'E5', 4], [4, 'A5', 4]], [64, 67, 69, 72]),
            B(50, 'min', null, [[0, 'F5', 4], [4, 'D5', 4]], [62, 65, 69, 72]),
            B(43, 'dom', null, [[0, 'D5', 4], [4, 'F5', 4]], [62, 65, 67, 71]),
            B(48, 'maj', null, [[0, 'E5', 4], [4, 'G5', 4]], [60, 64, 67, 71]),
            B(41, 'maj', null, [[0, 'A5', 4], [4, 'F5', 4]], [64, 65, 69, 72]),
            B(47, 'm7b5', null, [[0, 'D5', 4], [4, 'F5', 4]], [62, 65, 69, 71]),
            B(40, 'dom', null, [[0, 'B4', 4], [4, 'G#4', 2], [6, 'D5', 2]], [62, 64, 68, 71]),
            B(45, 'min', null, [[0, 'E5', 8]], [64, 67, 69, 72]),
            B(50, 'min', null, [[0, 'F5', 2], [2, 'A5', 2], [4, 'D6', 4]], [62, 65, 69, 72]),
            B(43, 'dom', null, [[0, 'D6', 2], [2, 'B5', 2], [4, 'G5', 4]], [62, 65, 67, 71]),
            B(48, 'maj', null, [[0, 'E6', 2], [2, 'C6', 2], [4, 'G5', 4]], [60, 64, 67, 71]),
            B(41, 'maj', null, [[0, 'A5', 2], [2, 'F5', 2], [4, 'C6', 4]], [64, 65, 69, 72]),
            B(47, 'm7b5', null, [[0, 'F5', 2], [2, 'D5', 2], [4, 'A5', 4]], [62, 65, 69, 71]),
            B(40, 'dom', null, [[0, 'G#5', 2], [2, 'B5', 2], [4, 'F5', 2], [6, 'E5', 2]], [62, 65, 68, 71]),
            B(45, 'min', null, [[0, 'C6', 4], [4, 'A5', 4]], [64, 67, 69, 72]),
            B(40, 'dom', null, [[0, 'B5', 2], [2, 'G#5', 2], [4, 'E5', 4]], [62, 64, 68, 71]),
        ] },
        // nocturne: dark, flowing piano left hand under a singing cello line
        escape: { bpm: 100, swing: 0.12, spb: 8, bass: 'pedal', drums: 'soft', comp: 'piano', mel: ['cello', 'flute'], pad: true, bars: [
            B(38, 'min', [62, 65, 69], [[0, 'A5', 4], [4, 'F5', 2], [6, 'E5', 2]], [50, 57, 62, 65]),
            B(34, 'maj', [62, 65, 70], [[0, 'D5', 4], [4, 'F5', 4]], [46, 53, 58, 62]),
            B(43, 'min', [62, 67, 70], [[0, 'G5', 4], [4, 'Bb5', 2], [6, 'A5', 2]], [43, 50, 55, 58]),
            B(45, 'dom', [61, 67, 69], [[0, 'C#6', 4], [4, 'A5', 2], [6, 'E5', 2]], [45, 52, 55, 61]),
            B(38, 'min', [62, 65, 69], [[0, 'F5', 4], [4, 'A5', 4]], [50, 57, 62, 65]),
            B(34, 'maj', [62, 65, 70], [[0, 'D6', 4], [4, 'C6', 2], [6, 'Bb5', 2]], [46, 53, 58, 62]),
            B(43, 'min', [62, 67, 70], [[0, 'A5', 3], [3, 'G5', 1], [4, 'F5', 2], [6, 'D5', 2]], [43, 50, 55, 58]),
            B(45, 'dom', [61, 67, 69], [[0, 'E5', 4], [4, 'C#5', 2], [6, 'D5', 2]], [45, 52, 55, 61]),
        ] },
        // jazz waltz: grand and a little heroic, oom-pah-pah piano with strings
        gauntlet: { bpm: 156, swing: 0.2, spb: 6, bass: 'waltz', drums: 'waltz', comp: 'piano', mel: ['piano', 'vibe'], pad: true, bars: [
            B(48, 'min', [63, 67, 72], [[0, 'G5', 4], [4, 'Eb5', 2]]),
            B(44, 'maj', [60, 63, 68], [[0, 'Ab5', 4], [4, 'C6', 2]]),
            B(41, 'min', [60, 65, 68], [[0, 'C6', 3], [3, 'Bb5', 1], [4, 'Ab5', 2]]),
            B(43, 'dom', [62, 65, 71], [[0, 'B5', 4], [4, 'D6', 2]]),
            B(48, 'min', [63, 67, 72], [[0, 'Eb6', 4], [4, 'D6', 2]]),
            B(51, 'maj', [58, 63, 67], [[0, 'Bb5', 2], [2, 'G5', 2], [4, 'Eb5', 2]]),
            B(44, 'maj', [60, 63, 68], [[0, 'C6', 2], [2, 'Ab5', 2], [4, 'F5', 2]]),
            B(43, 'dom', [62, 65, 71], [[0, 'D5', 4], [4, 'B4', 2]]),
        ] },
        // bossa for the levels: nylon guitar and flute
        levels: { bpm: 98, swing: 0.08, spb: 8, bass: 'bossa', drums: 'bossa', comp: 'guitar', mel: ['flute', 'vibe'], pad: false, bars: [
            B(41, 'maj', [64, 67, 69, 72], [[0, 'A5', 3], [3, 'G5', 1], [4, 'F5', 2], [6, 'C5', 2]]),
            B(43, 'min', [65, 70, 74], [[0, 'Bb5', 3], [3, 'A5', 1], [4, 'G5', 2], [6, 'D5', 2]]),
            B(48, 'dom', [64, 70, 74], [[0, 'E5', 2], [2, 'G5', 2], [4, 'A5', 3], [7, 'G5', 1]]),
            B(41, 'maj', [64, 67, 69, 72], [[0, 'F5', 4], [4, 'A5', 4]]),
            B(46, 'maj', [62, 65, 69, 72], [[0, 'D6', 3], [3, 'C6', 1], [4, 'Bb5', 2], [6, 'F5', 2]]),
            B(45, 'min', [64, 67, 72], [[0, 'E5', 2], [2, 'G5', 2], [4, 'C6', 3], [7, 'A5', 1]]),
            B(43, 'min', [65, 70, 74], [[0, 'Bb5', 2], [2, 'G5', 2], [4, 'D5', 2], [6, 'F5', 2]]),
            B(48, 'dom', [64, 70, 74], [[0, 'E5', 4], [4, 'Bb4', 2], [6, 'C5', 2]]),
        ] },
    };
    for (const T of Object.values(TRACKS)) for (const bar of T.bars) if (bar.m) bar.m = bar.m.map(([s, n, l]) => [s, nm(n), l]);
    // more music from the same material: the same songs in another key, tempo and instrumentation (a safe way to get variety)
    function variant(base, name, o) {
        const sh = o.shift || 0, B0 = TRACKS[base];
        const bars = (o.bars || B0.bars).map(b => ({ r: b.r + sh, q: b.q, v: b.v && b.v.map(x => x + sh), a: b.a && b.a.map(x => x + sh), m: b.m && b.m.map(([st, n, l]) => [st, n + sh, l]) }));
        TRACKS[name] = Object.assign({}, B0, { base: B0.base || base, bars }, o.over || {});
    }
    variant('menu', 'menu2', { shift: -3, over: { bpm: 70, comp: 'guitar', mel: ['flute', 'vibe'] } });
    variant('menu', 'menu3', { shift: 2, over: { bpm: 82, comp: 'piano', mel: ['vibe', 'piano'] } });
    variant('race', 'race2', { shift: 3, over: { bpm: 142, comp: 'piano', mel: ['vibe', 'flute'] } });
    variant('race', 'race3', { shift: -2, over: { bpm: 126, swing: 0.33, comp: 'harpsi', mel: ['piano', 'vibe'] } });
    variant('escape', 'escape2', { shift: 5, over: { bpm: 92, mel: ['flute', 'cello'] } });
    variant('gauntlet', 'gauntlet2', { shift: 2, over: { bpm: 168, mel: ['vibe', 'piano'] } });
    variant('levels', 'levels2', { shift: 3, over: { bpm: 106, comp: 'guitar', mel: ['vibe', 'flute'] } });
    variant('menu', 'results', { shift: 5, bars: TRACKS.menu.bars.slice(0, 8), over: { bpm: 70, comp: 'epiano', mel: ['vibe', 'vibe'], base: 'results' } });
    // what plays where: every mode has a short playlist, so the music changes from race to race (and inside a long race)
    const LISTS = { menu: ['menu', 'menu2', 'menu3'], race: ['race', 'race2', 'race3'], escape: ['escape', 'escape2'], gauntlet: ['gauntlet', 'gauntlet2'], levels: ['levels', 'levels2'], results: ['results'] };
    const GAPS = { menu: [4, 11] };                     // the menu music rests between songs (silence is part of the mix); everything else runs on
    const LOOPS = { results: true };

    // MUSIC is rendered ahead of time. Each loop is generated once into an AudioBuffer (an OfflineAudioContext renders it off the main thread),
    // then simply looped: no synthesis happens while you play, so a busy phone can never make it crackle.
    const PASSES = { menu: 1, race: 1, escape: 2, gauntlet: 4, levels: 2 };
    const MUS_GAIN = 0.8;
    function offlineGraph(oc) {
        const mb = oc.createGain(); mb.gain.value = 1; mb.connect(oc.destination);
        const v2 = makeVerb(oc, 2.2, 0.22, 0.5); if (v2) v2.outG.connect(mb);
        return { ac: oc, comp: null, sfxBus: null, musBus: mb, verbIn: null, musVerb: v2 ? v2.inG : null, dly: makeDelay(oc, mb), noiseBuf: makeNoise(oc), offline: true };
    }
    function runOn(g, fn) {
        const save = { ac, comp, sfxBus, musBus, verbIn, musVerb, dly, noiseBuf, offline };
        ({ ac, comp, sfxBus, musBus, verbIn, musVerb, dly, noiseBuf, offline } = g);
        try { fn(); } finally { ({ ac, comp, sfxBus, musBus, verbIn, musVerb, dly, noiseBuf, offline } = save); }
    }
    // a walking line: root, a chord tone, another, then a half step into the next root
    function walk(T, st, bi, beat) {
        const bar = T.bars[bi], nxt = T.bars[(bi + 1) % T.bars.length], [t3, t5] = QUAL[bar.q] || QUAL.maj;
        const pat = [bar.r, bar.r + (st.loop % 2 ? t5 : t3), bar.r + (st.loop % 2 ? t3 : t5), nxt.r + (nxt.r > bar.r ? -1 : 1)];
        let n = pat[beat]; while (n < 36) n += 12; while (n > 55) n -= 12; return n;
    }
    // schedule n eighth-note steps of a track starting at st.step (all times are absolute in the offline context)
    function genSteps(T, st, n) {
        const s8 = 60 / T.bpm / 2, spb = T.spb, nb = T.bars.length;
        for (let k = 0; k < n; k++) {
            const bi = Math.floor(st.step / spb) % nb, i = st.step % spb, bar = T.bars[bi];
            if (st.step > 0 && st.step % (spb * nb) === 0) st.loop++;
            const half = bi < nb / 2 ? 0 : 1;
            const off = (spb === 8 && i % 2 === 1) ? T.swing * s8 : 0;
            const w = st.next + off + (st.rnd() - 0.5) * 0.008;
            const vel = 0.88 + st.rnd() * 0.24;

            // ---- drums (soft and tonal: no noise bursts)
            if (T.drums === 'ballad') { if ([0, 2, 3, 4, 6, 7].includes(i)) D.ride(w, 0.8 * vel); if (i % 2 === 0) D.kick(w, 0.4); }
            else if (T.drums === 'swing') { if ([0, 2, 3, 4, 6, 7].includes(i)) D.ride(w, vel); if (i % 2 === 0) D.kick(w, 0.5); }
            else if (T.drums === 'soft') { if (i % 2 === 0) D.ride(w, 0.6); if (i === 0 || i === 4) D.kick(w, 0.55); if (i === 2 || i === 6) D.rim(w, 0.6); }
            else if (T.drums === 'waltz') { if (i % 2 === 0) D.ride(w, 0.9 * vel); if (i === 0) D.kick(w, 0.55); }
            else if (T.drums === 'bossa') { if ([0, 3, 4, 7].includes(i)) D.kick(w, 0.35); if ([1, 3, 6].includes(i)) D.rim(w, 0.55); D.ride(w, 0.5 * vel); }

            // ---- bass
            if (T.bass === 'walk' && i % 2 === 0) I.bass(mtof(walk(T, st, bi, i / 2)), { bus: 'mus', when: w, v: 0.2 * vel, t: s8 * 1.7 });
            else if (T.bass === 'pedal' && i % 4 === 0) I.bass(mtof(bar.r + (i === 4 ? 7 : 0)), { bus: 'mus', when: w, v: 0.2, t: s8 * 3 });
            else if (T.bass === 'waltz' && i === 0) I.bass(mtof(bar.r), { bus: 'mus', when: w, v: 0.22, t: s8 * 2.2 });
            else if (T.bass === 'bossa') { if (i === 0 || i === 4) I.bass(mtof(bar.r), { bus: 'mus', when: w, v: 0.2, t: s8 * 2.4 }); if (i === 3 || i === 7) I.bass(mtof(bar.r + 7), { bus: 'mus', when: w, v: 0.16, t: s8 * 1.6 }); }

            // ---- harmony
            if (T.comp === 'epiano') {
                if (i === 0) bar.v.forEach((m, j) => I.epiano(mtof(m), { bus: 'mus', when: w + j * 0.012, v: 0.05, t: s8 * 6, verb: 0.4 }));
                if (i === 5) bar.v.slice(1).forEach((m, j) => I.epiano(mtof(m), { bus: 'mus', when: w + j * 0.01, v: 0.028, t: s8 * 2, verb: 0.4 }));
            } else if (T.comp === 'harpsi') {
                const idx = [0, 1, 2, 3, 2, 1, 2, 3][i]; I.harpsi(mtof(bar.a[idx]), { bus: 'mus', when: w, v: 0.062 * vel, t: s8 * 1.4, verb: 0.3, echo: 0.2 });
                if (i === 0) I.harpsi(mtof(bar.a[0] - 12), { bus: 'mus', when: w, v: 0.05, t: s8 * 2, verb: 0.3 });
            } else if (T.comp === 'piano') {
                if (spb === 6) { if (i === 2 || i === 4) bar.v.forEach((m, j) => I.piano(mtof(m), { bus: 'mus', when: w + j * 0.008, v: 0.05 * vel, t: s8 * 1.6, verb: 0.35 })); }
                else { const idx = [0, 1, 2, 3, 2, 1, 2, 3][i], a = bar.a; if (a) I.piano(mtof(a[idx % a.length]), { bus: 'mus', when: w, v: 0.055 * vel, t: s8 * 2.2, verb: 0.45 });
                       if (i === 0 && bar.v) bar.v.forEach(m => I.piano(mtof(m - 12), { bus: 'mus', when: w, v: 0.035, t: s8 * 6, verb: 0.5 })); }
            } else if (T.comp === 'guitar') {
                if (i === 0 || i === 3 || i === 6) bar.v.forEach((m, j) => I.guitar(mtof(m), { bus: 'mus', when: w + j * 0.014, v: 0.05 * vel, t: s8 * 1.5, verb: 0.25 }));
            }
            if (T.pad && i === 0) {                           // strings hold the chord, very quietly
                const tones = bar.v || bar.a;
                tones.slice(0, 3).forEach(m => I.strings(mtof(m - (m > 70 ? 12 : 0)), { bus: 'mus', when: w, v: 0.022, t: s8 * spb * 0.95 }));
            }

            // ---- melody (the second half of the form uses the second instrument)
            for (const [sp, midi, len] of bar.m || []) if (sp === i) {
                const inst = T.mel[half], dur = Math.max(0.25, s8 * len * 0.95), lvl = (inst === 'cello' ? 0.08 : inst === 'flute' ? 0.085 : 0.1) * vel;
                I[inst](mtof(midi), { bus: 'mus', when: w, v: lvl, t: dur, verb: 0.5, echo: 0.3 });
            }
            st.step++; st.next += s8;
        }
    }
    /* ================================================================== finished recordings ==== */
    const BANK_DIR = 'src/audio/bank/';
    const decode = (A, ab) => new Promise((res, rej) => { try { const p = A.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); } });
    const bank = { state: 'idle', map: null, raw: null, buf: null };          // idle -> fetched -> ready (or failed: then the old live synthesis takes over)
    function bankFetch() {
        if (bank.state !== 'idle' || typeof fetch === 'undefined' || extCtx) return;
        bank.state = 'loading';
        Promise.all([fetch(BANK_DIR + 'sfx.json').then(r => r.json()), fetch(BANK_DIR + 'sfx.ogg').then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })])
            .then(([m, ab]) => { bank.map = m; bank.raw = ab; bank.state = 'fetched'; bankDecode(); }).catch(() => { bank.state = 'failed'; });
    }
    function bankDecode() {                              // decoded with the real context, so every buffer already has the device's sample rate (nothing is resampled while playing)
        if (bank.state !== 'fetched' || !ac) return; bank.state = 'decoding';
        decode(ac, bank.raw).then(b => { bank.buf = b; bank.raw = null; bank.state = 'ready'; }).catch(() => { bank.state = 'failed'; });
    }
    let bankActive = 0;
    function playBank(key) {
        const it = bank.map && bank.map.items[key]; if (!it || !bank.buf || !ac) return false;
        if (muted || bankActive >= 14) return true;
        const s = ac.createBufferSource(); s.buffer = bank.buf; s.connect(bankBus);
        bankActive++; s.onended = () => { bankActive--; };
        s.start(0, it[0], it[1]); return true;
    }
    const clamp01 = k => Math.max(0, Math.min(1, +k || 0));
    const QUANT = { jump: k => Math.round(clamp01(k === undefined ? 0.6 : k) * 5), knock: n => Math.min(6, Math.max(0, n | 0)), tick: k => Math.round(clamp01(k) * 7), star: i => (i | 0) % 3, shatter: () => Math.floor(Math.random() * 3) };
    const bankKey = (name, arg) => QUANT[name] ? name + ':' + QUANT[name](arg) : name;
    // the build tool renders one sound (or every variant of it) to a buffer; this is the only place that synthesises in bulk
    const BAKE = { jump: [0, 1, 2, 3, 4, 5].map(r => r / 5), knock: [0, 1, 2, 3, 4, 5, 6], tick: [0, 1, 2, 3, 4, 5, 6, 7].map(r => r / 7), star: [0, 1, 2], shatter: [0, 1, 2] };
    function bakeSfx(name, arg, sr, secs) {
        const oc = new OfflineAudioContext(1, Math.round(sr * secs), sr);
        const sb = oc.createGain(); sb.gain.value = 1; sb.connect(oc.destination);
        const v1 = makeVerb(oc, 0.9, 0.5, 0.6); if (v1) v1.outG.connect(oc.destination);       // live the reverb joined after the sfx volume (0.3); at the default volume 0.5 that equals 0.6 here
        const g = { ac: oc, comp: null, sfxBus: sb, musBus: null, verbIn: v1 ? v1.inG : sb, musVerb: null, dly: null, noiseBuf: makeNoise(oc), offline: true };
        const mu = muted; muted = false; try { runOn(g, () => P[name](arg)); } finally { muted = mu; }
        return oc.startRendering();
    }

    /* ================================================================== music player ==== */
    const MUSIC = (() => {
        let musicOn = true; try { musicOn = localStorage.getItem('rr_music') !== '0'; } catch (e) {}
        let list = null, gen = 0, live = [];              // list: which playlist is on; gen: bumped on every change so stale async work stops; live: sources playing or queued
        const buffers = {}, raws = {}, loading = {}, lastOf = {};
        const yieldMain = () => new Promise(r => setTimeout(r, 0));
        const base = () => Math.max(0.0001, musVol * MUS_GAIN);
        const listOf = n => LISTS[n] ? n : Object.keys(LISTS).find(k => LISTS[k].includes(n));
        // the old live path, kept as a fallback only: one full loop rendered ahead of time (and the reverb tail folded back onto the start)
        async function build(name) {
            const A = ctx(); if (!A) return null; const T = TRACKS[name], sr = 22050;
            const passes = PASSES[T.base || name] || (name === 'results' ? 2 : 1), steps = T.bars.length * T.spb * passes, s8 = 60 / T.bpm / 2, secs = steps * s8, tail = 3;
            const L = Math.round(secs * sr), oc = (typeof OfflineAudioContext !== 'undefined') ? new OfflineAudioContext(1, L + Math.round(tail * sr), sr) : null;
            if (!oc) return null;
            const g = offlineGraph(oc); let sd = 7 + name.length * 13;
            const st = { step: 0, next: 0.05, loop: 0, rnd: () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; } };
            for (let done = 0; done < steps; done += 16) { runOn(g, () => genSteps(T, st, Math.min(16, steps - done))); await yieldMain(); }
            const rendered = await oc.startRendering(), src = rendered.getChannelData(0);
            const out = A.createBuffer(1, L, sr), dst = out.getChannelData(0), tl = Math.round(tail * sr);
            let pk = 0, sq = 0;
            for (let i = 0; i < L; i++) { const v = src[i] + (i < tl ? src[L + i] : 0); dst[i] = v; const a = Math.abs(v); if (a > pk) pk = a; sq += v * v; }
            const rms = Math.sqrt(sq / L) || 1e-6, k = Math.min(0.8 / (pk || 1), 0.06 / rms);       // every track about equally loud, never hot
            for (let i = 0; i < L; i++) dst[i] *= k;
            const fade = Math.round(0.004 * sr); for (let i = 0; i < fade; i++) { const f = i / fade; dst[i] *= f; dst[L - 1 - i] *= f; }   // the very ends meet at zero: no click at the loop point
            return out;
        }
        function fetchRaw(name) {
            if (raws[name]) return Promise.resolve(raws[name]);
            if (typeof fetch === 'undefined' || extCtx) return Promise.reject(0);
            return fetch(BANK_DIR + 'music-' + name + '.ogg').then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(ab => (raws[name] = ab));
        }
        // a track's buffer: the finished recording, decoded once. Only the track that is needed right now may fall back to live synthesis.
        function getBuf(name, synthOk) {
            if (buffers[name]) return Promise.resolve(buffers[name]);
            const A = ctx(); if (!A) return Promise.resolve(null);
            if (!loading[name]) loading[name] = fetchRaw(name).then(ab => decode(A, ab.slice(0))).then(b => { delete raws[name]; return (buffers[name] = b); })
                .catch(() => null).then(b => { delete loading[name]; return b; });
            return loading[name].then(b => b || (synthOk ? build(name).then(o => (o ? (buffers[name] = o) : null)).catch(() => null) : null));
        }
        function pickNext(l) {
            const L = LISTS[l], opts = L.length > 1 ? L.filter(n => n !== lastOf[l]) : L, n = opts[Math.floor(Math.random() * opts.length)];
            lastOf[l] = n; return n;
        }
        function startTrack(name, when, fadeIn, loop) {
            const A = ctx(), g = A.createGain(), s = A.createBufferSource(), buf = buffers[name];
            s.buffer = buf; s.loop = !!loop;
            g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(1, when + fadeIn);
            s.connect(g); g.connect(musBus); s.start(when);
            const n = { s, g, name, when, end: loop ? Infinity : when + buf.duration };
            live.push(n); s.onended = () => { live = live.filter(x => x !== n); };
            return n;
        }
        // the next song is queued on the audio clock (right after this one, after a rest in the menu), so there is never a timer deciding when music starts
        async function queueNext(prev, my) {
            if (my !== gen || !list || LOOPS[list]) return;
            const name = pickNext(list), b = await getBuf(name, false);
            if (my !== gen || !b || !ac) return;
            const gap = GAPS[list] ? GAPS[list][0] + Math.random() * (GAPS[list][1] - GAPS[list][0]) : 0.15;
            const nxt = startTrack(name, Math.max(ac.currentTime + 0.05, prev.end + gap), 0.12, false);
            prev.s.addEventListener('ended', () => queueNext(nxt, my));
        }
        function stopAll(fade) {
            const A = ac; gen++;
            for (const n of live) { try { n.s.onended = null; n.g.gain.cancelScheduledValues(A.currentTime); n.g.gain.setValueAtTime(Math.max(0.0001, n.g.gain.value), A.currentTime); n.g.gain.linearRampToValueAtTime(0.0001, A.currentTime + fade); n.s.stop(A.currentTime + fade + 0.05); } catch (e) {} }
            live = [];
        }
        let pre = false;
        async function prefetch() {                       // the other songs are fetched and decoded quietly in the background (decoding runs off the main thread)
            if (pre) return; pre = true;
            for (const l of Object.keys(LISTS)) for (const n of LISTS[l]) { await getBuf(n, false); await new Promise(r => setTimeout(r, 300)); }
        }
        return {
            get on() { return musicOn; },
            get track() { const n = live.find(x => x.when <= (ac ? ac.currentTime : 0)); return n ? n.name : null; },
            get list() { return list; },
            get __queue() { return live.map(n => ({ name: n.name, when: +n.when.toFixed(2), end: +n.end.toFixed(2) })); },
            set(name) {
                if (!musicOn || muted || !name) { this.stop(); return; }
                const l = listOf(name); if (!l) { this.stop(); return; }
                if (!ctx()) return;
                if (list === l && live.length) return;
                const A = ac, hadMusic = live.length; if (hadMusic) stopAll(0.35); else gen++;
                list = l; const my = gen, first = pickNext(l);
                getBuf(first, true).then(b => {
                    if (my !== gen || !b || !musicOn || muted) return;
                    try { musBus.gain.cancelScheduledValues(A.currentTime); } catch (e) {}
                    musBus.gain.setValueAtTime(base(), A.currentTime);
                    const n = startTrack(first, A.currentTime + 0.05, hadMusic ? 0.5 : 0.25, !!LOOPS[l]);
                    queueNext(n, my); prefetch();
                });
            },
            stop() { list = null; if (ac && live.length) stopAll(0.5); else gen++; },
            // music steps back for a moment (a fanfare, a banner) and returns on its own
            duck(level, secs) {
                if (!ac || !musBus || !live.length) return; const t = ac.currentTime, g = musBus.gain, b = base();
                try { g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t); g.linearRampToValueAtTime(b * level, t + 0.15); g.setValueAtTime(b * level, t + secs); g.linearRampToValueAtTime(b, t + secs + 0.9); } catch (e) {}
            },
            setVol(v) { if (musBus && ac) { try { musBus.gain.cancelScheduledValues(ac.currentTime); } catch (e) {} musBus.gain.setValueAtTime(Math.max(0.0001, v * MUS_GAIN), ac.currentTime); } },
            toggle() { musicOn = !musicOn; try { localStorage.setItem('rr_music', musicOn ? '1' : '0'); } catch (e) {}
                if (!musicOn) this.stop(); return musicOn; },
            __build: name => build(name),                // the build tool: a finished loop of one track, rendered live (never used while playing)
        };
    })();

    // fanfares: a sound plus what the music does around it
    const STINGS = {
        lead:    { sfx: 'lead', duck: [0.45, 1.3], gap: 9000 },                      // you took the lead
        win:     { sfx: 'win', hush: 3600, then: 'results' },                        // you won
        place:   { sfx: 'finish', hush: 2200, then: 'results' },                     // you finished, not first
        lose:    { sfx: 'fail', hush: 2200, then: 'results' },                       // you did not finish
        qualify: { sfx: 'qualify', duck: [0.4, 1.8] },                               // Gauntlet: through to the next stage
        elim:    { sfx: 'elim', duck: [0.3, 2.6] },                                  // Gauntlet: you are out
        gtwin:   { sfx: 'gtwin', hush: 5200, then: 'results' },                      // Gauntlet: you won it all
    };
    const lastSting = {};

    const trackFor = inGame => {
        try {
            if (!inGame && typeof state !== 'undefined' && state === 'menu') return 'menu';
            const m = typeof gameMode !== 'undefined' ? gameMode : 'race';
            if (m === 'escape') return 'escape';
            if (m === 'gauntlet' || m === 'tag') return 'gauntlet';
            if (m === 'level' || m === 'parkour') return 'levels';
            return 'race';
        } catch (e) { return 'race'; }
    };

    bankFetch();                                         // the recordings start downloading at once (decoding waits for the first tap)

    return {
        play(name, arg) { try {
            const now = performance.now(), cd = COOLDOWN[name] !== undefined ? COOLDOWN[name] : (CRITICAL.has(name) ? 0 : 45);
            if (cd && now - (lastPlay[name] || -1e9) < cd) return;
            lastPlay[name] = now; lastAny = now;
            if (bank.state === 'ready') { if (playBank(bankKey(name, arg))) return; }        // the normal case: a finished recording, nothing is synthesised
            else if (bank.state !== 'failed') return;                                          // still loading (a second or less): a moment of quiet beats live synthesis
            if (active > 20 && !CRITICAL.has(name)) return;
            if (P[name]) P[name](arg);                                                          // only when the files are missing
        } catch (e) {} },
        sting(kind) { try {
            const E = STINGS[kind]; if (!E || muted) return; const now = performance.now();
            if (E.gap && now - (lastSting[kind] || -1e9) < E.gap) return; lastSting[kind] = now;
            this.play(E.sfx);
            if (E.duck) MUSIC.duck(E.duck[0], E.duck[1]);
            if (E.hush) { MUSIC.stop(); if (E.then) setTimeout(() => { if (!MUSIC.list && MUSIC.on && !muted) MUSIC.set(E.then); }, E.hush); }
        } catch (e) {} },
        get lastAny() { return lastAny; },
        toggle() { muted = !muted; try { localStorage.setItem('rr_mute', muted ? '1' : '0'); } catch (e) {} return muted; },
        get muted() { return muted; },
        setMuted(v) { muted = !!v; try { localStorage.setItem('rr_mute', muted ? '1' : '0'); } catch (e) {} },
        get sfxVol() { return sfxVol; },
        get musVol() { return musVol; },
        setSfxVol(v) { sfxVol = Math.max(0, Math.min(1, v)); try { localStorage.setItem('rr_sfxvol', sfxVol); } catch (e) {} if (sfxBus) { try { sfxBus.gain.setTargetAtTime(sfxVol, ac.currentTime, 0.02); } catch (e) { sfxBus.gain.value = sfxVol; } } },
        setMusVol(v) { musVol = Math.max(0, Math.min(1, v)); try { localStorage.setItem('rr_musvol', musVol); } catch (e) {} MUSIC.setVol(musVol); },
        unlock() { try { ctx(); bankDecode(); } catch (e) {} },
        suspend() { try { if (ac && ac.state === 'running' && ac.suspend) { const r = ac.suspend(); if (r && r.catch) r.catch(() => {}); } } catch (e) {} },      // app in the background / screen off: no sound
        trackFor,
        music: MUSIC,
        names: Object.keys(P),
        tracks: Object.keys(TRACKS),
        __use(c) { extCtx = c; ac = null; },          // tests: build the whole engine on an OfflineAudioContext
        __live() { return ac; },
        __play(name, arg) { if (P[name]) P[name](arg); },
        __bake: bakeSfx, __bakeList: () => Object.keys(P).map(n => [n, BAKE[n] || [undefined]]), __bank: bank, __bankKey: bankKey,
    };
})();
if (typeof window !== 'undefined' && window.addEventListener) {
    // Browsers only allow sound after the first tap or key press: that first gesture unlocks the engine and starts the music for wherever you are.
    let kicked = false;
    const unlockOnce = () => {
        SFX.unlock();
        if (!kicked) { kicked = true; try { SFX.music.set(SFX.trackFor()); } catch (e) {} }
    };
    window.addEventListener('pointerdown', unlockOnce, { passive: true });
    window.addEventListener('keydown', unlockOnce);
    window.addEventListener('touchend', unlockOnce, { passive: true });
    window.addEventListener('click', unlockOnce);
    document.addEventListener('visibilitychange', () => { if (document.hidden) SFX.suspend(); else SFX.unlock(); });
    window.addEventListener('pagehide', () => SFX.suspend());
    // a soft tick on every button that does not make a sound of its own
    document.addEventListener('click', e => {
        const b = e.target && e.target.closest && e.target.closest('button, [role="button"]');
        if (!b || b.disabled) return;
        if (performance.now() - SFX.lastAny < 80) return;
        SFX.play('tap');
    });
}
