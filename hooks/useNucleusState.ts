
import { useState } from 'react';
import { GameState, HistoryEntry } from '../types';
import { getInitialState } from '../utils/initialState';

/**
 * Single Source of Truth hook for the raw game state and discovery history.
 */
export const useNucleusState = () => {
    const [gameState, setGameState] = useState<GameState>(getInitialState());
    const [evolutionHistory, setEvolutionHistory] = useState<Record<string, HistoryEntry>>({});

    return {
        gameState,
        setGameState,
        evolutionHistory,
        setEvolutionHistory
    };
};
