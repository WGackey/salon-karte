// 入口。アドレスの # のうしろを見て、画面を切りかえる。
import { boot, flush, S } from './state.js';
import { guestView } from './views/guest.js';
import { h, page } from './ui.js';
import { homeView, listView } from './views/home.js';
import { customerView, customerFormView, notFound } from './views/customer.js';
import { visitView } from './views/visit.js';
import * as st from './views/settings.js';

const ROUTES = [
  [/^\/$/, homeView], [/^\/list$/, listView], [/^\/new$/, () => customerFormView(null)],
  [/^\/c\/([^/]+)$/, customerView], [/^\/c\/([^/]+)\/edit$/, customerFormView],
  [/^\/v\/([^/]+)\/([^/]+)$/, visitView],
  [/^\/set$/, st.settingsView], [/^\/set\/oils$/, st.oilsView], [/^\/set\/oil\/([^/]+)$/, st.oilEditView],
  [/^\/set\/carriers$/, st.carriersView], [/^\/set\/carrier\/([^/]+)$/, st.carrierEditView], [/^\/set\/fats$/, st.fatsView], [/^\/set\/menus$/, st.menusView], [/^\/set\/parts$/, st.partsView], [/^\/set\/limits$/, st.limitsView],
  [/^\/set\/cats$/, st.catsView], [/^\/set\/rules$/, st.rulesView], [/^\/set\/consent$/, st.consentView], [/^\/set\/actions$/, st.actionsView], [/^\/set\/symacts$/, st.symActsView], [/^\/set\/lists$/, st.listsView], [/^\/set\/salon$/, st.salonView], [/^\/set\/handover$/, st.handoverView],
  [/^\/set\/backup$/, st.backupView], [/^\/set\/sample$/, st.sampleView], [/^\/set\/about$/, st.aboutView],
];
const root = document.getElementById('app');
let seq = 0;
async function render() {
  const my = ++seq; await flush();
  // お客さんに渡しているあいだは、どのアドレスでもお客さん用の画面だけを出す（打ちかえても・戻るボタンでも、ここに戻る）
  if (S.guest) {
    if (location.hash !== '#/guest') history.replaceState(null, '', '#/guest');
    if (root.firstElementChild && root.firstElementChild.classList.contains('guestmode')) return; // もう出ている（書きかけを消さない）
    const gv = await guestView(); if (my !== seq || !S.guest) return;
    document.documentElement.classList.remove('noscroll'); document.documentElement.classList.add('guest');
    root.replaceChildren(gv); scrollTo(0, 0); return;
  }
  document.documentElement.classList.remove('guest');
  if (location.hash === '#/guest') { history.replaceState(null, '', '#/'); }
  const path = (location.hash.slice(1) || '/').split('?')[0];
  let view;
  try {
    const hit = ROUTES.map(([re, fn]) => [path.match(re), fn]).find(([m]) => m);
    view = hit ? await hit[1](...hit[0].slice(1).map(decodeURIComponent)) : notFound();
  } catch (e) {
    console.error(e);
    view = page({ title: 'うまく開けませんでした', back: '#/', body: h('div', { class: 'notice red' }, 'この画面を開くときに問題が起きました。もう一度ためしてね。（' + e.message + '）') });
  }
  if (my !== seq) return;
  document.documentElement.classList.remove('noscroll'); // 図の「画面いっぱい」のまま移ったときのため
  root.replaceChildren(view); scrollTo(0, 0);
}
addEventListener('hashchange', render); addEventListener('popstate', () => { if (S.guest && location.hash !== '#/guest') render(); });

boot().then(render).catch((e) => {
  console.error(e);
  root.replaceChildren(h('div', { class: 'notice red pad' }, 'データを開けませんでした。Safari の「プライベートブラウズ」では保存できません。ふつうの画面で開き直してね。（' + e.message + '）'));
});

// ネットなしでも動くように、アプリのファイルを端末に置いておく係
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offer = (w) => {
      if (!navigator.serviceWorker.controller) return; // はじめての読みこみ
      const bar = h('button', { class: 'update-bar', type: 'button', onclick: () => w.postMessage('skipWaiting') }, '新しい版があります。ここを押すと新しくなります');
      document.body.append(bar);
    };
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); }); });
  }).catch(() => {});
  let reloaded = false; const hadCtl = !!navigator.serviceWorker.controller; // はじめて開いたときは読みこみ直さない（書きかけが消えないように）
  navigator.serviceWorker.addEventListener('controllerchange', async () => { if (reloaded || !hadCtl) return; reloaded = true; await flush(); location.reload(); });
}
