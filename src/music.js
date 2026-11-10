// BGM。Web Audio で、その場で鳴らす(音声ファイルなし)。
//
// 曲は手で譜面を書かず、「調・コード進行・速さ・ノリ」から決まった手順で旋律を作る。
// 乱数の種を曲ごとに固定しているので、毎回同じ曲になる(すべてこのゲームのためのオリジナル)。
//   旋律: 4小節のフレーズを作り、5〜8小節目は同じ始まりで終わり方だけ変える(覚えやすい形)
//   ベース・ドラム: ノリ(drive / walk / calm)ごとの型
import { audioCtx, isMuted } from './audio.js';

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

// 曲の設計図。prog はコード(ローマ数字の代わりに、調の音階の何番目か: 0〜6)
const TRACKS = {
  title: { key: 'A', minor: true, bpm: 108, prog: [0, 5, 2, 6], feel: 'calm', seed: 11 },
  monday: { key: 'C', minor: false, bpm: 132, prog: [0, 5, 3, 4], feel: 'drive', seed: 21 },
  tuesday: { key: 'D', minor: true, bpm: 128, prog: [0, 5, 6, 4], feel: 'walk', seed: 32 },
  wednesday: { key: 'E', minor: true, bpm: 136, prog: [0, 3, 5, 4], feel: 'drive', seed: 43 },
  thursday: { key: 'F', minor: false, bpm: 116, prog: [0, 2, 3, 4], feel: 'walk', seed: 54 },
  friday: { key: 'G', minor: true, bpm: 144, prog: [0, 6, 5, 4], feel: 'drive', seed: 65 },
  saturday: { key: 'A', minor: true, bpm: 150, prog: [0, 0, 5, 4], feel: 'drive', seed: 76 },
  sunday: { key: 'B', minor: true, bpm: 140, prog: [0, 5, 2, 4], feel: 'drive', seed: 87 },
  boss: { key: 'E', minor: true, bpm: 168, prog: [0, 1, 0, 6], feel: 'drive', seed: 98, hard: true },
  chase: { key: 'A', minor: true, bpm: 176, prog: [0, 0, 6, 5], feel: 'drive', seed: 109, hard: true },
  review: { key: 'F', minor: false, bpm: 96, prog: [0, 3, 1, 4], feel: 'calm', seed: 120 },
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

// 設計図から、8小節(16分音符 × 128)の譜面を作る
function compose(def) {
  const r = rng(def.seed);
  const scale = def.minor ? MINOR : MAJOR;
  const tonic = 60 + NOTE[def.key] - (NOTE[def.key] > 5 ? 12 : 0);
  // 音階の n 番目(オクターブをまたいでよい)の高さ
  const deg = (n) => tonic + scale[((n % 7) + 7) % 7] + 12 * Math.floor(n / 7);
  const chordTones = (c) => [c, c + 2, c + 4];
  // リズムの型(1 = 音の出だし)。ノリで選ぶ候補を変える
  const rhythms =
    def.feel === 'calm'
      ? ['1000001000100000', '1000100010000000', '1000000010001000']
      : ['1010001010100010', '1000101000101010', '1010101000100010', '1001001010001010'];
  const motif = [0, 1, 2, 3].map(() => rhythms[Math.floor(r() * rhythms.length)]);
  const lead = [];
  let pos = chordTones(def.prog[0])[Math.floor(r() * 3)] + 7; // 1オクターブ上から
  const phrase = [];
  for (let bar = 0; bar < 4; bar++) {
    const c = def.prog[bar % def.prog.length];
    const notes = [];
    for (let i = 0; i < 16; i++) {
      if (motif[bar][i] !== '1') continue;
      // 小節の頭はコードの音へ寄せ、それ以外は音階を1〜2歩ずつ動く
      if (i === 0) {
        const targets = chordTones(c).map((t) => t + 7);
        pos = targets.reduce((a, b) => (Math.abs(b - pos) < Math.abs(a - pos) ? b : a));
      } else {
        // 小節の前半は上がりがち、後半は下がりがち(山なりの旋律にする)。たまに跳ぶ
        const x = r();
        const stepN = x < 0.55 ? 1 : x < 0.85 ? 2 : 3;
        const up = r() < (i < 8 ? 0.68 : 0.32);
        pos += up ? stepN : -stepN;
        if (pos > 14) pos = 14 - (pos - 14);
        if (pos < 3) pos = 3 + (3 - pos);
      }
      notes.push({ i, n: pos });
    }
    phrase.push(notes);
  }
  // 5〜8小節目: 前半をくり返し、最後の小節だけ主音に落ち着く
  const ending = phrase[3].map((x, k, a) => ({ i: x.i, n: k === a.length - 1 ? 7 : x.n }));
  const bars = [...phrase, phrase[0], phrase[1], phrase[2], ending];
  bars.forEach((notes, bar) => {
    notes.forEach((x, k) => {
      const next = notes[k + 1]?.i ?? 16;
      lead.push({ step: bar * 16 + x.i, len: Math.min(next - x.i, 4), m: deg(x.n) });
    });
  });
  // ベース
  const bass = [];
  for (let bar = 0; bar < 8; bar++) {
    const root = deg(def.prog[bar % def.prog.length]) - 24;
    const fifth = root + 7;
    const pat =
      def.feel === 'drive'
        ? [0, 2, 4, 6, 8, 10, 12, 14].map((i, k) => [i, k % 4 === 3 ? root + 12 : root, 2])
        : def.feel === 'walk'
          ? [[0, root, 4], [4, fifth, 4], [8, root + 12, 4], [12, fifth, 4]]
          : [[0, root, 8], [8, fifth, 8]];
    for (const [i, m, len] of pat) bass.push({ step: bar * 16 + i, len, m });
  }
  // 和音の分散(静かな伴奏)
  const arp = [];
  for (let bar = 0; bar < 8; bar++) {
    const c = def.prog[bar % def.prog.length];
    const tones = chordTones(c).map((t) => deg(t));
    for (let i = 0; i < 16; i += def.feel === 'calm' ? 4 : 2) arp.push({ step: bar * 16 + i, len: 1, m: tones[(i / 2) % 3] });
  }
  // ドラム(k: バスドラム / s: スネア / h: ハイハット)
  const drums = [];
  const kick = def.hard ? '1000100010001000' : def.feel === 'calm' ? '1000000010000000' : '1000001010000000';
  const snare = def.feel === 'calm' ? '0000000000000000' : '0000100000001000';
  const hat = def.feel === 'calm' ? '0010001000100010' : '1010101010101010';
  for (let bar = 0; bar < 8; bar++)
    for (let i = 0; i < 16; i++) {
      if (kick[i] === '1') drums.push({ step: bar * 16 + i, d: 'k' });
      if (snare[i] === '1') drums.push({ step: bar * 16 + i, d: 's' });
      if (hat[i] === '1') drums.push({ step: bar * 16 + i, d: 'h' });
    }
  const byStep = Array.from({ length: 128 }, () => []);
  for (const x of lead) byStep[x.step].push({ ...x, v: 'lead' });
  for (const x of bass) byStep[x.step].push({ ...x, v: 'bass' });
  for (const x of arp) byStep[x.step].push({ ...x, v: 'arp' });
  for (const x of drums) byStep[x.step].push({ ...x, v: 'drum' });
  return { bpm: def.bpm, byStep };
}

const compiled = {};
let bus = null; // 音量のつまみ(ミュートで 0)
let noise = null;
let cur = null;
let curName = null;
let wanted = null;
let timer = 0;
let step = 0;
let nextTime = 0;

function setup(ctx) {
  if (bus) return;
  bus = ctx.createGain();
  bus.gain.value = isMuted() ? 0 : 0.8;
  bus.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function voice(ctx, t, x, dur) {
  if (x.v === 'drum') {
    if (x.d === 'k') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.16);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = x.d === 'h' ? 'highpass' : 'bandpass';
    f.frequency.value = x.d === 'h' ? 7000 : 1800;
    const g = ctx.createGain();
    const len = x.d === 'h' ? 0.03 : 0.12;
    g.gain.setValueAtTime(x.d === 'h' ? 0.025 : 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
    src.stop(t + len + 0.02);
    return;
  }
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = x.v === 'bass' ? 'triangle' : 'square';
  o.frequency.setValueAtTime(hz(x.m), t);
  const vol = x.v === 'lead' ? 0.028 : x.v === 'bass' ? 0.07 : 0.01;
  const len = Math.max(0.05, x.len * dur * 0.9);
  g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(vol, t + len * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + len + 0.02);
}

function tick() {
  const ctx = audioCtx();
  if (!ctx || !cur) return;
  const dur = 60 / cur.bpm / 4;
  // タブを裏に回して戻ったとき、たまった音を一気に鳴らさない
  if (nextTime < ctx.currentTime - 0.1) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.15) {
    for (const x of cur.byStep[step]) voice(ctx, nextTime, x, dur);
    nextTime += dur;
    step = (step + 1) % 128;
  }
}

// name: TRACKS のキー。null で止める。同じ曲なら続けて鳴らす
export function playMusic(name) {
  wanted = name;
  const ctx = audioCtx();
  if (!ctx) return; // 音が使えるようになったら(最初の操作のあと)、startPending で始める
  setup(ctx);
  if (name === curName) return;
  curName = name;
  clearInterval(timer);
  if (!name || !TRACKS[name]) {
    cur = null;
    return;
  }
  cur = compiled[name] ??= compose(TRACKS[name]);
  step = 0;
  nextTime = ctx.currentTime + 0.08;
  timer = setInterval(tick, 25);
  tick();
}

// 最初の操作で音が使えるようになったら、待っていた曲を鳴らす
export function startPending() {
  if (wanted && wanted !== curName) playMusic(wanted);
}

export function setMusicMuted(m) {
  const ctx = audioCtx();
  if (bus && ctx) bus.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
}

export const hasTrack = (name) => !!TRACKS[name];
