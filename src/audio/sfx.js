// SOUND: calm, warm, satisfying. Everything is synthesised (no audio files).
//  * SFX: soft marimba / kalimba / vibraphone / felt sounds, all tuned to the same pentatonic C so rapid sounds always blend.
//  * MUSIC: instrumental jazz-meets-classical tracks (walking bass, brushes, rhodes, vibraphone, flute, harpsichord, strings, piano).
//    Tracks: menu (ballad), race (baroque swing), escape (nocturne), gauntlet (jazz waltz), levels (bossa).
// Loaded BEFORE game.js. API: SFX.play(name, arg), SFX.music.set(track|null) / stop / toggle / setVol, SFX.toggle / setMuted / setSfxVol / setMusVol / unlock.
const SFX = (() => {
    let ac = null, comp = null, sfxBus = null, musBus = null, verbIn = null, musVerb = null, dly = null, noiseBuf = null, muted = false, extCtx = null;
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
    function track(n) { active++; n.onended = () => { active--; }; }

    function ctx() {
        if (!ac) {
            const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
            if (!extCtx && !AC) return null;
            if (extCtx) ac = extCtx; else { try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { ac = new AC(); } }
            comp = ac.createGain(); comp.gain.value = 1.25;
            try {                                       // soft saturation instead of a (laggy) compressor: loud pile-ups round off instead of crackling
                const shaper = ac.createWaveShaper(), cv = new Float32Array(4096);
                for (let i = 0; i < 4096; i++) { const x = i / 2047.5 - 1; cv[i] = Math.tanh(x * 1.1) / Math.tanh(1.1); }
                shaper.curve = cv; shaper.oversample = 'none';
                const out = ac.createGain(); out.gain.value = 0.92; comp.connect(shaper); shaper.connect(out); out.connect(ac.destination);
            } catch (e) { comp.connect(ac.destination); }
            sfxBus = ac.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(comp);
            musBus = ac.createGain(); musBus.gain.value = 0.0001; musBus.connect(comp);
            // two reverbs: a short bright room for the effects and a longer, darker hall for the music
            const makeVerb = (secs, damp, level) => {
                try {
                    const len = Math.floor(ac.sampleRate * secs), ir = ac.createBuffer(2, len, ac.sampleRate);
                    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const x = 1 - i / len; lp += (((Math.random() * 2 - 1) * x * x * x) - lp) * damp; d[i] = lp * 2.2; } }
                    const cv = ac.createConvolver(); cv.buffer = ir; const inG = ac.createGain(), outG = ac.createGain(); outG.gain.value = level;
                    inG.connect(cv); cv.connect(outG); return { inG, outG };
                } catch (e) { return null; }
            };
            const v1 = makeVerb(1.1, 0.5, 0.34); if (v1) { verbIn = v1.inG; v1.outG.connect(comp); } else verbIn = comp;
            const v2 = makeVerb(2.4, 0.22, 0.5); if (v2) { musVerb = v2.inG; v2.outG.connect(musBus); }
            try {                                       // gentle echo for the music (dotted eighth)
                dly = ac.createDelay(1.0); dly.delayTime.value = 0.36;
                const fb = ac.createGain(); fb.gain.value = 0.28; const dOut = ac.createGain(); dOut.gain.value = 0.24;
                const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
                dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(dOut); dOut.connect(musBus);
            } catch (e) { dly = null; }
            const n = Math.floor(ac.sampleRate * 1.5); noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
            const nd = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) nd[i] = Math.random() * 2 - 1;
        }
        if (ac.state === 'suspended' && ac.resume) { try { const r = ac.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
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
        envelope(g, t0, (o.v || 0.2) / detunes.length, o.a || 0.004, dur, rel, o.hold);
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
        const g = A.createGain(); envelope(g, t0, o.v || 0.2, o.a || 0.003, dur, o.r || 0.04);
        src.connect(f); f.connect(g); g.connect(isMus ? musBus : sfxBus);
        if (isMus) send(g, o.verb, musVerb); else send(g, o.verb, verbIn);
        track(src); src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + (o.r || 0.04) + 0.02);
    }

    /* ================================================================== instruments (shared by SFX and music) ==== */
    // each takes (frequency, o) where o = { v: volume, t: length, at/when: start, bus: 'mus' for music, verb, echo }
    const base = o => ({ bus: o.bus, when: o.when, at: o.at, verb: o.verb, echo: o.echo });
    const I = {
        // marimba / kalimba: a round fundamental, a quick bright 4th partial and a tiny wooden tick
        pluck(f, o = {}) { const b = base(o), t = o.t || 0.55, v = o.v || 0.16;
            voice(Object.assign({ f, t, v, a: 0.003, r: 0.08 }, b));
            voice(Object.assign({ f: f * 4, t: 0.07, v: v * 0.22, a: 0.002, r: 0.03 }, b, { verb: 0 }));
            noise(Object.assign({ type: 'bandpass', f: Math.min(5000, f * 3), q: 1.6, t: 0.02, v: v * 0.22, a: 0.001, r: 0.01 }, { bus: o.bus, when: o.when, at: o.at })); },
        // vibraphone: bell-like, slow decay, slight chorus
        vibe(f, o = {}) { const b = base(o), t = o.t || 1.3, v = o.v || 0.12;
            voice(Object.assign({ f, t, v, a: 0.004, r: 0.2 }, b)); voice(Object.assign({ f: f * 1.004, t, v: v * 0.6, a: 0.004, r: 0.2 }, b, { verb: 0 }));
            voice(Object.assign({ f: f * 4, t: 0.18, v: v * 0.18, a: 0.002, r: 0.05 }, b, { verb: 0 })); },
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
            voice(Object.assign({ f: f * 2, t: t * 0.6, v: v * 0.35, a: 0.005, r: 0.06 }, b));
            noise(Object.assign({ type: 'lowpass', f: 700, t: 0.03, v: v * 0.25, a: 0.002, r: 0.02 }, b)); },
        // harpsichord: plucked, glassy, short
        harpsi(f, o = {}) { const b = base(o), t = o.t || 0.4, v = o.v || 0.07;
            voice(Object.assign({ type: 'sawtooth', f, t, v, a: 0.002, r: 0.06, filter: { f: 3400, f2: 1000, time: 0.25 } }, b));
            voice(Object.assign({ f: f * 2, t: t * 0.5, v: v * 0.4, a: 0.002, r: 0.04 }, b, { verb: 0 }));
            noise(Object.assign({ type: 'highpass', f: 5000, t: 0.012, v: v * 0.25, a: 0.001, r: 0.01 }, { bus: o.bus, when: o.when, at: o.at })); },
        // nylon guitar
        guitar(f, o = {}) { const b = base(o), t = o.t || 0.5, v = o.v || 0.09;
            voice(Object.assign({ type: 'triangle', f, t, v, a: 0.003, r: 0.08, filter: { f: 2600, f2: 1100, time: t } }, b));
            voice(Object.assign({ f: f * 2, t: t * 0.5, v: v * 0.3, a: 0.003, r: 0.05 }, b, { verb: 0 })); },
        // flute: breathy sine with vibrato
        flute(f, o = {}) { const b = base(o), t = o.t || 0.6, v = o.v || 0.09;
            voice(Object.assign({ f, t, v, a: 0.07, r: 0.18, vib: f * 0.006, vibRate: 5.1, hold: 0.9 }, b));
            voice(Object.assign({ f: f * 2, t, v: v * 0.12, a: 0.09, r: 0.15 }, b, { verb: 0 }));
            noise(Object.assign({ type: 'bandpass', f: Math.min(6000, f * 3), q: 2, t: Math.min(t, 0.5), v: v * 0.08, a: 0.05, r: 0.1 }, { bus: o.bus, when: o.when, at: o.at, verb: 0 })); },
        // strings: slow, soft, detuned
        strings(f, o = {}) { const b = base(o), t = o.t || 2.4, v = o.v || 0.035;
            voice(Object.assign({ type: 'sawtooth', f, t, v, a: Math.min(0.9, t * 0.35), r: 0.7, unison: 7, filter: { f: 1000, q: 0.5 }, vib: f * 0.003, vibRate: 4.6 }, b)); },
        // warm cello for the dark tracks
        cello(f, o = {}) { const b = base(o), t = o.t || 1, v = o.v || 0.07;
            voice(Object.assign({ type: 'sawtooth', f, t, v, a: 0.12, r: 0.25, filter: { f: 1100, q: 0.6 }, vib: f * 0.005, vibRate: 5.3, hold: 0.9 }, b)); },
    };
    // percussion: brushes and a feathered kick, always soft
    const D = {
        ride(w, v = 1) { noise({ bus: 'mus', when: w, type: 'highpass', f: 6500, t: 0.12, v: 0.045 * v, a: 0.002, r: 0.12, q: 0.5 }); },
        chick(w, v = 1) { noise({ bus: 'mus', when: w, type: 'highpass', f: 8000, t: 0.03, v: 0.06 * v, a: 0.001, r: 0.03, q: 0.5 }); },
        kick(w, v = 1) { voice({ bus: 'mus', when: w, f: 95, f2: 48, glide: 0.1, t: 0.16, v: 0.1 * v, r: 0.06 }); },
        brush(w, v = 1) { noise({ bus: 'mus', when: w, type: 'bandpass', f: 2600, t: 0.16, v: 0.05 * v, a: 0.012, r: 0.1, q: 0.6 }); },
        rim(w, v = 1) { noise({ bus: 'mus', when: w, type: 'bandpass', f: 1800, t: 0.02, v: 0.06 * v, a: 0.001, r: 0.02, q: 3 }); voice({ bus: 'mus', when: w, f: 820, t: 0.03, v: 0.04 * v, a: 0.001, r: 0.02 }); },
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
        chain() { [0, 0.07, 0.15].forEach((d, i) => I.pluck(1500 + i * 210, { at: d, t: 0.16, v: 0.05, verb: 0.2 })); noise({ type: 'highpass', f: 5000, t: 0.2, v: 0.025 }); },
        quake() { noise({ type: 'lowpass', f: 260, f2: 70, q: 1, t: 1, v: 0.25, a: 0.06, verb: 0.2 }); voice({ f: 52, f2: 34, t: 0.9, v: 0.2, a: 0.03, vib: 5, vibRate: 11 }); },
        shield() { P.pop(); [0, 4, 7, 11].forEach((s, i) => voice({ f: mtof(67 + s), t: 0.8, v: 0.06, a: 0.08, at: i * 0.04, verb: 0.5 })); bell(mtof(91), { at: 0.2, t: 0.9, v: 0.05 }); },
        block() { I.pluck(2093, { t: 0.35, v: 0.09, verb: 0.35 }); I.vibe(1568, { t: 0.5, v: 0.05, verb: 0.35 }); },
        wind() { P.pop(); noise({ type: 'bandpass', f: 380, f2: 1500, q: 1.4, t: 1, v: 0.1, a: 0.3, verb: 0.3 }); noise({ type: 'bandpass', f: 800, f2: 450, q: 1.8, t: 0.8, v: 0.045, at: 0.25, a: 0.2 }); },
        ufo() { P.pop(); voice({ f: 480, f2: 760, t: 1.5, v: 0.08, a: 0.15, vib: 40, vibRate: 7, glide: 1.4, verb: 0.4 }); voice({ type: 'triangle', f: 120, t: 1.4, v: 0.04, a: 0.3, filter: { f: 450 } }); },
        // rewards
        coin() { I.pluck(mtof(79), { t: 0.14, v: 0.1, verb: 0.15 }); I.vibe(mtof(84), { at: 0.06, t: 0.5, v: 0.09, verb: 0.3 }); },
        combo() { [0, 1, 2, 3].forEach(i => I.pluck(mtof(pent(72, i + 1)), { at: i * 0.05, t: 0.3, v: 0.07, verb: 0.2 })); },
        star(i = 0) { I.vibe(mtof(pent(72, 1 + (i % 3) * 2)), { t: 0.9, v: 0.11, verb: 0.35 }); I.pluck(mtof(pent(84, 1 + (i % 3) * 2)), { t: 0.3, v: 0.04 }); },
        claim() { I.pluck(mtof(76), { t: 0.2, v: 0.09, verb: 0.2 }); [0, 1, 2].forEach(i => I.vibe(mtof(pent(79, i * 2)), { at: 0.07 + i * 0.07, t: 0.9, v: 0.08, verb: 0.35 })); },
        buy() { I.pluck(mtof(72), { t: 0.15, v: 0.1 }); I.pluck(mtof(79), { at: 0.07, t: 0.16, v: 0.1 }); I.vibe(mtof(84), { at: 0.15, t: 0.9, v: 0.09, verb: 0.35 }); noise({ type: 'highpass', f: 7000, t: 0.15, v: 0.02, at: 0.12 }); },
        equip() { noise({ type: 'bandpass', f: 600, f2: 2400, t: 0.12, v: 0.045, a: 0.02, verb: 0.2 }); I.pluck(mtof(81), { at: 0.06, t: 0.3, v: 0.09, verb: 0.3 }); },
        levelup() { [0, 2, 4, 5, 7].forEach(i => I.vibe(mtof(pent(67, i)), { at: i * 0.08, t: 1.1, v: 0.08, verb: 0.4 })); [60, 64, 67, 71].forEach(m => I.piano(mtof(m), { at: 0.45, t: 1.2, v: 0.07, verb: 0.4 })); },
        // chest
        knock(n = 0) { const k = Math.min(6, n); voice({ f: 190 + k * 18, f2: 110 + k * 8, t: 0.1, v: 0.22 }); noise({ type: 'bandpass', f: 1400 + k * 150, q: 2, t: 0.04, v: 0.1 }); I.pluck(mtof(pent(55, k)), { t: 0.25, v: 0.07, verb: 0.2 }); },
        tierup() { [0, 1, 2, 3, 4, 5].forEach(i => I.vibe(mtof(pent(67, i + 1)), { at: i * 0.06, t: 1, v: 0.07, verb: 0.4 })); noise({ type: 'bandpass', f: 800, f2: 5000, t: 0.45, v: 0.05, a: 0.1, verb: 0.3 }); },
        open() { [48, 55, 59, 64, 67, 71, 74].forEach((m, i) => I.piano(mtof(m), { at: i * 0.012, t: 1.8, v: 0.06, verb: 0.5 }));
            [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => I.vibe(mtof(pent(76, i)), { at: 0.12 + i * 0.05, t: 1.2, v: 0.06, verb: 0.45 }));
            voice({ f: 70, f2: 45, t: 0.5, v: 0.22 }); noise({ type: 'highpass', f: 6000, t: 0.7, v: 0.03, a: 0.1, verb: 0.4 }); },
        // feedback
        fail() { [76, 74, 72, 69].forEach((m, i) => I.epiano(mtof(m), { at: i * 0.2, t: i === 3 ? 1.2 : 0.5, v: 0.09, verb: 0.35 })); },
        error() { voice({ f: 196, t: 0.12, v: 0.1, filter: { f: 700 }, verb: 0.15 }); voice({ f: 175, t: 0.18, v: 0.1, at: 0.11, filter: { f: 700 }, verb: 0.15 }); },
        // interface
        count() { voice({ f: 880, t: 0.05, v: 0.09, a: 0.002, r: 0.03 }); noise({ type: 'bandpass', f: 2400, q: 3, t: 0.015, v: 0.05, a: 0.001 }); },
        tap() { voice({ f: 1250, f2: 1000, t: 0.035, v: 0.045, a: 0.002, r: 0.02 }); },
        select() { I.pluck(mtof(81), { t: 0.18, v: 0.07, verb: 0.15 }); },
        back() { I.pluck(mtof(72), { t: 0.18, v: 0.06, verb: 0.15 }); },
        toggle() { voice({ f: 700, f2: 950, glide: 0.04, t: 0.06, v: 0.08, a: 0.002 }); },
        pop() { voice({ f: 1400, f2: 700, t: 0.045, v: 0.08, a: 0.002, r: 0.02 }); },
        whoosh() { noise({ type: 'bandpass', f: 300, f2: 2200, q: 0.5, t: 0.25, v: 0.05, a: 0.07, verb: 0.2 }); },
        // match flow
        go() { [60, 64, 67, 71, 74].forEach((m, i) => I.piano(mtof(m), { at: i * 0.015, t: 1.1, v: 0.07, verb: 0.35 })); I.vibe(mtof(88), { at: 0.08, t: 1, v: 0.06, verb: 0.4 }); },
        finish() { [0, 2, 4, 5, 7, 9].forEach(i => I.vibe(mtof(pent(60, i)), { at: i * 0.07, t: 1.2, v: 0.085, verb: 0.4 }));
            [48, 55, 59, 64, 67].forEach(m => I.piano(mtof(m), { at: 0.5, t: 1.6, v: 0.07, verb: 0.45 })); noise({ type: 'highpass', f: 6500, t: 0.9, v: 0.025, a: 0.2, at: 0.4, verb: 0.3 }); },
        shatter() { noise({ type: 'highpass', f: 3500, t: 0.22, v: 0.09, verb: 0.3 }); for (let i = 0; i < 4; i++) I.pluck(mtof(pent(84, i + Math.floor(Math.random() * 3))), { at: i * 0.035, t: 0.25, v: 0.045, verb: 0.35 }); },
    };
    const COOLDOWN = { coin: 45, land: 70, pickup: 90, item: 70, combo: 120, shatter: 150, chain: 200, block: 200, jump: 40, tap: 60, knock: 30 };
    const CRITICAL = new Set(['jump', 'land', 'finish', 'go', 'count', 'fail', 'boost', 'stumble', 'open', 'knock']);
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

    const MUSIC = (() => {
        let musicOn = true; try { musicOn = localStorage.getItem('rr_music') !== '0'; } catch (e) {}
        let cur = null, timer = null, step = 0, nextTime = 0, loop = 0, seed = 1;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        const human = (w, ms = 7) => w + (rnd() - 0.5) * ms / 1000;
        // a walking line: root, a chord tone, another, then a half step into the next root
        function walk(T, bi, beat) {
            const bar = T.bars[bi], nxt = T.bars[(bi + 1) % T.bars.length], [t3, t5] = QUAL[bar.q] || QUAL.maj;
            const pat = [bar.r, bar.r + (loop % 2 ? t5 : t3), bar.r + (loop % 2 ? t3 : t5), nxt.r + (nxt.r > bar.r ? -1 : 1)];
            let n = pat[beat]; while (n < 36) n += 12; while (n > 55) n -= 12; return n;
        }
        function bars(T) { return T.bars.length; }
        function scheduleUntil(horizon) {
            const A = ctx(); if (!A || !cur) return;
            const T = TRACKS[cur], s8 = 60 / T.bpm / 2, spb = T.spb, nb = bars(T);
            while (nextTime < horizon) {
                const bi = Math.floor(step / spb) % nb, i = step % spb, bar = T.bars[bi];
                if (step > 0 && step % (spb * nb) === 0) loop++;
                const half = bi < nb / 2 ? 0 : 1;
                const off = (spb === 8 && i % 2 === 1) ? T.swing * s8 : 0;
                const w = human(nextTime + off, 6);
                const vel = 0.85 + rnd() * 0.3;
                const mf = nm2(bar);

                // ---- drums
                if (T.drums === 'ballad') { if ([0, 2, 3, 4, 6, 7].includes(i)) D.ride(w, 0.7 * vel); if (i === 2 || i === 6) D.chick(w, 0.8); if (i % 2 === 0) D.kick(w, 0.4); }
                else if (T.drums === 'swing') { if ([0, 2, 3, 4, 6, 7].includes(i)) D.ride(w, vel); if (i === 2 || i === 6) D.chick(w, vel); if (i % 2 === 0) D.kick(w, 0.5); if (i === 5 && rnd() < 0.3) D.brush(w, 0.6); }
                else if (T.drums === 'soft') { if (i % 2 === 0) D.ride(w, 0.55); if (i === 0 || i === 4) D.kick(w, 0.55); if (i === 2 || i === 6) D.rim(w, 0.6); }
                else if (T.drums === 'waltz') { if (i % 2 === 0) D.ride(w, 0.8 * vel); if (i === 0) D.kick(w, 0.55); if (i === 2 || i === 4) D.chick(w, 0.6); }
                else if (T.drums === 'bossa') { D.chick(w, 0.45 * vel); if ([0, 3, 4, 7].includes(i)) D.kick(w, 0.35); if ([1, 3, 6].includes(i)) D.rim(w, 0.55); }

                // ---- bass
                if (T.bass === 'walk' && i % 2 === 0) I.bass(mtof(walk(T, bi, i / 2)), { bus: 'mus', when: w, v: 0.2 * vel, t: s8 * 1.7 });
                else if (T.bass === 'pedal' && i % 4 === 0) I.bass(mtof(bar.r + (i === 4 ? 7 : 0)), { bus: 'mus', when: w, v: 0.2, t: s8 * 3 });
                else if (T.bass === 'waltz' && i === 0) I.bass(mtof(bar.r), { bus: 'mus', when: w, v: 0.22, t: s8 * 2.2 });
                else if (T.bass === 'bossa') { if (i === 0 || i === 4) I.bass(mtof(bar.r), { bus: 'mus', when: w, v: 0.2, t: s8 * 2.4 }); if (i === 3 || i === 7) I.bass(mtof(bar.r + 7), { bus: 'mus', when: w, v: 0.16, t: s8 * 1.6 }); }

                // ---- harmony
                if (T.comp === 'epiano') {                      // ballad: long chord, a small answer
                    if (i === 0) bar.v.forEach((m, k) => I.epiano(mtof(m), { bus: 'mus', when: w + k * 0.012, v: 0.05, t: s8 * 6, verb: 0.4 }));
                    if (i === 5) bar.v.slice(1).forEach((m, k) => I.epiano(mtof(m), { bus: 'mus', when: w + k * 0.01, v: 0.028, t: s8 * 2, verb: 0.4 }));
                } else if (T.comp === 'harpsi') {               // Bach-style figuration, one arpeggio note per eighth
                    const idx = [0, 1, 2, 3, 2, 1, 2, 3][i]; I.harpsi(mtof(bar.a[idx]), { bus: 'mus', when: w, v: 0.062 * vel, t: s8 * 1.4, verb: 0.3, echo: 0.2 });
                    if (i === 0) I.harpsi(mtof(bar.a[0] - 12), { bus: 'mus', when: w, v: 0.05, t: s8 * 2, verb: 0.3 });
                } else if (T.comp === 'piano') {
                    if (T.spb === 6) { if (i === 2 || i === 4) bar.v.forEach((m, k) => I.piano(mtof(m), { bus: 'mus', when: w + k * 0.008, v: 0.05 * vel, t: s8 * 1.6, verb: 0.35 })); }
                    else { const idx = [0, 1, 2, 3, 2, 1, 2, 3][i], a = bar.a; if (a) I.piano(mtof(a[idx % a.length]), { bus: 'mus', when: w, v: 0.055 * vel, t: s8 * 2.2, verb: 0.45 });
                           if (i === 0) bar.v.forEach(m => I.piano(mtof(m - 12), { bus: 'mus', when: w, v: 0.035, t: s8 * 6, verb: 0.5 })); }
                } else if (T.comp === 'guitar') {               // bossa comping on 1, the & of 2 and 4
                    if (i === 0 || i === 3 || i === 6) bar.v.forEach((m, k) => I.guitar(mtof(m), { bus: 'mus', when: w + k * 0.014, v: 0.05 * vel, t: s8 * 1.5, verb: 0.25 }));
                }
                if (T.pad && i === 0 && (T.spb === 8 ? true : true)) {   // strings hold the chord, very quietly
                    const tones = bar.v || bar.a.map(x => x); (tones.slice(0, 3)).forEach(m => I.strings(mtof(m - (m > 70 ? 12 : 0)), { bus: 'mus', when: w, v: 0.022, t: s8 * spb * 0.95 }));
                }

                // ---- melody (the second half of the form uses the second instrument)
                for (const [s, midi, len] of bar.m || []) if (s === i) {
                    const inst = T.mel[half], dur = Math.max(0.25, s8 * len * 0.95), lvl = (inst === 'cello' ? 0.08 : inst === 'flute' ? 0.085 : 0.1) * vel;
                    I[inst](mtof(midi), { bus: 'mus', when: w, v: lvl, t: dur, verb: 0.5, echo: 0.3 });
                }
                step++; nextTime += s8;
            }
        }
        const nm2 = b => b;
        function level(to) { const A = ctx(); if (!A) return; const g = musBus.gain;
            try { g.cancelScheduledValues(A.currentTime); } catch (e) {}
            g.setValueAtTime(Math.max(0.0001, g.value), A.currentTime); g.linearRampToValueAtTime(Math.max(0.0001, to), A.currentTime + 0.9); }
        const tick = () => { const A = ac; if (A) scheduleUntil(A.currentTime + 0.5); };
        return {
            get on() { return musicOn; },
            get track() { return cur; },
            set(name) {
                if (!musicOn || muted || !name || !TRACKS[name]) { this.stop(); return; }
                const A = ctx(); if (!A) return;
                if (cur === name && timer) return;
                cur = name; step = 0; loop = 0; seed = 7 + name.length * 13; nextTime = A.currentTime + 0.15;
                level(musVol * 0.42);
                if (!timer) timer = setInterval(tick, 100);
                tick();
            },
            stop() { if (timer) { clearInterval(timer); timer = null; } cur = null; if (musBus) level(0); },
            setVol(v) { if (cur && musBus) level(v * 0.42); },
            toggle() { musicOn = !musicOn; try { localStorage.setItem('rr_music', musicOn ? '1' : '0'); } catch (e) {}
                if (!musicOn) this.stop(); return musicOn; },
            // offline rendering (tests): schedule `seconds` of a track into the current context at once
            __render(name, seconds) { cur = name; step = 0; loop = 0; seed = 7 + name.length * 13; nextTime = 0.1; level(0.42 * 0.5); scheduleUntil(seconds); cur = null; },
        };
    })();

    const trackFor = inGame => {
        try {
            if (!inGame && typeof state !== 'undefined' && state === 'menu') return 'menu';
            const m = typeof gameMode !== 'undefined' ? gameMode : 'race';
            if (m === 'escape') return 'escape';
            if (m === 'gauntlet') return 'gauntlet';
            if (m === 'level' || m === 'parkour') return 'levels';
            return 'race';
        } catch (e) { return 'race'; }
    };

    return {
        play(name, arg) { try {
            const now = performance.now(), cd = COOLDOWN[name] !== undefined ? COOLDOWN[name] : (CRITICAL.has(name) ? 0 : 45);
            if (cd && now - (lastPlay[name] || -1e9) < cd) return;
            if (active > 28 && !CRITICAL.has(name)) return;
            lastPlay[name] = now; lastAny = now;
            if (P[name]) P[name](arg);
        } catch (e) {} },
        get lastAny() { return lastAny; },
        toggle() { muted = !muted; try { localStorage.setItem('rr_mute', muted ? '1' : '0'); } catch (e) {} return muted; },
        get muted() { return muted; },
        setMuted(v) { muted = !!v; try { localStorage.setItem('rr_mute', muted ? '1' : '0'); } catch (e) {} },
        get sfxVol() { return sfxVol; },
        get musVol() { return musVol; },
        setSfxVol(v) { sfxVol = Math.max(0, Math.min(1, v)); try { localStorage.setItem('rr_sfxvol', sfxVol); } catch (e) {} if (sfxBus) { try { sfxBus.gain.setTargetAtTime(sfxVol, ac.currentTime, 0.02); } catch (e) { sfxBus.gain.value = sfxVol; } } },
        setMusVol(v) { musVol = Math.max(0, Math.min(1, v)); try { localStorage.setItem('rr_musvol', musVol); } catch (e) {} MUSIC.setVol(musVol); },
        unlock() { try { ctx(); } catch (e) {} },
        trackFor,
        music: MUSIC,
        names: Object.keys(P),
        tracks: Object.keys(TRACKS),
        __use(c) { extCtx = c; ac = null; },          // tests: build the whole engine on an OfflineAudioContext
        __play(name, arg) { if (P[name]) P[name](arg); },
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
    document.addEventListener('visibilitychange', () => { if (!document.hidden) SFX.unlock(); });
    // a soft tick on every button that does not make a sound of its own
    document.addEventListener('click', e => {
        const b = e.target && e.target.closest && e.target.closest('button, [role="button"]');
        if (!b || b.disabled) return;
        if (performance.now() - SFX.lastAny < 80) return;
        SFX.play('tap');
    });
}
