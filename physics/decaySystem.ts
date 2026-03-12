import { DecayMode, EntityType, GridEntity, VisualEffect, Position, NuclideData, DecayDelta } from '../types';

import { GRID_WIDTH, GRID_HEIGHT } from '../constants/gameConfig';
import { DECAY_PHYSICS } from '../constants/physics';
import { BONUS_SCORES } from '../constants/economy';
import { HISTORY_METHODS } from '../constants/strings';

import { getFissionFragmentOutcome, getPromptNeutronCount } from './fissionModel';
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
    emissions?: EntityType[]; // Procedure 2: Abstraction of emitted particles
    byproduct?: { z: number, a: number }; // Added for fission fragment handling
}

export const getDecayDeltas = (mode: DecayMode): DecayDelta => {
    return DECAY_PHYSICS[mode] || DECAY_PHYSICS[DecayMode.UNKNOWN];
};

/**
 * Handles Alpha Decay logic, including anti-nuclide neutralization in 8 directions.
 */
const handleAlphaDecay = (currentNuclide: NuclideData, playerPos: Position, gridEntities: GridEntity[], currentTime: number): Partial<DecayResult> => {
    let currentEntities = [...gridEntities];
    let energyBonus = 5;
    let score = 0;
    const messages: string[] = [];

    // Find anti-nuclides in 8 directions (Moore neighborhood)
    const nearbyAntis = currentEntities.filter(e => 
        e.type === EntityType.ANTI_NUCLIDE && 
        Math.abs(e.position.x - playerPos.x) <= 1 && 
        Math.abs(e.position.y - playerPos.y) <= 1
    );

    if (nearbyAntis.length > 0) {
        // Remove detected anti-nuclides
        currentEntities = currentEntities.filter(e => !nearbyAntis.some(a => a.id === e.id));
        
        // Apply special rewards
        energyBonus += 1000;
        score += Math.floor(940 * currentNuclide.a);
        messages.push(`✨ ANTI-NUCLIDE NEUTRALIZED: Alpha pulse purged anomaly! (+1000 MeV)`);
    }

    return { 
        trigger: HISTORY_METHODS.ALPHA_DECAY, 
        newGridEntities: currentEntities, 
        energyBonus, 
        actionBonusScore: score, 
        extraMessages: messages,
        shouldFlash: false 
    };
};

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
    // Determine dynamic neutron emission count first to ensure mass conservation
    const neutronCount = getPromptNeutronCount(currentNuclide.z, currentNuclide.a);
    
    const fragment = getFissionFragmentOutcome(currentNuclide.z, currentNuclide.a, neutronCount);
    const dZ = fragment.z - currentNuclide.z;
    const dA = fragment.a - currentNuclide.a;

    // --- CONSERVATION OF MASS AND CHARGE (Procedure 2) ---
    // Calculate the secondary fragment (byproduct)
    const byproductZ = currentNuclide.z - fragment.z;
    const byproductA = currentNuclide.a - fragment.a - neutronCount;
    
    // Detection before shockwave filters entities
    const antisInBlast = gridEntities.filter(e => 
        e.type === EntityType.ANTI_NUCLIDE &&
        Math.sqrt(Math.pow(e.position.x - playerPos.x, 2) + Math.pow(e.position.y - playerPos.y, 2)) <= 2
    );

    let currentEntities = calculateFissionShockwave(playerPos, gridEntities, 2);

    // --- EMISSION LOGIC ---
    // Use the dynamically calculated neutron count
    const emissions: EntityType[] = new Array(neutronCount).fill(EntityType.NEUTRON);

    let energyBonus = 200;
    let score = BONUS_SCORES.FISSION_TITLE;
    const messages: string[] = [];

    if (antisInBlast.length > 0) {
        energyBonus += 1000;
        score += Math.floor(940 * currentNuclide.a);
        messages.push(`💥 ANTI-NUCLIDE PURGED: Fission shockwave dissolved anomaly! (+1000 MeV)`);
    }

    // Prepare byproduct data if it is a physically plausible nucleus
    const byproduct = (byproductZ > 0 && byproductA >= byproductZ) 
        ? { z: byproductZ, a: byproductA } 
        : undefined;

    return {
        dZ, dA, trigger: HISTORY_METHODS.FISSION_SPONTANEOUS, shouldShake: true, shouldFlash: true,
        speechOverride: "Nuclear Fission", actionBonusScore: score, energyBonus, newGridEntities: currentEntities,
        extraMessages: messages,
        emissions, // Return list of particles to be spawned by engine
        byproduct  // Procedure 2: Secondary fragment for conservation
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
        speechOverride: null, isAnnihilation: false, newPosition: undefined,
        emissions: []
    };

    switch (effectiveMode) {
        case DecayMode.ALPHA: 
            Object.assign(result, handleAlphaDecay(currentNuclide, playerPos, gridEntities, currentTime));
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
        case DecayMode.TWO_PROTON_EMISSION:
            result.trigger = HISTORY_METHODS.TWO_PROTON_EMISSION;
            result.emissions = [EntityType.PROTON, EntityType.PROTON];
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