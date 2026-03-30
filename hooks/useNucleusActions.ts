// Fix: Added React import to provide access to React namespace for Dispatch type
import React, { useCallback } from 'react';
import { GameState, DecayMode, HistoryEntry, GameAction } from '../types';
import { INITIAL_NUCLIDE } from '../constants/gameConfig';
import { HISTORY_METHODS } from '../constants/strings';
import { TITLES } from '../constants/titles';
import { getNuclideDataSync } from '../services/nuclideService';
import { generateEntities } from '../engine/moveSimulator';
import { getInitialState } from '../engine/initialState';
import { pickNuclideWithPriority } from '../engine/particleEngine';
import { getNextTutorialMessage } from '../engine/tutorialManager';

/**
 * Nucleus Actions Controller
 * Responsible for all user-initiated atomic transformations and session lifecycle management.
 */
export const useNucleusActions = (
    gameState: GameState,
    dispatch: React.Dispatch<GameAction>,
    stopAutoMove: () => void,
    handleDecayAction: (mode: DecayMode) => void,
    resetVisuals: () => void
) => {

    const handleStabilize = useCallback(() => {
        const isSynth = gameState.energyPoints >= 200 && gameState.playerLevel >= 6 && !gameState.disabledSkills.includes(TITLES.NUCLEOSYNTHESIS);
        // Reset visual ghost states if a transformation is about to occur
        if (isSynth) resetVisuals();
        dispatch({
            type: 'USE_SKILL',
            payload: { skillType: isSynth ? 'NUCLEOSYNTHESIS' : 'STABILIZE' }
        });
    }, [gameState.energyPoints, gameState.playerLevel, gameState.disabledSkills, dispatch, resetVisuals]);

    const handleUltimateSynthesis = useCallback(() => {
        resetVisuals();
        dispatch({ type: 'USE_SKILL', payload: { skillType: 'R_PROCESS' } });
    }, [dispatch, resetVisuals]);

    const handleToggleTimeStop = useCallback(() => {
        stopAutoMove();
        // Reset visuals when toggling time stop to prevent stale combo animations from reappearing
        resetVisuals();
        dispatch({ type: 'USE_SKILL', payload: { skillType: 'TIME_STOP' } });
    }, [stopAutoMove, dispatch, resetVisuals]);

    const handleTransmute = useCallback((selectedZ: number) => {
        resetVisuals();
        dispatch({ type: 'USE_SKILL', payload: { skillType: 'TRANSMUTE', params: { selectedZ } } });
    }, [dispatch, resetVisuals]);

    const handleToggleHiddenSkill = useCallback((skillName: string) => {
        dispatch({ type: 'USE_SKILL', payload: { skillType: 'TOGGLE_SKILL', params: { skillName } } });
    }, [dispatch]);

    const handleEngraveCurrent = useCallback((isResonating: boolean = false) => {
        dispatch({ type: 'ENGRAVE_CURRENT', payload: { isResonating } });
    }, [dispatch]);

    const restartGame = useCallback((randomStart: boolean = false) => {
        const currentTitles = gameState.unlockedElements;
        const currentGroups = gameState.unlockedGroups;
        const currentLanguage = gameState.language;
        const isDaredevilActive = currentGroups.includes(TITLES.DEMON_CORE) && !gameState.disabledSkills.includes(TITLES.DEMON_CORE);
        
        let startNuclide = INITIAL_NUCLIDE;
        if (randomStart) {
            let coords = pickNuclideWithPriority(currentTitles, isDaredevilActive); 
            if (coords) { 
                const data = getNuclideDataSync(coords.z, coords.a); 
                if (data.exists) startNuclide = data; 
            }
        }
        
        resetVisuals();
        const newState = getInitialState(currentLanguage);
        
        // Random Generation時はチュートリアルの既読状態を引き継ぐ
        if (randomStart) {
            newState.hasSeenDecayTutorial = gameState.hasSeenDecayTutorial;
            newState.hasSeenCaptureTutorial = gameState.hasSeenCaptureTutorial;
            newState.hasSeenDripLineTutorial = gameState.hasSeenDripLineTutorial;
            newState.hasSeenEngraveTutorial = gameState.hasSeenEngraveTutorial;
            newState.hasSeenSkillToggleTutorial = gameState.hasSeenSkillToggleTutorial;
        }

        // ターン数のリセット: 歴史に刻印する機能の導入に伴い、Random Generation 時もターン 0 から開始する
        const startTurn = 0;

        const originEntry: HistoryEntry = { 
            firstTurn: startTurn, 
            lastTurn: startTurn, 
            name: startNuclide.name, 
            symbol: startNuclide.symbol, 
            z: startNuclide.z, 
            a: startNuclide.a, 
            method: HISTORY_METHODS.ORIGIN, 
            pz: null, 
            pa: null 
        };

        // 履歴のフィルタリング: randomStart の場合は刻印済みエントリのみを抽出して引き継ぐ
        let nextHistory: Record<string, HistoryEntry> = {};
        if (randomStart) {
            Object.entries(gameState.evolutionHistory).forEach(([key, entry]) => {
                if (entry.isEngraved) {
                    // 新セッション用にターン情報をリセットして引き継ぐ
                    nextHistory[key] = {
                        ...entry,
                        firstTurn: 0,
                        lastTurn: 0
                    };
                }
            });
            // 開始核種を追加
            nextHistory[`${startNuclide.z}-${startNuclide.a}`] = originEntry;
        } else {
            nextHistory = { [`${startNuclide.z}-${startNuclide.a}`]: originEntry };
        }

        const nextMsg = getNextTutorialMessage(newState, 'GAME_START', { randomStart, nextNuclide: startNuclide }, newState.language);

        dispatch({
            type: 'RESET_STATE',
            payload: { 
                ...newState, 
                turn: startTurn,
                elapsedTime: randomStart ? gameState.elapsedTime : 0,
                evolutionHistory: nextHistory,
                disabledSkills: randomStart ? gameState.disabledSkills : [], 
                currentNuclide: startNuclide, 
                gridEntities: generateEntities(5, [], newState.playerPos, startTurn), 
                unlockedElements: randomStart ? currentTitles : [], 
                unlockedGroups: randomStart ? currentGroups : [], 
                maxCombo: randomStart ? gameState.maxCombo : 0, 
                reincarnations: randomStart ? gameState.reincarnations + 1 : 0, 
                tutorialMessage: nextMsg
            }
        });
    }, [gameState, resetVisuals, dispatch]);

    const handleForceUnknownDecay = useCallback(() => {
        if (gameState.playerLevel < 5 || !gameState.currentNuclide.isStable || gameState.energyPoints < 5) return;
        resetVisuals();
        handleDecayAction(DecayMode.UNKNOWN);
    }, [gameState.playerLevel, gameState.currentNuclide.isStable, gameState.energyPoints, handleDecayAction, resetVisuals]);

    return { 
        handleStabilize, 
        handleUltimateSynthesis, 
        handleToggleTimeStop, 
        handleTransmute, 
        handleToggleHiddenSkill, 
        restartGame, 
        handleForceUnknownDecay,
        handleEngraveCurrent
    };
};
