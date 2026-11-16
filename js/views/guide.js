// はじめて開いたときの案内・「この考え方で作っています」・使い方の手引き。
// どれもアプリの中に入っていて、ネットなしで読める。案内はとばせる・あとから設定で全部直せる。
import { h, fill, page, card, btn, badge, go, chips, input, confirmDlg, HERE } from '../ui.js';
import { S, saveSettings, saveMaster, deleteMaster, hasPin } from '../state.js';
import { choosePin } from './guest.js';
import { salonFields, SAFARI_WARN } from './settings.js';
import * as db from '../db.js';
import { todayStr } from '../logic.js';

const ul = (...items) => h('ul', { class: 'plain' }, items.filter(Boolean).map((t) => h('li', null, t)));
const ol = (...items) => h('ol', { class: 'plain' }, items.filter(Boolean).map((t) => h('li', null, t)));
const ja = (a, b) => a.name.localeCompare(b.name, 'ja');

// ---- 考え方（短く・やさしい言葉で） ----
const IDEAS = () => [
  ['精油とキャリアオイルの候補', 'つらいところ → 働き → 成分の分類 → 精油、という順に考えるやり方をもとにしています。候補は「こんな場面で選ばれることが多い」という目安で、「なぜ出たか」「なぜ外したか」をいっしょに出します。'],
  ['はじめから入っている中身は「下書き」', '精油・キャリアオイルの成分、濃度の目安、気をつける状態、同意書の文は、下書きです。流派や資料によってちがうので、自分の資料で確かめて、設定で直してから使ってください。'],
  ['医療ではありません', '病気を診断したり、治したりするものではありません。からだの調子が心配なときは、お医者さんに相談するよう伝えてください。'],
  ['最後に決めるのは、施術する人', 'アプリが出すのは候補と目安だけです。使う精油・濃度・施術は、目の前のお客さんを見て、施術する人が決めてください。'],
  [`データは、${HERE} の中だけ`, 'お客さんのデータは、インターネットのどこにも送りません。作った人にも見えません。そのかわり、端末がこわれたり、なくしたりすると、データもなくなります。'],
  ['バックアップは自分で', '設定 → バックアップ から、こまめにファイルに書き出して、端末の外（iCloud Drive など）にも置いてください。こちらでデータを元に戻すことはできません。'],
];
const ideaCards = () => IDEAS().map(([t, d]) => h('div', { class: 'idea' }, h('h3', null, t), h('p', null, d)));
export function ideaView() {
  return page({ title: 'この考え方で作っています', back: '#/set', body: [card(ideaCards())] });
}

