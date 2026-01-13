import React, { useCallback } from 'react';
import { GameState, DecayMode, NuclideData, EntityType, DiscoveryContext } from '../types';

import { ENERGY_EVOLUTION_TURNS } from '../constants/gameConfig';
import { MAX_ENERGY, SCORE_FACTORS, BONUS_SCORES } from '../constants/economy';
import { REASON } from '../constants/gameOverReason';
import { TITLES } from '../constants/titles';

import { calculateMoveResult, generateEntities } from '../engine/gameLogic';
import { processUnlocks } from '../engine/unlockSystem';
import { processRandomBackgroundEvents } from '../engine/randomEvents';
import { getHistoryMethod } from '../utils/historyLogic';
import { getNuclideDataSync } from '../services/nuclideService';
import { resolveStabilityCrisis } from '../engine/stabilityManager';
import { getNextTutorialMessage, calculateTutorialFlagUpdates } from '../engine/tutorialManager';
import { emitShake, emitFlash, emitTTS } from '../engine/events/gameEvents';

interface MovementExecutorDeps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    dispatchDiscovery: (nextNuclide: NuclideData, context: DiscoveryContext) => void;
    setLastDecayEvent: (val: { mode: DecayMode; timestamp: number } | null) => void;
    setLastFinalCombo: (val: { count: number; id: number } | null) => void;
    onStopRequest: () => void;
}

/**
 * Movement Execution Unit: Responsible for processing one 'step' of movement.
 */
