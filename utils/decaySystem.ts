
import { GameState, DecayMode, EntityType, GridEntity, VisualEffect, Position } from '../types';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants';

export interface DecayResult {
    dZ: number;
    dA: number;
    trigger: string;
    actionBonusScore: number;
    energyBonus: number; // For ALPHA decay
    extraMessages: string[];
    additionalEffects: VisualEffect[];
    newGridEntities: GridEntity[];
    shouldShake: boolean;
    shouldFlash: boolean;
    speechOverride: string | null;
    isAnnihilation?: boolean;
    newPosition?: Position; // Teleportation target
}

/**
 * Box-Muller transform for generating Gaussian random numbers
 */
const gaussianRandom = (mean: number, std: number): number => {
    const u = 1 - Math.random();
    const v = 1 - Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * std + mean;
};

/**
 * Calculates a fission fragment using a Double-Gaussian model.
 * As parents get heavier (A > 240), fission becomes more symmetric.
 */
const getFissionFragment = (parentZ: number, parentA: number): { z: number, a: number } => {
    const promptNeutrons = 2; // Prompt neutrons emitted
    const totalA = parentA - promptNeutrons;
    const midPointA = totalA / 2;
    
    // Standard asymmetric heavy peak is around A=140 (shell effect)
    const standardHeavyPeak = 140;
    
    // Asymmetry weakens for superheavy elements
    const startSymmetryA = 240;
    const maxSymmetryA = 280;
    
    let s = 0; 
    if (parentA > startSymmetryA) {
        s = Math.min(1.0, (parentA - startSymmetryA) / (maxSymmetryA - startSymmetryA));
    }
    
    let meanHeavy = (1 - s) * standardHeavyPeak + s * midPointA;
    if (totalA < 200) meanHeavy = Math.max(midPointA, totalA * 0.6);
    
    const meanLight = totalA - meanHeavy;
    const sigma = 6.5; 
    
    const isHeavy = Math.random() > 0.5;
    const targetMean = isHeavy ? meanHeavy : meanLight;
    
    let fragA = Math.round(gaussianRandom(targetMean, sigma));
    fragA = Math.max(1, Math.min(totalA - 1, fragA));
    
    // Unchanged Charge Density (UCD) hypothesis: FragZ / FragA = ParentZ / ParentA
    const fragZ = Math.round(fragA * (parentZ / parentA));
    
    return { z: Math.max(1, fragZ), a: fragA };
};

// Extract delta logic
export const getDecayDeltas = (mode: DecayMode): { dZ: number, dA: number } => {
    switch (mode) {
        case DecayMode.ALPHA: return { dZ: -2, dA: -4 };
        case DecayMode.BETA_MINUS: return { dZ: 1, dA: 0 };
        case DecayMode.BETA_PLUS: return { dZ: -1, dA: 0 };
        case DecayMode.ELECTRON_CAPTURE: return { dZ: -1, dA: 0 };
        case DecayMode.PROTON_EMISSION: return { dZ: -1, dA: -1 };
        case DecayMode.NEUTRON_EMISSION: return { dZ: 0, dA: -1 };
        case DecayMode.SPONTANEOUS_FISSION: return { dZ: -38, dA: -96 }; // Representative jump
        default: return { dZ: 0, dA: 0 };
    }
};

