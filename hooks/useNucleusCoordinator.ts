
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

/**
 * Central orchestrator for the Nucleus Rogue game engine.
 * Manages the connection between state, execution, input control, and visual feedback.
 */
export const useNucleusCoordinator = (triggerTTS: (text: string) => void) => {
    // 1. 生の状態（Single Source of Truth）
    const { gameState, setGameState, evolutionHistory, setEvolutionHistory } = useNucleusState();

    // 2. 視覚的フィードバック状態
    const {
        isScreenShaking, isFlashBang, flashColor, lastDecayEvent, finalCombo,
        triggerShake, triggerFlash, setLastDecayEvent, setFinalCombo, resetVisuals
    } = useVisualEffects();

    // 3. 受動的な自動ロジック（タイマーとクリーンアップ）
    useStabilityTimer(gameState, setGameState);
    useComboTimer(gameState, setGameState, setFinalCombo);
    useVisualCleanup(gameState, setGameState);

    // 循環参照解決用の関数Ref
    const stopAutoMoveRef = useRef<() => void>(() => {});

    // 4. 移動実行ロジック（物理ルールと計算）
    const { moveStep } = useMovementExecutor({
        setGameState, 
        setEvolutionHistory, 
        triggerTTS,
        triggerShake, 
        triggerFlash, 
        setLastDecayEvent, 
        setFinalCombo,
        onStopRequest: () => stopAutoMoveRef.current() // Ref経由で呼び出し
    });

    // 5. 相互作用ロジック（手動崩壊、粒子接触時の動作）
    const { 
        handleDecayAction, handlePlayerInteract 
    } = useDecayController(
        gameState, setGameState, setEvolutionHistory, triggerTTS, 
        triggerShake, triggerFlash, setLastDecayEvent, setFinalCombo, 
        () => stopAutoMoveRef.current()
    );

    // 6. ユーザー入力・制御ロジック（自動移動・パス生成）
    const { handleCellClick, stopAutoMove } = useMoveController(
        gameState,
        setGameState,
        moveStep,
        handlePlayerInteract
    );

    // コントローラーの停止関数をRefに同期
    useEffect(() => {
        stopAutoMoveRef.current = stopAutoMove;
    }, [stopAutoMove]);

    // 7. 高レベルスキル制御（安定化、合成、時間停止等）
    const {
        handleStabilize, handleUltimateSynthesis, handleToggleTimeStop,
        handleTransmute, handleToggleHiddenSkill, restartGame, handleForceUnknownDecay
    } = useSkillController(
        gameState, setGameState, setEvolutionHistory, triggerTTS, triggerFlash,
        stopAutoMove, handleDecayAction, setLastDecayEvent, setFinalCombo, resetVisuals
    );

    // 8. データ永続化（セーブ・ロード）
    const { generateSaveCode, loadSaveCode } = usePersistence(
        gameState,
        setGameState,
        evolutionHistory,
        setEvolutionHistory,
        resetVisuals
    );

    // 初期世界生成
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
