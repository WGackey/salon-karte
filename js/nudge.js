// バックアップの知らせ（0.13.0）と「ホーム画面に追加」の案内。
// iPad・iPhone では、人が押さずにファイルを保存することはできない（共有の画面は、ボタンを押したその場でしか出せない）。
// だから「知らせる」＋「知らせから、なるべく少ない押し方で書き出す」にしている。
// 合言葉そのものは端末に覚えさせない。覚えるのは「前に合言葉をつけたか」だけ（backupMode：'lock'／'open'）
import { h, fill, btn, toast, sheet, field, input, confirmDlg, DEVICE } from './ui.js';
import { S } from './state.js';
import * as db from './db.js';
import { makeBackupText, handOver } from './backup.js';
import { todayStr, daysBetween, ymd, backupName, backupLevel, askBackupOnClose, showHomeAdd, changedSince } from './logic.js';

// ホーム画面のアイコンから開いているか（Safari のタブではないか）
export function isStandalone() {
  try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; }
}
// 前のバックアップから何日（暦の日）・そのあとに変わったものがあるか
export async function backupState() {
  const last = await db.getMeta('lastBackupAt'); const changed = changedSince(await db.getMeta('lastChangeAt'), last);
  return { days: last ? daysBetween(ymd(new Date(last)), todayStr()) : null, changed };
}
export const daysText = (days) => (days == null ? 'まだ一度もバックアップしていません'
  : days === 0 ? '今日のバックアップのあとに、記録が変わっています' : days === 1 ? 'きのうからバックアップしていません' : `${days}日バックアップしていません`);

// 合言葉なしで書き出す人のために、中身を先に作っておく（押したその場で共有の画面を出すため）
let mode = null; let pre = null;
export async function prepare() {
  mode = await db.getMeta('backupMode'); pre = null;
  if (mode !== 'open') return;
  const box = {}; pre = box;
  try { box.text = await makeBackupText(''); } catch { if (pre === box) pre = null; }
}
async function done(ok, locked) {
  if (!ok) return false;
  await db.setMeta('lastBackupAt', Date.now()); await db.setMeta('backupMode', locked ? 'lock' : 'open'); mode = locked ? 'lock' : 'open';
  toast('書き出しました'); return true;
}
const fname = () => backupName(S.settings.salonName, todayStr());

// 知らせのボタンから書き出す。終わったら（書き出しても・とじても）end(書き出せたか) を呼ぶ
export function quickBackup(end) {
  let finished = false; const fin = (ok) => { if (finished) return; finished = true; end && end(ok); };
  // 合言葉なし・中身ができている → 1回押すだけ（そのまま共有の画面）
  if (mode === 'open' && pre && pre.text) {
    const text = pre.text; pre = null;
    handOver(text, fname()).then((ok) => done(ok, false)).then((ok) => fin(ok));
    return;
  }
  const o = { pass: '', pass2: '' };
  const step = h('div', { class: 'step' });
  let s = null;
  const build = async (pass) => {
    fill(step, h('div', { class: 'notice' }, 'バックアップを作っています…'));
    try {
      const text = await makeBackupText(pass);
      fill(step, h('div', { class: 'notice ok' }, 'できました。下のボタンを押して「ファイルに保存」→ iCloud Drive などをえらんでね。'),
        btn('保存先をえらぶ', async () => { if (await done(await handOver(text, fname()), !!pass)) { fin(true); s.close(); } }, 'primary big wide'));
    } catch (e) { fill(step); toast('書き出せませんでした：' + e.message); }
  };
  const lockPart = () => [
    h('div', { class: 'grid2' }, field('合言葉（カギ）', input(o, 'pass', { type: 'password' })), field('合言葉（もう一度）', input(o, 'pass2', { type: 'password' }))),
    h('p', { class: 'hint' }, '⚠ 合言葉を忘れると、そのファイルは二度と開けません。'),
    btn('合言葉をつけて作る', () => {
      if (!o.pass) toast('合言葉を入れてね'); else if (o.pass !== o.pass2) toast('合言葉が2つでちがっています'); else build(o.pass);
    }, 'primary wide')];
  const openBtn = btn('合言葉なしで作る', async () => {
    if (mode !== 'open' && !(await confirmDlg('合言葉なしで書き出します。ファイルを開けば、だれでも中身を読めます。よいですか？', '合言葉なしで書き出す', true))) return;
    build('');
  }, 'ghost wide');
  const body = h('div', { class: 'quickbk' },
    h('p', { class: 'hint' }, `お客さん・カルテ・設定をまるごと1つのファイルにします。iCloud Drive など ${DEVICE === 'この端末' ? '端末' : DEVICE} の外に置いておくと安心です。`),
    mode === 'open' ? null : lockPart(),
    mode === 'lock' ? h('details', { class: 'small' }, h('summary', null, '合言葉なしで書き出すときは'), openBtn) : mode === 'open' ? null : openBtn,
    step);
  s = sheet('いまバックアップ', body, { onClose: () => fin(false) });
  if (mode === 'open') build(''); // 中身がまだできていなかったとき：作ってから「保存先をえらぶ」
}

