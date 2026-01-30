
import { MidiDevice, MidiMessage } from '../types';

export type MidiListener = (message: MidiMessage, deviceId: string) => void;

/**
 * Singleton Manager for Web MIDI API and Virtual Signal Routing.
 */
export class MidiManager {
  private static instance: MidiManager;
  private midiAccess: MIDIAccess | null = null;
  private inputs: Map<string, MIDIInput> = new Map();
  private outputs: Map<string, MIDIOutput> = new Map();
  private listeners: Set<MidiListener> = new Set();
  
  public isPhysicalSupported: boolean = false;

  private constructor() {
    // Auto-probe on construction
    this.requestAccess().catch(() => {});
  }

  public static getInstance(): MidiManager {
    if (!MidiManager.instance) {
      MidiManager.instance = new MidiManager();
    }
    return MidiManager.instance;
  }

  public async requestAccess(): Promise<{ physical: boolean, error?: string }> {
    if (typeof navigator.requestMIDIAccess !== 'function') {
      return { physical: false, error: "Web MIDI not supported" };
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: true, software: true });
      this.isPhysicalSupported = true;
      this.setupMidiAccess();
      return { physical: true };
    } catch (e: any) {
      // Fallback for restricted environments
      try {
        this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        this.isPhysicalSupported = true;
        this.setupMidiAccess();
        return { physical: true };
      } catch (err: any) {
        return { physical: false, error: err.message };
      }
    }
  }

  private setupMidiAccess() {
    if (!this.midiAccess) return;
    this.updateDevices();
    this.midiAccess.onstatechange = () => this.updateDevices();
  }

  private updateDevices() {
    if (!this.midiAccess) return;
    
    this.inputs.clear();
    this.midiAccess.inputs.forEach((i) => {
      this.inputs.set(i.id, i);
      i.onmidimessage = (event: any) => {
        this.broadcast(event.data as unknown as MidiMessage, i.id);
      };
    });

    this.outputs.clear();
    this.midiAccess.outputs.forEach((o) => {
      this.outputs.set(o.id, o);
    });
  }

  public getDevices(): MidiDevice[] {
    const inputs: MidiDevice[] = Array.from(this.inputs.values()).map(i => ({
      id: i.id, name: i.name || 'Input', manufacturer: i.manufacturer || 'System', type: 'input'
    }));
    const outputs: MidiDevice[] = Array.from(this.outputs.values()).map(o => ({
      id: o.id, name: o.name || 'Output', manufacturer: o.manufacturer || 'System', type: 'output'
    }));
    return [...inputs, ...outputs];
  }

  public addListener(cb: MidiListener) {
    this.listeners.add(cb);
  }

  public removeListener(cb: MidiListener) {
    this.listeners.delete(cb);
  }

  public sendMidi(deviceId: string, message: MidiMessage) {
    const output = this.outputs.get(deviceId);
    if (output) {
      try { output.send(message); } catch (e) {}
    }
    // Also broadcast internally for virtual routing
    this.broadcast(message, deviceId);
  }

  public broadcast(message: MidiMessage, deviceId: string) {
    this.listeners.forEach(l => l(message, deviceId));
  }
}
