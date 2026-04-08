import { DecayMode, NuclideData } from '../domain/nuclide';
import { Position } from '../domain/physics';
import { EntityType, GridEntity } from '../domain/entities';
import { HistoryEntry, ComboOrigin, DiscoveryContext } from './history';
import { VisualEffect, GameStateEvent } from './events';
import { Language } from '../index';

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
  /** 
   * Static timestamp of a major achievement (e.g. Periodic Table completion).
   * Unlike elapsedTime, this is set only once and does not trigger high-frequency updates.
   */
  recordTime?: number;
  achievementTimes: Record<string, number>;
  tutorialMessage: string | null;
  tutorialStartTurn: number;
  hasSeenDecayTutorial: boolean;
  hasSeenCaptureTutorial: boolean;
  hasSeenDripLineTutorial: boolean;
  hasSeenEngraveTutorial: boolean;
  hasSeenSkillToggleTutorial: boolean;
  reincarnationPool: { p: number; n: number; e: number };
  hasPerformedActiveReincarnation: boolean;
  emptyTurnCount: number;
  lastEvent?: GameStateEvent; 
  persistentPath?: Position[];
  pathExpiryTurn?: number;
  realPhysicsUnlockProgress: {
    hasScatteredProton: boolean;
    hasScatteredElectron: boolean;
    hasAbsorbedNeutron: boolean;
  };
  isAnimatingFission?: boolean;
  tranquiloTurnCount: number;
  language: Language;
  showRadar: boolean;
  spatialIndex: {
    entities: Record<string, GridEntity[]>;
    entitiesById: Record<string, GridEntity>;
    effects: Record<string, VisualEffect[]>;
  };
}

/**
 * SessionState: Represents high-frequency, non-core-logic runtime values.
 * Separated from GameState to optimize rendering and reduce redundant calculations.
 */
export interface SessionState {
  elapsedTime: number;
  isScreenShaking: boolean;
  shakeIntensity: 'normal' | 'light';
  isFlashBang: boolean;
  flashColor: string;
}

export type GameAction =
  | { type: 'MOVE_PLAYER'; payload: { dx: number; dy: number; elapsedTime?: number } }
  | { type: 'MANUAL_DECAY'; payload: { mode: DecayMode; elapsedTime?: number } }
  | { type: 'USE_SKILL'; payload: { skillType: 'STABILIZE' | 'NUCLEOSYNTHESIS' | 'R_PROCESS' | 'TIME_STOP' | 'TRANSMUTE' | 'TOGGLE_SKILL' | 'QUANTUM_OVERRIDE'; params?: any; elapsedTime?: number } }
  | { type: 'DISCOVER_NUCLIDE'; payload: { nextNuclide: NuclideData; context: DiscoveryContext } }
  | { type: 'UPDATE_BASIC_STATE'; payload: Partial<GameState> | ((prev: GameState) => Partial<GameState>) }
  | { type: 'RESET_STATE'; payload: GameState }
  | { type: 'APPLY_STABILITY_DECAY'; payload: { hp: number; energyPoints?: number; messages?: string[]; effects?: VisualEffect[]; gameOver?: boolean; gameOverReason?: string } }
  | { type: 'SET_HP'; payload: number }
  | { type: 'RESET_VISUALS' }
  | { type: 'MARK_EVENT_PLAYED'; payload: { eventId: number } }
  | { type: 'MARK_EFFECTS_PLAYED'; payload: { effectIds: string[] } }
  | { type: 'NOTIFY_TUTORIAL_EVENT'; payload: { event: 'MASTERY_OPENED' } }
  | { type: 'END_COMBO'; payload: { scoreBonus: number; unlockedGroups: string[]; messages: string[] } }
  | { type: 'CLEANUP_VISUALS'; payload: { effects: VisualEffect[]; activeEventExpired: boolean } }
  | { type: 'ENGRAVE_CURRENT'; payload: { isResonating: boolean; elapsedTime?: number } }
  | { type: 'RECORD_ACHIEVEMENT'; payload: { id: string; time: number } }
  | { type: 'SET_LANGUAGE'; payload: Language }
  | { type: 'TOGGLE_RADAR' };
