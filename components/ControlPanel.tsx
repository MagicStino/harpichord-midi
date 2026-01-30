
import React, { useState, useEffect, useRef } from 'react';
import { RhythmPattern, OmnichordState, DelayDivision, WaveformType, MidiDevice, ChordModeKey } from '../types';
import { midiService } from '../services/midiService';

interface KnobProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  labelColor?: string;
  labelSize?: 'xs' | 'sm' | 'base';
}

const Knob: React.FC<KnobProps> = ({ 
  label, 
  value, 
  onChange, 
  color = 'orange-600', 
  size = 'md', 
  labelColor = 'text-orange-950/80',
  labelSize = 'xs'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = startY.current - e.clientY;
      const newValue = Math.min(1, Math.max(0, startValue.current + delta / 150));
      onChange(newValue);
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onChange]);

  const rotation = -135 + value * 270;
  const sizeClass = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-20 h-20' : 'w-14 h-14';
  const labelSizeClass = labelSize === 'sm' ? 'text-[11px]' : labelSize === 'base' ? 'text-[13px]' : 'text-[9.5px]';

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div 
        onMouseDown={handleMouseDown}
        className={`${sizeClass} rounded-full retro-knob relative cursor-ns-resize shadow-[0_4px_8px_rgba(0,0,0,0.4)] border-2 border-[#1a1a1a]`}
      >
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[85%] rounded-full bg-[#222]"
          style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
        >
          <div className={`absolute top-1 left-1/2 -translate-x-1/2 w-1 h-2.5 bg-${color} rounded-full shadow-[0_0_8px_currentColor]`} />
        </div>
      </div>
      {label && (
        <label className={`${labelSizeClass} font-black tracking-widest mt-0.5 text-center leading-tight uppercase ${labelColor}`}>
          {label}
        </label>
      )}
    </div>
  );
};

