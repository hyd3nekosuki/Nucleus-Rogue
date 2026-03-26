import { GameState } from '../../types';
import { getNextTutorialMessage, calculateTutorialFlagUpdates } from '../tutorialManager';
import { registerHistoryEntry } from '../core/historyService';

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
    
    // Already engraved? Nothing to do.
    if (entry?.isEngraved) return state;
    
    // If not in history, only allow if rhythmic resonance is active (Secret Mechanic)
    if (!entry && !isResonating) return state;

    // Use common history service for consistency
    // If entry is missing, we synthesize a lineage (Method: Reincarnation for electron, Resonance for others)
    const nextHistory = registerHistoryEntry(
        state.evolutionHistory,
        state.currentNuclide,
        entry?.method || (state.currentNuclide.z === -1 ? "Reincarnation" : "Resonance"),
        entry ? entry.pz : null,
        entry ? entry.pa : null,
        state.turn,
        true // forceEngraved
    );

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