// キーボード・画面のボタン・ゲームパッドの入力をまとめる。
//   held.left / right / jump / act   … 押している間 true
//   take('jump') / take('act')        … 前に呼んでから押されたら true(1回だけ)

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'jump', Space: 'jump', KeyK: 'jump', KeyW: 'jump',
  KeyX: 'act', ArrowUp: 'act', KeyJ: 'act', Enter: 'act',
};

export const held = { left: false, right: false, jump: false, act: false };
const pressed = { jump: false, act: false };
const sources = { key: {}, touch: {}, pad: {} };

function refresh(name) {
  const was = held[name];
  held[name] = !!(sources.key[name] || sources.touch[name] || sources.pad[name]);
  if (held[name] && !was && name in pressed) pressed[name] = true;
}

export function take(name) {
  const v = pressed[name];
  pressed[name] = false;
  return v;
}

export function clearPressed() {
  pressed.jump = pressed.act = false;
}

let enabled = true;
// 判断シーンなどで文字入力やボタン操作をするあいだは、ゲームの入力を止める
export function setGameInput(on) {
  enabled = on;
  if (!on) {
    for (const s of Object.values(sources)) for (const k in s) s[k] = false;
    for (const k in held) held[k] = false;
    fingers?.clear();
    document.querySelectorAll('#pad .on').forEach((el) => el.classList.remove('on'));
    clearPressed();
  }
}

export function initInput(onAnyInput) {
  addEventListener('keydown', (e) => {
    onAnyInput?.();
    const name = KEYS[e.code];
    if (!name || !enabled) return;
    e.preventDefault();
    sources.key[name] = true;
    refresh(name);
  });
  addEventListener('keyup', (e) => {
    const name = KEYS[e.code];
    if (!name) return;
    sources.key[name] = false;
    refresh(name);
  });
  addEventListener('blur', () => {
    for (const k in sources.key) sources.key[k] = false;
    for (const k in held) refresh(k);
  });

  initTouch(onAnyInput);
}

// ---- スマホのコントローラー ----
// 指ごとに「今どこにあるか」から、押しているボタンを毎回決め直す。
//   十字キー: 枠の真ん中より左なら左、右なら右(真ん中付近は直前の向きを保つ)
//   ボタン:   いちばん近いボタン(すき間を押しても、近いほうが反応する)
// 指は枠の外へ出ても追いかける(setPointerCapture)ので、滑らせても途切れない。
const fingers = new Map(); // pointerId → { zone, name }

function pick(zone, x, y, prev) {
  if (zone.dataset.zone === 'dpad') {
    // 押せる範囲は広いが、左右の境目は「見えている十字キーの真ん中」にする
    const r = (zone.querySelector('.dpad-face') || zone).getBoundingClientRect();
    const dx = x - (r.left + r.width / 2);
    if (Math.abs(dx) < r.width * 0.08 && prev) return prev;
    return dx < 0 ? 'left' : 'right';
  }
  let best = null;
  let bestD = Infinity;
  for (const b of zone.querySelectorAll('[data-btn]')) {
    const r = b.getBoundingClientRect();
    const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    if (d < bestD) {
      bestD = d;
      best = b.dataset.btn;
    }
  }
  return best;
}

function syncTouch() {
  const now = {};
  for (const f of fingers.values()) if (f.name) now[f.name] = true;
  for (const k of ['left', 'right', 'jump', 'act']) {
    const was = !!sources.touch[k];
    sources.touch[k] = !!now[k];
    refresh(k);
    if (!was && now[k] && (k === 'jump' || k === 'act')) navigator.vibrate?.(8);
  }
  for (const el of document.querySelectorAll('#pad [data-show]')) el.classList.toggle('on', !!now[el.dataset.show]);
}

function initTouch(onAnyInput) {
  for (const zone of document.querySelectorAll('#pad [data-zone]')) {
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      document.body.classList.add('touch');
      onAnyInput?.();
      if (!enabled) return;
      try {
        zone.setPointerCapture(e.pointerId);
      } catch {
        /* 取れなくても動く */
      }
      fingers.set(e.pointerId, { zone, name: pick(zone, e.clientX, e.clientY, null) });
      syncTouch();
    });
    zone.addEventListener('pointermove', (e) => {
      const f = fingers.get(e.pointerId);
      if (!f) return;
      const name = pick(f.zone, e.clientX, e.clientY, f.name);
      if (name !== f.name) {
        f.name = name;
        syncTouch();
      }
    });
    const up = (e) => {
      if (!fingers.delete(e.pointerId)) return;
      syncTouch();
    };
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
    zone.addEventListener('lostpointercapture', up);
    zone.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // プレイ中に、ダブルタップやピンチで画面が拡大・スクロールされないようにする
  // (拡大されると、見た目とタップの位置がずれる)
  const app = document.querySelector('#app');
  app.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  app.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault());
  addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
}

// ゲームパッド(毎フレーム読む)
export function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = [...pads].find(Boolean);
  if (!p || !enabled) return;
  const b = (i) => !!p.buttons[i]?.pressed;
  const ax = p.axes[0] || 0;
  const next = {
    left: b(14) || ax < -0.4,
    right: b(15) || ax > 0.4,
    jump: b(0),
    act: b(1) || b(2) || b(12),
  };
  for (const k in next) {
    if (sources.pad[k] !== next[k]) {
      sources.pad[k] = next[k];
      refresh(k);
    }
  }
}
