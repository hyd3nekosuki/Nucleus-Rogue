import { DecayMode } from '../domain/nuclide';
import { Position } from '../domain/physics';

/**
 * Game Engine Transient Events & Visuals
 * Handles side-effects and animations triggered by the engine.
 */

export interface VisualEffect {
  id: string;
  type: DecayMode;
  position: Position;
  timestamp: number;
  isPlayed?: boolean;
}

export interface GameStateEvent {
  id: number;
  type: 'COLLISION' | 'DECAY' | 'LEVEL_UP' | 'SKILL' | 'SURVIVAL' | 'DEATH' | 'STABILITY_CRISIS' | 'ENGRAVE' | 'DEFEAT';
  subType?: string;
  decayModeTrigger?: DecayMode; 
  message?: string;
  priorityMessages?: string[]; 
  shake?: boolean;
  shakeIntensity?: 'normal' | 'light';
  flash?: string;
  isPlayed?: boolean;
  hasDefeat?: boolean;
  isAnnihilation?: boolean;
  chainReactionPath?: Position[];
}
