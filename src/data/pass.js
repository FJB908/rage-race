// Season 01 pass: 30 tiers, flat PASS_TIER_PTS pass points per tier, one free track.
// Reward kinds: {t:'none'} (an empty tier, nothing to claim)  |  {t:'coins', n}  |  {t:'drop'} (a supply drop, opened fullscreen)  |  {t:'item', cat, id}  |  {t:'boost', kind:'coin'|'chest', mult, n}
const PASS_TIER_PTS = 100;
const PASS_TIERS = [
    { t:'coins', n:50 }, { t:'none' }, { t:'drop' }, { t:'boost', kind:'coin', mult:2, n:3 }, { t:'none' },
    { t:'coins', n:100 }, { t:'drop' }, { t:'none' }, { t:'item', cat:'face', id:'shades' }, { t:'item', cat:'trail', id:'afterglow' },
    { t:'none' }, { t:'drop' }, { t:'item', cat:'hat', id:'headphones' }, { t:'none' }, { t:'item', cat:'skin', id:'tiger' },
    { t:'boost', kind:'coin', mult:2, n:5 }, { t:'none' }, { t:'item', cat:'hat', id:'propeller' }, { t:'coins', n:250 }, { t:'none' },
    { t:'drop' }, { t:'boost', kind:'chest', mult:2, n:3 }, { t:'none' }, { t:'coins', n:300 }, { t:'item', cat:'trail', id:'aurora' },
    { t:'none' }, { t:'boost', kind:'coin', mult:3, n:3 }, { t:'none' }, { t:'boost', kind:'chest', mult:3, n:2 }, { t:'item', cat:'hat', id:'crown' }
];

// RAGE PASS: the paid lane (RAGE_PASS_GEMS gems, once). Same 30 tiers, same pass points, a second reward per tier.
// Extra kinds: {t:'gem', n} | {t:'emote', id} | {t:'finisher', id} | {t:'prem', cat, id} (gem-shop cosmetic) | {t:'drop', tier} (supply drop starting at that tier)
const RAGE_PASS_GEMS = 1000;
const RAGE_TIERS = [
    { t:'coins', n:500 },                    { t:'emote', id:'nice' },                 { t:'drop', tier:'rare' },                { t:'boost', kind:'coin', mult:2, n:5 },   { t:'gem', n:30 },
    { t:'item', cat:'skin', id:'lava' },  { t:'coins', n:800 },                    { t:'drop', tier:'epic' },                 { t:'emote', id:'rage' },                { t:'prem', cat:'face', id:'p-scanner' },
    { t:'boost', kind:'chest', mult:2, n:3 },{ t:'gem', n:40 },                        { t:'finisher', id:'f-fireworks' },        { t:'coins', n:1000 },                    { t:'drop', tier:'epic' },
    { t:'prem', cat:'trail', id:'p-thunder' },{ t:'emote', id:'boom' },                 { t:'boost', kind:'coin', mult:3, n:5 },   { t:'gem', n:50 },                        { t:'coins', n:1500 },
    { t:'drop', tier:'legendary' },          { t:'finisher', id:'f-lightning' },        { t:'prem', cat:'hat', id:'p-storm' },     { t:'emote', id:'king' },                 { t:'boost', kind:'chest', mult:3, n:4 },
    { t:'gem', n:60 },                       { t:'coins', n:2500 },                     { t:'drop', tier:'legendary' },          { t:'finisher', id:'f-supernova' },        { t:'prem', cat:'skin', id:'p-holochrome' }
];
