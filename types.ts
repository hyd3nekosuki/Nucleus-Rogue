
export enum EntityType {
  PLAYER = 'PLAYER',
  PROTON = 'PROTON',
  NEUTRON = 'NEUTRON',
  ENEMY_ELECTRON = 'ENEMY_ELECTRON', // Reduces Z
  ENEMY_POSITRON = 'ENEMY_POSITRON', // Reduces Z (annihilation-ish logic for game)
  VOID = 'VOID'
}

export enum DecayMode {
  STABLE = 'STABLE',
  ALPHA = 'ALPHA',
  BETA_MINUS = 'BETA_MINUS',
  BETA_PLUS = 'BETA_PLUS',
  PROTON_EMISSION = 'PROTON_EMISSION',
  NEUTRON_EMISSION = 'NEUTRON_EMISSION',
  SPONTANEOUS_FISSION = 'SPONTANEOUS_FISSION',
  ELECTRON_CAPTURE = 'ELECTRON_CAPTURE', // Added for interaction effect
  GAMMA = 'GAMMA', // Gamma Decay (Isomeric Transition)
  UNKNOWN = 'UNKNOWN',
  GAMMA_RAY_H = 'GAMMA_RAY_H', // Visual effect only (Bi-directional)
  GAMMA_RAY_V = 'GAMMA_RAY_V',  // Visual effect only (Bi-directional)
  GAMMA_RAY_UP = 'GAMMA_RAY_UP', // Visual effect only (Uni-directional)
  GAMMA_RAY_DOWN = 'GAMMA_RAY_DOWN', // Visual effect only (Uni-directional)
  GAMMA_RAY_LEFT = 'GAMMA_RAY_LEFT', // Visual effect only (Uni-directional)
  GAMMA_RAY_RIGHT = 'GAMMA_RAY_RIGHT', // Visual effect only (Uni-directional)
  GAMMA_RAY_DIAG_TL_BR = 'GAMMA_RAY_DIAG_TL_BR', // New: Diagonal \
  GAMMA_RAY_DIAG_TR_BL = 'GAMMA_RAY_DIAG_TR_BL', // New: Diagonal /
  STABILIZE_ZAP = 'STABILIZE_ZAP',
  NUCLEOSYNTHESIS_ZAP = 'NUCLEOSYNTHESIS_ZAP' // NEW: Powerful blue-white lightning
}

export enum NuclideCategory {
  STABLE = 1,
  ALPHA = 2,
  BETA_MINUS = 3,
  BETA_PLUS = 4,
  NON_EXISTENT = 5
}

export interface Position {
  x: number;
  y: number;
}

/**
 * Strict physical coordinates of a nucleus
 */
export interface NucleusCoords {
  z: number;
  a: number;
}

/**
 * Physical deltas for a nuclear reaction
 */
export interface DecayDelta {
  dZ: number;
  dA: number;
}

/**
 * Basic atomic identity
 */
export interface NuclideState {
  z: number;
  a: number;
}

export interface GridEntity {
  id: string;
  type: EntityType;
  position: Position;
  spawnTurn: number;
  isHighEnergy: boolean;
}

/**
 * Encapsulates changes to the grid entities during a single turn/reaction.
 */
export interface GridMutation {
    removedEntityIds: string[];
    modifiedEntities: GridEntity[];
    addedEntities: GridEntity[];
}

export interface VisualEffect {
  id: string;
  type: DecayMode;
  position: Position;
  timestamp: number;
}

export interface NuclideData {
  z: number;
  a: number;
  symbol: string;
  name: string;
  halfLifeText: string;
  halfLifeSeconds: number; // For calculation. Infinity for stable.
  decayModes: DecayMode[];
  category: NuclideCategory;
  isStable: boolean;
  exists: boolean; // Check if nuclide is known/valid
  description?: string;
}

/**
 * Result of an atomic reaction calculation.
 */
export interface AtomicReactionResult {
    dZ: number;
    dA: number;
    hpPenalty: number;
    energyBonus: number;
    actionBonusScore: number;
    messages: string[];
    inducedDecayMode?: DecayMode;
    inducedReactionLabel?: string;
    isPpFusion?: boolean;
    isPositronAbsorption?: boolean;
    isCoulombScattered?: boolean;
    isBremsAchieved?: boolean;
    magicProtectionBonus?: number;
    chargesUsed: number;
    scatteredMessage?: string;
    shouldShake?: boolean;
    shouldFlash?: boolean;
    chainDecayResult?: any;
    newGridEntities?: GridEntity[];
    newPosition?: Position;
    isAnnihilation?: boolean;
}

