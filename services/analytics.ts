
/**
 * HARPICHORD Analytics Service
 * Wraps gtag to provide structured event tracking for instrument interactions.
 */

export type AnalyticsEvent = 
  | { name: 'chord_press'; params: { chord: string; mode: string } }
  | { name: 'rhythm_change'; params: { pattern: string; tempo: number } }
  | { name: 'strum_interaction'; params: { method: 'manual' | 'touchpad' } }
  | { name: 'control_change'; params: { parameter: string; value: number | string } }
  | { name: 'midi_io_active'; params: { input: string; output: string } }
  | { name: 'factory_reset'; params: {} }
  | { name: 'kill_switch'; params: {} }
  | { name: 'touchpad_toggle'; params: { enabled: boolean } };

export const trackEvent = (event: AnalyticsEvent) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', event.name, event.params);
  }
};

// Use for debouncing high-frequency events like sliders
let debounceTimers: Record<string, number> = {};
export const trackEventDebounced = (event: AnalyticsEvent, ms: number = 1000) => {
  const key = event.name + (event.params && 'parameter' in event.params ? event.params.parameter : '');
  if (debounceTimers[key]) {
    clearTimeout(debounceTimers[key]);
  }
  debounceTimers[key] = window.setTimeout(() => {
    trackEvent(event);
    delete debounceTimers[key];
  }, ms);
};
