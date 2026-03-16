import { DecayMode } from '../types';

/**
 * List of base decay modes that contribute to Mastery Level.
 * This fixed list ensures save code compatibility and clear progression.
 */
export const BASE_MASTERY_MODES: DecayMode[] = [
    DecayMode.ALPHA,
    DecayMode.BETA_MINUS,
    DecayMode.BETA_PLUS,
    DecayMode.ELECTRON_CAPTURE,
    DecayMode.PROTON_EMISSION,
    DecayMode.NEUTRON_EMISSION,
    DecayMode.SPONTANEOUS_FISSION,
    DecayMode.GAMMA
];

/**
 * Decomposes a complex decay mode into its constituent base particles/processes.
 * Example: B-N -> [BETA_MINUS, NEUTRON_EMISSION]
 * Example: 2P -> [PROTON_EMISSION]
 */
export const decomposeDecayMode = (mode: DecayMode): DecayMode[] => {
    const bases: Set<DecayMode> = new Set();

    if (mode === DecayMode.ALPHA) bases.add(DecayMode.ALPHA);
    if (mode === DecayMode.BETA_MINUS || mode === DecayMode.DOUBLE_BETA_MINUS) bases.add(DecayMode.BETA_MINUS);
    if (mode === DecayMode.BETA_PLUS || mode === DecayMode.DOUBLE_BETA_PLUS) bases.add(DecayMode.BETA_PLUS);
    if (mode === DecayMode.ELECTRON_CAPTURE || mode === DecayMode.DOUBLE_ELECTRON_CAPTURE) bases.add(DecayMode.ELECTRON_CAPTURE);
    if (mode === DecayMode.SPONTANEOUS_FISSION) bases.add(DecayMode.SPONTANEOUS_FISSION);
    if (mode === DecayMode.PROTON_EMISSION || mode === DecayMode.TWO_PROTON_EMISSION) bases.add(DecayMode.PROTON_EMISSION);
    if (mode === DecayMode.NEUTRON_EMISSION || mode === DecayMode.TWO_NEUTRON_EMISSION) bases.add(DecayMode.NEUTRON_EMISSION);
    if (mode === DecayMode.GAMMA || mode === DecayMode.IT) bases.add(DecayMode.GAMMA);

    // Delayed emissions (B- series)
    if (mode.startsWith('B-')) {
        bases.add(DecayMode.BETA_MINUS);
        if (mode.includes('N')) bases.add(DecayMode.NEUTRON_EMISSION);
        if (mode.includes('A')) bases.add(DecayMode.ALPHA);
        if (mode.includes('P')) bases.add(DecayMode.PROTON_EMISSION);
        if (mode.includes('SF')) bases.add(DecayMode.SPONTANEOUS_FISSION);
    }

    // Delayed emissions (B+ series)
    if (mode.startsWith('B+')) {
        bases.add(DecayMode.BETA_PLUS);
        if (mode.includes('A')) bases.add(DecayMode.ALPHA);
        if (mode.includes('P')) bases.add(DecayMode.PROTON_EMISSION);
    }

    // Delayed emissions (EC series)
    if (mode.startsWith('EC')) {
        bases.add(DecayMode.ELECTRON_CAPTURE);
        if (mode.includes('A')) bases.add(DecayMode.ALPHA);
        if (mode.includes('P')) bases.add(DecayMode.PROTON_EMISSION);
        if (mode.includes('SF')) bases.add(DecayMode.SPONTANEOUS_FISSION);
    }

    return Array.from(bases).filter(b => BASE_MASTERY_MODES.includes(b));
};
