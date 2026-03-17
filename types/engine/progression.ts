import { DecayMode } from '../domain/nuclide';

/**
 * Game Engine Progression & Mastery Types
 * Defines the player's advancement and unlocked capabilities.
 */

export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type SkillActionType = 
  | 'STABILIZE' 
  | 'NUCLEOSYNTHESIS' 
  | 'R_PROCESS' 
  | 'TIME_STOP' 
  | 'TRANSMUTE' 
  | 'TOGGLE_SKILL' 
  | 'QUANTUM_OVERRIDE';

export interface MasteryUpdate {
  nextLevel: MasteryLevel;
  nextMastered: DecayMode[];
}
