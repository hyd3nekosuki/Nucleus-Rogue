import { DecayMode, NuclideCategory, NuclideRecord, BranchingRatio } from '../types';
import { isValidNucleus } from '../physics/validators';

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
        case '2N':
            mode = DecayMode.TWO_NEUTRON_EMISSION;
            category = NuclideCategory.BETA_MINUS;
            break;
        case 'P':
            mode = DecayMode.PROTON_EMISSION;
            category = NuclideCategory.BETA_PLUS;
            break;
        case '2P':
            mode = DecayMode.TWO_PROTON_EMISSION;
            category = NuclideCategory.BETA_PLUS;
            break;
        case 'SF':
            mode = DecayMode.SPONTANEOUS_FISSION;
            category = NuclideCategory.ALPHA;
            break;
        case 'IT':
            mode = DecayMode.IT;
            category = NuclideCategory.BETA_PLUS;
            break;
        case 'B-N':
            mode = DecayMode.B_MINUS_N;
            category = NuclideCategory.BETA_MINUS;
            break;
        case 'B-2N':
            mode = DecayMode.B_MINUS_2N;
            category = NuclideCategory.BETA_MINUS;
            break;
        case 'B-3N':
            mode = DecayMode.B_MINUS_3N;
            category = NuclideCategory.BETA_MINUS;
            break;
        case 'B-4N':
            mode = DecayMode.B_MINUS_4N;
            category = NuclideCategory.BETA_MINUS;
            break;
        case 'B-5N':
            mode = DecayMode.B_MINUS_5N;
            category = NuclideCategory.BETA_MINUS;
            break;
        case 'B-6N':
            mode = DecayMode.B_MINUS_6N;
            category = NuclideCategory.BETA_MINUS;
            break;
        case 'B-7N':
            mode = DecayMode.B_MINUS_7N;
            category = NuclideCategory.BETA_MINUS;
            break;
        case 'B-A':
            mode = DecayMode.B_MINUS_ALPHA;
            category = NuclideCategory.BETA_MINUS;
            break;
        case 'B-P':
            mode = DecayMode.B_MINUS_PROTON;
            category = NuclideCategory.BETA_MINUS;
            break;
        case 'B-SF':
            mode = DecayMode.B_MINUS_SF;
            category = NuclideCategory.BETA_MINUS;
            break;
        case 'B+A':
            mode = DecayMode.B_PLUS_ALPHA;
            category = NuclideCategory.BETA_PLUS;
            break;
        case 'B+P':
            mode = DecayMode.B_PLUS_PROTON;
            category = NuclideCategory.BETA_PLUS;
            break;
        case 'B+2P':
            mode = DecayMode.B_PLUS_2PROTON;
            category = NuclideCategory.BETA_PLUS;
            break;
        case 'ECA':
            mode = DecayMode.EC_ALPHA;
            category = NuclideCategory.BETA_PLUS;
            break;
        case 'ECP':
            mode = DecayMode.EC_PROTON;
            category = NuclideCategory.BETA_PLUS;
            break;
        case 'EC2P':
            mode = DecayMode.EC_2PROTON;
            category = NuclideCategory.BETA_PLUS;
            break;
        case 'ECSF':
            mode = DecayMode.EC_SF;
            category = NuclideCategory.BETA_PLUS;
            break;
        case 'EC+B+':
            mode = DecayMode.EC_B_PLUS;
            category = NuclideCategory.BETA_PLUS;
            break;
        case '2B-':
            mode = DecayMode.DOUBLE_BETA_MINUS;
            category = NuclideCategory.BETA_MINUS;
            break;
        case '2B+':
            mode = DecayMode.DOUBLE_BETA_PLUS;
            category = NuclideCategory.BETA_PLUS;
            break;
        case '2EC':
            mode = DecayMode.DOUBLE_ELECTRON_CAPTURE;
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
 * Minimum branching ratio to consider (0.00001%)
 */
const MIN_RATIO = 0.00001;

/**
 * Defensive parser for single comma-separated "A:Mode1:Ratio1:Mode2:Ratio2:Mode3:Ratio3:HalfLife" string segments.
 * Returns null if the segment is fundamentally broken.
 */
export const parseNuclideRecord = (z: number, segment: string): NuclideRecord | null => {
    if (!segment) return null;
    
    const parts = segment.split(':');
    
    // Fallback for legacy format (A:Mode:HalfLife)
    if (parts.length === 3) {
        const a = parseInt(parts[0]);
        if (!isValidNucleus(z, a)) return null;
        const { mode, category } = parseNuclideMode(parts[1]);
        const halflife = parseNuclideHalfLife(parts[2]);
        return { z, a, branches: [{ mode, ratio: 100 }], halflife, category };
    }

    if (parts.length < 8) {
        console.warn(`Nuclide Parser: Record for Z=${z} is missing parts. Found: "${segment}"`);
        return null;
    }

    const a = parseInt(parts[0]);
    if (!isValidNucleus(z, a)) {
        console.warn(`Nuclide Parser: Physical contradiction detected for Z=${z}, A=${a}.`);
        return null;
    }

    const halflifeStr = (parts[7] || '').trim().toUpperCase();
    const halflife = parseNuclideHalfLife(halflifeStr);
    const isStable = halflifeStr === 'S';

    const branches: BranchingRatio[] = [];
    
    if (isStable) {
        branches.push({ mode: DecayMode.STABLE, ratio: 100 });
    } else {
        // Parse up to 3 modes
        for (let i = 0; i < 3; i++) {
            const modeStr = (parts[1 + i * 2] || '').trim();
            const ratioStr = (parts[2 + i * 2] || '').trim();
            
            if (modeStr !== '') {
                const { mode } = parseNuclideMode(modeStr);
                if (mode === DecayMode.UNKNOWN) continue;

                let ratio: number;
                if (ratioStr === '' || ratioStr === '?') {
                    ratio = MIN_RATIO;
                } else {
                    ratio = parseFloat(ratioStr);
                    if (isNaN(ratio)) ratio = MIN_RATIO;
                }
                
                branches.push({ mode, ratio });
            }
        }
    }

    // If no branches found but it's not stable, it might be unknown
    if (branches.length === 0 && !isStable) {
        branches.push({ mode: DecayMode.UNKNOWN, ratio: 100 });
    }

    // Category is determined by the primary (first) mode string or 'S' if stable
    const primaryModeStr = isStable ? 'S' : (parts[1] || '');
    const { category } = parseNuclideMode(primaryModeStr);

    return { z, a, branches, halflife, category };
};
