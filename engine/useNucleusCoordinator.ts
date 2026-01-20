import { useEffect, useCallback, useRef } from 'react';
import { INITIAL_NUCLIDE, HISTORY_METHODS } from '../constants';
import { generateEntities } from './moveSimulator';
import { useNucleusState } from './useNucleusState';
import { useStabilityTimer } from './useStabilityTimer';
import { useComboTimer } from './useComboTimer';
import { useVisualCleanup } from '../hooks/useVisualCleanup';
import { useMoveController } from '../hooks/useMoveController';
import { usePersistence } from '../hooks/usePersistence';
import { useQuantumOverride } from '../hooks/useQuantumOverride';
import { useVisualEffects } from '../hooks/useVisualEffects';
import { useNucleusActions } from '../hooks/useNucleusActions';
import { useDecayController } from '../hooks/useDecayController';
import { useMovementExecutor } from '../hooks/useMovementExecutor';

/**
 * Nucleus Rogue Switchboard: Orchestrates all atomic interactions.
 * This coordinator provides a clean Facade for the App UI to interact with the underlying
 * state-machine (nucleusReducer) and specialized physics simulation logic.
 */
export const useNucleusCoordinator = () => {
    // 1. Core Integrated State & Reducer Dispatch
    const { gameState, setGameState, dispatch } = useNucleusState();

    // 2. Transient Visual State Management (Shakes, Flashes, TTS Trigger)
    const {
        isScreenShaking, isFlashBang, flashColor, lastDecayEvent, finalCombo,
        triggerShake, triggerFlash, setFinalCombo, resetVisuals
    } = useVisualEffects(gameState);

    // 3. Periodic Life-Cycle Timers (Stability Decay, Combo Expiration, Janitorial Cleanup)
    useStabilityTimer(gameState, setGameState);
    useComboTimer(gameState, setGameState, setFinalCombo);
    useVisualCleanup(gameState, setGameState);

    // 4. Movement & Interaction Control Units
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

    // Bridge the internal stopAutoMove to external handlers via Ref
    useEffect(() => {
        stopAutoMoveRef.current = stopAutoMove;
    }, [stopAutoMove]);

    // 5. User-Initiated Actions & Session Management
    const {
        handleStabilize, handleUltimateSynthesis, handleToggleTimeStop,
        handleTransmute, handleToggleHiddenSkill, restartGame, handleForceUnknownDecay,
        handleEngraveCurrent
    } = useNucleusActions(
        gameState, dispatch, 
        stopAutoMove, handleDecayAction, resetVisuals
    );

    // 6. Persistence & Advanced Mastery Features (Level 6 Cite Research)
    const { generateSaveCode, loadSaveCode: rawLoadSaveCode } = usePersistence(
        gameState,
        setGameState,
        gameState.evolutionHistory,
        () => {}, // setEvolutionHistory (Legacy - integrated in state)
        resetVisuals
    );

    const { executeQuantumOverride } = useQuantumOverride(
        gameState,
        dispatch,
        resetVisuals
    );

    /**
     * Unified Load Handler: Routes codes to either Quantum Override (Mastery level 6)
     * or standard binary research persistence.
     */
    const handleLoad = useCallback(async (code: string) => {
        const isQuantumSuccess = executeQuantumOverride(code);
        if (isQuantumSuccess) return true;
        return await rawLoadSaveCode(code);
    }, [executeQuantumOverride, rawLoadSaveCode]);

    // 7. Initial Nucleogenesis
    useEffect(() => {
        const initialEntities = generateEntities(5, [], gameState.playerPos, 0);
        dispatch({
            type: 'RESET_STATE',
            payload: {
                ...gameState,
                gridEntities: initialEntities,
                evolutionHistory: {
                    [`${INITIAL_NUCLIDE.z}-${INITIAL_NUCLIDE.a}`]: {
                        firstTurn: 0, lastTurn: 0, name: INITIAL_NUCLIDE.name, symbol: INITIAL_NUCLIDE.symbol, 
                        z: INITIAL_NUCLIDE.z, a: INITIAL_NUCLIDE.a, method: HISTORY_METHODS.ORIGIN, 
                        pz: null, pa: null
                    }
                }
            }
        });
    }, []);

    // Helper for manual HP adjustments (Sound Test)
    const setHP = useCallback((val: number) => dispatch({ type: 'SET_HP', payload: val }), [dispatch]);

    return {
        // Raw Data
        gameState, 
        evolutionHistory: gameState.evolutionHistory,
        
        // Visual Status
        isScreenShaking, isFlashBang, flashColor, lastDecayEvent, finalCombo,
        
        // Visual Triggers
        triggerShake, triggerFlash, 
        
        // Nucleus Interaction Facade
        moveStep, 
        handleCellClick, 
        stopAutoMove,
        handleDecayAction, 
        handlePlayerInteract, 
        handleEngraveCurrent,
        
        // Advanced Mastery Skills
        handleStabilize, 
        handleUltimateSynthesis, 
        handleToggleTimeStop,
        handleTransmute, 
        handleToggleHiddenSkill, 
        handleForceUnknownDecay,
        
        // System & Persistence
        restartGame, 
        setHP, 
        generateSaveCode, 
        handleLoad
    };
};