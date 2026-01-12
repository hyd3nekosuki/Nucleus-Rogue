import { GridEntity, Position, EntityType, GameState, DecayMode, VisualEffect } from '../types';

import { GRID_WIDTH, GRID_HEIGHT } from '../constants/gameConfig';
import { isWithinBounds, findEntityAt } from '../utils/gridUtils';
import { calculateInteraction, calculateNeutronReaction } from '../physics/atomicCalculator';
import { TITLES } from '../constants/titles';

/**
 * Result structure for the physics simulation of a move.
 * Contains only raw physical changes and interaction metadata.
 */
export interface MoveResult {
    moved: boolean;
    newPos?: Position;
    dZ: number;
    dA: number;
    hpPenalty: number;
    energyBonus: number;
    actionBonusScore: number;
    inducedDecayMode?: DecayMode;
    inducedReactionLabel?: string;
    shouldShake?: boolean;
    shouldFlash?: boolean;
    additionalEffects?: VisualEffect[];
    isPpFusion?: boolean;
    isPositronAbsorption?: boolean;
    isCoulombScattered?: boolean;
    isBremsAchieved?: boolean;
    isZeroBarnAchieved?: boolean;
    isFissionAchieved?: boolean;
    gluttonyTrigger?: boolean;
    targetEntity?: GridEntity;
    evolvedEntities: GridEntity[];
    scatteredMessage?: string;
    magicProtectionBonus?: number;
    chargesUsed: number;
    consecutiveProtons: number;
    consecutiveNeutrons: number;
    consecutiveElectrons: number;
    lastConsumedType: EntityType | null;
    reincarnationPoolIncrement: { p: number; n: number; e: number };
}

export const generateEntities = (count: number, currentEntities: GridEntity[], playerPos: Position, currentTurn: number = 0, forcedType?: EntityType): GridEntity[] => {
    const newEntities = [...currentEntities];
    
    for (let i = 0; i < count; i++) {
        // Step 1: Identify all available empty cells on the grid
        const freeCells: Position[] = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const isPlayerPos = (x === playerPos.x && y === playerPos.y);
                const isOccupied = newEntities.some(e => e.position.x === x && e.position.y === y);
                
                if (!isPlayerPos && !isOccupied) {
                    freeCells.push({ x, y });
                }
            }
        }

        // If no space left, stop generation
        if (freeCells.length === 0) break;

        // Step 2: Select a cell using exactly one random roll per entity
        const randomIndex = Math.floor(Math.random() * freeCells.length);
        const pos = freeCells[randomIndex];

        if (forcedType) {
            newEntities.push({
                id: Math.random().toString(36).substr(2, 9),
                type: forcedType,
                position: pos,
                spawnTurn: currentTurn,
                isHighEnergy: false
            });
        } else {
            const rand = Math.random();
            newEntities.push({
              id: Math.random().toString(36).substr(2, 9),
              type: rand > 0.9 ? EntityType.ENEMY_ELECTRON : (rand > 0.5 ? EntityType.PROTON : EntityType.NEUTRON),
              position: pos,
              spawnTurn: currentTurn,
              isHighEnergy: false
            });
        }
    }
    return newEntities;
};

/**
 * Physics Simulator: Calculates the outcome of a single move attempt.
 * Does NOT update GameState. Does NOT build messages.
 */