interface ControlPanelProps {
  state: OmnichordState;
  onChange: (updates: Partial<OmnichordState>) => void;
  onReset: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ state, onChange, onReset }) => {
  const [activeTab, setActiveTab] = useState<'MAIN' | 'DRUMS' | 'FX' | 'SOUND' | 'I/O'>('MAIN');
  const [ioSubTab, setIoSubTab] = useState<'MIDI OUT' | 'MIDI IN' | 'MIDI LOG'>('MIDI OUT');
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [midiLogs, setMidiLogs] = useState<string[]>([]);

  useEffect(() => {
    const handleDevicesUpdate = () => {
      setDevices(midiService.getDevices());
    };
    window.addEventListener('midiDevicesChanged', handleDevicesUpdate);
    handleDevicesUpdate();
    return () => window.removeEventListener('midiDevicesChanged', handleDevicesUpdate);
  }, []);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setMidiLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 15));
  };

  const parseMidi = (msg: Uint8Array, id: string) => {
    const [status, d1, d2] = msg;
    const cmd = status & 0xF0;
    const ch = (status & 0x0F) + 1;
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const prefix = `${id.slice(0,4)}: `;
    
    if (cmd === 0x90 && d2 > 0) {
      const oct = Math.floor(d1 / 12) - 1;
      return `${prefix}▶ NOTE ON | ${names[d1 % 12]}${oct} | VEL: ${d2} | CH: ${ch}`;
    }
    if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
      const oct = Math.floor(d1 / 12) - 1;
      return `${prefix}■ NOTE OFF | ${names[d1 % 12]}${oct} | CH: ${ch}`;
    }
    if (cmd === 0xB0) return `${prefix}⚙ CC | NO: ${d1} | VAL: ${d2} | CH: ${ch}`;
    if (cmd === 0xE0) return `${prefix}〰 BEND | VAL: ${((d2 << 7) | d1)} | CH: ${ch}`;
    
    return `${prefix}HEX: ${Array.from(msg).map(b => b.toString(16).padStart(2, '0')).join(' ')}`;
  };

  useEffect(() => {
    const handleMidiIn = (msg: Uint8Array, id: string) => {
      if (activeTab === 'I/O') {
        addLog(parseMidi(msg, id));
      }
    };
    midiService.addListener(handleMidiIn);
    return () => midiService.removeListener(handleMidiIn);
  }, [activeTab]);

  const handleRefreshDevices = () => {
    midiService.init();
    const newDevices = midiService.getDevices();
    setDevices(newDevices);
    
    addLog("--- SYSTEM REFRESH ---");
    const inputs = newDevices.filter(d => d.type === 'input');
    const outputs = newDevices.filter(d => d.type === 'output');
    
    inputs.forEach(d => addLog(`DETECTED IN: ${d.name}`));
    outputs.forEach(d => addLog(`DETECTED OUT: ${d.name}`));
    
    addLog(`FOUND ${inputs.length} INPUTS / ${outputs.length} OUTPUTS.`);
  };

  const applyTubePreset = (preset: 'clean' | 'soft' | 'warm' | 'hot') => {
    let drive = 0;
    let wet = 0;
    let enabled = true;
    switch(preset) {
      case 'clean': enabled = false; drive = 0; wet = 0; break;
      case 'soft': drive = 0.05; wet = 0.25; break; // V5.03: Extra subtle Soft setting
      case 'warm': drive = 0.45; wet = 0.5; break;
      case 'hot': drive = 0.85; wet = 0.7; break;
    }
    onChange({ tubePreset: preset, tubeEnabled: enabled, tubeDrive: drive, tubeWet: wet });
  };

  const outputs = devices.filter(d => d.type === 'output');
  const inputs = devices.filter(d => d.type === 'input');

  const updateOctaveMap = (octave: number, mode: ChordModeKey) => {
    const newMap = { ...state.midiOctaveMap, [octave]: mode };
    onChange({ midiOctaveMap: newMap });
  };

  const chordModes: ChordModeKey[] = ['None', 'Major', 'Minor', 'Dominant 7', 'Minor 7', 'Major 7', 'Add9', 'Sus4', 'Power', 'Diminished'];

  return (
    <div className="flex flex-col h-fit max-h-[880px] bg-[#dcd0b8] rounded-[2.5rem] border-[4px] border-[#bdae93] shadow-[inset_0_4px_10px_rgba(0,0,0,0.1)] text-orange-950 font-black uppercase tracking-tight overflow-hidden">
      
      <div className="flex border-b border-black/5 bg-black/5">
        {(['MAIN', 'DRUMS', 'FX', 'SOUND', 'I/O'] as const).map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-[10px] font-black tracking-[0.1em] transition-all ${
              activeTab === tab ? 'bg-[#dcd0b8] text-orange-950 border-b-2 border-orange-800' : 'text-orange-900/40'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        {activeTab === 'MAIN' ? (
          <>
            <div className="bg-orange-950/5 p-3 rounded-2xl border-[3px] border-orange-950/20 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-900 leading-none block mb-1">CHORD SECTION</span>
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 justify-items-center">
                   <Knob label="CHORD VOL" size="sm" value={state.chordVolume} onChange={(v) => onChange({ chordVolume: v })} />
                   <Knob label="CHORD CUT" size="sm" value={state.chordCutoff} onChange={(v) => onChange({ chordCutoff: v })} />
                   <Knob label="ATTACK" size="sm" value={state.chordAttack} onChange={(v) => onChange({ chordAttack: v })} />
                   <Knob label="RELEASE" size="sm" value={state.chordRelease} onChange={(v) => onChange({ chordRelease: v })} />
                </div>
            </div>

            <div className="bg-orange-950/5 p-3 rounded-2xl border-[3px] border-orange-950/20 space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-900 leading-none">HARP MODULE</span>
                    <div className="flex gap-1">
                        {[-2, -1, 0, 1].map(oct => (
                            <button key={oct} onClick={() => onChange({ harpOctave: oct })} className={`w-6 h-6 rounded text-[9px] flex items-center justify-center border-2 transition-all ${state.harpOctave === oct ? 'bg-orange-600 text-white border-orange-800' : 'bg-white/50 border-orange-900/20'}`}>{oct}</button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-1 justify-items-center items-end">
                    <Knob label="VOL" size="sm" value={state.harpVolume} onChange={(v) => onChange({ harpVolume: v })} />
                    <Knob label="CUT" size="sm" value={state.harpCutoff} onChange={(v) => onChange({ harpCutoff: v })} />
                    <Knob label="SUSTAIN" size="sm" value={state.sustain} onChange={(v) => onChange({ sustain: v })} />
                    <div className="flex flex-col items-center gap-1 pb-1">
                        <span className="text-[9.5px] font-black opacity-60 uppercase tracking-widest">OCTAVE</span>
                        <div className="text-[11px] bg-black/10 px-2 py-0.5 rounded border border-black/5">{state.harpOctave}</div>
                    </div>
                </div>
            </div>

            <div className="bg-orange-950/5 p-3 rounded-2xl border-[3px] border-orange-950/20 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-900 leading-none block">BASS MODULE</span>
                <div className="grid grid-cols-3 gap-2 justify-items-center items-center">
                    <Knob label="BASS VOL" size="sm" value={state.bassVolume} onChange={(v) => onChange({ bassVolume: v })} />
                    <button onClick={() => onChange({ bassEnabled: !state.bassEnabled })} className={`w-full h-12 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${state.bassEnabled ? 'bg-orange-800 border-orange-950 text-white' : 'bg-black/10 border-black/20 text-black/40'}`}>
                        <span className="text-[10px] font-black leading-none mb-0.5">BASS</span>
                        <span className="text-[8px] font-black opacity-70 uppercase">{state.bassEnabled ? 'ON' : 'OFF'}</span>
                    </button>
                    <div className="flex flex-col items-center">
                        <Knob label="" size="sm" value={state.bassWaveformMix} onChange={(v) => onChange({ bassWaveformMix: v })} />
                        <span className="text-[9.5px] font-black opacity-60 mt-1 uppercase text-center leading-tight tracking-widest">SINE / SAW</span>
                    </div>
                </div>
            </div>

            <div className="bg-orange-950/5 p-3 rounded-2xl border-[3px] border-orange-950/20 space-y-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-900 leading-none block">MASTER TUBE</span>
                <button 
                  onClick={() => onChange({ tubeEnabled: !state.tubeEnabled })} 
                  className={`px-3 py-1 rounded-full border-2 text-[8px] font-black transition-all ${state.tubeEnabled ? 'bg-orange-600 border-orange-800 text-black shadow-[0_0_10px_rgba(234,88,12,0.3)]' : 'bg-black/10 border-black/20 text-black/40'}`}
                >
                  {state.tubeEnabled ? 'ACTIVE' : 'BYPASS'}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1 mb-2">
                {(['clean', 'soft', 'warm', 'hot'] as const).map(p => (
                  <button key={p} onClick={() => applyTubePreset(p)} className={`py-1 rounded text-[9px] font-black border-2 transition-all uppercase ${state.tubePreset === p ? 'bg-orange-500 text-black border-orange-700' : 'bg-white/40 border-orange-900/10 text-orange-900/60 hover:bg-white/60'}`}>{p}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 justify-items-center">
                {/* V6.01: Touching the drive knob now automatically turns the tube ON */}
                <Knob label="DRIVE" size="sm" color="orange-500" value={state.tubeDrive} onChange={(v) => onChange({ tubeDrive: v, tubeEnabled: true })} />
                <Knob label="WET" size="sm" color="orange-500" value={state.tubeWet} onChange={(v) => onChange({ tubeWet: v })} />
              </div>
            </div>
          </>
        ) : activeTab === 'DRUMS' ? (
          <div className="flex flex-col gap-4 py-1">
             <div className="flex flex-col bg-orange-950/5 p-3 rounded-2xl border-[3px] border-orange-950/20 gap-2">
                <div className="flex justify-between items-center px-2">
                    <label className="text-[11px] font-black opacity-60 tracking-widest">TEMPO BPM</label>
                    <input type="number" min="40" max="240" value={state.tempo} onChange={(e) => onChange({ tempo: parseInt(e.target.value) || 40 })} className="w-16 bg-black/15 text-orange-900 text-center py-1 rounded border-2 border-orange-950/20 text-[13px] font-black outline-none" />
                </div>
                <div className="flex justify-center">
                    <Knob label="" size="sm" value={(state.tempo - 40) / 200} onChange={(v) => onChange({ tempo: Math.round(40 + v * 200) })} />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-2 justify-items-center bg-orange-950/5 p-3 rounded-2xl border-[3px] border-orange-950/20">
                <Knob label="DRUMS VOL" size="sm" value={state.rhythmVolume} onChange={(v) => onChange({ rhythmVolume: v })} />
                <Knob label="DRUM CUT" size="sm" value={state.rhythmCutoff} onChange={(v) => onChange({ rhythmCutoff: v })} />
             </div>
             <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                {Object.values(RhythmPattern).filter(p => p !== RhythmPattern.NONE).map(p => (
                  <button key={p} onClick={() => onChange({ rhythm: state.rhythm === p ? RhythmPattern.NONE : p })} className={`w-full py-2.5 rounded-xl border-2 text-[11px] font-black uppercase transition-all ${state.rhythm === p ? 'bg-orange-800 text-white border-orange-950 shadow-inner' : 'bg-[#eee3ce] border-[#bdae93]'}`}>{p}</button>
                ))}
             </div>
          </div>
        ) : activeTab === 'FX' ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="bg-[#1a1a1a] p-4 rounded-3xl border-2 border-cyan-500/50 space-y-4">
              <div className="flex flex-col gap-2">
                 <h3 className="text-[11px] text-cyan-400 font-black uppercase tracking-widest italic">DELAY</h3>
                 <div className="grid grid-cols-5 gap-1">
                    {['1/4', '1/4D', '1/4T', '1/8', '1/8D', '1/8T', '1/16', '1/16D', '1/16T', '1/3', '1/5'].map(div => (
                      <button key={div} onClick={() => onChange({ delayDivision: div as DelayDivision })} className={`px-1 py-2 rounded text-[11px] font-black border-2 transition-all ${state.delayDivision === div ? 'bg-cyan-500 text-black border-cyan-400' : 'text-cyan-500 border-cyan-900/30'}`}>{div}</button>
                    ))}
                 </div>
              </div>
              <div className="grid grid-cols-3 gap-2 justify-items-center">
                 <Knob label="FEEDBACK" size="sm" color="cyan-400" labelColor="text-cyan-400" value={state.delayFeedback} onChange={(v) => onChange({ delayFeedback: v })} />
                 <Knob label="TONE" size="sm" color="cyan-400" labelColor="text-cyan-400" value={state.delayTone} onChange={(v) => onChange({ delayTone: v })} />
                 <Knob label="SPREAD" size="sm" color="cyan-400" labelColor="text-cyan-400" value={state.delaySpread} onChange={(v) => onChange({ delaySpread: v })} />
              </div>
              <div className="pt-2 border-t border-cyan-500/10 grid grid-cols-3 gap-1">
                <Knob label="CHORD DEL" size="sm" color="cyan-400" labelColor="text-cyan-400" value={state.chordDelaySend} onChange={(v) => onChange({ chordDelaySend: v })} />
                <Knob label="HARP DEL" size="sm" color="cyan-400" labelColor="text-cyan-400" value={state.harpDelaySend} onChange={(v) => onChange({ harpDelaySend: v })} />
                <Knob label="DRUM DEL" size="sm" color="cyan-400" labelColor="text-cyan-400" value={state.rhythmDelaySend} onChange={(v) => onChange({ rhythmDelaySend: v })} />
              </div>
            </div>
            <div className="bg-[#1a1a1a] p-4 rounded-3xl border-2 border-purple-500/50 space-y-4">
               <h3 className="text-[11px] text-purple-400 font-black uppercase tracking-widest italic">REVERB</h3>
               <div className="grid grid-cols-3 gap-2 justify-items-center">
                 <Knob label="SIZE" size="sm" color="purple-400" labelColor="text-purple-400" value={state.reverbSize} onChange={(v) => onChange({ reverbSize: v })} />
                 <Knob label="DAMP" size="sm" color="purple-400" labelColor="text-purple-400" value={state.reverbDamp} onChange={(v) => onChange({ reverbDamp: v })} />
                 <Knob label="COLOR" size="sm" color="purple-400" labelColor="text-purple-400" value={state.reverbColor} onChange={(v) => onChange({ reverbColor: v })} />
               </div>
               <div className="pt-2 border-t border-purple-500/10 grid grid-cols-3 gap-1">
                <Knob label="CHORD REV" size="sm" color="purple-400" labelColor="text-purple-400" value={state.chordReverbSend} onChange={(v) => onChange({ chordReverbSend: v })} />
                <Knob label="HARP REV" size="sm" color="purple-400" labelColor="text-purple-400" value={state.harpReverbSend} onChange={(v) => onChange({ harpReverbSend: v })} />
                <Knob label="DRUM REV" size="sm" color="purple-400" labelColor="text-purple-400" value={state.rhythmReverbSend} onChange={(v) => onChange({ rhythmReverbSend: v })} />
              </div>
            </div>
          </div>
        ) : activeTab === 'SOUND' ? (
          <div className="flex flex-col gap-6 py-2">
             <div className="bg-[#1a1a1a] p-5 rounded-3xl border-2 border-orange-400/30 space-y-4">
                <h3 className="text-[12px] text-amber-300 tracking-widest text-center uppercase font-black">OSC WAVEFORMS</h3>
                <div className="flex gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <span className="text-[11px] text-center text-amber-300/70 uppercase font-black tracking-widest mb-1">CHORD</span>
                    {['sine', 'triangle', 'square', 'sawtooth'].map(w => (
                      <button key={w} onClick={() => onChange({ chordWaveform: w as WaveformType })} className={`py-2 rounded text-[12px] font-black border-2 transition-all uppercase tracking-wider ${state.chordWaveform === w ? 'bg-orange-600 text-black border-orange-400 shadow-[0_0_12px_rgba(234,88,12,0.3)]' : 'text-orange-800 border-orange-900/40'}`}>{w}</button>
                    ))}
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <span className="text-[11px] text-center text-amber-300/70 uppercase font-black tracking-widest mb-1">HARP</span>
                    {['sine', 'triangle', 'square', 'sawtooth'].map(w => (
                      <button key={w} onClick={() => onChange({ harpWaveform: w as WaveformType })} className={`py-2 rounded text-[12px] font-black border-2 transition-all uppercase tracking-wider ${state.harpWaveform === w ? 'bg-orange-600 text-black border-orange-400 shadow-[0_0_12px_rgba(234,88,12,0.3)]' : 'text-orange-800 border-orange-900/40'}`}>{w}</button>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t border-orange-900/40 space-y-3">
                   <h3 className="text-[11px] text-amber-300 tracking-widest text-center uppercase font-black">VIBRATO LFO</h3>
                   <div className="grid grid-cols-2 gap-4 justify-items-center">
                      <Knob label="AMOUNT" size="sm" color="orange-400" labelColor="text-amber-200" value={state.vibratoAmount} onChange={(v) => onChange({ vibratoAmount: v })} />
                      <Knob label="RATE" size="sm" color="orange-400" labelColor="text-amber-200" value={state.vibratoRate / 20} onChange={(v) => onChange({ vibratoRate: v * 20 })} />
                   </div>
                </div>
             </div>
             <button onClick={onReset} className="px-8 py-3 bg-[#800] text-white text-[14px] font-black tracking-widest rounded-full uppercase shadow-lg hover:brightness-110 active:translate-y-0.5 transition-all">Factory Reset</button>
          </div>
        ) : (
          <div className="flex flex-col h-full bg-[#1a1a1a] p-4 rounded-3xl border-2 border-indigo-500/30 overflow-hidden">
             
             {/* Sub-tabs for MIDI IO */}
             <div className="flex bg-black/40 rounded-xl p-1 mb-4 border border-indigo-500/10">
                {(['MIDI OUT', 'MIDI IN', 'MIDI LOG'] as const).map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setIoSubTab(tab)}
                    className={`flex-1 py-1.5 text-[9px] font-black tracking-widest transition-all rounded-lg ${
                      ioSubTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-400/50 hover:text-indigo-400'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 px-1">
                {ioSubTab === 'MIDI OUT' ? (
                  <div className="space-y-4">
                    <h3 className="text-[11px] text-indigo-400 font-black tracking-widest uppercase italic border-b border-indigo-500/20 pb-2">MIDI OUTPUT DEVICES</h3>
                    
                    <div className="bg-black/20 rounded-xl p-3 space-y-3 border border-indigo-500/10">
                      <h4 className="text-[10px] text-zinc-400 font-black tracking-wider uppercase">CHORD SIGNAL</h4>
                      <select 
                        value={state.midiChordOutputId} 
                        onChange={(e) => onChange({ midiChordOutputId: e.target.value })}
                        className="w-full bg-[#111] text-[#eee] border-2 border-[#444] rounded-lg p-2 text-[10px] font-bold outline-none cursor-pointer hover:border-indigo-500 focus:border-indigo-500 transition-all appearance-none"
                        style={{ backgroundImage: 'linear-gradient(45deg, transparent 50%, #888 50%), linear-gradient(135deg, #888 50%, transparent 50%)', backgroundPosition: 'calc(100% - 20px) center, calc(100% - 15px) center', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                      >
                        <option value="none">OFF</option>
                        <option value="all">ALL PORTS</option>
                        {outputs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">CH {state.midiChordChannel}</label>
                        <input 
                          type="range" min="1" max="16" step="1" 
                          value={state.midiChordChannel} 
                          onChange={(e) => onChange({ midiChordChannel: parseInt(e.target.value) })}
                          className="w-2/3 accent-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="bg-black/20 rounded-xl p-3 space-y-3 border border-indigo-500/10">
                      <h4 className="text-[10px] text-zinc-400 font-black tracking-wider uppercase">HARP SIGNAL</h4>
                      <select 
                        value={state.midiHarpOutputId} 
                        onChange={(e) => onChange({ midiHarpOutputId: e.target.value })}
                        className="w-full bg-[#111] text-[#eee] border-2 border-[#444] rounded-lg p-2 text-[10px] font-bold outline-none cursor-pointer hover:border-indigo-500 focus:border-indigo-500 transition-all appearance-none"
                        style={{ backgroundImage: 'linear-gradient(45deg, transparent 50%, #888 50%), linear-gradient(135deg, #888 50%, transparent 50%)', backgroundPosition: 'calc(100% - 20px) center, calc(100% - 15px) center', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                      >
                        <option value="none">OFF</option>
                        <option value="all">ALL PORTS</option>
                        {outputs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">CH {state.midiHarpChannel}</label>
                        <input 
                          type="range" min="1" max="16" step="1" 
                          value={state.midiHarpChannel} 
                          onChange={(e) => onChange({ midiHarpChannel: parseInt(e.target.value) })}
                          className="w-2/3 accent-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ) : ioSubTab === 'MIDI IN' ? (
                  <div className="space-y-4">
                    <h3 className="text-[11px] text-indigo-400 font-black tracking-widest uppercase italic border-b border-indigo-500/20 pb-2">MIDI INPUT & OCTAVE MAPPING</h3>
                    
                    <div className="space-y-3">
                      <select 
                        value={state.midiInputId} 
                        onChange={(e) => onChange({ midiInputId: e.target.value })}
                        className="w-full bg-[#111] text-[#eee] border-2 border-[#444] rounded-lg p-2 text-[10px] font-bold outline-none cursor-pointer hover:border-indigo-500 focus:border-indigo-500 transition-all appearance-none"
                        style={{ backgroundImage: 'linear-gradient(45deg, transparent 50%, #888 50%), linear-gradient(135deg, #888 50%, transparent 50%)', backgroundPosition: 'calc(100% - 20px) center, calc(100% - 15px) center', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                      >
                        <option value="none">INPUT DISABLED</option>
                        <option value="all">OMNI (ALL DEVICES)</option>
                        {inputs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                    </div>

                    <div className="bg-black/20 rounded-xl p-3 space-y-3 border border-indigo-500/10">
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500 font-black tracking-widest px-1 uppercase mb-2">
                        <span>MIDI RANGE</span>
                        <span>CHORD MODE</span>
                      </div>
                      {[0, 1, 2, 3, 4, 5, 6].map(oct => (
                        <div key={oct} className="grid grid-cols-2 gap-3 items-center">
                          <span className="text-[14px] text-zinc-200 font-black tracking-tight font-mono">C{oct} - B{oct}</span>
                          <select 
                            value={state.midiOctaveMap[oct] || 'None'}
                            onChange={(e) => updateOctaveMap(oct, e.target.value as ChordModeKey)}
                            className="bg-[#111] text-indigo-400 border-2 border-[#444] rounded-lg px-2 py-1.5 text-[12px] font-black outline-none focus:border-indigo-500 transition-all cursor-pointer"
                          >
                            {chordModes.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 h-full flex flex-col">
                    <h3 className="text-[11px] text-indigo-400 font-black tracking-widest uppercase italic border-b border-indigo-500/20 pb-2">MIDI EVENT LOG</h3>
                    <div className="bg-black/40 rounded-xl p-4 border border-indigo-500/10 font-mono text-[13px] text-indigo-400 flex-1 min-h-[360px] max-h-[480px] overflow-y-auto custom-scrollbar">
                      {midiLogs.length === 0 ? (
                        <div className="h-full flex items-center justify-center opacity-30 italic">No MIDI data detected...</div>
                      ) : (
                        midiLogs.map((log, i) => (
                          <div key={i} className="mb-2 border-b border-indigo-500/5 pb-2 last:border-0 leading-relaxed font-black tracking-tight">{log}</div>
                        ))
                      )}
                    </div>
                  </div>
                )}
             </div>
             
             <button onClick={handleRefreshDevices} className="mt-4 w-full py-2 bg-indigo-900/20 text-indigo-400 text-[10px] font-black tracking-widest rounded-xl border border-indigo-500/20 uppercase hover:bg-indigo-900/40 transition-colors">
               Refresh Devices
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;
