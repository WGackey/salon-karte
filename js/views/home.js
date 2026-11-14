import { h, fill, page, card, btn, badge, go } from '../ui.js';
import { S } from '../state.js';
import * as db from '../db.js';
import { todayStr, addDays, daysBetween, jpDate, searchPeople, ymd } from '../logic.js';

export function personRow(p, extra) {
  return h('a', { class: 'row-link', href: `#/c/${p.id}` },
    h('div', { class: 'grow' }, h('div', { class: 'name' }, p.name || '（名前なし）'), h('div', { class: 'muted' }, p.kana || '')),
    h('div', { class: 'muted right' }, extra || (p.lastVisit ? `前回 ${jpDate(p.lastVisit)}・${p.visitCount}回` : 'まだ来店なし')),
    h('span', { class: 'chev' }, '›'));
}

export async function homeView() {
  const today = todayStr(); const weekEnd = addDays(today, 6);
  const due = S.people.filter((p) => p.nextDate && p.nextDate >= today && p.nextDate <= weekEnd).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const todays = due.filter((p) => p.nextDate === today), week = due.filter((p) => p.nextDate !== today);

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

  const sched = (title, list) => card(h('h2', null, title, ' ', badge(String(list.length))),
    list.length ? h('div', { class: 'list' }, list.map((p) => personRow(p, jpDate(p.nextDate, false)))) : h('p', { class: 'muted' }, '予定はありません'));

  return page({
    title: S.settings.salonName || 'カルテ', sub: jpDate(today),
    actions: h('a', { class: 'btn ghost', href: '#/set' }, '設定'),
    body: [
      S.newer ? h('div', { class: 'notice red' }, 'このデータは新しい版のアプリで作られています。アプリを新しくしてください。') : null,
      h('div', { class: 'home-top' }, search, h('a', { class: 'btn primary big', href: '#/new' }, '＋ 新しいお客さん')),
      results,
      h('div', { class: 'grid2' }, sched('今日の予定', todays), sched('今週の予定', week)),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/list' }, `お客さんの一覧（${S.people.length}人）`), bk),
    ],
  });
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
