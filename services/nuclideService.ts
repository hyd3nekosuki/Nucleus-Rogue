import { NuclideData, DecayMode, NuclideCategory, NuclideRecord, NuclideId, BranchingRatio, Language } from "../types";
import { getSymbol, getName } from "../constants/atomicData";
import { NUCLIDE_FACTS } from "../data/nuclideFacts";
import { NUCLIDE_REPOSITORY, getRepositoryValidAsForZ } from "../data/nuclideRepository";
import { DripLineService } from "../engine/dripLineService";
import { isElectron, isPositron } from "../utils/particleUtils";

export const ELECTRON_DATA: NuclideData = {
    z: -1,
    a: 0,
    symbol: 'e-',
    name: 'electron',
    halfLifeText: 'Stable',
    halfLifeSeconds: Infinity,
    decayModes: [DecayMode.STABLE],
    branches: [],
    category: NuclideCategory.STABLE,
    isStable: true,
    exists: true,
    isProtonDripLine: false,
    isNeutronDripLine: false,
    description: 'A fundamental particle. Not a nucleus, but surviving as a lone electron.'
};

export const POSITRON_DATA: NuclideData = {
    z: 1,
    a: 0,
    symbol: 'e+',
    name: 'positron',
    halfLifeText: 'Stable',
    halfLifeSeconds: Infinity,
    decayModes: [DecayMode.STABLE],
    branches: [],
    category: NuclideCategory.STABLE,
    isStable: true,
    exists: true,
    isProtonDripLine: false,
    isNeutronDripLine: false,
    description: 'The antiparticle of the electron. Not a nucleus, but surviving as a lone positron.'
};

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
export const getDecayModeLabel = (mode: DecayMode, language: Language = 'en'): string => {
    switch (mode) {
        case DecayMode.STABLE: return language === 'jp' ? "安定" : "Stable";
        case DecayMode.ALPHA: return "α";
        case DecayMode.BETA_MINUS: return "β-";
        case DecayMode.BETA_PLUS: return "β+";
        case DecayMode.ELECTRON_CAPTURE: return "EC";
        case DecayMode.EC_B_PLUS: return "EC/β+";
        case DecayMode.SPONTANEOUS_FISSION: return "SF";
        case DecayMode.PROTON_EMISSION: return "p";
        case DecayMode.TWO_PROTON_EMISSION: return "2p";
        case DecayMode.NEUTRON_EMISSION: return "n";
        case DecayMode.TWO_NEUTRON_EMISSION: return "2n";
        case DecayMode.GAMMA: return "γ";
        case DecayMode.IT: return "IT";
        case DecayMode.DOUBLE_BETA_MINUS: return "2β-";
        case DecayMode.DOUBLE_BETA_PLUS: return "2β+";
        case DecayMode.DOUBLE_ELECTRON_CAPTURE: return "2EC";
        case DecayMode.B_MINUS_N: return "β-n";
        case DecayMode.B_MINUS_2N: return "β-2n";
        case DecayMode.B_MINUS_3N: return "β-3n";
        case DecayMode.B_MINUS_4N: return "β-4n";
        case DecayMode.B_MINUS_5N: return "β-5n";
        case DecayMode.B_MINUS_6N: return "β-6n";
        case DecayMode.B_MINUS_7N: return "β-7n";
        case DecayMode.B_MINUS_ALPHA: return "β-α";
        case DecayMode.B_MINUS_PROTON: return "β-p";
        case DecayMode.B_MINUS_SF: return "β-SF";
        case DecayMode.B_PLUS_ALPHA: return "β+α";
        case DecayMode.B_PLUS_PROTON: return "β+p";
        case DecayMode.B_PLUS_2PROTON: return "β+2p";
        case DecayMode.EC_ALPHA: return "ECα";
        case DecayMode.EC_PROTON: return "ECp";
        case DecayMode.EC_2PROTON: return "EC2p";
        case DecayMode.EC_SF: return "ECSF";
        default: return language === 'jp' ? "不明" : "Unknown";
    }
};

/**
 * Formats the decay modes of a nuclide into a single string.
 */
