// 火曜〜日曜の中身(月曜は story.js / stage1.js)。
// 1日 = 台本(朝・判断の前・黒幕・夕方)+ 判断シーン + 地図 + ギミックの設定 + もらえる解説カード。
// 毎日、新しいギミックとセキュリティのテーマを1つ以上持つ。
//
// 判断シーンの書き方は scenes.js と同じ({{ }} = 本当に怪しいところ / [[ ]] = 問題ない引っかけ)。
// mock.kind: mail(メール)/ chat(チャット)/ call(電話)/ screen(画面の警告)
// 社名・人名・ドメインはすべて架空。ドメインは例示用の .example を使う。
import { buildMap } from './mapkit.js';

const ASK_KURODA = (text) => ({
  label: '判断がつかないので、黒田先輩に相談する',
  tier: 'safe',
  delay: 15,
  cause: 'escalate',
  rule: 3,
  title: '先輩に相談した',
  text: text || '黒田先輩「……手がかりがあれば自分で確かめられたな」 安全だが、そのぶん仕事は遅れた。',
});

// ================= 火曜: 社長のなりすまし・多要素認証 =================
export const TUESDAY = {
  id: 'tuesday',
  day: '火曜',
  theme: '社長・上司のなりすまし / 多要素認証',
  stage: {
    id: 'tuesday',
    name: '火曜 役員フロア',
    tutorialEnd: 0,
    map: buildMap(132, (m) => {
      m.on(2, 'P');
      m.on(4, 'i'); // 人事部
      m.row(12, 15, 8, 'B');
      m.put(14, 7, 'J'); // 社内ルールの紙
      [8, 9, 10].forEach((x) => m.put(x, 8, 'o'));
      m.on(20, 'e');
      m.on(27, 'p');
      m.on(34, 'T'); // 11:00 社長のチャット
      m.on(42, 'i'); // 認証ゲートの説明
      m.on(48, 'k'); // 要素1: パスワード
      m.on(53, 'e');
      m.row(57, 58, 8, 'B');
      m.row(60, 63, 7, 'B');
      m.put(62, 6, 'h'); // 要素2: スマホ
      m.on(65, 'p');
      m.col(69, 0, 9, 'X'); // 認証ゲート
      m.on(72, 'i'); // 役員フロア
      m.put(76, 6, 'B');
      m.put(77, 6, 'Q');
      m.put(78, 6, 'B');
      m.pit(82, 83);
      m.put(82, 8, 'o');
      m.put(83, 8, 'o');
      m.on(88, 'p');
      m.on(94, 's'); // 迷惑メールの群れ
      m.on(102, 'T'); // 15:00 多要素認証の設定
      m.on(108, 'e');
      m.put(112, 6, 'H');
      m.on(116, 'p');
      m.on(120, 'i'); // 夕方
      [123, 124, 125].forEach((x) => m.put(x, 8, 'o'));
      m.on(98, 'b'); // ボット(空から急降下)
      m.on(127, 'Z');
    }),
  },
  barrier: 'mfa',
  cards: ['ceo', 'mfa'],
  scenes: ['ceo', 'mfaSetup'],
  clocks: { ceo: '11:00', mfaSetup: '15:00', boss: '17:00' },
  intro: [
    { who: 'sys', text: '火曜 9:00 ── 情報システム部' },
    { who: 'kuroda', text: '昨日はよくやった。……アングラーは「身内の顔で釣る」と言ってたな' },
    { who: 'kuroda', text: '上司や社長になりすまして、急ぎの頼みごとをしてくる手口だ。偉い人の名前を出されると、断りにくいだろ?' },
    { who: 'kuroda', text: 'そういうときの盾が、社内ルールだ。人事部の掲示板に貼ってある。取ってこい' },
    { who: 'guard', text: '今日は役員フロアにも行くんですね……緊張します' },
    { who: 'sys', text: '今日の任務: ①社内ルールの紙を手に入れる ②認証ゲートを抜ける ③届いた依頼に答える' },
  ],
  before: {
    ceo: [
      { who: 'sys', text: '11:00 ── {name}あてに、社長からチャットが届いた' },
      { who: 'guard', text: 'しゃ、社長からです! 急ぎって書いてあります!' },
    ],
    mfaSetup: [{ who: 'sys', text: '15:00 ── 黒田先輩からメールが届いた' }],
  },
  boss: [
    { who: 'sys', text: '17:00 ── 社長室の監視カメラに、フードの影が映った' },
    { who: 'anglerKnown', text: '社長の顔でも釣れないとはな。……ならば次は、餌に毒を仕込もう' },
    { who: 'anglerKnown', text: '明日届く「添付ファイル」、開けずにいられるかな?' },
  ],
  outro: [
    { who: 'kuroda', text: '偉い人の名前に負けなかったな。ルールは、断るための道具でもある' },
    { who: 'kuroda', text: '明日は添付ファイルか。……拡張子の見方を、教えておかないとな' },
  ],
  hints: [
    { help: true, say: { who: 'guard', text: 'ここは人事部です。掲示板に「社内ルールの紙」があるはず!' } },
    {
      help: true,
      talk: [
        { who: 'guard', text: 'この先は「認証ゲート」です。パスワードの鍵と、スマホ。2つの要素がそろわないと開きません' },
        { who: 'guard', text: 'パスワードだけでは開かないのが、多要素認証のしくみ。パスワードが盗まれても、スマホがなければ入れないんです' },
      ],
    },
    { say: { who: 'guard', text: 'ここが役員フロア……。社長室は、この奥です' } },
    { say: { who: 'guard', text: 'もうすぐ夕方です。出口まであと少し!' } },
  ],
  sceneData: {
    ceo: {
      from: 'self',
      time: 50,
      clues: ['rules'],
      mock: {
        kind: 'chat',
        app: '社内チャット',
        from: '社長 junia 太郎(社外のアカウント: {{taro.junia@freemail.example}})',
        body: [
          '[[お疲れさまです。]]',
          '{{いま会議中で、電話には出られない}}。',
          '{{至急}}、取引先へのお礼に、ギフトカードを10万円分買ってほしい。',
          '買ったら、{{カードの番号を写真で送って}}くれ。',
          '{{このことは、ほかの人には言わないように}}。',
        ],
      },
      choices: [
        {
          label: '社内ルールに合わないので断り、秘書室に内線で確かめる',
          needs: 'rules',
          alt: ASK_KURODA('黒田先輩「社長がチャットでギフトカードを頼むわけないだろ。……ルールの紙を読んでおけ」 安全だが、仕事は遅れた。'),
          tier: 'best',
          rule: 2,
          title: 'ルールを盾に、別の道で確かめた',
          text: '秘書室「社長は今日、海外出張です。そんなチャットは送っていません」 社外のアカウントから、電話に出られない理由をつけて急かす。なりすましの定番の手口。',
        },
        {
          label: '黒田先輩に相談する',
          onlyWith: 'rules',
          tier: 'safe',
          delay: 15,
          cause: 'escalate',
          rule: 3,
          title: '先輩に相談した',
          text: '黒田先輩「ルールの紙、持ってるだろ。それを読めば断れる」 安全だが、仕事は遅れた。',
        },
        {
          label: 'チャットで「本当に社長ですか?」と聞き返す',
          tier: 'close',
          leak: 25,
          cause: 'ceoReply',
          rule: 2,
          title: '返事は「本当だ。急げ」',
          text: 'なりすましている本人に聞いても、本人だと言うに決まっている。確かめるなら、別の道(内線・対面)で。',
        },
        {
          label: '社長の頼みなので、すぐにギフトカードを買って番号を送る',
          tier: 'fooled',
          leak: 55,
          cause: 'ceo',
          rule: 1,
          followup: true,
          title: 'ギフトカードを送ってしまった',
          text: '番号を送った瞬間に、カードの価値は相手のものになる。ギフトカードを頼むメール・チャットは、ほぼ詐欺。',
        },
      ],
    },
    mfaSetup: {
      from: 'self',
      time: 0,
      clues: ['rules'],
      mock: {
        kind: 'mail',
        from: '[[黒田]](情報システム部) <[[kuroda@junia-shoji.example]]>',
        subject: '[[全社で多要素認証を有効にします]]',
        body: [
          '[[お疲れさまです。情報システム部の黒田です。]]',
          '今週中に、全員の多要素認証(スマホでの承認)を有効にします。',
          '社内ポータルの「アカウント設定」から設定してください。',
          '手順は社内ポータルにも載せています。',
        ],
      },
      choices: [
        {
          label: '社内ポータル(ブックマーク)から、今すぐ設定する',
          tier: 'best',
          rule: 2,
          title: '今すぐ、正しい入口から設定した',
          text: '多要素認証を設定した! パスワードが盗まれても、スマホの承認がなければ入られない。設定は、メールのリンクではなく、いつもの入口から。',
        },
        {
          label: 'メールに書かれた手順どおり、すぐ設定する',
          tier: 'ok',
          rule: 2,
          title: '設定できた(今回は本物)',
          text: '今回は本物の先輩のメールだった。でも、設定の案内を装う偽メールもある。設定は、いつもの入口(ポータル)からが安心。',
        },
        {
          label: '忙しいので、あとで設定する',
          tier: 'close',
          leak: 10,
          cause: 'mfaLater',
          rule: 3,
          title: '「あとで」は、だいたい来ない',
          text: 'その「あとで」のあいだに、パスワードが盗まれたら……。多要素認証は、設定した日から守ってくれる。',
        },
      ],
    },
  },
};

