
import React, { useCallback } from 'react';
import { GameState, DecayMode, GameAction } from '../types';
import { selectDecayMode } from '../services/nuclideService';

export const useDecayController = (
    gameState: GameState,
    dispatch: React.Dispatch<GameAction>,
    stopAutoMove: () => void
) => {
    const handleDecayAction = useCallback((mode: DecayMode) => {
        stopAutoMove(); 
        if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;
        
        let actualMode = mode;
        // If the mode is UNKNOWN or we want to use the nuclide's natural branching ratios
        if (mode === DecayMode.UNKNOWN || mode === (gameState.currentNuclide.decayModes[0] || DecayMode.UNKNOWN)) {
            actualMode = selectDecayMode(gameState.currentNuclide.branches);
        }

        // Handle EC/B+ 50/50 split
        if (actualMode === DecayMode.EC_B_PLUS) {
            actualMode = Math.random() < 0.5 ? DecayMode.ELECTRON_CAPTURE : DecayMode.BETA_PLUS;
        }

        dispatch({
            type: 'MANUAL_DECAY',
            payload: { mode: actualMode }
        });
    }, [gameState.gameOver, gameState.loadingData, gameState.isTimeStopped, gameState.currentNuclide, stopAutoMove, dispatch]);

    const handlePlayerInteract = useCallback(() => {
        stopAutoMove(); 
        if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;
        if (gameState.currentNuclide.isStable) return;
        
        const selectedMode = selectDecayMode(gameState.currentNuclide.branches);
        // Trigger decay even if it's UNKNOWN (user request: space key should work for ? decay)
        handleDecayAction(selectedMode);
    }, [gameState.gameOver, gameState.loadingData, gameState.isTimeStopped, gameState.currentNuclide, stopAutoMove, handleDecayAction]);

    return {
        handleDecayAction,
        handlePlayerInteract
    };
};
