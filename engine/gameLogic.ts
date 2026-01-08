import { GridEntity, Position, EntityType, GameState, DecayMode, VisualEffect } from '../types';
import { GRID_WIDTH, GRID_HEIGHT, BONUS_SCORES, HISTORY_METHODS, SCORE_FACTORS } from '../constants';
import { getNuclideDataSync } from '../services/nuclideService';
import { processUnlocks } from './unlockSystem';
import { processRandomBackgroundEvents } from './randomEvents';
import { isWithinBounds, findEntityAt } from '../utils/gridUtils';
import { calculateInteraction, calculateNeutronReaction } from '../physics/atomicCalculator';

export interface MoveResult {
    moved: boolean;
    state: GameState;
    inducedDecayMode?: DecayMode;
    inducedReactionLabel?: string;
    shouldShake?: boolean;
    shouldFlash?: boolean;
    flashColor?: string;
    additionalEffects?: VisualEffect[];
    isPpFusion?: boolean;
    isPositronAbsorption?: boolean;
    targetEntity?: GridEntity;
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

export const calculateMoveResult = (
    prev: GameState,
    dx: number,
    dy: number,
    COULOMB_BAR_THRESHOLD: number,
    ENERGY_EVOLUTION_TURNS: number,
    playerLevel: number = 0
): MoveResult => {
    const newPos: Position = { x: prev.playerPos.x + dx, y: prev.playerPos.y + dy };

    // 1. Validation
    if (!isWithinBounds(newPos)) return { moved: false, state: prev };

    // 2. Interaction
    const entityMatch = findEntityAt(prev.gridEntities, newPos);
    
    let dZ = 0, dA = 0, hpPenalty = 0, energyBonus = 0, actionBonusScore = 0;
    let inducedDecayMode: DecayMode | undefined = undefined;
    let reactionLabel = "";
    let additionalMessages: string[] = [];
    let interactionResult: any = null;
    let nextEntities = [...prev.gridEntities];
    let shouldShake = false;
    let shouldFlash = false;
    let targetEntity: GridEntity | undefined;
    let gluttonyTrigger = false;

    let cP = prev.consecutiveProtons;
    let cN = prev.consecutiveNeutrons;
    let cE = prev.consecutiveElectrons;
    let lT = prev.lastConsumedType;
    let currentCharges = prev.magicBarrierCharges;

    const isZeroBarnActive = prev.unlockedGroups.includes("zero barn") && !prev.disabledSkills.includes("zero barn");

    if (entityMatch) {
        targetEntity = entityMatch.entity;
        if (targetEntity.type === EntityType.ENEMY_POSITRON && prev.currentNuclide.z !== 0) return { moved: false, state: prev };

        nextEntities.splice(entityMatch.index, 1);
        if (nextEntities.length === 0) gluttonyTrigger = true;

        // Streak maintenance
        if (targetEntity.type === EntityType.PROTON) {
            if (lT === EntityType.PROTON) cP++; else { cP = 1; cN = 0; cE = 0; lT = EntityType.PROTON; }
        } else if (targetEntity.type === EntityType.NEUTRON) {
            if (lT === EntityType.NEUTRON) cN++; else { cP = 0; cN = 1; cE = 0; lT = EntityType.NEUTRON; }
        } else if (targetEntity.type === EntityType.ENEMY_ELECTRON) {
            if (lT === EntityType.ENEMY_ELECTRON) cE++; else { cP = 0; cN = 0; cE = 1; lT = EntityType.ENEMY_ELECTRON; }
        }

        const isAnnihilationSkillActive = prev.unlockedGroups.includes("Pair annihilation") && !prev.disabledSkills.includes("Pair annihilation");

        // Check for high energy neutron reaction first
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
                prev.currentNuclide, targetEntity, cE, prev.hp, currentCharges, 
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
        shouldShake = !!interactionResult.shouldShake;
        shouldFlash = !!interactionResult.shouldFlash;
        currentCharges -= interactionResult.chargesUsed;

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

    // 4. Create Next State
    let nextState: GameState = { 
        ...prev, 
        playerPos: newPos, 
        gridEntities: evolvedEntities, 
        turn: prev.turn + 1, 
        consecutiveProtons: cP, 
        consecutiveNeutrons: cN, 
        consecutiveElectrons: cE, 
        lastConsumedType: lT, 
        magicBarrierCharges: currentCharges 
    };

    if (dZ !== 0 || dA !== 0 || reactionLabel || interactionResult?.isCoulombScattered || interactionResult?.isPpFusion || interactionResult?.isPositronAbsorption) {
        const potentialZ = prev.currentNuclide.z + dZ;
        const potentialA = prev.currentNuclide.a + dA;
        const newData = (dZ === 0 && dA === 0 && !interactionResult?.isPpFusion && !interactionResult?.isPositronAbsorption) ? prev.currentNuclide : getNuclideDataSync(potentialZ, potentialA);
        
        if (newData.exists) {
            const isFissionAchieved = inducedDecayMode === DecayMode.SPONTANEOUS_FISSION;
            const isZeroBarnAchieved = cN >= 20 && !prev.unlockedGroups.includes("zero barn");
            const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, potentialZ, potentialA, false, false, false, false, 0, !!interactionResult?.isCoulombScattered, !!interactionResult?.isPpFusion, isFissionAchieved, isZeroBarnAchieved, !!interactionResult?.isBremsAchieved, 0, 0, gluttonyTrigger);
            
            const protectionMsg = (interactionResult?.magicProtectionBonus || 0) > 0 ? [`✨ ${interactionResult.isPositronAbsorption ? 'POSITRON CAPTURE' : 'MAGIC BARRIER USED'}: +${interactionResult.magicProtectionBonus.toLocaleString()} PTS`] : [];
            const fusionMsg = interactionResult?.isPpFusion ? [`✨ STELLAR FUSION: p + p → D + e+ (+${BONUS_SCORES.STELLAR_FUSION.toLocaleString()} PTS)`] : [];
            let coreMsg = interactionResult?.scatteredMessage && !interactionResult.isPositronAbsorption ? `⚠️ ${interactionResult.scatteredMessage}` : interactionResult?.isPpFusion ? `Fusion: Deuterium Synthesized.` : interactionResult?.isPositronAbsorption ? `Positron capture: Transmuted to ${newData.name}.` : `${reactionLabel ? reactionLabel + ' reaction' : 'Transformation'} into ${newData.name}.`;
            
            // Centralized Score Logic for Movement Interactions
            const basePoints = newData.a * SCORE_FACTORS.MASS_MULTIPLIER;
            const stabilityReward = newData.isStable ? SCORE_FACTORS.MOVEMENT_STABLE_REWARD : SCORE_FACTORS.MOVEMENT_UNSTABLE_REWARD;
            const totalActionScore = basePoints + stabilityReward + actionBonusScore + unlockResult.scoreBonus + (interactionResult?.magicProtectionBonus || 0) + (interactionResult?.isPpFusion ? BONUS_SCORES.STELLAR_FUSION : 0);

            nextState = { 
                ...nextState, 
                currentNuclide: newData, 
                unlockedElements: unlockResult.updatedElements, 
                unlockedGroups: unlockResult.updatedGroups, 
                messages: [...prev.messages, coreMsg, ...fusionMsg, ...protectionMsg, ...unlockResult.messages].slice(-10), 
                energyPoints: prev.energyPoints + energyBonus, 
                score: nextState.score + totalActionScore, 
                hp: Math.min(prev.maxHp, Math.max(0, prev.hp + (newData.isStable ? 10 : 0) - hpPenalty)) 
            };
            if (newData.isStable && (dZ !== 0 || dA !== 0 || interactionResult?.isPpFusion || interactionResult?.isPositronAbsorption)) nextState.combo = 0;
        } else {
            if (interactionResult?.isBremsAchieved) {
                const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, potentialZ, potentialA, false, false, false, false, 0, false, false, false, false, true);
                nextState.unlockedGroups = unlockResult.updatedGroups; nextState.score += unlockResult.scoreBonus; nextState.messages = [...nextState.messages, ...unlockResult.messages].slice(-10);
            }
            nextState.hp = Math.max(0, prev.hp - hpPenalty);
        }
    } else {
        if (nextState.currentNuclide.isStable) nextState.hp = Math.min(prev.maxHp, prev.hp + 1);
        const isZeroBarnAchieved = cN >= 20 && !prev.unlockedGroups.includes("zero barn");
        if (isZeroBarnAchieved) {
            const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, prev.currentNuclide.z, prev.currentNuclide.a, false, false, false, false, 0, false, false, false, true);
            nextState = { ...nextState, unlockedGroups: unlockResult.updatedGroups, messages: [...prev.messages, ...unlockResult.messages].slice(-10), score: nextState.score + unlockResult.scoreBonus };
        }
        if (interactionResult?.scatteredMessage) nextState.messages = [...nextState.messages, `ℹ ${interactionResult.scatteredMessage}`].slice(-10);
    }

    // 5. Background Events
    const backgroundResult = processRandomBackgroundEvents(nextState);
    
    return { 
        moved: true, 
        state: {
            ...nextState,
            gridEntities: backgroundResult.gridEntities,
            messages: backgroundResult.messages,
            activeEvent: backgroundResult.activeEvent
        }, 
        inducedDecayMode, 
        inducedReactionLabel: reactionLabel, 
        shouldShake: shouldShake || !!interactionResult?.isCoulombScattered || !!interactionResult?.isPpFusion || !!interactionResult?.isPositronAbsorption, 
        shouldFlash: shouldFlash || !!interactionResult?.isPpFusion || !!interactionResult?.isPositronAbsorption, 
        additionalEffects: interactionResult?.chainDecayResult?.additionalEffects, 
        isPpFusion: !!interactionResult?.isPpFusion, 
        isPositronAbsorption: !!interactionResult?.isPositronAbsorption, 
        targetEntity 
    };
};