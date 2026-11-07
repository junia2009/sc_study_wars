// 判断シーン。端末(T)に触れると、ゲームが止まってこの画面が出る。
//
//   time     考えられる秒数
//   card     クリアしたときにもらえる解説カード
//   mock     本物そっくりの業務画面
//              kind: 'app'  → app / title / body
//              kind: 'mail' → from / replyTo / subject / body
//   detail   「詳しく調べる」を押すと出る情報
//   choices  選択肢
//              result: 'good' 正解 / 'bad' 引っかかった / 'later' 今は何も起きない
//              leak:   漏洩ゲージが増える量(%)    cause: 障害報告書に書かれる原因(causes.js)
//              flag:   この先の展開を変える印
//   timeout  時間切れのとき
//
// 社名・人名・ドメインはすべて架空。ドメインは例示用の .example を使う。

export const SCENES = {
  password: {
    time: 20,
    card: 'reuse',
    mock: {
      kind: 'app',
      app: '経費精算システム(新)',
      title: 'はじめに、パスワードを設定してください',
      body: [
        '経費精算が、新しいシステムに変わりました。',
        'ログイン用のパスワードを決めてください。',
      ],
    },
    detail: [
      'いつものパスワードは、私用の通販サイトでも使っている',
      'その通販サイトで、去年「会員情報が流出した」というお知らせが出ていた(気がする)',
    ],
    choices: [
      {
        label: 'いつものパスワードを使う(覚えやすいし)',
        result: 'later',
        flag: { reuse: true },
        title: '設定できました',
        text: '……今のところは、何も起きていません。',
      },
      {
        label: 'パスワード管理ツールで、このシステム専用のものを作る',
        result: 'good',
        flag: { reuse: false },
        title: '正解',
        text: 'サービスごとに別のパスワードなら、どこかで漏れても被害がほかへ広がりません。',
      },
    ],
    timeout: {
      title: '保留',
      text: '急いで決めなくても大丈夫。あとで落ち着いて、専用のパスワードを作りましょう。',
      flag: { reuse: false },
    },
  },

  mfa: {
    time: 15,
    card: 'mfa',
    mock: {
      kind: 'app',
      app: '経費精算システム(新)',
      title: '多要素認証を設定しますか?',
      body: [
        'ログインのときに、スマホのアプリでも承認するようにできます。',
        '設定は1分ほどで終わります。',
      ],
    },
    detail: [
      'パスワードが漏れても、スマホでの承認がなければログインできなくなる',
      '情シスの先輩いわく「“あとで設定する”を押した人が、あとで設定したのを見たことがない」',
    ],
    choices: [
      {
        label: 'あとで設定する',
        result: 'later',
        flag: { mfa: false },
        title: 'あとで……',
        text: '「あとで」は、だいたい来ません。',
      },
      {
        label: '今すぐ設定する',
        result: 'good',
        flag: { mfa: true },
        title: '正解',
        text: '多要素認証の盾を手に入れた! パスワードが盗まれても、それだけでは扉が開かなくなります。',
      },
    ],
    timeout: {
      title: '保留',
      text: '設定しないまま、先へ進みました。',
      flag: { mfa: false },
    },
  },

  bec: {
    time: 12,
    card: 'bec',
    mock: {
      kind: 'mail',
      from: 'サンプル物産 経理部 佐藤 <sato@sanple-bussan.example>',
      replyTo: 'sato.keiri@freemail.example',
      subject: '【至急】振込先口座変更のお願い',
      body: [
        'いつもお世話になっております。',
        '監査の都合により、今月から振込先の口座が変わりました。',
        '本日15時までに、下記の新しい口座へお振り込みください。',
        '※ 社内で調整中のため、本件はご内密にお願いいたします。',
        '新しい口座: ○○銀行 ××支店 普通 1234567',
        'ご不明な点は 03-0000-0000(佐藤 直通)まで。',
      ],
    },
    detail: [
      'いつもの送り主: sato@sample-bussan.example',
      '今回の送り主: sato@sanple-bussan.example(m が n になっている)',
      '返信先が、送り主と別のフリーメールになっている',
    ],
    choices: [
      {
        label: '至急とのことなので、新しい口座に振り込む',
        result: 'bad',
        leak: 50,
        cause: 'bec',
        title: '振り込んでしまった……',
        text: '取引先になりすました詐欺でした。お金の話に「至急」「内密に」がそろったら要注意。',
      },
      {
        label: 'メールに書かれた番号に電話して確かめる',
        result: 'bad',
        leak: 30,
        cause: 'becPhone',
        title: '惜しい!',
        text: 'その番号は、相手が用意したものでした。確認は、以前から登録している連絡先で。',
      },
      {
        label: '以前から登録している番号で、佐藤さん本人に確かめる',
        result: 'good',
        title: '正解',
        text: '佐藤さん「そんなメール、送っていません!」 被害を防ぎました。',
      },
    ],
    timeout: {
      title: '時間切れ',
      text: 'でも、急かされたときに判断を保留するのは、悪くない選択です。',
    },
  },
};