// ================= 水曜: 添付ファイルのマルウェア・パスワードの使い回し =================
export const WEDNESDAY = {
  id: 'wednesday',
  day: '水曜',
  theme: '添付ファイルのマルウェア / パスワードの使い回し',
  stage: {
    id: 'wednesday',
    name: '水曜 メールサーバー',
    tutorialEnd: 0,
    map: buildMap(138, (m) => {
      m.on(2, 'P');
      m.on(4, 'i'); // メールサーバー
      m.row(10, 12, 8, 'B');
      m.put(11, 7, 'V'); // 拡張子の見分け表
      m.on(17, 'e');
      m.on(24, 'i'); // 添付ファイルの箱の説明
      // 添付ファイルの箱(6つ。行6に浮かせて、下から叩く)
      [30, 36, 42, 48, 54, 60].forEach((x) => m.put(x, 6, 'Y'));
      m.on(39, 'e');
      m.on(51, 'p');
      m.col(66, 0, 9, 'X'); // 必要なファイルを開けると開く
      m.on(70, 'T'); // 10:30 添付ファイルつきの請求書
      m.on(76, 'p');
      m.pit(80, 81);
      m.put(80, 8, 'o');
      m.put(81, 8, 'o');
      m.on(86, 'v'); // マルウェア(分裂する)
      m.on(92, 'T'); // 13:00 新しいサービスのパスワード
      m.on(100, 'i'); // パスワード使い回しのツケ
      m.on(106, 'v');
      m.put(110, 6, 'B');
      m.put(111, 6, 'Q');
      m.put(112, 6, 'B');
      m.on(118, 'p');
      m.pit(122, 124);
      [122, 123, 124].forEach((x) => m.put(x, 7, 'o'));
      m.on(128, 'i'); // 夕方
      m.on(116, 'b'); // ボット(空から急降下)
      m.on(133, 'Z');
    }),
  },
  barrier: 'files',
  files: {
    need: 3,
    list: [
      { name: '請求書_10月.pdf', safe: true },
      { name: '請求書_10月.pdf.exe', safe: false },
      { name: '議事録.docx', safe: true },
      { name: '見積書.xlsm', safe: false },
      { name: '社員名簿.xlsx', safe: true },
      { name: '写真.jpg.scr', safe: false },
    ],
  },
  cards: ['malware', 'reuse'],
  scenes: ['attach', 'reuse'],
  clocks: { attach: '10:30', reuse: '13:00', boss: '17:00' },
  intro: [
    { who: 'sys', text: '水曜 9:00 ── 情報システム部' },
    { who: 'kuroda', text: '今日は添付ファイルだ。開いた瞬間に動き出す「マルウェア」が仕込まれていることがある' },
    { who: 'kuroda', text: '見分けるコツは、ファイル名のいちばん右の「拡張子」。メールサーバーに見分け表を置いておいた' },
    { who: 'guard', text: 'ファイルの名前を、最後まで読めばいいんですね!' },
    { who: 'sys', text: '今日の任務: ①拡張子の見分け表を手に入れる ②安全なファイルだけ開けて仕事を進める ③届いたメールに答える' },
  ],
  before: {
    attach: [{ who: 'sys', text: '10:30 ── 佐藤さんから相談が届いた' }],
    reuse: [{ who: 'sys', text: '13:00 ── 新しい勤怠システムの案内が届いた' }],
  },
  boss: [
    { who: 'sys', text: '17:00 ── メールサーバーのログに、知らない足あとが残っていた' },
    { who: 'anglerKnown', text: '毒入りの餌も見抜くか。……ならば、声で釣るまでだ' },
    { who: 'anglerKnown', text: '明日は電話が鳴る。在宅で一人のときにな' },
  ],
  outro: [
    { who: 'kuroda', text: '拡張子は、ファイル名のいちばん右。それだけで防げる被害は多い' },
    { who: 'kuroda', text: '明日は在宅勤務の日か。……電話には気をつけろ' },
  ],
  hints: [
    { help: true, say: { who: 'guard', text: 'メールサーバーです。拡張子の見分け表を探しましょう!' } },
    {
      help: true,
      talk: [
        { who: 'guard', text: '浮いている箱は「添付ファイル」です。下から叩くと開きます' },
        { who: 'guard', text: '名札のファイル名を、いちばん右まで読んで! 「.pdf.exe」のように拡張子が2つ並ぶもの、.exe .scr、マクロ付きの .xlsm は危険です' },
        { who: 'guard', text: '安全なファイルを3つ開けると、仕事が進んでゲートが開きます。危険なファイルを開けると、マルウェアが飛び出します!' },
      ],
    },
    { credential: true },
    { say: { who: 'guard', text: 'もうすぐ夕方です。出口まであと少し!' } },
  ],
  sceneData: {
    attach: {
      from: 'sato',
      ask: '山田さんから請求書が届いたんですけど、添付ファイルを開いてもいいですか?',
      time: 0,
      clues: ['extlist'],
      mock: {
        kind: 'mail',
        from: '[[サンプル物産 山田]] <{{yamada.sample-bussan@freemail.example}}>',
        subject: '[[10月分のご請求書]]({{至急ご確認ください}})',
        body: [
          '[[いつもお世話になっております。]]',
          '10月分の請求書を添付します。',
          '{{至急、開いて内容をご確認ください}}。',
          '添付: {{請求書_10月.pdf.exe}}',
        ],
      },
      choices: [
        {
          label: '拡張子を見て、開かずに情シスに報告する',
          needs: 'extlist',
          alt: ASK_KURODA(),
          tier: 'best',
          rule: 1,
          title: '開かずに見抜いて、報告した',
          text: '「.pdf.exe」は書類ではなく実行ファイル。差出人もフリーメール。報告したので、同じメールを受け取ったほかの人にも注意が回った。',
        },
        {
          label: '黒田先輩に相談する',
          onlyWith: 'extlist',
          tier: 'safe',
          delay: 15,
          cause: 'escalate',
          rule: 3,
          title: '先輩に相談した',
          text: '黒田先輩「見分け表、持ってるだろ。いちばん右の拡張子を見ろ」 安全だが、仕事は遅れた。',
        },
        {
          label: '怪しいので、黙って削除しておく',
          tier: 'close',
          leak: 10,
          cause: 'noReport',
          rule: 3,
          title: '自分は守れたが……',
          text: '同じメールは、ほかの人にも届いているかもしれない。怪しいメールは、消す前に報告。',
        },
        {
          label: '請求書なので、開いて中身を確かめる',
          tier: 'fooled',
          leak: 55,
          cause: 'openMalware',
          rule: 1,
          followup: true,
          title: 'マルウェアを開いてしまった',
          text: '開いた瞬間、マルウェアが動き出した。ファイル名は、いちばん右まで読む。',
        },
      ],
    },
    reuse: {
      from: 'self',
      time: 0,
      clues: ['extlist'],
      mock: {
        kind: 'mail',
        from: '[[勤怠システム]] <[[no-reply@kintai.junia-shoji.example]]>',
        subject: '[[アカウントを作成しました]]',
        body: [
          '[[{name} 様]]',
          '新しい勤怠システムのアカウントを作成しました。',
          '最初のログインで、パスワードを決めてください。',
          '(このメールは本物です。どんなパスワードにするかを選ぼう)',
        ],
      },
      choices: [
        {
          label: 'パスワード管理ツールで、このサービス専用のものを作る',
          tier: 'best',
          flag: { reuse: false },
          rule: 1,
          title: 'サービスごとに別のパスワードにした',
          text: 'どこかで漏れても、ほかのサービスまでは被害が広がらない。覚えきれない分は、管理ツールに任せる。',
        },
        {
          label: '覚えやすいので、いつものパスワードを使う',
          tier: 'close',
          flag: { reuse: true },
          rule: 1,
          title: '設定できた……今のところは',
          text: '今は何も起きていない。でも、いつものパスワードは、ほかのサービスでも使っている……。',
        },
        {
          label: '会社の名前と年号で「Junia2026!」にする',
          tier: 'close',
          flag: { reuse: true },
          rule: 1,
          title: 'ルールは満たしているが……',
          text: '会社名と年号は、真っ先に試される組み合わせ。推測されにくいパスワードを、管理ツールで作ろう。',
        },
      ],
    },
  },
};