// ---- 使い方の手引き ----
const sec = (title, ...body) => h('details', { class: 'card guide' }, h('summary', null, title), h('div', { class: 'guide-body' }, body));
export function guideView() {
  return page({
    title: '使い方の手引き', back: '#/set', body: [
      h('p', { class: 'hint' }, '見たいところを押すと開きます。ネットにつながっていなくても読めます。'),
      sec('① ホーム画面に追加する（はじめに）',
        ol('Safari でこのアプリを開く', '画面の「共有」ボタン（四角から上向きの矢印）を押す', '「ホーム画面に追加」をえらんで「追加」', 'できたアイコンから開く'),
        h('div', { class: 'notice amber' }, 'Safari で開いたときと、ホーム画面のアイコンから開いたときでは、データの置き場がちがいます。いつもホーム画面のアイコンから開いてください。')),
      sec('② 使いはじめる前に',
        ul('設定 →「精油の一覧と手持ち」「キャリアオイルの一覧と手持ち」で、持っているものにしるしをつける（候補は手持ちの中から出ます）',
          '設定 →「施術メニュー」で、自分のメニューを作る', '設定 →「濃度の目安」と「同意書と注意事項」を、自分の資料・お店に合わせて直す（はじめは下書き）',
          '設定 →「お客さんに渡すとき」で、合言葉（数字4けた）を決める'),
        h('a', { class: 'btn', href: '#/hajime' }, 'はじめの案内で順番にやる')),
      sec('③ 1回の来店の流れ',
        ol('ホームで名前をさがす（はじめての人は「＋ 新しいお客さん」）', 'お客さんのページの下の「今日の来店をはじめる」',
          '前半（お客さんから聞くこと）：問診 → 気になるところの図。「お客さんに渡す」で、お客さんに書いてもらうこともできます',
          '後半（施術者の記録）：所見の図 → オイルの候補 → ブレンド（濃度は自動で計算）→ 施術 → 施術後',
          '「できた（カルテをとじる）」。書いたものは、直すたびに自動で保存されています'),
        ul('2回目からは、前回の問診が入った状態で開きます。変わったところだけ直します', '「これまでの記録」は横にめくれます。「経過を並べて見る」で、つらさの動きを見られます')),
      sec('④ お客さんに渡す（お客さん用の画面）',
        ul('渡しているあいだは、ほかのお客さんのカルテ・設定には行けません', '書き終わると「スタッフにお返しください」と出ます。合言葉（数字4けた）を入れると戻ります',
          '合言葉は書きとめておいてください。忘れると、お客さん用の画面から戻れなくなります')),
      sec('⑤ バックアップ（大事）',
        ul('設定 → バックアップ →「バックアップを作る」→「保存先をえらぶ」→「ファイルに保存」', 'iCloud Drive など、端末の外にも置いておくと安心です',
          'ファイルに合言葉をかけられます。忘れると二度と開けないので、書きとめておいてください', SAFARI_WARN, '7日バックアップしていないと、ホームのいちばん上に知らせが出ます。「いまバックアップ」から、そのまま書き出せます。カルテをとじるときにも聞きます（「あとで」を押すと、その日は聞きません）', '週に1回が目安です')),
      sec('⑥ 新しい版にするには',
        ul('新しい版が出ると、画面の上に「新しい版があります。ここを押すと新しくなります」と出ます。押すと新しくなります。入れたデータはそのまま残ります',
          'アプリは、ときどき自分で新しい版をさがします（ネットにつながっているとき）。何もしなくてだいじょうぶです',
          '自分でさがしたいときは、ホームの画面のいちばん上で、下に引っぱります。設定 →「このアプリについて」の「新しい版をさがす」でもさがせます',
          'カルテを書いている途中は、小さく「新しい版あり」と出るだけです。勝手に切りかわることはありません',
          '念のため、ときどきバックアップを取っておくと安心です')),
      sec('⑦ iPad と iPhone のあいだで移す',
        ul('データは端末ごとに別々です。自動ではそろいません'),
        ol('もとの端末で、設定 → バックアップ → 書き出して、iCloud Drive に置く（AirDrop でもよい）', '移す先の端末でアプリを開き、設定 → バックアップ →「戻す」でそのファイルをえらぶ', '合言葉つきなら同じ合言葉を入れて「入れ替える」'),
        h('div', { class: 'notice amber' }, '戻すと、移す先に入っていたデータは消えて入れ替わります（2台の中身を混ぜることはできません）。カルテを書く端末は1台に決めておくのがおすすめです。')),
      sec('⑧ こまったとき',
        ul('データが消えた：' + SAFARI_WARN + ' 消えてしまったときは、バックアップから戻してください',
          '合言葉を忘れてお客さん用の画面から戻れない：アプリを消して入れ直し、バックアップから戻すことになります',
          '候補に出てほしい精油が出ない：設定で「手持ち」になっているか、「外した理由」に出ていないかを見てください')),
      h('a', { class: 'btn wide', href: '#/set/kangae' }, 'この考え方で作っています'),
    ],
  });
}

