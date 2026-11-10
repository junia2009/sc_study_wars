// 物語の台本(会話)と、手がかりの中身。
//
// 会話は { who, text } の並び。who は登場人物(PEOPLE のキー)。
// text の中の {name} は、プレイヤーが付けた主人公の名前に置き換わる。
// 社名・人名・ドメインはすべて架空。ドメインは例示用の .example を使う。

export const PEOPLE = {
  kuroda: { name: '黒田先輩', face: 'kuroda' },
  guard: { name: 'ガード', face: 'guard' },
  sato: { name: '佐藤さん', face: 'sato' },
  angler: { name: '???', face: 'angler' },
  anglerKnown: { name: 'アングラー', face: 'angler' },
  sys: { name: '', face: null },
};

// 手がかり(手帳に記録される)。判断シーンで本物と見比べるのに使う
export const CLUES = {
  // 火曜〜日曜の手がかり(下の bookmark・ledger は月曜から)
  rules: {
    name: '社内ルールの紙',
    sprite: 'rules',
    where: '人事部の掲示板',
    lines: [
      '・ギフトカードや電子マネーの購入を、メールやチャットで頼むことはありません(総務部)',
      '・振込先の変更や急ぎの支払いは、上司の承認と電話での確認が必要です',
      '・役員の依頼でも、ルールに合わないものは断ってかまいません',
    ],
    hint: '偉い人の名前で急かされても、ルールを盾に断っていい',
  },
  extlist: {
    name: '拡張子の見分け表',
    sprite: 'extlist',
    where: 'メールサーバー',
    lines: [
      '書類: .pdf .docx .xlsx .jpg',
      '実行ファイル(開くとプログラムが動く): .exe .scr .bat .js',
      'マクロ付き(「有効化」しない): .docm .xlsm',
      '「請求書.pdf.exe」のように、拡張子が2つ並ぶものは要注意',
    ],
    hint: 'ファイル名の最後(いちばん右)の拡張子を見る',
  },
  naisen: {
    name: '情シスの内線番号表',
    sprite: 'naisen',
    where: '在宅勤務の回線',
    lines: ['情報システム部 ヘルプデスク: 内線 1234', '情シスが電話やメールで、パスワードを聞くことはありません'],
    hint: '電話の相手を確かめるときは、こちらからこの番号にかけ直す',
  },
  irp: {
    name: '初動対応の手順書',
    sprite: 'irp',
    where: '休日のサーバー室',
    lines: ['① ネットワークから切り離す(LAN ケーブルを抜く・Wi-Fi を切る)', '② 電源は切らない(調べる手がかりが消える)', '③ すぐ情シスに報告する。身代金は払わない'],
    hint: 'ランサムウェアの画面が出たら、この順で動く',
  },
  bookmark: {
    name: '経費システムの公式ブックマーク',
    sprite: 'bookmark',
    where: '社内ポータル',
    lines: ['経費精算システム(公式)', 'https://keihi.junia-shoji.example/'],
    hint: 'ログインは、メールのリンクではなく、ここから開く',
  },
  ledger: {
    name: '取引先の連絡先台帳',
    sprite: 'ledger',
    where: '経理部のファイルサーバー',
    lines: [
      'サンプル物産 経理部 山田 様',
      'メール: yamada@sample-bussan.example',
      '電話: 03-1234-5678(代表)',
      '振込先: ○○銀行 本店 普通 7654321',
    ],
    hint: '取引先に確かめるときは、ここの番号に電話する',
  },
};

