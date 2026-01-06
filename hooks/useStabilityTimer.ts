// Added React import to provide access to React namespace
import React, { useEffect } from 'react';
import { GameState, DecayMode } from '../types';
import { getStabilityDecayParams } from '../utils/stabilityLogic';

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
                        // Temporal Inversion (Auto-Stabilization) Check
                        if (prev.unlockedGroups.includes("Temporal Inversion") && 
                            !prev.disabledSkills.includes("Temporal Inversion") && 
                            prev.energyPoints >= 5) {
                            
                            return { 
                                ...prev, 
                                hp: prev.maxHp, 
                                energyPoints: Math.max(0, prev.energyPoints - 5), 
                                messages: [...prev.messages, "⏱ AUTO-STABILIZATION: Temporal Inversion triggered!"].slice(-10),
                                effects: [...prev.effects, { 
                                    id: Math.random().toString(36).substr(2, 9), 
                                    type: DecayMode.STABILIZE_ZAP, 
                                    position: { ...prev.playerPos }, 
                                    timestamp: Date.now() 
                                }]
                            };
                        }
                        
                        // Normal Death
                        return { 
                            ...prev, 
                            hp: 0, 
                            energyPoints: 0, 
                            gameOver: true, 
                            gameOverReason: "CRITICAL_DECAY", 
                            combo: 0, 
                            comboScore: 0, 
                            comboStartNuclide: undefined 
                        };
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