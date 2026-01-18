/**
 * Dynamic calculation of prompt neutrons released during fission.
 * Based on scientific data: U-235 averages ~2.4, heavier nuclides tend to emit more.
 */
export const getPromptNeutronCount = (z: number, a: number): number => {
    // 1. Determine mean (mu) based on mass number A.
    // Base: U-235 (Z=92, A=235) has a mean of ~2.4.
    // Trend: Average neutron count increases with A.
    let mean = 2.4 + (a - 235) * 0.05;
    
    // 2. Determine max trials (n) for binomial distribution.
    // For U-235, max is 5. We scale this with A as well.
    let n = 5 + Math.floor((a - 235) / 10);
    n = Math.max(2, Math.min(8, n)); // Safe bounds for grid constraints
    
    // Ensure mean doesn't exceed n
    mean = Math.max(1.0, Math.min(n - 0.1, mean));

    // 3. Binomial Distribution B(n, p) where p = mean / n
    const p = mean / n;
    let count = 0;
    for (let i = 0; i < n; i++) {
        if (Math.random() < p) count++;
    }
    
    return count;
};

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
 * Takes the pre-calculated neutronCount to ensure mass conservation.
 */
export const getFissionFragmentOutcome = (parentZ: number, parentA: number, neutronCount: number): { z: number, a: number } => {
    const totalA = parentA - neutronCount;
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
