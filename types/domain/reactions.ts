import { DecayMode } from './nuclide';
import { Position } from './physics';
import { EntityType, GridEntity } from './entities';

/**
 * Atomic Reaction Outcome Types
 * Defines the physical consequences of nuclear interactions.
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
  shakeIntensity?: 'normal' | 'light';
  shouldFlash?: boolean;
  flashColor?: string;
  chainDecayResult?: any;
  newGridEntities?: GridEntity[];
  newPosition?: Position;
  isAnnihilation?: boolean;
  emissions?: EntityType[];
  byproduct?: { z: number, a: number };
}

/**
 * Astrophysics & Historical Special Reactions
 * Defines scientific facts about specific nuclide-nuclide interactions.
 */
export interface SpecialReaction {
  z1: number;
  a1: number;
  z2: number;
  a2: number;
  productZ: number;
  productA: number;
  product2Z?: number; // Secondary nuclide product
  product2A?: number;
  emissions: EntityType[]; // Remaining raw particle emissions
  message: string;
  energyBonus: number; // Q-value in MeV
  isSuperheavy?: boolean;
}
