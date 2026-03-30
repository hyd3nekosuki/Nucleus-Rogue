
import { EntityType, NuclideData, GridEntity, Position } from '../types';
import { ANNIHILATION_ENERGY_REWARD } from '../constants/economy';

/**
 * Calculates the outcome of a collision between the nucleus and an anti-nuclide.
 * Returns core state changes required for Total Annihilation.
 */
export const calculateAnnihilation = (
    currentNuclide: NuclideData,
    targetEntity: GridEntity,
    newPos: Position
) => {
    // Massive energy release proportional to mass
    //const energyBonus = Math.floor(940 * currentNuclide.a);
    //const actionBonusScore= 1000000;
    const energyBonus = ANNIHILATION_ENERGY_REWARD; // <- need to reconsider
    const actionBonusScore = Math.floor(940 * currentNuclide.a);
    
    // Core collapses to absolute zero
    const dZ = -currentNuclide.z;
    const dA = -currentNuclide.a;

    return {
        moved: true,
        newPos,
        dZ,
        dA,
        hpPenalty: 0,
        energyBonus,
        actionBonusScore,
        shouldShake: true,
        shouldFlash: true,
        chargesUsed: 0,
        consecutiveProtons: 0,
        consecutiveNeutrons: 0,
        consecutiveElectrons: 0,
        lastConsumedType: null,
        reincarnationPoolIncrement: { p: 0, n: 0, e: 0 },
        targetEntity: targetEntity
    };
};
