import { GameState, EntityType, GridEntity, Position } from '../types';
import { generateEntities } from './moveSimulator';
import { moveAntiNuclides, consumeMatterWithAntiNuclides } from './behaviors/antiNuclideBehavior';
import { moveAnotherNuclides, consumeParticlesWithAnotherNuclides } from './behaviors/anotherNuclideBehavior';
import { TITLES } from '../constants/titles';

export interface BackgroundEventResult {
    gridEntities: GridEntity[];
    messages: string[];
    activeEvent?: { type: string; color: string; timestamp: number };
    emptyTurnCount: number;
}

/**
 * Handles all chance-based background phenomena and periodic entity replenishment.
 * Separating this ensures the core move logic remains predictable and testable.
 */
export const processRandomBackgroundEvents = (state: GameState): BackgroundEventResult => {
    let nextEntities = [...state.gridEntities];
    let nextMessages = [...state.messages];
    let activeEvent = state.activeEvent;
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
            // Spawn Anti-nuclide at a random free position
            nextEntities = generateEntities(1, nextEntities, state.playerPos, state.turn, EntityType.ANTI_NUCLIDE);
            nextMessages = [...nextMessages, "⚠️ WARNING: ANOMALY DETECTED. ANTI-NUCLIDE MATERIALIZED."].slice(-10);
        }
    } else {
        nextEmptyTurnCount = 0;
    }

    // 2. Behaviors: Movement and Matter Consumption
    nextEntities = moveAntiNuclides(nextEntities, state.playerPos);
    nextEntities = consumeMatterWithAntiNuclides(nextEntities);
    
    // Another Nuclide AI Processing
    nextEntities = moveAnotherNuclides(nextEntities, state.playerPos, state.turn);
    nextEntities = consumeParticlesWithAnotherNuclides(nextEntities);

    // 3. Spawning "Another Nuclide" (Mid-boss)
    const hasAnother = nextEntities.some(e => e.type === EntityType.ANOTHER_NUCLIDE);
    if (!hasAnother && state.turn > 20 && Math.random() < 0.015) {
        const zLimit = state.currentNuclide.z;
        const aLimit = state.currentNuclide.a;
        
        // Random Z, A less than or equal to machine
        const enemyZ = Math.floor(Math.random() * zLimit) + 1;
        const enemyA = Math.floor(Math.random() * (aLimit - enemyZ + 1)) + enemyZ;

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
                a: enemyA
            });
            nextMessages = [...nextMessages, `⚠️ ANOTHER NUCLIDE DETECTED: Z=${enemyZ}, A=${enemyA} approaching.`].slice(-10);
            activeEvent = { type: "BOSS_SPAWN", color: "#b45309", timestamp: Date.now() };
        }
    }

    // 4. Background random events
    const isUnknownSkillActive = state.unlockedGroups.includes(TITLES.UNKNOWN) && !state.disabledSkills.includes(TITLES.UNKNOWN);
    if (isUnknownSkillActive && Math.random() < 0.02) {
        const randEvent = Math.random();
        let eventMsg = "", signalType = "", signalColor = "";
        
        if (randEvent < 0.5) {
            eventMsg = "⚠️ QUANTUM COHERENCE: Particle Identity Inversion!"; 
            signalType = "INVERSION"; 
            signalColor = "#bc13fe";
            nextEntities = nextEntities.map(e => (
                e.type === EntityType.PROTON ? { ...e, type: EntityType.NEUTRON } : 
                e.type === EntityType.NEUTRON ? { ...e, type: EntityType.PROTON } : 
                e.type === EntityType.ENEMY_ELECTRON ? { ...e, isHighEnergy: !e.isHighEnergy } : e
            ));
        } else if (randEvent < 0.8) {
            eventMsg = "⚠️ STELLAR WIND: Massive Neutron Flux!"; 
            signalType = "NEUTRON_STORM"; 
            signalColor = "#00f3ff";
            nextEntities = nextEntities.map(e => (e.type !== EntityType.ENEMY_POSITRON && e.type !== EntityType.ANTI_NUCLIDE && e.type !== EntityType.ANOTHER_NUCLIDE) ? { ...e, type: EntityType.NEUTRON } : e);
        } else if (randEvent < 0.95) {
            eventMsg = "⚠️ COSMIC RAY BURST: Massive Proton Flood!"; 
            signalType = "PROTON_BURST"; 
            signalColor = "#ff0055";
            nextEntities = nextEntities.map(e => (e.type !== EntityType.ENEMY_POSITRON && e.type !== EntityType.ANTI_NUCLIDE && e.type !== EntityType.ANOTHER_NUCLIDE) ? { ...e, type: EntityType.PROTON } : e);
        } else {
            eventMsg = "⚠️ VACUUM FLUCTUATION: Massive Electron Storm!"; 
            signalType = "ELECTRON_FLUCTUATION"; 
            signalColor = "#facc15";
            nextEntities = nextEntities.map(e => (e.type !== EntityType.ENEMY_POSITRON && e.type !== EntityType.ANTI_NUCLIDE && e.type !== EntityType.ANOTHER_NUCLIDE) ? { ...e, type: EntityType.ENEMY_ELECTRON } : e);
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
        emptyTurnCount: nextEmptyTurnCount
    };
};