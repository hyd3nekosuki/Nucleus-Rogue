import { EntityType, NuclideData, GridEntity, AtomicReactionResult, DecayMode, Position } from '../types';

import { BONUS_SCORES } from '../constants/economy';
import { COULOMB_BARRIER_THRESHOLD } from '../constants/physics';
import { HISTORY_METHODS } from '../constants/strings';
import { TITLES } from '../constants/titles';


import { getNuclideDataSync } from '../services/nuclideService';
import { calculateDecayEffects } from './decaySystem';

/**
 * Pure function to calculate the outcome of a collision with an entity.
 */
export const calculateInteraction = (
    currentNuclide: NuclideData,
    target: GridEntity,
    consecutiveElectrons: number,
    hp: number,
    charges: number,
    unlockedGroups: string[],
    disabledSkills: string[]
): AtomicReactionResult => {
    const res: AtomicReactionResult = {
        dZ: 0, dA: 0, hpPenalty: 0, energyBonus: 0, actionBonusScore: 0,
        messages: [], chargesUsed: 0
    };

    const isFusionDisabled = disabledSkills.includes(TITLES.FUSION);
    const isZeroBarnActive = unlockedGroups.includes(TITLES.ZERO_BARN) && !disabledSkills.includes(TITLES.ZERO_BARN);
    const scatteringActive = unlockedGroups.includes(TITLES.ELECTRON_SCATTERING) && !disabledSkills.includes(TITLES.ELECTRON_SCATTERING);
    const isDaredevilActive = unlockedGroups.includes(TITLES.DAREDEVIL) && !disabledSkills.includes(TITLES.DAREDEVIL);

    switch (target.type) {
        case EntityType.PROTON:
            if (isFusionDisabled) {
                res.scatteredMessage = "Proton was blocked by Coulomb barrier";
            } else if (currentNuclide.z === 1 && currentNuclide.a === 1 && target.isHighEnergy) {
                res.isPpFusion = true;
                res.dA = 1; 
            } else if (charges > 0 || target.isHighEnergy || currentNuclide.z === 0) {
                res.dZ = 1; res.dA = 1;
                if (charges > 0 && !target.isHighEnergy && currentNuclide.z !== 0) {
                    res.chargesUsed = 1;
                    res.magicProtectionBonus = currentNuclide.z * BONUS_SCORES.MAGIC_PROTECTION_PER_Z;
                }
            } else if (hp > COULOMB_BARRIER_THRESHOLD) {
                res.hpPenalty = 20; res.dZ = 1; res.dA = 1;
            } else {
                // Hard mode safety removal for Daredevil
                if (isDaredevilActive) {
                    //res.hpPenalty = 999; // Fatal
                    res.hpPenalty = 20;
                    res.dZ = 1; res.dA = 1; // Daredevil: Allow transformation even if fatal
                    res.scatteredMessage = "Unstable proton capture";
                } else {
                    res.isCoulombScattered = true;
                    res.scatteredMessage = "Proton was scattered by Coulomb barrier";
                }
            }
            break;

        case EntityType.NEUTRON:
            if (isZeroBarnActive) {
                res.scatteredMessage = "Neutron was not absorbed due to 0 barn";
            } else {
                res.dA = 1;
            }
            break;

        case EntityType.ENEMY_ELECTRON:
            if (scatteringActive) {
                res.scatteredMessage = "Electron scattering prevents capture";
            } else {
                if (hp <= 10 && consecutiveElectrons >= 5) res.isBremsAchieved = true;
                if (charges > 0 || target.isHighEnergy) {
                    res.dZ = -1;
                    if (charges > 0 && !target.isHighEnergy) {
                        res.chargesUsed = 1;
                        res.magicProtectionBonus = currentNuclide.z * BONUS_SCORES.MAGIC_PROTECTION_PER_Z;
                    }
                } else {
                    res.hpPenalty = hp * 0.5; res.dZ = -1;
                }
            }
            break;

        case EntityType.ENEMY_POSITRON:
            res.isPositronAbsorption = true;
            res.dZ = 1;
            break;
    }

    return res;
};

