
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
  private chordAttack: number = 0.05;
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

  private firstChordPlayed: boolean = false;

  private safeTarget(param: AudioParam | undefined, value: number, time?: number, ramp?: number) {
    if (!param || !this.ctx) return;
    const now = this.ctx.currentTime;
    const startTime = time ?? now;
    const rampTime = ramp ?? 0.05;
    // Essential for Chrome: cancel pending values to ensure the new target is applied immediately
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, startTime, rampTime);
  }

  // Implementation for distortion curve calculation
  private makeDistortionCurve(amount: number) {
    const k = amount * 100;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  async init() {
    if (this.initPromise) return this.initPromise;

    // Fix: Invoke the async function expression immediately to assign the resulting Promise
    this.initPromise = (async () => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.ctx = ctx;

      // Chrome Autoplay Policy requires resume on user interaction
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;

      // Create Nodes
      this.compressor = ctx.createDynamicsCompressor();
      this.masterGain = ctx.createGain();
      
      // Muted until first real note to prevent pops
      this.masterGain.gain.setValueAtTime(0, now);

      this.masterTubeIn = ctx.createGain();
      this.masterTubeDry = ctx.createGain();
      this.masterTubeWet = ctx.createGain();
      this.masterTubeAmp = ctx.createWaveShaper();
      this.masterTubeOut = ctx.createGain();
      
      // Fix: makeDistortionCurve is now defined
      this.masterTubeAmp.curve = this.makeDistortionCurve(0.2);
      this.masterTubeDry.gain.setValueAtTime(1, now);
      this.masterTubeWet.gain.setValueAtTime(0, now);

      this.chordSource = ctx.createGain();
      this.harpSource = ctx.createGain();
      this.rhythmSource = ctx.createGain();
      this.bassSource = ctx.createGain();
      
      // Default source volumes
      this.chordSource.gain.setValueAtTime(0.25, now);
      this.harpSource.gain.setValueAtTime(0.5, now);
      this.rhythmSource.gain.setValueAtTime(1.0, now);
      this.bassSource.gain.setValueAtTime(0.8, now);

      this.rhythmFilterBus = ctx.createBiquadFilter();
      this.rhythmFilterBus.type = 'lowpass';
      this.rhythmFilterBus.frequency.setValueAtTime(20000, now);

      this.chordDry = ctx.createGain();
      this.chordDelaySend = ctx.createGain();
      this.chordReverbSend = ctx.createGain();
      this.chordDry.gain.setValueAtTime(1, now);
      this.chordDelaySend.gain.setValueAtTime(0, now);
      this.chordReverbSend.gain.setValueAtTime(0, now);

      this.harpDry = ctx.createGain();
      this.harpDelaySend = ctx.createGain();
      this.harpReverbSend = ctx.createGain();
      this.harpDry.gain.setValueAtTime(1, now);
      this.harpDelaySend.gain.setValueAtTime(0, now);
      this.harpReverbSend.gain.setValueAtTime(0, now);

      this.rhythmDry = ctx.createGain();
      this.rhythmDelaySend = ctx.createGain();
      this.rhythmReverbSend = ctx.createGain();
      this.rhythmDry.gain.setValueAtTime(1, now);
      this.rhythmDelaySend.gain.setValueAtTime(0, now);
      this.rhythmReverbSend.gain.setValueAtTime(0, now);

      this.delayNodeL = ctx.createDelay(4.0);
      this.delayNodeR = ctx.createDelay(4.0);
      this.delayFeedback = ctx.createGain();
      this.delayFilter = ctx.createBiquadFilter();
      this.delayMerger = ctx.createChannelMerger(2);
      this.delayOutput = ctx.createGain();
      
      this.delayFeedback.gain.setValueAtTime(0.4, now);
      this.delayFilter.type = 'lowpass';
      this.delayFilter.frequency.setValueAtTime(5000, now);
      this.delayOutput.gain.setValueAtTime(1.0, now);

      this.reverbFilter = ctx.createBiquadFilter();
      this.reverbPanner = ctx.createStereoPanner();
      this.reverbOutput = ctx.createGain();
      this.reverbFilter.type = 'lowpass';
      this.reverbFilter.frequency.setValueAtTime(10000, now);
      this.reverbOutput.gain.setValueAtTime(1.0, now);

      // Connect Graph
      this.rhythmSource.connect(this.rhythmFilterBus);
      
      this.chordSource.connect(this.chordDry);
      this.chordSource.connect(this.chordDelaySend);
      this.chordSource.connect(this.chordReverbSend);

      this.harpSource.connect(this.harpDry);
      this.harpSource.connect(this.harpDelaySend);
      this.harpSource.connect(this.harpReverbSend);

      this.rhythmFilterBus.connect(this.rhythmDry);
      this.rhythmFilterBus.connect(this.rhythmDelaySend);
      this.rhythmFilterBus.connect(this.rhythmReverbSend);

      [this.chordDelaySend, this.harpDelaySend, this.rhythmDelaySend].forEach(s => s.connect(this.delayFilter!));
      this.delayFilter.connect(this.delayNodeL);
      this.delayFilter.connect(this.delayNodeR);
      this.delayNodeL.connect(this.delayFeedback);
      this.delayNodeR.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayFilter);
      this.delayNodeL.connect(this.delayMerger, 0, 0);
      this.delayNodeR.connect(this.delayMerger, 0, 1);
      this.delayMerger.connect(this.delayOutput);
      this.delayOutput.connect(this.masterGain!);

      const times = [0.033, 0.037, 0.041, 0.043, 0.047, 0.051, 0.059, 0.067];
      times.forEach(t => {
        const d = ctx.createDelay(1.0);
        d.delayTime.value = t;
        const g = ctx.createGain();
        g.gain.value = 0.7;
        [this.chordReverbSend!, this.harpReverbSend!, this.rhythmReverbSend!].forEach(s => s.connect(d));
        d.connect(g);
        g.connect(d); 
        g.connect(this.reverbFilter!);
        this.reverbNodes.push(d);
        this.reverbGains.push(g);
      });
      this.reverbFilter.connect(this.reverbPanner);
      this.reverbPanner.connect(this.reverbOutput);
      this.reverbOutput.connect(this.masterGain!);

      [this.chordDry, this.harpDry, this.rhythmDry, this.bassSource].forEach(n => n.connect(this.masterGain!));

      this.masterGain.connect(this.masterTubeIn);
      this.masterTubeIn.connect(this.masterTubeDry);
      this.masterTubeIn.connect(this.masterTubeAmp);
      this.masterTubeAmp.connect(this.masterTubeWet);
      this.masterTubeDry.connect(this.masterTubeOut);
      this.masterTubeWet.connect(this.masterTubeOut);
      this.masterTubeOut.connect(this.compressor);
      this.compressor.connect(ctx.destination);
    })();

    return this.initPromise;
  }

  // Audio configuration setters called from App.tsx
  setChordVolume(v: number) { this.safeTarget(this.chordSource?.gain, v); }
  setHarpVolume(v: number) { this.safeTarget(this.harpSource?.gain, v); }
  setRhythmVolume(v: number) { this.safeTarget(this.rhythmSource?.gain, v); }
  setBassVolume(v: number) { this.safeTarget(this.bassSource?.gain, v); }
  setSustain(v: number) { this.sustainValue = v; }
  setChordAttack(v: number) { this.chordAttack = v; }
  setChordRelease(v: number) { this.chordRelease = v; }
  setTempo(v: number) { this.tempo = v; }
  setOctave(v: number) { this.octaveShift = v; }
  setHarpOctave(v: number) { this.harpOctaveShift = v; }
  setChordCutoff(v: number) { this.chordCutoff = v; }
  setHarpCutoff(v: number) { this.harpCutoff = v; }
  setRhythmCutoff(v: number) {
    this.rhythmCutoff = v;
    if (this.rhythmFilterBus) {
      this.safeTarget(this.rhythmFilterBus.frequency, 200 + (v * v * 18000));
    }
  }
  setBassEnabled(v: boolean) { this.bassEnabled = v; }
  setBassWaveformMix(v: number) { this.bassWaveformMix = v; }
  setTubeAmp(enabled: boolean, drive: number, wet: number) {
    if (!this.masterTubeDry || !this.masterTubeWet || !this.masterTubeAmp) return;
    this.safeTarget(this.masterTubeDry.gain, enabled ? 1 - wet : 1);
    this.safeTarget(this.masterTubeWet.gain, enabled ? wet : 0);
    this.masterTubeAmp.curve = this.makeDistortionCurve(drive);
  }
  setChordWaveform(v: WaveformType) { this.chordWaveform = v; }
  setHarpWaveform(v: WaveformType) { this.harpWaveform = v; }
  setVibrato(amt: number, rate: number) { this.vibratoAmount = amt; this.vibratoRate = rate; }
  
  updateDelay(div: DelayDivision, fb: number, tone: number, spread: number) {
    if (!this.delayNodeL || !this.delayNodeR || !this.delayFeedback || !this.delayFilter) return;
    const beatTime = 60 / this.tempo;
    const divisions: Record<string, number> = {
      '1/4': 1, '1/4D': 1.5, '1/4T': 0.666,
      '1/8': 0.5, '1/8D': 0.75, '1/8T': 0.333,
      '1/16': 0.25, '1/16D': 0.375, '1/16T': 0.166,
      '1/3': 0.333, '1/5': 0.2
    };
    const time = beatTime * (divisions[div] || 0.5);
    this.safeTarget(this.delayNodeL.delayTime, time);
    this.safeTarget(this.delayNodeR.delayTime, time * (1 + spread * 0.05));
    this.safeTarget(this.delayFeedback.gain, fb * 0.85);
    this.safeTarget(this.delayFilter.frequency, 100 + (tone * 8000));
  }

  updateReverb(size: number, damp: number, width: number, color: number) {
    if (!this.reverbFilter) return;
    this.reverbGains.forEach(g => this.safeTarget(g.gain, 0.4 + size * 0.5));
    this.safeTarget(this.reverbFilter.frequency, 1000 + (1 - damp) * 15000);
    if (this.reverbPanner) this.safeTarget(this.reverbPanner.pan, (width - 0.5) * 2);
  }

  setSends(s: { chordDelay: number, chordReverb: number, harpDelay: number, harpReverb: number, rhythmDelay: number, rhythmReverb: number }) {
    this.safeTarget(this.chordDelaySend?.gain, s.chordDelay);
    this.safeTarget(this.chordReverbSend?.gain, s.chordReverb);
    this.safeTarget(this.harpDelaySend?.gain, s.harpDelay);
    this.safeTarget(this.harpReverbSend?.gain, s.harpReverb);
    this.safeTarget(this.rhythmDelaySend?.gain, s.rhythmDelay);
    this.safeTarget(this.rhythmReverbSend?.gain, s.rhythmReverb);
  }

  // Playback logic
  playChord(chord: ChordDefinition) {
    if (!this.ctx || !this.chordSource) return;
    this.stopChord();
    
    if (!this.firstChordPlayed) {
      this.safeTarget(this.masterGain?.gain, 1, this.ctx.currentTime, 0.2);
      this.firstChordPlayed = true;
    }

    chord.intervals.forEach((interval) => {
      const freq = 440 * Math.pow(2, (interval + (this.octaveShift * 12) - 21) / 12);
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      osc.type = this.chordWaveform;
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200 + this.chordCutoff * 10000, this.ctx!.currentTime);

      gain.gain.setValueAtTime(0, this.ctx!.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, this.ctx!.currentTime + this.chordAttack);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.chordSource!);
      osc.start();

      this.chordOscillators.push({ osc, gain, filter });
    });
  }

  stopChord(immediate = false) {
    const now = this.ctx?.currentTime || 0;
    this.chordOscillators.forEach(({ osc, gain }) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, immediate ? 0.01 : this.chordRelease);
      setTimeout(() => { try { osc.stop(); } catch(e) {} }, (immediate ? 0.05 : this.chordRelease * 5) * 1000);
    });
    this.chordOscillators = [];
  }

  playHarpNote(chord: ChordDefinition, index: number) {
    if (!this.ctx || !this.harpSource) return;
    const intervalIndex = index % chord.intervals.length;
    const octaveOffset = Math.floor(index / chord.intervals.length);
    const interval = chord.intervals[intervalIndex] + (this.octaveShift + this.harpOctaveShift) * 12 + (octaveOffset * 12);
    const freq = 440 * Math.pow(2, (interval - 21) / 12);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = this.harpWaveform;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200 + this.harpCutoff * 15000, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + this.sustainValue * 2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.harpSource);
    osc.start();
    setTimeout(() => { try { osc.stop(); } catch(e) {} }, this.sustainValue * 2500);
  }

  startRhythm(pattern: RhythmPattern) {
    this.stopRhythm();
    const interval = 60 / this.tempo / 4;
    let step = 0;
    this.rhythmInterval = window.setInterval(() => {
      if (!this.ctx || !this.rhythmSource) return;
      if (step % 4 === 0) this.triggerDrum(150, 0.4); // Kick placeholder
      if (step % 8 === 4) this.triggerDrum(800, 0.2); // Snare placeholder
      step = (step + 1) % 16;
    }, interval * 1000);
  }

  private triggerDrum(freq: number, vol: number) {
    if (!this.ctx || !this.rhythmSource) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.rhythmSource);
    osc.start();
    setTimeout(() => { try { osc.stop(); } catch(e) {} }, 200);
  }

  stopRhythm() {
    if (this.rhythmInterval) clearInterval(this.rhythmInterval);
    this.rhythmInterval = null;
  }
}

// Fix: Export the audioEngine instance used in App.tsx
export const audioEngine = new AudioEngine();
