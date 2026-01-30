
export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output';
}

export interface MidiInstrumentConfig {
  id: string;
  name: string;
  inputId: string; // Device ID or 'all' or 'none'
  outputId: string; // Device ID or 'none'
  inputChannel: number; // 1-16 or 0 for Omni
  outputChannel: number; // 1-16
}

export type MidiMessage = [number, number, number];

export enum MidiCommand {
  NoteOff = 0x80,
  NoteOn = 0x90,
  ControlChange = 0xB0,
  ProgramChange = 0xC0,
  PitchBend = 0xE0
}
