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
  type: 'COLLISION' | 'DECAY' | 'LEVEL_UP' | 'SKILL' | 'SURVIVAL' | 'DEATH' | 'STABILITY_CRISIS' | 'ENGRAVE';
  subType?: string;
  decayModeTrigger?: DecayMode; 
  message?: string;
  priorityMessages?: string[]; 
  shake?: boolean;
  flash?: string;
  isPlayed?: boolean;
}
