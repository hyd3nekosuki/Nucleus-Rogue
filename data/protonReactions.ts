import { ProtonCrossSectionRecord } from "./protonReactions/types";

export type { ProtonCrossSectionRecord };

/**
 * Aggregated Proton Cross Section Database
 * Initially populated with specific nuclides for proton-nucleus reactions.
 */
export const PROTON_CROSS_SECTIONS: Record<string, ProtonCrossSectionRecord> = {
  "1-2": { z: 1, a: 2, reactions: { "p,n+p": [0, 0.1], "p,g": [0, 1e-5] } },
  "1-3": { z: 1, a: 3, reactions: { "p,n": [0, 0.5] } },
  "3-7": { z: 3, a: 7, reactions: { "p,n": [0, 0.5] } },
  "4-7": { z: 4, a: 7, reactions: { "p,g": [0, 1e-6] } },
  "4-9": { z: 4, a: 9, reactions: { "p,n": [0, 0.5] } },
  "4-10": { z: 4, a: 10, reactions: { "p,n": [0, 0.5] } },
  "5-10": { z: 5, a: 10, reactions: { "p,n": [0, 0.01], "p,a": [0, 0.1] } },
  "5-11": { z: 5, a: 11, reactions: { "p,n": [0, 0.1], "p,g": [0, 1e-6], "p,a": [0, 0.1] } },
  "6-12": { z: 6, a: 12, reactions: { "p,n+p": [0, 0.1], "p,2p": [0, 0.05] } },
  "6-13": { z: 6, a: 13, reactions: { "p,g": [0, 1e-5], "p,a": [0, 0.1], "p,p+a": [0, 0.05] } },
  "6-14": { z: 6, a: 14, reactions: { "p,n": [0, 0.25] } },
  "92-235": { z: 92, a: 235, reactions: { "p,f": [0, 0.5] } },
  "92-238": { z: 92, a: 238, reactions: { "p,f": [0, 0.5] } },
};