export const MONDAY = {
  id: 'monday',
  day: '月曜',
  // 朝: 先輩からの依頼(3つの基本動作は、オープニングムービーで先輩が説明している)
  intro: [
    { who: 'sys', text: '月曜 9:00 ── junia 商事 情報システム部' },
    { who: 'kuroda', text: '{name}、初日から仕事だ。経理部を詐欺から守れ' },
    { who: 'kuroda', text: '確かめるには「本物の情報」が要る。手がかりを集めてこい' },
    { who: 'guard', text: 'AI のガードです! 操作は入口で教えます' },
  ],
  // 判断シーンの前のひとこと(時刻が進む)
  before: {
    invoice: [
      { who: 'sys', text: '10:30 ── 佐藤さんから相談' },
    ],
    bec: [
      { who: 'sys', text: '14:00 ── 佐藤さんから、また相談' },
    ],
    phish: [
      { who: 'sys', text: '16:30 ── {name}あてにメール' },
    ],
  },
  // ゴール(ログアウトゲート)に着いたら: 黒幕の登場
  boss: [
    { who: 'sys', text: '17:00 ── 見慣れない影が現れた' },
    { who: 'angler', text: '我々は「フィッシャーズ」。明日は、身内の顔で釣ってやろう' },
  ],
  // 夕方の振り返り(評価のあと)
  outro: [
    { who: 'kuroda', text: '「身内の顔」……明日は社長のなりすましだな。お疲れ' },
  ],
  // 判断シーンの順番(地図の T の左から)と、そのときの時刻
  scenes: ['invoice', 'bec', 'phish'],
  clocks: { invoice: '10:30', bec: '14:00', phish: '16:30', boss: '17:00' },
  // ステージのところどころで出るガードの説明(地図の i の左から)
  //   talk: ゲームを止めて会話で説明する(チュートリアル) / say: 止めずにひとこと
  //   point: 会話のあいだ光らせる画面の部分
  //   help: 遊び方を教えるだけの説明。一度その日を最後まで遊んだら(ゲートに着いたら)、2回目からは出さない
  //         (release の敵はそのまま動き出す)。物語の会話には付けない
  //   {move} {jump} {note} {pause} は、タッチ端末かどうかで操作の書き方が変わる
  hints: [
    {
      help: true,
      talk: [
        { who: 'guard', text: '{move}で移動。右へ進もう' },
      ],
    },
    {
      help: true,
      talk: [
        { who: 'guard', text: '{jump}でジャンプ。長押しで高く跳べる' },
      ],
    },
    {
      help: true,
      talk: [
        { who: 'guard', text: '結晶は「業務データ」。拾うと遅れが減る', point: '#hud .gauge.delay' },
      ],
    },
    {
      help: true,
      release: 'tutorial',
      talk: [
        { who: 'guard', text: '敵だ! {shoot}で撃つか、上から踏む', point: '#hud .gauge.leak' },
        { who: 'guard', text: '長押しで、ため撃ち。置いていった敵は夕方に見つかる' },
      ],
    },
    {
      help: true,
      talk: [
        { who: 'guard', text: '「!」ブロックは、下から叩く' },
      ],
    },
    {
      help: true,
      talk: [
        { who: 'guard', text: '穴の下は本番環境。落ちると漏洩!' },
      ],
    },
    {
      help: true,
      talk: [
        { who: 'guard', text: '左上は時刻', point: '#hud-clock' },
        { who: 'guard', text: '漏洩が満タンで、障害報告書', point: '#hud .gauge.leak' },
        { who: 'guard', text: '遅れが満タンで、始末書', point: '#hud .gauge.delay' },
        { who: 'guard', text: '手帳は{note}、一時停止は{pause}' },
      ],
    },
    { help: true, say: { who: 'guard', text: '公式ブックマークを探そう!' } },
    { help: true, say: { who: 'guard', text: '連絡先台帳は、階段の上!' } },
    {
      help: true,
      release: 'sort',
      talk: [
        { who: 'guard', text: 'メール便! 頭の札はドメイン。本物は sample-bussan' },
        { who: 'guard', text: '本物は受け止める。偽物は撃つか踏む' },
      ],
    },
    { sortReport: true },
    {
      help: true,
      talk: [
        { who: 'guard', text: '「!」の端末を通ると、判断シーン' },
      ],
    },
    { say: { who: 'guard', text: 'もうすぐ夕方。出口へ!' } },
    {
      help: true,
      talk: [
        { who: 'guard', text: 'ログアウトゲートで、今日はおしまい' },
      ],
    },
  ],
  // 初めて画面に映ったときの説明(練習区間で教えていない敵)
  //   talk: ゲームを止めて説明 / say: 止めずにひとこと
  firstSight: {
    pass: {
      help: true,
      talk: [
        { who: 'guard', text: '「Password1!」。鎧は、ため撃ちか踏みつけで割れる' },
      ],
    },
    soft: { help: true, say: { who: 'guard', text: '中身が逃げる! とどめを' } },
    virus: {
      help: true,
      talk: [
        { who: 'guard', text: 'マルウェア! 放っておくと分裂する。早めに倒そう' },
      ],
    },
    bot: {
      help: true,
      talk: [
        { who: 'guard', text: 'ボット! 「!」の後に急降下。ジャンプ撃ちか踏む' },
      ],
    },
    tail: {
      help: true,
      talk: [
        { who: 'guard', text: '社員証のない人……共連れだ!' },
        { who: 'guard', text: '胸に社員証がある本物は、撃たないで' },
      ],
    },
    spam: { help: true, say: { who: 'guard', text: '迷惑メールの群れ! まとめて撃とう' } },
  },
};

// 振り返りの評価と、部長の一言
export const GRADES = [
  { min: 90, grade: 'S', boss: '何も起きなかったな。……何も起きないのが一番だ' },
  { min: 75, grade: 'A', boss: '上出来だ。明日もこの調子で頼む' },
  { min: 55, grade: 'B', boss: 'まあ、無事ならいい。確かめる癖をつけていこう' },
  { min: 35, grade: 'C', boss: 'ヒヤッとしたぞ。明日は落ち着いていこう' },
  { min: 0, grade: 'D', boss: '来週、会議室を押さえておいてくれ' },
];
