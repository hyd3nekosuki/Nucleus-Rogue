
/**
 * Checks if the physical temporal inversion condition (returning to the same nuclide) is met.
 */
export const isTemporalInversionEligible = (
    currentZ: number, 
    currentA: number, 
    startNuclide: { z: number, a: number } | undefined
): boolean => {
    if (!startNuclide) return false;
    return (currentZ === startNuclide.z && currentA === startNuclide.a);
};

/**
 * Calculates the score bonus based on the current combo status.
 */
export const calculateComboCompletionBonus = (
    comboScore: number,
    inversionEligible: boolean
): number => {
    // Temporal Inversion gives a 10x multiplier bonus
    return inversionEligible ? comboScore * 10 : 0;
};
