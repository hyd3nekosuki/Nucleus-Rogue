import React, { useCallback } from 'react';
import { GameState, DecayMode, NuclideData } from '../types';

import { ENERGY_EVOLUTION_TURNS } from '../constants/gameConfig';
import { MAX_ENERGY, SCORE_FACTORS, BONUS_SCORES } from '../constants/economy';

import { calculateMoveResult } from '../engine/gameLogic';
import { processUnlocks } from '../engine/unlockSystem';
import { processRandomBackgroundEvents } from '../engine/randomEvents';
import { getHistoryMethod } from '../utils/historyLogic';
import { getNuclideDataSync } from '../services/nuclideService';
import { DiscoveryContext } from '../engine/stateTransitions';
import { calculateReincarnationTargets } from '../engine/particleEngine';

interface MovementExecutorDeps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    dispatchDiscovery: (nextNuclide: NuclideData, context: DiscoveryContext) => void;
    triggerTTS: (text: string) => void;
    triggerShake: () => void;
    triggerFlash: (color: string) => void;
    setLastDecayEvent: (val: { mode: DecayMode; timestamp: number } | null) => void;
    setLastFinalCombo: (val: { count: number; id: number } | null) => void;
    onStopRequest: () => void;
}

/**
 * Movement Execution Unit: Responsible for processing one 'step' of movement.
 */
