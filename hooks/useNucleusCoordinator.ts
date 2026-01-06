
import { useEffect, useCallback } from 'react';
import { DecayMode } from '../types';
import { INITIAL_NUCLIDE, HISTORY_METHODS } from '../constants';
import { generateEntities } from '../utils/gameLogic';
import { useNucleusState } from './useNucleusState';
import { useStabilityTimer } from './useStabilityTimer';
import { useComboTimer } from './useComboTimer';
import { useVisualCleanup } from './useVisualCleanup';
import { useMoveController } from './useMoveController';
import { usePersistence } from './usePersistence';
import { useVisualEffects } from './useVisualEffects';
import { useSkillController } from './useSkillController';
import { useDecayController } from './useDecayController';
import { useMovementExecutor } from './useMovementExecutor';

/**
 * Central orchestrator for the Nucleus Rogue game engine.
 * Manages the connection between state, execution, input control, and visual feedback.
 */
export const useNucleusCoordinator = (triggerTTS: (text: string) => void) => {
    // 1. Raw State
    const { gameState, setGameState, evolutionHistory, setEvolutionHistory } = useNucleusState();

    // 2. Visual Feedback States
    const {
        isScreenShaking, isFlashBang, flashColor, lastDecayEvent, finalCombo,
        triggerShake, triggerFlash, setLastDecayEvent, setFinalCombo, resetVisuals
    } = useVisualEffects();

    // 3. Automated Passive Logic (Timers & Cleanup)
    useStabilityTimer(gameState, setGameState);
    useComboTimer(gameState, setGameState, setFinalCombo);
    useVisualCleanup(gameState, setGameState);

    // 4. Movement Execution Logic
    // We define this separately so moveStep can be passed to the controller
    const { moveStep } = useMovementExecutor({
        setGameState, 
        setEvolutionHistory, 
        triggerTTS,
        triggerShake, 
        triggerFlash, 
        setLastDecayEvent, 
        setFinalCombo,
        // stopAutoMove is wired later via the controller, so we use a functional ref or simple stop dispatch here
        onStopRequest: () => setGameState(prev => ({ ...prev, targetPos: undefined }))
    });

    // 5. Interaction Logic (Manual Decay)
    const { 
        handleDecayAction, handlePlayerInteract 
    } = useDecayController(
        gameState, setGameState, setEvolutionHistory, triggerTTS, 
        triggerShake, triggerFlash, setLastDecayEvent, setFinalCombo, 
        () => setGameState(prev => ({ ...prev, targetPos: undefined }))
    );

    // 6. User Input Control Logic (Movement & Pathing)
    const { handleCellClick, stopAutoMove } = useMoveController(
        gameState,
        setGameState,
        moveStep,
        handlePlayerInteract
    );

    // 7. High-Level Skill Control
    const {
        handleStabilize, handleUltimateSynthesis, handleToggleTimeStop,
        handleTransmute, handleToggleHiddenSkill, restartGame, handleForceUnknownDecay
    } = useSkillController(
        gameState, setGameState, setEvolutionHistory, triggerTTS, triggerFlash,
        stopAutoMove, handleDecayAction, setLastDecayEvent, setFinalCombo, resetVisuals
    );

    // 8. Data Persistence (Save/Load)
    const { generateSaveCode, loadSaveCode } = usePersistence(
        gameState,
        setGameState,
        evolutionHistory,
        setEvolutionHistory,
        resetVisuals
    );

    // Initial World Generation
    useEffect(() => {
        const initialEntities = generateEntities(5, [], gameState.playerPos, 0);
        setGameState(prev => ({ ...prev, gridEntities: initialEntities }));
        setEvolutionHistory({
            [`${INITIAL_NUCLIDE.z}-${INITIAL_NUCLIDE.a}`]: {
                turn: 0, name: INITIAL_NUCLIDE.name, symbol: INITIAL_NUCLIDE.symbol,
                z: INITIAL_NUCLIDE.z, a: INITIAL_NUCLIDE.a, method: HISTORY_METHODS.ORIGIN
            }
        });
    }, []);

    const setHP = useCallback((val: number) => setGameState(prev => ({ ...prev, hp: val })), []);

    return {
        gameState, evolutionHistory, isScreenShaking, isFlashBang, flashColor, lastDecayEvent, finalCombo,
        moveStep, handleStabilize, handleDecayAction, handlePlayerInteract, handleToggleTimeStop,
        handleTransmute, handleToggleHiddenSkill, restartGame, handleCellClick, stopAutoMove,
        handleUltimateSynthesis, handleForceUnknownDecay, setHP, generateSaveCode, loadSaveCode
    };
};
