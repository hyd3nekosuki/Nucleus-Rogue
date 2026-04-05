import { GridEntity, Position, EntityType, Language } from '../../types';
import { isWithinBounds } from '../../utils/gridUtils';
import { getNuclideDataSync } from '../../services/nuclideService';
import { getLogMessages } from '../../constants';

/**
 * Handles the AI movement of another nuclide.
 * Moves 1 step towards the player every 2 turns.
 * Step 1 Update: Allows enemy nuclides to enter player cell if Demon core (isDaredevilActive) is on.
 */
export const moveAnotherNuclides = (
    entities: GridEntity[], 
    playerPos: Position, 
    currentTurn: number,
    isDaredevilActive: boolean = false // Added in Step 1
): GridEntity[] => {
    const nextEntities = [...entities];
    
    for (let i = 0; i < nextEntities.length; i++) {
        const e = nextEntities[i];
        if (e.type === EntityType.ANOTHER_NUCLIDE) {
            const elapsed = currentTurn - e.spawnTurn;
            // Moves on every 2nd turn relative to spawn
            if (elapsed > 0 && elapsed % 2 === 0) {
                let targetPos = playerPos;

                // If friendly, prioritize targeting the closest enemy another nuclide to "challenge" it
                if (e.isFriendly) {
                    const enemies = nextEntities.filter(other => 
                        other.type === EntityType.ANOTHER_NUCLIDE && !other.isFriendly
                    );

                    if (enemies.length > 0) {
                        // Find closest enemy
                        let closest = enemies[0];
                        let minDistance = Math.abs(closest.position.x - e.position.x) + Math.abs(closest.position.y - e.position.y);
                        
                        for (let j = 1; j < enemies.length; j++) {
                            const dist = Math.abs(enemies[j].position.x - e.position.x) + Math.abs(enemies[j].position.y - e.position.y);
                            if (dist < minDistance) {
                                minDistance = dist;
                                closest = enemies[j];
                            }
                        }
                        targetPos = closest.position;
                    }
                }

                const dx = targetPos.x - e.position.x;
                const dy = targetPos.y - e.position.y;
                
                // Potential move candidates prioritizing the direction that closes the largest gap
                const candidates: Position[] = [];
                if (Math.abs(dx) >= Math.abs(dy)) {
                    if (dx !== 0) candidates.push({ x: e.position.x + (dx > 0 ? 1 : -1), y: e.position.y });
                    if (dy !== 0) candidates.push({ x: e.position.x, y: e.position.y + (dy > 0 ? 1 : -1) });
                } else {
                    if (dy !== 0) candidates.push({ x: e.position.x, y: e.position.y + (dy > 0 ? 1 : -1) });
                    if (dx !== 0) candidates.push({ x: e.position.x + (dx > 0 ? 1 : -1), y: e.position.y });
                }

                const canOverlapPlayer = isDaredevilActive && !e.isFriendly;

                for (const nextPos of candidates) {
                    const isPlayerPos = nextPos.x === playerPos.x && nextPos.y === playerPos.y;
                    
                    // Check bounds and player collision (ignore player collision if canOverlapPlayer is true)
                    if (isWithinBounds(nextPos) && (!isPlayerPos || canOverlapPlayer)) {
                        
                        // Check if this cell is already occupied by a nuclide of the SAME affiliation
                        // We check nextEntities to account for moves already made in this turn
                        const isAllyOccupied = nextEntities.some(other => 
                            other.id !== e.id && 
                            other.type === EntityType.ANOTHER_NUCLIDE &&
                            (!!other.isFriendly === !!e.isFriendly) &&
                            other.position.x === nextPos.x && other.position.y === nextPos.y
                        );

                        if (!isAllyOccupied) {
                            nextEntities[i] = { ...e, position: nextPos };
                            break;
                        }
                    }
                }
            }
        }
    }
    return nextEntities;
};

/**
 * Step 4: Resolves "Matter Struggle" between nuclides of different camps sharing the same position.
 */
