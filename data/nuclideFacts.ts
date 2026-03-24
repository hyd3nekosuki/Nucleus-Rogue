import { FACTS_SEGMENT_1 } from './nuclideFacts/nuclideFacts_1_10';
import { FACTS_SEGMENT_2 } from './nuclideFacts/nuclideFacts_11_40';
import { FACTS_SEGMENT_3 } from './nuclideFacts/nuclideFacts_41_80';
import { FACTS_SEGMENT_4 } from './nuclideFacts/nuclideFacts_81_100';
import { FACTS_SEGMENT_5 } from './nuclideFacts/nuclideFacts_101_118';

/**
 * Static database of scientific facts for common and significant nuclides.
 * Format: "Z-A": "Fact string"
 * Total entries: 387
 */
export const NUCLIDE_FACTS: Record<string, string> = {
  ...FACTS_SEGMENT_1,
  ...FACTS_SEGMENT_2,
  ...FACTS_SEGMENT_3,
  ...FACTS_SEGMENT_4,
  ...FACTS_SEGMENT_5
};
