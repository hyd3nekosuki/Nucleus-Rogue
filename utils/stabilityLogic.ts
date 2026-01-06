/**
 * Pure function to calculate HP decay parameters based on half-life.
 * Returns decayRate (ms interval) and damage (amount per tick).
 */
export const getStabilityDecayParams = (halfLifeSeconds: number): { decayRate: number, damage: number } => {
    if (halfLifeSeconds > 3600) { 
        return { decayRate: 2000, damage: 0 }; 
    }
    if (halfLifeSeconds > 60) { 
        return { decayRate: 1000, damage: 1 }; 
    }
    if (halfLifeSeconds > 1) { 
        return { decayRate: 500, damage: 2 }; 
    }
    // Very unstable nuclides (HL <= 1s)
    return { decayRate: 200, damage: 5 };
};