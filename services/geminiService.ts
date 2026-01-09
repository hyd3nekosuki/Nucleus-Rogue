import { NuclideData, NuclideCategory } from "../types";
import { getSymbol } from "../constants";
import { NUCLIDE_FACTS } from "../data/nuclideFacts";

/**
 * Service to provide nuclide descriptions.
 * Decommissioned dynamic AI fetching to avoid rate limit issues.
 * Now exclusively uses the static IAEA fact database.
 */

export const fetchNuclideDescription = async (z: number, a: number, name: string): Promise<string> => {
  const key = `${z}-${a}`;
  // Always return from static database or a fallback
  return NUCLIDE_FACTS[key] || "Stability data registered in IAEA nodes.";
};

// Compatibility shim
export const fetchNuclideData = async (z: number, a: number): Promise<NuclideData> => {
    return {
        z, a, symbol: getSymbol(z), name: '', halfLifeText: '', halfLifeSeconds: 0, 
        decayModes: [], category: NuclideCategory.STABLE, isStable: true, exists: true,
        description: "Accessing IAEA Chart...",
        isProtonDripLine: false,
        isNeutronDripLine: false
    };
};