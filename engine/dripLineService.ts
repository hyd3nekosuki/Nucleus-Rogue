import { NUCLIDE_REPOSITORY } from '../data/nuclideRepository';
import { DRIP_LINE_LIMITS } from '../data/dripLineLimits';
import { NuclideCategory } from '../types';

/**
 * Service to determine if a nuclide sits on the physical boundaries of existence (Drip Lines).
 * Optimized to use static limit data where possible.
 */
export const DripLineService = {
    /**
     * Checks if the nuclide is at the Proton Drip Line (Proton-rich limit).
     */
    isAtProtonDripLine: (z: number, a: number): boolean => {
        if (z <= 0) return false;

        const limits = DRIP_LINE_LIMITS[z];
        if (!limits) return false;

        // Condition: Must be the lowest registered A for this Z
        return a === limits.minA;
    },

    /**
     * Checks if the nuclide is at the Neutron Drip Line (Neutron-rich limit).
     */
    isAtNeutronDripLine: (z: number, a: number): boolean => {
        const limits = DRIP_LINE_LIMITS[z];
        if (!limits) return false;

        // Condition: Must be the highest registered A for this Z
        return a === limits.maxA;
    },

    /**
     * Checks if a specific coordinate pair (Z, A) is outside the boundaries of nuclear existence.
     */
    isBeyondDripLine: (z: number, a: number): boolean => {
        if (z === -1 && a === 0) return false; // Electron is a special case
        if (z < 0 || z > 118) return true;
        const limits = DRIP_LINE_LIMITS[z];
        if (!limits) return true;
        return a < limits.minA || a > limits.maxA;
    }
};
