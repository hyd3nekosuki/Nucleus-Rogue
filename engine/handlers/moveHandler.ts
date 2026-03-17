import { 
  GameState, 
  EntityType, 
  DiscoveryContext,
  Position,
  GridEntity,
  DecayMode
} from '../../types';
import { ENERGY_EVOLUTION_TURNS } from '../../constants/gameConfig';
import { MAX_ENERGY, SCORE_FACTORS, BONUS_SCORES } from '../../constants/economy';
import { REASON } from '../../constants/gameOverReason';
import { TITLES } from '../../constants/titles';
import { HISTORY_METHODS } from '../../constants/strings';
import { calculateMoveResult, generateEntities } from '../moveSimulator';
import { getHistoryMethod } from '../../utils/historyLogic';
import { getNuclideDataSync } from '../../services/nuclideService';
import { resolveStabilityCrisis } from '../stabilityManager';
import { getNextTutorialMessage, calculateTutorialFlagUpdates } from '../tutorialManager';
import { applyDiscoveryLogic, findNearbyFreeCell } from '../core/discoveryEngine';
import { handleAnotherNuclideCollision, handleDefeatByReaction } from '../core/collisionService';
import { finalizeAction } from '../core/turnService';
import { processUnlocks } from '../unlockSystem';

export const handleMovePlayer = (state: GameState, payload: { dx: number, dy: number }): GameState => {
    const { dx, dy } = payload;
    if (state.gameOver || state.loadingData || state.isTimeStopped) return state;
    
    const nextTurn = state.turn + 1;
    const result = calculateMoveResult(state, dx, dy, ENERGY_EVOLUTION_TURNS);
    if (!result.moved || !result.newPos) return state;

    // Scenario 1: Direct player movement into Another Nuclide (Mid-boss/Predator)
    if (result.targetEntity?.type === EntityType.ANOTHER_NUCLIDE) {
        // ボスとの衝突も1ターンとしてカウントし、最新のターン数を渡す
        const afterCollisionState = handleAnotherNuclideCollision(state, result.targetEntity, result.newPos, nextTurn);
        return finalizeAction(afterCollisionState);
    }

    // Scenario 2: Normal movement or interaction with particles
    let reason: string = REASON.UNKNOWN;
    const pZ = state.currentNuclide.z + result.dZ, pA = state.currentNuclide.a + result.dA;
    const isAnti = result.targetEntity?.type === EntityType.ANTI_NUCLIDE;

    let nextEntities = result.evolvedEntities;
    let currentHistory = state.evolutionHistory;
    let reactionEnergyBonus = 0;
    let reactionMessages: string[] = [];

    // Procedure 3: Handle emissions from neutron reactions or other collisions
    if (result.chainDecayResult?.emissions && result.chainDecayResult.emissions.length > 0) {
        result.chainDecayResult.emissions.forEach((emitType: EntityType) => {
            const isFission = result.inducedDecayMode === DecayMode.SPONTANEOUS_FISSION;
            nextEntities = generateEntities(1, nextEntities, result.newPos!, state.turn, emitType, true);
            if (isFission && nextEntities.length > 0) {
                const last = nextEntities[nextEntities.length - 1];
                if (last.type === EntityType.NEUTRON) last.isHighEnergy = true;
            }
        });
    }

    // Process enemies defeated by reaction (Alpha, SF, etc.) from chainDecayResult
    if (result.chainDecayResult?.defeatedNuclides && result.chainDecayResult.defeatedNuclides.length > 0) {
        const defeatResult = handleDefeatByReaction({ ...state, gridEntities: nextEntities }, result.chainDecayResult.defeatedNuclides, nextTurn);
        nextEntities = defeatResult.nextEntities;
        currentHistory = defeatResult.nextHistory;
        reactionEnergyBonus = defeatResult.energyBonus;
        reactionMessages = defeatResult.messages;
    }

    // Procedure 4: Byproduct realization
    if (result.byproduct) {
        const spawnPos = findNearbyFreeCell(result.newPos!, nextEntities, result.newPos!);
        nextEntities.push({
            id: 'fragment-' + Math.random().toString(36).substr(2, 9),
            type: EntityType.ANOTHER_NUCLIDE,
            position: spawnPos,
            spawnTurn: state.turn,
            isHighEnergy: false,
            z: result.byproduct.z,
            a: result.byproduct.a,
            isFriendly: true // Marked as friendly companion
        });
    }

    let nextState: GameState = { 
        ...state, 
        playerPos: result.newPos, 
        gridEntities: nextEntities, 
        evolutionHistory: currentHistory,
        consecutiveProtons: result.consecutiveProtons, 
        consecutiveNeutrons: result.consecutiveNeutrons, 
        consecutiveElectrons: result.consecutiveElectrons, 
        lastConsumedType: result.lastConsumedType, 
        reincarnationPool: { 
            p: state.reincarnationPool.p + result.reincarnationPoolIncrement.p, 
            n: state.reincarnationPool.n + result.reincarnationPoolIncrement.n, 
            e: state.reincarnationPool.e + result.reincarnationPoolIncrement.e 
        }, 
        turn: nextTurn, 
        lastEvent: (result.shouldShake || result.shouldFlash || result.isPpFusion || result.inducedDecayMode) ? { 
            id: Date.now(), 
            type: 'COLLISION', 
            shake: result.shouldShake, 
            flash: result.shouldFlash ? (result.isPpFusion ? 'bg-neon-purple' : 'bg-neon-blue') : undefined, 
            priorityMessages: result.isPpFusion ? ['Nuclear Fusion'] : [],
            decayModeTrigger: result.inducedDecayMode
        } : undefined 
    };

    if (result.dZ !== 0 || result.dA !== 0 || result.isPpFusion || result.isPositronAbsorption) {
        const newData = (result.dZ === 0 && result.dA === 0 && !result.isPpFusion && !result.isPositronAbsorption) ? state.currentNuclide : getNuclideDataSync(pZ, pA);
        if (newData.exists) {
            const totalActionScore = (newData.a * SCORE_FACTORS.MASS_MULTIPLIER) + (newData.isStable ? SCORE_FACTORS.MOVEMENT_STABLE_REWARD : SCORE_FACTORS.MOVEMENT_UNSTABLE_REWARD) + result.actionBonusScore + (result.magicProtectionBonus || 0) + (result.isPpFusion ? BONUS_SCORES.STELLAR_FUSION : 0);
            const context: DiscoveryContext = { method: getHistoryMethod(!!result.isPpFusion, !!result.isPositronAbsorption, result.targetEntity, result.inducedReactionLabel), pz: state.currentNuclide.z, pa: state.currentNuclide.a, addedScore: totalActionScore, chargesUsed: result.chargesUsed, inducedDecayMode: result.inducedDecayMode, isManualDecay: false };
            
            let coreMsg = result.scatteredMessage && !result.isPositronAbsorption 
                ? `⚠️ ${result.scatteredMessage}` 
                : result.isPpFusion 
                    ? `Nuclear Fusion: Deuterium Synthesized.` 
                    : result.inducedReactionLabel
                        ? `${result.inducedReactionLabel} reaction into ${newData.name}` 
                        : result.targetEntity?.type === EntityType.ENEMY_ELECTRON 
                            ? `Enforced electron capture into ${newData.name}` 
                            : result.targetEntity?.type === EntityType.ENEMY_POSITRON 
                                ? `Enforced positron capture into ${newData.name}` 
                                : result.targetEntity?.type === EntityType.PROTON 
                                    ? `Enforced proton capture into ${newData.name}` 
                                    : result.targetEntity?.type === EntityType.NEUTRON 
                                        ? `Neutron capture into ${newData.name}` 
                                        : `Transformation into ${newData.name}.`;

            if (result.hpPenalty >= 20) { coreMsg = `⚠️ ENFORCED CAPTURE! ${coreMsg}`; reason = REASON.FATAL_CAPTURE; }

            nextState = applyDiscoveryLogic({ ...nextState, messages: [...nextState.messages, coreMsg, ...reactionMessages].slice(-10), hp: Math.min(state.maxHp, Math.max(0, state.hp + (newData.isStable ? 10 : 0) - result.hpPenalty)), energyPoints: Math.min(MAX_ENERGY, state.energyPoints + result.energyBonus + reactionEnergyBonus) }, newData, context, nextTurn, { isCoulombScattered: result.isCoulombScattered, isFusionAchieved: result.isPpFusion, isFissionAchieved: result.isFissionAchieved, isZeroBarnAchieved: result.isZeroBarnAchieved, isBremsAchieved: result.isBremsAchieved, gluttonyTrigger: result.gluttonyTrigger });
        } else {
            const isDare = !state.currentNuclide.isStable && (state.currentNuclide.isProtonDripLine || state.currentNuclide.isNeutronDripLine);
            const isDareActive = state.unlockedGroups.includes(TITLES.DAREDEVIL) && !state.disabledSkills.includes(TITLES.DAREDEVIL);
            let failMsg = isAnti ? `🌑 TOTAL ANNIHILATION: Core matter converted to ${result.energyBonus} MeV energy!` : `⚠️ Transformation failed: Target nuclide is outside the drip lines.`;

            const unlockResult = processUnlocks(
                state.unlockedElements, state.unlockedGroups, null, null,
                false, false, false, false, 0, 
                false, false, false, !!result.isZeroBarnAchieved, !!result.isBremsAchieved,
                0, 0, false, isDare
            );

            let finalEntities = nextState.gridEntities;
            if (unlockResult.updatedGroups.includes(TITLES.DAREDEVIL) && !state.unlockedGroups.includes(TITLES.DAREDEVIL)) {
                finalEntities = generateEntities(1, finalEntities, result.newPos!, nextTurn, EntityType.ANTI_NUCLIDE);
            }

            Object.assign(nextState, { 
                unlockedGroups: unlockResult.updatedGroups,
                gridEntities: finalEntities,
                hp: (isDareActive || isAnti) ? 0 : Math.max(0, state.hp - result.hpPenalty), 
                energyPoints: Math.min(MAX_ENERGY, state.energyPoints + result.energyBonus), 
                magicBarrierCharges: Math.max(0, state.magicBarrierCharges - result.chargesUsed), 
                messages: [...state.messages, failMsg, ...unlockResult.messages].slice(-10),
                score: state.score + unlockResult.scoreBonus
            });
            
            if (nextState.hp === 0) reason = isAnti ? REASON.NOTHINGNESS : (isDareActive ? REASON.TRANSFORMATION_FAILED : REASON.FATAL_CAPTURE);
        }
    } else {
        const nextHp = Math.max(0, Math.min(state.maxHp, state.hp + (state.currentNuclide.isStable ? 1 : 0)) - result.hpPenalty);
        const nextMsg = getNextTutorialMessage(state, 'TURN_ADVANCED', { currentTurn: nextTurn, energyIncreased: result.energyBonus > 0 });
        Object.assign(nextState, { hp: nextHp, ...calculateTutorialFlagUpdates(state, nextMsg, nextTurn, 'TURN_ADVANCED'), tutorialMessage: nextMsg, messages: result.scatteredMessage ? [...state.messages, `⚠️ ${result.scatteredMessage}`].slice(-10) : state.messages });
        if (nextHp === 0) reason = REASON.FATAL_CAPTURE;
    }

    if (result.additionalEffects) nextState.effects = [...nextState.effects, ...result.additionalEffects];
    if (result.inducedDecayMode && result.inducedReactionLabel) nextState.reactionStats = { ...nextState.reactionStats, [result.inducedReactionLabel]: (nextState.reactionStats[result.inducedReactionLabel] || 0) + 1 };
    if (nextState.hp <= 0 && !nextState.gameOver) Object.assign(nextState, resolveStabilityCrisis(nextState, reason, !state.currentNuclide.isStable && (state.currentNuclide.isProtonDripLine || state.currentNuclide.isNeutronDripLine)));
    
    return finalizeAction(nextState);
};