export const useMovementExecutor = (deps: MovementExecutorDeps) => {
    const {
        setGameState, dispatchDiscovery, setLastDecayEvent, 
        onStopRequest
    } = deps;

    const moveStep = useCallback((dx: number, dy: number) => {
        let shouldStop = false;
        let potentialReason = REASON.UNKNOWN;
        let isDaredevilAttempt = false;

        setGameState(prev => {
            if (prev.gameOver || prev.loadingData || prev.isTimeStopped) {
                shouldStop = true;
                return prev;
            }

            // Step 3 Physics Simulation
            const result = calculateMoveResult(prev, dx, dy, ENERGY_EVOLUTION_TURNS);
            
            if (!result.moved || !result.newPos) {
                shouldStop = true;
                return prev;
            }
            
            if (result.hpPenalty > 0) { potentialReason = REASON.FATAL_CAPTURE; }

            // Update pool
            const nextPool = {
                p: prev.reincarnationPool.p + result.reincarnationPoolIncrement.p,
                n: prev.reincarnationPool.n + result.reincarnationPoolIncrement.n,
                e: prev.reincarnationPool.e + result.reincarnationPoolIncrement.e
            };

            let nextPeripheralUpdate: Partial<GameState> = { 
                playerPos: result.newPos,
                gridEntities: result.evolvedEntities,
                consecutiveProtons: result.consecutiveProtons,
                consecutiveNeutrons: result.consecutiveNeutrons,
                consecutiveElectrons: result.consecutiveElectrons,
                lastConsumedType: result.lastConsumedType,
                reincarnationPool: nextPool
            };

            const potentialZ = prev.currentNuclide.z + result.dZ;
            const potentialA = prev.currentNuclide.a + result.dA;
            
            const isAntiCollision = result.targetEntity?.type === EntityType.ANTI_NUCLIDE;

            if (result.dZ !== 0 || result.dA !== 0 || result.isPpFusion || result.isPositronAbsorption ) {
                const newData = (result.dZ === 0 && result.dA === 0 && !result.isPpFusion && !result.isPositronAbsorption) ? prev.currentNuclide : getNuclideDataSync(potentialZ, potentialA);
                
                if (newData.exists) {
                    const unlockResult = processUnlocks(
                        prev.unlockedElements, prev.unlockedGroups, potentialZ, potentialA, 
                        false, false, false, false, 0, 
                        result.isCoulombScattered, result.isPpFusion, result.isFissionAchieved, result.isZeroBarnAchieved, result.isBremsAchieved, 
                        0, 0, result.gluttonyTrigger
                    );

                    const basePoints = newData.a * SCORE_FACTORS.MASS_MULTIPLIER;
                    const stabilityReward = newData.isStable ? SCORE_FACTORS.MOVEMENT_STABLE_REWARD : SCORE_FACTORS.MOVEMENT_UNSTABLE_REWARD;
                    const totalBaseActionScore = basePoints + stabilityReward + result.actionBonusScore + (result.magicProtectionBonus || 0) + (result.isPpFusion ? BONUS_SCORES.STELLAR_FUSION : 0);

                    // TRANSFORMATION DISPATCH: Capture sustains chain window but does NOT increment count or record origin
                    dispatchDiscovery(newData, {
                        method: getHistoryMethod(!!result.isPpFusion, !!result.isPositronAbsorption, result.targetEntity, result.inducedReactionLabel),
                        pz: prev.currentNuclide.z,
                        pa: prev.currentNuclide.a,
                        addedScore: totalBaseActionScore,
                        chargesUsed: result.chargesUsed,
                        inducedDecayMode: result.inducedDecayMode,
                        isManualDecay: false // Explicitly set to false for capture transformations
                    });

                    const protectionMsg = (result.magicProtectionBonus || 0) > 0 ? [`✨ ${result.isPositronAbsorption ? 'POSITRON CAPTURE' : 'MAGIC BARRIER USED'}: +${result.magicProtectionBonus.toLocaleString()} PTS`] : [];
                    const fusionMsg = result.isPpFusion ? [`✨ STELLAR FUSION: p + p → D + e+ (+${BONUS_SCORES.STELLAR_FUSION.toLocaleString()} PTS)`] : [];
                    let coreMsg = result.scatteredMessage && !result.isPositronAbsorption ? `⚠️ ${result.scatteredMessage}` : result.isPpFusion ? `Fusion: Deuterium Synthesized.` : result.isPositronAbsorption ? `Positron capture: Transmuted to ${newData.name}.` : `${result.inducedReactionLabel ? result.inducedReactionLabel + ' reaction' : 'Transformation'} into ${newData.name}.`;

                    if (result.hpPenalty >= 20) {
                        coreMsg = `⚠️ ENFORCED CAPTURE! ${coreMsg}`;
                        potentialReason = REASON.FATAL_CAPTURE;
                    }

                    const dripMsg = (!newData.isStable && (newData.isProtonDripLine || newData.isNeutronDripLine)) ? ["⚠️ Danger: Drip line limit"] : [];

                    const nextTurn = prev.turn + 1;
                    const nextMsg = getNextTutorialMessage(prev, 'PARTICLE_CAPTURED', { nextNuclide: newData, currentTurn: nextTurn });
                    const tutorialUpdates = calculateTutorialFlagUpdates(prev, nextMsg, nextTurn, 'PARTICLE_CAPTURED');

                    let finalEntities = nextPeripheralUpdate.gridEntities || prev.gridEntities;
                    if (unlockResult.updatedGroups.includes(TITLES.DAREDEVIL) && !prev.unlockedGroups.includes(TITLES.DAREDEVIL)) {
                        finalEntities = generateEntities(1, finalEntities, result.newPos, nextTurn, EntityType.ANTI_NUCLIDE);
                    }

                    nextPeripheralUpdate = {
                        ...nextPeripheralUpdate,
                        ...tutorialUpdates,
                        tutorialMessage: nextMsg,
                        unlockedElements: unlockResult.updatedElements,
                        unlockedGroups: unlockResult.updatedGroups,
                        gridEntities: finalEntities,
                        messages: [...prev.messages, coreMsg, ...fusionMsg, ...protectionMsg, ...dripMsg, ...unlockResult.messages].slice(-10),
                        energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + result.energyBonus),
                        hp: Math.min(prev.maxHp, Math.max(0, prev.hp + (newData.isStable ? 10 : 0) - result.hpPenalty)),
                        score: prev.score + (totalBaseActionScore * (prev.combo || 1)) + unlockResult.scoreBonus
                    };

                    if (result.shouldShake) emitShake();
                    if (result.shouldFlash) emitFlash('bg-neon-blue');
                    if (result.isPpFusion) emitTTS("Nuclear Fusion");
                    
                } else {
                    isDaredevilAttempt = !prev.currentNuclide.isStable && (prev.currentNuclide.isProtonDripLine || prev.currentNuclide.isNeutronDripLine);
                    const isDaredevilActive = prev.unlockedGroups.includes(TITLES.DAREDEVIL) && !prev.disabledSkills.includes(TITLES.DAREDEVIL);

                    const unlockResult = processUnlocks(
                        prev.unlockedElements, 
                        prev.unlockedGroups, 
                        null, null,
                        false, false, false, false, 0, 
                        false, false, false, !!result.isZeroBarnAchieved, !!result.isBremsAchieved,
                        0, 0, false, isDaredevilAttempt
                    );
                    
                    const protectionMsg = (result.magicProtectionBonus || 0) > 0 ? [`✨ MAGIC BARRIER USED: +${result.magicProtectionBonus.toLocaleString()} PTS`] : [];
                    let failMsg = `⚠️ Transformation failed: Target nuclide is outside the drip lines.`;
                    
                    if (isAntiCollision) {
                        failMsg = `🌑 TOTAL ANNIHILATION: Core matter converted to ${result.energyBonus} MeV energy!`;
                        emitTTS("Total Annihilation");
                    }

                    let finalEntities = nextPeripheralUpdate.gridEntities || prev.gridEntities;
                    if (unlockResult.updatedGroups.includes(TITLES.DAREDEVIL) && !prev.unlockedGroups.includes(TITLES.DAREDEVIL)) {
                        finalEntities = generateEntities(1, finalEntities, prev.playerPos, prev.turn + 1, EntityType.ANTI_NUCLIDE);
                    }

                    nextPeripheralUpdate.unlockedGroups = unlockResult.updatedGroups; 
                    nextPeripheralUpdate.gridEntities = finalEntities;
                    nextPeripheralUpdate.score = prev.score + (result.actionBonusScore || 0) + (result.magicProtectionBonus || 0) + unlockResult.scoreBonus; 
                    nextPeripheralUpdate.messages = [...prev.messages, failMsg, ...protectionMsg, ...unlockResult.messages].slice(-10);
                    
                    if (isDaredevilActive || isAntiCollision) {
                        nextPeripheralUpdate.hp = 0;
                        potentialReason = isAntiCollision ? REASON.NOTHINGNESS : REASON.TRANSFORMATION_FAILED;
                    } else {
                        nextPeripheralUpdate.hp = Math.max(0, prev.hp - result.hpPenalty);
                        if (nextPeripheralUpdate.hp === 0) potentialReason = REASON.FATAL_CAPTURE;
                    }
                    
                    nextPeripheralUpdate.energyPoints = Math.min(MAX_ENERGY, prev.energyPoints + result.energyBonus);
                    nextPeripheralUpdate.magicBarrierCharges = Math.max(0, prev.magicBarrierCharges - (result.chargesUsed || 0));
                    nextPeripheralUpdate.turn = prev.turn + 1; 

                    nextPeripheralUpdate.consecutiveProtons = result.consecutiveProtons;
                    nextPeripheralUpdate.consecutiveNeutrons = result.consecutiveNeutrons;
                    nextPeripheralUpdate.consecutiveElectrons = result.consecutiveElectrons;
                    nextPeripheralUpdate.lastConsumedType = result.lastConsumedType;
                }
            } else {
                nextPeripheralUpdate.turn = prev.turn + 1;
                const recovery = prev.currentNuclide.isStable ? 1 : 0;
                nextPeripheralUpdate.hp = Math.max(0, Math.min(prev.maxHp, prev.hp + recovery) - result.hpPenalty);
                if (nextPeripheralUpdate.hp === 0) potentialReason = REASON.FATAL_CAPTURE;

                if (result.scatteredMessage) {
                    nextPeripheralUpdate.messages = [
                        ...prev.messages, 
                        `⚠️ ${result.scatteredMessage}`
                    ].slice(-10);
                }

                const nextTurn = prev.turn + 1;
                const nextMsg = getNextTutorialMessage(prev, 'TURN_ADVANCED', { currentTurn: nextTurn });
                const tutorialUpdates = calculateTutorialFlagUpdates(prev, nextMsg, nextTurn, 'TURN_ADVANCED');
                Object.assign(nextPeripheralUpdate, { ...tutorialUpdates, tutorialMessage: nextMsg });
            }

            let finalNextState = { ...prev, ...nextPeripheralUpdate };

            if (result.additionalEffects) {
                finalNextState.effects = [...finalNextState.effects, ...result.additionalEffects];
            }
            if (result.inducedDecayMode && result.inducedReactionLabel) {
                setLastDecayEvent({ mode: result.inducedDecayMode, timestamp: Date.now() });
                finalNextState.reactionStats = { 
                    ...finalNextState.reactionStats, 
                    [result.inducedReactionLabel]: (finalNextState.reactionStats[result.inducedReactionLabel] || 0) + 1 
                };
            }

            if (finalNextState.hp <= 0 && !finalNextState.gameOver) {
                const crisisUpdate = resolveStabilityCrisis(finalNextState, potentialReason, isDaredevilAttempt);
                finalNextState = { ...finalNextState, ...crisisUpdate };
                if (finalNextState.gameOver) shouldStop = true;
            }

            const backgroundResult = processRandomBackgroundEvents(finalNextState);
            finalNextState.gridEntities = backgroundResult.gridEntities;
            finalNextState.messages = backgroundResult.messages;
            finalNextState.activeEvent = backgroundResult.activeEvent;
            finalNextState.emptyTurnCount = backgroundResult.emptyTurnCount;

            return finalNextState;
        });

        if (shouldStop) {
            onStopRequest();
        }
    }, [onStopRequest, setLastDecayEvent, setGameState, dispatchDiscovery]);

    return { moveStep };
};