
import React, { useCallback } from 'react';
import { GameState, HistoryEntry } from '../types';
import { getNuclideDataSync } from '../services/nuclideService';
import { parseNuclideCommand, solveParticleRequirements } from '../engine/particleEngine';

/**
 * Custom hook for the 'Quantum Override Transmutation' mechanic (Mastery Level 6).
 * Handles the logic of consuming grid particles to transform the nucleus into a specific target.
 */
export const useQuantumOverride = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    resetVisualEvents: () => void
) => {
    /**
     * Attempts to execute a transmutation based on the provided command string.
     * @param code The input string (e.g., "Au-197")
     * @returns true if transmutation was successful, false otherwise.
     */
    const executeQuantumOverride = useCallback((code: string): boolean => {
        if (!code || code.trim().length === 0) return false;
        
        // Security Check: Only active for Mastery Level 6
        if (gameState.playerLevel < 6) return false;

        // Step 1: Parse the goal nuclide coordinates
        const commandCoords = parseNuclideCommand(code);
        if (!commandCoords) return false;

        // Step 2: Solve the resource equation using current grid entities
        const requirements = solveParticleRequirements(
            gameState.currentNuclide.z,
            gameState.currentNuclide.a,
            commandCoords.z,
            commandCoords.a,
            gameState.gridEntities
        );

        // Step 3: Apply transformation if resources are available
        if (requirements) {
            const targetData = getNuclideDataSync(commandCoords.z, commandCoords.a);
            const nextTurn = gameState.turn + 1;
            const now = Date.now();
            
            const existing = gameState.evolutionHistory[`${targetData.z}-${targetData.a}`];
            const newEntry: HistoryEntry = {
                firstTurn: existing ? existing.firstTurn : nextTurn,
                lastTurn: nextTurn,
                name: targetData.name,
                symbol: targetData.symbol,
                z: targetData.z,
                a: targetData.a,
                method: "Quantum Override Transmutation",
                pz: gameState.currentNuclide.z,
                pa: gameState.currentNuclide.a
            };

            // Atomic state update for transmutation
            setGameState(prev => ({
                ...prev,
                currentNuclide: targetData,
                turn: nextTurn,
                // Consume the specific grid entities used for the reaction
                gridEntities: prev.gridEntities.filter(e => !requirements.idsToConsume.includes(e.id)),
                evolutionHistory: {
                    ...prev.evolutionHistory,
                    [`${targetData.z}-${targetData.a}`]: newEntry
                },
                messages: [...prev.messages, `🌌 SYSTEM OVERRIDE: Reachable configuration established for ${targetData.name}!`].slice(-10),
                energyPoints: 0, // High-dimensional interference resets local energy
                lastEvent: {
                    id: now,
                    type: 'SKILL',
                    subType: 'TRANSMUTE',
                    flash: 'bg-yellow-400',
                    shake: true,
                    priorityMessages: ['Quantum Override Transmutation']
                }
            }));
            
            return true;
        }

        return false;
    }, [gameState.playerLevel, gameState.currentNuclide, gameState.gridEntities, gameState.turn, gameState.evolutionHistory, setGameState]);

    return { executeQuantumOverride };
};
