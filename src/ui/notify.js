// REMINDER NOTIFICATIONS (Android app only, local: no server, nothing leaves the phone).
// At most ONE a day, always in the afternoon / evening (never at night), only when the player has opted in, and a switch in Settings turns them all off at once:
//   - the daily reward / streak reminder (the next 19:00 when today's reward is not claimed yet, otherwise tomorrow 19:00)
//   - "your cube is waiting" after 2 days away (18:30), and one last "start a new streak" after 6 days
// They are planned when the app goes to the background and cancelled the moment it is opened again, so a reminder can never pop up while you play.
// The first time (after a first win) a small sheet asks; "Not now" is remembered and the switch in Settings stays available.
(function () {
    'use strict';
    const PREF = 'rr_notif', ASKED = 'rr_notif_asked', IDS = [4101, 4102, 4103], CHANNEL = 'reminders';
    const cap = window.Capacitor, LN = () => cap && cap.Plugins && cap.Plugins.LocalNotifications;
    const supported = () => !!(cap && cap.isNativePlatform && cap.isNativePlatform() && LN());
    const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
    const enabled = () => get(PREF) === '1';
    const $ = id => document.getElementById(id);
    let channelDone = false;

    async function permission(ask) {
        const ln = LN(); if (!ln) return false;
        try {
            let st = await ln.checkPermissions();
            if (st.display === 'granted') return true;
            if (!ask) return false;
            st = await ln.requestPermissions(); return st.display === 'granted';
        } catch (e) { return false; }
    }
    async function ensureChannel() {
        if (channelDone) return; const ln = LN(); if (!ln) return;
        try { await ln.createChannel({ id: CHANNEL, name: 'Reminders', description: 'Daily reward and streak reminders', importance: 3, visibility: 1 }); } catch (e) {}
        channelDone = true;
    }
    async function cancelAll() {
        const ln = LN(); if (!ln) return;
        try { await ln.cancel({ notifications: IDS.map(id => ({ id })) }); } catch (e) {}
    }
    function at(daysAhead, h, m) { const d = new Date(); d.setDate(d.getDate() + daysAhead); d.setHours(h, m, 0, 0); return d; }
    // what to plan, as plain data (also used by the test)
    function plan(now) {
        now = now || new Date(); const list = [];
        const st = window.Streak ? Streak.state() : { streak: 0, claimedToday: false, nextDay: 1, canClaim: true };
        let when = at(0, 19, 0); if (when <= new Date(now.getTime() + 20 * 60000) || st.claimedToday) when = at(1, 19, 0);
        const n = st.claimedToday ? st.streak : st.streak;
        list.push({ id: IDS[0], at: when, title: n > 1 ? 'Your ' + n + ' day streak is in danger' : 'Your daily reward is waiting', body: n > 1 ? "Claim today's reward to keep your streak going." : 'Day ' + (st.nextDay || 1) + ' is ready. It takes a few seconds.' });
        list.push({ id: IDS[1], at: at(2, 18, 30), title: 'Your cube is waiting', body: 'A free daily reward and a quick race are ready for you.' });
        list.push({ id: IDS[2], at: at(6, 18, 30), title: 'Start a new streak', body: 'Day 1 of a new streak is a free reward. Come back for it.' });
        return list;
    }
    async function schedule() {
        if (!supported() || !enabled()) return;
        if (!(await permission(false))) return;
        await cancelAll(); await ensureChannel();
        try {
            await LN().schedule({ notifications: plan().map(p => ({ id: p.id, title: p.title, body: p.body, channelId: CHANNEL, schedule: { at: p.at, allowWhileIdle: true }, smallIcon: 'ic_stat_cube', iconColor: '#35E0C8' })) });
        } catch (e) {}
    }
    async function enable() {
        if (!supported()) { if (typeof toast === 'function') toast('Reminders work in the Android app'); return false; }
        const ok = await permission(true);
        if (!ok) { put(PREF, '0'); if (typeof toast === 'function') toast('Notifications are blocked: allow them in the Android settings'); syncSettings(); return false; }
        put(PREF, '1'); syncSettings(); schedule(); return true;
    }
    function disable() { put(PREF, '0'); cancelAll(); syncSettings(); }

    /* ------------------------------------------------------------ settings switch ---- */
    function syncSettings() { const row = $('set-notif-row'), b = $('set-notif'); if (row) row.hidden = !supported(); if (b) b.classList.toggle('on', enabled()); }
    const sw = $('set-notif');
    if (sw) sw.addEventListener('click', async () => { if (enabled()) disable(); else await enable(); syncSettings(); if (window.SFX) SFX.play('toggle'); });

    /* ------------------------------------------------------------ the first question ---- */
    let askedNow = false;
    function maybeAsk() {
        if (askedNow || !supported() || get(PREF) !== null || get(ASKED)) return;
        const p = prog(); if ((p.wins || 0) < 1 || (p.races || 0) < 3) return;
        askedNow = true;
        setTimeout(() => {
            const s = $('s-start'); if (!s || s.style.display === 'none' || (typeof state !== 'undefined' && state !== 'menu')) { askedNow = false; return; }
            if (document.querySelector('.lb-overlay, .pt-sheet, #nf-sheet')) { askedNow = false; return; }
            const el = document.createElement('div'); el.id = 'nf-sheet'; el.className = 'nf-sheet';
            el.innerHTML = '<div class="nf-card"><h3>Reminders?</h3><p>One small reminder a day at most, in the evening, so you do not lose your daily streak. You can turn it off any time in Settings.</p>' +
                '<button class="btn" type="button" data-a="yes">YES, REMIND ME</button><button class="btn ghost" type="button" data-a="no">NOT NOW</button></div>';
            document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
            put(ASKED, '1');
            el.addEventListener('click', async e => { const a = e.target.dataset && e.target.dataset.a; if (!a) return; el.classList.remove('in'); setTimeout(() => el.remove(), 220); if (a === 'yes') await enable(); });
        }, 2500);
    }

    // planned when the app goes to the background, cancelled when it comes back
    document.addEventListener('visibilitychange', () => { if (!supported() || !enabled()) return; if (document.hidden) schedule(); else cancelAll(); });
    setTimeout(() => { if (supported() && enabled() && !document.hidden) cancelAll(); syncSettings(); }, 1500);

    window.Notify = { supported, enabled, enable, disable, schedule, plan, maybeAsk, syncSettings };
})();
