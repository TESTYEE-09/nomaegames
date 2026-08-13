// Procedural audio engine — every sound is synthesized, zero assets.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.ready = false;
    this.musicOn = true;
    this._noiseBuf = null;
    this._nextNote = 0;
    this._step = 0;
    this._intensity = 0;
    this._musicTimer = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const ctx = new AC();
    this.ctx = ctx;

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 24;
    this.comp.ratio.value = 8;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.22;

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 1.0;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.0;

    // Cheap stereo "space": two feedback delays.
    this.verb = ctx.createGain();
    this.verb.gain.value = 0.24;
    const dL = ctx.createDelay(1.0), dR = ctx.createDelay(1.0);
    dL.delayTime.value = 0.083; dR.delayTime.value = 0.117;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const merger = ctx.createChannelMerger(2);
    this.verb.connect(dL); this.verb.connect(dR);
    dL.connect(lp); dR.connect(lp);
    lp.connect(fb); fb.connect(dL); fb.connect(dR);
    dL.connect(merger, 0, 0); dR.connect(merger, 0, 1);
    merger.connect(this.master);

    this.sfxBus.connect(this.comp);
    this.musicBus.connect(this.comp);
    this.comp.connect(this.master);
    this.master.connect(ctx.destination);

    // White noise source buffer, reused everywhere.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;

    this.ready = true;
    this._nextNote = ctx.currentTime + 0.1;
    this._musicTimer = setInterval(() => this._scheduleMusic(), 60);
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMuted(m) {
    this.enabled = !m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }
  setIntensity(v) { this._intensity = clamp(v, 0, 1); }
  setMusic(on) {
    this.musicOn = on;
    if (this.ctx && this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.3);
  }

  _now() { return this.ctx.currentTime; }

  _noise(dest, t, dur, gain, type = 'bandpass', f0 = 1200, f1 = 200, q = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filt = ctx.createBiquadFilter();
    filt.type = type; filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(dest);
    src.start(t); src.stop(t + dur + 0.05);
    return g;
  }

  _tone(dest, t, dur, gain, f0, f1, type = 'sine') {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    return g;
  }

  // --- SFX ------------------------------------------------------------
  shoot(kind) {
    if (!this.ready || !this.enabled) return;
    const t = this._now(), B = this.sfxBus;
    if (kind === 'pulse') {
      this._tone(B, t, 0.13, 0.30, 900, 120, 'square');
      this._tone(B, t, 0.09, 0.20, 240, 60, 'sawtooth');
      this._noise(B, t, 0.09, 0.22, 'highpass', 2800, 900);
      this._noise(this.verb, t, 0.18, 0.06, 'bandpass', 1800, 500);
    } else if (kind === 'scatter') {
      this._tone(B, t, 0.26, 0.34, 320, 45, 'square');
      this._noise(B, t, 0.24, 0.42, 'lowpass', 3200, 260, 0.8);
      this._noise(B, t, 0.06, 0.30, 'highpass', 5200, 2200);
      this._noise(this.verb, t, 0.4, 0.12, 'bandpass', 900, 260);
    } else if (kind === 'rail') {
      this._tone(B, t, 0.5, 0.28, 1800, 90, 'sawtooth');
      this._tone(B, t, 0.42, 0.18, 3600, 200, 'sine');
      this._noise(B, t, 0.35, 0.22, 'bandpass', 5200, 400, 3);
      this._noise(this.verb, t, 0.7, 0.16, 'bandpass', 2400, 300, 2);
    }
  }

  charge(dur) {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    this._tone(this.sfxBus, t, dur, 0.10, 180, 1500, 'triangle');
  }

  hit(head) {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    this._noise(this.sfxBus, t, head ? 0.10 : 0.055, head ? 0.34 : 0.20, 'bandpass', head ? 3200 : 1500, 400, 1.6);
    this._tone(this.sfxBus, t, 0.05, head ? 0.26 : 0.14, head ? 1400 : 700, 200, 'square');
  }

  kill() {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    this._tone(this.sfxBus, t, 0.30, 0.26, 520, 70, 'sawtooth');
    this._noise(this.sfxBus, t, 0.30, 0.28, 'lowpass', 2600, 180);
    this._noise(this.verb, t, 0.5, 0.10, 'bandpass', 1200, 220);
  }

  explode() {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    this._noise(this.sfxBus, t, 0.55, 0.5, 'lowpass', 1800, 60, 0.7);
    this._tone(this.sfxBus, t, 0.45, 0.34, 160, 32, 'sine');
    this._noise(this.verb, t, 0.9, 0.18, 'bandpass', 700, 140);
  }

  dash() {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    this._noise(this.sfxBus, t, 0.28, 0.22, 'bandpass', 600, 3800, 1.2);
    this._tone(this.sfxBus, t, 0.2, 0.12, 220, 620, 'triangle');
  }

  jump() {
    if (!this.ready || !this.enabled) return;
    this._tone(this.sfxBus, this._now(), 0.13, 0.10, 320, 620, 'triangle');
  }

  land(force) {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    this._noise(this.sfxBus, t, 0.12, 0.10 + force * 0.2, 'lowpass', 900, 120);
    this._tone(this.sfxBus, t, 0.1, 0.08 + force * 0.1, 120, 50, 'sine');
  }

  reload(stage) {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    if (stage === 0) { this._noise(this.sfxBus, t, 0.07, 0.16, 'bandpass', 2400, 900, 2); this._tone(this.sfxBus, t, 0.05, 0.08, 420, 200, 'square'); }
    else { this._noise(this.sfxBus, t, 0.09, 0.2, 'bandpass', 1600, 500, 1.4); this._tone(this.sfxBus, t, 0.07, 0.12, 260, 130, 'square'); }
  }

  empty() {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    this._noise(this.sfxBus, t, 0.05, 0.14, 'bandpass', 3000, 1400, 4);
  }

  hurt() {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    this._tone(this.sfxBus, t, 0.3, 0.26, 240, 60, 'sawtooth');
    this._noise(this.sfxBus, t, 0.2, 0.2, 'lowpass', 900, 160);
  }

  enemyShoot() {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    this._tone(this.sfxBus, t, 0.22, 0.12, 620, 160, 'sawtooth');
    this._noise(this.verb, t, 0.3, 0.05, 'bandpass', 1400, 400);
  }

  pickup() {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    this._tone(this.sfxBus, t, 0.12, 0.16, 880, 1320, 'sine');
    this._tone(this.sfxBus, t + 0.08, 0.14, 0.14, 1320, 1760, 'sine');
  }

  ui(up) {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    this._tone(this.sfxBus, t, 0.08, 0.12, up ? 700 : 500, up ? 1100 : 340, 'square');
  }

  spawnPortal() {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    this._tone(this.sfxBus, t, 0.7, 0.12, 90, 420, 'sawtooth');
    this._noise(this.verb, t, 0.9, 0.12, 'bandpass', 400, 1800, 2);
  }

  waveStart(n) {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    const base = 220 * Math.pow(2, ((n - 1) % 5) / 12);
    [0, 0.13, 0.26].forEach((o, i) => {
      this._tone(this.sfxBus, t + o, 0.5, 0.2, base * (1 + i * 0.5), base * (1 + i * 0.5), 'square');
      this._tone(this.verb, t + o, 0.9, 0.1, base * (1 + i * 0.5), base * (1 + i * 0.5), 'sine');
    });
  }

  gameOver() {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    this._tone(this.sfxBus, t, 1.6, 0.3, 440, 55, 'sawtooth');
    this._tone(this.sfxBus, t + 0.1, 1.5, 0.2, 330, 41, 'square');
    this._noise(this.verb, t, 2.0, 0.14, 'lowpass', 1600, 100);
  }

  levelUp() {
    if (!this.ready || !this.enabled) return;
    const t = this._now();
    [523, 659, 784, 1047].forEach((f, i) => this._tone(this.sfxBus, t + i * 0.07, 0.35, 0.16, f, f, 'triangle'));
  }

  // --- Music: 16-step synthwave loop that thickens with intensity -----
  _scheduleMusic() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const bpm = 128 + this._intensity * 22;
    const spb = 60 / bpm / 2; // eighth notes
    while (this._nextNote < ctx.currentTime + 0.35) {
      this._playStep(this._nextNote, this._step);
      this._nextNote += spb;
      this._step = (this._step + 1) % 32;
    }
  }

  _playStep(t, s) {
    const I = this._intensity;
    const B = this.musicBus;
    const root = 55; // A1
    const prog = [0, 0, 5, 5, 3, 3, 7, 7][Math.floor(s / 4)];
    const f = root * Math.pow(2, prog / 12);

    // Bass pulse on every eighth
    const g = this._tone(B, t, 0.16, 0.34, f, f, 'sawtooth');
    void g;

    // Kick
    if (s % 4 === 0) {
      this._tone(B, t, 0.22, 0.5, 150, 42, 'sine');
      this._noise(B, t, 0.03, 0.16, 'lowpass', 1800, 400);
    }
    // Hat
    if (I > 0.15 && s % 2 === 1) this._noise(B, t, 0.04, 0.05 + I * 0.06, 'highpass', 8000, 6000);
    // Snare
    if (I > 0.3 && s % 8 === 4) this._noise(B, t, 0.14, 0.14 + I * 0.1, 'bandpass', 2200, 700, 0.8);
    // Arp
    if (I > 0.45) {
      const scale = [0, 3, 5, 7, 10, 12, 15, 12];
      const n = scale[s % 8];
      const af = f * 8 * Math.pow(2, n / 12);
      this._tone(B, t, 0.13, 0.07 + I * 0.05, af, af, 'square');
      if (I > 0.75) this._tone(this.verb, t, 0.3, 0.05, af * 2, af * 2, 'triangle');
    }
  }
}
