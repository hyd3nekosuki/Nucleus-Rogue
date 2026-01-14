
// Add React import to provide access to React namespace
import React, { useCallback } from 'react';
import { GameState, DecayMode, GameAction } from '../types';

export const useDecayController = (
    gameState: GameState,
    dispatch: React.Dispatch<GameAction>,
    stopAutoMove: () => void
) => {
    const handleDecayAction = useCallback((mode: DecayMode) => {
        stopAutoMove(); 
        if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;
        
        dispatch({
            type: 'MANUAL_DECAY',
            payload: { mode }
        });
    }, [gameState.gameOver, gameState.loadingData, gameState.isTimeStopped, stopAutoMove, dispatch]);

    const handlePlayerInteract = useCallback(() => {
        stopAutoMove(); 
        if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;
        if (gameState.currentNuclide.isStable) return;
        
        let activeMode = gameState.currentNuclide.decayModes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN) 
                        || (gameState.currentNuclide.decayModes.includes(DecayMode.UNKNOWN) ? DecayMode.UNKNOWN : null);
        
        if (activeMode) handleDecayAction(activeMode);
    }, [gameState.gameOver, gameState.loadingData, gameState.isTimeStopped, gameState.currentNuclide, stopAutoMove, handleDecayAction]);

    return {
        handleDecayAction,
        handlePlayerInteract
    };
};
