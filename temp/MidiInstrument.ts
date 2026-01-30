
// Fixed: Import missing MIDI types from local types-1 file instead of root types
import { MidiInstrumentConfig, MidiMessage, MidiCommand } from './types-1';
import { MidiManager } from './MidiManager';

export type MidiMessageHandler = (command: MidiCommand, channel: number, note: number, velocity: number) => void;

/**
 * Encapsulates logic for a single MIDI entity.
 * Handles: Filtering (Device/Channel) -> Logic (Synth) -> Thru (MIDI Out).
 */
export class MidiInstrument {
  public config: MidiInstrumentConfig;
  private manager: MidiManager;
  private onMessageCallbacks: Set<MidiMessageHandler> = new Set();

  constructor(config: MidiInstrumentConfig) {
    this.config = { ...config };
    this.manager = MidiManager.getInstance();
    this.manager.addListener(this.handleMidiEvent);
  }

  public updateConfig(newConfig: Partial<MidiInstrumentConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Register a callback to handle incoming MIDI specifically for this instrument.
   */
  public onMessage(callback: MidiMessageHandler) {
    this.onMessageCallbacks.add(callback);
    return () => this.onMessageCallbacks.delete(callback);
  }

  private handleMidiEvent = (message: MidiMessage, deviceId: string) => {
    // 1. Device Match
    const isInputMatch = this.config.inputId === 'all' || this.config.inputId === deviceId;
    if (!isInputMatch) return;

    const [status, data1, data2] = message;
    const command = status & 0xF0;
    const channel = (status & 0x0F) + 1;

    // 2. Channel Match (0 = Omni)
    if (this.config.inputChannel !== 0 && this.config.inputChannel !== channel) {
      return;
    }

    // 3. Local Trigger
    this.onMessageCallbacks.forEach(cb => cb(command as MidiCommand, channel, data1, data2));

    // 4. Automated Thru Routing
    if (this.config.outputId && this.config.outputId !== 'none') {
      const outStatus = command | (this.config.outputChannel - 1);
      this.manager.sendMidi(this.config.outputId, [outStatus, data1, data2] as MidiMessage);
    }
  }

  public dispose() {
    this.manager.removeListener(this.handleMidiEvent);
    this.onMessageCallbacks.clear();
  }
}
