// 起動と、画面の切り替え(タイトル → プレイ → 判断シーン → クリア/報告書)
import { buildSprites, spriteURL } from './sprites.js';
import { initInput, pollPad, setGameInput, clearPressed, held } from './input.js';
import { initAudio, setMuted, isMuted } from './audio.js';
import { Game, VIEW_W, VIEW_H } from './game.js';
import { RES } from './sprites.js';
import { STAGE1 } from '../data/stage1.js';
import { SCENES } from '../data/scenes.js';
import * as UI from './ui.js';

export const GAME_TITLE = 'SC STUDY WARS';
export const GAME_SUBTITLE = '障害報告書は書きたくない';

const canvas = document.querySelector('#screen');
const g = canvas.getContext('2d');
canvas.width = VIEW_W * RES;
canvas.height = VIEW_H * RES;

const S = buildSprites();
const CARD_SPRITE = { pass: S.pass[0].r, shield: S.shield, phish: S.phish[0].r, door: S.door };
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
game = new Game(STAGE1, S, {
  hud: (gm) => UI.updateHud(gm),
  banner: (text, tone) => UI.banner(text, tone),
  prompt: (text) => UI.prompt(text),
  scene: (id) => {
    pause();
    UI.showScene(id, (choice) => {
      game.applyScene(id, choice);
      if (!game.over) resume();
    });
  },
  door: (door) => {
    pause();
    UI.showDoor(door, (enter) => {
      if (enter) game.enterDoor(door);
      if (!game.over) resume();
    });
  },
  over: (gm) => {
    mode = 'end';
    setGameInput(false);
    UI.prompt(null);
    UI.hideOverlay();
    setTimeout(() => UI.showReport(gm, { onRetry: restart, onTitle: title }), 500);
  },
  clear: (gm) => {
    mode = 'end';
    setGameInput(false);
    UI.prompt(null);
    const sum = gm.summary();
    owned = [...new Set([...owned, ...sum.cards])];
    store.set('scsw.cards', owned);
    const best = store.get('scsw.best', 0);
    if (sum.score > best) store.set('scsw.best', sum.score);
    const clearOpts = { cardImg, onCards: () => cards(() => UI.showClear(sum, clearOpts)), onRetry: restart, onTitle: title };
    UI.showClear(sum, clearOpts);
  },
});

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
function restart() {
  game.reset();
  UI.prompt(null);
  resume();
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
      restart();
      UI.banner('経理部に到着。ゴールは、本物の経費精算システムの扉だ。', 'info');
    },
    onCards: () => cards(title),
    onMute: () => {
      setMuted(!isMuted());
      store.set('scsw.muted', isMuted());
      title();
    },
  });
}
// 一時停止(HUD の ⏸ ボタン、Esc・P キー)
function pauseMenu() {
  if (mode !== 'play') return;
  pause();
  UI.showPause({
    muted: isMuted(),
    onResume: resume,
    onRestart: restart,
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
for (const id of STAGE1.terminals) if (!SCENES[id]) console.warn(`判断シーン ${id} がない`);

// PWA
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
