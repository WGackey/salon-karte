// はじめに入れておく中身。すべて「下書き」で、アプリの中で直せる。
// 精油の成分の割合は、一般に知られているおおよその値。自信のないところは空けてある（null）。
// 本や教科書の表を写したものではない。使う人が自分の資料で確かめて直す前提。
export const DEFAULT_SETTINGS = {
  salonName: '',
  dropMl: 0.05, // 1滴の量（ml）
  cautionPct: 10, // 気をつける成分が何％以上入っていたら外すか
  areas: [
    { id: 'a_body', name: '体', max: 1, draft: true },
    { id: 'a_face', name: '顔', max: 0.5, draft: true },
    { id: 'a_part', name: '手・足だけ', max: null },
  ],
  stateLimits: {}, // 状態ごとの目安（はじめは空。使う人が入れる）
  symptoms: [
    ['s_kata', '肩こり'], ['s_kubi', '首のこり'], ['s_koshi', '腰のつらさ'], ['s_senaka', '背中のはり'],
    ['s_atama', '頭が重い'], ['s_me', '目の疲れ'], ['s_mukumi', 'むくみ'], ['s_hie', '冷え'],
    ['s_tsukare', '疲れ・だるさ'], ['s_nemuri', '眠りが浅い'], ['s_stress', 'ストレス・緊張'], ['s_kibun', '気分が沈みがち'],
    ['s_kinniku', '筋肉のはり'], ['s_ashi', '足の疲れ'], ['s_ichou', 'おなかの調子'], ['s_gekkei', '月経まわりの不快感'],
    ['s_hada', '肌の乾燥'], ['s_hana', '鼻・のどがすっきりしない'],
  ].map(([id, name]) => ({ id, name })),
  conds: [
    { id: 'c_preg', name: '妊娠中', when: 'visit' }, { id: 'c_nurse', name: '授乳中', when: 'visit' },
    { id: 'c_mens', name: '月経中', when: 'visit' }, { id: 'c_sun', name: 'このあと日に当たる', when: 'visit' },
    { id: 'c_bp', name: '高血圧', when: 'person' }, { id: 'c_heart', name: '心臓の持病', when: 'person' },
    { id: 'c_epi', name: 'てんかん', when: 'person' }, { id: 'c_asthma', name: 'ぜんそく', when: 'person' },
    { id: 'c_skin', name: '敏感肌', when: 'person' }, { id: 'c_dep', name: '気分の落ちこみが強い', when: 'person' },
    { id: 'c_old', name: '高齢', when: 'person' }, { id: 'c_child', name: '子ども', when: 'person' },
  ],
  families: [
    { id: 'f_citrus', name: '柑橘', color: '#f2a03d' }, { id: 'f_flower', name: '花', color: '#e88fb0' },
    { id: 'f_tree', name: '樹木', color: '#5a9a6b' }, { id: 'f_herb', name: 'ハーブ', color: '#8fbf5a' },
    { id: 'f_spice', name: 'スパイス', color: '#b9643a' }, { id: 'f_resin', name: '樹脂', color: '#c9a04a' },
    { id: 'f_exotic', name: 'エキゾチック', color: '#8d6cc0' },
  ],
  marks: [
    { id: 'm_pain', name: '痛い', color: '#e0483e' }, { id: 'm_kori', name: 'こっている', color: '#3d74d9' },
    { id: 'm_hari', name: 'はっている', color: '#f08a24' }, { id: 'm_hie', name: '冷えている', color: '#35b3c9' },
    { id: 'm_mukumi', name: 'むくみ', color: '#3fa860' }, { id: 'm_other', name: 'そのほか', color: '#8d6cc0' },
  ],
  jobs: ['営業系', '事務系', '工業系', '主婦(夫)', '学生(運動)', '学生(文化)', 'そのほか'],
  purposes: ['こり・はりをほぐしたい', 'リラックスしたい', '疲れをとりたい', 'ぐっすり眠りたい', 'むくみをすっきり', '気分を変えたい'],
  moods: ['すっきりした香り', '甘い香り', '落ちつく香り', '香りはひかえめに', 'おまかせ'],
  scents: ['とても好き', '好き', 'ふつう', '少し苦手', '苦手'],
  // 肌の状態（問診でえらぶ。キャリアオイルの候補に使う）
  skins: [
    { id: 'sk_dry', name: '乾燥しやすい' }, { id: 'sk_oily', name: 'べたつきやすい' },
    { id: 'sk_age', name: 'ハリ・うるおいが気になる' }, { id: 'sk_normal', name: 'とくに気にならない' },
  ],
  // アレルギーのしるし。words＝アレルギーの欄にこの言葉が書いてあったら、あてはまるとみなす
  allergens: [
    { id: 'al_nut', name: 'ナッツ類（木の実）', words: 'ナッツ、アーモンド、くるみ、クルミ、カシュー、マカデミア、ヘーゼル、ピスタチオ、木の実' },
    { id: 'al_peanut', name: 'ピーナッツ（落花生）', words: 'ピーナッツ、落花生' },
    { id: 'al_sesame', name: 'ごま', words: 'ごま、ゴマ、胡麻、セサミ' },
    { id: 'al_rice', name: '米', words: '米ぬか、こめ、お米' },
    { id: 'al_wheat', name: '小麦', words: '小麦' },
    { id: 'al_soy', name: '大豆', words: '大豆' },
  ],
  // キャリアオイルの成分（脂肪酸など）。uses＝こんな肌の状態で選ばれることが多い。すべて下書き
  fats: [
    { id: 'ole', name: 'オレイン酸', uses: ['sk_dry', 'sk_age'], note: 'しっとりした使い心地と言われる。比較的、酸化しにくい。' },
    { id: 'lin', name: 'リノール酸', uses: ['sk_oily'], note: 'さらっと軽い使い心地と言われる。酸化しやすい。' },
    { id: 'aln', name: 'α-リノレン酸', uses: ['sk_age'], note: 'とても酸化しやすい。少しだけ混ぜて、早めに使い切ると言われる。' },
    { id: 'pmo', name: 'パルミトレイン酸', uses: ['sk_age', 'sk_dry'], note: '年齢とともに減っていく皮脂の成分に近いと言われる。' },
    { id: 'pal', name: 'パルミチン酸', uses: [], note: '酸化しにくい。' },
    { id: 'ste', name: 'ステアリン酸', uses: [], note: '酸化しにくい。' },
    { id: 'wax', name: 'ワックスエステル（ろうの仲間）', uses: ['sk_oily', 'sk_normal'], note: '皮脂の成分に近いと言われる。とても酸化しにくい。' },
    { id: 'mct', name: '中鎖脂肪酸（カプリル酸・カプリン酸）', uses: ['sk_oily'], note: 'さらっと軽い。とても酸化しにくい。' },
  ].map((f) => ({ ...f, draft: true })),
};

