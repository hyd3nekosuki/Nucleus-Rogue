
import { GridEntity, Position, EntityType, GameState, DecayMode, VisualEffect } from '../types';
import { GRID_WIDTH, GRID_HEIGHT, MAGIC_NUMBERS } from '../constants';
import { getNuclideDataSync } from '../services/nuclideService';
import { processUnlocks } from './unlockSystem';
import { calculateDecayEffects } from './decaySystem';

export interface MoveResult {
    moved: boolean;
    state: GameState;
    inducedDecayMode?: DecayMode;
    inducedReactionLabel?: string;
    shouldShake?: boolean;
    shouldFlash?: boolean;
    additionalEffects?: VisualEffect[];
    isPpFusion?: boolean;
    isPositronAbsorption?: boolean;
}

export const generateEntities = (count: number, currentEntities: GridEntity[], playerPos: Position, currentTurn: number = 0): GridEntity[] => {
    const newEntities = [...currentEntities];
    for (let i = 0; i < count; i++) {
        let pos: Position;
        let attempts = 0;
        do {
          pos = { x: Math.floor(Math.random() * GRID_WIDTH), y: Math.floor(Math.random() * GRID_HEIGHT) };
          attempts++;
        } while (
            (pos.x === playerPos.x && pos.y === playerPos.y) || 
            newEntities.some(e => e.position.x === pos.x && e.position.y === pos.y) && attempts < 10
        );

        const rand = Math.random();
        newEntities.push({
          id: Math.random().toString(36).substr(2, 9),
          type: rand > 0.9 ? EntityType.ENEMY_ELECTRON : (rand > 0.5 ? EntityType.PROTON : EntityType.NEUTRON),
          position: pos,
          spawnTurn: currentTurn,
          isHighEnergy: false
        });
    }
    return newEntities;
};

