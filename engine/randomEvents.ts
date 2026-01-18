import { GameState, EntityType, GridEntity, Position } from '../types';
import { generateEntities } from './moveSimulator';
import { moveAntiNuclides, consumeMatterWithAntiNuclides } from './behaviors/antiNuclideBehavior';
import { moveAnotherNuclides, consumeParticlesWithAnotherNuclides, resolveMatterStruggle } from './behaviors/anotherNuclideBehavior';
import { TITLES } from '../constants/titles';
import { getValidAsForZ, getNuclideDataSync } from '../services/nuclideService';
import { findReactionPartners } from '../data/specialReactions';

export interface BackgroundEventResult {
    gridEntities: GridEntity[];
    messages: string[];
    activeEvent?: { type: string; color: string; timestamp: number };
    emptyTurnCount: number;
}

/**
 * Handles all chance-based background phenomena and periodic entity replenishment.
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
            nextEntities = generateEntities(1, nextEntities, state.playerPos, state.turn, EntityType.ANTI_NUCLIDE);
            nextMessages = [...nextMessages, "⚠️ WARNING: ANOMALY DETECTED. ANTI-NUCLIDE MATERIALIZED."].slice(-10);
        }
    } else {
        nextEmptyTurnCount = 0;
    }

    // 2. Behaviors: Movement and Matter Consumption
    nextEntities = moveAntiNuclides(nextEntities, state.playerPos);
    nextEntities = consumeMatterWithAntiNuclides(nextEntities);
    nextEntities = moveAnotherNuclides(nextEntities, state.playerPos, state.turn);
    
    // NEW Step 4: Resolve struggles between different camps after movement
    const struggleResult = resolveMatterStruggle(nextEntities);
    nextEntities = struggleResult.nextEntities;
    if (struggleResult.struggleMessages.length > 0) {
        nextMessages = [...nextMessages, ...struggleResult.struggleMessages].slice(-10);
    }

    nextEntities = consumeParticlesWithAnotherNuclides(nextEntities);

    // 3. Spawning "Another Nuclide" (Mid-boss) with Linked Spawning Logic
    const hasAnother = nextEntities.some(e => e.type === EntityType.ANOTHER_NUCLIDE);
    if (!hasAnother && state.turn > 20 && Math.random() < 0.015) {
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