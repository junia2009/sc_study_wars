// 起動と、1日の流れ(タイトル → 名前 → 朝の会話 → プレイ ⇄ 判断シーン → 黒幕 → 振り返り)
import { buildSprites, spriteURL } from './sprites.js';
import { initInput, pollPad, setGameInput, clearPressed, held } from './input.js';
import { initAudio, setMuted, isMuted } from './audio.js';
import { Game, VIEW_W, VIEW_H } from './game.js';
import { RES } from './sprites.js';
import { STAGE1 } from '../data/stage1.js';
import { SCENES } from '../data/scenes.js';
import { MONDAY, GRADES, CLUES } from '../data/story.js';
import { LATER_DAYS } from '../data/days.js';
import { WEAPONS } from '../data/weapons.js';
import * as UI from './ui.js';
import { Movie } from './movie.js';

export const GAME_TITLE = 'SC STUDY WARS';
export const GAME_SUBTITLE = '障害報告書は書きたくない';

const canvas = document.querySelector('#screen');
const g = canvas.getContext('2d');
canvas.width = VIEW_W * RES;
canvas.height = VIEW_H * RES;

const S = buildSprites();
const CARD_SPRITE = {
  pass: S.pass[0].r,
  shield: S.shield,
  phish: S.phish[0].r,
  door: S.door,
  bookmark: S.bookmark,
  ledger: S.ledger,
  rules: S.rules,
  naisen: S.naisen,
  soft: S.soft[0].r,
  mail: S.mail[0].r,
  reboot: S.reboot,
  guard: S.guard.stand[0].r,
  tail: S.tail[0].r,
};
const cardImgCache = {};
const cardImg = (c) => (cardImgCache[c.id] ??= spriteURL(CARD_SPRITE[c.sprite] || S.crystal[0], 2));

// ---- 保存(端末の中だけ。使えないときは保存しないで続ける) ----
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, v) {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* 保存できない環境 */
    }
  },
};
let owned = store.get('scsw.cards', []);
setMuted(store.get('scsw.muted', false));
let playerName = store.get('scsw.name', 'ミナト');

// 画面(ui.js)に渡す: 顔・手がかりの画像と、主人公の名前
const faceCache = {};
const clueCache = {};
UI.initUI({
  face: (k) => (faceCache[k] ??= spriteURL(S.faces[k], 3)),
  clueImg: (k) => (clueCache[k] ??= spriteURL(S[k], 2)),
  name: () => playerName,
  // タッチ端末か(操作の説明の書き方を変える)
  touch: () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches,
  // 初めて見たときの説明を、もう見たか
  seen: (k) => !!seen[k],
  markSeen: (k) => {
    seen[k] = true;
    store.set('scsw.seen', seen);
  },
});
const seen = store.get('scsw.seen', {});

// ---- 画面の大きさ ----
// 画面の形に合わせて、拡大率と「見える範囲(横 vw × 縦 vh)」を決める。
//   横向き・PC: 高さいっぱいに映し、横幅は画面の形に合わせて 240〜400 の間で広げる(黒い帯を出さない)
//   縦向き:     下のコントローラーの台を除いた場所を、まるごとゲーム画面にする。
//               見える横幅を 10〜13 マスに絞ってキャラを大きくし、余った高さは床の上の景色として映す
const PORTRAIT_VW = 216;
function fit() {
  const wrap = document.querySelector('#stage-wrap');
  const portrait = innerHeight > innerWidth;
  document.body.classList.toggle('portrait', portrait);
  const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let s;
  let vw;
  let vh = VIEW_H;
  if (portrait) {
    // 縦向き: 見える範囲がだいたい「横 168〜216 × 縦 250 前後」になるように寄る。
    // 縦長の画面ほど寄ってキャラを大きくし、余った高さは床の上の景色として映す
    const top = parseFloat(getComputedStyle(document.querySelector('#app')).paddingTop) || 0;
    const deck = document.querySelector('#pad').getBoundingClientRect().height; // 画面のボタンがないときは 0
    const areaH = innerHeight - top - deck;
    s = Math.max(innerWidth / PORTRAIT_VW, areaH / 250);
    if (innerWidth / s < 168) s = innerWidth / 168;
    vh = areaH / s;
    if (vh < VIEW_H) {
      s = areaH / VIEW_H;
      vh = VIEW_H;
    }
    vh = Math.min(vh, 340);
    vw = clampN(innerWidth / s, 168, VIEW_W);
  } else {
    s = innerHeight / VIEW_H;
    if (s >= 2 && !document.body.classList.contains('touch')) s = Math.floor(s); // PC は整数倍でドットをそろえる
    vw = clampN(innerWidth / s, 240, 400);
    s = Math.min(s, innerWidth / vw);
  }
  vw = Math.round(vw);
  vh = Math.round(vh);
  if (canvas.width !== vw * RES || canvas.height !== vh * RES) {
    canvas.width = vw * RES;
    canvas.height = vh * RES;
  }
  g.imageSmoothingEnabled = false;
  game?.setView(vw, vh);
  wrap.style.width = `${Math.round(vw * s)}px`;
  wrap.style.height = `${Math.round(vh * s)}px`;
  document.documentElement.style.setProperty('--px', `${s}px`);
}
addEventListener('resize', fit);
let game = null;
addEventListener('orientationchange', () => setTimeout(fit, 200));
visualViewport?.addEventListener('resize', fit);

