
import React, { useCallback, useRef } from 'react';
import { GameState } from '../types';

/**
 * Custom hook to manage player movement control, including automatic pathing and interval management.
 * Extracts operational UI logic from the core game engine.
 */
export const useMoveController = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    moveStep: (dx: number, dy: number) => void,
    handlePlayerInteract: () => void
) => {
    const moveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const moveQueueRef = useRef<{ dx: number; dy: number }[]>([]);

    const stopAutoMove = useCallback(() => {
        if (moveIntervalRef.current) {
            clearInterval(moveIntervalRef.current);
            moveIntervalRef.current = null;
        }
        moveQueueRef.current = [];
        setGameState(prev => ({ ...prev, targetPos: undefined }));
    }, [setGameState]);

    const handleCellClick = useCallback((x: number, y: number) => {
        // Current position click triggers interaction (Decay)
        if (x === gameState.playerPos.x && y === gameState.playerPos.y) {
            handlePlayerInteract();
            return;
        }

        stopAutoMove();

        // Guards
        if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;

        const dx = x - gameState.playerPos.x;
        const dy = y - gameState.playerPos.y;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);

        // Immediate move for adjacent cells
        if (adx <= 1 && ady <= 1) {
            moveStep(dx, dy);
            return;
        }

        // Generate simple rectilinear path
        const path: { dx: number; dy: number }[] = [];
        for (let i = 0; i < adx; i++) path.push({ dx: dx > 0 ? 1 : -1, dy: 0 });
        for (let i = 0; i < ady; i++) path.push({ dx: 0, dy: dy > 0 ? 1 : -1 });

        if (path.length > 0) {
            moveQueueRef.current = path;
            setGameState(prev => ({ ...prev, targetPos: { x, y } }));
            
            if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
            moveIntervalRef.current = setInterval(() => {
                if (moveQueueRef.current.length > 0) {
                    const step = moveQueueRef.current.shift();
                    if (step) moveStep(step.dx, step.dy);
                } else {
                    stopAutoMove();
                }
            }, 100);
        }
    }, [
        gameState.playerPos,
        gameState.gameOver,
        gameState.loadingData,
        gameState.isTimeStopped,
        handlePlayerInteract,
        stopAutoMove,
        setGameState,
        moveStep
    ]);

    return {
        handleCellClick,
        stopAutoMove
    };
};
