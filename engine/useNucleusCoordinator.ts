import { useEffect, useCallback, useRef } from 'react';
import { INITIAL_NUCLIDE, HISTORY_METHODS } from '../constants';
import { generateEntities } from './gameLogic';
import { useNucleusState } from './useNucleusState';
import { useStabilityTimer } from './useStabilityTimer';
import { useComboTimer } from './useComboTimer';
import { useVisualCleanup } from '../hooks/useVisualCleanup';
import { useMoveController } from '../hooks/useMoveController';
import { usePersistence } from '../hooks/usePersistence';
import { useVisualEffects } from '../hooks/useVisualEffects';
import { useSkillController } from '../hooks/useSkillController';
import { useDecayController } from '../hooks/useDecayController';
import { useMovementExecutor } from '../hooks/useMovementExecutor';
import { useAtomicDispatcher } from '../hooks/useAtomicDispatcher';

export const useNucleusCoordinator = () => {
    const { gameState, setGameState, dispatch } = useNucleusState();
    const { dispatchDiscovery } = useAtomicDispatcher(dispatch);

    // Pass gameState to useVisualEffects to enable the Effect Bridge
    const {
        isScreenShaking, isFlashBang, flashColor, lastDecayEvent, finalCombo,
        triggerShake, triggerFlash, 
        setLastDecayEvent, setFinalCombo, resetVisuals
    } = useVisualEffects(gameState);

    useStabilityTimer(gameState, setGameState);
    useComboTimer(gameState, setGameState, setFinalCombo);
    useVisualCleanup(gameState, setGameState);

    const stopAutoMoveRef = useRef<() => void>(() => {});

    const { moveStep } = useMovementExecutor({
        dispatch,
        onStopRequest: () => stopAutoMoveRef.current()
    });

    const { 
        handleDecayAction, handlePlayerInteract 
    } = useDecayController(
        gameState, dispatch, 
        () => stopAutoMoveRef.current()
    );

    const { handleCellClick, stopAutoMove } = useMoveController(
        gameState,
        setGameState,
        moveStep,
        handlePlayerInteract
    );

    useEffect(() => {
        stopAutoMoveRef.current = stopAutoMove;
    }, [stopAutoMove]);

    const {
        handleStabilize, handleUltimateSynthesis, handleToggleTimeStop,
        handleTransmute, handleToggleHiddenSkill, restartGame, handleForceUnknownDecay
    } = useSkillController(
        gameState, dispatch, 
        stopAutoMove, handleDecayAction, resetVisuals
    );

    const { generateSaveCode, loadSaveCode } = usePersistence(
        gameState,
        setGameState,
        gameState.evolutionHistory,
        () => {}, 
        resetVisuals
    );

    useEffect(() => {
        const initialEntities = generateEntities(5, [], gameState.playerPos, 0);
        dispatch({
            type: 'RESET_STATE',
            payload: {
                ...gameState,
                gridEntities: initialEntities,
                evolutionHistory: {
                    [`${INITIAL_NUCLIDE.z}-${INITIAL_NUCLIDE.a}`]: {
                        firstTurn: 0, lastTurn: 0, name: INITIAL_NUCLIDE.name, symbol: INITIAL_NUCLIDE.symbol, z: INITIAL_NUCLIDE.z, a: INITIAL_NUCLIDE.a, method: HISTORY_METHODS.ORIGIN, pz: null, pa: null
                    }
                }
            }
        });
    }, []);

    const setHP = useCallback((val: number) => dispatch({ type: 'SET_HP', payload: val }), []);

    return {
        gameState, evolutionHistory: gameState.evolutionHistory, isScreenShaking, isFlashBang, flashColor, lastDecayEvent, finalCombo,
        triggerShake, triggerFlash, moveStep, handleStabilize, handleDecayAction, handlePlayerInteract, handleToggleTimeStop,
        handleTransmute, handleToggleHiddenSkill, restartGame, handleCellClick, stopAutoMove,
        handleUltimateSynthesis, handleForceUnknownDecay, setHP, generateSaveCode, loadSaveCode
    };
};