// ---- ゲーム ----
let mode = 'title'; // title | play | dialog | end
// 1週間: 月曜(story.js / stage1.js)+ 火曜〜日曜(days.js)
const DAYS = [{ ...MONDAY, stage: STAGE1, cards: ['bec', 'phishing', 'verify'] }, ...LATER_DAYS.map((d) => ({ firstSight: MONDAY.firstSight, ...d }))];
for (const d of LATER_DAYS) Object.assign(SCENES, d.sceneData);
let dayIndex = 0;
let DAY = DAYS[0];
// 遊べる日(クリアした日の次の日まで)と、クリアした日
let progress = store.get('scsw.progress', { unlocked: 0, cleared: [] });
// 手に入れた特殊武器(クリアした日からも数え直す。前から遊んでいる人にも渡るように)
let ownedWeapons = [...new Set([...store.get('scsw.weapons', []), ...WEAPONS.filter((w) => w.from && progress.cleared.includes(w.from)).map((w) => w.id)])];
store.set('scsw.weapons', ownedWeapons);
// 遊び方の説明を、その日にもう見たか(月曜は以前の保存 seen.learned も見る)
const learnedDay = () => !!seen[`learned_${DAY.id}`] || (DAY.id === 'monday' && !!seen.learned);
game = new Game(STAGE1, DAY, S, {
  hud: (gm) => UI.updateHud(gm),
  banner: (text, tone) => UI.banner(text, tone),
  say: (line) => UI.say(line),
  prompt: (text) => UI.prompt(text),
  // 手がかりを取った
  clue: (kind) => {
    const lines = {
      bookmark: [{ who: 'guard', text: '公式ブックマークを手に入れました! 手帳に記録しておきます({note}で見られます)' }],
      ledger: [{ who: 'guard', text: '連絡先台帳を手に入れました! 山田さんの本当の連絡先が載っています' }],
    }[kind] || [{ who: 'guard', text: `${CLUES[kind].name}を手に入れました! 手帳に記録しておきます。${CLUES[kind].hint}` }];
    if (learnedDay()) {
      // 遊び方を覚えた人には、止めずにひとことで
      UI.say({ who: 'guard', text: `${CLUES[kind].name}を手に入れた!` });
      return;
    }
    pause();
    UI.talk(lines, resume);
  },
  // 遊び方を一度覚えたか(その日を最後まで遊んだら覚えたことにして、2回目からは遊び方の説明を出さない)
  learned: learnedDay,
  sightSeen: (kind) => !!seen[`sight_${kind}`] || (seen.learned && (kind === 'pass' || kind === 'soft')),
  markSight: (kind) => {
    seen[`sight_${kind}`] = true;
    store.set('scsw.seen', seen);
  },
  // ガードの説明(チュートリアル): ゲームを止めて会話で説明する
  lesson: (lines) => {
    pause();
    UI.talk(lines, resume);
  },
  // 承認の通知(木曜)
  push: (ps) => UI.showPush(ps, (approve) => game.answerPush(ps, approve)),
  pushDone: (ps) => UI.hidePush(ps),
  // URL の扉(日曜)
  door: (dr) => {
    pause();
    UI.showDoor(dr, game.clues, (enter) => {
      resume();
      game.enterDoor(dr, enter);
    });
  },
  // 手帳(B ボタン)
  notebook: () => {
    pause();
    UI.showNotebook(game.clues, resume);
  },
  // 判断シーン: 前のひとこと → 判断 → 結果
  scene: (id) => {
    pause();
    game.clock = DAY.clocks[id] || game.clock;
    UI.updateHud(game);
    UI.talk(DAY.before[id] || [], () => {
      UI.showScene(id, { clues: game.clues, clock: game.clock, ioc: game.ioc }, (result) => {
        game.applyScene(id, result);
        if (!game.over) resume();
      });
    });
  },
  // 漏洩リスク・業務の遅れが満タン
  over: (gm) => {
    mode = 'end';
    setGameInput(false);
    UI.prompt(null);
    UI.clearPushes();
    UI.hideOverlay();
    setTimeout(() => UI.showReport(gm, { onRetry: startDay, onTitle: title }), 500);
  },
  // ログアウトゲートに着いた: 黒幕 → 振り返り
  goal: (gm) => {
    seen[`learned_${DAY.id}`] = true;
    if (DAY.id === 'monday') seen.learned = true;
    store.set('scsw.seen', seen);
    mode = 'end';
    setGameInput(false);
    UI.prompt(null);
    UI.clearPushes();
    gm.clock = DAY.clocks.boss;
    UI.updateHud(gm);
    UI.talk(DAY.boss, () => review(gm));
  },
});

