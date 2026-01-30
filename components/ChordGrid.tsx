
import React from 'react';
import { ChordDefinition } from '../types';
import { 
  MAJOR_CHORDS, MINOR_CHORDS, DOM7_CHORDS,
  MIN7_CHORDS, MAJ7_CHORDS, ADD9_CHORDS,
  SUS4_CHORDS, POWER_CHORDS, DIM_CHORDS
} from '../constants';

interface ChordGridProps {
  activeChord: ChordDefinition | null;
  currentPage: number;
  onPress: (chord: ChordDefinition) => void;
  onRelease: () => void;
  onSetPage: (page: number) => void;
  midiMode?: number;
}

const ChordGrid: React.FC<ChordGridProps> = ({ activeChord, currentPage, onPress, onRelease, onSetPage, midiMode = 0 }) => {
  const getPageRows = () => {
    switch (currentPage) {
      case 1: return [
        { label: 'Minor 7', data: MIN7_CHORDS, color: 'bg-[#f8f1e5]' },
        { label: 'Major 7', data: MAJ7_CHORDS, color: 'bg-[#eee3ce]' },
        { label: 'Add9', data: ADD9_CHORDS, color: 'bg-[#e4d6b7]' }
      ];
      case 2: return [
        { label: 'Sus4', data: SUS4_CHORDS, color: 'bg-[#f8f1e5]' },
        { label: 'Power (5)', data: POWER_CHORDS, color: 'bg-[#eee3ce]' },
        { label: 'Diminished', data: DIM_CHORDS, color: 'bg-[#e4d6b7]' }
      ];
      default: return [
        { label: 'Major', data: MAJOR_CHORDS, color: 'bg-[#f8f1e5]' },
        { label: 'Minor', data: MINOR_CHORDS, color: 'bg-[#eee3ce]' },
        { label: 'Dominant 7', data: DOM7_CHORDS, color: 'bg-[#e4d6b7]' }
      ];
    }
  };

  const rows = getPageRows();
  
  const getMidiModeLabel = () => {
    if (midiMode === 0) return 'MIDI: MAJOR (C4)';
    if (midiMode === 1) return 'MIDI: MINOR (C5)';
    return 'MIDI: DOM7 (C3)';
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* RETRO LCD DISPLAY */}
      <div className="w-[365px] h-[95px] mb-8 bg-[#0a0a0a] rounded-[2rem] border-[4px] border-[#1a1a1a] shadow-[inset_0_4px_10px_rgba(0,0,0,0.9),0_4px_15px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ 
          backgroundImage: 'linear-gradient(rgba(255,165,0,0.05) 1px, transparent 1px)',
          backgroundSize: '100% 3px'
        }} />
        <div className="flex flex-col items-center z-10 w-full px-4 leading-none">
          {activeChord ? (
            <div className="flex flex-col items-center">
              <div className="lcd-text text-orange-500/90 text-3xl uppercase tracking-wide text-center drop-shadow-[0_0_4px_rgba(249,115,22,0.2)]">
                {activeChord.root} {activeChord.modeName}
              </div>
              <div className="lcd-text text-orange-500/40 text-[12px] uppercase tracking-widest mt-1">
                LATCHED • READY
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="lcd-text text-orange-500/90 text-[20px] uppercase tracking-[0.1em] text-center drop-shadow-[0_0_4px_rgba(249,115,22,0.2)]">
                A-Z: CHORDS | 0-9: HARP
              </div>
              <div className="lcd-text text-orange-500/90 text-[18px] uppercase tracking-[0.1em] text-center drop-shadow-[0_0_4px_rgba(249,115,22,0.2)]">
                TAB: CHORD PAGES
              </div>
              <div className="lcd-text text-orange-500/30 text-[10px] uppercase tracking-[0.3em] mt-1 italic">
                {getMidiModeLabel()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CHORD GRID ROWS */}
      <div className="flex flex-col gap-1 w-full items-center">
        {rows.map((row, idx) => (
          <div key={idx} className="flex flex-col items-center">
            {/* V6.02: Chord Mode Label spacing adjusted for better layout breatheability (mt-8 mb-4) */}
            <div className="text-[12px] font-black text-amber-900/60 mt-8 mb-4 uppercase tracking-[0.4em] font-sans">
              {row.label} Mode
            </div>
            <div className="flex gap-1.5">
              {row.data.map((chord) => (
                <button
                  key={chord.label}
                  onMouseDown={() => onPress(chord)}
                  onMouseUp={onRelease}
                  onMouseLeave={onRelease}
                  className={`chord-button w-[66px] h-[64px] flex flex-col items-center justify-center transition-all ${
                    activeChord?.label === chord.label 
                      ? 'bg-amber-700 text-white active shadow-[0_0_15px_rgba(180,83,9,0.5)] scale-105 z-10' 
                      : `${row.color} text-amber-950 hover:brightness-105 active:scale-95 shadow-[0_4px_0_#8d7d5d]`
                  }`}
                >
                  {/* Chord Label: 1pt bigger (11.5px) */}
                  <span className="leading-none text-[11.5px] font-black mb-1">{chord.label}</span>
                  <div className={`w-6 h-[0.5px] mb-1 ${activeChord?.label === chord.label ? 'bg-white/40' : 'bg-amber-900/20'}`} />
                  <span className={`text-[9px] font-mono font-black uppercase tracking-tighter ${activeChord?.label === chord.label ? 'text-white/70' : 'text-amber-900/40'}`}>
                    {chord.key.length > 5 ? chord.key.slice(0, 3) : chord.key}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* PAGINATOR */}
      <div className="mt-8 flex flex-col items-center gap-2">
        <div className="flex gap-8 items-center bg-black/5 px-8 py-2 rounded-full border border-black/5">
          {[0, 1, 2].map(p => (
            <button
              key={p}
              onClick={() => onSetPage(p)}
              className="group flex flex-col items-center gap-1.5"
            >
              <div className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                currentPage === p 
                  ? 'bg-green-500 border-green-900 shadow-[0_0_10px_#22c55e]' 
                  : 'bg-gray-800 border-black hover:bg-gray-700'
              }`} />
              <span className={`text-[11px] font-black tracking-[0.2em] transition-all ${
                currentPage === p ? 'text-amber-900' : 'text-amber-900/30'
              }`}>
                {p + 1}/3
              </span>
            </button>
          ))}
        </div>
        <div className="text-[7px] font-black text-amber-900/20 uppercase tracking-[0.8em] mt-1">OMNI_PAGE • TAB</div>
      </div>
    </div>
  );
};

export default ChordGrid;
