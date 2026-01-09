import { GridEntity, Position, EntityType, GameState, DecayMode, VisualEffect } from '../types';

import { GRID_WIDTH, GRID_HEIGHT } from '../constants/gameConfig';
import { isWithinBounds, findEntityAt } from '../utils/gridUtils';
import { calculateInteraction, calculateNeutronReaction } from '../physics/atomicCalculator';

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
    shouldFlash?: boolean;
    additionalEffects?: VisualEffect[];
    isPpFusion?: boolean;
    isPositronAbsorption?: boolean;
    isCoulombScattered?: boolean;
    isBremsAchieved?: boolean;
    isZeroBarnAchieved?: boolean;
    isFissionAchieved?: boolean;
    gluttonyTrigger?: boolean;
    targetEntity?: GridEntity;
    evolvedEntities: GridEntity[];
    scatteredMessage?: string;
    magicProtectionBonus?: number;
    chargesUsed: number;
    consecutiveProtons: number;
    consecutiveNeutrons: number;
    consecutiveElectrons: number;
    lastConsumedType: EntityType | null;
}

export const generateEntities = (count: number, currentEntities: GridEntity[], playerPos: Position, currentTurn: number = 0, forcedType?: EntityType): GridEntity[] => {
    const newEntities = [...currentEntities];
    for (let i = 0; i < count; i++) {
        let pos: Position;
        let attempts = 0;
        do {
          pos = { x: Math.floor(Math.random() * GRID_WIDTH), y: Math.floor(Math.random() * GRID_HEIGHT) };
          attempts++;
        } while (
            (pos.x === playerPos.x && pos.y === playerPos.y) || 
            newEntities.some(e => e.position.x === pos.x && e.position.y === pos.y) && attempts < 10
        );

        if (forcedType) {
            newEntities.push({
                id: Math.random().toString(36).substr(2, 9),
                type: forcedType,
                position: pos,
                spawnTurn: currentTurn,
                isHighEnergy: false
            });
        } else {
            const rand = Math.random();
            newEntities.push({
              id: Math.random().toString(36).substr(2, 9),
              type: rand > 0.9 ? EntityType.ENEMY_ELECTRON : (rand > 0.5 ? EntityType.PROTON : EntityType.NEUTRON),
              position: pos,
              spawnTurn: currentTurn,
              isHighEnergy: false
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
    ENERGY_EVOLUTION_TURNS: number
): MoveResult => {
    const newPos: Position = { x: prev.playerPos.x + dx, y: prev.playerPos.y + dy };

    // 1. Validation
    if (!isWithinBounds(newPos)) {
        return { 
            moved: false, dZ: 0, dA: 0, hpPenalty: 0, energyBonus: 0, actionBonusScore: 0, evolvedEntities: prev.gridEntities, chargesUsed: 0,
            consecutiveProtons: prev.consecutiveProtons,
            consecutiveNeutrons: prev.consecutiveNeutrons,
            consecutiveElectrons: prev.consecutiveElectrons,
            lastConsumedType: prev.lastConsumedType
        };
    }

    // 2. Interaction Setup
    const entityMatch = findEntityAt(prev.gridEntities, newPos);
    
    let dZ = 0, dA = 0, hpPenalty = 0, energyBonus = 0, actionBonusScore = 0;
    let inducedDecayMode: DecayMode | undefined = undefined;
    let reactionLabel = "";
    let interactionResult: any = null;
    let nextEntities = [...prev.gridEntities];
    let targetEntity: GridEntity | undefined;
    let gluttonyTrigger = false;
    let chargesUsed = 0;

    let cP = prev.consecutiveProtons;
    let cN = prev.consecutiveNeutrons;
    let cE = prev.consecutiveElectrons;
    let lT = prev.lastConsumedType;

    const isZeroBarnActive = prev.unlockedGroups.includes("zero barn") && !prev.disabledSkills.includes("zero barn");
    const scatteringActive = prev.unlockedGroups.includes("Electron scattering") && !prev.disabledSkills.includes("Electron scattering");
    const isFusionDisabled = prev.disabledSkills.includes("Fusion");

    if (entityMatch) {
        targetEntity = entityMatch.entity;
        // Collision prevention for positrons unless we are a neutron state
        if (targetEntity.type === EntityType.ENEMY_POSITRON && prev.currentNuclide.z !== 0) {
            return { 
                moved: false, dZ: 0, dA: 0, hpPenalty: 0, energyBonus: 0, actionBonusScore: 0, evolvedEntities: prev.gridEntities, chargesUsed: 0,
                consecutiveProtons: prev.consecutiveProtons,
                consecutiveNeutrons: prev.consecutiveNeutrons,
                consecutiveElectrons: prev.consecutiveElectrons,
                lastConsumedType: prev.lastConsumedType
            };
        }

        nextEntities.splice(entityMatch.index, 1);
        if (nextEntities.length === 0) gluttonyTrigger = true;

        // Streak maintenance
        if (targetEntity.type === EntityType.PROTON) {
            // Only increment streak if Fusion is not explicitly disabled
            if (!isFusionDisabled) {
                if (lT === EntityType.PROTON) cP++; else { cP = 1; cN = 0; cE = 0; lT = EntityType.PROTON; }
            }
        } else if (targetEntity.type === EntityType.NEUTRON) {
            // Only increment streak if Zero Barn is NOT preventing the capture
            if (!isZeroBarnActive) {
                if (lT === EntityType.NEUTRON) cN++; else { cP = 0; cN = 1; cE = 0; lT = EntityType.NEUTRON; }
            }
        } else if (targetEntity.type === EntityType.ENEMY_ELECTRON) {
            // Only increment streak if scattering is not preventing the capture
            if (!scatteringActive) {
                if (lT === EntityType.ENEMY_ELECTRON) cE++; else { cP = 0; cN = 0; cE = 1; lT = EntityType.ENEMY_ELECTRON; }
            }
        }

        const isAnnihilationSkillActive = prev.unlockedGroups.includes("Pair annihilation") && !prev.disabledSkills.includes("Pair annihilation");

        // High energy neutron special reactions
        const neutronReaction = calculateNeutronReaction(
            prev.currentNuclide, 
            targetEntity, 
            newPos, 
            nextEntities, 
            Date.now(), 
            isAnnihilationSkillActive, 
            !prev.disabledSkills.includes("Fission"),
            prev.unlockedGroups.includes("Neutronization") && !prev.disabledSkills.includes("Neutronization"),
            isZeroBarnActive
        );

        if (neutronReaction) {
            interactionResult = neutronReaction;
            nextEntities = neutronReaction.newGridEntities || nextEntities;
        } else {
            interactionResult = calculateInteraction(
                prev.currentNuclide, targetEntity, cE, prev.hp, prev.magicBarrierCharges, 
                prev.unlockedGroups, prev.disabledSkills
            );
        }

        dZ = interactionResult.dZ;
        dA = interactionResult.dA;
        hpPenalty = interactionResult.hpPenalty;
        energyBonus = interactionResult.energyBonus || 0;
        actionBonusScore = interactionResult.actionBonusScore || 0;
        inducedDecayMode = interactionResult.inducedDecayMode;
        reactionLabel = interactionResult.inducedReactionLabel || "";
        chargesUsed = interactionResult.chargesUsed || 0;

        if (interactionResult.isPpFusion) {
            nextEntities.push({ id: 'pp-fusion-eplus-' + Math.random().toString(36).substr(2, 9), type: EntityType.ENEMY_POSITRON, position: { ...prev.playerPos }, spawnTurn: prev.turn, isHighEnergy: false });
            gluttonyTrigger = false;
        }

        if (interactionResult.isCoulombScattered) {
            let attempts = 0, respawnPos: Position;
            do { respawnPos = { x: Math.floor(Math.random() * GRID_WIDTH), y: Math.floor(Math.random() * GRID_HEIGHT) }; attempts++; } 
            while ( (respawnPos.x === newPos.x && respawnPos.y === newPos.y) || nextEntities.some(e => e.position.x === respawnPos.x && e.position.y === respawnPos.y) && attempts < 10 );
            nextEntities.push({ id: Math.random().toString(36).substr(2, 9), type: EntityType.PROTON, position: respawnPos, spawnTurn: prev.turn, isHighEnergy: false });
            gluttonyTrigger = false;
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
        shouldFlash: !!interactionResult?.shouldFlash || !!interactionResult?.isPpFusion || !!interactionResult?.isPositronAbsorption, 
        additionalEffects: interactionResult?.chainDecayResult?.additionalEffects, 
        isPpFusion: !!interactionResult?.isPpFusion, 
        isPositronAbsorption: !!interactionResult?.isPositronAbsorption, 
        isCoulombScattered: !!interactionResult?.isCoulombScattered,
        isBremsAchieved: !!interactionResult?.isBremsAchieved,
        isZeroBarnAchieved: cN >= 20 && !prev.unlockedGroups.includes("zero barn"),
        isFissionAchieved: inducedDecayMode === DecayMode.SPONTANEOUS_FISSION,
        gluttonyTrigger,
        targetEntity,
        evolvedEntities,
        scatteredMessage: interactionResult?.scatteredMessage,
        magicProtectionBonus: interactionResult?.magicProtectionBonus,
        chargesUsed,
        consecutiveProtons: cP,
        consecutiveNeutrons: cN,
        consecutiveElectrons: cE,
        lastConsumedType: lT
    };
};