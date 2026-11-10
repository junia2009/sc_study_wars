// 判断シーンを「操作」にするためのデータ。scenes.js / days.js の選択肢に、順番どおりに重ねる。
//
//   lesson   結果で大きく出す1行(25字くらいまで)。くわしい説明は「くわしく」の中
//   loss     引っかかったときに飛んでいくもの(絵文字)
//   compare  「手帳と重ねる」で見比べる行
//              kind 'diff'(省略時): mail と ref を1文字ずつ重ね、違う文字を光らせる
//              kind 'ext' : ファイル名のいちばん右の拡張子を取り出して見せる
//              kind 'rule': 手帳の決まりごとの1行を見せる
//   acts     選択肢と同じ順番で、ボタンの絵と短い名前
//              via   電話: 'book' = 手帳の番号 / 'mail' = メールに書かれた番号(ダイヤル画面で選ぶ)
//              dial  ダイヤル画面に出す番号
//              group 同じ group のボタンは1つにまとめ、when で中身が変わる
//                    when 'compared' = 見比べを全部すませた / 'not' = すませていない
// 先輩への相談(cause: 'escalate')は、どの場面でも 🙋「先輩に相談」になる。

export const ESCALATE = { icon: '🙋', short: '先輩に相談' };

export const ACTIONS = {
  invoice: {
    lesson: 'いつもどおりでも、台帳と見比べてから',
    loss: '💸',
    compare: [
      { label: '送り主', mail: 'yamada@sample-bussan.example', clue: 'ledger', ref: 'yamada@sample-bussan.example' },
      { label: '振込先', mail: '○○銀行 本店 普通 7654321', clue: 'ledger', ref: '○○銀行 本店 普通 7654321' },
    ],
    acts: [
      { icon: '✅', short: '処理する', group: 'go', when: 'compared' },
      { icon: '📞', short: '電話する', via: 'book', dial: '03-1234-5678(台帳)' },
      { icon: '⛔', short: '全部止める' },
      { icon: '✅', short: '処理する', group: 'go', when: 'not' },
    ],
  },
  bec: {
    lesson: '振込先の変更は、台帳の番号で確かめる',
    loss: '💸',
    compare: [
      { label: '送り主', mail: 'yamada@sanple-bussan.example', clue: 'ledger', ref: 'yamada@sample-bussan.example' },
      { label: '返信先', mail: 'yamada.keiri@freemail.example', clue: 'ledger', ref: 'yamada@sample-bussan.example' },
      { label: '振込先', mail: '△△銀行 西支店 普通 1234567', clue: 'ledger', ref: '○○銀行 本店 普通 7654321' },
      { label: '電話', mail: '03-0000-0000', clue: 'ledger', ref: '03-1234-5678' },
    ],
    acts: [
      { icon: '📞', short: '電話する', via: 'book', dial: '03-1234-5678(台帳)' },
      { icon: '📞', short: '電話する', via: 'mail', dial: '03-0000-0000(メールの直通)' },
      { icon: '↩️', short: '返信で聞く' },
      { icon: '💸', short: '先に振り込む' },
    ],
  },
  phish: {
    lesson: 'ログインは、ブックマークから',
    loss: '🔑',
    compare: [
      { label: '差出人', mail: 'keihi-junia-shoji.example', clue: 'bookmark', ref: 'keihi.junia-shoji.example' },
      { label: 'リンク先', mail: 'keihi.junla-shoji.example', clue: 'bookmark', ref: 'keihi.junia-shoji.example' },
    ],
    acts: [
      { icon: '🔖', short: 'ブックマークで開く' },
      ESCALATE,
      { icon: '🔒', short: '鍵を見て入力' },
      { icon: '🔗', short: 'リンクで更新' },
    ],
  },
  ceo: {
    lesson: 'ルールに合わない頼みは、断っていい',
    loss: '🎁',
    compare: [{ kind: 'rule', label: 'ギフトカード', clue: 'rules', ref: 0 }],
    acts: [
      { icon: '🚫', short: '断って内線で確認' },
      ESCALATE,
      { icon: '💬', short: '本人に聞き返す' },
      { icon: '🎁', short: 'カードを買う' },
    ],
  },
  mfaSetup: {
    lesson: '多要素認証は、すぐ・いつもの入口で',
    loss: '🔓',
    acts: [
      { icon: '🔖', short: 'ポータルで設定' },
      { icon: '🔗', short: 'メールの手順で' },
      { icon: '⏸️', short: 'あとで' },
    ],
  },
  attach: {
    lesson: 'ファイル名は、いちばん右まで読む',
    loss: '🦠',
    compare: [{ kind: 'ext', label: '添付', mail: '請求書_10月.pdf.exe', clue: 'extlist' }],
    acts: [
      { icon: '🚩', short: '開かずに報告' },
      ESCALATE,
      { icon: '🗑️', short: '黙って消す' },
      { icon: '📂', short: '開いてみる' },
    ],
  },
  reuse: {
    lesson: 'パスワードは、サービスごとに別々',
    loss: '🔑',
    acts: [
      { icon: '🔐', short: '専用に作る' },
      { icon: '♻️', short: 'いつもの' },
      { icon: '🏢', short: '社名+年号' },
    ],
  },
  vishing: {
    lesson: '電話は切って、こちらからかけ直す',
    loss: '🔑',
    compare: [
      { label: '相手の番号', mail: '非通知', clue: 'naisen', ref: '内線 1234' },
      { kind: 'rule', label: 'パスワード', clue: 'naisen', ref: 1 },
    ],
    acts: [
      { icon: '📞', short: 'かけ直す', via: 'book', dial: '内線 1234(内線番号表)' },
      ESCALATE,
      { icon: '❓', short: '名前を聞く' },
      { icon: '🔑', short: 'パスワードを言う' },
    ],
  },
  vpn: {
    lesson: '更新は、後回しにしない',
    loss: '🔓',
    acts: [
      { icon: '🔖', short: '手順書で更新' },
      { icon: '📞', short: '電話する', via: 'book', dial: '内線 1234(ヘルプデスク)' },
      { icon: '⏸️', short: '来月まとめて' },
    ],
  },
  takeover: {
    lesson: 'アドレスが本物でも、電話で確かめる',
    loss: '💸',
    compare: [
      { label: '送り主', mail: 'yamada@sample-bussan.example', clue: 'ledger', ref: 'yamada@sample-bussan.example' },
      { label: '振込先', mail: '△△銀行 西支店 普通 1234567', clue: 'ledger', ref: '○○銀行 本店 普通 7654321' },
    ],
    acts: [
      { icon: '📞', short: '電話する', via: 'book', dial: '03-1234-5678(台帳)' },
      ESCALATE,
      { icon: '↩️', short: '返信する' },
      { icon: '💸', short: '振り込む' },
    ],
  },
  payment: {
    lesson: '確かめたら、ためらわず進める',
    loss: '💸',
    compare: [{ label: '振込先', mail: '○○銀行 本店 普通 7654321', clue: 'ledger', ref: '○○銀行 本店 普通 7654321' }],
    acts: [
      { icon: '✅', short: '処理する', group: 'go', when: 'compared' },
      { icon: '⏸️', short: '来週に延ばす' },
      { icon: '✅', short: '処理する', group: 'go', when: 'not' },
    ],
  },
  ransom: {
    lesson: '切り離す・電源は切らない・すぐ報告',
    loss: '💰',
    compare: [{ kind: 'rule', label: '最初にやること', clue: 'irp', ref: 0 }],
    acts: [
      { icon: '🔌', short: '切り離して報告' },
      ESCALATE,
      { icon: '🔄', short: '再起動' },
      { icon: '💰', short: '払う' },
    ],
  },
  support: {
    lesson: '頼んでいない業者は、二度目の詐欺',
    loss: '🖥️',
    acts: [
      { icon: '🚫', short: '断って切る' },
      { icon: '🖥️', short: 'ソフトを入れる' },
      { icon: '❓', short: '名前を聞く' },
    ],
  },
  threat: {
    lesson: '脅しは一人で抱えず、すぐ報告',
    loss: '💰',
    acts: [
      { icon: '🚩', short: 'すぐ報告' },
      { icon: '🗑️', short: '黙って消す' },
      { icon: '💰', short: '払う' },
    ],
  },
};
