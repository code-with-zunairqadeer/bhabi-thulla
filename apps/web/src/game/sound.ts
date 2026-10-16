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

/**
 * Warm and cheeky Thulla sting: a playful "whee!" up, then a wobbly,
 * warm "boing" down. Triangle/sine only — no harsh buzz.
 */
export function thullaSound(): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;

  // Cheeky rising "whee!"
  const whee = c.createOscillator();
  whee.type = 'triangle';
  whee.frequency.setValueAtTime(420, t);
  whee.frequency.exponentialRampToValueAtTime(940, t + 0.22);
  const wheeGain = c.createGain();
  envelope(wheeGain, t, 0.16, 0.26);
  whee.connect(wheeGain);
  wheeGain.connect(c.destination);
  whee.start(t);
  whee.stop(t + 0.3);

  // Warm wobbly "boing" down, with a gentle vibrato.
  const boing = c.createOscillator();
  boing.type = 'sine';
  boing.frequency.setValueAtTime(680, t + 0.16);
  boing.frequency.exponentialRampToValueAtTime(170, t + 0.78);
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 9;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 26;
  lfo.connect(lfoGain);
  lfoGain.connect(boing.frequency);
  const boingGain = c.createGain();
  envelope(boingGain, t + 0.16, 0.2, 0.66);
  boing.connect(boingGain);
  boingGain.connect(c.destination);
  boing.start(t + 0.16);
  boing.stop(t + 0.9);
  lfo.start(t + 0.16);
  lfo.stop(t + 0.9);
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
