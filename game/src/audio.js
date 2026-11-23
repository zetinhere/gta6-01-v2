// audio.js — every sound is synthesized with WebAudio: no audio files, no
// network. Engine hum, sirens, gunfire, coins and a lazy bassline, all
// guarded so a browser without audio still plays fine.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this.engine = null;
    this.musicTimer = 0;
    this.musicStep = 0;
  }
  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // Engine: a quiet sawtooth through a lowpass, pitched by speed.
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth'; osc.frequency.value = 55;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 320;
      const gain = this.ctx.createGain(); gain.gain.value = 0;
      osc.connect(filt); filt.connect(gain); gain.connect(this.ctx.destination);
      osc.start();
      this.engine = { osc, filt, gain };
    } catch (e) { this.ctx = null; }
  }
  setEngine(speed, inCar) {
    if (!this.ctx || !this.engine || this.muted) return;
    const target = inCar ? 0.05 + Math.min(0.06, Math.abs(speed) / 9000) : 0;
    this.engine.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engine.osc.frequency.setTargetAtTime(50 + Math.abs(speed) * 0.12, this.ctx.currentTime, 0.1);
  }
  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* silent */ }
  }
  noise(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = freq || 1200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filt); filt.connect(g); g.connect(this.ctx.destination);
      src.start(t);
    } catch (e) { /* silent */ }
  }
  sfx(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'shoot': this.noise(0.12, 0.2, 3000); this.blip(180, 0.08, 'square', 0.06, 60); break;
      case 'punch': this.noise(0.08, 0.12, 500); break;
      case 'pickup': this.blip(660, 0.09, 'sine', 0.09); setTimeout(() => this.blip(990, 0.12, 'sine', 0.09), 70); break;
      case 'cash': this.blip(880, 0.07, 'sine', 0.08); setTimeout(() => this.blip(1174, 0.07, 'sine', 0.08), 60); setTimeout(() => this.blip(1568, 0.12, 'sine', 0.08), 120); break;
      case 'crash': this.noise(0.25, 0.22, 900); break;
      case 'click': this.blip(1200, 0.04, 'sine', 0.05); break;
      case 'siren': this.blip(700, 0.4, 'sine', 0.04, 950); break;
      case 'mission': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.14, 'triangle', 0.09), i * 90)); break;
      case 'busted': [392, 311, 233].forEach((f, i) => setTimeout(() => this.blip(f, 0.2, 'sawtooth', 0.06), i * 140)); break;
      default: break;
    }
  }
  // A lazy A-minor bassline, stepped in update().
  musicTick(dt) {
    if (!this.ctx || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.24;
    const line = [110, 0, 130.8, 0, 98, 0, 130.8, 164.8, 110, 0, 130.8, 0, 98, 123.5, 146.8, 0];
    const f = line[this.musicStep % line.length];
    this.musicStep++;
    if (f) this.blip(f, 0.22, 'triangle', 0.045);
  }
}
