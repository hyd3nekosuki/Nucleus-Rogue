import { DecayMode, EntityType, NuclideData, GridEntity, Position, VisualEffect } from '../index';

/**
 * Result of a single movement simulation step.
 */
export interface MoveResult {
  moved: boolean;
  newPos?: Position;
  dZ: number;
  dA: number;
  hpPenalty: number;
  energyBonus: number;
  actionBonusScore: number;
  inducedDecayMode?: DecayMode;
  inducedReactionLabel?: string;
  shouldShake?: boolean;
  shouldFlash?: boolean;
  additionalEffects?: VisualEffect[];
  isPpFusion?: boolean;
  isPositronAbsorption?: boolean;
  isCoulombScattered?: boolean;
  isBremsAchieved?: boolean;
  isZeroBarnAchieved?: boolean;
  isFissionAchieved?: boolean;
  gluttonyTrigger?: boolean;
  targetEntity?: GridEntity;
  evolvedEntities: GridEntity[];
  scatteredMessage?: string;
  magicProtectionBonus?: number;
  chargesUsed: number;
  consecutiveProtons: number;
  consecutiveNeutrons: number;
  consecutiveElectrons: number;
  lastConsumedType: EntityType | null;
  reincarnationPoolIncrement: { p: number; n: number; e: number };
  chainDecayResult?: any;
  byproduct?: { z: number, a: number };
}

/**
 * Result of a radioactive decay simulation.
 */
export interface DecayResult {
  dZ: number;
  dA: number;
  trigger: string;
  actionBonusScore: number;
  energyBonus: number; 
  extraMessages: string[];
  additionalEffects: VisualEffect[];
  newGridEntities: GridEntity[];
  shouldShake: boolean;
  shouldFlash: boolean;
  speechOverride: string | null;
  isAnnihilation?: boolean;
  newPosition?: Position; 
  emissions?: EntityType[];
  byproduct?: { z: number, a: number };
}
