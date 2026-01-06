
/**
 * Box-Muller transform for generating Gaussian random numbers.
 */
export const gaussianRandom = (mean: number, std: number): number => {
    const u = 1 - Math.random();
    const v = 1 - Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * std + mean;
};

/**
 * Calculates a fission fragment using a Double-Gaussian model.
 * As parents get heavier (A > 240), fission becomes more symmetric.
 */
export const getFissionFragmentOutcome = (parentZ: number, parentA: number): { z: number, a: number } => {
    const promptNeutrons = 2; // Prompt neutrons typically emitted
    const totalA = parentA - promptNeutrons;
    const midPointA = totalA / 2;
    
    // Standard asymmetric heavy peak is around A=140 (nuclear shell effect)
    const standardHeavyPeak = 140;
    
    // Asymmetry weakens for superheavy elements
    const startSymmetryA = 240;
    const maxSymmetryA = 280;
    
    let s = 0; 
    if (parentA > startSymmetryA) {
        s = Math.min(1.0, (parentA - startSymmetryA) / (maxSymmetryA - startSymmetryA));
    }
    
    let meanHeavy = (1 - s) * standardHeavyPeak + s * midPointA;
    if (totalA < 200) meanHeavy = Math.max(midPointA, totalA * 0.6);
    
    const meanLight = totalA - meanHeavy;
    const sigma = 6.5; 
    
    const isHeavy = Math.random() > 0.5;
    const targetMean = isHeavy ? meanHeavy : meanLight;
    
    let fragA = Math.round(gaussianRandom(targetMean, sigma));
    fragA = Math.max(1, Math.min(totalA - 1, fragA));
    
    // Unchanged Charge Density (UCD) hypothesis: FragZ / FragA = ParentZ / ParentA
    const fragZ = Math.round(fragA * (parentZ / parentA));
    
    return { z: Math.max(1, fragZ), a: fragA };
};