export const resolveMatterStruggle = (entities: GridEntity[], language: Language = 'en'): { nextEntities: GridEntity[], struggleMessages: string[], hasStruggle: boolean } => {
    const logMessages = getLogMessages(language);
    const struggleMessages: string[] = [];
    let hasStruggle = false;
    
    // Group entities by position to handle multi-combatant cells
    const posMap = new Map<string, GridEntity[]>();
    entities.forEach(e => {
        const key = `${e.position.x},${e.position.y}`;
        if (!posMap.has(key)) posMap.set(key, []);
        posMap.get(key)!.push(e);
    });

    const resultEntities: GridEntity[] = [];

    for (const [_, cellEntities] of posMap.entries()) {
        const friends = cellEntities.filter(e => e.type === EntityType.ANOTHER_NUCLIDE && e.isFriendly);
        const enemies = cellEntities.filter(e => e.type === EntityType.ANOTHER_NUCLIDE && !e.isFriendly);
        const others = cellEntities.filter(e => e.type !== EntityType.ANOTHER_NUCLIDE);

        // Non-nuclide entities always survive the struggle
        resultEntities.push(...others);

        if (friends.length === 0 || enemies.length === 0) {
            // No conflict in this cell
            resultEntities.push(...friends, ...enemies);
            continue;
        }

        // Struggle occurs!
        hasStruggle = true;
        
        // Sort both sides by strength (Z then A)
        const sortFn = (a: GridEntity, b: GridEntity) => ((b.z || 0) - (a.z || 0)) || ((b.a || 0) - (a.a || 0));
        friends.sort(sortFn);
        enemies.sort(sortFn);

        // Primary resolution: Strongest Friend vs Strongest Enemy
        const f = friends[0];
        const e = enemies[0];
        
        const zf = f.z || 0;
        const af = f.a || 0;
        const ze = e.z || 0;
        const ae = e.a || 0;

        const nameF = getNuclideDataSync(zf, af).name;
        const nameE = getNuclideDataSync(ze, ae).name;

        let winnerIsFriend: boolean;

        if (zf > ze) { winnerIsFriend = true; }
        else if (ze > zf) { winnerIsFriend = false; }
        else if (af > ae) { winnerIsFriend = true; }
        else if (ae > af) { winnerIsFriend = false; }
        else {
            // Friend wins tie
            winnerIsFriend = true;
        }

        const winnerName = winnerIsFriend ? nameF : nameE;
        struggleMessages.push(JSON.stringify({ key: 'EVENTS.MATTER_STRUGGLE', params: [nameF, nameE, winnerName] }));

        if (winnerIsFriend) {
            // All friends in this cell survive, all enemies are removed
            resultEntities.push(...friends);
            if (enemies.length > 1) {
                struggleMessages.push(JSON.stringify({ key: 'EVENTS.ANNIHILATED_ENEMIES' }));
            }
        } else {
            // All enemies in this cell survive, all friends are removed
            resultEntities.push(...enemies);
            if (friends.length > 1) {
                struggleMessages.push(JSON.stringify({ key: 'EVENTS.ANNIHILATED_FRIENDS' }));
            }
        }
    }

    return { nextEntities: resultEntities, struggleMessages, hasStruggle };
};

/**
 * Processes particle consumption for Another Nuclide.
 * If the resulting Z/A state is non-existent, the nuclide vanishes.
 */
export const consumeParticlesWithAnotherNuclides = (entities: GridEntity[]): GridEntity[] => {
    const anotherNuclides = entities.filter(e => e.type === EntityType.ANOTHER_NUCLIDE);
    if (anotherNuclides.length === 0) return entities;

    let nextEntities = [...entities];
    
    anotherNuclides.forEach(nuclide => {
        // Find index in current evolving entity list
        const nuclideIndexInNext = nextEntities.findIndex(e => e.id === nuclide.id);
        if (nuclideIndexInNext === -1) return;

        const consumedIndex = nextEntities.findIndex(e => 
            e.id !== nuclide.id && 
            e.position.x === nuclide.position.x && 
            e.position.y === nuclide.position.y &&
            [EntityType.PROTON, EntityType.NEUTRON, EntityType.ENEMY_ELECTRON, EntityType.ENEMY_POSITRON].includes(e.type)
        );

        if (consumedIndex !== -1) {
            const target = nextEntities[consumedIndex];
            const updatedNuclide = { ...nextEntities[nuclideIndexInNext] };
            
            switch (target.type) {
                case EntityType.PROTON:
                    updatedNuclide.z = (updatedNuclide.z || 0) + 1;
                    updatedNuclide.a = (updatedNuclide.a || 0) + 1;
                    break;
                case EntityType.NEUTRON:
                    updatedNuclide.a = (updatedNuclide.a || 0) + 1;
                    break;
                case EntityType.ENEMY_ELECTRON:
                    updatedNuclide.z = Math.max(0, (updatedNuclide.z || 0) - 1);
                    break;
                case EntityType.ENEMY_POSITRON:
                    updatedNuclide.z = (updatedNuclide.z || 0) + 1;
                    break;
            }

            // Remove the consumed particle
            nextEntities.splice(consumedIndex, 1);
            
            // Re-find nuclide index because splice shifts things
            const finalNuclideIndex = nextEntities.findIndex(e => e.id === nuclide.id);
            if (finalNuclideIndex !== -1) {
                const existenceCheck = getNuclideDataSync(updatedNuclide.z || 0, updatedNuclide.a || 0);
                // Both friendly and enemy nuclides vanish if they hit a non-existent state
                if (!existenceCheck.exists) {
                    // Nuclide vanished due to reaching an impossible configuration
                    nextEntities.splice(finalNuclideIndex, 1);
                } else {
                    nextEntities[finalNuclideIndex] = updatedNuclide;
                }
            }
        }
    });

    return nextEntities;
};