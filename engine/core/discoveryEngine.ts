import { 
  GameState, 
  NuclideData, 
  DiscoveryContext, 
  Position, 
  GridEntity, 
  DecayMode, 
  GameStateEvent,
  EntityType 
} from '../../types';
import { GRID_WIDTH, GRID_HEIGHT } from '../../constants/gameConfig';
import { calculateNextLevel, checkBarrierReplenish } from '../atomicTransitions';
import { processUnlocks } from '../unlockSystem';
import { getNextTutorialMessage, calculateTutorialFlagUpdates } from '../tutorialManager';
import { TITLES } from '../../constants/titles';
import { generateEntities } from '../moveSimulator';
import { registerHistoryEntry } from './historyService';
import { decomposeDecayMode } from '../../utils/masteryUtils';
import { LOG_MESSAGES } from '../../constants/logMessageTextData';
import { getLogMessages } from '../../constants';
import { getLocalizedReactionLabel } from '../../utils/historyLogic';

/**
 * Internal helper to find a nearby empty cell for byproduct placement.
 * Ensures the product does not overlap with the player or existing entities.
 */
export const findNearbyFreeCell = (center: Position, entities: GridEntity[], playerPos: Position): Position => {
    const neighbors: Position[] = [];
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const p = { x: center.x + dx, y: center.y + dy };
            if (p.x >= 0 && p.x < GRID_WIDTH && p.y >= 0 && p.y < GRID_HEIGHT) {
                const isPlayer = (p.x === playerPos.x && p.y === playerPos.y);
                const isOccupied = entities.some(e => e.position.x === p.x && e.position.y === p.y);
                if (!isPlayer && !isOccupied) neighbors.push(p);
            }
        }
    }
    return neighbors.length > 0 ? neighbors[Math.floor(Math.random() * neighbors.length)] : center;
};

/**
 * Central Engine: Applies transition logic when a nuclide state changes.
 * Consolidates all post-physics state updates: level-up, unlocks, history, and tutorials.
 */
