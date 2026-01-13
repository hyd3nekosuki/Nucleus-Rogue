import { GameState, DecayMode } from '../types';
import { GRID_WIDTH, GRID_HEIGHT, INITIAL_HP, INITIAL_NUCLIDE, HISTORY_METHODS, TUTORIAL_MESSAGES } from '../constants';

/**
 * Provides the clean slate initial state for the Nucleus game engine.
 * Isolated for clean state management and consistent resetting.
 */
export const getInitialState = (): GameState => ({
    turn: 0,
    score: 0,
    energyPoints: 0,
    playerPos: { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) },
    gridEntities: [],
    currentNuclide: INITIAL_NUCLIDE,
    // Add missing evolutionHistory property to fix GameState type compatibility error
    evolutionHistory: {},
    hp: INITIAL_HP,
    maxHp: INITIAL_HP,
    messages: ["Welcome to the Nucleus!", "Master radioactive decays to increase your Mastery Level."],
    gameOver: false,
    gameOverReason: undefined,
    loadingData: false,
    unlockedElements: [], 
    unlockedGroups: [],
    disabledSkills: [],
    effects: [],
    combo: 0,
    maxCombo: 0,
    lastComboTime: 0,
    isTimeStopped: false,
    playerLevel: 0,
    masteredDecays: [],
    comboScore: 0,
    consecutiveProtons: 0,
    consecutiveNeutrons: 0,
    consecutiveElectrons: 0,
    lastConsumedType: null,
    reincarnations: 0,
    magicBarrierCharges: 0,
    tutorialMessage: TUTORIAL_MESSAGES.CAPTURE,
    tutorialStartTurn: 0,
    hasSeenDecayTutorial: false,
    hasSeenCaptureTutorial: false,
    hasSeenDripLineTutorial: false,
    comboOrigin: undefined,
    reincarnationPool: { p: 0, n: 0, e: 0 },
    emptyTurnCount: 0,
    decayStats: {
        [DecayMode.ALPHA]: 0,
        [DecayMode.BETA_MINUS]: 0,
        [DecayMode.BETA_PLUS]: 0,
        [DecayMode.ELECTRON_CAPTURE]: 0,
        [DecayMode.SPONTANEOUS_FISSION]: 0,
        [DecayMode.NEUTRON_EMISSION]: 0,
        [DecayMode.PROTON_EMISSION]: 0,
        [DecayMode.GAMMA]: 0,
    },
    reactionStats: {
        [HISTORY_METHODS.REACTION_NG]: 0,
        [HISTORY_METHODS.REACTION_NP]: 0,
        [HISTORY_METHODS.REACTION_N2N]: 0,
        [HISTORY_METHODS.REACTION_NA]: 0,
        [HISTORY_METHODS.REACTION_NF]: 0,
    }
});