// Draws the Android launcher icons (the teal cube) straight into android/app/src/main/res. Run: node tools/gen-icons.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const res = path.join(__dirname, '..', 'android/app/src/main/res');
// The icon is only the cube: no background tile. Adaptive icons get a transparent background layer and the cube stays inside the safe zone.
const cube = (S, half) => { const s = S * half, r = s * 0.26, e = s * 0.2; return `<g transform="translate(${S/2} ${S/2})">
  <ellipse cx="0" cy="${s*1.1}" rx="${s*0.8}" ry="${s*0.13}" fill="rgba(0,0,0,.28)" filter="url(#bl)"/>
  <rect x="${-s}" y="${-s}" width="${s*2}" height="${s*2}" rx="${r}" fill="#0f7f6c"/>
  <rect x="${-s}" y="${-s}" width="${s*2}" height="${s*2-s*0.07}" rx="${r}" fill="url(#g)" stroke="#0a3f37" stroke-width="${s*0.07}"/>
  <rect x="${-s*0.9}" y="${-s*0.9}" width="${s*1.8}" height="${s*0.9}" rx="${r*0.8}" fill="url(#sh)"/>
  <ellipse cx="${-s*0.38}" cy="${-s*0.62}" rx="${s*0.36}" ry="${s*0.14}" fill="rgba(255,255,255,.55)" transform="rotate(-24 ${-s*0.38} ${-s*0.62})"/>
  <circle cx="${-s*0.36}" cy="${-s*0.02}" r="${e*1.1}" fill="#0d1017"/><circle cx="${s*0.36}" cy="${-s*0.02}" r="${e*1.1}" fill="#0d1017"/>
  <circle cx="${-s*0.31}" cy="${-s*0.09}" r="${e*0.34}" fill="#fff"/><circle cx="${s*0.41}" cy="${-s*0.09}" r="${e*0.34}" fill="#fff"/></g>`; };
const svg = (S, half) => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8cf9e6"/><stop offset=".55" stop-color="#2fd6bb"/><stop offset="1" stop-color="#139c84"/></linearGradient><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,255,255,.28)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></linearGradient><filter id="bl"><feGaussianBlur stdDeviation="${S*0.012}"/></filter></defs>` + cube(S, half) + '</svg>';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }), p = await b.newPage();
  const shot = async (S, kind, file) => { await p.setViewportSize({ width: S, height: S }); await p.setContent('<body style="margin:0;background:transparent">' + svg(S, kind === 'fg' ? 0.29 : 0.42) + '</body>'); fs.writeFileSync(file, await p.screenshot({ omitBackground: true })); };
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, m] of Object.entries(dens)) {
    const dir = path.join(res, 'mipmap-' + d);
    await shot(Math.round(48 * m), 'square', path.join(dir, 'ic_launcher.png'));
    await shot(Math.round(48 * m), 'round', path.join(dir, 'ic_launcher_round.png'));
    await shot(Math.round(108 * m), 'fg', path.join(dir, 'ic_launcher_foreground.png'));
  }
  await shot(512, 'legacy', path.join(__dirname, '..', 'docs/play-store-icon-512.png'));
  fs.writeFileSync(path.join(res, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#00000000</color>\n</resources>\n');
  await b.close(); console.log('icons written');
})();
