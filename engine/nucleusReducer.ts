import { 
  GameState, 
  GameAction
} from '../types';
import { applyDiscoveryLogic } from './core/discoveryEngine';
import { handleUseSkill } from './handlers/skillHandler';
import { handleEngraveCurrent } from './handlers/historyHandler';
import { handleMovePlayer } from './handlers/moveHandler';
import { handleManualDecay } from './handlers/decayHandler';
import { getNextTutorialMessage, calculateTutorialFlagUpdates } from './tutorialManager';
import { buildSpatialIndex } from '../utils/gridUtils';

/**
 * Nucleus Rogue: Central State Reducer
 * Routes all atomic actions to specialized handlers while maintaining a pure state-machine architecture.
 */
export const nucleusReducer = (state: GameState, action: GameAction): GameState => {
    const nextState = (() => {
        switch (action.type) {
            case 'MOVE_PLAYER':
                return handleMovePlayer(state, action.payload);

            case 'MANUAL_DECAY':
                return handleManualDecay(state, action.payload);

            case 'USE_SKILL':
                return handleUseSkill(state, action.payload);

            case 'ENGRAVE_CURRENT':
                return handleEngraveCurrent(state, action.payload);

            case 'DISCOVER_NUCLIDE':
                return applyDiscoveryLogic(state, action.payload.nextNuclide, action.payload.context, state.turn + 1);

            case 'UPDATE_BASIC_STATE': {
                const update = typeof action.payload === 'function' ? action.payload(state) : action.payload;
                let next = { ...state, ...update };
                // Auto-reset combo tracking if a stable nuclide is reached via state update
                if (next.currentNuclide.isStable) {
                    next.combo = 0;
                    next.comboScore = 0;
                    next.comboOrigin = undefined;
                    next.lastComboTime = 0;
                }
                return next;
            }

            case 'RESET_STATE': 
                return action.payload;

            case 'SET_HP': 
                return { ...state, hp: action.payload };

            case 'RESET_VISUALS':
                return { ...state, effects: [], activeEvent: undefined, lastEvent: undefined, persistentPath: undefined };

            case 'MARK_EVENT_PLAYED':
                if (state.lastEvent && state.lastEvent.id === action.payload.eventId) {
                    return { ...state, lastEvent: { ...state.lastEvent, isPlayed: true } };
                }
                return state;

            case 'MARK_EFFECTS_PLAYED':
                return {
                    ...state,
                    effects: state.effects.map(e => 
                        action.payload.effectIds.includes(e.id) ? { ...e, isPlayed: true } : e
                    )
                };

            case 'NOTIFY_TUTORIAL_EVENT': {
                const nextMsg = getNextTutorialMessage(state, action.payload.event, {}, state.language);
                const updates = calculateTutorialFlagUpdates(state, nextMsg, state.turn, action.payload.event);
                return {
                    ...state,
                    ...updates,
                    tutorialMessage: nextMsg
                };
            }

            case 'CLEANUP_VISUALS': {
                const { effects, activeEventExpired } = action.payload;
                return { ...state, effects, activeEvent: activeEventExpired ? undefined : state.activeEvent };
            }

            case 'RECORD_ACHIEVEMENT': {
                if (state.achievementTimes[action.payload.id]) return state;
                return {
                    ...state,
                    achievementTimes: {
                        ...state.achievementTimes,
                        [action.payload.id]: action.payload.time
                    }
                };
            }

            case 'SET_LANGUAGE':
                return { ...state, language: action.payload };

            case 'TOGGLE_RADAR':
                return { ...state, showRadar: !state.showRadar };

            default: 
                return state;
        }
    })();

    // Post-processing for persistent path (Chain Reaction visualization)
    let finalState = nextState;
    const newPath = finalState.lastEvent?.chainReactionPath;
    
    if (newPath && newPath.length > 0) {
        // If a new path is generated, persist it for 3 turns
        finalState = {
            ...finalState,
            persistentPath: newPath,
            pathExpiryTurn: finalState.turn + 3
        };
    } else if (finalState.persistentPath && finalState.turn >= (finalState.pathExpiryTurn || 0)) {
        // Clear path after expiry
        finalState = {
            ...finalState,
            persistentPath: undefined
        };
    }

    // Sync spatial index if entities or effects changed
    if (finalState.gridEntities !== state.gridEntities || finalState.effects !== state.effects || !finalState.spatialIndex) {
        finalState = {
            ...finalState,
            spatialIndex: buildSpatialIndex(finalState.gridEntities, finalState.effects)
        };
    }

    return finalState;
};
