// COLLECTION: themed sets of cosmetics. Own every piece of a set and claim its bonus once (prog().setsClaimed). Loaded AFTER game.js.
(function () {
    'use strict';
    const SETS = [
        { id: 'fire',   name: 'Fire',   items: [['skin', 'ember'], ['skin', 'lava'], ['trail', 'cinder'], ['trail', 'embers']],           coins: 1500, gems: 10 },
        { id: 'ice',    name: 'Ice',    items: [['skin', 'frost'], ['skin', 'glacier'], ['face', 'frostmark'], ['trail', 'glacierline']], coins: 1500, gems: 10 },
        { id: 'royal',  name: 'Royal',  items: [['skin', 'gold'], ['hat', 'crown'], ['hat', 'halo'], ['trail', 'goldenhour']],             coins: 2500, gems: 20 },
        { id: 'space',  name: 'Space',  items: [['skin', 'galaxy'], ['hat', 'spacehelm'], ['face', 'visor'], ['trail', 'nebula']],         coins: 2000, gems: 15 },
        { id: 'nature', name: 'Nature', items: [['skin', 'lime'], ['skin', 'sakura'], ['hat', 'flower'], ['hat', 'petalcrown']],           coins: 1500, gems: 10 },
        { id: 'cool',   name: 'Cool',   items: [['face', 'shades'], ['face', 'aviator'], ['face', '3d'], ['hat', 'headphones']],           coins: 1200, gems: 10 },
        { id: 'tech',   name: 'Tech',   items: [['skin', 'circuit'], ['skin', 'carbon'], ['face', 'hologlass'], ['trail', 'blueprint']],   coins: 1800, gems: 15 },
        { id: 'dark',   name: 'Dark',   items: [['skin', 'eclipse'], ['hat', 'voidhorns'], ['face', 'voidstitch'], ['trail', 'shadowcode']], coins: 2200, gems: 20 },
    ];
    const itemOf = (cat, id) => (COS_BY[cat] || []).find(i => i.id === id);
    const sets = () => SETS.map(s => Object.assign({}, s, { items: s.items.map(([cat, id]) => ({ cat, id, it: itemOf(cat, id) })).filter(x => x.it) })).filter(s => s.items.length);
    function progress(p) {
        return sets().map(s => { const have = s.items.filter(x => p.owned.includes(x.id)).length; return Object.assign({}, s, { have, total: s.items.length, complete: have === s.items.length, claimed: (p.setsClaimed || []).includes(s.id) }); });
    }

    const el = document.createElement('div');
    el.id = 's-collection'; el.className = 'screen scr'; el.style.cssText = 'display:none;opacity:0';
    el.innerHTML = '<section class="scr-shell"><header class="scr-head"><button class="pass-back" type="button" id="cl-back" aria-label="Back">' + icon('chev-l') + '</button><div class="scr-title"><span class="scr-eye" id="cl-eye"></span><h1>Collection</h1></div></header><div class="scr-body" id="cl-body"></div></section>';
    document.body.appendChild(el); S.collection = el;
    const body = el.querySelector('#cl-body');

    function render() {
        const p = prog(), list = progress(p);
        el.querySelector('#cl-eye').textContent = list.filter(s => s.complete).length + ' / ' + list.length + ' sets complete';
        body.innerHTML = '';
        for (const s of list) {
            const d = document.createElement('div'); d.className = 'cl-set' + (s.complete ? ' complete' : '');
            d.innerHTML = '<div class="cl-top"><b>' + s.name + '</b><small>' + s.have + ' / ' + s.total + '</small></div><div class="cl-items">' +
                s.items.map(x => '<div class="cl-it' + (p.owned.includes(x.id) ? '' : ' miss') + '" style="--rc:' + RARITY[x.it.rarity].color + '"><canvas width="116" height="116" data-c="' + x.cat + '" data-id="' + x.id + '"></canvas><small>' + x.it.name + '</small></div>').join('') + '</div>' +
                '<div class="cl-bonus"><span>Set bonus ' + R('coin', s.coins) + R('gem', s.gems) + '</span>' + (s.claimed ? '<span class="cl-done">CLAIMED</span>' : s.complete ? '<button class="cl-go" type="button" data-s="' + s.id + '">CLAIM</button>' : '') + '</div>';
            body.appendChild(d);
        }
        body.querySelectorAll('canvas').forEach(cv => {
            const look = Object.assign({ skin: 'classic', hat: 'none', face: 'none', trail: 'none' }, { [cv.dataset.c]: cv.dataset.id });
            try { if (cv.dataset.c === 'trail') { cv.width = 116; cv.height = 116; drawTrailPreview(cv, itemOf('trail', cv.dataset.id), undefined, 1.5); } else renderLook(cv, look, { scale: .26, cy: .6 }); } catch (e) {}
        });
        body.querySelectorAll('.cl-go').forEach(b => b.onclick = () => claim(b.dataset.s));
        refreshBadge();
    }
    let busy = false;
    async function claim(id) {
        if (busy) return; busy = true;
        try {
            const p = prog(), s = progress(p).find(x => x.id === id); if (!s || !s.complete || s.claimed) return;
            p.setsClaimed = (p.setsClaimed || []).concat(id); saveProg(p); addCoins(s.coins); addGems(s.gems);
            await showRewardPops([{ type: 'coin', n: s.coins }, { type: 'gem', n: s.gems }], { tier: 'legendary' });
        } finally { busy = false; render(); refreshMenu(); }
    }

    function mountButton() {
        const anchor = document.getElementById('pf-level'); if (!anchor || document.getElementById('btn-collection')) return;
        const b = document.createElement('button'); b.type = 'button'; b.id = 'btn-collection'; b.className = 'pf-level pf-coll';
        b.innerHTML = '<span class="pf-lv-n">' + icon('star') + '</span><span class="pf-lv-t"><span class="pf-lv-top"><b>Collection</b><em id="cl-sub"></em></span></span><svg class="ico ico-chev-r" aria-hidden="true"><use href="#ico-chev-l"/></svg>';
        anchor.parentNode.insertBefore(b, anchor.nextSibling);
        b.addEventListener('click', () => { SFX.play('count'); open(); });
    }
    function refreshBadge() {
        mountButton();
        const p = prog(), list = progress(p), ready = list.filter(s => s.complete && !s.claimed).length;
        const sub = document.getElementById('cl-sub'); if (sub) sub.textContent = list.filter(s => s.complete).length + ' / ' + list.length + ' sets';
        setBadge(document.getElementById('btn-collection'), ready);
    }
    function open() { render(); showScreen('collection'); }
    el.querySelector('#cl-back').addEventListener('click', () => { showScreen('start'); });
    window.Collection = { open, refresh: refreshBadge, sets: progress };
    const orig = window.refreshMenu; if (typeof orig === 'function') { window.refreshMenu = function () { const r = orig.apply(this, arguments); try { refreshBadge(); if (window.Missions) Missions.refreshHome(); } catch (e) {} return r; }; }
    setTimeout(refreshBadge, 0);
})();