// 成分の分類。uses＝こんな場面で選ばれることが多い（症状）、cautions＝気をつける状態
export const DEFAULT_CATS = [
  { id: 'mth', name: 'モノテルペン炭化水素類', uses: ['s_mukumi', 's_tsukare', 's_kibun', 's_ashi'], cautions: [], note: '古くなると肌への刺激が出やすいと言われる。' },
  { id: 'sth', name: 'セスキテルペン炭化水素類', uses: ['s_stress', 's_kinniku'], cautions: [], note: '' },
  { id: 'alc', name: 'モノテルペンアルコール類', uses: ['s_tsukare', 's_hada', 's_kibun'], cautions: [], note: '比較的おだやかと言われる。' },
  { id: 'sqa', name: 'セスキテルペンアルコール類', uses: ['s_mukumi', 's_ashi', 's_stress'], cautions: [], note: '' },
  { id: 'ald', name: 'アルデヒド類', uses: ['s_stress', 's_nemuri', 's_kinniku'], cautions: ['c_skin'], note: '肌への刺激に気をつける。' },
  { id: 'ket', name: 'ケトン類', uses: ['s_hana', 's_kinniku'], cautions: ['c_preg', 'c_nurse', 'c_child', 'c_epi'], note: '' },
  { id: 'phe', name: 'フェノール類', uses: ['s_hie', 's_tsukare'], cautions: ['c_skin', 'c_child', 'c_preg'], note: '肌への刺激が強いと言われる。うすめに・短い期間で。' },
  { id: 'est', name: 'エステル類', uses: ['s_stress', 's_nemuri', 's_kata', 's_kubi', 's_senaka', 's_koshi', 's_kinniku', 's_gekkei'], cautions: [], note: '' },
  { id: 'oxi', name: 'オキサイド類', uses: ['s_hana', 's_atama'], cautions: ['c_child', 'c_asthma'], note: '' },
  { id: 'eth', name: 'フェノールメチルエーテル類', uses: ['s_kinniku', 's_ichou', 's_gekkei'], cautions: ['c_preg', 'c_child'], note: '' },
  { id: 'lac', name: 'ラクトン・クマリン類', uses: [], cautions: [], note: '柑橘の皮の精油に少し入る。日に当たる前は気をつける（精油ごとに登録）。' },
].map((c) => ({ ...c, draft: true }));

