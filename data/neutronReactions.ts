import { CrossSectionRecord } from "./neutronReactions/types";
import { DATA_Z0_20 } from "./neutronReactions/z0_20";
import { DATA_Z21_40 } from "./neutronReactions/z21_40";
import { DATA_Z41_60 } from "./neutronReactions/z41_60";
import { DATA_Z61_80 } from "./neutronReactions/z61_80";
import { DATA_Z81_118 } from "./neutronReactions/z81_118";

export type { CrossSectionRecord };

/**
 * Aggregated Neutron Cross Section Database
 */
export const NEUTRON_CROSS_SECTIONS: Record<string, CrossSectionRecord> = {
  ...DATA_Z0_20,
  ...DATA_Z21_40,
  ...DATA_Z41_60,
  ...DATA_Z61_80,
  ...DATA_Z81_118,
};
