import { DecayMode } from '../domain/nuclide';

/**
 * Game Engine Persistence & Serialization Types
 * Defines the structure for compressed binary save codes.
 */

export interface SavePayload {
  v: string;   // Version
  s: number;   // Score
  e: number;   // Energy
  h: number;   // HP
  l: number;   // Level
  r: number;   // Reincarnations
  t: number;   // Total Turn
  cz: number;  // Current Z
  ca: number;  // Current A
  ue: number[]; // Unlocked Elements
  ug: string[]; // Unlocked Groups (Titles)
  ds: string[]; // Disabled Skills
  md: DecayMode[]; // Mastered Decays
  st: Record<string, number>; // Statistics (Decays)
  rs: Record<string, number>; // Statistics (Reactions)
  ev: Record<string, string>; // Evolution History (Serialized)
  mc: number;  // Max Combo
  mb: number;  // Magic Barrier Charges
  et: number;  // Elapsed Time (RTA)
  pp: number;  // Reincarnation Pool Protons
  pn: number;  // Reincarnation Pool Neutrons
  pe: number;  // Reincarnation Pool Electrons
  rp: { p: boolean; e: boolean; n: boolean }; // Real Physics Progress
  tf: { d: boolean; c: boolean; l: boolean; e: boolean; s: boolean }; // Tutorial Flags
}