export const calculateDecayEffects = (
    mode: DecayMode,
    gameState: GameState,
    currentTime: number,
    annihilationEnabled: boolean = true,
    fissionEnabled: boolean = true
): DecayResult => {
    let effectiveMode = mode;
    if (mode === DecayMode.SPONTANEOUS_FISSION && !fissionEnabled) {
        effectiveMode = DecayMode.ALPHA;
    }

    let { dZ, dA } = getDecayDeltas(effectiveMode);
    
    let trigger = effectiveMode.toString().replace(/_/g, ' ').toLowerCase();
    
    let actionBonusScore = 0;
    let energyBonus = 0;
    const additionalEffects: VisualEffect[] = [];
    const extraMessages: string[] = [];
    let currentEntities = [...gameState.gridEntities];
    let shouldShake = false;
    let shouldFlash = false;
    let speechOverride = null;
    let isAnnihilation = false;
    let newPosition: Position | undefined = undefined;

    switch (effectiveMode) {
        case DecayMode.ALPHA: 
            trigger = "α decay";
            energyBonus = 5; 
            shouldFlash = false; 
            break;
        case DecayMode.BETA_MINUS: 
            trigger = "β- decay"; 
            shouldFlash = false;
            const neighborProtons = currentEntities.filter(e => {
                if (e.type !== EntityType.PROTON) return false;
                const dx = Math.abs(e.position.x - gameState.playerPos.x);
                const dy = Math.abs(e.position.y - gameState.playerPos.y);
                return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
            });
            const neighborPositrons = currentEntities.filter(e => {
                if (e.type !== EntityType.ENEMY_POSITRON) return false;
                const dx = Math.abs(e.position.x - gameState.playerPos.x);
                const dy = Math.abs(e.position.y - gameState.playerPos.y);
                return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
            });
            if (neighborProtons.length > 0) {
                const targetProton = neighborProtons[Math.floor(Math.random() * neighborProtons.length)];
                const targetIndex = currentEntities.findIndex(e => e.id === targetProton.id);
                if (targetIndex !== -1) {
                    currentEntities[targetIndex] = { ...targetProton, type: EntityType.NEUTRON };
                    additionalEffects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.ELECTRON_CAPTURE, position: { ...targetProton.position }, timestamp: currentTime });
                    actionBonusScore += 1000;
                    extraMessages.push("⚡ p + e- → n ? (+1000 PTS)");
                }
            } else if (neighborPositrons.length > 0 && annihilationEnabled) {
                const target = neighborPositrons[Math.floor(Math.random() * neighborPositrons.length)];
                currentEntities = currentEntities.filter(e => e.id !== target.id);
                const dx = target.position.x - gameState.playerPos.x;
                const dy = target.position.y - gameState.playerPos.y;
                const isHorizontal = dy === 0;
                const isVertical = dx === 0;
                const isDiag1 = dx === dy; 
                const isDiag2 = dx === -dy; 
                currentEntities = currentEntities.map(e => {
                    const edx = e.position.x - gameState.playerPos.x;
                    const edy = e.position.y - gameState.playerPos.y;
                    let onLine = false;
                    if (isHorizontal && edy === 0) onLine = true;
                    else if (isVertical && edx === 0) onLine = true;
                    else if (isDiag1 && edx === edy) onLine = true;
                    else if (isDiag2 && edx === -edy) onLine = true;
                    if (onLine) return { ...e, isHighEnergy: true };
                    return e;
                });
                let effectMode = isHorizontal ? DecayMode.GAMMA_RAY_H : DecayMode.GAMMA_RAY_V;
                if (isDiag1) effectMode = DecayMode.GAMMA_RAY_DIAG_TL_BR;
                else if (isDiag2) effectMode = DecayMode.GAMMA_RAY_DIAG_TR_BL;
                additionalEffects.push({ id: Math.random().toString(36).substr(2, 9), type: effectMode, position: { ...gameState.playerPos }, timestamp: currentTime });
                additionalEffects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.SPONTANEOUS_FISSION, position: { ...target.position }, timestamp: currentTime });
                actionBonusScore += 20000;
                extraMessages.push("💥 ANNIHILATION! Gamma rays may excite other particle (+20000 PTS)");
                speechOverride = "Pair Annihilation";
                isAnnihilation = true;
            }
            break;
        case DecayMode.BETA_PLUS: 
            trigger = "β+ decay"; 
            shouldFlash = false;
            const nearbyElectrons = currentEntities.filter(e => {
                if (e.type !== EntityType.ENEMY_ELECTRON) return false;
                const dx = Math.abs(e.position.x - gameState.playerPos.x);
                const dy = Math.abs(e.position.y - gameState.playerPos.y);
                return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
            });
            if (nearbyElectrons.length > 0 && annihilationEnabled) {
                const target = nearbyElectrons[Math.floor(Math.random() * nearbyElectrons.length)];
                currentEntities = currentEntities.filter(e => e.id !== target.id);
                const dx = target.position.x - gameState.playerPos.x;
                const dy = target.position.y - gameState.playerPos.y;
                const isHorizontal = dy === 0;
                const isVertical = dx === 0;
                const isDiag1 = dx === dy; 
                const isDiag2 = dx === -dy; 
                currentEntities = currentEntities.map(e => {
                    const edx = e.position.x - gameState.playerPos.x;
                    const edy = e.position.y - gameState.playerPos.y;
                    let onLine = false;
                    if (isHorizontal && edy === 0) onLine = true;
                    else if (isVertical && edx === 0) onLine = true;
                    else if (isDiag1 && edx === edy) onLine = true;
                    else if (isDiag2 && edx === -edy) onLine = true;
                    if (onLine) return { ...e, isHighEnergy: true };
                    return e;
                });
                let effectMode = isHorizontal ? DecayMode.GAMMA_RAY_H : DecayMode.GAMMA_RAY_V;
                if (isDiag1) effectMode = DecayMode.GAMMA_RAY_DIAG_TL_BR;
                else if (isDiag2) effectMode = DecayMode.GAMMA_RAY_DIAG_TR_BL;
                additionalEffects.push({ id: Math.random().toString(36).substr(2, 9), type: effectMode, position: { ...gameState.playerPos }, timestamp: currentTime });
                additionalEffects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.SPONTANEOUS_FISSION, position: { ...target.position }, timestamp: currentTime });
                actionBonusScore += 20000;
                extraMessages.push("💥 ANNIHILATION! Gamma rays may excite other particle (+20000 PTS)");
                speechOverride = "Pair Annihilation";
                isAnnihilation = true;
            }
            break;
        case DecayMode.ELECTRON_CAPTURE: 
             trigger = "Electron capture";
             const targetX = Math.floor(Math.random() * GRID_WIDTH);
             const targetY = Math.floor(Math.random() * GRID_HEIGHT);
             newPosition = { x: targetX, y: targetY };
             shouldShake = true;
             shouldFlash = false; 
             extraMessages.push("✨ Position relocated!");
             additionalEffects.push({ id: Math.random().toString(36).substr(2, 9), type: DecayMode.ELECTRON_CAPTURE, position: { x: targetX, y: targetY }, timestamp: currentTime });
             break;
        case DecayMode.PROTON_EMISSION: 
            trigger = "Proton emission"; 
            shouldFlash = false;
            break;
        case DecayMode.NEUTRON_EMISSION: 
            trigger = "Neutron emission"; 
            shouldFlash = false;
            break;
        case DecayMode.GAMMA:
             trigger = "Gamma decay";
             actionBonusScore += 5000;
             shouldFlash = false;
             const directions = [ { mode: DecayMode.GAMMA_RAY_UP, label: "UP" }, { mode: DecayMode.GAMMA_RAY_DOWN, label: "DOWN" }, { mode: DecayMode.GAMMA_RAY_LEFT, label: "LEFT" }, { mode: DecayMode.GAMMA_RAY_RIGHT, label: "RIGHT" } ];
             const selected = directions[Math.floor(Math.random() * directions.length)];
             extraMessages.push(`✨ GAMMA LASER ${selected.label}! (+5000 PTS)`);
             additionalEffects.push({ id: Math.random().toString(36).substr(2, 9), type: selected.mode, position: { ...gameState.playerPos }, timestamp: currentTime });
             break;
        case DecayMode.SPONTANEOUS_FISSION:
            trigger = "spontaneous fission";
            shouldShake = true;
            shouldFlash = true;
            speechOverride = "Nuclear Fission";
            actionBonusScore += 50000;
            energyBonus += 25;

            // FIX: Player transmutes into one of the fission fragments
            const fragment = getFissionFragment(gameState.currentNuclide.z, gameState.currentNuclide.a);
            dZ = fragment.z - gameState.currentNuclide.z;
            dA = fragment.a - gameState.currentNuclide.a;
            
            // Clear entities in radius 2 (destruction effect)
            currentEntities = currentEntities.filter(e => {
                const dist = Math.sqrt(Math.pow(e.position.x - gameState.playerPos.x, 2) + Math.pow(e.position.y - gameState.playerPos.y, 2));
                return dist > 2; 
            });
            break;
    }

    return {
        dZ, dA, trigger, actionBonusScore, energyBonus, extraMessages, additionalEffects, newGridEntities: currentEntities, shouldShake, shouldFlash, speechOverride, isAnnihilation, newPosition
    };
};
