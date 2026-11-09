// キーボード・画面のボタン・ゲームパッドの入力をまとめる。
//   held.left / right / jump / act(撃つ) / note(手帳)   … 押している間 true
//   take('jump') / take('act') / take('note')        … 前に呼んでから押されたら true(1回だけ)

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'jump', Space: 'jump', KeyK: 'jump', KeyW: 'jump',
  KeyX: 'act', KeyJ: 'act', ArrowUp: 'act', Enter: 'act',
  KeyC: 'note', KeyI: 'note',
};

export const held = { left: false, right: false, jump: false, act: false, note: false };
const pressed = { jump: false, act: false, note: false };
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
  pressed.jump = pressed.act = pressed.note = false;
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
// 押せるのは、ボタンの上と、その周り(.cluster の余白 = 指のずれの許容分)だけ。
// 指ごとに「今どこにあるか」から、押しているボタンを毎回決め直すので、
// 左右のキーの間を滑らせると向きが切り替わる。指を大きく外へ離すと、押していないことになる。
const fingers = new Map(); // pointerId → { zone, name }
const RELEASE_PX = 48; // ボタンからこれ以上離れたら、押していないことにする

// 点から四角までの距離(中なら 0)
function distToRect(x, y, r) {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

function pick(zone, x, y, prev) {
  let best = null;
  let bestD = Infinity;
  const ds = {};
  for (const b of zone.querySelectorAll('[data-btn]')) {
    const r = b.getBoundingClientRect();
    // 丸いボタンは、角の外側を押せないように円で測る
    const round = b.classList.contains('pad-btn');
    const d = round
      ? Math.max(0, Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) - r.width / 2)
      : distToRect(x, y, r);
    ds[b.dataset.btn] = d;
    if (d < bestD) {
      bestD = d;
      best = b.dataset.btn;
    }
  }
  if (bestD > RELEASE_PX) return null;
  // 境目でちらつかないよう、直前のボタンが同じくらい近ければそのまま
  if (prev && ds[prev] !== undefined && ds[prev] <= bestD + 6) return prev;
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
      zone.classList.add('touching');
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
      if (![...fingers.values()].some((f) => f.zone === zone)) zone.classList.remove('touching');
      syncTouch();
    };
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
    zone.addEventListener('lostpointercapture', up);
    zone.addEventListener('contextmenu', (e) => e.preventDefault());
    // タップのあとにブラウザが送ってくる「クリック」を止める
    // (B で手帳を開いた直後、同じ場所にある「とじる」が押されてしまうのを防ぐ)
    zone.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
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
    note: b(3),
  };
  for (const k in next) {
    if (sources.pad[k] !== next[k]) {
      sources.pad[k] = next[k];
      refresh(k);
    }
  }
}
