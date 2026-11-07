// 起動と、1日の流れ(タイトル → 名前 → 朝の会話 → プレイ ⇄ 判断シーン → 黒幕 → 振り返り)
import { buildSprites, spriteURL } from './sprites.js';
import { initInput, pollPad, setGameInput, clearPressed, held } from './input.js';
import { initAudio, setMuted, isMuted } from './audio.js';
import { Game, VIEW_W, VIEW_H } from './game.js';
import { RES } from './sprites.js';
import { STAGE1 } from '../data/stage1.js';
import { SCENES } from '../data/scenes.js';
import { MONDAY, GRADES } from '../data/story.js';
import * as UI from './ui.js';
import { Movie } from './movie.js';

export const GAME_TITLE = 'SC STUDY WARS';
export const GAME_SUBTITLE = '障害報告書は書きたくない';

const canvas = document.querySelector('#screen');
const g = canvas.getContext('2d');
canvas.width = VIEW_W * RES;
canvas.height = VIEW_H * RES;

const S = buildSprites();
const CARD_SPRITE = { pass: S.pass[0].r, shield: S.shield, phish: S.phish[0].r, door: S.door, bookmark: S.bookmark, ledger: S.ledger };
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
const DAY = MONDAY;
game = new Game(STAGE1, DAY, S, {
  hud: (gm) => UI.updateHud(gm),
  banner: (text, tone) => UI.banner(text, tone),
  say: (line) => UI.say(line),
  prompt: (text) => UI.prompt(text),
  // 手がかりを取った
  clue: (kind) => {
    const lines = {
      bookmark: [{ who: 'guard', text: '公式ブックマークを手に入れました! 手帳に記録しておきます(B ボタンで見られます)' }],
      ledger: [{ who: 'guard', text: '連絡先台帳を手に入れました! 山田さんの本当の連絡先が載っています' }],
    }[kind];
    pause();
    UI.talk(lines, resume);
  },
  // ガードの説明(チュートリアル): ゲームを止めて会話で説明する
  lesson: (lines) => {
    pause();
    UI.talk(lines, resume);
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
      UI.showScene(id, { clues: game.clues, clock: game.clock }, (result) => {
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
    UI.hideOverlay();
    setTimeout(() => UI.showReport(gm, { onRetry: startDay, onTitle: title }), 500);
  },
  // ログアウトゲートに着いた: 黒幕 → 振り返り
  goal: (gm) => {
    mode = 'end';
    setGameInput(false);
    UI.prompt(null);
    gm.clock = DAY.clocks.boss;
    UI.updateHud(gm);
    UI.talk(DAY.boss, () => review(gm));
  },
});

function review(gm) {
  const sum = gm.summary(GRADES);
  owned = [...new Set([...owned, ...sum.cards])];
  store.set('scsw.cards', owned);
  const opts = {
    day: DAY.day,
    cardImg,
    onCards: () => cards(() => UI.showReview(sum, opts)),
    onRetry: startDay,
    onTitle: title,
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
// 1日を最初から: 朝の会話 → プレイ
function startDay() {
  game.reset();
  UI.prompt(null);
  pause();
  UI.talk(DAY.intro, resume);
}
function title() {
  mode = 'title';
  setGameInput(false);
  game.reset();
  UI.showTitle({
    title: GAME_TITLE,
    subtitle: GAME_SUBTITLE,
    owned: owned.length,
    heroURL: spriteURL(S.guard.stand[0].r, 4),
    muted: isMuted(),
    onStart: () => {
      initAudio();
      UI.askName(playerName, (name) => {
        playerName = name;
        store.set('scsw.name', name);
        // 初めての人には、まずオープニングムービーを見せる
        if (!seen.opening) playOpening(startDay);
        else startDay();
      });
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
for (const id of DAY.scenes) if (!SCENES[id]) console.warn(`判断シーン ${id} がない`);

// PWA
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
