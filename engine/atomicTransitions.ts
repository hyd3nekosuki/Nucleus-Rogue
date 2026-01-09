import { DecayMode, HistoryEntry, NuclideData } from '../types';
import { MAGIC_NUMBERS } from '../constants/physics';

/**
 * Pure function to calculate the next mastery level based on newly performed decay modes.
 */
export const calculateNextLevel = (
  currentLevel: number,
  masteredDecays: DecayMode[],
  mode: DecayMode
): { nextLevel: number; nextMastered: DecayMode[] } => {
  // Only increment level if the decay mode is new and we haven't reached the cap (Level 6)
  if (mode !== DecayMode.STABLE && mode !== DecayMode.UNKNOWN && !masteredDecays.includes(mode) && currentLevel < 6) {
    return {
      nextLevel: currentLevel + 1,
      nextMastered: [...masteredDecays, mode]
    };
  }
  return { nextLevel: currentLevel, nextMastered: masteredDecays };
};

/**
 * Pure function to determine the resulting magic barrier charges.
 * Replenishes to 3 if the target Z is a magic number and the current charges are empty.
 */
export const checkBarrierReplenish = (
  level: number,
  z: number,
  currentCharges: number
): number => {
  if (level >= 1 && MAGIC_NUMBERS.includes(z) && currentCharges === 0) {
    return 3;
  }
  return currentCharges;
};

/**
 * Pure function to construct a standard history entry object.
 */
export const createHistoryEntry = (
  nuclide: NuclideData,
  method: string,
  pz: number | null,
  pa: number | null,
  turn: number
): HistoryEntry => {
  return {
    firstTurn: turn,
    lastTurn: turn,
    name: nuclide.name,
    symbol: nuclide.symbol,
    z: nuclide.z,
    a: nuclide.a,
    method,
    pz,
    pa
  };
};