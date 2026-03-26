import { 
    GameState, 
    EntityType, 
    GridEntity,
    GameStateEvent, 
    DecayMode, 
    DiscoveryContext,
    HistoryEntry
} from '../../types';
import { 
    STABILIZE_COST, 
    NUCLEOSYNTHESIS_COST, 
    MAX_ENERGY, 
    BONUS_SCORES 
} from '../../constants/economy';
import { MAGIC_NUMBERS } from '../../constants/physics';
import { TITLES } from '../../constants/titles';
import { HISTORY_METHODS } from '../../constants/strings';
import { TUTORIAL_MESSAGES } from '../../constants/tutorial';
import { REASON } from '../../constants/gameOverReason';
import { getNuclideDataSync, getValidAsForZ } from '../../services/nuclideService';
import { generateEntities } from '../moveSimulator';
import { applyDiscoveryLogic, findNearbyFreeCell } from '../core/discoveryEngine';
import { finalizeAction } from '../core/turnService';
import { parseNuclideCommand, solveParticleRequirements } from '../particleEngine';

/**
 * Handler for all skill-based state transitions.
 */
export const handleUseSkill = (state: GameState, payload: { skillType: string, params?: any }): GameState => {
    const { skillType, params } = payload;
    const now = Date.now();
    if (state.gameOver || state.loadingData) return state;

    switch (skillType) {
        case 'STABILIZE': {
            const cost = STABILIZE_COST;
            if (state.energyPoints < cost) return { ...state, messages: [...state.messages, `⚠️ Not enough energy! Need ${cost}E.`].slice(-10) };
            
            const nextState: GameState = { 
                ...state, 
                turn: state.turn + 1, 
                hp: state.maxHp, 
                energyPoints: Math.max(0, state.energyPoints - cost), 
                messages: [...state.messages, `🔬 Stabilization: HP Recovered.`].slice(-10), 
                lastEvent: { id: now, type: 'SKILL', subType: 'STABILIZE', flash: 'bg-neon-green' } 
            };
            
            return finalizeAction(nextState);
        }

        case 'NUCLEOSYNTHESIS': {
            const cost = NUCLEOSYNTHESIS_COST;
            if (state.energyPoints < cost) return { ...state, messages: [...state.messages, `⚠️ Not enough energy! Need ${cost}E.`].slice(-10) };
            
            // Special Case: Z=118 Boundary
            if (state.currentNuclide.z === 118) {
                const isOg294 = state.currentNuclide.a === 294;
                const nextState: GameState = { 
                    ...state, 
                    turn: state.turn + 1,
                    energyPoints: Math.max(0, state.energyPoints - cost),
                    tutorialMessage: isOg294 ? TUTORIAL_MESSAGES.OGANESSON_CONGRATS : state.tutorialMessage,
                    recordTime: state.elapsedTime,
                    achievementTimes: state.achievementTimes['far_beyond_og'] 
                        ? state.achievementTimes 
                        : { ...state.achievementTimes, far_beyond_og: state.elapsedTime },
                    messages: [...state.messages, `🌟 NUCLEOSYNTHESIS: Boundary reached. ${isOg294 ? 'Message unlocked.' : ''}`].slice(-10),
                    lastEvent: { id: now, type: 'SKILL', subType: 'NUCLEOSYNTHESIS', flash: 'bg-yellow-400', shake: true, priorityMessages: ['Nucleosynthesis'] }
                };
                return finalizeAction(nextState);
            }

            const nextZ = state.currentNuclide.z + 1;
            if (nextZ > 118) return { ...state, messages: [...state.messages, "⚠️ Oganesson limit reached!"].slice(-10) };
            const validAs = getValidAsForZ(nextZ);
            const randomA = validAs[Math.floor(Math.random() * validAs.length)];
            const newData = getNuclideDataSync(nextZ, randomA);
            if (!newData.exists) return state;

            const nextState = applyDiscoveryLogic(
                { ...state, hp: state.maxHp, energyPoints: Math.max(0, state.energyPoints - cost), messages: [...state.messages, `🌟 NUCLEOSYNTHESIS: Synthesized ${newData.name}!`].slice(-10), isTimeStopped: false, consecutiveProtons: 0, consecutiveNeutrons: 0, consecutiveElectrons: 0, lastConsumedType: null, lastEvent: { id: now, type: 'SKILL', subType: 'NUCLEOSYNTHESIS', flash: 'bg-white', shake: true, priorityMessages: ['Nucleosynthesis'] } },
                newData,
                { method: HISTORY_METHODS.NUCLEOSYNTHESIS, pz: state.currentNuclide.z, pa: state.currentNuclide.a, addedScore: nextZ * 10000, chargesUsed: 0, isManualDecay: false },
                state.turn + 1,
                { isNucleosynthesis: true }
            );

            return finalizeAction(nextState);
        }

        case 'R_PROCESS': {
            let absorbedP = 0, absorbedN = 0, absorbedE = 0, absorbedPos = 0;
            state.gridEntities.forEach(e => { if (e.type === EntityType.PROTON) absorbedP++; else if (e.type === EntityType.NEUTRON) absorbedN++; else if (e.type === EntityType.ENEMY_ELECTRON) absorbedE++; else if (e.type === EntityType.ENEMY_POSITRON) absorbedPos++; });
            const totalAbsorbed = absorbedP + absorbedN + absorbedE + absorbedPos;
            if (totalAbsorbed === 0) return state;
            const nextZ = state.currentNuclide.z + absorbedP - absorbedE + absorbedPos;
            const nextA = state.currentNuclide.a + absorbedP + absorbedN;
            const newData = getNuclideDataSync(nextZ, nextA);
            if (!newData.exists || nextZ < 0 || nextZ > 118) return { ...state, gameOver: true, gameOverReason: REASON.NUCLEUS_COLLAPSE, gridEntities: [], energyPoints: 0, tutorialMessage: null, lastEvent: { id: now, type: 'DEATH' } };
            
            const nextState = applyDiscoveryLogic(
                { ...state, hp: state.maxHp, gridEntities: [], playerLevel: 0, masteredDecays: [], messages: [...state.messages, `🌌 r-process nucleosynthesis: Absorbed ${totalAbsorbed} particles!`, "⚠️ MASTERY CONSUMED: Level reset to 0."].slice(-10), lastEvent: { id: now, type: 'SKILL', subType: 'R_PROCESS', flash: 'bg-neon-blue', shake: true, priorityMessages: ['Rapid Process Nucleosynthesis'] } },
                newData,
                { method: HISTORY_METHODS.R_PROCESS, pz: state.currentNuclide.z, pa: state.currentNuclide.a, addedScore: totalAbsorbed * 50000, chargesUsed: 0, isManualDecay: false },
                state.turn + 1,
                { isNucleosynthesis: true }
            );

            // Check for Forbidden Capture achievement: 1 or more positrons absorbed and successful transformation
            let achievementTimes = nextState.achievementTimes;
            if (absorbedPos > 0 && !achievementTimes['forbidden_capture']) {
                achievementTimes = {
                    ...achievementTimes,
                    forbidden_capture: state.elapsedTime
                };
            }

            return finalizeAction({ ...nextState, achievementTimes });
        }

        case 'TIME_STOP': {
            const nextFrozen = !state.isTimeStopped;
            return { ...state, isTimeStopped: nextFrozen, messages: [...state.messages, nextFrozen ? "✨ FROZEN TIME" : "✨ TIME RESTORED"].slice(-10), lastEvent: { id: now, type: 'SKILL', subType: 'TIME_STOP' } };
        }

        case 'TRANSMUTE': {
            const { selectedZ } = params;
            const validAs = getValidAsForZ(selectedZ);
            const randomA = validAs[Math.floor(Math.random() * validAs.length)];
            const newData = getNuclideDataSync(selectedZ, randomA);
            if (!newData.exists) return state;

            const nextState = applyDiscoveryLogic(
                { ...state, messages: [...state.messages, `🔮 EXP. REPLICATE: ${newData.name}!`].slice(-10), isTimeStopped: false, combo: 0, lastEvent: { id: now, type: 'SKILL', subType: 'TRANSMUTE', flash: 'bg-neon-purple', shake: true, priorityMessages: ['Experimental Replication'] } },
                newData,
                { method: HISTORY_METHODS.EXP_REPLICATE, pz: state.currentNuclide.z, pa: state.currentNuclide.a, addedScore: BONUS_SCORES.EXP_REPLICATE_ACTION, chargesUsed: 0, isManualDecay: false },
                state.turn + 1,
                { skipComboSettlement: true, isExplicitReplication: true, isQuantumOverride: false }
            );

            return finalizeAction(nextState);
        }

        case 'QUANTUM_OVERRIDE': {
            const { code } = params;

            // --- DEBUG BACKDOOR ---
            const KONAMI_PREFIX = "UUDDLRLRBA";
            if (code && code.startsWith(KONAMI_PREFIX)) {
                const debugCmd = code.substring(KONAMI_PREFIX.length);
                let debugType: 'player' | 'enemy' | 'friend' = 'player';
                let nuclidePart = debugCmd;

                // Unlock Research Misconduct title if not already unlocked
                let updatedGroups = state.unlockedGroups;
                if (!updatedGroups.includes(TITLES.RESEARCH_MISCONDUCT)) {
                    updatedGroups = [...updatedGroups, TITLES.RESEARCH_MISCONDUCT];
                }

                // Record achievement for Research Misconduct
                let achievementTimes = { ...state.achievementTimes };
                if (achievementTimes['research_misconduct'] === undefined) {
                    achievementTimes['research_misconduct'] = state.elapsedTime;
                }

                if (debugCmd.toLowerCase().endsWith('e')) {
                    debugType = 'enemy';
                    nuclidePart = debugCmd.slice(0, -1);
                } else if (debugCmd.toLowerCase().endsWith('f')) {
                    debugType = 'friend';
                    nuclidePart = debugCmd.slice(0, -1);
                }

                const coords = parseNuclideCommand(nuclidePart);
                if (coords) {
                    const targetData = getNuclideDataSync(coords.z, coords.a);
                    if (targetData.exists) {
                        if (debugType === 'player') {
                            return finalizeAction(applyDiscoveryLogic(
                                { ...state, unlockedGroups: updatedGroups, achievementTimes, messages: [...state.messages, `🛠️ DEBUG: Transformed into ${targetData.name}`].slice(-10) },
                                targetData,
                                { method: HISTORY_METHODS.QUANTUM_OVERRIDE, pz: state.currentNuclide.z, pa: state.currentNuclide.a, addedScore: 0, chargesUsed: 0, isManualDecay: false },
                                state.turn + 1,
                                { isQuantumOverride: true }
                            ));
                        } else {
                            const isFriendly = debugType === 'friend';
                            const spawnPos = findNearbyFreeCell(state.playerPos, state.gridEntities, state.playerPos);
                            const newEntity: GridEntity = {
                                id: 'debug-' + Math.random().toString(36).substr(2, 9),
                                type: EntityType.ANOTHER_NUCLIDE,
                                position: spawnPos,
                                spawnTurn: state.turn,
                                isHighEnergy: false,
                                z: targetData.z,
                                a: targetData.a,
                                isFriendly
                            };
                            return {
                                ...state,
                                unlockedGroups: updatedGroups,
                                achievementTimes,
                                gridEntities: [...state.gridEntities, newEntity],
                                messages: [...state.messages, `🛠️ DEBUG: Spawned ${isFriendly ? 'friend' : 'enemy'} ${targetData.name}`].slice(-10)
                            };
                        }
                    }
                }
                
                // If no valid coords but prefix was used, still unlock the title
                return {
                    ...state,
                    unlockedGroups: updatedGroups,
                    achievementTimes,
                    messages: [...state.messages, "🛠️ DEBUG: Cheat Activated (Research Misconduct)"].slice(-10)
                };
            }
            // --- END DEBUG BACKDOOR ---

            if (state.playerLevel < 8) return state;
            const coords = parseNuclideCommand(code);
            if (!coords) return state;

            const requirements = solveParticleRequirements(
                state.currentNuclide.z, state.currentNuclide.a, 
                coords.z, coords.a, state.gridEntities
            );

            if (!requirements) return state;

            const targetData = getNuclideDataSync(coords.z, coords.a);
            const nextTurn = state.turn + 1;
            
            // Execute transformation through discoveryEngine to handle all side-effects (history, level, unlock)
            const consumedEntities = state.gridEntities.filter(e => requirements.idsToConsume.includes(e.id));
            const absorbedPos = consumedEntities.filter(e => e.type === EntityType.ENEMY_POSITRON).length;

            const nextState = applyDiscoveryLogic(
                { 
                    ...state, 
                    gridEntities: state.gridEntities.filter(e => !requirements.idsToConsume.includes(e.id)),
                    energyPoints: 0, // High-dimensional interference resets local energy
                    messages: [...state.messages, `🌌 SYSTEM OVERRIDE: Reachable configuration established for ${targetData.name}!`].slice(-10),
                    lastEvent: {
                        id: now, type: 'SKILL', subType: 'TRANSMUTE', flash: 'bg-yellow-400', shake: true,
                        priorityMessages: ['Quantum Override Transmutation']
                    }
                },
                targetData,
                { method: HISTORY_METHODS.QUANTUM_OVERRIDE, pz: state.currentNuclide.z, pa: state.currentNuclide.a, addedScore: 0, chargesUsed: 0, isManualDecay: false },
                nextTurn,
                { isExplicitReplication: true, isQuantumOverride: true }
            );

            // Check for Forbidden Capture achievement
            let achievementTimes = nextState.achievementTimes;
            if (absorbedPos > 0 && !achievementTimes['forbidden_capture']) {
                achievementTimes = {
                    ...achievementTimes,
                    forbidden_capture: state.elapsedTime
                };
            }

            return finalizeAction({ ...nextState, achievementTimes });
        }

        case 'TOGGLE_SKILL': {
            const { skillName } = params;
            const isDisabled = state.disabledSkills.includes(skillName);
            const nextDisabled = isDisabled ? state.disabledSkills.filter(s => s !== skillName) : [...state.disabledSkills, skillName];
            let nextEntities = [...state.gridEntities];
            if (skillName === TITLES.DEMON_CORE && isDisabled && !nextEntities.some(e => e.type === EntityType.ANTI_NUCLIDE)) {
                nextEntities = generateEntities(1, nextEntities, state.playerPos, state.turn, EntityType.ANTI_NUCLIDE);
            }
            
            // Dismiss tutorial if active
            const isSkillToggleTutorialActive = state.tutorialMessage === TUTORIAL_MESSAGES.SKILL_TOGGLE;
            
            return { 
                ...state, 
                gridEntities: nextEntities, 
                disabledSkills: nextDisabled, 
                messages: [...state.messages, `⚙️ Skill ${skillName} ${isDisabled ? 'ENABLED' : 'DISABLED'}`].slice(-10),
                hasSeenSkillToggleTutorial: true,
                tutorialMessage: isSkillToggleTutorialActive ? null : state.tutorialMessage
            };
        }

        default: return state;
    }
};