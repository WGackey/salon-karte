// 新しい版に気づくしくみ。アプリを閉じなくても、自分で新しい版をさがす。
// ・さがすとき：開いたとき／別のアプリから戻ってきたとき／開いたままでも数時間に1回／ホームで下に引っぱったとき／設定のボタン
// ・切りかえるのは、使う人が押したときだけ（施術の途中で勝手に切りかわらない）。カルテのデータにはさわらない
// ・ネットにつながっていないときは、だまって何もしない
import { h, toast, confirmDlg } from './ui.js';
import { flush, S } from './state.js';

const KEY = 'karte-last-update-check'; // 最後にさがした時刻（端末の中だけ。お客さんのデータではないので localStorage）
const AWAKE_GAP = 30 * 60e3, TIMER = 3 * 3600e3;
let reg = null, bar = null, busy = null;
const canUse = () => 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
export const lastCheck = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };
const mark = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* 保存できない端末でも動く */ } };
export const hasNew = () => !!(reg && reg.waiting && navigator.serviceWorker.controller);

// 新しい版に切りかえる（押したときだけ）。書きかけを保存してから
async function apply() {
  const inVisit = /^#\/v\//.test(location.hash);
  if (inVisit && !(await confirmDlg('新しい版に切りかえます。いま書いているカルテは保存されています。入れたデータはそのまま残ります。', '切りかえる'))) return;
  await flush(); if (reg && reg.waiting) reg.waiting.postMessage('skipWaiting');
}
// 案内の出し方：ふだんは上にはっきり。来店の流れの途中は小さなしるし。お客さん用の画面のあいだは出さない
export function showOffer() {
  if (!hasNew()) { if (bar) { bar.remove(); bar = null; } return; }
  if (!bar) { bar = h('button', { class: 'update-bar', type: 'button', onclick: apply }); document.body.append(bar); }
  const small = /^#\/v\//.test(location.hash);
  bar.classList.toggle('small', small); bar.hidden = !!S.guest;
  bar.textContent = small ? '新しい版あり' : '新しい版があります。ここを押すと新しくなります（入れたデータはそのまま残ります）';
}
// 新しい版をさがす。返すもの：'found'＝あった／'latest'＝いまがいちばん新しい／'offline'＝さがせなかった（だまって何もしない）
export function checkUpdate() {
  if (busy) return busy;
  busy = (async () => {
    if (!reg || navigator.onLine === false) return 'offline';
    if (hasNew()) { showOffer(); return 'found'; }
    try { await reg.update(); } catch { return 'offline'; }
    mark();
    const w = reg.installing;
    if (w) await new Promise((res) => { const t = setTimeout(res, 20000); w.addEventListener('statechange', () => { if (w.state === 'installed' || w.state === 'redundant') { clearTimeout(t); res(); } }); });
    showOffer(); return hasNew() ? 'found' : 'latest';
  })().finally(() => { busy = null; });
  return busy;
}
// 押してさがしたとき用：結果を言葉で返す
export async function checkAndTell() {
  if (!canUse() || !reg) return 'この開き方では、新しい版をさがせません（ホーム画面のアイコンから開いてね）';
  const r = await checkUpdate();
  return r === 'found' ? '新しい版があります。上の案内を押すと新しくなります' : r === 'latest' ? 'いまの版がいちばん新しいです' : 'いまはさがせませんでした（ネットにつながっているときに、もう一度）';
}
export function initUpdate() {
  if (!canUse()) return;
  navigator.serviceWorker.register('./sw.js').then((r) => {
    reg = r; showOffer();
    r.addEventListener('updatefound', () => { const w = r.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed') showOffer(); }); });
    const quiet = () => { if (!document.hidden) checkUpdate().catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastCheck() > AWAKE_GAP) quiet(); }); // 別のアプリから戻る・画面をつけ直す
    setInterval(quiet, TIMER); // 開いたままでも、ときどき
    addEventListener('online', () => { if (Date.now() - lastCheck() > AWAKE_GAP) quiet(); });
  }).catch(() => {});
  addEventListener('hashchange', () => setTimeout(showOffer, 0));
  let reloaded = false; const hadCtl = !!navigator.serviceWorker.controller; // はじめて開いたときは読みこみ直さない（書きかけが消えないように）
  navigator.serviceWorker.addEventListener('controllerchange', async () => { if (reloaded || !hadCtl) return; reloaded = true; await flush(); location.reload(); });
}

// ホームの画面：いちばん上で下に引っぱると、新しい版をさがす。ふつうのスクロールとぶつからないよう、いちばん上にいて・指1本で・たてに引いたときだけ
export function pullToCheck(el) {
  const note = h('div', { class: 'pullnote', 'aria-live': 'polite' }); let y0 = null, x0 = 0, far = false, working = false;
  const NEED = 80;
  const set = (t, show = true) => { note.textContent = t; note.classList.toggle('show', show); };
  el.addEventListener('touchstart', (e) => {
    y0 = null; if (working || e.touches.length !== 1 || scrollY > 0 || document.querySelector('.overlay') || e.target.closest('input, textarea, select, .bodypad, .signpad')) return;
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; far = false;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (y0 == null) return; const dy = e.touches[0].clientY - y0, dx = Math.abs(e.touches[0].clientX - x0);
    if (scrollY > 0 || dy < 0 || dx > dy) { y0 = null; set('', false); return; }
    if (dy > 24) { far = dy > NEED; set(far ? '指をはなすと、新しい版をさがします' : '↓ 下に引っぱると、新しい版をさがします'); }
  }, { passive: true });
  const end = async () => {
    if (y0 == null) return; y0 = null;
    if (!far) { set('', false); return; }
    working = true; set('新しい版をさがしています…');
    const msg = await checkAndTell(); set(msg); setTimeout(() => { set('', false); working = false; }, 3500);
  };
  el.addEventListener('touchend', end); el.addEventListener('touchcancel', () => { y0 = null; set('', false); });
  return note;
}
