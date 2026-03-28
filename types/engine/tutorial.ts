import { NuclideData } from '../domain/nuclide';

/**
 * Game Engine Tutorial System Types
 * Manages the sequential delivery of scientific guidance.
 */

export type TutorialEvent = 
  | 'GAME_START' 
  | 'PARTICLE_CAPTURED' 
  | 'DECAY_PERFORMED' 
  | 'TURN_ADVANCED' 
  | 'ENGRAVE_PERFORMED'
  | 'MASTERY_OPENED';

export interface TutorialContext {
  randomStart?: boolean;
  nextNuclide?: NuclideData;
  currentTurn?: number;
  energyIncreased?: boolean;
}

export interface TutorialStateFlags {
  hasSeenDecayTutorial: boolean;
  hasSeenCaptureTutorial: boolean;
  hasSeenDripLineTutorial: boolean;
  hasSeenEngraveTutorial: boolean;
}
