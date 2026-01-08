import { DecayMode, EntityType, GridEntity, VisualEffect, Position, NuclideData, DecayDelta } from '../types';

import { GRID_WIDTH, GRID_HEIGHT } from '../constants/gameConfig';
import { DECAY_PHYSICS } from '../constants/physics';
import { BONUS_SCORES } from '../constants/economy';
import { HISTORY_METHODS } from '../constants/strings';

import { getFissionFragmentOutcome } from './fissionModel';
import { calculateAnnihilationSymmetry, calculateFissionShockwave } from '../utils/decayInteractionHandler';

export interface DecayResult {
    dZ: number;
    dA: number;
    trigger: string;
    actionBonusScore: number;
    energyBonus: number; 
    extraMessages: string[];
    additionalEffects: VisualEffect[];
    newGridEntities: GridEntity[];
    shouldShake: boolean;
    shouldFlash: boolean;
    speechOverride: string | null;
    isAnnihilation?: boolean;
    newPosition?: Position; 
}

export const getDecayDeltas = (mode: DecayMode): DecayDelta => {
    return DECAY_PHYSICS[mode] || DECAY_PHYSICS[DecayMode.UNKNOWN];
};

const handleAlphaDecay = (currentTime: number, pos: Position): Partial<DecayResult> => ({
    trigger: HISTORY_METHODS.ALPHA_DECAY,
    energyBonus: 5,
    shouldFlash: false
});

const handleBetaMinus = (
    playerPos: Position,
    gridEntities: GridEntity[],
    currentTime: number, 
    neutronStarEnabled: boolean
): Partial<DecayResult> => {
    let currentEntities = [...gridEntities];
    let score = 0;
    const messages: string[] = [];
    const effects: VisualEffect[] = [];
    let speech = null;
    let isAnnihilation = false;

    // 1. Check for Proton -> Neutron conversion (requires skill)
    if (neutronStarEnabled) {
        const neighborProtons = currentEntities.filter(e => {
            if (e.type !== EntityType.PROTON) return false;
            const dx = Math.abs(e.position.x - playerPos.x);
            const dy = Math.abs(e.position.y - playerPos.y);
            return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
        });
        
        if (neighborProtons.length > 0) {
            const targetProton = neighborProtons[Math.floor(Math.random() * neighborProtons.length)];
            const targetIndex = currentEntities.findIndex(e => e.id === targetProton.id);
            if (targetIndex !== -1) {
                currentEntities[targetIndex] = { ...targetProton, type: EntityType.NEUTRON };
                effects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.ELECTRON_CAPTURE, position: { ...targetProton.position }, timestamp: currentTime });
                score += BONUS_SCORES.BETA_CONVERSION;
                messages.push(`⚡ p + e- → n (+${BONUS_SCORES.BETA_CONVERSION} PTS)`);
            }
        }
    }

    // 2. Annihilation check
    const annihilationResult = calculateAnnihilationSymmetry(playerPos, currentEntities, EntityType.ENEMY_POSITRON, currentTime);
    if (annihilationResult) {
        currentEntities = annihilationResult.remainingEntities;
        effects.push({ id: Math.random().toString(36).substr(2, 9), type: annihilationResult.effectMode, position: { ...playerPos }, timestamp: currentTime });
        effects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.SPONTANEOUS_FISSION, position: { ...playerPos }, timestamp: currentTime }); 
        score += BONUS_SCORES.PAIR_ANNIHILATION;
        messages.push(...annihilationResult.extraMessages);
        speech = "Pair Annihilation";
        isAnnihilation = true;
    }

    return { trigger: HISTORY_METHODS.BETA_MINUS, newGridEntities: currentEntities, actionBonusScore: score, extraMessages: messages, additionalEffects: effects, speechOverride: speech, isAnnihilation };
};

const handleBetaPlus = (
    playerPos: Position,
    gridEntities: GridEntity[],
    currentTime: number, 
    annihilationEnabled: boolean
): Partial<DecayResult> => {
    let currentEntities = [...gridEntities];
    let score = 0;
    const messages: string[] = [];
    const effects: VisualEffect[] = [];
    let speech = null;
    let isAnnihilation = false;

    // Perform annihilation logic only if skill is unlocked and active
    if (annihilationEnabled) {
        const annihilationResult = calculateAnnihilationSymmetry(playerPos, currentEntities, EntityType.ENEMY_ELECTRON, currentTime);
        if (annihilationResult) {
            currentEntities = annihilationResult.remainingEntities;
            effects.push({ id: Math.random().toString(36).substr(2, 9), type: annihilationResult.effectMode, position: { ...playerPos }, timestamp: currentTime });
            effects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.SPONTANEOUS_FISSION, position: { ...playerPos }, timestamp: currentTime }); 
            score += BONUS_SCORES.PAIR_ANNIHILATION;
            messages.push(...annihilationResult.extraMessages);
            speech = "Pair Annihilation";
            isAnnihilation = true;
        }
    }

    return { trigger: HISTORY_METHODS.BETA_PLUS, newGridEntities: currentEntities, actionBonusScore: score, extraMessages: messages, additionalEffects: effects, speechOverride: speech, isAnnihilation };
};

