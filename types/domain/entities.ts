import { Position } from './physics';

/**
 * Grid Entity Domain Types
 * Describes physical particles existing on the game grid.
 */

export enum EntityType {
  PLAYER = 'PLAYER',
  PROTON = 'PROTON',
  NEUTRON = 'NEUTRON',
  ENEMY_ELECTRON = 'ENEMY_ELECTRON',
  ENEMY_POSITRON = 'ENEMY_POSITRON',
  ANTI_NUCLIDE = 'ANTI_NUCLIDE',
  ANOTHER_NUCLIDE = 'ANOTHER_NUCLIDE',
  VOID = 'VOID'
}

export interface GridEntity {
  id: string;
  type: EntityType;
  position: Position;
  spawnTurn: number;
  isHighEnergy: boolean;
  z?: number; // Used for ANOTHER_NUCLIDE
  a?: number; // Used for ANOTHER_NUCLIDE
  isFriendly?: boolean; // Affiliation flag
}
