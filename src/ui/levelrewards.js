// Level rewards screen: a vertical road of levels with one reward each. Open it by tapping the XP bar (home or profile).
// Loaded AFTER game.js.
(function () {
    'use strict';
    const TC = { common:'#35e0c8', rare:'#5b8def', epic:'#b3a9ff', legendary:'#ffcf3f' };
    const itemOf = r => COS_BY[r.cat].find(i => i.id === r.id);
    const lvOf = () => levelInfo(prog().xp);

    function claimable() {
        const p = prog(), L = lvOf().lvl, out = [];
        for (let l = 2; l <= Math.min(L, LEVEL_MAX); l++) if (!p.lvClaimed.includes(l)) out.push(l);
        return out;
    }
    function color(r) { return r.t === 'drop' ? TC[r.tier] : r.t === 'boost' ? Boost.KINDS[r.kind].color : r.t === 'gem' ? '#ff8ae6' : r.t === 'item' ? RARITY[itemOf(r).rarity].color : '#ffcf3f'; }
    function art(r, l) {
        if (r.t === 'coin') return icon('coin'); if (r.t === 'gem') return icon('gem');
        if (r.t === 'drop') return '<span class="lr-crate" style="--ic:' + TC[r.tier] + '">' + icon('drop-' + r.tier) + '</span>';
        if (r.t === 'boost') return Boost.art(r);
        return '<canvas width="120" height="120" data-l="' + l + '"></canvas>';
    }
    function name(r) {
        if (r.t === 'coin') return '<b>' + r.n.toLocaleString('en-US') + '</b><small>Coins</small>';
        if (r.t === 'gem') return '<b>' + r.n + '</b><small>Gems</small>';
        if (r.t === 'drop') return '<b style="color:' + TC[r.tier] + '">' + r.tier.toUpperCase() + '</b><small>Chest</small>';
        if (r.t === 'boost') return '<b style="color:' + color(r) + '">x' + r.mult + ' ' + Boost.KINDS[r.kind].name + '</b><small>' + r.n + ' ' + (r.kind === 'coin' ? (r.n === 1 ? 'match' : 'matches') : (r.n === 1 ? 'chest' : 'chests')) + (r.kind === 'chest' ? ' · from matches' : '') + '</small>';
        const it = itemOf(r); return '<b style="color:' + RARITY[it.rarity].color + '">' + it.name + '</b><small>' + RARITY[it.rarity].label + ' ' + ({ skin:'skin', hat:'headwear', face:'face', trail:'trail' }[r.cat]) + '</small>';
    }

    const el = document.createElement('div');
    el.id = 's-lvr'; el.className = 'screen lvr-screen'; el.style.cssText = 'display:none;opacity:0';
    el.innerHTML =
        '<section class="lr-shell"><header class="lr-top"><button class="pass-back" type="button" id="lr-back" aria-label="Back">' + icon('chev-l') + '</button>' +
        '<div class="lr-title"><small>LEVEL REWARDS</small><h1>Level progress</h1></div></header>' +
        '<div class="lr-hero"><div class="lr-ring" id="lr-ring"><span id="lr-lvl">1</span></div><div class="lr-herotxt"><b id="lr-next">NEXT LEVEL</b><div class="lr-bar"><i id="lr-fill"></i></div><small id="lr-xp"></small></div>' +
        '<button type="button" class="lr-all" id="lr-all" hidden>CLAIM ALL</button></div>' +
        '<div class="lr-list" id="lr-list"></div></section>';
    document.body.appendChild(el);
    S.lvr = el;
    const list = el.querySelector('#lr-list');

    function render() {
        const p = prog(), L = lvOf(), cl = claimable();
        el.querySelector('#lr-lvl').textContent = L.lvl;
        el.querySelector('#lr-ring').style.setProperty('--pct', (100 * L.into / L.need).toFixed(1));
        el.querySelector('#lr-fill').style.width = (100 * L.into / L.need).toFixed(1) + '%';
        el.querySelector('#lr-next').textContent = L.lvl >= LEVEL_MAX ? 'MAX LEVEL' : 'LEVEL ' + (L.lvl + 1) + ' IN';
        el.querySelector('#lr-xp').innerHTML = L.lvl >= LEVEL_MAX ? '' : R('xp', (L.need - L.into) + ' to go');
        const all = el.querySelector('#lr-all'); all.hidden = !cl.length; all.innerHTML = 'CLAIM ALL <b>' + cl.length + '</b>';
        list.innerHTML = '';
        for (let l = 2; l <= LEVEL_MAX; l++) {
            const r = LEVEL_REWARDS[l], claimed = p.lvClaimed.includes(l), ready = !claimed && l <= L.lvl, cur = l === L.lvl + 1;
            const row = document.createElement('div');
            row.className = 'lr-row' + (claimed ? ' claimed' : ready ? ' ready' : ' locked') + (cur ? ' next' : '') + (r.t === 'item' || (r.t === 'drop' && r.tier === 'legendary') ? ' mile' : '');
            row.dataset.l = l; row.style.setProperty('--rc', color(r));
            row.innerHTML = '<div class="lr-node">' + (claimed ? icon('check') : l) + '</div>' +
                '<div class="lr-card"><div class="lr-art">' + art(r, l) + '</div><div class="lr-name">' + name(r) + '</div>' +
                (ready ? '<button type="button" class="lr-claim">CLAIM</button>' : claimed ? '<span class="lr-state">CLAIMED</span>' : '<span class="lr-state lock">' + icon('lock') + ' LV ' + l + '</span>') + '</div>';
            if (ready) row.querySelector('.lr-claim').onclick = () => claim([l]);
            list.appendChild(row);
            const cv = row.querySelector('canvas');
            if (cv) { const look = Object.assign({ skin:'classic', hat:'none', face:'none', trail:'none' }, { [r.cat]:r.id }); if (r.cat === 'trail') { cv.width = 200; cv.height = 100; try { drawTrailPreview(cv, itemOf(r)); } catch (e) {} } else try { renderLook(cv, look, { scale:.36, cy:.56 }); } catch (e) {} }
        }
    }
    function scrollToCurrent() {
        const t = list.querySelector('.ready') || list.querySelector('.next') || list.lastElementChild;
        if (t) list.scrollTop = Math.max(0, t.offsetTop - list.clientHeight / 3);
    }

    async function grant(l) {
        const r = LEVEL_REWARDS[l], p = prog();
        if (p.lvClaimed.includes(l)) return;
        p.lvClaimed.push(l); saveProg(p);                     // mark first: a double tap can never pay twice
        if (r.t === 'coin') { addCoins(r.n); await showRewardPops([{ type:'coin', n:r.n }]); }
        else if (r.t === 'gem') { addGems(r.n); await showRewardPops([{ type:'gem', n:r.n }]); }
        else if (r.t === 'boost') await showRewardPops([Boost.pop(r)]);
        else if (r.t === 'drop') { const drop = awardLootDrop(newLootId('lvreward'), { coins:60, xp:40, passPoints:0 }, { tier:r.tier }); await new Promise(res => openLootbox(drop, { title:'LEVEL ' + l + ' REWARD', onDone:res })); }
        else {
            const it = itemOf(r), q = prog();
            if (q.owned.includes(it.id)) { const back = { common:100, rare:400, epic:1200, legendary:3000 }[it.rarity] || 100; addCoins(back); await showRewardPops([{ type:'coin', n:back }], { tier:it.rarity }); }
            else { q.owned.push(it.id); saveProg(q); await showRewardPops([{ type:'item', item:it }], { tier:it.rarity }); }
        }
    }
    let busy = false;
    async function claim(ls) {
        if (busy) return; busy = true;
        try { for (const l of ls) { await grant(l); refreshMenu(); render(); } }
        finally { busy = false; refreshMenu(); render(); }
    }
    el.querySelector('#lr-all').onclick = () => claim(claimable());
    el.querySelector('#lr-back').onclick = () => showScreen('start');

    window.LevelRewards = {
        claimable,
        open() { render(); showScreen('lvr'); setTimeout(scrollToCurrent, 90); },
        refreshHome() {
            const n = claimable().length;
            setBadge(document.getElementById('m-lvl'), n);
            const pl = document.getElementById('m-plvl'); if (pl) pl.classList.toggle('has-claim', n > 0);
        },
        debugClaimAll: () => claim(claimable()),
    };
    // tapping an XP bar opens it
    document.querySelectorAll('.m-who .m-xpbar, #pf-level').forEach(x => { const t = x.closest('.m-xpbar') || x; t.style.cursor = 'pointer'; t.addEventListener('click', ev => { ev.stopPropagation(); SFX.play('count'); LevelRewards.open(); }); });
    LevelRewards.refreshHome();
})();