const O = (id, name, family, components, uses, cautions, note = '') => ({ id, name, family, components, uses, cautions, note, owned: false, draft: true });
export const DEFAULT_OILS = [
  O('o_lavender', 'ラベンダー（真正）', 'f_flower', { est: 40, alc: 40, mth: 5 }, ['s_nemuri', 's_kata'], []),
  O('o_teatree', 'ティートリー', 'f_tree', { alc: 45, mth: 40, oxi: 5 }, ['s_hana'], []),
  O('o_peppermint', 'ペパーミント', 'f_herb', { alc: 45, ket: 25, oxi: 5, est: 5 }, ['s_atama', 's_ichou'], ['c_preg', 'c_nurse', 'c_child', 'c_epi'], 'すっとした強い香り。少なめから。'),
  O('o_eucalyptus', 'ユーカリ・グロブルス', 'f_tree', { oxi: 75, mth: 20 }, ['s_hana'], ['c_child']),
  O('o_rosemary', 'ローズマリー・シネオール', 'f_herb', { oxi: 45, mth: 25, ket: 10, alc: 5 }, ['s_kata', 's_atama', 's_kinniku'], ['c_preg', 'c_bp', 'c_epi', 'c_child']),
  O('o_lemon', 'レモン', 'f_citrus', { mth: 90, ald: 2 }, ['s_kibun', 's_atama'], ['c_sun'], '皮をしぼった精油は、ぬったあと日に当てない。'),
  O('o_orange', 'オレンジ・スイート', 'f_citrus', { mth: 95 }, ['s_nemuri', 's_ichou'], []),
  O('o_grapefruit', 'グレープフルーツ', 'f_citrus', { mth: 95 }, ['s_mukumi'], ['c_sun'], '皮をしぼった精油は、ぬったあと日に当てない。'),
  O('o_bergamot', 'ベルガモット', 'f_citrus', { mth: 45, est: 30, alc: 15 }, ['s_kibun', 's_stress'], ['c_sun'], '日に当たる前は特に気をつける（ベルガプテンを除いたものは別）。'),
  O('o_yuzu', 'ゆず', 'f_citrus', { mth: 90 }, ['s_hie'], [], '日に当たる前の注意は、作り方（しぼる・蒸す）で違う。資料で確かめる。'),
  O('o_ylang', 'イランイラン', 'f_exotic', { sth: 40, est: 20, alc: 15, eth: 10 }, ['s_stress'], [], '香りが強い。少なめから。'),
  O('o_geranium', 'ゼラニウム', 'f_flower', { alc: 60, est: 20 }, ['s_gekkei', 's_mukumi'], [], '妊娠中のあつかいは資料によって違う。'),
  O('o_chamomile', 'カモミール・ローマン', 'f_flower', { est: 75 }, ['s_nemuri'], []),
  O('o_clary', 'クラリセージ', 'f_herb', { est: 65, alc: 20 }, ['s_gekkei'], ['c_preg'], 'お酒の前後・運転の前は避けると言われる。'),
  O('o_frankincense', 'フランキンセンス', 'f_resin', { mth: 75, alc: 5 }, ['s_stress', 's_hada'], []),
  O('o_sandalwood', 'サンダルウッド', 'f_exotic', { sqa: 80 }, ['s_stress'], []),
  O('o_cedar', 'シダーウッド・アトラス', 'f_tree', { sth: 60, ket: 15 }, [], ['c_preg']),
  O('o_cypress', 'サイプレス', 'f_tree', { mth: 70, sqa: 5 }, ['s_mukumi', 's_ashi'], ['c_preg']),
  O('o_juniper', 'ジュニパーベリー', 'f_tree', { mth: 80, alc: 5 }, ['s_mukumi'], ['c_preg'], '腎臓に持病のある人は避けると言われる。'),
  O('o_lemongrass', 'レモングラス', 'f_herb', { ald: 75 }, ['s_kinniku', 's_ashi'], []),
  O('o_marjoram', 'スイートマージョラム', 'f_herb', { alc: 50, mth: 40 }, ['s_hie', 's_kata', 's_kinniku'], ['c_preg']),
  O('o_neroli', 'ネロリ', 'f_flower', { alc: 40, mth: 35, est: 10 }, ['s_kibun', 's_stress'], []),
  O('o_rose', 'ローズ・オットー', 'f_flower', { alc: 65 }, ['s_kibun', 's_stress'], ['c_preg']),
  O('o_jasmine', 'ジャスミン', 'f_flower', {}, ['s_kibun'], ['c_preg'], '成分の割合は空けてある。資料で確かめて入れる。'),
  O('o_patchouli', 'パチュリ', 'f_exotic', { sth: 50, sqa: 35 }, ['s_stress'], []),
  O('o_vetiver', 'ベチバー', 'f_exotic', {}, ['s_nemuri'], [], '成分の割合は空けてある。資料で確かめて入れる。'),
  O('o_ginger', 'ジンジャー', 'f_spice', { sth: 60, mth: 20 }, ['s_hie', 's_ichou'], ['c_skin']),
  O('o_pepper', 'ブラックペッパー', 'f_spice', { mth: 55, sth: 30 }, ['s_hie', 's_kinniku'], ['c_skin']),
  O('o_hinoki', 'ひのき', 'f_tree', {}, ['s_stress'], [], '成分の割合は空けてある（木・葉で違う）。資料で確かめて入れる。'),
  O('o_petitgrain', 'プチグレン', 'f_tree', { est: 55, alc: 30 }, ['s_stress', 's_nemuri'], []),
  O('o_palmarosa', 'パルマローザ', 'f_herb', { alc: 80 }, ['s_hada'], []),
  O('o_clove', 'クローブ', 'f_spice', { phe: 80 }, ['s_hie'], [], '肌への刺激が強い。体に使うならごくうすく。'),
];

