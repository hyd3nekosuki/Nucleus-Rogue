import { DecayMode, NuclideCategory, NuclideRecord } from '../types';
import { isValidNucleus } from './physicsValidators';

/**
 * Pure function to parse a raw mode string into its physical DecayMode and Category.
 */
export const parseNuclideMode = (modeStr: string): { mode: DecayMode; category: NuclideCategory } => {
    let mode = DecayMode.UNKNOWN;
    let category = NuclideCategory.STABLE;
    
    // Normalize and trim to prevent typo-driven failures
    const normalized = (modeStr || '').trim().toUpperCase();

    switch (normalized) {
        case 'S':
            mode = DecayMode.STABLE;
            category = NuclideCategory.STABLE;
            break;
        case 'A':
            mode = DecayMode.ALPHA;
            category = NuclideCategory.ALPHA;
            break;
        case 'B-':
            mode = DecayMode.BETA_MINUS;
            category = NuclideCategory.BETA_MINUS;
            break;
        case 'B+':
            mode = DecayMode.BETA_PLUS;
            category = NuclideCategory.BETA_PLUS;
            break;
        case 'EC':
            mode = DecayMode.ELECTRON_CAPTURE;
            category = NuclideCategory.BETA_PLUS;
            break;
        case 'N':
            mode = DecayMode.NEUTRON_EMISSION;
            category = NuclideCategory.BETA_MINUS;
            break;
        case 'P':
            mode = DecayMode.PROTON_EMISSION;
            category = NuclideCategory.BETA_PLUS;
            break;
        case 'SF':
            mode = DecayMode.SPONTANEOUS_FISSION;
            category = NuclideCategory.ALPHA;
            break;
        case 'IT':
            mode = DecayMode.GAMMA;
            category = NuclideCategory.BETA_PLUS;
            break;
        default:
            mode = DecayMode.UNKNOWN;
            category = NuclideCategory.NON_EXISTENT;
            break;
    }
    
    return { mode, category };
};

/**
 * Pure function to parse raw half-life string into seconds.
 * Robust against empty strings or corrupt scientific notations.
 */
export const parseNuclideHalfLife = (hlStr: string): number => {
    if (!hlStr) return 0;
    const normalized = hlStr.trim().toUpperCase();
    
    if (normalized === 'S') return Infinity;
    if (normalized === 'V') return 1e-9;
    if (normalized === '?') return 0; 
    
    const val = parseFloat(normalized);
    // Safety check for NaN or negative values (which shouldn't exist in half-life data)
    return (isNaN(val) || val < 0) ? 0 : val;
};

/**
 * Defensive parser for single comma-separated "A:Mode:HalfLife" string segments.
 * Returns null if the segment is fundamentally broken.
 */
export const parseNuclideRecord = (z: number, segment: string): NuclideRecord | null => {
    if (!segment) return null;
    
    const parts = segment.split(':');
    if (parts.length < 3) {
        console.warn(`Nuclide Parser: Record for Z=${z} is missing parts. Found: "${segment}"`);
        return null;
    }

    const a = parseInt(parts[0]);
    if (!isValidNucleus(z, a)) {
        console.warn(`Nuclide Parser: Physical contradiction detected for Z=${z}, A=${a}.`);
        return null;
    }

    const { mode, category } = parseNuclideMode(parts[1]);
    const halflife = parseNuclideHalfLife(parts[2]);

    return { z, a, mode, halflife, category };
};
