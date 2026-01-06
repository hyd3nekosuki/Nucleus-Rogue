import { EntityType, NuclideData, Position } from '../types';
import { BONUS_SCORES, COULOMB_BARRIER_THRESHOLD } from '../constants';

export interface InteractionResult {
    dZ: number;
    dA: number;
    hpPenalty: number;
    scatteredMessage?: string;
    isPpFusion?: boolean;
    isPositronAbsorption?: boolean;
    isCoulombScattered?: boolean;
    isBremsAchieved?: boolean;
    magicProtectionBonus?: number;
    chargesUsed: number;
}

/**
 * Pure function to determine the outcome of a collision between the player and an entity.
 */
export const handleEntityInteraction = (
    currentNuclide: NuclideData,
    entity: { type: EntityType, isHighEnergy: boolean },
    consecutiveElectrons: number,
    currentHP: number,
    currentCharges: number,
    unlockedGroups: string[],
    disabledSkills: string[]
): InteractionResult => {
    let result: InteractionResult = {
        dZ: 0, dA: 0, hpPenalty: 0, chargesUsed: 0
    };

    const isFusionDisabled = disabledSkills.includes("Fusion");
    const isZeroBarnActive = unlockedGroups.includes("zero barn") && !disabledSkills.includes("zero barn");
    const scatteringActive = unlockedGroups.includes("Electron scattering") && !disabledSkills.includes("Electron scattering");

    switch (entity.type) {
        case EntityType.PROTON:
            if (isFusionDisabled) {
                result.scatteredMessage = "Proton was blocked by Coulomb barrier";
            } else if (currentNuclide.z === 1 && currentNuclide.a === 1 && entity.isHighEnergy) {
                result.isPpFusion = true;
                result.dA = 1; 
            } else if (currentCharges > 0 || entity.isHighEnergy || currentNuclide.z === 0) {
                result.dZ = 1; result.dA = 1;
                if (currentCharges > 0 && !entity.isHighEnergy && currentNuclide.z !== 0) {
                    result.chargesUsed = 1;
                    result.magicProtectionBonus = currentNuclide.z * BONUS_SCORES.MAGIC_PROTECTION_PER_Z;
                }
            } else if (currentHP > COULOMB_BARRIER_THRESHOLD) {
                result.hpPenalty = 20; result.dZ = 1; result.dA = 1;
            } else {
                result.isCoulombScattered = true;
                result.scatteredMessage = "Proton was scattered by Coulomb barrier";
            }
            break;

        case EntityType.NEUTRON:
            if (isZeroBarnActive) {
                result.scatteredMessage = "Neutron was not absorbed due to 0 barn";
            } else {
                result.dA = 1;
            }
            break;

        case EntityType.ENEMY_ELECTRON:
            if (scatteringActive) {
                result.scatteredMessage = "Electron scattering prevents capture";
            } else {
                if (currentHP <= 10 && consecutiveElectrons >= 5) result.isBremsAchieved = true;
                if (currentCharges > 0 || entity.isHighEnergy) {
                    result.dZ = -1;
                    if (currentCharges > 0 && !entity.isHighEnergy) {
                        result.chargesUsed = 1;
                        result.magicProtectionBonus = currentNuclide.z * BONUS_SCORES.MAGIC_PROTECTION_PER_Z;
                    }
                } else {
                    result.hpPenalty = currentHP * 0.5; result.dZ = -1;
                }
            }
            break;

        case EntityType.ENEMY_POSITRON:
            result.isPositronAbsorption = true;
            result.dZ = 1;
            break;
    }

    return result;
};