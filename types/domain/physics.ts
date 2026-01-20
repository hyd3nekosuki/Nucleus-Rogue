/**
 * Fundamental Physics & Geometry Types
 * These are base types that do not depend on other domain logic.
 */

export interface Position {
  x: number;
  y: number;
}

export interface NucleusCoords {
  z: number;
  a: number;
}

export interface DecayDelta {
  dZ: number;
  dA: number;
}

export interface NuclideState {
  z: number;
  a: number;
}
