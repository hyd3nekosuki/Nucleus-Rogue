
import { GameState, EntityType, GridEntity, Position } from '../types';
import { generateEntities } from './moveSimulator';
import { moveAntiNuclides, consumeMatterWithAntiNuclides } from './behaviors/antiNuclideBehavior';
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

    // 2. Anti-nuclide Behavior: Movement and Matter Consumption - Refactored to Behavior layer
    nextEntities = moveAntiNuclides(nextEntities, state.playerPos);
    nextEntities = consumeMatterWithAntiNuclides(nextEntities);

    // 3. Background random events (Quantum coherence, etc.) - Requires "Unknown" skill
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
            nextEntities = nextEntities.map(e => (e.type !== EntityType.ENEMY_POSITRON && e.type !== EntityType.ANTI_NUCLIDE) ? { ...e, type: EntityType.NEUTRON } : e);
        } else if (randEvent < 0.95) {
            eventMsg = "⚠️ COSMIC RAY BURST: Massive Proton Flood!"; 
            signalType = "PROTON_BURST"; 
            signalColor = "#ff0055";
            nextEntities = nextEntities.map(e => (e.type !== EntityType.ENEMY_POSITRON && e.type !== EntityType.ANTI_NUCLIDE) ? { ...e, type: EntityType.PROTON } : e);
        } else {
            eventMsg = "⚠️ VACUUM FLUCTUATION: Massive Electron Storm!"; 
            signalType = "ELECTRON_FLUCTUATION"; 
            signalColor = "#facc15";
            nextEntities = nextEntities.map(e => (e.type !== EntityType.ENEMY_POSITRON && e.type !== EntityType.ANTI_NUCLIDE) ? { ...e, type: EntityType.ENEMY_ELECTRON } : e);
        }
        
        nextMessages = [...nextMessages, eventMsg].slice(-10);
        activeEvent = { type: signalType, color: signalColor, timestamp: Date.now() };
        eventTriggered = true;
    }

    // 4. Periodic Entity Respawn - Skipped if Gluttony skill is active
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
