import { NuclideData, DecayMode, NuclideCategory, NuclideRecord, NuclideId } from "../types";
import { getSymbol, getName } from "../constants/atomicData";
import { NUCLIDE_FACTS } from "../data/nuclideFacts";
import { NUCLIDE_REPOSITORY, getRepositoryValidAsForZ } from "../data/nuclideRepository";
import { DripLineService } from "../engine/dripLineService";

const getDecayDescription = (mode: DecayMode, isStable: boolean): string => {
    if (isStable) return 'Stable nuclide';
    switch(mode) {
        case DecayMode.ALPHA: return 'Radioactive nuclide: α';
        case DecayMode.BETA_MINUS: return 'Radioactive nuclide: β-';
        case DecayMode.BETA_PLUS: return 'Radioactive nuclide: β+';
        case DecayMode.ELECTRON_CAPTURE: return 'Radioactive nuclide: EC';
        case DecayMode.SPONTANEOUS_FISSION: return 'Radioactive nuclide: SF';
        case DecayMode.PROTON_EMISSION: return 'Unstable nuclide: p';
        case DecayMode.TWO_PROTON_EMISSION: return 'Unstable nuclide: 2p';
        case DecayMode.NEUTRON_EMISSION: return 'Unstable nuclide: n';
        case DecayMode.GAMMA: return 'Radioactive nuclide: γ';
        default: return 'Radioactive nuclide';
    }
};

/**
 * Returns a human-readable scientific symbol for a DecayMode.
 */
export const getDecayModeLabel = (mode: DecayMode): string => {
    switch (mode) {
        case DecayMode.STABLE: return "Stable";
        case DecayMode.ALPHA: return "α";
        case DecayMode.BETA_MINUS: return "β-";
        case DecayMode.BETA_PLUS: return "β+";
        case DecayMode.ELECTRON_CAPTURE: return "EC";
        case DecayMode.SPONTANEOUS_FISSION: return "SF";
        case DecayMode.PROTON_EMISSION: return "p";
        case DecayMode.TWO_PROTON_EMISSION: return "2p";
        case DecayMode.NEUTRON_EMISSION: return "n";
        case DecayMode.GAMMA: return "γ";
        default: return "Unknown";
    }
};

/**
 * Formats the decay modes of a nuclide into a single string.
 */
export const formatDecayModes = (nuclide: NuclideData): string => {
    if (nuclide.isStable) return "Stable";

    const modes = nuclide.decayModes.filter(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN);
    if (modes.length === 0) {
        return nuclide.decayModes.includes(DecayMode.UNKNOWN) ? "Unknown" : "Stable";
    }
    
    return modes.map(getDecayModeLabel).join(", ");
};

/**
 * Rich factory to create the UI-facing NuclideData structure.
 */
const createNuclide = (
    z: number, 
    a: number, 
    category: NuclideCategory, 
    mainMode: DecayMode, 
    halfLife: number, 
    isStable: boolean,
    isDatabaseEntry: boolean = false
): NuclideData => {
    const symbol = getSymbol(z);
    const elementName = getName(z);
    let baseName = `${elementName}-${a}`;
    
    if (z === 1) {
        if (a === 2) baseName = "Deuterium";
        if (a === 3) baseName = "Tritium";
    }
    if (z === 0 && a === 4) baseName = "Tetraneutron";

    let hlText = "Unknown";
    if (isStable) hlText = "Stable";
    else if (halfLife === 0) hlText = "-";
    else if (halfLife < 1e-6) hlText = "< 1 µs";
    else if (halfLife < 1) hlText = `${halfLife.toExponential(2)} s`;
    else if (halfLife < 60) hlText = `${Math.round(halfLife)} s`;
    else if (halfLife < 3600) hlText = `${Math.round(halfLife/60)} m`;
    else if (halfLife < 86400) hlText = `${Math.round(halfLife/3600)} h`;
    else if (halfLife < 31536000) hlText = `${Math.round(halfLife/86400)} d`;
    else hlText = `${(halfLife/31536000).toExponential(2)} y`;

    let description = NUCLIDE_FACTS[`${z}-${a}`] || getDecayDescription(mainMode, isStable);
    if (z === 0 && a === 4) description = '⚠ ANOMALY DETECTED: Tetraneutron.';

    // Drip Line logic application
    const isProtonDripLine = DripLineService.isAtProtonDripLine(z, a);
    const isNeutronDripLine = DripLineService.isAtNeutronDripLine(z, a);

    return {
        z, a, symbol, name: baseName, halfLifeText: hlText,
        halfLifeSeconds: halfLife === 0 ? 0.00000001 : halfLife,
        decayModes: isStable ? [DecayMode.STABLE] : [mainMode],
        category, isStable, exists: isDatabaseEntry || category !== NuclideCategory.NON_EXISTENT,
        description,
        isProtonDripLine,
        isNeutronDripLine
    };
};

/**
 * Accesses pre-parsed data from the repository and attaches metadata for the UI.
 */
export const getNuclideDataSync = (z: number, a: number): NuclideData => {
    const record = NUCLIDE_REPOSITORY.get(`${z}-${a}`);
    if (record) {
        return createNuclide(z, a, record.category, record.mode, record.halflife, record.category === NuclideCategory.STABLE, true);
    }
    return createNuclide(z, a, NuclideCategory.NON_EXISTENT, DecayMode.UNKNOWN, 0, false, false);
};

/**
 * Retrieves valid A values for a given Z from the static repository.
 */
export const getValidAsForZ = (z: number): number[] => {
    return getRepositoryValidAsForZ(z);
};

/**
 * Accesses pre-parsed and validated data from the repository.
 * If data is missing or physically contradictory, returns null.
 */
export const getKnownNuclide = (z: number, a: number): NuclideRecord | null => {
  const id: NuclideId = `${z}-${a}`;
  return NUCLIDE_REPOSITORY.get(id) || null;
};

export const getCategoryName = (cat: NuclideCategory): string => {
    switch(cat) {
        case NuclideCategory.STABLE: return "Stable Nuclide";
        case NuclideCategory.ALPHA: return "Unstable (Alpha Decay)";
        case NuclideCategory.BETA_MINUS: return "Unstable (Beta- Decay)";
        case NuclideCategory.BETA_PLUS: return "Unstable (Beta+ / EC)";
        case NuclideCategory.NON_EXISTENT: return "Theoretical / Unknown";
        default: return "Unknown";
    }
}

/**
 * Retrieves all nuclide records for visualization.
 * Uses the pre-parsed repository as the Single Source of Truth.
 */
export const getAllNuclides = (): { z: number, n: number, a: number, mode: DecayMode, halflife: number, cat: NuclideCategory }[] => {
  const nuclides: { z: number, n: number, a: number, mode: DecayMode, halflife: number, cat: NuclideCategory }[] = [];
  
  for (const record of NUCLIDE_REPOSITORY.values()) {
      nuclides.push({
          z: record.z,
          n: record.a - record.z,
          a: record.a,
          mode: record.mode,
          halflife: record.halflife,
          cat: record.category
      });
  }
  return nuclides;
};
