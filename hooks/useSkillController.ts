
// Add React import to provide access to React namespace
import React, { useCallback } from 'react';
import { GameState, DecayMode, HistoryEntry, GameAction, EntityType } from '../types';
import { INITIAL_NUCLIDE } from '../constants/gameConfig';
import { HISTORY_METHODS } from '../constants/strings';
import { TITLES } from '../constants/titles';
import { getNuclideDataSync } from '../services/nuclideService';
import { generateEntities } from '../engine/gameLogic';
import { processUnlocks } from '../engine/unlockSystem';
import { getInitialState } from '../engine/initialState';
import { pickNuclideWithPriority } from '../engine/particleEngine';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants/gameConfig';
import { getNextTutorialMessage } from '../engine/tutorialManager';

export const useSkillController = (
    gameState: GameState,
    dispatch: React.Dispatch<GameAction>,
    stopAutoMove: () => void,
    handleDecayAction: (mode: DecayMode) => void,
    resetVisuals: () => void
) => {

    const handleStabilize = useCallback(() => {
        const isSynth = gameState.energyPoints >= 200 && gameState.playerLevel >= 5 && !gameState.disabledSkills.includes(TITLES.NUCLEOSYNTHESIS);
        dispatch({
            type: 'USE_SKILL',
            payload: { skillType: isSynth ? 'NUCLEOSYNTHESIS' : 'STABILIZE' }
        });
    }, [gameState.energyPoints, gameState.playerLevel, gameState.disabledSkills, dispatch]);

    const handleUltimateSynthesis = useCallback(() => {
        dispatch({ type: 'USE_SKILL', payload: { skillType: 'R_PROCESS' } });
    }, [dispatch]);

    const handleToggleTimeStop = useCallback(() => {
        stopAutoMove();
        dispatch({ type: 'USE_SKILL', payload: { skillType: 'TIME_STOP' } });
    }, [stopAutoMove, dispatch]);

    const handleTransmute = useCallback((selectedZ: number) => {
        dispatch({ type: 'USE_SKILL', payload: { skillType: 'TRANSMUTE', params: { selectedZ } } });
    }, [dispatch]);

    const handleToggleHiddenSkill = useCallback((skillName: string) => {
        dispatch({ type: 'USE_SKILL', payload: { skillType: 'TOGGLE_SKILL', params: { skillName } } });
    }, [dispatch]);

    const restartGame = useCallback((randomStart: boolean = false) => {
        const currentTitles = gameState.unlockedElements;
        const currentGroups = gameState.unlockedGroups;
        const isDaredevilActive = currentGroups.includes(TITLES.DAREDEVIL) && !gameState.disabledSkills.includes(TITLES.DAREDEVIL);
        
        let startNuclide = INITIAL_NUCLIDE;
        if (randomStart) {
            let coords = pickNuclideWithPriority(currentTitles, isDaredevilActive); 
            if (coords) { 
                const data = getNuclideDataSync(coords.z, coords.a); 
                if (data.exists) startNuclide = data; 
            }
        }
        
        resetVisuals();
        const newState = getInitialState();
        const originEntry: HistoryEntry = { firstTurn: 0, lastTurn: 0, name: startNuclide.name, symbol: startNuclide.symbol, z: startNuclide.z, a: startNuclide.a, method: HISTORY_METHODS.ORIGIN, pz: null, pa: null };
        const nextMsg = getNextTutorialMessage(newState, 'GAME_START', { randomStart, nextNuclide: startNuclide });

        dispatch({
            type: 'RESET_STATE',
            payload: { 
                ...newState, 
                evolutionHistory: { [`${startNuclide.z}-${startNuclide.a}`]: originEntry },
                disabledSkills: randomStart ? gameState.disabledSkills : [], 
                currentNuclide: startNuclide, 
                gridEntities: generateEntities(5, [], newState.playerPos, 0), 
                unlockedElements: randomStart ? currentTitles : [], 
                unlockedGroups: randomStart ? currentGroups : [], 
                maxCombo: randomStart ? gameState.maxCombo : 0, 
                reincarnations: randomStart ? gameState.reincarnations + 1 : 0, 
                tutorialMessage: nextMsg
            }
        });
    }, [gameState, resetVisuals, dispatch]);

    const handleForceUnknownDecay = useCallback(() => {
        if (gameState.playerLevel < 6 || !gameState.currentNuclide.isStable || gameState.energyPoints < 5) return;
        handleDecayAction(DecayMode.UNKNOWN);
    }, [gameState.playerLevel, gameState.currentNuclide.isStable, gameState.energyPoints, handleDecayAction]);

    return { handleStabilize, handleUltimateSynthesis, handleToggleTimeStop, handleTransmute, handleToggleHiddenSkill, restartGame, handleForceUnknownDecay };
};
