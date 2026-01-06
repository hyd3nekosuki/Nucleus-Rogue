
/**
 * Checks if the physical temporal inversion condition (returning to the same nuclide) is met.
 * Pure logic function: evaluates only the provided atomic coordinates.
 * 
 * @param currentZ Current atomic number
 * @param currentA Current mass number
 * @param startNuclide Nucleus state at the beginning of the chain/combo
 */
export const isTemporalInversionEligible = (
    currentZ: number, 
    currentA: number, 
    startNuclide: { z: number, a: number } | undefined | null
): boolean => {
    if (!startNuclide) return false;
    return (currentZ === startNuclide.z && currentA === startNuclide.a);
};

/**
 * Calculates the score bonus based on the current combo status.
 * Standardizes the 10x multiplier for Temporal Inversion.
 * 
 * @param comboScore The accumulated score of the current chain
 * @param inversionEligible Whether the inversion condition is met
 */
export const calculateComboCompletionBonus = (
    comboScore: number,
    inversionEligible: boolean
): number => {
    // Temporal Inversion gives a 10x multiplier bonus as a reward for closed loops
    return inversionEligible ? comboScore * 10 : 0;
};
