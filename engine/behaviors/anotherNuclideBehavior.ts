import { GridEntity, Position, EntityType } from '../../types';
import { isWithinBounds } from '../../utils/gridUtils';
import { getNuclideDataSync } from '../../services/nuclideService';

/**
 * Handles the AI movement of another nuclide.
 * Moves 1 step towards the player every 2 turns.
 * Step 3: Updated to avoid overlapping with nuclides of the same affiliation.
 */
export const moveAnotherNuclides = (entities: GridEntity[], playerPos: Position, currentTurn: number): GridEntity[] => {
    return entities.map(e => {
        if (e.type === EntityType.ANOTHER_NUCLIDE) {
            const elapsed = currentTurn - e.spawnTurn;
            // Moves on every 2nd turn relative to spawn
            if (elapsed > 0 && elapsed % 2 === 0) {
                const dx = playerPos.x - e.position.x;
                const dy = playerPos.y - e.position.y;
                
                // Potential move candidates prioritizing the direction that closes the largest gap
                const candidates: Position[] = [];
                if (Math.abs(dx) >= Math.abs(dy)) {
                    if (dx !== 0) candidates.push({ x: e.position.x + (dx > 0 ? 1 : -1), y: e.position.y });
                    if (dy !== 0) candidates.push({ x: e.position.x, y: e.position.y + (dy > 0 ? 1 : -1) });
                } else {
                    if (dy !== 0) candidates.push({ x: e.position.x, y: e.position.y + (dy > 0 ? 1 : -1) });
                    if (dx !== 0) candidates.push({ x: e.position.x + (dx > 0 ? 1 : -1), y: e.position.y });
                }

                for (const nextPos of candidates) {
                    // Check bounds and player collision
                    if (isWithinBounds(nextPos) && !(nextPos.x === playerPos.x && nextPos.y === playerPos.y)) {
                        
                        // Step 3 logic: Check if this cell is already occupied by a nuclide of the SAME affiliation
                        const isAllyOccupied = entities.some(other => 
                            other.id !== e.id && 
                            other.type === EntityType.ANOTHER_NUCLIDE &&
                            (!!other.isFriendly === !!e.isFriendly) &&
                            other.position.x === nextPos.x && other.position.y === nextPos.y
                        );

                        if (!isAllyOccupied) {
                            return { ...e, position: nextPos };
                        }
                    }
                }
                // If all gap-closing options are blocked by allies or bounds, stay in place
                return e;
            }
        }
        return e;
    });
};

/**
 * Step 4: Resolves "Matter Struggle" between nuclides of different camps sharing the same position.
 */
