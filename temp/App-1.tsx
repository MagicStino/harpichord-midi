
import React, { useState, useEffect, useRef } from 'react';
import { MidiManager } from './midi/MidiManager';
import { MidiInstrument } from './midi/MidiInstrument';
import { SynthEngine } from './services/SynthEngine';
import { MidiConfigPanel } from './components/MidiConfigPanel';
import { MidiDevice, MidiInstrumentConfig, MidiCommand } from './types';
import { 
  Activity, 
  RefreshCw, 
  ShieldCheck, 
  Settings2,
  Waves
} from 'lucide-react';

const App: React.FC = () => {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [status, setStatus] = useState('Initializing...');
  
  const [inst1Config, setInst1Config] = useState<MidiInstrumentConfig>({
    id: 'inst-1',
    name: 'Primary Instrument',
    inputId: 'all',
    outputId: 'none',
    inputChannel: 0,
    outputChannel: 1,
  });

  const manager = useRef(MidiManager.getInstance());
  const synth = useRef(new SynthEngine('sine'));
  const inst1 = useRef<MidiInstrument | null>(null);

  // Auto-init on load
  useEffect(() => {
    const init = async () => {
      const result = await manager.current.requestAccess();
      setDevices(manager.current.getDevices());
      setStatus(result.physical ? 'Ready' : 'Limited Mode');
    };
    init();

    // Setup the instrument logic
    inst1.current = new MidiInstrument(inst1Config);
    const unsub = inst1.current.onMessage((cmd, ch, note, vel) => {
      if (cmd === MidiCommand.NoteOn && vel > 0) synth.current.noteOn(note, vel);
      else if (cmd === MidiCommand.NoteOff || (cmd === MidiCommand.NoteOn && vel === 0)) synth.current.noteOff(note);
    });

    return () => {
      unsub();
      inst1.current?.dispose();
    };
  }, []);

  // Sync config changes
  useEffect(() => { inst1.current?.updateConfig(inst1Config); }, [inst1Config]);

  const refreshDevices = () => {
    manager.current.requestAccess();
    setDevices(manager.current.getDevices());
  };

  return (
    <div className="p-4 md:p-12 max-w-3xl mx-auto space-y-12 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-900 pb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3 italic">
            <Activity className="text-indigo-500" /> MIDI CONFIG
          </h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium italic">Plugin Core Management Console</p>
        </div>
        
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-zinc-400 text-[10px] font-black rounded-lg border border-zinc-800 uppercase tracking-widest">
            <ShieldCheck size={14} className={status === 'Ready' ? "text-emerald-500" : "text-amber-500"} />
            {status}
          </div>
          <button 
            onClick={refreshDevices}
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg border border-zinc-800 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <main className="space-y-8">
        <section>
          <MidiConfigPanel 
            config={inst1Config} 
            devices={devices} 
            onUpdate={(u) => setInst1Config(prev => ({ ...prev, ...u }))} 
          />
        </section>

        {/* Status Indicator */}
        <section className="bg-zinc-950/50 border border-zinc-900 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400">
             <Waves size={24} />
          </div>
          <div className="space-y-1">
             <h4 className="text-xs font-black text-zinc-100 uppercase tracking-widest">Signal Chain Active</h4>
             <p className="text-[10px] text-zinc-500 leading-relaxed max-w-[200px]">
               Routing MIDI events from <b>{inst1Config.inputId === 'all' ? 'All Devices' : inst1Config.inputId}</b> to <b>{inst1Config.outputId === 'none' ? 'Internal Synth' : inst1Config.outputId}</b>.
             </p>
          </div>
        </section>
      </main>

      <footer className="pt-8 border-t border-zinc-900">
        <div className="flex items-center gap-4 text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
          <Settings2 size={14} />
          <span>Plugin Mode: Integration Ready</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
