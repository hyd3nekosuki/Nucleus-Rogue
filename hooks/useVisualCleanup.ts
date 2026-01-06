// Added React import to provide access to React namespace
import React, { useEffect } from 'react';
import { GameState } from '../types';

/**
 * Custom hook to manage the cleanup of temporary visual effects and events.
 * Extracts the "janitorial" logic from useNucleusEngine to maintain focus on game rules.
 */
export const useVisualCleanup = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
    useEffect(() => {
        // Guard: If nothing to clean up, do nothing
        if (gameState.effects.length === 0 && !gameState.activeEvent) return;

        const timer = setTimeout(() => {
            setGameState(prev => {
                const now = Date.now();
                
                // Filter effects older than 1 second
                const remainingEffects = prev.effects.filter(e => now - e.timestamp < 1000);
                
                // Check if the background active event has expired
                const eventStillActive = prev.activeEvent && (now - prev.activeEvent.timestamp < 1000);

                // Optimization: Skip state update if no changes are needed
                if (remainingEffects.length === prev.effects.length && 
                    (!!eventStillActive === !!prev.activeEvent)) {
                    return prev;
                }

                return { 
                    ...prev, 
                    effects: remainingEffects, 
                    activeEvent: eventStillActive ? prev.activeEvent : undefined 
                };
            });
        }, 500);

        return () => clearTimeout(timer);
    }, [gameState.effects, gameState.activeEvent, setGameState]);
};