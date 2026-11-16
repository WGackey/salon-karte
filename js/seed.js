// はじめに入れておく中身。すべて「下書き」で、アプリの中で直せる。
// 精油のデータは、がっき〜の資料（自作のエクセル）で確かめた事実を、このアプリの形にまとめ直したもの。表や文章の写しではない。
// 資料に割合がないところは空けてある（null）。キャリアオイルは前の下書きのまま。使う人がアプリの中で直せる。
// 日に当たると肌に出やすい精油（柑橘の皮など）を外すための項目。言葉は がっき〜に確かめ中 → 変えるときはここと、db.js の移し替えに1つ足す
export const SUN_NAME_OLD = ['このあと日に当たる'];
export const SUN_NAME = 'このあと屋外で過ごす予定がある（外出・屋外作業など）';
// 作用（働き）のまとまり。資料の作用の名前（terms）を、ふだんの言葉のまとまりに分けたもの。
// 名前は「こんな働きがあると言われる」という分け方で、「効く」という意味ではない。アプリの中で直せる。
export const DEFAULT_ACTIONS = [
  ['a_calm', '気持ちを落ちつける', '鎮静・神経安定・抗不安・神経バランス回復・催眠性・副交感神経・血圧降下'],
  ['a_lift', '元気づける', '強壮・強壮刺激・神経強壮・心臓強壮'],
  ['a_relax', 'こわばりをゆるめる', '鎮痙攣・筋肉弛緩'],
  ['a_ease', 'つらさをやわらげる', '鎮痛・局所鎮痛・麻酔'],
  ['a_heat', 'ほてり・はれをしずめる', '抗炎症'],
  ['a_cool', 'すっと冷やす', '冷却・血管収斂'],
  ['a_warm', 'あたためる', '加温'],
  ['a_flow', 'めぐりを助ける', '鬱滞除去・鬱血除去・静脈強壮・リンパ強壮・血流促進・血管拡張'],
  ['a_water', '水分の流れを助ける', '腎臓機能促進・腎臓強壮・腎臓廃液促進・解毒'],
  ['a_digest', 'おなかの動きを助ける', '蠕動運動促進・消化促進・胆汁分泌促進・肝臓強壮・発酵抑制'],
  ['a_breath', '鼻・のどをすっきり', '去痰・抗カタル・鎮咳・粘液溶解'],
  ['a_guard', 'まもる力を支える', '抗菌・抗ウイルス・免疫調整・免疫刺激'],
  ['a_itch', 'むずむずをしずめる', '抗アレルギー・抗ヒスタミン・抗掻痒'],
  ['a_skin', '肌をととのえる', '皮膚弾力回復・収斂・瘢痕形成・皮膚強壮・組織再生'],
  ['a_female', '女性のリズムに関わる', 'エストロゲン様・ホルモン様・黄体ホルモン分泌促進・通経・子宮収縮'],
  ['a_head', '頭をすっきり', '脳血流増加'],
  ['a_bug', '虫よけ', '昆虫忌避・駆虫'],
  ['a_other', 'そのほか', '血液凝固阻止・血腫抑制・止血・結石溶解・脂肪溶解'],
].map(([id, name, terms]) => ({ id, name, terms, draft: true }));

// つらいところ → 作用。数字は重み（2＝とても関係する、1＝少し関係する）。すべて下書き・アプリの中で直せる
const SYM = [
  ['s_kata', '肩こり', { a_relax: 2, a_flow: 1, a_ease: 1 }], ['s_kubi', '首のこり', { a_relax: 2, a_flow: 1, a_ease: 1 }],
  ['s_koshi', '腰のつらさ', { a_relax: 2, a_ease: 2, a_flow: 1 }], ['s_senaka', '背中のはり', { a_relax: 2, a_flow: 1 }],
  ['s_atama', '頭が重い', { a_head: 2, a_ease: 1, a_cool: 1, a_calm: 1 }], ['s_me', '目の疲れ', { a_head: 1, a_flow: 1, a_cool: 1 }],
  ['s_mukumi', 'むくみ', { a_flow: 2, a_water: 2 }], ['s_hie', '冷え', { a_warm: 2, a_flow: 2 }],
  ['s_tsukare', '疲れ・だるさ', { a_lift: 2, a_flow: 1 }], ['s_nemuri', '眠りが浅い', { a_calm: 2 }],
  ['s_stress', 'ストレス・緊張', { a_calm: 2, a_relax: 1 }], ['s_kibun', '気分が沈みがち', { a_lift: 2, a_calm: 1 }],
  ['s_kinniku', '筋肉のはり', { a_relax: 2, a_ease: 1, a_flow: 1 }], ['s_ashi', '足の疲れ', { a_flow: 2, a_water: 1, a_relax: 1 }],
  ['s_ichou', 'おなかの調子', { a_digest: 2, a_relax: 1 }], ['s_gekkei', '月経まわりの不快感', { a_relax: 2, a_female: 1, a_flow: 1, a_calm: 1 }],
  ['s_hada', '肌の乾燥', { a_skin: 2, a_itch: 1 }], ['s_hana', '鼻・のどがすっきりしない', { a_breath: 2, a_guard: 1, a_itch: 1 }],
];
export const DEFAULT_SYM_ACTS = Object.fromEntries(SYM.map(([id, , acts]) => [id, acts]));