export const calculateMoveResult = (
    prev: GameState,
    dx: number,
    dy: number,
    COULOMB_BARRIER_THRESHOLD: number,
    ENERGY_EVOLUTION_TURNS: number,
    playerLevel: number = 0
): MoveResult => {
    const newX = prev.playerPos.x + dx;
    const newY = prev.playerPos.y + dy;

    if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) return { moved: false, state: prev };

    const entityIndex = prev.gridEntities.findIndex(e => e.position.x === newX && e.position.y === newY);
    let dZ = 0, dA = 0, hpPenalty = 0;
    let chainDecayResult: any = null;
    let chainReactionLabel = "";
    let inducedDecayMode: DecayMode | undefined = undefined;
    let magicProtectionBonus = 0;
    let scatteredMessage = "";
    let isPpFusion = false;
    let isPositronAbsorption = false;
    let isCoulombScattered = false;
    let isBremsAchieved = false;
    
    let nextEntities = [...prev.gridEntities];

    const annihilationEnabled = !prev.disabledSkills.includes("Pair anihilation");
    const isFissionDisabled = prev.disabledSkills.includes("Fission");

    let cP = prev.consecutiveProtons;
    let cN = prev.consecutiveNeutrons;
    let cE = prev.consecutiveElectrons;
    let lT = prev.lastConsumedType;

    if (entityIndex !== -1) {
        const entity = prev.gridEntities[entityIndex];

        if (entity.type === EntityType.ENEMY_POSITRON && prev.currentNuclide.z !== 0) {
            return { moved: false, state: prev };
        }

        const isMagic = playerLevel >= 1 && MAGIC_NUMBERS.includes(prev.currentNuclide.z);
        nextEntities.splice(entityIndex, 1);

        if (entity.type === EntityType.PROTON) {
            if (lT === EntityType.PROTON) cP++;
            else { cP = 1; cN = 0; cE = 0; lT = EntityType.PROTON; }
        } else if (entity.type === EntityType.NEUTRON) {
            if (lT === EntityType.NEUTRON) cN++;
            else { cP = 0; cN = 1; cE = 0; lT = EntityType.NEUTRON; }
        } else if (entity.type === EntityType.ENEMY_ELECTRON) {
            if (lT === EntityType.ENEMY_ELECTRON) cE++;
            else { cP = 0; cN = 0; cE = 1; lT = EntityType.ENEMY_ELECTRON; }
        }

        if (entity.type === EntityType.PROTON) { 
            const isFusionDisabled = prev.disabledSkills.includes("Fusion");
            if (isFusionDisabled) {
                dZ = 0; dA = 0;
                scatteredMessage = "Proton was blocked by Coulomb barrier";
            } else {
                if (prev.currentNuclide.z === 1 && prev.currentNuclide.a === 1 && entity.isHighEnergy) {
                    isPpFusion = true;
                    dZ = 0; dA = 1; 
                    nextEntities.push({ id: 'pp-fusion-eplus-' + Math.random().toString(36).substr(2, 9), type: EntityType.ENEMY_POSITRON, position: { ...prev.playerPos }, spawnTurn: prev.turn, isHighEnergy: false });
                }
                // Deflection logic tied to "Coulomb barrier" skill removed.
                else if (isMagic || entity.isHighEnergy || prev.currentNuclide.z === 0) { 
                    dZ = 1; dA = 1; 
                    if (isMagic && !entity.isHighEnergy) magicProtectionBonus = prev.currentNuclide.z * 10000;
                }
                else if (prev.hp > COULOMB_BARRIER_THRESHOLD) { 
                    hpPenalty = 20; dZ = 1; dA = 1; 
                }
                else { 
                    isCoulombScattered = true;
                    scatteredMessage = "Proton was scattered by Coulomb barrier";
                }
                if (isCoulombScattered) {
                    let respawnPos: Position;
                    let attempts = 0;
                    do { respawnPos = { x: Math.floor(Math.random() * GRID_WIDTH), y: Math.floor(Math.random() * GRID_HEIGHT) }; attempts++; } while ( (respawnPos.x === newX && respawnPos.y === newY) || nextEntities.some(e => e.position.x === respawnPos.x && e.position.y === respawnPos.y) && attempts < 10 );
                    nextEntities.push({ id: Math.random().toString(36).substr(2, 9), type: EntityType.PROTON, position: respawnPos, spawnTurn: prev.turn, isHighEnergy: false });
                }
            }
        } else if (entity.type === EntityType.NEUTRON) { 
            const isZeroBarnActive = prev.unlockedGroups.includes("zero barn") && !prev.disabledSkills.includes("zero barn");
            if (isZeroBarnActive) {
                dZ = 0; dA = 0;
                scatteredMessage = "No reaction to neutron";
            } else {
                dZ = 0; dA = 1; 
                if (entity.isHighEnergy) {
                    const intermediateData = getNuclideDataSync(prev.currentNuclide.z, prev.currentNuclide.a + 1);
                    if (intermediateData.exists) {
                        const tempState = { ...prev, playerPos: { x: newX, y: newY }, currentNuclide: intermediateData, gridEntities: nextEntities };
                        const options = [{ mode: DecayMode.GAMMA, label: "(n,γ)" }, { mode: DecayMode.PROTON_EMISSION, label: "(n,p)" }, { mode: DecayMode.NEUTRON_EMISSION, label: "(n,2n)" }];
                        if (intermediateData.z >= 92) {
                            if (isFissionDisabled) options.push({ mode: DecayMode.ALPHA, label: "(n,α)" });
                            else options.push({ mode: DecayMode.SPONTANEOUS_FISSION, label: "(n,fission)" });
                        }
                        const chosen = options[Math.floor(Math.random() * options.length)];
                        chainDecayResult = calculateDecayEffects(chosen.mode, tempState, Date.now(), annihilationEnabled, !isFissionDisabled);
                        chainReactionLabel = chosen.label;
                        inducedDecayMode = chosen.mode;

                        if (chosen.mode === DecayMode.SPONTANEOUS_FISSION) {
                            dZ = chainDecayResult.dZ;
                            dA = 1 + chainDecayResult.dA; 
                        } else if (chosen.mode === DecayMode.PROTON_EMISSION) {
                            dZ = -1; dA = 0; 
                        } else if (chosen.mode === DecayMode.NEUTRON_EMISSION) {
                            dZ = 0; dA = -1; 
                        } else {
                            dZ = chainDecayResult.dZ;
                            dA = 1 + chainDecayResult.dA;
                        }
                    }
                }
            }
        } else if (entity.type === EntityType.ENEMY_ELECTRON) { 
            const bremsActive = prev.unlockedGroups.includes("Bremsstrahlung") && !prev.disabledSkills.includes("Bremsstrahlung");
            if (bremsActive) {
                dZ = 0; dA = 0;
                scatteredMessage = "Electron emission (Bremsstrahlung) prevents capture";
            } else {
                // BREMSSTRAHLUNG CONDITION: HP <= 10 AND consecutive electron capture count >= 5
                if (prev.hp <= 10 && cE >= 5) {
                    isBremsAchieved = true;
                }

                if (isMagic || entity.isHighEnergy) { 
                    dZ = -1; dA = 0; 
                    if (isMagic && !entity.isHighEnergy) magicProtectionBonus = prev.currentNuclide.z * 10000;
                } else { 
                    hpPenalty = prev.hp * 0.5; dZ = -1; dA = 0; 
                }
            }
        } else if (entity.type === EntityType.ENEMY_POSITRON) {
            isPositronAbsorption = true; dZ = 1; dA = 0;
        }
    }

    const potentialZ = prev.currentNuclide.z + dZ;
    const potentialA = prev.currentNuclide.a + dA;
    const evolvedEntities = (chainDecayResult?.newGridEntities || nextEntities).map(e => {
        if (!e.isHighEnergy && (e.type === EntityType.PROTON || e.type === EntityType.ENEMY_ELECTRON) && (prev.turn + 1) - e.spawnTurn >= ENERGY_EVOLUTION_TURNS) return { ...e, isHighEnergy: true };
        return e;
    });

    let nextState = { ...prev, playerPos: { x: newX, y: newY }, gridEntities: evolvedEntities, turn: prev.turn + 1, consecutiveProtons: cP, consecutiveNeutrons: cN, consecutiveElectrons: cE, lastConsumedType: lT };

    if (dZ !== 0 || dA !== 0 || chainDecayResult || isCoulombScattered || isPpFusion || isPositronAbsorption) {
        const newData = (dZ === 0 && dA === 0 && !isPpFusion && !isPositronAbsorption) ? prev.currentNuclide : getNuclideDataSync(potentialZ, potentialA);
        if (newData.exists) {
            const isFissionAchieved = inducedDecayMode === DecayMode.SPONTANEOUS_FISSION;
            const isZeroBarnAchieved = cN >= 20 && !prev.unlockedGroups.includes("zero barn");
            const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, potentialZ, potentialA, false, false, false, false, 0, isCoulombScattered, isPpFusion, isFissionAchieved, isZeroBarnAchieved, isBremsAchieved);
            const protectionMsg = magicProtectionBonus > 0 ? [`✨ ${isPositronAbsorption ? 'POSITRON CAPTURE' : 'MAGIC SHELL PROTECTION'}: +${magicProtectionBonus.toLocaleString()} PTS`] : [];
            const fusionMsg = isPpFusion ? ["✨ STELLAR FUSION: p + p → D + e+ (+420,000 PTS)"] : [];
            let coreMsg = scatteredMessage && !isPositronAbsorption ? `⚠️ ${scatteredMessage}` : isPpFusion ? `Fusion: Deuterium Synthesized.` : isPositronAbsorption ? `Positron capture: Transmuted to ${newData.name}.` : `${chainReactionLabel ? chainReactionLabel + ' reaction' : 'Transformation'} into ${newData.name}.`;
            const messages = [...prev.messages, coreMsg, ...fusionMsg, ...protectionMsg, ...unlockResult.messages].slice(-5);
            nextState = { ...nextState, currentNuclide: newData, unlockedElements: unlockResult.updatedElements, unlockedGroups: unlockResult.updatedGroups, messages, energyPoints: prev.energyPoints + (chainDecayResult?.energyBonus || 0), score: nextState.score + (newData.a * 10) + (newData.isStable ? 200 : 10) + (chainDecayResult?.actionBonusScore || 0) + unlockResult.scoreBonus + magicProtectionBonus + (isPpFusion ? 420000 : 0), hp: Math.min(prev.maxHp, Math.max(0, prev.hp + (newData.isStable ? 10 : 0) - hpPenalty)) };
            if (nextState.hp <= 0) { 
                if (nextState.unlockedGroups.includes("Temporal Inversion") && !nextState.disabledSkills.includes("Temporal Inversion") && nextState.energyPoints >= 5) {
                    // Handled in App.tsx moveStep but we check here to prevent game over in logic if possible
                } else {
                    nextState.gameOver = true; nextState.gameOverReason = "TRANSFORMATION_SHOCK"; nextState.combo = 0; 
                }
            }
            if (newData.isStable && (dZ !== 0 || dA !== 0 || isPpFusion || isPositronAbsorption)) nextState.combo = 0;
        } else {
            // BREMSSTRAHLUNG: Allow unlock even if transmutation fails (e.g. Z=-1)
            if (isBremsAchieved) {
                const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, potentialZ, potentialA, false, false, false, false, 0, false, false, false, false, true);
                nextState.unlockedGroups = unlockResult.updatedGroups;
                nextState.score += unlockResult.scoreBonus;
                nextState.messages = [...nextState.messages, ...unlockResult.messages].slice(-5);
            }
            nextState.hp = Math.max(0, prev.hp - hpPenalty);
            if (nextState.hp <= 0 && hpPenalty > 0) { 
                if (nextState.unlockedGroups.includes("Temporal Inversion") && !nextState.disabledSkills.includes("Temporal Inversion") && nextState.energyPoints >= 5) {
                   // Survival by Temporal Inversion
                } else {
                    nextState.gameOver = true; nextState.gameOverReason = "PARTICLE_COLLISION"; nextState.combo = 0; 
                }
            }
        }
    } else {
        if (nextState.currentNuclide.isStable) nextState.hp = Math.min(prev.maxHp, prev.hp + 1);
        const isZeroBarnAchieved = cN >= 20 && !prev.unlockedGroups.includes("zero barn");
        if (isZeroBarnAchieved) {
            const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, prev.currentNuclide.z, prev.currentNuclide.a, false, false, false, false, 0, false, false, false, true);
            nextState = { ...nextState, unlockedGroups: unlockResult.updatedGroups, messages: [...prev.messages, ...unlockResult.messages].slice(-5), score: nextState.score + unlockResult.scoreBonus };
        }
        if (scatteredMessage) nextState.messages = [...nextState.messages, `ℹ ${scatteredMessage}`].slice(-5);
    }

    if (Math.random() < 0.15) nextState.gridEntities = generateEntities(1, nextState.gridEntities, nextState.playerPos, nextState.turn);
    return { moved: true, state: nextState, inducedDecayMode, inducedReactionLabel: chainReactionLabel, shouldShake: chainDecayResult?.shouldShake || isCoulombScattered || isPpFusion || isPositronAbsorption, shouldFlash: chainDecayResult?.shouldFlash || isPpFusion || isPositronAbsorption, additionalEffects: chainDecayResult?.additionalEffects, isPpFusion, isPositronAbsorption };
};
