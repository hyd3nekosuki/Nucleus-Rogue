
// Add React import to provide access to React namespace
import React, { useCallback } from 'react';
import { GameAction } from '../types';

interface MovementExecutorDeps {
    dispatch: React.Dispatch<GameAction>;
    onStopRequest: () => void;
}

/**
 * Movement Execution Unit: Now strictly a dispatcher for the Reducer's game engine.
 */
export const useMovementExecutor = (deps: MovementExecutorDeps) => {
    const { dispatch, onStopRequest } = deps;

    const moveStep = useCallback((dx: number, dy: number) => {
        dispatch({
            type: 'MOVE_PLAYER',
            payload: { dx, dy }
        });
        
        // Stop request logic can be handled via state checking if needed, 
        // but here we maintain the interface for manual interruptions.
    }, [dispatch]);

    return { moveStep };
};
