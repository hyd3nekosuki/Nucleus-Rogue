import React, { useCallback } from 'react';
import { GameState, HistoryEntry } from '../types';
import { MAX_ENERGY, GRID_WIDTH, GRID_HEIGHT, HISTORY_METHODS } from '../constants';
import { packBinary, unpackBinary } from '../services/serializationService';
import { getNuclideDataSync } from '../services/nuclideService';
import { generateEntities } from '../engine/gameLogic';
import { getInitialState } from '../engine/initialState';

/**
 * Custom hook to handle game persistence (saving and loading data).
 * Now sources history directly from the integrated GameState.
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
                
                let pz: number | null = null, pa: number | null = null, method = val, turn = 0;
                if (val.includes(':')) {
                    const valParts = val.split(':');
                    pz = isNaN(parseInt(valParts[0])) ? null : parseInt(valParts[0]);
                    pa = isNaN(parseInt(valParts[1])) ? null : parseInt(valParts[1]);
                    method = valParts[2];
                    if (valParts.length >= 4) {
                        turn = parseInt(valParts[3]);
                    }
                }

                const data = getNuclideDataSync(z, a);
                restoredHistory[`${z}-${a}`] = { 
                    turn: turn, 
                    name: data.name, 
                    symbol: data.symbol, 
                    z, a, method,
                    pz, pa
                };
            });

            // Atomic update of the entire game state including history
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
    }, [setGameState, resetVisualEvents]);

    return { generateSaveCode, loadSaveCode };
};