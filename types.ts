
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

export interface GridEntity {
  id: string;
  type: EntityType;
  position: Position;
  spawnTurn: number;
  isHighEnergy: boolean;
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

export interface GameState {
  turn: number;
  score: number;
  energyPoints: number;
  playerPos: Position;
  gridEntities: GridEntity[];
  currentNuclide: NuclideData;
  hp: number;
  maxHp: number;
  messages: string[];
  gameOver: boolean;
  gameOverReason?: string; // Reason for game over (e.g., "TRANSFORMATION_FAILED")
  loadingData: boolean;
  unlockedElements: number[]; // Array of Z numbers
  unlockedGroups: string[]; // Array of Group Names (e.g., "Noble Gas")
  disabledSkills: string[]; // NEW: List of toggled-off hidden skills
  effects: VisualEffect[];
  combo: number; // Current chain combo count
  maxCombo: number; // Record max combo
  lastComboTime: number; // Timestamp of the last successful decay
  isTimeStopped: boolean; // Magic: Pause HP decay and movement
  playerLevel: number; // 0-5 based on trefoil completion
  masteredDecays: DecayMode[]; // Track first-time decays
  comboStartNuclide?: { z: number, a: number }; // NEW: For Temporal Inversion
  comboScore: number; // NEW: Track total points in current combo
  consecutiveProtons: number; // Hidden: Consecutive protons eaten
  consecutiveNeutrons: number; // Hidden: Consecutive neutrons eaten
  consecutiveElectrons: number; // Hidden: Consecutive electrons eaten
  lastConsumedType: EntityType | null; // Hidden: Tracker for streak
}