// キャリアオイル。精油と同じ作り：成分（脂肪酸など）のおおよその割合・特徴・向いている肌の状態・目的・アレルギーのしるし。
// 一般に知られているおおよその値の下書き。産地や作り方で変わる。自信のないところは空けてある（null・書いていない）。
// traits：feel＝のび・重さ（1 軽い〜3 重い）、oxid＝酸化しやすさ（1 しにくい〜3 しやすい）、scent＝香り（1 ほとんどない〜3 強め）
const K = (id, name, fatty, traits, skins, purposes, allergens, note = '') => ({ id, name, fatty, traits, skins, purposes, allergens, cautions: [], note, owned: false, draft: true });
const HOGUSU = 'こり・はりをほぐしたい';
export const DEFAULT_CARRIERS = [
  K('k_jojoba', 'ホホバオイル', { wax: 97 }, { feel: 1, oxid: 1, scent: 1 }, ['sk_normal'], [], [], '油ではなく、液体のろう。寒いと固まるが、あたためると戻る。'),
  K('k_almond', 'スイートアーモンドオイル', { ole: 68, lin: 22, pal: 6 }, { feel: 2, oxid: 2, scent: 1 }, ['sk_dry'], [HOGUSU], ['al_nut'], 'のびがよく、全身に使いやすいと言われる。'),
  K('k_grape', 'グレープシードオイル', { lin: 70, ole: 18, pal: 7, ste: 4 }, { feel: 1, oxid: 3, scent: 1 }, [], [], [], '開けたら早めに使い切る。'),
  K('k_macadamia', 'マカデミアナッツオイル', { ole: 58, pmo: 20, pal: 8, ste: 3, lin: 2 }, { feel: 2, oxid: 1, scent: 2 }, [], [HOGUSU], ['al_nut']),
  K('k_rice', 'ライスブランオイル（米ぬか）', { ole: 42, lin: 35, pal: 17 }, { feel: 2, oxid: null, scent: 1 }, [], [HOGUSU], ['al_rice'], '酸化しやすさは空けてある。資料で確かめて入れる。'),
  K('k_sesame', 'セサミオイル（生のごま）', { ole: 40, lin: 43, pal: 9, ste: 5 }, { feel: 3, oxid: 1, scent: null }, [], [], ['al_sesame'], '料理用の茶色いごま油とは別のもの。香りは空けてある。'),
  K('k_apricot', 'アプリコットカーネルオイル', { ole: 65, lin: 27, pal: 5 }, { feel: 1, oxid: 2, scent: 1 }, ['sk_dry'], [], ['al_nut'], 'あんずの種の中身のオイル。ナッツのアレルギーがある人は、念のため確かめる。'),
  K('k_tsubaki', '椿オイル', { ole: 85, lin: 4, pal: 8 }, { feel: 3, oxid: 1, scent: 1 }, [], [], []),
  K('k_argan', 'アルガンオイル', { ole: 46, lin: 33, pal: 13, ste: 5 }, { feel: 2, oxid: 2, scent: 2 }, [], [], ['al_nut'], 'アルガンの木の実の種のオイル。ナッツのアレルギーがある人は、念のため確かめる。'),
  K('k_rosehip', 'ローズヒップオイル', { lin: 44, aln: 33, ole: 14 }, { feel: null, oxid: 3, scent: 2 }, [], [], [], 'とても酸化しやすい。ほかのオイルに少し混ぜて使うことが多い。冷蔵庫で保管し、早めに使い切る。'),
  K('k_avocado', 'アボカドオイル', { ole: 65, pal: 15, lin: 12, pmo: 5 }, { feel: 3, oxid: 2, scent: null }, ['sk_dry'], [], [], '重いので、ほかのオイルに混ぜて使うことが多い。精製したものと、していないもので色・香りが違う。'),
  K('k_mct', 'ココナッツオイル（分留したもの）', { mct: 95 }, { feel: 1, oxid: 1, scent: 1 }, [], [], [], '固まるふつうのココナッツオイルとは別。液体のまま固まらない。'),
];

// メニューは買った人が自分で作る前提。はじめは例を3つだけ。
export const DEFAULT_MENUS = [
  { id: 'mn_1', name: '整体', minutes: 60 },
  { id: 'mn_2', name: 'アロマトリートメント', minutes: 60 },
  { id: 'mn_3', name: 'アロマトリートメント', minutes: 90 },
];
