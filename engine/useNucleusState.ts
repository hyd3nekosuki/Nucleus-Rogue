import { useReducer, useCallback } from 'react';
import { GameState, GameAction } from '../types';
import { getInitialState } from './initialState';
import { nucleusReducer } from './stateTransitions';

/**
 * Single Source of Truth hook for the raw game state and discovery history.
 * Uses a Reducer to ensure all complex state transitions are atomic.
 */
export const useNucleusState = () => {
    // Initialize integrated state
    const initialState: GameState = getInitialState();

    const [gameState, dispatch] = useReducer(nucleusReducer, initialState);

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
        evolutionHistory: gameState.evolutionHistory
    };
};