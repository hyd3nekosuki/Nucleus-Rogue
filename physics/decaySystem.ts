import { DecayMode, EntityType, GridEntity, VisualEffect, Position, NuclideData, DecayDelta } from '../types';

import { GRID_WIDTH, GRID_HEIGHT } from '../constants/gameConfig';
import { DECAY_PHYSICS } from '../constants/physics';
import { BONUS_SCORES } from '../constants/economy';
import { HISTORY_METHODS } from '../constants/strings';
import { LOG_MESSAGES } from '../constants/logMessageTextData';

import { getFissionFragmentOutcome, getPromptNeutronCount } from './fissionModel';
import { calculateAnnihilationSymmetry, calculateFissionShockwave } from '../utils/decayInteractionHandler';
import { processFissionChainReaction } from './chainReactionSystem';

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
    shakeIntensity?: 'normal' | 'light';
    shouldFlash: boolean;
    flashColor?: string;
    speechOverride: string | null;
    isAnnihilation?: boolean;
    newPosition?: Position; 
    emissions?: EntityType[]; // Procedure 2: Abstraction of emitted particles
    byproduct?: { z: number, a: number }; // Added for fission fragment handling
    defeatedNuclides?: GridEntity[]; // Added to track enemies defeated by reaction
    chainReactionPath?: Position[];
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
        // Apply special rewards
        energyBonus += 1000;
        score += Math.floor(940 * currentNuclide.a);
        messages.push(LOG_MESSAGES.PHYSICS.ANTI_NUCLIDE_NEUTRALIZED_ALPHA);
    }

    // Find non-friendly Another Nuclides in Moore neighborhood
    const nearbyEnemies = currentEntities.filter(e => 
        e.type === EntityType.ANOTHER_NUCLIDE && 
        !e.isFriendly &&
        Math.abs(e.position.x - playerPos.x) <= 1 && 
        Math.abs(e.position.y - playerPos.y) <= 1
    );

    return { 
        trigger: HISTORY_METHODS.ALPHA_DECAY, 
        newGridEntities: currentEntities, 
        energyBonus, 
        actionBonusScore: score, 
        extraMessages: messages,
        shouldFlash: false,
        defeatedNuclides: [...nearbyAntis, ...nearbyEnemies]
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
                messages.push(LOG_MESSAGES.PHYSICS.PROTON_ELECTRON_CONVERSION(BONUS_SCORES.BETA_CONVERSION));
            }
        }
    }

    // 2. Annihilation check
    const annihilationResult = calculateAnnihilationSymmetry(playerPos, currentEntities, EntityType.ENEMY_POSITRON, currentTime);
    let defeatedNuclides: GridEntity[] = [];
    if (annihilationResult) {
        const removedEntity = gridEntities.find(e => e.id === annihilationResult.removedId);
        if (removedEntity) defeatedNuclides.push(removedEntity);
        currentEntities = annihilationResult.remainingEntities;
        effects.push({ id: Math.random().toString(36).substr(2, 9), type: annihilationResult.effectMode, position: { ...playerPos }, timestamp: currentTime });
        effects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.SPONTANEOUS_FISSION, position: { ...playerPos }, timestamp: currentTime }); 
        score += BONUS_SCORES.PAIR_ANNIHILATION;
        messages.push(...annihilationResult.extraMessages);
        speech = LOG_MESSAGES.HISTORY.ANNIHILATION;
        isAnnihilation = true;
    }

    return { trigger: HISTORY_METHODS.BETA_MINUS, newGridEntities: currentEntities, actionBonusScore: score, extraMessages: messages, additionalEffects: effects, speechOverride: speech, isAnnihilation, defeatedNuclides };
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
    let defeatedNuclides: GridEntity[] = [];
    if (annihilationEnabled) {
        const annihilationResult = calculateAnnihilationSymmetry(playerPos, currentEntities, EntityType.ENEMY_ELECTRON, currentTime);
        if (annihilationResult) {
            const removedEntity = gridEntities.find(e => e.id === annihilationResult.removedId);
            if (removedEntity) defeatedNuclides.push(removedEntity);
            currentEntities = annihilationResult.remainingEntities;
            effects.push({ id: Math.random().toString(36).substr(2, 9), type: annihilationResult.effectMode, position: { ...playerPos }, timestamp: currentTime });
            effects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.SPONTANEOUS_FISSION, position: { ...playerPos }, timestamp: currentTime }); 
            score += BONUS_SCORES.PAIR_ANNIHILATION;
            messages.push(...annihilationResult.extraMessages);
            speech = LOG_MESSAGES.HISTORY.ANNIHILATION;
            isAnnihilation = true;
        }
    }

    return { trigger: HISTORY_METHODS.BETA_PLUS, newGridEntities: currentEntities, actionBonusScore: score, extraMessages: messages, additionalEffects: effects, speechOverride: speech, isAnnihilation, defeatedNuclides };
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
    
    // --- FISSION CHAIN REACTION (Special Event) ---
    const chainResult = processFissionChainReaction(neutronCount, playerPos, gridEntities);
    let currentEntities = chainResult.finalEntities;
    const finalNeutronCount = chainResult.remainingNeutrons;
    const chainReactionPath = chainResult.path;

    // Detection before shockwave filters entities
    const antisInBlast = currentEntities.filter(e => 
        e.type === EntityType.ANTI_NUCLIDE &&
        Math.sqrt(Math.pow(e.position.x - playerPos.x, 2) + Math.pow(e.position.y - playerPos.y, 2)) <= 2
    );

    // Find non-friendly Another Nuclides in blast radius
    const enemiesInBlast = currentEntities.filter(e => 
        e.type === EntityType.ANOTHER_NUCLIDE &&
        !e.isFriendly &&
        Math.sqrt(Math.pow(e.position.x - playerPos.x, 2) + Math.pow(e.position.y - playerPos.y, 2)) <= 2
    );

    currentEntities = calculateFissionShockwave(playerPos, currentEntities, 2);

    // --- EMISSION LOGIC ---
    // Use the remaining neutrons from the chain reaction
    const emissions: EntityType[] = new Array(finalNeutronCount).fill(EntityType.NEUTRON);

    let energyBonus = 200;
    let score = BONUS_SCORES.FISSION_TITLE;
    const messages: string[] = [];

    if (chainResult.chainReactionCount > 0) {
        messages.push(LOG_MESSAGES.PHYSICS.FISSION_CHAIN_REACTION_TRIGGERED(chainResult.chainReactionCount));
    }

    if (antisInBlast.length > 0) {
        energyBonus += 1000;
        score += Math.floor(940 * currentNuclide.a);
        messages.push(LOG_MESSAGES.PHYSICS.ANTI_NUCLIDE_PURGED_FISSION);
    }

    // Prepare byproduct data if it is a physically plausible nucleus
    const byproduct = (byproductZ > 0 && byproductA >= byproductZ) 
        ? { z: byproductZ, a: byproductA } 
        : undefined;

    return {
        dZ, dA, trigger: HISTORY_METHODS.FISSION_SPONTANEOUS, shouldShake: true, shouldFlash: true,
        flashColor: 'bg-yellow-400',
        speechOverride: LOG_MESSAGES.HISTORY.NUCLEAR_FISSION, actionBonusScore: score, energyBonus, newGridEntities: currentEntities,
        extraMessages: messages,
        emissions, // Return list of particles to be spawned by engine
        byproduct,  // Procedure 2: Secondary fragment for conservation
        defeatedNuclides: [...antisInBlast, ...enemiesInBlast],
        chainReactionPath
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
    if (!fissionEnabled) {
        if (mode === DecayMode.SPONTANEOUS_FISSION) {
            effectiveMode = DecayMode.ALPHA;
        } else if (mode === DecayMode.B_MINUS_SF) {
            effectiveMode = DecayMode.B_MINUS_ALPHA;
        } else if (mode === DecayMode.EC_SF) {
            effectiveMode = DecayMode.EC_ALPHA;
        }
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
        case DecayMode.DOUBLE_BETA_MINUS:
            Object.assign(result, handleBetaMinus(playerPos, gridEntities, currentTime, neutronStarEnabled));
            result.trigger = LOG_MESSAGES.HISTORY.DOUBLE_BETA_MINUS;
            break;
        case DecayMode.BETA_PLUS: 
            Object.assign(result, handleBetaPlus(playerPos, gridEntities, currentTime, annihilationEnabled));
            break;
        case DecayMode.EC_B_PLUS:
            // EC/B+ combined mode - should have been resolved by controller, but handle here as fallback
            if (Math.random() < 0.5) {
                result.trigger = LOG_MESSAGES.HISTORY.ELECTRON_CAPTURE;
                result.newPosition = { x: Math.floor(Math.random() * GRID_WIDTH), y: Math.floor(Math.random() * GRID_HEIGHT) };
                result.shouldShake = true;
                result.extraMessages.push(LOG_MESSAGES.PHYSICS.UNCERTAINTY_POSITION);
                result.additionalEffects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.ELECTRON_CAPTURE, position: { ...result.newPosition }, timestamp: currentTime });
            } else {
                Object.assign(result, handleBetaPlus(playerPos, gridEntities, currentTime, annihilationEnabled));
            }
            break;
        case DecayMode.DOUBLE_BETA_PLUS:
            Object.assign(result, handleBetaPlus(playerPos, gridEntities, currentTime, annihilationEnabled));
            result.trigger = LOG_MESSAGES.HISTORY.DOUBLE_BETA_PLUS;
            break;
        case DecayMode.ELECTRON_CAPTURE: 
             result.trigger = LOG_MESSAGES.HISTORY.ELECTRON_CAPTURE;
             result.newPosition = { x: Math.floor(Math.random() * GRID_WIDTH), y: Math.floor(Math.random() * GRID_HEIGHT) };
             result.shouldShake = true;
             result.shakeIntensity = 'light';
             result.extraMessages.push(LOG_MESSAGES.PHYSICS.UNCERTAINTY_POSITION);
             result.additionalEffects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.ELECTRON_CAPTURE, position: { ...result.newPosition }, timestamp: currentTime });
             break;
        case DecayMode.DOUBLE_ELECTRON_CAPTURE:
             result.trigger = LOG_MESSAGES.HISTORY.DOUBLE_ELECTRON_CAPTURE;
             result.newPosition = { x: Math.floor(Math.random() * GRID_WIDTH), y: Math.floor(Math.random() * GRID_HEIGHT) };
             result.shouldShake = true;
             result.shakeIntensity = 'light';
             result.extraMessages.push(LOG_MESSAGES.PHYSICS.DOUBLE_UNCERTAINTY);
             result.additionalEffects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.ELECTRON_CAPTURE, position: { ...result.newPosition }, timestamp: currentTime });
             break;
        case DecayMode.PROTON_EMISSION: 
            result.trigger = LOG_MESSAGES.HISTORY.PROTON_EMISSION; 
            result.emissions = [EntityType.PROTON];
            break;
        case DecayMode.TWO_PROTON_EMISSION:
            result.trigger = LOG_MESSAGES.HISTORY.TWO_PROTON_EMISSION;
            result.emissions = [EntityType.PROTON, EntityType.PROTON];
            break;
        case DecayMode.NEUTRON_EMISSION: 
            result.trigger = LOG_MESSAGES.HISTORY.NEUTRON_EMISSION; 
            result.emissions = [EntityType.NEUTRON];
            break;
        case DecayMode.TWO_NEUTRON_EMISSION:
            result.trigger = LOG_MESSAGES.HISTORY.TWO_NEUTRON_EMISSION;
            result.emissions = [EntityType.NEUTRON, EntityType.NEUTRON];
            break;
        case DecayMode.DEUTERON_EMISSION:
            result.trigger = LOG_MESSAGES.HISTORY.DEUTERON_EMISSION;
            result.emissions = [EntityType.PROTON, EntityType.NEUTRON];
            break;
        case DecayMode.TRITON_EMISSION:
            result.trigger = LOG_MESSAGES.HISTORY.TRITON_EMISSION;
            result.emissions = [EntityType.PROTON, EntityType.NEUTRON, EntityType.NEUTRON];
            break;
        case DecayMode.HELIUM3_EMISSION:
            result.trigger = LOG_MESSAGES.HISTORY.HELIUM3_EMISSION;
            result.emissions = [EntityType.PROTON, EntityType.PROTON, EntityType.NEUTRON];
            break;
        case DecayMode.IT:
            result.trigger = LOG_MESSAGES.HISTORY.ISOMERIC_TRANSITION;
            result.actionBonusScore = BONUS_SCORES.GAMMA_ACTION;
            result.additionalEffects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.GAMMA_RAY_UP, position: { ...playerPos }, timestamp: currentTime });
            break;
        case DecayMode.B_MINUS_N:
        case DecayMode.B_MINUS_2N:
        case DecayMode.B_MINUS_3N:
        case DecayMode.B_MINUS_4N:
        case DecayMode.B_MINUS_5N:
        case DecayMode.B_MINUS_6N:
        case DecayMode.B_MINUS_7N:
            const nMatch = mode.match(/(\d)N/);
            const nCount = nMatch ? parseInt(nMatch[1]) : 1;
            Object.assign(result, handleBetaMinus(playerPos, gridEntities, currentTime, neutronStarEnabled));
            result.trigger = LOG_MESSAGES.HISTORY.B_MINUS_DELAYED_N(nCount);
            result.emissions = new Array(nCount).fill(EntityType.NEUTRON);
            break;
        case DecayMode.B_MINUS_ALPHA:
            Object.assign(result, handleBetaMinus(playerPos, gridEntities, currentTime, neutronStarEnabled));
            result.trigger = LOG_MESSAGES.HISTORY.B_MINUS_DELAYED_ALPHA;
            result.energyBonus = 5;
            break;
        case DecayMode.B_MINUS_PROTON:
            Object.assign(result, handleBetaMinus(playerPos, gridEntities, currentTime, neutronStarEnabled));
            result.trigger = LOG_MESSAGES.HISTORY.B_MINUS_DELAYED_PROTON;
            result.emissions = [EntityType.PROTON];
            break;
        case DecayMode.B_MINUS_SF:
            Object.assign(result, handleBetaMinus(playerPos, gridEntities, currentTime, neutronStarEnabled));
            const bMinusFission = handleSpontaneousFission(currentNuclide, playerPos, result.newGridEntities, currentTime);
            Object.assign(result, bMinusFission);
            result.trigger = LOG_MESSAGES.HISTORY.B_MINUS_DELAYED_FISSION;
            break;
        case DecayMode.B_PLUS_ALPHA:
            Object.assign(result, handleBetaPlus(playerPos, gridEntities, currentTime, annihilationEnabled));
            result.trigger = LOG_MESSAGES.HISTORY.B_PLUS_DELAYED_ALPHA;
            result.energyBonus = 5;
            break;
        case DecayMode.B_PLUS_PROTON:
            Object.assign(result, handleBetaPlus(playerPos, gridEntities, currentTime, annihilationEnabled));
            result.trigger = LOG_MESSAGES.HISTORY.B_PLUS_DELAYED_PROTON;
            result.emissions = [EntityType.PROTON];
            break;
        case DecayMode.B_PLUS_2PROTON:
            Object.assign(result, handleBetaPlus(playerPos, gridEntities, currentTime, annihilationEnabled));
            result.trigger = LOG_MESSAGES.HISTORY.B_PLUS_DELAYED_2PROTON;
            result.emissions = [EntityType.PROTON, EntityType.PROTON];
            break;
        case DecayMode.EC_ALPHA:
            result.trigger = LOG_MESSAGES.HISTORY.EC_DELAYED_ALPHA;
            result.energyBonus = 5;
            break;
        case DecayMode.EC_PROTON:
            result.trigger = LOG_MESSAGES.HISTORY.EC_DELAYED_PROTON;
            result.emissions = [EntityType.PROTON];
            break;
        case DecayMode.EC_2PROTON:
            result.trigger = LOG_MESSAGES.HISTORY.EC_DELAYED_2PROTON;
            result.emissions = [EntityType.PROTON, EntityType.PROTON];
            break;
        case DecayMode.EC_SF:
            const ecFission = handleSpontaneousFission(currentNuclide, playerPos, gridEntities, currentTime);
            Object.assign(result, ecFission);
            result.trigger = LOG_MESSAGES.HISTORY.EC_DELAYED_FISSION;
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