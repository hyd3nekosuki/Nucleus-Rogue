import { GameState, EntityType, GridEntity, Position, GameStateEvent } from '../types';
import { generateEntities } from './moveSimulator';
import { moveAntiNuclides, consumeMatterWithAntiNuclides } from './behaviors/antiNuclideBehavior';
import { moveAnotherNuclides, consumeParticlesWithAnotherNuclides, resolveMatterStruggle } from './behaviors/anotherNuclideBehavior';
import { TITLES } from '../constants/titles';
import { getLogMessages } from '../constants';
import { getValidAsForZ, getNuclideDataSync } from '../services/nuclideService';
import { findReactionPartners } from '../data/specialReactions';

export interface BackgroundEventResult {
    gridEntities: GridEntity[];
    messages: string[];
    activeEvent?: { type: string; color: string; timestamp: number };
    lastEvent?: GameStateEvent;
    emptyTurnCount: number;
    assaultingEntity: GridEntity | null; // Step 3: Added for Hard Mode assault detection
}

/**
 * Handles all chance-based background phenomena and periodic entity replenishment.
 */
export const processRandomBackgroundEvents = (state: GameState): BackgroundEventResult => {
    const logMessages = getLogMessages(state.language);
    let nextEntities = [...state.gridEntities];
    let nextMessages = [...state.messages];
    let activeEvent = state.activeEvent;
    let lastEvent: GameStateEvent | undefined = undefined;
    let eventTriggered = false;
    let nextEmptyTurnCount = state.emptyTurnCount;

    // 1. Anti-nuclide deadlock check
    const hasParticles = nextEntities.some(e => 
        e.type === EntityType.PROTON || 
        e.type === EntityType.NEUTRON || 
        e.type === EntityType.ENEMY_ELECTRON || 
        e.type === EntityType.ENEMY_POSITRON
    );

    if (!hasParticles) {
        nextEmptyTurnCount++;
        if (nextEmptyTurnCount >= 20 && !nextEntities.some(e => e.type === EntityType.ANTI_NUCLIDE)) {
            nextEntities = generateEntities(1, nextEntities, state.playerPos, state.turn, EntityType.ANTI_NUCLIDE);
            nextMessages = [...nextMessages, logMessages.EVENTS.ANOMALY_DETECTED].slice(-10);
        }
    } else {
        nextEmptyTurnCount = 0;
    }

    // 2. Behaviors: Movement and Matter Consumption
    const isDaredevilActive = state.unlockedGroups.includes(TITLES.DEMON_CORE) && !state.disabledSkills.includes(TITLES.DEMON_CORE);

    nextEntities = moveAntiNuclides(nextEntities, state.playerPos);
    nextEntities = consumeMatterWithAntiNuclides(nextEntities);
    nextEntities = moveAnotherNuclides(nextEntities, state.playerPos, state.turn, isDaredevilActive);
    
    // NEW Step 4: Resolve struggles between different camps after movement
    const struggleResult = resolveMatterStruggle(nextEntities);
    nextEntities = struggleResult.nextEntities;
    if (struggleResult.struggleMessages.length > 0) {
        nextMessages = [...nextMessages, ...struggleResult.struggleMessages].slice(-10);
        if (struggleResult.hasStruggle) {
            activeEvent = { type: "MATTER_STRUGGLE", color: "#ef4444", timestamp: Date.now() };
            lastEvent = {
                id: Date.now(),
                type: 'COLLISION',
                subType: 'MATTER_STRUGGLE',
                shake: true,
                shakeIntensity: 'light',
                flash: 'bg-red-500/20'
            };
        }
    }

    nextEntities = consumeParticlesWithAnotherNuclides(nextEntities);

    // --- NEW: Fission Chain Chance (Monster House Event) ---
    if (state.currentNuclide.z >= 92 && Math.random() < 0.01) {
        const fissionMessages = [logMessages.EVENTS.CRITICALITY_CHANCE];
        const fissionEntities: GridEntity[] = [];
        
        // Spawn 6-10 fissionable nuclides randomly across the grid
        const spawnCount = Math.floor(Math.random() * 5) + 6;
        const fissionableNuclides = [
            { z: 92, a: 235 }, // U-235
            { z: 94, a: 239 }  // Pu-239
        ];

        const freeCells: Position[] = [];
        for (let y = 0; y < 15; y++) {
            for (let x = 0; x < 15; x++) {
                // Avoid spawning directly on player or too close (3x3 area)
                if (Math.abs(x - state.playerPos.x) > 1 || Math.abs(y - state.playerPos.y) > 1) {
                    if (!nextEntities.some(e => e.position.x === x && e.position.y === y)) {
                        freeCells.push({ x, y });
                    }
                }
            }
        }

        for (let i = 0; i < spawnCount && freeCells.length > 0; i++) {
            const cellIdx = Math.floor(Math.random() * freeCells.length);
            const pos = freeCells.splice(cellIdx, 1)[0];
            const nuclide = fissionableNuclides[Math.floor(Math.random() * fissionableNuclides.length)];
            
            fissionEntities.push({
                id: 'fission-house-' + Math.random().toString(36).substr(2, 9),
                type: EntityType.ANOTHER_NUCLIDE,
                position: pos,
                spawnTurn: state.turn,
                isHighEnergy: true, 
                z: nuclide.z,
                a: nuclide.a,
                isFriendly: isDaredevilActive ? false : (Math.random() < 0.5)
            });
        }

        if (fissionEntities.length > 0) {
            nextEntities = [...nextEntities, ...fissionEntities];
            nextMessages = [...nextMessages, ...fissionMessages].slice(-10);
            activeEvent = { type: "CRITICALITY_ALERT", color: "#f59e0b", timestamp: Date.now() };
            lastEvent = {
                id: Date.now(),
                type: 'COLLISION',
                subType: 'FISSION_HOUSE',
                shake: true,
                shakeIntensity: 'normal',
                flash: 'bg-yellow-500/40'
            };
            eventTriggered = true;
        }
    }

    // Step 3 Logic: Detect if any predator (enemy) nuclide has moved onto the player position.
    // This overlap is only possible during Hard Mode (isDaredevilActive) as per Step 1.
    const assaultingEntity = nextEntities.find(e => 
        e.type === EntityType.ANOTHER_NUCLIDE && 
        !e.isFriendly && 
        e.position.x === state.playerPos.x && 
        e.position.y === state.playerPos.y
    ) || null;

    // 3. Spawning "Another Nuclide" (Mid-boss) with Linked Spawning Logic
    const hasEnemyAnother = nextEntities.some(e => e.type === EntityType.ANOTHER_NUCLIDE && !e.isFriendly);
    const hasFriendlyAnother = nextEntities.some(e => e.type === EntityType.ANOTHER_NUCLIDE && e.isFriendly);
    
    // Demon core ON: Allow spawning enemy if no ENEMY exists (even if friend exists)
    // Demon core OFF: Allow spawning enemy only if NO another nuclide exists
    const canSpawnEnemy = isDaredevilActive ? !hasEnemyAnother : (!hasEnemyAnother && !hasFriendlyAnother);

    if (canSpawnEnemy && state.turn > 20 && Math.random() < 0.015) {
        const curZ = state.currentNuclide.z;
        const curA = state.currentNuclide.a;
        
        let enemyZ = 1;
        let enemyA = 1;
        let found = false;

        // --- LINKED SPAWNING: Check for Special Reaction Partners ---
        const partners = findReactionPartners(curZ, curA);
        
        // 80% chance to prioritize a compatible partner if one exists
        if (partners.length > 0 && Math.random() < 0.8) {
            const partner = partners[Math.floor(Math.random() * partners.length)];
            // Partners must be actual nuclides (Z > 0) to spawn as Another Nuclide
            // Particles like neutrons (Z=0) are generated via standard entity spawning
            if (partner.z > 0) {
                enemyZ = partner.z;
                enemyA = partner.a;
                found = true;
            }
        }

        // Fallback to random weighted search if no partner selected
        if (!found) {
            const zLimit = curZ;
            const aLimit = curA;
            for (let attempt = 0; attempt < 20; attempt++) {
                const tz = Math.floor(Math.random() * zLimit) + 1;
                const validAs = getValidAsForZ(tz).filter(a => a <= aLimit);
                if (validAs.length > 0) {
                    enemyZ = tz;
                    enemyA = validAs[Math.floor(Math.random() * validAs.length)];
                    found = true;
                    break;
                }
            }
        }
        
        if (!found) { enemyZ = 1; enemyA = 1; }

        const freeCells: Position[] = [];
        for (let y = 0; y < 15; y++) {
            for (let x = 0; x < 15; x++) {
                if (Math.abs(x - state.playerPos.x) > 5 && !nextEntities.some(e => e.position.x === x && e.position.y === y)) {
                    freeCells.push({ x, y });
                }
            }
        }
        
        if (freeCells.length > 0) {
            const pos = freeCells[Math.floor(Math.random() * freeCells.length)];
            nextEntities.push({
                id: 'another-' + Math.random().toString(36).substr(2, 9),
                type: EntityType.ANOTHER_NUCLIDE,
                position: pos,
                spawnTurn: state.turn,
                isHighEnergy: false,
                z: enemyZ,
                a: enemyA,
                isFriendly: false // Natural spawns are predators
            });
            nextMessages = [...nextMessages, logMessages.EVENTS.BOSS_SPAWN(enemyZ, enemyA)].slice(-10);
            activeEvent = { type: "BOSS_SPAWN", color: "#b45309", timestamp: Date.now() };
        }
    }

    // 4. Background random events
    const isUnknownSkillActive = state.unlockedGroups.includes(TITLES.UNKNOWN) && !state.disabledSkills.includes(TITLES.UNKNOWN);
    if (isUnknownSkillActive && Math.random() < 0.02) {
        const randEvent = Math.random();
        let eventMsg = "", signalType = "", signalColor = "";
        
        if (randEvent < 0.48) {
            eventMsg = logMessages.EVENTS.QUANTUM_COHERENCE; 
            signalType = "INVERSION"; 
            signalColor = "#bc13fe";
            nextEntities = nextEntities.map(e => (
                e.type === EntityType.PROTON ? { ...e, type: EntityType.NEUTRON } : 
                e.type === EntityType.NEUTRON ? { ...e, type: EntityType.PROTON } : 
                e.type === EntityType.ENEMY_ELECTRON ? { ...e, isHighEnergy: !e.isHighEnergy } : e
            ));
        } else if (randEvent < 0.78) {
            eventMsg = logMessages.EVENTS.STELLAR_WIND; 
            signalType = "NEUTRON_STORM"; 
            signalColor = "#00f3ff";
            nextEntities = nextEntities.map(e => (e.type !== EntityType.ENEMY_POSITRON && e.type !== EntityType.ANTI_NUCLIDE && e.type !== EntityType.ANOTHER_NUCLIDE) ? { ...e, type: EntityType.NEUTRON } : e);
        } else if (randEvent < 0.93) {
            eventMsg = logMessages.EVENTS.COSMIC_RAY_BURST; 
            signalType = "PROTON_BURST"; 
            signalColor = "#ff0055";
            nextEntities = nextEntities.map(e => (e.type !== EntityType.ENEMY_POSITRON && e.type !== EntityType.ANTI_NUCLIDE && e.type !== EntityType.ANOTHER_NUCLIDE) ? { ...e, type: EntityType.PROTON } : e);
        } else if (randEvent < 0.98) {
            eventMsg = logMessages.EVENTS.VACUUM_FLUCTUATION; 
            signalType = "ELECTRON_FLUCTUATION"; 
            signalColor = "#facc15";
            nextEntities = nextEntities.map(e => (e.type !== EntityType.ENEMY_POSITRON && e.type !== EntityType.ANTI_NUCLIDE && e.type !== EntityType.ANOTHER_NUCLIDE) ? { ...e, type: EntityType.ENEMY_ELECTRON } : e);
        } else {
            eventMsg = logMessages.EVENTS.POSITRON_MAZE; 
            signalType = "POSITRON_MAZE"; 
            signalColor = "#e879f9";
            
            // Generate Maze Walls
            const mazeEntities: GridEntity[] = [];
            for (let y = 0; y < 15; y++) {
                for (let x = 0; x < 15; x++) {
                    // Avoid player position and immediate neighbors to ensure a start
                    if (Math.abs(x - state.playerPos.x) <= 1 && Math.abs(y - state.playerPos.y) <= 1) continue;

                    // Maze logic: walls on even grid lines with 40% gaps for paths
                    if ((x % 2 === 0 || y % 2 === 0) && Math.random() > 0.4) {
                        const existingIdx = nextEntities.findIndex(e => e.position.x === x && e.position.y === y);
                        
                        if (existingIdx !== -1) {
                            const ent = nextEntities[existingIdx];
                            // If it's a particle (p, n, e-, e+), change it to positron
                            if ([EntityType.PROTON, EntityType.NEUTRON, EntityType.ENEMY_ELECTRON, EntityType.ENEMY_POSITRON].includes(ent.type)) {
                                nextEntities[existingIdx] = { ...ent, type: EntityType.ENEMY_POSITRON };
                            }
                        } else {
                            // Create new positron wall
                            mazeEntities.push({
                                id: 'maze-' + x + '-' + y + '-' + Math.random().toString(36).substr(2, 5),
                                type: EntityType.ENEMY_POSITRON,
                                position: { x, y },
                                spawnTurn: state.turn,
                                isHighEnergy: false
                            });
                        }
                    }
                }
            }
            nextEntities = [...nextEntities, ...mazeEntities];
        }
        
        nextMessages = [...nextMessages, eventMsg].slice(-10);
        activeEvent = { type: signalType, color: signalColor, timestamp: Date.now() };
        eventTriggered = true;
    }

    // 5. Periodic Entity Respawn
    const isGluttonySkillActive = state.unlockedGroups.includes(TITLES.GLUTTONY) && !state.disabledSkills.includes(TITLES.GLUTTONY);
    if (!isGluttonySkillActive && !eventTriggered && Math.random() < 0.15) {
        nextEntities = generateEntities(1, nextEntities, state.playerPos, state.turn);
    }

    return {
        gridEntities: nextEntities,
        messages: nextMessages,
        activeEvent,
        lastEvent,
        emptyTurnCount: nextEmptyTurnCount,
        assaultingEntity // Return detection result to the handler
    };
};