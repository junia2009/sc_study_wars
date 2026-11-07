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
  // 朝: 先輩からの依頼
  intro: [
    { who: 'sys', text: '月曜 9:00 ── junia 商事 情報システム部' },
    { who: 'kuroda', text: 'おはよう……(あくび)。{name}だっけ。配属初日に悪いけど、いきなり仕事だ' },
    { who: 'kuroda', text: '今週、取引先を名乗る詐欺メールが経理部に来てる。金曜には大口の支払いがある。それまで経理部を守ってくれ' },
    { who: 'kuroda', text: 'コツは3つ。①見る。②別の道で確かめる。③迷ったら相談。……あと、だいたいの障害は DNS のせいだ' },
    { who: 'guard', text: 'は、はじめまして! 見習い用セキュリティ AI のガードです。がんばります……たぶん' },
    { who: 'kuroda', text: '確かめるには、本物の情報が要る。社内ポータルに経費システムのブックマーク、経理のファイルサーバーに取引先の連絡先台帳がある。ガードで取ってこい' },
    { who: 'sys', text: '今日の任務: ①公式ブックマークを手に入れる ②連絡先台帳を手に入れる ③経理部からの相談に乗る' },
  ],
  // 判断シーンの前のひとこと(時刻が進む)
  before: {
    invoice: [{ who: 'sys', text: '10:30 ── 経理部の佐藤さんから相談が届いた' }],
    bec: [
      { who: 'sys', text: '14:00 ── 佐藤さんから、もう一度相談が届いた' },
      { who: 'guard', text: 'また山田さんからのメールみたいです。……この人、すごく急いでるんですね!' },
    ],
    phish: [
      { who: 'sys', text: '16:30 ── {name}あてにメールが届いた' },
      { who: 'guard', text: '{name}さん、パスワードの期限が切れるって書いてあります! 大変です!' },
    ],
  },
  // ゴール(ログアウトゲート)に着いたら: 黒幕の登場
  boss: [
    { who: 'sys', text: '17:00 ── ネットワークの奥に、見慣れない影が現れた' },
    { who: 'angler', text: '……ほう。今日の獲物は、ずいぶん用心深いな' },
    { who: 'anglerKnown', text: '我々は「フィッシャーズ」。俺はアングラー。今日はご挨拶代わりだ' },
    { who: 'anglerKnown', text: '明日は撒き餌を変える。……お前たちの身内の顔で、釣ってやろう' },
    { who: 'guard', text: 'ま、待ってください! ……行っちゃいました' },
  ],
  // 夕方の振り返り(評価のあと)
  outro: [
    { who: 'kuroda', text: '「身内の顔」か……明日は上司や社長のなりすましが来るぞ' },
    { who: 'kuroda', text: 'お疲れ。今日はもう帰れ。俺はこれから DNS を見る' },
  ],
  // 判断シーンの順番(地図の T の左から)と、そのときの時刻
  scenes: ['invoice', 'bec', 'phish'],
  clocks: { invoice: '10:30', bec: '14:00', phish: '16:30', boss: '17:00' },
  // ステージのところどころで出るひとこと(地図の i の左から)
  hints: [
    { who: 'guard', text: 'ここは社内ポータルです。ブックマークを探しましょう!' },
    { who: 'guard', text: 'この先は経理部のファイルサーバーです。台帳は高いところにあるみたいです' },
    { who: 'guard', text: 'もうすぐ夕方です。ネットワークの出口(ログアウトゲート)まであと少し!' },
  ],
};

// 振り返りの評価と、部長の一言
export const GRADES = [
  { min: 90, grade: 'S', boss: '何も起きなかったな。……何も起きないのが一番だ' },
  { min: 75, grade: 'A', boss: '上出来だ。明日もこの調子で頼む' },
  { min: 55, grade: 'B', boss: 'まあ、無事ならいい。確かめる癖をつけていこう' },
  { min: 35, grade: 'C', boss: 'ヒヤッとしたぞ。明日は落ち着いていこう' },
  { min: 0, grade: 'D', boss: '来週、会議室を押さえておいてくれ' },
];
