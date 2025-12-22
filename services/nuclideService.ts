
import { NuclideData, DecayMode, NuclideCategory } from "../types";
import { getSymbol, getName } from "../constants";
import { getAllNuclides } from "../data/staticNuclides";

const nuclideMap = new Map<string, { mode: DecayMode, hl: number, cat: NuclideCategory }>();
let isCacheInitialized = false;

const initCache = () => {
    if (isCacheInitialized) return;
    const all = getAllNuclides();
    all.forEach(n => {
        nuclideMap.set(`${n.z}-${n.a}`, { mode: n.mode, hl: n.halflife, cat: n.cat });
    });
    isCacheInitialized = true;
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
        case DecayMode.NEUTRON_EMISSION: return 'Unstable nuclide: n';
        case DecayMode.GAMMA: return 'Radioactive nuclide: γ';
        default: return 'Radioactive nuclide';
    }
};

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

    let description = getDecayDescription(mainMode, isStable);
    if (z === 0 && a === 1) description = 'A free neutron. Essential constituent of atomic nuclei.';
    else if (z === 1 && a === 1) description = 'The most abundant element in the universe.';
    else if (z === 0 && a === 4) description = '⚠ ANOMALY DETECTED: Tetraneutron.';

    return {
        z, a, symbol, name: baseName, halfLifeText: hlText,
        halfLifeSeconds: halfLife === 0 ? 0.00000001 : halfLife,
        decayModes: isStable ? [DecayMode.STABLE] : [mainMode],
        category, isStable, exists: isDatabaseEntry || category !== NuclideCategory.NON_EXISTENT,
        description
    };
};

export const getNuclideDataSync = (z: number, a: number): NuclideData => {
    initCache();
    const cached = nuclideMap.get(`${z}-${a}`);
    if (cached) {
        return createNuclide(z, a, cached.cat, cached.mode, cached.hl, cached.cat === NuclideCategory.STABLE, true);
    }
    return createNuclide(z, a, NuclideCategory.NON_EXISTENT, DecayMode.UNKNOWN, 0, false, false);
};

export const getValidAsForZ = (z: number): number[] => {
    initCache();
    const validAs: number[] = [];
    for (const key of nuclideMap.keys()) {
        const [kZ, kA] = key.split('-').map(Number);
        if (kZ === z) validAs.push(kA);
    }
    return validAs;
};