export const useMovementExecutor = (deps: MovementExecutorDeps) => {
    const {
        setGameState, dispatchDiscovery, triggerTTS,
        triggerShake, triggerFlash, setLastDecayEvent, 
        onStopRequest
    } = deps;

    const moveStep = useCallback((dx: number, dy: number) => {
        let shouldStop = false;

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
            
            // --- BEGIN GAME PROGRESSION LOGIC ---
            // Update pool based on physics engine result
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
            
            // Check if identity changed
            if (result.dZ !== 0 || result.dA !== 0 || result.isPpFusion || result.isPositronAbsorption || result.isCoulombScattered) {
                const newData = (result.dZ === 0 && result.dA === 0 && !result.isPpFusion && !result.isPositronAbsorption) ? prev.currentNuclide : getNuclideDataSync(potentialZ, potentialA);
                
                if (newData.exists) {
                    // Unlock Processing
                    const unlockResult = processUnlocks(
                        prev.unlockedElements, prev.unlockedGroups, potentialZ, potentialA, 
                        false, false, false, false, 0, 
                        result.isCoulombScattered, result.isPpFusion, result.isFissionAchieved, result.isZeroBarnAchieved, result.isBremsAchieved, 
                        0, 0, result.gluttonyTrigger
                    );

                    // Scoring
                    const basePoints = newData.a * SCORE_FACTORS.MASS_MULTIPLIER;
                    const stabilityReward = newData.isStable ? SCORE_FACTORS.MOVEMENT_STABLE_REWARD : SCORE_FACTORS.MOVEMENT_UNSTABLE_REWARD;
                    const totalBaseActionScore = basePoints + stabilityReward + result.actionBonusScore + (result.magicProtectionBonus || 0) + (result.isPpFusion ? BONUS_SCORES.STELLAR_FUSION : 0);

                    // --- STEP 5: CENTRALIZED TRANSFORMATION DISPATCH ---
                    dispatchDiscovery(newData, {
                        method: getHistoryMethod(!!result.isPpFusion, !!result.isPositronAbsorption, result.targetEntity, result.inducedReactionLabel),
                        pz: prev.currentNuclide.z,
                        pa: prev.currentNuclide.a,
                        addedScore: totalBaseActionScore,
                        chargesUsed: result.chargesUsed,
                        inducedDecayMode: result.inducedDecayMode
                    });

                    // Messaging
                    const protectionMsg = (result.magicProtectionBonus || 0) > 0 ? [`✨ ${result.isPositronAbsorption ? 'POSITRON CAPTURE' : 'MAGIC BARRIER USED'}: +${result.magicProtectionBonus.toLocaleString()} PTS`] : [];
                    const fusionMsg = result.isPpFusion ? [`✨ STELLAR FUSION: p + p → D + e+ (+${BONUS_SCORES.STELLAR_FUSION.toLocaleString()} PTS)`] : [];
                    let coreMsg = result.scatteredMessage && !result.isPositronAbsorption ? `⚠️ ${result.scatteredMessage}` : result.isPpFusion ? `Fusion: Deuterium Synthesized.` : result.isPositronAbsorption ? `Positron capture: Transmuted to ${newData.name}.` : `${result.inducedReactionLabel ? result.inducedReactionLabel + ' reaction' : 'Transformation'} into ${newData.name}.`;

                    // Drip line warning
                    const dripMsg = (!newData.isStable && (newData.isProtonDripLine || newData.isNeutronDripLine)) ? ["⚠️ Danger: Drip line limit"] : [];

                    nextPeripheralUpdate = {
                        ...nextPeripheralUpdate,
                        unlockedElements: unlockResult.updatedElements,
                        unlockedGroups: unlockResult.updatedGroups,
                        messages: [...prev.messages, coreMsg, ...fusionMsg, ...protectionMsg, ...dripMsg, ...unlockResult.messages].slice(-10),
                        energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + result.energyBonus),
                        hp: Math.min(prev.maxHp, Math.max(0, prev.hp + (newData.isStable ? 10 : 0) - result.hpPenalty))
                    };

                    if (prev.tutorialMessage === "Capture particle to transform") {
                        nextPeripheralUpdate.tutorialMessage = null;
                        nextPeripheralUpdate.hasSeenCaptureTutorial = true;
                    } else if (!newData.isStable && !prev.hasSeenDecayTutorial) {
                        nextPeripheralUpdate.tutorialMessage = "Decay to be stable";
                    }

                    if (result.shouldShake) triggerShake();
                    if (result.shouldFlash) triggerFlash('bg-neon-blue');
                    if (result.isPpFusion) triggerTTS("Nuclear Fusion");
                    
                } else {
                    // Target does not exist (Drip line violation)
                    // Reincarnation Check
                    const isDaredevilActive = prev.unlockedGroups.includes("Daredevil") && !prev.disabledSkills.includes("Daredevil");
                    const reinc = calculateReincarnationTargets(prev.currentNuclide, nextPool, prev.evolutionHistory, isDaredevilActive);

                    if (reinc) {
                        const { nuclide, usage } = reinc;
                        const nextEnergy = Math.floor((prev.energyPoints / 2) / 5) * 5;

                        return {
                            ...prev,
                            currentNuclide: nuclide,
                            hp: prev.maxHp,
                            playerLevel: 0,
                            masteredDecays: [],
                            energyPoints: nextEnergy,
                            reincarnationPool: {
                                p: nextPool.p - usage.p,
                                n: nextPool.n - usage.n,
                                e: nextPool.e - usage.e
                            },
                            reincarnations: prev.reincarnations + 1,
                            messages: [...prev.messages, `♻️ REINCARNATION: Reborn as ${nuclide.name}! (Knowledge lost)`].slice(-10),
                            combo: 0,
                            comboScore: 0,
                            comboStartNuclide: undefined,
                            comboStartedUnstable: false,
                            consecutiveProtons: 0,
                            consecutiveNeutrons: 0,
                            consecutiveElectrons: 0,
                            lastConsumedType: null
                        };
                    }

                    // Check for Daredevil attempt
                    const isDaredevilAttempt = prev.currentNuclide.isProtonDripLine || prev.currentNuclide.isNeutronDripLine;

                    // Check for achievements even during failure (Bremsstrahlung or Zero Barn)
                    const unlockResult = processUnlocks(
                        prev.unlockedElements, 
                        prev.unlockedGroups, 
                        null, null,
                        false, false, false, false, 0, 
                        false, false, false, !!result.isZeroBarnAchieved, !!result.isBremsAchieved,
                        0, 0, false, isDaredevilAttempt
                    );
                    
                    const protectionMsg = (result.magicProtectionBonus || 0) > 0 ? [`✨ MAGIC BARRIER USED: +${result.magicProtectionBonus.toLocaleString()} PTS`] : [];
                    
                    nextPeripheralUpdate.unlockedGroups = unlockResult.updatedGroups; 
                    nextPeripheralUpdate.score = prev.score + (result.actionBonusScore || 0) + (result.magicProtectionBonus || 0) + unlockResult.scoreBonus; 
                    nextPeripheralUpdate.messages = [...prev.messages, ...protectionMsg, ...unlockResult.messages].slice(-10);
                    nextPeripheralUpdate.hp = Math.max(0, prev.hp - result.hpPenalty);
                    nextPeripheralUpdate.magicBarrierCharges = Math.max(0, prev.magicBarrierCharges - (result.chargesUsed || 0));
                    nextPeripheralUpdate.turn = prev.turn + 1; 

                    // Hard Mode immediate game over for Daredevil on drip line violation
                    if (isDaredevilActive) {
                        nextPeripheralUpdate.gameOver = true;
                        nextPeripheralUpdate.gameOverReason = "TRANSFORMATION_FAILED";
                    }
                    
                    // Update streak status even on failed transformation
                    nextPeripheralUpdate.consecutiveProtons = result.consecutiveProtons;
                    nextPeripheralUpdate.consecutiveNeutrons = result.consecutiveNeutrons;
                    nextPeripheralUpdate.consecutiveElectrons = result.consecutiveElectrons;
                    nextPeripheralUpdate.lastConsumedType = result.lastConsumedType;
                }
            } else {
                // Moving without identity change (e.g. hitting wall or scattering without absorption)
                nextPeripheralUpdate.turn = prev.turn + 1;
                if (prev.currentNuclide.isStable) nextPeripheralUpdate.hp = Math.min(prev.maxHp, prev.hp + 1);
                
                // Still check for achievements like Zero Barn if the move was successful but identity didn't change (rare but for safety)
                if (result.isZeroBarnAchieved) {
                    const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, 
                    prev.currentNuclide.z, prev.currentNuclide.a,
                    false, false, false, false, 0, false, false, false, true);
                    nextPeripheralUpdate.unlockedGroups = unlockResult.updatedGroups;
                    nextPeripheralUpdate.messages = [...prev.messages, ...unlockResult.messages].slice(-10);
                    nextPeripheralUpdate.score = (nextPeripheralUpdate.score || prev.score) + unlockResult.scoreBonus;
                }
                
                if (result.scatteredMessage) {
                    nextPeripheralUpdate.messages = [...prev.messages, `ℹ ${result.scatteredMessage}`].slice(-10);
                }
            }

            // Create intermediate state for background events processing
            let finalNextState = { ...prev, ...nextPeripheralUpdate };

            // Cleanup & Stats
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

            // Global Stability Enforcement
            if (finalNextState.hp <= 0 && !finalNextState.gameOver) {
                if (finalNextState.unlockedGroups.includes("Temporal Inversion") && 
                    !finalNextState.disabledSkills.includes("Temporal Inversion") && 
                    finalNextState.energyPoints >= 5) {
                    
                    finalNextState.hp = finalNextState.maxHp;
                    finalNextState.energyPoints -= 5;
                    finalNextState.messages = [...finalNextState.messages, "⏱ AUTO-STABILIZATION: Temporal Inversion triggered!"].slice(-10);
                    finalNextState.effects = [
                        ...finalNextState.effects, 
                        { id: Math.random().toString(36).substr(2, 9), type: DecayMode.STABILIZE_ZAP, position: { ...finalNextState.playerPos }, timestamp: Date.now() }
                    ];
                } else {
                    // Final Reincarnation attempt before Game Over
                    const isDaredevilActive = finalNextState.unlockedGroups.includes("Daredevil") && !finalNextState.disabledSkills.includes("Daredevil");
                    const reinc = calculateReincarnationTargets(finalNextState.currentNuclide, finalNextState.reincarnationPool, finalNextState.evolutionHistory, isDaredevilActive);
                    
                    if (reinc) {
                        const { nuclide, usage } = reinc;
                        const nextEnergy = Math.floor((finalNextState.energyPoints / 2) / 5) * 5;

                        finalNextState.currentNuclide = nuclide;
                        finalNextState.hp = finalNextState.maxHp;
                        finalNextState.playerLevel = 0;
                        finalNextState.masteredDecays = [];
                        finalNextState.energyPoints = nextEnergy;
                        finalNextState.reincarnationPool = {
                            p: finalNextState.reincarnationPool.p - usage.p,
                            n: finalNextState.reincarnationPool.n - usage.n,
                            e: finalNextState.reincarnationPool.e - usage.e
                        };
                        finalNextState.reincarnations += 1;
                        finalNextState.messages = [...finalNextState.messages, `♻️ REINCARNATION: Reborn as ${nuclide.name}! (Energy dissipated)`].slice(-10);
                        finalNextState.combo = 0;
                        finalNextState.comboScore = 0;
                        finalNextState.comboStartNuclide = undefined;
                        finalNextState.comboStartedUnstable = false;
                        finalNextState.consecutiveProtons = 0;
                        finalNextState.consecutiveNeutrons = 0;
                        finalNextState.consecutiveElectrons = 0;
                        finalNextState.lastConsumedType = null;
                    } else {
                        finalNextState.gameOver = true;
                        finalNextState.gameOverReason = "PARTICLE_COLLISION";
                        shouldStop = true;
                    }
                }
            }

            // Background Events
            const backgroundResult = processRandomBackgroundEvents(finalNextState);
            finalNextState.gridEntities = backgroundResult.gridEntities;
            finalNextState.messages = backgroundResult.messages;
            finalNextState.activeEvent = backgroundResult.activeEvent;

            return finalNextState;
        });

        if (shouldStop) {
            onStopRequest();
        }
    }, [onStopRequest, triggerTTS, triggerShake, triggerFlash, setLastDecayEvent, setGameState, dispatchDiscovery]);

    return { moveStep };
};