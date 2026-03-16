import { DecayMode } from '../types';
import { MAGIC_NUMBERS } from '../constants/physics';

/**
 * Pure function to calculate the next mastery level based on newly performed decay modes.
 * Supports multiple modes (e.g., from composite decays like B-N).
 */
export const calculateNextLevel = (
  currentLevel: number,
  masteredDecays: DecayMode[],
  modes: DecayMode[]
): { nextLevel: number; nextMastered: DecayMode[] } => {
  let nextLevel = currentLevel;
  let nextMastered = [...masteredDecays];

  for (const mode of modes) {
    // Only increment level if the decay mode is new and we haven't reached the cap (Level 6)
    if (mode !== DecayMode.STABLE && mode !== DecayMode.UNKNOWN && !nextMastered.includes(mode) && nextLevel < 6) {
      nextLevel += 1;
      nextMastered.push(mode);
    }
  }

  return { nextLevel, nextMastered };
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
