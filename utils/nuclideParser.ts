
import { DecayMode, NuclideCategory } from '../types';

/**
 * Pure function to parse a raw mode string into its physical DecayMode and Category.
 */
export const parseNuclideMode = (modeStr: string): { mode: DecayMode; category: NuclideCategory } => {
    let mode = DecayMode.UNKNOWN;
    let category = NuclideCategory.STABLE;
    
    if (modeStr === 'S') mode = DecayMode.STABLE;
    else if (modeStr === 'A') { mode = DecayMode.ALPHA; category = NuclideCategory.ALPHA; }
    else if (modeStr === 'B-') { mode = DecayMode.BETA_MINUS; category = NuclideCategory.BETA_MINUS; }
    else if (modeStr === 'B+') { mode = DecayMode.BETA_PLUS; category = NuclideCategory.BETA_PLUS; }
    else if (modeStr === 'EC') { mode = DecayMode.ELECTRON_CAPTURE; category = NuclideCategory.BETA_PLUS; }
    else if (modeStr === 'N') { mode = DecayMode.NEUTRON_EMISSION; category = NuclideCategory.BETA_MINUS; }
    else if (modeStr === 'P') { mode = DecayMode.PROTON_EMISSION; category = NuclideCategory.BETA_PLUS; }
    else if (modeStr === 'SF') { mode = DecayMode.SPONTANEOUS_FISSION; category = NuclideCategory.ALPHA; }
    else if (modeStr === 'IT') { mode = DecayMode.GAMMA; category = NuclideCategory.BETA_PLUS; }
    
    if (mode === DecayMode.UNKNOWN && modeStr !== 'S') {
       category = NuclideCategory.NON_EXISTENT; 
    }
    
    return { mode, category };
};

/**
 * Pure function to parse raw half-life string into seconds.
 */
export const parseNuclideHalfLife = (hlStr: string): number => {
    if (hlStr === 'S') return Infinity;
    if (hlStr === 'V') return 1e-9;
    if (hlStr === '?') return 0; 
    const val = parseFloat(hlStr);
    return isNaN(val) ? 0 : val;
};
