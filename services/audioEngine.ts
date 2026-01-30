
import { ChordDefinition, RhythmPattern, DelayDivision, WaveformType } from '../types';

interface ActiveOscillator {
  osc: OscillatorNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  lfo?: OscillatorNode;
  lfoGain?: GainNode;
}

class AudioEngine {
  public ctx: AudioContext | null = null;
  private initPromise: Promise<void> | null = null;
  
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  
  private chordSource: GainNode | null = null;
  private harpSource: GainNode | null = null;
  private rhythmSource: GainNode | null = null;
  private bassSource: GainNode | null = null;
  private rhythmFilterBus: BiquadFilterNode | null = null;

  private masterTubeIn: GainNode | null = null;
  private masterTubeDry: GainNode | null = null;
  private masterTubeWet: GainNode | null = null;
  private masterTubeAmp: WaveShaperNode | null = null;
  private masterTubeOut: GainNode | null = null;

  private chordDry: GainNode | null = null;
  private chordDelaySend: GainNode | null = null;
  private chordReverbSend: GainNode | null = null;
  
  private harpDry: GainNode | null = null;
  private harpDelaySend: GainNode | null = null;
  private harpReverbSend: GainNode | null = null;
  
  private rhythmDry: GainNode | null = null;
  private rhythmDelaySend: GainNode | null = null;
  private rhythmReverbSend: GainNode | null = null;

  private delayNodeL: DelayNode | null = null;
  private delayNodeR: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayFilter: BiquadFilterNode | null = null;
  private delayOutput: GainNode | null = null;
  private delayMerger: ChannelMergerNode | null = null;

  private reverbNodes: DelayNode[] = [];
  private reverbGains: GainNode[] = [];
  private reverbFilter: BiquadFilterNode | null = null;
  private reverbPanner: StereoPannerNode | null = null;
  private reverbOutput: GainNode | null = null;

