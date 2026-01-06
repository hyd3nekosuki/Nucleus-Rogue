
import { getAllNuclides } from './staticNuclides';
import { NuclideRecord } from '../types';

/**
 * An immutable, pre-calculated Map for O(1) nuclide physical data lookups.
 * Built once during application initialization.
 */
export const NUCLIDE_REPOSITORY: Map<string, NuclideRecord> = new Map(
  getAllNuclides().map(n => [`${n.z}-${n.a}`, {
    z: n.z,
    a: n.a,
    mode: n.mode,
    halflife: n.halflife,
    category: n.cat
  }])
);

/**
 * Get all available mass numbers (A) for a given atomic number (Z).
 */
export const getRepositoryValidAsForZ = (z: number): number[] => {
    const validAs: number[] = [];
    // Efficiently search keys in a single pass
    for (const key of NUCLIDE_REPOSITORY.keys()) {
        const hyphenIndex = key.indexOf('-');
        if (hyphenIndex !== -1) {
            const keyZ = parseInt(key.substring(0, hyphenIndex));
            if (keyZ === z) {
                validAs.push(parseInt(key.substring(hyphenIndex + 1)));
            }
        }
    }
    return validAs.sort((a, b) => a - b);
};
