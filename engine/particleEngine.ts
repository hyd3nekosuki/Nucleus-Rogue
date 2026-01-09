import { ELEMENT_SYMBOLS, ELEMENT_NAMES } from '../constants/atomicData';
import { EntityType, GridEntity } from '../types';
import { getNuclideDataSync } from '../services/nuclideService';

/**
 * Step 1: Goal Nuclide Identification
 * Parses strings like "Au-197", "Gold-197", "197Au" into atomic coordinates.
 */
export const parseNuclideCommand = (input: string): { z: number, a: number } | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Matches patterns like "Au-197", "Au197", "197-Au", "197Au"
    const match = trimmed.match(/^([a-z]+)-?(\d+)$/i) || trimmed.match(/^(\d+)-?([a-z]+)$/i);
    
    if (!match) return null;

    let symbolOrName: string;
    let aStr: string;

    // Determine which part is the text and which is the number
    if (isNaN(parseInt(match[1]))) {
        symbolOrName = match[1];
        aStr = match[2];
    } else {
        aStr = match[1];
        symbolOrName = match[2];
    }

    const a = parseInt(aStr);
    
    // Find Z: Prioritize exact case-sensitive symbol match (e.g., distinguish "N" for Nitrogen vs "n" for Neutron)
    let z = ELEMENT_SYMBOLS.indexOf(symbolOrName);
    
    // Fallback 1: Case-insensitive symbol match
    if (z === -1) {
        z = ELEMENT_SYMBOLS.findIndex(s => s.toLowerCase() === symbolOrName.toLowerCase());
    }
    
    // Fallback 2: Find Z by Full Name case-insensitively if symbol lookups failed
    if (z === -1) {
        z = ELEMENT_NAMES.findIndex(n => n.toLowerCase() === symbolOrName.toLowerCase());
    }

    if (z === -1 || isNaN(a)) return null;
    
    // Verify if nuclide exists in database
    const data = getNuclideDataSync(z, a);
    if (!data.exists) return null;

    return { z, a };
};

/**
 * Step 2: Resource Equation Definition
 * Calculates if the target nuclide is reachable using available grid particles.
 * Returns the list of particle IDs to consume if reachable, otherwise null.
 */
export const solveParticleRequirements = (
    currentZ: number, 
    currentA: number, 
    targetZ: number, 
    targetA: number, 
    entities: GridEntity[]
): { idsToConsume: string[] } | null => {
    const deltaA = targetA - currentA;
    const deltaZ = targetZ - currentZ;

    // Filter available resource pools on the grid
    const available = entities.reduce((acc, e) => {
        if (e.type === EntityType.PROTON) acc.p.push(e.id);
        else if (e.type === EntityType.NEUTRON) acc.n.push(e.id);
        else if (e.type === EntityType.ENEMY_ELECTRON) acc.e.push(e.id);
        else if (e.type === EntityType.ENEMY_POSITRON) acc.pos.push(e.id);
        return acc;
    }, { p: [] as string[], n: [] as string[], e: [] as string[], pos: [] as string[] });

    /**
     * Physics Constraint Equations:
     * 1) deltaA = p + n  (Conservation of Mass)
     * 2) deltaZ = p - e + pos (Conservation of Charge)
     * 
     * p: Protons, n: Neutrons, e: Electrons, pos: Positrons (absorbed count)
     */
    
    let bestSolution: string[] | null = null;
    let minParticles = Infinity;

    // Iterate through possible proton absorption counts within grid limits
    for (let pCount = 0; pCount <= available.p.length; pCount++) {
        // Calculate required neutron count to satisfy mass change
        const nCount = deltaA - pCount;
        if (nCount < 0 || nCount > available.n.length) continue;

        // Current net charge from absorbed nucleons: +pCount
        // Required charge adjustment from leptons: deltaZ - pCount
        const leptonChargeReq = deltaZ - pCount;

        // pos - e = leptonChargeReq
        // Iterate through electron absorption counts
        for (let eCount = 0; eCount <= available.e.length; eCount++) {
            const posCount = leptonChargeReq + eCount;
            
            // Check if required positron count is within grid limits
            if (posCount >= 0 && posCount <= available.pos.length) {
                const total = pCount + nCount + eCount + posCount;
                if (total < minParticles) {
                    minParticles = total;
                    bestSolution = [
                        ...available.p.slice(0, pCount),
                        ...available.n.slice(0, nCount),
                        ...available.e.slice(0, eCount),
                        ...available.pos.slice(0, posCount)
                    ];
                }
            }
        }
    }

    return bestSolution ? { idsToConsume: bestSolution } : null;
};