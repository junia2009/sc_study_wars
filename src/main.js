// 起動と、画面の切り替え(タイトル → プレイ → 判断シーン → クリア/報告書)
import { buildSprites, spriteURL } from './sprites.js';
import { initInput, pollPad, setGameInput, clearPressed } from './input.js';
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
g.imageSmoothingEnabled = false;

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
function fit() {
  const wrap = document.querySelector('#stage-wrap');
  const portrait = innerHeight > innerWidth;
  const availH = portrait ? innerHeight * 0.55 : innerHeight;
  let s = Math.min(innerWidth / VIEW_W, availH / VIEW_H);
  if (s >= 2) s = Math.floor(s); // 2倍以上なら整数倍にして、ドットの大きさをそろえる
  wrap.style.width = `${Math.floor(VIEW_W * s)}px`;
  wrap.style.height = `${Math.floor(VIEW_H * s)}px`;
  document.documentElement.style.setProperty('--px', `${s}px`);
  document.body.classList.toggle('portrait', portrait);
}
addEventListener('resize', fit);
fit();

// ---- ゲーム ----
let mode = 'title'; // title | play | dialog | end
const game = new Game(STAGE1, S, {
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
function cards(back) {
  UI.showCards(owned, { cardImg, onBack: back });
}

initInput(() => initAudio());
title();
window.scsw = game; // 動作確認用(ブラウザの開発ツールから状態を見られる)

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