// ================= 木曜: 電話のなりすまし・多要素認証の疲労攻撃 =================
export const THURSDAY = {
  id: 'thursday',
  day: '木曜',
  theme: '電話のなりすまし / 多要素認証の疲労攻撃',
  stage: {
    id: 'thursday',
    name: '木曜 在宅勤務の回線',
    tutorialEnd: 0,
    map: buildMap(134, (m) => {
      m.on(2, 'P');
      m.on(4, 'i'); // 在宅勤務
      m.row(11, 14, 8, 'B');
      m.put(13, 7, 'N'); // 内線番号表
      m.on(19, 'e');
      m.on(26, 'T'); // 10:30 情シスを名乗る電話
      m.on(32, 'i'); // 承認通知の説明(ここから通知が届き始める)
      m.on(38, 'p');
      m.on(46, 'W'); // ログイン端末
      m.col(52, 0, 9, 'X'); // 自分のログインを承認すると開く
      m.on(58, 'e');
      m.pit(64, 65);
      m.put(64, 8, 'o');
      m.put(65, 8, 'o');
      m.on(70, 'p');
      m.put(76, 6, 'B');
      m.put(77, 6, 'Q');
      m.put(78, 6, 'B');
      m.on(84, 's'); // 迷惑メールの群れ
      m.on(92, 'T'); // 15:00 VPN 機器の更新
      m.on(98, 'p');
      m.on(104, 'e');
      m.pit(110, 112);
      [110, 111, 112].forEach((x) => m.put(x, 7, 'o'));
      m.on(118, 'p');
      m.on(124, 'i'); // 夕方
      m.on(60, 'b'); // ボット(空から急降下)
      m.on(100, 'b'); // ボット(空から急降下)
      m.on(129, 'Z');
    }),
  },
  barrier: 'push',
  push: {
    every: 7,
    life: 6,
    fakes: [
      { app: '経費システム', where: 'ログインした場所: 海外(不明な端末)' },
      { app: '社内メール', where: 'ログインした場所: 不明な端末' },
      { app: '経費システム', where: 'ログインした場所: 大阪(知らない端末)' },
    ],
    real: { app: '経費システム', where: 'ログインした場所: 自宅(あなたの端末)・たった今' },
  },
  cards: ['vishing', 'push'],
  scenes: ['vishing', 'vpn'],
  clocks: { vishing: '10:30', vpn: '15:00', boss: '17:00' },
  intro: [
    { who: 'sys', text: '木曜 9:00 ── 在宅勤務(自宅)' },
    { who: 'kuroda', text: '(オンライン会議)今日は在宅だな。……一人のときを狙って、電話でパスワードを聞き出す手口がある' },
    { who: 'kuroda', text: 'それと、パスワードを盗んだやつが、スマホに承認の通知を何度も送ってくる手口もだ。根負けして押すのを待ってる' },
    { who: 'kuroda', text: '情シスの内線番号表は、在宅用の回線にも置いてある。……俺はこれから寝る' },
    { who: 'guard', text: '先輩、在宅だといつもより眠そうです……' },
    { who: 'sys', text: '今日の任務: ①内線番号表を手に入れる ②承認の通知を見分ける ③電話とメールに答える' },
  ],
  before: {
    vishing: [{ who: 'sys', text: '10:30 ── 知らない番号から、電話が鳴った' }],
    vpn: [{ who: 'sys', text: '15:00 ── 情報システム部から、お知らせのメールが届いた' }],
  },
  boss: [
    { who: 'sys', text: '17:00 ── 在宅回線の向こうから、笑い声が聞こえた' },
    { who: 'anglerKnown', text: '声にも、通知にも釣られないか。……いいだろう。明日は本番だ' },
    { who: 'anglerKnown', text: '明日は、本物の取引先から届くメールで釣る。本物のアドレスでな' },
  ],
  outro: [
    { who: 'kuroda', text: '自分で操作していない承認は、押さない。電話は、こっちからかけ直す。いい日だった' },
    { who: 'kuroda', text: '「本物のアドレスで」……取引先のアカウントを乗っ取る気か。明日は支払いの日だぞ' },
  ],
  hints: [
    { help: true, say: { who: 'guard', text: '在宅勤務の回線です。内線番号表を探しましょう!' } },
    {
      help: true,
      release: 'push',
      talk: [
        { who: 'guard', text: 'ここから、スマホに「承認しますか?」の通知が届きます。画面の上に出る通知を見て、承認か拒否を選んでください' },
        { who: 'guard', text: 'ゲートを開けるには、ログイン端末に触れて「自分で」ログインし、そのとき届く通知だけを承認します' },
        { who: 'guard', text: '自分で操作していないのに届いた通知は、パスワードを盗んだ誰かのログイン。拒否です! 放っておくと消えます' },
      ],
    },
    { say: { who: 'guard', text: 'もうすぐ夕方です。出口まであと少し!' } },
  ],
  sceneData: {
    vishing: {
      from: 'self',
      time: 50,
      clues: ['naisen'],
      mock: {
        kind: 'call',
        app: '着信',
        from: '{{非通知}}',
        body: [
          '「[[お疲れさまです]]。情報システム部の田中です」',
          '「{{あなたのアカウントに、不正アクセスの形跡があります}}」',
          '「{{今すぐ}}対応しないと、アカウントを止めることになります」',
          '「確認のため、{{いまのパスワードを教えてください}}」',
        ],
      },
      choices: [
        {
          label: 'いったん電話を切り、内線番号表の番号で情シスにかけ直す',
          needs: 'naisen',
          alt: ASK_KURODA('黒田先輩「……情シスはパスワードを聞かない。内線番号表を手に入れておけ」 安全だが、仕事は遅れた。'),
          tier: 'best',
          rule: 2,
          title: 'こちらからかけ直した',
          text: 'ヘルプデスク「田中という者はいません。そんな電話はしていません」 情シスがパスワードを聞くことはない。非通知・急かし・パスワードの3点セットは、なりすまし。',
        },
        {
          label: '黒田先輩にチャットで聞く',
          onlyWith: 'naisen',
          tier: 'safe',
          delay: 15,
          cause: 'escalate',
          rule: 3,
          title: '先輩に聞いた',
          text: '黒田先輩「……内線番号表、持ってるだろ。かけ直せ。俺は寝る」 安全だが、仕事は遅れた。',
        },
        {
          label: '相手の名前と社員番号を聞いて、本物か確かめる',
          tier: 'close',
          leak: 25,
          cause: 'vishingAsk',
          rule: 2,
          title: 'すらすら答えてきた',
          text: '名前も社員番号も、どこかで調べて用意している。相手の答えでは確かめられない。確かめるなら、こちらからかけ直す。',
        },
        {
          label: 'アカウントを止められると困るので、パスワードを伝える',
          tier: 'fooled',
          leak: 55,
          cause: 'vishing',
          rule: 2,
          followup: true,
          title: 'パスワードを教えてしまった',
          text: '情シスが電話でパスワードを聞くことはない。「止める」「今すぐ」と急かすのは、考える時間を奪う手口。',
        },
      ],
    },
    vpn: {
      from: 'self',
      time: 0,
      clues: ['naisen'],
      mock: {
        kind: 'mail',
        from: '[[情報システム部]] <[[helpdesk@junia-shoji.example]]>',
        subject: '[[在宅用 VPN 機器の更新のお願い]]',
        body: [
          '[[在宅勤務中の皆さま]]',
          '在宅用の VPN 機器に、修正版のソフトが出ました。',
          '今週中に、社内ポータルの手順書に沿って更新してください。',
          '(このメールは本物です。どう対応するかを選ぼう)',
        ],
      },
      choices: [
        {
          label: '社内ポータル(ブックマーク)の手順書を見て、今日中に更新する',
          tier: 'best',
          rule: 2,
          title: '正しい手順で、すぐ更新した',
          text: '機器の弱点(脆弱性)は、修正版が出た時点で攻撃者にも知られる。更新はすぐ、手順はいつもの入口から。',
        },
        {
          label: 'ヘルプデスクの内線に電話して、本物か確かめてから更新する',
          tier: 'safe',
          delay: 8,
          cause: 'overCheck',
          rule: 2,
          title: '確かめてから更新した',
          text: '安全。ただ、ポータルにも同じお知らせが載っているなら、そちらで確かめれば電話は要らない。',
        },
        {
          label: '仕事が落ち着いたら、来月まとめて更新する',
          tier: 'close',
          leak: 20,
          cause: 'unpatched',
          rule: 3,
          title: '後回しにしてしまった',
          text: '更新していない VPN 機器は、侵入の入口として真っ先に狙われる。更新は後回しにしない。',
        },
      ],
    },
  },
};

