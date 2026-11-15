import { h, fill, page, card, btn, badge, go } from '../ui.js';
import { S } from '../state.js';
import { startView } from './guide.js';
import { pullToCheck } from '../update.js';
import * as db from '../db.js';
import { todayStr, daysBetween, jpDate, searchPeople, ymd, schedule } from '../logic.js';

export function personRow(p, extra) {
  return h('a', { class: 'row-link', href: `#/c/${p.id}` },
    h('div', { class: 'grow' }, h('div', { class: 'name' }, p.name || '（名前なし）'), h('div', { class: 'muted' }, p.kana || '')),
    h('div', { class: 'muted right' }, extra || (p.lastVisit ? `前回 ${jpDate(p.lastVisit)}・${p.visitCount}回` : 'まだ来店なし')),
    h('span', { class: 'chev' }, '›'));
}

// 予定の1行。押すと、その人のカルテ（お客さんのページ）が開く
function schedRow(it, kind, today) {
  const p = it.person; const when = kind === 'today' ? (it.time || '時間は未定') : `${jpDate(it.date, false)}${it.time ? ' ' + it.time : ''}`;
  const sub = kind === 'overdue' ? `予定日 ${jpDate(it.date, false)}（${it.late}日前）・来店の記録がありません`
    : p ? (p.lastVisit ? `前回 ${jpDate(p.lastVisit, false)}・${p.visitCount}回` : 'はじめての来店') : 'どのお客さんか、まだ決まっていません';
  const days = kind === 'week' || kind === 'later' ? daysBetween(today, it.date) : 0;
  return h('a', { class: 'row-link schedrow ' + kind, href: p ? `#/c/${p.id}` : '#/list' },
    h('div', { class: 'swhen' }, h('b', null, when), days ? h('span', { class: 'muted small' }, days === 1 ? 'あした' : `${days}日後`) : null),
    h('div', { class: 'grow' }, h('div', { class: 'name' }, it.title || '（名前なし）', it.unsure ? badge('お客さんを確かめる', 'amber') : null), h('div', { class: 'muted small' }, sub)),
    h('span', { class: 'chev' }, '›'));
}

export async function homeView() {
  // はじめて開いたとき（だれも登録されていない・案内をまだ終えていない）は、はじめの案内を出す。とばせる・あとで設定から開ける
  if (!(S.settings.onboard || {}).done && !S.people.length && !S.newer) return startView();
  const today = todayStr(); const sc = schedule(S.people, S.appts, today);

  const results = h('div', { class: 'list' });
  const search = h('input', { class: 'input search', type: 'search', placeholder: '名前・ふりがな・カルテ番号でさがす', 'aria-label': 'お客さんをさがす', autocomplete: 'off' });
  const showResults = () => {
    const q = search.value.trim();
    if (!q) { fill(results, ); return; }
    const found = searchPeople(S.people, q);
    fill(results, ...found.slice(0, 30).map((p) => personRow(p)),
      found.length > 30 ? h('p', { class: 'muted pad' }, `ほか ${found.length - 30} 人。もう少し文字を入れてね`) : null,
      found.length === 0 ? h('p', { class: 'muted pad' }, '見つからなかったよ') : null);
  };
  search.oninput = showResults;

  const last = await db.getMeta('lastBackupAt');
  const days = last ? daysBetween(ymd(new Date(last)), today) : null;
  const bk = S.people.length === 0 ? null
    : h('a', { class: 'notice ' + (days == null || days >= 30 ? 'red' : days >= 7 ? 'amber' : 'ok'), href: '#/set/backup' },
      days == null ? 'まだバックアップしていません' : days === 0 ? '今日バックアップ済み' : `前のバックアップから ${days} 日`, h('span', { class: 'chev' }, '›'));

  // 予定：今日・今週（あした〜6日後）・その先。多いときは、はじめの何件かだけ出して「もっと見る」
  const sched = (title, list, kind, { cls = '', first = 8, empty = '予定はありません', hint = null } = {}) => {
    let shown = first; const box = h('div', { class: 'list' });
    const draw = () => fill(box, ...list.slice(0, shown).map((it) => schedRow(it, kind, today)), list.length > shown ? btn(`もっと見る（あと ${list.length - shown} 件）`, () => { shown += 30; draw(); }, 'wide') : null);
    draw();
    return h('section', { class: 'card sched ' + kind + ' ' + cls }, h('h2', null, title, ' ', badge(String(list.length), kind === 'overdue' ? 'warn' : '')), hint ? h('p', { class: 'hint' }, hint) : null,
      list.length ? box : h('p', { class: 'muted' }, empty));
  };

  const pg = page({
    title: S.settings.salonName || 'カルテ', sub: jpDate(today),
    actions: h('a', { class: 'btn ghost', href: '#/set' }, '設定'),
    body: [
      S.newer ? h('div', { class: 'notice red' }, 'このデータは新しい版のアプリで作られています。アプリを新しくしてください。') : null,
      h('div', { class: 'home-top' }, search, h('a', { class: 'btn primary big', href: '#/new' }, '＋ 新しいお客さん')),
      results,
      sc.overdue.length ? sched('予定日を過ぎた人', sc.overdue, 'overdue', { first: 5, hint: '予定日を過ぎて、来店の記録がない人です。名前を押して、来店をはじめるか、予定日を直す・消すかしてね。' }) : null,
      h('div', { class: 'grid2' }, sched('今日の予定', sc.today, 'today', { first: 30 }), sched('今週の予定', sc.week, 'week', { first: 30, empty: 'あした〜6日後の予定はありません' })),
      sc.later.length ? sched('その先の予定', sc.later, 'later', { first: 5 }) : null,
      h('p', { class: 'hint center' }, '予定は、お客さんのページか 施術後の画面の「次回の予定日」から入ります。'),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/list' }, `お客さんの一覧（${S.people.length}人）`), bk),
    ],
  });
  pg.querySelector('.main').prepend(pullToCheck(pg)); // いちばん上で下に引っぱると、新しい版をさがす
  return pg;
}

export async function listView() {
  let sort = 'kana', shown = 60;
  const list = h('div', { class: 'list' });
  const draw = () => {
    const arr = [...S.people].sort(sort === 'kana' ? (a, b) => (a.kana || a.name).localeCompare(b.kana || b.name, 'ja')
      : sort === 'recent' ? (a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || '') : (a, b) => a.no - b.no);
    fill(list, ...arr.slice(0, shown).map((p) => personRow(p, sort === 'no' ? `No.${p.no}` : null)),
      arr.length > shown ? btn(`もっと見る（あと ${arr.length - shown} 人）`, () => { shown += 100; draw(); }, 'wide') : null,
      arr.length === 0 ? h('p', { class: 'muted pad' }, 'まだだれも登録されていません') : null);
  };
  const tabs = h('div', { class: 'chips' }, [['kana', 'あいうえお順'], ['recent', '最近来た順'], ['no', 'カルテ番号順']].map(([id, name]) => {
    const b = h('button', { class: 'chip' + (id === sort ? ' on' : ''), type: 'button' }, name);
    b.onclick = () => { sort = id; shown = 60; tabs.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b)); draw(); };
    return b;
  }));
  draw();
  return page({ title: 'お客さんの一覧', sub: `${S.people.length}人`, back: '#/', body: [tabs, list] });
}
