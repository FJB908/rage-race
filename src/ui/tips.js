// ONE-TIME TIPS: a new player is not thrown in at the deep end, and is not hand-held either. The first time something new shows up in a race (a power-up in
// your slot, a crumbling / icy / moving / boost / sealed ledge under your feet) one short card says what it is. Every tip shows once per account and never
// stops the game. The card: an icon on the left (the power-up's own icon, or a little drawing of the ledge), a small label, the name and one line, and a thin
// line along the bottom that runs out with the time. Profile field: tips = { key: 1 }. Loaded AFTER game.js and arenatheme.js.
(function () {
    'use strict';
    const SHOW_MS = 4200;
    const LEDGE = {
        fragile: ['Crumbling ledge', 'It breaks soon after you land. Keep moving.', '#ff9838'],
        ice: ['Icy ledge', 'You slide after landing. Jump a little short.', '#9fd6ff'],
        moving: ['Moving ledge', 'Wait for it to come to you, then jump.', '#9a8dff'],
        boost: ['Boost ledge', 'Land on it and your next jump is stronger.', '#35e0c8'],
        ceiling: ['Sealed ledge', 'Closed underneath. Jump up into it to break through.', '#c9d1e3'],
    };
    // a little drawing for every ledge type (48 x 48, drawn in the accent colour)
    const bar = (x, y, w, o) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="8" rx="4" fill="currentColor"' + (o || '') + '/>';
    const DRAW = {
        fragile: bar(5, 27, 16, ' transform="rotate(-6 13 31)"') + bar(27, 29, 16, ' transform="rotate(7 35 33)"') + '<path d="M24 14l-3 6 4 3-3 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
        ice: bar(5, 28, 38) + '<path d="M15 20l3-3m5 3l3-3m5 3l3-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>',
        moving: bar(12, 30, 24) + '<path d="M9 19h30M14 14l-5 5 5 5M34 14l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
        boost: bar(5, 31, 38) + '<path d="M16 25l8-7 8 7m-16-8l8-7 8 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
        ceiling: bar(5, 10, 38) + '<path d="M24 36V20m-6 6l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
    };
    let el = null, hideT = 0;
    const seen = k => { try { return !!(prog().tips || {})[k]; } catch (e) { return true; } };
    function mark(k) { try { const p = prog(); p.tips = p.tips || {}; p.tips[k] = 1; saveProg(p); } catch (e) {} }
    function show(key, o) {
        if (seen(key) || (el && el.classList.contains('on'))) return;                     // one at a time; a skipped tip comes back next time
        mark(key);
        if (!el) { el = document.createElement('div'); el.id = 'tip-pill'; document.body.appendChild(el); }
        el.style.setProperty('--tc', o.color);
        el.innerHTML = '<span class="tp-ic">' + o.icon + '</span><span class="tp-tx"><small>' + o.label + '</small><b>' + o.title + '</b><span>' + o.text + '</span></span><i class="tp-bar"></i>';
        el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
        clearTimeout(hideT); hideT = setTimeout(() => el && el.classList.remove('on'), SHOW_MS);
    }
    function item(k) {
        if (!k || window.TUT_ITEM || !window.ArenaTheme) return;
        const i = ArenaTheme.INFO[k]; if (!i) return;
        let first = true; try { first = !Object.keys(prog().tips || {}).some(t => t.indexOf('item-') === 0); } catch (e) {}
        show('item-' + k, { label: 'NEW POWER-UP', title: i[0], text: i[1] + '.' + (first ? ' Tap the item button to use it.' : ''), color: ArenaTheme.COLORS[k] || '#9aa4b6', icon: (typeof ICON_SVG !== 'undefined' && ICON_SVG[k]) || '' });
    }
    function ledge(pl) {
        if (!pl || pl.ground || pl.type === 'safety' || pl.type === 'finish') return;
        const k = pl.ceiling ? 'ceiling' : pl.type, t = LEDGE[k]; if (!t) return;
        show('ledge-' + k, { label: 'NEW LEDGE', title: t[0], text: t[1], color: t[2], icon: '<svg viewBox="0 0 48 48" aria-hidden="true">' + DRAW[k] + '</svg>' });
    }
    window.Tips = { item, ledge, show };
})();