export const resolveMatterStruggle = (entities: GridEntity[]): { nextEntities: GridEntity[], struggleMessages: string[] } => {
    const struggleMessages: string[] = [];
    const processedIds = new Set<string>();
    const resultEntities: GridEntity[] = [];

    // Sort entities to ensure consistent processing (by Z then A)
    const sorted = [...entities].sort((a, b) => {
        if (a.type !== b.type) return a.type === EntityType.ANOTHER_NUCLIDE ? -1 : 1;
        return ((b.z || 0) - (a.z || 0)) || ((b.a || 0) - (a.a || 0));
    });

    for (let i = 0; i < sorted.length; i++) {
        const e1 = sorted[i];
        if (processedIds.has(e1.id)) continue;
        if (e1.type !== EntityType.ANOTHER_NUCLIDE) {
            resultEntities.push(e1);
            processedIds.add(e1.id);
            continue;
        }

        // Find opponent at same position with DIFFERENT affiliation
        const opponentIndex = sorted.findIndex((e2, idx) => 
            idx > i &&
            !processedIds.has(e2.id) &&
            e2.type === EntityType.ANOTHER_NUCLIDE &&
            e2.position.x === e1.position.x &&
            e2.position.y === e1.position.y &&
            (!!e2.isFriendly !== !!e1.isFriendly)
        );

        if (opponentIndex !== -1) {
            const e2 = sorted[opponentIndex];
            const z1 = e1.z || 0;
            const a1 = e1.a || 0;
            const z2 = e2.z || 0;
            const a2 = e2.a || 0;

            const name1 = getNuclideDataSync(z1, a1).name;
            const name2 = getNuclideDataSync(z2, a2).name;

            // Determine winner: 1. Higher Z, 2. Higher A, 3. 50% Chance
            let winner: GridEntity;
            let loser: GridEntity;

            if (z1 > z2) { winner = e1; loser = e2; }
            else if (z2 > z1) { winner = e2; loser = e1; }
            else if (a1 > a2) { winner = e1; loser = e2; }
            else if (a2 > a1) { winner = e2; loser = e1; }
            else {
                const p1Wins = Math.random() > 0.5;
                winner = p1Wins ? e1 : e2;
                loser = p1Wins ? e2 : e1;
            }

            const winnerName = winner === e1 ? name1 : name2;
            struggleMessages.push(`💥 Matter Struggle: ${name1} vs ${name2} -> ${winnerName} remained`);
            
            resultEntities.push(winner);
            processedIds.add(e1.id);
            processedIds.add(e2.id);
        } else {
            resultEntities.push(e1);
            processedIds.add(e1.id);
        }
    }

    return { nextEntities: resultEntities, struggleMessages };
};

/**
 * Processes particle consumption for Another Nuclide.
 * If the resulting Z/A state is non-existent, the nuclide vanishes.
 */
export const consumeParticlesWithAnotherNuclides = (entities: GridEntity[]): GridEntity[] => {
    const anotherNuclides = entities.filter(e => e.type === EntityType.ANOTHER_NUCLIDE);
    if (anotherNuclides.length === 0) return entities;

    let nextEntities = [...entities];
    
    anotherNuclides.forEach(enemy => {
        // Find index in current evolving entity list
        const enemyIndexInNext = nextEntities.findIndex(e => e.id === enemy.id);
        if (enemyIndexInNext === -1) return;

        const consumedIndex = nextEntities.findIndex(e => 
            e.id !== enemy.id && 
            e.position.x === enemy.position.x && 
            e.position.y === enemy.position.y &&
            [EntityType.PROTON, EntityType.NEUTRON, EntityType.ENEMY_ELECTRON, EntityType.ENEMY_POSITRON].includes(e.type)
        );

        if (consumedIndex !== -1) {
            const target = nextEntities[consumedIndex];
            const updatedEnemy = { ...nextEntities[enemyIndexInNext] };
            
            switch (target.type) {
                case EntityType.PROTON:
                    updatedEnemy.z = (updatedEnemy.z || 0) + 1;
                    updatedEnemy.a = (updatedEnemy.a || 0) + 1;
                    break;
                case EntityType.NEUTRON:
                    updatedEnemy.a = (updatedEnemy.a || 0) + 1;
                    break;
                case EntityType.ENEMY_ELECTRON:
                    updatedEnemy.z = Math.max(0, (updatedEnemy.z || 0) - 1);
                    break;
                case EntityType.ENEMY_POSITRON:
                    updatedEnemy.z = (updatedEnemy.z || 0) + 1;
                    break;
            }

            // Remove the consumed particle
            nextEntities.splice(consumedIndex, 1);
            
            // Re-find enemy index because splice shifts things
            const finalEnemyIndex = nextEntities.findIndex(e => e.id === enemy.id);
            if (finalEnemyIndex !== -1) {
                const existenceCheck = getNuclideDataSync(updatedEnemy.z || 0, updatedEnemy.a || 0);
                if (!existenceCheck.exists) {
                    // Mid-boss vanished due to reaching an impossible configuration
                    nextEntities.splice(finalEnemyIndex, 1);
                } else {
                    nextEntities[finalEnemyIndex] = updatedEnemy;
                }
            }
        }
    });

    return nextEntities;
};