import { EntityType, NuclideData, GridEntity, AtomicReactionResult, DecayMode, Position } from '../types';

import { BONUS_SCORES } from '../constants/economy';
import { COULOMB_BARRIER_THRESHOLD } from '../constants/physics';
import { HISTORY_METHODS } from '../constants/strings';
import { TITLES } from '../constants/titles';
import { LOG_MESSAGES } from '../constants/logMessageTextData';

import { getNuclideDataSync } from '../services/nuclideService';
import { calculateDecayEffects } from './decaySystem';
import { NEUTRON_CROSS_SECTIONS } from '../data/neutronReactions';
import { PROTON_CROSS_SECTIONS } from '../data/protonReactions';

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
    const isDaredevilActive = unlockedGroups.includes(TITLES.DEMON_CORE) && !disabledSkills.includes(TITLES.DEMON_CORE);
    const isRealPhysicsActive = !unlockedGroups.includes(TITLES.REAL_PHYSICS) || !disabledSkills.includes(TITLES.REAL_PHYSICS);

    // Special Case: Player is an Electron (Z=-1)
    if (currentNuclide.z === -1) {
        switch (target.type) {
            case EntityType.PROTON:
                if (target.isHighEnergy) {
                    // Forced Capture: e- + p -> n (High energy only)
                    res.dZ = 1; res.dA = 1;
                    res.messages.push(LOG_MESSAGES.PHYSICS.ELECTRON_PROTON_REACTION);
                    res.inducedReactionLabel = LOG_MESSAGES.HISTORY.ELECTRON_CAPTURE_PLAYER;
                    res.shouldFlash = true;
                    res.flashColor = "bg-white";
                    return res;
                } else {
                    // Normal energy p: No reaction, pass through
                    res.messages.push(LOG_MESSAGES.PHYSICS.ELECTRON_PASSES_PROTON);
                    return res;
                }
            case EntityType.NEUTRON:
                // No reaction, pass through
                res.messages.push(LOG_MESSAGES.PHYSICS.ELECTRON_PASSES_NEUTRON);
                return res;
            case EntityType.ENEMY_ELECTRON:
                // Coulomb repulsion: e- vs e-
                res.isCoulombScattered = true;
                res.scatteredMessage = LOG_MESSAGES.PHYSICS.COULOMB_REPULSION_EE;
                return res;
            case EntityType.ENEMY_POSITRON:
                // Annihilation
                res.isAnnihilation = true;
                return res;
            default:
                return res;
        }
    }

    switch (target.type) {
        case EntityType.PROTON:
            if (isFusionDisabled) {
                res.messages.push(LOG_MESSAGES.PHYSICS.PROTON_BLOCKED_BARRIER);
                // No dZ, dA, no isCoulombScattered -> pool in moveSimulator
            } else if (isRealPhysicsActive) {
                res.isCoulombScattered = true;
                res.scatteredMessage = LOG_MESSAGES.PHYSICS.PROTON_SCATTERED_BARRIER;
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
                    res.scatteredMessage = LOG_MESSAGES.PHYSICS.UNSTABLE_PROTON_CAPTURE;
                } else {
                    res.isCoulombScattered = true;
                    res.scatteredMessage = LOG_MESSAGES.PHYSICS.PROTON_SCATTERED_BARRIER;
                }
            }
            break;

        case EntityType.NEUTRON:
            if (isZeroBarnActive) {
                res.messages.push(LOG_MESSAGES.PHYSICS.NEUTRON_NOT_ABSORBED_ZERO_BARN);
            } else {
                res.dA = 1;
            }
            break;

        case EntityType.ENEMY_ELECTRON: {
            const isECCapable = currentNuclide.decayModes.some(m => 
                m === DecayMode.ELECTRON_CAPTURE ||
                m === DecayMode.DOUBLE_ELECTRON_CAPTURE ||
                m === DecayMode.EC_ALPHA ||
                m === DecayMode.EC_PROTON ||
                m === DecayMode.EC_2PROTON ||
                m === DecayMode.EC_SF ||
                m === DecayMode.EC_B_PLUS
            );

            if (isRealPhysicsActive) {
                // Real Physics ON: Only capture if any decay mode is EC-related
                if (isECCapable) {
                    res.dZ = -1;
                    res.isECCapture = true;
                    const ecMode = currentNuclide.decayModes.find(m => 
                        m === DecayMode.ELECTRON_CAPTURE ||
                        m === DecayMode.DOUBLE_ELECTRON_CAPTURE ||
                        m === DecayMode.EC_ALPHA ||
                        m === DecayMode.EC_PROTON ||
                        m === DecayMode.EC_2PROTON ||
                        m === DecayMode.EC_SF ||
                        m === DecayMode.EC_B_PLUS
                    );
                    res.messages = [LOG_MESSAGES.PHYSICS.ELECTRON_CAPTURED_VIA_CHANNEL(ecMode || "")].filter(Boolean);
                } else if (scatteringActive) {
                    res.messages.push(LOG_MESSAGES.PHYSICS.ELECTRON_SCATTERING_PREVENTS_CAPTURE);
                } else {
                    res.isCoulombScattered = true;
                    res.scatteredMessage = LOG_MESSAGES.PHYSICS.ELECTRON_SCATTERED_STABILITY;
                }
            } else if (scatteringActive) {
                res.messages.push(LOG_MESSAGES.PHYSICS.ELECTRON_SCATTERING_PREVENTS_CAPTURE);
            } else {
                if (hp <= 10 && consecutiveElectrons >= 5) res.isBremsAchieved = true;
                if (charges > 0 || target.isHighEnergy) {
                    res.dZ = -1;
                    if (isECCapable) res.isECCapture = true;
                    if (charges > 0 && !target.isHighEnergy) {
                        res.chargesUsed = 1;
                        res.magicProtectionBonus = currentNuclide.z * BONUS_SCORES.MAGIC_PROTECTION_PER_Z;
                    }
                } else {
                    res.hpPenalty = hp * 0.5; res.dZ = -1;
                    if (isECCapable) res.isECCapture = true;
                }
            }
            break;
        }

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
    isDaredevilActive: boolean = false,
    unlockedGroups: string[] = [],
    disabledSkills: string[] = []
): AtomicReactionResult | null => {
    if (target.type !== EntityType.NEUTRON || currentNuclide.z === -1) return null;

    const isRealPhysicsActive = !unlockedGroups.includes(TITLES.REAL_PHYSICS) || !disabledSkills.includes(TITLES.REAL_PHYSICS);

    // If zero barn is active, neutrons are ignored (no reaction)
    if (zeroBarnActive) {
        return {
            dZ: 0,
            dA: 0,
            hpPenalty: 0,
            energyBonus: 0,
            actionBonusScore: 0,
            messages: [target.isHighEnergy ? LOG_MESSAGES.PHYSICS.HIGH_ENERGY_NEUTRON_NOT_ABSORBED_ZERO_BARN : LOG_MESSAGES.PHYSICS.NEUTRON_NOT_ABSORBED_ZERO_BARN],
            chargesUsed: 0,
            newGridEntities: currentEntities,
            shouldFlash: false
        };
    }

    if (!isRealPhysicsActive) {
        // Real Physics is OFF: Use game-like random algorithm (formerly Unknown ON logic)
        if (!target.isHighEnergy) return null; // Let calculateInteraction handle normal neutrons (dA=1)

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
            shouldFlash: chosen.label === HISTORY_METHODS.REACTION_N2N ? false : decayResult.shouldFlash,
            flashColor: chosen.mode === DecayMode.SPONTANEOUS_FISSION ? 'bg-neon-blue' : decayResult.flashColor,
            chargesUsed: 0,
            chainDecayResult: decayResult,
            newGridEntities: decayResult.newGridEntities,
            byproduct: decayResult.byproduct
        };
    } else {
        // Real Physics is ON: Use realistic neutron nuclear reaction data (formerly Unknown OFF logic)
        const data = NEUTRON_CROSS_SECTIONS[`${currentNuclide.z}-${currentNuclide.a}`];
        if (data) {
            const energyIdx = target.isHighEnergy ? 1 : 0;
            const isDaredevilActive = unlockedGroups.includes(TITLES.DEMON_CORE) && !disabledSkills.includes(TITLES.DEMON_CORE);
            
            // Filter reactions based on existence if Demon core is OFF
            const allReactions = Object.entries(data.reactions);
            const validReactions = allReactions.filter(([key, xs]) => {
                if (xs[energyIdx] <= 0) return false;
                if (isDaredevilActive || key === "n,f") return true;
                
                let dZ = 0, dA = 0;
                switch (key) {
                    case "n,g": dZ = 0; dA = 1; break;
                    case "n,p": dZ = -1; dA = 0; break;
                    case "n,d": dZ = -1; dA = -1; break;
                    case "n,t": dZ = -1; dA = -2; break;
                    case "n,2n": dZ = 0; dA = -1; break;
                    case "n,a": dZ = -2; dA = -3; break;
                    default: dZ = 0; dA = 1;
                }
                return getNuclideDataSync(currentNuclide.z + dZ, currentNuclide.a + dA).exists;
            });

            const totalXS = validReactions.reduce((sum, [_, xs]) => sum + xs[energyIdx], 0);

            if (totalXS > 0) {
                let r = Math.random() * totalXS;
                let chosenKey = validReactions[0][0];
                for (const [key, xs] of validReactions) {
                    r -= xs[energyIdx];
                    if (r <= 0) {
                        chosenKey = key;
                        break;
                    }
                }

                let mode: DecayMode;
                let label: string;
                switch (chosenKey) {
                    case "n,g": mode = DecayMode.GAMMA; label = HISTORY_METHODS.REACTION_NG; break;
                    case "n,p": mode = DecayMode.PROTON_EMISSION; label = HISTORY_METHODS.REACTION_NP; break;
                    case "n,2n": mode = DecayMode.NEUTRON_EMISSION; label = HISTORY_METHODS.REACTION_N2N; break;
                    case "n,d": mode = DecayMode.DEUTERON_EMISSION; label = HISTORY_METHODS.REACTION_ND; break;
                    case "n,t": mode = DecayMode.TRITON_EMISSION; label = HISTORY_METHODS.REACTION_NT; break;
                    case "n,a": mode = DecayMode.ALPHA; label = HISTORY_METHODS.REACTION_NA; break;
                    case "n,f": mode = DecayMode.SPONTANEOUS_FISSION; label = HISTORY_METHODS.REACTION_NF; break;
                    default: mode = DecayMode.GAMMA; label = HISTORY_METHODS.REACTION_NG;
                }

                // If fission is disabled, replace (n,f) with (n,a)
                if (chosenKey === "n,f" && !fissionEnabled) {
                    mode = DecayMode.ALPHA;
                    label = HISTORY_METHODS.REACTION_NA;
                }

                const intermediateData = getNuclideDataSync(currentNuclide.z, currentNuclide.a + 1);
                const decayResult = calculateDecayEffects(
                    mode, 
                    intermediateData, 
                    playerPos, 
                    currentEntities, 
                    currentTime, 
                    annihilationEnabled, 
                    fissionEnabled,
                    neutronStarEnabled
                );

                let stackedDA = 1 + decayResult.dA;
                if (label === HISTORY_METHODS.REACTION_N2N) stackedDA = -1;

                return {
                    dZ: decayResult.dZ,
                    dA: stackedDA,
                    hpPenalty: 0,
                    energyBonus: decayResult.energyBonus,
                    actionBonusScore: decayResult.actionBonusScore,
                    messages: decayResult.extraMessages,
                    inducedDecayMode: mode,
                    inducedReactionLabel: label,
                    shouldShake: decayResult.shouldShake,
                    shouldFlash: label === HISTORY_METHODS.REACTION_N2N ? false : decayResult.shouldFlash,
                    flashColor: mode === DecayMode.SPONTANEOUS_FISSION ? 'bg-neon-blue' : decayResult.flashColor,
                    chargesUsed: 0,
                    chainDecayResult: decayResult,
                    newGridEntities: decayResult.newGridEntities,
                    byproduct: decayResult.byproduct
                };
            }
        }

        // Default behavior: N increases by 1, Mass increases by 1
        return {
            dZ: 0,
            dA: 1,
            hpPenalty: 0,
            energyBonus: 0,
            actionBonusScore: 0,
            messages: [],
            inducedReactionLabel: HISTORY_METHODS.NEUTRON_CAPTURE,
            chargesUsed: 0
        };
    }
};

