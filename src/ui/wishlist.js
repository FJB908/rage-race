// WISHLIST GOAL: pin one shop item as "my goal". The home screen then shows a quiet progress bar (coins or gems saved / price), so every race moves toward something the player picked.
// Easy to switch off: the little x on the bar removes the goal, and Settings has a "Wishlist goal" switch that hides the bar and the pin stars everywhere.
// Works for the four wardrobe categories of the shop (skin, hat, face, trail). The goal lives in the profile (prog().wish), the on/off switch in localStorage (rr_wish_on).
(function () {
    'use strict';
    const $ = id => document.getElementById(id), KEY = 'rr_wish_on';
    const CATS = ['skin', 'hat', 'face', 'trail'];
    const enabled = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } };
    const setEnabled = on => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} };
    const num = n => Math.round(n).toLocaleString('en-US');

    function itemOf(w) { const list = w && COS_BY[w.cat]; return list ? list.find(i => i.id === w.id) : null; }
    // the goal as the home screen needs it, or null when there is none / it is switched off / you already own it
    function goal() {
        const p = prog(), w = p.wish; if (!w || !enabled()) return null;
        const it = itemOf(w); if (!it) return null;
        const gem = !!it.premium, price = gem ? it.gemPrice : it.price; if (!(price > 0)) return null;
        return { w, it, gem, price, have: gem ? gemCount() : load('rr_coins', 0), owned: p.owned.includes(it.id) };
    }
    function set(cat, id) { const p = prog(); p.wish = { cat, id }; saveProg(p); refresh(); }
    function clear() { const p = prog(); if (p.wish) { delete p.wish; saveProg(p); } refresh(); }
    const isPinned = (cat, id) => { const w = prog().wish; return !!w && w.cat === cat && w.id === id; };

    /* ------------------------------------------------------------------ home bar ---- */
    let lastKey = '';
    function refresh() {
        const box = $('m-wish'); if (!box) return;
        let g = goal();
        if (g && g.owned) {                                                      // reached: the goal is done, clear it and say so once
            const name = g.it.name; const p = prog(); delete p.wish; saveProg(p); g = null; lastKey = '';
            if (typeof toast === 'function') toast('Goal reached: ' + name);
        }
        if (!g) { box.hidden = true; lastKey = ''; return; }
        const pct = Math.min(100, g.have / g.price * 100), ready = g.have >= g.price;
        const key = g.w.cat + g.w.id + '|' + Math.floor(g.have) + '|' + (prog().skin) + '|' + (prog().hat) + '|' + (prog().face);
        box.hidden = false; box.classList.toggle('ready', ready);
        if (key === lastKey) return; lastKey = key;
        const cur = window.icon ? icon(g.gem ? 'gem' : 'coin') : '';
        const sameItem = box.dataset.id === g.w.cat + ':' + g.w.id;
        if (!sameItem) {
            box.dataset.id = g.w.cat + ':' + g.w.id;
            box.innerHTML = '<button class="mw-main" type="button"><canvas width="96" height="96"></canvas><span class="mw-tx"><small>GOAL</small><b></b><i class="mw-bar"><u></u></i></span><span class="mw-n"></span></button>' +
                '<button class="mw-x" type="button" aria-label="Remove goal"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>';
            const me = prog(), cat = g.w.cat;
            const look = { skin: me.skin, hat: me.hat, face: me.face, trail: 'none', costume: 'none' }; look[cat === 'trail' ? 'trail' : cat] = g.w.id;
            try { if (cat === 'trail') { const cv = box.querySelector('canvas'); drawTrailPreview(cv, g.it, undefined, 1.3); } else renderLook(box.querySelector('canvas'), look, { scale: .27, cy: .66 }); } catch (e) {}
            box.querySelector('.mw-main').onclick = () => { menuTab('shop'); renderShop(g.w.cat); setTimeout(() => { const c = document.querySelector('#m-skins [data-tid="' + g.w.id + '"]'); if (c) { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); c.classList.remove('wish-flash'); void c.offsetWidth; c.classList.add('wish-flash'); } }, 60); };
            box.querySelector('.mw-x').onclick = e => { e.stopPropagation(); clear(); if (window.SFX) SFX.play('back'); };
        }
        box.querySelector('b').textContent = g.it.name;
        box.querySelector('.mw-bar u').style.width = pct.toFixed(1) + '%';
        box.querySelector('.mw-n').innerHTML = ready ? '<em>READY</em>' : '<span>' + cur + num(g.have) + ' / ' + num(g.price) + '</span>';
    }

    /* ------------------------------------------------------------- pin on a shop card ---- */
    // called by renderShop for every card; the star only shows on items you do not own yet
    function decorate(card, cat, it, owned) {
        const old = card.querySelector('.wish-pin'); if (old) old.remove();
        if (owned || !enabled() || !CATS.includes(cat) || !((it.premium ? it.gemPrice : it.price) > 0)) return;
        const s = document.createElement('span'); s.className = 'wish-pin' + (isPinned(cat, it.id) ? ' on' : ''); s.setAttribute('role', 'button'); s.setAttribute('aria-label', 'Set as my goal');
        s.innerHTML = window.icon ? icon('star') : '*';
        s.addEventListener('click', e => {
            e.stopPropagation(); e.preventDefault();
            const was = isPinned(cat, it.id);
            if (was) clear(); else { set(cat, it.id); if (window.SFX) SFX.play('select'); if (typeof toast === 'function') toast('Goal set: ' + it.name); }
            document.querySelectorAll('#m-skins .wish-pin').forEach(x => x.classList.remove('on'));
            if (!was) s.classList.add('on');
        });
        card.appendChild(s);
    }

    /* ------------------------------------------------------------------ settings ---- */
    function syncSettings() { const b = $('set-wish'); if (b) b.classList.toggle('on', enabled()); }
    const sw = $('set-wish');
    if (sw) sw.addEventListener('click', () => { setEnabled(!enabled()); syncSettings(); lastKey = ''; refresh(); if (window.SFX) SFX.play('toggle'); const g = $('m-skins'); if (g && !g.hidden && typeof renderShop === 'function') { const on = document.querySelector('.m-pill.on[data-cat]'); if (on && on.dataset.cat !== 'resources') renderShop(on.dataset.cat); } });
    setInterval(() => { if (document.hidden) return; const s = $('s-start'); if (s && s.style.display !== 'none' && enabled()) refresh(); }, 1500);       // coins change from many places: keep the bar honest

    window.Wish = { goal, set, clear, refresh, decorate, enabled, syncSettings, isPinned };
})();
