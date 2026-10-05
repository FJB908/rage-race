// Level rewards: one reward for reaching each player level (2..LEVEL_MAX). Same kinds as the daily calendar:
//   { t:'coin', n } | { t:'gem', n } | { t:'drop', tier } | { t:'item', cat, id } | { t:'boost', kind:'coin'|'xp', mult, n }
const LEVEL_MAX = 50;
const LEVEL_REWARDS = (function () {
    const BOOST = { 3:['coin', 2, 2], 4:['coin', 2, 3], 6:['xp', 2, 2], 8:['xp', 2, 2], 9:['coin', 2, 4], 12:['coin', 2, 5], 13:['xp', 2, 3], 16:['xp', 2, 3], 18:['coin', 3, 3], 22:['coin', 3, 3], 24:['xp', 3, 2], 27:['coin', 2, 6], 28:['xp', 3, 2], 32:['xp', 2, 4], 34:['coin', 2, 8], 37:['coin', 3, 4], 38:['xp', 2, 5], 42:['xp', 3, 3], 44:['coin', 3, 5], 46:['coin', 5, 3], 48:['xp', 3, 3], 49:['xp', 5, 2] };
    const ITEM = { 10:['skin', 'ocean'], 20:['hat', 'cowboy'], 30:['trail', 'comet'], 40:['face', 'visor'] };
    const GEM = { 15:10, 25:15, 35:20, 45:25 };
    const out = {};
    for (let L = 2; L <= LEVEL_MAX; L++) {
        if (ITEM[L]) out[L] = { t:'item', cat:ITEM[L][0], id:ITEM[L][1] };
        else if (L === LEVEL_MAX) out[L] = { t:'drop', tier:'legendary' };
        else if (L % 5 === 0 && GEM[L]) out[L] = { t:'gem', n:GEM[L] };
        else if (L % 5 === 0) out[L] = { t:'drop', tier:L <= 10 ? 'common' : L <= 25 ? 'rare' : 'epic' };
        else if (BOOST[L]) out[L] = { t:'boost', kind:BOOST[L][0], mult:BOOST[L][1], n:BOOST[L][2] };
        else out[L] = { t:'coin', n:Math.round((50 + L * 10) / 5) * 5 };
    }
    return out;
})();
