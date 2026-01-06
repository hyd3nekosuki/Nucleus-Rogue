
import { useEffect, useCallback, useRef } from 'react';
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

export const useNucleusCoordinator = (triggerTTS: (text: string) => void) => {
    const { gameState, setGameState, evolutionHistory, setEvolutionHistory, recordDiscovery } = useNucleusState();

    const {
        isScreenShaking, isFlashBang, flashColor, lastDecayEvent, finalCombo,
        triggerShake, triggerFlash, setLastDecayEvent, setFinalCombo, resetVisuals
    } = useVisualEffects();

    useStabilityTimer(gameState, setGameState);
    useComboTimer(gameState, setGameState, setFinalCombo);
    useVisualCleanup(gameState, setGameState);

    const stopAutoMoveRef = useRef<() => void>(() => {});

    const { moveStep } = useMovementExecutor({
        gameState,
        setGameState, 
        setEvolutionHistory,
        recordDiscovery,
        triggerTTS,
        triggerShake, 
        triggerFlash, 
        setLastDecayEvent, 
        setFinalCombo,
        onStopRequest: () => stopAutoMoveRef.current()
    });

    const { 
        handleDecayAction, handlePlayerInteract 
    } = useDecayController(
        gameState, setGameState, setEvolutionHistory, recordDiscovery, triggerTTS, 
        triggerShake, triggerFlash, setLastDecayEvent, setFinalCombo, 
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
        gameState, setGameState, setEvolutionHistory, triggerTTS, triggerFlash,
        stopAutoMove, handleDecayAction, setLastDecayEvent, setFinalCombo, resetVisuals
    );

    const { generateSaveCode, loadSaveCode } = usePersistence(
        gameState,
        setGameState,
        evolutionHistory,
        setEvolutionHistory,
        resetVisuals
    );

    useEffect(() => {
        const initialEntities = generateEntities(5, [], gameState.playerPos, 0);
        setGameState(prev => ({ ...prev, gridEntities: initialEntities }));
        setEvolutionHistory({
            [`${INITIAL_NUCLIDE.z}-${INITIAL_NUCLIDE.a}`]: {
                turn: 0, name: INITIAL_NUCLIDE.name, symbol: INITIAL_NUCLIDE.symbol,
                z: INITIAL_NUCLIDE.z, a: INITIAL_NUCLIDE.a, method: HISTORY_METHODS.ORIGIN,
                pz: null, pa: null
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
