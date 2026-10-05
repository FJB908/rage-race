// Renders every sound effect and every music track of src/audio/sfx.js to finished ogg files in src/audio/bank/.
// The game then only PLAYS recordings (nothing is synthesised while you play), so the sound can never crackle on a busy phone.
// Run it after changing sounds or music:  node tools/bake-audio.js   (needs playwright + ffmpeg)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..'), out = path.join(root, 'src', 'audio', 'bank'), tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bake-'));
const SFX_SR = 32000, GAP = 0.06, MASTER = 0.5;       // MASTER: the bank is baked 6 dB down (headroom for big stacked sounds); the player lifts it back with a x2 gain
const only = process.argv[2];                         // optional: bake just one track or sfx name
function encode(pcm, sr, file, q) {
    const raw = path.join(tmp, path.basename(file) + '.raw'); fs.writeFileSync(raw, pcm);
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(sr), '-ac', '1', '-i', raw, '-c:a', 'libvorbis', '-q:a', String(q), file]);
    return fs.statSync(file).size;
}
(async () => {
    fs.mkdirSync(out, { recursive: true });
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('about:blank'); await p.addScriptTag({ content: fs.readFileSync(path.join(root, 'src/audio/sfx.js'), 'utf8') });
    // ---- music
    const tracks = await p.evaluate(() => SFX.tracks);
    let total = 0;
    for (const name of tracks) {
        if (only && only !== name && only !== 'music') continue;
        const b64 = await p.evaluate(async n => {
            const buf = await SFX.music.__build(n), d = buf.getChannelData(0), i16 = new Int16Array(d.length);
            for (let i = 0; i < d.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767)));
            let s = ''; const u = new Uint8Array(i16.buffer); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s);
        }, name);
        const size = encode(Buffer.from(b64, 'base64'), 22050, path.join(out, 'music-' + name + '.ogg'), 4); total += size;
        console.log('music', name.padEnd(10), (Buffer.from(b64, 'base64').length / 2 / 22050).toFixed(1) + ' s', (size / 1024).toFixed(0) + ' KB');
    }
    // ---- sound effects (one sprite file, every sound and variant after each other with a short gap)
    if (!only || only === 'sfx' || !tracks.includes(only)) {
        const list = await p.evaluate(() => SFX.__bakeList()), items = {}, chunks = []; let at = 0, peakAll = 0;
        for (const [name, args] of list) for (const arg of args) {
            const key = args[0] === undefined ? name : name + ':' + (name === 'jump' ? Math.round(arg * 5) : name === 'tick' ? Math.round(arg * 7) : arg);
            const r = await p.evaluate(async ([n, a, sr, master]) => {
                const buf = await SFX.__bake(n, a, sr, 6.5), d = buf.getChannelData(0); let last = 0, pk = 0;
                for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > 0.0004) last = i; if (v > pk) pk = v; }
                const len = Math.min(d.length, last + Math.round(0.06 * sr)), i16 = new Int16Array(len), fade = Math.round(0.02 * sr);
                for (let i = 0; i < len; i++) { let v = d[i] * master; if (i > len - fade) v *= (len - i) / fade; i16[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767))); }
                let s = ''; const u = new Uint8Array(i16.buffer); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
                return { b64: btoa(s), len, pk };
            }, [name, arg, SFX_SR, MASTER]);
            const pcm = Buffer.from(r.b64, 'base64'); items[key] = [+(at / SFX_SR).toFixed(4), +(r.len / SFX_SR).toFixed(4)];
            chunks.push(pcm, Buffer.alloc(Math.round(GAP * SFX_SR) * 2)); at += r.len + Math.round(GAP * SFX_SR); peakAll = Math.max(peakAll, r.pk * MASTER);
            if (r.pk * MASTER > 0.98) console.log('  WARNING: ' + key + ' peaks at ' + (r.pk * MASTER).toFixed(2) + ' even after the -6 dB master');
        }
        const size = encode(Buffer.concat(chunks), SFX_SR, path.join(out, 'sfx.ogg'), 5); total += size;
        fs.writeFileSync(path.join(out, 'sfx.json'), JSON.stringify({ sr: SFX_SR, items }));
        console.log('sfx', Object.keys(items).length + ' sounds,', (at / SFX_SR).toFixed(1) + ' s,', (size / 1024).toFixed(0) + ' KB, loudest peak ' + peakAll.toFixed(2));
    }
    console.log('total', (total / 1024).toFixed(0) + ' KB', errs.length ? errs : '');
    await b.close(); fs.rmSync(tmp, { recursive: true, force: true });
})();
