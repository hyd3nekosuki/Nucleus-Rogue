/**
 * System Audio & Synthesis Types
 * Defines constants and modes for the Web Audio API engine.
 */

export type KickMode = 'standard' | 'heavy-gabber' | 'sharp-gabber' | 'sub-thud' | 'dnb-punch';

export type SnareColor = 'sharp' | 'heavy' | 'industrial' | 'dnb-crack';

export type SynthType = 'pulse' | 'sub' | 'dark' | 'gabber' | 'void' | 'acid' | 'dnb-lead' | 'sparkle';

export interface AudioEngineStatus {
  isMuted: boolean;
  bpm: number;
  primaryMode: string;
}

export interface AudioEvent {
  id: number;
  type: 'ENGRAVE' | 'UI_CLICK';
}
