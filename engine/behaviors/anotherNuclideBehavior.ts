import { GridEntity, Position, EntityType } from '../../types';
import { isWithinBounds } from '../../utils/gridUtils';
import { getNuclideDataSync } from '../../services/nuclideService';

/**
 * Handles the AI movement of another nuclide.
 * Moves 1 step towards the player every 2 turns.
 */
export const moveAnotherNuclides = (entities: GridEntity[], playerPos: Position, currentTurn: number): GridEntity[] => {
    return entities.map(e => {
        if (e.type === EntityType.ANOTHER_NUCLIDE) {
            const elapsed = currentTurn - e.spawnTurn;
            // Moves on every 2nd turn relative to spawn
            if (elapsed > 0 && elapsed % 2 === 0) {
                const dx = playerPos.x - e.position.x;
                const dy = playerPos.y - e.position.y;
                
                let nextX = e.position.x;
                let nextY = e.position.y;

                if (Math.abs(dx) > Math.abs(dy)) {
                    nextX += dx > 0 ? 1 : -1;
                } else if (dy !== 0) {
                    nextY += dy > 0 ? 1 : -1;
                } else if (dx !== 0) {
                    nextX += dx > 0 ? 1 : -1;
                }

                const nextPos: Position = { x: nextX, y: nextY };
                
                // Do not step on player (collision handled in reducer)
                if (isWithinBounds(nextPos) && !(nextPos.x === playerPos.x && nextPos.y === playerPos.y)) {
                    return { ...e, position: nextPos };
                }
            }
        }
        return e;
    });
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