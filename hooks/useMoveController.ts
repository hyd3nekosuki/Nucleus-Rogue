
import React, { useCallback, useRef } from 'react';
import { GameState } from '../types';

/**
 * Movement Control Unit: Responsible for managing user intent and automatic pathing.
 * It translates clicks/destination marks into a sequence of calls to the execution unit.
 */
export const useMoveController = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    moveStep: (dx: number, dy: number) => void,
    handlePlayerInteract: () => void
) => {
    const moveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const moveQueueRef = useRef<{ dx: number; dy: number }[]>([]);

    /**
     * Terminate any ongoing automatic movement immediately.
     */
    const stopAutoMove = useCallback(() => {
        if (moveIntervalRef.current) {
            clearInterval(moveIntervalRef.current);
            moveIntervalRef.current = null;
        }
        moveQueueRef.current = [];
        setGameState(prev => {
            // Only update if targetPos actually needs clearing to avoid unnecessary renders
            if (prev.targetPos === undefined) return prev;
            return { ...prev, targetPos: undefined };
        });
    }, [setGameState]);

    /**
     * Handle user interaction with grid cells (Movement or In-place Interaction).
     */
    const handleCellClick = useCallback((x: number, y: number) => {
        // Condition: Clicking on the current player position triggers interaction (Decay/Decapsulation)
        if (x === gameState.playerPos.x && y === gameState.playerPos.y) {
            handlePlayerInteract();
            return;
        }

        // Clean up previous intentions
        stopAutoMove();

        // Safety Guards: Prevent movement during critical states
        if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;

        const dx = x - gameState.playerPos.x;
        const dy = y - gameState.playerPos.y;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);

        // Scenario A: Direct move to an adjacent cell (including diagonals)
        if (adx <= 1 && ady <= 1) {
            moveStep(dx, dy);
            return;
        }

        // Scenario B: Long-distance movement (Automatic Pathing)
        // We generate a simple rectilinear path for predictability
        const path: { dx: number; dy: number }[] = [];
        // Move horizontally first
        for (let i = 0; i < adx; i++) path.push({ dx: dx > 0 ? 1 : -1, dy: 0 });
        // Then move vertically
        for (let i = 0; i < ady; i++) path.push({ dx: 0, dy: dy > 0 ? 1 : -1 });

        if (path.length > 0) {
            moveQueueRef.current = path;
            setGameState(prev => ({ ...prev, targetPos: { x, y } }));
            
            // Initialize automated movement interval
            if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
            moveIntervalRef.current = setInterval(() => {
                if (moveQueueRef.current.length > 0) {
                    const step = moveQueueRef.current.shift();
                    if (step) {
                        moveStep(step.dx, step.dy);
                    }
                } else {
                    stopAutoMove();
                }
            }, 100); // 100ms per atomic step for smooth visual tracking
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