function review(gm) {
  const sum = gm.summary(GRADES);
  owned = [...new Set([...owned, ...sum.cards])];
  store.set('scsw.cards', owned);
  // クリアした日を記録して、次の日を遊べるようにする
  if (!progress.cleared.includes(DAY.id)) progress.cleared.push(DAY.id);
  progress.unlocked = Math.max(progress.unlocked, Math.min(DAYS.length - 1, dayIndex + 1));
  store.set('scsw.progress', progress);
  // その日の手口への「対策」を、特殊武器として手に入れる
  const prize = WEAPONS.find((w) => w.from === DAY.id && !ownedWeapons.includes(w.id));
  if (prize) {
    ownedWeapons = [...ownedWeapons, prize.id];
    store.set('scsw.weapons', ownedWeapons);
    game.ownedWeapons = ownedWeapons;
  }
  const nextDay = DAYS[dayIndex + 1];
  const last = !nextDay;
  const opts = {
    day: DAY.day,
    cardImg,
    weapon: prize,
    onCards: () => cards(() => UI.showReview(sum, opts)),
    onRetry: startDay,
    onTitle: title,
    next: last
      ? { label: 'エンディングへ', text: '一週間、守り抜いた!' }
      : { label: `${nextDay.day}へ`, text: `次は${nextDay.day}: ${nextDay.theme}` },
    onNext: last ? ending : () => playDay(dayIndex + 1),
  };
  UI.talk(DAY.outro, () => UI.showReview(sum, opts));
}

// ---- オープニングムービー ----
const movie = new Movie(S, (cap, shot, total) => UI.setMovieCaption(cap, shot, total));
function playOpening(onEnd) {
  mode = 'movie';
  setGameInput(false);
  document.body.classList.add('movie');
  UI.startMovieUI({ onNext: () => movie.next(), onSkip: () => movie.skip() });
  movie.start(() => {
    document.body.classList.remove('movie');
    UI.hideOverlay();
    seen.opening = true;
    store.set('scsw.seen', seen);
    onEnd();
  });
}

