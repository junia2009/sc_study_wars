// 効果音。Web Audio で、その場で音を作る(音声ファイルなし)。

let ctx = null;
let muted = false;

export function initAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

export function setMuted(v) {
  muted = v;
}
export function audioCtx() {
  return ctx;
}
export function isMuted() {
  return muted;
}

function tone(freq, dur, { type = 'square', vol = 0.05, slide = 0, delay = 0 } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  jump: () => tone(420, 0.14, { slide: 380, vol: 0.04 }),
  coin: () => {
    tone(988, 0.06, { vol: 0.04 });
    tone(1319, 0.12, { vol: 0.04, delay: 0.06 });
  },
  stomp: () => tone(260, 0.12, { slide: -160, vol: 0.06 }),
  armor: () => tone(700, 0.08, { type: 'triangle', slide: -400, vol: 0.07 }),
  bump: () => tone(140, 0.08, { vol: 0.05 }),
  hurt: () => tone(220, 0.3, { type: 'sawtooth', slide: -140, vol: 0.06 }),
  item: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.08, { vol: 0.04, delay: i * 0.06 })),
  open: () => tone(660, 0.1, { type: 'triangle', vol: 0.05 }),
  good: () => [659, 880, 1175].forEach((f, i) => tone(f, 0.1, { vol: 0.05, delay: i * 0.08 })),
  bad: () => [330, 247].forEach((f, i) => tone(f, 0.2, { type: 'sawtooth', vol: 0.05, delay: i * 0.15 })),
  alarm: () => [880, 660, 880, 660].forEach((f, i) => tone(f, 0.12, { vol: 0.04, delay: i * 0.13 })),
  shot: () => tone(980, 0.05, { type: 'square', slide: -300, vol: 0.025 }),
  charge: () => tone(520, 0.22, { type: 'sawtooth', slide: 600, vol: 0.05 }),
  tick: () => tone(1200, 0.03, { vol: 0.02 }),
  clear: () =>
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.14, { vol: 0.05, delay: i * 0.11 })),
  over: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.06, delay: i * 0.2 })),
};