// ---- はじめて開いたときの案内 ----
// 手持ちのしるしをまとめてつける（押すとすぐ保存）
function ownPick(store) {
  const items = [...S[store]].sort(ja); const count = h('p', { class: 'hint' });
  const upd = () => { count.textContent = `いま ${S[store].filter((o) => o.owned).length} 個にしるし（ぜんぶで ${items.length} 個）。押すとすぐ保存されます。`; };
  upd();
  return [chips(items, items.filter((o) => o.owned).map((o) => o.id), { cls: 'ownpick', onChange: async (ids) => {
    for (const o of items) { const on = ids.includes(o.id); if (!!o.owned !== on) { o.owned = on; await saveMaster(store, o); } }
    upd();
  } }), count];
}
function menuList() {
  const box = h('div');
  const draw = () => fill(box, ...S.menus.map((m) => h('div', { class: 'edit-row' },
    input(m, 'name', { placeholder: 'メニューの名前', cls: 'grow', onInput: () => saveMaster('menus', m) }),
    h('span', { class: 'row tight' }, input(m, 'minutes', { type: 'number', inputmode: 'numeric', cls: 'num', onInput: () => saveMaster('menus', m) }), '分'),
    btn('×', async () => { if (await confirmDlg(`「${m.name || '（名前なし）'}」を消します。`, '消す', true)) { await deleteMaster('menus', m.id); draw(); } }, 'ghost round'))),
    h('div', { class: 'row' }, btn('＋ 足す', async () => { await saveMaster('menus', { id: db.uid(), name: '', minutes: 60, scope: null }); draw(); })));
  draw(); return box;
}
const pct = (n) => (n == null ? '目安なし' : `${n}％まで`);

