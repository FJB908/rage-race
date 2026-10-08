// TEST SWITCH (temporary): a small button next to the hanger on the home screen that picks which arena Arena Race is played in, so every
// arena can be tried without earning the trophies. It only changes the look, the power-up pool and the ledge types (not the opponents).
// To remove it later: delete this file, arenatest.css and their two tags in index.html (and `rr_arena_test` is simply ignored).
(function () {
    'use strict';
    const stage = document.querySelector('.m-stage'); if (!stage || !window.ArenaTheme) return;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'm-arenatest'; btn.setAttribute('aria-label', 'Test: choose the arena you play');
    (stage.querySelector('.m-tools') || stage).insertBefore(btn, (stage.querySelector('.m-tools') || stage).firstChild);          // left of the hanger, under the arena banner
    function label() { const t = ArenaTheme.testGet(); btn.innerHTML = '<b>' + (t < 0 ? 'A' : t + 1) + '</b><small>TEST</small>'; btn.classList.toggle('set', t >= 0); }
    function close() { const s = document.getElementById('at-sheet'); if (s) s.remove(); }
    function open() {
        close(); const cur = ArenaTheme.testGet(), real = Trophies.arenaOf(prog().tr || 0), s = document.createElement('div'); s.id = 'at-sheet';
        s.innerHTML = '<div class="at-card"><h3>Test: play in arena</h3><p>Changes the look, power-ups and ledges. Trophies and opponents stay yours.</p><div class="at-list"></div><button type="button" class="at-x">Close</button></div>';
        const list = s.querySelector('.at-list');
        const row = (i, name, sub, col) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'at-row' + (i === cur ? ' on' : ''); b.style.setProperty('--c', col);
            b.innerHTML = '<i>' + (i < 0 ? 'A' : i + 1) + '</i><span><b>' + name + '</b><small>' + sub + '</small></span>'; b.onclick = () => { ArenaTheme.testSet(i); label(); close(); if (window.SFX) SFX.play('select'); }; list.appendChild(b); };
        row(-1, 'Automatic', 'Your own arena: ' + ArenaTheme.THEMES[real].name, '#8b95a7');
        ArenaTheme.THEMES.forEach((t, i) => row(i, t.name, ArenaTheme.poolOfArena(i).length + ' power-ups', t.c));
        s.addEventListener('click', e => { if (e.target === s) close(); }); s.querySelector('.at-x').onclick = close;
        document.body.appendChild(s);
    }
    btn.addEventListener('click', e => { e.stopPropagation(); if (window.SFX) SFX.play('tap'); open(); });
    label();
})();
