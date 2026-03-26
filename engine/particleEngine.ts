import { ELEMENT_SYMBOLS, ELEMENT_NAMES } from '../constants/atomicData';
import { EntityType, GridEntity, NuclideData, HistoryEntry, DecayMode, NuclideCategory } from '../types';
import { getNuclideDataSync, ELECTRON_DATA } from '../services/nuclideService';
import { DRIP_LINE_LIMITS } from '../data/dripLineLimits';
import { NUCLIDE_REPOSITORY } from '../data/nuclideRepository';

/**
 * Step 1: Goal Nuclide Identification
 * Parses strings like "Au-197", "Gold-197", "197Au" into atomic coordinates.
 */
export const parseNuclideCommand = (input: string): { z: number, a: number } | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (trimmed.toLowerCase() === 'e-') return { z: -1, a: 0 };

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

/**
 * Calculates the best available nuclide for reincarnation based on the particle pool and discovery history.
 */
export const calculateReincarnationTargets = (
    currentNuclide: NuclideData,
    pool: { p: number, n: number, e: number },
    history: Record<string, HistoryEntry>,
    isDaredevilActive: boolean
): { nuclide: NuclideData, usage: { p: number, n: number, e: number } } | null => {
    // 1. Failure check: Must have at least one nucleon (p or n) to form a nucleus
    if (pool.p + pool.n <= 0) {
        // Special Case: Electron Reincarnation
        if (pool.e > 0) {
            return {
                nuclide: ELECTRON_DATA,
                usage: { p: 0, n: 0, e: 1 }
            };
        }
        return null;
    }

    const reachableCandidates: { nuclide: NuclideData; p: number }[] = [];

    // 2 & 3. Scan history for reachable nuclides with Z <= current Z
    Object.values(history).forEach(entry => {
        if (entry.z > currentNuclide.z) return;

        /**
         * Reachability check using the pool (building from scratch Z=0, A=0):
         * A_t = p + n  => n = A_t - p
         * Z_t = p - e  => e = p - Z_t
         * Constraints: 0 <= p <= pool.p, 0 <= n <= pool.n, 0 <= e <= pool.e
         * Derived p bounds:
         * max(0, A_t - pool.n, Z_t) <= p <= min(pool.p, A_t, Z_t + pool.e)
         */
        const L = Math.max(0, entry.a - pool.n, entry.z);
        const R = Math.min(pool.p, entry.a, entry.z + pool.e);

        if (L <= R) {
            const data = getNuclideDataSync(entry.z, entry.a);
            if (data.exists) {
                // p = L to minimize pool usage
                reachableCandidates.push({ nuclide: data, p: L });
            }
        }
    });

    if (reachableCandidates.length === 0) return null;

    // 4. Selection Algorithm
    reachableCandidates.sort((ca, cb) => {
        const a = ca.nuclide;
        const b = cb.nuclide;
        
        // Priority 1: Atom number Z closest to current (Descending order as we filter by Z_t <= Z_c)
        if (b.z !== a.z) return b.z - a.z;

        if (isDaredevilActive) {
            // Daredevil Mode (Risk Seek): 
            // 1. Z (already handled)
            // 2. Shortest life (Risk seek)
            if (a.halfLifeSeconds !== b.halfLifeSeconds) {
                return a.halfLifeSeconds - b.halfLifeSeconds;
            }
            
            // 3. Closest to Neutron Drip Line (highest A for this Z)
            const maxA = DRIP_LINE_LIMITS[a.z]?.maxA ?? a.a;
            return (maxA - a.a) - (maxA - b.a);
        } else {
            // Normal Mode (Stability Seek):
            
            // Priority 2: isStable (Stable first)
            if (a.isStable !== b.isStable) return b.isStable ? 1 : -1;
            
            // Priority 3: Highest A (Maximize mass preservation)
            if (b.a !== a.a) return b.a - a.a;

            // Priority 4: Half-life descending (Longest life first)
            // Note: Stable nuclides have halfLifeSeconds = Infinity
            return b.halfLifeSeconds - a.halfLifeSeconds;
        }
    });

    const best = reachableCandidates[0];
    const nUsed = best.nuclide.a - best.p;
    const eUsed = best.p - best.nuclide.z;

    return { 
        nuclide: best.nuclide, 
        usage: { p: best.p, n: nUsed, e: eUsed } 
    };
};

