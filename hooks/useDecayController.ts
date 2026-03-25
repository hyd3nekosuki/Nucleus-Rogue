
import React, { useCallback } from 'react';
import { GameState, DecayMode, GameAction, EntityType } from '../types';
import { selectDecayMode, getNuclideDataSync } from '../services/nuclideService';
import { calculateDecayEffects } from '../physics/decaySystem';
import { TITLES } from '../constants/titles';

export const useDecayController = (
    gameState: GameState,
    dispatch: React.Dispatch<GameAction>,
    stopAutoMove: () => void
) => {
    const handleDecayAction = useCallback((mode: DecayMode) => {
        stopAutoMove(); 
        if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped || gameState.isAnimatingFission) return;
        
        let actualMode = mode;
        // If the mode is UNKNOWN or we want to use the nuclide's natural branching ratios
        // CRITICAL: For Forced Decay (Stable nuclide + UNKNOWN), we MUST skip selectDecayMode
        // to allow the reducer/handler to perform the random selection logic (Demon Core, etc.).
        const isForcedDecay = mode === DecayMode.UNKNOWN && gameState.currentNuclide.isStable;

        if (!isForcedDecay && (mode === DecayMode.UNKNOWN || mode === (gameState.currentNuclide.decayModes[0] || DecayMode.UNKNOWN))) {
            actualMode = selectDecayMode(gameState.currentNuclide.branches);
        }

        // Handle EC/B+ 50/50 split
        if (actualMode === DecayMode.EC_B_PLUS) {
            actualMode = Math.random() < 0.5 ? DecayMode.ELECTRON_CAPTURE : DecayMode.BETA_PLUS;
        }

        const fissionEnabled = !gameState.disabledSkills.includes(TITLES.FISSION);
        
        // Check if it's a fission event that needs animation
        if (actualMode === DecayMode.SPONTANEOUS_FISSION && fissionEnabled) {
            const now = Date.now();
            const result = calculateDecayEffects(
                actualMode, 
                gameState.currentNuclide, 
                gameState.playerPos, 
                gameState.gridEntities, 
                now, 
                gameState.unlockedGroups.includes(TITLES.PAIR_ANNIHILATION) && !gameState.disabledSkills.includes(TITLES.PAIR_ANNIHILATION), 
                fissionEnabled, 
                gameState.unlockedGroups.includes(TITLES.NEUTRONIZATION) && !gameState.disabledSkills.includes(TITLES.NEUTRONIZATION)
            );
            const newData = getNuclideDataSync(gameState.currentNuclide.z + result.dZ, gameState.currentNuclide.a + result.dA);
            
            // If there's a chain reaction path, start animation
            if (result.chainReactionPath && result.chainReactionPath.length > 1) {
                const totalBaseActionPoints = (newData.a * 10) + (newData.isStable ? 1000 : 500) + result.actionBonusScore;
                const context = { method: result.trigger, pz: gameState.currentNuclide.z, pa: gameState.currentNuclide.a, addedScore: totalBaseActionPoints, chargesUsed: 0, inducedDecayMode: actualMode, isManualDecay: true };
                
                dispatch({
                    type: 'START_FISSION_ANIMATION',
                    payload: { mode: actualMode, result, newData, context }
                });
                return;
            }
        }

        dispatch({
            type: 'MANUAL_DECAY',
            payload: { mode: actualMode }
        });
    }, [gameState.gameOver, gameState.loadingData, gameState.isTimeStopped, gameState.isAnimatingFission, gameState.currentNuclide, gameState.playerPos, gameState.gridEntities, gameState.unlockedGroups, gameState.disabledSkills, stopAutoMove, dispatch]);

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