// ================= 金曜: 本物のアカウントの乗っ取り(+ 黒幕とボス戦) =================
export const FRIDAY = {
  id: 'friday',
  day: '金曜',
  theme: '取引先アカウントの乗っ取り / 見た目では見抜けない詐欺',
  stage: {
    id: 'friday',
    name: '金曜 支払いの日',
    tutorialEnd: 0,
    map: buildMap(158, (m) => {
      m.on(2, 'P');
      m.on(4, 'i'); // 支払いの日
      m.row(10, 13, 8, 'B');
      m.put(12, 7, 'L'); // 連絡先台帳
      m.on(18, 'e');
      m.on(24, 'i'); // 乗っ取りのメール便の説明
      // 札が2行で横に長いので、メール便の間は広めに(8マス)
      [30, 38, 46, 54, 62, 70].forEach((x) => m.on(x, 'M'));
      m.on(76, 'i'); // 仕分けの結果
      m.on(80, 'T'); // 14:00 乗っ取られたアカウントからのメール
      m.on(85, 'p');
      m.pit(90, 91);
      m.put(90, 8, 'o');
      m.put(91, 8, 'o');
      m.on(96, 'e');
      m.on(100, 'T'); // 16:00 大口の支払いの最終確認
      m.on(106, 'i'); // サーバー室
      m.row(112, 115, 7, 'B');
      m.row(124, 127, 7, 'B');
      m.on(126, 'R'); // アングラー
      m.col(142, 0, 9, 'X'); // アングラーを倒すと開く
      [146, 147, 148].forEach((x) => m.put(x, 8, 'o'));
      m.on(86, 'b'); // ボット(空から急降下)
      m.on(153, 'Z');
    }),
  },
  barrier: 'boss',
  mails: {
    real: 'sample-bussan',
    speed: 20,
    account: { real: '○○銀行 本店 7654321', fakes: ['△△銀行 西支店 1234567', '○○銀行 駅前支店 7654321', '××銀行 本店 7654321'] },
  },
  angler: {
    hp: 3,
    speed: 50,
    drop: 2.4,
    swoop: 4,
    talk: [
      { who: 'anglerKnown', text: 'よくここまで来たな。だが、支払いはいただく!' },
      { who: 'guard', text: 'アングラーです! 降りてきたところを、上から踏みましょう!' },
    ],
    defeat: [
      { who: 'anglerKnown', text: 'ぐっ……今日のところは、引いてやる' },
      { who: 'guard', text: 'やりました! 出口への道が開きました!' },
    ],
  },
  cards: ['takeover'],
  scenes: ['takeover', 'payment'],
  clocks: { takeover: '14:00', payment: '16:00', boss: '17:00' },
  intro: [
    { who: 'sys', text: '金曜 9:00 ── 大口の支払いの日' },
    { who: 'kuroda', text: 'いよいよだ。今日、サンプル物産へ大口の支払いがある' },
    { who: 'kuroda', text: 'アングラーは「本物のアドレスで釣る」と言った。取引先のアカウントを乗っ取って、そこから送ってくるつもりだ' },
    { who: 'kuroda', text: 'そうなると、アドレスを見ても見抜けない。見るべきは中身……特に、振込先の口座だ。台帳を持っていけ' },
    { who: 'guard', text: 'アドレスが本物でも、偽物……。こわいです' },
    { who: 'sys', text: '今日の任務: ①連絡先台帳を手に入れる ②メール便を仕分ける ③支払いを守り抜く' },
  ],
  before: {
    takeover: [
      { who: 'sys', text: '14:00 ── 佐藤さんから相談が届いた' },
      { who: 'guard', text: '今度は、アドレスが本物です……!' },
    ],
    payment: [{ who: 'sys', text: '16:00 ── 部長から、支払いの最終確認が届いた' }],
  },
  boss: [
    { who: 'sys', text: '17:00 ── 支払いは、無事に本物の口座へ届いた' },
    { who: 'kuroda', text: 'よし……! 今週の目標は達成だ。よくやった、{name}' },
    { who: 'anglerKnown', text: '(通信)……フィッシャーズは、このままでは終わらん。週末を楽しみにしていろ' },
  ],
  outro: [
    { who: 'kuroda', text: '週末……休みで人がいないときを狙う気か。悪いが、明日は休日出勤だ' },
    { who: 'guard', text: '休日出勤……! でも、がんばります!' },
  ],
  hints: [
    { say: { who: 'guard', text: '今日は支払いの日。まずは連絡先台帳を!' } },
    {
      help: true,
      release: 'sort',
      talk: [
        { who: 'guard', text: 'またメール便です! でも今日は、ドメインは全部本物の「sample-bussan」……乗っ取られているんです' },
        { who: 'guard', text: '札の2行目、「口座」を見てください。台帳の本物は「○○銀行 本店 7654321」。違う口座のメール便が偽物です!' },
      ],
    },
    { sortReport: true },
    { say: { who: 'guard', text: 'この先はサーバー室……アングラーの気配がします' } },
  ],
  sceneData: {
    takeover: {
      from: 'sato',
      ask: '山田さんから、振込先の変更が来ました。今度はアドレスも本物なんです……',
      time: 60,
      clues: ['ledger'],
      mock: {
        kind: 'mail',
        from: '[[サンプル物産 山田]] <[[yamada@sample-bussan.example]]>',
        subject: '[[Re: 10月分のご請求書(INV-2026-1031)]]',
        body: [
          '[[いつもお世話になっております。]]',
          '先日の請求書の件、{{振込先を下記に変更}}させてください。',
          '{{本日中に}}お願いいたします。',
          '新しい振込先: {{△△銀行 西支店 普通 1234567}}',
          '{{お電話は外出中のため、メールでご返信ください}}。',
        ],
      },
      choices: [
        {
          label: '台帳の番号で山田さんに電話して、確かめる',
          needs: 'ledger',
          alt: ASK_KURODA(),
          tier: 'best',
          rule: 2,
          title: 'アドレスが本物でも、別の道で確かめた',
          text: '山田さん「アカウントを乗っ取られていたみたいです……! 振込先は変えていません」 アドレスも、いつものやり取りの続きも本物。それでも、振込先の変更は電話で確かめる。',
        },
        {
          label: '黒田先輩に相談する',
          onlyWith: 'ledger',
          tier: 'safe',
          delay: 15,
          cause: 'escalate',
          rule: 3,
          title: '先輩に相談した',
          text: '黒田先輩「台帳、持ってるだろ。かけろ」 安全だが、仕事は遅れた。',
        },
        {
          label: 'アドレスもやり取りも本物なので、メールで「承知しました」と返す',
          tier: 'close',
          leak: 35,
          cause: 'takeoverReply',
          rule: 2,
          title: '返信先は、乗っ取った犯人',
          text: '乗っ取られたアカウントに返信しても、読むのは犯人。「電話に出られない」と別の道をふさぐのも、手口のひとつ。',
        },
        {
          label: '本物のアドレスなので、新しい口座に振り込む',
          tier: 'fooled',
          leak: 60,
          cause: 'takeover',
          rule: 2,
          followup: true,
          title: '振り込んでしまった',
          text: 'アドレスが本物でも、アカウントが乗っ取られていれば偽物。振込先の変更は、必ず別の道で確かめる。',
        },
      ],
    },
    payment: {
      from: 'sato',
      ask: '部長から、今日の大口の支払いの最終確認です。承認していいですか?',
      time: 0,
      clues: ['ledger'],
      mock: {
        kind: 'mail',
        from: '[[部長 鈴木]] <[[suzuki@junia-shoji.example]]>',
        subject: '[[本日の支払いの最終確認]]',
        body: [
          '[[経理部 佐藤さん]]',
          '本日のサンプル物産への支払いです。',
          '振込先: [[○○銀行 本店 普通 7654321]]',
          '社内の承認は済んでいます。確認のうえ、処理してください。',
        ],
      },
      choices: [
        {
          label: '振込先を台帳と見比べて、一致していれば処理してもらう',
          needs: 'ledger',
          alt: ASK_KURODA(),
          tier: 'best',
          rule: 1,
          title: '確かめて、支払った',
          text: '振込先は台帳と一致。社内の承認も済んでいる。確かめたら、ためらわずに進めるのも仕事。',
        },
        {
          label: '今週は詐欺が多かったので、念のため支払いを来週に延ばす',
          tier: 'safe',
          delay: 45,
          cause: 'overSuspicion',
          rule: 1,
          title: '本物の支払いを止めてしまった',
          text: '取引先「お支払いがまだのようですが……」 疑いすぎも、取引先の信用を失う。',
        },
        {
          label: '部長からなので、そのまま処理してもらう',
          tier: 'ok',
          rule: 1,
          title: '無事だった(今回は)',
          text: '今回は本物だった。でも、大口の支払いほど、振込先を台帳と見比べる習慣を。',
        },
      ],
    },
  },
};

