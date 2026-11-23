// Santa Brisa Rush — sound: everything is synthesized with WebAudio, no audio
// files. Engine hum, siren, gunshot, punch, pickup blip, jingles. Mute with M.
// The audio context only starts after a user gesture; headless runs stay silent.

export function makeSynth() {
  const s = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    muted: false,
    sirenTimer: 0,
  };

  function ensure() {
    if (s.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      s.ctx = new AC();
      s.master = s.ctx.createGain();
      s.master.gain.value = 0.35;
      s.master.connect(s.ctx.destination);
      s.engineOsc = s.ctx.createOscillator();
      s.engineOsc.type = 'sawtooth';
      s.engineOsc.frequency.value = 60;
      s.engineGain = s.ctx.createGain();
      s.engineGain.gain.value = 0;
      const filt = s.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      s.engineOsc.connect(filt);
      filt.connect(s.engineGain);
      s.engineGain.connect(s.master);
      s.engineOsc.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || s.muted) return;
    try {
      const t = s.ctx.currentTime;
      const o = s.ctx.createOscillator();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const g = s.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(s.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* silent */ }
  }

  function noiseBurst(dur, vol) {
    if (!ensure() || s.muted) return;
    try {
      const t = s.ctx.currentTime;
      const len = Math.floor(s.ctx.sampleRate * dur);
      const buf = s.ctx.createBuffer(1, len, s.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = s.ctx.createBufferSource();
      src.buffer = buf;
      const g = s.ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(g);
      g.connect(s.master);
      src.start(t);
    } catch (e) { /* silent */ }
  }

  s.unlock = ensure;
  s.toggleMute = () => {
    s.muted = !s.muted;
    if (s.master) s.master.gain.value = s.muted ? 0 : 0.35;
    return s.muted;
  };
  s.engine = (ratio) => {
    if (!ensure() || s.muted) return;
    try {
      s.engineOsc.frequency.value = 55 + ratio * 190;
      s.engineGain.gain.value = 0.05 + ratio * 0.06;
    } catch (e) { /* silent */ }
  };
  s.engineOff = () => {
    if (s.engineGain) s.engineGain.gain.value = 0;
  };
  s.shot = () => noiseBurst(0.14, 0.4);
  s.punch = () => noiseBurst(0.09, 0.25);
  s.bump = () => noiseBurst(0.12, 0.3);
  s.door = () => blip(220, 0.12, 'square', 0.18, 130);
  s.pickup = () => { blip(660, 0.1, 'sine', 0.22); setTimeout(() => blip(880, 0.14, 'sine', 0.22), 90); };
  s.jingle = () => {
    blip(523, 0.12, 'triangle', 0.22);
    setTimeout(() => blip(659, 0.12, 'triangle', 0.22), 110);
    setTimeout(() => blip(784, 0.2, 'triangle', 0.22), 220);
  };
  s.paid = () => {
    blip(784, 0.1, 'sine', 0.25);
    setTimeout(() => blip(1046, 0.22, 'sine', 0.25), 100);
  };
  s.siren = () => {
    if (!ensure() || s.muted) return;
    try {
      const t = s.ctx.currentTime;
      const o = s.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(700, t);
      o.frequency.linearRampToValueAtTime(1100, t + 0.5);
      o.frequency.linearRampToValueAtTime(700, t + 1.0);
      const g = s.ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
      o.connect(g);
      g.connect(s.master);
      o.start(t);
      o.stop(t + 1.05);
    } catch (e) { /* silent */ }
  };
  s.allClear = () => blip(440, 0.25, 'sine', 0.18, 330);

  return s;
}