// ホームのいちばん上の帯。前のバックアップのあとに変わったものがあるときだけ（橙。3日以上たった・一度もしていない：赤）
export async function backupBand() {
  const { days, changed } = await backupState(); const lv = backupLevel(days, S.people.length, changed);
  if (!lv) return null;
  prepare(); // 待たない（できていれば 1回押すだけになる）
  const band = h('div', { class: 'notice bkband ' + lv, role: 'status' },
    h('div', { class: 'grow' }, h('b', null, '⚠ ' + daysText(days)), h('div', { class: 'small' }, '記録を足したり直したりした日は、バックアップしておくと安心です（端末がこわれたり、データが消えたりしたときのため）。')),
    btn('いまバックアップ', () => quickBackup((ok) => { if (ok) band.replaceWith(h('div', { class: 'notice ok' }, '✓ 今日バックアップしました')); }), lv === 'red' ? 'danger' : 'primary'));
  return band;
}

// カルテをとじるとき（その日に記録が変わって、まだバックアップしていなければ聞く）。聞かなくてよければ、すぐ next()
export async function closeNudge(next) {
  if (S.guest) return next(); // お客さん用の画面では出さない
  const today = todayStr(); const { days, changed } = await backupState();
  if (!askBackupOnClose(days, S.people.length, changed, await db.getMeta('backupLaterDay'), today)) return next();
  prepare();
  const end = () => { wrap.remove(); next(); };
  const wrap = h('div', { class: 'overlay center' },
    h('div', { class: 'dialog' }, h('h2', null, 'バックアップしますか？'), h('p', null, days == null ? '（まだ一度もバックアップしていません）' : '（今日の記録が、まだバックアップされていません）'),
      h('div', { class: 'row end' },
        btn('あとで', async () => { await db.setMeta('backupLaterDay', today); end(); }, 'ghost'),
        btn('いまする', () => { wrap.remove(); quickBackup(() => next()); }, 'primary'))));
  document.body.append(wrap);
}

// 「ホーム画面に追加」の案内。Safari のタブで開いているときだけ（iPad・iPhone）。とじたら 30日出さない
export async function homeAddBand() {
  if (DEVICE === 'この端末') return null; // やり方が Safari（iPad・iPhone）のものなので
  if (!showHomeAdd(isStandalone(), await db.getMeta('homeAddHidden'), todayStr())) return null;
  const where = DEVICE === 'iPhone' ? '下' : '上';
  const band = h('div', { class: 'notice amber homeadd' },
    h('div', { class: 'grow' },
      h('b', null, 'ホーム画面に追加して使ってね'),
      h('div', { class: 'small' }, 'Safari のタブで開いたままだと、7日ほど開かないときや、Safari の「履歴と Web サイトデータを消去」で、データが消えることがあります。ホーム画面のアイコンから開けば、消去しても消えません。'),
      h('ol', { class: 'plain small' },
        h('li', null, `Safari の${where}にある「共有」（四角から上に矢印が出ているしるし）を押す`),
        h('li', null, '「ホーム画面に追加」→「追加」'),
        h('li', null, 'これからは、ホーム画面のアイコンから開く')),
      S.people.length ? h('div', { class: 'small' }, h('b', null, 'いまこのタブに入っているデータは、アイコンの方には入りません（置き場が別）。'), '先に「バックアップ」で書き出して、アイコンから開いたあと 設定 → バックアップ の「戻す」で移してね。') : null),
    btn('とじる', async () => { await db.setMeta('homeAddHidden', todayStr()); band.remove(); }, 'ghost'));
  return band;
}
