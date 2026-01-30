
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { OmnichordState, ChordDefinition, RhythmPattern, DelayDivision, ChordModeKey } from './types';
import { 
  MAJOR_CHORDS, MINOR_CHORDS, DOM7_CHORDS,
  MIN7_CHORDS, MAJ7_CHORDS, ADD9_CHORDS,
  SUS4_CHORDS, POWER_CHORDS, DIM_CHORDS,
  HARP_KEYS 
} from './constants';
import { audioEngine } from './services/audioEngine';
import { midiService } from './services/midiService';
import ChordGrid from './components/ChordGrid';
import SonicStrings from './components/SonicStrings';
import ControlPanel from './components/ControlPanel';
import PianoKeyboard from './components/PianoKeyboard';

const STORAGE_KEY = 'harpichord_v1_state';

const INITIAL_STATE: OmnichordState = {
  currentChord: null,
  chordPage: 0,
  chordVolume: 0.50,   
  harpVolume: 0.50,    
  rhythmVolume: 0.50,  
  bassVolume: 0.25, 
  sustain: 0.4,
  tempo: 120,
  rhythm: RhythmPattern.NONE,
  isPlaying: false,
  useTouchpad: false,
  octave: 0,
  harpOctave: -1, 
  chordCutoff: 1.0,    
  harpCutoff: 1.0,     
  rhythmCutoff: 1.0,   
  bassEnabled: false,  
  bassWaveformMix: 0.0, 
  chordAttack: 0.01,
  chordRelease: 0.2,
  tubeEnabled: false,
  tubeDrive: 0.1, 
  tubeWet: 0.4,
  tubePreset: 'soft',
  delayDivision: '1/8',
  delayFeedback: 0.4,
  delayTone: 0.5,
  delaySpread: 0.3,
  reverbSize: 0.6,
  reverbDamp: 0.3,
  reverbWidth: 0.5,
  reverbColor: 0.2,
  chordDelaySend: 0.0,
  chordReverbSend: 0.1,
  harpDelaySend: 0.3,
  harpReverbSend: 0.3,
  rhythmDelaySend: 0.1,
  rhythmReverbSend: 0.05,
  chordWaveform: 'square',
  harpWaveform: 'triangle',
  vibratoAmount: 0,
  vibratoRate: 5,
  midiInputId: 'all',
  midiChordOutputId: 'none',
  midiChordChannel: 1,
  midiHarpOutputId: 'none',
  midiHarpChannel: 2,
  midiOctaveMap: {
    0: 'Sus4', 1: 'Power', 2: 'Minor 7', 3: 'Minor', 4: 'Major', 5: 'Dominant 7', 6: 'Major 7'
  }
};

