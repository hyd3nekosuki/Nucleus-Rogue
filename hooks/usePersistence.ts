
import React, { useCallback } from 'react';
import { GameState, HistoryEntry } from '../types';
import { MAX_ENERGY, GRID_WIDTH, GRID_HEIGHT, HISTORY_METHODS } from '../constants';
import { packBinary, unpackBinary } from '../services/serializationService';
import { getNuclideDataSync } from '../services/nuclideService';
import { generateEntities } from '../engine/gameLogic';
import { getInitialState } from '../engine/initialState';
import { parseNuclideCommand, solveParticleRequirements } from '../engine/particleEngine';

/**
 * Custom hook to handle game persistence (saving and loading data).
 * Now sources history directly from the integrated GameState.
 * Added: Controlled Transmutation (Cheat) support for Level 6.
 */
export const usePersistence = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    evolutionHistory: Record<string, HistoryEntry>, // Passed for internal use, though now part of state
    setEvolutionHistory: React.Dispatch<React.SetStateAction<Record<string, HistoryEntry>>>, // Legacy unused
    resetVisualEvents: () => void
) => {
    const generateSaveCode = useCallback(async () => {
        // evolutionHistory is now guaranteed to be in sync with gameState
        return await packBinary(gameState, gameState.evolutionHistory);
    }, [gameState]);

    const loadSaveCode = useCallback(async (code: string) => {
        if (!code || code.trim().length === 0) return false;
        
        // --- Mastery Level 6 Cheat Logic (Step 1 & 2 Implementation) ---
        if (gameState.playerLevel >= 6) {
            const commandCoords = parseNuclideCommand(code);
            if (commandCoords) {
                const requirements = solveParticleRequirements(
                    gameState.currentNuclide.z,
                    gameState.currentNuclide.a,
                    commandCoords.z,
                    commandCoords.a,
                    gameState.gridEntities
                );

                if (requirements) {
                    const targetData = getNuclideDataSync(commandCoords.z, commandCoords.a);
                    const nextTurn = gameState.turn + 1;
                    
                    const existing = gameState.evolutionHistory[`${targetData.z}-${targetData.a}`];
                    const newEntry: HistoryEntry = {
                        firstTurn: existing ? existing.firstTurn : nextTurn,
                        lastTurn: nextTurn,
                        name: targetData.name,
                        symbol: targetData.symbol,
                        z: targetData.z,
                        a: targetData.a,
                        method: "Quantum Override Transmutation",
                        pz: gameState.currentNuclide.z,
                        pa: gameState.currentNuclide.a
                    };

                    setGameState(prev => ({
                        ...prev,
                        currentNuclide: targetData,
                        turn: nextTurn,
                        gridEntities: prev.gridEntities.filter(e => !requirements.idsToConsume.includes(e.id)),
                        evolutionHistory: {
                            ...prev.evolutionHistory,
                            [`${targetData.z}-${targetData.a}`]: newEntry
                        },
                        messages: [...prev.messages, `🌌 SYSTEM OVERRIDE: Reachable configuration established for ${targetData.name}!`].slice(-10),
                        energyPoints: 0 // Reset energy as a reaction to high-dimensional interference
                    }));
                    
                    resetVisualEvents();
                    return true;
                }
            }
        }

        // --- Standard Save Data Loading Logic ---
        const payload = await unpackBinary(code);
        if (!payload) return false;

        try {
            const currentData = getNuclideDataSync(payload.cz!, payload.ca!);
            
            const restoredHistory: Record<string, HistoryEntry> = {};
            Object.entries(payload.ev || {}).forEach(([key, val]) => {
                const parts = key.split('-');
                let z, a;
                if (parts.length === 4) {
                    z = parseInt(parts[2]);
                    a = parseInt(parts[3]);
                } else {
                    z = parseInt(parts[0]);
                    a = parseInt(parts[1]);
                }
                
                let pz: number | null = null, pa: number | null = null, method = val, firstTurn = 0, lastTurn = 0;
                if (val.includes(':')) {
                    const valParts = val.split(':');
                    pz = valParts[0] === 'null' ? null : parseInt(valParts[0]);
                    pa = isNaN(parseInt(valParts[1])) ? 0 : parseInt(valParts[1]);
                    method = valParts[2];
                    if (valParts.length >= 4) {
                        firstTurn = parseInt(valParts[3]);
                        lastTurn = valParts.length >= 5 ? parseInt(valParts[4]) : firstTurn;
                    }
                }

                const data = getNuclideDataSync(z, a);
                restoredHistory[`${z}-${a}`] = { 
                    firstTurn, 
                    lastTurn,
                    name: data.name, 
                    symbol: data.symbol, 
                    z, a, method,
                    pz, pa
                };
            });

            // Atomic update of the entire game state including history and pool
            setGameState({ 
                ...getInitialState(), 
                score: payload.s!, 
                energyPoints: Math.min(MAX_ENERGY, payload.e!), 
                hp: payload.h!, 
                playerLevel: payload.l!, 
                reincarnations: payload.r!, 
                turn: payload.t || 0, 
                maxCombo: payload.mc || 0, 
                magicBarrierCharges: payload.mb || 0, 
                reincarnationPool: {
                    p: payload.pp || 0,
                    n: payload.pn || 0,
                    e: payload.pe || 0
                },
                currentNuclide: currentData, 
                evolutionHistory: restoredHistory,
                unlockedElements: payload.ue || [], 
                unlockedGroups: payload.ug || [], 
                disabledSkills: payload.ds || [], 
                masteredDecays: payload.md || [], 
                decayStats: payload.st || getInitialState().decayStats, 
                reactionStats: payload.rs || getInitialState().reactionStats, 
                messages: ["Previous research is cited."], 
                tutorialMessage: null, 
                hasSeenCaptureTutorial: true, 
                hasSeenDecayTutorial: true, 
                gridEntities: generateEntities(5, [], { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) }, payload.t || 0) 
            });

            resetVisualEvents();
            return true;
        } catch (e) {
            console.error("Failed to restore game state from code:", e);
            return false;
        }
    }, [setGameState, resetVisualEvents, gameState.playerLevel, gameState.currentNuclide, gameState.gridEntities, gameState.turn]);

    return { generateSaveCode, loadSaveCode };
};
