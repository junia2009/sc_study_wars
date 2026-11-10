// 特殊武器。日をクリアすると手に入る(ロックマンのように、倒した相手の手口への「対策」を武器にする)。
// エネルギーは最大 MAX。業務データ(光る結晶)を拾うと、選んでいる武器に補充される。
export const MAX_ENERGY = 12;

export const WEAPONS = [
  {
    id: 'buster',
    name: 'ショット',
    short: '弾',
    color: '#ffd23f',
    cost: 0,
    desc: 'いつもの弾。長押しして離すと、ため撃ち。',
  },
  {
    id: 'mfa',
    name: '多要素シールド',
    short: '盾',
    color: '#5cc8ff',
    cost: 4,
    from: 'tuesday',
    desc: '体の周りを光の玉が回る(5秒)。触れた敵と釣り針を消す。パスワードだけでは入れない、2つめの守り。',
  },
  {
    id: 'quarantine',
    name: '隔離ショット',
    short: '隔',
    color: '#5dff8a',
    cost: 2,
    from: 'wednesday',
    desc: '当てた敵を閉じ込めて消す。マルウェアは分裂しない。なりすましの盾も通る。見つけたら、広がる前に隔離。',
  },
  {
    id: 'patch',
    name: 'パッチ配布',
    short: '更',
    color: '#ff9fc6',
    cost: 2,
    from: 'thursday',
    desc: '斜め上へ3方向に撃つ。空を飛ぶボットに届く。弱点は、修正版で上からふさぐ。',
  },
  {
    id: 'blocklist',
    name: 'ブロックリスト',
    short: '断',
    color: '#ff5c7a',
    cost: 6,
    from: 'friday',
    desc: '画面の中の迷惑メール・フィッシング・ボットをまとめて消す。ボスにも効く。知られた攻撃元は、まとめて遮断。',
  },
];