const App: React.FC = () => {
  const [state, setState] = useState<OmnichordState>(INITIAL_STATE);
  const [initialized, setInitialized] = useState(false);
  const [scale, setScale] = useState(1);
  const [lastStrumNote, setLastStrumNote] = useState<{midi: number, time: number} | null>(null);
  const [touchpadStrumIndex, setTouchpadStrumIndex] = useState<{index: number, time: number} | null>(null);
  const [activeMidiNote, setActiveMidiNote] = useState<number | null>(null);

  const lastZone = useRef<number | null>(null);
  
  const lastMidiTime = useRef<number>(0);
  const midiEventCounter = useRef<number>(0);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState(prev => ({ 
          ...prev, 
          ...parsed, 
          currentChord: null, 
          isPlaying: false, 
          useTouchpad: false 
        }));
      } catch (e) {
        console.warn("Autoload error:", e);
      }
    }
    midiService.init().catch(() => {});
    setInitialized(true);
  }, []);

  const syncEngine = useCallback((s: OmnichordState) => {
    if (!audioEngine.ctx) return;
    audioEngine.setChordVolume(s.chordVolume);
    audioEngine.setHarpVolume(s.harpVolume);
    audioEngine.setRhythmVolume(s.rhythmVolume);
    audioEngine.setBassVolume(s.bassVolume);
    audioEngine.setSustain(s.sustain);
    audioEngine.setChordAttack(s.chordAttack);
    audioEngine.setChordRelease(s.chordRelease);
    audioEngine.setTempo(s.tempo);
    audioEngine.setOctave(s.octave);
    audioEngine.setHarpOctave(s.harpOctave);
    audioEngine.setChordCutoff(s.chordCutoff);
    audioEngine.setHarpCutoff(s.harpCutoff);
    audioEngine.setRhythmCutoff(s.rhythmCutoff);
    audioEngine.setBassEnabled(s.bassEnabled);
    audioEngine.setBassWaveformMix(s.bassWaveformMix);
    audioEngine.setTubeAmp(s.tubeEnabled, s.tubeDrive, s.tubeWet);
    audioEngine.setChordWaveform(s.chordWaveform);
    audioEngine.setHarpWaveform(s.harpWaveform);
    audioEngine.setVibrato(s.vibratoAmount, s.vibratoRate);
    audioEngine.updateDelay(s.delayDivision, s.delayFeedback, s.delayTone, s.delaySpread);
    audioEngine.updateReverb(s.reverbSize, s.reverbDamp, s.reverbWidth, s.reverbColor);
    audioEngine.setSends({
      chordDelay: s.chordDelaySend, chordReverb: s.chordReverbSend,
      harpDelay: s.harpDelaySend, harpReverb: s.harpReverbSend,
      rhythmDelay: s.rhythmDelaySend, rhythmReverb: s.rhythmReverbSend,
    });
  }, []);

  const initAudioOnInteraction = async () => {
    if (!audioEngine.ctx || audioEngine.ctx.state !== 'running') {
      await audioEngine.init();
      syncEngine(state);
      await midiService.init();
    }
  };

  const handleChordPress = useCallback((chord: ChordDefinition | null) => {
    if (!chord) return;
    initAudioOnInteraction();
    audioEngine.playChord(chord);
    if (state.midiChordOutputId !== 'none') {
      midiService.sendChord(chord, state.midiChordOutputId, state.midiChordChannel);
    }
    setState(prev => ({ ...prev, currentChord: chord }));
  }, [state.midiChordOutputId, state.midiChordChannel, state]); 

  const handleHarpTrigger = useCallback((index: number) => {
    initAudioOnInteraction();
    if (state.currentChord) {
      audioEngine.playHarpNote(state.currentChord, index);
      if (state.midiHarpOutputId !== 'none') {
        midiService.sendHarpNote(
          state.currentChord, 
          index, 
          state.octave, 
          state.harpOctave, 
          state.midiHarpOutputId, 
          state.midiHarpChannel
        );
      }
      const intervalIndex = index % state.currentChord.intervals.length;
      const octaveOffset = Math.floor(index / state.currentChord.intervals.length);
      const midiNote = 60 + (state.octave + state.harpOctave) * 12 + state.currentChord.intervals[intervalIndex] + (octaveOffset * 12);
      setLastStrumNote({ midi: midiNote, time: Date.now() });
      setTouchpadStrumIndex({ index, time: Date.now() });
    }
  }, [state.currentChord, state.octave, state.harpOctave, state.midiHarpOutputId, state.midiHarpChannel]);

  useEffect(() => {
    const handleMidiMessage = (message: Uint8Array, id: string) => {
      if (state.midiInputId === 'none') return;
      if (state.midiInputId !== 'all' && state.midiInputId !== id) return;
      
      const now = Date.now();
      if (now - lastMidiTime.current < 100) {
        midiEventCounter.current++;
        if (midiEventCounter.current > 12) return; 
      } else {
        midiEventCounter.current = 0;
      }
      lastMidiTime.current = now;

      const [status, data1, data2] = message;
      const type = status & 0xf0;
      
      if (type === 0x90 && data2 > 0) { 
        const note = data1;
        const octave = Math.floor(note / 12) - 1; 
        
        if (octave >= 0 && octave <= 6) {
          const mode = state.midiOctaveMap[octave];
          if (mode && mode !== 'None') {
            const rootOffset = note % 12;
            const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
            const rootName = names[rootOffset];
            
            let pool: ChordDefinition[] = [];
            switch(mode) {
              case 'Major': pool = MAJOR_CHORDS; break;
              case 'Minor': pool = MINOR_CHORDS; break;
              case 'Dominant 7': pool = DOM7_CHORDS; break;
              case 'Minor 7': pool = MIN7_CHORDS; break;
              case 'Major 7': pool = MAJ7_CHORDS; break;
              case 'Add9': pool = ADD9_CHORDS; break;
              case 'Sus4': pool = SUS4_CHORDS; break;
              case 'Power': pool = POWER_CHORDS; break;
              case 'Diminished': pool = DIM_CHORDS; break;
            }
            
            const chord = pool.find(c => c.root === rootName);
            if (chord) {
              handleChordPress(chord);
              setActiveMidiNote(note);
            }
          }
        }
      }
    };

    midiService.addListener(handleMidiMessage);
    return () => midiService.removeListener(handleMidiMessage);
  }, [state.midiInputId, state.midiOctaveMap, handleChordPress]);

  useEffect(() => {
    if (!state.useTouchpad) {
      lastZone.current = null;
      return;
    }
    const handlePointerMove = (e: PointerEvent) => {
      const stringsCount = 14;
      const height = window.innerHeight;
      const segment = Math.floor((e.clientY / height) * stringsCount);
      const clampedSegment = Math.max(0, Math.min(stringsCount - 1, segment));
      const targetString = (stringsCount - 1) - clampedSegment;
      if (lastZone.current !== targetString) {
        handleHarpTrigger(targetString);
        lastZone.current = targetString;
      }
    };
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [state.useTouchpad, handleHarpTrigger]);

  const handleKillChord = useCallback(() => {
    audioEngine.stopChord(false);
    audioEngine.stopRhythm();
    midiService.sendChord(null, state.midiChordOutputId, state.midiChordChannel);
    setState(prev => ({ ...prev, currentChord: null, rhythm: RhythmPattern.NONE }));
    setLastStrumNote(null);
    setTouchpadStrumIndex(null);
    setActiveMidiNote(null);
  }, [state.midiChordOutputId, state.midiChordChannel]);

  const handleStateChange = useCallback((updates: Partial<OmnichordState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      
      if (updates.chordVolume !== undefined) audioEngine.setChordVolume(newState.chordVolume);
      if (updates.harpVolume !== undefined) audioEngine.setHarpVolume(newState.harpVolume);
      if (updates.rhythmVolume !== undefined) audioEngine.setRhythmVolume(newState.rhythmVolume);
      if (updates.bassVolume !== undefined) audioEngine.setBassVolume(newState.bassVolume);
      if (updates.sustain !== undefined) audioEngine.setSustain(newState.sustain);
      if (updates.chordAttack !== undefined) audioEngine.setChordAttack(newState.chordAttack);
      if (updates.chordRelease !== undefined) audioEngine.setChordRelease(newState.chordRelease);
      if (updates.tempo !== undefined) {
        audioEngine.setTempo(newState.tempo);
        audioEngine.updateDelay(newState.delayDivision, newState.delayFeedback, newState.delayTone, newState.delaySpread);
        if (newState.rhythm !== RhythmPattern.NONE) audioEngine.startRhythm(newState.rhythm);
      }
      if (updates.rhythm !== undefined) {
        if (newState.rhythm === RhythmPattern.NONE) audioEngine.stopRhythm();
        else audioEngine.startRhythm(newState.rhythm);
      }
      if (updates.octave !== undefined) {
        audioEngine.setOctave(newState.octave);
        if (newState.currentChord) audioEngine.playChord(newState.currentChord);
      }
      if (updates.harpOctave !== undefined) audioEngine.setHarpOctave(newState.harpOctave);
      if (updates.chordCutoff !== undefined) audioEngine.setChordCutoff(newState.chordCutoff);
      if (updates.harpCutoff !== undefined) audioEngine.setHarpCutoff(newState.harpCutoff);
      if (updates.rhythmCutoff !== undefined) audioEngine.setRhythmCutoff(newState.rhythmCutoff);
      if (updates.bassEnabled !== undefined) {
          audioEngine.setBassEnabled(newState.bassEnabled);
          if (newState.currentChord) audioEngine.playChord(newState.currentChord);
      }
      if (updates.bassWaveformMix !== undefined) audioEngine.setBassWaveformMix(newState.bassWaveformMix);
      if (updates.tubeEnabled !== undefined || updates.tubeDrive !== undefined || updates.tubeWet !== undefined) {
          audioEngine.setTubeAmp(newState.tubeEnabled, newState.tubeDrive, newState.tubeWet);
      }
      if (updates.chordWaveform !== undefined) {
          audioEngine.setChordWaveform(newState.chordWaveform);
          if (newState.currentChord) audioEngine.playChord(newState.currentChord);
      }
      if (updates.harpWaveform !== undefined) {
          audioEngine.setHarpWaveform(newState.harpWaveform);
      }
      if (updates.vibratoAmount !== undefined || updates.vibratoRate !== undefined) {
          audioEngine.setVibrato(newState.vibratoAmount, newState.vibratoRate);
      }
      if (updates.delayDivision !== undefined || updates.delayFeedback !== undefined || updates.delayTone !== undefined || updates.delaySpread !== undefined) {
          audioEngine.updateDelay(newState.delayDivision, newState.delayFeedback, newState.delayTone, newState.delaySpread);
      }
      if (updates.reverbSize !== undefined || updates.reverbDamp !== undefined || updates.reverbWidth !== undefined || updates.reverbColor !== undefined) {
          audioEngine.updateReverb(newState.reverbSize, newState.reverbDamp, newState.reverbWidth, newState.reverbColor);
      }
      const sendKeys = ['chordDelaySend', 'chordReverbSend', 'harpDelaySend', 'harpReverbSend', 'rhythmDelaySend', 'rhythmReverbSend'];
      if (sendKeys.some(k => updates.hasOwnProperty(k))) {
          audioEngine.setSends({
            chordDelay: newState.chordDelaySend, chordReverb: newState.chordReverbSend,
            harpDelay: newState.harpDelaySend, harpReverb: newState.harpReverbSend,
            rhythmDelay: newState.rhythmDelaySend, rhythmReverb: newState.rhythmReverbSend,
          });
      }
      return newState;
    });
  }, []);

  const handleReset = useCallback(() => {
    setState(INITIAL_STATE);
    localStorage.removeItem(STORAGE_KEY);
    audioEngine.stopChord(true);
    audioEngine.stopRhythm();
    setLastStrumNote(null);
    setTouchpadStrumIndex(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      initAudioOnInteraction();
      if (e.key === 'Tab') {
        e.preventDefault();
        setState(prev => ({ ...prev, chordPage: (prev.chordPage + 1) % 3 }));
        return;
      }
      const key = e.key.toUpperCase();
      let currentSetChords: ChordDefinition[] = [];
      switch (state.chordPage) {
        case 1: currentSetChords = [...MIN7_CHORDS, ...MAJ7_CHORDS, ...ADD9_CHORDS]; break;
        case 2: currentSetChords = [...SUS4_CHORDS, ...POWER_CHORDS, ...DIM_CHORDS]; break;
        default: currentSetChords = [...MAJOR_CHORDS, ...MINOR_CHORDS, ...DOM7_CHORDS];
      }
      const chordMatch = currentSetChords.find(c => {
          const cKey = c.key.toUpperCase();
          if (cKey === 'SHIFT' && e.shiftKey) return true;
          if (cKey === 'ENTER' && e.key === 'Enter') return true;
          if (cKey === 'CONTROL' && (e.ctrlKey || e.metaKey)) return true;
          return cKey === key || c.key === e.key;
      });
      if (chordMatch) {
        e.preventDefault();
        handleChordPress(chordMatch);
        return;
      }
      if (HARP_KEYS.includes(e.key)) {
        handleHarpTrigger(HARP_KEYS.indexOf(e.key));
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.chordPage, handleChordPress, handleHarpTrigger]);

  const updateScale = useCallback(() => {
    const baseW = 1780; 
    const baseH = 1000; 
    const padding = 20;
    const ratio = Math.min((window.innerWidth - padding) / baseW, (window.innerHeight - padding) / baseH);
    setScale(Math.max(0.3, ratio)); 
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050505] overflow-hidden select-none">
      <div 
        style={{ transform: `scale(${scale})`, transformOrigin: 'center center', width: '1780px', height: '1000px', flexShrink: 0 }} 
        className="omnichord-body pt-10 pb-6 px-40 rounded-[7.5rem] border border-[#c4b598] relative transition-all shadow-[0_120px_240px_rgba(0,0,0,1)] flex flex-col justify-between"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1060px] h-4 bg-black/5 rounded-b-[2rem] border-b border-black/5" />
        <div className="flex justify-between items-start w-full px-40 pt-0 relative min-h-[100px]">
          <div className="w-[440px] flex items-center gap-6 mt-1.5">
            <div className="flex items-center gap-6 bg-black/10 px-6 py-2 rounded-full border border-black/10 shadow-inner">
              <div className={`w-5 h-5 rounded-full border-2 border-black/40 transition-all duration-700 ${initialized ? 'bg-green-600 shadow-[0_0_20px_rgba(22,163,74,0.6)]' : 'bg-green-950'}`} />
              <div className="w-px h-6 bg-black/15" />
              <div className="flex flex-col">
                  {/* Updated Version to 6.04 */}
                  <span className="text-[10px] font-black text-orange-900/60 tracking-[0.2em] uppercase leading-none">V6.04 OMNI_CORE</span>
              </div>
            </div>
            <div className="flex flex-col">
                <span className="text-[9px] font-black tracking-[0.2em] text-orange-900/10 uppercase italic leading-none">ANALOG MODELING</span>
                <span className="text-[9px] font-black tracking-[0.2em] text-orange-900/10 uppercase italic leading-none mt-1">POLYPHONIC BRIDGE</span>
            </div>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <span className="branding-text text-6xl tracking-[-0.08em] opacity-90 leading-none">HARPICHORD</span>
            <span className="text-[12px] font-black tracking-[0.5em] text-orange-900/40 uppercase mt-2 italic">STIJN DE RYCK • 2026</span>
          </div>
          <div className="w-[300px] flex justify-end mt-1.5">
            <span className="text-[9px] font-black tracking-[0.2em] text-orange-900/10 uppercase italic">MADE IN THE NETHERLANDS</span>
          </div>
        </div>
        <div className="flex w-full gap-16 items-start justify-center px-40 flex-1 mt-2">
          <div className="w-[28%] min-w-[440px]">
            <ControlPanel state={state} onChange={handleStateChange} onReset={handleReset} />
          </div>
          <div className="flex-1 flex flex-col gap-4 items-center justify-start relative">
            <div className="w-full h-[580px] bg-[#dcd0b8] rounded-[5rem] border border-[#bdae93] shadow-[inset_0_25px_50px_rgba(0,0,0,0.2)] flex items-center justify-center p-8">
              <ChordGrid 
                activeChord={state.currentChord} 
                currentPage={state.chordPage}
                onPress={handleChordPress} 
                onRelease={() => {}} 
                onSetPage={(p) => handleStateChange({ chordPage: p })}
              />
            </div>
            <div className="flex flex-col items-center gap-6 w-full">
                <div className="flex items-center gap-12">
                    <div className="w-40 h-[1.5px] bg-orange-900/20" />
                    <button onClick={handleKillChord} className="w-[58px] h-[58px] rounded-full bg-[#b00] border-2 border-[#800] shadow-[0_8px_0_#500] active:translate-y-2 active:shadow-none transition-all flex items-center justify-center cursor-pointer group relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="text-[10px] font-black text-white uppercase text-center leading-tight tracking-widest group-active:scale-90 transition-transform relative z-10">KILL<br/><span className="text-[8px] opacity-60 font-bold">RESET</span></span>
                    </button>
                    <div className="w-40 h-[1.5px] bg-orange-900/20" />
                </div>
                <div className="w-[900px] mt-[20px]">
                    <div className="w-full bg-[#dcd0b8] rounded-[3rem] border border-[#bdae93] shadow-[inset_0_8px_16px_rgba(0,0,0,0.1),0_10px_30px_rgba(0,0,0,0.15)] p-3">
                      <PianoKeyboard 
                        currentChord={state.currentChord} 
                        octave={state.octave} 
                        bassEnabled={state.bassEnabled}
                        lastStrumHit={lastStrumNote}
                      />
                    </div>
                </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-10">
             <SonicStrings 
                currentChord={state.currentChord} 
                useTouchpad={state.useTouchpad} 
                onTrigger={handleHarpTrigger}
                lastTriggeredIndex={touchpadStrumIndex}
             />
             {/* V6.04: Corrected shadow from 120px to 10px to fix position of black mask */}
             <button onClick={() => handleStateChange({ useTouchpad: !state.useTouchpad })} className={`w-[90px] h-[90px] rounded-[2rem] border-[4px] border-black transition-all flex items-center justify-center cursor-pointer shadow-[0_10px_0_#000] active:translate-y-2 active:shadow-none group ${state.useTouchpad ? 'bg-orange-600 border-orange-800' : 'bg-[#1a1a1a] border-[#0a0a0a]'}`}>
                <div className="flex flex-col items-center leading-none text-white group-active:scale-90 transition-transform text-center">
                    <span className={`text-[12px] font-black tracking-widest mb-2 ${state.useTouchpad ? 'text-black' : 'opacity-40'}`}>TOUCH</span>
                    <span className={`text-[12px] font-black tracking-widest ${state.useTouchpad ? 'text-black' : ''}`}>PAD</span>
                </div>
             </button>
          </div>
        </div>
        <div className="h-6" />
      </div>
    </div>
  );
};

export default App;