/**
 * Returns a random valid nuclide coordinate from the verified repository.
 * Equivalent to getRandomKnownNuclideCoordinates but located in the logic engine.
 */
export const pickRandomNuclideCoords = (): { z: number, a: number } | null => {
    const ids = Array.from(NUCLIDE_REPOSITORY.keys());
    if (ids.length === 0) return null;
    
    const randomId = ids[Math.floor(Math.random() * ids.length)];
    const parts = randomId.split('-');
    return { z: parseInt(parts[0]), a: parseInt(parts[1]) };
};

/**
 * Smarter selection for random starts.
 * 1. Favors undiscovered elements (Z).
 * 2. In Normal Mode: Uniformly picks an isotope (A) for the selected Z.
 * 3. In Hard Mode: Favors isotopes with short half-lives and those near drip lines.
 */
export const pickNuclideWithPriority = (unlockedElements: number[], isDaredevil: boolean): { z: number, a: number } | null => {
    // Step 1: Collect all Zs that exist in the repository
    const allZs = new Set<number>();
    for (const key of NUCLIDE_REPOSITORY.keys()) {
        const z = parseInt(key.split('-')[0]);
        allZs.add(z);
    }
    const zList = Array.from(allZs);
    if (zList.length === 0) return null;

    // Step 2: Weighted selection of Z (Element)
    // Undiscovered elements get a weight of 10, discovered get 1.
    const zWeights = zList.map(z => unlockedElements.includes(z) ? 1 : 10);
    const totalZWeight = zWeights.reduce((a, b) => a + b, 0);
    let zRand = Math.random() * totalZWeight;
    let selectedZ = zList[0];
    for (let i = 0; i < zList.length; i++) {
        zRand -= zWeights[i];
        if (zRand <= 0) {
            selectedZ = zList[i];
            break;
        }
    }

    // Step 3: Weighted selection of A (Isotope) for the chosen Z
    const prefix = `${selectedZ}-`;
    const availableAs: number[] = [];
    for (const key of NUCLIDE_REPOSITORY.keys()) {
        if (key.startsWith(prefix)) {
            availableAs.push(parseInt(key.substring(prefix.length)));
        }
    }

    if (availableAs.length === 0) return null;

    if (!isDaredevil) {
        // Normal Mode: Uniform random choice
        return { z: selectedZ, a: availableAs[Math.floor(Math.random() * availableAs.length)] };
    } else {
        // Hard Mode: Weight by instability
        const aWeights = availableAs.map(a => {
            const data = getNuclideDataSync(selectedZ, a);
            
            // Base weight: favor short half-lives
            // log10(1s) = 0, log10(1e-9s) = -9, log10(1e9s) = 9
            // Weight increases as half-life decreases
            let weight = 1 / (1 + Math.max(-8, Math.log10(Math.max(1e-12, data.halfLifeSeconds))));
            
            // Drip line bonus: double the weight if on any drip line
            if (data.isProtonDripLine || data.isNeutronDripLine) {
                weight *= 3.0;
            }
            
            return weight;
        });

        const totalAWeight = aWeights.reduce((a, b) => a + b, 0);
        let aRand = Math.random() * totalAWeight;
        let selectedA = availableAs[0];
        for (let i = 0; i < availableAs.length; i++) {
            aRand -= aWeights[i];
            if (aRand <= 0) {
                selectedA = availableAs[i];
                break;
            }
        }
        return { z: selectedZ, a: selectedA };
    }
};