export const calculateMoveResult = (
    prev: GameState,
    dx: number,
    dy: number,
    ENERGY_EVOLUTION_TURNS: number
): MoveResult => {
    const newPos: Position = { x: prev.playerPos.x + dx, y: prev.playerPos.y + dy };

    // 1. Validation
    if (!isWithinBounds(newPos)) {
        return { 
            moved: false, dZ: 0, dA: 0, hpPenalty: 0, energyBonus: 0, actionBonusScore: 0, evolvedEntities: prev.gridEntities, chargesUsed: 0,
            consecutiveProtons: prev.consecutiveProtons,
            consecutiveNeutrons: prev.consecutiveNeutrons,
            consecutiveElectrons: prev.consecutiveElectrons,
            lastConsumedType: prev.lastConsumedType,
            reincarnationPoolIncrement: { p: 0, n: 0, e: 0 }
        };
    }

    // 2. Interaction Setup
    const entityMatch = findEntityAt(prev.gridEntities, newPos);
    
    let dZ = 0, dA = 0, hpPenalty = 0, energyBonus = 0, actionBonusScore = 0;
    let inducedDecayMode: DecayMode | undefined = undefined;
    let reactionLabel = "";
    let interactionResult: any = null;
    let nextEntities = [...prev.gridEntities];
    let targetEntity: GridEntity | undefined;
    let gluttonyTrigger = false;
    let chargesUsed = 0;
    let poolInc = { p: 0, n: 0, e: 0 };

    let cP = prev.consecutiveProtons;
    let cN = prev.consecutiveNeutrons;
    let cE = prev.consecutiveElectrons;
    let lT = prev.lastConsumedType;

    const isZeroBarnActive = prev.unlockedGroups.includes(TITLES.ZERO_BARN) && !prev.disabledSkills.includes(TITLES.ZERO_BARN);
    const scatteringActive = prev.unlockedGroups.includes(TITLES.ELECTRON_SCATTERING) && !prev.disabledSkills.includes(TITLES.ELECTRON_SCATTERING);
    const isFusionDisabled = prev.disabledSkills.includes(TITLES.FUSION);
    const isDaredevilActive = prev.unlockedGroups.includes(TITLES.DAREDEVIL) && !prev.disabledSkills.includes(TITLES.DAREDEVIL);

    if (entityMatch) {
        targetEntity = entityMatch.entity;
        // Collision prevention for positrons unless we are a neutron state
        if (targetEntity.type === EntityType.ENEMY_POSITRON && prev.currentNuclide.z !== 0) {
            return { 
                moved: false, dZ: 0, dA: 0, hpPenalty: 0, energyBonus: 0, actionBonusScore: 0, evolvedEntities: prev.gridEntities, chargesUsed: 0,
                consecutiveProtons: prev.consecutiveProtons,
                consecutiveNeutrons: prev.consecutiveNeutrons,
                consecutiveElectrons: prev.consecutiveElectrons,
                lastConsumedType: prev.lastConsumedType,
                reincarnationPoolIncrement: { p: 0, n: 0, e: 0 }
            };
        }

        nextEntities.splice(entityMatch.index, 1);
        if (nextEntities.length === 0) gluttonyTrigger = true;

        // Streak maintenance for Neutrons and Electrons
        if (targetEntity.type === EntityType.NEUTRON) {
            if (lT != EntityType.NEUTRON) { cP = 0; cN = 0; cE = 0; lT = EntityType.NEUTRON; }
            // Only increment streak if Zero Barn is NOT preventing the capture
            if (!isZeroBarnActive) { cN++; } 
            else { poolInc.n = 1; }

        } else if (targetEntity.type === EntityType.ENEMY_ELECTRON) {
            if (lT != EntityType.ENEMY_ELECTRON) { cP = 0; cN = 0; cE = 0; lT = EntityType.ENEMY_ELECTRON; }
            // Only increment streak if scattering is not preventing the capture
            if (!scatteringActive) { cE++; }
            else { poolInc.e = 1; }
        }

        const isAnnihilationSkillActive = prev.unlockedGroups.includes(TITLES.PAIR_ANNIHILATION) && !prev.disabledSkills.includes(TITLES.PAIR_ANNIHILATION);

        // High energy neutron special reactions
        const neutronReaction = calculateNeutronReaction(
            prev.currentNuclide, 
            targetEntity, 
            newPos, 
            nextEntities, 
            Date.now(), 
            isAnnihilationSkillActive, 
            !prev.disabledSkills.includes(TITLES.FISSION),
            prev.unlockedGroups.includes(TITLES.NEUTRONIZATION) && !prev.disabledSkills.includes(TITLES.NEUTRONIZATION),
            isZeroBarnActive,
            isDaredevilActive
        );

        if (neutronReaction) {
            interactionResult = neutronReaction;
            nextEntities = neutronReaction.newGridEntities || nextEntities;
        } else {
            interactionResult = calculateInteraction(
                prev.currentNuclide, targetEntity, cE, prev.hp, prev.magicBarrierCharges, 
                prev.unlockedGroups, prev.disabledSkills
            );
        }

        dZ = interactionResult.dZ;
        dA = interactionResult.dA;
        hpPenalty = interactionResult.hpPenalty;
        energyBonus = interactionResult.energyBonus || 0;
        actionBonusScore = interactionResult.actionBonusScore || 0;
        inducedDecayMode = interactionResult.inducedDecayMode;
        reactionLabel = interactionResult.inducedReactionLabel || "";
        chargesUsed = interactionResult.chargesUsed || 0;

        // Streak and Pool maintenance for Protons
        if (targetEntity.type === EntityType.PROTON) {
            if (!interactionResult.isCoulombScattered) {
                if (lT != EntityType.PROTON) { cP = 0; cN = 0; cE = 0; lT = EntityType.PROTON; }
                // 1 Success case: Capture occurred (No barrier block AND Fusion enabled)
                if (!isFusionDisabled) { cP++; }
                // 2. Skill case: Fusion is explicitly disabled by player (Absorption into pool)
                else { poolInc.p = 1; }
            }
            else {
                // 3. Physical case: Coulomb scattered due to low HP (No increment to pool, particle is lost to grid)
                // interactionResult.isCoulombScattered is true. Pool stays 0.               
            }
        }

        if (interactionResult.isPpFusion) {
            nextEntities.push({ id: 'pp-fusion-eplus-' + Math.random().toString(36).substr(2, 9), type: EntityType.ENEMY_POSITRON, position: { ...prev.playerPos }, spawnTurn: prev.turn, isHighEnergy: false });
            gluttonyTrigger = false;
        }

        if (interactionResult.isCoulombScattered) {
            // Even during scattering, we use the deterministic empty cell selection for the new proton position
            const potentialCells: Position[] = [];
            for (let y = 0; y < GRID_HEIGHT; y++) {
                for (let x = 0; x < GRID_WIDTH; x++) {
                    const isNewPos = (x === newPos.x && y === newPos.y);
                    const isOccupiedByExisting = nextEntities.some(e => e.position.x === x && e.position.y === y);
                    if (!isNewPos && !isOccupiedByExisting) potentialCells.push({ x, y });
                }
            }
            
            if (potentialCells.length > 0) {
                const respawnPos = potentialCells[Math.floor(Math.random() * potentialCells.length)];
                nextEntities.push({ id: Math.random().toString(36).substr(2, 9), type: EntityType.PROTON, position: respawnPos, spawnTurn: prev.turn, isHighEnergy: false });
            }
            gluttonyTrigger = false;
        }
    }

    // 3. Evolution of Entities
    const evolvedEntities = nextEntities.map(e => {
        if (e.type === EntityType.PROTON || e.type === EntityType.ENEMY_ELECTRON) {
            const elapsed = (prev.turn + 1) - e.spawnTurn;
            const shouldBeHigh = Math.floor(elapsed / ENERGY_EVOLUTION_TURNS) % 2 === 1;
            if (e.isHighEnergy !== shouldBeHigh) return { ...e, isHighEnergy: shouldBeHigh };
        }
        return e;
    });

    return { 
        moved: true, 
        newPos,
        dZ,
        dA,
        hpPenalty,
        energyBonus,
        actionBonusScore,
        inducedDecayMode, 
        inducedReactionLabel: reactionLabel, 
        shouldShake: !!interactionResult?.shouldShake || !!interactionResult?.isCoulombScattered || !!interactionResult?.isPpFusion || !!interactionResult?.isPositronAbsorption, 
        shouldFlash: !!interactionResult?.shouldFlash || !!interactionResult?.isPpFusion || !!interactionResult?.isPositronAbsorption, 
        additionalEffects: interactionResult?.chainDecayResult?.additionalEffects, 
        isPpFusion: !!interactionResult?.isPpFusion, 
        isPositronAbsorption: !!interactionResult?.isPositronAbsorption, 
        isCoulombScattered: !!interactionResult?.isCoulombScattered,
        isBremsAchieved: !!interactionResult?.isBremsAchieved,
        isZeroBarnAchieved: cN >= 20 && !prev.unlockedGroups.includes(TITLES.ZERO_BARN),
        isFissionAchieved: inducedDecayMode === DecayMode.SPONTANEOUS_FISSION,
        gluttonyTrigger,
        targetEntity,
        evolvedEntities,
        scatteredMessage: interactionResult?.scatteredMessage,
        magicProtectionBonus: interactionResult?.magicProtectionBonus,
        chargesUsed,
        consecutiveProtons: cP,
        consecutiveNeutrons: cN,
        consecutiveElectrons: cE,
        lastConsumedType: lT,
        reincarnationPoolIncrement: poolInc
    };
};