// 気をつける状態。when：visit＝来店ごと／person＝お客さんごと／auto＝自動でつく（妊娠の月数から）
export const DEFAULT_CONDS = [
  { id: 'c_preg', name: '妊娠中', when: 'visit' },
  { id: 'c_preg_early', name: '妊娠初期（4か月まで）', when: 'auto' },
  { id: 'c_preg_mid', name: '妊娠中期（5〜7か月）', when: 'auto' },
  { id: 'c_preg_late', name: '妊娠後期（8か月から）', when: 'auto' },
  { id: 'c_post', name: '出産してまもない', when: 'visit' }, { id: 'c_nurse', name: '授乳中', when: 'visit' },
  { id: 'c_mens', name: '月経中', when: 'visit' }, { id: 'c_sun', name: SUN_NAME, when: 'visit' },
  { id: 'c_drive', name: 'このあと運転する', when: 'visit' }, { id: 'c_drink', name: 'このあとお酒を飲む（飲んできた）', when: 'visit' },
  { id: 'c_bp', name: '高血圧', when: 'person' }, { id: 'c_bpmed', name: '血圧の薬をのんでいる', when: 'person' },
  { id: 'c_heart', name: '心臓の持病', when: 'person' },
  { id: 'c_epi', name: 'てんかん', when: 'person' }, { id: 'c_asthma', name: 'ぜんそく', when: 'person' },
  { id: 'c_skin', name: '敏感肌', when: 'person' }, { id: 'c_atopy', name: 'アトピー（肌のトラブル）', when: 'person' },
  { id: 'c_dep', name: '気分の落ちこみが強い', when: 'person' },
  { id: 'c_infant', name: '乳幼児', when: 'person' }, { id: 'c_child', name: '子ども', when: 'person' }, { id: 'c_old', name: '高齢', when: 'person' },
];

// 同意書と注意事項の下書き。法律の文書として正しいかは確かめていない。使う人が自分の店に合わせて直す（設定 → 同意書と注意事項）
export const DEFAULT_CONSENT_TEXT = `施術を受ける前に、次のことをお読みください。

・施術のあとは、いつもより少し多めに水分をとってください。
・施術の当日は、お酒や激しい運動はひかえてください。
・アロマトリートメントのあとは、しばらく時間をあけてから入浴してください。
・施術のあと、だるさや眠気が出ることがあります。運転などは、ゆとりをもってください。
・肌に赤み・かゆみなど、いつもとちがうことがあれば、すぐにお知らせください。
・病院で治療中の方・薬をのんでいる方・妊娠中の方は、受ける前にお医者さんにご確認ください。
・この施術は、病気の診断や治療をするものではありません。

上のことを読み、説明を受けたうえで、施術を受けることに同意します。`;

