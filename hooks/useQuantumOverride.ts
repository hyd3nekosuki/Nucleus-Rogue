import React, { useCallback } from 'react';
import { GameState, GameAction } from '../types';
import { parseNuclideCommand, solveParticleRequirements } from '../engine/particleEngine';

/**
 * Custom hook for the 'Quantum Override Transmutation' mechanic (Mastery Level 8).
 * Refactored in Step 4 to rely on the centralized Reducer logic for state transitions.
 */
export const useQuantumOverride = (
    gameState: GameState,
    dispatch: React.Dispatch<GameAction>,
    resetVisualEvents: () => void
) => {
    /**
     * Checks if the given code corresponds to a valid, reachable nuclide for override.
     * Used for real-time UI highlighting via useOverrideValidator.
     */
    const validateOverridePotential = useCallback((code: string) => {
        if (gameState.playerLevel < 8 || !code.trim()) return null;
        
        const coords = parseNuclideCommand(code);
        if (!coords) return null;

        const requirements = solveParticleRequirements(
            gameState.currentNuclide.z, gameState.currentNuclide.a, 
            coords.z, coords.a, gameState.gridEntities
        );

        return requirements;
    }, [gameState.playerLevel, gameState.currentNuclide, gameState.gridEntities]);

    /**
     * Attempts to execute a transmutation based on the provided command string.
     * Dispatches a Reducer action to ensure consistent turn progression and finalization.
     */
    const executeQuantumOverride = useCallback((code: string): boolean => {
        if (!code || code.trim().length === 0 || gameState.playerLevel < 8) return false;
        
        const requirements = validateOverridePotential(code);
        if (requirements) {
            // Clean up visual effect ghost states before the world state leaps forward
            resetVisualEvents();

            dispatch({
                type: 'USE_SKILL',
                payload: { 
                    skillType: 'QUANTUM_OVERRIDE',
                    params: { code }
                }
            });
            return true;
        }

        return false;
    }, [gameState.playerLevel, validateOverridePotential, resetVisualEvents, dispatch]);

    return { executeQuantumOverride };
};