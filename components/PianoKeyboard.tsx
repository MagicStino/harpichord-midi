import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ChordDefinition } from '../types';

interface PianoKeyboardProps {
  currentChord: ChordDefinition | null;
  octave: number;
  bassEnabled: boolean;
  lastStrumHit: { midi: number; time: number } | null;
}

const PianoKeyboard: React.FC<PianoKeyboardProps> = ({ currentChord, octave, bassEnabled, lastStrumHit }) => {
  // 4 octaves keyboard display: MIDI 36 to 83
  const startMidi = 36;
  const numKeys = 48; 
  const keys = Array.from({ length: numKeys }).map((_, i) => startMidi + i);

  const [activeStrums, setActiveStrums] = useState<Record<number, number>>({});
  const [, setRenderTrigger] = useState(0);
  const frameRef = useRef<number | null>(null);

  // Sync new strum hits from parent
  useEffect(() => {
    if (lastStrumHit) {
      setActiveStrums(prev => ({
        ...prev,
        [lastStrumHit.midi]: lastStrumHit.time
      }));
    }
  }, [lastStrumHit]);

  // High-performance animation loop for glow fading
  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const strumEntries = Object.entries(activeStrums);
      if (strumEntries.length > 0) {
        setRenderTrigger(t => t + 1);
      }
      frameRef.current = requestAnimationFrame(update);
    };
    frameRef.current = requestAnimationFrame(update);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [activeStrums]);

  // Clean up expired strum timestamps
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setActiveStrums(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(key => {
          const k = Number(key);
          if (now - next[k] > 600) { 
            delete next[k];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 200);
    return () => clearInterval(timer);
  }, []);

  const getNoteName = (midi: number) => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return names[midi % 12];
  };

  const isAccidental = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);

  const activeChordMidis = useMemo(() => {
    if (!currentChord) return new Set<number>();
    const base = 48 + (octave * 12);
    return new Set(currentChord.intervals.map(i => base + i));
  }, [currentChord, octave]);

  const activeBassMidi = useMemo(() => {
    if (!currentChord || !bassEnabled) return null;
    const base = 48 + (octave * 12);
    return (base + (currentChord.intervals[0] % 12)) - 12;
  }, [currentChord, octave, bassEnabled]);

  const now = Date.now();

  return (
    <div className="flex justify-center w-full h-28 bg-black/10 rounded-[1.5rem] p-1.5 shadow-inner border border-black/5">
      <div className="flex relative w-full h-full justify-center">
        {keys.map((midi) => {
          const isChord = activeChordMidis.has(midi);
          const isBass = activeBassMidi === midi;
          const accidental = isAccidental(midi);
          const strumTime = activeStrums[midi];
          
          // Orange-gold afterglow (0.2s duration)
          const strumGlowRaw = strumTime ? Math.max(0, 1 - (now - strumTime) / 200) : 0;
          const strumGlow = strumGlowRaw; 
          
          const noteName = getNoteName(midi);

          // Deep Orange-Gold glow effect
          const strumOutlineStyle = strumGlow > 0 ? {
            borderColor: `rgba(255, 140, 0, ${strumGlow})`,
            boxShadow: `0 0 ${20 * strumGlow}px rgba(255, 140, 0, ${strumGlow}), inset 0 0 ${10 * strumGlow}px rgba(255, 69, 0, 0.5)`,
            zIndex: 30
          } : {};

          if (accidental) {
            return (
              <div 
                key={midi}
                className={`z-20 w-7 h-[65%] -mx-3.5 rounded-b-md transition-all duration-75 relative border border-black/30 ${
                  isChord ? 'bg-[#b38e5d]' : 
                  isBass ? 'bg-[#832f2f]' : 
                  'bg-[#2a2a2a]'
                }`}
                style={strumOutlineStyle}
              >
                {(isChord || isBass) && (
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_white] mb-1" />
                    <span className="text-[16px] font-black text-white font-mono tracking-tighter leading-none">{noteName}</span>
                  </div>
                )}
              </div>
            );
          } else {
            return (
              <div 
                key={midi}
                className={`z-10 w-11 h-full rounded-b-lg border-x border-b border-black/10 transition-all duration-75 relative ${
                  isChord ? 'bg-[#c5a16d] shadow-[inset_0_0_20px_rgba(0,0,0,0.15)]' : 
                  isBass ? 'bg-[#963f3f] shadow-[inset_0_0_20px_rgba(0,0,0,0.15)]' : 
                  'bg-[#e6d5b8]'
                }`}
                style={strumOutlineStyle}
              >
                {(isChord || isBass) && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_white] mb-1.5" />
                    <span className={`text-[16px] font-black font-mono tracking-tighter leading-none text-white`}>{noteName}</span>
                  </div>
                )}
              </div>
            );
          }
        })}
      </div>
    </div>
  );
};

export default PianoKeyboard;