function pause() {
  mode = 'dialog';
  setGameInput(false);
}
function resume() {
  UI.hideOverlay();
  mode = 'play';
  setGameInput(true);
  clearPressed();
  canvas.focus?.();
}
// 日を選んで始める
function playDay(i) {
  dayIndex = i;
  DAY = DAYS[i];
  game.stage = DAY.stage;
  game.day = DAY;
  game.ownedWeapons = ownedWeapons;
  startDay();
}
function ending() {
  mode = 'end';
  UI.showEnding({ heroURL: spriteURL(S.guard.stand[0].r, 3), owned: owned.length, onCards: () => cards(ending), onTitle: title });
}
// 1日を最初から: 朝の会話 → プレイ
function startDay() {
  game.reset();
  UI.prompt(null);
  UI.clearPushes();
  pause();
  // 前から遊んでいる人には、新しく増えたショットを一度だけ知らせる
  const extra =
    seen.learned && !seen.shootIntro
      ? [
          { who: 'guard', text: '{name}さん、ガードに新しい力が付きました! {shoot}で弾を撃てます。長く押してから離すと、大きな「ため撃ち」です' },
          { who: 'guard', text: '倒さずに置いていった敵は、社内に入り込んで夕方に見つかります。倒した敵が落とす「痕跡」を3つ集めると、判断シーンでヒントに使えます' },
          { who: 'guard', text: '手帳は{note}から開けます' },
        ]
      : [];
  if (extra.length) {
    seen.shootIntro = true;
    store.set('scsw.seen', seen);
  }
  UI.talk([...DAY.intro, ...extra], resume);
}
function title() {
  mode = 'title';
  setGameInput(false);
  UI.clearPushes();
  UI.prompt(null);
  game.reset();
  const cont = progress.unlocked;
  UI.showTitle({
    startLabel: cont > 0 ? `つづきから(${DAYS[cont].day})` : '月曜からはじめる',
    days: DAYS.map((d, i) => ({ day: d.day, theme: d.theme || '取引先のなりすまし / フィッシング', unlocked: i <= progress.unlocked, cleared: progress.cleared.includes(d.id) })),
    onDay: (i) => {
      initAudio();
      playDay(i);
    },
    title: GAME_TITLE,
    subtitle: GAME_SUBTITLE,
    owned: owned.length,
    heroURL: spriteURL(S.guard.stand[0].r, 4),
    muted: isMuted(),
    name: playerName,
    onName: (name) => {
      playerName = name || 'ミナト';
      store.set('scsw.name', playerName);
    },
    onStart: () => {
      initAudio();
      // 初めての人には、まずオープニングムービーを見せる
      if (!seen.opening) playOpening(() => playDay(cont));
      else playDay(cont);
    },
    onCards: () => cards(title),
    onMute: () => {
      setMuted(!isMuted());
      store.set('scsw.muted', isMuted());
      title();
    },
    onMovie: seen.opening
      ? () => {
          initAudio();
          playOpening(title);
        }
      : null,
  });
}
// 一時停止(HUD の ⏸ ボタン、Esc・P キー)
function pauseMenu() {
  if (mode !== 'play') return;
  pause();
  UI.showPause({
    muted: isMuted(),
    onResume: resume,
    onRestart: startDay,
    onTitle: title,
    onMute: () => {
      setMuted(!isMuted());
      store.set('scsw.muted', isMuted());
      mode = 'play';
      pauseMenu();
    },
  });
}
document.querySelector('#hud-weapon').addEventListener('click', (e) => {
  e.stopPropagation();
  if (mode === 'play') game.switchWeapon(1);
});
document.querySelector('#hud-note').addEventListener('click', (e) => {
  e.stopPropagation();
  if (mode === 'play') game.hooks.notebook();
});
document.querySelector('#hud-pause').addEventListener('click', (e) => {
  e.stopPropagation();
  initAudio();
  pauseMenu();
});
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' && e.code !== 'KeyP') return;
  if (mode === 'play') pauseMenu();
  else if (mode === 'dialog' && document.querySelector('#overlay .pause')) resume();
});

function cards(back) {
  UI.showCards(owned, { cardImg, onBack: back });
}

fit();
addEventListener('touchstart', () => setTimeout(fit, 0), { once: true, passive: true });
initInput(() => initAudio());
title();
window.scsw = game; // 動作確認用(ブラウザの開発ツールから状態を見られる)
window.__held = held;

// ---- ループ(1/60 秒きざみで進めて、端末の速さに左右されないようにする) ----
const STEP = 1 / 60;
let acc = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  pollPad();
  if (mode === 'movie') {
    movie.update(dt);
    if (movie.active) {
      movie.render(g, canvas.width, canvas.height, now);
      requestAnimationFrame(frame);
      return;
    }
  }
  if (mode === 'play') {
    acc += dt;
    while (acc >= STEP && mode === 'play') {
      game.update(STEP);
      acc -= STEP;
    }
  } else {
    acc = 0;
  }
  game.render(g, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 判断シーンの中身が足りているかを、開発中に確かめる
for (const d of DAYS) for (const id of d.scenes) if (!SCENES[id]) console.warn(`判断シーン ${id} がない`);
window.__days = { DAYS, playDay };

// PWA
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
