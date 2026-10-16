/**
 * Tiny WebAudio synth for game sounds — no audio assets needed.
 * The AudioContext is created lazily and resumed on user gestures, so it
 * complies with browser autoplay policies.
 */

let ctx: AudioContext | null = null;
let muted =
  typeof localStorage !== 'undefined' && localStorage.getItem('bhabi-sound-muted') === '1';

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('bhabi-sound-muted', m ? '1' : '0');
  } catch {
    /* storage unavailable — session-only mute */
  }
}

/** Call from a user gesture (e.g. "Deal me in") so later sounds are allowed. */
export function unlockAudio(): void {
  if (!muted) ac();
}

function envelope(gain: GainNode, t: number, peak: number, dur: number): void {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/** Card snap: a short filtered noise burst, like a card hitting felt. */
export function playCardSound(): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const dur = 0.09;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2600;
  f.Q.value = 0.8;
  const g = c.createGain();
  envelope(g, t, 0.5, dur);
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start(t);
}

/** Soft UI click blip for toolbar buttons. */
export function clickSound(): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = 640;
  const g = c.createGain();
  envelope(g, t, 0.16, 0.07);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + 0.09);
}

/** Cheeky descending womp for a Thulla — part slide-whistle, part sad trombone. */
export function thullaSound(): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const glide = (
    type: OscillatorType,
    f0: number,
    f1: number,
    delay: number,
    dur: number,
    peak: number,
  ) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t + delay);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + delay + dur);
    const g = c.createGain();
    envelope(g, t + delay, peak, dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t + delay);
    o.stop(t + delay + dur + 0.05);
  };
  glide('sawtooth', 520, 160, 0, 0.45, 0.15);
  glide('sawtooth', 392, 110, 0.12, 0.5, 0.13);
  glide('sine', 1040, 320, 0, 0.3, 0.05);
}

/** Gentle two-note chime when your turn arrives. */
export function turnSound(): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const note = (freq: number, delay: number) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = c.createGain();
    envelope(g, t + delay, 0.13, 0.28);
    o.connect(g);
    g.connect(c.destination);
    o.start(t + delay);
    o.stop(t + delay + 0.32);
  };
  note(880, 0);
  note(1174.66, 0.09);
}