/**
 * Pure function to calculate special reactions for high energy protons.
 */
export const calculateProtonReaction = (
    currentNuclide: NuclideData,
    target: GridEntity,
    playerPos: Position,
    currentEntities: GridEntity[],
    currentTime: number,
    annihilationEnabled: boolean,
    fissionEnabled: boolean,
    neutronStarEnabled: boolean,
    unlockedGroups: string[] = [],
    disabledSkills: string[] = []
): AtomicReactionResult | null => {
    if (target.type !== EntityType.PROTON || !target.isHighEnergy || currentNuclide.z === -1) return null;

    const isRealPhysicsActive = !unlockedGroups.includes(TITLES.REAL_PHYSICS) || !disabledSkills.includes(TITLES.REAL_PHYSICS);
    const isFusionDisabled = disabledSkills.includes(TITLES.FUSION);

    if (isFusionDisabled) {
        return {
            dZ: 0, dA: 0, hpPenalty: 0, energyBonus: 0, actionBonusScore: 0,
            messages: [LOG_MESSAGES.PHYSICS.PROTON_BLOCKED_BARRIER],
            chargesUsed: 0
        };
    }

    if (!isRealPhysicsActive) return null;

    const data = PROTON_CROSS_SECTIONS[`${currentNuclide.z}-${currentNuclide.a}`];
    if (!data) return null;

    const energyIdx = 1; // High energy
    const isDaredevilActive = unlockedGroups.includes(TITLES.DEMON_CORE) && !disabledSkills.includes(TITLES.DEMON_CORE);

    // Filter reactions based on existence if Demon core is OFF
    const allReactions = Object.entries(data.reactions);
    const validReactions = allReactions.filter(([key, xs]) => {
        if (xs[energyIdx] <= 0) return false;
        if (isDaredevilActive || key === "p,f") return true;

        let dZ = 0, dA = 0;
        switch (key) {
            case "p,n": dZ = 1; dA = 0; break;
            case "p,2n": dZ = 1; dA = -1; break;
            case "p,g": dZ = 1; dA = 1; break;
            case "p,n+p": dZ = 0; dA = -1; break;
            case "p,2p": dZ = -1; dA = -1; break;
            case "p,p+a": dZ = -2; dA = -4; break;
            case "p,a": dZ = -1; dA = -3; break;
            case "p,d": dZ = 0; dA = -1; break;
            case "p,t": dZ = 0; dA = -2; break;
            case "p,he3": dZ = -1; dA = -2; break;
            default: dZ = 1; dA = 1;
        }
        return getNuclideDataSync(currentNuclide.z + dZ, currentNuclide.a + dA).exists;
    });

    const totalXS = validReactions.reduce((sum, [_, xs]) => sum + xs[energyIdx], 0);

    if (totalXS > 0) {
        let r = Math.random() * totalXS;
        let chosenKey = validReactions[0][0];
        for (const [key, xs] of validReactions) {
            r -= xs[energyIdx];
            if (r <= 0) {
                chosenKey = key;
                break;
            }
        }

        let mode: DecayMode;
        let label: string;
        let extraEmissions: EntityType[] = [];
        
        switch (chosenKey) {
            case "p,n": 
                mode = DecayMode.NEUTRON_EMISSION; 
                label = HISTORY_METHODS.REACTION_PN; 
                break;
            case "p,2n":
                mode = DecayMode.TWO_NEUTRON_EMISSION;
                label = HISTORY_METHODS.REACTION_P2N;
                break;
            case "p,g": 
                mode = DecayMode.GAMMA; 
                label = HISTORY_METHODS.REACTION_PG; 
                break;
            case "p,n+p": 
                mode = DecayMode.NEUTRON_EMISSION; 
                label = HISTORY_METHODS.REACTION_PNP; 
                extraEmissions = [EntityType.PROTON];
                break;
            case "p,2p":
                mode = DecayMode.PROTON_EMISSION;
                label = HISTORY_METHODS.REACTION_P2P;
                extraEmissions = [EntityType.PROTON];
                break;
            case "p,p+a":
                mode = DecayMode.ALPHA;
                label = HISTORY_METHODS.REACTION_PPA;
                extraEmissions = [EntityType.PROTON];
                break;
            case "p,f":
                mode = DecayMode.SPONTANEOUS_FISSION;
                label = HISTORY_METHODS.REACTION_PF;
                break;
            case "p,a":
                mode = DecayMode.ALPHA;
                label = HISTORY_METHODS.REACTION_PA;
                break;
            case "p,d":
                mode = DecayMode.DEUTERON_EMISSION;
                label = HISTORY_METHODS.REACTION_PD;
                break;
            case "p,t":
                mode = DecayMode.TRITON_EMISSION;
                label = HISTORY_METHODS.REACTION_PT;
                break;
            case "p,he3":
                mode = DecayMode.HELIUM3_EMISSION;
                label = HISTORY_METHODS.REACTION_PHE3;
                break;
            default: 
                mode = DecayMode.GAMMA; 
                label = HISTORY_METHODS.REACTION_PG;
        }

        // Intermediate state is (Z+1, A+1) after absorbing the proton
        const intermediateData = getNuclideDataSync(currentNuclide.z + 1, currentNuclide.a + 1);
        
        const decayResult = calculateDecayEffects(
            mode, 
            intermediateData, 
            playerPos, 
            currentEntities, 
            currentTime, 
            annihilationEnabled, 
            fissionEnabled,
            neutronStarEnabled
        );

        // Stacking logic:
        // Absorption: dZ+1, dA+1
        // (p,n):   Intermediate(Z+1, A+1) -> n emission -> Final(Z+1, A). Net: dZ+1, dA+0
        // (p,g):   Intermediate(Z+1, A+1) -> gamma -> Final(Z+1, A+1). Net: dZ+1, dA+1
        // (p,n+p): Intermediate(Z+1, A+1) -> n emission -> (Z+1, A) -> p emission -> Final(Z, A-1). Net: dZ+0, dA-1
        
        let stackedDZ = 1 + decayResult.dZ;
        let stackedDA = 1 + decayResult.dA;
        
        if (chosenKey === "p,n+p") {
            stackedDZ = 0;
            stackedDA = -1;
            decayResult.emissions = [...(decayResult.emissions || []), ...extraEmissions];
        } else if (chosenKey === "p,2p") {
            stackedDZ = -1;
            stackedDA = -1;
            decayResult.emissions = [...(decayResult.emissions || []), ...extraEmissions];
        } else if (chosenKey === "p,p+a") {
            stackedDZ = -2;
            stackedDA = -4;
            decayResult.emissions = [...(decayResult.emissions || []), ...extraEmissions];
        }

        return {
            dZ: stackedDZ,
            dA: stackedDA,
            hpPenalty: 0,
            energyBonus: decayResult.energyBonus,
            actionBonusScore: decayResult.actionBonusScore,
            messages: decayResult.extraMessages,
            inducedDecayMode: mode,
            inducedReactionLabel: label,
            shouldShake: decayResult.shouldShake,
            shouldFlash: decayResult.shouldFlash,
            flashColor: mode === DecayMode.SPONTANEOUS_FISSION ? 'bg-neon-blue' : decayResult.flashColor,
            chargesUsed: 0,
            chainDecayResult: decayResult,
            newGridEntities: decayResult.newGridEntities,
            byproduct: decayResult.byproduct
        };
    }

    return null;
};
