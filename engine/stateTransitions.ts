import { GameState, GameAction, NuclideData, DecayMode, HistoryEntry } from '../types';
import { calculateNextLevel, checkBarrierReplenish, createHistoryEntry } from './atomicTransitions';

export interface DiscoveryContext {
    method: string;
    pz: number | null;
    pa: number | null;
    addedScore: number;
    chargesUsed: number;
    inducedDecayMode?: DecayMode;
}

/**
 * The single source of truth for all game state transitions.
 * Ensures atomicity between Z/A changes, level advancement, barrier replenishment, and evolution history logging.
 */
export const nucleusReducer = (state: GameState, action: GameAction): GameState => {
    switch (action.type) {
        case 'DISCOVER_NUCLIDE': {
            const { nextNuclide, method, pz, pa, addedScore, chargesUsed, inducedDecayMode } = action.payload;
            
            // ATOMIC TURN INCREMENT: Every discovery/transformation advances the cosmic clock
            const nextGlobalTurn = state.turn + 1;

            // 1. Calculate Level Up (Pure logic from Step 1)
            const { nextLevel, nextMastered } = calculateNextLevel(
                state.playerLevel,
                state.masteredDecays,
                inducedDecayMode || DecayMode.STABLE
            );

            // 2. Handle Magic Barrier Consumption and Replenishment
            const currentChargesAfterConsumption = Math.max(0, state.magicBarrierCharges - chargesUsed);
            const nextCharges = checkBarrierReplenish(
                nextLevel,
                nextNuclide.z,
                currentChargesAfterConsumption
            );

            // 3. Evolution History Logic (Updated for firstTurn/lastTurn)
            const nuclideKey = `${nextNuclide.z}-${nextNuclide.a}`;
            const existingEntry = state.evolutionHistory[nuclideKey];
            
            let updatedHistoryEntry: HistoryEntry;
            
            if (existingEntry) {
                // Nuclide already discovered: keep firstTurn, update lastTurn and path info
                updatedHistoryEntry = {
                    ...existingEntry,
                    lastTurn: nextGlobalTurn,
                    method,
                    pz,
                    pa
                };
            } else {
                // New discovery: set both firstTurn and lastTurn to current turn
                updatedHistoryEntry = createHistoryEntry(
                    nextNuclide,
                    method,
                    pz,
                    pa,
                    nextGlobalTurn
                );
            }

            const nextEvolutionHistory = {
                ...state.evolutionHistory,
                [nuclideKey]: updatedHistoryEntry
            };

            // 4. Handle Combo Logic for discoveries
            let nextCombo = state.combo;
            let nextComboScore = state.comboScore;
            let nextComboStartNuclide = state.comboStartNuclide;
            let nextComboStartedUnstable = state.comboStartedUnstable;

            // Initiating start detection at the transformation boundary
            if (nextCombo === 0) {
                // Record the PARENT nuclide as the start of the potential combo
                nextComboStartNuclide = { z: state.currentNuclide.z, a: state.currentNuclide.a };
                nextComboStartedUnstable = !state.currentNuclide.isStable;
                // Note: comboScore will be updated by UPDATE_BASIC_STATE via score delta
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
                turn: nextGlobalTurn, // Apply the incremented turn globally
                currentNuclide: nextNuclide,
                evolutionHistory: nextEvolutionHistory,
                playerLevel: nextLevel,
                masteredDecays: nextMastered,
                magicBarrierCharges: nextCharges,
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
                // Record the parent nuclide if it wasn't already set by DISCOVER_NUCLIDE
                if (!nextState.comboStartNuclide) {
                    nextState.comboStartNuclide = { z: state.currentNuclide.z, a: state.currentNuclide.a };
                    nextState.comboStartedUnstable = !state.currentNuclide.isStable;
                }
                // Initial score gain is part of the combo tracking
                const scoreGain = nextState.score - state.score;
                nextState.comboScore = Math.max(0, scoreGain);
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