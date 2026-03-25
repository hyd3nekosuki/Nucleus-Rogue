import { 
  GameState, 
  DecayMode, 
  EntityType, 
  GameStateEvent
} from '../../types';
import { MAX_ENERGY } from '../../constants/economy';
import { REASON } from '../../constants/gameOverReason';
import { TITLES } from '../../constants/titles';
import { generateEntities } from '../moveSimulator';
import { getDecayModeLabel, getNuclideDataSync } from '../../services/nuclideService';
import { resolveStabilityCrisis } from '../stabilityManager';
import { applyDiscoveryLogic, findNearbyFreeCell } from '../core/discoveryEngine';
import { processUnlocks } from '../unlockSystem';
import { finalizeAction } from '../core/turnService';
import { handleDefeatByReaction } from '../core/collisionService';

/**
 * Finalizes the fission event after the animation is complete.
 * This is the "Phase C" of the requested sequential animation.
 */
export const handleCommitFission = (state: GameState): GameState => {
    if (!state.pendingFission) return { ...state, isAnimatingFission: false };
    
    const { mode, result, newData, context } = state.pendingFission;
    const now = Date.now();
    const isForced = state.currentNuclide.isStable;
    
    // 1. Create the decay event (this will trigger the flash and messages)
    const decayEvent: GameStateEvent = { 
        id: now, 
        type: 'DECAY', 
        subType: mode, 
        decayModeTrigger: mode, 
        shake: isForced || result.shouldShake, 
        shakeIntensity: result.shakeIntensity,
        flash: isForced ? undefined : (result.shouldFlash ? (result.flashColor || 'bg-white') : undefined), 
        priorityMessages: result.speechOverride ? [result.speechOverride] : [],
        isAnnihilation: result.isAnnihilation,
        chainReactionPath: result.chainReactionPath,
        isPlayed: false // Ensure it triggers effects
    };

    // 2. Handle failure if target nuclide doesn't exist (drip lines)
    if (!newData.exists) {
        const isDare = !state.currentNuclide.isStable && (state.currentNuclide.isProtonDripLine || state.currentNuclide.isNeutronDripLine);
        
        const unlockResult = processUnlocks(
            state.unlockedElements, state.unlockedGroups, null, null,
            false, false, false, false, 0, 
            false, false, false, false, false, 
            state.decayStats[DecayMode.BETA_PLUS], 
            state.decayStats[DecayMode.BETA_MINUS],
            false, isDare, false, false, state.playerLevel
        );

        const newHp = Math.max(0, state.hp - 20);
        const failMsg = `⚠️ Decay failed: Target nuclide is outside the drip lines.`;
        
        let finalEntities = state.gridEntities;
        if (unlockResult.updatedGroups.includes(TITLES.DEMON_CORE) && !state.unlockedGroups.includes(TITLES.DEMON_CORE)) {
            finalEntities = generateEntities(1, finalEntities, state.playerPos, state.turn, EntityType.ANTI_NUCLIDE);
        }

        const crisisUpdate = resolveStabilityCrisis(state, REASON.DECAY_FAILED, isDare, false);
        return { 
            ...state, 
            ...crisisUpdate, 
            isAnimatingFission: false,
            pendingFission: undefined,
            unlockedGroups: unlockResult.updatedGroups,
            gridEntities: finalEntities,
            score: state.score + unlockResult.scoreBonus,
            energyPoints: isForced ? Math.max(0, state.energyPoints - 5) : state.energyPoints,
            lastEvent: decayEvent,
            messages: [...state.messages, failMsg, ...unlockResult.messages].slice(-10) 
        };
    }

    // 3. Handle successful fission
    const forcedMsg = isForced ? `☢️ FORCED DECAY: ${getDecayModeLabel(mode)} selected! (-5 MeV)` : "";
    const decayDescMsg = `Spontaneous fission into ${newData.name}`;
    
    let nextEntities = result.newGridEntities;
    if (result.emissions && result.emissions.length > 0) {
        result.emissions.forEach((emitType: EntityType) => {
            nextEntities = generateEntities(1, nextEntities, state.playerPos, state.turn, emitType, true);
            if (nextEntities.length > 0) {
                const last = nextEntities[nextEntities.length - 1];
                if (last.type === EntityType.NEUTRON) last.isHighEnergy = true;
            }
        });
    }

    if (result.byproduct) {
        const spawnPos = findNearbyFreeCell(state.playerPos, nextEntities, state.playerPos);
        nextEntities.push({
            id: 'fragment-' + Math.random().toString(36).substr(2, 9),
            type: EntityType.ANOTHER_NUCLIDE,
            position: spawnPos,
            spawnTurn: state.turn,
            isHighEnergy: false,
            z: result.byproduct.z,
            a: result.byproduct.a,
            isFriendly: true
        });
    }

    // Update stats
    const nextDecayStats = { ...state.decayStats };
    nextDecayStats[DecayMode.SPONTANEOUS_FISSION] = (nextDecayStats[DecayMode.SPONTANEOUS_FISSION] || 0) + 1;

    const nextTurn = state.turn + 1;
    const baseEnergy = isForced ? Math.max(0, state.energyPoints - 5) : state.energyPoints;

    // Process enemies defeated
    let currentEntities = nextEntities;
    let currentHistory = state.evolutionHistory;
    let reactionEnergyBonus = 0;
    let reactionMessages: string[] = [];

    if (result.defeatedNuclides && result.defeatedNuclides.length > 0) {
        const defeatResult = handleDefeatByReaction({ ...state, gridEntities: currentEntities }, result.defeatedNuclides, nextTurn);
        currentEntities = defeatResult.nextEntities;
        currentHistory = defeatResult.nextHistory;
        reactionEnergyBonus = defeatResult.energyBonus;
        reactionMessages = defeatResult.messages;
        decayEvent.hasDefeat = true;
    }

    let nextState = applyDiscoveryLogic(
        { 
            ...state, 
            isAnimatingFission: false,
            pendingFission: undefined,
            turn: nextTurn, 
            playerPos: result.newPosition || state.playerPos, 
            energyPoints: Math.min(MAX_ENERGY, baseEnergy + (result.energyBonus || 0) + reactionEnergyBonus), 
            gridEntities: currentEntities, 
            evolutionHistory: currentHistory,
            effects: [...state.effects, { id: Math.random().toString(36).substr(2, 9), type: mode, position: { ...state.playerPos }, timestamp: now }, ...result.additionalEffects], 
            hp: Math.min(state.maxHp, state.hp + (newData.isStable ? 10 : 0)), 
            messages: [...state.messages, ...(forcedMsg ? [forcedMsg] : []), ...(decayDescMsg ? [decayDescMsg] : []), ...result.extraMessages, ...reactionMessages].slice(-10), 
            decayStats: nextDecayStats, 
            consecutiveProtons: 0, 
            consecutiveNeutrons: 0, 
            consecutiveElectrons: 0, 
            lastConsumedType: null, 
            lastEvent: decayEvent 
        },
        newData, context, nextTurn, { isAnnihilation: result.isAnnihilation }
    );

    return finalizeAction(nextState);
};
