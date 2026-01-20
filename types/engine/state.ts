import { DecayMode, NuclideData } from '../domain/nuclide';
import { Position } from '../domain/physics';
import { EntityType, GridEntity } from '../domain/entities';
import { HistoryEntry, ComboOrigin, DiscoveryContext } from './history';
import { VisualEffect, GameStateEvent } from './events';

/**
 * Central Game Engine State Management
 * Represents the complete runtime snapshot of the game.
 */

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
  lastConsumedType: null | EntityType;
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
  hasSeenEngraveTutorial: boolean;
  reincarnationPool: { p: number; n: number; e: number };
  emptyTurnCount: number;
  lastEvent?: GameStateEvent; 
}

export type GameAction =
  | { type: 'MOVE_PLAYER'; payload: { dx: number; dy: number } }
  | { type: 'MANUAL_DECAY'; payload: { mode: DecayMode } }
  | { type: 'USE_SKILL'; payload: { skillType: 'STABILIZE' | 'NUCLEOSYNTHESIS' | 'R_PROCESS' | 'TIME_STOP' | 'TRANSMUTE' | 'TOGGLE_SKILL' | 'QUANTUM_OVERRIDE'; params?: any } }
  | { type: 'DISCOVER_NUCLIDE'; payload: { nextNuclide: NuclideData; context: DiscoveryContext } }
  | { type: 'UPDATE_BASIC_STATE'; payload: Partial<GameState> | ((prev: GameState) => Partial<GameState>) }
  | { type: 'RESET_STATE'; payload: GameState }
  | { type: 'APPLY_STABILITY_DECAY'; payload: { hp: number; energyPoints?: number; messages?: string[]; effects?: VisualEffect[]; gameOver?: boolean; gameOverReason?: string } }
  | { type: 'SET_HP'; payload: number }
  | { type: 'END_COMBO'; payload: { scoreBonus: number; unlockedGroups: string[]; messages: string[] } }
  | { type: 'CLEANUP_VISUALS'; payload: { effects: VisualEffect[]; activeEventExpired: boolean } }
  | { type: 'ENGRAVE_CURRENT'; payload: { isResonating: boolean } };