/**
 * Strict internal identification of a nuclide in map repositories
 */
export type NuclideId = `${number}-${number}`;

/**
 * Strict internal representation of physical nuclide data.
 */
export interface NuclideRecord {
  z: number;
  a: number;
  mode: DecayMode;
  halflife: number;
  category: NuclideCategory;
}

/**
 * Historical record of a nuclide discovery.
 * pz and pa represent the progenitor's state.
 */
export interface HistoryEntry {
    turn: number;
    name: string;
    symbol: string;
    z: number;
    a: number;
    method: string;
    pz: number | null; // Progenitor Z (Atomic Number of origin), null for origin
    pa: number | null; // Progenitor A (Mass Number of origin), null for origin
}

export interface GameState {
  turn: number;
  score: number;
  energyPoints: number;
  playerPos: Position;
  targetPos?: Position; // Destination mark for auto-move
  gridEntities: GridEntity[];
  currentNuclide: NuclideData;
  evolutionHistory: Record<string, HistoryEntry>; // Integrated Discovery History
  hp: number;
  maxHp: number;
  messages: string[];
  gameOver: boolean;
  gameOverReason?: string; // Reason for game over (e.g., "TRANSFORMATION_FAILED")
  loadingData: boolean;
  unlockedElements: number[]; // Array of Z numbers
  unlockedGroups: string[]; // Array of Group Names (e.g., "Noble Gas")
  disabledSkills: string[]; // List of toggled-off hidden skills
  effects: VisualEffect[];
  combo: number; // Current chain combo count
  maxCombo: number; // Record max combo
  lastComboTime: number; // Timestamp of the last successful decay
  isTimeStopped: boolean; // Magic: Pause HP decay and movement
  playerLevel: number; // 0-5 based on trefoil completion
  masteredDecays: DecayMode[]; // Track first-time decays
  comboStartNuclide?: NuclideState; // For Temporal Inversion
  comboStartedUnstable?: boolean; // Eligibility tracking for Inversion
  comboScore: number; // Track total points in current combo
  consecutiveProtons: number; // Hidden: Consecutive protons eaten
  consecutiveNeutrons: number; // Hidden: Consecutive neutrons eaten
  consecutiveElectrons: number; // Hidden: Consecutive electrons eaten
  lastConsumedType: EntityType | null; // Hidden: Tracker for streak
  decayStats: Record<string, number>; // Total counts of α, β-, β+, EC, SF, n, p, γ
  reactionStats: Record<string, number>; // Counts of (n,γ), (n,p), (n,2n), (n,α), (n,fission)
  activeEvent?: { type: string; color: string; timestamp: number }; // For subtle background signals
  reincarnations: number; // Track random generation count
  magicBarrierCharges: number; // Protects against HP loss from P/E capture (3 charges)
  tutorialMessage: string | null;
  hasSeenDecayTutorial: boolean;
  hasSeenCaptureTutorial: boolean;
}

export type GameAction =
  | { type: 'DISCOVER_NUCLIDE'; payload: { nextNuclide: NuclideData; method: string; pz: number | null; pa: number | null; addedScore: number } }
  | { type: 'UPDATE_BASIC_STATE'; payload: Partial<GameState> | ((prev: GameState) => Partial<GameState>) }
  | { type: 'RESET_STATE'; payload: GameState }
  | { type: 'APPLY_STABILITY_DECAY'; payload: { hp: number; energyPoints?: number; messages?: string[]; effects?: VisualEffect[]; gameOver?: boolean; gameOverReason?: string } }
  | { type: 'SET_HP'; payload: number }
  | { type: 'END_COMBO'; payload: { scoreBonus: number; unlockedGroups: string[]; messages: string[] } }
  | { type: 'CLEANUP_VISUALS'; payload: { effects: VisualEffect[]; activeEventExpired: boolean } };

export interface SavePayload {
  v: string; // App Version
  s: number; // Score
  e: number; // Energy
  h: number; // HP
  l: number; // Player Level
  r: number; // Reincarnations
  t: number; // Global Turn count
  cz: number; // Current Z
  ca: number; // Current A
  ue: number[]; // Unlocked Elements
  ug: string[]; // Unlocked Groups
  ds: string[]; // Disabled Skills
  md: DecayMode[]; // Mastered Decays
  st: Record<string, number>; // Decay Stats
  rs: Record<string, number>; // Reaction Stats
  ev: Record<string, string>; // Evolution Map (Last methods)
  mc: number; // Max Combo
  mb: number; // Magic Barrier Charges
}
