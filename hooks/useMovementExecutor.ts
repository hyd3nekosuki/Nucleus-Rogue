
// Add React import to provide access to React namespace
import React, { useCallback } from 'react';
import { GameAction, SessionState } from '../types';

interface MovementExecutorDeps {
    dispatch: React.Dispatch<GameAction>;
    sessionState: SessionState;
    onStopRequest: () => void;
}

/**
 * Movement Execution Unit: Now strictly a dispatcher for the Reducer's game engine.
 */
export const useMovementExecutor = (deps: MovementExecutorDeps) => {
    const { dispatch, sessionState, onStopRequest } = deps;

    const moveStep = useCallback((dx: number, dy: number) => {
        dispatch({
            type: 'MOVE_PLAYER',
            payload: { dx, dy, elapsedTime: sessionState.elapsedTime }
        });
        
        // Stop request logic can be handled via state checking if needed, 
        // but here we maintain the interface for manual interruptions.
    }, [dispatch, sessionState.elapsedTime]);

    return { moveStep };
};
