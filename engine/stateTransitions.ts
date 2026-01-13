import { GameState, GameAction, NuclideData, DecayMode, HistoryEntry } from '../types';
import { calculateNextLevel, checkBarrierReplenish, createHistoryEntry } from './atomicTransitions';

/**
 * The single source of truth for all game state transitions.
 * Ensures atomicity between Z/A changes, level advancement, barrier replenishment, and evolution history logging.
 */
export const nucleusReducer = (state: GameState, action: GameAction): GameState => {
    switch (action.type) {
        case 'DISCOVER_NUCLIDE': {
            const { nextNuclide, context } = action.payload;
            const { method, pz, pa, addedScore, chargesUsed, inducedDecayMode, isManualDecay } = context;
            
            // ATOMIC TURN INCREMENT: Every discovery/transformation advances the cosmic clock
            const nextGlobalTurn = state.turn + 1;

            // 1. Calculate Level Up
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

            // 3. Evolution History Logic
            const nuclideKey = `${nextNuclide.z}-${nextNuclide.a}`;
            const existingEntry = state.evolutionHistory[nuclideKey];
            
            let updatedHistoryEntry: HistoryEntry;
            
            if (existingEntry) {
                updatedHistoryEntry = {
                    ...existingEntry,
                    lastTurn: nextGlobalTurn,
                    method,
                    pz,
                    pa
                };
            } else {
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

            // 4. Handle Level Up message notification
            let nextMessages = state.messages;
            if (nextLevel > state.playerLevel) {
                nextMessages = [...state.messages, `✨ Mastery LV. ${nextLevel}`].slice(-10);
            }

            // 5. ATOMIC COMBO LOGIC (Strict Adherence to Definitions)
            let nextCombo = state.combo;
            let nextComboScore = (state.comboScore || 0) + addedScore;
            let nextComboOrigin = state.comboOrigin;
            let nextLastComboTime = state.lastComboTime; // DEFAULT: Maintain existing timer (Gauge continues to decrease)

            if (isManualDecay) {
                // START CASE: Combo is 0 and an unstable nuclide performs manual decay
                if (state.combo === 0 && !state.currentNuclide.isStable) {
                    // Record pre-action parent nuclide as snapshot
                    nextComboOrigin = { 
                        z: state.currentNuclide.z, 
                        a: state.currentNuclide.a,
                        isUnstable: true,
                        timestamp: Date.now()
                    };
                }
                // RECOVERY CASE: Manual decay always increments combo AND RECOVERS gauge
                nextCombo += 1;
                nextLastComboTime = Date.now();
            } else {
                // SUSTAIN CASE: Capture transformation does NOT increment combo, 
                // and DOES NOT recover the gauge (lastComboTime is not refreshed).
            }

            // STABILITY RESET: Becoming a stable nuclide forces chain termination
            if (nextNuclide.isStable) {
                nextCombo = 0;
                nextComboScore = 0;
                nextComboOrigin = undefined;
                nextLastComboTime = 0;
            }

            return {
                ...state,
                turn: nextGlobalTurn,
                currentNuclide: nextNuclide,
                evolutionHistory: nextEvolutionHistory,
                playerLevel: nextLevel,
                masteredDecays: nextMastered,
                magicBarrierCharges: nextCharges,
                combo: nextCombo,
                comboScore: nextComboScore,
                comboOrigin: nextComboOrigin,
                lastComboTime: nextLastComboTime, 
                maxCombo: Math.max(state.maxCombo, nextCombo),
                messages: nextMessages
            };
        }

        case 'UPDATE_BASIC_STATE': {
            const update = typeof action.payload === 'function' 
                ? action.payload(state) 
                : action.payload;
            
            let nextState = { ...state, ...update };

            // Forced Stability Reset (Global enforcement)
            if (nextState.currentNuclide.isStable) {
                nextState.combo = 0;
                nextState.comboScore = 0;
                nextState.comboOrigin = undefined;
                nextState.lastComboTime = 0;
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
                comboOrigin: undefined,
                lastComboTime: 0
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