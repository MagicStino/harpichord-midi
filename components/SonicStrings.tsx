import React, { useRef, useEffect, useState } from 'react';
import { ChordDefinition } from '../types';

interface SonicStringsProps {
  currentChord: ChordDefinition | null;
  useTouchpad: boolean;
  onTrigger: (index: number) => void;
  lastTriggeredIndex?: { index: number, time: number } | null;
}

const SonicStrings: React.FC<SonicStringsProps> = ({ currentChord, useTouchpad, onTrigger, lastTriggeredIndex }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track highlights by index -> timestamp to prevent leaks
  const [highlights, setHighlights] = useState<Record<number, number>>({});

  // 14 strings for 4 octaves as requested
  const stringsCount = 14;

  // Pruning Loop: Clean up old highlights every 50ms
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const expiration = 150; // ms to stay highlighted
      
      setHighlights(prev => {
        const next = { ...prev };
        let changed = false;
        
        Object.keys(next).forEach(key => {
          const idx = Number(key);
          if (now - next[idx] > expiration) {
            delete next[idx];
            changed = true;
          }
        });
        
        return changed ? next : prev;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // Flush all highlights on mode or chord change
  useEffect(() => {
    setHighlights({});
  }, [useTouchpad, currentChord]);

  // Synchronize with external triggers (like the global touchpad strum)
  useEffect(() => {
    if (lastTriggeredIndex) {
      const idx = lastTriggeredIndex.index;
      setHighlights(prev => ({
        ...prev,
        [idx]: Date.now()
      }));
    }
  }, [lastTriggeredIndex]);

  // Manual strum (hovering over the plate directly)
  const handlePointerEnter = (e: React.PointerEvent, index: number) => {
    if (useTouchpad) return;
    onTrigger(index);
    setHighlights(prev => ({
      ...prev,
      [index]: Date.now()
    }));
  };

  const strings = Array.from({ length: stringsCount }).map((_, i) => i);

  return (
    <div 
      ref={containerRef}
      className={`relative w-72 h-[480px] sonic-strings-plate rounded-2xl border-[6px] border-[#8d7d5d] overflow-hidden transition-all shadow-xl ${
        useTouchpad ? 'brightness-110 ring-4 ring-amber-400' : 'hover:brightness-105'
      }`}
    >
      {/* Visual background lines */}
      <div className="absolute inset-0 flex flex-col justify-around py-2 opacity-40 pointer-events-none">
        {strings.map(i => (
          <div key={i} className="h-[2px] w-full bg-black/30 shadow-inner" />
        ))}
      </div>

      {/* Interaction layer */}
      <div className="absolute inset-0 flex flex-col items-stretch">
        {strings.map(i => {
          const stringIdx = (stringsCount - 1) - i;
          const isHighlighted = highlights[stringIdx] !== undefined;
          
          return (
            <div 
              key={i} 
              className="flex-1 cursor-pointer relative group"
              onPointerEnter={(e) => handlePointerEnter(e, stringIdx)}
            >
              {/* Highlight Overlay */}
              <div 
                className={`absolute inset-0 transition-opacity duration-150 pointer-events-none ${
                  isHighlighted 
                    ? 'bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-100' 
                    : 'opacity-0'
                }`}
              />
              
              {/* String Wire Visual */}
              <div className={`h-[1px] w-full absolute top-1/2 -translate-y-1/2 transition-colors ${
                  currentChord ? 'bg-amber-900/20' : 'bg-black/5'
              }`} />
            </div>
          );
        })}
      </div>

      {/* Grid labels */}
      <div className="absolute inset-0 flex flex-col justify-around pointer-events-none px-4">
        {strings.map(i => (
          <div key={i} className="flex justify-between items-center opacity-10">
            <span className="text-[7px] font-black font-mono">{((stringsCount - 1) - i).toString().padStart(2, '0')}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
          </div>
        ))}
      </div>

      {/* Mode Indicator */}
      {useTouchpad && (
        <div className="absolute top-6 right-6 flex items-center gap-3">
            <span className="text-[10px] font-black text-red-900 uppercase tracking-tighter">TOUCHPAD</span>
            <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_10px_red] animate-pulse" />
        </div>
      )}

      {/* Branding */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none opacity-25">
         <span className="branding-text text-3xl tracking-tighter">HARPICHORD</span>
         <span className="text-[10px] font-black tracking-[0.4em] mt-1 italic uppercase">DX STRUM SYSTEM</span>
      </div>

      {/* Locked Overlay */}
      {!currentChord && !useTouchpad && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#c4b598]/30 backdrop-blur-[2px] z-20">
          <div className="bg-amber-950/80 text-white p-6 rounded-xl border border-white/20 shadow-2xl">
            <span className="text-[12px] uppercase font-black tracking-widest block text-center leading-tight">Select Chord<br/>First</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SonicStrings;