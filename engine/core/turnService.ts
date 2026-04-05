import { GameState } from '../../types';
import { processRandomBackgroundEvents } from '../randomEvents';
import { handleAnotherNuclideCollision } from './collisionService';

/**
 * Core Service: Finalizes a turn by processing background world events.
 * This includes AI movement, entity spawning, and resolving any 
 * resulting collisions (Assaults) at the end of the step.
 * 
 * Used by all action handlers (Move, Decay, and soon Skills) to maintain consistency.
 */
export const finalizeAction = (state: GameState): GameState => {
    // Safety Guard: If the action resulted in a Game Over (e.g. fatal capture or decay failure),
    // we stop the world immediately. No background events or further collisions.
    if (state.gameOver) return state;

    // 1. Process all world phenomena: Movement of anti-nuclides/another nuclides, spawning, etc.
    const bgResult = processRandomBackgroundEvents(state);
    
    // 2. Destructure result to separate pure state updates from transient flags (assaultingEntity)
    const { assaultingEntity, lastEvent: bgLastEvent, ...stateUpdates } = bgResult;
    
    // 3. Create the intermediate state after world updates
    let nextState: GameState = { ...state, ...stateUpdates };

    // 4. Merge lastEvent if background event is important (like a struggle)
    if (bgLastEvent) {
        if (!nextState.lastEvent || nextState.lastEvent.isPlayed) {
            nextState.lastEvent = bgLastEvent;
        } else if (bgLastEvent.subType === 'MATTER_STRUGGLE') {
            // Combat takes high priority for feedback, merge with existing messages
            nextState.lastEvent = {
                ...bgLastEvent,
                priorityMessages: [
                    ...(nextState.lastEvent.priorityMessages || []),
                    ...(bgLastEvent.priorityMessages || [])
                ],
                ttsPriorityMessages: [
                    ...(nextState.lastEvent.ttsPriorityMessages || []),
                    ...(bgLastEvent.ttsPriorityMessages || [])
                ]
            };
        }
    }
    
    // 5. Collision Resolution: In Hard Mode, if an enemy moved onto the player position,
    // we must trigger the collision logic immediately as an "assault".
    if (assaultingEntity) {
        // Fix: Pass nextState.turn as the fourth argument required by handleAnotherNuclideCollision
        nextState = handleAnotherNuclideCollision(nextState, assaultingEntity, nextState.playerPos, nextState.turn);
    }
    
    return nextState;
};