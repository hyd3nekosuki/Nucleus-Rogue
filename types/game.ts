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
  comboStartNuclide?: NuclideState;
  comboStartedUnstable?: boolean;
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
  hasSeenDecayTutorial: boolean;
  hasSeenCaptureTutorial: boolean;
  reincarnationPool: { p: number; n: number; e: number };
}

export type GameAction =
  | { type: 'DISCOVER_NUCLIDE'; payload: { nextNuclide: NuclideData; method: string; pz: number | null; pa: number | null; addedScore: number; chargesUsed: number; inducedDecayMode?: DecayMode } }
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
}