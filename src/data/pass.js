// Season 01 pass: 30 tiers, flat PASS_TIER_PTS pass points per tier, one free track.
// Reward kinds: {t:'coins', n}  |  {t:'drop'} (a supply drop, opened fullscreen)  |  {t:'item', cat, id}  |  {t:'boost', kind:'coin'|'chest', mult, n}
const PASS_TIER_PTS = 100;
const PASS_TIERS = [
    { t:'coins', n:50 }, { t:'coins', n:75 }, { t:'drop' }, { t:'boost', kind:'coin', mult:2, n:3 }, { t:'item', cat:'skin', id:'violet' },
    { t:'coins', n:100 }, { t:'drop' }, { t:'coins', n:150 }, { t:'item', cat:'face', id:'shades' }, { t:'item', cat:'trail', id:'afterglow' },
    { t:'boost', kind:'chest', mult:2, n:2 }, { t:'drop' }, { t:'item', cat:'hat', id:'headphones' }, { t:'coins', n:200 }, { t:'item', cat:'skin', id:'tiger' },
    { t:'boost', kind:'coin', mult:2, n:5 }, { t:'drop' }, { t:'item', cat:'hat', id:'propeller' }, { t:'coins', n:250 }, { t:'item', cat:'trail', id:'cinder' },
    { t:'drop' }, { t:'boost', kind:'chest', mult:2, n:3 }, { t:'item', cat:'face', id:'bandit' }, { t:'coins', n:300 }, { t:'item', cat:'trail', id:'aurora' },
    { t:'drop' }, { t:'boost', kind:'coin', mult:3, n:3 }, { t:'item', cat:'skin', id:'chrome' }, { t:'boost', kind:'chest', mult:3, n:2 }, { t:'item', cat:'hat', id:'crown' }
];
