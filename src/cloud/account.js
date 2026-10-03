// Profile-tab card for the cloud account. Needs cloud.js.
(function () {
    'use strict';
    const box = document.getElementById('m-acct'), title = document.getElementById('ma-title'), sub = document.getElementById('ma-sub'), btn = document.getElementById('ma-btn');
    if (!box || !window.Cloud) return;
    const ago = t => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : Math.floor(s / 86400) + ' d ago'; };
    function render() {
        const c = Cloud, st = c.status;
        box.classList.toggle('ok', st === 'ok' || st === 'syncing'); box.classList.toggle('err', st === 'error');
        btn.hidden = !(st === 'ok' || st === 'syncing' || st === 'error');
        if (!btn.dataset.sure) btn.textContent = c.anon ? 'SIGN IN' : 'SIGN OUT';
        if (st === 'off') { title.textContent = 'Cloud save'; sub.textContent = 'Connecting...'; }
        else if (st === 'offline') { title.textContent = 'Cloud save'; sub.textContent = 'Offline. Progress is kept on this phone and syncs later.'; }
        else if (st === 'error') { title.textContent = 'Cloud save'; sub.textContent = 'Could not sync (' + (c.error || 'error') + '). Will retry.'; }
        else if (c.anon) { title.textContent = 'Back up your progress'; sub.textContent = 'Saved to this device. Sign in to keep it safe and use it on other phones.'; }
        else { title.textContent = 'Cloud save on'; sub.textContent = (c.email || 'Google account') + (c.last ? ' · synced ' + ago(c.last) : ''); }
    }
    btn.addEventListener('click', async () => {
        if (!Cloud.anon) {                                              // sign out: ask twice
            if (!btn.dataset.sure) { btn.dataset.sure = '1'; btn.textContent = 'SURE?'; setTimeout(() => { btn.dataset.sure = ''; render(); }, 3000); return; }
            btn.disabled = true; btn.textContent = '...';
            try { await Cloud.signOut(); } catch (e) { toast(e.message === 'sync-failed' ? 'Could not save to the cloud, try again' : 'Could not sign out'); btn.dataset.sure = ''; btn.disabled = false; render(); }
            return;
        }
        btn.disabled = true;
        try { await Cloud.signInGoogle(); toast('Signed in'); }
        catch (e) { const code = String(e && e.code || e); if (!/popup-closed|cancelled/.test(code)) toast('Sign-in failed: ' + code.replace('auth/', '')); }
        btn.disabled = false; render();
    });
    Cloud.on(render); render();

    /* First open: a new player or an existing account. Players who already have progress skip this. */
    const CHOICE = 'rr_acct_choice';
    const hasProgress = () => { try { const q = JSON.parse(localStorage.getItem('rr_profile') || 'null'); return !!(q && (q.xp > 0 || q.races > 0 || q.passPointsEarned > 0 || (q.owned || []).filter(x => x !== 'classic' && x !== 'none').length > 0)) || +localStorage.getItem('rr_coins') > 0; } catch (e) { return false; } };   // the game itself writes an empty profile on first start
    let chosen = null; try { chosen = localStorage.getItem(CHOICE); if (!chosen && hasProgress()) { localStorage.setItem(CHOICE, 'existing'); chosen = 'existing'; } } catch (e) {}
    if (!chosen) {
        const el = document.createElement('div'); el.id = 'acct-choose';
        el.innerHTML = '<div class="ac-card"><h1>RAGE RACE</h1><p>How do you want to play?</p>' +
            '<button type="button" class="ac-new">NEW PLAYER</button>' +
            '<button type="button" class="ac-g" disabled>SIGN IN WITH GOOGLE</button>' +
            '<small class="ac-note">Already have an account? Sign in to get your progress back.</small></div>';
        document.body.appendChild(el);
        const gbtn = el.querySelector('.ac-g'), note = el.querySelector('.ac-note');
        const done = v => { try { localStorage.setItem(CHOICE, v); } catch (e) {} el.remove(); };
        el.querySelector('.ac-new').onclick = () => done('new');
        const upd = () => { const ok = Cloud.status === 'ok' || Cloud.status === 'syncing'; gbtn.disabled = !ok; note.textContent = ok ? 'Already have an account? Sign in to get your progress back.' : (Cloud.status === 'offline' || Cloud.status === 'error' ? 'Sign-in needs an internet connection.' : 'Connecting...'); };
        Cloud.on(upd); upd();
        gbtn.onclick = async () => {
            gbtn.disabled = true;
            try { try { localStorage.setItem(CHOICE, 'google'); } catch (e) {} await Cloud.signInGoogle(); el.remove(); }
            catch (e) { try { localStorage.removeItem(CHOICE); } catch (er) {} const code = String(e && e.code || e); if (!/popup-closed|cancelled/.test(code)) toast('Sign-in failed: ' + code.replace('auth/', '')); gbtn.disabled = false; }
        };
    }
    setInterval(() => { if (document.querySelector('.m-tab[data-tab="profile"]:not([hidden])')) render(); }, 30000);
})();
