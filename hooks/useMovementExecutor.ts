
import React, { useCallback } from 'react';
import { GameState, DecayMode, HistoryEntry } from '../types';
import { 
    ENERGY_EVOLUTION_TURNS, COULOMB_BARRIER_THRESHOLD, MAX_ENERGY 
} from '../constants';
import { calculateMoveResult } from '../utils/gameLogic';
import { processUnlocks } from '../utils/unlockSystem';
import { isTemporalInversionEligible, calculateComboCompletionBonus } from '../utils/scoreLogic';
import { getHistoryMethod } from '../utils/historyLogic';

interface MovementExecutorDeps {
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    setEvolutionHistory: React.Dispatch<React.SetStateAction<Record<string, HistoryEntry>>>;
    triggerTTS: (text: string) => void;
    triggerShake: () => void;
    triggerFlash: (color: string) => void;
    setLastDecayEvent: (val: { mode: DecayMode; timestamp: number } | null) => void;
    setFinalCombo: (val: { count: number; id: number } | null) => void;
    onStopRequest: () => void;
}

/**
 * Movement Execution Unit: Responsible for processing one 'step' of movement.
 * It coordinates the atomic physics logic, game rules, and immediate UI effects.
 */
export const useMovementExecutor = (deps: MovementExecutorDeps) => {
    const {
        setGameState, setEvolutionHistory, triggerTTS,
        triggerShake, triggerFlash, setLastDecayEvent, setFinalCombo,
        onStopRequest
    } = deps;

    const moveStep = useCallback((dx: number, dy: number) => {
        let shouldStop = false;

        setGameState(prev => {
            // Pre-move guards
            if (prev.gameOver || prev.loadingData || prev.isTimeStopped) {
                shouldStop = true;
                return prev;
            }

            // Calculate the physical outcome of the move
            const result = calculateMoveResult(
                prev, 
                dx, 
                dy, 
                COULOMB_BARRIER_THRESHOLD, 
                ENERGY_EVOLUTION_TURNS, 
                prev.playerLevel
            );
            
            // If movement was blocked by boundaries or specific game logic
            if (!result.moved) {
                shouldStop = true;
                return prev;
            }
            
            const nextState = { ...result.state };
            
            // Apply physical constraints and secondary effects
            if (nextState.energyPoints > MAX_ENERGY) nextState.energyPoints = MAX_ENERGY;
            if (nextState.gameOver) nextState.energyPoints = 0;

            // Trigger sensory feedback
            if (result.shouldShake) triggerShake();
            if (result.shouldFlash) triggerFlash('bg-neon-blue');
            
            if (result.additionalEffects) {
                nextState.effects = [...nextState.effects, ...result.additionalEffects];
            }

            // Handle induced nuclear reactions (e.g., neutron-induced fission/capture)
            if (result.inducedDecayMode && result.inducedReactionLabel) {
                setLastDecayEvent({ mode: result.inducedDecayMode, timestamp: Date.now() });
                nextState.reactionStats = { 
                    ...nextState.reactionStats, 
                    [result.inducedReactionLabel]: (nextState.reactionStats[result.inducedReactionLabel] || 0) + 1 
                };
            }

            // Check for Nuclide Transformation (Discovery)
            if (nextState.currentNuclide.z !== prev.currentNuclide.z || nextState.currentNuclide.a !== prev.currentNuclide.a) {
                // Update tutorial state
                if (prev.tutorialMessage === "Capture particle to transform") {
                    nextState.tutorialMessage = null;
                    nextState.hasSeenCaptureTutorial = true;
                }
                if (!nextState.currentNuclide.isStable && !prev.hasSeenDecayTutorial) {
                    nextState.tutorialMessage = "Decay to be stable";
                }

                // Record discovery in evolution history
                const method = getHistoryMethod(!!result.isPpFusion, !!result.isPositronAbsorption, result.targetEntity, result.inducedReactionLabel);
                setEvolutionHistory(h => ({
                    ...h,
                    [`${nextState.currentNuclide.z}-${nextState.currentNuclide.a}`]: { 
                        turn: nextState.turn, 
                        name: nextState.currentNuclide.name, 
                        symbol: nextState.currentNuclide.symbol, 
                        z: nextState.currentNuclide.z, 
                        a: nextState.currentNuclide.a, 
                        method,
                        pz: prev.currentNuclide.z,
                        pa: prev.currentNuclide.a
                    }
                }));

                if (result.isPpFusion) triggerTTS("Nuclear Fusion");

                // Manage combo chains
                if (nextState.combo === 0 && !nextState.currentNuclide.isStable) {
                    nextState.comboStartNuclide = { z: prev.currentNuclide.z, a: prev.currentNuclide.a };
                }
                
                const scoreDiff = nextState.score - prev.score;
                nextState.comboScore = (nextState.combo === 0) ? scoreDiff : prev.comboScore + scoreDiff;

                // Handle Automatic Settlement (Reached Stability during move)
                if (nextState.currentNuclide.isStable && prev.combo > 0) {
                    const isMatched = isTemporalInversionEligible(
                        nextState.currentNuclide.z, 
                        nextState.currentNuclide.a, 
                        prev.comboStartNuclide
                    );
                    
                    const isUnlocked = prev.unlockedGroups.includes("Temporal Inversion");
                    const isDisabled = prev.disabledSkills.includes("Temporal Inversion");
                    // Trigger unlock if not unlocked, or apply bonus if unlocked and enabled
                    const shouldTriggerInversion = isMatched && (!isUnlocked || !isDisabled);

                    if (shouldTriggerInversion) {
                        const scoreBonus = calculateComboCompletionBonus(nextState.comboScore, true);
                        const unlockResult = processUnlocks(
                            nextState.unlockedElements, nextState.unlockedGroups, 
                            nextState.currentNuclide.z, nextState.currentNuclide.a, 
                            false, false, false, true, nextState.comboScore, 
                            false, false, false, false, false, 
                            prev.decayStats[DecayMode.BETA_PLUS] || 0, 
                            prev.decayStats[DecayMode.BETA_MINUS] || 0
                        );
                        nextState.score += scoreBonus + unlockResult.scoreBonus;
                        nextState.unlockedGroups = unlockResult.updatedGroups;
                        nextState.messages = [...nextState.messages, ...unlockResult.messages].slice(-10);
                    }

                    if (prev.combo >= 2) setFinalCombo({ count: prev.combo, id: Date.now() });
                    nextState.combo = 0;
                    nextState.comboScore = 0;
                    nextState.comboStartNuclide = undefined;
                }
            }

            // Life cycle safety: Death Check
            if (nextState.hp <= 0 && !nextState.gameOver) {
                // Check for Temporal Inversion auto-save
                if (nextState.unlockedGroups.includes("Temporal Inversion") && 
                    !nextState.disabledSkills.includes("Temporal Inversion") && 
                    nextState.energyPoints >= 5) {
                    
                    nextState.hp = nextState.maxHp;
                    nextState.energyPoints -= 5;
                    nextState.messages = [...nextState.messages, "⏱ AUTO-STABILIZATION: Temporal Inversion triggered!"].slice(-10);
                    nextState.effects = [
                        ...nextState.effects, 
                        { id: Math.random().toString(36).substr(2, 9), type: DecayMode.STABILIZE_ZAP, position: { ...nextState.playerPos }, timestamp: Date.now() }
                    ];
                } else {
                    nextState.gameOver = true;
                    nextState.gameOverReason = "PARTICLE_COLLISION";
                    nextState.combo = 0;
                    nextState.comboScore = 0;
                    nextState.comboStartNuclide = undefined;
                    shouldStop = true;
                }
            }
            return nextState;
        });

        // If something triggered a stop (game over, blockage), notify the controller
        if (shouldStop) {
            onStopRequest();
        }
    }, [
        onStopRequest, triggerTTS, triggerShake, triggerFlash, 
        setLastDecayEvent, setFinalCombo, setGameState, setEvolutionHistory
    ]);

    return { moveStep };
};
