import { ChordDefinition, MidiDevice } from '../types';

export type MidiListener = (message: Uint8Array, deviceId: string) => void;

class MidiManager {
  private static instance: MidiManager;
  private midiAccess: MIDIAccess | null = null;
  private inputs: Map<string, MIDIInput> = new Map();
  private outputs: Map<string, MIDIOutput> = new Map();
  private listeners: Set<MidiListener> = new Set();
  
  // Track active chord notes to send explicit Note Offs
  private activeChordNotes: Map<string, number[]> = new Map();
  
  // LOOP PREVENTION: Ignore incoming messages for a short window after sending
  private lockoutUntil: number = 0;
  private LOCKOUT_DURATION_MS = 35; // Short enough to not miss human play, long enough to break loops

  public isSupported: boolean = false;
  public initialized: boolean = false;

  private constructor() {}

  public static getInstance(): MidiManager {
    if (!MidiManager.instance) {
      MidiManager.instance = new MidiManager();
    }
    return MidiManager.instance;
  }

  async init() {
    if (this.initialized) return;

    if (!navigator.requestMIDIAccess) {
      console.warn("Web MIDI API not supported");
      return;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
    } catch (err) {
      try {
        this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      } catch (e) {
        console.warn("MIDI Access Denied:", e);
        return;
      }
    }

    this.isSupported = true;
    this.updateDevices();
    this.midiAccess.onstatechange = () => this.updateDevices();
    this.initialized = true;
  }

  private updateDevices() {
    if (!this.midiAccess) return;
    
    this.inputs.clear();
    this.midiAccess.inputs.forEach(input => {
      this.inputs.set(input.id, input);
      input.onmidimessage = (msg) => this.broadcast(msg.data, input.id);
    });

    this.outputs.clear();
    this.midiAccess.outputs.forEach(output => {
      this.outputs.set(output.id, output);
    });

    window.dispatchEvent(new CustomEvent('midiDevicesChanged'));
  }

  public getDevices(): MidiDevice[] {
    const devs: MidiDevice[] = [];
    this.inputs.forEach(i => devs.push({ 
      id: i.id, 
      name: i.name || 'Input', 
      manufacturer: i.manufacturer,
      type: 'input' 
    }));
    this.outputs.forEach(o => devs.push({ 
      id: o.id, 
      name: o.name || 'Output', 
      manufacturer: o.manufacturer,
      type: 'output' 
    }));
    return devs;
  }

  public addListener(cb: MidiListener) {
    this.listeners.add(cb);
  }

  public removeListener(cb: MidiListener) {
    this.listeners.delete(cb);
  }

  private broadcast(message: Uint8Array, deviceId: string) {
    // If we are in a lockout period, ignore incoming MIDI to prevent feedback loops
    if (Date.now() < this.lockoutUntil) {
      return;
    }
    this.listeners.forEach(l => l(message, deviceId));
  }

  private setLockout() {
    this.lockoutUntil = Date.now() + this.LOCKOUT_DURATION_MS;
  }

  public sendChord(chord: ChordDefinition | null, outputId: string, channel: number) {
    if (outputId === 'none') return;
    const outputsToSend = outputId === 'all' 
      ? Array.from(this.outputs.values()) 
      : [this.outputs.get(outputId)].filter(Boolean) as MIDIOutput[];
    
    if (outputsToSend.length > 0) {
      this.setLockout();
    }

    outputsToSend.forEach(out => {
      try {
        // 1. Explicitly turn off previous notes for this device
        const active = this.activeChordNotes.get(out.id) || [];
        active.forEach(note => {
          out.send([0x80 | (channel - 1), note, 0]);
        });
        
        // 2. Play new chord
        if (chord) {
          const newNotes: number[] = [];
          chord.intervals.forEach(interval => {
            const note = 48 + interval; // C2 base
            out.send([0x90 | (channel - 1), note, 100]);
            newNotes.push(note);
          });
          this.activeChordNotes.set(out.id, newNotes);
        } else {
          this.activeChordNotes.delete(out.id);
        }
      } catch (e) {
        console.error("MIDI Output Error:", e);
      }
    });
  }

  public sendHarpNote(chord: ChordDefinition, stringIndex: number, octave: number, harpOctave: number, outputId: string, channel: number) {
    if (outputId === 'none' || !chord) return;
    const outputsToSend = outputId === 'all' 
      ? Array.from(this.outputs.values()) 
      : [this.outputs.get(outputId)].filter(Boolean) as MIDIOutput[];
    
    if (outputsToSend.length > 0) {
      this.setLockout();
    }

    const intervalIndex = stringIndex % chord.intervals.length;
    const octaveOffset = Math.floor(stringIndex / chord.intervals.length);
    const note = 60 + (octave + harpOctave) * 12 + chord.intervals[intervalIndex] + (octaveOffset * 12);

    outputsToSend.forEach(out => {
      try {
        out.send([0x90 | (channel - 1), note, 110]);
        setTimeout(() => out.send([0x80 | (channel - 1), note, 0]), 250);
      } catch (e) {
        console.error("MIDI Output Error:", e);
      }
    });
  }
}

export const midiService = MidiManager.getInstance();
