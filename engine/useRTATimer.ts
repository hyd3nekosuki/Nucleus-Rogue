import React, { useEffect, useRef } from 'react';
import { GameState } from '../types';

/**
 * Custom hook to manage the Real Time Attack (RTA) timer.
 * Increments the elapsed time every second while the game is active.
 * Uses performance.now() for high precision delta calculation.
 */
export const useRTATimer = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
) => {
    const lastTickRef = useRef<number>(performance.now());

    useEffect(() => {
        // Stop timer if game is over or data is being loaded
        if (gameState.gameOver || gameState.loadingData) {
            return;
        }

        // Capture the exact moment the state changed (e.g., Frozen Time activation)
        // This allows the timer to "snap" to the precise elapsed time immediately.
        const now = performance.now();
        const initialDelta = now - lastTickRef.current;
        lastTickRef.current = now;

        // Immediately update the state with the precise delta since the last tick.
        // This fulfills the requirement to show the exact 0.01s-unit time upon activation.
        setGameState(prev => {
            if (prev.gameOver || prev.loadingData) return prev;
            return { ...prev, elapsedTime: prev.elapsedTime + initialDelta };
        });

        const timer = setInterval(() => {
            const tickNow = performance.now();
            const delta = tickNow - lastTickRef.current;
            lastTickRef.current = tickNow;

            setGameState(prev => {
                // Re-check conditions inside the interval to ensure accuracy
                if (prev.gameOver || prev.loadingData) return prev;
                return { ...prev, elapsedTime: prev.elapsedTime + delta };
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [gameState.gameOver, gameState.loadingData, gameState.isTimeStopped, setGameState]);
};
