'use strict';
// Ranked rules, ported 1:1 from src/modes/roster.js and src/modes/ranked.js (docs/RANKED.md). Keep both in sync.
const RP_PER_DIV = 100, DIVS = 3, RP_PER_TIER = RP_PER_DIV * DIVS, CROWN_RP = RP_PER_TIER * 6;
const MMR_FLOOR = 850, RP_SCALE = 2.12;
const PLACEMENTS = 5, EPOCH = Date.UTC(2026, 9, 1), SEASON_DAYS = 30;
const HIST_MAX = 12, SEASON_AGE = 0.65, IDLE_DECAY = 0.85;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mmrToRp = m => Math.max(0, Math.round((m - MMR_FLOOR) * RP_SCALE));
const tierOf = rp => Math.min(6, Math.floor(Math.max(0, rp) / RP_PER_TIER));
const seasonAt = now => Math.max(0, Math.floor((now - EPOCH) / (SEASON_DAYS * 864e5)));

function expected(i, list) { let e = 0; for (let j = 0; j < list.length; j++) if (j !== i) e += 1 / (1 + Math.pow(10, (list[j] - list[i]) / 400)); return e / (list.length - 1); }
function eloDelta(ratings, place, k) { const s = (ratings.length - place) / (ratings.length - 1); return k * 2 * (s - expected(place - 1, ratings)); }

// the part of the ranked record the server owns (the client keeps claimed / dropDay / dropN)
const FIELDS = ['mmr', 'rp', 'placed', 'peak', 'season', 'hist', 'protect', 'streak', 'matches', 'wins', 'sm', 'lastPlayed', 'seasons'];
const fresh = () => ({ mmr:1000, rp:0, placed:0, peak:0, season:0, hist:[], protect:0, streak:0, matches:0, wins:0, sm:0, lastPlayed:-1, seasons:[] });
const num = (v, d) => Number.isFinite(+v) ? +v : d;
function adopt(c, now) {                         // first contact: take the phone's old local record, with a cap so it cannot be used to start at the top
    const r = fresh(); if (!c || typeof c !== 'object') return r;
    r.mmr = clamp(Math.round(num(c.mmr, 1000)), 400, 1500); r.placed = clamp(Math.round(num(c.placed, 0)), 0, PLACEMENTS);
    r.matches = clamp(Math.round(num(c.matches, 0)), 0, 5000); r.wins = clamp(Math.round(num(c.wins, 0)), 0, r.matches); r.sm = clamp(Math.round(num(c.sm, 0)), 0, r.matches);
    r.season = seasonAt(now);
    r.rp = r.placed >= PLACEMENTS ? mmrToRp(r.mmr) : 0; r.peak = r.rp;
    return r;
}

function carryMmr(seasons, now, idle) {
    let sum = 0, wsum = 0;
    for (const e of seasons) {
        const w = Math.pow(SEASON_AGE, Math.max(0, now - 1 - e.s)) * Math.min(1, 0.4 + e.m / 12);
        sum += e.mmr * w; wsum += w;
    }
    const avg = wsum ? sum / wsum : 1100;
    return Math.round(1100 + (avg - 1100) * 0.55 * Math.pow(IDLE_DECAY, idle));
}
function ensureSeason(r, nowMs) {
    const now = seasonAt(nowMs);
    if (r.season === now) return r;
    const played = r.sm || (r.matches > 0 && !r.seasons.length ? r.matches : 0);
    if (played > 0) {
        r.seasons.unshift({ s:r.season, mmr:r.mmr, rp:r.rp, tier:tierOf(r.peak), m:played });
        r.seasons.length = Math.min(r.seasons.length, HIST_MAX);
        r.lastPlayed = r.season;
    }
    if (r.seasons.length) {
        const idle = Math.max(0, now - 1 - Math.max(r.lastPlayed, r.seasons[0].s));
        r.mmr = carryMmr(r.seasons, now, idle);
        r.placed = Math.max(0, Math.min(r.placed, PLACEMENTS - 2 - Math.min(2, idle >> 1)));
        r.rp = mmrToRp(r.mmr); r.peak = r.rp; r.protect = 0; r.streak = 0;
    }
    r.sm = 0; r.season = now;
    return r;
}

// ratings: the four mmr values in finishing order (the player's own at index place-1). Returns the new record plus what changed.
function applyResult(r, ratings, place, forfeit, nowMs) {
    const placing = r.placed < PLACEMENTS, wasRank = placing ? null : tierOf(r.rp);
    const k = placing ? 56 : 28;
    let dm = Math.round(eloDelta(ratings, place, k));
    if (forfeit) dm = Math.min(dm, -12);
    let rpd = 0;
    r.mmr = clamp(r.mmr + dm, 400, 2900);
    r.matches++; r.sm++; r.lastPlayed = seasonAt(nowMs);
    if (place === 1) { r.wins++; r.streak++; } else if (place >= 3) r.streak = 0;
    if (placing) {
        r.placed++;
        if (r.placed >= PLACEMENTS) { r.rp = mmrToRp(r.mmr); r.peak = Math.max(r.peak, r.rp); r.protect = 2; }
    } else {
        const target = mmrToRp(r.mmr);
        rpd = Math.round(dm * RP_SCALE * 0.5 + 0.12 * (target - r.rp)) + (place === 1 ? Math.min(6, Math.max(0, r.streak - 2) * 3) : 0);
        rpd = clamp(rpd, -24, 34);
        if (forfeit) rpd = Math.min(rpd, -16);
        const floor = wasRank * RP_PER_TIER;
        let next = Math.max(0, r.rp + rpd);
        if (rpd < 0 && r.protect > 0) next = Math.max(next, floor);
        rpd = next - r.rp; r.rp = next; r.peak = Math.max(r.peak, r.rp);
        if (r.protect > 0) r.protect--;
    }
    r.hist.unshift({ place, d:rpd, t:nowMs }); r.hist.length = Math.min(r.hist.length, 20);
    if (!placing && tierOf(r.rp) > wasRank) r.protect = 2;                       // promoted: shielded from demotion for 2 matches
    return { dm, rpd, placing };
}
const pick = r => { const o = {}; FIELDS.forEach(f => { o[f] = r[f]; }); return o; };

module.exports = { FIELDS, PLACEMENTS, fresh, adopt, ensureSeason, applyResult, pick, seasonAt, mmrToRp, tierOf, clamp, eloDelta };
