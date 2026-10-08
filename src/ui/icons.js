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
        '<linearGradient id="ggC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe0f8"/><stop offset="1" stop-color="#ff6fd8"/></linearGradient>' +
        '<linearGradient id="ggL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5fd2"/><stop offset="1" stop-color="#a0128a"/></linearGradient>' +
        '<linearGradient id="ggR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e63cb8"/><stop offset="1" stop-color="#6a0a5a"/></linearGradient>' +
        '<radialGradient id="gbm" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#6a7690"/><stop offset=".45" stop-color="#1d2331"/><stop offset="1" stop-color="#06080d"/></radialGradient>' +
        '<linearGradient id="gfl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe45e"/><stop offset=".5" stop-color="#ff9a1f"/><stop offset="1" stop-color="#e0301e"/></linearGradient>' +
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

        '<symbol id="ico-gem" viewBox="0 0 64 64">' +
          '<path d="M18 11 H46 L59 26 L32 58 L5 26 Z" fill="#3a0830" opacity=".4" transform="translate(0 2)"/>' +
          '<path d="M18 10 H46 L59 26 L32 58 L5 26 Z" fill="url(#ggL)" stroke="#3a0830" stroke-width="3.2" stroke-linejoin="round"/>' +
          '<path d="M5 26 L18 10 H46 L59 26 Z" fill="url(#ggC)"/>' +
          '<path d="M5 26 H59 L32 58 Z" fill="url(#ggL)"/>' +
          '<path d="M32 58 L59 26 H40 Z" fill="url(#ggR)"/>' +
          '<path d="M5 26 L18 10 M59 26 L46 10 M18 10 L25 26 M46 10 L39 26 M25 26 L32 58 M39 26 L32 58 M25 26 H39" fill="none" stroke="#3a0830" stroke-opacity=".5" stroke-width="1.6" stroke-linejoin="round"/>' +
          '<path d="M19 13 H30" stroke="#fff" stroke-opacity=".9" stroke-width="3" stroke-linecap="round"/><path d="M10 25 L14 19" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/>' +
        '</symbol>' +
        '<linearGradient id="gcal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a86"/><stop offset="1" stop-color="#e0304a"/></linearGradient>' +
        '<symbol id="ico-calendar" viewBox="0 0 64 64">' +
          '<rect x="7" y="12" width="50" height="46" rx="9" fill="#0d1017" opacity=".35" transform="translate(0 2.5)"/>' +
          '<rect x="7" y="11" width="50" height="46" rx="9" fill="#f4f6fb" stroke="#1b2130" stroke-width="3"/>' +
          '<path d="M7 20 Q7 11 16 11 H48 Q57 11 57 20 V26 H7 Z" fill="url(#gcal)" stroke="#1b2130" stroke-width="3" stroke-linejoin="round"/>' +
          '<rect x="19" y="4" width="6" height="13" rx="3" fill="#dfe5f2" stroke="#1b2130" stroke-width="2.6"/><rect x="39" y="4" width="6" height="13" rx="3" fill="#dfe5f2" stroke="#1b2130" stroke-width="2.6"/>' +
          '<g fill="#aab4c8"><rect x="14" y="31" width="7" height="6" rx="2"/><rect x="28.5" y="31" width="7" height="6" rx="2"/><rect x="43" y="31" width="7" height="6" rx="2"/><rect x="14" y="41" width="7" height="6" rx="2"/><rect x="43" y="41" width="7" height="6" rx="2"/></g>' +
          '<rect x="26.5" y="39" width="11" height="10" rx="3" fill="#ffb21f" stroke="#a65e00" stroke-width="2"/>' +
        '</symbol>' +
        '<symbol id="ico-hanger" viewBox="0 0 64 64">' +
          '<path d="M32 27 V21 C32 17.5 37.5 16.5 37.5 11.5 C37.5 6.5 31.5 5.5 28.8 9.3" fill="none" stroke="#10151f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M32 27 L8.5 45.5 C5.5 48 7 52.5 11 52.5 H53 C57 52.5 58.5 48 55.5 45.5 Z" fill="none" stroke="#10151f" stroke-width="8" stroke-linejoin="round"/>' +
          '<path d="M32 27 V21 C32 17.5 37.5 16.5 37.5 11.5 C37.5 6.5 31.5 5.5 28.8 9.3" fill="none" stroke="#eef2f9" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M32 27 L8.5 45.5 C5.5 48 7 52.5 11 52.5 H53 C57 52.5 58.5 48 55.5 45.5 Z" fill="rgba(53,224,200,.22)" stroke="#35e0c8" stroke-width="3.6" stroke-linejoin="round"/>' +
        '</symbol>' +
        '<linearGradient id="gtrp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27d"/><stop offset="1" stop-color="#f0a21a"/></linearGradient>' +
        '<symbol id="ico-trophy" viewBox="0 0 64 64">' +
          '<path d="M16 14 H9 C9 25 13 30.5 22 31.5 M48 14 H55 C55 25 51 30.5 42 31.5" fill="none" stroke="#e39a17" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M15 7 H49 V24 C49 33.6 41.6 40.5 32 40.5 C22.4 40.5 15 33.6 15 24 Z" fill="url(#gtrp)"/>' +
          '<path d="M20 11 H25.5 V24 C25.5 29 23.8 32.4 21.4 33.6 C19.8 31 20 27 20 24 Z" fill="#fff" opacity=".38"/>' +
          '<rect x="28.2" y="40" width="7.6" height="9" fill="#e39a17"/>' +
          '<rect x="19" y="49" width="26" height="8" rx="2.6" fill="url(#gtrp)"/>' +
        '</symbol>' +
        '<symbol id="ico-video" viewBox="0 0 64 64">' +
          '<rect x="6" y="14" width="52" height="38" rx="10" fill="#1b2130" stroke="#0a0d14" stroke-width="3"/>' +
          '<rect x="10" y="18" width="44" height="30" rx="7" fill="#2f3a52"/>' +
          '<path d="M26 24 L42 33 L26 42 Z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>' +
          '<path d="M14 24 H17" stroke="#fff" stroke-opacity=".35" stroke-width="2.6" stroke-linecap="round"/>' +
        '</symbol>' +
        '<symbol id="ico-flame" viewBox="0 0 64 64">' +
          '<path d="M32 4 C36 16 52 22 52 40 C52 52 43 60 32 60 C21 60 12 52 12 40 C12 31 17 27 20 22 C21 28 24 30 27 30 C25 20 28 11 32 4 Z" fill="#7a1408" opacity=".45" transform="translate(0 2)"/>' +
          '<path d="M32 3 C36 15 52 21 52 39 C52 51 43 59 32 59 C21 59 12 51 12 39 C12 30 17 26 20 21 C21 27 24 29 27 29 C25 19 28 10 32 3 Z" fill="url(#gfl)" stroke="#7a1408" stroke-width="3" stroke-linejoin="round"/>' +
          '<path d="M32 28 C34 36 42 38 42 47 C42 53 37 57 32 57 C27 57 22 53 22 47 C22 41 27 38 28 33 C30 36 31 35 32 28 Z" fill="#fff4a8" opacity=".95"/>' +
        '</symbol>' +
        '<linearGradient id="gcw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".45" stop-color="#ffc83a"/><stop offset="1" stop-color="#c47a10"/></linearGradient>' +
        '<linearGradient id="gky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9fffb"/><stop offset=".5" stop-color="#5eead4"/><stop offset="1" stop-color="#0e8f7e"/></linearGradient>' +
        // --- CROWN: gold, three jewelled peaks (the Gauntlet prize) ---
        '<symbol id="ico-crown" viewBox="0 0 64 64">' +
          '<path d="M7 50 L4 20 L19 33 L32 11 L45 33 L60 20 L57 50 Z" fill="#5a3300" opacity=".4" transform="translate(0 3)"/>' +
          '<path d="M7 50 L4 20 L19 33 L32 11 L45 33 L60 20 L57 50 Z" fill="url(#gcw)" stroke="#6b3d00" stroke-width="3" stroke-linejoin="round"/>' +
          '<path d="M7 50 H57 V57 Q57 59 55 59 H9 Q7 59 7 57 Z" fill="url(#gcR)" stroke="#6b3d00" stroke-width="3" stroke-linejoin="round"/>' +
          '<path d="M19 33 L32 22 L45 33" fill="none" stroke="#fff6c4" stroke-opacity=".7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<circle cx="32" cy="11" r="4.2" fill="#ff5470" stroke="#6b3d00" stroke-width="2.2"/><circle cx="4" cy="20" r="3.4" fill="#35e0c8" stroke="#6b3d00" stroke-width="2"/><circle cx="60" cy="20" r="3.4" fill="#7c6bff" stroke="#6b3d00" stroke-width="2"/>' +
          '<circle cx="32" cy="43" r="4" fill="#ff5470" stroke="#6b3d00" stroke-width="2"/><circle cx="18" cy="43" r="2.8" fill="#35e0c8" stroke="#6b3d00" stroke-width="1.8"/><circle cx="46" cy="43" r="2.8" fill="#35e0c8" stroke="#6b3d00" stroke-width="1.8"/>' +
          '<path d="M12 53 H30" stroke="#fff" stroke-opacity=".55" stroke-width="2.2" stroke-linecap="round"/>' +
        '</symbol>' +
        // --- KEY: teal key, the free way into the Gauntlet ---
        '<symbol id="ico-key" viewBox="0 0 64 64">' +
          '<circle cx="22" cy="24" r="17" fill="#04332c" opacity=".4" transform="translate(0 3)"/>' +
          '<path d="M33 35 L56 58 M46 48 L40 54 M53 55 L47 61" stroke="#04332c" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" opacity=".4" fill="none" transform="translate(0 3)"/>' +
          '<path d="M33 35 L56 58" stroke="#04332c" stroke-width="12" stroke-linecap="round" fill="none"/>' +
          '<path d="M33 35 L56 58" stroke="url(#gky)" stroke-width="7" stroke-linecap="round" fill="none"/>' +
          '<path d="M46 48 L52 42 M53 55 L59 49" stroke="#04332c" stroke-width="10" stroke-linecap="round" fill="none"/>' +
          '<path d="M46 48 L52 42 M53 55 L59 49" stroke="url(#gky)" stroke-width="5" stroke-linecap="round" fill="none"/>' +
          '<circle cx="22" cy="24" r="17" fill="url(#gky)" stroke="#04332c" stroke-width="3.2"/>' +
          '<circle cx="22" cy="24" r="7" fill="#0d1017" stroke="#04332c" stroke-width="2.4"/>' +
          '<path d="M10 17 A14 14 0 0 1 20 10" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="3" stroke-linecap="round"/>' +
        '</symbol>' +
        // --- PLAYERS: three of the game's own rounded squares, eyes and all ---
        '<symbol id="ico-users" viewBox="0 0 64 64">' +
          '<rect x="5" y="22" width="26" height="26" rx="7" fill="#7c6bff" stroke="#1c1450" stroke-width="3"/><circle cx="14" cy="33" r="2.6" fill="#0d1017"/><circle cx="23" cy="33" r="2.6" fill="#0d1017"/>' +
          '<rect x="33" y="22" width="26" height="26" rx="7" fill="#ff5470" stroke="#4a0c22" stroke-width="3"/><circle cx="42" cy="33" r="2.6" fill="#0d1017"/><circle cx="51" cy="33" r="2.6" fill="#0d1017"/>' +
          '<rect x="19" y="10" width="26" height="26" rx="7" fill="#35e0c8" stroke="#04332c" stroke-width="3"/><circle cx="28" cy="21" r="2.6" fill="#0d1017"/><circle cx="37" cy="21" r="2.6" fill="#0d1017"/>' +
          '<path d="M24 14 Q30 11 36 12" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/>' +
        '</symbol>' +
        // --- MODE ICONS ---
        '<symbol id="ico-mode-race" viewBox="0 0 64 64">' +
          '<rect x="11" y="6" width="5" height="52" rx="2.5" fill="#cfd6e6" stroke="#0d1017" stroke-width="2.5"/><ellipse cx="13.5" cy="58" rx="9" ry="3" fill="#0d1017" opacity=".45"/>' +
          '<path d="M16 9 H55 L49 22 L55 35 H16 Z" fill="#fff" stroke="#0d1017" stroke-width="3" stroke-linejoin="round"/>' +
          '<path d="M16 9 H55 L49 22 L55 35 H16 Z" fill="#0d1017" opacity=".0"/>' +
          '<g fill="#0d1017"><rect x="16" y="9" width="10" height="8.7"/><rect x="36" y="9" width="10" height="8.7"/><rect x="26" y="17.7" width="10" height="8.6"/><rect x="46" y="17.7" width="6" height="8.6"/><rect x="16" y="26.3" width="10" height="8.7"/><rect x="36" y="26.3" width="10" height="8.7"/></g>' +
          '<path d="M16 9 H55 L49 22 L55 35 H16 Z" fill="none" stroke="#0d1017" stroke-width="3" stroke-linejoin="round"/>' +
          '<circle cx="13.5" cy="6" r="4" fill="#35e0c8" stroke="#0d1017" stroke-width="2.4"/>' +
        '</symbol>' +
        '<symbol id="ico-mode-build" viewBox="0 0 64 64">' +
          '<rect x="6" y="44" width="30" height="9" rx="4" fill="#4ade80" stroke="#0d3a1c" stroke-width="2.5"/>' +
          '<rect x="30" y="26" width="28" height="9" rx="4" fill="#7c6bff" stroke="#1d1650" stroke-width="2.5"/>' +
          '<path d="M10 14 l7 -7 l7 7 l-3 3 l-4 -4 l-4 4z" fill="#ff5470" stroke="#5a0f24" stroke-width="2" stroke-linejoin="round"/>' +
          '<path d="M44 8 l10 10 M44 18 l10 -10" stroke="#ffcf3f" stroke-width="4" stroke-linecap="round"/>' +
        '</symbol>' +
        '<symbol id="ico-mode-arcade" viewBox="0 0 64 64">' +
          '<ellipse cx="32" cy="58" rx="22" ry="3.5" fill="#000" opacity=".28"/>' +
          '<rect x="8" y="34" width="48" height="22" rx="8" fill="#6b4fd8" stroke="#1c1450" stroke-width="3"/>' +
          '<rect x="12" y="38" width="40" height="6" rx="3" fill="#fff" opacity=".18"/>' +
          '<rect x="29" y="14" width="6" height="22" rx="3" fill="#9aa4c0" stroke="#1c1450" stroke-width="2.4"/>' +
          '<circle cx="32" cy="12" r="9" fill="#ff5470" stroke="#5a0f24" stroke-width="3"/><circle cx="29" cy="9" r="2.6" fill="#fff" opacity=".55"/>' +
          '<circle cx="17" cy="46" r="4" fill="#ffcf3f" stroke="#6b3d00" stroke-width="2"/><circle cx="47" cy="46" r="4" fill="#35e0c8" stroke="#0d3a33" stroke-width="2"/>' +
        '</symbol>' +
        '<symbol id="ico-ar-giant" viewBox="0 0 64 64">' +
          '<ellipse cx="32" cy="59" rx="24" ry="3.5" fill="#000" opacity=".28"/>' +
          '<rect x="8" y="10" width="48" height="46" rx="11" fill="#ff6f91" stroke="#5a1230" stroke-width="3.2"/>' +
          '<path d="M13 16 Q22 11 35 12" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3.4" stroke-linecap="round"/>' +
          '<circle cx="23" cy="31" r="6" fill="#fff"/><circle cx="41" cy="31" r="6" fill="#fff"/><circle cx="24.5" cy="32.5" r="3" fill="#0d1017"/><circle cx="39.5" cy="32.5" r="3" fill="#0d1017"/>' +
          '<path d="M14 21 L28 27 M50 21 L36 27" stroke="#2a0a18" stroke-width="3.6" stroke-linecap="round"/>' +
          '<rect x="22" y="43" width="20" height="6" rx="3" fill="#2a0a18"/><path d="M26 43 v5 M32 43 v5 M38 43 v5" stroke="#fff" stroke-width="1.6"/>' +
        '</symbol>' +
        '<symbol id="ico-ar-sink" viewBox="0 0 64 64">' +
          '<path d="M6 40 H29 L26 47 H6 Z" fill="#4ade80" stroke="#0d3a1c" stroke-width="3" stroke-linejoin="round"/>' +
          '<path d="M36 36 H58 V43 H33 Z" fill="#4ade80" stroke="#0d3a1c" stroke-width="3" stroke-linejoin="round" transform="rotate(8 46 40)"/>' +
          '<path d="M24 52 l7 4 l-3 6 l-7 -3 Z" fill="#7bd88f" stroke="#0d3a1c" stroke-width="2.4" stroke-linejoin="round"/>' +
          '<rect x="22" y="14" width="18" height="18" rx="5" fill="#35e0c8" stroke="#0d3a33" stroke-width="3"/><circle cx="28" cy="22" r="2.4" fill="#0d1017"/><circle cx="35" cy="22" r="2.4" fill="#0d1017"/>' +
          '<path d="M5 56 Q14 50 22 56 T40 56 T58 56 V62 H5 Z" fill="#3b82f6" opacity=".85"/>' +
        '</symbol>' +
        '<symbol id="ico-mode-tag" viewBox="0 0 64 64">' +
          '<ellipse cx="30" cy="57" rx="19" ry="3.5" fill="#000" opacity=".28"/>' +
          '<circle cx="30" cy="36" r="21" fill="url(#gbm)" stroke="#06080d" stroke-width="3"/>' +
          '<path d="M16 24 Q22 15 33 14" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="3.2" stroke-linecap="round"/>' +
          '<rect x="24" y="10" width="13" height="8" rx="2.5" fill="#8892a6" stroke="#06080d" stroke-width="2.5"/>' +
          '<path d="M31 10 Q36 3 45 6" fill="none" stroke="#d8b06a" stroke-width="3" stroke-linecap="round"/>' +
          '<path d="M47 0 L49.2 5 L54.5 5.4 L50.4 8.6 L51.8 13.8 L47 11 L42.2 13.8 L43.6 8.6 L39.5 5.4 L44.8 5 Z" fill="#ffe27a" stroke="#ff7a2e" stroke-width="1.8" stroke-linejoin="round"/>' +
          '<circle cx="23" cy="35" r="4.6" fill="#fff"/><circle cx="37" cy="35" r="4.6" fill="#fff"/><circle cx="24" cy="36" r="2.3" fill="#06080d"/><circle cx="36" cy="36" r="2.3" fill="#06080d"/>' +
          '<path d="M17 28 L27 32 M43 28 L33 32" stroke="#ff5470" stroke-width="3" stroke-linecap="round"/>' +
        '</symbol>' +
        '<symbol id="ico-mode-escape" viewBox="0 0 64 64">' +
          '<path d="M3 47 Q11 41 19 47 T35 47 T51 47 T61 47 V62 H3 Z" fill="#14060c" opacity=".5" transform="translate(0 2)"/>' +
          '<path d="M3 47 Q11 41 19 47 T35 47 T51 47 T61 47 V62 H3 Z" fill="url(#gfl)" stroke="#7a1408" stroke-width="3" stroke-linejoin="round"/>' +
          '<path d="M3 47 Q11 41 19 47 T35 47 T51 47 T61 47" fill="none" stroke="#ffe3a0" stroke-opacity=".8" stroke-width="2" stroke-linecap="round"/>' +
          '<path d="M32 5 L47 22 H38 V40 H26 V22 H17 Z" fill="#fff" stroke="#0d1017" stroke-width="3" stroke-linejoin="round"/>' +
          '<path d="M32 12 L40 21 M32 12 L24 21" stroke="#35e0c8" stroke-width="2.6" stroke-linecap="round" fill="none"/>' +
          '<circle cx="9" cy="35" r="2" fill="#ff5470"/><circle cx="56" cy="31" r="2.4" fill="#ff9838"/><circle cx="49" cy="40" r="1.6" fill="#ffd25a"/>' +
        '</symbol>' +
        '<symbol id="ico-mode-levels" viewBox="0 0 64 64">' +
          '<path d="M5 58 V44 H19 V31 H33 V18 H47 V58 Z" fill="#1c1450" opacity=".4" transform="translate(0 3)"/>' +
          '<path d="M5 58 V44 H19 V31 H33 V18 H47 V58 Z" fill="url(#gpB)" stroke="#1c1450" stroke-width="3" stroke-linejoin="round"/>' +
          '<path d="M5 44 H19 V31 H33 V18 H47" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.2" stroke-linejoin="round"/>' +
          '<path d="M52 4 L55.3 11.2 L63 12 L57.2 17.3 L58.9 25 L52 21 L45.1 25 L46.8 17.3 L41 12 L48.7 11.2 Z" fill="url(#gcw)" stroke="#6b3d00" stroke-width="2.4" stroke-linejoin="round"/>' +
        '</symbol>' +
        '<symbol id="ico-star" viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></symbol>' +
        '<symbol id="ico-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>' +
        '<symbol id="ico-missions" viewBox="0 0 64 64">' +
          '<rect x="12" y="10" width="40" height="48" rx="8" fill="#1d3a46" stroke="#0d1d24" stroke-width="3"/>' +
          '<rect x="22" y="5" width="20" height="12" rx="5" fill="#35e0c8" stroke="#0d1d24" stroke-width="3"/>' +
          '<path d="M19 28l4 4 7-8" fill="none" stroke="#35e0c8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M19 43l4 4 7-8" fill="none" stroke="#ffcf3f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<rect x="34" y="27" width="12" height="4" rx="2" fill="#7fa0ad"/><rect x="34" y="42" width="12" height="4" rx="2" fill="#7fa0ad"/>' +
        '</symbol>' +
        '<symbol id="ico-chev-l" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
        '<symbol id="ico-chev-r" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
        '<symbol id="ico-arrow-up" viewBox="0 0 24 24"><path d="M12 20V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
        '<symbol id="ico-arrow-down" viewBox="0 0 24 24"><path d="M12 4v15M5.5 12.5L12 19l6.5-6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
        '<symbol id="ico-home" viewBox="0 0 24 24"><path d="M3.5 11.5L12 4l8.5 7.5M6 10v9.5h4.5v-5h3v5H18V10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
        '</defs></svg>';


    // Supply crate icons, one per rarity (same design language as the big crate in lootbox.js: more detail for rarer crates).
    const dropSymbols = () => {
        const D = '#0b0e16', IC = 'style="fill:var(--ic,#35e0c8)"', ST = 'style="stroke:var(--ic,#35e0c8)"';
        const one = (id, T) => {
            const crown = T === 4 ? '<path d="M14 14 L17 5 L24 11 L32 2 L40 11 L47 5 L50 14 Z" ' + IC + ' stroke="' + D + '" stroke-width="2" stroke-linejoin="round"/>' : '';
            const caps = T >= 2 ? '<path d="M8 38 V35 Q8 31 12 31 H15 M56 38 V35 Q56 31 52 31 H49 M8 48 V51 Q8 57 14 57 H17 M56 48 V51 Q56 57 50 57 H47" fill="none" ' + ST + ' stroke-width="2.6" stroke-linecap="round"/>' : '';
            const lock = T === 0 ? '<circle cx="32" cy="21" r="3.4" fill="#5c6a8c" stroke="' + D + '" stroke-width="2"/>'
                : T === 1 ? '<circle cx="32" cy="21" r="4.4" ' + IC + ' stroke="' + D + '" stroke-width="2"/><circle cx="30.6" cy="19.6" r="1.3" fill="#fff"/>'
                : '<path d="M32 15 L38.5 21.5 L32 28 L25.5 21.5 Z" ' + IC + ' stroke="' + (T >= 3 ? '#fff' : D) + '" stroke-width="2" stroke-linejoin="round"/><path d="M29 20 L32 17.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>';
            const rim = T >= 3 ? '<rect x="8" y="28" width="48" height="29" rx="7" fill="none" ' + ST + ' stroke-width="1.2" opacity=".9"/>' : '';
            return '<symbol id="' + id + '" viewBox="0 0 64 64">' + crown +
              '<ellipse cx="32" cy="60" rx="24" ry="3" fill="#000" opacity=".3"/>' +
              '<rect x="8" y="28" width="48" height="29" rx="7" fill="url(#gdb)" stroke="' + D + '" stroke-width="2.6"/>' + rim + caps +
              '<rect x="15" y="28" width="6" height="28" ' + IC + ' stroke="' + D + '" stroke-width="1.6"/><rect x="43" y="28" width="6" height="28" ' + IC + ' stroke="' + D + '" stroke-width="1.6"/>' +
              '<path d="M25 47 L32 40 L39 47 M25 53 L32 46 L39 53" fill="none" stroke="' + D + '" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -2)"/>' +
              '<path d="M25 47 L32 40 L39 47 M25 53 L32 46 L39 53" fill="none" ' + ST + ' stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -2)"/>' +
              '<rect x="5" y="12" width="54" height="19" rx="9" fill="url(#gdl)" stroke="' + D + '" stroke-width="2.6"/>' +
              '<rect x="15" y="12" width="6" height="19" ' + IC + ' stroke="' + D + '" stroke-width="1.6"/><rect x="43" y="12" width="6" height="19" ' + IC + ' stroke="' + D + '" stroke-width="1.6"/>' +
              '<rect x="7" y="25" width="50" height="3.2" rx="1.6" ' + IC + '/>' + lock +
              '<path d="M11 18 Q15 15 22 15" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/></symbol>';
        };
        return '<linearGradient id="gdb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46526f"/><stop offset=".5" stop-color="#2a3350"/><stop offset="1" stop-color="#151a2b"/></linearGradient>' +
            '<linearGradient id="gdl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b7ba3"/><stop offset="1" stop-color="#2f3a56"/></linearGradient>' +
            one('ico-drop', 0) + one('ico-drop-common', 0) + one('ico-drop-rare', 1) + one('ico-drop-epic', 2) + one('ico-drop-mythic', 3) + one('ico-drop-legendary', 4);
    };
    const mount = () => { if (!document.getElementById('ico-sprite')) { const d = document.createElement('div'); d.id = 'ico-sprite'; d.innerHTML = SPRITE.replace('</defs></svg>', dropSymbols() + '</defs></svg>'); document.body.prepend(d); } };
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

    window.icon = (name, cls) => '<svg class="ico ico-' + name + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#ico-' + name + '"/></svg>';
    // Icon + number chip. opts.plus adds a leading "+", label is read by screen readers only.
    const LABEL = { coin:'coins', xp:'XP', pass:'pass points', gem:'gems', key:'keys', crown:'crowns' };
    window.R = (name, n, opts) => {
        const num = typeof n === 'number' ? n.toLocaleString('en-US') : n;
        return '<span class="rwd rwd-' + name + '" role="img" aria-label="' + ((opts && opts.plus ? '+' : '') + num + ' ' + LABEL[name]) + '">' + icon(name) + '<b>' + (opts && opts.plus ? '+' : '') + num + '</b></span>';
    };
})();
