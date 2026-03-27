import { useEffect, useCallback, useRef } from 'react';
import { INITIAL_NUCLIDE, HISTORY_METHODS } from '../constants';
import { CHALLENGES } from '../constants/challenges';
import { DecayMode } from '../types';
import { generateEntities } from './moveSimulator';
import { getInitialState } from './initialState';
import { useNucleusState } from './useNucleusState';
import { useStabilityTimer } from './useStabilityTimer';
import { useRTATimer } from './useRTATimer';
import { useComboTimer } from './useComboTimer';
import { useVisualCleanup } from '../hooks/useVisualCleanup';
import { useMoveController } from '../hooks/useMoveController';
import { usePersistence } from '../hooks/usePersistence';
import { useQuantumOverride } from '../hooks/useQuantumOverride';
import { useVisualEffects } from '../hooks/useVisualEffects';
import { useNucleusActions } from '../hooks/useNucleusActions';
import { useDecayController } from '../hooks/useDecayController';
import { useMovementExecutor } from '../hooks/useMovementExecutor';
import { emitTTS } from './events/gameEvents';

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
        isScreenShaking, shakeIntensity, isFlashBang, flashColor, lastDecayEvent, finalCombo,
        triggerShake, triggerFlash, setFinalCombo, resetVisuals
    } = useVisualEffects(gameState, dispatch);

    // 3. Periodic Life-Cycle Timers (Stability Decay, Combo Expiration, Janitorial Cleanup)
    useStabilityTimer(gameState, setGameState);
    useRTATimer(gameState, setGameState);
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

    // 6. Persistence & Advanced Mastery Features (Level 8 Cite Research)
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
     * Unified Load Handler: Routes codes to either Quantum Override (Mastery level 8)
     * or standard binary research persistence.
     */
    const handleLoad = useCallback(async (code: string) => {
        const isQuantumSuccess = executeQuantumOverride(code);
        if (isQuantumSuccess) return true;
        return await rawLoadSaveCode(code);
    }, [executeQuantumOverride, rawLoadSaveCode]);

    // 7. Initial Nucleogenesis & Visual Reset
    useEffect(() => {
        // Clear any stale visual effects from the state on mount (fixes tab-switch ghosting)
        // We use getInitialState() directly to ensure no old events or effects leak in
        const initialState = getInitialState();
        const initialEntities = generateEntities(5, [], initialState.playerPos, 0);
        
        dispatch({
            type: 'RESET_STATE',
            payload: {
                ...initialState,
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

    const handleOpenMastery = useCallback(() => {
        dispatch({ type: 'NOTIFY_TUTORIAL_EVENT', payload: { event: 'MASTERY_OPENED' } });
    }, [dispatch]);

    // 8. Achievement Tracking
    useEffect(() => {
        const checkAchievement = (id: string, condition: boolean) => {
            if (condition && !gameState.achievementTimes[id]) {
                dispatch({ type: 'RECORD_ACHIEVEMENT', payload: { id, time: gameState.elapsedTime } });
            }
        };

        checkAchievement('all_elements', gameState.unlockedElements.filter(z => z > 0).length >= 118);
        checkAchievement('combo_master', gameState.maxCombo >= 20);
        checkAchievement('tranquilo', gameState.tranquiloTurnCount >= 50);
        checkAchievement('reincarnated', gameState.hasPerformedActiveReincarnation && gameState.currentNuclide.z === -1);
        checkAchievement('this_is_it', (gameState.decayStats[DecayMode.IT] || 0) > 0);
        
        // Nuclear Domino: Triggered by a fission chain reaction
        const hasChainReaction = (gameState.lastEvent?.chainReactionPath?.length || 0) > 0;
        checkAchievement('nuclear_domino', hasChainReaction);

        // Master of Alpha: Experience all alpha-related events at least once
        const hasPureAlpha = (gameState.decayStats['PURE_ALPHA'] || 0) > 0;
        const hasBMinusAlpha = (gameState.decayStats[DecayMode.B_MINUS_ALPHA] || 0) > 0;
        const hasBPlusAlpha = (gameState.decayStats[DecayMode.B_PLUS_ALPHA] || 0) > 0;
        const hasECAlpha = (gameState.decayStats[DecayMode.EC_ALPHA] || 0) > 0;
        const hasNA = (gameState.reactionStats[HISTORY_METHODS.REACTION_NA] || 0) > 0;
        const hasPA = (gameState.reactionStats[HISTORY_METHODS.REACTION_PA] || 0) > 0;
        
        checkAchievement('i_am_the_alpha', hasPureAlpha && hasBMinusAlpha && hasBPlusAlpha && hasECAlpha && hasNA && hasPA);

        // Master of Beta: Experience all beta-minus related events at least once
        const hasPureBMinus = (gameState.decayStats['PURE_BETA_MINUS'] || 0) > 0;
        const hasDoubleBMinus = (gameState.decayStats[DecayMode.DOUBLE_BETA_MINUS] || 0) > 0;
        const hasBMinusN = (gameState.decayStats[DecayMode.B_MINUS_N] || 0) > 0;
        const hasBMinusAlpha_B = (gameState.decayStats[DecayMode.B_MINUS_ALPHA] || 0) > 0;
        const hasBMinusProton = (gameState.decayStats[DecayMode.B_MINUS_PROTON] || 0) > 0;
        const hasBMinusSF = (gameState.decayStats[DecayMode.B_MINUS_SF] || 0) > 0;

        checkAchievement('beta_master', hasPureBMinus && hasDoubleBMinus && hasBMinusN && hasBMinusAlpha_B && hasBMinusProton && hasBMinusSF);

        // Seasoned Nuclide: All major decay modes and neutron reactions experienced at least once
        const checkSeasonedNuclide = () => {
            const id = 'seasoned_nuclide';
            if (gameState.achievementTimes[id]) return;

            const requiredDecays = [
                DecayMode.ALPHA,
                DecayMode.BETA_MINUS,
                DecayMode.BETA_PLUS,
                DecayMode.ELECTRON_CAPTURE,
                DecayMode.SPONTANEOUS_FISSION,
                DecayMode.NEUTRON_EMISSION,
                DecayMode.PROTON_EMISSION,
                DecayMode.GAMMA
            ];

            const requiredReactions = [
                HISTORY_METHODS.REACTION_NG,
                HISTORY_METHODS.REACTION_NP,
                HISTORY_METHODS.REACTION_N2N,
                HISTORY_METHODS.REACTION_NA,
                HISTORY_METHODS.REACTION_NF
            ];

            const allDecaysDone = requiredDecays.every(mode => (gameState.decayStats[mode] || 0) > 0);
            const allReactionsDone = requiredReactions.every(method => (gameState.reactionStats[method] || 0) > 0);

            if (allDecaysDone && allReactionsDone) {
                dispatch({ type: 'RECORD_ACHIEVEMENT', payload: { id, time: gameState.elapsedTime } });
            }
        };

        checkSeasonedNuclide();
    }, [
        gameState.unlockedElements, 
        gameState.maxCombo, 
        gameState.reincarnations, 
        gameState.decayStats, 
        gameState.reactionStats, 
        gameState.elapsedTime,
        gameState.achievementTimes,
        gameState.currentNuclide,
        gameState.lastEvent,
        dispatch
    ]);

    // 9. Global Achievement TTS Watcher
    // Tracks which achievements have been vocalized in the current session to avoid duplicates
    const spokenAchievementsRef = useRef<Set<string>>(new Set(Object.keys(gameState.achievementTimes)));

    useEffect(() => {
        const currentIds = Object.keys(gameState.achievementTimes);
        const newIds = currentIds.filter(id => !spokenAchievementsRef.current.has(id));
        
        if (newIds.length > 0) {
            // If more than 3 achievements appear at once, it's likely a save load or bulk sync
            // In that case, we just mark them as spoken without vocalizing to avoid audio spam
            if (newIds.length <= 3) {
                newIds.forEach(id => {
                    const challenge = CHALLENGES.find(c => c.id === id);
                    if (challenge) {
                        emitTTS(challenge.title);
                    }
                });
            }
            
            newIds.forEach(id => spokenAchievementsRef.current.add(id));
        }
    }, [gameState.achievementTimes]);

    return {
        // Raw Data
        gameState, 
        evolutionHistory: gameState.evolutionHistory,
        
        // Visual Status
        isScreenShaking, shakeIntensity, isFlashBang, flashColor, lastDecayEvent, finalCombo,
        
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
        handleOpenMastery,
        
        // System & Persistence
        restartGame, 
        setHP, 
        generateSaveCode, 
        handleLoad
    };
};