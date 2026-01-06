
import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, DecayMode, HistoryEntry } from '../types';
import { 
    INITIAL_NUCLIDE, MAGIC_NUMBERS, HISTORY_METHODS,
    ENERGY_EVOLUTION_TURNS, COULOMB_BARRIER_THRESHOLD, MAX_ENERGY
} from '../constants';
import { generateEntities, calculateMoveResult } from '../utils/gameLogic';
import { processUnlocks } from '../utils/unlockSystem';
import { isTemporalInversionEligible, calculateComboCompletionBonus } from '../utils/scoreLogic';
import { getHistoryMethod } from '../utils/historyLogic';
import { getInitialState } from './useNucleusDefaults';
import { useStabilityTimer } from './useStabilityTimer';
import { useComboTimer } from './useComboTimer';
import { useVisualCleanup } from './useVisualCleanup';
import { useMoveController } from './useMoveController';
import { usePersistence } from './usePersistence';
import { useUIFeedback } from './useUIFeedback';
import { useSkillController } from './useSkillController';
import { useDecayController } from './useDecayController';

export const useNucleusEngine = (triggerTTS: (text: string) => void) => {
    const [gameState, setGameState] = useState<GameState>(getInitialState());
    // FIX: Changed state type from HistoryEntry[] to Record<string, HistoryEntry> to satisfy hook parameter requirements
    const [evolutionHistory, setEvolutionHistory] = useState<Record<string, HistoryEntry>>({});

    // FIX: Initialize bridge refs to break circular dependency between moveStep and useMoveController
    const stopAutoMoveRef = useRef<() => void>(() => {});

    // UI Feedback hook integration
    const {
        isScreenShaking, isFlashBang, flashColor, lastDecayEvent, finalCombo,
        triggerShake, triggerFlash, setLastDecayEvent, setFinalCombo, resetVisuals
    } = useUIFeedback();

    // Stability monitoring hook
    useStabilityTimer(gameState, setGameState);
    
    // Combo monitoring hook
    useComboTimer(gameState, setGameState, setFinalCombo);

    // Visual cleanup hook
    useVisualCleanup(gameState, setGameState);

    // Step logic for player movement
    const moveStep = useCallback((dx: number, dy: number) => {
        setGameState(prev => {
            if (prev.gameOver || prev.loadingData || prev.isTimeStopped) {
                // FIX: Use bridged stopAutoMove function
                stopAutoMoveRef.current();
                return prev;
            }
            const result = calculateMoveResult(prev, dx, dy, COULOMB_BARRIER_THRESHOLD, ENERGY_EVOLUTION_TURNS, prev.playerLevel);
            if (!result.moved) {
                // FIX: Use bridged refs to handle movement state cleanup
                stopAutoMoveRef.current();
                return prev;
            }
            
            const nextState = { ...result.state };
            if (nextState.energyPoints > MAX_ENERGY) nextState.energyPoints = MAX_ENERGY;
            if (nextState.gameOver) nextState.energyPoints = 0;

            if (result.shouldShake) triggerShake();
            if (result.shouldFlash) triggerFlash('bg-neon-blue');
            
            if (result.additionalEffects) nextState.effects = [...nextState.effects, ...result.additionalEffects];
            if (result.inducedDecayMode && result.inducedReactionLabel) {
                setLastDecayEvent({ mode: result.inducedDecayMode, timestamp: Date.now() });
                nextState.reactionStats = { ...nextState.reactionStats, [result.inducedReactionLabel]: (nextState.reactionStats[result.inducedReactionLabel] || 0) + 1 };
            }

            if (nextState.currentNuclide.z !== prev.currentNuclide.z || nextState.currentNuclide.a !== prev.currentNuclide.a) {
                if (prev.tutorialMessage === "Capture particle to transform") { nextState.tutorialMessage = null; nextState.hasSeenCaptureTutorial = true; }
                if (!nextState.currentNuclide.isStable && !prev.hasSeenDecayTutorial) nextState.tutorialMessage = "Decay to be stable";

                const method = getHistoryMethod(!!result.isPpFusion, !!result.isPositronAbsorption, result.targetEntity, result.inducedReactionLabel);
                // FIX: Updated setEvolutionHistory to use Record structure [Z-A]: Entry
                setEvolutionHistory(h => ({
                    ...h,
                    [`${nextState.currentNuclide.z}-${nextState.currentNuclide.a}`]: { 
                        turn: nextState.turn, 
                        name: nextState.currentNuclide.name, 
                        symbol: nextState.currentNuclide.symbol, 
                        z: nextState.currentNuclide.z, 
                        a: nextState.currentNuclide.a, 
                        method,
                        pz: prev.currentNuclide.z,
                        pa: prev.currentNuclide.a
                    }
                }));

                if (result.isPpFusion) triggerTTS("Nuclear Fusion");

                if (nextState.combo === 0 && !nextState.currentNuclide.isStable) nextState.comboStartNuclide = { z: prev.currentNuclide.z, a: prev.currentNuclide.a };
                const scoreDiff = nextState.score - prev.score;
                nextState.comboScore = (nextState.combo === 0) ? scoreDiff : prev.comboScore + scoreDiff;

                if (nextState.currentNuclide.isStable && prev.combo > 0) {
                    const inversionEligible = isTemporalInversionEligible(nextState.currentNuclide.z, nextState.currentNuclide.a, prev.comboStartNuclide, nextState.unlockedGroups, prev.disabledSkills);
                    if (inversionEligible) {
                        const scoreBonus = calculateComboCompletionBonus(nextState.comboScore, true);
                        const unlockResult = processUnlocks(nextState.unlockedElements, nextState.unlockedGroups, nextState.currentNuclide.z, nextState.currentNuclide.a, false, false, false, true, nextState.comboScore, false, false, false, false, false, prev.decayStats[DecayMode.BETA_PLUS] || 0, prev.decayStats[DecayMode.BETA_MINUS] || 0);
                        nextState.score += scoreBonus + unlockResult.scoreBonus; nextState.unlockedGroups = unlockResult.updatedGroups; nextState.messages = [...nextState.messages, ...unlockResult.messages].slice(-10);
                    }
                    if (prev.combo >= 2) setFinalCombo({ count: prev.combo, id: Date.now() });
                    nextState.combo = 0; nextState.comboScore = 0; nextState.comboStartNuclide = undefined;
                }
            }

            if (nextState.hp <= 0 && !nextState.gameOver) {
                if (nextState.unlockedGroups.includes("Temporal Inversion") && !nextState.disabledSkills.includes("Temporal Inversion") && nextState.energyPoints >= 5) {
                    nextState.hp = nextState.maxHp; nextState.energyPoints -= 5; nextState.messages = [...nextState.messages, "⏱ AUTO-STABILIZATION: Temporal Inversion triggered!"].slice(-10);
                    nextState.effects = [...nextState.effects, { id: Math.random().toString(36).substr(2, 9), type: DecayMode.STABILIZE_ZAP, position: { ...nextState.playerPos }, timestamp: Date.now() }];
                } else { nextState.gameOver = true; nextState.gameOverReason = "PARTICLE_COLLISION"; nextState.combo = 0; nextState.comboScore = 0; nextState.comboStartNuclide = undefined; }
            }
            return nextState;
        });
    }, [triggerTTS, triggerShake, triggerFlash, setLastDecayEvent, setFinalCombo]);

    // Decay controller hook integration (Handles manual decay and interaction glue)
    const { 
        handleDecayAction, handlePlayerInteract 
    } = useDecayController(
        gameState, setGameState, setEvolutionHistory, triggerTTS, 
        triggerShake, triggerFlash, setLastDecayEvent, setFinalCombo, () => stopAutoMoveRef.current()
    );

    // Movement controller hook integration
    // FIX: Remove non-existent continuousDirRef from useMoveController destructuring
    const { handleCellClick, stopAutoMove } = useMoveController(
        gameState,
        setGameState,
        moveStep,
        handlePlayerInteract
    );

    // FIX: Synchronize bridge refs with move controller outputs in an effect to handle cross-hook availability
    useEffect(() => {
        stopAutoMoveRef.current = stopAutoMove;
    });

    // Skill controller hook integration
    const {
        handleStabilize, handleUltimateSynthesis, handleToggleTimeStop,
        handleTransmute, handleToggleHiddenSkill, restartGame, handleForceUnknownDecay
    } = useSkillController(
        gameState, setGameState, setEvolutionHistory, triggerTTS, triggerFlash,
        stopAutoMove, handleDecayAction, setLastDecayEvent, setFinalCombo, resetVisuals
    );

    // Persistence controller hook integration
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
        // FIX: Seed history as Record instead of Array
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