// ================= 土曜: ランサムウェア・バックアップ・初動対応 =================
export const SATURDAY = {
  id: 'saturday',
  day: '土曜',
  theme: 'ランサムウェア / バックアップ / 初動対応',
  stage: {
    id: 'saturday',
    name: '土曜 休日のサーバー室',
    tutorialEnd: 0,
    map: buildMap(150, (m) => {
      m.on(2, 'P');
      m.on(4, 'i'); // 休日のサーバー室
      m.row(10, 13, 8, 'B');
      m.put(12, 7, 'F'); // 初動対応の手順書
      m.on(20, 'T'); // 10:00 脅迫の画面
      m.on(26, 'i'); // 暗号化の壁の説明(ここから迫ってくる)
      m.on(32, 'S');
      m.on(40, 'e');
      m.row(46, 48, 8, 'B');
      m.pit(50, 51);
      m.on(56, 'p');
      m.on(62, 'S');
      m.put(68, 6, 'B');
      m.put(69, 6, 'Q');
      m.put(70, 6, 'B');
      m.on(74, 'v'); // マルウェア(分裂する)
      m.pit(80, 82);
      [80, 81, 82].forEach((x) => m.put(x, 7, 'o'));
      m.on(88, 'p');
      m.on(94, 'S');
      m.row(100, 101, 8, 'B');
      m.row(102, 103, 7, 'B');
      m.on(108, 'e');
      m.pit(112, 113);
      m.on(118, 'S');
      m.on(124, 'p');
      m.on(130, 'e');
      m.on(136, 'i'); // 逃げ切った
      m.on(140, 'T'); // 15:00 復旧業者を名乗る電話
      m.on(90, 'b'); // ボット(空から急降下)
      m.on(128, 'b'); // ボット(空から急降下)
      m.on(146, 'Z');
    }),
  },
  chase: { speed: 46 },
  cards: ['ransom'],
  scenes: ['ransom', 'support'],
  clocks: { ransom: '10:00', support: '15:00', boss: '17:00' },
  intro: [
    { who: 'sys', text: '土曜 9:30 ── 休日のオフィス' },
    { who: 'kuroda', text: '……来たか。休みの日は、気づく人がいない。だから狙われる' },
    { who: 'kuroda', text: 'もしファイルが暗号化される「ランサムウェア」が来たら、手順書どおりに動け。サーバー室に置いてある' },
    { who: 'kuroda', text: 'それと、バックアップだ。暗号化されても、バックアップがあれば戻せる' },
    { who: 'guard', text: 'ば、バックアップ……大事ですね!' },
    { who: 'sys', text: '今日の任務: ①初動対応の手順書を手に入れる ②暗号化から逃げ切る ③正しく初動対応する' },
  ],
  before: {
    ransom: [
      { who: 'sys', text: '10:00 ── サーバーの画面が、真っ赤に変わった' },
      { who: 'guard', text: 'た、大変です! 画面に脅しの文章が……!' },
    ],
    support: [{ who: 'sys', text: '15:00 ── 「セキュリティ復旧センター」を名乗る電話が鳴った' }],
  },
  boss: [
    { who: 'sys', text: '17:00 ── 暗号化は止まり、バックアップから復旧が始まった' },
    { who: 'kuroda', text: '初動が早かったから、被害は最小限だ。……ログに、アングラーの通信先が残っていた' },
    { who: 'kuroda', text: '明日、フィッシャーズの拠点をたどる。日曜で悪いな' },
  ],
  outro: [
    { who: 'guard', text: '明日で、全部終わらせましょう!' },
    { who: 'kuroda', text: 'ああ。……今夜はちゃんと寝ろよ。俺は寝ないけど' },
  ],
  hints: [
    { help: true, say: { who: 'guard', text: '休日のサーバー室です。初動対応の手順書は、すぐそこに!' } },
    {
      help: true,
      release: 'chase',
      talk: [
        { who: 'guard', text: 'う、後ろから暗号化が迫ってきます! 追いつかれると、データが暗号化されます!' },
        { who: 'guard', text: '途中のバックアップ地点に触れておくと、追いつかれても、そこから復旧できて被害が小さく済みます。走って!' },
      ],
    },
    { endChase: true, say: { who: 'guard', text: '逃げ切りました……! 暗号化の広がりが止まりました' } },
  ],
  sceneData: {
    ransom: {
      from: 'self',
      time: 50,
      clues: ['irp'],
      mock: {
        kind: 'screen',
        app: 'サーバーの画面',
        from: 'FISHERS RANSOM',
        body: [
          '{{あなたのファイルは、すべて暗号化されました}}。',
          '元に戻したければ、{{48時間以内に}}暗号資産で支払え。',
          '{{支払わなければ、盗んだ情報を公開する}}。',
          '{{電源を切ったり、誰かに知らせたりすれば、ファイルは二度と戻らない}}。',
        ],
      },
      choices: [
        {
          label: '手順書どおり、ネットワークから切り離し、電源は切らずにすぐ報告する',
          needs: 'irp',
          alt: ASK_KURODA('黒田先輩(電話)「ケーブルを抜け! 電源は切るな! ……手順書を持っておけ」 被害は抑えたが、対応は遅れた。'),
          tier: 'best',
          rule: 3,
          title: '手順書どおりに、初動対応した',
          text: '切り離したので、ほかのサーバーへの広がりを止められた。電源を残したので、調べる手がかりも残った。脅しの「知らせるな」は、報告を遅らせるための手口。',
        },
        {
          label: '黒田先輩に電話する',
          onlyWith: 'irp',
          tier: 'safe',
          delay: 12,
          cause: 'escalate',
          rule: 3,
          title: '先輩に電話した',
          text: '黒田先輩「手順書、持ってるだろ! まずケーブルを抜け!」 報告は正しいが、切り離しが遅れた分、仕事も遅れた。',
        },
        {
          label: 'とりあえず再起動して、直るか試す',
          tier: 'close',
          leak: 25,
          cause: 'ransomReboot',
          rule: 3,
          title: '再起動してしまった',
          text: '再起動しても暗号化は戻らない。調べるための手がかりが消え、つながったままのネットワークから被害が広がった。',
        },
        {
          label: '情報を公開されると困るので、身代金を支払う',
          tier: 'fooled',
          leak: 60,
          cause: 'ransomPay',
          rule: 3,
          followup: true,
          title: '身代金を払ってしまった',
          text: '払っても、元に戻る保証はない。「払う会社」として、また狙われる。身代金は払わず、すぐ報告。',
        },
      ],
    },
    support: {
      from: 'self',
      time: 0,
      clues: ['irp'],
      mock: {
        kind: 'call',
        app: '着信',
        from: '{{セキュリティ復旧センター}}(登録のない番号)',
        body: [
          '「[[休日に失礼します]]」',
          '「{{御社がランサムウェアの被害に遭ったと聞きました}}」',
          '「いまなら{{特別料金で}}、すぐに復旧できます」',
          '「{{この遠隔操作ソフトを入れていただければ}}、こちらで作業します」',
        ],
      },
      choices: [
        {
          label: '断って電話を切り、情シスと契約している業者に確かめる',
          tier: 'best',
          rule: 2,
          title: '断って、別の道で確かめた',
          text: '被害を知っているのは、社内と攻撃者だけのはず。頼んでもいない「復旧業者」は、二度目の詐欺。遠隔操作ソフトは、絶対に入れない。',
        },
        {
          label: '急いで直したいので、遠隔操作ソフトを入れる',
          tier: 'fooled',
          leak: 55,
          cause: 'fakeSupport',
          rule: 2,
          followup: true,
          title: '遠隔操作ソフトを入れてしまった',
          text: 'パソコンを丸ごと相手に渡したのと同じ。頼んでいない業者からの電話は、まず疑う。',
        },
        {
          label: '会社の名前と担当者名を聞いてから、作業を頼む',
          tier: 'close',
          leak: 25,
          cause: 'fakeSupportAsk',
          rule: 2,
          title: 'それらしい名前が返ってきた',
          text: '名前は、いくらでも用意できる。確かめるなら、こちらが知っている契約先に、こちらからかける。',
        },
      ],
    },
  },
};