export const DEFAULT_PARTS = [
  { id: 'hand', name: '手', areaId: 'a_part', syms: ['s_hie', 's_mukumi', 's_tsukare', 's_kinniku', 's_hada', 's_stress'] },
  { id: 'foot', name: '足', areaId: 'a_part', syms: ['s_ashi', 's_mukumi', 's_hie', 's_tsukare', 's_kinniku', 's_hada'] },
  { id: 'head', name: '頭', areaId: 'a_face', syms: ['s_atama', 's_me', 's_nemuri', 's_stress', 's_kubi', 's_kibun'] }, // 顔に近いので、低いほうの目安（安全側）。設定で直せる
  { id: 'neck', name: '首・肩', areaId: 'a_body', syms: ['s_kata', 's_kubi', 's_atama', 's_me', 's_kinniku', 's_stress'] },
  { id: 'back', name: '背中・腰', areaId: 'a_body', syms: ['s_senaka', 's_koshi', 's_kata', 's_kinniku', 's_tsukare'] },
];
// 反射区（足の裏の区分け）。一般に知られている大まかな区分けだけの下書きで、確かめていない。名前と色は使う人が直せる。
// 形（どこにあるか）は parts.js の REFLEX_SHAPES。名前は区分けの名前だけ（「〇〇に効く」とは書かない）。show＝図に重ねて出すか（はじめは出さない）／checked＝使う人が確かめた
export const DEFAULT_REFLEX = {
  show: false, checked: false,
  zones: [
    { id: 'rz_head', name: '頭', color: '#8d6cc0' }, { id: 'rz_neck', name: '首', color: '#c0569b' },
    { id: 'rz_eye', name: '目', color: '#3d74d9' }, { id: 'rz_ear', name: '耳', color: '#2a9aa8' },
    { id: 'rz_shoulder', name: '肩', color: '#d9822b' }, { id: 'rz_chest', name: '胸・肺', color: '#4f9a5d' },
    { id: 'rz_stomach', name: '胃', color: '#c9a227' }, { id: 'rz_gut', name: '腸', color: '#a0683c' },
    { id: 'rz_spine', name: '背骨', color: '#6b7280' }, { id: 'rz_pelvis', name: '骨盤まわり', color: '#d0564c' },
  ],
};
export const AGE_RULES = { infant: 6, child: 17, old: 60 };
export const DEFAULT_SETTINGS = {
  salonName: '', // お店の名前。ホームの上・お客さん用の画面・同意書・バックアップのファイル名に出る
  staffName: '', // 施術する人の名前。同意書のサインの記録と、お客さん用の画面の「お返しください」に出る
  onboard: { done: false, step: 0, ack: '' }, // はじめて開いたときの案内。done＝終えた（とばした）／ack＝下書きであることを確かめた日
  pin: null, // お客さん用の画面から戻るための合言葉（数字4けた）。{ salt, hash } の形で残す
  // 問診をだれが書くか（はじめに大きく出すボタン）。guest＝お客さんに渡す／staff＝施術する人が聞きながら書く。どちらもいつでも選べる
  handover: { first: 'guest', repeat: 'staff' },
  consent: { text: DEFAULT_CONSENT_TEXT, ver: 1, draft: true }, // ver＝文の版。文を直して保存すると1つ上がる
  dropMl: 0.05, // 1滴の量（ml）
  cautionPct: 10, // 気をつける成分が何％以上入っていたら外すか
  unknownPct: 'block', // 気をつける成分が「入っている・割合は分からない」とき：block＝外す（安全側）／warn＝⚠をつけて候補に残す
  // 生年月日から自動でつける：乳幼児（○歳まで）・子ども（○歳まで）・高齢（○歳から）。0.12.0（2026-11-16 がっき〜が決めた）：乳幼児＝0〜6歳／子ども＝7〜17歳（乳幼児とは重ねない・18歳から大人）／高齢者＝60歳以上。
  // 空欄だと埋めるのが大変なので、はじめから入れておく。設定 → 外す決まり で直せる（空けると自動でつけない）
  ageRules: { infant: AGE_RULES.infant, child: AGE_RULES.child, old: AGE_RULES.old },
  // 濃度の目安（精油 ÷ キャリアオイル）。0.10.0 から資料の数字：全身 5％まで・顔 3％まで・部分ぬり ふつう10％まで（資料に「例外あり」）
  // 資料のメモ：はじめての人・敏感肌は うすめに（数字は書いていない）。子ども・高齢・妊娠中の数字は資料にない → 状態ごとの目安は空のまま
  // 0.12.0：体 5％・顔 3％・部分ぬり 10％ は がっき〜が「そのまま」と決めたので、「下書き」のしるし（draft）は付けない
  areas: [
    // firstMax＝はじめての人（来店1回目）の目安（0.11.0・2026-11-16 がっき〜が決めた：体 1％・顔 0.5％）
    { id: 'a_body', name: '体', max: 5, firstMax: 1 },
    { id: 'a_face', name: '顔', max: 3, firstMax: 0.5 },
    { id: 'a_part', name: '手・足だけ', max: 5, firstMax: 1 }, // 2026-11-16 がっき〜：手・足だけのトリートメントは体と同じ（部分ぬりの10％とは別）
    { id: 'a_spot', name: '部分ぬり（気になるところに少しだけ）', max: 10 },
  ],
  stateLimits: {}, // 状態ごとの目安（はじめは空。使う人が入れる）
  // 部位だけのカルテ（手だけ・足だけ など）。図は parts.js。名前・濃度の目安（areas のどれを使うか）・関わる「つらいところ」は設定で直せる
  wholeAreaId: 'a_body', // 全身のときの濃度の目安
  parts: DEFAULT_PARTS,
  reflex: DEFAULT_REFLEX,
  symptoms: SYM.map(([id, name, acts]) => ({ id, name, acts: { ...acts } })),
  actions: DEFAULT_ACTIONS,
  conds: DEFAULT_CONDS,
  // 香りの系統は、がっき〜の資料の3つ（樹木系・花穂系・柑橘系）を軸に。色は 樹＝緑・花＝ピンク・柑橘＝オレンジ
  families: [
    { id: 'f_tree', name: '樹木系', color: '#5a9a6b' }, { id: 'f_flower', name: '花穂系', color: '#e88fb0' },
    { id: 'f_citrus', name: '柑橘系', color: '#f2a03d' },
  ],
  marks: [
    { id: 'm_pain', name: '痛い', color: '#e0483e' }, { id: 'm_kori', name: 'こっている', color: '#3d74d9' },
    { id: 'm_hari', name: 'はっている', color: '#f08a24' }, { id: 'm_hie', name: '冷えている', color: '#35b3c9' },
    { id: 'm_mukumi', name: 'むくみ', color: '#3fa860' }, { id: 'm_other', name: 'そのほか', color: '#8d6cc0' },
    // 触れてほしくないところ。図には × で出し、次の来店にも写す
    { id: 'm_notouch', name: '触れないで（×）', color: '#2b2b2b', x: true },
  ],
  jobs: ['営業系', '事務系', '工業系', '主婦(夫)', '学生(運動)', '学生(文化)', 'そのほか'],
  purposes: ['こり・はりをほぐしたい', 'リラックスしたい', '疲れをとりたい', 'ぐっすり眠りたい', 'むくみをすっきり', '気分を変えたい'],
  moods: ['すっきりした香り', '甘い香り', '落ちつく香り', '香りはひかえめに', 'おまかせ'],
  scents: ['とても好き', '好き', 'ふつう', '少し苦手', '苦手'],
  // 肌の状態（問診でえらぶ。キャリアオイルの候補に使う）
  skins: [
    { id: 'sk_dry', name: '乾燥しやすい' }, { id: 'sk_oily', name: 'べたつきやすい' },
    { id: 'sk_age', name: 'ハリ・うるおいが気になる' }, { id: 'sk_sensitive', name: '敏感肌' },
    { id: 'sk_normal', name: 'とくに気にならない' },
  ],
  // アレルギーのしるし。words＝アレルギーの欄にこの言葉が書いてあったら、あてはまるとみなす
  allergens: [
    { id: 'al_nut', name: 'ナッツ類（木の実）', words: 'ナッツ、アーモンド、くるみ、クルミ、カシュー、マカデミア、ヘーゼル、ピスタチオ、木の実' },
    { id: 'al_peanut', name: 'ピーナッツ（落花生）', words: 'ピーナッツ、落花生' },
    { id: 'al_sesame', name: 'ごま', words: 'ごま、ゴマ、胡麻、セサミ' },
    { id: 'al_rice', name: '米', words: '米ぬか、こめ、お米' },
    { id: 'al_wheat', name: '小麦', words: '小麦' },
    { id: 'al_soy', name: '大豆', words: '大豆' },
    { id: 'al_ragweed', name: 'ブタクサ', words: 'ブタクサ' },
    { id: 'al_grass', name: 'イネ科の植物', words: 'イネ科' },
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
    { id: 'gla', name: 'γ-リノレン酸', uses: [], note: '資料：月見草・ボリジ・くるみの油に入っている（0.10.0 で足した）。' },
  ].map((f) => ({ ...f, draft: true })),
};

