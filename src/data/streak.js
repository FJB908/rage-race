// 30-day login streak. Claim once per day; missing a day restarts at day 1; after day 30 it starts over.
// Reward kinds: coin | gem | xp | pass {n} | drop {tier} (supply drop that starts at that tier) | item {cat,id} | prem {cat,id} (premium cosmetic)
const STREAK_CONFIG = { autoOpen:true };
const STREAK_REWARDS = [
    { t:'coin', n:100 },  { t:'coin', n:150 },  { t:'drop', tier:'common' },  { t:'coin', n:200 },  { t:'gem', n:10 },
    { t:'xp', n:100 },    { t:'item', cat:'hat', id:'bunny' },
    { t:'coin', n:300 },  { t:'drop', tier:'rare' },  { t:'gem', n:15 },  { t:'coin', n:400 },  { t:'pass', n:60 },  { t:'drop', tier:'rare' },
    { t:'item', cat:'skin', id:'tiger' },
    { t:'gem', n:25 },    { t:'coin', n:500 },  { t:'drop', tier:'epic' },  { t:'xp', n:200 },  { t:'coin', n:700 },  { t:'gem', n:30 },
    { t:'drop', tier:'legendary' },
    { t:'coin', n:800 },  { t:'pass', n:120 },  { t:'drop', tier:'epic' },  { t:'gem', n:40 },  { t:'coin', n:1000 },  { t:'drop', tier:'epic' },
    { t:'item', cat:'face', id:'hologlass' },
    { t:'gem', n:50 },
    { t:'prem', cat:'skin', id:'p-streaker' },
];
