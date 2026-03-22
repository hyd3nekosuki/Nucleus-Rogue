import { DecayMode, DecayDelta } from '../types';

export const MAGIC_NUMBERS = [2, 8, 20, 28, 50, 82, 126];
export const COULOMB_BARRIER_THRESHOLD = 20;

/**
 * Atomic Physics constants
 */
export const DECAY_PHYSICS: Record<string, DecayDelta> = {
    [DecayMode.ALPHA]: { dZ: -2, dA: -4 },
    [DecayMode.BETA_MINUS]: { dZ: 1, dA: 0 },
    [DecayMode.DOUBLE_BETA_MINUS]: { dZ: 2, dA: 0 },
    [DecayMode.BETA_PLUS]: { dZ: -1, dA: 0 },
    [DecayMode.DOUBLE_BETA_PLUS]: { dZ: -2, dA: 0 },
    [DecayMode.ELECTRON_CAPTURE]: { dZ: -1, dA: 0 },
    [DecayMode.DOUBLE_ELECTRON_CAPTURE]: { dZ: -2, dA: 0 },
    [DecayMode.PROTON_EMISSION]: { dZ: -1, dA: -1 },
    [DecayMode.TWO_PROTON_EMISSION]: { dZ: -2, dA: -2 },
    [DecayMode.NEUTRON_EMISSION]: { dZ: 0, dA: -1 },
    [DecayMode.TWO_NEUTRON_EMISSION]: { dZ: 0, dA: -2 },
    [DecayMode.SPONTANEOUS_FISSION]: { dZ: -38, dA: -96 }, // Representative average
    [DecayMode.STABLE]: { dZ: 0, dA: 0 },
    [DecayMode.GAMMA]: { dZ: 0, dA: 0 },
    [DecayMode.IT]: { dZ: 0, dA: 0 },
    [DecayMode.B_MINUS_N]: { dZ: 1, dA: -1 },
    [DecayMode.B_MINUS_2N]: { dZ: 1, dA: -2 },
    [DecayMode.B_MINUS_3N]: { dZ: 1, dA: -3 },
    [DecayMode.B_MINUS_4N]: { dZ: 1, dA: -4 },
    [DecayMode.B_MINUS_5N]: { dZ: 1, dA: -5 },
    [DecayMode.B_MINUS_6N]: { dZ: 1, dA: -6 },
    [DecayMode.B_MINUS_7N]: { dZ: 1, dA: -7 },
    [DecayMode.B_MINUS_ALPHA]: { dZ: -1, dA: -4 },
    [DecayMode.B_MINUS_PROTON]: { dZ: 0, dA: -1 },
    [DecayMode.B_MINUS_SF]: { dZ: -37, dA: -96 },
    [DecayMode.B_PLUS_ALPHA]: { dZ: -3, dA: -4 },
    [DecayMode.B_PLUS_PROTON]: { dZ: -2, dA: -1 },
    [DecayMode.B_PLUS_2PROTON]: { dZ: -3, dA: -2 },
    [DecayMode.EC_ALPHA]: { dZ: -3, dA: -4 },
    [DecayMode.EC_PROTON]: { dZ: -2, dA: -1 },
    [DecayMode.EC_2PROTON]: { dZ: -3, dA: -2 },
    [DecayMode.EC_SF]: { dZ: -39, dA: -96 },
    [DecayMode.EC_B_PLUS]: { dZ: -1, dA: 0 },
    [DecayMode.DEUTERON_EMISSION]: { dZ: -1, dA: -2 },
    [DecayMode.TRITON_EMISSION]: { dZ: -1, dA: -3 },
    [DecayMode.HELIUM3_EMISSION]: { dZ: -2, dA: -3 },
    [DecayMode.UNKNOWN]: { dZ: 0, dA: 0 }
};
