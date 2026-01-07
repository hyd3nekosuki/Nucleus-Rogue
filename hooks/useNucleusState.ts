
import { useReducer, useCallback } from 'react';
import { GameState, NuclideData, GameAction } from '../types';
import { getInitialState } from '../utils/initialState';
import { nucleusReducer, DiscoveryContext } from '../utils/stateTransitions';

/**
 * Single Source of Truth hook for the raw game state and discovery history.
 * Uses a Reducer to ensure all complex state transitions are atomic.
 */
export const useNucleusState = () => {
    // Initialize integrated state
    // FIX: Simplified initialization as getInitialState now correctly includes evolutionHistory
    const initialState: GameState = getInitialState();

    const [gameState, dispatch] = useReducer(nucleusReducer, initialState);

    /**
     * Atomically records a discovery and updates the associated game state.
     * Dispatches the action to the reducer where history and core state are updated together.
     */
    const recordDiscovery = useCallback((nextNuclide: NuclideData, context: DiscoveryContext) => {
        dispatch({
            type: 'DISCOVER_NUCLIDE',
            payload: {
                nextNuclide,
                method: context.method,
                pz: context.pz,
                pa: context.pa,
                addedScore: context.addedScore
            }
        });
    }, []);

    /**
     * Helper to allow legacy-style updates while components migrate to specific dispatch actions.
     * Removed dependency on local gameState to avoid stale closure lags.
     */
    const setGameState = useCallback((updater: Partial<GameState> | ((prev: GameState) => Partial<GameState>)) => {
        dispatch({ type: 'UPDATE_BASIC_STATE', payload: updater });
    }, [dispatch]);

    return {
        gameState,
        setGameState, // Compatibility layer
        dispatch,     // Native dispatch path
        evolutionHistory: gameState.evolutionHistory,
        recordDiscovery
    };
};
