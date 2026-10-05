// PODIUM: the same victory stand on every result screen. 1st in the middle, 2nd left, 3rd right; the steps rise one after the other and the characters
// react: the winner jumps for joy (confetti, hop, salto), 2nd and 3rd cheer, and a player who missed the podium stands next to it, sulking under a rain cloud.
// Podium.html(entries, opts) returns the markup, Podium.start(root) brings the characters to life. Entries are ordered best first:
//   { name, look, color, me, sub }   opts: { extra: entry for the local player when outside the top 3, extraRank, solo: 'one winner, no steps compared' }
(function () {
    'use strict';
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const ORD = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
    const MOOD = { 1: 'win', 2: 'cheer', 3: 'cheer' };
    let seq = 0;
    function cell(e, rank, cls, extra) {
        const id = 'pd' + (++seq);
        return '<div class="pd-col ' + cls + (e.me ? ' me' : '') + '" data-rank="' + rank + '"><div class="pd-who">' +
            (rank === 1 ? '<span class="pd-crown">' + (window.icon ? icon('crown') : '') + '</span>' : '') +
            '<canvas width="260" height="300" data-pd="' + id + '" data-rank="' + rank + '"></canvas>' +
            '<b>' + (e.me ? 'YOU' : esc(e.name)) + '</b>' + (e.sub ? '<small>' + esc(e.sub) + '</small>' : '') + '</div>' +
            (extra ? '<div class="pd-plate"><i>' + ORD(rank) + '</i></div>' : '<div class="pd-step"><i>' + rank + '</i></div>') + '</div>';
    }
    function html(entries, o) {
        o = o || {}; const top = entries.slice(0, 3); if (!top.length) return '';
        const cols = [];
        if (top[1]) cols.push(cell(top[1], 2, 'second'));
        cols.push(cell(top[0], 1, 'first'));
        if (top[2]) cols.push(cell(top[2], 3, 'third'));
        if (o.extra) cols.push(cell(o.extra, o.extraRank || 4, 'fourth', true));
        const data = encodeURIComponent(JSON.stringify([top[0], top[1], top[2], o.extra].map(e => e ? { look: e.look || {}, color: e.color || '' } : null)));
        return '<div class="pd-stand n' + cols.length + (o.extra ? ' has-extra' : '') + (top.length === 1 ? ' solo' : '') + '" data-pd-looks="' + data + '"><div class="pd-beam"></div><div class="pd-row">' + cols.join('') + '</div></div>';
    }
    function start(root) {
        root = typeof root === 'string' ? document.getElementById(root) : root; if (!root || !window.CharAnim) return;
        root.querySelectorAll('.pd-stand').forEach(st => {
            let looks = []; try { looks = JSON.parse(decodeURIComponent(st.dataset.pdLooks)); } catch (e) {}
            const map = { 1: looks[0], 2: looks[1], 3: looks[2], 4: looks[3] };
            st.querySelectorAll('canvas[data-pd]').forEach(cv => {
                const r = +cv.dataset.rank, d = map[r] || map[4] || {}, delay = { 3: .15, 2: .55, 1: 1.0, 4: 1.3 }[r] || 0;
                const mood = MOOD[r] || 'lose', a = CharAnim.actor(cv, () => d.look || {}, { mood, delay, cloud: r > 3, confetti: r === 2, color: d.color || undefined, opts: { scale: .205, cy: .62 } });
                a.setLook(d.look || {});
            });
        });
    }
    window.Podium = { html, start, ORD };
})();
