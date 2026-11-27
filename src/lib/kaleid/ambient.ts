const CHORDS: number[][] = [
  [73.42, 110.0, 146.83, 220.0, 329.63],
  [87.31, 130.81, 174.61, 246.94, 349.23],
  [98.0, 146.83, 196.0, 293.66, 392.0],
  [82.41, 123.47, 164.81, 246.94, 329.63],
];

const SHIMMER = [523.25, 587.33, 659.25, 783.99, 880.0, 987.77];
const MASTER = 0.42;
const CHORD_SECS = 18;
const GLIDE_SECS = 7;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function curve(v: number) {
  return MASTER * Math.pow(clamp01(v), 1.28);
}

function brownNoise(ctx: AudioContext, seconds = 2.5) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
  }
  return buffer;
}

class AmbientPad {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: OscillatorNode[] = [];
  private voiceGains: GainNode[] = [];
  private filter: BiquadFilterNode | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private lfo: OscillatorNode | null = null;
  private volume = 0.34;
  private chord = 0;
  private chordTimer = 0;
  private sparkleTimer = 0;
  private sparkleIdx = 0;
  private built = false;
  private looping = false;
  private wanted = false;
  private listeners = new Set<(playing: boolean) => void>();

  setVolume(v: number) {
    this.volume = clamp01(v);
    this.applyGain();
  }

  subscribe(fn: (playing: boolean) => void) {
    this.listeners.add(fn);
    fn(this.isPlaying());
    return () => {
      this.listeners.delete(fn);
    };
  }

  isPlaying() {
    return this.wanted && this.ctx?.state === "running";
  }

  async start() {
    if (typeof window === "undefined") return;
    this.wanted = true;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.ctx.addEventListener("statechange", () => this.emit());
    }
    if (!this.built) this.build();
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        this.emit();
        return;
      }
    }
    this.applyGain(true);
    if (!this.looping) {
      this.looping = true;
      this.queueChord();
      this.queueSparkle();
    }
    this.emit();
  }

  async stop() {
    this.wanted = false;
    this.looping = false;
    window.clearTimeout(this.chordTimer);
    window.clearTimeout(this.sparkleTimer);
    const ctx = this.ctx;
    if (ctx && this.master) {
      const t = ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(0, t, 0.05);
      try {
        await ctx.suspend();
      } catch {
        /* ignore */
      }
    }
    this.emit();
  }

  private emit() {
    const playing = this.isPlaying();
    this.listeners.forEach((fn) => fn(playing));
  }

  private build() {
    const ctx = this.ctx;
    if (!ctx || this.built) return;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 720;
    filter.Q.value = 0.55;
    filter.connect(master);
    this.filter = filter;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 280;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.lfo = lfo;
    const pans = [-0.62, -0.28, 0.04, 0.32, 0.66];
    const types: OscillatorType[] = ["sine", "sine", "triangle", "sine", "sine"];
    const gains = [0.22, 0.16, 0.09, 0.11, 0.07];
    const chord = CHORDS[0] ?? [];
    for (let i = 0; i < 5; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const pan = ctx.createStereoPanner();
      osc.type = types[i] ?? "sine";
      osc.frequency.value = chord[i] ?? 110;
      osc.detune.value = (i - 2) * 4;
      g.gain.value = gains[i] ?? 0.1;
      pan.pan.value = pans[i] ?? 0;
      osc.connect(g);
      g.connect(pan);
      pan.connect(filter);
      osc.start();
      this.voices.push(osc);
      this.voiceGains.push(g);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = brownNoise(ctx);
    noise.loop = true;
    const ng = ctx.createGain();
    ng.gain.value = 0.045;
    const nf = ctx.createBiquadFilter();
    nf.type = "lowpass";
    nf.frequency.value = 280;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(master);
    noise.start();
    this.noise = noise;
    this.built = true;
  }

  private applyGain(fadeIn = false) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const target = curve(this.volume);
    this.master.gain.cancelScheduledValues(t);
    if (fadeIn) {
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(target, t + 1.6);
    } else {
      this.master.gain.setTargetAtTime(target, t, 0.08);
    }
  }

  private queueChord() {
    window.clearTimeout(this.chordTimer);
    this.chordTimer = window.setTimeout(() => {
      if (this.ctx?.state === "running") this.advanceChord();
      if (this.looping) this.queueChord();
    }, CHORD_SECS * 1000);
  }

  private advanceChord() {
    if (!this.ctx) return;
    this.chord = (this.chord + 1) % CHORDS.length;
    const chord = CHORDS[this.chord] ?? CHORDS[0];
    if (!chord) return;
    const t = this.ctx.currentTime;
    this.voices.forEach((osc, i) => {
      const freq = chord[i] ?? chord[0] ?? 110;
      osc.frequency.cancelScheduledValues(t);
      osc.frequency.setValueAtTime(osc.frequency.value, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq), t + GLIDE_SECS);
    });
  }

  private queueSparkle() {
    window.clearTimeout(this.sparkleTimer);
    const wait = 2600 + Math.random() * 3200;
    this.sparkleTimer = window.setTimeout(() => {
      if (this.ctx?.state === "running") this.pluck();
      if (this.looping) this.queueSparkle();
    }, wait);
  }

  private pluck() {
    const ctx = this.ctx;
    const dest = this.master;
    if (!ctx || !dest || ctx.state !== "running") return;
    const freq = SHIMMER[this.sparkleIdx % SHIMMER.length] ?? 659.25;
    this.sparkleIdx += 1 + (Math.random() < 0.25 ? 1 : 0);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner();
    osc.type = "sine";
    osc.frequency.value = freq * (Math.random() < 0.2 ? 0.5 : 1);
    pan.pan.value = Math.random() * 1.2 - 0.6;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.4);
    osc.connect(g);
    g.connect(pan);
    pan.connect(dest);
    osc.start(t);
    osc.stop(t + 3.6);
  }
}

let pad: AmbientPad | null = null;

export function getAmbient(): AmbientPad {
  if (!pad) pad = new AmbientPad();
  return pad;
}
