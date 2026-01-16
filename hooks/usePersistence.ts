import React, { useCallback } from 'react';
import { GameState, HistoryEntry } from '../types';
import { MAX_ENERGY, GRID_WIDTH, GRID_HEIGHT } from '../constants';
import { packBinary, unpackBinary } from '../services/serializationService';
import { getNuclideDataSync } from '../services/nuclideService';
import { generateEntities } from '../engine/moveSimulator';
import { getInitialState } from '../engine/initialState';

/**
 * Custom hook to handle game persistence (saving and loading research data).
 * Focused solely on handling compressed binary save strings.
 */
export const usePersistence = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    evolutionHistory: Record<string, HistoryEntry>, // Legacy: part of state now
    setEvolutionHistory: React.Dispatch<React.SetStateAction<Record<string, HistoryEntry>>>, // Legacy: unused
    resetVisualEvents: () => void
) => {
    /**
     * Generates a compressed research save code from current progress.
     */
    const generateSaveCode = useCallback(async () => {
        return await packBinary(gameState, gameState.evolutionHistory);
    }, [gameState]);

    /**
     * Loads research data from a compressed save code.
     * Purely handles data restoration; command-based logic has been moved to useQuantumOverride.
     */
    const loadSaveCode = useCallback(async (code: string) => {
        if (!code || code.trim().length === 0) return false;
        
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
                
                let pz: number | null = null, pa: number | null = null, method = val, firstTurn = 0, lastTurn = 0, isEngraved = false;
                if (val.includes(':')) {
                    const valParts = val.split(':');
                    pz = valParts[0] === 'null' ? null : parseInt(valParts[0]);
                    pa = isNaN(parseInt(valParts[1])) ? 0 : parseInt(valParts[1]);
                    method = valParts[2];
                    if (valParts.length >= 4) {
                        firstTurn = parseInt(valParts[3]);
                        lastTurn = valParts.length >= 5 ? parseInt(valParts[4]) : firstTurn;
                    }
                    if (valParts.length >= 6) {
                        isEngraved = valParts[5] === '1';
                    }
                }

                const data = getNuclideDataSync(z, a);
                restoredHistory[`${z}-${a}`] = { 
                    firstTurn, 
                    lastTurn,
                    name: data.name, 
                    symbol: data.symbol, 
                    z, a, method,
                    pz, pa,
                    isEngraved
                };
            });

            // Atomic update of the entire game state including history and reincarnation pool
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
                tutorialStartTurn: payload.t || 0,
                hasSeenCaptureTutorial: true, 
                hasSeenDecayTutorial: true, 
                gridEntities: generateEntities(5, [], { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) }, payload.t || 0) 
            });

            resetVisualEvents();
            return true;
        } catch (e) {
            console.error("Failed to restore game state from research data:", e);
            return false;
        }
    }, [setGameState, resetVisualEvents]);

    return { generateSaveCode, loadSaveCode };
};