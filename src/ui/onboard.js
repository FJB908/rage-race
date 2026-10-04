// ONBOARDING for a brand-new player: a short close-up of your character, you give it a name, then the tutorial starts by itself.
// Starts right after "NEW PLAYER" is tapped (account.js), and also after a reload if that was interrupted. Loaded before account.js.
(function () {
    'use strict';
    const DONE = 'rr_onboarded', $ = id => document.getElementById(id);
    let running = false;
    const seen = () => { try { return localStorage.getItem(DONE) === '1'; } catch (e) { return true; } };
    function finish(name) {
        try { localStorage.setItem(DONE, '1'); } catch (e) {}
        const q = prog(); if (name) q.name = name; saveProg(q); refreshMenu();
        const root = $('ob-root'); if (root) root.classList.add('out');
        setTimeout(() => { if (root) root.remove(); running = false; if (window.Tutorial) Tutorial.start(); }, 450);
    }
    function start() {
        if (running || seen()) return; running = true;
        const root = document.createElement('div'); root.id = 'ob-root';
        root.innerHTML = '<div class="ob-glow"></div><div class="ob-stage"><canvas id="ob-c" width="440" height="440"></canvas><i class="ob-sh"></i></div>' +
            '<div class="ob-copy"><small>WELCOME TO</small><h1>RAGE RACE</h1><div class="ob-ask"><label for="ob-name">What is your name?</label>' +
            '<input id="ob-name" type="text" maxlength="14" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Your name"><button type="button" id="ob-go" disabled>LET\'S GO</button><p>You can change it later.</p></div></div>';
        document.body.appendChild(root);
        try { renderLook($('ob-c'), myLook(), { scale:.26, cy:.6 }); } catch (e) {}
        try { SFX.play('open'); } catch (e) {}
        requestAnimationFrame(() => root.classList.add('in'));
        setTimeout(() => root.classList.add('ask'), 1500);
        const inp = $('ob-name'), go = $('ob-go');
        const ok = () => inp.value.trim().length >= 2;
        inp.addEventListener('input', () => { go.disabled = !ok(); });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter' && ok()) go.click(); });
        go.onclick = () => { if (!ok()) return; try { SFX.play('claim'); } catch (e) {} inp.blur(); finish(inp.value.trim().slice(0, 14)); };
        setTimeout(() => { try { inp.focus(); } catch (e) {} }, 2300);
    }
    // an interrupted onboarding (closed the app before naming): resume it
    setTimeout(() => { try {
        if (seen() || document.getElementById('acct-choose')) return;
        const p = JSON.parse(localStorage.getItem('rr_profile') || 'null'), ch = localStorage.getItem('rr_acct_choice');
        if (ch === 'new' && (!p || !(p.races > 0)) && localStorage.getItem('rr_tutorial_done') !== '1') start();
    } catch (e) {} }, 900);
    window.Onboard = { start };
})();
