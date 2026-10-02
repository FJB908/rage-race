// Shared currency icons. One source of truth: every coin / XP / pass-point label in the game uses these.
// Loaded BEFORE game.js. Usage: icon('coin') -> inline <svg>; R('coin', 120) -> "[icon] 120" chip markup.
(function () {
    const SPRITE =
        '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
        // --- COIN: bevelled gold disc with an embossed double chevron (the climb) ---
        '<linearGradient id="gcR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset=".5" stop-color="#f7b326"/><stop offset="1" stop-color="#b8690a"/></linearGradient>' +
        '<linearGradient id="gcF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd25a"/><stop offset="1" stop-color="#e8921a"/></linearGradient>' +
        // --- XP: electric bolt ---
        '<linearGradient id="gxB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe9ff"/><stop offset=".45" stop-color="#4fb4ff"/><stop offset="1" stop-color="#2459e0"/></linearGradient>' +
        // --- PASS: violet ticket with notches, perforation and a star ---
        '<linearGradient id="gpB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b3a9ff"/><stop offset=".55" stop-color="#7c6bff"/><stop offset="1" stop-color="#4a38c4"/></linearGradient>' +
        '<symbol id="ico-coin" viewBox="0 0 64 64">' +
          '<circle cx="32" cy="34" r="29" fill="#7a4300" opacity=".35"/>' +
          '<circle cx="32" cy="32" r="29" fill="url(#gcR)" stroke="#7a4300" stroke-width="2.5"/>' +
          '<circle cx="32" cy="32" r="22" fill="url(#gcF)" stroke="#b8690a" stroke-width="2"/>' +
          '<path d="M20 36 L32 24 L44 36 M20 45 L32 33 L44 45" fill="none" stroke="#8a4a00" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -3)"/>' +
          '<path d="M20 36 L32 24 L44 36 M20 45 L32 33 L44 45" fill="none" stroke="#fff3c4" stroke-opacity=".8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -4.5)"/>' +
          '<path d="M13 24 A22 22 0 0 1 28 11" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>' +
        '</symbol>' +
        '<symbol id="ico-xp" viewBox="0 0 64 64">' +
          '<path d="M40 5 L11 37 H27 L21 61 L53 25 H36 L45 5 Z" fill="#0b2a73" opacity=".4" transform="translate(0 3)"/>' +
          '<path d="M40 5 L11 37 H27 L21 61 L53 25 H36 L45 5 Z" fill="url(#gxB)" stroke="#0b2a73" stroke-width="3.5" stroke-linejoin="round"/>' +
          '<path d="M39 11 L20 33 M33 25 H44" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.6" stroke-linecap="round"/>' +
        '</symbol>' +
        '<symbol id="ico-pass" viewBox="0 0 64 64">' +
          '<path d="M6 11 H58 V24 A7 7 0 0 0 58 40 V53 H6 V40 A7 7 0 0 0 6 24 Z" fill="#1c1450" opacity=".4" transform="translate(0 3)"/>' +
          '<path d="M6 11 H58 V24 A7 7 0 0 0 58 40 V53 H6 V40 A7 7 0 0 0 6 24 Z" fill="url(#gpB)" stroke="#1c1450" stroke-width="3" stroke-linejoin="round"/>' +
          '<path d="M44 15 V49" stroke="#1c1450" stroke-opacity=".5" stroke-width="2" stroke-dasharray="3 3"/>' +
          '<path d="M24 22 L27.2 29 L35 29.9 L29.2 35 L30.9 42.5 L24 38.6 L17.1 42.5 L18.8 35 L13 29.9 L20.8 29 Z" fill="#fff" stroke="#1c1450" stroke-width="2" stroke-linejoin="round" transform="translate(32 32) scale(1.2) translate(-24 -32) translate(1 1)"/>' +
          '<path d="M10 16 H30" stroke="#fff" stroke-opacity=".5" stroke-width="2.5" stroke-linecap="round"/>' +
        '</symbol>' +
        '</defs></svg>';

    const mount = () => { if (!document.getElementById('ico-sprite')) { const d = document.createElement('div'); d.id = 'ico-sprite'; d.innerHTML = SPRITE; document.body.prepend(d); } };
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

    window.icon = (name, cls) => '<svg class="ico ico-' + name + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#ico-' + name + '"/></svg>';
    // Icon + number chip. opts.plus adds a leading "+", label is read by screen readers only.
    const LABEL = { coin:'coins', xp:'XP', pass:'pass points' };
    window.R = (name, n, opts) => {
        const num = typeof n === 'number' ? n.toLocaleString('en-US') : n;
        return '<span class="rwd rwd-' + name + '" role="img" aria-label="' + ((opts && opts.plus ? '+' : '') + num + ' ' + LABEL[name]) + '">' + icon(name) + '<b>' + (opts && opts.plus ? '+' : '') + num + '</b></span>';
    };
})();
