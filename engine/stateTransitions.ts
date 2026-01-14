
import { 
  GameState, 
  GameAction, 
  NuclideData, 
  DecayMode, 
  HistoryEntry, 
  EntityType, 
  DiscoveryContext,
  GameStateEvent
} from '../types';
import { calculateNextLevel, checkBarrierReplenish, createHistoryEntry } from './atomicTransitions';
import { ENERGY_EVOLUTION_TURNS, INITIAL_NUCLIDE } from '../constants/gameConfig';
import { MAX_ENERGY, SCORE_FACTORS, BONUS_SCORES, STABILIZE_COST, NUCLEOSYNTHESIS_COST, FORCE_DECAY_COST } from '../constants/economy';
import { REASON } from '../constants/gameOverReason';
import { TITLES } from '../constants/titles';
import { HISTORY_METHODS } from '../constants/strings';
import { calculateMoveResult, generateEntities } from './gameLogic';
import { processUnlocks } from './unlockSystem';
import { processRandomBackgroundEvents } from './randomEvents';
import { getHistoryMethod } from '../utils/historyLogic';
import { getNuclideDataSync, getValidAsForZ } from '../services/nuclideService';
import { resolveStabilityCrisis } from './stabilityManager';
import { getNextTutorialMessage, calculateTutorialFlagUpdates } from './tutorialManager';
import { getDecayDeltas, calculateDecayEffects } from '../physics/decaySystem';
import { pickNuclideWithPriority } from './particleEngine';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants/gameConfig';

/**
 * Internal helper to apply nuclide discovery/transformation logic to the state.
 */
const applyDiscoveryLogic = (state: GameState, nextNuclide: NuclideData, context: DiscoveryContext, targetTurn: number): GameState => {
    const { method, pz, pa, addedScore, chargesUsed, inducedDecayMode, isManualDecay } = context;
    const now = Date.now();

    const { nextLevel, nextMastered } = calculateNextLevel(
        state.playerLevel,
        state.masteredDecays,
        inducedDecayMode || DecayMode.STABLE
    );

    const currentChargesAfterConsumption = Math.max(0, state.magicBarrierCharges - chargesUsed);
    const nextCharges = checkBarrierReplenish(
        nextLevel,
        nextNuclide.z,
        currentChargesAfterConsumption
    );

    const nuclideKey = `${nextNuclide.z}-${nextNuclide.a}`;
    const existingEntry = state.evolutionHistory[nuclideKey];
    const updatedHistoryEntry = existingEntry 
        ? { ...existingEntry, lastTurn: targetTurn, method, pz, pa }
        : createHistoryEntry(nextNuclide, method, pz, pa, targetTurn);

    const nextEvolutionHistory = {
        ...state.evolutionHistory,
        [nuclideKey]: updatedHistoryEntry
    };

    let nextMessages = state.messages;
    let levelUpEvent: GameStateEvent | undefined;

    if (nextLevel > state.playerLevel) {
        nextMessages = [...state.messages, `✨ Mastery LV. ${nextLevel}`].slice(-10);
        levelUpEvent = {
            id: now,
            type: 'LEVEL_UP',
            priorityMessages: [`Mastery Level ${nextLevel}`]
        };
    }

    let nextCombo = state.combo;
    let nextComboScore = (state.comboScore || 0) + addedScore;
    let nextComboOrigin = state.comboOrigin;
    let nextLastComboTime = state.lastComboTime;

    if (isManualDecay) {
        if (state.combo === 0 && !state.currentNuclide.isStable) {
            nextComboOrigin = { 
                z: state.currentNuclide.z, 
                a: state.currentNuclide.a,
                isUnstable: true,
                timestamp: now
            };
        }
        nextCombo += 1;
        nextLastComboTime = now;
    }

    if (nextNuclide.isStable) {
        nextCombo = 0;
        nextComboScore = 0;
        nextComboOrigin = undefined;
        nextLastComboTime = 0;
    }

    // Structured Merge of Events
    let finalEvent = levelUpEvent;
    if (levelUpEvent && state.lastEvent) {
        // Collect all unique priority items from both events
        const combinedPriority = [
            ...(state.lastEvent.priorityMessages || (state.lastEvent.message ? [state.lastEvent.message] : [])),
            ...(levelUpEvent.priorityMessages || [])
        ];
        
        finalEvent = {
            ...levelUpEvent,
            shake: levelUpEvent.shake || state.lastEvent.shake,
            flash: levelUpEvent.flash || state.lastEvent.flash,
            subType: state.lastEvent.subType || levelUpEvent.subType,
            priorityMessages: combinedPriority
        };
    } else if (!levelUpEvent) {
        finalEvent = state.lastEvent;
    }

    return {
        ...state,
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
        maxCombo: Math.max(state.maxCombo, nextCombo),
        messages: nextMessages,
        lastEvent: finalEvent
    };
};