// 成分の分類（大分類）と、その中の成分（小分類）。がっき〜の資料「アロマ表」の分け方。
//   subs     ：成分（小分類）と、資料でその成分にあるとされる作用
//   cautions ：あてはまるお客さんには、その分類が入っている精油を外す（理由つき）
//   warns    ：外さずに ⚠ をつける
//   tip      ：だれに使うときも出す注意
const sub = (id, name, actions) => ({ id, name, actions });
export const DEFAULT_CATS = [
  { id: 'hyd', name: '炭化水素類', cautions: [], warns: [], tip: '', note: '', subs: [
    sub('sb_mth', 'モノテルペン炭化水素類', ['a_flow']), sub('sb_pinene', 'α-ピネン', ['a_head']),
    sub('sb_limonene', 'リモネン', ['a_digest', 'a_water']), sub('sb_sth', 'セスキテルペン炭化水素類', ['a_lift', 'a_relax', 'a_heat']),
    sub('sb_copaene', 'α-コパエン', ['a_female']), sub('sb_chamazulene', 'カマズレン', ['a_itch'])] },
  { id: 'alc', name: 'アルコール類', cautions: [], warns: [], tip: '', note: '', subs: [
    sub('sb_mta', 'モノテルペンアルコール類', ['a_guard', 'a_lift', 'a_bug']), sub('sb_cedrol', 'セドロール', ['a_flow']),
    sub('sb_linalool', 'リナロール', ['a_calm']), sub('sb_menthol', 'メントール', ['a_cool', 'a_ease', 'a_digest']),
    sub('sb_geraniol', 'ゲラニオール', ['a_skin']), sub('sb_sqa', 'セスキテルペンアルコール類', ['a_female', 'a_flow', 'a_lift']),
    sub('sb_santalol', 'α・β-サンタロール', ['a_calm', 'a_lift', 'a_flow']), sub('sb_nerolidol', 'ネロリドール', ['a_female']),
    sub('sb_dta', 'ジテルペンアルコール類', ['a_female', 'a_lift']), sub('sb_sclareol', 'スクラレオール', ['a_female'])] },
  { id: 'ald', name: 'アルデヒド類', cautions: [], warns: [], tip: '', note: '', subs: [
    sub('sb_tald', 'テルペン系アルデヒド類', ['a_heat', 'a_ease', 'a_calm', 'a_digest', 'a_guard', 'a_other']),
    sub('sb_arald', '芳香族アルデヒド類', ['a_guard', 'a_bug', 'a_lift', 'a_digest'])] },
  { id: 'ket', name: 'ケトン類', cautions: ['c_infant', 'c_preg', 'c_epi', 'c_bpmed'], warns: [], tip: '', note: '資料：乳児・妊娠・てんかん・血圧の薬 は使わない。', subs: [
    sub('sb_ket', 'ケトン類', ['a_breath', 'a_digest', 'a_skin', 'a_other']), sub('sb_menthone', 'メントン', ['a_digest']),
    sub('sb_camphor', 'カンファー', ['a_relax', 'a_bug']), sub('sb_dione', 'β-ジオン', ['a_other'])] },
  { id: 'phe', name: 'フェノール類', cautions: [], warns: ['c_skin'], tip: '肌を傷めることがある。かならずうすめて使う', note: '', subs: [
    sub('sb_phe', 'フェノール類', ['a_bug', 'a_guard', 'a_lift', 'a_warm']), sub('sb_pme', 'フェノールメチルエーテル類', ['a_relax']),
    sub('sb_eugenol', 'オイゲノール', ['a_relax', 'a_ease']), sub('sb_thymol', 'チモール', ['a_ease'])] },
  { id: 'est', name: 'エステル類', cautions: [], warns: [], tip: '', note: '資料：心のストレスのときによく選ばれる。', subs: [
    sub('sb_est', 'エステル類', ['a_relax', 'a_calm', 'a_ease', 'a_heat'])] },
  { id: 'oxi', name: 'オキシド類', cautions: [], warns: [], tip: '', note: '資料：かぜの季節によく選ばれる。', subs: [
    sub('sb_oxi', 'オキシド類', ['a_breath', 'a_guard', 'a_bug']), sub('sb_cineole', '1,8-シネオール', ['a_guard', 'a_heat'])] },
].map((c) => ({ ...c, draft: true }));

