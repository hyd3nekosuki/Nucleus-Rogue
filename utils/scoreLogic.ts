/**
 * Checks if the temporal inversion conditions are met.
 */
export const isTemporalInversionEligible = (
    currentZ: number, 
    currentA: number, 
    startNuclide: { z: number, a: number } | undefined,
    unlockedGroups: string[],
    disabledSkills: string[]
): boolean => {
    if (!startNuclide) return false;
    const isMatched = (currentZ === startNuclide.z && currentA === startNuclide.a);
    const isUnlocked = unlockedGroups.includes("Temporal Inversion");
    const isEnabled = !disabledSkills.includes("Temporal Inversion");
    return isMatched && isUnlocked && isEnabled;
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