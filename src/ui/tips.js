// ONE-TIME TIPS: a new player is not thrown in at the deep end, and is not hand-held either. The first time something new shows up in a race (a power-up in
// your slot, a crumbling / icy / moving / boost / sealed ledge under your feet) one short line says what it is. Every tip shows once per account and never
// stops the game. Profile field: tips = { key: 1 }. Loaded AFTER game.js and arenatheme.js.
(function () {
    'use strict';
    const LEDGE = {
        fragile: ['Crumbling ledge', 'It breaks soon after you land. Keep moving.'],
        ice: ['Icy ledge', 'You slide after landing. Jump a little short.'],
        moving: ['Moving ledge', 'Wait for it to come to you, then jump.'],
        boost: ['Boost ledge', 'Land on it and your next jump is stronger.'],
        ceiling: ['Sealed ledge', 'Some ledges are closed underneath. Jump up into them to break through.'],
    };
    let el = null, hideT = 0;
    const seen = k => { try { return !!(prog().tips || {})[k]; } catch (e) { return true; } };
    function mark(k) { try { const p = prog(); p.tips = p.tips || {}; p.tips[k] = 1; saveProg(p); } catch (e) {} }
    function show(key, title, text) {
        if (seen(key) || (el && el.classList.contains('on'))) return;                     // one at a time; a skipped tip comes back next time
        mark(key);
        if (!el) { el = document.createElement('div'); el.id = 'tip-pill'; document.body.appendChild(el); }
        el.innerHTML = '<b>' + title + '</b><span>' + text + '</span>'; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
        clearTimeout(hideT); hideT = setTimeout(() => el && el.classList.remove('on'), 4200);
    }
    function item(k) {
        if (!k || window.TUT_ITEM || !window.ArenaTheme) return;
        const i = ArenaTheme.INFO[k]; if (i) show('item-' + k, i[0], i[1] + '. Tap the item button to use it.');
    }
    function ledge(pl) {
        if (!pl || pl.ground || pl.type === 'safety' || pl.type === 'finish') return;
        const k = pl.ceiling ? 'ceiling' : pl.type, t = LEDGE[k]; if (t) show('ledge-' + k, t[0], t[1]);
    }
    window.Tips = { item, ledge, show };
})();