/**
 * Pure function to calculate special reactions for high energy neutrons.
 * Redesigned to stack absorption (+1A) and emission consequences correctly.
 */
export const calculateNeutronReaction = (
    currentNuclide: NuclideData,
    target: GridEntity,
    playerPos: Position,
    currentEntities: GridEntity[],
    currentTime: number,
    annihilationEnabled: boolean,
    fissionEnabled: boolean,
    neutronStarEnabled: boolean,
    zeroBarnActive: boolean,
    isDaredevilActive: boolean = false
): AtomicReactionResult | null => {
    if (target.type !== EntityType.NEUTRON || !target.isHighEnergy) return null;

    // If zero barn is active, high energy neutrons are also ignored (no reaction)
    if (zeroBarnActive) {
        return {
            dZ: 0,
            dA: 0,
            hpPenalty: 0,
            energyBonus: 0,
            actionBonusScore: 0,
            messages: [],
            scatteredMessage: "High energy neutron was not absorbed due to 0 barn",
            chargesUsed: 0,
            newGridEntities: currentEntities
        };
    }

    // Absorption phase
    const intermediateData = getNuclideDataSync(currentNuclide.z, currentNuclide.a + 1);
    
    // Daredevil check for initial absorption existence
    if (!isDaredevilActive && !intermediateData.exists) return null;

    const options = [];

    // (n,γ) is valid if player can exist at currentZ, currentA + 1
    if (isDaredevilActive || intermediateData.exists) {
        options.push({ mode: DecayMode.GAMMA, label: HISTORY_METHODS.REACTION_NG });
    }

    // (n,p) validation -> Resulting state is (Z-1, A)
    if (isDaredevilActive || getNuclideDataSync(currentNuclide.z - 1, currentNuclide.a).exists) {
        options.push({ mode: DecayMode.PROTON_EMISSION, label: HISTORY_METHODS.REACTION_NP });
    }

    // (n,2n) validation -> Resulting state is (Z, A-1)
    if (isDaredevilActive || getNuclideDataSync(currentNuclide.z, currentNuclide.a - 1).exists) {
        options.push({ mode: DecayMode.NEUTRON_EMISSION, label: HISTORY_METHODS.REACTION_N2N });
    }
    
    // Fission condition: Normally Z >= 92, but Daredevil allows it for all elements
    if (isDaredevilActive || intermediateData.z >= 92) {
        if (!fissionEnabled) {
            // (n,α) validation -> Resulting state is (Z-2, A-3)
            if (isDaredevilActive || getNuclideDataSync(currentNuclide.z - 2, currentNuclide.a - 3).exists) {
                options.push({ mode: DecayMode.ALPHA, label: HISTORY_METHODS.REACTION_NA });
            }
        }
        else options.push({ mode: DecayMode.SPONTANEOUS_FISSION, label: HISTORY_METHODS.REACTION_NF });
    }

    if (options.length === 0) return null;
    
    const chosen = options[Math.floor(Math.random() * options.length)];
    
    // Decay phase (triggered by absorption energy)
    // Pass currentEntities (the ones already adjusted for the collision) to calculateDecayEffects
    const decayResult = calculateDecayEffects(
        chosen.mode, 
        intermediateData, 
        playerPos, 
        currentEntities, 
        currentTime, 
        annihilationEnabled, 
        fissionEnabled,
        neutronStarEnabled
    );
    
    // Stacking logic: 
    // If (n,2n) label is used, we ensure total net dA is -1 relative to current nuclide.
    let stackedDA = 1 + decayResult.dA;
    if (chosen.label === HISTORY_METHODS.REACTION_N2N) stackedDA = -1;

    return {
        dZ: decayResult.dZ,
        dA: stackedDA,
        hpPenalty: 0,
        energyBonus: decayResult.energyBonus,
        actionBonusScore: decayResult.actionBonusScore,
        messages: decayResult.extraMessages,
        inducedDecayMode: chosen.mode,
        inducedReactionLabel: chosen.label,
        shouldShake: decayResult.shouldShake,
        shouldFlash: decayResult.shouldFlash,
        chargesUsed: 0,
        chainDecayResult: decayResult,
        newGridEntities: decayResult.newGridEntities
    };
};