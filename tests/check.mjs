// 置く前の点検：版の数字がそろっているか／オフライン用の一覧に全部のファイルが入っているか／外への通信を書いていないか
import fs from 'node:fs';
import path from 'node:path';
const sw = fs.readFileSync('sw.js', 'utf8'); const ver = fs.readFileSync('js/version.js', 'utf8').match(/'([\d.]+)'/)[1];
let bad = 0; const ng = (m) => { console.error('✗ ' + m); bad++; };
if (!sw.includes(`VERSION = '${ver}'`)) ng(`sw.js と js/version.js の版がちがう（${ver}）`);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = [...walk('js'), ...walk('css'), 'index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-512.png'];
for (const f of files) if (!sw.includes(`'./${f}'`)) ng(`sw.js の FILES に ${f} がない`);
for (const f of [...walk('js'), ...walk('css'), 'index.html', 'sw.js']) {
  const t = fs.readFileSync(f, 'utf8');
  if (/https?:\/\/(?!www\.w3\.org)/.test(t) || /\b(XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b/.test(t)) ng(`${f} に外への通信らしきものがある`);
  if (f !== 'sw.js' && /\bfetch\(/.test(t)) ng(`${f} が fetch を使っている`);
}
if (bad) process.exit(1); console.log(`✓ 点検OK（版 ${ver}・${files.length}ファイル）`);
