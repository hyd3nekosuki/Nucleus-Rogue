import { DecayMode, DecayDelta } from '../types';

export const MAGIC_NUMBERS = [2, 8, 20, 28, 50, 82, 126];
export const COULOMB_BARRIER_THRESHOLD = 20;

/**
 * Atomic Physics constants
 */
export const DECAY_PHYSICS: Record<string, DecayDelta> = {
    [DecayMode.ALPHA]: { dZ: -2, dA: -4 },
    [DecayMode.BETA_MINUS]: { dZ: 1, dA: 0 },
    [DecayMode.BETA_PLUS]: { dZ: -1, dA: 0 },
    [DecayMode.ELECTRON_CAPTURE]: { dZ: -1, dA: 0 },
    [DecayMode.PROTON_EMISSION]: { dZ: -1, dA: -1 },
    [DecayMode.NEUTRON_EMISSION]: { dZ: 0, dA: -1 },
    [DecayMode.SPONTANEOUS_FISSION]: { dZ: -38, dA: -96 }, // Representative average
    [DecayMode.STABLE]: { dZ: 0, dA: 0 },
    [DecayMode.GAMMA]: { dZ: 0, dA: 0 },
    [DecayMode.UNKNOWN]: { dZ: 0, dA: 0 }
};
