import { 
  DecayMode, 
  NuclideData, 
  GridEntity, 
  Position, 
  NuclideState, 
  EntityType 
} from './physics';

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

export interface HistoryEntry {
  firstTurn: number;
  lastTurn: number;
  name: string;
  symbol: string;
  z: number;
  a: number;
  method: string;
  pz: number | null;
  pa: number | null;
}

/**
 * Snapshot of the nucleus state at the moment a chain/combo begins.
 */
export interface ComboOrigin {
  z: number;
  a: number;
  isUnstable: boolean;
  timestamp: number;
}

export interface DiscoveryContext {
  method: string;
  pz: number | null;
  pa: number | null;
  addedScore: number;
  chargesUsed: number;
  inducedDecayMode?: DecayMode;
  isManualDecay?: boolean; // Added to distinguish decay actions from transformations
}

export interface GameState {
  turn: number;
  score: number;
  energyPoints: number;
  playerPos: Position;
  targetPos?: Position;
  gridEntities: GridEntity[];
  currentNuclide: NuclideData;
  evolutionHistory: Record<string, HistoryEntry>;
  hp: number;
  maxHp: number;
  messages: string[];
  gameOver: boolean;
  gameOverReason?: string;
  loadingData: boolean;
  unlockedElements: number[];
  unlockedGroups: string[];
  disabledSkills: string[];
  effects: VisualEffect[];
  combo: number;
  maxCombo: number;
  lastComboTime: number;
  isTimeStopped: boolean;
  playerLevel: number;
  masteredDecays: DecayMode[];
  comboOrigin?: ComboOrigin;
  comboScore: number;
  consecutiveProtons: number;
  consecutiveNeutrons: number;
  consecutiveElectrons: number;
  lastConsumedType: EntityType | null;
  decayStats: Record<string, number>;
  reactionStats: Record<string, number>;
  activeEvent?: { type: string; color: string; timestamp: number };
  reincarnations: number;
  magicBarrierCharges: number;
  tutorialMessage: string | null;
  tutorialStartTurn: number;
  hasSeenDecayTutorial: boolean;
  hasSeenCaptureTutorial: boolean;
  hasSeenDripLineTutorial: boolean;
  reincarnationPool: { p: number; n: number; e: number };
  emptyTurnCount: number;
}

export type GameAction =
  | { type: 'DISCOVER_NUCLIDE'; payload: { nextNuclide: NuclideData; context: DiscoveryContext } }
  | { type: 'UPDATE_BASIC_STATE'; payload: Partial<GameState> | ((prev: GameState) => Partial<GameState>) }
  | { type: 'RESET_STATE'; payload: GameState }
  | { type: 'APPLY_STABILITY_DECAY'; payload: { hp: number; energyPoints?: number; messages?: string[]; effects?: VisualEffect[]; gameOver?: boolean; gameOverReason?: string } }
  | { type: 'SET_HP'; payload: number }
  | { type: 'END_COMBO'; payload: { scoreBonus: number; unlockedGroups: string[]; messages: string[] } }
  | { type: 'CLEANUP_VISUALS'; payload: { effects: VisualEffect[]; activeEventExpired: boolean } };

export interface SavePayload {
  v: string;
  s: number;
  e: number;
  h: number;
  l: number;
  r: number;
  t: number;
  cz: number;
  ca: number;
  ue: number[];
  ug: string[];
  ds: string[];
  md: DecayMode[];
  st: Record<string, number>;
  rs: Record<string, number>;
  ev: Record<string, string>;
  mc: number;
  mb: number;
  pp: number; // Pool Protons
  pn: number; // Pool Neutrons
  pe: number; // Pool Electrons
}