const handleSpontaneousFission = (currentNuclide: NuclideData, playerPos: Position, gridEntities: GridEntity[], currentTime: number): Partial<DecayResult> => {
    const fragment = getFissionFragmentOutcome(currentNuclide.z, currentNuclide.a);
    const dZ = fragment.z - currentNuclide.z;
    const dA = fragment.a - currentNuclide.a;
    const currentEntities = calculateFissionShockwave(playerPos, gridEntities, 2);

    return {
        dZ, dA, trigger: HISTORY_METHODS.FISSION_SPONTANEOUS, shouldShake: true, shouldFlash: true,
        speechOverride: "Nuclear Fission", actionBonusScore: BONUS_SCORES.FISSION_TITLE, energyBonus: 200, newGridEntities: currentEntities
    };
};

export const calculateDecayEffects = (
    mode: DecayMode,
    currentNuclide: NuclideData,
    playerPos: Position,
    gridEntities: GridEntity[],
    currentTime: number,
    annihilationEnabled: boolean = true,
    fissionEnabled: boolean = true,
    neutronStarEnabled: boolean = false
): DecayResult => {
    let effectiveMode = mode;
    if (mode === DecayMode.SPONTANEOUS_FISSION && !fissionEnabled) {
        effectiveMode = DecayMode.ALPHA;
    }

    const deltas = getDecayDeltas(effectiveMode);
    
    let result: DecayResult = {
        dZ: deltas.dZ, dA: deltas.dA, trigger: HISTORY_METHODS.TRANSMUTATION,
        actionBonusScore: 0, energyBonus: 0, extraMessages: [], additionalEffects: [],
        newGridEntities: [...gridEntities], shouldShake: false, shouldFlash: false,
        speechOverride: null, isAnnihilation: false, newPosition: undefined
    };

    switch (effectiveMode) {
        case DecayMode.ALPHA: 
            Object.assign(result, handleAlphaDecay(currentTime, playerPos));
            break;
        case DecayMode.BETA_MINUS: 
            Object.assign(result, handleBetaMinus(playerPos, gridEntities, currentTime, neutronStarEnabled));
            break;
        case DecayMode.BETA_PLUS: 
            Object.assign(result, handleBetaPlus(playerPos, gridEntities, currentTime, annihilationEnabled));
            break;
        case DecayMode.ELECTRON_CAPTURE: 
             result.trigger = HISTORY_METHODS.ELECTRON_CAPTURE;
             result.newPosition = { x: Math.floor(Math.random() * GRID_WIDTH), y: Math.floor(Math.random() * GRID_HEIGHT) };
             result.shouldShake = true;
             result.extraMessages.push("✨ Uncertainty principle for position!");
             result.additionalEffects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.ELECTRON_CAPTURE, position: { ...result.newPosition }, timestamp: currentTime });
             break;
        case DecayMode.PROTON_EMISSION: 
            result.trigger = HISTORY_METHODS.PROTON_EMISSION; 
            break;
        case DecayMode.NEUTRON_EMISSION: 
            result.trigger = HISTORY_METHODS.NEUTRON_EMISSION; 
            break;
        case DecayMode.GAMMA:
             result.trigger = HISTORY_METHODS.GAMMA_DECAY;
             result.actionBonusScore = BONUS_SCORES.GAMMA_ACTION;
             const dirs = [DecayMode.GAMMA_RAY_UP, DecayMode.GAMMA_RAY_DOWN, DecayMode.GAMMA_RAY_LEFT, DecayMode.GAMMA_RAY_RIGHT];
             const selected = dirs[Math.floor(Math.random() * dirs.length)];
             result.additionalEffects.push({ id: Math.random().toString(36).substr(2, 9), type: selected, position: { ...playerPos }, timestamp: currentTime });
             break;
        case DecayMode.SPONTANEOUS_FISSION:
            Object.assign(result, handleSpontaneousFission(currentNuclide, playerPos, gridEntities, currentTime));
            break;
    }

    return result;
};