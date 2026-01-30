
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

export type DelayDivision = '1/2' | '1/4' | '1/4D' | '1/8' | '1/8D' | '5/16' | '5/8' | '7/8' | '1/4T' | '1/8T' | '1/16T';
export type WaveformType = 'square' | 'sawtooth' | 'triangle' | 'sine';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer?: string;
  type: 'input' | 'output';
}

export type ChordModeKey = 'Major' | 'Minor' | 'Dominant 7' | 'Minor 7' | 'Major 7' | 'Add9' | 'Sus4' | 'Power' | 'Diminished' | 'None';

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
  midiInputId: string;
  midiChordOutputId: string;
  midiChordChannel: number;
  midiHarpOutputId: string;
  midiHarpChannel: number;
  midiOctaveMap: Record<number, ChordModeKey>;
}
