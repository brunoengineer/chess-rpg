import { useStore } from './state/store';

/** Tiny synthesized sound effects: no audio files needed. */
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!useStore.getState().save.settings.sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, delay = 0, slideTo?: number) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.2, delay = 0, freq = 1200) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

export const sfx = {
  select: () => tone(660, 0.06, 'triangle', 0.08),
  move: () => { tone(220, 0.08, 'triangle', 0.12); noise(0.05, 0.08, 0, 2500); },
  capture: () => { noise(0.18, 0.25, 0, 1800); tone(180, 0.2, 'square', 0.06, 0, 90); },
  hit: () => { noise(0.3, 0.35, 0, 600); tone(110, 0.3, 'sawtooth', 0.1, 0, 50); },
  coin: () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.18, 'square', 0.05, 0.07); },
  promote: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, i * 0.07)),
  summon: () => tone(200, 0.4, 'sine', 0.12, 0, 600),
  warn: () => { tone(440, 0.15, 'square', 0.06); tone(440, 0.15, 'square', 0.06, 0.2); },
  boom: () => { noise(0.6, 0.4, 0, 400); tone(80, 0.5, 'sawtooth', 0.12, 0, 40); },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, i * 0.1)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'sine', 0.12, i * 0.15)),
  buy: () => { tone(784, 0.08, 'square', 0.05); tone(1175, 0.2, 'square', 0.05, 0.08); },
};
