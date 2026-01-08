/**
 * Utility for verifying physical nuclear consistency.
 * Prevents logic errors from proceeding with impossible atomic states.
 */

export const isValidNucleus = (z: number, a: number): boolean => {
    // Basic physical constraints:
    // 1. Proton number must be non-negative
    // 2. Mass number must be >= proton number (except for theoretical cases, but N >= 0 is a rule)
    // 3. Neutron-only nuclei (Z=0) are allowed for n, n2, n4 etc.
    if (z < 0 || a < 0) return false;
    if (a < z) return false;
    
    return true;
};

export const isWithinDiscoveryLimits = (z: number): boolean => {
    // Current IAU recognized limit is Oganesson (Z=118)
    return z >= 0 && z <= 118;
};