export const formatDecayModes = (nuclide: NuclideData, showAll: boolean = true, language: Language = 'en'): string => {
    if (nuclide.isStable) return language === 'jp' ? "安定" : "Stable";

    let modes = nuclide.decayModes.filter(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN);
    if (modes.length === 0) {
        return nuclide.decayModes.includes(DecayMode.UNKNOWN) ? (language === 'jp' ? "不明" : "Unknown") : (language === 'jp' ? "安定" : "Stable");
    }

    if (!showAll && modes.length > 1) {
        modes = [modes[0]];
    }
    
    return modes.map(m => getDecayModeLabel(m, language)).join(", ");
};

/**
 * Randomly selects a decay mode based on branching ratios.
 * Handles the special case of EC+B+ with 50/50 split.
 */
export const selectDecayMode = (branches: BranchingRatio[]): DecayMode => {
    if (!branches || branches.length === 0) return DecayMode.UNKNOWN;
    
    // Filter out very small ratios if not already done by parser
    const validBranches = branches.filter(b => b.ratio >= 0.00001);
    if (validBranches.length === 0) return branches[0].mode;

    const totalRatio = validBranches.reduce((sum, b) => sum + b.ratio, 0);
    let random = Math.random() * totalRatio;
    
    let selectedMode = validBranches[0].mode;
    for (const branch of validBranches) {
        if (random < branch.ratio) {
            selectedMode = branch.mode;
            break;
        }
        random -= branch.ratio;
    }

    // Special handling for EC+B+
    if (selectedMode === DecayMode.EC_B_PLUS) {
        return Math.random() < 0.5 ? DecayMode.ELECTRON_CAPTURE : DecayMode.BETA_PLUS;
    }
    
    return selectedMode;
};

/**
 * Rich factory to create the UI-facing NuclideData structure.
 */
const createNuclide = (
    z: number, 
    a: number, 
    category: NuclideCategory, 
    branches: BranchingRatio[], 
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
    else if (halfLife === 0) hlText = "unknown";
    else if (halfLife < 1e-6) hlText = "< 1 µs";
    else if (halfLife < 1) hlText = `${halfLife.toExponential(2)} s`;
    else if (halfLife < 60) hlText = `${Math.round(halfLife)} s`;
    else if (halfLife < 3600) hlText = `${Math.round(halfLife/60)} m`;
    else if (halfLife < 86400) hlText = `${Math.round(halfLife/3600)} h`;
    else if (halfLife < 31536000) hlText = `${Math.round(halfLife/86400)} d`;
    else hlText = `${(halfLife/31536000).toExponential(2)} y`;

    const mainMode = branches.length > 0 ? branches[0].mode : DecayMode.UNKNOWN;
    let description = NUCLIDE_FACTS[`${z}-${a}`] || getDecayDescription(mainMode, isStable);
    if (z === 0 && a === 4) description = '⚠ ANOMALY DETECTED: Tetraneutron.';

    // Drip Line logic application
    const isProtonDripLine = DripLineService.isAtProtonDripLine(z, a);
    const isNeutronDripLine = DripLineService.isAtNeutronDripLine(z, a);

    return {
        z, a, symbol, name: baseName, halfLifeText: hlText,
        halfLifeSeconds: halfLife === 0 ? 0.00000001 : halfLife,
        decayModes: isStable ? [DecayMode.STABLE] : branches.map(b => b.mode),
        branches,
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
    if (isElectron({ z, a })) return ELECTRON_DATA;
    if (isPositron({ z, a })) return POSITRON_DATA;
    const record = NUCLIDE_REPOSITORY.get(`${z}-${a}`);
    if (record) {
        return createNuclide(z, a, record.category, record.branches, record.halflife, record.category === NuclideCategory.STABLE, true);
    }
    return createNuclide(z, a, NuclideCategory.NON_EXISTENT, [], 0, false, false);
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
          mode: record.branches.length > 0 ? record.branches[0].mode : DecayMode.UNKNOWN,
          halflife: record.halflife,
          cat: record.category
      });
  }
  return nuclides;
};
