
import { NuclideData, NuclideCategory } from "../types";
import { getSymbol } from "../constants";

/**
 * Gemini API enrichment is now disabled.
 * This service returns placeholders or static data to maintain compatibility.
 */

export const fetchNuclideDescription = async (z: number, a: number): Promise<string> => {
  return "Science episode feature is disabled.";
};

// Compatibility shim
export const fetchNuclideData = async (z: number, a: number): Promise<NuclideData> => {
    return {
        z, a, symbol: getSymbol(z), name: '', halfLifeText: '', halfLifeSeconds: 0, 
        decayModes: [], category: NuclideCategory.STABLE, isStable: true, exists: true,
        description: "Enrichment disabled."
    };
};
