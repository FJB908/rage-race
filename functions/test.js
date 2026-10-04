'use strict';
// node test.js : checks the Ranked handlers against an in-memory store (no Firebase needed)
const assert = require('assert');
const H = require('./handlers'), R = require('./rank');
const mem = () => { const m = new Map(); return { get: async p => m.has(p) ? JSON.parse(JSON.stringify(m.get(p))) : null, set: async (p, d) => { m.set(p, JSON.parse(JSON.stringify(d))); }, m }; };
const T0 = Date.UTC(2026, 9, 5, 12);
const rejects = async (fn, code) => { try { await fn(); } catch (e) { assert.strictEqual(e.code, code, 'expected ' + code + ' got ' + e.code); return; } assert.fail('expected reject ' + code); };
(async () => {
    const s = mem();
    // first contact adopts a capped record
    let st = await H.start(s, 'u1', { rk:{ mmr:2800, placed:5, matches:50, wins:30, sm:50 } }, T0);
    assert.ok(st.rk.mmr <= 1500, 'adopt cap');
    // a normal win
    let r = await H.finish(s, 'u1', { id:st.id, place:1, finishTime:40, ratings:[st.rk.mmr + 90, st.rk.mmr, st.rk.mmr - 90] }, T0 + 42000);
    assert.ok(r.dm > 0 && r.rk.wins === st.rk.wins + 1, 'win gives rating');
    // cannot finish twice, nor with someone else's id
    await rejects(() => H.finish(s, 'u1', { id:st.id, place:1, finishTime:40, ratings:[1, 1, 1] }, T0 + 50000), 'already-finished');
    const st2 = await H.start(s, 'u1', {}, T0 + 60000);
    await rejects(() => H.finish(s, 'u2', { id:st2.id, place:1, finishTime:30 }, T0 + 95000), 'no-match');
    // too fast / impossible time / bad lobby / void
    await rejects(() => H.finish(s, 'u1', { id:st2.id, place:1, finishTime:5, ratings:[1000, 1000, 1000] }, T0 + 62000), 'too-fast');
    await rejects(() => H.finish(s, 'u1', { id:st2.id, place:1, finishTime:90, ratings:[1000, 1000, 1000] }, T0 + 60000 + 40000), 'bad-time');
    await rejects(() => H.finish(s, 'u1', { id:st2.id, place:1, finishTime:30, ratings:[2500, 2500, 2500] }, T0 + 60000 + 40000), 'bad-lobby');
    await rejects(() => H.finish(s, 'u1', { id:st2.id, place:9, finishTime:30 }, T0 + 60000 + 40000), 'bad-place');
    // a forfeit is allowed at any moment and always costs rating
    const f = await H.finish(s, 'u1', { id:st2.id, place:4, forfeit:true, ratings:[1000, 1000, 1000] }, T0 + 61000);
    assert.ok(f.dm <= -12 && f.rpd <= 0, 'forfeit loses');
    // rate limit
    for (let i = 0; i < 40; i++) { const x = await H.start(s, 'u3', { rk:{ mmr:1000 } }, T0 + i * 1000); try { await H.finish(s, 'u3', { id:x.id, place:2, forfeit:true, ratings:[1000, 1000, 1000] }, T0 + i * 1000 + 500); } catch (e) { assert.strictEqual(e.code, 'rate-limit'); assert.ok(i >= 30); break; } }
    // a new season resets claims-free fields and pulls rating to the middle
    const s2 = mem(); const a = await H.start(s2, 'u9', { rk:{ mmr:1400, placed:5, matches:20, sm:20 } }, T0);
    const nxt = await H.start(s2, 'u9', {}, T0 + 31 * 864e5);
    assert.ok(nxt.rk.season === R.seasonAt(T0) + 1 && nxt.rk.mmr < 1400 && nxt.rk.mmr > 1100, 'soft reset');
    console.log('all server tests passed');
})().catch(e => { console.error(e); process.exit(1); });
