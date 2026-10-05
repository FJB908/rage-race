// 30-day login streak. Claim once per day; missing a day restarts at day 1; after day 30 it starts over.
// Reward kinds: coin | gem | xp | pass {n} | boost {kind,mult,n} | drop {tier} (supply drop that starts at that tier) | item {cat,id} | prem {cat,id} (premium cosmetic)
const STREAK_CONFIG = { autoOpen:false };      // the menu just opens; a "!" on the calendar says a reward is waiting
const STREAK_REWARDS = [
    { t:'coin', n:100 },  { t:'coin', n:150 },  { t:'drop', tier:'common' },  { t:'boost', kind:'coin', mult:2, n:3 },  { t:'gem', n:10 },
    { t:'xp', n:100 },    { t:'item', cat:'hat', id:'bunny' },
    { t:'coin', n:300 },  { t:'drop', tier:'rare' },  { t:'gem', n:15 },  { t:'boost', kind:'chest', mult:2, n:2 },  { t:'pass', n:60 },  { t:'drop', tier:'rare' },
    { t:'item', cat:'skin', id:'tiger' },
    { t:'gem', n:25 },    { t:'boost', kind:'coin', mult:2, n:5 },  { t:'drop', tier:'epic' },  { t:'xp', n:200 },  { t:'coin', n:700 },  { t:'gem', n:30 },
    { t:'drop', tier:'legendary' },
    { t:'boost', kind:'chest', mult:2, n:3 },  { t:'pass', n:120 },  { t:'drop', tier:'epic' },  { t:'gem', n:40 },  { t:'boost', kind:'coin', mult:3, n:3 },  { t:'drop', tier:'epic' },
    { t:'item', cat:'face', id:'hologlass' },
    { t:'gem', n:50 },
    { t:'gemchest' },
];
