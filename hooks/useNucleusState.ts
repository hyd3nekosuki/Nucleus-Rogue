
import { useState, useCallback } from 'react';
import { GameState, HistoryEntry, NuclideData } from '../types';
import { getInitialState } from '../utils/initialState';
import { handleDiscoveryTransition, DiscoveryContext } from '../utils/stateTransitions';

/**
 * Single Source of Truth hook for the raw game state and discovery history.
 * Ensures state management is consistent across the application.
 */
export const useNucleusState = () => {
    const [gameState, setGameState] = useState<GameState>(getInitialState());
    const [evolutionHistory, setEvolutionHistory] = useState<Record<string, HistoryEntry>>({});

    /**
     * Atomically records a discovery and updates the associated game state.
     * Prevents desync between the history map and the current core state.
     */
    const recordDiscovery = useCallback((nextNuclide: NuclideData, context: DiscoveryContext) => {
        setGameState(prev => {
            const { nextState, newHistoryEntry } = handleDiscoveryTransition(prev, nextNuclide, context);
            
            // Side effect within setter to ensure order of operations
            setEvolutionHistory(h => ({
                ...h,
                [`${nextNuclide.z}-${nextNuclide.a}`]: newHistoryEntry
            }));

            return nextState;
        });
    }, []);

    return {
        gameState,
        setGameState,
        evolutionHistory,
        setEvolutionHistory,
        recordDiscovery
    };
};
