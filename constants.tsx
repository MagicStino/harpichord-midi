import { ChordDefinition } from './types';

// Root notes in MIDI offsets (C = 0, Db = 1, etc.)
// Each root now has an explicit array of keys for the 3 rows: [Row 0 (Major), Row 1 (Minor), Row 2 (7th/etc)]
const ROOTS = [
  { name: 'Db', offset: 1, keys: ['Q', 'A', 'Z'] },
  { name: 'Ab', offset: 8, keys: ['W', 'S', 'X'] },
  { name: 'Eb', offset: 3, keys: ['E', 'D', 'C'] },
  { name: 'Bb', offset: 10, keys: ['R', 'F', 'V'] },
  { name: 'F', offset: 5, keys: ['T', 'G', 'B'] },
  { name: 'C', offset: 0, keys: ['Y', 'H', 'N'] },
  { name: 'G', offset: 7, keys: ['U', 'J', 'M'] },
  { name: 'D', offset: 2, keys: ['I', 'K', ','] },
  { name: 'A', offset: 9, keys: ['O', 'L', '.'] },
  { name: 'E', offset: 4, keys: ['P', ';', '/'] },
  { name: 'B', offset: 11, keys: ['[', "'", 'Shift'] },
  { name: 'F#', offset: 6, keys: [']', 'Enter', 'Control'] }
];

const generateRow = (modeName: string, suffix: string, intervals: number[], keyRowIndex: 0 | 1 | 2): ChordDefinition[] => {
  return ROOTS.map(r => ({
    root: r.name,
    label: `${r.name}${suffix}`,
    modeName: modeName,
    intervals: intervals.map(i => i + r.offset),
    key: r.keys[keyRowIndex]
  }));
};

// PAGE 1 – Core: Major · Minor · Dominant 7
export const MAJOR_CHORDS = generateRow('Major', '', [0, 4, 7], 0);
export const MINOR_CHORDS = generateRow('Minor', 'm', [0, 3, 7], 1);
export const DOM7_CHORDS = generateRow('Dominant 7', '7', [0, 4, 7, 10], 2);

// PAGE 2 – Color: Minor 7 · Major 7 · Add9
export const MIN7_CHORDS = generateRow('Minor 7', 'm7', [0, 3, 7, 10], 0);
export const MAJ7_CHORDS = generateRow('Major 7', 'maj7', [0, 4, 7, 11], 1);
export const ADD9_CHORDS = generateRow('Add9', 'add9', [0, 4, 7, 14], 2);

// PAGE 3 – Tension / Neutral: Sus4 · Power (5) · Diminished
export const SUS4_CHORDS = generateRow('Sus4', 'sus4', [0, 5, 7], 0);
export const POWER_CHORDS = generateRow('Power', '5', [0, 7], 1);
export const DIM_CHORDS = generateRow('Diminished', 'dim', [0, 3, 6], 2);

// Harp keys restricted to 1-0 and -= to prevent overlap with [ ] chord keys
export const HARP_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
