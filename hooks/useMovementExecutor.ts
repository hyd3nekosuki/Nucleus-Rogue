
import React, { useCallback } from 'react';
import { GameState, DecayMode, HistoryEntry, NuclideData } from '../types';

import { ENERGY_EVOLUTION_TURNS } from '../constants/gameConfig';
import { COULOMB_BARRIER_THRESHOLD } from '../constants/physics';
import { MAX_ENERGY } from '../constants/economy';

import { calculateMoveResult } from '../engine/gameLogic';
import { getHistoryMethod } from '../utils/historyLogic';

interface MovementExecutorDeps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    triggerTTS: (text: string) => void;
    triggerShake: () => void;
    triggerFlash: (color: string) => void;
    setLastDecayEvent: (val: { mode: DecayMode; timestamp: number } | null) => void;
    setFinalCombo: (val: { count: number; id: number } | null) => void;
    onStopRequest: () => void;
}

/**
 * Movement Execution Unit: Responsible for processing one 'step' of movement.
 */
export const useMovementExecutor = (deps: MovementExecutorDeps) => {
    const {
        setGameState, triggerTTS,
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

            const result = calculateMoveResult(
                prev, 
                dx, 
                dy, 
                COULOMB_BARRIER_THRESHOLD, 
                ENERGY_EVOLUTION_TURNS, 
                prev.playerLevel
            );
            
            if (!result.moved) {
                shouldStop = true;
                return prev;
            }
            
            const nextState = { ...result.state };
            
            if (nextState.energyPoints > MAX_ENERGY) nextState.energyPoints = MAX_ENERGY;
            if (nextState.gameOver) nextState.energyPoints = 0;

            if (result.shouldShake) triggerShake();
            if (result.shouldFlash) triggerFlash('bg-neon-blue');
            
            if (result.additionalEffects) {
                nextState.effects = [...nextState.effects, ...result.additionalEffects];
            }

            if (result.inducedDecayMode && result.inducedReactionLabel) {
                setLastDecayEvent({ mode: result.inducedDecayMode, timestamp: Date.now() });
                nextState.reactionStats = { 
                    ...nextState.reactionStats, 
                    [result.inducedReactionLabel]: (nextState.reactionStats[result.inducedReactionLabel] || 0) + 1 
                };
            }

            // Discovery Handling - Integrated Synchronously
            if (nextState.currentNuclide.z !== prev.currentNuclide.z || nextState.currentNuclide.a !== prev.currentNuclide.a) {
                if (prev.tutorialMessage === "Capture particle to transform") {
                    nextState.tutorialMessage = null;
                    nextState.hasSeenCaptureTutorial = true;
                }
                if (!nextState.currentNuclide.isStable && !prev.hasSeenDecayTutorial) {
                    nextState.tutorialMessage = "Decay to be stable";
                }

                const method = getHistoryMethod(!!result.isPpFusion, !!result.isPositronAbsorption, result.targetEntity, result.inducedReactionLabel);
                
                // Add to history within the same state transition to prevent map skipping
                const newEntry: HistoryEntry = {
                    turn: nextState.turn,
                    name: nextState.currentNuclide.name,
                    symbol: nextState.currentNuclide.symbol,
                    z: nextState.currentNuclide.z,
                    a: nextState.currentNuclide.a,
                    method,
                    pz: prev.currentNuclide.z,
                    pa: prev.currentNuclide.a
                };

                nextState.evolutionHistory = {
                    ...prev.evolutionHistory,
                    [`${nextState.currentNuclide.z}-${nextState.currentNuclide.a}`]: newEntry
                };

                if (result.isPpFusion) triggerTTS("Nuclear Fusion");
            }

            if (nextState.hp <= 0 && !nextState.gameOver) {
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
                    shouldStop = true;
                }
            }
            return nextState;
        });

        if (shouldStop) {
            onStopRequest();
        }
    }, [onStopRequest, triggerTTS, triggerShake, triggerFlash, setLastDecayEvent, setGameState]);

    return { moveStep };
};
