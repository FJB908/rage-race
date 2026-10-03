'use strict';
// The two Ranked calls, written against a tiny store { get(path), set(path, data) } so they can be tested without Firebase.
const R = require('./rank');
const MIN_RACE_S = 18;               // nobody can climb the track faster than this (the bot-free fast-sim record is far above it)
const MAX_RACE_S = 400;              // a match older than this is void
const MATCH_WINDOW = 450;            // the opponents' average rating must be near the player's (matchmaking window)
const RATING_MIN = 600, RATING_MAX = 2500;
const MAX_FINISHES_PER_HOUR = 30;

class Reject extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }

async function start(store, uid, data, now) {
    if (!uid) throw new Reject('unauthenticated');
    let doc = await store.get('ranked/' + uid);
    if (!doc) doc = { rk:R.adopt(data && data.rk, now), starts:[], created:now };
    const rk = R.ensureSeason(doc.rk, now);
    const id = uid.slice(0, 6) + '-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    await store.set('matches/' + id, { uid, t0:now, open:true });
    doc.rk = rk; doc.pending = id;
    await store.set('ranked/' + uid, doc);
    return { id, rk:R.pick(rk) };
}

async function finish(store, uid, data, now) {
    if (!uid) throw new Reject('unauthenticated');
    data = data || {};
    const doc = await store.get('ranked/' + uid), m = await store.get('matches/' + String(data.id));
    if (!doc || !m || m.uid !== uid) throw new Reject('no-match');
    if (!m.open) throw new Reject('already-finished');
    const place = Math.round(+data.place), forfeit = !!data.forfeit, elapsed = (now - m.t0) / 1000;
    if (!(place >= 1 && place <= 4)) throw new Reject('bad-place');
    if (elapsed > MAX_RACE_S) { await store.set('matches/' + data.id, Object.assign({}, m, { open:false, void:true })); throw new Reject('expired'); }
    if (!forfeit) {
        if (elapsed < MIN_RACE_S) throw new Reject('too-fast');
        if (!(+data.finishTime >= MIN_RACE_S - 2 && +data.finishTime <= elapsed + 3)) throw new Reject('bad-time');
    }
    const recent = (doc.finishes || []).filter(t => now - t < 3600e3);
    if (recent.length >= MAX_FINISHES_PER_HOUR) throw new Reject('rate-limit');
    const rk = R.ensureSeason(doc.rk, now);
    // opponents come from the phone for now (bots). Clamp them and keep the lobby inside the matchmaking window.
    const others = (Array.isArray(data.ratings) ? data.ratings : []).slice(0, 3).map(v => R.clamp(Math.round(+v) || rk.mmr, RATING_MIN, RATING_MAX));
    while (others.length < 3) others.push(rk.mmr);
    const avg = others.reduce((a, b) => a + b, 0) / 3;
    const bounded = others.map(v => R.clamp(v, rk.mmr - MATCH_WINDOW, rk.mmr + MATCH_WINDOW));
    if (Math.abs(avg - rk.mmr) > MATCH_WINDOW * 1.5) throw new Reject('bad-lobby');
    const ratings = bounded.slice(); ratings.splice(place - 1, 0, rk.mmr);
    const res = R.applyResult(rk, ratings, place, forfeit, now);
    doc.rk = rk; doc.pending = null; doc.finishes = recent.concat(now);
    await store.set('matches/' + data.id, Object.assign({}, m, { open:false, place, forfeit, t1:now }));
    await store.set('ranked/' + uid, doc);
    return { rk:R.pick(rk), dm:res.dm, rpd:res.rpd, placing:res.placing };
}

module.exports = { start, finish, Reject, MIN_RACE_S };
