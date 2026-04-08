import { useReducer, useCallback, useState } from 'react';
import { GameState, GameAction, SessionState } from '../types';
import { getInitialState } from './initialState';
import { nucleusReducer } from './nucleusReducer';

/**
 * Single Source of Truth: Integrated Nucleus State Management.
 * Uses a Reducer to ensure all complex atomic state transitions are consistent and pure.
 */
export const useNucleusState = () => {
    // 1. Initialize State Container
    const initialState: GameState = getInitialState();

    // 2. State Machine Activation
    const [gameState, dispatch] = useReducer(nucleusReducer, initialState);

    // 3. Session State (High-frequency updates)
    const [sessionState, setSessionState] = useState<SessionState>({
        elapsedTime: 0,
        isScreenShaking: false,
        shakeIntensity: 'normal',
        isFlashBang: false,
        flashColor: 'bg-neon-blue'
    });

    /**
     * State Update Proxy: Maintains backward compatibility for legacy hooks
     * during the migration to a fully Dispatch-based architecture.
     * 
     * Routing updates through 'UPDATE_BASIC_STATE' ensures that even legacy
     * partial updates respect the Reducer's centralized logic (like combo resets).
     */
    const setGameState = useCallback((updater: Partial<GameState> | ((prev: GameState) => Partial<GameState>)) => {
        dispatch({ type: 'UPDATE_BASIC_STATE', payload: updater });
    }, [dispatch]);

    return {
        gameState,
        setGameState, 
        sessionState,
        setSessionState,
        dispatch,     
        evolutionHistory: gameState.evolutionHistory
    };
};
