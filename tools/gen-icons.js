// Draws the Android launcher icons (the teal cube) straight into android/app/src/main/res. Run: node tools/gen-icons.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const res = path.join(__dirname, '..', 'android/app/src/main/res');
const cube = (S, pad) => { const s = S * (0.5 - pad), r = s * 0.2; return `<g transform="translate(${S/2} ${S/2})"><rect x="${-s}" y="${-s}" width="${s*2}" height="${s*2}" rx="${r}" fill="url(#g)" stroke="rgba(13,16,23,.55)" stroke-width="${s*0.06}"/><ellipse cx="${-s*0.33}" cy="${-s*0.45}" rx="${s*0.4}" ry="${s*0.18}" fill="rgba(255,255,255,.35)" transform="rotate(-20 ${-s*0.33} ${-s*0.45})"/><circle cx="${-s*0.33}" cy="${-s*0.1}" r="${s*0.2}" fill="#0d1017"/><circle cx="${s*0.33}" cy="${-s*0.1}" r="${s*0.2}" fill="#0d1017"/></g>`; };
const svg = (S, kind) => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ff3dc"/><stop offset="1" stop-color="#1fb89f"/></linearGradient><radialGradient id="b" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#1b2433"/><stop offset="1" stop-color="#0d1017"/></radialGradient></defs>` +
  (kind === 'fg' ? '' : `<rect width="${S}" height="${S}" rx="${kind === 'round' ? S/2 : kind === 'flat' ? 0 : S*0.22}" fill="url(#b)"/>`) + cube(S, kind === 'fg' ? 0.3 : 0.2) + '</svg>';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }), p = await b.newPage();
  const shot = async (S, kind, file) => { await p.setViewportSize({ width: S, height: S }); await p.setContent('<body style="margin:0;background:transparent">' + svg(S, kind) + '</body>'); fs.writeFileSync(file, await p.screenshot({ omitBackground: true })); };
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, m] of Object.entries(dens)) {
    const dir = path.join(res, 'mipmap-' + d);
    await shot(Math.round(48 * m), 'square', path.join(dir, 'ic_launcher.png'));
    await shot(Math.round(48 * m), 'round', path.join(dir, 'ic_launcher_round.png'));
    await shot(Math.round(108 * m), 'fg', path.join(dir, 'ic_launcher_foreground.png'));
  }
  await shot(512, 'flat', path.join(__dirname, '..', 'docs/play-store-icon-512.png'));
  fs.writeFileSync(path.join(res, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0D1017</color>\n</resources>\n');
  await b.close(); console.log('icons written');
})();
