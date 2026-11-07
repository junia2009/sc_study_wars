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

  // 画面のボタン(複数の指で同時に押せる)
  const active = new Map(); // pointerId → name
  for (const btn of document.querySelectorAll('[data-pad]')) {
    const name = btn.dataset.pad;
    const down = (e) => {
      e.preventDefault();
      onAnyInput?.();
      if (!enabled) return;
      active.set(e.pointerId, name);
      btn.classList.add('on');
      sources.touch[name] = true;
      refresh(name);
    };
    const up = (e) => {
      if (!active.has(e.pointerId)) return;
      active.delete(e.pointerId);
      btn.classList.remove('on');
      sources.touch[name] = [...active.values()].includes(name);
      refresh(name);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
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
