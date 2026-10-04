// Copies the web game (index.html, game.js, game.css, src/) into www/, which is the folder Capacitor packs into the Android app.
// Run it through `npm run sync` (it then also runs `cap sync`). Never edit www/ by hand: it is rebuilt every time.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'game.js', 'game.css']) fs.copyFileSync(path.join(root, f), path.join(out, f));
fs.cpSync(path.join(root, 'src'), path.join(out, 'src'), { recursive: true });
console.log('www/ ready (' + fs.readdirSync(out).join(', ') + ')');
