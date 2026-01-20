import { DecayMode } from '../domain/nuclide';

/**
 * Game Engine History & Evolution Tracking
 * Records the progression of the nucleus through the chart.
 */

export interface HistoryEntry {
  firstTurn: number;
  lastTurn: number;
  name: string;
  symbol: string;
  z: number;
  a: number;
  method: string;
  pz: number | null;
  pa: number | null;
  isEngraved?: boolean;
}

export interface ComboOrigin {
  z: number;
  a: number;
  isUnstable: boolean;
  timestamp: number;
}

export interface DiscoveryContext {
  method: string;
  pz: number | null;
  pa: number | null;
  addedScore: number;
  chargesUsed: number;
  inducedDecayMode?: DecayMode;
  isManualDecay?: boolean; 
}
