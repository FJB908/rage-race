// Draws the Android launcher icons (the teal cube) straight into android/app/src/main/res. Run: node tools/gen-icons.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const res = path.join(__dirname, '..', 'android/app/src/main/res');
// The icon IS the cube: a full-bleed teal rounded square with the eyes. Adaptive icons: the teal gradient is the background layer and the eyes + shine the foreground
// (the launcher cuts the rounded shape). Legacy square / round / Play Store icons are drawn full-bleed too.
const defs = S => `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8cf9e6"/><stop offset=".55" stop-color="#2fd6bb"/><stop offset="1" stop-color="#139c84"/></linearGradient><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,255,255,.3)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></linearGradient><linearGradient id="dk" x1="0" y1="0" x2="0" y2="1"><stop offset=".7" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,60,50,.35)"/></linearGradient></defs>`;
const face = (S, k) => { const c = S / 2, e = S * 0.085 * k, dx = S * 0.17 * k, dy = -S * 0.05 * k; return `<ellipse cx="${c - S*0.16*k}" cy="${c - S*0.24*k}" rx="${S*0.17*k}" ry="${S*0.06*k}" fill="rgba(255,255,255,.5)" transform="rotate(-24 ${c - S*0.16*k} ${c - S*0.24*k})"/><circle cx="${c - dx}" cy="${c + dy}" r="${e}" fill="#0d1017"/><circle cx="${c + dx}" cy="${c + dy}" r="${e}" fill="#0d1017"/><circle cx="${c - dx + e*.3}" cy="${c + dy - e*.35}" r="${e*.32}" fill="#fff"/><circle cx="${c + dx + e*.3}" cy="${c + dy - e*.35}" r="${e*.32}" fill="#fff"/>`; };
const svg = (S, kind) => {
  const body = `<rect width="${S}" height="${S}" fill="url(#g)"/><rect width="${S}" height="${S}" fill="url(#sh)"/><rect width="${S}" height="${S}" fill="url(#dk)"/>`;
  let inner;
  if (kind === 'bg') inner = body;
  else if (kind === 'fg') inner = face(S, 0.62);                       // inside the 66% safe zone
  else if (kind === 'play') inner = body + face(S, 1);
  else { const r = kind === 'round' ? S / 2 : S * 0.24; inner = `<clipPath id="m"><rect width="${S}" height="${S}" rx="${r}"/></clipPath><g clip-path="url(#m)">${body}${face(S, 1)}</g>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${defs(S)}${inner}</svg>`;
};
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }), p = await b.newPage();
  const shot = async (S, kind, file) => { await p.setViewportSize({ width: S, height: S }); await p.setContent('<body style="margin:0;background:transparent">' + svg(S, kind) + '</body>'); fs.writeFileSync(file, await p.screenshot({ omitBackground: true })); };
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, m] of Object.entries(dens)) {
    const dir = path.join(res, 'mipmap-' + d);
    await shot(Math.round(48 * m), 'square', path.join(dir, 'ic_launcher.png'));
    await shot(Math.round(48 * m), 'round', path.join(dir, 'ic_launcher_round.png'));
    await shot(Math.round(108 * m), 'fg', path.join(dir, 'ic_launcher_foreground.png'));
    await shot(Math.round(108 * m), 'bg', path.join(dir, 'ic_launcher_background.png'));
  }
  await shot(512, 'play', path.join(__dirname, '..', 'docs/play-store-icon-512.png'));
  fs.writeFileSync(path.join(res, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#00000000</color>\n</resources>\n');
  await b.close(); console.log('icons written');
})();
