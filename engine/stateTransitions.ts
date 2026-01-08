
import { GameState, GameAction, NuclideData, HistoryEntry } from '../types';
import { getNuclideDataSync } from '../services/nuclideService';

export interface DiscoveryContext {
    method: string;
    pz: number | null;
    pa: number | null;
    addedScore: number;
}

/**
 * The single source of truth for all game state transitions.
 * Ensures atomicity between Z/A changes and evolution history logging.
 */
export const nucleusReducer = (state: GameState, action: GameAction): GameState => {
    switch (action.type) {
        case 'DISCOVER_NUCLIDE': {
            const { nextNuclide, method, pz, pa, addedScore } = action.payload;
            
            // 1. Create history entry
            const newHistoryEntry: HistoryEntry = {
                turn: state.turn,
                name: nextNuclide.name,
                symbol: nextNuclide.symbol,
                z: nextNuclide.z,
                a: nextNuclide.a,
                method: method,
                pz: pz,
                pa: pa
            };

            const nextEvolutionHistory = {
                ...state.evolutionHistory,
                [`${nextNuclide.z}-${nextNuclide.a}`]: newHistoryEntry
            };

            // 2. Handle Combo Logic for discoveries
            let nextCombo = state.combo;
            let nextComboScore = state.comboScore;
            let nextComboStartNuclide = state.comboStartNuclide;
            let nextComboStartedUnstable = state.comboStartedUnstable;

            // If we are currently in a combo, add the score from this discovery
            if (nextCombo > 0) {
                nextComboScore += addedScore;
            }

            // Stability check: Forced reset of CHAIN metadata
            if (nextNuclide.isStable) {
                nextCombo = 0;
                nextComboScore = 0;
                nextComboStartNuclide = undefined;
                nextComboStartedUnstable = false;
            }

            return {
                ...state,
                currentNuclide: nextNuclide,
                evolutionHistory: nextEvolutionHistory,
                combo: nextCombo,
                comboScore: nextComboScore,
                comboStartNuclide: nextComboStartNuclide,
                comboStartedUnstable: nextComboStartedUnstable
            };
        }

        case 'UPDATE_BASIC_STATE': {
            const update = typeof action.payload === 'function' 
                ? action.payload(state) 
                : action.payload;
            
            let nextState = { ...state, ...update };

            // ENSURE COMBO METADATA IS UPDATED ATOMICALLY
            // A. Start Detection: combo goes from 0 -> 1 (or more)
            if (state.combo === 0 && nextState.combo > 0) {
                // Record the nucleus WE WERE AT before this change started the combo
                nextState.comboStartNuclide = { z: state.currentNuclide.z, a: state.currentNuclide.a };
                nextState.comboStartedUnstable = !state.currentNuclide.isStable;
                // Initial score gain is part of the combo tracking
                nextState.comboScore = Math.max(0, nextState.score - state.score);
            } 
            // B. Score Accumulation: already in a combo, track additional points gained
            else if (nextState.combo > 0) {
                const scoreGain = nextState.score - state.score;
                if (scoreGain > 0) {
                    nextState.comboScore = (state.comboScore || 0) + scoreGain;
                }
            }

            // C. Forced Stability Reset (Global enforcement)
            if (nextState.currentNuclide.isStable) {
                nextState.combo = 0;
                nextState.comboScore = 0;
                nextState.comboStartNuclide = undefined;
                nextState.comboStartedUnstable = false;
            }

            return nextState;
        }

        case 'APPLY_STABILITY_DECAY':
            return { ...state, ...action.payload };

        case 'END_COMBO': {
            const { scoreBonus, unlockedGroups, messages } = action.payload;
            return {
                ...state,
                score: state.score + scoreBonus,
                unlockedGroups,
                messages: [...state.messages, ...messages].slice(-10),
                combo: 0,
                comboScore: 0,
                comboStartNuclide: undefined,
                comboStartedUnstable: false
            };
        }

        case 'CLEANUP_VISUALS': {
            const { effects, activeEventExpired } = action.payload;
            return {
                ...state,
                effects,
                activeEvent: activeEventExpired ? undefined : state.activeEvent
            };
        }

        case 'SET_HP':
            return { ...state, hp: action.payload };

        case 'RESET_STATE':
            return action.payload;

        default:
            return state;
    }
};

/**
 * Compatibility helper for discovery transitions.
 * Wraps the reducer logic for callers that haven't moved to dispatch yet.
 */
export const handleDiscoveryTransition = (
    prev: GameState,
    nextNuclide: NuclideData,
    context: DiscoveryContext
): { 
    nextState: GameState, 
    newHistoryEntry: HistoryEntry 
} => {
    const result = nucleusReducer(prev, { 
        type: 'DISCOVER_NUCLIDE', 
        payload: { nextNuclide, ...context } 
    });
    return { 
        nextState: result, 
        newHistoryEntry: result.evolutionHistory[`${nextNuclide.z}-${nextNuclide.a}`] 
    };
};
