// Menu side of the gentle start: locked mode cards, a plainer home for new players, level titles and the level-up celebration.
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    let shownBusy = false;
    function refresh(p, L) {
        const lvl = L.lvl;
        document.body.classList.toggle('gentle-simple', lvl < 3);
        const t = $('m-title'); if (t) t.textContent = Gentle.title(lvl);
        const pl = $('m-plvl'); if (pl) pl.textContent = 'Level ' + lvl + ' · ' + Gentle.title(lvl);
        document.querySelectorAll('#s-start .m-card[data-mode]').forEach(c => {
            const need = Gentle.LOCKS[c.dataset.mode] || 1, lock = lvl < need;
            c.classList.toggle('lvl-locked', lock);
            let tag = c.querySelector('.lock-tag');
            if (lock) { if (!tag) { tag = document.createElement('i'); tag.className = 'lock-tag'; c.appendChild(tag); } tag.textContent = 'LEVEL ' + need; }
            else if (tag) tag.remove();
        });
        // a level-up while you are on the menu: celebrate it once
        const seen = p.lvlSeen;
        if (seen === undefined) { const q = prog(); q.lvlSeen = lvl; saveProg(q); return; }
        if (lvl > seen && !shownBusy && typeof state !== 'undefined' && state === 'menu' && !document.getElementById('lootbox')) celebrate(seen, lvl);
    }
    function celebrate(from, to) {
        shownBusy = true; const q = prog(); q.lvlSeen = to; saveProg(q);
        const opens = []; for (let l = from + 1; l <= to; l++) (Gentle.OPENS[l] || []).forEach(x => opens.push(x));
        const t = Gentle.title(to), newTitle = Gentle.title(from) !== t;
        const el = document.createElement('div'); el.className = 'lvup';
        el.innerHTML = '<div class="lvup-card"><small>LEVEL UP</small><div class="lvup-n">' + to + '</div><h2>' + t + '</h2><p>' + (newTitle ? 'A new title for you.' : 'Nice climb.') + '</p>' +
            (opens.length ? '<div class="lvup-open"><b>NOW OPEN</b>' + opens.map(o => '<span>' + o + '</span>').join('') + '</div>' : '') + '<button type="button">AWESOME</button></div>';
        document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
        try { SFX.play('levelup'); haptic([30, 40, 60]); } catch (e) {}
        const done = () => { el.classList.remove('in'); setTimeout(() => { el.remove(); shownBusy = false; refreshMenu(); }, 250); };
        el.querySelector('button').onclick = done;
    }
    window.GentleUI = { refresh };
})();
