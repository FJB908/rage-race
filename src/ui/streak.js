// Daily login streak calendar. Loaded AFTER game.js.
(function () {
    const N = STREAK_REWARDS.length;
    const TC = { common:'#35e0c8', rare:'#5b8def', epic:'#b3a9ff', mythic:'#ff4d7d', legendary:'#ffcf3f' };
    const pad = n => (n < 10 ? '0' : '') + n;
    const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const now = () => window.__todayOverride ? new Date(window.__todayOverride + 'T12:00:00') : new Date();
    const today = () => dstr(now());
    const yesterday = () => { const d = now(); d.setDate(d.getDate() - 1); return dstr(d); };
    const twoDaysAgo = () => { const d = now(); d.setDate(d.getDate() - 2); return dstr(d); };
    const SAVE_GEMS = 25;
    const itemOf = r => COS_BY[r.cat].find(i => i.id === r.id);

    function state() {
        const p = prog(), s = p.streak || { n:0, last:'' }, t = today(), y = yesterday();
        const alive = s.last === t || s.last === y, n = alive ? (s.n || 0) : 0, claimedToday = s.last === t;
        const canSave = !alive && (s.n || 0) > 0 && s.last === twoDaysAgo();          // missed exactly one day: it can still be saved
        return { canSave, lost:s.n || 0, streak:n, claimedToday, canClaim:!claimedToday, nextDay:claimedToday ? null : (n >= N ? 1 : n + 1), shown:claimedToday ? n : (n >= N ? 0 : n) };
    }

    function art(r, i) {
        if (r.t === 'coin') return icon('coin');
        if (r.t === 'gem') return icon('gem');
        if (r.t === 'xp') return icon('xp');
        if (r.t === 'pass') return icon('pass');
        if (r.t === 'boost') return Boost.art(r);
        if (r.t === 'gemchest') return '<span class="sk-chest" style="--ic:#ff8ae6">' + (window.LB_GEMCHEST ? LB_GEMCHEST('sk') : icon('gem')) + '</span>';
        if (r.t === 'drop') return '<span class="sk-chest" style="--ic:' + TC[r.tier] + '">' + icon('drop-' + r.tier) + '</span>';
        return '<canvas width="120" height="120" data-i="' + i + '"></canvas>';
    }
    function amount(r) {
        if (r.t === 'gemchest') return '<b class="a-item" style="color:#ff8ae6">GEM CHEST</b>';
        if (r.t === 'coin' || r.t === 'gem' || r.t === 'xp' || r.t === 'pass') return '<b class="a-' + r.t + '">' + r.n.toLocaleString('en-US') + '</b>';
        if (r.t === 'boost') return '<b class="a-boost" style="color:' + Boost.KINDS[r.kind].color + '">' + r.n + (r.kind === 'coin' ? (r.n === 1 ? ' match' : ' matches') : (r.n === 1 ? ' chest' : ' chests')) + '</b>';
        if (r.t === 'drop') return '<b class="a-drop" style="color:' + TC[r.tier] + '">' + r.tier.toUpperCase() + '</b>';
        const it = itemOf(r); return '<b class="a-item" style="color:' + (r.t === 'prem' ? '#ff8ae6' : RARITY[it.rarity].color) + '">' + (r.t === 'prem' ? 'PREMIUM' : RARITY[it.rarity].label.toUpperCase()) + '</b>';
    }

    // ---- screen ----
    const el = document.createElement('div');
    el.id = 's-streak'; el.className = 'screen streak-screen'; el.style.cssText = 'display:none;opacity:0';
    el.innerHTML = '<section class="sk-shell"><header class="sk-top"><button class="pass-back" type="button" id="sk-back" aria-label="Back to home">' + icon('chev-l') + '</button><div class="sk-title"><span class="sk-eyebrow">DAILY REWARDS</span><h1>' + icon('calendar') + '<b id="sk-days">0</b><span id="sk-flame" class="sk-flame" hidden>' + icon('flame') + '</span><span class="sk-lbl">day streak</span></h1></div></header><div class="sk-grid" id="sk-grid"></div><footer class="sk-foot"><button class="sk-save" id="sk-save" type="button" hidden></button><button class="sk-claim" id="sk-claim" type="button"></button></footer></section>';
    document.body.appendChild(el);
    S.streak = el;
    const grid = el.querySelector('#sk-grid'), claimBtn = el.querySelector('#sk-claim');

    function render() {
        const st = state(); el.querySelector('#sk-days').textContent = st.streak; el.querySelector('#sk-flame').hidden = st.streak < 1;
        grid.innerHTML = '';
        STREAK_REWARDS.forEach((r, i) => {
            const day = i + 1, claimed = day <= st.shown, isToday = st.canClaim && day === st.nextDay, milestone = r.t === 'prem' || r.t === 'gemchest' || r.t === 'item' || (r.t === 'drop' && r.tier === 'legendary');
            const tile = document.createElement('div');
            tile.className = 'sk-tile' + (claimed ? ' claimed' : '') + (isToday ? ' today' : '') + (milestone ? ' mile' : '') + (r.t === 'prem' ? ' prem' : '') + (r.t === 'gemchest' ? ' gemchest' : '');
            tile.innerHTML = '<small>' + day + '</small><div class="sk-art">' + art(r, i) + '</div>' + amount(r) + (claimed ? '<span class="sk-check">' + icon('check') + '</span>' : '');
            grid.appendChild(tile);
            const cv = tile.querySelector('canvas');
            if (cv) { const it = itemOf(r), look = Object.assign({ skin:'classic', hat:'none', face:'none', trail:'none' }, { [r.cat]:r.id }); try { renderLook(cv, look, { scale:.24, cy:.6 }); } catch (e) {} }
        });
        const sv = el.querySelector('#sk-save'); sv.hidden = !st.canSave; sv.dataset.armed = ''; sv.innerHTML = icon('flame') + '<span>Save your ' + st.lost + ' day streak</span><b>' + icon('gem') + ' ' + SAVE_GEMS + '</b>';
        claimBtn.disabled = !st.canClaim;
        claimBtn.innerHTML = st.canClaim ? 'CLAIM DAY ' + st.nextDay : '<span>' + icon('check') + '</span> COME BACK TOMORROW';
        claimBtn.classList.toggle('ready', st.canClaim);
    }
    function scrollToToday() { const t = grid.querySelector('.today') || grid.querySelector('.sk-tile:not(.claimed)'); if (t) grid.scrollTop = Math.max(0, t.offsetTop - grid.clientHeight / 2 + t.offsetHeight / 2); }

    async function grant(r) {
        const p = prog();
        if (r.t === 'coin') { addCoins(r.n); await showRewardPops([{ type:'coin', n:r.n }]); }
        else if (r.t === 'gem') { addGems(r.n); await showRewardPops([{ type:'gem', n:r.n }]); }
        else if (r.t === 'xp') { p.xp += r.n; saveProg(p); await showRewardPops([{ type:'xp', n:r.n }]); }
        else if (r.t === 'pass') { p.passPoints += r.n; p.passPointsEarned += r.n; saveProg(p); await showRewardPops([{ type:'pass', n:r.n }]); }
        else if (r.t === 'boost') { await showRewardPops([Boost.pop(r)]); }
        else if (r.t === 'gemchest') { await GemCrate.give(); }
        else if (r.t === 'drop') { const drop = awardLootDrop(newLootId('streak'), { coins:80, xp:60, passPoints:0 }, { tier:r.tier }); await new Promise(res => openLootbox(drop, { title:'DAILY CHEST', onDone:res })); }
        else {
            const it = itemOf(r);
            if (p.owned.includes(it.id)) { const back = { common:100, rare:400, epic:1200, mythic:2000, legendary:3000 }[it.rarity] || 100; addCoins(back); await showRewardPops([{ type:'coin', n:back }], { tier:it.rarity }); }
            else { p.owned.push(it.id); saveProg(p); await showRewardPops([{ type:'item', item:it }], { tier:it.rarity }); }
        }
    }
    let busy = false;
    async function claim() {
        const st = state(); if (!st.canClaim || busy) return; busy = true;
        try {
            const r = STREAK_REWARDS[st.nextDay - 1], p = prog();
            p.streak = { n:st.nextDay, last:today() }; saveProg(p);     // mark first so a double tap can never pay twice
            await grant(r);
        } finally { busy = false; refreshMenu(); render(); Streak.refreshHome(); }
    }
    claimBtn.addEventListener('click', claim);
    const saveBtn = el.querySelector('#sk-save');
    saveBtn.addEventListener('click', () => {
        const st = state(); if (!st.canSave) return;
        if (!saveBtn.dataset.armed) { saveBtn.dataset.armed = '1'; saveBtn.classList.add('arm'); setTimeout(() => { saveBtn.dataset.armed = ''; saveBtn.classList.remove('arm'); }, 2600); return; }
        if (gemCount() < SAVE_GEMS) { toast('You need ' + SAVE_GEMS + ' gems'); goGemShop(); return; }
        store('rr_gems', gemCount() - SAVE_GEMS);
        const p = prog(); p.streak = { n:p.streak.n, last:yesterday() }; saveProg(p);       // the missed day counts as played
        SFX.play('finish'); toast('Streak saved'); refreshMenu(); render(); Streak.refreshHome();
    });
    el.querySelector('#sk-back').addEventListener('click', () => showScreen('start'));

    window.Streak = {
        state,
        open() { render(); showScreen('streak'); setTimeout(scrollToToday, 80); },
        refreshHome() {
            const st = state(), b = document.getElementById('btn-streak-open'); if (!b) return;
            b.classList.toggle('has-fire', st.streak > 0); b.title = st.streak > 0 ? st.streak + ' day streak' : 'Daily rewards';
            b.querySelector('.ms-dot').hidden = true;
            setBadge(b, st.canClaim ? 1 : 0);
            b.classList.toggle('ready', st.canClaim);
        },
        debugClaimNow: claim,
    };
    const home = document.getElementById('btn-streak-open');
    if (home) home.addEventListener('click', () => { SFX.play('count'); Streak.open(); });
    Streak.refreshHome();
    // show the calendar once per launch when a reward is waiting (skipped in automated browsers)
    window.addEventListener('load', () => { try { if (STREAK_CONFIG.autoOpen && !navigator.webdriver && state().canClaim) setTimeout(() => { if (getComputedStyle(S.start).display !== 'none') Streak.open(); }, 900); } catch (e) {} });
})();
