import { ProtonCrossSectionRecord } from './protonReactions/types';
import { PROTON_REACTIONS_0_20 } from './protonReactions/z0_20';
import { PROTON_REACTIONS_21_40 } from './protonReactions/z21_40';
import { PROTON_REACTIONS_41_60 } from './protonReactions/z41_60';
import { PROTON_REACTIONS_61_80 } from './protonReactions/z61_80';
import { PROTON_REACTIONS_81_118 } from './protonReactions/z81_118';

export type { ProtonCrossSectionRecord };

/**
 * Aggregated Proton Cross Section Database
 * Populated with specific nuclides for proton-nucleus reactions across the periodic table.
 */
export const PROTON_CROSS_SECTIONS: Record<string, ProtonCrossSectionRecord> = {
  ...PROTON_REACTIONS_0_20,
  ...PROTON_REACTIONS_21_40,
  ...PROTON_REACTIONS_41_60,
  ...PROTON_REACTIONS_61_80,
  ...PROTON_REACTIONS_81_118,
};