// 精油。がっき〜の資料（アロマDB・アロマ表）の30本。名前も資料の呼び方。
//   components：成分の分類ごとの割合（％）。資料に割合がないものは null（入っている・割合は分からない）、'tr'＝微量
//   subs      ：アロマ表でその成分のところにのっている
//   actions   ：アロマDBの「効能」のらん（作用のまとまりに分けたもの）
//   uses      ：資料の「OK」と使いどころのうち、つらいところの言葉にあてはまるもの
//   okConds   ：資料の「OK」のうち、お客さんの状態にあてはまるもの（妊産婦・乳幼児・高齢者）
//   cautions  ：資料の「NG」→ あてはまるお客さんには外す。warns＝外さずに ⚠
//   allergens ：資料の「NG」の植物アレルギー。plant＝資料の「種類」（科。いまは見せるだけ）
// 資料にない数字・注意は足さない（空き＝未記入）。資料が正本
const PREG = ['c_preg', 'c_post']; // 資料の「妊産婦」＝妊娠中と、出産してまもない人
const BP = ['c_bp', 'c_bpmed'];
const O = (id, name, family, plant, components, subs, actions, uses, x = {}) => ({
  id, name, family, plant, components, subs, actions, uses,
  okConds: [], cautions: [], warns: [], allergens: [], note: '', ...x, owned: false, draft: true,
});
export const DEFAULT_OILS = [
  O('o_teatree', 'ティートゥリー', 'f_tree', 'フトモモ科', { hyd: 45, alc: 45, oxi: 5 }, ['sb_mth', 'sb_mta', 'sb_cineole'], ['a_flow', 'a_calm', 'a_guard'], ['s_hana'], { note: '資料の使いどころ：かぜの季節・口のケア。' }),
  O('o_lavender', 'ラベンダー・アングスティフォリア', 'f_flower', 'シソ科', { est: null, alc: null, hyd: null }, ['sb_sth', 'sb_linalool', 'sb_est'], ['a_ease', 'a_calm', 'a_heat'], [], { okConds: [...PREG, 'c_infant', 'c_old'] }),
  O('o_peppermint', 'ペパーミント', 'f_tree', 'シソ科', { alc: 40, ket: 30, oxi: 10 }, ['sb_menthol', 'sb_menthone', 'sb_cineole'], ['a_cool', 'a_ease', 'a_digest', 'a_guard', 'a_heat'], ['s_ichou', 's_hana'],
    { cautions: [...PREG, 'c_infant', 'c_epi', ...BP], note: '資料の使いどころ：むかむかするとき・鼻やのど。アルコール類は「40％強」、オキシド類は「10％弱」と資料に。' }),
  O('o_euc_radiata', 'ユーカリ・ラディアタ', 'f_tree', 'フトモモ科', { oxi: 80, hyd: null, alc: null }, ['sb_limonene', 'sb_mta', 'sb_cineole'], ['a_guard', 'a_heat', 'a_breath', 'a_digest'], ['s_hana'], { note: '資料の使いどころ：鼻の下・耳のまわり・胸・背中にぬる。' }),
  O('o_geranium', 'ゼラニウム・エジプト', 'f_tree', 'フウロソウ科', { alc: null, est: null, ket: null }, ['sb_linalool', 'sb_ket', 'sb_est'], ['a_bug', 'a_skin', 'a_heat', 'a_other'], ['s_hada'], { okConds: [...PREG], note: '資料の使いどころ：虫よけ・虫にさされたとき・しわ・肉割れ・傷あと（妊娠線など）。' }),
  O('o_ravensara', 'ラベンサラ', 'f_tree', 'クスノキ科', { oxi: null, hyd: null, alc: null }, ['sb_limonene', 'sb_mta', 'sb_cineole'], ['a_guard', 'a_heat', 'a_calm'], ['s_hana', 's_nemuri', 's_tsukare'], { okConds: ['c_infant'], note: '資料の使いどころ：かぜの季節・眠れないとき・心やからだの疲れ。' }),
  O('o_helichrysum', 'ヘリクリサム', 'f_tree', 'キク科', { hyd: null, est: null, ket: null }, ['sb_mth', 'sb_sth', 'sb_dione', 'sb_est'], ['a_other'], [], { cautions: [...PREG, 'c_infant', 'c_epi', ...BP], note: '資料の使いどころ：ぶつけたとき・あざ。ケトン類は「大」と資料に（割合はなし）。' }),
  O('o_rosemary', 'ローズマリー・シネオール', 'f_flower', 'シソ科', { oxi: null, hyd: null, ket: null }, ['sb_pinene', 'sb_camphor', 'sb_cineole'], ['a_relax', 'a_bug', 'a_heat', 'a_guard', 'a_head'], ['s_kinniku', 's_kata'], { cautions: [...PREG, 'c_infant', 'c_epi', ...BP], note: '資料の使いどころ：筋肉のつかれ・肩こり。' }),
  O('o_orange', 'オレンジ・スウィート', 'f_citrus', 'ミカン科', { hyd: 95, alc: 'tr' }, ['sb_limonene', 'sb_mta'], ['a_digest', 'a_water'], ['s_ichou'], { cautions: ['c_sun'], note: '資料の使いどころ：おなかの調子・部屋の香りづけ。アルコール類は「微量」と資料に。' }),
  O('o_ylang', 'イランイラン', 'f_flower', 'バンレイシ科', { alc: null, est: null, phe: null }, ['sb_linalool', 'sb_pme', 'sb_est'], ['a_calm', 'a_relax', 'a_heat'], ['s_stress', 's_kibun', 's_hada'], { warns: ['c_skin'], note: '敏感肌は、うすめれば使える と資料に。' }),
  O('o_chamomile_g', 'カモミール・ジャーマン', 'f_flower', 'キク科', { oxi: 50, hyd: null, alc: null }, ['sb_chamazulene', 'sb_sqa', 'sb_oxi'], ['a_heat', 'a_itch', 'a_relax', 'a_female'], [],
    { cautions: ['c_preg_early'], warns: ['c_atopy'], allergens: ['al_ragweed'], note: 'うすめても働きが強い と資料に。アトピーは NG のらんに「注意」、OK のらんにも入っている。' }),
  O('o_chamomile', 'カモミール・ローマン', 'f_flower', 'キク科', { est: 70, ket: null, hyd: null }, ['sb_limonene', 'sb_ket', 'sb_est'], ['a_relax', 'a_calm', 'a_heat', 'a_female'], ['s_stress', 's_nemuri'], { cautions: ['c_preg_early'] }),
  O('o_cypress', 'サイプレス', 'f_flower', 'ヒノキ科', { hyd: 80, alc: null }, ['sb_limonene', 'sb_sth', 'sb_sqa'], ['a_flow', 'a_breath', 'a_head', 'a_female'], ['s_mukumi', 's_hana'], { cautions: ['c_preg_early'] }),
  O('o_sandalwood', 'サンダルウッド', 'f_tree', 'ビャクダン科', { alc: null }, ['sb_santalol'], ['a_calm', 'a_lift', 'a_flow', 'a_female', 'a_breath', 'a_digest'], [], { cautions: ['c_dep'], note: '気分の落ちこみが強いときは使わない（資料のNG）。' }),
  O('o_neroli', 'ネロリ', 'f_flower', 'ミカン科', { alc: 70, est: 10, hyd: null }, ['sb_limonene', 'sb_linalool', 'sb_est'], ['a_calm', 'a_lift', 'a_ease', 'a_guard', 'a_skin'], ['s_stress', 's_kibun', 's_gekkei', 's_hada']),
  O('o_palmarosa', 'パルマローザ', 'f_tree', 'イネ科', { alc: 80, est: null }, ['sb_geraniol', 'sb_est'], ['a_skin', 'a_female'], [],
    { cautions: ['c_preg_early', 'c_preg_mid'], allergens: ['al_grass'], note: '資料の OK のらんに「妊娠（出産時）」もある。NG の「妊婦（中期まで）」と合わせて確かめてね。' }),
  O('o_frankincense', 'フランキンセンス', 'f_tree', 'カンラン科', { hyd: null }, ['sb_pinene', 'sb_sth'], ['a_head', 'a_flow', 'a_calm', 'a_lift'], []),
  O('o_lemon', 'レモン', 'f_citrus', 'ミカン科', { hyd: null, ald: null }, ['sb_limonene', 'sb_tald'], ['a_digest', 'a_water', 'a_flow'], ['s_ichou', 's_mukumi', 's_hada'], { cautions: ['c_sun'], note: 'アルデヒド類は「アロマ表」にあり（「データベース」のシートにはない）。' }),
  O('o_rose', 'ローズ', 'f_flower', '', { alc: null, hyd: null, est: null, oxi: null, ket: null, phe: null }, ['sb_geraniol', 'sb_ket', 'sb_eugenol', 'sb_est', 'sb_oxi'], ['a_skin', 'a_guard', 'a_female'], ['s_hada', 's_gekkei', 's_stress', 's_nemuri'],
    { cautions: ['c_preg_early'], note: '資料の「種類」のらんが「花穂系」になっていた（科の名前がない）ので、科は空けてある。' }),
  O('o_rosewood', 'ローズウッド', 'f_tree', 'クスノキ科', { alc: 90 }, ['sb_linalool'], ['a_calm', 'a_guard', 'a_itch', 'a_breath', 'a_heat'], ['s_hada', 's_tsukare', 's_hana'], { note: 'アルコール類の割合は、アロマ表の「リナロール 90％」から。' }),
  O('o_celery', 'セロリ', '', '', { hyd: null, alc: null }, [], ['a_digest', 'a_water'], [], { note: '資料の「種類」のらんが「タイプC」。アロマ表にも出てこないので、香りの系統と科は空けてある。' }),
  O('o_clary', 'クラリセージ', 'f_tree', 'シソ科', { est: 80, alc: 20 }, ['sb_linalool', 'sb_dta', 'sb_est'], ['a_calm', 'a_ease', 'a_heat', 'a_female'], ['s_nemuri', 's_gekkei'], { cautions: ['c_drive', 'c_drink'] }),
  O('o_juniper', 'ジュニパー', 'f_tree', 'ヒノキ科', { hyd: null }, ['sb_mth', 'sb_sth'], ['a_flow', 'a_heat', 'a_digest', 'a_water'], ['s_koshi', 's_kata'], { cautions: ['c_preg'] }),
  O('o_cedar', 'シダー', 'f_tree', 'ヒノキ科', { hyd: null, alc: null }, ['sb_sth', 'sb_cedrol'], ['a_flow', 'a_female'], ['s_mukumi'], { cautions: [...PREG] }),
  O('o_myrrh', 'ミルラ', 'f_tree', 'カンラン科', { hyd: null }, ['sb_copaene'], ['a_relax', 'a_heat', 'a_female', 'a_lift'], ['s_ichou', 's_kibun', 's_gekkei'], { cautions: ['c_preg'] }),
  O('o_euc_citriodora', 'ユーカリ・レモン', 'f_tree', 'フトモモ科', { ald: 80, alc: null }, ['sb_mta', 'sb_tald'], ['a_ease', 'a_bug'], ['s_kata']),
  O('o_patchouli', 'パチュリー', 'f_flower', 'シソ科', { hyd: null, alc: null }, ['sb_sth', 'sb_sqa'], ['a_flow', 'a_skin'], []),
  O('o_marjoram', 'マジョラム', 'f_flower', 'シソ科', { hyd: null, alc: null }, ['sb_mth', 'sb_mta'], ['a_calm', 'a_digest', 'a_flow'], ['s_stress'], { cautions: [...PREG] }),
  O('o_lemongrass', 'レモングラス', 'f_tree', 'イネ科', { ald: 80, hyd: null, alc: null }, ['sb_limonene', 'sb_mta', 'sb_tald'], ['a_itch', 'a_flow', 'a_heat', 'a_ease', 'a_calm'], ['s_kata', 's_hie']),
  O('o_mandarin', 'マンダリン', 'f_citrus', 'ミカン科', { hyd: 90, est: null, alc: null }, ['sb_limonene', 'sb_linalool', 'sb_est'], ['a_digest', 'a_water', 'a_calm'], ['s_nemuri', 's_tsukare', 's_ichou'], { cautions: ['c_sun'], note: 'アルコール類は「アロマ表」（リナロール）にあり。' }),
];
// 前の下書きにあって、がっき〜の資料にない精油（11本）。新しく入れる端末には入れない。版4への移し替えで「資料にない」（候補の点数に入れない）にして残し、
// 版11（0.12.0）で、使っている端末からもぜんぶ消す（がっき〜：「資料に無いものは全部消してOK」）。
export const OLD_ONLY_OILS = {
  o_eucalyptus: 'f_tree', o_grapefruit: 'f_citrus', o_bergamot: 'f_citrus', o_yuzu: 'f_citrus', o_jasmine: 'f_flower',
  o_vetiver: '', o_ginger: '', o_pepper: '', o_hinoki: 'f_tree', o_petitgrain: '', o_clove: '',
};

