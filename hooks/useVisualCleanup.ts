
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
    // Immediate cleanup on mount to prevent old effects from replaying
    useEffect(() => {
        const now = Date.now();
        const hasStaleEffects = gameState.effects.some(e => now - e.timestamp >= 1000);
        const isEventExpired = gameState.activeEvent && (now - gameState.activeEvent.timestamp >= 1000);

        if (hasStaleEffects || isEventExpired) {
            setGameState(prev => {
                const currentTime = Date.now();
                const remainingEffects = prev.effects.filter(e => currentTime - e.timestamp < 1000);
                const eventStillActive = prev.activeEvent && (currentTime - prev.activeEvent.timestamp < 1000);
                
                if (remainingEffects.length === prev.effects.length && (!!eventStillActive === !!prev.activeEvent)) {
                    return prev;
                }
                
                return {
                    ...prev,
                    effects: remainingEffects,
                    activeEvent: eventStillActive ? prev.activeEvent : undefined
                };
            });
        }
    }, []); // Run once on mount

    useEffect(() => {
        // Guard: If time is stopped, or nothing to clean up, do nothing
        if (gameState.isTimeStopped || (gameState.effects.length === 0 && !gameState.activeEvent)) return;

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
    }, [gameState.isTimeStopped, gameState.effects, gameState.activeEvent, setGameState]);
};