export const applyDiscoveryLogic = (
    state: GameState, 
    nextNuclide: NuclideData, 
    context: DiscoveryContext, 
    targetTurn: number,
    flags: {
        isAnnihilation?: boolean;
        isNucleosynthesis?: boolean;
        isTemporalInversion?: boolean;
        isCoulombScattered?: boolean;
        isFusionAchieved?: boolean;
        isFissionAchieved?: boolean;
        isZeroBarnAchieved?: boolean;
        isBremsAchieved?: boolean;
        isGluttonyAchieved?: boolean;
        isDaredevilAchieved?: boolean;
        isPositronAbsorbed?: boolean;
        skipComboSettlement?: boolean;
        isExplicitReplication?: boolean; 
        isQuantumOverride?: boolean;
        gluttonyTrigger?: boolean;
    } = {}
): GameState => {
    const { method, pz, pa, addedScore, chargesUsed, inducedDecayMode, isManualDecay } = context;
    const now = Date.now();
    const logMessages = getLogMessages(state.language);

    // 1. Level & Mastery
    const masteryModes = isManualDecay && inducedDecayMode 
        ? decomposeDecayMode(inducedDecayMode) 
        : [];

    const { nextLevel, nextMastered } = calculateNextLevel(
        state.playerLevel,
        state.masteredDecays,
        masteryModes
    );

    // 2. Barrier Check
    const currentChargesAfterConsumption = Math.max(0, state.magicBarrierCharges - chargesUsed);
    const nextCharges = checkBarrierReplenish(nextLevel, nextNuclide.z, currentChargesAfterConsumption);

    // 3. Persistent History Entry (Delegated to historyService)
    const nextEvolutionHistory = registerHistoryEntry(
        state.evolutionHistory,
        nextNuclide,
        method,
        pz,
        pa,
        targetTurn,
        false
    );

    // 4. Process Global Unlocks (Skills & Titles)
    const unlockResult = processUnlocks(
        state.unlockedElements, 
        state.unlockedGroups, 
        nextNuclide.z, 
        nextNuclide.a, 
        !!flags.isExplicitReplication, 
        !!flags.isAnnihilation,
        !!flags.isNucleosynthesis,
        !!flags.isTemporalInversion,
        state.comboScore,
        !!flags.isCoulombScattered,
        !!flags.isFusionAchieved,
        !!flags.isFissionAchieved,
        !!flags.isZeroBarnAchieved,
        !!flags.isBremsAchieved,
        state.decayStats[DecayMode.BETA_PLUS] + (inducedDecayMode === DecayMode.BETA_PLUS ? 1 : 0),
        state.decayStats[DecayMode.BETA_MINUS] + (inducedDecayMode === DecayMode.BETA_MINUS ? 1 : 0),
        !!flags.isGluttonyAchieved,
        !!flags.isDaredevilAchieved,
        state.isTimeStopped,
        !!flags.isQuantumOverride,
        state.playerLevel,
        !!flags.isPositronAbsorbed,
        state.language
    );

    // 5. Level Up Messaging
    let nextMessages = [...state.messages, ...unlockResult.messages];
    let levelUpEvent: GameStateEvent | undefined;

    if (nextLevel > state.playerLevel) {
        nextMessages = [...nextMessages, logMessages.SYSTEM.MASTERY_LEVEL_UP(nextLevel)];
        levelUpEvent = { id: now, type: 'LEVEL_UP', priorityMessages: [LOG_MESSAGES.HISTORY.MASTERY_LEVEL] };
    }

    // 6. Tutorial Management
    const energyIncreased = addedScore > 0;
    const tutorialEvent = isManualDecay ? 'DECAY_PERFORMED' : 'PARTICLE_CAPTURED';
    const nextTutorialMsg = getNextTutorialMessage(state, tutorialEvent, { 
        nextNuclide, 
        currentTurn: targetTurn, 
        energyIncreased 
    }, state.language);
    const tutorialUpdates = calculateTutorialFlagUpdates(state, nextTutorialMsg, targetTurn, tutorialEvent);
    
    // 6.5 Check for All Elements Discovery (Z=1 to 118)
    let finalTutorialMsg = nextTutorialMsg;
    let finalRecordTime = state.recordTime;
    
    const hasAllElements = Array.from({ length: 118 }, (_, i) => i + 1).every(z => unlockResult.updatedElements.includes(z));
    const wasAlreadyComplete = Array.from({ length: 118 }, (_, i) => i + 1).every(z => state.unlockedElements.includes(z));
    
    if (hasAllElements && !wasAlreadyComplete) {
        finalTutorialMsg = logMessages.TUTORIAL.ALL_ELEMENTS_COMPLETE;
        finalRecordTime = state.elapsedTime;
        nextMessages = [...nextMessages, logMessages.SYSTEM.PERIODIC_TABLE_COMPLETE];
    }

    // Achievement Time Recording
    const nextAchievementTimes = { ...state.achievementTimes };
    if (unlockResult.updatedGroups.includes(TITLES.FORBIDDEN_CAPTURE) && !state.unlockedGroups.includes(TITLES.FORBIDDEN_CAPTURE)) {
        nextAchievementTimes['forbidden_capture'] = state.elapsedTime;
    }

    // 7. Chain / Combo Logic
    let nextCombo = state.combo;
    let nextComboScore = (state.comboScore || 0) + addedScore;
    let nextComboOrigin = state.comboOrigin;
    let nextLastComboTime = state.lastComboTime;

    if (isManualDecay) {
        if (state.combo === 0 && !state.currentNuclide.isStable) {
            nextComboOrigin = { z: state.currentNuclide.z, a: state.currentNuclide.a, isUnstable: true, timestamp: now };
        }
        nextCombo += 1;
        nextLastComboTime = now;
    }

    const recordableCombo = nextCombo;
    let settlementEvent: GameStateEvent | undefined;

    if (nextNuclide.isStable) {
        if (nextCombo >= 2 && !flags.skipComboSettlement) {
            settlementEvent = { id: now + 50, type: 'SURVIVAL', subType: 'COMBO_SETTLED', message: `${nextCombo}` };
        }
        nextCombo = 0;
        nextComboScore = 0;
        nextComboOrigin = undefined;
        nextLastComboTime = 0;
    }

    // 8. Event Integration
    const mergeEvents = (base: GameStateEvent | undefined, overlay: GameStateEvent | undefined): GameStateEvent | undefined => {
        if (!base) return overlay;
        if (!overlay) return base;
        const combinedPriority = [...(base.priorityMessages || []), ...(overlay.priorityMessages || [])];
        return {
            ...base,
            id: Math.max(base.id, overlay.id),
            shake: base.shake || overlay.shake,
            flash: base.flash || overlay.flash,
            subType: overlay.subType || base.subType, 
            message: overlay.message || base.message,
            priorityMessages: Array.from(new Set(combinedPriority)) 
        };
    };

    let finalEvent = mergeEvents(state.lastEvent, levelUpEvent);
    finalEvent = mergeEvents(finalEvent, settlementEvent);

    // 9. Drip Line Warning
    if (!nextNuclide.isStable && (nextNuclide.isProtonDripLine || nextNuclide.isNeutronDripLine)) {
        nextMessages = [...nextMessages, logMessages.SYSTEM.DRIP_LINE_WARNING];
    }

    // 10. Daredevil Anti-Matter spawn handling
    let finalEntities = state.gridEntities;
    if (unlockResult.updatedGroups.includes(TITLES.DEMON_CORE) && !state.unlockedGroups.includes(TITLES.DEMON_CORE)) {
        finalEntities = generateEntities(1, finalEntities, state.playerPos, targetTurn, EntityType.ANTI_NUCLIDE);
    }

    return {
        ...state,
        ...tutorialUpdates,
        turn: targetTurn,
        currentNuclide: nextNuclide,
        evolutionHistory: nextEvolutionHistory,
        playerLevel: nextLevel,
        masteredDecays: nextMastered,
        magicBarrierCharges: nextCharges,
        combo: nextCombo,
        comboScore: nextComboScore,
        comboOrigin: nextComboOrigin,
        lastComboTime: nextLastComboTime, 
        maxCombo: Math.max(state.maxCombo, recordableCombo), 
        messages: nextMessages.slice(-10),
        lastEvent: finalEvent,
        score: state.score + (addedScore * (state.combo || 1)) + unlockResult.scoreBonus,
        unlockedElements: unlockResult.updatedElements,
        unlockedGroups: unlockResult.updatedGroups,
        achievementTimes: nextAchievementTimes,
        tutorialMessage: finalTutorialMsg,
        recordTime: finalRecordTime,
        gridEntities: finalEntities
    };
};
