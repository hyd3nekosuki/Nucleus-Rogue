import { GameState, GridEntity, Position, EntityType, DiscoveryContext, DecayMode } from '../../types';
import { MAX_ENERGY } from '../../constants/economy';
import { HISTORY_METHODS } from '../../constants/strings';
import { REASON } from '../../constants/gameOverReason';
import { getNuclideDataSync } from '../../services/nuclideService';
import { generateEntities } from '../moveSimulator';
import { applyDiscoveryLogic, findNearbyFreeCell } from './discoveryEngine';
import { findSpecialReaction } from '../../data/specialReactions';
import { resolveStabilityCrisis } from '../stabilityManager';
import { registerHistoryEntry } from './historyService';

/**
 * Core Service: Resolves a collision between the player nucleus and an "Another Nuclide" entity.
 * Handles special reactions (fusion), combat (damage/defeat), and status updates.
 */
export const handleAnotherNuclideCollision = (
    state: GameState, 
    enemy: GridEntity, 
    collisionPos: Position,
    targetTurn: number
): GameState => {
    const now = Date.now();
    const pz = state.currentNuclide.z;
    const pa = state.currentNuclide.a;
    const ez = enemy.z || 0;
    const ea = enemy.a || 0;
    const reaction = findSpecialReaction(pz, pa, ez, ea);

    // Scenario A: Special Nuclear Reaction (e.g., fusion or transmutation)
    if (reaction) {
        let playerZ = reaction.productZ, playerA = reaction.productA, bossZ = reaction.product2Z, bossA = reaction.product2A;
        // Optimization: Ensure player takes the heavier fragment if two are produced
        if (bossZ !== undefined && bossA !== undefined && (bossA > playerA || (bossA === playerA && bossZ > playerZ))) {
            [playerZ, bossZ] = [bossZ, playerZ]; [playerA, bossA] = [bossA, playerA];
        }
        
        const nextNuclide = getNuclideDataSync(playerZ, playerA);
        if (nextNuclide.exists) {
            let nextEntities = state.gridEntities.filter(e => e.id !== enemy.id);
            let nextHistory = state.evolutionHistory;

            // Step 3 Enhancement: Register byproduct nuclide as a scientific discovery (isolated dot)
            if (bossZ !== undefined && bossA !== undefined && bossA > 0) {
                const isSingle = (bossZ === 1 && bossA === 1) || (bossZ === 0 && bossA === 1);
                if (isSingle) {
                    nextEntities = generateEntities(1, nextEntities, collisionPos, state.turn, bossZ === 1 ? EntityType.PROTON : EntityType.NEUTRON, true);
                } else {
                    const bossData = getNuclideDataSync(bossZ, bossA);
                    if (bossData.exists) {
                        // Register byproduct as "Unknown" pedigree to show as isolated dot on the map
                        nextHistory = registerHistoryEntry(nextHistory, bossData, "Unknown", null, null, targetTurn, true);
                        nextEntities.push({ 
                            id: 'product-' + Math.random().toString(36).substr(2, 9), 
                            type: EntityType.ANOTHER_NUCLIDE, 
                            position: findNearbyFreeCell(collisionPos, nextEntities, collisionPos), 
                            spawnTurn: state.turn, 
                            isHighEnergy: false, 
                            z: bossZ, 
                            a: bossA, 
                            isFriendly: true 
                        });
                    }
                }
            }
            reaction.emissions.forEach(emitType => { nextEntities = generateEntities(1, nextEntities, collisionPos, state.turn, emitType, true); });

            return applyDiscoveryLogic(
                { 
                    ...state, 
                    playerPos: collisionPos, 
                    energyPoints: Math.min(MAX_ENERGY, state.energyPoints + reaction.energyBonus), 
                    gridEntities: nextEntities, 
                    evolutionHistory: nextHistory,
                    messages: [...state.messages, reaction.message].slice(-10), 
                    lastEvent: { 
                        id: now, type: 'COLLISION', subType: 'SPECIAL_REACTION', shake: true, 
                        flash: reaction.isSuperheavy ? 'bg-yellow-400' : 'bg-white', 
                        priorityMessages: ['Nuclear Fusion', 'Experimental Replication'] 
                    } 
                },
                nextNuclide,
                { method: HISTORY_METHODS.EXP_REPLICATE, pz, pa, addedScore: 500000, chargesUsed: 0, isManualDecay: false },
                targetTurn,
                { skipComboSettlement: true }
            );
        }
    }

    // Scenario B: Combat / Physical Collision
    const penalty = enemy.isFriendly ? 25 : 50;
    
    const dZ_e = Math.max(1, Math.floor(pz / 2 + 0.5)), dA_e = Math.max(1, Math.floor(pa / 2 + 0.5));
    const nextZ = Math.max(0, ez - dZ_e), nextA = Math.max(0, ea - dA_e);
    const finalData = getNuclideDataSync(nextZ, nextA);
    const isDefeated = nextZ <= 0 || nextA <= 0 || !finalData.exists;

    let nextEntities = state.gridEntities.filter(e => e.id !== enemy.id);
    let rewardMsg: string[] = [];
    let nextEnergy = state.energyPoints;
    let nextHistory = state.evolutionHistory;

    if (isDefeated) { 
        nextEnergy = Math.min(MAX_ENERGY, state.energyPoints + 1); 
        rewardMsg = [`💥 ANOTHER NUCLIDE DEFEATED! (+1E)`]; 
        
        // Register defeated enemy in history as isolated dot
        const enemyData = getNuclideDataSync(ez, ea);
        if (enemyData.exists) {
            nextHistory = registerHistoryEntry(nextHistory, enemyData, "Unknown", null, null, targetTurn, true);
        }
    }
    else {
        nextEntities.push({ ...enemy, position: findNearbyFreeCell(collisionPos, nextEntities, collisionPos), z: nextZ, a: nextA });
    }

    const campLabel = enemy.isFriendly ? "FRIENDLY" : "ANOTHER";
    const nextState: GameState = { 
        ...state, 
        playerPos: collisionPos, 
        hp: Math.max(0, state.hp - penalty), 
        energyPoints: nextEnergy, 
        gridEntities: nextEntities, 
        evolutionHistory: nextHistory,
        turn: targetTurn, 
        messages: [...state.messages, `⚠️ COLLISION WITH ${campLabel} NUCLIDE! HP -${penalty}`, ...rewardMsg].slice(-10), 
        lastEvent: { id: now, type: 'COLLISION', shake: true, flash: enemy.isFriendly ? 'bg-blue-900' : 'bg-amber-700' } 
    };

    if (nextState.hp <= 0) {
        return { ...nextState, ...resolveStabilityCrisis(nextState, REASON.FATAL_CAPTURE) };
    }
    
    return nextState;
};