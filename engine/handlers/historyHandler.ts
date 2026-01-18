import { GameState } from '../../types';
import { getNextTutorialMessage, calculateTutorialFlagUpdates } from '../tutorialManager';

/**
 * Handler for engraving the current nuclide into history.
 */
export const handleEngraveCurrent = (state: GameState, payload: { isResonating: boolean }): GameState => {
    const { isResonating } = payload;
    const now = Date.now();
    const cost = isResonating ? 0 : 1;
    
    if (state.gameOver || state.loadingData || state.energyPoints < cost) return state;
    
    const key = `${state.currentNuclide.z}-${state.currentNuclide.a}`;
    const entry = state.evolutionHistory[key];
    if (!entry || entry.isEngraved) return state;

    const nextHistory = {
        ...state.evolutionHistory,
        [key]: { ...entry, isEngraved: true }
    };

    const nextMsg = getNextTutorialMessage(state, 'ENGRAVE_PERFORMED');
    const tutorialUpdates = calculateTutorialFlagUpdates(state, nextMsg, state.turn, 'ENGRAVE_PERFORMED');
    const resonanceMsg = isResonating ? ["✨ RHYTHMIC RESONANCE: Cost 0E"] : [];

    return {
        ...state,
        ...tutorialUpdates,
        tutorialMessage: nextMsg,
        energyPoints: state.energyPoints - cost,
        evolutionHistory: nextHistory,
        messages: [...state.messages, `📍 ${state.currentNuclide.name} engraved in history!`, ...resonanceMsg].slice(-10),
        lastEvent: { id: now, type: 'ENGRAVE', flash: 'bg-yellow-400' }
    };
};