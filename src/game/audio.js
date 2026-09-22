/**
 * Tiny original procedural sound engine built on the Web Audio API.
 * Nothing is created until the player interacts with the page, so autoplay
 * policies are respected and no audio files are shipped.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.started = false;
  }

  get available() {
    return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
  }

  /** Must be called from a user gesture (click / key press / touch). */
  start() {
    if (this.started || !this.available) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.28 : 0;
      this.master.connect(this.ctx.destination);
      this.started = true;
    } catch {
      this.ctx = null;
      this.started = false;
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 0.28 : 0;
    if (enabled && this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  tone(frequency, duration, type = 'sine', gain = 0.6, detune = 0) {
    if (!this.started || !this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    osc.detune.setValueAtTime(detune, now);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  sequence(notes, type = 'triangle') {
    notes.forEach(([freq, delay, duration], index) => {
      setTimeout(() => this.tone(freq, duration, type, 0.5 - index * 0.03), delay * 1000);
    });
  }

  play(name) {
    switch (name) {
      case 'jump':
        this.tone(440, 0.16, 'triangle', 0.4);
        break;
      case 'doubleJump':
        this.tone(660, 0.16, 'triangle', 0.35);
        break;
      case 'coin':
        this.tone(988, 0.08, 'square', 0.25);
        setTimeout(() => this.tone(1319, 0.14, 'square', 0.22), 70);
        break;
      case 'stomp':
        this.tone(180, 0.18, 'sawtooth', 0.3);
        break;
      case 'checkpoint':
        this.sequence([
          [523, 0, 0.14],
          [659, 0.1, 0.14],
          [784, 0.2, 0.22]
        ]);
        break;
      case 'death':
        this.sequence([
          [392, 0, 0.16],
          [311, 0.12, 0.18],
          [233, 0.26, 0.3]
        ], 'sawtooth');
        break;
      case 'victory':
        this.sequence([
          [523, 0, 0.16],
          [659, 0.14, 0.16],
          [784, 0.28, 0.16],
          [1047, 0.42, 0.5]
        ]);
        break;
      default:
        break;
    }
  }
}
