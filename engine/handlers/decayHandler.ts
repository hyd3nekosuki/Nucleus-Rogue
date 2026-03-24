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
import { getNuclideDataSync, getDecayModeLabel } from '../../services/nuclideService';
import { resolveStabilityCrisis } from '../stabilityManager';
import { getDecayDeltas, calculateDecayEffects } from '../../physics/decaySystem';
import { applyDiscoveryLogic, findNearbyFreeCell } from '../core/discoveryEngine';
import { processUnlocks } from '../unlockSystem';
import { finalizeAction } from '../core/turnService';
import { handleAnotherNuclideCollision, handleDefeatByReaction } from '../core/collisionService';

/**
 * Handler for manual radioactive decay actions.
 * Now advances the global turn and triggers AI movement/assault resolution via turnService.
 */
export const handleManualDecay = (state: GameState, payload: { mode: DecayMode }): GameState => {
    const { mode } = payload;
    const now = Date.now();
    if (state.gameOver || state.loadingData || state.isTimeStopped) return state;
    
    let actualMode = mode;
    const isDaredevilActive = state.unlockedGroups.includes(TITLES.DEMON_CORE) && !state.disabledSkills.includes(TITLES.DEMON_CORE);
    const isForced = state.currentNuclide.isStable;

    if (mode === DecayMode.UNKNOWN) {
        const allModes = [
            DecayMode.ALPHA, 
            DecayMode.BETA_MINUS, 
            DecayMode.BETA_PLUS, 
            DecayMode.ELECTRON_CAPTURE,
            DecayMode.SPONTANEOUS_FISSION,
            DecayMode.PROTON_EMISSION, 
            DecayMode.NEUTRON_EMISSION, 
            DecayMode.GAMMA
        ];
        
        const candidates: DecayMode[] = [];

        allModes.forEach(m => {
            const deltas = getDecayDeltas(m);
            const targetZ = state.currentNuclide.z + deltas.dZ;
            const targetA = state.currentNuclide.a + deltas.dA;
            
            // Physical constraint: Z >= 0 and A >= Z
            if (targetZ < 0 || targetA < targetZ) return;

            if (isDaredevilActive) {
                // Demon core ON: All physically possible modes are candidates (even if game over)
                candidates.push(m);
            } else {
                // Demon core OFF
                if (m === DecayMode.SPONTANEOUS_FISSION) {
                    // SF is always a candidate if physically possible
                    candidates.push(m);
                } else if (getNuclideDataSync(targetZ, targetA).exists) {
                    // Others must exist in the database to avoid game over
                    candidates.push(m);
                }
            }
        });

        // Randomly select from candidates
        if (candidates.length > 0) {
            actualMode = candidates[Math.floor(Math.random() * candidates.length)];
        } else {
            actualMode = DecayMode.GAMMA; // Absolute fallback
        }
    }

    const fissionEnabled = !state.disabledSkills.includes(TITLES.FISSION);
    
    // Redirect fission modes to alpha if fission skill is disabled (Physical outcome alignment)
    if (!fissionEnabled) {
        if (actualMode === DecayMode.SPONTANEOUS_FISSION) {
            actualMode = DecayMode.ALPHA;
        } else if (actualMode === DecayMode.B_MINUS_SF) {
            actualMode = DecayMode.B_MINUS_ALPHA;
        } else if (actualMode === DecayMode.EC_SF) {
            actualMode = DecayMode.EC_ALPHA;
        }
    }

    const decayResult = calculateDecayEffects(
        actualMode, 
        state.currentNuclide, 
        state.playerPos, 
        state.gridEntities, 
        now, 
        state.unlockedGroups.includes(TITLES.PAIR_ANNIHILATION) && !state.disabledSkills.includes(TITLES.PAIR_ANNIHILATION), 
        fissionEnabled, 
        state.unlockedGroups.includes(TITLES.NEUTRONIZATION) && !state.disabledSkills.includes(TITLES.NEUTRONIZATION)
    );
    const newData = getNuclideDataSync(state.currentNuclide.z + decayResult.dZ, state.currentNuclide.a + decayResult.dA);
    
    const decayEvent: GameStateEvent = { 
        id: now, 
        type: 'DECAY', 
        subType: actualMode, 
        decayModeTrigger: actualMode, 
        shake: isForced || decayResult.shouldShake, 
        shakeIntensity: decayResult.shakeIntensity,
        flash: isForced ? undefined : (decayResult.shouldFlash ? (actualMode === DecayMode.SPONTANEOUS_FISSION ? 'bg-yellow-400' : 'bg-white') : undefined), 
        priorityMessages: decayResult.speechOverride ? [decayResult.speechOverride] : [],
        isAnnihilation: decayResult.isAnnihilation
    };

    if (!newData.exists) {
        const isDare = !state.currentNuclide.isStable && (state.currentNuclide.isProtonDripLine || state.currentNuclide.isNeutronDripLine);
        
        const unlockResult = processUnlocks(
            state.unlockedElements, state.unlockedGroups, null, null,
            false, false, false, false, 0, 
            false, false, false, false, false, 
            state.decayStats[DecayMode.BETA_PLUS] + (actualMode === DecayMode.BETA_PLUS ? 1 : 0), 
            state.decayStats[DecayMode.BETA_MINUS] + (actualMode === DecayMode.BETA_MINUS ? 1 : 0),
            false, isDare, false, false, state.playerLevel
        );

        if (isDaredevilActive) {
            return { 
                ...state, 
                unlockedGroups: unlockResult.updatedGroups,
                score: state.score + unlockResult.scoreBonus,
                energyPoints: isForced ? Math.max(0, state.energyPoints - 5) : state.energyPoints,
                lastEvent: decayEvent,
                ...resolveStabilityCrisis(state, REASON.DECAY_FAILED, isDare, false) 
            };
        }

        const newHp = Math.max(0, state.hp - 20);
        const failMsg = `⚠️ Decay failed: Target nuclide is outside the drip lines.`;
        
        let finalEntities = state.gridEntities;
        if (unlockResult.updatedGroups.includes(TITLES.DEMON_CORE) && !state.unlockedGroups.includes(TITLES.DEMON_CORE)) {
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
                energyPoints: isForced ? Math.max(0, state.energyPoints - 5) : state.energyPoints,
                lastEvent: decayEvent,
                messages: [...state.messages, failMsg, ...unlockResult.messages].slice(-10) 
            };
        }

        return { 
            ...state, 
            hp: newHp, 
            unlockedGroups: unlockResult.updatedGroups,
            gridEntities: finalEntities,
            score: state.score + unlockResult.scoreBonus,
            energyPoints: isForced ? Math.max(0, state.energyPoints - 5) : state.energyPoints,
            lastEvent: decayEvent,
            messages: [...state.messages, failMsg, ...unlockResult.messages].slice(-10) 
        };
    }

    const totalBaseActionPoints = (newData.a * SCORE_FACTORS.MASS_MULTIPLIER) + (newData.isStable ? SCORE_FACTORS.STABLE_BONUS : SCORE_FACTORS.UNSTABLE_BONUS) + decayResult.actionBonusScore;
    const context: DiscoveryContext = { method: decayResult.trigger, pz: state.currentNuclide.z, pa: state.currentNuclide.a, addedScore: totalBaseActionPoints, chargesUsed: 0, inducedDecayMode: actualMode, isManualDecay: true };
    
    const forcedMsg = isForced ? `☢️ FORCED DECAY: ${getDecayModeLabel(actualMode)} selected! (-5 MeV)` : "";
    const decayDescMsg = 
          actualMode === DecayMode.ALPHA ? `α decay into ${newData.name}` 
        : actualMode === DecayMode.BETA_MINUS ? `β- decay into ${newData.name}` 
        : actualMode === DecayMode.DOUBLE_BETA_MINUS ? `2β- decay into ${newData.name}`
        : actualMode === DecayMode.BETA_PLUS ? `β+ decay into ${newData.name}` 
        : actualMode === DecayMode.DOUBLE_BETA_PLUS ? `2β+ decay into ${newData.name}`
        : actualMode === DecayMode.ELECTRON_CAPTURE ? `Electron capture into ${newData.name}` 
        : actualMode === DecayMode.DOUBLE_ELECTRON_CAPTURE ? `Double electron capture into ${newData.name}`
        : actualMode === DecayMode.NEUTRON_EMISSION ? `n emission into ${newData.name}` 
        : actualMode === DecayMode.TWO_NEUTRON_EMISSION ? `2n emission into ${newData.name}`
        : actualMode === DecayMode.PROTON_EMISSION ? `p emission into ${newData.name}` 
        : actualMode === DecayMode.TWO_PROTON_EMISSION ? `2p emission into ${newData.name}` 
        : actualMode === DecayMode.SPONTANEOUS_FISSION ? `Spontaneous fission into ${newData.name}` 
        : actualMode === DecayMode.IT ? `Isomeric transition`
        : actualMode === DecayMode.GAMMA ? `γ decay`
        : actualMode.startsWith('B-') || actualMode.startsWith('B+') || actualMode.startsWith('EC') ? `${decayResult.trigger} into ${newData.name}`
        : "";
    
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

    // Update decay stats based on emitted particles for composite modes
    const nextDecayStats = { ...state.decayStats };
    const updateStats = (mode: DecayMode) => {
        switch (mode) {
            case DecayMode.ALPHA: 
                nextDecayStats[DecayMode.ALPHA] = (nextDecayStats[DecayMode.ALPHA] || 0) + 1; 
                nextDecayStats['PURE_ALPHA'] = (nextDecayStats['PURE_ALPHA'] || 0) + 1;
                break;
            case DecayMode.BETA_MINUS: 
                nextDecayStats[DecayMode.BETA_MINUS] = (nextDecayStats[DecayMode.BETA_MINUS] || 0) + 1; 
                nextDecayStats['PURE_BETA_MINUS'] = (nextDecayStats['PURE_BETA_MINUS'] || 0) + 1;
                break;
            case DecayMode.BETA_PLUS: nextDecayStats[DecayMode.BETA_PLUS] = (nextDecayStats[DecayMode.BETA_PLUS] || 0) + 1; break;
            case DecayMode.ELECTRON_CAPTURE: nextDecayStats[DecayMode.ELECTRON_CAPTURE] = (nextDecayStats[DecayMode.ELECTRON_CAPTURE] || 0) + 1; break;
            case DecayMode.SPONTANEOUS_FISSION: nextDecayStats[DecayMode.SPONTANEOUS_FISSION] = (nextDecayStats[DecayMode.SPONTANEOUS_FISSION] || 0) + 1; break;
            case DecayMode.PROTON_EMISSION: nextDecayStats[DecayMode.PROTON_EMISSION] = (nextDecayStats[DecayMode.PROTON_EMISSION] || 0) + 1; break;
            case DecayMode.TWO_PROTON_EMISSION: nextDecayStats[DecayMode.PROTON_EMISSION] = (nextDecayStats[DecayMode.PROTON_EMISSION] || 0) + 2; break;
            case DecayMode.NEUTRON_EMISSION: nextDecayStats[DecayMode.NEUTRON_EMISSION] = (nextDecayStats[DecayMode.NEUTRON_EMISSION] || 0) + 1; break;
            case DecayMode.TWO_NEUTRON_EMISSION: nextDecayStats[DecayMode.NEUTRON_EMISSION] = (nextDecayStats[DecayMode.NEUTRON_EMISSION] || 0) + 2; break;
            case DecayMode.GAMMA: nextDecayStats[DecayMode.GAMMA] = (nextDecayStats[DecayMode.GAMMA] || 0) + 1; break;
            case DecayMode.IT: 
                nextDecayStats[DecayMode.GAMMA] = (nextDecayStats[DecayMode.GAMMA] || 0) + 1; 
                nextDecayStats[DecayMode.IT] = (nextDecayStats[DecayMode.IT] || 0) + 1;
                break;
            case DecayMode.DOUBLE_BETA_MINUS: 
                nextDecayStats[DecayMode.BETA_MINUS] = (nextDecayStats[DecayMode.BETA_MINUS] || 0) + 2; 
                nextDecayStats[DecayMode.DOUBLE_BETA_MINUS] = (nextDecayStats[DecayMode.DOUBLE_BETA_MINUS] || 0) + 1;
                break;
            case DecayMode.DOUBLE_BETA_PLUS: nextDecayStats[DecayMode.BETA_PLUS] = (nextDecayStats[DecayMode.BETA_PLUS] || 0) + 2; break;
            case DecayMode.DOUBLE_ELECTRON_CAPTURE: nextDecayStats[DecayMode.ELECTRON_CAPTURE] = (nextDecayStats[DecayMode.ELECTRON_CAPTURE] || 0) + 2; break;
            
            case DecayMode.B_MINUS_N: 
                nextDecayStats[DecayMode.BETA_MINUS] = (nextDecayStats[DecayMode.BETA_MINUS] || 0) + 1; 
                nextDecayStats[DecayMode.NEUTRON_EMISSION] = (nextDecayStats[DecayMode.NEUTRON_EMISSION] || 0) + 1; 
                nextDecayStats[DecayMode.B_MINUS_N] = (nextDecayStats[DecayMode.B_MINUS_N] || 0) + 1;
                break;
            case DecayMode.B_MINUS_2N: nextDecayStats[DecayMode.BETA_MINUS] = (nextDecayStats[DecayMode.BETA_MINUS] || 0) + 1; nextDecayStats[DecayMode.NEUTRON_EMISSION] = (nextDecayStats[DecayMode.NEUTRON_EMISSION] || 0) + 2; break;
            case DecayMode.B_MINUS_3N: nextDecayStats[DecayMode.BETA_MINUS] = (nextDecayStats[DecayMode.BETA_MINUS] || 0) + 1; nextDecayStats[DecayMode.NEUTRON_EMISSION] = (nextDecayStats[DecayMode.NEUTRON_EMISSION] || 0) + 3; break;
            case DecayMode.B_MINUS_4N: nextDecayStats[DecayMode.BETA_MINUS] = (nextDecayStats[DecayMode.BETA_MINUS] || 0) + 1; nextDecayStats[DecayMode.NEUTRON_EMISSION] = (nextDecayStats[DecayMode.NEUTRON_EMISSION] || 0) + 4; break;
            case DecayMode.B_MINUS_5N: nextDecayStats[DecayMode.BETA_MINUS] = (nextDecayStats[DecayMode.BETA_MINUS] || 0) + 1; nextDecayStats[DecayMode.NEUTRON_EMISSION] = (nextDecayStats[DecayMode.NEUTRON_EMISSION] || 0) + 5; break;
            case DecayMode.B_MINUS_6N: nextDecayStats[DecayMode.BETA_MINUS] = (nextDecayStats[DecayMode.BETA_MINUS] || 0) + 1; nextDecayStats[DecayMode.NEUTRON_EMISSION] = (nextDecayStats[DecayMode.NEUTRON_EMISSION] || 0) + 6; break;
            case DecayMode.B_MINUS_7N: nextDecayStats[DecayMode.BETA_MINUS] = (nextDecayStats[DecayMode.BETA_MINUS] || 0) + 1; nextDecayStats[DecayMode.NEUTRON_EMISSION] = (nextDecayStats[DecayMode.NEUTRON_EMISSION] || 0) + 7; break;
            case DecayMode.B_MINUS_ALPHA: 
                nextDecayStats[DecayMode.BETA_MINUS] = (nextDecayStats[DecayMode.BETA_MINUS] || 0) + 1; 
                nextDecayStats[DecayMode.ALPHA] = (nextDecayStats[DecayMode.ALPHA] || 0) + 1; 
                nextDecayStats[DecayMode.B_MINUS_ALPHA] = (nextDecayStats[DecayMode.B_MINUS_ALPHA] || 0) + 1;
                break;
            case DecayMode.B_MINUS_PROTON: 
                nextDecayStats[DecayMode.BETA_MINUS] = (nextDecayStats[DecayMode.BETA_MINUS] || 0) + 1; 
                nextDecayStats[DecayMode.PROTON_EMISSION] = (nextDecayStats[DecayMode.PROTON_EMISSION] || 0) + 1; 
                nextDecayStats[DecayMode.B_MINUS_PROTON] = (nextDecayStats[DecayMode.B_MINUS_PROTON] || 0) + 1;
                break;
            case DecayMode.B_MINUS_SF: 
                nextDecayStats[DecayMode.BETA_MINUS] = (nextDecayStats[DecayMode.BETA_MINUS] || 0) + 1; 
                nextDecayStats[DecayMode.SPONTANEOUS_FISSION] = (nextDecayStats[DecayMode.SPONTANEOUS_FISSION] || 0) + 1; 
                nextDecayStats[DecayMode.B_MINUS_SF] = (nextDecayStats[DecayMode.B_MINUS_SF] || 0) + 1;
                break;
            
            case DecayMode.B_PLUS_ALPHA: 
                nextDecayStats[DecayMode.BETA_PLUS] = (nextDecayStats[DecayMode.BETA_PLUS] || 0) + 1; 
                nextDecayStats[DecayMode.ALPHA] = (nextDecayStats[DecayMode.ALPHA] || 0) + 1; 
                nextDecayStats[DecayMode.B_PLUS_ALPHA] = (nextDecayStats[DecayMode.B_PLUS_ALPHA] || 0) + 1;
                break;
            case DecayMode.B_PLUS_PROTON: nextDecayStats[DecayMode.BETA_PLUS] = (nextDecayStats[DecayMode.BETA_PLUS] || 0) + 1; nextDecayStats[DecayMode.PROTON_EMISSION] = (nextDecayStats[DecayMode.PROTON_EMISSION] || 0) + 1; break;
            case DecayMode.B_PLUS_2PROTON: nextDecayStats[DecayMode.BETA_PLUS] = (nextDecayStats[DecayMode.BETA_PLUS] || 0) + 1; nextDecayStats[DecayMode.PROTON_EMISSION] = (nextDecayStats[DecayMode.PROTON_EMISSION] || 0) + 2; break;
            
            case DecayMode.EC_ALPHA: 
                nextDecayStats[DecayMode.ELECTRON_CAPTURE] = (nextDecayStats[DecayMode.ELECTRON_CAPTURE] || 0) + 1; 
                nextDecayStats[DecayMode.ALPHA] = (nextDecayStats[DecayMode.ALPHA] || 0) + 1; 
                nextDecayStats[DecayMode.EC_ALPHA] = (nextDecayStats[DecayMode.EC_ALPHA] || 0) + 1;
                break;
            case DecayMode.EC_PROTON: nextDecayStats[DecayMode.ELECTRON_CAPTURE] = (nextDecayStats[DecayMode.ELECTRON_CAPTURE] || 0) + 1; nextDecayStats[DecayMode.PROTON_EMISSION] = (nextDecayStats[DecayMode.PROTON_EMISSION] || 0) + 1; break;
            case DecayMode.EC_2PROTON: nextDecayStats[DecayMode.ELECTRON_CAPTURE] = (nextDecayStats[DecayMode.ELECTRON_CAPTURE] || 0) + 1; nextDecayStats[DecayMode.PROTON_EMISSION] = (nextDecayStats[DecayMode.PROTON_EMISSION] || 0) + 2; break;
            case DecayMode.EC_SF: nextDecayStats[DecayMode.ELECTRON_CAPTURE] = (nextDecayStats[DecayMode.ELECTRON_CAPTURE] || 0) + 1; nextDecayStats[DecayMode.SPONTANEOUS_FISSION] = (nextDecayStats[DecayMode.SPONTANEOUS_FISSION] || 0) + 1; break;
            
            default: 
                nextDecayStats[mode] = (nextDecayStats[mode] || 0) + 1;
                break;
        }
    };
    updateStats(actualMode);

    // Advance turn and trigger background AI/assault processing
    const nextTurn = state.turn + 1;
    const baseEnergy = isForced ? Math.max(0, state.energyPoints - 5) : state.energyPoints;

    // Process enemies defeated by reaction (Alpha, SF, etc.)
    let currentEntities = nextEntities;
    let currentHistory = state.evolutionHistory;
    let reactionEnergyBonus = 0;
    let reactionMessages: string[] = [];

    if (decayResult.defeatedNuclides && decayResult.defeatedNuclides.length > 0) {
        const defeatResult = handleDefeatByReaction({ ...state, gridEntities: currentEntities }, decayResult.defeatedNuclides, nextTurn);
        currentEntities = defeatResult.nextEntities;
        currentHistory = defeatResult.nextHistory;
        reactionEnergyBonus = defeatResult.energyBonus;
        reactionMessages = defeatResult.messages;
        decayEvent.hasDefeat = true;
    }

    let nextState = applyDiscoveryLogic(
        { 
            ...state, 
            turn: nextTurn, 
            playerPos: decayResult.newPosition || state.playerPos, 
            energyPoints: Math.min(MAX_ENERGY, baseEnergy + (decayResult.energyBonus || 0) + reactionEnergyBonus), 
            gridEntities: currentEntities, 
            evolutionHistory: currentHistory,
            effects: [...state.effects, { id: Math.random().toString(36).substr(2, 9), type: actualMode, position: { ...state.playerPos }, timestamp: now }, ...decayResult.additionalEffects], 
            hp: Math.min(state.maxHp, state.hp + (newData.isStable ? 10 : 0)), 
            messages: [...state.messages, ...(forcedMsg ? [forcedMsg] : []), ...(decayDescMsg ? [decayDescMsg] : []), ...decayResult.extraMessages, ...reactionMessages].slice(-10), 
            decayStats: nextDecayStats, 
            consecutiveProtons: 0, 
            consecutiveNeutrons: 0, 
            consecutiveElectrons: 0, 
            lastConsumedType: null, 
            lastEvent: decayEvent 
        },
        newData, context, nextTurn, { isAnnihilation: decayResult.isAnnihilation }
    );

    return finalizeAction(nextState);
};