/**
 * The single source of truth for all game state transitions.
 */
export const nucleusReducer = (state: GameState, action: GameAction): GameState => {
    const now = Date.now();
    switch (action.type) {
        case 'MOVE_PLAYER': {
            const { dx, dy } = action.payload;
            if (state.gameOver || state.loadingData || state.isTimeStopped) return state;

            const result = calculateMoveResult(state, dx, dy, ENERGY_EVOLUTION_TURNS);
            if (!result.moved || !result.newPos) return state;

            let potentialReason: string = REASON.UNKNOWN;
            let isDaredevilAttempt = false;
            const nextTurn = state.turn + 1;

            // Added definition for potentialZ, potentialA and isAntiCollision to resolve scope errors
            const potentialZ = state.currentNuclide.z + result.dZ;
            const potentialA = state.currentNuclide.a + result.dA;
            const isAntiCollision = result.targetEntity?.type === EntityType.ANTI_NUCLIDE;

            const nextPool = {
                p: state.reincarnationPool.p + result.reincarnationPoolIncrement.p,
                n: state.reincarnationPool.n + result.reincarnationPoolIncrement.n,
                e: state.reincarnationPool.e + result.reincarnationPoolIncrement.e
            };

            let nextState: GameState = {
                ...state,
                playerPos: result.newPos,
                gridEntities: result.evolvedEntities,
                consecutiveProtons: result.consecutiveProtons,
                consecutiveNeutrons: result.consecutiveNeutrons,
                consecutiveElectrons: result.consecutiveElectrons,
                lastConsumedType: result.lastConsumedType,
                reincarnationPool: nextPool,
                turn: nextTurn,
                lastEvent: undefined // Clear previous event
            };

            // Handle Move/Interaction Events
            if (result.shouldShake || result.shouldFlash || result.isPpFusion) {
                nextState.lastEvent = {
                    id: now,
                    type: 'COLLISION',
                    shake: result.shouldShake,
                    flash: result.shouldFlash ? (result.isPpFusion ? 'bg-neon-purple' : 'bg-neon-blue') : undefined,
                    priorityMessages: result.isPpFusion ? ['Nuclear Fusion'] : []
                };
            }

            if (result.dZ !== 0 || result.dA !== 0 || result.isPpFusion || result.isPositronAbsorption) {
                const newData = (result.dZ === 0 && result.dA === 0 && !result.isPpFusion && !result.isPositronAbsorption) 
                    ? state.currentNuclide 
                    : getNuclideDataSync(potentialZ, potentialA);
                
                if (newData.exists) {
                    const unlockResult = processUnlocks(
                        state.unlockedElements, state.unlockedGroups, potentialZ, potentialA, 
                        false, false, false, false, 0, 
                        result.isCoulombScattered, result.isPpFusion, result.isFissionAchieved, result.isZeroBarnAchieved, result.isBremsAchieved, 
                        0, 0, result.gluttonyTrigger
                    );

                    const basePoints = newData.a * SCORE_FACTORS.MASS_MULTIPLIER;
                    const stabilityReward = newData.isStable ? SCORE_FACTORS.MOVEMENT_STABLE_REWARD : SCORE_FACTORS.MOVEMENT_UNSTABLE_REWARD;
                    const totalBaseActionScore = basePoints + stabilityReward + result.actionBonusScore + (result.magicProtectionBonus || 0) + (result.isPpFusion ? BONUS_SCORES.STELLAR_FUSION : 0);

                    const discoveryContext: DiscoveryContext = {
                        method: getHistoryMethod(!!result.isPpFusion, !!result.isPositronAbsorption, result.targetEntity, result.inducedReactionLabel),
                        pz: state.currentNuclide.z,
                        pa: state.currentNuclide.a,
                        addedScore: totalBaseActionScore,
                        chargesUsed: result.chargesUsed,
                        inducedDecayMode: result.inducedDecayMode,
                        isManualDecay: false 
                    };

                    nextState = applyDiscoveryLogic(nextState, newData, discoveryContext, nextTurn);

                    const protectionMsg = (result.magicProtectionBonus || 0) > 0 ? [`✨ ${result.isPositronAbsorption ? 'POSITRON CAPTURE' : 'MAGIC BARRIER USED'}: +${result.magicProtectionBonus.toLocaleString()} PTS`] : [];
                    const fusionMsg = result.isPpFusion ? [`✨ STELLAR FUSION: p + p → D + e+ (+${BONUS_SCORES.STELLAR_FUSION.toLocaleString()} PTS)`] : [];
                    
                    let coreMsg = "";
                    if (result.scatteredMessage && !result.isPositronAbsorption) {
                        coreMsg = `⚠️ ${result.scatteredMessage}`;
                    } else if (result.isPpFusion) {
                        coreMsg = `Nuclear Fusion: Deuterium Synthesized.`;
                    } else if (result.targetEntity?.type === EntityType.ENEMY_ELECTRON) {
                        coreMsg = `Enforced electron capture into ${newData.name}`;
                    } else if (result.targetEntity?.type === EntityType.ENEMY_POSITRON) {
                        coreMsg = `Enforced positron capture into ${newData.name}`;
                    } else if (result.targetEntity?.type === EntityType.PROTON) {
                        coreMsg = `Enforced proton capture into ${newData.name}`;
                    } else if (result.targetEntity?.type === EntityType.NEUTRON && !result.inducedReactionLabel) {
                        coreMsg = `Neutron capture into ${newData.name}`;
                    } else {
                        coreMsg = `${result.inducedReactionLabel ? result.inducedReactionLabel + ' reaction' : 'Transformation'} into ${newData.name}.`;
                    }

                    if (result.hpPenalty >= 20) {
                        coreMsg = `⚠️ ENFORCED CAPTURE! ${coreMsg}`;
                        potentialReason = REASON.FATAL_CAPTURE;
                    }

                    const dripMsg = (!newData.isStable && (newData.isProtonDripLine || newData.isNeutronDripLine)) ? ["⚠️ Danger: Drip line limit"] : [];
                    const nextMsg = getNextTutorialMessage(nextState, 'PARTICLE_CAPTURED', { nextNuclide: newData, currentTurn: nextTurn });
                    const tutorialUpdates = calculateTutorialFlagUpdates(nextState, nextMsg, nextTurn, 'PARTICLE_CAPTURED');

                    let finalEntities = nextState.gridEntities;
                    if (unlockResult.updatedGroups.includes(TITLES.DAREDEVIL) && !state.unlockedGroups.includes(TITLES.DAREDEVIL)) {
                        finalEntities = generateEntities(1, finalEntities, result.newPos!, nextTurn, EntityType.ANTI_NUCLIDE);
                    }

                    Object.assign(nextState, {
                        ...tutorialUpdates,
                        tutorialMessage: nextMsg,
                        unlockedElements: unlockResult.updatedElements,
                        unlockedGroups: unlockResult.updatedGroups,
                        gridEntities: finalEntities,
                        messages: [...nextState.messages, coreMsg, ...fusionMsg, ...protectionMsg, ...dripMsg, ...unlockResult.messages].slice(-10),
                        energyPoints: Math.min(MAX_ENERGY, state.energyPoints + result.energyBonus),
                        hp: Math.min(state.maxHp, Math.max(0, state.hp + (newData.isStable ? 10 : 0) - result.hpPenalty)),
                        score: nextState.score + (totalBaseActionScore * (state.combo || 1)) + unlockResult.scoreBonus
                    });

                } else {
                    isDaredevilAttempt = !state.currentNuclide.isStable && (state.currentNuclide.isProtonDripLine || state.currentNuclide.isNeutronDripLine);
                    const isDaredevilActive = state.unlockedGroups.includes(TITLES.DAREDEVIL) && !state.disabledSkills.includes(TITLES.DAREDEVIL);

                    const unlockResult = processUnlocks(
                        state.unlockedElements, state.unlockedGroups, null, null,
                        false, false, false, false, 0, 
                        false, false, false, !!result.isZeroBarnAchieved, !!result.isBremsAchieved,
                        0, 0, false, isDaredevilAttempt
                    );
                    
                    const protectionMsg = (result.magicProtectionBonus || 0) > 0 ? [`✨ MAGIC BARRIER USED: +${result.magicProtectionBonus.toLocaleString()} PTS`] : [];
                    let failMsg = `⚠️ Transformation failed: Target nuclide is outside the drip lines.`;
                    if (isAntiCollision) failMsg = `🌑 TOTAL ANNIHILATION: Core matter converted to ${result.energyBonus} MeV energy!`;

                    let finalEntities = nextState.gridEntities;
                    if (unlockResult.updatedGroups.includes(TITLES.DAREDEVIL) && !state.unlockedGroups.includes(TITLES.DAREDEVIL)) {
                        finalEntities = generateEntities(1, finalEntities, state.playerPos, nextTurn, EntityType.ANTI_NUCLIDE);
                    }

                    Object.assign(nextState, {
                        unlockedGroups: unlockResult.updatedGroups,
                        gridEntities: finalEntities,
                        score: state.score + (result.actionBonusScore || 0) + (result.magicProtectionBonus || 0) + unlockResult.scoreBonus,
                        messages: [...state.messages, failMsg, ...protectionMsg, ...unlockResult.messages].slice(-10),
                        hp: (isDaredevilActive || isAntiCollision) ? 0 : Math.max(0, state.hp - result.hpPenalty),
                        energyPoints: Math.min(MAX_ENERGY, state.energyPoints + result.energyBonus),
                        magicBarrierCharges: Math.max(0, state.magicBarrierCharges - (result.chargesUsed || 0))
                    });
                    
                    if (nextState.hp === 0) {
                        potentialReason = isAntiCollision ? REASON.NOTHINGNESS : (isDaredevilActive ? REASON.TRANSFORMATION_FAILED : REASON.FATAL_CAPTURE);
                    }
                }
            } else {
                const recovery = state.currentNuclide.isStable ? 1 : 0;
                const nextHp = Math.max(0, Math.min(state.maxHp, state.hp + recovery) - result.hpPenalty);
                const nextMsg = getNextTutorialMessage(state, 'TURN_ADVANCED', { currentTurn: nextTurn });
                const tutorialUpdates = calculateTutorialFlagUpdates(state, nextMsg, nextTurn, 'TURN_ADVANCED');

                Object.assign(nextState, {
                    hp: nextHp,
                    ...tutorialUpdates,
                    tutorialMessage: nextMsg,
                    messages: result.scatteredMessage ? [...state.messages, `⚠️ ${result.scatteredMessage}`].slice(-10) : state.messages
                });

                if (nextHp === 0) potentialReason = REASON.FATAL_CAPTURE;
            }

            if (result.additionalEffects) {
                nextState.effects = [...nextState.effects, ...result.additionalEffects];
            }
            if (result.inducedDecayMode && result.inducedReactionLabel) {
                nextState.reactionStats = { 
                    ...nextState.reactionStats, 
                    [result.inducedReactionLabel]: (nextState.reactionStats[result.inducedReactionLabel] || 0) + 1 
                };
            }

            if (nextState.hp <= 0 && !nextState.gameOver) {
                const crisisUpdate = resolveStabilityCrisis(nextState, potentialReason, isDaredevilAttempt);
                Object.assign(nextState, crisisUpdate);
                if (crisisUpdate.lastEvent) nextState.lastEvent = crisisUpdate.lastEvent;
            }

            const backgroundResult = processRandomBackgroundEvents(nextState);
            return {
                ...nextState,
                gridEntities: backgroundResult.gridEntities,
                messages: backgroundResult.messages,
                activeEvent: backgroundResult.activeEvent,
                emptyTurnCount: backgroundResult.emptyTurnCount
            };
        }

        case 'MANUAL_DECAY': {
            const { mode } = action.payload;
            if (state.gameOver || state.loadingData || state.isTimeStopped) return state;
            
            let actualMode = mode;
            const isDaredevilActive = state.unlockedGroups.includes(TITLES.DAREDEVIL) && !state.disabledSkills.includes(TITLES.DAREDEVIL);

            if (mode === DecayMode.UNKNOWN) {
                const candidates = [DecayMode.GAMMA];
                const checkModes = [DecayMode.ALPHA, DecayMode.BETA_MINUS, DecayMode.BETA_PLUS, DecayMode.PROTON_EMISSION, DecayMode.NEUTRON_EMISSION, DecayMode.SPONTANEOUS_FISSION];
                checkModes.forEach(m => {
                    const deltas = getDecayDeltas(m);
                    if (isDaredevilActive || getNuclideDataSync(state.currentNuclide.z + deltas.dZ, state.currentNuclide.a + deltas.dA).exists) {
                        candidates.push(m);
                    }
                });
                actualMode = candidates[Math.floor(Math.random() * candidates.length)];
            }

            const isAnnihilationSkillActive = state.unlockedGroups.includes(TITLES.PAIR_ANNIHILATION) && !state.disabledSkills.includes(TITLES.PAIR_ANNIHILATION);
            const decayResult = calculateDecayEffects(
                actualMode, state.currentNuclide, state.playerPos, state.gridEntities, now, 
                isAnnihilationSkillActive, !state.disabledSkills.includes(TITLES.FISSION), 
                state.unlockedGroups.includes(TITLES.NEUTRONIZATION) && !state.disabledSkills.includes(TITLES.NEUTRONIZATION)
            );

            const newData = getNuclideDataSync(state.currentNuclide.z + decayResult.dZ, state.currentNuclide.a + decayResult.dA);
            if (!newData.exists) {
                const isDaredevilAttempt = !state.currentNuclide.isStable && (state.currentNuclide.isProtonDripLine || state.currentNuclide.isNeutronDripLine);
                if (isDaredevilActive) {
                    const crisisUpdate = resolveStabilityCrisis(state, REASON.DECAY_FAILED, isDaredevilAttempt, false);
                    return { ...state, ...crisisUpdate };
                } else {
                    const newHp = Math.max(0, state.hp - 20);
                    const failMsg = `⚠️ Decay failed: Target nuclide is outside the drip lines.`;
                    if (newHp === 0) {
                         const crisisUpdate = resolveStabilityCrisis(state, REASON.DECAY_FAILED, isDaredevilAttempt, false);
                         return { ...state, ...crisisUpdate, messages: [...state.messages, failMsg].slice(-10) };
                    }
                    return { ...state, hp: newHp, messages: [...state.messages, failMsg].slice(-10) };
                }
            }

            const baseActionPoints = newData.a * SCORE_FACTORS.MASS_MULTIPLIER;
            const stabilityReward = newData.isStable ? SCORE_FACTORS.STABLE_BONUS : SCORE_FACTORS.UNSTABLE_BONUS;
            const totalBaseActionPoints = baseActionPoints + stabilityReward + decayResult.actionBonusScore;

            const discoveryContext: DiscoveryContext = {
                method: decayResult.trigger,
                pz: state.currentNuclide.z,
                pa: state.currentNuclide.a,
                addedScore: totalBaseActionPoints,
                chargesUsed: 0,
                inducedDecayMode: actualMode,
                isManualDecay: true
            };

            // Clear previous event explicitly before applying discovery to prevent stale merging
            let nextState = applyDiscoveryLogic({ ...state, lastEvent: undefined }, newData, discoveryContext, state.turn);
            const unlockResult = processUnlocks(
                state.unlockedElements, state.unlockedGroups, newData.z, newData.a, 
                false, !!decayResult.isAnnihilation, false, false, 0, 
                false, false, false, false, false, 
                state.decayStats[DecayMode.BETA_PLUS] + (actualMode === DecayMode.BETA_PLUS ? 1 : 0), 
                state.decayStats[DecayMode.BETA_MINUS] + (actualMode === DecayMode.BETA_MINUS ? 1 : 0)
            );
            
            const dripMsg = (!newData.isStable && (newData.isProtonDripLine || newData.isNeutronDripLine)) ? ["⚠️ Danger: Drip line limit"] : [];
            const nextMsg = getNextTutorialMessage(state, 'DECAY_PERFORMED', { nextNuclide: newData, currentTurn: state.turn });
            const tutorialUpdates = calculateTutorialFlagUpdates(state, nextMsg, state.turn, 'DECAY_PERFORMED');

            let finalEntities = decayResult.newGridEntities;
            if (unlockResult.updatedGroups.includes(TITLES.DAREDEVIL) && !state.unlockedGroups.includes(TITLES.DAREDEVIL)) {
                finalEntities = generateEntities(1, finalEntities, state.playerPos, state.turn, EntityType.ANTI_NUCLIDE);
            }

            const decayDescMsg = 
                actualMode === DecayMode.ALPHA ? `α decay into ${newData.name}` :
                actualMode === DecayMode.BETA_MINUS ? `β- decay into ${newData.name}` :
                actualMode === DecayMode.BETA_PLUS ? `β+ decay into ${newData.name}` :
                actualMode === DecayMode.ELECTRON_CAPTURE ? `Electron capture into ${newData.name}` :
                actualMode === DecayMode.NEUTRON_EMISSION ? `n emission into ${newData.name}` :
                actualMode === DecayMode.PROTON_EMISSION ? `p emission into ${newData.name}` :
                actualMode === DecayMode.SPONTANEOUS_FISSION ? `Spontaneous fission into ${newData.name}` :
                actualMode === DecayMode.GAMMA ? `γ decay` : "";

            const decayEvent: GameStateEvent = {
                id: now,
                type: 'DECAY',
                subType: actualMode,
                shake: decayResult.shouldShake,
                flash: decayResult.shouldFlash ? (actualMode === DecayMode.SPONTANEOUS_FISSION ? 'bg-yellow-400' : 'bg-white') : undefined,
                priorityMessages: decayResult.speechOverride ? [decayResult.speechOverride] : []
            };

            // Merge decayEvent with whatever applyDiscoveryLogic produced (could be Level Up)
            const finalEvent: GameStateEvent = nextState.lastEvent 
                ? {
                    ...nextState.lastEvent,
                    priorityMessages: [
                        ...(nextState.lastEvent.priorityMessages || []),
                        ...(decayEvent.priorityMessages || [])
                    ],
                    shake: nextState.lastEvent.shake || decayEvent.shake,
                    flash: nextState.lastEvent.flash || decayEvent.flash,
                    subType: decayEvent.subType || nextState.lastEvent.subType
                  }
                : decayEvent;

            return { 
                ...nextState, 
                ...tutorialUpdates,
                playerPos: decayResult.newPosition || state.playerPos, 
                energyPoints: Math.min(MAX_ENERGY, state.energyPoints + (decayResult.energyBonus || 0)), 
                tutorialMessage: nextMsg, 
                unlockedElements: unlockResult.updatedElements, 
                unlockedGroups: unlockResult.updatedGroups, 
                gridEntities: finalEntities, 
                effects: [...state.effects, { id: Math.random().toString(36).substr(2, 9), type: actualMode, position: { ...state.playerPos }, timestamp: now }, ...decayResult.additionalEffects], 
                score: nextState.score + (totalBaseActionPoints * state.combo), 
                hp: Math.min(state.maxHp, state.hp + (newData.isStable ? 10 : 0)), 
                messages: [...nextState.messages, ...(decayDescMsg ? [decayDescMsg] : []), ...unlockResult.messages, ...dripMsg, ...decayResult.extraMessages].slice(-10), 
                decayStats: { ...state.decayStats, [actualMode]: (state.decayStats[actualMode] || 0) + 1 },
                consecutiveProtons: 0, consecutiveNeutrons: 0, consecutiveElectrons: 0, lastConsumedType: null,
                lastEvent: finalEvent
            };
        }

        case 'USE_SKILL': {
            const { skillType, params } = action.payload;
            if (state.gameOver || state.loadingData) return state;

            switch (skillType) {
                case 'STABILIZE': {
                    const cost = STABILIZE_COST;
                    if (state.energyPoints < cost) return { ...state, messages: [...state.messages, `⚠️ Not enough energy! Need ${cost}E.`].slice(-10) };
                    return { 
                        ...state, turn: state.turn + 1, hp: state.maxHp, energyPoints: Math.max(0, state.energyPoints - cost), messages: [...state.messages, `🔬 Stabilization: HP Recovered.`].slice(-10),
                        lastEvent: { id: now, type: 'SKILL', subType: 'STABILIZE', flash: 'bg-neon-green' }
                    };
                }
                case 'NUCLEOSYNTHESIS': {
                    const cost = NUCLEOSYNTHESIS_COST;
                    if (state.energyPoints < cost) return { ...state, messages: [...state.messages, `⚠️ Not enough energy! Need ${cost}E.`].slice(-10) };
                    const nextZ = state.currentNuclide.z + 1;
                    if (nextZ > 118) return { ...state, messages: [...state.messages, "⚠️ Oganesson limit reached!"].slice(-10) };
                    const validAs = getValidAsForZ(nextZ);
                    const randomA = validAs[Math.floor(Math.random() * validAs.length)];
                    const newData = getNuclideDataSync(nextZ, randomA);
                    if (!newData.exists) return state;

                    const discoveryContext: DiscoveryContext = { method: HISTORY_METHODS.NUCLEOSYNTHESIS, pz: state.currentNuclide.z, pa: state.currentNuclide.a, addedScore: nextZ * 10000, chargesUsed: 0, isManualDecay: false };
                    let nextState = applyDiscoveryLogic({ ...state, lastEvent: undefined }, newData, discoveryContext, state.turn + 1);
                    const unlockResult = processUnlocks(state.unlockedElements, state.unlockedGroups, nextZ, randomA, false, false, true);
                    const nextMsg = getNextTutorialMessage(nextState, 'PARTICLE_CAPTURED', { nextNuclide: newData, currentTurn: state.turn + 1 });
                    const tutorialFlags = calculateTutorialFlagUpdates(state, nextMsg, state.turn + 1, 'PARTICLE_CAPTURED');

                    const skillEvent: GameStateEvent = { id: now, type: 'SKILL', subType: 'NUCLEOSYNTHESIS', flash: 'bg-white', shake: true, priorityMessages: ['Nucleosynthesis'] };
                    // Merge skillEvent with potential Level Up from nextState.lastEvent
                    const finalEvent: GameStateEvent = nextState.lastEvent 
                        ? {
                            ...nextState.lastEvent,
                            priorityMessages: [
                                ...(skillEvent.priorityMessages || []),
                                ...(nextState.lastEvent.priorityMessages || [])
                            ],
                            shake: nextState.lastEvent.shake || skillEvent.shake,
                            flash: nextState.lastEvent.flash || skillEvent.flash
                        }
                        : skillEvent;

                    return { 
                        ...nextState, ...tutorialFlags, hp: state.maxHp, energyPoints: Math.max(0, state.energyPoints - cost), tutorialMessage: nextMsg, score: nextState.score + nextZ * 10000 + unlockResult.scoreBonus, unlockedElements: unlockResult.updatedElements, unlockedGroups: unlockResult.updatedGroups, messages: [...state.messages, `🌟 NUCLEOSYNTHESIS: Synthesized ${newData.name}!`, ...unlockResult.messages].slice(-10), isTimeStopped: false, consecutiveProtons: 0, consecutiveNeutrons: 0, consecutiveElectrons: 0, lastConsumedType: null,
                        lastEvent: finalEvent
                    };
                }
                case 'R_PROCESS': {
                    let absorbedP = 0, absorbedN = 0, absorbedE = 0, absorbedPos = 0;
                    state.gridEntities.forEach(e => { if (e.type === EntityType.PROTON) absorbedP++; else if (e.type === EntityType.NEUTRON) absorbedN++; else if (e.type === EntityType.ENEMY_ELECTRON) absorbedE++; else if (e.type === EntityType.ENEMY_POSITRON) absorbedPos++; });
                    const totalAbsorbed = absorbedP + absorbedN + absorbedE + absorbedPos;
                    if (totalAbsorbed === 0) return state;
                    const nextZ = state.currentNuclide.z + absorbedP - absorbedE + absorbedPos;
                    const nextA = state.currentNuclide.a + absorbedP + absorbedN;
                    const newData = getNuclideDataSync(nextZ, nextA);
                    if (!newData.exists || nextZ < 0 || nextZ > 118) return { ...state, gameOver: true, gameOverReason: REASON.NUCLEUS_COLLAPSE, gridEntities: [], energyPoints: 0, tutorialMessage: null, lastEvent: { id: now, type: 'DEATH' } };
                    
                    const discoveryContext: DiscoveryContext = { method: HISTORY_METHODS.R_PROCESS, pz: state.currentNuclide.z, pa: state.currentNuclide.a, addedScore: totalAbsorbed * 50000, chargesUsed: 0, isManualDecay: false };
                    let nextState = applyDiscoveryLogic({ ...state, lastEvent: undefined }, newData, discoveryContext, state.turn + 1);
                    const unlockResult = processUnlocks(state.unlockedElements, state.unlockedGroups, nextZ, nextA, false, false, true);
                    const nextMsg = getNextTutorialMessage(nextState, 'PARTICLE_CAPTURED', { nextNuclide: newData, currentTurn: state.turn + 1 });
                    const tutorialFlags = calculateTutorialFlagUpdates(state, nextMsg, state.turn + 1, 'PARTICLE_CAPTURED');

                    const skillEvent: GameStateEvent = { id: now, type: 'SKILL', subType: 'R_PROCESS', flash: 'bg-neon-blue', shake: true, priorityMessages: ['Rapid Process Nucleosynthesis'] };
                    // Merge skillEvent with potential Level Up from nextState.lastEvent
                    const finalEvent: GameStateEvent = nextState.lastEvent 
                        ? {
                            ...nextState.lastEvent,
                            priorityMessages: [
                                ...(skillEvent.priorityMessages || []),
                                ...(nextState.lastEvent.priorityMessages || [])
                            ],
                            shake: nextState.lastEvent.shake || skillEvent.shake,
                            flash: nextState.lastEvent.flash || skillEvent.flash
                        }
                        : skillEvent;

                    return { 
                        ...nextState, ...tutorialFlags, hp: state.maxHp, gridEntities: [], tutorialMessage: nextMsg, score: nextState.score + totalAbsorbed * 50000 + unlockResult.scoreBonus, unlockedElements: unlockResult.updatedElements, unlockedGroups: unlockResult.updatedGroups, playerLevel: 0, masteredDecays: [], messages: [...state.messages, `🌌 r-process nucleosynthesis: Absorbed ${totalAbsorbed} particles!`, "⚠️ MASTERY CONSUMED: Level reset to 0."].slice(-10), combo: 0,
                        lastEvent: finalEvent
                    };
                }
                case 'TIME_STOP': {
                    const nextFrozen = !state.isTimeStopped;
                    return { 
                        ...state, isTimeStopped: nextFrozen, messages: [...state.messages, nextFrozen ? "✨ FROZEN TIME" : "✨ TIME RESTORED"].slice(-10),
                        lastEvent: { id: now, type: 'SKILL', subType: 'TIME_STOP', priorityMessages: [nextFrozen ? 'Time Stopped' : 'Time Restored'] }
                    };
                }
                case 'TRANSMUTE': {
                    const { selectedZ } = params;
                    const validAs = getValidAsForZ(selectedZ);
                    const randomA = validAs[Math.floor(Math.random() * validAs.length)];
                    const newData = getNuclideDataSync(selectedZ, randomA);
                    if (!newData.exists) return state;

                    const discoveryContext: DiscoveryContext = { method: HISTORY_METHODS.EXP_REPLICATE, pz: state.currentNuclide.z, pa: state.currentNuclide.a, addedScore: BONUS_SCORES.EXP_REPLICATE_ACTION, chargesUsed: 0, isManualDecay: false };
                    let nextState = applyDiscoveryLogic({ ...state, lastEvent: undefined }, newData, discoveryContext, state.turn + 1);
                    const unlockResult = processUnlocks(state.unlockedElements, state.unlockedGroups, selectedZ, randomA, true);
                    
                    const skillEvent: GameStateEvent = { id: now, type: 'SKILL', subType: 'TRANSMUTE', flash: 'bg-neon-purple', shake: true, priorityMessages: ['Experimental Replication'] };
                    const finalEvent: GameStateEvent = nextState.lastEvent 
                        ? {
                            ...nextState.lastEvent,
                            priorityMessages: [
                                ...(skillEvent.priorityMessages || []),
                                ...(nextState.lastEvent.priorityMessages || [])
                            ],
                            shake: nextState.lastEvent.shake || skillEvent.shake,
                            flash: nextState.lastEvent.flash || skillEvent.flash
                        }
                        : skillEvent;

                    return { 
                        ...nextState, unlockedElements: unlockResult.updatedElements, unlockedGroups: unlockResult.updatedGroups, score: nextState.score + BONUS_SCORES.EXP_REPLICATE_ACTION + unlockResult.scoreBonus, messages: [...state.messages, `🔮 EXP. REPLICATE: ${newData.name}!`, ...unlockResult.messages].slice(-10), isTimeStopped: false, combo: 0,
                        lastEvent: finalEvent
                    };
                }
                case 'TOGGLE_SKILL': {
                    const { skillName } = params;
                    const isDisabled = state.disabledSkills.includes(skillName);
                    const nextDisabled = isDisabled ? state.disabledSkills.filter(s => s !== skillName) : [...state.disabledSkills, skillName];
                    let nextEntities = [...state.gridEntities];
                    if (skillName === TITLES.DAREDEVIL && isDisabled && !nextEntities.some(e => e.type === EntityType.ANTI_NUCLIDE)) {
                        nextEntities = generateEntities(1, nextEntities, state.playerPos, state.turn, EntityType.ANTI_NUCLIDE);
                    }
                    return { ...state, gridEntities: nextEntities, disabledSkills: nextDisabled, messages: [...state.messages, `⚙️ Skill ${skillName} ${isDisabled ? 'ENABLED' : 'DISABLED'}`].slice(-10) };
                }
                default: return state;
            }
        }

        case 'DISCOVER_NUCLIDE': {
            return applyDiscoveryLogic(state, action.payload.nextNuclide, action.payload.context, state.turn + 1);
        }

        case 'UPDATE_BASIC_STATE': {
            const update = typeof action.payload === 'function' ? action.payload(state) : action.payload;
            let nextState = { ...state, ...update };
            if (nextState.currentNuclide.isStable) {
                nextState.combo = 0;
                nextState.comboScore = 0;
                nextState.comboOrigin = undefined;
                nextState.lastComboTime = 0;
            }
            return nextState;
        }

        case 'RESET_STATE':
            return action.payload;

        case 'SET_HP':
            return { ...state, hp: action.payload };

        case 'CLEANUP_VISUALS': {
            const { effects, activeEventExpired } = action.payload;
            return { ...state, effects, activeEvent: activeEventExpired ? undefined : state.activeEvent };
        }

        default:
            return state;
    }
};
