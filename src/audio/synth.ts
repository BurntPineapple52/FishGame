// Tiny WebAudio synth for UI blips, chimes, jingles and creature noises, so the
// game gets lots of feedback sounds without shipping more audio files.

import { save } from '../save';
import { audio } from './Audio';

type Wave = OscillatorType;

function out(): { ctx: AudioContext; dest: AudioNode } | null {
  const ctx = audio.context;
  const dest = audio.destination;
  if (!ctx || !dest || ctx.state !== 'running') return null;
  return { ctx, dest };
}

function tone(
  freq: number,
  dur: number,
  opts: { type?: Wave; vol?: number; slideTo?: number; delay?: number; attack?: number } = {},
): void {
  const o = out();
  if (!o) return;
  const { ctx, dest } = o;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const vol = (opts.vol ?? 0.2) * save.data.settings.sfx;
  if (vol <= 0) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? 'triangle';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const attack = opts.attack ?? 0.005;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;

function noise(
  dur: number,
  opts: { vol?: number; freq?: number; sweepTo?: number; q?: number; type?: BiquadFilterType; delay?: number } = {},
): void {
  const o = out();
  if (!o) return;
  const { ctx, dest } = o;
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const vol = (opts.vol ?? 0.2) * save.data.settings.sfx;
  if (vol <= 0) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.type ?? 'bandpass';
  filter.Q.value = opts.q ?? 1;
  filter.frequency.setValueAtTime(opts.freq ?? 1000, t0);
  if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const synth = {
  /** Menu cursor move. */
  select(): void {
    tone(660, 0.07, { type: 'square', vol: 0.05, slideTo: 880 });
  },
  confirm(): void {
    tone(660, 0.08, { type: 'square', vol: 0.06 });
    tone(990, 0.12, { type: 'square', vol: 0.06, delay: 0.06 });
  },
  back(): void {
    tone(520, 0.1, { type: 'square', vol: 0.05, slideTo: 330 });
  },
  /** Typewriter tick for title cards. */
  type(): void {
    tone(1100 + Math.random() * 300, 0.025, { type: 'square', vol: 0.025 });
  },
  pop(): void {
    tone(300, 0.08, { type: 'sine', vol: 0.18, slideTo: 900 });
  },
  /** Checkpoint reached. */
  chime(): void {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.12, delay: i * 0.07 }));
  },
  /** Golden roe. */
  jingle(): void {
    [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.3, { type: 'sine', vol: 0.14, delay: i * 0.055 }));
    noise(0.5, { vol: 0.05, freq: 7000, type: 'highpass', delay: 0.15 });
  },
  /** Results-screen star `n` (0-based). */
  star(n: number): void {
    tone(880 * (1 + n * 0.26), 0.25, { type: 'triangle', vol: 0.14 });
    tone(1760 * (1 + n * 0.26), 0.2, { type: 'sine', vol: 0.06, delay: 0.03 });
  },
  /** A soft bell note (title keycaps). */
  note(freq: number): void {
    tone(freq, 0.4, { type: 'triangle', vol: 0.12 });
    tone(freq * 2, 0.25, { type: 'sine', vol: 0.04 });
  },
  fanfare(): void {
    [523, 659, 784].forEach((f, i) => tone(f, 0.16, { type: 'square', vol: 0.07, delay: i * 0.11 }));
    [523, 659, 784, 1047].forEach((f) => tone(f, 0.9, { type: 'triangle', vol: 0.07, delay: 0.36, attack: 0.02 }));
  },
  deathSting(): void {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, { type: 'square', vol: 0.06, delay: i * 0.13 }));
  },
  /** Bear wind-up. */
  growl(): void {
    tone(85, 0.7, { type: 'sawtooth', vol: 0.16, slideTo: 50, attack: 0.08 });
    noise(0.7, { vol: 0.2, freq: 260, sweepTo: 160, type: 'lowpass', q: 3 });
  },
  heartbeat(): void {
    tone(70, 0.14, { type: 'sine', vol: 0.35, slideTo: 40 });
    tone(62, 0.16, { type: 'sine', vol: 0.25, slideTo: 38, delay: 0.18 });
  },
  whoosh(dur = 0.4, vol = 0.12): void {
    noise(dur, { vol, freq: 400, sweepTo: 2600, q: 0.8 });
  },
  thud(vol = 0.3): void {
    tone(130, 0.16, { type: 'sine', vol, slideTo: 45 });
  },
  /** Gasping for water. */
  gasp(): void {
    noise(0.22, { vol: 0.07, freq: 1800, sweepTo: 900, q: 2 });
  },
  wriggle(): void {
    tone(500 + Math.random() * 400, 0.05, { type: 'square', vol: 0.05 });
  },
  rumble(dur = 1.2): void {
    noise(dur, { vol: 0.25, freq: 120, sweepTo: 60, type: 'lowpass', q: 1 });
  },
};
