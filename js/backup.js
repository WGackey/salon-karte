// バックアップ：iPad の中のデータを1つのファイルに書き出す・戻す。合言葉でカギをかけられる。
// カギは端末に入っている暗号のしくみ（Web Crypto：AES-GCM）を使う。外へは送らない。
import * as db from './db.js';
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const ITER = 250000;
async function keyOf(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function makeBackupText(pass) {
  const dump = await db.dumpAll(); const counts = { customers: dump.stores.customers.length, visits: dump.stores.visits.length };
  const head = { app: 'salon-karte', format: 1, dataVersion: dump.dataVersion, savedAt: new Date().toISOString(), counts };
  if (!pass) return JSON.stringify({ ...head, locked: false, stores: dump.stores });
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyOf(pass, salt, ITER), enc.encode(JSON.stringify(dump.stores)));
  return JSON.stringify({ ...head, locked: true, iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(data) });
}
export function readBackupHead(text) {
  let o; try { o = JSON.parse(text); } catch { throw new Error('バックアップのファイルではないようです。'); }
  if (!o || o.app !== 'salon-karte' || (!o.stores && !o.data)) throw new Error('このアプリのバックアップではないようです。');
  return o;
}
export async function openBackup(o, pass) {
  let stores = o.stores;
  if (o.locked) {
    try {
      const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, await keyOf(pass || '', unb64(o.salt), o.iter), unb64(o.data));
      stores = JSON.parse(dec.decode(buf));
    } catch { throw new Error('合言葉がちがうか、ファイルがこわれています。'); }
  }
  return { app: 'salon-karte', dataVersion: o.dataVersion || 1, stores };
}
export async function restoreBackup(o, pass) { await db.restoreAll(await openBackup(o, pass)); }

// ファイルとして渡す。iPad では「ファイルに保存」をえらべる共有の画面を出す
export async function handOver(text, filename) {
  const file = new File([text], filename, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = filename; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); return true;
}
