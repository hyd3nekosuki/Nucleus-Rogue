import { GridEntity, Position, EntityType, GameState, DecayMode, VisualEffect, Language } from '../types';

import { GRID_WIDTH, GRID_HEIGHT } from '../constants/gameConfig';
import { isWithinBounds, findEntityAt, getFreeCells } from '../utils/gridUtils';
import { isPositron, isElectron, isLepton } from '../utils/particleUtils';
import { calculateInteraction, calculateNeutronReaction, calculateProtonReaction } from '../physics/atomicCalculator';
import { calculateAnnihilation } from '../physics/annihilationLogic';
import { TITLES } from '../constants/titles';
import { getLogMessages } from '../constants';

/**
 * Result structure for the physics simulation of a move.
 * Contains only raw physical changes and interaction metadata.
 */
export interface MoveResult {
    moved: boolean;
    newPos?: Position;
    dZ: number;
    dA: number;
    hpPenalty: number;
    energyBonus: number;
    actionBonusScore: number;
    inducedDecayMode?: DecayMode;
    inducedReactionLabel?: string;
    shouldShake?: boolean;
    shakeIntensity?: 'normal' | 'light';
    shouldFlash?: boolean;
    flashColor?: string;
    additionalEffects?: VisualEffect[];
    isPpFusion?: boolean;
    isPositronAbsorption?: boolean;
    isECCapture?: boolean;
    isAnnihilation?: boolean;
    isCoulombScattered?: boolean;
    isBremsAchieved?: boolean;
    isZeroBarnAchieved?: boolean;
    isFissionAchieved?: boolean;
    gluttonyTrigger?: boolean;
    targetEntity?: GridEntity;
    evolvedEntities: GridEntity[];
    scatteredMessage?: string;
    messages?: string[];
    ttsPriorityMessages?: string[];
    magicProtectionBonus?: number;
    chargesUsed: number;
    consecutiveProtons: number;
    consecutiveNeutrons: number;
    consecutiveElectrons: number;
    lastConsumedType: EntityType | null;
    reincarnationPoolIncrement: { p: number; n: number; e: number };
    // Add chainDecayResult to MoveResult interface to fix type error in handlers
    chainDecayResult?: any;
    byproduct?: { z: number, a: number };
    realPhysicsUnlockProgress?: {
        hasScatteredProton: boolean;
        hasScatteredElectron: boolean;
        hasAbsorbedNeutron: boolean;
    };
    tutorialMessage?: string | null;
    tutorialStartTurn?: number;
    newlyUnlockedGroups?: string[];
}

export const generateEntities = (count: number, currentEntities: GridEntity[], playerPos: Position, currentTurn: number = 0, forcedType?: EntityType, isFriendly?: boolean): GridEntity[] => {
    const newEntities = [...currentEntities];
    
    // Get all initial free cells once to improve performance
    let freeCells = getFreeCells(newEntities, playerPos);
    
    for (let i = 0; i < count; i++) {
        if (freeCells.length === 0) break;

        const randomIndex = Math.floor(Math.random() * freeCells.length);
        const pos = freeCells.splice(randomIndex, 1)[0];

        if (forcedType) {
            newEntities.push({
                id: Math.random().toString(36).substr(2, 9),
                type: forcedType,
                position: pos,
                spawnTurn: currentTurn,
                isHighEnergy: false,
                isFriendly: isFriendly // Assign affiliation
            });
        } else {
            const rand = Math.random();
            newEntities.push({
                id: Math.random().toString(36).substr(2, 9),
                type: rand > 0.9 ? EntityType.ENEMY_ELECTRON : (rand > 0.5 ? EntityType.PROTON : EntityType.NEUTRON),
                position: pos,
                spawnTurn: currentTurn,
                isHighEnergy: false,
                isFriendly: false // Natural spawns are predators
            });
        }
    }
    return newEntities;
};

/**
 * Physics Simulator: Calculates the outcome of a single move attempt.
 * Does NOT update GameState. Does NOT build messages.
 */
