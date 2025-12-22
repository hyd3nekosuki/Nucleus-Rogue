
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

// Extract delta logic for use in prediction/random search
export const getDecayDeltas = (mode: DecayMode): { dZ: number, dA: number } => {
    switch (mode) {
        case DecayMode.ALPHA: return { dZ: -2, dA: -4 };
        case DecayMode.BETA_MINUS: return { dZ: 1, dA: 0 };
        case DecayMode.BETA_PLUS: return { dZ: -1, dA: 0 };
        case DecayMode.ELECTRON_CAPTURE: return { dZ: -1, dA: 0 };
        case DecayMode.PROTON_EMISSION: return { dZ: -1, dA: -1 };
        case DecayMode.NEUTRON_EMISSION: return { dZ: 0, dA: -1 };
        case DecayMode.SPONTANEOUS_FISSION: return { dZ: 0, dA: 0 }; // Special handling in calc
        default: return { dZ: 0, dA: 0 };
    }
};

export const calculateDecayEffects = (
    mode: DecayMode,
    gameState: GameState,
    currentTime: number,
    annihilationEnabled: boolean = true
): DecayResult => {
    const { dZ, dA } = getDecayDeltas(mode);
    
    // Default trigger text
    let trigger = mode.toString().replace(/_/g, ' ').toLowerCase();
    
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

    // Custom logic overrides per mode
    switch (mode) {
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

            if (neighborProtons.length > 0) {
                const targetProton = neighborProtons[Math.floor(Math.random() * neighborProtons.length)];
                const targetIndex = currentEntities.findIndex(e => e.id === targetProton.id);

                if (targetIndex !== -1) {
                    currentEntities[targetIndex] = { ...targetProton, type: EntityType.NEUTRON };
                    
                    additionalEffects.push({
                        id: Math.random().toString(36).substr(2, 9),
                        type: DecayMode.ELECTRON_CAPTURE, 
                        position: { ...targetProton.position },
                        timestamp: currentTime
                    });
                    
                    actionBonusScore += 1000;
                    extraMessages.push("⚡ p + e- → n (+1000 PTS)");
                }
            }
            break;
        case DecayMode.BETA_PLUS: 
            trigger = "β+ decay"; 
            shouldFlash = false;
            
            // Annihilation only triggers if skill is enabled and unlocked
            const nearbyElectrons = currentEntities.filter(e => {
                if (e.type !== EntityType.ENEMY_ELECTRON) return false;
                const dx = Math.abs(e.position.x - gameState.playerPos.x);
                const dy = Math.abs(e.position.y - gameState.playerPos.y);
                return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
            });

            if (nearbyElectrons.length > 0 && annihilationEnabled) {
                const target = nearbyElectrons[Math.floor(Math.random() * nearbyElectrons.length)];
                currentEntities = currentEntities.filter(e => e.id !== target.id);
                
                const isHorizontal = target.position.y === gameState.playerPos.y;
                
                currentEntities = currentEntities.map(e => {
                    if (isHorizontal) {
                        if (e.position.y === gameState.playerPos.y) return { ...e, isHighEnergy: true };
                    } else {
                        if (e.position.x === gameState.playerPos.x) return { ...e, isHighEnergy: true };
                    }
                    return e;
                });

                additionalEffects.push({
                    id: Math.random().toString(36).substr(2, 9),
                    type: isHorizontal ? DecayMode.GAMMA_RAY_H : DecayMode.GAMMA_RAY_V,
                    position: { ...target.position },
                    timestamp: currentTime
                });

                additionalEffects.push({
                    id: Math.random().toString(36).substr(2, 9),
                    type: DecayMode.SPONTANEOUS_FISSION,
                    position: { ...target.position },
                    timestamp: currentTime
                });
                actionBonusScore += 20000;
                extraMessages.push("💥 ANNIHILATION! Gamma rays excited nearby particles! (+20000 PTS)");
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
             
             additionalEffects.push({
                id: Math.random().toString(36).substr(2, 9),
                type: DecayMode.ELECTRON_CAPTURE,
                position: { x: targetX, y: targetY },
                timestamp: currentTime
             });
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
             
             const directions = [
                 { mode: DecayMode.GAMMA_RAY_UP, label: "UP" },
                 { mode: DecayMode.GAMMA_RAY_DOWN, label: "DOWN" },
                 { mode: DecayMode.GAMMA_RAY_LEFT, label: "LEFT" },
                 { mode: DecayMode.GAMMA_RAY_RIGHT, label: "RIGHT" }
             ];
             const selected = directions[Math.floor(Math.random() * directions.length)];
             
             extraMessages.push(`✨ GAMMA LASER ${selected.label}! (+5000 PTS)`);
             
             additionalEffects.push({ 
                 id: Math.random().toString(36).substr(2, 9),
                 type: selected.mode, 
                 position: { ...gameState.playerPos }, 
                 timestamp: currentTime
             });
             break;
        case DecayMode.SPONTANEOUS_FISSION: 
             const parentZ = gameState.currentNuclide.z;
             const parentA = gameState.currentNuclide.a;

             if (parentA < 5 || parentZ < 3) {
                 extraMessages.push("Nucleus too small for fission!");
                 trigger = "Fizzle";
                 return { dZ: 0, dA: 0, trigger, actionBonusScore: 0, energyBonus: 0, extraMessages, additionalEffects, newGridEntities: currentEntities, isAnnihilation: false, shouldShake: false, shouldFlash: false, speechOverride: null };
             }

             const remainingA = Math.max(1, parentA - 2);
             const heavyA = Math.floor(remainingA * 0.6);
             const heavyZ = Math.floor(parentZ * 0.6);
             
             const finalDZ = heavyZ - parentZ;
             const finalDA = heavyA - parentA;
             
             trigger = "Spontaneous fission";
             actionBonusScore += 2000000;
             energyBonus = 200;
             extraMessages.push("☢️ 2 Neutrons were emitted (+2,000,000 PTS, +200E)");

             const adjacents = [];
             for(let dx=-1; dx<=1; dx++){
                 for(let dy=-1; dy<=1; dy++){
                     if(dx===0 && dy===0) continue;
                     const tx = gameState.playerPos.x + dx;
                     const ty = gameState.playerPos.y + dy;
                     if(tx>=0 && tx<GRID_WIDTH && ty>=0 && ty<GRID_HEIGHT) {
                         adjacents.push({x: tx, y: ty});
                     }
                 }
             }
             for (let i = adjacents.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [adjacents[i], adjacents[j]] = [adjacents[j], adjacents[i]];
             }
             const neutronSpots = adjacents.slice(0, 2);
             
             neutronSpots.forEach(spot => {
                  const idx = currentEntities.findIndex(e => e.position.x === spot.x && e.position.y === spot.y);
                  if(idx !== -1) currentEntities.splice(idx, 1);
                  
                  currentEntities.push({
                      id: Math.random().toString(36).substr(2, 9),
                      type: EntityType.NEUTRON,
                      position: spot,
                      spawnTurn: gameState.turn,
                      isHighEnergy: false
                  });
             });

             return {
                dZ: finalDZ,
                dA: finalDA,
                trigger,
                actionBonusScore,
                energyBonus,
                extraMessages,
                additionalEffects,
                newGridEntities: currentEntities,
                shouldShake: true,
                shouldFlash: true, 
                speechOverride: null,
                isAnnihilation: false
             };
    }

    return {
        dZ, dA, trigger, actionBonusScore, energyBonus, extraMessages, additionalEffects, newGridEntities: currentEntities, shouldShake, shouldFlash, speechOverride, isAnnihilation, newPosition
    };
};