export function startView() {
  const st = S.settings; st.onboard = { done: false, step: 0, ack: '', ...(st.onboard || {}) };
  const ob = st.onboard; const root = h('div');
  const finish = async () => { ob.done = true; ob.step = 0; await saveSettings(); if (location.hash === '#/hajime') go('#/'); else go('#/?' + Date.now()); };
  const STEPS = [
    { title: 'ようこそ', body: () => [
      h('p', { class: 'lead' }, '整体とアロマのカルテです。はじめに、いくつか決めておくと、すぐ使いはじめられます。'),
      ul('どれも、とばせます', 'あとから「設定」でぜんぶ直せます', `データは、${HERE} の中だけに保存します（どこにも送りません）`),
      h('div', { class: 'notice draft' }, 'はじめから入っている精油・キャリアオイル・同意書の文は「下書き」です。濃度の目安も、自分の資料で確かめてください。候補は目安で、医療ではありません。最後に決めるのは施術する人です。'),
      h('a', { class: 'btn ghost', href: '#/set/kangae' }, 'くわしく：この考え方で作っています')] },
    { title: 'お店の名前・施術する人の名前', body: () => salonFields() },
    { title: '合言葉（数字4けた）', body: () => {
      const box = h('div', { class: 'step' });
      const draw = () => fill(box, h('p', null, hasPin() ? h('b', null, '✓ 決めてあります') : 'まだ決めていません'),
        btn(hasPin() ? '合言葉を決め直す' : '合言葉を決める', async () => { if (await choosePin()) draw(); }, hasPin() ? '' : 'primary big'));
      draw();
      return [h('p', null, 'お客さんに端末を渡して、問診やサインを書いてもらうときに使います。渡しているあいだは、ほかのお客さんのカルテに行けません。戻るときに、この合言葉を入れます。'),
        box, h('div', { class: 'notice amber' }, '合言葉は、どこかに書きとめておいてね。忘れると、お客さん用の画面から戻れなくなります。')];
    } },
    { title: '手持ちの精油', body: () => [h('p', null, '持っている精油を押して、しるしをつけます。候補は、手持ちの中から出ます（持っていないけれど合うものは「次に買う候補」として出ます）。'), ...ownPick('oils'),
      h('p', { class: 'hint' }, '一覧にない精油は、設定 →「精油の一覧と手持ち」→「＋ 足す」で足せます。')] },
    { title: '手持ちのキャリアオイル', body: () => [h('p', null, '持っているキャリアオイル（うすめるためのオイル）を押して、しるしをつけます。'), ...ownPick('carriers'),
      h('p', { class: 'hint' }, '一覧にないものは、設定 →「キャリアオイルの一覧と手持ち」で足せます。')] },
    { title: '施術メニュー', body: () => [h('p', null, 'はじめから入っているのは例です。自分のお店のメニューに直してください。料金は入れません。'), menuList(),
      h('p', { class: 'hint' }, '「手だけ」「足だけ」など、施術するところをメニューにひもづけるのは、設定 →「施術メニュー」でできます。')] },
    { title: '「下書き」の確かめ', body: () => {
      const ackBox = h('div');
      const draw = () => fill(ackBox, chips([{ id: 'ok', name: '下書きだと分かりました。自分で確かめて直します' }], ob.ack ? ['ok'] : [], { cls: 'col', onChange: (x) => { ob.ack = x.length ? todayStr() : ''; saveSettings(); } }));
      draw();
      return [h('p', null, '次の2つは、とくに大事です。そのまま使わず、自分の資料・お店に合わせて確かめて、ちがうところは直してください。'),
        h('div', { class: 'idea' }, h('h3', null, '濃度の目安 ', (st.areas || []).some((a) => a.draft) ? badge('下書き', 'draft') : null),
          ul(...(st.areas || []).map((a) => `${a.name}：${pct(a.max)}${a.firstMax != null ? `（はじめての人 ${pct(a.firstMax)}）` : ''}`)), h('p', { class: 'hint' }, 'はじめの数字は、アロマテラピーを学んだときの資料のもの（精油 ÷ キャリアオイル）。流派や資料によってちがいます。はじめての人・敏感肌の人は、うすめに。妊娠中・高齢・子どもなど、状態ごとの目安は資料にないので空です（自分で入れます）。'),
          h('a', { class: 'btn', href: '#/set/limits' }, '濃度の目安を直す')),
        h('div', { class: 'idea' }, h('h3', null, '同意書と注意事項の文 ', badge('下書き', 'draft')),
          h('p', { class: 'pre consenttext small' }, (st.consent || {}).text || ''), h('p', { class: 'hint' }, '法律の文書として正しいかは、確かめていません。'),
          h('a', { class: 'btn', href: '#/set/consent' }, '同意書の文を直す')),
        h('p', { class: 'hint' }, '直す画面から戻るときは、設定 →「はじめの案内をもう一度」で、この続きから開けます。'), ackBox];
    } },
    { title: 'バックアップと、ホーム画面', body: () => [
      h('div', { class: 'idea' }, h('h3', null, 'バックアップは自分で'), h('p', null, `データは ${HERE} の中だけにあります。こわれたり、なくしたりすると、データもなくなります。お客さんを登録したら、設定 → バックアップ から、こまめに書き出してください（週に1回が目安）。`),
        h('div', { class: 'notice amber' }, '⚠ ' + SAFARI_WARN)),
      h('div', { class: 'idea' }, h('h3', null, 'ホーム画面に追加'), h('p', null, 'Safari の「共有」→「ホーム画面に追加」で、アイコンから開けるようになります。Safari のタブで使っていると、しばらく開かないときや Safari の消去でデータが消えることがあります。いつもアイコンから開いてください（タブとアイコンはデータの置き場が別です）。')),
      h('p', { class: 'hint' }, '使い方は、設定 →「使い方の手引き」でいつでも読めます。')] },
  ];
  const draw = () => {
    const i = Math.max(0, Math.min(STEPS.length - 1, ob.step || 0)); const s = STEPS[i]; const last = i === STEPS.length - 1;
    const move = (d) => { ob.step = i + d; saveSettings(); draw(); scrollTo(0, 0); };
    fill(root, page({
      title: 'はじめの案内', sub: i === 0 ? null : `${i} / ${STEPS.length - 1}`, cls: 'startpage',
      body: [h('div', { class: 'startdots', 'aria-hidden': 'true' }, STEPS.map((_, k) => h('span', { class: k === i ? 'on' : k < i ? 'past' : '' }))),
        card(h('h2', null, s.title), s.body()),
        last ? null : h('button', { type: 'button', class: 'startskip', onclick: finish }, i === 0 ? 'あとでする（案内をとばして、すぐ使う）' : '案内をここでやめて、使いはじめる')],
      footer: [i > 0 ? btn('‹ もどる', () => move(-1), 'big') : null,
        last ? btn('できた（使いはじめる）', finish, 'primary big grow') : btn(i === 0 ? 'はじめる' : 'つぎへ', () => move(1), 'primary big grow')],
    }));
  };
  draw(); return root;
}
