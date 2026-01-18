import { 
  GameState, 
  DecayMode, 
  EntityType, 
  DiscoveryContext,
  GameStateEvent
} from '../../types';
import { MAX_ENERGY, SCORE_FACTORS } from '../../constants/economy';
import { REASON } from '../../constants/gameOverReason';
import { TITLES } from '../../constants/titles';
import { generateEntities } from '../moveSimulator';
import { getNuclideDataSync } from '../../services/nuclideService';
import { resolveStabilityCrisis } from '../stabilityManager';
import { getDecayDeltas, calculateDecayEffects } from '../../physics/decaySystem';
import { applyDiscoveryLogic, findNearbyFreeCell } from '../core/discoveryEngine';
import { processUnlocks } from '../unlockSystem';
import { processRandomBackgroundEvents } from '../randomEvents';
import { handleAnotherNuclideCollision } from '../core/collisionService';

/**
 * Handler for manual radioactive decay actions.
 * Step 4 Update: Now advances the global turn and triggers AI movement/assault resolution.
 */
export const handleManualDecay = (state: GameState, payload: { mode: DecayMode }): GameState => {
    const { mode } = payload;
    const now = Date.now();
    if (state.gameOver || state.loadingData || state.isTimeStopped) return state;
    
    let actualMode = mode;
    const isDaredevilActive = state.unlockedGroups.includes(TITLES.DAREDEVIL) && !state.disabledSkills.includes(TITLES.DAREDEVIL);

    if (mode === DecayMode.UNKNOWN) {
        const candidates = [DecayMode.GAMMA];
        const checkModes = [DecayMode.ALPHA, DecayMode.BETA_MINUS, DecayMode.BETA_PLUS, DecayMode.PROTON_EMISSION, DecayMode.NEUTRON_EMISSION, DecayMode.SPONTANEOUS_FISSION];
        checkModes.forEach(m => {
            const deltas = getDecayDeltas(m);
            if (isDaredevilActive || getNuclideDataSync(state.currentNuclide.z + deltas.dZ, state.currentNuclide.a + deltas.dA).exists) candidates.push(m);
        });
        actualMode = candidates[Math.floor(Math.random() * candidates.length)];
    }

    const decayResult = calculateDecayEffects(actualMode, state.currentNuclide, state.playerPos, state.gridEntities, now, state.unlockedGroups.includes(TITLES.PAIR_ANNIHILATION) && !state.disabledSkills.includes(TITLES.PAIR_ANNIHILATION), !state.disabledSkills.includes(TITLES.FISSION), state.unlockedGroups.includes(TITLES.NEUTRONIZATION) && !state.disabledSkills.includes(TITLES.NEUTRONIZATION));
    const newData = getNuclideDataSync(state.currentNuclide.z + decayResult.dZ, state.currentNuclide.a + decayResult.dA);
    
    if (!newData.exists) {
        const isDare = !state.currentNuclide.isStable && (state.currentNuclide.isProtonDripLine || state.currentNuclide.isNeutronDripLine);
        
        const unlockResult = processUnlocks(
            state.unlockedElements, state.unlockedGroups, null, null,
            false, false, false, false, 0, 
            false, false, false, false, false, 
            state.decayStats[DecayMode.BETA_PLUS] + (actualMode === DecayMode.BETA_PLUS ? 1 : 0), 
            state.decayStats[DecayMode.BETA_MINUS] + (actualMode === DecayMode.BETA_MINUS ? 1 : 0),
            false, isDare
        );

        if (isDaredevilActive) {
            return { 
                ...state, 
                unlockedGroups: unlockResult.updatedGroups,
                score: state.score + unlockResult.scoreBonus,
                ...resolveStabilityCrisis(state, REASON.DECAY_FAILED, isDare, false) 
            };
        }

        const newHp = Math.max(0, state.hp - 20);
        const failMsg = `⚠️ Decay failed: Target nuclide is outside the drip lines.`;
        
        let finalEntities = state.gridEntities;
        if (unlockResult.updatedGroups.includes(TITLES.DAREDEVIL) && !state.unlockedGroups.includes(TITLES.DAREDEVIL)) {
            finalEntities = generateEntities(1, finalEntities, state.playerPos, state.turn, EntityType.ANTI_NUCLIDE);
        }

        if (newHp === 0) {
             const crisisUpdate = resolveStabilityCrisis(state, REASON.DECAY_FAILED, isDare, false);
             return { 
                ...state, 
                ...crisisUpdate, 
                unlockedGroups: unlockResult.updatedGroups,
                gridEntities: finalEntities,
                score: state.score + unlockResult.scoreBonus,
                messages: [...state.messages, failMsg, ...unlockResult.messages].slice(-10) 
            };
        }

        return { 
            ...state, 
            hp: newHp, 
            unlockedGroups: unlockResult.updatedGroups,
            gridEntities: finalEntities,
            score: state.score + unlockResult.scoreBonus,
            messages: [...state.messages, failMsg, ...unlockResult.messages].slice(-10) 
        };
    }

    const totalBaseActionPoints = (newData.a * SCORE_FACTORS.MASS_MULTIPLIER) + (newData.isStable ? SCORE_FACTORS.STABLE_BONUS : SCORE_FACTORS.UNSTABLE_BONUS) + decayResult.actionBonusScore;
    const context: DiscoveryContext = { method: decayResult.trigger, pz: state.currentNuclide.z, pa: state.currentNuclide.a, addedScore: totalBaseActionPoints, chargesUsed: 0, inducedDecayMode: actualMode, isManualDecay: true };
    
    const decayDescMsg = actualMode === DecayMode.ALPHA ? `α decay into ${newData.name}` : actualMode === DecayMode.BETA_MINUS ? `β- decay into ${newData.name}` : actualMode === DecayMode.BETA_PLUS ? `β+ decay into ${newData.name}` : actualMode === DecayMode.ELECTRON_CAPTURE ? `Electron capture into ${newData.name}` : actualMode === DecayMode.NEUTRON_EMISSION ? `n emission into ${newData.name}` : actualMode === DecayMode.PROTON_EMISSION ? `p emission into ${newData.name}` : actualMode === DecayMode.SPONTANEOUS_FISSION ? `Spontaneous fission into ${newData.name}` : actualMode === DecayMode.GAMMA ? `γ decay` : "";
    const decayEvent: GameStateEvent = { id: now, type: 'DECAY', subType: actualMode, decayModeTrigger: actualMode, shake: decayResult.shouldShake, flash: decayResult.shouldFlash ? (actualMode === DecayMode.SPONTANEOUS_FISSION ? 'bg-yellow-400' : 'bg-white') : undefined, priorityMessages: decayResult.speechOverride ? [decayResult.speechOverride] : [] };

    let nextEntities = decayResult.newGridEntities;
    if (decayResult.emissions && decayResult.emissions.length > 0) {
        decayResult.emissions.forEach(emitType => {
            const isFission = actualMode === DecayMode.SPONTANEOUS_FISSION;
            nextEntities = generateEntities(1, nextEntities, state.playerPos, state.turn, emitType, true);
            if (isFission && nextEntities.length > 0) {
                const last = nextEntities[nextEntities.length - 1];
                if (last.type === EntityType.NEUTRON) last.isHighEnergy = true;
            }
        });
    }

    if (decayResult.byproduct) {
        const spawnPos = findNearbyFreeCell(state.playerPos, nextEntities, state.playerPos);
        nextEntities.push({
            id: 'fragment-' + Math.random().toString(36).substr(2, 9),
            type: EntityType.ANOTHER_NUCLIDE,
            position: spawnPos,
            spawnTurn: state.turn,
            isHighEnergy: false,
            z: decayResult.byproduct.z,
            a: decayResult.byproduct.a,
            isFriendly: true
        });
    }

    // Advance turn and trigger background AI/assault processing
    const nextTurn = state.turn + 1;
    let nextState = applyDiscoveryLogic(
        { ...state, turn: nextTurn, playerPos: decayResult.newPosition || state.playerPos, energyPoints: Math.min(MAX_ENERGY, state.energyPoints + (decayResult.energyBonus || 0)), gridEntities: nextEntities, effects: [...state.effects, { id: Math.random().toString(36).substr(2, 9), type: actualMode, position: { ...state.playerPos }, timestamp: now }, ...decayResult.additionalEffects], hp: Math.min(state.maxHp, state.hp + (newData.isStable ? 10 : 0)), messages: [...state.messages, ...(decayDescMsg ? [decayDescMsg] : []), ...decayResult.extraMessages].slice(-10), decayStats: { ...state.decayStats, [actualMode]: (state.decayStats[actualMode] || 0) + 1 }, consecutiveProtons: 0, consecutiveNeutrons: 0, consecutiveElectrons: 0, lastConsumedType: null, lastEvent: decayEvent },
        newData, context, nextTurn, { isAnnihilation: decayResult.isAnnihilation }
    );

    const bgResult = processRandomBackgroundEvents(nextState);
    // Fix: Destructure bgResult to separate GameState updates from the temporary 'assaultingEntity' flag.
    const { assaultingEntity, ...stateUpdates } = bgResult;
    nextState = { ...nextState, ...stateUpdates };
    
    // Assault Logic: Resolve collision if an enemy moved onto the player after decay
    if (assaultingEntity) {
        nextState = handleAnotherNuclideCollision(nextState, assaultingEntity, nextState.playerPos);
    }

    return nextState;
};