  private chordOscillators: ActiveOscillator[] = [];
  private bassOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];
  
  private activeBassGainSine: GainNode | null = null;
  private activeBassGainSaw: GainNode | null = null;
  
  private sustainValue: number = 0.5;
  private chordAttack: number = 0.01;
  private chordRelease: number = 0.2;
  private tempo: number = 120;
  private rhythmInterval: number | null = null;
  private octaveShift: number = 0;
  private harpOctaveShift: number = 0;
  private chordCutoff: number = 0.5;
  private harpCutoff: number = 0.8;
  private rhythmCutoff: number = 1.0;
  private bassEnabled: boolean = false;
  private bassWaveformMix: number = 0;

  private chordWaveform: WaveformType = 'square';
  private harpWaveform: WaveformType = 'triangle';
  private vibratoAmount: number = 0;
  private vibratoRate: number = 5;

  private audioOpened: boolean = false;

  private safeTarget(param: AudioParam | undefined, value: number, time?: number, ramp?: number) {
    if (!param || !this.ctx) return;
    const now = this.ctx.currentTime;
    const startTime = time ?? now;
    const rampTime = ramp ?? 0.05;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, startTime, rampTime);
  }

  private makeDistortionCurve(amount: number) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const drive = 1 + amount * 6; 
    const asymmetry = amount * 0.15; 
    
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      const sa = (x * drive) + asymmetry;
      curve[i] = Math.tanh(sa);
    }
    return curve;
  }

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.ctx = ctx;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;

      const compressor = ctx.createDynamicsCompressor();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, now);

      const masterTubeIn = ctx.createGain();
      const masterTubeDry = ctx.createGain();
      const masterTubeWet = ctx.createGain();
      const masterTubeAmp = ctx.createWaveShaper();
      const masterTubeOut = ctx.createGain();
      
      masterTubeAmp.curve = this.makeDistortionCurve(0.1);
      masterTubeDry.gain.setValueAtTime(1, now);
      masterTubeWet.gain.setValueAtTime(0, now);

      const chordSource = ctx.createGain();
      const harpSource = ctx.createGain();
      const rhythmSource = ctx.createGain();
      const bassSource = ctx.createGain();
      
      const rhythmFilterBus = ctx.createBiquadFilter();
      rhythmFilterBus.type = 'lowpass';
      rhythmFilterBus.frequency.setValueAtTime(20000, now);

      const chordDry = ctx.createGain();
      const chordDelaySend = ctx.createGain();
      const chordReverbSend = ctx.createGain();
      const harpDry = ctx.createGain();
      const harpDelaySend = ctx.createGain();
      const harpReverbSend = ctx.createGain();
      const rhythmDry = ctx.createGain();
      const rhythmDelaySend = ctx.createGain();
      const rhythmReverbSend = ctx.createGain();

      const delayNodeL = ctx.createDelay(4.0);
      const delayNodeR = ctx.createDelay(4.0);
      const delayFeedback = ctx.createGain();
      const delayFilter = ctx.createBiquadFilter();
      const delayMerger = ctx.createChannelMerger(2);
      const delayOutput = ctx.createGain();
      
      delayFeedback.gain.setValueAtTime(0.4, now);
      delayFilter.type = 'lowpass';
      delayFilter.frequency.setValueAtTime(5000, now);

      const reverbFilter = ctx.createBiquadFilter();
      const reverbPanner = ctx.createStereoPanner();
      const reverbOutput = ctx.createGain();
      reverbFilter.type = 'lowpass';
      reverbFilter.frequency.setValueAtTime(10000, now);

      rhythmSource.connect(rhythmFilterBus);
      chordSource.connect(chordDry);
      chordSource.connect(chordDelaySend);
      chordSource.connect(chordReverbSend);
      harpSource.connect(harpDry);
      harpSource.connect(harpDelaySend);
      harpSource.connect(harpReverbSend);
      rhythmFilterBus.connect(rhythmDry);
      rhythmFilterBus.connect(rhythmDelaySend);
      rhythmFilterBus.connect(rhythmReverbSend);

      [chordDelaySend, harpDelaySend, rhythmDelaySend].forEach(s => s.connect(delayFilter));
      delayFilter.connect(delayNodeL);
      delayFilter.connect(delayNodeR);
      delayNodeL.connect(delayFeedback);
      delayNodeR.connect(delayFeedback);
      delayFeedback.connect(delayFilter);
      delayNodeL.connect(delayMerger, 0, 0);
      delayNodeR.connect(delayMerger, 0, 1);
      delayMerger.connect(delayOutput);
      delayOutput.connect(masterGain);

      const times = [0.033, 0.037, 0.041, 0.043, 0.047, 0.051, 0.059, 0.067];
      times.forEach(t => {
        const d = ctx.createDelay(1.0);
        d.delayTime.value = t;
        const g = ctx.createGain();
        g.gain.value = 0.7;
        [chordReverbSend, harpReverbSend, rhythmReverbSend].forEach(s => s.connect(d));
        d.connect(g);
        g.connect(d); 
        g.connect(reverbFilter);
        this.reverbNodes.push(d);
        this.reverbGains.push(g);
      });
      reverbFilter.connect(reverbPanner);
      reverbPanner.connect(reverbOutput);
      reverbOutput.connect(masterGain);

      [chordDry, harpDry, rhythmDry, bassSource].forEach(n => n.connect(masterGain));
      masterGain.connect(masterTubeIn);
      masterTubeIn.connect(masterTubeDry);
      masterTubeIn.connect(masterTubeAmp);
      masterTubeAmp.connect(masterTubeWet);
      masterTubeDry.connect(masterTubeOut);
      masterTubeWet.connect(masterTubeOut);
      masterTubeOut.connect(compressor);
      compressor.connect(ctx.destination);

      this.masterGain = masterGain;
      this.compressor = compressor;
      this.masterTubeIn = masterTubeIn;
      this.masterTubeDry = masterTubeDry;
      this.masterTubeWet = masterTubeWet;
      this.masterTubeAmp = masterTubeAmp;
      this.masterTubeOut = masterTubeOut;
      this.chordSource = chordSource;
      this.harpSource = harpSource;
      this.rhythmSource = rhythmSource;
      this.bassSource = bassSource;
      this.rhythmFilterBus = rhythmFilterBus;
      this.chordDry = chordDry;
      this.chordDelaySend = chordDelaySend;
      this.chordReverbSend = chordReverbSend;
      this.harpDry = harpDry;
      this.harpDelaySend = harpDelaySend;
      this.harpReverbSend = harpReverbSend;
      this.rhythmDry = rhythmDry;
      this.rhythmDelaySend = rhythmDelaySend;
      this.rhythmReverbSend = rhythmReverbSend;
      this.delayNodeL = delayNodeL;
      this.delayNodeR = delayNodeR;
      this.delayFeedback = delayFeedback;
      this.delayFilter = delayFilter;
      this.delayOutput = delayOutput;
      this.delayMerger = delayMerger;
      this.reverbFilter = reverbFilter;
      this.reverbPanner = reverbPanner;
      this.reverbOutput = reverbOutput;
      
      if (ctx.state === 'running') {
        this.safeTarget(this.masterGain.gain, 1.0, ctx.currentTime, 0.1);
        this.audioOpened = true;
      }
    })();

    return this.initPromise;
  }

  private async ensureAudioOpened() {
    if (!this.ctx) await this.init();
    if (!this.ctx) return;
    if (!this.audioOpened) {
      if (this.ctx.state !== 'running') await this.ctx.resume();
      this.safeTarget(this.masterGain?.gain, 1, this.ctx.currentTime, 0.1);
      this.audioOpened = true;
    }
  }

  setChordVolume(v: number) { this.safeTarget(this.chordSource?.gain, v * 0.4); }
  setHarpVolume(v: number) { this.safeTarget(this.harpSource?.gain, v * 0.8); }
  setRhythmVolume(v: number) { this.safeTarget(this.rhythmSource?.gain, v * 3.0); }
  setBassVolume(v: number) { this.safeTarget(this.bassSource?.gain, v * 2.0); }
  
  setSustain(v: number) { this.sustainValue = v; }
  setChordAttack(v: number) { this.chordAttack = Math.max(0.001, v); }
  setChordRelease(v: number) { this.chordRelease = Math.max(0.01, v); }
  setTempo(v: number) { this.tempo = v; }
  setOctave(v: number) { this.octaveShift = v; }
  setHarpOctave(v: number) { this.harpOctaveShift = v; }
  setChordCutoff(v: number) {
    this.chordCutoff = v;
    const freq = 100 + (v * 5000);
    this.chordOscillators.forEach(({ filter }) => this.safeTarget(filter.frequency, freq, undefined, 0.1));
  }
  setHarpCutoff(v: number) { this.harpCutoff = v; }
  setRhythmCutoff(v: number) {
    this.rhythmCutoff = v;
    const freq = 100 + (v * 19000);
    this.safeTarget(this.rhythmFilterBus?.frequency, freq, undefined, 0.1);
  }
  setBassEnabled(v: boolean) { this.bassEnabled = v; }
  setBassWaveformMix(v: number) { 
    this.bassWaveformMix = v; 
    this.safeTarget(this.activeBassGainSine?.gain, 0.7 * (1 - v));
    this.safeTarget(this.activeBassGainSaw?.gain, 0.4 * v);
  }
  setTubeAmp(enabled: boolean, drive: number, wet: number) {
    if (!this.masterTubeDry || !this.masterTubeWet || !this.masterTubeAmp) return;
    this.safeTarget(this.masterTubeDry.gain, enabled ? 1 - wet : 1);
    this.safeTarget(this.masterTubeWet.gain, enabled ? wet : 0);
    this.masterTubeAmp.curve = this.makeDistortionCurve(drive);
  }
  setChordWaveform(v: WaveformType) { this.chordWaveform = v; }
  setHarpWaveform(v: WaveformType) { this.harpWaveform = v; }
  
  setVibrato(amt: number, rate: number) { 
    this.vibratoAmount = amt; 
    this.vibratoRate = rate; 
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    this.chordOscillators.forEach(active => {
      if (amt > 0) {
        if (!active.lfo || !active.lfoGain) {
          active.lfo = this.ctx!.createOscillator();
          active.lfoGain = this.ctx!.createGain();
          active.lfo.connect(active.lfoGain);
          active.lfoGain.connect(active.osc.frequency);
          active.lfo.start(now);
        }
        this.safeTarget(active.lfo.frequency, rate);
        this.safeTarget(active.lfoGain.gain, amt * 25);
      } else {
        if (active.lfoGain) this.safeTarget(active.lfoGain.gain, 0);
      }
    });
  }

  updateDelay(div: DelayDivision, fb: number, tone: number, spread: number) {
    if (!this.delayNodeL || !this.delayNodeR || !this.delayFeedback || !this.delayFilter) return;
    const beatTime = 60 / this.tempo;
    const divisions: Record<string, number> = {
      '1/2': 2.0, '1/4': 1.0, '1/4D': 1.5, '1/8': 0.5, '1/8D': 0.75,
      '5/16': 0.625, '5/8': 2.5, '7/8': 3.5, '1/4T': 0.666, '1/8T': 0.333, '1/16T': 0.166
    };
    const time = beatTime * (divisions[div] || 0.5);
    this.safeTarget(this.delayNodeL.delayTime, time);
    this.safeTarget(this.delayNodeR.delayTime, time * (1 + spread * 0.1));
    this.safeTarget(this.delayFeedback.gain, fb * 0.9);
    this.safeTarget(this.delayFilter.frequency, 100 + (tone * 14000));
  }

  updateReverb(size: number, damp: number, width: number, color: number) {
    if (!this.reverbFilter) return;
    this.reverbGains.forEach(g => this.safeTarget(g.gain, 0.3 + size * 0.65));
    this.safeTarget(this.reverbFilter.frequency, 200 + (1 - damp) * 19000);
    if (this.reverbPanner) this.safeTarget(this.reverbPanner.pan, (width - 0.5) * 2);
  }

  setSends(s: { chordDelay: number, chordReverb: number, harpDelay: number, harpReverb: number, rhythmDelay: number, rhythmReverb: number }) {
    this.safeTarget(this.chordDry?.gain, Math.max(0, 1 - s.chordDelay - s.chordReverb));
    this.safeTarget(this.chordDelaySend?.gain, s.chordDelay);
    this.safeTarget(this.chordReverbSend?.gain, s.chordReverb);
    this.safeTarget(this.harpDry?.gain, Math.max(0, 1 - s.harpDelay - s.harpReverb));
    this.safeTarget(this.harpDelaySend?.gain, s.harpDelay);
    this.safeTarget(this.harpReverbSend?.gain, s.harpReverb);
    this.safeTarget(this.rhythmDry?.gain, Math.max(0, 1 - s.rhythmDelay - s.rhythmReverb));
    this.safeTarget(this.rhythmDelaySend?.gain, s.rhythmDelay);
    this.safeTarget(this.rhythmReverbSend?.gain, s.rhythmReverb);
  }

  async playChord(chord: ChordDefinition) {
    await this.ensureAudioOpened();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    this.stopChord(false); 

    if (this.bassEnabled) {
      const freq = 130.81 * Math.pow(2, this.octaveShift) * Math.pow(2, (chord.intervals[0] - 12) / 12);
      const oscSine = this.ctx.createOscillator();
      const gainSine = this.ctx.createGain();
      oscSine.type = 'sine';
      oscSine.frequency.setValueAtTime(freq, now);
      gainSine.gain.setValueAtTime(0, now);
      gainSine.gain.linearRampToValueAtTime(0.7 * (1 - this.bassWaveformMix), now + this.chordAttack);
      oscSine.connect(gainSine);
      if (this.bassSource) gainSine.connect(this.bassSource);
      oscSine.start(now);
      this.activeBassGainSine = gainSine;

      const oscSaw = this.ctx.createOscillator();
      const gainSaw = this.ctx.createGain();
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.setValueAtTime(800, now);
      oscSaw.type = 'sawtooth';
      oscSaw.frequency.setValueAtTime(freq, now);
      gainSaw.gain.setValueAtTime(0, now);
      gainSaw.gain.linearRampToValueAtTime(0.4 * this.bassWaveformMix, now + this.chordAttack);
      oscSaw.connect(lpf); lpf.connect(gainSaw);
      if (this.bassSource) gainSaw.connect(this.bassSource);
      oscSaw.start(now);
      this.activeBassGainSaw = gainSaw;

      this.bassOscillators.push({ osc: oscSine, gain: gainSine }, { osc: oscSaw, gain: gainSaw });
    }

    chord.intervals.forEach((interval) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();
      osc.type = this.chordWaveform;
      osc.frequency.setValueAtTime(130.81 * Math.pow(2, this.octaveShift) * Math.pow(2, interval / 12), now);
      
      let lfo: OscillatorNode | undefined;
      let lfoG: GainNode | undefined;
      if (this.vibratoAmount > 0) {
        lfo = this.ctx!.createOscillator();
        lfoG = this.ctx!.createGain();
        lfo.frequency.setValueAtTime(this.vibratoRate, now);
        lfoG.gain.setValueAtTime(this.vibratoAmount * 25, now);
        lfo.connect(lfoG); 
        lfoG.connect(osc.frequency);
        lfo.start(now);
      }

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(100 + (this.chordCutoff * 5000), now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + this.chordAttack);
      osc.connect(filter); filter.connect(gain);
      if (this.chordSource) gain.connect(this.chordSource);
      osc.start(now);
      this.chordOscillators.push({ osc, gain, filter, lfo, lfoGain: lfoG });
    });
  }

  stopChord(immediate = false, customRelease?: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const release = customRelease ?? (immediate ? 0.005 : this.chordRelease);
    
    this.chordOscillators.forEach((active) => {
      active.gain.gain.cancelScheduledValues(now);
      active.gain.gain.setValueAtTime(active.gain.gain.value, now);
      active.gain.gain.linearRampToValueAtTime(0, now + release);
      active.osc.stop(now + release + 0.1);
      active.lfo?.stop(now + release + 0.1);
    });
    this.bassOscillators.forEach(({ osc, gain }) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + release);
      osc.stop(now + release + 0.1);
    });
    
    this.chordOscillators = [];
    this.bassOscillators = [];
  }

  async playHarpNote(chord: ChordDefinition, index: number) {
    await this.ensureAudioOpened();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const intervalIndex = index % chord.intervals.length;
    const octaveOffset = Math.floor(index / chord.intervals.length);
    const freq = 261.63 * Math.pow(2, this.octaveShift + this.harpOctaveShift) * Math.pow(2, (chord.intervals[intervalIndex] + (octaveOffset * 12)) / 12);
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = this.harpWaveform;
    osc.frequency.setValueAtTime(freq, now);
    filter.type = 'lowpass';
    const baseCutoff = 800 + (this.harpCutoff * 9000);
    filter.frequency.setValueAtTime(baseCutoff, now);
    filter.frequency.exponentialRampToValueAtTime(baseCutoff * 0.2, now + 0.4);
    gain.gain.setValueAtTime(0.5, now);
    const decay = 0.6 + (this.sustainValue * 5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    osc.connect(filter); filter.connect(gain);
    if (this.harpSource) gain.connect(this.harpSource);
    osc.start(now); osc.stop(now + decay + 0.1);
  }

  async startRhythm(pattern: RhythmPattern) {
    this.stopRhythm();
    if (pattern === RhythmPattern.NONE) return;
    
    // V6.06: Ensure audio context and master gain are active before starting rhythm
    await this.ensureAudioOpened();
    if (!this.ctx) return;
    
    const beatLen = 60 / this.tempo;
    let step = 0;
    
    this.rhythmInterval = window.setInterval(() => {
      const s = step % 16;
      switch(pattern) {
        case RhythmPattern.ROCK1: 
          if (s % 8 === 0 || s % 8 === 6) this.playDrum('kick'); 
          if (s % 8 === 4) this.playDrum('snare'); 
          if (s % 4 === 0) this.playDrum('hihat'); 
          break;
        case RhythmPattern.ROCK2: 
          if (s === 0 || s === 3 || s === 8) this.playDrum('kick'); 
          if (s === 4 || s === 12) this.playDrum('snare'); 
          if (s % 4 === 0) this.playDrum('hihat'); 
          break;
        case RhythmPattern.DISCO: 
          if (s % 4 === 0) this.playDrum('kick'); 
          if (s % 8 === 4) this.playDrum('snare'); 
          if (s % 4 === 0) this.playDrum('hihat'); 
          break;
        case RhythmPattern.EIGHT_BEAT: 
          if (s % 4 === 0) this.playDrum('kick'); 
          if (s % 8 === 4) this.playDrum('snare'); 
          if (s % 2 === 0) this.playDrum('hihat'); 
          break;
        case RhythmPattern.SIXTEEN_BEAT: 
          if (s === 0 || s === 6 || s === 10) this.playDrum('kick'); 
          if (s === 4 || s === 12) this.playDrum('snare'); 
          if (s % 2 === 0) this.playDrum('hihat'); 
          break;
        case RhythmPattern.COUNTRY: 
          if (s % 8 === 0 || s % 8 === 4) this.playDrum('kick'); 
          if (s % 8 === 2 || s % 8 === 6) this.playDrum('snare'); 
          if (s % 4 === 0) this.playDrum('hihat'); 
          break;
        case RhythmPattern.SHUFFLE: 
          if (s % 8 === 0) this.playDrum('kick'); 
          if (s % 8 === 4) this.playDrum('snare'); 
          if (s % 3 === 0 || s % 3 === 2) this.playDrum('hihat'); 
          break;
        case RhythmPattern.HIPHOP: 
          if (s === 0 || s === 3 || s === 10) this.playDrum('kick'); 
          if (s === 4 || s === 12) this.playDrum('snare'); 
          if (s % 4 === 0) this.playDrum('hihat'); 
          break;
        case RhythmPattern.BLUES: 
          if (s % 8 === 0 || s % 8 === 3) this.playDrum('kick'); 
          if (s % 8 === 4) this.playDrum('snare'); 
          if (s % 4 === 0) this.playDrum('hihat'); 
          break;
        case RhythmPattern.WALTZ: 
          if (s % 12 === 0) this.playDrum('kick'); 
          if (s % 12 === 4 || s % 12 === 8) this.playDrum('hihat'); 
          break;
        case RhythmPattern.JAZZ_WALTZ: 
          if (s % 12 === 0) this.playDrum('kick'); 
          if (s % 12 === 4 || s % 12 === 8) this.playDrum('hihat'); 
          if (s % 12 === 4) this.playDrum('snare'); 
          break;
        case RhythmPattern.LATIN: 
          if (s % 4 === 0) this.playDrum('kick'); 
          if (s === 3 || s === 7 || s === 11 || s === 15) this.playDrum('snare'); 
          if (s % 2 === 0) this.playDrum('hihat'); 
          break;
        case RhythmPattern.BOSSA: 
          if (s === 0 || s === 3 || s === 10) this.playDrum('kick'); 
          if (s === 4 || s === 12) this.playDrum('snare'); 
          if (s % 4 === 0) this.playDrum('hihat'); 
          break;
        case RhythmPattern.REGGAE: 
          if (s === 4 || s === 12) this.playDrum('kick'); 
          if (s === 4 || s === 12) this.playDrum('snare'); 
          if (s % 4 === 0) this.playDrum('hihat'); 
          break;
        case RhythmPattern.TANGO: 
          if (s === 0 || s === 4 || s === 8 || s === 12 || s === 14) this.playDrum('kick'); 
          if (s === 15) this.playDrum('snare'); 
          break;
      }
      step = (step + 1) % 48;
    }, (beatLen / 4) * 1000);
  }

  private playDrum(type: 'kick' | 'snare' | 'hihat') {
    if (!this.ctx || !this.rhythmSource) return;
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    if (type === 'kick') {
      const osc = this.ctx.createOscillator();
      osc.frequency.setValueAtTime(100, now); 
      osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.15);
      gain.gain.setValueAtTime(1.0, now); 
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain); osc.start(now); osc.stop(now + 0.15);
    } else {
      const noise = this.ctx.createBufferSource();
      const bufferSize = this.ctx.sampleRate * 0.2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;
      const f = this.ctx.createBiquadFilter(); 
      f.type = type === 'snare' ? 'bandpass' : 'highpass';
      f.frequency.setValueAtTime(type === 'snare' ? 1200 : 9000, now);
      noise.connect(f); f.connect(gain);
      gain.gain.setValueAtTime(type === 'snare' ? 0.7 : 0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + (type === 'snare' ? 0.2 : 0.08));
      noise.start(now); noise.stop(now + 0.2);
    }
    gain.connect(this.rhythmSource);
  }

  stopRhythm() {
    if (this.rhythmInterval) clearInterval(this.rhythmInterval);
    this.rhythmInterval = null;
  }
}

export const audioEngine = new AudioEngine();
