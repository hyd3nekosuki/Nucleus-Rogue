import { DecayMode, NuclideData, NuclideCategory } from '../types';

export const GRID_WIDTH = 15;
export const GRID_HEIGHT = 15;
export const INITIAL_HP = 100;
export const APP_VERSION = "v1.3.4.4";
export const MAX_MASTERY_LEVEL = 8;

// --- Game Balance/Pacing Constants ---
export const COMBO_WINDOW_MS = 8000;
export const ENERGY_EVOLUTION_TURNS = 60; 

export const INITIAL_NUCLIDE: NuclideData = {
  z: 1,
  a: 1,
  symbol: 'H',
  name: 'Hydrogen-1',
  halfLifeText: 'Stable',
  halfLifeSeconds: Infinity,
  decayModes: [DecayMode.STABLE],
  category: NuclideCategory.STABLE,
  isStable: true,
  exists: true,
  description: 'The most abundant element in the universe, making up 75% of baryonic mass.',
  branches: [{ mode: DecayMode.STABLE, ratio: 100 }],
  // Fix: Added missing properties from NuclideData interface
  isProtonDripLine: false,
  isNeutronDripLine: false
};