export type ChordType = 'major' | 'minor' | '7th';

export interface ChordDefinition {
  root: string;
  label: string;
  intervals: number[];
  key: string;
  modeName: string;
}

export enum RhythmPattern {
  NONE = 'None',
  ROCK1 = 'Rock 1',
  ROCK2 = 'Rock 2',
  DISCO = 'Disco',
  EIGHT_BEAT = '8 Beat',
  SIXTEEN_BEAT = '16 Beat',
  COUNTRY = 'Country',
  SHUFFLE = 'Shuffle',
  HIPHOP = 'Hip Hop',
  BLUES = 'Blues',
  WALTZ = 'Waltz',
  JAZZ_WALTZ = 'Jazz Waltz',
  LATIN = 'Latin',
  BOSSA = 'Bossa Nova',
  REGGAE = 'Reggae',
  TANGO = 'Tango'
}

export type DelayDivision = '1/4' | '1/4D' | '1/4T' | '1/8' | '1/8D' | '1/8T' | '1/16' | '1/16D' | '1/16T' | '1/3' | '1/5';
export type WaveformType = 'square' | 'sawtooth' | 'triangle' | 'sine';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer?: string;
  type: 'input' | 'output';
}

// Added missing MIDI types required by components in the temp/ directory
export interface MidiInstrumentConfig {
  id: string;
  name: string;
  inputId: string; // Device ID or 'all' or 'none'
  outputId: string; // Device ID or 'none'
  inputChannel: number; // 1-16 or 0 for Omni
  outputChannel: number; // 1-16
}

// Added MidiMessage type as either a tuple or Uint8Array to support both legacy and modern MIDI message formats
export type MidiMessage = [number, number, number] | Uint8Array;

// Added MidiCommand enum for standard MIDI status bytes
export enum MidiCommand {
  NoteOff = 0x80,
  NoteOn = 0x90,
  ControlChange = 0xB0,
  ProgramChange = 0xC0,
  PitchBend = 0xE0
}

export interface OmnichordState {
  currentChord: ChordDefinition | null;
  chordPage: number;
  chordVolume: number;
  harpVolume: number;
  rhythmVolume: number;
  bassVolume: number;
  sustain: number;
  tempo: number;
  rhythm: RhythmPattern;
  isPlaying: boolean;
  useTouchpad: boolean;
  octave: number;
  harpOctave: number;
  chordCutoff: number;
  harpCutoff: number;
  rhythmCutoff: number;
  bassEnabled: boolean;
  bassWaveformMix: number;
  chordAttack: number;
  chordRelease: number;
  tubeEnabled: boolean;
  tubeDrive: number;
  tubeWet: number;
  tubePreset: 'clean' | 'soft' | 'warm' | 'hot';
  delayDivision: DelayDivision;
  delayFeedback: number;
  delayTone: number; 
  delaySpread: number;
  reverbSize: number;
  reverbDamp: number;
  reverbWidth: number; 
  reverbColor: number;
  chordDelaySend: number;
  chordReverbSend: number;
  harpDelaySend: number;
  harpReverbSend: number;
  rhythmDelaySend: number;
  rhythmReverbSend: number;
  chordWaveform: WaveformType;
  harpWaveform: WaveformType;
  vibratoAmount: number;
  vibratoRate: number;
  // MIDI Settings
  midiInputId: string;
  midiChordOutputId: string;
  midiChordChannel: number;
  midiHarpOutputId: string;
  midiHarpChannel: number;
}