// Added React import to provide access to React namespace
import React, { useEffect } from 'react';
import { GameState } from '../types';
import { getStabilityDecayParams } from '../utils/stabilityLogic';
import { REASON } from '../constants/gameOverReason';
import { resolveStabilityCrisis } from './stabilityManager';

/**
 * Custom hook to manage the continuous HP decay based on nuclide stability.
 * Extracts logic from useNucleusEngine to separate progression from passive state changes.
 */
export const useStabilityTimer = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
) => {
    useEffect(() => {
        if (gameState.gameOver) return;

        let timer: ReturnType<typeof setInterval>;
        
        if (!gameState.currentNuclide.isStable) {
            const { decayRate, damage } = getStabilityDecayParams(gameState.currentNuclide.halfLifeSeconds);
            
            timer = setInterval(() => {
                setGameState(prev => {
                    // Safety check: Don't reduce HP if time is stopped or game is already over
                    if (prev.isTimeStopped || prev.gameOver) return prev; 

                    const newHp = Math.min(prev.maxHp, Math.max(0, prev.hp - damage));
                    
                    if (newHp === 0 && !prev.gameOver) {
                        const crisisUpdate = resolveStabilityCrisis(prev, REASON.RADIOACTIVE_DECAY);
                        return { ...prev, ...crisisUpdate };
                    }
                    
                    return { ...prev, hp: newHp };
                });
            }, decayRate);
        }

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [gameState.currentNuclide, gameState.gameOver, gameState.isTimeStopped, setGameState]);
};