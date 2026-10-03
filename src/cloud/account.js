// Profile-tab card for the cloud account. Needs cloud.js.
(function () {
    'use strict';
    const box = document.getElementById('m-acct'), title = document.getElementById('ma-title'), sub = document.getElementById('ma-sub'), btn = document.getElementById('ma-btn');
    if (!box || !window.Cloud) return;
    const ago = t => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : Math.floor(s / 86400) + ' d ago'; };
    function render() {
        const c = Cloud, st = c.status;
        box.classList.toggle('ok', st === 'ok' || st === 'syncing'); box.classList.toggle('err', st === 'error');
        btn.hidden = !(c.anon && (st === 'ok' || st === 'syncing' || st === 'error'));
        if (st === 'off') { title.textContent = 'Cloud save'; sub.textContent = 'Connecting...'; }
        else if (st === 'offline') { title.textContent = 'Cloud save'; sub.textContent = 'Offline. Progress is kept on this phone and syncs later.'; }
        else if (st === 'error') { title.textContent = 'Cloud save'; sub.textContent = 'Could not sync (' + (c.error || 'error') + '). Will retry.'; }
        else if (c.anon) { title.textContent = 'Back up your progress'; sub.textContent = 'Saved to this device. Sign in to keep it safe and use it on other phones.'; }
        else { title.textContent = 'Cloud save on'; sub.textContent = (c.email || 'Google account') + (c.last ? ' · synced ' + ago(c.last) : ''); }
    }
    btn.addEventListener('click', async () => {
        btn.disabled = true;
        try { await Cloud.signInGoogle(); toast('Signed in'); }
        catch (e) { const code = String(e && e.code || e); if (!/popup-closed|cancelled/.test(code)) toast('Sign-in failed: ' + code.replace('auth/', '')); }
        btn.disabled = false; render();
    });
    Cloud.on(render); render();
    setInterval(() => { if (document.querySelector('.m-tab[data-tab="profile"]:not([hidden])')) render(); }, 30000);
})();