// ================= 日曜: 総まとめ・偽サイトの迷路・最終決戦 =================
export const SUNDAY = {
  id: 'sunday',
  day: '日曜',
  theme: '総まとめ / 偽サイト / 報告の文化',
  stage: {
    id: 'sunday',
    name: '日曜 フィッシャーズの拠点',
    tutorialEnd: 0,
    map: buildMap(176, (m) => {
      m.on(2, 'P');
      m.on(4, 'i'); // 拠点へ
      m.row(10, 13, 8, 'B');
      m.put(12, 7, 'K'); // 公式ブックマーク
      m.on(18, 'i'); // URL の扉の説明
      // 部屋1: 扉2つ → 仕切りの壁(列30)
      m.on(23, 'D');
      m.on(27, 'D');
      m.col(30, 0, 9, '#');
      m.on(33, 'e');
      // 部屋2: 扉3つ → 仕切りの壁(列52)
      m.on(40, 'p');
      m.on(44, 'D');
      m.on(47, 'D');
      m.on(50, 'D');
      m.col(52, 0, 9, '#');
      m.on(56, 'e');
      // 部屋3: 扉2つ → 仕切りの壁(列72)
      m.on(64, 'p');
      m.on(67, 'D');
      m.on(70, 'D');
      m.col(72, 0, 9, '#');
      m.on(76, 'T'); // 13:00 黒幕からの脅しのメール
      m.on(82, 's'); // 迷惑メールの群れ
      m.on(86, 'v');
      m.pit(88, 89);
      m.on(94, 'p');
      m.put(98, 6, 'B');
      m.put(99, 6, 'Q');
      m.put(100, 6, 'B');
      m.on(106, 'i'); // 最終決戦
      m.row(116, 119, 7, 'B');
      m.row(132, 135, 7, 'B');
      m.on(126, 'R'); // アングラー(最終決戦)
      m.col(150, 0, 9, 'X');
      [154, 155, 156].forEach((x) => m.put(x, 8, 'o'));
      m.on(162, 'i'); // 余韻
      m.on(95, 'b'); // ボット(空から急降下)
      m.on(112, 'b'); // ボット(空から急降下)
      m.on(170, 'Z');
    }),
  },
  doors: {
    // to: 本物の扉に入ったら移る先(マス)。仕切りの壁の向こう
    list: [
      { url: 'https://keihi.junla-shoji.example/', real: false, to: 32 },
      { url: 'https://keihi.junia-shoji.example/', real: true, to: 32 },
      { url: 'https://keihi-junia-shoji.example/', real: false, to: 54 },
      { url: 'https://keihi.junia-shoji.example.login-check.example/', real: false, to: 54 },
      { url: 'https://keihi.junia-shoji.example/', real: true, to: 54 },
      { url: 'https://keihi.junia-shoji.example/', real: true, to: 74 },
      { url: 'https://keihi.junia-sh0ji.example/', real: false, to: 74 },
    ],
  },
  barrier: 'boss',
  angler: {
    hp: 4,
    speed: 58,
    drop: 2.2,
    swoop: 3.8,
    talk: [
      { who: 'anglerKnown', text: 'ここまで来たか、見習い。……だが、ここが私の釣り場だ!' },
      { who: 'guard', text: '最後です! 降りてきたところを踏んで、4回!' },
    ],
    defeat: [
      { who: 'anglerKnown', text: 'ば、馬鹿な……釣り針に、一度もかからないとは……' },
      { who: 'anglerKnown', text: '……覚えておけ。人が「確かめる」ことをやめたとき、我々はまた戻ってくる' },
    ],
  },
  cards: ['culture'],
  scenes: ['threat'],
  clocks: { threat: '13:00', boss: '17:00' },
  intro: [
    { who: 'sys', text: '日曜 10:00 ── 情報システム部' },
    { who: 'kuroda', text: '昨日のログから、フィッシャーズの拠点の入口が分かった。ただし、偽の入口がいくつも並んでいる' },
    { who: 'kuroda', text: '本物の入口は、うちの公式ブックマークと同じ URL だけだ。1文字でも違えば偽物' },
    { who: 'kuroda', text: '今週覚えたことを、全部使え。……行ってこい、{name}' },
    { who: 'guard', text: 'はい! 最後まで、確かめていきます!' },
    { who: 'sys', text: '今日の任務: ①本物の入口を選んで進む ②黒幕アングラーを倒す' },
  ],
  before: {
    threat: [
      { who: 'sys', text: '13:00 ── {name}あてに、黒幕からメールが届いた' },
      { who: 'guard', text: 'お、脅しのメールです……!' },
    ],
  },
  boss: [
    { who: 'sys', text: '17:00 ── フィッシャーズの拠点は、警察と業者に引き渡された' },
    { who: 'kuroda', text: '……終わったな。お疲れ、{name}' },
    { who: 'kuroda', text: '今週、障害報告書はゼロ。誰にも褒められない、最高の仕事だ' },
    { who: 'kuroda', text: '来週から、見習いは卒業だ。情報システム部へ、ようこそ' },
    { who: 'guard', text: 'やった……! {name}さん、来週からもよろしくお願いします!' },
  ],
  outro: [
    { who: 'sys', text: '── 一週間、おつかれさまでした ──' },
    { who: 'kuroda', text: '最後にひとつ。詐欺は、見抜けなくても負けじゃない。迷ったら相談、やったら報告。それができる職場が、いちばん強い' },
  ],
  hints: [
    { say: { who: 'guard', text: 'フィッシャーズの拠点へ向かいます。まずは公式ブックマークを!' } },
    {
      help: true,
      talk: [
        { who: 'guard', text: 'ここからは「URL の扉」が並んでいます。扉の上の URL を、手帳のブックマークと1文字ずつ見比べて' },
        { who: 'guard', text: '本物の扉の前で B ボタン(X キー)を押すと入れます。偽物に入ると、情報を盗まれて押し戻されます' },
      ],
    },
    { say: { who: 'guard', text: 'この先に、アングラーがいます……!' } },
    { say: { who: 'guard', text: '……静かになりました。出口へ行きましょう' } },
  ],
  sceneData: {
    threat: {
      from: 'self',
      time: 0,
      clues: ['bookmark'],
      mock: {
        kind: 'mail',
        from: 'Fishers <{{angler@fishers-bait.example}}>',
        subject: '{{【警告】あなたの秘密を知っている}}',
        body: [
          '[[{name} 様]]',
          '{{あなたのパソコンを、ずっと監視していた}}。',
          '{{24時間以内に}}暗号資産を送れ。',
          '{{誰かに相談すれば、すべてを公開する}}。',
        ],
      },
      choices: [
        {
          label: '返信も支払いもせず、すぐに情シスへ報告する',
          tier: 'best',
          rule: 3,
          title: '一人で抱えず、報告した',
          text: '「監視していた」「相談するな」は、根拠のない脅しの決まり文句。相手の狙いは、一人で焦らせること。報告すれば、会社として守れる。',
        },
        {
          label: '怖いけど恥ずかしいので、誰にも言わずに削除する',
          tier: 'close',
          leak: 10,
          cause: 'noReport',
          rule: 3,
          title: '一人で抱えてしまった',
          text: '同じメールは、ほかの人にも届いているかもしれない。脅しのメールほど、一人で抱えずに報告を。',
        },
        {
          label: '公開されると困るので、言われたとおり支払う',
          tier: 'fooled',
          leak: 50,
          cause: 'extortionPay',
          rule: 3,
          followup: true,
          title: '払ってしまった',
          text: '払うと「払う人」として、また狙われる。脅しに応じず、報告。',
        },
      ],
    },
  },
};

export const LATER_DAYS = [TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY];
