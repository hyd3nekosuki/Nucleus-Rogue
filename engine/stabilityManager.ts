import { GameState, DecayMode } from '../types';
import { calculateReincarnationTargets } from './particleEngine';
import { REASON } from '../constants/gameOverReason';
import { processUnlocks } from './unlockSystem';
import { TITLES } from '../constants/titles';

/**
 * Utility to resolve a stability crisis (HP=0).
 * Checks for automatic survival mechanisms before triggering game over.
 */
export const resolveStabilityCrisis = (
    state: GameState, 
    reason: string = REASON.UNKNOWN,
    isDaredevilAttempt: boolean = false,
    checkInversion: boolean = true
): Partial<GameState> => {
    const now = Date.now();

    // Helper for final title check
    const finalizeUnlocks = (updatedState: Partial<GameState>) => {
        const tempState = { ...state, ...updatedState };
        return processUnlocks(
            tempState.unlockedElements, 
            tempState.unlockedGroups, 
            null, null, 
            false, false, false, false, 0, 
            false, false, false, false, false, 
            0, 0, false, isDaredevilAttempt,
            state.isTimeStopped, false, state.playerLevel
        );
    };

    // --- CASE: Total Annihilation ---
    if (reason === REASON.NOTHINGNESS) {
        const res = finalizeUnlocks({ hp: 0, gameOver: true });
        return { 
            hp: 0, energyPoints: 0, gameOver: true, gameOverReason: reason,
            unlockedGroups: res.updatedGroups, score: state.score + res.scoreBonus,
            messages: [...state.messages, ...res.messages].slice(-10),
            combo: 0, comboScore: 0, comboOrigin: undefined,
            consecutiveProtons: 0, consecutiveNeutrons: 0, consecutiveElectrons: 0, lastConsumedType: null,
            lastEvent: { id: now, type: 'DEATH', message: 'Total Annihilation', flash: 'bg-neon-purple', shake: true }
        };
    }

    // --- CASE 1: Temporal Inversion (Auto-Stabilization) ---
    if (checkInversion &&
        state.unlockedGroups.includes(TITLES.TEMPORAL_INVERSION) && 
        !state.disabledSkills.includes(TITLES.TEMPORAL_INVERSION) && 
        state.energyPoints >= 5) {
        
        const survivalUpdate: Partial<GameState> = { 
            hp: state.maxHp, 
            energyPoints: Math.max(0, state.energyPoints - 5),
            effects: [
                ...state.effects, 
                { id: Math.random().toString(36).substr(2, 9), type: DecayMode.STABILIZE_ZAP, position: { ...state.playerPos }, timestamp: now }
            ],
            lastEvent: { id: now, type: 'SURVIVAL', subType: 'TEMPORAL_INVERSION', message: 'Temporal Inversion' }
        };

        const res = finalizeUnlocks(survivalUpdate);
        return {
            ...survivalUpdate,
            unlockedGroups: res.updatedGroups,
            score: state.score + res.scoreBonus,
            messages: [...state.messages, "⏱ AUTO-STABILIZATION: Temporal Inversion triggered!", ...res.messages].slice(-10)
        };
    }

    // --- CASE 2: Reincarnation ---
    const isDaredevilActive = state.unlockedGroups.includes(TITLES.DEMON_CORE) && !state.disabledSkills.includes(TITLES.DEMON_CORE);
    const reinc = calculateReincarnationTargets(state.currentNuclide, state.reincarnationPool, state.evolutionHistory, isDaredevilActive);
    
    if (reinc) {
        const { nuclide, usage } = reinc;
        const nextEnergy = Math.floor((state.energyPoints / 2) / 5) * 5;
        
        const survivalUpdate: Partial<GameState> = {
            currentNuclide: nuclide,
            hp: state.maxHp,
            playerLevel: 0,
            masteredDecays: [],
            energyPoints: nextEnergy,
            reincarnationPool: {
                p: state.reincarnationPool.p - usage.p,
                n: state.reincarnationPool.n - usage.n,
                e: state.reincarnationPool.e - usage.e
            },
            reincarnations: state.reincarnations + 1,
            combo: 0, comboScore: 0, comboOrigin: undefined,
            consecutiveProtons: 0, consecutiveNeutrons: 0, consecutiveElectrons: 0, lastConsumedType: null,
            lastEvent: { id: now, type: 'SURVIVAL', subType: 'REINCARNATION', flash: 'bg-neon-green', message: 'Reincarnation' }
        };

        const res = finalizeUnlocks(survivalUpdate);
        return {
            ...survivalUpdate,
            unlockedGroups: res.updatedGroups,
            score: state.score + res.scoreBonus,
            messages: [...state.messages, `♻️ REINCARNATION: Reborn as ${nuclide.name}!`, ...res.messages].slice(-10)
        };
    }

    // --- CASE 3: Normal Death ---
    const finalRes = finalizeUnlocks({ hp: 0, gameOver: true });
    return { 
        hp: 0, energyPoints: 0, gameOver: true, gameOverReason: reason,
        unlockedGroups: finalRes.updatedGroups, score: state.score + finalRes.scoreBonus,
        messages: [...state.messages, ...finalRes.messages].slice(-10),
        combo: 0, comboScore: 0, comboOrigin: undefined,
        consecutiveProtons: 0, consecutiveNeutrons: 0, consecutiveElectrons: 0, lastConsumedType: null,
        lastEvent: { id: now, type: 'DEATH' }
    };
};