// キャリアオイル。精油と同じ作り：成分（脂肪酸など）・特徴・向いている肌の状態・目的・アレルギーのしるし。
// 0.10.0（データの形 版9）から、がっき〜がアロマを学んだときのプリント（キャリアオイル・スキンケア）に合わせた。資料が正本。
//   資料に割合（％）がない成分は null（「入っている・割合は分からない」）。数字を埋めない
//   traits：feel＝のび・重さ（1 軽い〜3 重い）、oxid＝酸化しやすさ（1 しにくい〜3 しやすい）、scent＝香り（1 ほとんどない〜3 強め）。資料にその油のこととして書いてあるものだけ入れた
//   ref：false＝資料にない油（候補の点数に入れない）。0.12.0 から、はじめの一覧には入れない（下の OLD_ONLY_CARRIERS）
//   allergens：資料にはない。名前から分かる原料（ナッツ・ごま など）は、安全のため残した（がっき〜に確かめ中）
const K = (id, name, fatty, traits, skins, purposes, allergens, note = '', more = {}) => ({ id, name, fatty, traits, skins, purposes, allergens, cautions: [], note, owned: false, draft: true, ref: true, ...more });
const HOGUSU = 'こり・はりをほぐしたい';
const ALL_SKINS = ['sk_dry', 'sk_oily', 'sk_age', 'sk_normal'];
export const DEFAULT_CARRIERS = [
  K('k_jojoba', 'ホホバオイル', { wax: null }, { oxid: 1 }, ALL_SKINS, [], [], '油ではなく、液体のろう（ワックス）。資料：どの肌にも合うとされる。酸化しにくく長く保存できる。10℃くらいで固まるが、あたためると戻る（くり返しても質は変わらない）。かぶれの報告もある、とも書いてある。'),
  K('k_almond', 'スイートアーモンドオイル', { ole: null }, {}, [], [], ['al_nut'], '資料：オレイン酸が主のグループに名前があるだけ（くわしい説明はない）。'),
  K('k_grape', 'グレープシードオイル', { lin: null }, { feel: 1 }, [], [], [], '資料：ブドウの種を、熱をかけてしぼる。しみこみがよく、さらっとしている。酸化しにくいとも言われるが、リノール酸が主なので保存に気をつける（酸化しやすさは、資料の中で2通りに読めるので空けてある）。'),
  K('k_macadamia', 'マカデミアナッツオイル', { ole: null, pmo: null }, {}, ['sk_dry'], [], ['al_nut'], '資料：オレイン酸などが多い（8割をこえる）。パルミトレイン酸がほかの油より多い（ヒトの皮脂にも多く、年とともに減る成分）。肌への刺激が少ない。乾燥した肌に。髪にも。'),
  K('k_sesame', 'セサミオイル（生のごま）', { ole: null, lin: null }, { scent: 1 }, [], [], ['al_sesame'], '料理用の茶色いごま油とは別のもの。資料：オレイン酸とリノール酸がほぼ半分ずつ。マッサージには生しぼり（においがない）を使う。ほかの油に10〜20％混ぜると、酸化しにくくなる。'),
  K('k_apricot', 'アプリコットカーネルオイル', {}, { feel: 1, oxid: 1 }, ['sk_dry', 'sk_sensitive'], [], ['al_nut'], 'あんずの種の中身を低温でしぼる。資料：敏感肌・乾燥肌に向く。しみこみがよく、さらっとしている。酸化にも比較的強い。顔のベースや、ほかの油とのブレンドに。成分は資料に書いていない。ナッツのアレルギーは資料にないが、念のため確かめる。'),
  K('k_tsubaki', '椿オイル', { ole: null }, { oxid: 1 }, [], [], [], '別名カメリア油。資料：オレイン酸が主で、酸化に強く保存しやすい。スキンケア用に精製したものは、さらっとしてしみこみがよく、べたつきが少ない（顔のベースに向く）。薬局のものはべたつき、マッサージに向かない、とメモ。のび・重さは、ものによってちがうので空けてある。'),
  K('k_rosehip', 'ローズヒップオイル', { lin: null }, {}, ['sk_dry'], [], [], '資料：ローズの種からとる。ビタミンCが多い。リノール酸が主のグループ（資料では「安定しない」グループ）。乾燥肌に。酸化しやすさは、この油のこととしては書いていないので空けてある。'),
  K('k_avocado', 'アボカドオイル', { ole: null }, {}, ['sk_dry'], [], [], '資料：果肉を低温でしぼる。ビタミン・ミネラルが多い。しっとりやわらかくする力が強く、しみこみもよい。乾燥肌に。顔・体はほかの油とブレンドすると使いやすい（乾燥がひどいときは、そのままでも）。冬の乾燥に、とメモ。'),
  // ここから下は、資料にあって 0.9.0 までのアプリに無かった油
  K('k_olive', 'オリーブオイル', { ole: null }, { oxid: 1 }, [], [], [], '資料：オレイン酸とポリフェノールを含む。酸化に強い。浸出油（ハーブを漬けて作る油）のベースにも。髪にも。'),
  K('k_sunflower', 'サンフラワーオイル（ひまわり）', { ole: null, lin: null }, {}, [], [], [], '資料：オレイン酸の多い型と、リノール酸の多い型がある。マッサージには、低温でしぼったものが向く（薬品で取り出して精製したものは向かない）。肌をやわらかくし、うるおいを与える。浸出油のベースにも。'),
  K('k_hazelnut', 'ヘーゼルナッツオイル', { ole: null, pmo: null }, {}, [], [], ['al_nut'], '資料：オレイン酸が主で、パルミトレイン酸も多い。しみこみがよい。かぶれなどアレルギーの原因になるかもしれない、という指摘があり注意。部分ぬりやブレンドに。髪にも。'),
  K('k_walnut', 'ウォールナッツオイル（くるみ）', { gla: null }, {}, [], [], ['al_nut'], '資料：多価不飽和脂肪酸が主で、γ-リノレン酸も含む。マッサージオイルに向く。日本ではほとんど売っていない、とメモ。'),
  K('k_peach', 'ピーチカーネルオイル', {}, { feel: 1, oxid: 1 }, ['sk_dry', 'sk_sensitive'], [], [], '資料：アプリコットカーネルと同じあつかい（敏感肌・乾燥肌に向く・さらっとしている・酸化にも比較的強い）。成分は資料に書いていない。'),
  K('k_wheatgerm', '小麦胚芽オイル（ウィートジャーム）', { lin: null }, { oxid: 1, scent: 2 }, ['sk_dry', 'sk_age'], [], ['al_wheat'], '資料：ビタミンEが多く、酸化をふせぐ力が強い。小麦のにおいが少しあるので、ほかの油に5〜10％混ぜて使う。乾燥肌・年齢肌に。小麦のアレルギーは資料にないが、名前から念のためしるしをつけた。'),
  K('k_primrose', 'イブニングプリムローズオイル（月見草）', { gla: null }, {}, ['sk_dry', 'sk_age'], [], [], '資料：γ-リノレン酸を含む。乾燥肌・年齢肌に。'),
  K('k_borage', 'ボリジオイル', { gla: null }, {}, ['sk_dry', 'sk_age'], [], [], '資料：γ-リノレン酸を含む。乾燥肌・年齢肌に。'),
  K('k_calendula', 'カレンデュラオイル（浸出油）', {}, {}, ['sk_dry', 'sk_sensitive'], [], [], '資料：ハーブを植物油に漬けて作る油（浸出油）。デリケートな肌・かさついた肌に向く。赤ちゃんの肌にも、と書いてある。'),
  K('k_stjohns', 'セントジョンズワートオイル（浸出油）', {}, {}, [], [], [], '資料：浸出油。日光に当たると肌トラブルが起きやすくなる成分（光感作）を含む → ぬったところに直射日光を当てない。', { cautions: ['c_sun'] }),
  K('k_arnica', 'アルニカオイル（浸出油）', {}, {}, [], [], [], '資料：浸出油。スポーツのあとのマッサージ向き。肌への刺激がある → アレルギー・敏感肌の人は、カレンデュラにかえるか、パッチテストのあとに使う。', { cautions: ['c_skin'] }),
];
// 資料にないキャリアオイル（米ぬか・アルガン・分留ココナッツ）。0.12.0 から、新しく入れる端末には入れない（がっき〜：「はじめの一覧は資料にあるものだけ。自分で増やせるから」）。
// 古い版からの移し替え（版2・版9）に使い、版11でぜんぶ消す
export const OLD_ONLY_CARRIERS = [
  K('k_rice', 'ライスブランオイル（米ぬか）', { ole: 42, lin: 35, pal: 17 }, { feel: 2, oxid: null, scent: 1 }, [], [HOGUSU], ['al_rice'], '酸化しやすさは空けてある。資料で確かめて入れる。', { ref: false }),
  K('k_argan', 'アルガンオイル', { ole: 46, lin: 33, pal: 13, ste: 5 }, { feel: 2, oxid: 2, scent: 2 }, [], [], ['al_nut'], 'アルガンの木の実の種のオイル。ナッツのアレルギーがある人は、念のため確かめる。', { ref: false }),
  K('k_mct', 'ココナッツオイル（分留したもの）', { mct: 95 }, { feel: 1, oxid: 1, scent: 1 }, [], [], [], '固まるふつうのココナッツオイルとは別。液体のまま固まらない。', { ref: false }),
];
// 0.9.0 までの下書き（版9への移し替えで「使う人が直したか」を見分けるために残す）
export const CARRIERS_V8 = [
  K('k_rice', 'ライスブランオイル（米ぬか）', { ole: 42, lin: 35, pal: 17 }, { feel: 2, oxid: null, scent: 1 }, [], [HOGUSU], ['al_rice'], '酸化しやすさは空けてある。資料で確かめて入れる。'),
  K('k_argan', 'アルガンオイル', { ole: 46, lin: 33, pal: 13, ste: 5 }, { feel: 2, oxid: 2, scent: 2 }, [], [], ['al_nut'], 'アルガンの木の実の種のオイル。ナッツのアレルギーがある人は、念のため確かめる。'),
  K('k_mct', 'ココナッツオイル（分留したもの）', { mct: 95 }, { feel: 1, oxid: 1, scent: 1 }, [], [], [], '固まるふつうのココナッツオイルとは別。液体のまま固まらない。'),
  K('k_jojoba', 'ホホバオイル', { wax: 97 }, { feel: 1, oxid: 1, scent: 1 }, ['sk_normal'], [], [], '油ではなく、液体のろう。寒いと固まるが、あたためると戻る。'),
  K('k_almond', 'スイートアーモンドオイル', { ole: 68, lin: 22, pal: 6 }, { feel: 2, oxid: 2, scent: 1 }, ['sk_dry'], [HOGUSU], ['al_nut'], 'のびがよく、全身に使いやすいと言われる。'),
  K('k_grape', 'グレープシードオイル', { lin: 70, ole: 18, pal: 7, ste: 4 }, { feel: 1, oxid: 3, scent: 1 }, [], [], [], '開けたら早めに使い切る。'),
  K('k_macadamia', 'マカデミアナッツオイル', { ole: 58, pmo: 20, pal: 8, ste: 3, lin: 2 }, { feel: 2, oxid: 1, scent: 2 }, [], [HOGUSU], ['al_nut']),
  K('k_sesame', 'セサミオイル（生のごま）', { ole: 40, lin: 43, pal: 9, ste: 5 }, { feel: 3, oxid: 1, scent: null }, [], [], ['al_sesame'], '料理用の茶色いごま油とは別のもの。香りは空けてある。'),
  K('k_apricot', 'アプリコットカーネルオイル', { ole: 65, lin: 27, pal: 5 }, { feel: 1, oxid: 2, scent: 1 }, ['sk_dry'], [], ['al_nut'], 'あんずの種の中身のオイル。ナッツのアレルギーがある人は、念のため確かめる。'),
  K('k_tsubaki', '椿オイル', { ole: 85, lin: 4, pal: 8 }, { feel: 3, oxid: 1, scent: 1 }, [], [], []),
  K('k_rosehip', 'ローズヒップオイル', { lin: 44, aln: 33, ole: 14 }, { feel: null, oxid: 3, scent: 2 }, [], [], [], 'とても酸化しやすい。ほかのオイルに少し混ぜて使うことが多い。冷蔵庫で保管し、早めに使い切る。'),
  K('k_avocado', 'アボカドオイル', { ole: 65, pal: 15, lin: 12, pmo: 5 }, { feel: 3, oxid: 2, scent: null }, ['sk_dry'], [], [], '重いので、ほかのオイルに混ぜて使うことが多い。精製したものと、していないもので色・香りが違う。'),
];

// メニューは買った人が自分で作る前提。はじめは例を3つだけ。
export const DEFAULT_MENUS = [
  { id: 'mn_1', name: '整体', minutes: 60 },
  { id: 'mn_2', name: 'アロマトリートメント', minutes: 60 },
  { id: 'mn_3', name: 'アロマトリートメント', minutes: 90 },
  // 部位だけのメニューの見本（scope＝施術するところ。メニューをえらぶだけで、図と濃度の目安がそろう）
  { id: 'mn_4', name: 'ハンドトリートメント', minutes: 20, scope: { type: 'part', parts: ['hand'] } },
  { id: 'mn_5', name: 'フットトリートメント', minutes: 30, scope: { type: 'part', parts: ['foot'] } },
];
