
// Added React import to provide access to React namespace
import React, { useEffect } from 'react';
import { GameState, DecayMode } from '../types';
import { COMBO_WINDOW_MS } from '../constants';
import { isTemporalInversionEligible } from '../utils/scoreLogic';
import { processUnlocks } from './unlockSystem';

/**
 * Custom hook to manage the combo (chain) window and settlement.
 * Handles the final Temporal Inversion check when a chain naturally expires.
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
                    if (prev.combo === 0) return prev;

                    let finalScoreBonus = 0;
                    let nextUnlockedGroups = [...prev.unlockedGroups];
                    let nextMessages = [...prev.messages];

                    // --- Temporal Inversion Check (At the end of the chain) ---
                    const isMatched = isTemporalInversionEligible(
                        prev.currentNuclide.z, 
                        prev.currentNuclide.a, 
                        prev.comboStartNuclide
                    );
                    
                    const isDisabled = prev.disabledSkills.includes("Temporal Inversion");

                    // Conditions for Temporal Inversion:
                    // 1. Current position matches the recorded start of the chain.
                    // 2. The chain MUST have started from an UNSTABLE nuclide.
                    // 3. Since stable nuclei reset the chain immediately in Transitions,
                    //    if we are here and matched, we are by definition at an unstable nucleus.
                    if (isMatched && prev.comboStartedUnstable && !isDisabled) {
                        const unlockResult = processUnlocks(
                            prev.unlockedElements, prev.unlockedGroups, 
                            prev.currentNuclide.z, prev.currentNuclide.a, 
                            false, false, false, true, prev.comboScore
                        );
                        
                        finalScoreBonus = unlockResult.scoreBonus;
                        nextUnlockedGroups = unlockResult.updatedGroups;
                        nextMessages = [
                            ...nextMessages, 
                            "⏱ TEMPORAL INVERSION: Loop concluded at origin unstable state!", 
                            ...unlockResult.messages
                        ];
                    }

                    // Trigger visual combo completion effect
                    if (prev.combo >= 2) setFinalCombo({ count: prev.combo, id: Date.now() });

                    // Clean reset of combo tracking state
                    return { 
                        ...prev, 
                        score: prev.score + finalScoreBonus,
                        unlockedGroups: nextUnlockedGroups,
                        messages: nextMessages.slice(-10),
                        combo: 0, 
                        comboScore: 0, 
                        comboStartNuclide: undefined,
                        comboStartedUnstable: false
                    };
                });
            }
        }, 100);

        return () => clearInterval(interval);
    }, [gameState.combo, gameState.lastComboTime, gameState.gameOver, gameState.isTimeStopped, setGameState, setFinalCombo]);
};