export const calculateMoveResult = (
    prev: GameState,
    dx: number,
    dy: number,
    ENERGY_EVOLUTION_TURNS: number,
    language: Language = 'en'
): MoveResult => {
    const logMessages = getLogMessages(language);
    const newPos: Position = { x: prev.playerPos.x + dx, y: prev.playerPos.y + dy };

    // 1. Validation
    if (!isWithinBounds(newPos)) {
        return { 
            moved: false, dZ: 0, dA: 0, hpPenalty: 0, energyBonus: 0, actionBonusScore: 0, evolvedEntities: prev.gridEntities, chargesUsed: 0,
            consecutiveProtons: prev.consecutiveProtons,
            consecutiveNeutrons: prev.consecutiveNeutrons,
            consecutiveElectrons: prev.consecutiveElectrons,
            lastConsumedType: prev.lastConsumedType,
            reincarnationPoolIncrement: { p: 0, n: 0, e: 0 },
            realPhysicsUnlockProgress: prev.realPhysicsUnlockProgress,
            tutorialMessage: undefined,
            tutorialStartTurn: prev.tutorialStartTurn,
            newlyUnlockedGroups: []
        };
    }

    // 2. Interaction Setup
    const entityMatch = findEntityAt(prev.gridEntities, newPos);
    
    let dZ = 0, dA = 0, hpPenalty = 0, energyBonus = 0, actionBonusScore = 0;
    let inducedDecayMode: DecayMode | undefined = undefined;
    let reactionLabel = "";
    let flashColor: string | undefined = undefined;
    let interactionResult: any = null;
    let nextEntities = [...prev.gridEntities];
    let targetEntity: GridEntity | undefined;
    let gluttonyTrigger = false;
    let chargesUsed = 0;
    let poolInc = { p: 0, n: 0, e: 0 };
    let messages: string[] = [];

    let cP = prev.consecutiveProtons;
    let cN = prev.consecutiveNeutrons;
    let cE = prev.consecutiveElectrons;
    let lT = prev.lastConsumedType;

    // Real Physics Unlock Progress Tracking
    let unlockProgress = { ...prev.realPhysicsUnlockProgress };
    let newTutorialMessage: string | undefined = undefined;
    let newTutorialStartTurn = prev.tutorialStartTurn;
    let newlyUnlockedGroups: string[] = [];

    const isZeroBarnActive = prev.unlockedGroups.includes(TITLES.ZERO_BARN) && !prev.disabledSkills.includes(TITLES.ZERO_BARN);
    const scatteringActive = prev.unlockedGroups.includes(TITLES.ELECTRON_SCATTERING) && !prev.disabledSkills.includes(TITLES.ELECTRON_SCATTERING);
    const isFusionDisabled = prev.disabledSkills.includes(TITLES.FUSION);
    const isDaredevilActive = prev.unlockedGroups.includes(TITLES.DEMON_CORE) && !prev.disabledSkills.includes(TITLES.DEMON_CORE);

    if (entityMatch) {
        targetEntity = entityMatch.entity;

        // Anti-nuclide Interaction - Refactored to external annihilation logic
        if (targetEntity.type === EntityType.ANTI_NUCLIDE) {
            const annihilationResult = calculateAnnihilation(prev.currentNuclide, targetEntity, newPos);
            nextEntities.splice(entityMatch.index, 1);
            
            return {
                ...annihilationResult,
                evolvedEntities: nextEntities,
                realPhysicsUnlockProgress: unlockProgress,
                tutorialMessage: undefined,
                tutorialStartTurn: newTutorialStartTurn,
                newlyUnlockedGroups: []
            };
        }

        // Collision prevention for positrons unless we are a neutron state or electron state
        if (targetEntity.type === EntityType.ENEMY_POSITRON && prev.currentNuclide.z !== 0 && prev.currentNuclide.z !== -1) {
            return { 
                moved: false, dZ: 0, dA: 0, hpPenalty: 0, energyBonus: 0, actionBonusScore: 0, evolvedEntities: prev.gridEntities, chargesUsed: 0,
                consecutiveProtons: prev.consecutiveProtons,
                consecutiveNeutrons: prev.consecutiveNeutrons,
                consecutiveElectrons: prev.consecutiveElectrons,
                lastConsumedType: prev.lastConsumedType,
                reincarnationPoolIncrement: { p: 0, n: 0, e: 0 },
                realPhysicsUnlockProgress: unlockProgress,
                tutorialMessage: undefined,
                tutorialStartTurn: newTutorialStartTurn,
                newlyUnlockedGroups: []
            };
        }

        const isPositronPlayer = isPositron(prev.currentNuclide);
        const isNoCapture = (isElectron(prev.currentNuclide) && (targetEntity.type === EntityType.NEUTRON || targetEntity.type === EntityType.ENEMY_ELECTRON || (targetEntity.type === EntityType.PROTON && !targetEntity.isHighEnergy))) ||
            (isPositronPlayer && (targetEntity.type === EntityType.NEUTRON || targetEntity.type === EntityType.ENEMY_POSITRON || targetEntity.type === EntityType.PROTON));
        if (!isNoCapture) {
            nextEntities.splice(entityMatch.index, 1);
        }
        if (nextEntities.length === 0) gluttonyTrigger = true;

        // Streak maintenance for Neutrons and Electrons
        if (targetEntity.type === EntityType.NEUTRON) {
            if (lT != EntityType.NEUTRON) { cP = 0; cN = 0; cE = 0; lT = EntityType.NEUTRON; }
            // Only increment streak if Zero Barn is NOT preventing the capture
            if (!isZeroBarnActive) { cN++; } 
            else { poolInc.n = 1; }

        } else if (targetEntity.type === EntityType.ENEMY_ELECTRON) {
            // Streak increment moved after interaction result to handle physical scattering
        }

        const isAnnihilationSkillActive = prev.unlockedGroups.includes(TITLES.PAIR_ANNIHILATION) && !prev.disabledSkills.includes(TITLES.PAIR_ANNIHILATION);

        // High energy proton special reactions
        const protonReaction = calculateProtonReaction(
            prev.currentNuclide,
            targetEntity,
            newPos,
            nextEntities,
            Date.now(),
            isAnnihilationSkillActive,
            !prev.disabledSkills.includes(TITLES.FISSION),
            prev.unlockedGroups.includes(TITLES.NEUTRONIZATION) && !prev.disabledSkills.includes(TITLES.NEUTRONIZATION),
            prev.unlockedGroups,
            prev.disabledSkills,
            language
        );

        // High energy neutron special reactions
        const neutronReaction = calculateNeutronReaction(
            prev.currentNuclide, 
            targetEntity, 
            newPos, 
            nextEntities, 
            Date.now(), 
            isAnnihilationSkillActive, 
            !prev.disabledSkills.includes(TITLES.FISSION),
            prev.unlockedGroups.includes(TITLES.NEUTRONIZATION) && !prev.disabledSkills.includes(TITLES.NEUTRONIZATION),
            isZeroBarnActive,
            isDaredevilActive,
            prev.unlockedGroups,
            prev.disabledSkills,
            language
        );

        if (protonReaction) {
            interactionResult = protonReaction;
            nextEntities = protonReaction.newGridEntities || nextEntities;
        } else if (neutronReaction) {
            interactionResult = neutronReaction;
            nextEntities = neutronReaction.newGridEntities || nextEntities;
        } else {
            interactionResult = calculateInteraction(
                prev.currentNuclide, targetEntity, cE, prev.hp, prev.magicBarrierCharges, 
                prev.unlockedGroups, prev.disabledSkills, language
            );
        }

        if (interactionResult.isAnnihilation) {
            const isPositronPlayer = isPositron(prev.currentNuclide);
            const annihilationMsg = isPositronPlayer ? logMessages.PHYSICS.POSITRON_ANNIHILATION : logMessages.PHYSICS.ELECTRON_ANNIHILATION;
            return {
                moved: true,
                newPos,
                dZ: 0, dA: 0, hpPenalty: 999, // Fatal
                isAnnihilation: true,
                energyBonus: 0, actionBonusScore: 0,
                evolvedEntities: nextEntities,
                messages: [annihilationMsg],
                chargesUsed: 0,
                consecutiveProtons: 0, consecutiveNeutrons: 0, consecutiveElectrons: 0,
                lastConsumedType: null,
                reincarnationPoolIncrement: { p: 0, n: 0, e: 0 },
                realPhysicsUnlockProgress: unlockProgress,
                newlyUnlockedGroups: []
            };
        }

        dZ = interactionResult.dZ;
        dA = interactionResult.dA;
        hpPenalty = interactionResult.hpPenalty;
        energyBonus = interactionResult.energyBonus || 0;
        actionBonusScore = interactionResult.actionBonusScore || 0;
        inducedDecayMode = interactionResult.inducedDecayMode;
        reactionLabel = interactionResult.inducedReactionLabel || "";
        flashColor = interactionResult.flashColor;
        chargesUsed = interactionResult.chargesUsed || 0;
        messages = interactionResult.messages || [];

        // Real Physics Unlock Progress Tracking
        const isRealPhysicsUnlocked = prev.unlockedGroups.includes(TITLES.REAL_PHYSICS);

        if (!isRealPhysicsUnlocked) {
            // 1. Proton scattering
            if (targetEntity.type === EntityType.PROTON && interactionResult.isCoulombScattered && !unlockProgress.hasScatteredProton) {
                unlockProgress.hasScatteredProton = true;
                newTutorialMessage = logMessages.SYSTEM.TUTORIAL_COULOMB_BARRIER;
                newTutorialStartTurn = prev.turn + 1;
            }
            // 2. Electron scattering
            if (targetEntity.type === EntityType.ENEMY_ELECTRON && interactionResult.isCoulombScattered && !unlockProgress.hasScatteredElectron) {
                unlockProgress.hasScatteredElectron = true;
                newTutorialMessage = logMessages.SYSTEM.TUTORIAL_MASS_STABILITY;
                newTutorialStartTurn = prev.turn + 1;
            }
            // 3. Neutron absorption resulting in transformation
            if (targetEntity.type === EntityType.NEUTRON && (dZ !== 0 || dA !== 0) && !unlockProgress.hasAbsorbedNeutron) {
                unlockProgress.hasAbsorbedNeutron = true;
                newTutorialMessage = logMessages.SYSTEM.TUTORIAL_NEUTRON_CAPTURE;
                newTutorialStartTurn = prev.turn + 1;
            }

            // Check for full unlock
            if (unlockProgress.hasScatteredProton && unlockProgress.hasScatteredElectron && unlockProgress.hasAbsorbedNeutron) {
                newlyUnlockedGroups.push(TITLES.REAL_PHYSICS);
            }
        }

        // Streak and Pool maintenance for Protons
        if (targetEntity.type === EntityType.PROTON) {
            if (!interactionResult.isCoulombScattered) {
                if (lT != EntityType.PROTON) { cP = 0; cN = 0; cE = 0; lT = EntityType.PROTON; }
                // 1 Success case: Capture occurred (No barrier block AND Fusion enabled)
                if (!isFusionDisabled) { cP++; }
                // 2. Skill case: Fusion is explicitly disabled by player (Absorption into pool)
                else { poolInc.p = 1; }
            }
        }

        // Streak and Pool maintenance for Electrons
        if (targetEntity.type === EntityType.ENEMY_ELECTRON) {
            if (!interactionResult.isCoulombScattered) {
                if (lT != EntityType.ENEMY_ELECTRON) { cP = 0; cN = 0; cE = 0; lT = EntityType.ENEMY_ELECTRON; }
                if (!scatteringActive) { cE++; }
                else { poolInc.e = 1; }
            }
        }

        if (interactionResult.isPpFusion) {
            nextEntities.push({ id: 'pp-fusion-eplus-' + Math.random().toString(36).substr(2, 9), type: EntityType.ENEMY_POSITRON, position: { ...prev.playerPos }, spawnTurn: prev.turn, isHighEnergy: false, isFriendly: true });
            gluttonyTrigger = false;
        }

        if (interactionResult.isCoulombScattered) {
            if (isLepton(prev.currentNuclide)) {
                // Electron or Positron is scattered
                const potentialCells = getFreeCells(nextEntities, newPos);
                if (potentialCells.length > 0) {
                    const respawnPos = potentialCells[Math.floor(Math.random() * potentialCells.length)];
                    return {
                        ...interactionResult,
                        moved: true,
                        newPos: respawnPos,
                        evolvedEntities: nextEntities, // Proton is NOT removed
                        consecutiveProtons: cP,
                        consecutiveNeutrons: cN,
                        consecutiveElectrons: cE,
                        lastConsumedType: lT,
                        reincarnationPoolIncrement: poolInc,
                        realPhysicsUnlockProgress: unlockProgress,
                        tutorialMessage: newTutorialMessage,
                        tutorialStartTurn: newTutorialStartTurn,
                        newlyUnlockedGroups
                    };
                }
            } else {
                // Use getFreeCells for scattering respawn
                const potentialCells = getFreeCells(nextEntities, newPos);
                
                if (potentialCells.length > 0) {
                    const respawnPos = potentialCells[Math.floor(Math.random() * potentialCells.length)];
                    nextEntities.push({ id: Math.random().toString(36).substr(2, 9), type: targetEntity.type, position: respawnPos, spawnTurn: prev.turn, isHighEnergy: false });
                }
                gluttonyTrigger = false;
            }
        }
    }

    // 3. Evolution of Entities
    const evolvedEntities = nextEntities.map(e => {
        if (e.type === EntityType.PROTON || e.type === EntityType.ENEMY_ELECTRON) {
            const elapsed = (prev.turn + 1) - e.spawnTurn;
            const shouldBeHigh = Math.floor(elapsed / ENERGY_EVOLUTION_TURNS) % 2 === 1;
            if (e.isHighEnergy !== shouldBeHigh) return { ...e, isHighEnergy: shouldBeHigh };
        }
        return e;
    });

    return { 
        moved: true, 
        newPos,
        dZ,
        dA,
        hpPenalty,
        energyBonus,
        actionBonusScore,
        inducedDecayMode, 
        inducedReactionLabel: reactionLabel, 
        shouldShake: !!interactionResult?.shouldShake || !!interactionResult?.isCoulombScattered || !!interactionResult?.isPpFusion || !!interactionResult?.isPositronAbsorption, 
        shakeIntensity: (interactionResult?.isCoulombScattered || interactionResult?.shakeIntensity === 'light') ? 'light' : 'normal',
        shouldFlash: !!interactionResult?.shouldFlash || !!interactionResult?.isPpFusion || !!interactionResult?.isPositronAbsorption, 
        flashColor,
        additionalEffects: interactionResult?.chainDecayResult?.additionalEffects, 
        isPpFusion: !!interactionResult?.isPpFusion, 
        isPositronAbsorption: !!interactionResult?.isPositronAbsorption, 
        isECCapture: !!interactionResult?.isECCapture,
        isCoulombScattered: !!interactionResult?.isCoulombScattered,
        isBremsAchieved: !!interactionResult?.isBremsAchieved,
        isZeroBarnAchieved: cN >= 20 && !prev.unlockedGroups.includes(TITLES.ZERO_BARN),
        isFissionAchieved: inducedDecayMode === DecayMode.SPONTANEOUS_FISSION,
        gluttonyTrigger,
        targetEntity,
        evolvedEntities,
        scatteredMessage: interactionResult?.scatteredMessage,
        messages,
        ttsPriorityMessages: interactionResult?.ttsPriorityMessages,
        magicProtectionBonus: interactionResult?.magicProtectionBonus,
        chargesUsed,
        consecutiveProtons: cP,
        consecutiveNeutrons: cN,
        consecutiveElectrons: cE,
        lastConsumedType: lT,
        reincarnationPoolIncrement: poolInc,
        chainDecayResult: interactionResult?.chainDecayResult,
        byproduct: interactionResult?.byproduct,
        realPhysicsUnlockProgress: unlockProgress,
        tutorialMessage: newTutorialMessage,
        tutorialStartTurn: newTutorialStartTurn,
        newlyUnlockedGroups
    };
};