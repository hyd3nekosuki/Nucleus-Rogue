// Added React import to provide access to React namespace
import React, { useEffect } from 'react';
import { GameState, DecayMode } from '../types';
import { COMBO_WINDOW_MS } from '../constants';
import { isTemporalInversionEligible, calculateComboCompletionBonus } from '../utils/scoreLogic';
import { processUnlocks } from '../utils/unlockSystem';

/**
 * Custom hook to manage the combo (chain) window and settlement.
 * Extracts timing and resolution logic from useNucleusEngine to keep the main engine clean.
 */
export const useComboTimer = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    setFinalCombo: React.Dispatch<React.SetStateAction<{ count: number; id: number } | null>>
) => {
    useEffect(() => {
        // Guard: If no active combo, or time is stopped, or game is over, do nothing
        if (gameState.combo === 0 || gameState.gameOver || gameState.isTimeStopped) return;

        const interval = setInterval(() => {
            const now = Date.now();
            if (now - gameState.lastComboTime > COMBO_WINDOW_MS) {
                setGameState(prev => {
                    // Double check in callback to ensure state consistency
                    if (prev.combo === 0) return prev;

                    // FIX: isTemporalInversionEligible expects 3 arguments, updated to match definition in utils/scoreLogic.ts.
                    // Also extracted skill checks to match the orchestrator logic found in useMovementExecutor and useDecayController.
                    const isMatched = isTemporalInversionEligible(
                        prev.currentNuclide.z,
                        prev.currentNuclide.a,
                        prev.comboStartNuclide
                    );
                    const isUnlocked = prev.unlockedGroups.includes("Temporal Inversion");
                    const isDisabled = prev.disabledSkills.includes("Temporal Inversion");
                    const shouldTriggerInversion = isMatched && (!isUnlocked || !isDisabled);

                    if (shouldTriggerInversion) {
                        const scoreBonus = calculateComboCompletionBonus(prev.comboScore, true);
                        const unlockResult = processUnlocks(
                            prev.unlockedElements,
                            prev.unlockedGroups,
                            prev.currentNuclide.z,
                            prev.currentNuclide.a,
                            false,
                            false,
                            false,
                            true,
                            prev.comboScore
                        );
                        
                        // Trigger visual combo completion effect
                        if (prev.combo >= 2) setFinalCombo({ count: prev.combo, id: Date.now() });

                        return {
                            ...prev,
                            score: prev.score + scoreBonus + unlockResult.scoreBonus,
                            unlockedGroups: unlockResult.updatedGroups,
                            messages: [...prev.messages, ...unlockResult.messages].slice(-10),
                            combo: 0,
                            comboScore: 0,
                            comboStartNuclide: undefined
                        };
                    }

                    // Normal combo end (no inversion)
                    if (prev.combo >= 2) setFinalCombo({ count: prev.combo, id: Date.now() });
                    return { ...prev, combo: 0, comboScore: 0, comboStartNuclide: undefined };
                });
            }
        }, 100);

        return () => clearInterval(interval);
    }, [gameState.combo, gameState.lastComboTime, gameState.gameOver, gameState.isTimeStopped, setGameState, setFinalCombo]);
};